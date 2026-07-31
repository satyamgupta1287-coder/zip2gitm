const fs = require('fs');
let code = fs.readFileSync('src/utils/githubApi.ts', 'utf8');

const target = "status: (isDifferent ? 'modified' : 'unchanged') as const,";
const replacement = "status: (isDifferent ? 'modified' : 'unchanged') as 'modified' | 'unchanged',";

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/utils/githubApi.ts', code);
  console.log("Patched 2!");
} else {
  console.log("Target string not found!");
}
