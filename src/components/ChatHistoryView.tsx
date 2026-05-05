import React from 'react';
import { motion } from 'motion/react';
import { 
  Cpu, 
  Clock, 
  Search, 
  Target, 
  Zap, 
  ChevronRight, 
  RefreshCw, 
  Trash2,
  ExternalLink,
  FileText,
  Mail
} from 'lucide-react';
import { GlassCard, NeonButton, cn } from './UI';
import { SourceType } from '../types';

interface ChatHistoryItem {
  id: string;
  uid: string;
  prompt: string;
  response: any;
  type: 'extraction' | 'analysis' | 'generation' | 'follow_up';
  metadata: any;
  timestamp: any;
}

interface ChatHistoryViewProps {
  history: ChatHistoryItem[];
  onReRun: (item: ChatHistoryItem) => void;
  onDelete?: (id: string) => void;
}

export const ChatHistoryView: React.FC<ChatHistoryViewProps> = ({ history, onReRun, onDelete }) => {
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'extraction': return <Search className="text-neon-blue" size={16} />;
      case 'analysis': return <Target className="text-neon-orange" size={16} />;
      case 'generation': return <Zap className="text-neon-purple" size={16} />;
      case 'follow_up': return <Mail className="text-neon-blue" size={16} />;
      case 'synthesis': return <FileText className="text-neon-purple" size={16} />;
      default: return <Cpu className="text-white/40" size={16} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'extraction': return 'Neural Extraction';
      case 'analysis': return 'Fit Analysis';
      case 'generation': return 'Application Gen';
      case 'follow_up': return 'Follow-up Gen';
      case 'synthesis': return 'Profile Synthesis';
      default: return 'AI Interaction';
    }
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
          <Cpu size={40} className="text-white/20" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black uppercase tracking-tighter">No Neural Logs</h3>
          <p className="text-white/40 max-w-xs mx-auto">Your AI interactions will be archived here for future reference and re-optimization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter">Neural Logs</h2>
          <p className="text-white/40 text-sm font-mono uppercase tracking-widest">Historical AI Interaction Archive</p>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Total Logs</span>
            <span className="text-lg font-mono text-neon-blue">{history.length}</span>
          </div>
          <Cpu className="text-neon-blue/40" size={24} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {history.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <GlassCard className="group hover:bg-white/5 transition-all duration-300 border-white/5 hover:border-white/20">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Type & Time */}
                <div className="flex md:flex-col items-center md:items-start justify-between md:justify-start gap-4 md:w-48 shrink-0">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    {getIcon(item.type)}
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                      {getTypeLabel(item.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white/20 font-mono text-[10px]">
                    <Clock size={12} />
                    {formatDate(item.timestamp)}
                  </div>
                </div>

                {/* Middle: Content */}
                <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Neural Prompt</span>
                    <p className="text-sm text-white/80 line-clamp-2 italic">"{item.prompt}"</p>
                  </div>
                  
                  {item.type === 'extraction' && item.response?.title && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-neon-blue/5 border border-neon-blue/10">
                      <div className="w-10 h-10 rounded bg-neon-blue/10 flex items-center justify-center text-neon-blue font-black">
                        {item.response.company?.[0] || 'J'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-tight">{item.response.title}</h4>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">{item.response.company}</p>
                      </div>
                    </div>
                  )}

                  {item.type === 'analysis' && item.response?.verdict && (
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                        item.response.verdict === 'relevant' ? "bg-green-500/20 text-green-400" :
                        item.response.verdict === 'maybe' ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      )}>
                        {item.response.verdict.replace('_', ' ')}
                      </span>
                      <p className="text-xs text-white/60 line-clamp-1">{item.response.fit_summary}</p>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 md:flex-col md:justify-center shrink-0">
                  <NeonButton 
                    variant="blue" 
                    className="flex-1 md:w-full"
                    onClick={() => onReRun(item)}
                  >
                    <RefreshCw size={14} className="mr-2" /> Re-Run
                  </NeonButton>
                  {onDelete && (
                    <button 
                      onClick={() => onDelete(item.id)}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/20 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
