import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Download,
  Upload,
  Layers
} from 'lucide-react';
import { GlassCard, NeonButton, FuturisticInput } from './UI';
import { aiService } from '../services/aiService';
import { saveGeneratedCV } from '../lib/firebase';
import { GeneratedCV, SourceType } from '../types';

interface StandaloneCVBuilderProps {
  user: any;
  profile: any;
  onCVSaved: (cv: GeneratedCV) => void;
  onVerifyStructure?: () => void;
}

export const StandaloneCVBuilder: React.FC<StandaloneCVBuilderProps> = ({ user, profile, onCVSaved, onVerifyStructure }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'import'>('generate');
  const [importText, setImportText] = useState('');
  
  // Local state for the CV being built
  const [cvData, setCVData] = useState({
    targetRole: '',
    customInstruction: '',
    experienceHighlights: '',
    projectFocus: ''
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportText(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!user) return;
    if (!importText) {
      setError("Please paste CV content to import.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Use AI to structure the pasted text into our 8-pillar format
      const result = await aiService.generateMasterCV({ ...profile, cv_text: importText });
      
      const newCVData = {
        job_id: 'manual_import',
        markdown_content: result.markdown_content,
        tailored_to: "Imported Artifact",
        generated_at: new Date()
      };

      const id = await saveGeneratedCV(user.uid, newCVData);
      const newCV: GeneratedCV = { ...newCVData, id, uid: user.uid };
      onCVSaved(newCV);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuild = async () => {
    if (!user) {
      setError("User not authenticated.");
      return;
    }

    if (!profile.cv_text && !profile.experience_summary && profile.skills.length === 0) {
      setError("Your profile appears to be empty. Please populate 'My Profile' or sync your CV before building new artifacts.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let result;
      let tailored_to = "Master Resume";

      if (cvData.targetRole) {
        // Tailored generation
        const mockJob: any = {
          title: cvData.targetRole,
          company: "Specialized Reference",
          requirements: [cvData.customInstruction || cvData.targetRole],
          required_skills: [cvData.targetRole],
          summary: cvData.experienceHighlights || "Creating a specialized neural artifact.",
          location: "Remote",
          raw_content: cvData.customInstruction || "Manual Build Directive",
          source_type: SourceType.text,
          preferred_skills: [],
          seniority: null,
          employment_type: null,
          remote_policy: null,
          application_method: null,
          missing_fields: []
        };
        result = await aiService.generateTailoredCV(mockJob, profile);
        tailored_to = `${cvData.targetRole}`;
      } else {
        // Master generation
        result = await aiService.generateMasterCV(profile);
      }
      
      const newCVData = {
        job_id: 'manual_build',
        markdown_content: result.markdown_content,
        tailored_to: tailored_to,
        generated_at: new Date()
      };

      const id = await saveGeneratedCV(user.uid, newCVData);
      
      const newCV: GeneratedCV = {
        ...newCVData,
        id,
        uid: user.uid
      };

      onCVSaved(newCV);
      setSuccess(true);
    } catch (err: any) {
      console.error("Manual CV Build Fail:", err);
      setError(err.message || "Failed to generate CV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-12">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="p-1 rounded-xl bg-white/5 border border-white/10 flex gap-1">
            {[
              { id: 'generate', label: 'AI Generator', icon: <Cpu size={14} /> },
              { id: 'import', label: 'Manual Import', icon: <FileText size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id 
                    ? 'bg-neon-purple text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
        <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none">CV <span className="text-neon-purple font-mono">BUILDER</span></h2>
        <p className="text-white/40 text-[10px] uppercase tracking-[0.4em] font-black">
          {activeTab === 'generate' ? 'Standalone Neural Artifact Generation Hub.' : 'Neural Reconstruction Facility.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'generate' ? (
            <GlassCard className="p-8 space-y-8">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="p-2 rounded-lg bg-neon-purple/10 text-neon-purple">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Configuration Matrix</h3>
                  <p className="text-[10px] text-white/40 uppercase">Define the target parameters for this artifact.</p>
                </div>
              </div>

              <div className="space-y-6">
                <FuturisticInput 
                  label="Target Role / Title" 
                  placeholder="e.g. Senior Full Stack Engineer"
                  value={cvData.targetRole}
                  onChange={e => setCVData({...cvData, targetRole: e.target.value})}
                />

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Custom Directives</label>
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-mono text-white/70 focus:border-neon-purple outline-none transition-all min-h-[120px]"
                    placeholder="Paste a job description or specific instructions for the AI..."
                    value={cvData.customInstruction}
                    onChange={e => setCVData({...cvData, customInstruction: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Focus Areas</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-mono text-white/70 focus:border-neon-purple outline-none transition-all min-h-[100px]"
                      placeholder="e.g. Cloud architecture, Team leadership..."
                      value={cvData.experienceHighlights}
                      onChange={e => setCVData({...cvData, experienceHighlights: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Project Highlights</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-mono text-white/70 focus:border-neon-purple outline-none transition-all min-h-[100px]"
                      placeholder="e.g. Built a microservices platform for FinTech..."
                      value={cvData.projectFocus}
                      onChange={e => setCVData({...cvData, projectFocus: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-[11px] font-bold">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 rounded bg-green-500/10 border border-green-500/20 flex items-center gap-3 text-green-400 text-[11px] font-bold">
                  <CheckCircle2 size={16} />
                  CV Generated Successfully! Redirecting to archive...
                </div>
              )}

              <NeonButton 
                variant="purple" 
                className="w-full py-4 text-lg font-black italic tracking-tighter"
                onClick={handleBuild}
                isLoading={loading}
              >
                <Download size={20} className="mr-2" /> GENERATE MASTER ARTIFACT
              </NeonButton>
            </GlassCard>
          ) : (
            <GlassCard className="p-8 space-y-8">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="p-2 rounded-lg bg-neon-blue/10 text-neon-blue">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Neural Import</h3>
                  <p className="text-[10px] text-white/40 uppercase">Reconstruct an existing CV into a system artifact.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Paste CV Content (PDF/DOCX Extraction)</label>
                    <p className="text-[9px] text-white/20 italic mb-2">Paste the text content of your current CV. Our AI will normalize it to the 8-pillar skeleton format.</p>
                  </div>
                  <div className="relative">
                    <input 
                      type="file" 
                      id="cv-upload" 
                      className="hidden" 
                      accept=".txt,.md"
                      onChange={handleFileUpload} 
                    />
                    <label 
                      htmlFor="cv-upload" 
                      className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-[9px] font-black text-white/40 hover:text-white hover:bg-white/10 cursor-pointer transition-all"
                    >
                      <Upload size={12} /> UPLOAD .TXT / .MD
                    </label>
                  </div>
                </div>
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-6 text-xs font-mono text-white/70 focus:border-neon-blue outline-none transition-all min-h-[300px] futuristic-scroll"
                  placeholder="Paste your CV here..."
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                />
              </div>

              {error && (
                <div className="p-4 rounded bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-[11px] font-bold">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <NeonButton 
                variant="purple" 
                className="w-full py-4 text-lg font-black italic tracking-tighter"
                onClick={handleImport}
                isLoading={loading}
              >
                <Layers size={20} className="mr-2" /> RECONSTRUCT AS ARTIFACT
              </NeonButton>
            </GlassCard>
          )}
        </div>

        <div className="space-y-8">
          <GlassCard className="p-6 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-neon-blue flex items-center gap-2">
              <Cpu size={16} /> System Protocol
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3 text-[10px] text-white/40 leading-relaxed font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1 shrink-0" />
                <span>Generating according to the non-negotiable 8-pillar skeleton format.</span>
              </div>
              <div className="flex gap-3 text-[10px] text-white/40 leading-relaxed font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1 shrink-0" />
                <span>AI will synthesize your profile data with the specified target role.</span>
              </div>
              <div className="flex gap-3 text-[10px] text-white/40 leading-relaxed font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1 shrink-0" />
                <span>Artifacts are automatically saved to your Compiler Archive.</span>
              </div>
            </div>
            
            <button 
              onClick={onVerifyStructure}
              className="w-full mt-4 py-3 rounded-lg border border-neon-blue/20 bg-neon-blue/5 text-[9px] font-black uppercase tracking-widest text-neon-blue hover:bg-neon-blue hover:text-black transition-all flex items-center justify-center gap-2"
            >
              <Cpu size={14} /> Structure Integrity Test
            </button>
          </GlassCard>

          <GlassCard className="p-6 bg-neon-purple/5 border-neon-purple/20">
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full border border-neon-purple/50 flex items-center justify-center text-neon-purple">
                <Layers size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Neural Profile Active</p>
                <p className="text-[8px] text-white/30 uppercase tracking-widest italic leading-relaxed">
                  Your identity matrix is currently synced and ready for transformation.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
};
