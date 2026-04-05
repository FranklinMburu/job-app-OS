import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, updateDoc, deleteDoc, Timestamp, getDocFromServer, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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
      providerInfo: auth.currentUser?.providerData.map(provider => ({
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
    await setDoc(jobRef, {
      ...job,
      uid,
      captured_at: Timestamp.now(),
      status: job.status || 'captured'
    });
    return jobRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateJobStatus = async (jobId: string, status: string) => {
  const path = `jobs/${jobId}`;
  try {
    await updateDoc(doc(db, 'jobs', jobId), { status });
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
