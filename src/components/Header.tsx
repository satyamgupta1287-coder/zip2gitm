import React from 'react';
import { GitHubUser } from '../types';
import { Github, Key, History, Archive, ShieldCheck, LogOut } from 'lucide-react';

interface HeaderProps {
  user: GitHubUser | null;
  onOpenTokenModal: () => void;
  onDisconnect: () => void;
  onOpenHistory: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenTokenModal,
  onDisconnect,
  onOpenHistory,
  historyCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl text-white shadow-lg shadow-cyan-500/20">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">Zip to GitHub Auto Pusher</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Detect ZIP structures, compare diffs, create repos & push code
            </p>
          </div>
        </div>

        {/* Right Actions & User Profile */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenHistory}
            className="relative inline-flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          >
            <History className="w-4 h-4 text-slate-400" />
            <span className="hidden md:inline">Push History</span>
            {historyCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                {historyCount}
              </span>
            )}
          </button>

          {user ? (
            <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/80 rounded-xl p-1.5 pr-3">
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-7 h-7 rounded-lg border border-slate-600"
              />
              <div className="text-left hidden sm:block">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-semibold text-slate-200">{user.login}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-[10px] text-slate-400 block">{user.public_repos} repos</span>
              </div>
              <button
                onClick={onDisconnect}
                title="Disconnect Token"
                className="ml-2 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenTokenModal}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-900 bg-cyan-400 hover:bg-cyan-300 shadow-md shadow-cyan-500/20 transition"
            >
              <Key className="w-4 h-4" />
              <span>Connect GitHub PAT</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
