const fs = require('fs');
let code = fs.readFileSync('src/utils/githubApi.ts', 'utf8');

code = code.replace("const res = await fetchWithRetry(url, options);", "const res = await fetch(url, options);");

fs.writeFileSync('src/utils/githubApi.ts', code);
console.log("Fixed infinite recursion!");
