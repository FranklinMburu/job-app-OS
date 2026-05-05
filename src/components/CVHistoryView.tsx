import React from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Trash2, 
  Clock, 
  Search, 
  ExternalLink,
  Target,
  FileDown,
  ChevronRight,
  Eye,
  Copy,
  History as HistoryIcon,
  ShieldCheck
} from 'lucide-react';
import { GlassCard, NeonButton } from './UI';
import { GeneratedCV } from '../types';

interface CVHistoryViewProps {
  cvs: GeneratedCV[];
  onSelect: (cv: GeneratedCV) => void;
  onDelete: (id: string) => void;
  onViewJobHistory: (jobId: string) => void;
}

export const CVHistoryView: React.FC<CVHistoryViewProps> = ({ cvs, onSelect, onDelete, onViewJobHistory }) => {
  const [search, setSearch] = React.useState('');

  const filteredCVs = cvs.filter(cv => 
    cv.tailored_to.toLowerCase().includes(search.toLowerCase()) ||
    cv.markdown_content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">COMPILER <span className="text-neon-purple">ARCHIVE</span></h2>
          <p className="text-white/40 text-sm">Deterministic professional history output database.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
          <input 
            type="text" 
            placeholder="FILTER ARTIFACTS..."
            className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-white focus:outline-none focus:border-neon-purple transition-all w-64"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredCVs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCVs.map((cv, i) => (
            <motion.div
              key={cv.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard className="group p-5 space-y-4 hover:bg-white/5 transition-all border-white/5 hover:border-neon-purple/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Target size={48} className="text-neon-purple/10" />
                </div>

                <div className="flex items-center justify-between relative z-10">
                   <div className="p-2 rounded-lg bg-neon-purple/10 border border-neon-purple/20 text-neon-purple">
                     <FileText size={20} />
                   </div>
                   <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em]">
                     {cv.generated_at?.toDate ? cv.generated_at.toDate().toLocaleDateString() : 'Active'}
                   </span>
                </div>

                <div className="space-y-1 relative z-10">
                   <h3 className="text-sm font-bold text-white/90 group-hover:text-neon-purple transition-colors truncate">
                     {cv.tailored_to}
                   </h3>
                   <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Compiled Artifact</span>
                      <div className="w-1 h-1 rounded-full bg-white/10" />
                      {cv.job_id && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewJobHistory(cv.job_id!);
                          }}
                          className="text-[10px] text-neon-blue hover:underline font-bold uppercase tracking-widest flex items-center gap-1"
                        >
                          <HistoryIcon size={10} /> Versions
                        </button>
                      )}
                      <span className="text-[10px] text-neon-purple/60 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Clock size={10} /> {cv.generated_at?.toDate ? cv.generated_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                      <div className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="text-[9px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
                        <ShieldCheck size={10} /> LOCKED
                      </span>
                   </div>
                </div>

                <div className="pt-4 flex items-center gap-2 relative z-10">
                   <button 
                     onClick={() => onSelect(cv)}
                     className="flex-1 px-4 py-2 rounded-lg bg-neon-purple text-black text-[10px] font-black uppercase tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                   >
                     <Eye size={14} /> OPEN WORKSPACE
                   </button>
                   <button 
                     onClick={() => {
                       navigator.clipboard.writeText(cv.markdown_content);
                     }}
                     className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/10 group relative"
                     title="Copy Markdown"
                   >
                     <Copy size={16} />
                     <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">COPY</span>
                   </button>
                   <button 
                     onClick={() => cv.id && onDelete(cv.id)}
                     className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all border border-red-500/20"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="p-20 text-center space-y-6 bg-white/5 rounded-3xl border border-white/5 border-dashed">
           <FileDown className="mx-auto text-white/10" size={64} />
           <div className="space-y-2">
             <h3 className="text-xl font-bold uppercase tracking-widest text-white/40">No Artifacts Found</h3>
             <p className="text-sm text-white/20 max-w-sm mx-auto uppercase tracking-wider">Generate your first job-tailored CV to see it appear in your timeline.</p>
           </div>
        </div>
      )}
    </div>
  );
};
