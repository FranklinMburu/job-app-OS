import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, updateDoc, deleteDoc, Timestamp, getDocFromServer, writeBatch, addDoc, orderBy } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ExtractedJob, JobStatus } from '../types';
import { trackingService } from '../services/trackingService';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

// Auth Helpers
let isSigningIn = false;
export const signIn = async () => {
  if (isSigningIn) return;
  isSigningIn = true;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    // Ignore benign errors
    if (
      error.code === 'auth/cancelled-popup-request' || 
      error.code === 'auth/popup-closed-by-user'
    ) {
      return;
    }
    console.error("Auth Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const signOut = () => auth.signOut();

// Data Helpers
export const saveUserProfile = async (uid: string, profile: any) => {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), {
      ...profile,
      uid,
      updated_at: Timestamp.now()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getUserProfile = async (uid: string) => {
  const path = `users/${uid}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', uid));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const saveJob = async (uid: string, job: any) => {
  const path = 'jobs';
  try {
    const jobRef = doc(collection(db, 'jobs'));
    
    // Explicitly pick allowed fields to avoid "Missing or insufficient permissions" 
    // caused by extraneous fields from AI hallucination
    const sanitizedJob = {
      uid,
      title: job.title ?? null,
      company: job.company ?? null,
      summary: job.summary ?? null,
      location: job.location ?? null,
      employment_type: job.employment_type ?? null,
      remote_policy: job.remote_policy ?? null,
      application_url: job.application_url ?? null,
      deadline: job.deadline ?? null,
      source_type: job.source_type || 'text',
      source_label: job.source_label ?? null,
      source_url: job.source_url ?? null,
      raw_content: job.raw_content ?? null,
      captured_at: Timestamp.now(),
      status: job.status || 'saved',
      requirements: job.requirements || [],
      required_skills: job.required_skills || [],
      preferred_skills: job.preferred_skills || [],
      experience_years_required: job.experience_years_required ?? null,
      seniority: job.seniority ?? null,
      application_method: job.application_method ?? null,
      application_email: job.application_email ?? null,
      salary_info: job.salary_info ?? null,
      raw_excerpt: job.raw_excerpt ?? null,
      missing_fields: job.missing_fields || [],
      extraction_confidence: job.extraction_confidence ?? null,
      postgres_id: job.postgres_id ?? null,
      model_output: job.model_output ?? null
    };

    await setDoc(jobRef, sanitizedJob);

    // Sync with Tracking Backend (Postgres or Local)
    try {
      await trackingService.createJob({
        uid,
        title: sanitizedJob.title,
        company: sanitizedJob.company,
        status: sanitizedJob.status,
        firestore_id: jobRef.id,
        extra_data: { 
          location: sanitizedJob.location,
          source_url: sanitizedJob.source_url
        }
      });
    } catch (syncError) {
      console.error("Failed to sync job to tracking backend:", syncError);
    }

    return jobRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateJobStatus = async (jobId: string, status: JobStatus, postgresId?: number) => {
  const path = `jobs/${jobId}`;
  try {
    await updateDoc(doc(db, 'jobs', jobId), { status });
    
    // Sync with Postgres if ID is available
    if (postgresId) {
      try {
        const token = await auth.currentUser?.getIdToken();
        await trackingService.updateStatus(postgresId, status, jobId, token);
      } catch (pgError) {
        console.error("Failed to sync status to Postgres:", pgError);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const updateJob = async (jobId: string, job: Partial<ExtractedJob>) => {
  const path = `jobs/${jobId}`;
  try {
    const jobRef = doc(db, 'jobs', jobId);
    const allowedFields = [
      'title', 'company', 'summary', 'location', 'employment_type', 
      'remote_policy', 'application_url', 'deadline', 'source_type', 
      'source_label', 'source_url', 'raw_content', 'status', 'requirements', 
      'required_skills', 'preferred_skills', 'experience_years_required', 
      'seniority', 'application_method', 'application_email', 
      'salary_info', 'raw_excerpt', 'missing_fields', 'extraction_confidence',
      'analysis', 'interview_prep', 'analysis_at', 'analysis_profile_at', 'postgres_id'
    ];
    
    const updateData: any = {};
    Object.keys(job).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = (job as any)[key];
      }
    });

    await updateDoc(jobRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const saveApplication = async (uid: string, jobId: string, application: any) => {
  const path = 'applications';
  try {
    const appRef = doc(collection(db, 'applications'));
    await setDoc(appRef, {
      ...application,
      uid,
      job_id: jobId,
      applied_at: Timestamp.now()
    });
    return appRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteJob = async (jobId: string) => {
  const path = `jobs/${jobId}`;
  try {
    await deleteDoc(doc(db, 'jobs', jobId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const deleteApplication = async (appId: string) => {
  const path = `applications/${appId}`;
  try {
    await deleteDoc(doc(db, 'applications', appId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const bulkDeleteJobs = async (jobIds: string[]) => {
  const batch = writeBatch(db);
  jobIds.forEach(id => {
    batch.delete(doc(db, 'jobs', id));
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'jobs/bulk');
  }
};

export const bulkUpdateJobStatus = async (jobIds: string[], status: string) => {
  const batch = writeBatch(db);
  jobIds.forEach(id => {
    batch.update(doc(db, 'jobs', id), { status });
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'jobs/bulk');
  }
};

export const bulkDeleteApplications = async (appIds: string[]) => {
  const batch = writeBatch(db);
  appIds.forEach(id => {
    batch.delete(doc(db, 'applications', id));
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'applications/bulk');
  }
};

export const saveChatHistory = async (uid: string, prompt: string, response: any, type: string, metadata: any = {}) => {
  const path = 'chat_history';
  try {
    await addDoc(collection(db, path), {
      uid,
      prompt,
      response,
      type,
      metadata,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getChatHistory = (uid: string, callback: (history: any[]) => void) => {
  const path = 'chat_history';
  const q = query(
    collection(db, path),
    where('uid', '==', uid),
    orderBy('timestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(history);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const deleteChatHistory = async (id: string) => {
  const path = `chat_history/${id}`;
  try {
    await deleteDoc(doc(db, 'chat_history', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const saveGeneratedCV = async (uid: string, cv: any) => {
  const path = 'cv_history';
  try {
    const cvRef = cv.id ? doc(db, 'cv_history', cv.id) : doc(collection(db, 'cv_history'));
    const data = {
      ...cv,
      uid,
      generated_at: cv.generated_at || Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    // Remote id from the body before saving to avoid redundancy
    const { id, ...finalDoc } = data;
    
    await setDoc(cvRef, finalDoc, { merge: true });
    return cvRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const saveAILog = async (log: any) => {
  const path = 'ai_logs';
  try {
    await addDoc(collection(db, path), {
      ...log,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    // We don't want to crash the app if logging fails, but we should know
    console.error("AI Logging Failed:", error);
  }
};

export const getGeneratedCVs = (uid: string, callback: (cvs: any[]) => void) => {
  const path = 'cv_history';
  const q = query(
    collection(db, path),
    where('uid', '==', uid),
    orderBy('generated_at', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const deleteGeneratedCV = async (id: string) => {
  const path = `cv_history/${id}`;
  try {
    await deleteDoc(doc(db, 'cv_history', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const saveCoverLetter = async (letter: any) => {
  const path = 'cover_letters';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...letter,
      generated_at: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getCoverLetters = (uid: string, callback: (letters: any[]) => void) => {
  const path = 'cover_letters';
  const q = query(
    collection(db, path),
    where('uid', '==', uid),
    orderBy('generated_at', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const deleteCoverLetter = async (id: string) => {
  const path = `cover_letters/${id}`;
  try {
    await deleteDoc(doc(db, 'cover_letters', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
