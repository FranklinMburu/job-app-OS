import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Layers, 
  Cpu, 
  Code2, 
  Zap,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  Binary
} from 'lucide-react';
import { GlassCard, NeonButton } from './UI';

import { aiService } from '../services/aiService';

interface StructureIntelligenceProps {
  onClose: () => void;
  cvContent?: string;
}

export const StructureIntelligence: React.FC<StructureIntelligenceProps> = ({ onClose, cvContent }) => {
  const [activeStep, setActiveStep] = useState(0);
  
  const pillars = [
    { title: "Contact Header", desc: "Your name, contact details, and link to professional profiles (LinkedIn/GitHub).", id: "P1" },
    { title: "Professional Summary", desc: "A brief, powerful summary explaining your core skills and suitability for the role.", id: "P2" },
    { title: "Core Skills", desc: "Categorized skills (e.g. Backend, Frontend, Tools) for quick scanning.", id: "P3" },
    { title: "Work Experience", desc: "Detailed achievements with measurable outcomes and impact.", id: "P4" },
    { title: "Key Projects", desc: "Notable professional or personal projects showing relevant technology stacks.", id: "P5" },
    { title: "Education", desc: "Academic degrees, certifications, or major course of study.", id: "P6" },
    { title: "Certifications & Languages", desc: "Professional credentials and secondary languages.", id: "P7" },
    { title: "Availability & Details", desc: "Notice period, work authorization, or relocation preferences.", id: "P8" }
  ];

  const verificationPoints = [
    { point: "Logical Section Ordering", icon: <Layers size={14} />, id: "ordering" },
    { point: "Action Verb Frequency", icon: <Zap size={14} />, id: "verbs" },
    { point: "Outcome & Impact Metrics", icon: <Cpu size={14} />, id: "impact" },
    { point: "ATS-Friendly Formatting", icon: <Code2 size={14} />, id: "semantic" }
  ];

  const [testResult, setTestResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const performVerification = async () => {
    if (!cvContent) return;
    setIsVerifying(true);
    setTestResult(null);
    
    try {
      const result = await aiService.verifyCVStructure(cvContent);
      setTestResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 overflow-hidden bg-black/80 backdrop-blur-xl"
    >
      <GlassCard className="w-full max-w-5xl h-full max-h-[85vh] flex flex-col p-0 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neon-blue/20 text-neon-blue">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter">Resume <span className="text-neon-blue">Format Checker</span></h2>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">8-Step Resume Layout & Structure Verification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all">
            <AlertCircle size={24} className="rotate-45" />
          </button>
        </div>

        <div className="flex-1 overflow-auto futuristic-scroll grid grid-cols-1 lg:grid-cols-12">
          {/* Left Panel: The Skeleton Definition */}
          <div className="lg:col-span-7 p-8 space-y-8 border-r border-white/5">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-neon-blue flex items-center gap-2">
                <Binary size={16} /> Resume Layout Guidelines
              </h3>
              <p className="text-white/40 text-[11px] leading-relaxed font-medium">
                To ensure your resume stands out and can be read perfectly by both human recruiters and Applicant Tracking Systems (ATS), we verify it against industry-standard structural rules.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pillars.map((pillar, i) => (
                <motion.div 
                  key={pillar.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2 hover:bg-white/10 transition-all group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-neon-blue uppercase">{pillar.id}</span>
                    {testResult?.pillarStatus ? (
                      testResult.pillarStatus[pillar.id] ? (
                        <CheckCircle2 size={12} className="text-green-400" />
                      ) : (
                        <AlertCircle size={12} className="text-red-400" />
                      )
                    ) : (
                      <CheckCircle2 size={12} className="text-neon-blue/30 group-hover:text-neon-blue transition-colors" />
                    )}
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/80">{pillar.title}</h4>
                  <p className="text-[9px] text-white/30 leading-snug font-bold italic">{pillar.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="p-6 rounded-2xl bg-neon-blue/5 border border-neon-blue/20 flex gap-4 items-start">
              <div className="p-2 rounded-lg bg-neon-blue/20 text-neon-blue">
                <Cpu size={20} />
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-black uppercase tracking-widest text-neon-blue">AI Checker Logic</p>
                <p className="text-white/50 leading-relaxed italic">
                  Every resume generated undergoes an automated verification to check bullet point strength, action verb density, and clear formatting.
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel: The Test Suite */}
          <div className="lg:col-span-5 p-8 space-y-8 flex flex-col bg-white/[0.02]">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <FileSearch size={16} /> ATS Checklist & Score
              </h3>
              <p className="text-white/30 text-[10px] uppercase font-black tracking-widest">
                Analyze your document against layout guidelines.
              </p>
            </div>

            <div className="flex-1 space-y-6">
              <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Layout Checkpoints</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-neon-blue animate-pulse">Checker Active</span>
                </div>
                <div className="space-y-3">
                  {verificationPoints.map((point) => (
                    <div key={point.id} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-2 text-white/60">
                        {point.icon}
                        <span className="font-bold">{point.point}</span>
                      </div>
                      <CheckCircle2 size={12} className="text-neon-blue" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-h-[150px] relative">
                <AnimatePresence mode="wait">
                  {isVerifying ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-neon-blue/20 border-t-neon-blue animate-spin" />
                      <p className="text-[10px] font-black text-neon-blue uppercase animate-pulse">Analyzing Resume Structure...</p>
                    </motion.div>
                  ) : testResult ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {testResult.success ? <CheckCircle2 className="text-green-400" size={16} /> : <AlertCircle className="text-red-400" size={16} />}
                          <span className={`text-[10px] font-black uppercase ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                            {testResult.success ? 'Format Approved' : 'Format Improvements Suggested'}
                          </span>
                        </div>
                        <span className="text-[20px] font-black font-mono text-white">{testResult.score}%</span>
                      </div>
                      <div className="space-y-2">
                        {testResult.logs.map((log: string, i: number) => (
                          <div key={i} className="text-[9px] font-mono text-white/30 flex gap-2">
                            <span>[{new Date().toLocaleTimeString()}]</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                      <Binary size={40} className="text-white/5" />
                      <p className="text-[10px] text-white/20 uppercase font-black">No test data processed.</p>
                      <p className="text-[8px] text-white/10 uppercase font-medium">Add some resume content to run a structural verification check.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-4">
              <NeonButton 
                variant="blue" 
                className="w-full py-4 text-[10px] font-black uppercase tracking-widest"
                onClick={performVerification}
                isLoading={isVerifying}
              >
                <Zap size={14} className="mr-2" /> RUN FORMAT CHECK
              </NeonButton>
              <button 
                onClick={onClose}
                className="w-full py-2 text-[8px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors"
              >
                CLOSE CHECKER
              </button>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
