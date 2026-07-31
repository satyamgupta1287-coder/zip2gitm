import React from 'react';
import { History, ExternalLink, Trash2, X, CheckCircle2, AlertCircle, GitCommit } from 'lucide-react';
import { PushJobHistory } from '../types';

interface PushHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: PushJobHistory[];
  onClearHistory: () => void;
}

export const PushHistoryDrawer: React.FC<PushHistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Push Operations Log</h3>
              <p className="text-xs text-slate-400">{history.length} recent push jobs recorded</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                title="Clear history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <History className="w-8 h-8 text-slate-700 mx-auto" />
              <p>No push operations logged yet.</p>
              <p className="text-[11px] text-slate-600">Pushed code commits will automatically record here.</p>
            </div>
          ) : (
            history.map((job) => (
              <div
                key={job.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {job.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[200px]">
                      {job.repoFullName}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono">{job.timestamp}</span>
                </div>

                <p className="text-xs font-mono text-slate-300 bg-slate-900 p-2 rounded border border-slate-800/80 truncate">
                  &quot;{job.commitMessage}&quot;
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>
                    ZIP: <strong className="text-slate-300">{job.zipName}</strong> ({job.filesChangedCount} files)
                  </span>

                  {job.status === 'success' && job.commitUrl ? (
                    <a
                      href={job.commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center space-x-1 font-mono font-semibold"
                    >
                      <GitCommit className="w-3 h-3" />
                      <span>{job.commitSha.slice(0, 7)}</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  ) : (
                    <span className="text-rose-400">Failed</span>
                  )}
                </div>

                {job.errorMessage && (
                  <p className="text-[10px] text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                    {job.errorMessage}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
