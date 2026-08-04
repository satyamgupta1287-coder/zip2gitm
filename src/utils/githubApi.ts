import { CreateRepoParams, DiffSummary, ExtractedFile, FileDiffItem, GitHubBranch, GitHubRepo, GitHubUser } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// Convert string/Uint8Array content to Base64 for GitHub Git Blob API
export function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Calculate GitHub Blob SHA locally
export async function calculateGitSha(content: string | Uint8Array): Promise<string> {
  let bytes: Uint8Array;
  if (typeof content === 'string') {
    bytes = new TextEncoder().encode(content);
  } else {
    bytes = content;
  }
  
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const combined = new Uint8Array(header.length + bytes.length);
  combined.set(header);
  combined.set(bytes, header.length);
  
  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fetch with retry for transient network errors
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res; // let the caller handle 4xx/5xx responses
    } catch (err: any) {
      if (i === retries - 1) throw err;
      // Wait before retrying (exponential backoff)
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Failed to fetch after retries");
}

// Helper to run promises with a concurrency limit
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  iteratorFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await iteratorFn(items[index], index);
    }
  });
  
  await Promise.all(workers);
  return results;
}

export async function validateGithubToken(token: string): Promise<GitHubUser> {
  token = token.replace(/[^a-zA-Z0-9_]/g, '');
  const res = await fetchWithRetry(`${GITHUB_API_BASE}/user`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    let msg = errorData.message || 'Invalid GitHub token or insufficient permissions.';
    if (res.status === 401) {
      msg = `Authentication failed (401). GitHub said: "${errorData.message}". Ensure your token is valid and not expired.`;
    }
    throw new Error(msg);
  }

    // Try to check scopes if it's a classic token
  const scopesHeader = res.headers.get('X-OAuth-Scopes');
  if (token.startsWith('ghp_')) {
    if (scopesHeader === null || scopesHeader === '') {
      throw new Error('Your Classic Token has no permissions granted! Please generate a new token and make sure to check the "repo" checkbox.');
    }
    if (!scopesHeader.includes('repo')) {
      throw new Error(`Your Classic Token is missing the "repo" permission scope. Current scopes: "${scopesHeader}". Please generate a new token with the "repo" checkbox checked.`);
    }
  }
  
  return await res.json();
}

export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetchWithRetry(`${GITHUB_API_BASE}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    throw new Error('Failed to fetch repositories from GitHub.');
  }

  return await res.json();
}

export async function createRepository(token: string, params: CreateRepoParams): Promise<GitHubRepo> {
  const res = await fetchWithRetry(`${GITHUB_API_BASE}/user/repos`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      private: params.isPrivate,
      auto_init: params.autoInit,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create GitHub repository.');
  }

  return await res.json();
}

export async function fetchRepoBranches(token: string, owner: string, repo: string): Promise<GitHubBranch[]> {
  const res = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    return [];
  }

  return await res.json();
}

export interface TreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

export async function fetchRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<{ sha: string; tree: TreeItem[] } | null> {
  // First get branch reference to get commit tree sha
  const branchRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${branch}`, {
    headers: getHeaders(token),
  });

  if (!branchRes.ok) {
    return null; // Empty or branch non-existent
  }

  const branchData = await branchRes.json();
  const commitSha = branchData.commit.sha;
  const treeSha = branchData.commit.commit.tree.sha;

  const treeRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, {
    headers: getHeaders(token),
  });

  if (!treeRes.ok) {
    return { sha: commitSha, tree: [] };
  }

  const treeData = await treeRes.json();
  return {
    sha: commitSha,
    tree: treeData.tree.filter((t: TreeItem) => t.type === 'blob'),
  };
}

export async function fetchFileContent(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  const res = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
    headers: getHeaders(token),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (data.content && data.encoding === 'base64') {
    return atob(data.content.replace(/\n/g, ''));
  }
  return null;
}

