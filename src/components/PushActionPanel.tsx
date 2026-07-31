import React, { useState, useEffect } from 'react';
import { Send, Sparkles, CheckCircle2, ExternalLink, Loader2, GitCommit, AlertCircle, ArrowRight, ShieldCheck, Copy, Check } from 'lucide-react';
import { DiffSummary, GitHubRepo, PushJobHistory } from '../types';
import { pushCommitToGithub } from '../utils/githubApi';

interface PushActionPanelProps {
  token: string | null;
  selectedRepo: GitHubRepo | null;
  selectedBranch: string;
  diffSummary: DiffSummary | null;
  zipName: string;
  onPushComplete: (job: PushJobHistory) => void;
  onOpenConnectModal: () => void;
}

export const PushActionPanel: React.FC<PushActionPanelProps> = ({
  token,
  selectedRepo,
  selectedBranch,
  diffSummary,
  zipName,
  onPushComplete,
  onOpenConnectModal,
}) => {
  const [commitMsg, setCommitMsg] = useState('');
  const [generatingAiMsg, setGeneratingAiMsg] = useState(false);
  const [pushOnlyChanges, setPushOnlyChanges] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastPushedJob, setLastPushedJob] = useState<PushJobHistory | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  // Set default commit message whenever zipName changes
  useEffect(() => {
    if (zipName && !commitMsg) {
      setCommitMsg(`feat: sync code updates from ${zipName}`);
    }
  }, [zipName]);

  const filesToPush = React.useMemo(() => {
    if (!diffSummary) return [];
    if (pushOnlyChanges) {
      return diffSummary.items.filter((item) => item.status === 'added' || item.status === 'modified');
    }
    return diffSummary.items;
  }, [diffSummary, pushOnlyChanges]);

  const handleGenerateAiCommitMsg = async () => {
    if (!diffSummary) return;
    setGeneratingAiMsg(true);
    try {
      const res = await fetch('/api/generate-commit-msg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipName,
          summary: {
            added: diffSummary.added,
            modified: diffSummary.modified,
          },
          files: diffSummary.items.map((i) => ({ path: i.path, status: i.status })),
        }),
      });

      const data = await res.json();
      if (data.commitMsg) {
        setCommitMsg(data.commitMsg);
      }
    } catch (err) {
      console.error('AI commit message error:', err);
    } finally {
      setGeneratingAiMsg(false);
    }
  };

  const handlePushToGithub = async () => {
    if (!token) {
      onOpenConnectModal();
      return;
    }

    if (!selectedRepo) {
      setError('Please select or create a target GitHub repository first.');
      return;
    }

    if (!commitMsg.trim()) {
      setError('Please provide a commit message.');
      return;
    }

    if (filesToPush.length === 0) {
      setError('No files to push (0 added or modified files).');
      return;
    }

    setPushing(true);
    setError(null);
    setProgressPercent(5);
    setProgressMsg('Initializing commit payload...');

    try {
      const result = await pushCommitToGithub({
        token,
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        branch: selectedBranch,
        commitMessage: commitMsg.trim(),
        filesToPush,
        onProgress: (msg, percent) => {
          setProgressMsg(msg);
          setProgressPercent(percent);
        },
      });

      const historyJob: PushJobHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        zipName,
        repoFullName: selectedRepo.full_name,
        repoUrl: selectedRepo.html_url,
        branch: selectedBranch,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        commitMessage: commitMsg.trim(),
        filesChangedCount: filesToPush.length,
        status: 'success',
      };

      setLastPushedJob(historyJob);
      onPushComplete(historyJob);
    } catch (err: any) {
      setError(err.message || 'Failed to push commit to GitHub repository.');
      const failedJob: PushJobHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        zipName,
        repoFullName: selectedRepo?.full_name || 'unknown',
        repoUrl: selectedRepo?.html_url || '',
        branch: selectedBranch,
        commitSha: '',
        commitUrl: '',
        commitMessage: commitMsg.trim(),
        filesChangedCount: filesToPush.length,
        status: 'failed',
        errorMessage: err.message,
      };
      onPushComplete(failedJob);
    } finally {
      setPushing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
        <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
          <GitCommit className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Step 4: Commit & Push to GitHub</h2>
          <p className="text-xs text-slate-400">Review final commit options and push code directly into GitHub repository.</p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {lastPushedJob && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3 animate-fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-200">Pushed Successfully to GitHub!</h3>
                <p className="text-xs text-emerald-400/80">
                  Committed {lastPushedJob.filesChangedCount} files to &apos;{lastPushedJob.repoFullName}&apos; on branch &apos;{lastPushedJob.branch}&apos;
                </p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(lastPushedJob.commitSha)}
              className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-mono inline-flex items-center space-x-1"
            >
              {copiedSha ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{lastPushedJob.commitSha.slice(0, 7)}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center space-x-3 pt-1 text-xs">
            <a
              href={lastPushedJob.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-emerald-400 text-slate-900 font-bold rounded-xl inline-flex items-center space-x-1 hover:bg-emerald-300 transition"
            >
              <span>View Commit on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={lastPushedJob.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-slate-800 text-slate-200 font-semibold rounded-xl inline-flex items-center space-x-1 hover:bg-slate-700 transition"
            >
              <span>Open Repository</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Push Configuration Controls */}
      <div className="space-y-4">
        {/* Toggle options */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="pushOnlyChanges"
              checked={pushOnlyChanges}
              onChange={(e) => setPushOnlyChanges(e.target.checked)}
              className="rounded text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="pushOnlyChanges" className="cursor-pointer">
              Only push changed/new files (<strong className="text-cyan-400">{filesToPush.length} files</strong>)
            </label>
          </div>

          <div className="text-slate-400 font-mono">
            Target: <span className="text-slate-200 font-bold">{selectedRepo?.full_name || 'No repo selected'}</span> ({selectedBranch})
          </div>
        </div>

        {/* Commit message input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">Commit Message *</label>

            <button
              type="button"
              onClick={handleGenerateAiCommitMsg}
              disabled={generatingAiMsg || !diffSummary}
              className="px-2.5 py-1 text-[11px] font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition inline-flex items-center space-x-1 disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>{generatingAiMsg ? 'AI Generating...' : 'AI Generate Commit Message'}</span>
            </button>
          </div>

          <textarea
            rows={3}
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="feat: add new components and sync updates from zip..."
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono resize-none"
          />
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Pushing <strong className="text-slate-200">{filesToPush.length} files</strong> into branch &apos;{selectedBranch}&apos;
          </div>

          <button
            onClick={handlePushToGithub}
            disabled={pushing || filesToPush.length === 0}
            className="px-6 py-3 text-xs font-bold text-slate-900 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition inline-flex items-center space-x-2 shadow-xl shadow-cyan-500/20"
          >
            {pushing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Pushing to GitHub ({progressPercent}%)...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Push Code to GitHub</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Dialog overlay during push */}
      {pushing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20 w-12 h-12 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">Pushing to GitHub Repository</h3>
              <p className="text-xs text-slate-400 mt-1">{progressMsg}</p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-[11px] font-mono text-slate-500">
              Atomic Git Blob & Tree commit build ({filesToPush.length} files)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
