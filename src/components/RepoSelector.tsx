import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Search, Lock, Globe, RefreshCw, GitFork, Star, CheckCircle, AlertCircle, Building, FolderPlus } from 'lucide-react';
import { CreateRepoParams, GitHubBranch, GitHubRepo } from '../types';
import { createRepository, fetchRepoBranches, fetchUserRepos } from '../utils/githubApi';

interface RepoSelectorProps {
  token: string | null;
  selectedRepo: GitHubRepo | null;
  onSelectRepo: (repo: GitHubRepo) => void;
  selectedBranch: string;
  onSelectBranch: (branch: string) => void;
  zipName?: string;
  onOpenConnectModal: () => void;
}

export const RepoSelector: React.FC<RepoSelectorProps> = ({
  token,
  selectedRepo,
  onSelectRepo,
  selectedBranch,
  onSelectBranch,
  zipName,
  onOpenConnectModal,
}) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'create'>('existing');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // New Repo Form State
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoIsPrivate, setNewRepoIsPrivate] = useState(true);
  const [newRepoAutoInit, setNewRepoAutoInit] = useState(true);
  const [creatingRepo, setCreatingRepo] = useState(false);

  // Auto-generate sanitized repo name when zipName changes
  useEffect(() => {
    if (zipName && !newRepoName) {
      const sanitized = zipName
        .replace(/\.zip$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-');
      setNewRepoName(sanitized);
      setNewRepoDesc(`Imported from ${zipName}`);
    }
  }, [zipName]);

  // Load user repos when token is available
  useEffect(() => {
    if (token) {
      loadRepos();
    }
  }, [token]);

  // Load branches when selected repo changes
  useEffect(() => {
    if (token && selectedRepo) {
      loadBranches(selectedRepo.owner.login, selectedRepo.name);
    }
  }, [token, selectedRepo]);

  const loadRepos = async () => {
    if (!token) return;
    setLoadingRepos(true);
    setError(null);
    try {
      const list = await fetchUserRepos(token);
      setRepos(list);
      // Auto select first repo if none selected
      if (list.length > 0 && !selectedRepo) {
        onSelectRepo(list[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load user repositories.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const loadBranches = async (owner: string, repoName: string) => {
    if (!token) return;
    setLoadingBranches(true);
    try {
      const list = await fetchRepoBranches(token, owner, repoName);
      setBranches(list);
      if (list.length > 0) {
        // If main or master exist, default to it
        const defaultB = list.find((b) => b.name === 'main' || b.name === 'master') || list[0];
        onSelectBranch(defaultB.name);
      } else {
        onSelectBranch('main');
      }
    } catch (err) {
      onSelectBranch('main');
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleCreateNewRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      onOpenConnectModal();
      return;
    }

    if (!newRepoName.trim()) {
      setError('Please provide a valid repository name.');
      return;
    }

    setCreatingRepo(true);
    setError(null);

    try {
      const params: CreateRepoParams = {
        name: newRepoName.trim(),
        description: newRepoDesc.trim(),
        isPrivate: newRepoIsPrivate,
        autoInit: newRepoAutoInit,
      };

      const newRepo = await createRepository(token, params);
      setRepos((prev) => [newRepo, ...prev]);
      onSelectRepo(newRepo);
      onSelectBranch(newRepo.default_branch || 'main');
      setActiveTab('existing');
    } catch (err: any) {
      setError(err.message || 'Failed to create new repository on GitHub.');
    } finally {
      setCreatingRepo(false);
    }
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.owner.login.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!token) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-center">
        <div className="max-w-md mx-auto space-y-3">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20 w-12 h-12 flex items-center justify-center mx-auto">
            <Building className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-100">Step 2: Target Repository</h3>
          <p className="text-xs text-slate-400">
            Connect your GitHub Personal Access Token to list existing repositories or automatically create a new repo.
          </p>
          <button
            onClick={onOpenConnectModal}
            className="px-5 py-2.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition shadow-lg shadow-cyan-500/20"
          >
            Connect GitHub PAT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Step 2: Select or Create Target GitHub Repository</h2>
            <p className="text-xs text-slate-400">Choose an existing repository or create a new one to push code into.</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('existing')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'existing' ? 'bg-slate-800 text-cyan-400 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Existing Repo ({repos.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
              activeTab === 'create' ? 'bg-slate-800 text-cyan-400 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Create New Repo</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'existing' ? (
        <div className="space-y-4">
          {/* Search Bar & Refresh */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your repositories..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={loadRepos}
              disabled={loadingRepos}
              className="p-2 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-800 transition"
              title="Refresh repository list"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRepos ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>

          {/* Repository List Grid */}
          {loadingRepos ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto" />
              <p>Fetching repositories from GitHub...</p>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800">
              No repositories found matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
              {filteredRepos.map((repo) => {
                const isSelected = selectedRepo?.id === repo.id;
                return (
                  <div
                    key={repo.id}
                    onClick={() => onSelectRepo(repo)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-slate-100 shadow-md shadow-cyan-500/5'
                        : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2 truncate">
                        {repo.private ? (
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold truncate">{repo.name}</span>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />}
                    </div>

                    <p className="text-[11px] text-slate-400 truncate mb-2">
                      {repo.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center space-x-3 text-[10px] text-slate-500">
                      <span>{repo.owner.login}</span>
                      <span>Branch: {repo.default_branch}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Repo & Target Branch Picker */}
          {selectedRepo && (
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Target Repository:</span>
                <a
                  href={selectedRepo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-cyan-400 hover:underline flex items-center gap-1"
                >
                  {selectedRepo.full_name}
                </a>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Branch:</span>
                <div className="relative">
                  <select
                    value={selectedBranch}
                    onChange={(e) => onSelectBranch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))
                    ) : (
                      <option value="main">main</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Create New Repo Form */
        <form onSubmit={handleCreateNewRepo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Repository Name *</label>
              <input
                type="text"
                required
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="my-awesome-app"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
              <input
                type="text"
                value={newRepoDesc}
                onChange={(e) => setNewRepoDesc(e.target.value)}
                placeholder="Brief project description..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={newRepoIsPrivate}
                  onChange={() => setNewRepoIsPrivate(true)}
                  className="text-cyan-500 focus:ring-cyan-500"
                />
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Private</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={!newRepoIsPrivate}
                  onChange={() => setNewRepoIsPrivate(false)}
                  className="text-cyan-500 focus:ring-cyan-500"
                />
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Public</span>
              </label>
            </div>

            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newRepoAutoInit}
                onChange={(e) => setNewRepoAutoInit(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-cyan-500"
              />
              <span>Initialize with README.md</span>
            </label>

            <button
              type="submit"
              disabled={creatingRepo || !newRepoName.trim()}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition inline-flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {creatingRepo ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Repository...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create & Select Repository</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
