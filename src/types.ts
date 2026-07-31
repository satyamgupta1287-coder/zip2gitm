export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
  public_repos: number;
  total_private_repos?: number;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
  stargazers_count: number;
  forks_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected?: boolean;
}

export interface ExtractedFile {
  path: string; // Relative normalized path e.g. "src/App.tsx"
  content: string | Uint8Array;
  isBinary: boolean;
  size: number;
  mimeType?: string;
}

export interface ZipAnalysis {
  fileName: string;
  fileSize: number;
  totalFiles: number;
  detectedRootFolder?: string;
  files: ExtractedFile[];
  languagesDetected: string[];
}

export type DiffStatus = 'added' | 'modified' | 'unchanged' | 'deleted';

export interface FileDiffItem {
  path: string;
  status: DiffStatus;
  newContent?: string | Uint8Array;
  oldContent?: string | Uint8Array;
  isBinary: boolean;
  size: number;
  oldSha?: string;
}

export interface DiffSummary {
  added: number;
  modified: number;
  unchanged: number;
  deleted: number;
  items: FileDiffItem[];
}

export interface PushJobHistory {
  id: string;
  timestamp: string;
  zipName: string;
  repoFullName: string;
  repoUrl: string;
  branch: string;
  commitSha: string;
  commitUrl: string;
  commitMessage: string;
  filesChangedCount: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface CreateRepoParams {
  name: string;
  description: string;
  isPrivate: boolean;
  autoInit: boolean;
}
