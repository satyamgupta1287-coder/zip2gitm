function normalizeGitHubToken(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^(bearer|token)\s+/i, "")
    .trim();
}

function readToken(req) {
  const authHeader = req.headers.authorization || "";
  const bodyToken = req.body && typeof req.body === "object" ? req.body.token : undefined;
  return normalizeGitHubToken(bodyToken || req.query.token || authHeader);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = readToken(req);

  if (!token) {
    return res.status(400).json({
      status: false,
      message: "GitHub token is required"
    });
  }

  try {
    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "numberdetailfinder"
      }
    });

    const text = await response.text();
    let payload = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      const githubMessage = payload.message || response.statusText || "GitHub authentication failed";
      const hint = response.status === 401
        ? "Token was rejected by GitHub. Paste only the raw token value, without quotes, spaces, or a 'Bearer'/'token' prefix."
        : "GitHub returned an error while validating the token.";

      return res.status(response.status).json({
        status: false,
        message: `GitHub said: ${githubMessage}`,
        hint
      });
    }

    return res.status(200).json({
      status: true,
      user: {
        login: payload.login,
        id: payload.id,
        avatar_url: payload.avatar_url,
        html_url: payload.html_url
      }
    });
  } catch (error) {
    return res.status(502).json({
      status: false,
      message: "Unable to reach GitHub while validating the token",
      error: error.message
    });
  }
}

export { normalizeGitHubToken };
