const fs = require('fs');
let code = fs.readFileSync('src/utils/githubApi.ts', 'utf8');

const target = `  if (branchRes.ok) {
    const branchData = await branchRes.json();
    parentCommitSha = branchData.commit.sha;
    baseTreeSha = branchData.commit.commit.tree.sha;
  }`;

const replacement = `  if (branchRes.ok) {
    const branchData = await branchRes.json();
    parentCommitSha = branchData.commit.sha;
    baseTreeSha = branchData.commit.commit.tree.sha;
  } else if (branchRes.status === 404) {
    // Check if repository is empty
    const repoInfoRes = await fetch(\`\${GITHUB_API_BASE}/repos/\${owner}/\${repo}\`, {
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
      const initRes = await fetch(\`\${GITHUB_API_BASE}/repos/\${owner}/\${repo}/contents/README.md\`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify({
          message: 'Initial commit',
          content: btoa('# ' + repo + '\\n\\nInitialized by Zip to GitHub Auto Pusher.'),
          branch: branch
        }),
      });
      
      if (!initRes.ok) {
         const err = await initRes.json().catch(() => ({}));
         throw new Error(\`Failed to initialize empty repository: \${err.message || 'API Error'}\`);
      }
      
      // Fetch branch info again
      const newBranchRes = await fetch(\`\${GITHUB_API_BASE}/repos/\${owner}/\${repo}/branches/\${branch}\`, {
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
  }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/utils/githubApi.ts', code);
  console.log("Patched!");
} else {
  console.log("Target string not found!");
}
