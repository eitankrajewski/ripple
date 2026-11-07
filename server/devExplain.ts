import type { Plugin } from "vite";
import { handleDoorDashWebhook } from "../api/_doordash.ts";
import { explainWithGemini } from "../api/_gemini.ts";

/** Serves /api/explain and /api/doordash during `npm run dev`, mirroring the Vercel functions. */
export function explainDevMiddleware(): Plugin {
  return {
    name: "ripple-explain-dev",
    configureServer(server) {
      server.middlewares.use("/api/doordash", (req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          const sig = req.headers["x-ripple-signature"];
          const out = await handleDoorDashWebhook(body, Array.isArray(sig) ? sig[0] : sig);
          res.statusCode = out.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(out.body));
        });
      });
      server.middlewares.use("/api/explain", (req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          res.setHeader("Content-Type", "application/json");
          let payload: unknown = {};
          try {
            payload = JSON.parse(body || "{}");
          } catch {
            // empty payload
          }
          const out = await explainWithGemini(payload);
          res.statusCode = out.ok ? 200 : 503;
          res.end(JSON.stringify(out.ok ? out.result : { error: out.reason }));
        });
      });
    },
  };
}
