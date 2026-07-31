const fs = require('fs');
let code = fs.readFileSync('src/utils/githubApi.ts', 'utf8');

// Change concurrency of Blobs from 10 to 3
code = code.replace("runWithConcurrency(filesToPush, 10,", "runWithConcurrency(filesToPush, 3,");
// Change concurrency of Tree processing (diffing) from 5 to 3
code = code.replace("runWithConcurrency(zipFiles, 5,", "runWithConcurrency(zipFiles, 3,");

fs.writeFileSync('src/utils/githubApi.ts', code);
console.log("Patched githubApi!");
