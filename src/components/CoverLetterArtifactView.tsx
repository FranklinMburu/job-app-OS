import React, { useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  FileText, 
  Check, 
  Copy, 
  Printer, 
  Trash2, 
  ArrowLeft,
  Cpu,
  Bookmark,
  Target,
  Clock,
  ShieldCheck,
  FileDown,
  Edit3,
  X,
  Save,
  Zap
} from 'lucide-react';
import { GlassCard, NeonButton, cn } from './UI';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { GeneratedCoverLetter } from '../types';

interface CoverLetterArtifactViewProps {
  letter: GeneratedCoverLetter;
  onClose: () => void;
  onDelete?: () => void;
}

export const CoverLetterArtifactView: React.FC<CoverLetterArtifactViewProps> = ({ 
  letter, 
  onClose,
  onDelete 
}) => {
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(letter.markdown_content);
  const letterRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedContent : letter.markdown_content);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleExportPDF = async () => {
    if (!letterRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(letterRef.current, { 
        quality: 1,
        backgroundColor: '#ffffff'
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`CoverLetter_${letter.company.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-[#05050a]/95 backdrop-blur-md overflow-hidden"
    >
      {/* Toolbar */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/40 relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 transition-all text-white/40 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-4 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-neon-blue" />
            <h2 className="text-sm font-black uppercase tracking-tight text-white/90">STRATEGIC WORKSPACE</h2>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-neon-blue/10 border border-neon-blue/20">
              <div className="w-1 h-1 rounded-full bg-neon-blue animate-pulse" />
              <span className="text-[8px] font-black text-neon-blue uppercase">Envoy Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditing && (
             <>
               <button onClick={() => setIsEditing(true)} className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative">
                 <Edit3 size={16} />
                 <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap uppercase">Edit Content</span>
               </button>
               <div className="w-px h-4 bg-white/10 mx-1" />
               <button onClick={handleExportPDF} className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative">
                 <FileDown size={16} />
                 <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap uppercase">Export PDF</span>
               </button>
               <button onClick={() => window.print()} className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative">
                 <Printer size={16} />
                 <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap uppercase">Print Artifact</span>
               </button>
             </>
          )}

          {isEditing && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsEditing(false)} 
                className="text-[10px] font-black text-white/40 hover:text-white uppercase px-3"
              >
                Cancel
              </button>
              <NeonButton 
                variant="blue" 
                className="!py-1.5 !px-3 text-[10px]"
                onClick={() => {
                   letter.markdown_content = editedContent;
                   setIsEditing(false);
                }}
              >
                <Save size={14} className="mr-2" /> Apply Changes
              </NeonButton>
            </div>
          )}

          <div className="h-4 w-px bg-white/10 mx-2" />
          
          <NeonButton onClick={handleCopy} className="!py-2 !px-4 text-[10px]">
            {copying ? <Check size={14} className="mr-2" /> : <Copy size={14} className="mr-2" />}
            {copying ? 'COPIED' : 'COPY CONTENT'}
          </NeonButton>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Intel */}
        <div className="w-80 border-r border-white/5 bg-[#0a0a0f] p-6 overflow-y-auto hidden xl:block futuristic-scroll">
           <div className="space-y-8">
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 border-b border-white/5 pb-2">Envoy Intelligence</h4>
                 <div className="space-y-3">
                    {[
                      { label: "Target Entity", value: letter.company, icon: <Target size={14} className="text-neon-blue" /> },
                      { label: "Role Context", value: letter.job_title, icon: <Bookmark size={14} className="text-neon-purple" /> },
                      { 
                        label: "Generated", 
                        value: letter.generated_at?.seconds ? new Date(letter.generated_at.seconds * 1000).toLocaleString() : new Date().toLocaleString(), 
                        icon: <Clock size={14} className="text-white/20" /> 
                      }
                    ].map((item, i) => (
                      <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                        <div className="flex items-center gap-1.5 text-white/30 text-[9px] uppercase font-bold tracking-widest">
                          {item.icon} {item.label}
                        </div>
                        <p className="text-xs font-bold text-white/90 break-words">{item.value}</p>
                      </div>
                    ))}
                 </div>
              </div>

              <GlassCard className="p-4 bg-neon-blue/5 border-neon-blue/10">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={14} className="text-neon-blue" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/60">STRATEGIC ALIGNMENT</h4>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed italic">
                  This envoy is calibrated to match the tonality and cultural markers of {letter.company} while emphasizing your specific value pillars.
                </p>
              </GlassCard>

              {onDelete && (
                <button 
                  onClick={onDelete}
                  className="w-full py-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Decommission Artifact
                </button>
              )}

              <div className="space-y-4 pt-4">
                 <div className="flex items-center gap-2 text-[10px] font-black text-green-500 uppercase">
                    <ShieldCheck size={14} />
                    Integrity Verified
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-neon-blue uppercase">
                    <Zap size={14} />
                    High Impact
                  </div>
              </div>
           </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#0a0a0f] p-4 md:p-12 overflow-auto flex justify-center futuristic-scroll items-start relative box-border">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          
          {isEditing ? (
            <textarea
              className="w-full max-w-3xl bg-black/40 border border-white/10 rounded-xl p-8 text-sm font-mono text-white/80 focus:border-neon-blue outline-none transition-all resize-none min-h-[700px] futuristic-scroll shadow-inner"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div 
              ref={letterRef}
              className="w-full max-w-[800px] p-12 md:p-24 shadow-[0_0_80px_rgba(0,0,0,0.5)] bg-white text-[#1a1a1a] min-h-[1132px] font-serif relative z-10 rounded-sm"
              style={{ backgroundColor: '#ffffff', color: '#1a1a1a' }}
            >
              <div className="max-w-2xl mx-auto space-y-8 markdown-body cover-letter-render">
                <Markdown>{letter.markdown_content}</Markdown>
              </div>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .cover-letter-render {
          line-height: 1.6;
          font-size: 11.5pt;
          color: #1a1a1a !important;
        }
        .cover-letter-render h1, .cover-letter-render h2, .cover-letter-render h3 {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          font-weight: 800;
          color: #000 !important;
          line-height: 1.2;
        }
        .cover-letter-render h1 { font-size: 24pt; border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 2rem; }
        .cover-letter-render p {
          margin-bottom: 1.25em;
        }
        .cover-letter-render ul {
          padding-left: 1.5em;
          list-style-type: disc;
          margin-bottom: 1.25em;
        }
        @media print {
          .no-print, button, nav, .fixed { display: none !important; }
          body { background: white !important; }
          .cover-letter-render { font-size: 11pt !important; }
          .fixed.inset-0 { position: relative !important; display: block !important; overflow: visible !important; }
        }
      `}} />

      <AnimatePresence>
        {exporting && (
          <motion.div 
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-6 right-6 px-6 py-4 rounded-2xl bg-black border border-neon-blue/30 flex items-center gap-4 z-[70] shadow-2xl"
          >
            <div className="w-4 h-4 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Tailoring PDF Envoy...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
