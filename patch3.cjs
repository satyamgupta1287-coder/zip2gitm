const fs = require('fs');
let code = fs.readFileSync('src/components/TokenConnectModal.tsx', 'utf8');

const targetState = "const [error, setError] = useState<string | null>(null);";
const replacementState = "const [error, setError] = useState<string | null>(null);\n  const [showToken, setShowToken] = useState(false);";

const targetInput = `<input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
            />`;

const replacementInput = `<div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onPaste={(e) => {
                   const pastedData = e.clipboardData.getData('Text');
                   if (pastedData) {
                     setTokenInput(pastedData.trim());
                   }
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
              >
                {showToken ? <X className="w-4 h-4" /> : <div className="text-[10px] font-bold">SHOW</div>}
              </button>
            </div>`;

if (code.includes(targetState) && code.includes(targetInput)) {
  code = code.replace(targetState, replacementState);
  code = code.replace(targetInput, replacementInput);
  fs.writeFileSync('src/components/TokenConnectModal.tsx', code);
  console.log("Patched TokenConnectModal!");
} else {
  console.log("Target string not found!");
}
