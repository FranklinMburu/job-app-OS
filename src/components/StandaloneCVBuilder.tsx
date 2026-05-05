import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Download,
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
}

export const StandaloneCVBuilder: React.FC<StandaloneCVBuilderProps> = ({ user, profile, onCVSaved }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Local state for the CV being built
  const [cvData, setCVData] = useState({
    targetRole: '',
    customInstruction: '',
    experienceHighlights: '',
    projectFocus: ''
  });

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
        <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none">CV <span className="text-neon-purple font-mono">BUILDER</span></h2>
        <p className="text-white/40 text-[10px] uppercase tracking-[0.4em] font-black">Standalone Neural Artifact Generation Hub.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
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
