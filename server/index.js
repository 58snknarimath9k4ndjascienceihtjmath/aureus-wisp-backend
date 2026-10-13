import express from "express";
import compression from "compression";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { server as wisp, logging as wispLogging } from "@mercuryworkshop/wisp-js/server";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public");
const PORT = Number(process.env.PORT) || 8081;
const HOST = process.env.HOST || "127.0.0.1";

if (process.env.NODE_ENV === "production") wispLogging.set_level(wispLogging.WARN);

const app = express();
app.disable("x-powered-by");
app.use(compression());

const transportOptions = {
  setHeaders(res, path) {
    if (path.endsWith(".mjs") || path.endsWith(".js")) res.type("text/javascript");
    else if (path.endsWith(".wasm")) res.type("application/wasm");
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=600");
  },
};

app.use("/uv", express.static(join(publicDir, "uv"), transportOptions));
app.use("/baremux", express.static(join(publicDir, "baremux"), transportOptions));
app.use("/epoxy", express.static(join(publicDir, "epoxy"), transportOptions));
app.use("/assets", express.static(join(publicDir, "assets"), { fallthrough: false }));
app.get("/css/aureus.css", (_req, res) => res.sendFile(join(publicDir, "css", "aureus.css")));
app.get("/js/aureus-browser.js", (_req, res) => res.type("text/javascript").sendFile(join(publicDir, "js", "aureus-browser.js")));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => res.sendFile(join(publicDir, "index.html")));

// UV registers its service worker at the root so it can intercept encoded
// destination paths such as /s/<encoded-url>.
app.get("/uv.sw.js", (_req, res) => {
  res.set("Service-Worker-Allowed", "/");
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.type("text/javascript").sendFile(join(publicDir, "uv", "uv.sw.js"));
});

const httpServer = createServer(app);
httpServer.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/wisp/")) wisp.routeRequest(req, socket, head);
  else socket.end();
});
httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") console.error(`Port ${error.port} is already in use. Stop the other server or set PORT.`);
  else console.error("Server error:", error.message);
  process.exit(1);
});
httpServer.listen(PORT, HOST, () => {
  console.log(`\n  Aureus running -> http://${HOST}:${PORT}`);
  console.log(`  UV Wisp       -> ws://${HOST}:${PORT}/wisp/\n`);
});
