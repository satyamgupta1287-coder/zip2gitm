import React, { useState } from 'react';
import { Key, Shield, ExternalLink, Check, AlertCircle, Loader2, X } from 'lucide-react';
import { GitHubUser } from '../types';
import { validateGithubToken } from '../utils/githubApi';

interface TokenConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: GitHubUser) => void;
  currentToken: string | null;
}

export const TokenConnectModal: React.FC<TokenConnectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentToken,
}) => {
  const [tokenInput, setTokenInput] = useState(currentToken || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please enter a valid GitHub Personal Access Token.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await validateGithubToken(tokenInput.trim());
      onSuccess(tokenInput.trim(), user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate token with GitHub.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Connect GitHub Account</h3>
              <p className="text-xs text-slate-400">Provide a Personal Access Token (PAT) with repo scope</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConnect} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              GitHub Personal Access Token (PAT)
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.replace(/[\s\r\n]+/g, ''))}
                onPaste={(e) => {
                   const pastedData = e.clipboardData.getData('Text');
                   if (pastedData) {
                     setTokenInput(pastedData.replace(/[\s\r\n]+/g, ''));
                   }
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
              >
                {showToken ? <X className="w-4 h-4" /> : <div className="text-[10px] font-bold">SHOW</div>}
              </button>
            </div>
          </div>

          {/* Quick instructions box */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" /> Token Requirements
              </span>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=ZipToGithubPusher"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                Generate token on GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>
                <strong className="text-slate-300">Classic Token:</strong> Check the <code className="px-1 py-0.5 bg-slate-800 rounded text-cyan-300">repo</code> scope (Full control of private & public repos).
              </li>
              <li>
                <strong className="text-slate-300">Fine-grained Token:</strong> Grant <code className="px-1 py-0.5 bg-slate-800 rounded text-cyan-300">Contents: Read and write</code> permission.
              </li>
            </ul>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !tokenInput.trim()}
              className="px-5 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition inline-flex items-center space-x-2 shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Token...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Verify & Save Token</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
