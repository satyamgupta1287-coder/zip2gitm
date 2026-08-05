import JSZip from 'jszip';
import { ExtractedFile, ZipAnalysis } from '../types';

const IGNORED_PATTERNS = [
  '__MACOSX/',
  '._',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '.git/',
  'node_modules/',
  '.next/',
  '.nuxt/',
  '.output/',
  '.vercel/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '.cache/',
  '.turbo/',
  '.idea/',
  '.vscode/',
];

const IGNORED_EXACT_FILENAMES = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
]);

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'xml',
  'svg', 'yaml', 'yml', 'env', 'example', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'go', 'rs', 'php', 'rb', 'sh', 'bash', 'zsh', 'sql', 'gitignore',
  'dockerignore', 'editorconfig', 'babelrc', 'eslintrc', 'prettierrc', 'toml',
  'cjs', 'mjs', 'lock'
]);

const SECRET_PATTERNS = [
  /ghp_[a-zA-Z0-9_]{20,}/g,
  /github_pat_[a-zA-Z0-9_]{20,}/g,
  /gho_[a-zA-Z0-9_]{20,}/g,
  /ghu_[a-zA-Z0-9_]{20,}/g,
  /ghs_[a-zA-Z0-9_]{20,}/g,
  /ghr_[a-zA-Z0-9_]{20,}/g,
  /sk-proj-[a-zA-Z0-9_\-]{20,}/g,
  /sk-[a-zA-Z0-9_\-]{20,}/g,
  /xox[baprs]-[a-zA-Z0-9_\-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
];

export function sanitizeTextSecrets(content: string): { text: string; count: number } {
  let text = content;
  let count = 0;
  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
      text = text.replace(pattern, 'REDACTED_SECRET_TOKEN');
    }
  }
  return { text, count };
}

export function isTextFile(filename: string): boolean {
  const parts = filename.split('.');
  if (parts.length === 1 && !filename.startsWith('.')) {
    return false;
  }
  const ext = parts.pop()?.toLowerCase() || '';
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Common filenames without extension
  const lower = filename.toLowerCase();
  if (['dockerfile', 'makefile', 'readme', 'license', 'changelog', '.gitignore', '.env.example'].includes(lower)) {
    return true;
  }
  return false;
}

export async function parseZipFile(file: File): Promise<ZipAnalysis> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const rawEntries: { cleanPath: string; entry: JSZip.JSZipObject }[] = [];

  loadedZip.forEach((relativePath, entry) => {
    if (entry.dir) return;

    // Normalize path slashes
    const cleanPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanPath) return;

    const lowerPath = cleanPath.toLowerCase();
    const fileName = cleanPath.split('/').pop()?.toLowerCase() || '';

    // Check exact ignored filenames or patterns
    if (IGNORED_EXACT_FILENAMES.has(fileName)) return;
    if (fileName.startsWith('._')) return; // Apple double files
    if (fileName.endsWith('.log')) return; // Log files

    const shouldIgnore = IGNORED_PATTERNS.some(pattern => {
      const lowerPattern = pattern.toLowerCase();
      return lowerPath.includes(lowerPattern) || lowerPath.endsWith(lowerPattern);
    });

    if (!shouldIgnore) {
      rawEntries.push({ cleanPath, entry });
    }
  });

  if (rawEntries.length === 0) {
    throw new Error('The ZIP archive is empty or contains only build/ignored files (e.g. node_modules, .DS_Store).');
  }

  // Detect common root folder (e.g., "bill-Mitra-vercel-main/src/index.ts")
  let commonRoot = '';
  const firstParts = rawEntries[0].cleanPath.split('/');
  if (firstParts.length > 1) {
    const candidateRoot = firstParts[0];
    const allShareRoot = rawEntries.every(item => {
      const parts = item.cleanPath.split('/');
      return parts.length > 1 && parts[0] === candidateRoot;
    });
    if (allShareRoot) {
      commonRoot = candidateRoot;
    }
  }

  const extractedFiles: ExtractedFile[] = [];
  const extMap = new Set<string>();

  for (const item of rawEntries) {
    let normalizedPath = item.cleanPath;
    if (commonRoot && normalizedPath.startsWith(commonRoot + '/')) {
      normalizedPath = normalizedPath.slice(commonRoot.length + 1);
    }

    if (!normalizedPath) continue;

    const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';
    if (ext && ext.length <= 5) {
      extMap.add(ext);
    }

    const isText = isTextFile(normalizedPath);
    let content: string | Uint8Array;

    if (isText) {
      const rawText = await item.entry.async('text');
      content = sanitizeTextSecrets(rawText).text;
    } else {
      content = await item.entry.async('uint8array');
    }

    // Estimate file size
    const size = typeof content === 'string' ? new Blob([content]).size : content.byteLength;

    extractedFiles.push({
      path: normalizedPath,
      content,
      isBinary: !isText,
      size
    });
  }

  // Sort files alphabetically by path
  extractedFiles.sort((a, b) => a.path.localeCompare(b.path));

  // Language detection summary
  const languagesDetected = Array.from(extMap).filter(e => 
    ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'html', 'css', 'json', 'md', 'cpp', 'c', 'php'].includes(e)
  );

  return {
    fileName: file.name,
    fileSize: file.size,
    totalFiles: extractedFiles.length,
    detectedRootFolder: commonRoot || undefined,
    files: extractedFiles,
    languagesDetected
  };
}
