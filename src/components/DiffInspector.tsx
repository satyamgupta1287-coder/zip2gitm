import React, { useState, useEffect } from 'react';
import { GitCompare, Plus, Edit2, CheckCircle2, FileText, Search, RefreshCw, Eye, AlertCircle, FileCode, Sparkles } from 'lucide-react';
import { DiffStatus, DiffSummary, ExtractedFile, FileDiffItem, GitHubRepo } from '../types';
import { compareZipWithRepo } from '../utils/githubApi';

interface DiffInspectorProps {
  token: string | null;
  selectedRepo: GitHubRepo | null;
  selectedBranch: string;
  zipFiles: ExtractedFile[];
  diffSummary: DiffSummary | null;
  onDiffCalculated: (summary: DiffSummary) => void;
}

export const DiffInspector: React.FC<DiffInspectorProps> = ({
  token,
  selectedRepo,
  selectedBranch,
  zipFiles,
  diffSummary,
  onDiffCalculated,
}) => {
  const [comparing, setComparing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | DiffStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileDiffItem | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [aiReview, setAiReview] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Auto-trigger diff analysis when zipFiles, selectedRepo, or selectedBranch changes
  useEffect(() => {
    if (token && selectedRepo && zipFiles.length > 0) {
      handleCalculateDiff();
    }
  }, [token, selectedRepo?.id, selectedBranch, zipFiles]);

  const handleCalculateDiff = async () => {
    if (!token || !selectedRepo) return;
    setComparing(true);
    setError(null);
    setAiReview(null);
    try {
      const summary = await compareZipWithRepo(
        token,
        selectedRepo.owner.login,
        selectedRepo.name,
        selectedBranch,
        zipFiles,
        (msg) => setProgressMsg(msg)
      );
      onDiffCalculated(summary);
      if (summary.items.length > 0) {
        setSelectedFile(summary.items[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to compare ZIP contents with GitHub repo.');
    } finally {
      setComparing(false);
    }
  };

  const handleAiReview = async () => {
    if (!diffSummary) return;
    setLoadingAi(true);
    setAiReview(null);
    try {
      const res = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: diffSummary.items })
      });
      const data = await res.json();
      setAiReview(data.review);
    } catch (err) {
      setAiReview("Failed to fetch AI review.");
    } finally {
      setLoadingAi(false);
    }
  };

  const getStatusBadge = (status: DiffStatus) => {
    switch (status) {
      case 'added':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Plus className="w-3 h-3" />
            <span>NEW</span>
          </span>
        );
      case 'modified':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Edit2 className="w-3 h-3" />
            <span>MODIFIED</span>
          </span>
        );
      case 'unchanged':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <CheckCircle2 className="w-3 h-3" />
            <span>IDENTICAL</span>
          </span>
        );
      case 'deleted':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span>DELETED</span>
          </span>
        );
    }
  };

  const itemsToDisplay = (diffSummary?.items || []).filter((item) => {
    const matchesFilter = statusFilter === 'all' || item.status === statusFilter;
    const matchesSearch = item.path.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Step 3: Smart Change & Diff Inspector</h2>
            <p className="text-xs text-slate-400">
              Automatically checks files against GitHub repository branch &apos;{selectedBranch}&apos; to detect updates.
            </p>
          </div>
        </div>

        <div className="flex space-x-2">
          {diffSummary && (
            <button
              onClick={handleAiReview}
              disabled={loadingAi || comparing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-400 hover:bg-purple-300 rounded-xl transition disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${loadingAi ? 'animate-pulse' : ''}`} />
              <span>{loadingAi ? 'Reviewing...' : 'AI Review Code'}</span>
            </button>
          )}
          <button
            onClick={handleCalculateDiff}
            disabled={comparing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${comparing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Re-Analyze Diffs</span>
          </button>
        </div>
      </div>

      {aiReview && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-purple-400 font-semibold text-sm">
             <Sparkles className="w-4 h-4" />
             <span>AI Code Review</span>
          </div>
          <div className="text-xs text-purple-200 whitespace-pre-wrap leading-relaxed font-mono">
             {aiReview}
          </div>
        </div>
      )}

      {comparing && (
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-200">{progressMsg || 'Comparing ZIP with repository...'}</p>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {diffSummary && !comparing && (
        <>
          {/* Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setStatusFilter('all')}
              className={`p-3 rounded-xl border cursor-pointer transition ${
                statusFilter === 'all'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Files</div>
              <div className="text-lg font-bold text-slate-100 mt-0.5">{diffSummary.items.length}</div>
            </div>

            <div
              onClick={() => setStatusFilter('added')}
              className={`p-3 rounded-xl border cursor-pointer transition ${
                statusFilter === 'added'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">New Files</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{diffSummary.added}</div>
            </div>

            <div
              onClick={() => setStatusFilter('modified')}
              className={`p-3 rounded-xl border cursor-pointer transition ${
                statusFilter === 'modified'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Modified</div>
              <div className="text-lg font-bold text-amber-400 mt-0.5">{diffSummary.modified}</div>
            </div>

            <div
              onClick={() => setStatusFilter('unchanged')}
              className={`p-3 rounded-xl border cursor-pointer transition ${
                statusFilter === 'unchanged'
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Identical</div>
              <div className="text-lg font-bold text-slate-300 mt-0.5">{diffSummary.unchanged}</div>
            </div>
          </div>

          {/* Search bar & Filter tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files by path..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
              {(['all', 'added', 'modified', 'unchanged'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg transition ${
                    statusFilter === st ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* File Explorer & Code Diff Split Pane */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-80">
            {/* File Tree / List Sidebar */}
            <div className="lg:col-span-5 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col h-full">
              <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>File Explorer ({itemsToDisplay.length})</span>
                <span className="font-mono text-slate-500">ZIP vs Repo</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-900/50 p-1">
                {itemsToDisplay.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No files match filter.</div>
                ) : (
                  itemsToDisplay.map((item) => {
                    const isSelected = selectedFile?.path === item.path;
                    return (
                      <div
                        key={item.path}
                        onClick={() => setSelectedFile(item)}
                        className={`p-2.5 rounded-lg cursor-pointer transition flex items-center justify-between space-x-2 text-xs font-mono ${
                          isSelected ? 'bg-cyan-500/15 border border-cyan-500/30 text-slate-100' : 'hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate min-w-0">
                          <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{item.path}</span>
                        </div>
                        <div className="shrink-0">{getStatusBadge(item.status)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Code Content / Diff Preview Box */}
            <div className="lg:col-span-7 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col h-full">
              {selectedFile ? (
                <>
                  <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-mono text-xs text-slate-200 truncate">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span className="truncate font-bold">{selectedFile.path}</span>
                    </div>
                    {getStatusBadge(selectedFile.status)}
                  </div>

                  <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-slate-300 bg-slate-950">
                    {selectedFile.isBinary ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                        <Eye className="w-8 h-8 text-slate-600" />
                        <p>Binary file content ({selectedFile.size} bytes)</p>
                      </div>
                    ) : typeof selectedFile.newContent === 'string' ? (
                      <div className="space-y-1">
                        {selectedFile.status === 'modified' && selectedFile.oldContent && typeof selectedFile.oldContent === 'string' ? (
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-amber-400 font-sans font-semibold mb-2 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                              Showing modified lines compared to repository version:
                            </div>
                            {selectedFile.newContent.split('\n').map((line, idx) => {
                              const oldLines = (selectedFile.oldContent as string).split('\n');
                              const isNewOrDiff = !oldLines.includes(line);
                              return (
                                <div
                                  key={idx}
                                  className={`px-2 py-0.5 rounded whitespace-pre-wrap ${
                                    isNewOrDiff ? 'bg-emerald-500/15 text-emerald-300 font-semibold' : 'text-slate-400'
                                  }`}
                                >
                                  <span className="text-slate-600 select-none mr-3 inline-block w-6 text-right">{idx + 1}</span>
                                  {line}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          selectedFile.newContent.split('\n').map((line, idx) => (
                            <div key={idx} className="px-1 whitespace-pre-wrap">
                              <span className="text-slate-600 select-none mr-3 inline-block w-6 text-right">{idx + 1}</span>
                              <span className={selectedFile.status === 'added' ? 'text-emerald-300' : 'text-slate-300'}>{line}</span>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-500">Non-text file content.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 p-6">
                  Select a file on the left to inspect content or diff details.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