export async function compareZipWithRepo(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  zipFiles: ExtractedFile[],
  onProgress?: (message: string) => void
): Promise<DiffSummary> {
  onProgress?.('Fetching repository structure from GitHub...');
  const repoTreeData = await fetchRepoTree(token, owner, repo, branch);

  const diffItems: FileDiffItem[] = [];
  let added = 0;
  let modified = 0;
  let unchanged = 0;
  let deleted = 0;

  if (!repoTreeData || repoTreeData.tree.length === 0) {
    // Empty repository or brand new branch -> All zip files are new additions
    for (const f of zipFiles) {
      diffItems.push({
        path: f.path,
        status: 'added',
        newContent: f.content,
        isBinary: f.isBinary,
        size: f.size,
      });
      added++;
    }

    return {
      added,
      modified,
      unchanged,
      deleted: 0,
      items: diffItems,
    };
  }

  // Create lookup map for existing files in GitHub repo tree
  const repoFileMap = new Map<string, TreeItem>();
  for (const item of repoTreeData.tree) {
    repoFileMap.set(item.path, item);
  }

  const zipPathsSet = new Set<string>();

  const processedDiffs = await runWithConcurrency(zipFiles, 3, async (zf, i) => {
    zipPathsSet.add(zf.path);
    if (i % 10 === 0 || i === zipFiles.length - 1) {
      onProgress?.(`Comparing file ${i + 1}/${zipFiles.length}: ${zf.path}`);
    }

    const existingInRepo = repoFileMap.get(zf.path);

    if (!existingInRepo) {
      return {
        path: zf.path,
        status: 'added' as const,
        newContent: zf.content,
        isBinary: zf.isBinary,
        size: zf.size,
      };
    }

    let oldContentStr: string | null = null;
    let isDifferent = false;
    
    const localSha = await calculateGitSha(zf.content);
    isDifferent = localSha !== existingInRepo.sha;

    if (isDifferent && !zf.isBinary && typeof zf.content === 'string') {
      oldContentStr = await fetchFileContent(token, owner, repo, branch, zf.path);
      if (oldContentStr !== null) {
        const normOld = oldContentStr.replace(/\r\n/g, '\n');
        const normNew = zf.content.replace(/\r\n/g, '\n');
        isDifferent = normOld !== normNew;
      } else {
        isDifferent = true;
      }
    } else if (isDifferent && zf.isBinary) {
      isDifferent = zf.size !== existingInRepo.size || isDifferent;
    }

    return {
      path: zf.path,
      status: (isDifferent ? 'modified' : 'unchanged') as 'modified' | 'unchanged',
      newContent: zf.content,
      oldContent: oldContentStr || undefined,
      isBinary: zf.isBinary,
      size: zf.size,
      oldSha: existingInRepo.sha,
    };
  });

  for (const diff of processedDiffs) {
    diffItems.push(diff);
    if (diff.status === 'added') added++;
    else if (diff.status === 'modified') modified++;
    else unchanged++;
  }

  return {
    added,
    modified,
    unchanged,
    deleted,
    items: diffItems,
  };
}

export interface PushCommitOptions {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  commitMessage: string;
  filesToPush: FileDiffItem[];
  onProgress?: (message: string, percent: number) => void;
}

