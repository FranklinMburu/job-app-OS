/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Search, 
  PenTool,
  Send, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft,
  ArrowRight,
  Link as LinkIcon, 
  Type, 
  Image as ImageIcon,
  Cpu,
  Zap,
  ShieldCheck,
  Target,
  Clock,
  Briefcase,
  MapPin,
  Globe,
  Mail,
  ExternalLink,
  Plus,
  X,
  Menu,
  Inbox,
  History,
  LogOut,
  LogIn,
  Copy,
  Trash2,
  Calendar,
  LayoutDashboard,
  Activity,
  TrendingUp,
  Users,
  ArrowUpRight,
  Settings,
  Square,
  CheckSquare,
  Upload,
  Filter,
  FileText,
  Download,
  Check,
  FileCheck,
  Database,
  Eye,
  Bell,
  Terminal,
  MessageSquare
} from 'lucide-react';
import { RawDataViewer } from './components/RawDataViewer';
import { ChatHistoryView } from './components/ChatHistoryView';
import { ExtractionAuditView } from './components/ExtractionAuditView';
import { CVArtifactView } from './components/CVArtifactView';
import { CVHistoryView } from './components/CVHistoryView';
import { StandaloneCVBuilder } from './components/StandaloneCVBuilder';
import { StructureIntelligence } from './components/StructureIntelligence';
import ReactMarkdown from 'react-markdown';
import { 
  Sun, 
  Moon,
  Layout,
  FileCode,
  FileDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  Cell
} from 'recharts';
import { 
  SourceType, 
  ExtractionConfidence, 
  OutputMode, 
  Tone, 
  UserProfile, 
  ExtractedJob, 
  Verdict, 
  JobAnalysis,
  JobStatus,
  GeneratedApplication,
  GeneratedCV,
  ApplyRecommendation,
  Confidence
} from './types';
import { trackingService, JobTrackingRecord } from './services/trackingService';
import { GlassCard, NeonButton, FuturisticInput, FuturisticTextarea, cn } from './components/UI';
import { 
  auth, 
  signIn, 
  signOut, 
  saveUserProfile, 
  getUserProfile, 
  saveJob, 
  updateJobStatus, 
  updateJob,
  saveApplication,
  deleteJob,
  deleteApplication,
  bulkDeleteJobs,
  bulkUpdateJobStatus,
  bulkDeleteApplications,
  saveChatHistory,
  getChatHistory,
  deleteChatHistory,
  saveGeneratedCV,
  getGeneratedCVs,
  deleteGeneratedCV,
  db,
  handleFirestoreError,
  OperationType
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, getDoc, doc, Timestamp } from 'firebase/firestore';
import { aiService } from './services/aiService';

