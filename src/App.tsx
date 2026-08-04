import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TokenConnectModal } from './components/TokenConnectModal';
import { WorkspaceManager } from './components/WorkspaceManager';
import { RepoSelector } from './components/RepoSelector';
import { DiffInspector } from './components/DiffInspector';
import { PushActionPanel } from './components/PushActionPanel';
import { PushHistoryDrawer } from './components/PushHistoryDrawer';
import { DiffSummary, GitHubRepo, GitHubUser, PushJobHistory, ZipAnalysis } from './types';
import { validateGithubToken } from './utils/githubApi';
import { FileArchive, Sparkles, HelpCircle, ShieldAlert, ArrowRight } from 'lucide-react';

const LOCAL_STORAGE_TOKEN_KEY = 'zip_pusher_github_token';
const LOCAL_STORAGE_HISTORY_KEY = 'zip_pusher_history';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Workflow State
  const [zipAnalysis, setZipAnalysis] = useState<ZipAnalysis | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [history, setHistory] = useState<PushJobHistory[]>([]);

  // Load saved token & history on initial mount
  useEffect(() => {
    let savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
    
    // Auto-inject the token provided by the user
    if (!savedToken) {
      savedToken = "REDACTED_SECRET_TOKEN";
      localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, savedToken);
    }

    if (savedToken) {
      setToken(savedToken);
      validateGithubToken(savedToken)
        .then((userData) => setUser(userData))
        .catch(() => {
          localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
          setToken(null);
        });
    }

    const savedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to parse push history:', err);
      }
    }
  }, []);

  const handleConnectSuccess = (newToken: string, userData: GitHubUser) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, newToken);
  };

  const handleDisconnect = () => {
    setToken(null);
    setUser(null);
    setSelectedRepo(null);
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
  };

  const handleAddPushJob = (job: PushJobHistory) => {
    const updated = [job, ...history];
    setHistory(updated);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
  };

  const handleLoadDemoZip = () => {
    const demoFiles = [
      {
        path: 'src/index.ts',
        content: `console.log("Hello from Zip Auto Pusher!");\nexport const version = "1.0.0";\n`,
        isBinary: false,
        size: 78,
      },
      {
        path: 'src/App.tsx',
        content: `import React from 'react';\n\nexport default function App() {\n  return (\n    <div className="p-8">\n      <h1 className="text-2xl font-bold">Imported App</h1>\n      <p>Pushed automatically via Zip Auto Pusher!</p>\n    </div>\n  );\n}\n`,
        isBinary: false,
        size: 215,
      },
      {
        path: 'package.json',
        content: `{\n  "name": "auto-pushed-app",\n  "version": "1.0.0",\n  "scripts": {\n    "build": "tsc"\n  }\n}\n`,
        isBinary: false,
        size: 98,
      },
      {
        path: 'README.md',
        content: `# Auto Pushed Application\n\nThis project was automatically deployed from a ZIP file archive directly into GitHub.\n`,
        isBinary: false,
        size: 132,
      },
    ];

    setZipAnalysis({
      fileName: 'sample-project-v1.zip',
      fileSize: 1024,
      totalFiles: demoFiles.length,
      detectedRootFolder: undefined,
      files: demoFiles,
      languagesDetected: ['ts', 'tsx', 'json', 'md'],
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Navigation Bar */}
      <Header
        user={user}
        onOpenTokenModal={() => setIsTokenModalOpen(true)}
        onDisconnect={handleDisconnect}
        onOpenHistory={() => setIsHistoryDrawerOpen(true)}
        historyCount={history.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner / Connection Prompt if token missing */}
        {!token && (
          <div className="p-5 bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Connect GitHub Personal Access Token</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  To push code to your GitHub repositories or auto-create new repos, connect your GitHub PAT token.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsTokenModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition shrink-0 shadow-lg shadow-cyan-500/20"
            >
              Connect Token Now
            </button>
          </div>
        )}

        {/* Demo Preset Loader pill */}
        {!zipAnalysis && (
          <div className="flex justify-end">
            <button
              onClick={handleLoadDemoZip}
              className="px-3.5 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl transition inline-flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Load Sample Demo ZIP</span>
            </button>
          </div>
        )}

        {/* Step 1: Workspace / File Manager */}
        <WorkspaceManager
          zipAnalysis={zipAnalysis}
          onAnalysisComplete={(analysis) => {
            setZipAnalysis(analysis);
            setDiffSummary(null);
          }}
          onAnalysisUpdate={setZipAnalysis}
          onReset={() => {
            setZipAnalysis(null);
            setDiffSummary(null);
          }}
        />

        {/* Step 2: Target Repository Selection & Creation */}
        <RepoSelector
          token={token}
          selectedRepo={selectedRepo}
          onSelectRepo={(repo) => {
            setSelectedRepo(repo);
            setDiffSummary(null);
          }}
          selectedBranch={selectedBranch}
          onSelectBranch={(branch) => {
            setSelectedBranch(branch);
            setDiffSummary(null);
          }}
          zipName={zipAnalysis?.fileName}
          onOpenConnectModal={() => setIsTokenModalOpen(true)}
        />

        {/* Step 3: Change & Diff Inspector */}
        {zipAnalysis && selectedRepo && (
          <DiffInspector
            token={token}
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            zipFiles={zipAnalysis.files}
            diffSummary={diffSummary}
            onDiffCalculated={setDiffSummary}
          />
        )}

        {/* Step 4: Commit & Push Execution */}
        {zipAnalysis && selectedRepo && (
          <PushActionPanel
            token={token}
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            diffSummary={diffSummary}
            zipName={zipAnalysis.fileName}
            onPushComplete={handleAddPushJob}
            onOpenConnectModal={() => setIsTokenModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-500">
        <p>Zip to GitHub Auto Pusher &bull; Automated deployment &amp; code change detector</p>
      </footer>

      {/* Modals & Drawers */}
      <TokenConnectModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onSuccess={handleConnectSuccess}
        currentToken={token}
      />

      <PushHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        history={history}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
