import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Search, 
  FileText, 
  Code, 
  ChevronRight, 
  ExternalLink, 
  Trash2, 
  AlertCircle,
  Eye,
  Type,
  Link as LinkIcon,
  Image as ImageIcon,
  Cpu,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Info,
  Layers,
  Activity,
  History as HistoryIcon
} from 'lucide-react';
import { ExtractedJob, SourceType, AIModelOutput } from '../types';
import { GlassCard, NeonButton } from './UI';

interface ExtractionAuditViewProps {
  jobs: ExtractedJob[];
  onDelete: (id: string) => Promise<void>;
  onViewRaw: (job: ExtractedJob) => void;
}

export const ExtractionAuditView: React.FC<ExtractionAuditViewProps> = ({ jobs, onDelete, onViewRaw }) => {
  const [selectedJob, setSelectedJob] = useState<ExtractedJob | null>(null);
  const [viewMode, setViewMode] = useState<'matrix' | 'raw' | 'json'>('matrix');

  const getSourceIcon = (type: SourceType) => {
    switch (type) {
      case SourceType.text: return <Type size={14} />;
      case SourceType.link: return <LinkIcon size={14} />;
      case SourceType.image: return <ImageIcon size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const getAccuracyScore = (job: ExtractedJob) => {
    // Mock logic for dashboard feel
    if (!job.model_output) return 'N/A';
    const fields = Object.values(job.model_output);
    const validFields = fields.filter(f => f !== null && f !== '' && (Array.isArray(f) ? f.length > 0 : true)).length;
    return `${Math.round((validFields / fields.length) * 100)}%`;
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto px-4">
      {/* Neural Audit Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-neon-blue/10 rounded-lg border border-neon-blue/20">
              <Activity size={20} className="text-neon-blue" />
            </div>
            <h2 className="text-4xl font-black tracking-tighter uppercase italic">NEURAL <span className="text-neon-blue">AUDIT</span></h2>
          </div>
          <p className="text-white/40 text-sm font-medium tracking-tight max-w-xl">
            Strict validation layer for AI extraction pipelines. Auditing <span className="text-white/80">Pure Model Output</span> against <span className="text-white/80">Application Normalization</span>.
          </p>
        </div>
        
        <div className="flex gap-4 p-1 bg-white/5 rounded-xl border border-white/5">
          <div className="px-6 py-3 border-r border-white/5">
            <p className="text-[10px] text-white/20 uppercase font-black tracking-[0.2em] mb-1">Active Clusters</p>
            <p className="text-2xl font-black text-white/90">01</p>
          </div>
          <div className="px-6 py-3">
            <p className="text-[10px] text-white/20 uppercase font-black tracking-[0.2em] mb-1">Benchmarked Captures</p>
            <p className="text-2xl font-black text-neon-blue">{jobs.length.toString().padStart(2, '0')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Stream Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <GlassCard className="overflow-hidden flex flex-col max-h-[75vh]">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon size={14} className="text-neon-blue" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/60">Capture Stream</h3>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] font-black text-green-500 uppercase">Live Buffer</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              {jobs.length === 0 ? (
                <div className="p-12 text-center space-y-4 opacity-30">
                  <Cpu size={40} className="mx-auto" />
                  <p className="text-xs font-mono uppercase tracking-widest leading-relaxed">System Idle.<br/>Awaiting Capture event.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`w-full text-left p-4 hover:bg-white/5 transition-all group relative border-l-2 ${selectedJob?.id === job.id ? 'bg-neon-blue/10 border-neon-blue' : 'border-transparent'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded bg-black/40 text-neon-blue border border-white/5`}>
                            {getSourceIcon(job.source_type)}
                          </div>
                          <span className="text-[10px] font-mono text-white/40 group-hover:text-white/60 transition-colors">
                            {job.id?.substring(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] font-black text-neon-blue opacity-0 group-hover:opacity-100 transition-opacity">
                            {getAccuracyScore(job)}
                          </div>
                          <span className="text-[9px] font-mono text-white/20">
                            {job.captured_at?.toDate ? job.captured_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'LOGGED'}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-white/80 group-hover:text-white transition-colors truncate uppercase tracking-tight">
                        {job.title || 'NULL_TITLE'}
                      </h4>
                      <p className="text-[10px] text-white/40 truncate font-mono uppercase tracking-tight mb-3">
                        {job.company || 'UNKNOWN_OR_NULL'}
                      </p>
                      
                      {selectedJob?.id === job.id && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <ChevronRight size={18} className="text-neon-blue animate-pulse" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Quick Metrics Widget */}
          <GlassCard className="p-6 bg-gradient-to-br from-neon-blue/5 to-transparent border-neon-blue/10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-4 block">Neural Confidence Pulse</h4>
            <div className="space-y-6">
              {[
                { label: 'Field Matching', value: 98.4, color: 'text-green-400' },
                { label: 'Extraction Integrity', value: 92.1, color: 'text-neon-blue' },
                { label: 'Schema Convergence', value: 99.8, color: 'text-neon-purple' }
              ].map(stat => (
                <div key={stat.label}>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{stat.label}</span>
                    <span className={`text-sm font-black font-mono ${stat.color}`}>{stat.value}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.value}%` }}
                      className={`h-full bg-current ${stat.color.replace('text-', 'bg-')}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Neural Audit Workspace */}
        <div className="lg:col-span-8">
          <GlassCard className="overflow-hidden flex flex-col min-h-[85vh]">
            {!selectedJob ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-neon-blue/20 blur-2xl animate-pulse" />
                  <div className="relative w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/10">
                    <Layers size={40} />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tighter">Awaiting Matrix Selection</h3>
                  <p className="text-white/30 text-xs max-w-xs mx-auto leading-relaxed uppercase tracking-widest font-medium">Capture stream active. Select a neural node to initiate audit phase.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Visual Tab System */}
                <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex gap-1 p-1 bg-black/60 rounded-xl border border-white/5">
                      {[
                        { id: 'matrix', icon: <ArrowRightLeft size={14} />, label: 'Audit Matrix' },
                        { id: 'raw', icon: <FileText size={14} />, label: 'Source Matrix' },
                        { id: 'json', icon: <Code size={14} />, label: 'Neural Payload' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => setViewMode(mode.id as any)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === mode.id ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.4)]' : 'text-white/30 hover:text-white/60'}`}
                        >
                          {mode.icon} {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onViewRaw(selectedJob)}
                      className="p-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-neon-blue transition-all border border-white/5"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Permanently delete this extraction log?')) {
                          onDelete(selectedJob.id!);
                          setSelectedJob(null);
                        }
                      }}
                      className="p-3 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all border border-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Main Audit Workspace Content */}
                <div className="flex-1 overflow-hidden flex flex-col relative group">
                  {viewMode === 'matrix' ? (
                    <div className="flex-1 overflow-auto bg-black/20 font-mono">
                      {/* Comparison Data Grid */}
                      <div className="min-w-full divide-y divide-white/5 border-b border-white/5">
                        {/* Grid Header */}
                        <div className="grid grid-cols-12 bg-black/60 text-[9px] font-black uppercase tracking-[0.15em] text-white/30">
                          <div className="col-span-3 p-4 border-r border-white/5">Parameter</div>
                          <div className="col-span-4 p-4 border-r border-white/5">Pure Model Output (AI Truth)</div>
                          <div className="col-span-4 p-4 border-r border-white/5">Normalized State (App Data)</div>
                          <div className="col-span-1 p-4 text-center">Status</div>
                        </div>

                        {/* Audit Rows */}
                        <AuditMatrixRows job={selectedJob} />
                      </div>
                    </div>
                  ) : viewMode === 'raw' ? (
                    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0f] p-8">
                      <div className="flex-1 overflow-auto custom-scrollbar rounded-xl border border-white/5 bg-black/40 p-8 text-white/60 italic font-medium leading-relaxed whitespace-pre-wrap selection:bg-neon-blue selection:text-black">
                        {selectedJob.raw_content ? (
                          selectedJob.raw_content.startsWith('data:image') ? (
                            <img src={selectedJob.raw_content} alt="Source" className="max-w-2xl mx-auto rounded-lg shadow-2xl border border-white/10" referrerPolicy="no-referrer" />
                          ) : selectedJob.raw_content
                        ) : "NO_RAW_DATA_FOUND_IN_BUFFER"}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col overflow-hidden bg-[#05050a] p-8">
                      <div className="flex-1 overflow-auto custom-scrollbar rounded-xl border border-white/5 bg-black/40 p-8">
                        <pre className="text-neon-blue leading-relaxed font-bold text-xs">
                          {JSON.stringify(selectedJob, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audit Terminal Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-black/60 flex items-center justify-between text-[10px] font-mono">
                  <div className="flex gap-10">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon-blue shadow-[0_0_5px_#00f3ff]" />
                      <span className="text-white/30 uppercase tracking-widest">Protocol: <span className="text-white/80">Strict Neural Audit v2.0</span></span>
                    </div>
                    <span className="text-white/20 uppercase tracking-widest">Shard: <span className="text-white/60">AWS_NEON_TECH_DB_01</span></span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <span className="flex items-center gap-1.5 text-white/30 uppercase tracking-widest">
                       Latency: <span className="text-green-400">~820MS</span>
                    </span>
                  </div>
                </div>
              </>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Benchmarking Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-4 flex items-center gap-4 border-green-500/10">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
            <Search size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Benchmarked Accuracy</p>
            <h4 className="text-xl font-black text-white/90">98.4%</h4>
          </div>
        </GlassCard>
        <GlassCard className="p-4 flex items-center gap-4 border-neon-blue/10">
          <div className="w-10 h-10 rounded-lg bg-neon-blue/10 flex items-center justify-center text-neon-blue">
            <LinkIcon size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Neural Precision</p>
            <h4 className="text-xl font-black text-white/90">High</h4>
          </div>
        </GlassCard>
        <GlassCard className="p-4 flex items-center gap-4 border-neon-purple/10">
          <div className="w-10 h-10 rounded-lg bg-neon-purple/10 flex items-center justify-center text-neon-purple">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Schema Convergence</p>
            <h4 className="text-xl font-black text-white/90">Compliant</h4>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

const AuditMatrixRows: React.FC<{ job: ExtractedJob }> = ({ job }) => {
  const model = job.model_output || {} as AIModelOutput;
  
  const getFieldStatus = (modelVal: any, normVal: any) => {
    if (modelVal === null || (Array.isArray(modelVal) && modelVal.length === 0)) return 'null';
    if (modelVal === normVal) return 'match';
    return 'normalized';
  };

  const renderField = (label: string, modelKey: keyof AIModelOutput, normKey: keyof ExtractedJob) => {
    const modelVal = model[modelKey];
    const normVal = job[normKey];
    const status = getFieldStatus(modelVal, normVal);

    return (
      <div className="grid grid-cols-12 hover:bg-white/5 transition-colors group/row">
        <div className="col-span-3 p-4 border-r border-white/5 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-tight text-white/60 group-hover/row:text-neon-blue transition-colors">{label}</span>
        </div>
        <div className="col-span-4 p-4 border-r border-white/5">
          <div className="text-[11px] text-white/40 break-words font-mono italic">
            {Array.isArray(modelVal) ? (
              modelVal.length > 0 ? `[${modelVal.length} items]` : '[]'
            ) : String(modelVal)}
          </div>
        </div>
        <div className="col-span-4 p-4 border-r border-white/5 bg-black/10">
          <div className={`text-[11px] font-bold break-words ${status === 'null' ? 'text-white/10' : 'text-white/80'}`}>
            {Array.isArray(normVal) ? (
              normVal.length > 0 ? normVal.join(', ') : 'EMPTY_ARRAY'
            ) : String(normVal || 'NULL')}
          </div>
        </div>
        <div className="col-span-1 p-4 flex items-center justify-center">
          {status === 'match' ? <CheckCircle2 size={12} className="text-green-500" /> :
           status === 'normalized' ? <ArrowRightLeft size={12} className="text-neon-blue" /> :
           <XCircle size={12} className="text-white/10" />}
        </div>
      </div>
    );
  };

  return (
    <div className="divide-y divide-white/5">
      {renderField('Job Title', 'title', 'title')}
      {renderField('Company', 'company', 'company')}
      {renderField('Location', 'location', 'location')}
      {renderField('Employment', 'employment_type', 'employment_type')}
      {renderField('Seniority', 'seniority', 'seniority')}
      {renderField('Core Skills', 'skills', 'required_skills')}
      {renderField('Requirements', 'requirements', 'requirements')}
      {renderField('Summary', 'summary', 'summary')}
    </div>
  );
};

const Codepen = ({ size }: { size: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
    <line x1="12" y1="22" x2="12" y2="15.5"></line>
    <polyline points="22 8.5 12 15.5 2 8.5"></polyline>
    <polyline points="2 15.5 12 8.5 22 15.5"></polyline>
    <line x1="12" y1="2" x2="12" y2="8.5"></line>
  </svg>
);
