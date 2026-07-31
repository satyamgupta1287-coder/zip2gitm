import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-commit-msg", async (req, res) => {
    try {
      const { zipName, summary, files } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        const title = `feat: sync code changes from ${zipName || 'ZIP file'}`;
        const desc = `\n\n- Updated ${summary?.modified || 0} existing file(s)\n- Added ${summary?.added || 0} new file(s)`;
        return res.json({ commitMsg: `${title}${desc}` });
      }

      const ai = new GoogleGenAI({ apiKey });
      const filesPreview = (files || [])
        .slice(0, 15)
        .map((f: { status: string; path: string }) => `- [${f.status.toUpperCase()}] ${f.path}`)
        .join("\n");

      const prompt = `You are a Git commit message generator. Based on the following summary of changes extracted from a ZIP archive, write a clean conventional commit message.

ZIP Name: ${zipName || 'archive.zip'}
Summary: ${summary?.added || 0} files added, ${summary?.modified || 0} files modified.

Changed files sample:
${filesPreview}

Instructions:
1. Provide a clear conventional commit title (e.g. feat: ..., fix: ..., refactor: ..., chore: ...).
2. Followed by 2-3 short bullet points summarizing what was added/updated.
3. Keep the title under 70 characters.
4. Output ONLY the raw commit message text, no markdown backticks or commentary.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const commitMsg = response.text?.trim() || `feat: import update from ${zipName || 'ZIP'}`;
      res.json({ commitMsg });
    } catch (err) {
      console.error("Gemini commit message error:", err);
      res.json({
        commitMsg: `feat: sync updates from ${req.body?.zipName || 'ZIP archive'}`,
      });
    }
  });

  app.post("/api/ai-review", async (req, res) => {
    try {
      const { files } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.json({ review: "Gemini API Key is missing. Please configure it in your environment." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      let diffText = "";
      const filesToReview = (files || []).filter((f: any) => !f.isBinary).slice(0, 10);
      
      if (filesToReview.length === 0) {
        return res.json({ review: "No text files to review." });
      }

      for (const f of filesToReview) {
        diffText += `\n--- File: ${f.path} (${f.status}) ---\n`;
        if (f.status === 'added' || f.status === 'modified') {
          diffText += `New Content (Snippet):\n${String(f.newContent).slice(0, 1500)}\n`;
        }
      }

      const prompt = `You are a Senior Software Engineer conducting a code review. Review the following changes and provide a concise summary, pointing out any potential bugs, security issues, or improvements. Use Markdown formatting. Keep it helpful and concise.\n\nChanges:\n${diffText}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      res.json({ review: response.text });
    } catch (err) {
      console.error("Gemini review error:", err);
      res.status(500).json({ review: "Failed to generate AI review. Please try again later." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
