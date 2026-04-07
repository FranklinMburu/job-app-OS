import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Code, Copy, Check, Eye, Edit3, Save, Download, ExternalLink } from 'lucide-react';
import { ExtractedJob } from '../types';

interface RawDataViewerProps {
  job: ExtractedJob;
  onClose: () => void;
  onSave?: (updatedJob: ExtractedJob) => Promise<void>;
}

export const RawDataViewer: React.FC<RawDataViewerProps> = ({ job, onClose, onSave }) => {
  const [view, setView] = useState<'readable' | 'json'>('readable');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(job.raw_content || '');
  const [editJson, setEditJson] = useState(JSON.stringify(job, null, 2));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCopy = () => {
    const text = view === 'readable' ? (isEditing ? editContent : job.raw_content) : (isEditing ? editJson : JSON.stringify(job, null, 2));
    navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = view === 'readable' ? (isEditing ? editContent : job.raw_content) : (isEditing ? editJson : JSON.stringify(job, null, 2));
    const blob = new Blob([text || ''], { type: view === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job_raw_${job.id || 'export'}.${view === 'json' ? 'json' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      let updatedJob: ExtractedJob;
      if (view === 'json') {
        updatedJob = JSON.parse(editJson);
      } else {
        updatedJob = { ...job, raw_content: editContent };
      }
      await onSave(updatedJob);
      setIsEditing(false);
    } catch (err) {
      alert("Failed to save: " + (err instanceof Error ? err.message : "Invalid format"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neon-blue/10 text-neon-blue">
              <Eye size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">RAW DATA ARCHIVE</h3>
              <div className="flex items-center gap-3">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">
                  {job.company} — {job.title}
                </p>
                {job.source_url && (
                  <a 
                    href={job.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-neon-blue hover:text-neon-blue/80 flex items-center gap-1 font-mono transition-colors"
                  >
                    <ExternalLink size={10} /> Source Link
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSave && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 rounded-lg transition-all ${
                  isEditing ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-white/10 text-white/40'
                }`}
                title={isEditing ? "Cancel Edit" : "Edit Data"}
              >
                <Edit3 size={20} />
              </button>
            )}
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg hover:bg-white/10 text-white/40 transition-all"
              title="Download Data"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-white/40 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-2 bg-black/40 border-b border-white/5">
          <button
            onClick={() => setView('readable')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              view === 'readable' ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]' : 'text-white/40 hover:bg-white/5'
            }`}
          >
            <FileText size={14} /> Readable
          </button>
          <button
            onClick={() => setView('json')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              view === 'json' ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]' : 'text-white/40 hover:bg-white/5'
            }`}
          >
            <Code size={14} /> JSON Schema
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 font-mono text-xs leading-relaxed">
          <div className="relative group flex-1 flex flex-col">
            <button
              onClick={handleCopy}
              className="absolute top-0 right-0 z-10 p-2 rounded bg-white/5 hover:bg-white/10 text-white/40 transition-all opacity-0 group-hover:opacity-100"
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            
            {isEditing ? (
              <textarea
                className="w-full flex-1 bg-black/40 border border-white/10 rounded-lg p-4 text-white/80 focus:outline-none focus:border-neon-blue/50 resize-none font-mono"
                value={view === 'readable' ? editContent : editJson}
                onChange={e => view === 'readable' ? setEditContent(e.target.value) : setEditJson(e.target.value)}
              />
            ) : (
              <div className="flex-1 overflow-auto">
                {view === 'readable' ? (
                  <div className="text-white/70 whitespace-pre-wrap break-words">
                    {job.raw_content || "No raw content available for this record."}
                  </div>
                ) : (
                  <pre className="text-neon-blue/80 overflow-x-auto">
                    {JSON.stringify(job, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20 flex justify-between items-center">
          <p className="text-[9px] text-white/20 uppercase tracking-widest font-mono">
            {isEditing ? "Editing Mode Active" : "Read-Only Archive Mode"}
          </p>
          <div className="flex gap-3">
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-green-500 text-black text-xs font-bold uppercase tracking-widest transition-all hover:bg-green-400 disabled:opacity-50"
              >
                {saving ? <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
                Save Changes
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-bold uppercase tracking-widest transition-all"
            >
              Close Archive
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