const API_BASE = '/backend-v2060';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
          <GlassCard className="max-w-md w-full space-y-6 border-red-500/30">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle size={32} />
              <h1 className="text-2xl font-bold uppercase tracking-tighter">System Error</h1>
            </div>
            <p className="text-sm text-white/60 font-mono">
              A critical exception has occurred in the neural link.
            </p>
            <div className="p-4 rounded bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-400 overflow-auto max-h-40">
              {this.state.error?.message || "Unknown error"}
            </div>
            <NeonButton variant="blue" className="w-full" onClick={() => window.location.reload()}>
              Reboot System
            </NeonButton>
          </GlassCard>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [step, setStep] = useState<'landing' | 'dashboard' | 'profile' | 'capture' | 'results' | 'inbox' | 'applications' | 'logs' | 'database' | 'tracking' | 'history' | 'archive' | 'cv_history' | 'cv_artifact' | 'cv_builder'>('landing');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [loading, setLoading] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [debugText, setDebugText] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [rawDataJob, setRawDataJob] = useState<ExtractedJob | null>(null);

  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'admins', user.uid)).then(snap => {
        setIsAdmin(snap.exists());
      });
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Data State
  const [profile, setProfile] = useState<UserProfile>({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    target_roles: [],
    skills: [],
    years_of_experience: '0',
    experience_summary: '',
    preferred_industries: [],
    cv_text: '',
    tone_preference: Tone.professional,
    linkedin_url: '',
    portfolio_url: ''
  });
  const [newSkill, setNewSkill] = useState('');
  
  const [captureInput, setCaptureInput] = useState({
    type: SourceType.text,
    value: ''
  });

  const [extractedJob, setExtractedJob] = useState<ExtractedJob | null>(null);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [generatedApp, setGeneratedApp] = useState<GeneratedApplication | null>(null);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [systemContent, setSystemContent] = useState<any>(null);
  const [appTone, setAppTone] = useState<Tone>(Tone.professional);
  const [appMode, setAppMode] = useState<OutputMode>(OutputMode.email);
  const [loadingCV, setLoadingCV] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [returnStep, setReturnStep] = useState<string | null>(null);
  const [viewingJobIdForArtifacts, setViewingJobIdForArtifacts] = useState<string | null>(null);

  // Firestore Data
  const [jobs, setJobs] = useState<ExtractedJob[]>([]);
  const [applications, setApplications] = useState<GeneratedApplication[]>([]);
  const [trackingRecords, setTrackingRecords] = useState<JobTrackingRecord[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [cvHistory, setCvHistory] = useState<GeneratedCV[]>([]);

  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [inboxFilter, setInboxFilter] = useState<JobStatus | 'all'>('all');
  const [selectedCV, setSelectedCV] = useState<GeneratedCV | null>(null);
  const [showStructureIntelligence, setShowStructureIntelligence] = useState(false);
  const [rawJobText, setRawJobText] = useState('');

  const handleUpdateJobStatus = async (jobId: string, status: JobStatus) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    setLoading(true);
    try {
      await updateJobStatus(jobId, status, job.postgres_id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'stats'), (snap) => {
      if (snap.exists()) {
        setSystemStats(snap.data());
      } else {
        // Fallback to initial if not in DB yet
        setSystemStats({
          nodes: "2,060+",
          jobs: "1.2M",
          success: "98.4%",
          latency: "14ms"
        });
      }
    }, (error) => {
      console.error("System stats fetch error:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'content'), (snap) => {
      if (snap.exists()) {
        setSystemContent(snap.data());
      } else {
        setSystemContent({
          loading_messages: [
            "Analyzing neural patterns in job requirements...",
            "Cross-referencing your skills with the future of work...",
            "Synthesizing optimal application strategy...",
            "Extracting core essence from the job description...",
            "Aligning career trajectories with market demands...",
          ],
          features: [
            { 
              title: "Smart Capture", 
              desc: "AI-powered extraction from any URL, text, or visual data stream.",
              icon: "Search",
              color: "blue"
            },
            { 
              title: "AI Matching", 
              desc: "Advanced gap analysis against your unique professional profile.",
              icon: "Target",
              color: "orange"
            },
            { 
              title: "Instant Apply", 
              desc: "Synthesize high-conversion application content in milliseconds.",
              icon: "Zap",
              color: "purple"
            }
          ]
        });
      }
    }, (error) => {
      console.error("System content fetch error:", error);
    });
    return () => unsub();
  }, []);

  // Theme Effect
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        if (step === 'landing') {
          setStep('dashboard');
        }
      } else {
        setStep('landing');
      }
    });
    return () => unsubscribe();
  }, [step]);

  useEffect(() => {
    setSelectedJobIds([]);
    setSelectedAppIds([]);
  }, [step]);

  useEffect(() => {
    if (isAdmin && step === 'logs') {
      const q = query(collection(db, 'ai_logs'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setAiLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'ai_logs');
      });
      return () => unsubscribe();
    }
  }, [isAdmin, step]);

  const activityData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayName = days[d.getDay()];
      const dayStart = new Date(d.setHours(0, 0, 0, 0)).getTime();
      const dayEnd = new Date(d.setHours(23, 59, 59, 999)).getTime();
      
      const dayJobs = jobs.filter(j => {
        const capturedAt = j.captured_at?.seconds ? j.captured_at.seconds * 1000 : 
                          j.captured_at instanceof Date ? j.captured_at.getTime() : 0;
        return capturedAt >= dayStart && capturedAt <= dayEnd;
      }).length;
      
      const dayApps = applications.filter(a => {
        const appliedAt = a.applied_at?.seconds ? a.applied_at.seconds * 1000 : 
                         a.applied_at instanceof Date ? a.applied_at.getTime() : 0;
        return appliedAt >= dayStart && appliedAt <= dayEnd;
      }).length;
      
      data.push({ name: dayName, apps: dayApps, captures: dayJobs });
    }
    return data;
  }, [jobs, applications]);

  const jobTrend = useMemo(() => {
    const now = new Date().getTime();
    const week = 7 * 24 * 60 * 60 * 1000;
    
    const currentWeek = jobs.filter(item => {
      const ts = (item as any).captured_at?.seconds || (item as any).applied_at?.seconds;
      return ts && (ts * 1000) > (now - week);
    }).length;
    
    const lastWeek = jobs.filter(item => {
      const ts = (item as any).captured_at?.seconds || (item as any).applied_at?.seconds;
      return ts && (ts * 1000) > (now - 2 * week) && (ts * 1000) <= (now - week);
    }).length;
    
    if (lastWeek === 0) return currentWeek > 0 ? `+${currentWeek}` : "0%";
    const diff = ((currentWeek - lastWeek) / lastWeek) * 100;
    return `${diff >= 0 ? '+' : ''}${Math.round(diff)}%`;
  }, [jobs]);

  const appTrend = useMemo(() => {
    const now = new Date().getTime();
    const week = 7 * 24 * 60 * 60 * 1000;
    
    const currentWeek = applications.filter(item => {
      const ts = (item as any).captured_at?.seconds || (item as any).applied_at?.seconds;
      return ts && (ts * 1000) > (now - week);
    }).length;
    
    const lastWeek = applications.filter(item => {
      const ts = (item as any).captured_at?.seconds || (item as any).applied_at?.seconds;
      return ts && (ts * 1000) > (now - 2 * week) && (ts * 1000) <= (now - week);
    }).length;
    
    if (lastWeek === 0) return currentWeek > 0 ? `+${currentWeek}` : "0%";
    const diff = ((currentWeek - lastWeek) / lastWeek) * 100;
    return `${diff >= 0 ? '+' : ''}${Math.round(diff)}%`;
  }, [applications]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signIn();
    } catch (err: any) {
      setError(err.message || "Failed to connect neural link.");
    } finally {
      setAuthLoading(false);
    }
  };
  useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then(p => {
        if (p) setProfile(p as UserProfile);
      });
    }
  }, [user]);

  // Firestore Sync Effect
  useEffect(() => {
    if (!user) {
      setJobs([]);
      setApplications([]);
      return;
    }

    const jobsQuery = query(
      collection(db, 'jobs'), 
      where('uid', '==', user.uid),
      orderBy('captured_at', 'desc')
    );
    const unsubJobs = onSnapshot(jobsQuery, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExtractedJob)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'jobs');
    });

    const appsQuery = query(
      collection(db, 'applications'), 
      where('uid', '==', user.uid),
      orderBy('applied_at', 'desc')
    );
    const unsubApps = onSnapshot(appsQuery, (snap) => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() } as GeneratedApplication)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'applications');
    });

    const cvQuery = query(
      collection(db, 'cv_history'),
      where('uid', '==', user.uid),
      orderBy('generated_at', 'desc')
    );
    const unsubCV = onSnapshot(cvQuery, (snap) => {
      setCvHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as GeneratedCV)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'cv_history');
    });

    return () => {
      unsubJobs();
      unsubApps();
      unsubCV();
    };
  }, [user]);

  // Postgres Tracking Sync
  useEffect(() => {
    if (user && (step === 'dashboard' || step === 'tracking')) {
      user.getIdToken().then(token => {
        trackingService.getJobs(user.uid, token)
          .then(setTrackingRecords)
          .catch(err => console.error("Failed to fetch tracking records:", err));
      });
    }
  }, [user, step, jobs]);

  // Chat History Sync
  useEffect(() => {
    if (user) {
      const unsub = getChatHistory(user.uid, setChatHistory);
      return () => unsub();
    }
  }, [user]);

  // Loading messages for AI tasks
  const loadingMessages = systemContent?.loading_messages || [
    "Analyzing neural patterns in job requirements...",
    "Cross-referencing your skills with the future of work...",
    "Synthesizing optimal application strategy...",
    "Extracting core essence from the job description...",
    "Aligning career trajectories with market demands...",
    "Generating high-impact communication protocols..."
  ];

  useEffect(() => {
    if (step === 'results' && extractedJob?.id) {
      // Find the latest job data from the synced list
      const currentJob = jobs.find(j => j.id === extractedJob.id);
      if (currentJob?.analysis) {
        setAnalysis(currentJob.analysis);
      } else if (!analysis && !loadingAnalysis) {
        handleAnalyze(extractedJob);
      }

      // Find the latest application for this job
      const lastApp = applications.find(a => a.job_id === extractedJob.id);
      if (lastApp && !generatedApp) {
        setGeneratedApp(lastApp);
      }
    }
  }, [step, extractedJob?.id, jobs, applications]);
  
  useEffect(() => {
    let interval: any;
    if (loading || loadingAnalysis) {
      let i = 0;
      setLoadingMessage(loadingMessages[0]);
      interval = setInterval(() => {
        i = (i + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[i]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading, loadingAnalysis, loadingMessages]);

  const handleReRun = (item: any) => {
    if (item.type === 'extraction') {
      setCaptureInput({
        type: item.metadata?.sourceType || SourceType.text,
        value: item.prompt
      });
      setStep('capture');
    } else if (item.type === 'analysis' || item.type === 'generation' || item.type === 'follow_up') {
      const job = jobs.find(j => j.id === item.metadata?.jobId);
      if (job) {
        setExtractedJob(job);
        if (item.type === 'analysis') {
          handleAnalyze(job);
        } else {
          setAnalysis(job.analysis || null);
          setStep('results');
        }
      } else {
        setError("Original job data not found. Please re-capture the job.");
      }
    }
  };

  // API Calls
  const handleExtract = async () => {
    if (!captureInput.value) {
      setError('Please provide a job description, URL, or image.');
      return;
    }

    if (captureInput.type === SourceType.link && !captureInput.value.startsWith('http')) {
      setError('Please provide a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);
    setError(null);
    setDebugText(null);
    setAnalysis(null);
    setGeneratedApp(null);
    try {
      let content = captureInput.value;

      // Handle URL fetching
      if (captureInput.type === SourceType.link) {
        const res = await fetch(`${API_BASE}/fetch-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: captureInput.value })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.detail || 'Failed to fetch job page');
        }
        content = data.content;
        setDebugText(content.substring(0, 500) + '...');
      }

      // Use AI Service for extraction
      const result = await aiService.extractJob(content, captureInput.type);
      const data = result.normalized_job;
      
      if (captureInput.type === SourceType.link) {
        data.source_url = captureInput.value;
      }
      setExtractedJob(data);

      // Save to History
      if (user) {
        saveChatHistory(user.uid, captureInput.value, result, 'extraction', { sourceType: captureInput.type });
      }

      // Save to Firestore if logged in
      if (user) {
        const jobId = await saveJob(user.uid, data);
        data.id = jobId;
      }
      
      // Auto-analyze if profile is ready
      if (profile.cv_text.length > 50) {
        await handleAnalyze(data);
      }
      
      setStep('results');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSynthesizeProfile = async () => {
    if (profile.cv_text.length < 50) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiService.synthesizeProfile(profile.cv_text);
      
      // Save to History
      if (user) {
        saveChatHistory(user.uid, `Synthesize profile from CV (${profile.cv_text.length} chars)`, data, 'synthesis', { cvLength: profile.cv_text.length });
      }

      setProfile(prev => ({
        ...prev,
        ...data,
        cv_text: prev.cv_text // Keep the original CV text
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      signIn();
      return;
    }
    setLoading(true);
    try {
      await saveUserProfile(user.uid, profile);
      
      // Intelligent Navigation: Return to previous context if it exists
      if (returnStep) {
        // If we came from results, the extractedJob should still be in state
        if (returnStep === 'results' && extractedJob) {
          // Trigger a re-analysis automatically as profile has changed
          handleAnalyze(extractedJob);
        }
        setStep(returnStep as any);
        setReturnStep(null);
      } else {
        setStep('capture');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApplication = async () => {
    if (!user || !generatedApp || !extractedJob) return;
    setLoading(true);
    try {
      await saveApplication(user.uid, extractedJob.id || 'unknown', generatedApp);
      const newStatus = generatedApp.subject?.startsWith('Follow-up:') ? JobStatus.follow_up : JobStatus.applied;
      await updateJobStatus(extractedJob.id || 'unknown', newStatus, extractedJob.postgres_id);
      setStep('applications');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdateJobStatus = async (jobIds: string[], status: JobStatus) => {
    setLoading(true);
    try {
      await bulkUpdateJobStatus(jobIds, status);
      setSelectedJobIds([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await deleteJob(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    try {
      await deleteApplication(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBulkDeleteJobs = async () => {
    if (selectedJobIds.length === 0) return;
    setLoading(true);
    try {
      await bulkDeleteJobs(selectedJobIds);
      setSelectedJobIds([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMarkAsApplied = async () => {
    if (selectedJobIds.length === 0) return;
    setLoading(true);
    try {
      await bulkUpdateJobStatus(selectedJobIds, JobStatus.applied);
      setSelectedJobIds([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeleteApps = async () => {
    if (selectedAppIds.length === 0) return;
    setLoading(true);
    try {
      await bulkDeleteApplications(selectedAppIds);
      setSelectedAppIds([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (job: ExtractedJob) => {
    if (loadingAnalysis) return;
    
    // Check for cached analysis
    const isProfileUnchanged = job.analysis_profile_at && profile.updated_at && 
      (typeof job.analysis_profile_at.toMillis === 'function' ? job.analysis_profile_at.toMillis() : job.analysis_profile_at) === 
      (typeof profile.updated_at.toMillis === 'function' ? profile.updated_at.toMillis() : profile.updated_at);

    if (job.analysis && isProfileUnchanged) {
      console.log("[AI Fit Match] Using cached analysis for job:", job.title);
      setAnalysis(job.analysis);
      return;
    }

    console.log("[AI Fit Match] Starting fresh analysis for job:", job.title);
    setLoadingAnalysis(true);
    setError(null);
    setAnalysis(null);
    try {
      const data = await aiService.analyzeJob(job, profile);
      console.log("[AI Fit Match] Analysis data received:", data);
      setAnalysis(data);

      // Save to History
      if (user) {
        saveChatHistory(user.uid, `Analyze fit for ${job.title} at ${job.company}`, data, 'analysis', { jobId: job.id, jobTitle: job.title });
      }
      if (job.id) {
        await updateJob(job.id, {
          analysis: data,
          analysis_at: Timestamp.now(),
          analysis_profile_at: profile.updated_at || null,
          status: JobStatus.analyzed
        });
      }
    } catch (err: any) {
      setError(err.message);
      console.error("[AI Fit Match] Troubleshooting Info:", err);
    } finally {
      setLoadingAnalysis(false);
      console.log("[AI Fit Match] Analysis process completed.");
    }
  };

  const handleGenerate = async () => {
    if (!extractedJob || !analysis) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiService.generateApplication(
        extractedJob,
        analysis,
        profile,
        appMode,
        appTone
      );
      setGeneratedApp(data);

      // Save to History
      if (user) {
        saveChatHistory(user.uid, `Generate ${appMode} for ${extractedJob.title} (${appTone} tone)`, data, 'generation', { jobId: extractedJob.id, jobTitle: extractedJob.title, mode: appMode, tone: appTone });
      }
      if (extractedJob?.id) {
        await updateJobStatus(extractedJob.id, JobStatus.apply_now, extractedJob.postgres_id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCV = async (jobOverride?: ExtractedJob) => {
    const job = jobOverride || extractedJob;
    if (!job || !profile || !user) return;
    
    // Gap Analysis: Ensure base profile exists
    if (!profile.cv_text || profile.cv_text.length < 50) {
      setError("Incomplete profile. Please add your professional background in the Profile section before tailoring a CV.");
      return;
    }

    setLoadingCV(true);
    try {
      const cvResult = await aiService.generateTailoredCV(job, profile);
      const cvData = {
        job_id: job.id || 'direct_build',
        markdown_content: cvResult.markdown_content,
        tailored_to: `${job.title} at ${job.company}`
      };
      
      const id = await saveGeneratedCV(user.uid, cvData);
      const completeCV: GeneratedCV = {
        ...cvData,
        id,
        uid: user.uid,
        generated_at: new Date()
      };
      setSelectedCV(completeCV);
      setStep('cv_artifact');
      setViewingJobIdForArtifacts(null);
    } catch (err: any) {
      console.error("CV Generation Fail:", err);
      setError("Failed to generate tailored CV artifact.");
    } finally {
      setLoadingCV(false);
    }
  };

  const handleDeleteCV = async (id: string) => {
    try {
      await deleteGeneratedCV(id);
      if (selectedCV?.id === id) setSelectedCV(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const handleFollowUp = async (job: ExtractedJob, app: GeneratedApplication) => {
    setLoading(true);
    try {
      const data = await aiService.generateFollowUp(job, profile, app);
      
      // Save to History
      if (user) {
        saveChatHistory(user.uid, `Generate follow-up for ${job.title}`, data, 'follow_up', { jobId: job.id, jobTitle: job.title });
      }
      
      // Create a temporary "application" object to show in results
      const followUpApp: GeneratedApplication = {
        ...data,
        subject: data.subject || `Follow-up: ${app.subject}`,
        output_mode: OutputMode.email,
        generation_confidence: ExtractionConfidence.high
      };
      setGeneratedApp(followUpApp);
      setExtractedJob(job);
      setStep('results');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill && !profile.skills.includes(newSkill)) {
      setProfile({ ...profile, skills: [...profile.skills, newSkill] });
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setProfile({ ...profile, skills: profile.skills.filter(s => s !== skill) });
  };

  // Render Helpers
  const renderBadge = (text: string, color: string = 'blue') => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-${color}-500/30 bg-${color}-500/10 text-${color}-400`}>
      {text}
    </span>
  );

  const renderAppView = () => {
    switch (step) {
      case 'dashboard':
        return (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight uppercase">COMMAND <span className="text-neon-blue">CENTER</span></h2>
                <p className="text-white/40 text-sm italic">Authenticated secure node processing {jobs.length} operations.</p>
              </div>
              <div className="flex gap-3">
                <NeonButton variant="blue" onClick={() => setStep('capture')}>
                  <Plus size={18} className="mr-2" /> New Capture
                </NeonButton>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Total Captured", value: jobs.length, icon: <Inbox className="text-neon-blue" />, trend: jobTrend, color: "blue", action: () => setStep('inbox') },
                { label: "Compiled Artifacts", value: cvHistory.length, icon: <Cpu className="text-neon-purple" />, trend: "Compiler Results", color: "purple", action: () => setStep('cv_history') },
                { label: "Follow-ups Needed", value: jobs.filter(j => j.status === JobStatus.follow_up).length, icon: <Mail className="text-neon-orange" />, trend: "Active", color: "orange", action: () => { setInboxFilter(JobStatus.follow_up); setStep('inbox'); } },
                { label: "Profile Status", value: `${Math.min(100, Math.round((profile.cv_text.length / 500) * 100))}%`, icon: <User className="text-neon-blue" />, trend: profile.cv_text.length >= 500 ? "Sync Complete" : "Profile Incomplete", color: "blue", action: () => setStep('profile') }
              ].map((metric, i) => (
                <GlassCard 
                  key={i} 
                  className="p-6 space-y-4 cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all group border-white/5"
                  onClick={metric.action}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      {metric.icon}
                    </div>
                    <span className="text-[10px] font-mono text-green-400/70">{metric.trend}</span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold tracking-widest text-white/30 group-hover:text-white/60 transition-colors">{metric.label}</p>
                    <h3 className="text-3xl font-black tracking-tighter group-hover:text-neon-blue transition-colors">{metric.value}</h3>
                  </div>
                </GlassCard>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Activity Chart */}
              <GlassCard className="lg:col-span-8 p-8 space-y-6 border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black tracking-[0.2em] uppercase text-white/40 flex items-center gap-2">
                    <TrendingUp size={16} className="text-neon-blue" /> ARCHIVE PERFORMANCE
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData}>
                      <defs>
                        <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff10" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ffffff10" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff05', borderRadius: '12px', fontSize: '10px' }}
                        itemStyle={{ color: '#00f2ff' }}
                      />
                      <Area type="monotone" dataKey="captures" stroke="#00f2ff" fillOpacity={1} fill="url(#colorApps)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Quick Actions & Recent */}
              <div className="lg:col-span-4 space-y-6">
                <GlassCard className="p-6 space-y-6 border-white/5">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Immediate Logistics</h3>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setStep('capture')}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-neon-blue/30 hover:bg-neon-blue/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Zap size={18} className="text-neon-blue" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Capture Link</span>
                      </div>
                      <ArrowUpRight size={14} className="text-white/10 group-hover:text-neon-blue" />
                    </button>
                    <button 
                      onClick={() => setStep('cv_builder')}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-neon-teal/30 hover:bg-neon-teal/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <PenTool size={18} className="text-neon-blue" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Standalone Builder</span>
                      </div>
                      <ArrowUpRight size={14} className="text-white/10 group-hover:text-neon-blue" />
                    </button>
                    <button 
                      onClick={() => setStep('profile')}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-neon-purple/30 hover:bg-neon-purple/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <User size={18} className="text-neon-purple" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Verify Identity</span>
                      </div>
                      <ArrowUpRight size={14} className="text-white/10 group-hover:text-neon-purple" />
                    </button>
                  </div>
                </GlassCard>

                <GlassCard className="p-6 space-y-6 border-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Latest Syncs</h3>
                    <button onClick={() => setStep('inbox')} className="text-[9px] font-black text-neon-blue uppercase tracking-widest">Show All</button>
                  </div>
                  <div className="space-y-4">
                    {jobs.slice(0, 3).map(job => (
                      <div 
                        key={job.id} 
                        className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 group cursor-pointer hover:border-white/20 transition-all" 
                        onClick={() => { setExtractedJob(job); setStep('results'); }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 group-hover:text-neon-blue transition-colors shrink-0">
                          <Briefcase size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold truncate transition-colors uppercase tracking-tight">{job.title}</p>
                          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] truncate italic">{job.company}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            </div>
          </motion.div>
        );
      case 'capture':
        return (
          <motion.div 
            key="capture"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="max-w-2xl mx-auto space-y-8 pt-12"
          >
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black tracking-tighter uppercase leading-none italic">JOB <br/><span className="text-neon-blue">CAPTURE</span></h2>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Paste job details or a link to save it to your database.</p>
            </div>

            <GlassCard className="p-0 overflow-hidden bg-[#0a0a0a]/50">
              <div className="flex border-b border-white/5">
                {[
                  { id: SourceType.text, label: 'RAW TEXT', icon: <Type size={14} /> },
                  { id: SourceType.link, label: 'LINK FEED', icon: <LinkIcon size={14} /> },
                  { id: SourceType.image, label: 'IMAGE SENSOR', icon: <ImageIcon size={14} /> }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setCaptureInput({ ...captureInput, type: type.id as SourceType })}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                      captureInput.type === type.id 
                        ? "bg-white/5 text-neon-blue border-b-2 border-neon-blue" 
                        : "text-white/30 hover:text-white/60"
                    )}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>

              <div className="p-8 space-y-6">
                {captureInput.type === SourceType.text ? (
                  <FuturisticTextarea
                    label="SYSTEM INPUT: RAW JOB DATA"
                    placeholder="Paste job description, requirements, or responsibilities..."
                    value={captureInput.value}
                    onChange={(e) => setCaptureInput({ ...captureInput, value: e.target.value })}
                    rows={12}
                  />
                ) : captureInput.type === SourceType.link ? (
                  <div className="space-y-4">
                    <FuturisticInput
                      label="NEURAL LINK: SOURCE URL"
                      placeholder="https://linkedin.com/jobs/view/..."
                      value={captureInput.value}
                      onChange={(e) => setCaptureInput({ ...captureInput, value: e.target.value })}
                    />
                    <div className="p-4 rounded-xl bg-neon-blue/5 border border-neon-blue/20 flex gap-4 items-start">
                      <div className="p-2 rounded-lg bg-neon-blue/20 text-neon-blue">
                         <Globe size={20} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neon-blue">Remote Synchronizer</p>
                        <p className="text-[11px] text-white/50 leading-relaxed italic">Directly extraction logic will attempt to pull clean metadata from the provided endpoint.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="relative group">
                      <input 
                        type="file" 
                        accept="image/*"
                        id="image-sensor-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCaptureInput({ ...captureInput, value: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor="image-sensor-upload"
                        className="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-white/10 rounded-2xl bg-white/5 hover:bg-white/10 hover:border-neon-blue/50 transition-all cursor-pointer group"
                      >
                        {captureInput.value && captureInput.value.startsWith('data:image') ? (
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10">
                            <img src={captureInput.value} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[10px] font-black uppercase tracking-widest text-white">Switch Image</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="p-4 rounded-full bg-neon-blue/10 text-neon-blue group-hover:scale-110 transition-transform">
                              <Upload size={32} />
                            </div>
                            <div className="text-center space-y-1">
                              <p className="text-xs font-bold uppercase tracking-tight">Upload Job Screenshot</p>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">PDF, PNG, JPG accepted for neural scanning.</p>
                            </div>
                          </>
                        )}
                      </label>
                    </div>
                    <div className="p-4 rounded-xl bg-neon-purple/5 border border-neon-purple/20 flex gap-4 items-start">
                      <div className="p-2 rounded-lg bg-neon-purple/20 text-neon-purple">
                         <Cpu size={20} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neon-purple">Vision Processor Ready</p>
                        <p className="text-[11px] text-white/50 leading-relaxed italic">Optical character recognition will attempt to reconstruct the job's neural structure from visual identifiers.</p>
                      </div>
                    </div>
                  </div>
                )}

                <NeonButton 
                  variant="blue" 
                  className="w-full py-6 text-md font-black italic tracking-tighter uppercase"
                  onClick={handleExtract}
                  isLoading={loading}
                  disabled={!captureInput.value.trim()}
                >
                  <Zap size={22} className="mr-3" /> Start Analysis
                </NeonButton>
              </div>
            </GlassCard>
            {loading && (
              <div className="text-center space-y-4">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-blue mx-auto animate-ping" />
                <p className="text-[10px] font-mono text-neon-blue uppercase tracking-[0.4em] animate-pulse">{loadingMessage}</p>
              </div>
            )}
          </motion.div>
        );
      case 'results':
        return extractedJob ? (
          <div key="results" className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/5">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-3 px-3 py-1 rounded bg-neon-blue/10 border border-neon-blue/20 text-neon-blue text-[8px] font-black uppercase tracking-widest">
                  Extraction Complete
                </div>
                <h1 className="text-6xl font-black tracking-tighter uppercase italic leading-none">{extractedJob.title}</h1>
                <p className="text-3xl text-neon-blue font-bold tracking-tighter uppercase">{extractedJob.company}</p>
              </div>
              <div className="flex gap-4">
                 <select 
                  value={extractedJob.status}
                  onChange={(e) => handleUpdateJobStatus(extractedJob.id!, e.target.value as JobStatus)}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/50 outline-none hover:bg-white/5 transition-all cursor-pointer"
                >
                  {Object.values(JobStatus).map(status => (
                    <option key={status} value={status} className="bg-[#050505]">{status.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
                <NeonButton variant="blue" onClick={() => setStep('inbox')} className="!px-6">
                  <Inbox size={18} className="mr-2" /> Operations Hub
                </NeonButton>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <GlassCard className="p-6 space-y-4 border-white/5">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
                       <Database size={12} /> JOB REQUIREMENTS
                    </h3>
                    <div className="space-y-3">
                      {extractedJob.requirements.map((req, i) => (
                        <div key={i} className="flex gap-3 items-start group">
                          <div className="w-1.5 h-1.5 rounded-full bg-neon-blue/20 mt-1.5 group-hover:bg-neon-blue" />
                          <p className="text-xs text-white/50 group-hover:text-white transition-colors">{req}</p>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                  <GlassCard className="p-6 space-y-4 border-white/5">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
                       <Cpu size={12} /> KEY SKILLS
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {extractedJob.required_skills.map((skill, i) => (
                        <span key={i} className="px-3 py-1.5 rounded bg-white/5 border border-white/5 text-[9px] font-black text-white/40 uppercase">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </GlassCard>
                </div>
                <GlassCard className="p-8 border-white/5 space-y-4">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">JOB DESCRIPTION</h3>
                  <p className="text-white/50 leading-relaxed italic text-lg font-medium">{extractedJob.summary || extractedJob.raw_content?.substring(0, 500)}</p>
                </GlassCard>

                {generatedApp && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <GlassCard glow="purple" className="p-8 space-y-6">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-neon-purple/10 flex items-center justify-center text-neon-purple">
                            <Mail size={20} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black uppercase italic tracking-tight">Synthesized Artifact</h3>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest">{appMode} // {appTone}</p>
                          </div>
                        </div>
                        <button onClick={() => setGeneratedApp(null)} className="text-white/20 hover:text-white"><X size={20}/></button>
                      </div>

                      <div className="space-y-6">
                        {generatedApp.subject && (
                          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Subject Line</span>
                            <p className="text-sm font-bold text-white/80">{generatedApp.subject}</p>
                          </div>
                        )}
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 max-h-[500px] overflow-y-auto futuristic-scroll prose-invert">
                           <div className="prose prose-invert prose-sm max-w-none prose-p:text-white/70 prose-headings:text-white prose-strong:text-neon-purple">
                            <ReactMarkdown>
                              {generatedApp.email_body || generatedApp.cover_note || generatedApp.short_fit_answer || ''}
                            </ReactMarkdown>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 pt-4">
                          <NeonButton 
                            variant="purple" 
                            className="flex-1 !py-4"
                            onClick={() => {
                              const text = generatedApp.email_body || generatedApp.cover_note || generatedApp.short_fit_answer || '';
                              navigator.clipboard.writeText(text);
                            }}
                          >
                            <Copy size={18} className="mr-2" /> Copy to Clipboard
                          </NeonButton>
                          <NeonButton 
                            variant="blue" 
                            className="flex-1 !py-4"
                            onClick={handleSaveApplication}
                            isLoading={loading}
                          >
                            <History size={18} className="mr-2" /> Commit to History
                          </NeonButton>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-6">
                {/* AI Fit Analysis */}
                <GlassCard glow={analysis?.verdict === Verdict.relevant ? 'blue' : analysis?.verdict === Verdict.maybe ? 'orange' : 'red'} className="p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-2">
                       <Target size={20} className="text-neon-blue" /> JOB MATCH
                    </h3>
                    {analysis && (
                       <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        analysis.verdict === Verdict.relevant ? "bg-green-500/10 border-green-500/30 text-green-400" :
                        analysis.verdict === Verdict.maybe ? "bg-orange-500/10 border-orange-500/30 text-orange-400" :
                        "bg-red-500/10 border-red-500/30 text-red-500"
                      )}>
                        {analysis.verdict}
                      </span>
                    )}
                  </div>

                  {!analysis ? (
                    <div className="py-12 text-center space-y-6">
                      {loadingAnalysis ? (
                        <>
                          <div className="w-12 h-12 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin mx-auto" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/30">{loadingMessage}</p>
                        </>
                      ) : (
                        <>
                          <Target size={48} className="mx-auto text-white/5" />
                          <div className="space-y-2">
                            <p className="text-sm font-bold text-white/60">Ready for Alignment</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest">Compare this job against your neural profile</p>
                          </div>
                          <NeonButton variant="blue" className="w-full py-4 uppercase font-black italic tracking-tighter" onClick={() => handleAnalyze(extractedJob)}>Run Alignment Check</NeonButton>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                         <div className="flex items-center gap-2 text-neon-blue">
                          <CheckCircle2 size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Compiler Suggestion</span>
                        </div>
                        <p className="text-md font-bold text-white/90 leading-tight uppercase italic">{analysis.apply_recommendation}</p>
                        <p className="text-xs text-white/50 leading-relaxed italic">{analysis.fit_summary}</p>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Strategic Strengths</h4>
                          <div className="space-y-2">
                            {analysis.reasons.map((reason, i) => (
                              <div key={i} className="flex gap-2 text-xs text-green-400/80 italic font-medium">
                                <span className="text-neon-blue">•</span> {reason}
                              </div>
                            ))}
                          </div>
                        </div>

                        {analysis.gaps.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Detected Anomalies</h4>
                            <div className="space-y-2">
                              {analysis.gaps.map((gap, i) => (
                                <div key={i} className="flex gap-2 text-xs text-orange-500/80 italic font-medium">
                                  <span className="text-neon-orange">•</span> {gap}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-8 border-t border-white/5 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-white/20 ml-1">Synthesis Mode</label>
                             <select 
                              value={appMode}
                              onChange={e => setAppMode(e.target.value as any)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/70 outline-none hover:border-white/20 transition-all cursor-pointer"
                            >
                               <option value={OutputMode.email} className="bg-[#0a0a0a]">Email Draft</option>
                               <option value={OutputMode.form_answers} className="bg-[#0a0a0a]">Form Responses</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-white/20 ml-1">Behavioral Tone</label>
                            <select 
                              value={appTone}
                              onChange={e => setAppTone(e.target.value as any)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/70 outline-none hover:border-white/20 transition-all cursor-pointer"
                            >
                               <option value={Tone.professional} className="bg-[#0a0a0a]">Professional</option>
                               <option value={Tone.confident} className="bg-[#0a0a0a]">Confident</option>
                               <option value={Tone.concise} className="bg-[#0a0a0a]">Concise</option>
                            </select>
                          </div>
                        </div>
                        <NeonButton 
                          variant="blue" 
                          className="w-full py-6 text-md font-black uppercase italic tracking-tighter"
                          onClick={handleGenerate}
                          isLoading={loading}
                        >
                          <Zap size={20} className="mr-2" /> Synthesize Artifact
                        </NeonButton>
                      </div>
                    </div>
                  )}
                </GlassCard>

                <GlassCard className="p-8 space-y-8 border-neon-purple/20 bg-neon-purple/5">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-2">
                      <Cpu size={20} className="text-neon-purple" /> CV BUILDER
                    </h3>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-white/30">Create a tailored version of your resume for this specific job.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NeonButton 
                      variant="purple" 
                      className="w-full py-6 text-md italic font-black uppercase tracking-tighter"
                      onClick={() => handleGenerateCV(extractedJob)}
                      isLoading={loadingCV}
                    >
                      <Download size={20} className="mr-2" /> Generate Tailored CV
                    </NeonButton>
                    <button 
                      onClick={() => setShowStructureIntelligence(true)}
                      className="w-full py-6 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={18} className="text-neon-blue" /> Verify Skeleton IQ
                    </button>
                  </div>
                  <div className="pt-4 border-t border-white/5 text-center">
                    <p className="text-[8px] font-mono text-white/20 uppercase tracking-[0.3em]">AI Resume Generator Ready</p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        ) : null;
      case 'cv_artifact':
        return <div className="flex items-center justify-center h-full text-white/20 uppercase text-[10px] font-black tracking-[0.2em]">Artifact Workspace Active</div>;
      case 'cv_history':
        return <CVHistoryView cvs={cvHistory} onSelect={(cv) => { setSelectedCV(cv); setStep('cv_artifact'); }} onDelete={handleDeleteCV} onViewJobHistory={(jobId) => setViewingJobIdForArtifacts(jobId)} />;
      case 'cv_builder':
        return <StandaloneCVBuilder 
          user={user} 
          profile={profile} 
          onCVSaved={(cv) => { setCvHistory([cv, ...cvHistory]); setSelectedCV(cv); setStep('cv_artifact'); }} 
          onVerifyStructure={() => setShowStructureIntelligence(true)}
        />;
      case 'tracking':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
             <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tighter uppercase italic leading-none">External <span className="text-neon-blue">Tracking</span></h2>
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">Direct Postgres mirror of your application status.</p>
              </div>
            </div>
            <GlassCard className="overflow-hidden border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/30">
                      <th className="p-4">ID</th>
                      <th className="p-4">Job / Company</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {trackingRecords.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-white/20 uppercase text-[10px] font-black">No external tracking data available.</td></tr>
                    ) : (
                      trackingRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-mono text-[10px] text-white/40">{rec.id}</td>
                          <td className="p-4">
                            <p className="text-xs font-bold uppercase">{rec.title}</p>
                            <p className="text-[10px] text-neon-blue uppercase">{rec.company}</p>
                          </td>
                          <td className="p-4">
                             <span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-black uppercase">{rec.status}</span>
                          </td>
                          <td className="p-4 text-[10px] text-white/20">{new Date(rec.captured_at).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        );
      case 'inbox':
        return (
          <JobsListView 
            jobs={jobs} 
            filter={inboxFilter} 
            onFilterChange={setInboxFilter} 
            onViewJob={(job: any) => { setExtractedJob(job); setStep('results'); }} 
            onUpdateStatus={handleUpdateJobStatus} 
            onDeleteJob={handleDeleteJob} 
            onBulkDelete={handleBulkDeleteJobs} 
            onBulkUpdateStatus={handleBulkUpdateJobStatus} 
            cvHistory={cvHistory} 
            onViewJobArtifacts={(jobId: string) => setViewingJobIdForArtifacts(jobId)} 
            onViewRaw={(job: any) => { setRawDataJob(job); setShowRawData(true); }}
          />
        );
      case 'applications':
        return (
          <ApplicationsListView 
            applications={applications} 
            jobs={jobs}
            onDeleteApplication={handleDeleteApplication} 
            onBulkDelete={handleBulkDeleteApps}
            setGeneratedApp={setGeneratedApp}
            setExtractedJob={setExtractedJob}
            setStep={setStep}
            handleFollowUp={handleFollowUp}
            onViewJobArtifacts={(jobId: string) => setViewingJobIdForArtifacts(jobId)}
          />
        );
      case 'profile':
        return <UserProfileView profile={profile} onSave={handleSaveProfile} onSyncWithCV={(text: string) => setProfile({ ...profile, cv_text: text })} />;
      case 'database':
        return (
          <DatabaseManager 
            jobs={jobs} 
            cvHistory={cvHistory} 
            updateJobStatus={handleUpdateJobStatus} 
            handleDeleteJob={handleDeleteJob} 
            setExtractedJob={setExtractedJob} 
            setStep={setStep} 
            setSelectedCV={setSelectedCV} 
            onViewRaw={(job: any) => { setRawDataJob(job); setShowRawData(true); }}
          />
        );
      case 'logs':
        return <AILogs aiLogs={aiLogs} isAdmin={isAdmin} />;
      case 'archive':
        return (
          <ExtractionAuditView 
            jobs={jobs} 
            onDelete={handleDeleteJob} 
            onViewRaw={(job) => { setRawDataJob(job); setShowRawData(true); }} 
          />
        );
      case 'history':
        return <AIInteractionHistory history={chatHistory} onReRun={handleReRun} />;
      default:
        return null;
    }
  };

  const LandingView = () => (
    <motion.div 
      key="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex flex-col items-center text-center space-y-16 py-32"
    >
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-neon-blue/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="space-y-6 relative z-10">
        <h2 className="text-8xl md:text-[10rem] font-black tracking-tighter leading-[0.8] uppercase italic">
          EVOLVE YOUR <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-purple to-neon-orange animate-gradient-x">CAREER</span>
        </h2>
        <p className="max-w-2xl mx-auto text-white/40 text-lg md:text-xl font-medium tracking-tight">
          Professional application compiler and neural career management system.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 relative z-10">
        <NeonButton 
          variant="blue" 
          className="px-16 py-6 text-2xl font-black italic tracking-tighter rounded-2xl shadow-[0_0_30px_rgba(0,243,255,0.1)] hover:scale-105 transition-all"
          onClick={() => user ? setStep('dashboard') : handleSignIn()}
          isLoading={authLoading}
        >
          {user ? 'INITIALIZE SYSTEM' : (authLoading ? 'ESTABLISHING LINK...' : 'CONNECT NEURAL LINK')} 
          <ChevronRight size={28} className="ml-2" />
        </NeonButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl relative z-10 px-6">
        {[
          { icon: <Search size={24}/>, title: "INTELLIGENCE", desc: "Automated job parameter extraction and alignment logic." },
          { icon: <Cpu size={24}/>, title: "COMPILER", desc: "Deterministic professional artifact generation engine." },
          { icon: <Database size={24}/>, title: "LOGISTICS", desc: "Consolidated application operations and lifecycle management." }
        ].map((feat, i) => (
          <GlassCard key={i} className="p-10 flex flex-col items-center gap-6 group hover:bg-white/5 border-white/5">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-neon-blue group-hover:scale-110 group-hover:rotate-6 transition-transform">
              {feat.icon}
            </div>
            <div className="space-y-2">
               <h3 className="text-xl font-black tracking-tighter uppercase italic">{feat.title}</h3>
               <p className="text-sm text-white/30">{feat.desc}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );

  const JobArtifactHistoryOverlay = () => {
    const job = jobs.find(j => j.id === viewingJobIdForArtifacts);
    if (!job) return null;

    return (
      <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
        <GlassCard className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0 border-white/10">
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-neon-purple/10 border border-neon-purple/20 text-neon-purple">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Compiler Database</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">
                  {job.title} @ {job.company}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setViewingJobIdForArtifacts(null)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/40 transition-all hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 futuristic-scroll space-y-6">
            <div className="flex items-center justify-between mb-4">
               <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Compiler Archive</h4>
               <NeonButton 
                 variant="purple" 
                 className="!py-2 !px-4 !text-[10px]"
                 onClick={() => handleGenerateCV(job)}
                 isLoading={loadingCV}
               >
                 <Zap size={14} className="mr-2" /> COMPILE NEW VERSION
               </NeonButton>
            </div>

            <div className="space-y-4">
              {cvHistory.filter(h => h.job_id === viewingJobIdForArtifacts).length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                  <p className="text-white/20 text-xs uppercase tracking-widest font-black">No artifacts generated for this node.</p>
                </div>
              ) : (
                cvHistory
                  .filter(h => h.job_id === viewingJobIdForArtifacts)
                  .sort((a, b) => {
                    const dateA = a.generated_at?.seconds ? a.generated_at.seconds : (a.generated_at instanceof Date ? a.generated_at.getTime() / 1000 : 0);
                    const dateB = b.generated_at?.seconds ? b.generated_at.seconds : (b.generated_at instanceof Date ? b.generated_at.getTime() / 1000 : 0);
                    return dateB - dateA;
                  })
                  .map((cv, idx) => (
                    <div 
                      key={cv.id} 
                      className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-neon-purple/30 transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-neon-purple/10 flex items-center justify-center text-neon-purple group-hover:scale-110 transition-transform">
                          <Cpu size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white/80">Version {cvHistory.filter(h => h.job_id === viewingJobIdForArtifacts).length - idx}</p>
                          <p className="text-[10px] text-white/40 font-mono tracking-tighter">
                            {cv.generated_at?.seconds ? new Date(cv.generated_at.seconds * 1000).toLocaleString() : 'Recent Encryption'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSelectedCV(cv);
                            setStep('cv_artifact');
                            setViewingJobIdForArtifacts(null);
                          }}
                          className="px-4 py-2 rounded-lg bg-neon-purple/10 border border-neon-purple/20 text-neon-purple text-[10px] font-black uppercase tracking-widest hover:bg-neon-purple/20 transition-all"
                        >
                          View Output
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
          
          <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
             <button 
              onClick={() => {
                setExtractedJob(job);
                setStep('results');
                setSelectedCV(null);
                setViewingJobIdForArtifacts(null);
              }}
              className="px-4 py-2 rounded-lg text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"
            >
              Analyze Job
            </button>
            <button 
              onClick={() => setViewingJobIdForArtifacts(null)}
              className="px-4 py-2 rounded-lg bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
            >
              Exit Storage
            </button>
          </div>
        </GlassCard>
      </div>
    );
  };

  return (
    <div className={cn(
      "min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-neon-blue/30 selection:text-white antialiased transition-colors duration-300",
      theme === 'light' && "bg-[#f8fafc] text-slate-900"
    )}>
      {/* Global Aesthetics */}
      <div className="scanline" />

      {!user || step === 'landing' ? (
        <>
          {/* Public Header */}
          <header className="fixed top-0 inset-x-0 z-50 h-20 flex items-center px-8 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setStep('landing')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple p-[1px]">
                <div className="w-full h-full rounded-[11px] bg-black flex items-center justify-center">
                  <Terminal size={22} className="text-neon-blue group-hover:rotate-12 transition-transform" />
                </div>
              </div>
              <h1 className="text-xl font-black tracking-tighter uppercase italic">CAREER<span className="text-neon-blue">OS</span></h1>
            </div>
            
            <div className="ml-auto flex items-center gap-4">
               <button 
                onClick={handleSignIn}
                disabled={authLoading}
                className="px-6 py-2 rounded-xl bg-neon-blue/10 border border-neon-blue/30 text-neon-blue text-[11px] font-black uppercase tracking-widest hover:bg-neon-blue/20 transition-all active:scale-95"
              >
                {authLoading ? 'CONNECTING...' : 'INITIALIZE LINK'}
              </button>
            </div>
          </header>

          <main className="pt-20">
            <AnimatePresence mode="wait">
              {step === 'landing' && <LandingView />}
            </AnimatePresence>
          </main>
        </>
      ) : (
        /* Enterprise Layout */
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar Navigation */}
          <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] flex flex-col z-40 relative">
            <div className="p-6 flex items-center gap-3 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-neon-blue/10 flex items-center justify-center">
                <Terminal size={18} className="text-neon-blue" />
              </div>
              <h1 className="text-sm font-black tracking-tighter uppercase">CAREER<span className="text-neon-blue">OS</span></h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-8 futuristic-scroll">
              <div className="space-y-1">
                <p className="px-3 pb-2 text-[10px] font-black tracking-[0.2em] text-white/20 uppercase">Core Systems</p>
                {[
                  { id: 'dashboard', label: 'Command Center', icon: <LayoutDashboard size={18} /> },
                  { id: 'inbox', label: 'Operations', icon: <Inbox size={18} />, count: jobs.length },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setStep(item.id as any)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                      step === item.id 
                        ? "bg-neon-blue/10 text-neon-blue border border-neon-blue/20" 
                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                    )}
                  >
                    {item.icon} {item.label}
                    {item.count !== undefined && item.count > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 rounded bg-neon-blue/20 text-neon-blue text-[9px] font-black">
                        {item.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <p className="px-3 pb-2 text-[10px] font-black tracking-[0.2em] text-white/20 uppercase">Intelligence</p>
                {[
                  { id: 'capture', label: 'Add New Job', icon: <Search size={18} /> },
                  { id: 'cv_builder', label: 'CV Builder', icon: <PenTool size={18} /> },
                  { id: 'profile', label: 'My Profile', icon: <User size={18} /> },
                  { id: 'cv_history', label: 'Compiler Archive', icon: <Cpu size={18} />, count: cvHistory.length },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setStep(item.id as any)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                      step === item.id 
                        ? "bg-neon-purple/10 text-neon-purple border border-neon-purple/20" 
                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                    )}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <p className="px-3 pb-2 text-[10px] font-black tracking-[0.2em] text-white/20 uppercase">Archive</p>
                {[
                  { id: 'applications', label: 'My Applications', icon: <History size={18} />, count: applications.length },
                  { id: 'tracking', label: 'Status Tracker', icon: <Activity size={18} />, count: trackingRecords.length },
                  { id: 'database', label: 'Job Database', icon: <Database size={18} /> },
                  { id: 'archive', label: 'Extraction Audit', icon: <ShieldCheck size={18} /> },
                  { id: 'history', label: 'Activity Logs', icon: <MessageSquare size={18} />, count: chatHistory.length },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setStep(item.id as any)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
                      step === item.id 
                        ? "bg-neon-orange/10 text-neon-orange border border-neon-orange/20" 
                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                    )}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-white/5 mt-auto">
              <button 
                onClick={() => signOut()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-400/5 transition-all"
              >
                <LogOut size={16} /> Disconnect Link
              </button>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
            <header className="h-16 border-b border-white/5 px-8 flex items-center justify-between backdrop-blur-xl z-30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-white/30">
                  <span className="hover:text-neon-blue cursor-pointer" onClick={() => setStep('dashboard')}>COMMAND</span>
                  <ChevronRight size={12} />
                  <span className="text-white/70">{step.replace('_', ' ').toUpperCase()}</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60 line-clamp-1">{user?.displayName}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-neon-blue transition-colors"
                  >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 relative">
                    <Bell size={18} />
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-neon-orange rounded-full border border-black" />
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 futuristic-scroll">
              <AnimatePresence mode="wait">
                {renderAppView()}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {selectedCV && step === 'cv_artifact' && (
          <CVArtifactView 
            cv={selectedCV} 
            onClose={() => {
              setStep((returnStep as any) || 'cv_history');
              setSelectedCV(null);
            }} 
            onDelete={async () => {
              if (selectedCV.id) {
                await handleDeleteCV(selectedCV.id);
                setSelectedCV(null);
                setStep('cv_history');
              }
            }}
            onRelink={(jobId) => {
              const job = jobs.find(j => j.id === jobId);
              if (job) {
                setExtractedJob(job);
                setStep('results');
                setSelectedCV(null);
              }
            }}
            onViewHistory={(jobId) => setViewingJobIdForArtifacts(jobId)}
            onVerifyStructure={() => setShowStructureIntelligence(true)}
          />
        )}
        {showStructureIntelligence && (
          <StructureIntelligence 
            key="structure-intel"
            onClose={() => setShowStructureIntelligence(false)} 
            cvContent={selectedCV?.markdown_content}
          />
        )}
        {viewingJobIdForArtifacts && (
          <JobArtifactHistoryOverlay key="artifact-history-overlay" />
        )}
        {showRawData && rawDataJob && (
          <RawDataViewer 
            key="raw-data-viewer"
            job={rawDataJob} 
            onClose={() => {
              setShowRawData(false);
              setRawDataJob(null);
            }} 
            onSave={async (updatedJob) => {
              if (updatedJob.id) {
                await updateJob(updatedJob.id, updatedJob);
                setRawDataJob(updatedJob);
                if (extractedJob?.id === updatedJob.id) {
                  setExtractedJob(updatedJob);
                }
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components

const JobsListView = ({ 
  jobs, 
  filter, 
  onFilterChange, 
  onViewJob, 
  onUpdateStatus, 
  onDeleteJob, 
  onBulkDelete, 
  onBulkUpdateStatus, 
  cvHistory, 
  onViewJobArtifacts,
  onViewRaw
}: any) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const filteredJobs = jobs.filter((j: any) => filter === 'all' || j.status === filter);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Manage <span className="text-neon-blue">Your Jobs</span></h2>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">Review and organize all jobs you've captured.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex p-1 bg-white/5 border border-white/10 rounded-lg">
            {['all', JobStatus.saved, JobStatus.applied, JobStatus.follow_up].map(f => (
              <button
                key={f}
                onClick={() => onFilterChange(f as any)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f ? 'bg-neon-blue/20 text-neon-blue' : 'text-white/40 hover:text-white/60'}`}
              >
                {f}
              </button>
            ))}
          </div>
          {selectedIds.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={() => onBulkUpdateStatus(selectedIds, JobStatus.applied)}
                className="px-4 py-2 rounded-lg bg-neon-blue/10 border border-neon-blue/30 text-[10px] font-bold uppercase tracking-widest text-neon-blue"
              >
                Applied
              </button>
              <button 
                onClick={() => onBulkDelete(selectedIds)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] font-bold uppercase tracking-widest text-red-400"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <GlassCard className="py-20 text-center space-y-6 border-dashed border-white/10">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/20">
            <Inbox size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold uppercase tracking-tight">No Jobs Found</h3>
            <p className="text-white/40 text-xs">You haven't added any job opportunities yet.</p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job: any) => (
            <GlassCard 
              key={job.id} 
              className={cn(
                "group transition-all flex flex-col relative border-white/5 hover:border-white/20",
                selectedIds.includes(job.id!) && "border-neon-blue/30 bg-neon-blue/5"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSelectedIds(prev => prev.includes(job.id) ? prev.filter(id => id !== job.id) : [...prev, job.id])}
                    className="text-white/20 hover:text-neon-blue"
                  >
                    {selectedIds.includes(job.id) ? <CheckSquare size={18} className="text-neon-blue" /> : <Square size={18} />}
                  </button>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm leading-tight uppercase tracking-tight group-hover:text-neon-blue transition-colors">{job.title}</h3>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{job.company}</p>
                  </div>
                </div>
                <button onClick={() => onDeleteJob(job.id)} className="p-1.5 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest">
                  <MapPin size={10} /> {job.location || 'Remote'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <select 
                    className={cn(
                      "px-2 py-1 rounded bg-black/40 border text-[9px] font-black uppercase tracking-widest outline-none",
                      job.status === JobStatus.applied ? "border-green-500/30 text-green-400" : "border-white/10 text-white/50"
                    )}
                    value={job.status}
                    onChange={(e) => onUpdateStatus(job.id, e.target.value as JobStatus)}
                  >
                    {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="text-[11px] text-white/50 line-clamp-2 italic leading-relaxed">{job.summary}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex gap-2">
                <NeonButton variant="blue" className="flex-1 !py-2 !text-[9px]" onClick={() => onViewJob(job)}>Analyze</NeonButton>
                <NeonButton variant="purple" className="flex-1 !py-2 !text-[9px]" onClick={() => onViewJobArtifacts(job.id)}>CVs ({cvHistory.filter((cv: any) => cv.job_id === job.id).length})</NeonButton>
                <button 
                  onClick={() => onViewRaw(job)}
                  className="p-2 rounded bg-white/5 text-white/40 hover:text-neon-blue transition-all"
                  title="Edit Raw Data"
                >
                  <Settings size={14} />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const ApplicationsListView = ({ applications, jobs, onDeleteApplication, setGeneratedApp, setExtractedJob, setStep, handleFollowUp }: any) => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase leading-none italic">My <span className="text-neon-purple">Applications</span></h2>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">Monitor all your submitted applications and materials.</p>
        </div>
      </div>

      {applications.length === 0 ? (
        <GlassCard className="py-20 text-center space-y-6 border-dashed border-white/10">
          <History size={48} className="mx-auto text-white/10" />
          <h3 className="text-xl font-bold uppercase text-white/30 tracking-tight">No active history</h3>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {applications.map((app: any) => {
            const job = jobs.find((j: any) => j.id === app.job_id);
            return (
              <GlassCard key={app.id} className="flex flex-col md:flex-row gap-6 items-center border-white/5 hover:border-neon-purple/50">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg uppercase tracking-tight">{job?.title || 'Unknown Job'}</h3>
                    <span className="px-2 py-0.5 rounded bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-[8px] font-black uppercase tracking-widest">{app.output_mode}</span>
                  </div>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest italic">{job?.company || 'Unknown'}</p>
                  <p className="text-[10px] text-white/30 font-mono tracking-tighter lowercase">ID: {app.id}</p>
                </div>
                <div className="flex gap-2">
                  <NeonButton variant="purple" className="!py-2 !px-4 !text-[10px]" onClick={() => {
                    setGeneratedApp(app);
                    if (job) setExtractedJob(job);
                    setStep('results');
                  }}>View content</NeonButton>
                  {job && (
                    <button onClick={() => handleFollowUp(job, app)} className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-neon-purple transition-all"><Mail size={16} /></button>
                  )}
                  <button onClick={() => onDeleteApplication(app.id)} className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

const UserProfileView = ({ profile, onSave, onSyncWithCV }: any) => {
  const [localProfile, setLocalProfile] = useState(profile);
  const [newSkill, setNewSkill] = useState('');

  const addSkill = () => {
    if (newSkill && !localProfile.skills.includes(newSkill)) {
      setLocalProfile({ ...localProfile, skills: [...localProfile.skills, newSkill] });
      setNewSkill('');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-12">
      <div className="text-center space-y-2">
        <h2 className="text-5xl font-black tracking-tighter uppercase italic">My <span className="text-neon-blue">Profile</span></h2>
        <p className="text-white/40 text-[10px] uppercase tracking-[0.4em] font-black">Manage your professional identity and resume data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <GlassCard className="p-8 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-neon-blue border-b border-white/5 pb-2">Core Parameters</h3>
            <div className="grid grid-cols-1 gap-6">
              <FuturisticInput label="Full Name" value={localProfile.full_name} onChange={e => setLocalProfile({...localProfile, full_name: e.target.value})} />
              <div className="grid grid-cols-2 gap-6">
                <FuturisticInput label="Primary Email" value={localProfile.email} onChange={e => setLocalProfile({...localProfile, email: e.target.value})} />
                <FuturisticInput label="Location" value={localProfile.location} onChange={e => setLocalProfile({...localProfile, location: e.target.value})} />
              </div>
              <FuturisticInput label="Years of Experience" type="number" value={localProfile.years_of_experience} onChange={e => setLocalProfile({...localProfile, years_of_experience: e.target.value})} />
            </div>
          </GlassCard>

          <GlassCard className="p-8 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-neon-purple border-b border-white/5 pb-2">Technical Skillsets</h3>
            <div className="flex gap-3">
              <input 
                type="text" 
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-neon-purple outline-none transition-all"
                placeholder="Add skill (e.g. React, Python)"
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSkill()}
              />
              <NeonButton onClick={addSkill} variant="purple">Add</NeonButton>
            </div>
            <div className="flex flex-wrap gap-2">
              {localProfile.skills.map((s: string, i: number) => (
                <span key={`${s}-${i}`} className="px-3 py-1.5 rounded-full bg-neon-purple/10 border border-neon-purple/20 text-neon-purple text-[10px] font-bold uppercase flex items-center gap-2">
                  {s}
                  <X size={10} className="cursor-pointer hover:text-white" onClick={() => setLocalProfile({...localProfile, skills: localProfile.skills.filter((sk: string) => sk !== s)})} />
                </span>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-8">
          <GlassCard className="p-8 space-y-6 h-full flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest text-neon-orange border-b border-white/5 pb-2">Paste Your Resume</h3>
            <textarea 
              className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-mono text-white/70 focus:border-neon-orange outline-none transition-all resize-none min-h-[400px]"
              placeholder="Paste your current CV text here for the AI to learn from..."
              value={localProfile.cv_text}
              onChange={e => setLocalProfile({...localProfile, cv_text: e.target.value})}
            />
            <div className="pt-4 flex justify-between items-center">
              <p className="text-[9px] text-white/30 uppercase tracking-widest font-black">Characters: {localProfile.cv_text.length}</p>
              <button 
                onClick={() => onSyncWithCV(localProfile.cv_text)}
                className="text-[10px] font-black text-neon-orange uppercase tracking-widest hover:underline"
              >
                Auto-Fill From Resume
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <NeonButton 
          variant="blue" 
          className="px-12 py-4 text-xl font-black italic tracking-tighter"
          onClick={() => onSave(localProfile)}
        >
          Save My Profile
        </NeonButton>
      </div>
    </motion.div>
  );
};

const DatabaseManager = ({ jobs, cvHistory, updateJobStatus, handleDeleteJob, setExtractedJob, setStep, setSelectedCV, onViewRaw }: any) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase italic leading-none">Job <span className="text-neon-blue">Database</span></h2>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">Full historical log of all jobs and their details.</p>
        </div>
      </div>

      <GlassCard className="overflow-hidden border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/30">
                <th className="p-4">Job ID</th>
                <th className="p-4">Job Title</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobs.map((job: any) => (
                <tr key={job.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4">
                    <p className="text-sm font-bold uppercase tracking-tight">{job.title}</p>
                    <p className="text-[10px] text-white/40 font-mono lower">{job.id}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-xs font-black text-neon-blue uppercase italic">{job.company}</p>
                    <p className="text-[9px] text-white/30 uppercase tracking-widest">{job.location || 'Remote'}</p>
                  </td>
                  <td className="p-4">
                    <select 
                      className="bg-transparent border border-white/10 rounded px-2 py-1 text-[9px] font-black uppercase text-white/60 focus:border-neon-blue outline-none"
                      value={job.status}
                      onChange={(e) => updateJobStatus(job.id, e.target.value as any)}
                    >
                      {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                       {cvHistory.filter((cv: any) => cv.job_id === job.id).map((cv: any, i: number) => (
                         <button 
                           key={cv.id} 
                           onClick={() => { setSelectedCV(cv); setStep('cv_artifact'); }}
                           className="w-6 h-6 rounded bg-neon-purple/20 text-neon-purple flex items-center justify-center text-[9px] font-black border border-neon-purple/30 hover:bg-neon-purple hover:text-black transition-all"
                         >
                           {i + 1}
                         </button>
                       ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setExtractedJob(job); setStep('results'); }} className="p-2 rounded bg-white/5 text-white/40 hover:text-neon-blue transition-all" title="View Hub"><Eye size={14} /></button>
                      <button 
                        onClick={() => onViewRaw(job)}
                        className="p-2 rounded bg-white/5 text-white/40 hover:text-neon-blue transition-all"
                        title="Edit Schema"
                      >
                        <Settings size={14} />
                      </button>
                      <button onClick={() => handleDeleteJob(job.id)} className="p-2 rounded bg-white/5 text-white/40 hover:text-red-400 transition-all" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </motion.div>
  );
};

const AILogs = ({ aiLogs, isAdmin }: any) => {
  if (!isAdmin) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <h2 className="text-3xl font-black tracking-tighter uppercase italic leading-none">Activity <span className="text-neon-blue">Logs</span></h2>
      <GlassCard className="overflow-hidden border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
               <tr className="bg-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
                 <th className="p-4">Timestamp</th>
                 <th className="p-4">Operation</th>
                 <th className="p-4">Model</th>
                 <th className="p-4">Latency</th>
                 <th className="p-4">Resources</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {aiLogs.map((log: any, i: number) => (
                <tr key={log.id || i} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white/40">{log.timestamp?.toDate().toLocaleString()}</td>
                  <td className="p-4 font-black uppercase text-neon-blue">{log.action}</td>
                  <td className="p-4 text-white/60">{log.model}</td>
                  <td className="p-4 text-white/40">{log.latency_ms}ms</td>
                  <td className="p-4 text-white/30">{log.tokens_input}/{log.tokens_output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </motion.div>
  );
};

const AIInteractionHistory = ({ history, onReRun }: any) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <ChatHistoryView 
        history={history} 
        onReRun={onReRun}
        onDelete={deleteChatHistory}
      />
    </motion.div>
  );
};











