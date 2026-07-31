const fs = require('fs');
let code = fs.readFileSync('src/utils/githubApi.ts', 'utf8');

const retryFn = `// Helper to run promises with a concurrency limit
export async function runWithConcurrency<T, R>(`;

const replacementRetryFn = `// Fetch with retry for transient network errors
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
export async function runWithConcurrency<T, R>(`;

code = code.replace(retryFn, replacementRetryFn);
// Replace all `await fetch(` with `await fetchWithRetry(`
code = code.replace(/await fetch\(/g, "await fetchWithRetry(");

fs.writeFileSync('src/utils/githubApi.ts', code);
console.log("Patched fetch with retries!");
