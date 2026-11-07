import type { Plugin } from "vite";
import { explainWithGemini } from "../api/_gemini.ts";

/** Serves /api/explain during `npm run dev`, mirroring the Vercel function. */
export function explainDevMiddleware(): Plugin {
  return {
    name: "ripple-explain-dev",
    configureServer(server) {
      server.middlewares.use("/api/explain", (req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          res.setHeader("Content-Type", "application/json");
          try {
            const result = await explainWithGemini(JSON.parse(body || "{}"));
            res.statusCode = result ? 200 : 503;
            res.end(JSON.stringify(result ?? { error: "explanation unavailable" }));
          } catch {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: "explanation unavailable" }));
          }
        });
      });
    },
  };
}
