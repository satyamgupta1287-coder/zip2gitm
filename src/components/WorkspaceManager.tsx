import React, { useRef, useState } from 'react';
import { Upload, FileArchive, FolderTree, CheckCircle2, AlertCircle, RefreshCw, Plus, Trash2, FileText, X } from 'lucide-react';
import { ZipAnalysis, ExtractedFile } from '../types';
import { parseZipFile } from '../utils/zipParser';

interface WorkspaceManagerProps {
  zipAnalysis: ZipAnalysis | null;
  onAnalysisComplete: (analysis: ZipAnalysis) => void;
  onAnalysisUpdate: (analysis: ZipAnalysis) => void;
  onReset: () => void;
}

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
  zipAnalysis,
  onAnalysisComplete,
  onAnalysisUpdate,
  onReset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = React.useMemo(() => {
    if (!zipAnalysis) return [];
    if (!searchQuery.trim()) return zipAnalysis.files;
    const q = searchQuery.toLowerCase();
    return zipAnalysis.files.filter(f => f.path.toLowerCase().includes(q));
  }, [zipAnalysis, searchQuery]);

  const handleFileChange = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a valid .zip archive file.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const analysis = await parseZipFile(file);
      onAnalysisComplete(analysis);
    } catch (err: any) {
      setError(err.message || 'Failed to parse ZIP archive.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDeleteFile = (path: string) => {
    if (!zipAnalysis) return;
    const updatedFiles = zipAnalysis.files.filter(f => f.path !== path);
    onAnalysisUpdate({
      ...zipAnalysis,
      files: updatedFiles,
      totalFiles: updatedFiles.length,
    });
  };

  const handleCleanJunkFiles = () => {
    if (!zipAnalysis) return;
    const junkPatterns = ['node_modules/', '.next/', '.git/', 'dist/', 'build/', 'coverage/', '.ds_store', 'thumbs.db', '.env', '.log'];
    const cleaned = zipAnalysis.files.filter(f => {
      const p = f.path.toLowerCase();
      return !junkPatterns.some(pattern => p.includes(pattern) || p.endsWith(pattern));
    });
    const removedCount = zipAnalysis.files.length - cleaned.length;
    onAnalysisUpdate({
      ...zipAnalysis,
      files: cleaned,
      totalFiles: cleaned.length,
    });
    if (removedCount > 0) {
      setError(`Cleaned up ${removedCount} junk/unnecessary files!`);
      setTimeout(() => setError(null), 3000);
    } else {
      setError('Workspace is already clean! No build files or OS junk found.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath || !newFileContent) return;
    
    const analysis = zipAnalysis || {
      fileName: 'Custom Workspace',
      fileSize: 0,
      totalFiles: 0,
      files: [],
      languagesDetected: []
    };

    const newExtractedFile: ExtractedFile = {
      path: newFilePath.replace(/\\/g, '/').replace(/^\/+/, ''),
      content: newFileContent,
      isBinary: false,
      size: new Blob([newFileContent]).size,
    };

    const updatedFiles = [...analysis.files.filter(f => f.path !== newExtractedFile.path), newExtractedFile];
    
    const newAnalysis: ZipAnalysis = {
      ...analysis,
      files: updatedFiles,
      totalFiles: updatedFiles.length,
      fileSize: analysis.fileSize + newExtractedFile.size,
    };

    if (!zipAnalysis) {
      onAnalysisComplete(newAnalysis);
    } else {
      onAnalysisUpdate(newAnalysis);
    }

    setIsCreatingFile(false);
    setNewFilePath('');
    setNewFileContent('');
  };

  const handleSingleFileUpload = async (file: File) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const isBinary = file.type ? !file.type.startsWith('text/') && !file.type.includes('json') : false;
    
    let content: string | Uint8Array;
    if (!isBinary) {
      content = new TextDecoder().decode(buffer);
    } else {
      content = new Uint8Array(buffer);
    }

    const newExtractedFile: ExtractedFile = {
      path: file.name,
      content,
      isBinary,
      size: file.size,
      mimeType: file.type
    };

    const analysis = zipAnalysis || {
      fileName: 'Custom Workspace',
      fileSize: 0,
      totalFiles: 0,
      files: [],
      languagesDetected: []
    };

    const updatedFiles = [...analysis.files.filter(f => f.path !== newExtractedFile.path), newExtractedFile];
    const newAnalysis: ZipAnalysis = {
      ...analysis,
      files: updatedFiles,
      totalFiles: updatedFiles.length,
      fileSize: analysis.fileSize + newExtractedFile.size,
    };

    if (!zipAnalysis) {
      onAnalysisComplete(newAnalysis);
    } else {
      onAnalysisUpdate(newAnalysis);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Step 1: Staged Files Workspace</h2>
            <p className="text-xs text-slate-400">Upload a project ZIP, or manually create/upload files to stage.</p>
          </div>
        </div>

        {zipAnalysis && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCleanJunkFiles}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl border border-amber-500/20 transition"
              title="Remove build files, node_modules, .DS_Store, etc."
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clean Junk Files</span>
            </button>
            <button
              onClick={() => setIsCreatingFile(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New File</span>
            </button>
            <button
              onClick={onReset}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-500/20 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Workspace</span>
            </button>
          </div>
        )}
      </div>

      {!zipAnalysis && !isCreatingFile && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-700 hover:border-slate-600 bg-slate-950/50 hover:bg-slate-950'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="mx-auto space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-cyan-400">
                <FileArchive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Upload ZIP Archive</p>
                <p className="text-xs text-slate-400 mt-1">Extract a whole project</p>
              </div>
            </div>
            {loading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                <p className="text-xs font-semibold text-slate-200">Analyzing ZIP...</p>
              </div>
            )}
          </div>

          <div
            onClick={() => setIsCreatingFile(true)}
            className="border-2 border-dashed border-slate-700 hover:border-slate-600 bg-slate-950/50 hover:bg-slate-950 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-emerald-400 mb-3">
              <Plus className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-200">Create New File</p>
            <p className="text-xs text-slate-400 mt-1">Type path and paste content manually</p>
          </div>
        </div>
      )}

      {isCreatingFile && (
        <form onSubmit={handleAddFile} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
             <h3 className="text-sm font-semibold text-slate-200">Add New File to Workspace</h3>
             <button type="button" onClick={() => setIsCreatingFile(false)} className="text-slate-400 hover:text-white">
               <X className="w-4 h-4" />
             </button>
          </div>
          <div>
            <input
              type="text"
              required
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="File path (e.g., src/components/App.tsx)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <textarea
              required
              value={newFileContent}
              onChange={(e) => setNewFileContent(e.target.value)}
              placeholder="Paste file content here..."
              rows={6}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsCreatingFile(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg"
            >
              Save File
            </button>
          </div>
        </form>
      )}

      {zipAnalysis && !isCreatingFile && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-950/70 border border-slate-800 rounded-xl">
             <div className="flex items-center space-x-3">
               <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                 <CheckCircle2 className="w-5 h-5" />
               </div>
               <div>
                 <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                   <span>{zipAnalysis.fileName}</span>
                   <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                     {formatBytes(zipAnalysis.fileSize)}
                   </span>
                 </h3>
                 <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                   <span>Staged <strong className="text-slate-200">{zipAnalysis.totalFiles} files</strong></span>
                   {zipAnalysis.detectedRootFolder && (
                     <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                       Root folder stripped: {zipAnalysis.detectedRootFolder}/
                     </span>
                   )}
                 </p>
               </div>
             </div>
             <div className="flex items-center space-x-2">
               <input
                 type="text"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Search staged files..."
                 className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36 sm:w-48"
               />
               <input
                 ref={singleFileInputRef}
                 type="file"
                 onChange={(e) => {
                   if (e.target.files && e.target.files[0]) handleSingleFileUpload(e.target.files[0]);
                 }}
                 className="hidden"
               />
               <button
                 onClick={() => singleFileInputRef.current?.click()}
                 className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
               >
                 <Upload className="w-3.5 h-3.5" />
                 <span>Upload File</span>
               </button>
             </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1">
             {filteredFiles.map((f, i) => (
                <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-900 rounded-lg group">
                   <div className="flex items-center space-x-2 overflow-hidden">
                     <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                     <span className="text-xs text-slate-300 truncate font-mono">{f.path}</span>
                     <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(f.size)}</span>
                   </div>
                   <button
                     onClick={() => handleDeleteFile(f.path)}
                     className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition p-1"
                     title="Remove from staging"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
                </div>
             ))}
             {filteredFiles.length === 0 && (
               <div className="p-4 text-center text-xs text-slate-500">
                 {zipAnalysis.files.length === 0 ? 'No files staged.' : 'No matching files found.'}
               </div>
             )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
