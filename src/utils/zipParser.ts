import JSZip from 'jszip';
import { ExtractedFile, ZipAnalysis } from '../types';

const IGNORED_PATTERNS = [
  '__MACOSX/',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '.git/',
  'node_modules/'
];

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'xml',
  'svg', 'yaml', 'yml', 'env', 'example', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'go', 'rs', 'php', 'rb', 'sh', 'bash', 'zsh', 'sql', 'gitignore',
  'dockerignore', 'editorconfig', 'babelrc', 'eslintrc', 'prettierrc', 'toml'
]);

export function isTextFile(filename: string): boolean {
  const parts = filename.split('.');
  if (parts.length === 1 && !filename.startsWith('.')) {
    return false;
  }
  const ext = parts.pop()?.toLowerCase() || '';
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Common filenames without extension
  const lower = filename.toLowerCase();
  if (['dockerfile', 'makefile', 'readme', 'license', 'changelog'].includes(lower)) {
    return true;
  }
  return false;
}

export async function parseZipFile(file: File): Promise<ZipAnalysis> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const rawEntries: { path: string; entry: JSZip.JSZipObject }[] = [];

  loadedZip.forEach((relativePath, entry) => {
    if (entry.dir) return;

    // Check ignore patterns
    const shouldIgnore = IGNORED_PATTERNS.some(pattern => 
      relativePath.includes(pattern) || relativePath.endsWith(pattern)
    );

    if (!shouldIgnore) {
      rawEntries.push({ path: relativePath, entry });
    }
  });

  if (rawEntries.length === 0) {
    throw new Error('The ZIP archive is empty or contains only ignored files.');
  }

  // Detect common root folder (e.g., "repo-master/src/index.ts")
  const pathParts = rawEntries.map(e => e.path.split('/'));
  let commonRoot = '';
  if (pathParts.length > 0 && pathParts[0].length > 1) {
    const candidateRoot = pathParts[0][0];
    const allHaveCandidate = pathParts.every(parts => parts.length > 1 && parts[0] === candidateRoot);
    if (allHaveCandidate) {
      commonRoot = candidateRoot;
    }
  }

  const extractedFiles: ExtractedFile[] = [];
  const extMap = new Set<string>();

  for (const item of rawEntries) {
    let normalizedPath = item.path;
    if (commonRoot && normalizedPath.startsWith(commonRoot + '/')) {
      normalizedPath = normalizedPath.slice(commonRoot.length + 1);
    }
    
    // Normalize any backslashes and remove leading slashes
    normalizedPath = normalizedPath.replace(/\\/g, '/').replace(/^\/+/, '');

    if (!normalizedPath) continue;

    const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';
    if (ext && ext.length <= 5) {
      extMap.add(ext);
    }

    const isText = isTextFile(normalizedPath);
    let content: string | Uint8Array;

    if (isText) {
      content = await item.entry.async('text');
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