export async function pushCommitToGithub(options: PushCommitOptions): Promise<{ commitSha: string; commitUrl: string }> {
  const { token, owner, repo, branch, commitMessage, filesToPush, onProgress } = options;

  onProgress?.('Checking target repository branch status...', 10);

  // 1. Get latest branch commit SHA
  const branchRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${branch}`, {
    headers: getHeaders(token),
  });

  let parentCommitSha: string | null = null;
  let baseTreeSha: string | null = null;

  if (branchRes.ok) {
    const branchData = await branchRes.json();
    parentCommitSha = branchData.commit.sha;
    baseTreeSha = branchData.commit.commit.tree.sha;
  } else if (branchRes.status === 404) {
    // Check if repository is empty
    const repoInfoRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: getHeaders(token),
    });
    let isEmpty = false;
    if (repoInfoRes.ok) {
      const repoInfo = await repoInfoRes.json();
      isEmpty = repoInfo.size === 0;
    }
    
    if (isEmpty) {
      onProgress?.('Repository is empty. Initializing with initial commit...', 12);
      // Initialize with a dummy README.md using the Contents API
      const initRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/README.md`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify({
          message: 'Initial commit',
          content: btoa('# ' + repo + '\n\nInitialized by Zip to GitHub Auto Pusher.'),
          branch: branch
        }),
      });
      
      if (!initRes.ok) {
         const err = await initRes.json().catch(() => ({}));
         throw new Error(`Failed to initialize empty repository: ${err.message || 'API Error'}`);
      }
      
      // Fetch branch info again
      const newBranchRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${branch}`, {
        headers: getHeaders(token),
      });
      if (newBranchRes.ok) {
        const branchData = await newBranchRes.json();
        parentCommitSha = branchData.commit.sha;
        baseTreeSha = branchData.commit.commit.tree.sha;
      } else {
        throw new Error('Failed to retrieve branch info after initialization.');
      }
    }
  }

  // 2. Create blobs for each file to push
  const total = filesToPush.length;
  let completedBlobs = 0;

  const treeEntries = await runWithConcurrency(filesToPush, 3, async (file) => {
    let contentBase64 = '';
    let encoding = 'utf-8';

    if (file.isBinary) {
      encoding = 'base64';
      if (file.newContent instanceof Uint8Array) {
        contentBase64 = arrayBufferToBase64(file.newContent);
      } else if (typeof file.newContent === 'string') {
        contentBase64 = btoa(file.newContent);
      }
    } else {
      if (typeof file.newContent === 'string') {
        contentBase64 = btoa(unescape(encodeURIComponent(file.newContent)));
        encoding = 'base64';
      } else if (file.newContent instanceof Uint8Array) {
        contentBase64 = arrayBufferToBase64(file.newContent);
        encoding = 'base64';
      }
    }

    const blobRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        content: contentBase64,
        encoding: encoding,
      }),
    });

    if (!blobRes.ok) {
      const err = await blobRes.json().catch(() => ({}));
      let errMsg = err.message || 'API Error';
      if (blobRes.status === 401 || errMsg.toLowerCase().includes('bad credentials')) {
        errMsg = 'Bad credentials. Your GitHub token is invalid, expired, or lacks write permissions. Please reconnect a valid PAT.';
      } else if (blobRes.status === 403) {
        errMsg = 'Permission denied. Ensure your token has write access to this repository and SSO is authorized.';
      } else if (blobRes.status === 404) {
        errMsg = 'Not Found (404). This usually means your token lacks the "repo" scope (for Classic Tokens) or "Contents: Write" permissions (for Fine-grained Tokens), or the repository does not exist. Please generate a new token with the correct permissions.';
      }
      throw new Error(`Failed to upload blob for ${file.path}: ${errMsg}`);
    }

    const blobData = await blobRes.json();
    completedBlobs++;
    const progressPercent = 15 + Math.floor((completedBlobs / total) * 50);
    onProgress?.(`Uploading blob ${completedBlobs}/${total}: ${file.path}`, progressPercent);

    return {
      path: file.path,
      mode: '100644', // normal file
      type: 'blob' as const,
      sha: blobData.sha,
    };
  });

  // 3. Create new tree
  onProgress?.('Building Git tree...', 70);
  const treeBody: { tree: typeof treeEntries; base_tree?: string } = {
    tree: treeEntries,
  };
  if (baseTreeSha) {
    treeBody.base_tree = baseTreeSha;
  }

  const treeRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(treeBody),
  });

  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}));
    let errMsg = err.message || 'API Error';
    
    const hasWorkflowFiles = filesToPush.some(f => f.path.startsWith('.github/workflows/'));
    if (treeRes.status === 404 && hasWorkflowFiles) {
      errMsg += ' (This usually happens because your GitHub token is missing the "workflow" scope required to modify .github/workflows/. Update your token permissions or remove the workflow files from the ZIP)';
    }

    throw new Error(`Failed to build Git tree: ${errMsg}`);
  }

  const newTreeData = await treeRes.json();

  // 4. Create commit
  onProgress?.('Creating commit...', 85);
  const commitBody: { message: string; tree: string; parents?: string[] } = {
    message: commitMessage,
    tree: newTreeData.sha,
  };
  if (parentCommitSha) {
    commitBody.parents = [parentCommitSha];
  }

  const commitRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(commitBody),
  });

  if (!commitRes.ok) {
    const err = await commitRes.json().catch(() => ({}));
    throw new Error(`Failed to create commit: ${err.message || 'API Error'}`);
  }

  const commitData = await commitRes.json();
  const newCommitSha = commitData.sha;

  // 5. Update branch reference
  onProgress?.(`Updating branch ref '${branch}'...`, 95);
  if (parentCommitSha) {
    const refRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({
        sha: newCommitSha,
        force: false,
      }),
    });

    if (!refRes.ok) {
      const err = await refRes.json().catch(() => ({}));
      throw new Error(`Failed to update branch reference '${branch}': ${err.message || 'API Error'}`);
    }
  } else {
    // Create reference if ref didn't exist yet
    const createRefRes = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: newCommitSha,
      }),
    });

    if (!createRefRes.ok) {
      const err = await createRefRes.json().catch(() => ({}));
      throw new Error(`Failed to create branch '${branch}': ${err.message || 'API Error'}`);
    }
  }

  onProgress?.('Push completed successfully!', 100);

  return {
    commitSha: newCommitSha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
  };
}
