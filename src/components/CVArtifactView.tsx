import React, { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Download, 
  Copy, 
  Check, 
  Trash2, 
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Target,
  ShieldCheck,
  Zap,
  Cpu,
  FileCode,
  FileDown,
  Clock,
  Layout,
  History,
  Edit3,
  Save,
  X,
  Printer,
  Sun,
  Moon
} from 'lucide-react';
import { GlassCard, NeonButton, cn } from './UI';
import { GeneratedCV } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveGeneratedCV, auth } from '../lib/firebase';

interface CVArtifactViewProps {
  cv: GeneratedCV;
  onClose: () => void;
  onDelete?: () => void;
  onRelink?: (jobId: string) => void;
  onViewHistory?: (jobId: string) => void;
  onVerifyStructure?: () => void;
  isHistoryItem?: boolean;
}

export const CVArtifactView: React.FC<CVArtifactViewProps> = ({ 
  cv, 
  onClose, 
  onDelete, 
  onRelink, 
  onViewHistory, 
  onVerifyStructure,
  isHistoryItem = false 
}) => {
  const [copying, setCopying] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedContent, setEditedContent] = React.useState(cv.markdown_content);
  const [isSaving, setIsSaving] = React.useState(false);
  const [previewTheme, setPreviewTheme] = React.useState<'light' | 'dark'>('light');
  const cvRef = useRef<HTMLDivElement>(null);

  // Auto-save CV if it's new
  React.useEffect(() => {
    const autoSave = async () => {
      if (!isHistoryItem && auth.currentUser && !cv.id) {
        setSaving(true);
        try {
          await saveGeneratedCV(auth.currentUser.uid, cv);
        } catch (err) {
          console.error("Failed to auto-save CV:", err);
        } finally {
          setSaving(false);
        }
      }
    };
    autoSave();
  }, [cv, isHistoryItem]);

  const togglePreviewTheme = () => {
    setPreviewTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleSaveEdit = async () => {
    if (!auth.currentUser || !cv.id) return;
    setIsSaving(true);
    try {
      const updatedCV = { ...cv, markdown_content: editedContent };
      await saveGeneratedCV(auth.currentUser.uid, updatedCV);
      cv.markdown_content = editedContent; // Update local reference
      setIsEditing(false);
    } catch (err) {
      console.error("Save Edit Fail:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(cv.markdown_content);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleDownloadMD = () => {
    const blob = new Blob([cv.markdown_content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CV_${cv.tailored_to.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPDF = async () => {
    if (!cvRef.current) return;
    setDownloading('pdf');
    try {
      const canvas = await html2canvas(cvRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: previewTheme === 'light' ? '#ffffff' : '#0f172a',
        onclone: (doc) => {
          // REMOVE ALL existing style/link tags that might contain oklch
          const head = doc.head;
          const styles = head.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach(s => s.remove());

          const element = doc.getElementById('cv-artifact-content');
          if (element) {
            // Force standard layout colors
            element.style.color = previewTheme === 'light' ? '#1e293b' : '#f8fafc';
            element.style.backgroundColor = previewTheme === 'light' ? '#ffffff' : '#0f172a';
            element.style.width = '800px';
            element.style.margin = '0 auto';
            element.style.padding = '60px';
            element.style.position = 'relative';
            element.style.display = 'block';
            element.style.boxSizing = 'border-box';
          }
          
          // Inject ONLY safe, oklch-free styles for the PDF
          const style = doc.createElement('style');
          style.innerHTML = `
            * { 
              margin: 0; padding: 0; box-sizing: border-box;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
              color-scheme: ${previewTheme} !important;
            }
            #cv-artifact-content {
              background-color: ${previewTheme === 'light' ? '#ffffff' : '#0f172a'} !important;
              color: ${previewTheme === 'light' ? '#1e293b' : '#f8fafc'} !important;
              line-height: 1.5 !important;
              font-size: 11pt !important;
            }
            h1 { 
              font-size: 24pt !important; font-weight: 900 !important; text-transform: uppercase !important;
              text-align: center !important; margin-bottom: 20pt !important; border-bottom: 2pt solid ${previewTheme === 'light' ? '#0f172a' : '#ffffff'} !important;
              padding-bottom: 10pt !important; color: ${previewTheme === 'light' ? '#0f172a' : '#ffffff'} !important;
              letter-spacing: -0.05em !important;
            }
            h2 { 
              font-size: 14pt !important; font-weight: 700 !important; text-transform: uppercase !important;
              margin-top: 20pt !important; margin-bottom: 8pt !important; border-bottom: 1pt solid ${previewTheme === 'light' ? '#e2e8f0' : '#334155'} !important;
              padding-bottom: 4pt !important; color: ${previewTheme === 'light' ? '#0f172a' : '#ffffff'} !important;
              letter-spacing: 0.05em !important;
            }
            p { margin-bottom: 10pt !important; }
            ul, ol { margin-left: 20pt !important; margin-bottom: 10pt !important; }
            li { margin-bottom: 4pt !important; }
            strong { font-weight: 700 !important; color: ${previewTheme === 'light' ? '#0f172a' : '#ffffff'} !important; }
            a { color: inherit !important; text-decoration: none !important; }
            
            /* Hide any UI elements that might have leaked in */
            .no-print, button, nav { display: none !important; }
          `;
          doc.head.appendChild(style);
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const canvasActualHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = canvasActualHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasActualHeight);
      heightLeft -= pdfHeight;

      // Subsequent pages if content exceeds one page
      while (heightLeft > 0) {
        position = heightLeft - canvasActualHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasActualHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`CV_${cv.tailored_to.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF Export failed. Fallback to basic rendering.", err);
      // Attempt a simpler capture if the first one fails
      alert("Traditional PDF generation failed. Use 'PRINT TO PDF' for better results.");
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDocx = async () => {
    setDownloading('docx');
    try {
      // Robust docx generation with basic formatting support (bold, italic)
      const parseFormatting = (text: string) => {
        const parts: TextRun[] = [];
        let currentText = text;
        const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
          // Add plain text before match
          if (match.index > lastIndex) {
            parts.push(new TextRun(text.substring(lastIndex, match.index)));
          }

          const isBold = !!(match[1]);
          const content = match[2] || match[4];
          parts.push(new TextRun({ text: content, bold: isBold, italics: !isBold }));
          lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
          parts.push(new TextRun(text.substring(lastIndex)));
        }

        return parts.length > 0 ? parts : [new TextRun(text)];
      };

      const sections = cv.markdown_content.split('\n\n');
      const docChildren: any[] = [];

      sections.forEach(section => {
        if (section.startsWith('# ')) {
          docChildren.push(new Paragraph({ 
            children: [new TextRun({ text: section.replace('# ', '').trim(), bold: true, size: 32 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 }
          }));
        } else if (section.startsWith('## ')) {
          docChildren.push(new Paragraph({ 
            children: [new TextRun({ text: section.replace('## ', '').trim(), bold: true, size: 28 })],
            spacing: { before: 400, after: 200 }
          }));
        } else if (section.startsWith('### ')) {
          docChildren.push(new Paragraph({ 
            children: [new TextRun({ text: section.replace('### ', '').trim(), bold: true, size: 24 })],
            spacing: { before: 200, after: 100 }
          }));
        } else if (section.startsWith('- ') || section.startsWith('* ')) {
          const lines = section.split('\n');
          lines.forEach(line => {
             const cleanLine = line.replace(/^[-*]\s+/, '').trim();
             docChildren.push(new Paragraph({ 
               children: parseFormatting(cleanLine),
               bullet: { level: 0 } 
             }));
          });
        } else {
          docChildren.push(new Paragraph({ children: parseFormatting(section.trim()), spacing: { after: 200 } }));
        }
      });

      const doc = new Document({
        sections: [{ children: docChildren }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CV_${cv.tailored_to.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Docx Fail:", err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-[#05050a]/95 backdrop-blur-md overflow-hidden"
    >
      {/* Dynamic Toolbar */}
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
            <h2 className="text-sm font-black uppercase tracking-tight text-white/90">COMPILER WORKSPACE</h2>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-neon-blue/10 border border-neon-blue/20">
              <div className="w-1 h-1 rounded-full bg-neon-blue animate-pulse" />
              <span className="text-[8px] font-black text-neon-blue uppercase">{isHistoryItem ? 'Archived Artifact' : 'Compiler Active'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onDelete && isHistoryItem && !isEditing && (
            <button 
              onClick={onDelete}
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all border border-red-500/20 mr-2"
            >
              <Trash2 size={16} />
            </button>
          )}
          
          <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-lg border border-white/10 mr-4">
             {!isEditing && (
               <>
                 <button onClick={() => setIsEditing(true)} className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative">
                   <Edit3 size={16} />
                   <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">EDIT CONTENT</span>
                 </button>
                 <div className="w-px h-4 bg-white/10 mx-1" />
                 <button onClick={onVerifyStructure} className="p-2 rounded hover:bg-white/10 text-neon-blue hover:text-white transition-all group relative">
                   <ShieldCheck size={16} />
                   <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap uppercase">Structure Intelligence</span>
                 </button>
                 <div className="w-px h-4 bg-white/10 mx-1" />
                 <button onClick={handleDownloadMD} className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative">
                   <FileCode size={16} />
                   <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">DOWNLOAD MD</span>
                 </button>
                 <button onClick={handleDownloadDocx} disabled={!!downloading} className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative">
                   <FileDown size={16} />
                   <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">DOWNLOAD DOCX</span>
                 </button>
                 <button onClick={() => window.print()} className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative">
                   <Printer size={16} />
                   <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">PRINT TO PDF</span>
                 </button>
                 <button onClick={handleDownloadPDF} disabled={!!downloading} className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative">
                   <Download size={16} />
                   <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">DOWNLOAD PDF</span>
                 </button>
                 <div className="w-px h-4 bg-white/10 mx-1" />
                 <button 
                   onClick={togglePreviewTheme} 
                   className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all group relative"
                 >
                   {previewTheme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                   <span className="absolute top-full right-0 mt-2 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap uppercase">
                     THEME: {previewTheme}
                   </span>
                 </button>
               </>
             )}
             {isEditing && (
               <div className="flex items-center gap-2 px-2">
                 <button 
                  onClick={() => setIsEditing(false)} 
                  className="p-2 rounded hover:bg-white/10 text-white/40 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black"
                >
                   <X size={14} /> CANCEL
                 </button>
                 <NeonButton 
                  onClick={handleSaveEdit} 
                  isLoading={isSaving}
                  className="!py-1.5 !px-3 text-[10px]"
                >
                   <Save size={14} className="mr-2" /> SAVE CHANGES
                 </NeonButton>
               </div>
             )}
          </div>

          <NeonButton onClick={handleCopy} className="!py-2 !px-4 text-[10px]">
            {copying ? <Check size={14} className="mr-2" /> : <Copy size={14} className="mr-2" />}
            {copying ? 'COPIED' : 'COPY CONTENT'}
          </NeonButton>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Workspace Sidebar */}
        <div className="w-80 border-r border-white/5 bg-[#0a0a0f] p-6 overflow-y-auto hidden xl:block futuristic-scroll">
          <div className="space-y-8">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 border-b border-white/5 pb-2">Artifact Intel</h4>
              <div className="space-y-3">
                {[
                  { label: "Target Job", value: cv.tailored_to, icon: <Target className="text-neon-blue" /> },
                  { 
                    label: "Timestamp", 
                    value: cv.generated_at?.toDate ? cv.generated_at.toDate().toLocaleString() : new Date().toLocaleString(), 
                    icon: <Clock className="text-neon-purple" /> 
                  },
                  { label: "System Sync", value: saving ? "Saving..." : "Synchronized", icon: <Check size={14} className="text-green-500" /> }
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5 text-white/30 text-[9px] uppercase font-bold tracking-widest">
                      {item.icon} {item.label}
                    </div>
                    <p className="text-xs font-bold text-white/90 break-words">{item.value}</p>
                  </div>
                ))}
              </div>

              {cv.job_id && (
                <div className="space-y-3">
                  <button 
                    onClick={() => onRelink ? onRelink(cv.job_id!) : onClose()}
                    className="w-full py-3 rounded-xl bg-neon-blue/10 border border-neon-blue/30 text-neon-blue text-[10px] font-black uppercase tracking-widest hover:bg-neon-blue/20 transition-all flex items-center justify-center gap-2 group"
                  >
                    <ExternalLink size={14} className="group-hover:scale-110 transition-transform" /> 
                    Re-link to Source
                  </button>
                  <button 
                    onClick={() => onViewHistory ? onViewHistory(cv.job_id!) : null}
                    className="w-full py-3 rounded-xl bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-[10px] font-black uppercase tracking-widest hover:bg-neon-purple/20 transition-all flex items-center justify-center gap-2 group"
                  >
                    <History size={14} className="group-hover:rotate-[-45deg] transition-transform" /> 
                    Compiler Database
                  </button>
                </div>
              )}
            </div>

            <GlassCard className="p-4 bg-green-500/5 border-green-500/10">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={14} className="text-green-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/60">Strict Format Lock</h4>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed italic mb-4">
                The CV format is currently locked to the non-negotiable 8-pillar skeleton. Format verification is active.
              </p>
              <button 
                onClick={() => {
                  const requiredHeaders = [
                    'PROFESSIONAL SUMMARY',
                    'CORE TECHNICAL SKILLS',
                    'PROFESSIONAL EXPERIENCE',
                    'SELECTED ENGINEERING PROJECTS',
                    'EDUCATION',
                    'ADDITIONAL VALUE',
                    'AVAILABILITY'
                  ];
                  const content = cv.markdown_content.toUpperCase();
                  const missing = requiredHeaders.filter(h => !content.includes(h));
                  
                  if (missing.length === 0) {
                    alert("✅ INTEGRITY VERIFIED: This artifact strictly adheres to the locked format skeleton.");
                  } else {
                    alert(`❌ INTEGRITY FAILURE: Missing sections: ${missing.join(', ')}`);
                  }
                }}
                className="w-full py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-500 text-[10px] font-black uppercase tracking-widest hover:bg-green-500/30 transition-all"
              >
                Verify Format Integrity
              </button>
            </GlassCard>

            <GlassCard className="p-4 bg-neon-blue/5 border-neon-blue/10">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={14} className="text-neon-blue" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/60">Compiler Logic</h4>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed italic">
                Deterministic transformation engine enforcing strict structural invariants, high-impact bullet formulas, and mandatory verification passes.
              </p>
            </GlassCard>

            <div className="space-y-4 pt-4">
               <div className="flex items-center gap-2 text-[10px] font-black text-green-500 uppercase">
                  <ShieldCheck size={14} />
                  ATS READY
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-neon-blue uppercase">
                  <Zap size={14} />
                  HIGH IMPACT
                </div>
            </div>
          </div>
        </div>

        {/* Workspace Canvas */}
        <div className="flex-1 bg-[#0a0a0f] p-4 md:p-12 overflow-auto flex justify-center futuristic-scroll items-start relative box-border">
          {/* Subtle Workspace Grid Background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          
          {isEditing ? (
            <div className="w-full max-w-4xl h-full flex flex-col gap-4 relative z-10">
              <div className="flex justify-between items-center px-4">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">Markdown Core Editor</h3>
                 <div className="flex gap-4">
                    <span className="text-[10px] text-white/20 font-mono">CHARS: {editedContent.length}</span>
                 </div>
              </div>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl p-8 text-sm font-mono text-white/80 focus:border-neon-purple outline-none transition-all resize-none futuristic-scroll min-h-[500px]"
                spellCheck={false}
              />
            </div>
          ) : (
            <div 
              ref={cvRef}
              id="cv-artifact-content"
              className={cn(
                "w-full max-w-[850px] p-10 md:p-24 shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-sm min-h-[1132px] cursor-auto my-8 transition-all duration-500 relative z-10",
                previewTheme === 'light' ? "bg-white text-slate-800" : "bg-slate-900 text-slate-100"
              )}
            >
              <div className={cn(
                "prose max-w-none prose-h1:text-center prose-h1:border-b-2 prose-h1:pb-6 prose-h1:uppercase prose-h1:tracking-tighter prose-h1:font-black prose-h2:border-b prose-h2:pb-2 prose-h2:mt-12 prose-h2:uppercase prose-h2:font-bold prose-h2:tracking-wider prose-li:my-1",
                previewTheme === 'light' 
                  ? "prose-slate prose-h1:border-slate-800 prose-h2:border-slate-200" 
                  : "prose-invert prose-h1:border-slate-100 prose-h2:border-slate-700"
              )}>
                <ReactMarkdown>
                  {cv.markdown_content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Floating Status */}
      <AnimatePresence>
        {downloading && (
          <motion.div 
            key="download-status-overlay"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 right-6 px-6 py-4 rounded-2xl glass-card border-neon-blue/30 flex items-center gap-4 z-[70]"
          >
            <div className="w-4 h-4 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">GENERATING {downloading.toUpperCase()}...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
