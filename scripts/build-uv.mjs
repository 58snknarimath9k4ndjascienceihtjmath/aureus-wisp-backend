// Copy the UV, bare-mux, and Epoxy browser bundles into public/.
// Run with: npm run build
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nm = join(root, "node_modules");
const bundles = [
  { name: "Ultraviolet", from: "@titaniumnetwork-dev/ultraviolet/dist", to: "public/uv" },
  { name: "BareMux", from: "@mercuryworkshop/bare-mux/dist", to: "public/baremux" },
  { name: "Epoxy transport", from: "@mercuryworkshop/epoxy-transport/dist", to: "public/epoxy" },
];

for (const bundle of bundles) {
  const source = join(nm, bundle.from);
  if (!existsSync(source)) {
    console.error(`Missing ${bundle.name} files at ${source}. From the Aureus folder, run: npm install`);
    process.exitCode = 1;
    continue;
  }
  const target = join(root, bundle.to);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  console.log(`Ready: ${bundle.name}`);
}
if (process.exitCode) process.exit(1);

// UV's files are served below /uv/, so align all client paths and the proxy prefix.
const configPath = join(root, "public/uv/uv.config.js");
let config = await readFile(configPath, "utf8");
config = config
  .replace("'/uv.handler.js'", "'/uv/uv.handler.js'")
  .replace("'/uv.client.js'", "'/uv/uv.client.js'")
  .replace("'/uv.bundle.js'", "'/uv/uv.bundle.js'")
  .replace("'/uv.config.js'", "'/uv/uv.config.js'")
  .replace("'/uv.sw.js'", "'/uv/uv.sw.js'")
  .replace(/prefix:\s*["']\/service\/["']/, 'prefix: "/s/"');
await writeFile(configPath, config);

// The npm package exports the service-worker class but not its fetch listener.
// This wrapper loads UV's globals and wires the handler for the browser.
const swPath = join(root, "public/uv/uv.sw.js");
let sw = await readFile(swPath, "utf8");
sw = sw.replace(/^\/\* aureus-uv-sw \*\/[\s\S]*?\n(?=(?:importScripts|var |let |const |self\.|\/\/|\/\*))/m, "");
const wiring = `/* aureus-uv-sw */
importScripts("/uv/uv.bundle.js", "/uv/uv.config.js");
`;
if (!sw.startsWith("/* aureus-uv-sw */")) {
  sw = wiring + sw + `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
const aureusUvWorker = new self.UVServiceWorker();
self.addEventListener("fetch", (event) => {
  if (aureusUvWorker.route({ request: event.request })) {
    event.respondWith(aureusUvWorker.fetch({ request: event.request }));
  }
});
`;
  await writeFile(swPath, sw);
}

// Copy TLS glue and WASM shipped by epoxy-tls into the Epoxy static folder.
const tlsDir = join(nm, "@mercuryworkshop/epoxy-tls/full");
if (existsSync(tlsDir)) {
  for (const file of ["epoxy-bundled.js", "epoxy.wasm"]) {
    const source = join(tlsDir, file);
    if (existsSync(source)) await cp(source, join(root, "public/epoxy", file));
  }
}

console.log("Ultraviolet browser files are ready. Start with: npm start");
