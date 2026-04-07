/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Search, 
  Send, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft, 
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
  Eye
} from 'lucide-react';
import { RawDataViewer } from './components/RawDataViewer';
import ReactMarkdown from 'react-markdown';
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
  db,
  handleFirestoreError,
  OperationType
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, getDoc, doc, Timestamp } from 'firebase/firestore';
import { aiService } from './services/aiService';

const API_BASE = '/app-backend-v1';

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
  const [step, setStep] = useState<'landing' | 'dashboard' | 'profile' | 'capture' | 'results' | 'inbox' | 'applications' | 'logs' | 'database' | 'tracking'>('landing');
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Firestore Data
  const [jobs, setJobs] = useState<ExtractedJob[]>([]);
  const [applications, setApplications] = useState<GeneratedApplication[]>([]);
  const [trackingRecords, setTrackingRecords] = useState<JobTrackingRecord[]>([]);

  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [inboxFilter, setInboxFilter] = useState<JobStatus | 'all'>('all');

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
              desc: "Neural extraction from any URL, text, or visual data stream.",
              icon: "Search",
              color: "blue"
            },
            { 
              title: "Neural Fit", 
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

  const getActivityData = () => {
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
  };

  const getTrend = (type: 'jobs' | 'apps') => {
    const now = new Date().getTime();
    const week = 7 * 24 * 60 * 60 * 1000;
    
    const currentWeek = (type === 'jobs' ? jobs : applications).filter(item => {
      const ts = (item as any).captured_at?.seconds || (item as any).applied_at?.seconds;
      return ts && (ts * 1000) > (now - week);
    }).length;
    
    const lastWeek = (type === 'jobs' ? jobs : applications).filter(item => {
      const ts = (item as any).captured_at?.seconds || (item as any).applied_at?.seconds;
      return ts && (ts * 1000) > (now - 2 * week) && (ts * 1000) <= (now - week);
    }).length;
    
    if (lastWeek === 0) return currentWeek > 0 ? `+${currentWeek}` : "0%";
    const diff = ((currentWeek - lastWeek) / lastWeek) * 100;
    return `${diff >= 0 ? '+' : ''}${Math.round(diff)}%`;
  };

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

    return () => {
      unsubJobs();
      unsubApps();
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
      const data = await aiService.extractJob(content, captureInput.type);
      if (captureInput.type === SourceType.link) {
        data.source_url = captureInput.value;
      }
      setExtractedJob(data);

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
      setStep('capture');
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
      if (extractedJob?.id) {
        await updateJobStatus(extractedJob.id, JobStatus.apply_now, extractedJob.postgres_id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async (job: ExtractedJob, app: GeneratedApplication) => {
    setLoading(true);
    try {
      const data = await aiService.generateFollowUp(job, profile, app);
      
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

  return (
    <div className="relative min-h-screen overflow-x-hidden futuristic-scroll">
      <div className="scanline" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass-card !rounded-none border-x-0 border-t-0 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setStep(user ? 'dashboard' : 'landing')}>
          <div className="w-10 h-10 rounded-lg bg-neon-blue/20 border border-neon-blue/50 flex items-center justify-center neon-glow-blue">
            <Cpu className="text-neon-blue w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold tracking-tighter text-xl leading-none">VISION <span className="text-neon-blue">2060</span></h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Job Acquisition Engine</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
          {[
            { id: 'dashboard', label: 'Command', icon: <LayoutDashboard size={14} />, auth: true },
            ...(isAdmin ? [{ id: 'logs', label: 'Neural Logs', icon: <Activity size={14} />, auth: true }] : []),
            { id: 'capture', label: 'Capture', icon: <Search size={14} /> },
            { id: 'inbox', label: 'Inbox', icon: <Inbox size={14} />, count: jobs.length, auth: true },
            { id: 'database', label: 'Database', icon: <Database size={14} />, auth: true },
            { id: 'applications', label: 'History', icon: <History size={14} />, count: applications.length, auth: true },
            { id: 'profile', label: 'Profile', icon: <User size={14} /> },
          ].filter(item => !item.auth || user).map((item) => (
            <button
              key={item.id}
              onClick={() => setStep(item.id as any)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                step === item.id 
                  ? "bg-neon-blue/20 text-neon-blue border border-neon-blue/30 shadow-[0_0_10px_rgba(0,243,255,0.1)]" 
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              )}
            >
              {item.icon} {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-neon-blue text-black text-[8px] font-black leading-none">
                  {item.count}
                </span>
              )}
              {step === item.id && (
                <motion.div 
                  layoutId="activeNav"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-neon-blue shadow-[0_0_5px_rgba(0,243,255,0.8)]"
                />
              )}
            </button>
          ))}
        </nav>
        
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`} />
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              {user ? 'Neural Link Active' : 'Offline Mode'}
            </span>
          </div>
          <div className="h-6 w-px bg-white/10 hidden lg:block" />
          
          <button 
            className="md:hidden p-2 rounded-lg hover:bg-white/5 text-white/60"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-bold text-white/90 leading-none">{user.displayName}</span>
                <span className="text-[8px] text-white/40 uppercase tracking-widest">Authorized User</span>
              </div>
              <button 
                onClick={() => signOut()}
                className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleSignIn}
              disabled={authLoading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-blue/10 border border-neon-blue/30 text-neon-blue text-[10px] font-bold uppercase tracking-widest hover:bg-neon-blue/20 transition-all",
                authLoading && "opacity-50 cursor-wait"
              )}
            >
              <LogIn size={16} /> {authLoading ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-[73px] z-30 md:hidden glass-card !rounded-none border-x-0 border-t-0 p-6 space-y-4 shadow-2xl"
          >
    {[
      { id: 'dashboard', label: 'Command', icon: <LayoutDashboard size={18} />, auth: true },
      ...(isAdmin ? [{ id: 'logs', label: 'Neural Logs', icon: <Activity size={18} />, auth: true }] : []),
      { id: 'profile', label: 'Profile', icon: <User size={18} /> },
      { id: 'capture', label: 'Capture Job', icon: <Search size={18} /> },
      { id: 'inbox', label: 'Inbox', icon: <Inbox size={18} />, count: jobs.length, auth: true },
      { id: 'database', label: 'Database', icon: <Database size={18} />, auth: true },
      { id: 'applications', label: 'History', icon: <History size={18} />, count: applications.length, auth: true },
    ].filter(item => !item.auth || user).map((item) => (
      <button
        key={item.id}
        onClick={() => {
          setStep(item.id as any);
          setIsMobileMenuOpen(false);
        }}
        className={cn(
          "w-full flex items-center gap-4 p-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
          step === item.id 
            ? "bg-neon-blue/20 text-neon-blue border border-neon-blue/30" 
            : "text-white/40 hover:text-white/60 hover:bg-white/5"
        )}
      >
        {item.icon} {item.label}
        {item.count !== undefined && item.count > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-neon-blue text-black text-[10px] font-black">
            {item.count}
          </span>
        )}
      </button>
    ))}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          
          {/* LANDING STEP */}
          {step === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex flex-col items-center text-center space-y-16 py-20"
            >
              {/* Background Glows */}
              <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-neon-blue/5 rounded-full blur-[120px] pointer-events-none" />
              <div className="absolute top-20 -left-20 w-64 h-64 bg-neon-purple/5 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute bottom-20 -right-20 w-64 h-64 bg-neon-orange/5 rounded-full blur-[80px] pointer-events-none" />

              <div className="space-y-6 relative z-10">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-[0.4em] backdrop-blur-sm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse" />
                  Neural Link Protocol v2.0.60
                </motion.div>
                
                <h2 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.85] uppercase">
                  EVOLVE YOUR <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-purple to-neon-orange animate-gradient-x">CAREER</span>
                </h2>
                
                <p className="max-w-2xl mx-auto text-white/40 text-lg md:text-xl font-medium leading-relaxed">
                  The ultimate neural-link between your potential and the global job market. 
                  Capture, analyze, and generate professional applications in seconds.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 relative z-10">
                <NeonButton 
                  variant="blue" 
                  className="px-16 py-6 text-xl rounded-2xl shadow-[0_0_30px_rgba(0,243,255,0.2)] hover:shadow-[0_0_50px_rgba(0,243,255,0.4)] transition-all"
                  onClick={() => user ? setStep('dashboard') : handleSignIn()}
                  isLoading={authLoading}
                >
                  {user ? 'Enter Command Center' : (authLoading ? 'Connecting...' : 'Initialize Neural Link')} <ChevronRight size={24} className="ml-2" />
                </NeonButton>
                
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">System Status</span>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-neon-blue/40 rounded-full" />)}
                    </div>
                    <span className="text-xs font-mono text-neon-blue uppercase tracking-widest">All Nodes Operational</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl relative z-10">
                {(systemContent?.features || []).map((feature: any, i: number) => (
                  <GlassCard key={i} className="group flex flex-col items-center text-center p-10 space-y-6 hover:bg-white/5 transition-all duration-500 border-white/5 hover:border-white/20">
                    <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                      {feature.icon === 'Search' ? <Search className="text-neon-blue" /> : 
                       feature.icon === 'Target' ? <Target className="text-neon-orange" /> : 
                       <Zap className="text-neon-purple" />}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-black text-2xl uppercase tracking-tight group-hover:text-neon-blue transition-colors">{feature.title}</h3>
                      <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
                    </div>
                    <div className="w-8 h-1 bg-white/5 rounded-full group-hover:w-16 group-hover:bg-neon-blue transition-all duration-500" />
                  </GlassCard>
                ))}
              </div>

              {/* Neural Ticker */}
              <div className="w-full border-y border-white/5 py-4 overflow-hidden relative z-10">
                <div className="flex whitespace-nowrap animate-marquee gap-12">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">
                      <span className="text-neon-blue">●</span> SYNCING_NEURAL_NODES
                      <span className="text-neon-purple">●</span> ANALYZING_MARKET_TRENDS
                      <span className="text-neon-orange">●</span> OPTIMIZING_CAREER_PATHS
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats Section */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-4xl relative z-10 pt-8">
                {[
                  { label: "Neural Nodes", value: systemStats?.nodes || "..." },
                  { label: "Jobs Synthesized", value: systemStats?.jobs || "..." },
                  { label: "Success Rate", value: systemStats?.success || "..." },
                  { label: "Latency", value: systemStats?.latency || "..." }
                ].map((stat, i) => (
                  <div key={i} className="text-center space-y-1">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-2xl font-black tracking-tighter text-white/80">{stat.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* DASHBOARD (COMMAND CENTER) STEP */}
          {step === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black tracking-tight uppercase">COMMAND <span className="text-neon-blue">CENTER</span></h2>
                  <p className="text-white/40 text-sm">Welcome back, {user?.displayName?.split(' ')[0]}. System status: <span className="text-green-400">Optimal</span></p>
                </div>
                <div className="flex gap-3">
                  <NeonButton variant="blue" onClick={() => setStep('capture')}>
                    <Plus size={18} className="mr-2" /> New Capture
                  </NeonButton>
                  <button 
                    onClick={() => setStep('profile')}
                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/40"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total Captured", value: jobs.length, icon: <Inbox className="text-neon-blue" />, trend: getTrend('jobs'), color: "blue", action: () => setStep('inbox') },
                  { label: "Applications Sent", value: applications.length, icon: <Send className="text-neon-purple" />, trend: getTrend('apps'), color: "purple", action: () => setStep('applications') },
                  { label: "Follow-ups Needed", value: jobs.filter(j => j.status === JobStatus.follow_up).length, icon: <Mail className="text-neon-orange" />, trend: "Active", color: "orange", action: () => { setInboxFilter(JobStatus.follow_up); setStep('inbox'); } },
                  { label: "Profile Strength", value: `${Math.min(100, Math.round((profile.cv_text.length / 500) * 100))}%`, icon: <User className="text-neon-blue" />, trend: profile.cv_text.length >= 500 ? "Complete" : "Improve", color: "blue", action: () => setStep('profile') }
                ].map((metric, i) => (
                  <GlassCard 
                    key={i} 
                    className="p-6 space-y-4 cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all group"
                    onClick={metric.action}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                        {metric.icon}
                      </div>
                      <span className="text-[10px] font-mono text-green-400">{metric.trend}</span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-white/40 group-hover:text-white/60 transition-colors">{metric.label}</p>
                      <h3 className="text-3xl font-black tracking-tighter group-hover:text-neon-blue transition-colors">{metric.value}</h3>
                    </div>
                  </GlassCard>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Activity Chart */}
                <GlassCard className="lg:col-span-8 p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <TrendingUp size={18} className="text-neon-blue" /> ACTIVITY TRENDS
                    </h3>
                    <div className="flex gap-2">
                      {['7D', '30D', 'ALL'].map(t => (
                        <button key={t} className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-white/40 hover:text-white transition-colors">{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getActivityData()}>
                        <defs>
                          <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#ffffff20" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#ffffff20" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '10px' }}
                          itemStyle={{ color: '#00f2ff' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="captures" 
                          stroke="#00f2ff" 
                          fillOpacity={1} 
                          fill="url(#colorApps)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Quick Actions & Recent */}
                <div className="lg:col-span-4 space-y-8">
                  <GlassCard className="p-6 space-y-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Quick Actions</h3>
                    <div className="space-y-3">
                      <button 
                        onClick={() => setStep('capture')}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-neon-blue/30 hover:bg-neon-blue/5 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <Zap size={18} className="text-neon-blue" />
                          <span className="text-xs font-bold uppercase tracking-widest">Capture Job</span>
                        </div>
                        <ArrowUpRight size={14} className="text-white/20 group-hover:text-neon-blue" />
                      </button>
                      <button 
                        onClick={() => setStep('profile')}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-neon-purple/30 hover:bg-neon-purple/5 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <User size={18} className="text-neon-purple" />
                          <span className="text-xs font-bold uppercase tracking-widest">Update Profile</span>
                        </div>
                        <ArrowUpRight size={14} className="text-white/20 group-hover:text-neon-purple" />
                      </button>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Recent Jobs</h3>
                      <button onClick={() => setStep('inbox')} className="text-[10px] font-bold text-neon-blue uppercase tracking-widest">View All</button>
                    </div>
                    <div className="space-y-4">
                      {jobs.slice(0, 3).map(job => (
                        <div key={job.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => { setExtractedJob(job); setStep('results'); }}>
                          <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-white/20 group-hover:text-neon-blue transition-colors">
                            <Briefcase size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate group-hover:text-neon-blue transition-colors">{job.title}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">{job.company}</p>
                          </div>
                        </div>
                      ))}
                      {jobs.length === 0 && <p className="text-xs text-white/20 italic">No jobs captured yet.</p>}
                    </div>
                  </GlassCard>
                </div>
              </div>
            </motion.div>
          )}

          {/* PROFILE STEP */}
          {step === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">USER <span className="text-neon-blue">PROFILE</span></h2>
                  <p className="text-white/40 text-sm">Configure your professional identity for precise AI matching.</p>
                </div>
                <NeonButton variant="blue" onClick={handleSaveProfile} isLoading={loading}>
                  Save & Continue <ChevronRight size={18} />
                </NeonButton>
              </div>

              <GlassCard className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Full Name</label>
                    <FuturisticInput 
                      placeholder="e.g. Alex Quantum" 
                      value={profile.full_name}
                      onChange={e => setProfile({...profile, full_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Email Address</label>
                    <FuturisticInput 
                      placeholder="alex@future.net" 
                      value={profile.email}
                      onChange={e => setProfile({...profile, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">LinkedIn URL</label>
                    <FuturisticInput 
                      placeholder="https://linkedin.com/in/..." 
                      value={profile.linkedin_url || ''}
                      onChange={e => setProfile({...profile, linkedin_url: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Portfolio URL</label>
                    <FuturisticInput 
                      placeholder="https://alex.dev" 
                      value={profile.portfolio_url || ''}
                      onChange={e => setProfile({...profile, portfolio_url: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Experience Summary</label>
                  <FuturisticTextarea 
                    placeholder="Briefly describe your career trajectory..." 
                    value={profile.experience_summary}
                    onChange={e => setProfile({...profile, experience_summary: e.target.value})}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Core Skills</label>
                  <div className="flex gap-2">
                    <FuturisticInput 
                      placeholder="Add a skill (e.g. React, Python, UI Design)" 
                      value={newSkill}
                      onChange={e => setNewSkill(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSkill()}
                    />
                    <NeonButton variant="blue" className="!px-3" onClick={addSkill}>
                      <Plus size={20} />
                    </NeonButton>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(profile.skills || []).map(skill => (
                      <span key={skill} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/30 text-neon-blue text-xs">
                        {skill}
                        <button onClick={() => removeSkill(skill)} className="hover:text-white transition-colors">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">CV / Resume Text</label>
                    <button 
                      onClick={handleSynthesizeProfile}
                      disabled={loading || profile.cv_text.length < 50}
                      className="text-[10px] font-bold text-neon-blue uppercase tracking-widest hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Sparkles size={12} /> Synthesize from CV
                    </button>
                  </div>
                  <FuturisticTextarea 
                    placeholder="Paste your full CV content here for deep analysis..." 
                    className="min-h-[250px]"
                    value={profile.cv_text}
                    onChange={e => setProfile({...profile, cv_text: e.target.value})}
                  />
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <p className={`text-[10px] ${profile.cv_text.length >= 500 ? 'text-green-400' : profile.cv_text.length >= 200 ? 'text-neon-blue' : 'text-white/30'}`}>
                        Profile Strength: {Math.min(100, Math.round((profile.cv_text.length / 500) * 100))}%
                      </p>
                      <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${profile.cv_text.length >= 500 ? 'bg-green-400' : profile.cv_text.length >= 200 ? 'bg-neon-blue' : 'bg-neon-orange'}`} 
                          style={{ width: `${Math.min(100, (profile.cv_text.length / 500) * 100)}%` }}
                        />
                      </div>
                    </div>
                    {profile.cv_text.length >= 50 ? (
                      <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold uppercase tracking-widest">
                        <CheckCircle2 size={12} /> Ready to Start
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-neon-orange font-bold uppercase tracking-widest animate-pulse">
                        <AlertCircle size={12} /> Minimal Info Needed
                      </span>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* CAPTURE STEP */}
          {step === 'capture' && (
            <motion.div 
              key="capture"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-2xl mx-auto space-y-12 py-10"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-black tracking-tighter uppercase">CAPTURE <span className="text-neon-blue">JOB</span></h2>
                <p className="text-white/40">Feed the AI with a job description to begin the matching process.</p>
              </div>

              <div className="space-y-6">
                <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl">
                  {[
                    { id: SourceType.text, icon: <Type size={18} />, label: "Text" },
                    { id: SourceType.link, icon: <LinkIcon size={18} />, label: "Link" },
                    { id: SourceType.image, icon: <ImageIcon size={18} />, label: "Image" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setCaptureInput({ type: tab.id, value: '' });
                        setError(null);
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${captureInput.type === tab.id ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30 shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'text-white/40 hover:text-white/60'}`}
                    >
                      {tab.icon} <span className="text-xs font-bold uppercase tracking-widest">{tab.label}</span>
                    </button>
                  ))}
                </div>

                <GlassCard glow="blue" className="p-1">
                  {captureInput.type === SourceType.image ? (
                    <div className="min-h-[200px] flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-lg hover:border-neon-blue/50 transition-all group relative overflow-hidden">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={async (e) => {
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
                      {captureInput.value ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <img src={captureInput.value} alt="Preview" className="max-h-[300px] rounded-lg shadow-2xl" />
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setCaptureInput({ ...captureInput, value: '' }); 
                              setError(null);
                            }}
                            className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-red-500/50 transition-colors z-20"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Upload size={32} className="text-white/20 group-hover:text-neon-blue" />
                          </div>
                          <p className="text-sm font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Upload Job Poster Image</p>
                          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] mt-2">PNG, JPG, WEBP (MAX 5MB)</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <FuturisticTextarea 
                      placeholder={
                        captureInput.type === SourceType.text ? "Paste the job description text here..." :
                        "Paste the job posting URL here..."
                      }
                      className="!bg-transparent !border-none !rounded-none min-h-[200px] text-lg"
                      value={captureInput.value}
                      onChange={e => setCaptureInput({...captureInput, value: e.target.value})}
                    />
                  )}
                </GlassCard>

                <div className="flex gap-4">
                  <NeonButton 
                    variant="blue" 
                    className="flex-1 py-4 text-lg"
                    onClick={handleExtract}
                    isLoading={loading}
                    disabled={!captureInput.value}
                  >
                    <Zap size={20} /> Process with AI
                  </NeonButton>
                  <button 
                    onClick={() => setStep('profile')}
                    className="px-6 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-white/60"
                  >
                    <ArrowLeft size={20} />
                  </button>
                </div>
                
                {loading && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-neon-blue text-xs font-mono uppercase tracking-[0.2em] animate-pulse"
                  >
                    {loadingMessage}
                  </motion.p>
                )}
                
                {error && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="shrink-0" size={18} />
                      <p>{error}</p>
                    </div>
                    {debugText && (
                      <div className="mt-2 p-2 bg-black/40 rounded border border-red-500/10 text-[10px] font-mono text-red-400/60 overflow-hidden break-all">
                        Scraped: {debugText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* RESULTS STEP */}
          {step === 'results' && extractedJob && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Job Details */}
              <div className="lg:col-span-7 space-y-8">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setStep('capture')}
                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/40"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2 className="text-2xl font-bold tracking-tight">JOB <span className="text-neon-blue">ANALYSIS</span></h2>
                  <button 
                    onClick={() => {
                      setRawDataJob(extractedJob);
                      setShowRawData(true);
                    }}
                    className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-all"
                  >
                    <Eye size={14} /> View Raw Source
                  </button>
                </div>

                <GlassCard className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="text-3xl font-black tracking-tighter leading-tight">{extractedJob.title}</h3>
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-white/40 font-bold uppercase tracking-widest">{extractedJob.company}</p>
                          {extractedJob.source_url && (
                            <a 
                              href={extractedJob.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-neon-blue hover:underline flex items-center gap-1 transition-all"
                            >
                              <LinkIcon size={12} /> Original Source
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <select 
                          className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-transparent focus:outline-none transition-all cursor-pointer",
                            extractedJob.status === JobStatus.applied ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                            extractedJob.status === JobStatus.follow_up ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                            extractedJob.status === JobStatus.interview ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                            extractedJob.status === JobStatus.offer ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue' :
                            extractedJob.status === JobStatus.rejected ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            'bg-white/10 border-white/20 text-white/60'
                          )}
                          value={extractedJob.status || JobStatus.saved}
                          onChange={async (e) => {
                            const newStatus = e.target.value as JobStatus;
                            if (extractedJob.id && user) {
                              try {
                                await updateJobStatus(extractedJob.id, newStatus, extractedJob.postgres_id);
                                setExtractedJob({ ...extractedJob, status: newStatus });
                              } catch (err: any) {
                                setError(err.message);
                              }
                            }
                          }}
                        >
                          {Object.values(JobStatus).map(status => (
                            <option key={status} value={status} className="bg-black text-white">{status.replace('_', ' ')}</option>
                          ))}
                        </select>
                        <div className="flex flex-col items-end gap-2">
                          {renderBadge(extractedJob.extraction_confidence, extractedJob.extraction_confidence === ExtractionConfidence.high ? 'green' : 'orange')}
                          <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Confidence Score</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-neon-blue font-bold tracking-widest uppercase text-xs">{extractedJob.company}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { icon: <MapPin size={14} />, label: "Location", value: extractedJob.location || 'Unknown' },
                      { icon: <Briefcase size={14} />, label: "Type", value: extractedJob.employment_type },
                      { icon: <Globe size={14} />, label: "Policy", value: extractedJob.remote_policy },
                      { icon: <Clock size={14} />, label: "Deadline", value: extractedJob.deadline || 'N/A' }
                    ].map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div className="flex items-center gap-1.5 text-white/30">
                          {item.icon} <span className="text-[9px] uppercase font-bold tracking-widest">{item.label}</span>
                        </div>
                        <p className="text-xs font-medium truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase font-bold tracking-[0.3em] text-white/40 border-b border-white/5 pb-2">Summary</h4>
                    <p className="text-sm text-white/70 leading-relaxed">{extractedJob.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase font-bold tracking-[0.3em] text-white/40 border-b border-white/5 pb-2">Required Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {(extractedJob.required_skills || []).map(skill => (
                          <span key={skill} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-white/60">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase font-bold tracking-[0.3em] text-white/40 border-b border-white/5 pb-2">Requirements</h4>
                      <ul className="space-y-2">
                        {(extractedJob.requirements || []).slice(0, 5).map((req, i) => (
                          <li key={i} className="text-xs text-white/50 flex gap-2">
                            <span className="text-neon-blue font-mono">•</span> {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Right Column: AI Analysis & Generation */}
              <div className="lg:col-span-5 space-y-8">
                {/* Fit Analysis */}
                <GlassCard glow={analysis?.verdict === Verdict.relevant ? 'blue' : 'orange'} className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <Cpu size={18} className="text-neon-blue" /> AI FIT MATCH
                    </h3>
                    {analysis && (
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        analysis.verdict === Verdict.relevant ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                        analysis.verdict === Verdict.maybe ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                        'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}>
                        {analysis.verdict.replace('_', ' ')}
                      </div>
                    )}
                  </div>

                  {!analysis ? (
                    <div className="py-10 text-center space-y-4">
                      {error ? (
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex flex-col items-center gap-3">
                          <AlertCircle size={24} />
                          <p className="font-bold uppercase tracking-widest">Analysis Failed</p>
                          <p className="text-[10px] opacity-70">{error}</p>
                          <NeonButton 
                            variant="blue" 
                            className="mt-2"
                            onClick={() => extractedJob && handleAnalyze(extractedJob)}
                          >
                            Retry Analysis
                          </NeonButton>
                        </div>
                      ) : loadingAnalysis ? (
                        <>
                          <div className="w-12 h-12 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin mx-auto" />
                          <p className="text-xs text-white/40 font-mono uppercase tracking-widest">Processing Fit Analysis...</p>
                        </>
                      ) : (
                        <div className="p-6 rounded-xl bg-neon-blue/5 border border-neon-blue/20 text-center space-y-4">
                          <Target className="mx-auto text-neon-blue opacity-50" size={32} />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-white/90">Fit Match Ready</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">Analyze this job against your profile</p>
                          </div>
                          <NeonButton 
                            variant="blue" 
                            className="w-full py-3"
                            onClick={() => extractedJob && handleAnalyze(extractedJob)}
                          >
                            Run Fit Match
                          </NeonButton>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <div className="flex items-center gap-2 text-neon-blue">
                          <ShieldCheck size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Recommendation</span>
                        </div>
                        <p className="text-sm font-bold text-white/90">{analysis.apply_recommendation.replace('_', ' ')}</p>
                        <p className="text-xs text-white/50">{analysis.fit_summary}</p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/40">Key Strengths</h4>
                          <div className="space-y-1.5">
                            {(analysis.reasons || []).map((reason, i) => (
                              <div key={i} className="text-xs text-green-400/80 flex gap-2">
                                <CheckCircle2 size={12} className="shrink-0 mt-0.5" /> {reason}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {(analysis.gaps || []).length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/40">Potential Gaps</h4>
                            <div className="space-y-1.5">
                              {(analysis.gaps || []).map((gap, i) => (
                                <div key={i} className="text-xs text-orange-400/80 flex gap-2">
                                  <AlertCircle size={12} className="shrink-0 mt-0.5" /> {gap}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {!generatedApp && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-bold tracking-widest text-white/30">Tone</label>
                              <select 
                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                                value={appTone}
                                onChange={e => setAppTone(e.target.value as Tone)}
                              >
                                <option value={Tone.professional}>Professional</option>
                                <option value={Tone.confident}>Confident</option>
                                <option value={Tone.concise}>Concise</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-bold tracking-widest text-white/30">Mode</label>
                              <select 
                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                                value={appMode}
                                onChange={e => setAppMode(e.target.value as OutputMode)}
                              >
                                <option value={OutputMode.email}>Email Draft</option>
                                <option value={OutputMode.form_answers}>Form Answers</option>
                              </select>
                            </div>
                          </div>
                          <NeonButton 
                            variant="blue" 
                            className="w-full py-3"
                            onClick={handleGenerate}
                            isLoading={loading}
                          >
                            <Zap size={18} /> Generate Application
                          </NeonButton>
                        </div>
                      )}
                    </div>
                  )}
                </GlassCard>

                {/* Generated Content */}
                {generatedApp && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <GlassCard glow="purple" className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                          <Mail size={18} className="text-neon-purple" /> GENERATED OUTPUT
                        </h3>
                        <button 
                          onClick={() => setGeneratedApp(null)}
                          className="text-white/30 hover:text-white transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {generatedApp.subject && (
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-white/30">Subject</span>
                            <p className="text-xs font-medium">{generatedApp.subject}</p>
                          </div>
                        )}

                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 max-h-[400px] overflow-y-auto futuristic-scroll">
                          <div className="prose prose-invert prose-xs max-w-none">
                            <ReactMarkdown>
                              {generatedApp.email_body || generatedApp.cover_note || generatedApp.short_fit_answer || ''}
                            </ReactMarkdown>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <NeonButton 
                            variant="purple" 
                            className="flex-1"
                            onClick={() => {
                              const text = generatedApp.email_body || generatedApp.cover_note || generatedApp.short_fit_answer || '';
                              navigator.clipboard.writeText(text);
                            }}
                          >
                            <Copy size={16} className="mr-2" /> Copy
                          </NeonButton>
                          {user && (
                            <NeonButton 
                              variant="blue" 
                              className="flex-1"
                              onClick={handleSaveApplication}
                              isLoading={loading}
                            >
                              Save to History
                            </NeonButton>
                          )}
                          {extractedJob.application_url && (
                            <a 
                              href={extractedJob.application_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-neon-blue text-neon-blue hover:bg-neon-blue hover:text-black transition-all"
                            >
                              Apply <ExternalLink size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* DATABASE STEP */}
          {step === 'database' && (
            <motion.div 
              key="database"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight uppercase">JOB <span className="text-neon-blue">RECORDS</span></h2>
                  <p className="text-white/40 text-sm">Efficient querying and management of your job database.</p>
                </div>
                <NeonButton variant="blue" onClick={() => setStep('capture')}>
                  <Plus size={18} className="mr-2" /> New Record
                </NeonButton>
              </div>

              <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5">
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Title</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Company</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Location</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Status</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Captured</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-white/5 transition-colors group">
                          <td className="p-4">
                            <p className="text-sm font-bold text-white/90">{job.title}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-xs text-neon-blue font-bold uppercase tracking-widest">{job.company}</p>
                          </td>
                          <td className="p-4 text-xs text-white/40">{job.location || 'N/A'}</td>
                          <td className="p-4">
                            <select 
                              className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-transparent focus:outline-none transition-all cursor-pointer",
                                job.status === JobStatus.applied ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                job.status === JobStatus.follow_up ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                                job.status === JobStatus.interview ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                                job.status === JobStatus.offer ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue' :
                                job.status === JobStatus.rejected ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                'bg-white/10 border-white/20 text-white/60'
                              )}
                              value={job.status || JobStatus.saved}
                              onChange={async (e) => {
                                const newStatus = e.target.value as JobStatus;
                                if (job.id && user) {
                                  try {
                                    await updateJobStatus(job.id, newStatus, job.postgres_id);
                                  } catch (err: any) {
                                    setError(err.message);
                                  }
                                }
                              }}
                            >
                              {Object.values(JobStatus).map(status => (
                                <option key={status} value={status} className="bg-black text-white">{status.replace('_', ' ')}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4 text-[10px] font-mono text-white/40">
                            {job.captured_at?.toDate ? job.captured_at.toDate().toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => { setExtractedJob(job); setStep('results'); }}
                                className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-neon-blue transition-all"
                              >
                                <Eye size={16} />
                              </button>
                              <button 
                                onClick={() => job.id && handleDeleteJob(job.id)}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* LOGS STEP */}
          {step === 'logs' && isAdmin && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight uppercase">NEURAL <span className="text-neon-blue">LOGS</span></h2>
                  <p className="text-white/40 text-sm">Real-time AI interaction auditing and performance monitoring.</p>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right">
                    <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Total Logs</p>
                    <p className="text-xl font-black text-neon-blue">{aiLogs.length}</p>
                  </div>
                </div>
              </div>

              <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5">
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Timestamp</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Action</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Model</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Latency</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Tokens (I/O)</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {aiLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                          <td className="p-4 text-[10px] font-mono text-white/60">
                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A'}
                          </td>
                          <td className="p-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neon-blue bg-neon-blue/10 px-2 py-1 rounded">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4 text-[10px] font-mono text-white/40">{log.model}</td>
                          <td className="p-4 text-[10px] font-mono text-white/40">{log.latency_ms}ms</td>
                          <td className="p-4 text-[10px] font-mono text-white/40">
                            {log.tokens_input || 0} / {log.tokens_output || 0}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">SUCCESS</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* INBOX STEP */}
          {step === 'inbox' && (
            <motion.div 
              key="inbox"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight uppercase">JOB <span className="text-neon-blue">INBOX</span></h2>
                  <p className="text-white/40 text-sm">All your captured opportunities in one neural hub.</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex p-1 bg-white/5 border border-white/10 rounded-lg">
                    {['all', JobStatus.saved, JobStatus.applied, JobStatus.follow_up].map(f => (
                      <button
                        key={f}
                        onClick={() => setInboxFilter(f as any)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${inboxFilter === f ? 'bg-neon-blue/20 text-neon-blue' : 'text-white/40 hover:text-white/60'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  {user && jobs.length > 0 && (
                    <button 
                      onClick={() => {
                        if (selectedJobIds.length === jobs.length) {
                          setSelectedJobIds([]);
                        } else {
                          setSelectedJobIds(jobs.map(j => j.id!).filter(Boolean));
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 transition-all"
                    >
                      {selectedJobIds.length === jobs.length ? <CheckSquare size={14} className="text-neon-blue" /> : <Square size={14} />}
                      Select All
                    </button>
                  )}
                  <NeonButton variant="blue" onClick={() => setStep('capture')}>
                    <Plus size={18} className="mr-2" /> Capture New
                  </NeonButton>
                </div>
              </div>

              {/* Bulk Actions Bar */}
              <AnimatePresence>
                {selectedJobIds.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 rounded-xl bg-neon-blue/10 border border-neon-blue/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-neon-blue uppercase tracking-widest">
                        {selectedJobIds.length} Items Selected
                      </span>
                      <div className="h-4 w-px bg-neon-blue/20" />
                      <button 
                        onClick={() => setSelectedJobIds([])}
                        className="text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <NeonButton 
                        variant="blue" 
                        className="!py-1.5 !px-4 !text-[10px]"
                        onClick={handleBulkMarkAsApplied}
                        isLoading={loading}
                      >
                        Mark as Applied
                      </NeonButton>
                      <button 
                        onClick={handleBulkDeleteJobs}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!user ? (
                <GlassCard className="py-20 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/20">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Authentication Required</h3>
                    <p className="text-white/40 max-w-xs mx-auto">Connect your neural link to access your personal job inbox and sync across devices.</p>
                  </div>
                  <NeonButton variant="blue" onClick={signIn}>Connect Now</NeonButton>
                </GlassCard>
              ) : jobs.length === 0 ? (
                <GlassCard className="py-20 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/20">
                    <Inbox size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Inbox Empty</h3>
                    <p className="text-white/40">No jobs captured yet. Start by capturing a job from a link or text.</p>
                  </div>
                  <NeonButton variant="blue" onClick={() => setStep('capture')}>Start Capturing</NeonButton>
                </GlassCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {jobs.filter(j => inboxFilter === 'all' || j.status === inboxFilter).map(job => (
                    <GlassCard 
                      key={job.id} 
                      className={cn(
                        "group hover:border-neon-blue/50 transition-all flex flex-col relative cursor-pointer",
                        selectedJobIds.includes(job.id!) && "border-neon-blue/50 bg-neon-blue/5"
                      )}
                      onClick={() => {
                        setExtractedJob(job);
                        setStep('results');
                        handleAnalyze(job);
                      }}
                    >
                      <div className="absolute top-4 left-4 z-10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (job.id) {
                              setSelectedJobIds(prev => 
                                prev.includes(job.id!) 
                                  ? prev.filter(id => id !== job.id) 
                                  : [...prev, job.id!]
                              );
                            }
                          }}
                          className="text-neon-blue transition-all"
                        >
                          {selectedJobIds.includes(job.id!) ? <CheckSquare size={20} /> : <Square size={20} className="opacity-20 group-hover:opacity-100" />}
                        </button>
                      </div>

                      <div className="flex justify-between items-start mb-4 pl-8">
                        <div className="space-y-1">
                          <h3 className="font-bold text-lg leading-tight group-hover:text-neon-blue transition-colors">{job.title}</h3>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-white/40 font-bold uppercase tracking-widest">{job.company}</p>
                            {job.source_url && (
                              <a 
                                href={job.source_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-neon-blue/60 hover:text-neon-blue flex items-center gap-1 transition-colors"
                              >
                                <LinkIcon size={10} /> Source
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setRawDataJob(job);
                              setShowRawData(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/20 hover:text-neon-blue transition-all"
                            title="View Raw Source"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              job.id && handleDeleteJob(job.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                          <MapPin size={12} /> {job.location || 'Unknown'}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <select 
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-transparent focus:outline-none transition-all cursor-pointer",
                              job.status === JobStatus.applied ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                              job.status === JobStatus.follow_up ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                              job.status === JobStatus.interview ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                              job.status === JobStatus.offer ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue' :
                              job.status === JobStatus.rejected ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                              'bg-white/10 border-white/20 text-white/60'
                            )}
                            value={job.status || JobStatus.saved}
                            onChange={async (e) => {
                              e.stopPropagation();
                              const newStatus = e.target.value as JobStatus;
                              if (job.id && user) {
                                try {
                                  await updateJobStatus(job.id, newStatus, job.postgres_id);
                                } catch (err: any) {
                                  setError(err.message);
                                }
                              }
                            }}
                          >
                            {Object.values(JobStatus).map(status => (
                              <option key={status} value={status} className="bg-black text-white">{status.replace('_', ' ')}</option>
                            ))}
                          </select>
                          {job.deadline && renderBadge(job.deadline, 'orange')}
                        </div>
                        <p className="text-xs text-white/60 line-clamp-3">{job.summary}</p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5 flex gap-2">
                        <NeonButton 
                          variant="blue" 
                          className="flex-1 !py-2 !text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExtractedJob(job);
                            setStep('results');
                            handleAnalyze(job);
                          }}
                        >
                          Analyze Fit
                        </NeonButton>
                        {(job.status === JobStatus.applied || job.status === JobStatus.follow_up) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const app = applications.find(a => a.job_id === job.id);
                              if (app) handleFollowUp(job, app);
                            }}
                            className="p-2 rounded-lg border border-neon-purple/30 hover:bg-neon-purple/10 text-neon-purple"
                            title="Generate Follow-up"
                          >
                            <Mail size={14} />
                          </button>
                        )}
                        {job.application_url && (
                          <a 
                            href={job.application_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/40"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* APPLICATIONS STEP */}
          {step === 'applications' && (
            <motion.div 
              key="applications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight uppercase">APP <span className="text-neon-purple">HISTORY</span></h2>
                  <p className="text-white/40 text-sm">Track your generated materials and application status.</p>
                </div>
                {user && applications.length > 0 && (
                  <button 
                    onClick={() => {
                      if (selectedAppIds.length === applications.length) {
                        setSelectedAppIds([]);
                      } else {
                        setSelectedAppIds(applications.map(a => a.id!).filter(Boolean));
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 transition-all"
                  >
                    {selectedAppIds.length === applications.length ? <CheckSquare size={14} className="text-neon-purple" /> : <Square size={14} />}
                    Select All
                  </button>
                )}
              </div>

              {/* Bulk Actions Bar */}
              <AnimatePresence>
                {selectedAppIds.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 rounded-xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-neon-purple uppercase tracking-widest">
                        {selectedAppIds.length} Items Selected
                      </span>
                      <div className="h-4 w-px bg-neon-purple/20" />
                      <button 
                        onClick={() => setSelectedAppIds([])}
                        className="text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleBulkDeleteApps}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!user ? (
                <GlassCard className="py-20 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/20">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Authentication Required</h3>
                    <p className="text-white/40 max-w-xs mx-auto">Connect your neural link to access your application history.</p>
                  </div>
                  <NeonButton variant="blue" onClick={signIn}>Connect Now</NeonButton>
                </GlassCard>
              ) : applications.length === 0 ? (
                <GlassCard className="py-20 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/20">
                    <History size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">No History</h3>
                    <p className="text-white/40">You haven't saved any generated applications yet.</p>
                  </div>
                  <NeonButton variant="blue" onClick={() => setStep('inbox')}>Go to Inbox</NeonButton>
                </GlassCard>
              ) : (
                <div className="space-y-4">
                  {applications.map(app => {
                    const job = jobs.find(j => j.id === app.job_id);
                    return (
                      <GlassCard 
                        key={app.id} 
                        className={cn(
                          "flex flex-col md:flex-row gap-6 items-start md:items-center relative cursor-pointer group hover:border-neon-purple/50 transition-all",
                          selectedAppIds.includes(app.id!) && "border-neon-purple/50 bg-neon-purple/5"
                        )}
                        onClick={() => {
                          setGeneratedApp(app);
                          if (job) setExtractedJob(job);
                          setStep('results');
                        }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 left-4 z-10 hidden md:block">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (app.id) {
                                setSelectedAppIds(prev => 
                                  prev.includes(app.id!) 
                                    ? prev.filter(id => id !== app.id) 
                                    : [...prev, app.id!]
                                );
                              }
                            }}
                            className="text-neon-purple transition-all"
                          >
                            {selectedAppIds.includes(app.id!) ? <CheckSquare size={20} /> : <Square size={20} className="opacity-20 hover:opacity-100" />}
                          </button>
                        </div>

                        <div className="flex-1 space-y-2 md:pl-10">
                          <div className="flex items-center gap-3">
                            <div className="md:hidden">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (app.id) {
                                    setSelectedAppIds(prev => 
                                      prev.includes(app.id!) 
                                        ? prev.filter(id => id !== app.id) 
                                        : [...prev, app.id!]
                                    );
                                  }
                                }}
                                className="text-neon-purple transition-all"
                              >
                                {selectedAppIds.includes(app.id!) ? <CheckSquare size={18} /> : <Square size={18} className="opacity-20" />}
                              </button>
                            </div>
                            <h3 className="font-bold text-lg group-hover:text-neon-purple transition-colors">{job?.title || 'Unknown Job'}</h3>
                            {renderBadge(app.output_mode, 'purple')}
                          </div>
                          <p className="text-xs text-white/40 font-bold uppercase tracking-widest">{job?.company || 'Unknown Company'}</p>
                          <div className="flex items-center gap-4 text-[10px] text-white/30">
                            <span className="flex items-center gap-1"><Calendar size={12} /> {app.applied_at?.toDate().toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><Target size={12} /> {app.generation_confidence} Confidence</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 w-full md:w-auto">
                          <NeonButton 
                            variant="purple" 
                            className="flex-1 md:flex-none !py-2 !px-4 !text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGeneratedApp(app);
                              if (job) setExtractedJob(job);
                              setStep('results');
                            }}
                          >
                            View Content
                          </NeonButton>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (job) handleFollowUp(job, app);
                            }}
                            className="p-2 rounded-lg hover:bg-neon-purple/10 text-white/20 hover:text-neon-purple transition-all"
                            title="Generate Follow-up"
                          >
                            <Mail size={18} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              app.id && handleDeleteApplication(app.id);
                            }}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showRawData && rawDataJob && (
          <RawDataViewer 
            job={rawDataJob} 
            onClose={() => {
              setShowRawData(false);
              setRawDataJob(null);
            }} 
            onSave={async (updatedJob) => {
              if (updatedJob.id) {
                await updateJob(updatedJob.id, updatedJob);
                setRawDataJob(updatedJob);
                // If the current extractedJob is the one being edited, update it too
                if (extractedJob?.id === updatedJob.id) {
                  setExtractedJob(updatedJob);
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <footer className="mt-20 py-10 border-t border-white/5 text-center space-y-4">
        <div className="flex justify-center gap-8 opacity-20">
          <Cpu size={24} />
          <Zap size={24} />
          <ShieldCheck size={24} />
          <Target size={24} />
        </div>
        <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.5em]">
          Vision 2060 Protocol // Secure Neural Link // AI-Driven Career Synthesis
        </p>
      </footer>
    </div>
  );
}
