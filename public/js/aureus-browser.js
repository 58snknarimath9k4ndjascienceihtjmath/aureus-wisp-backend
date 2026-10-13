import { BareMuxConnection } from "/baremux/index.mjs";

const $ = (selector) => document.querySelector(selector);
const tabsBar = $("#tabs");
const home = $("#home");
const viewer = $("#viewer");
const address = $("#addressInput");
const loading = $("#loading");
const toast = $("#toast");
const tabs = [];
let restoringTabs = true;
const HISTORY_KEY = "aureus.history.v1";
const ENGINE_KEY = "aureus.search-engine.v1";
const SESSION_KEY = "aureus.session.v1";
const engines = [
  { id: "duckduckgo", name: "DuckDuckGo", template: "https://duckduckgo.com/?q={query}", domain: "duckduckgo.com" },
  { id: "google", name: "Google", template: "https://www.google.com/search?q={query}", domain: "google.com" },
  { id: "bing", name: "Bing", template: "https://www.bing.com/search?q={query}", domain: "bing.com" },
  { id: "yandex", name: "Yandex", template: "https://yandex.com/search/?text={query}", domain: "yandex.com" },
  { id: "brave", name: "Brave Search", template: "https://search.brave.com/search?q={query}", domain: "search.brave.com" },
  { id: "ecosia", name: "Ecosia", template: "https://www.ecosia.org/search?q={query}", domain: "ecosia.org" },
  { id: "startpage", name: "Startpage", template: "https://www.startpage.com/sp/search?query={query}", domain: "startpage.com" },
  { id: "qwant", name: "Qwant", template: "https://www.qwant.com/?q={query}&t=web", domain: "qwant.com" },
  { id: "yahoo", name: "Yahoo Search", template: "https://search.yahoo.com/search?p={query}", domain: "search.yahoo.com" }
];
let recentHistory = readStorage(HISTORY_KEY, []);
let selectedEngine = engines.find((engine) => engine.id === readStorage(ENGINE_KEY, "duckduckgo")) || engines[0];
let activeId = null;
let nextId = 1;
let toastTimer;

function showNotice(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
}

function readStorage(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { showNotice("Browser storage is unavailable in this session."); }
}

function saveHistory(url, title = "") {
  if (!/^https?:/i.test(url)) return;
  recentHistory = [{ url, title: title || safeHost(url), visitedAt: Date.now() }, ...recentHistory.filter((item) => item.url !== url)].slice(0, 100);
  writeStorage(HISTORY_KEY, recentHistory);
  renderHistory();
}

function renderHistory() {
  const list = $("#historyList");
  list.replaceChildren();
  if (!recentHistory.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "Pages you visit will appear here.";
    list.append(empty);
    return;
  }
  for (const entry of recentHistory) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-entry";
    const title = document.createElement("strong");
    title.textContent = entry.title || safeHost(entry.url);
    const url = document.createElement("span");
    url.textContent = entry.url;
    button.append(title, url);
    button.addEventListener("click", () => { closeTools(); navigate(entry.url); });
    list.append(button);
  }
}

function renderEngines() {
  const menu = $("#engineMenu");
  const choices = engines;
  menu.replaceChildren();
  for (const engine of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "engine-option";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(engine.id === selectedEngine.id));
    const icon = document.createElement("img");
    icon.alt = "";
    icon.src = faviconFor(`https://${engine.domain || safeHost(engine.template)}/`);
    const label = document.createElement("span");
    label.textContent = engine.name;
    button.append(icon, label);
    button.addEventListener("click", () => selectEngine(engine));
    menu.append(button);
  }
  updateEngineButton();
}

function updateEngineButton() {
  $("#engineLabel").textContent = selectedEngine.name;
  const icon = $("#engineIcon");
  icon.src = faviconFor(`https://${selectedEngine.domain || "duckduckgo.com"}/`);
  icon.alt = "";
}

function selectEngine(engine) {
  selectedEngine = engine;
  writeStorage(ENGINE_KEY, engine.id);
  updateEngineButton();
  setEngineMenu(false);
}

function setEngineMenu(open) {
  const menu = $("#engineMenu");
  menu.hidden = !open;
  if (open) {
    const bounds = $("#engineToggle").getBoundingClientRect();
    menu.style.maxHeight = `${Math.max(140, Math.min(420, window.innerHeight - bounds.bottom - 20))}px`;
  }
  $("#engineToggle").setAttribute("aria-expanded", String(open));
}

function closeTools() { $("#toolsPanel").hidden = true; }

function activeTab() { return tabs.find((tab) => tab.id === activeId) || null; }

function renderTabs() {
  tabsBar.querySelectorAll(".tab").forEach((tab) => tab.remove());
  const addButton = $("#newTab");
  for (const tab of tabs) {
    const item = document.createElement("div");
    item.className = `tab${tab.id === activeId ? " active" : ""}`;
    item.dataset.tab = String(tab.id);
    item.setAttribute("role", "group");
    item.setAttribute("aria-label", `${tab.title || (tab.url ? safeHost(tab.url) : "New tab")}${tab.id === activeId ? ", active" : ""}`);
    item.title = tab.url || "New tab";
    const icon = document.createElement("img");
    icon.className = "tab-favicon";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    icon.src = tab.url ? faviconFor(tab.url) : "/favicon.ico";
    icon.addEventListener("error", () => {
      icon.remove();
      const fallback = document.createElement("span");
      fallback.className = "tab-fallback-icon";
      fallback.textContent = tab.url ? safeHost(tab.url).slice(0, 1).toUpperCase() : "✦";
      item.querySelector(".tab-select")?.prepend(fallback);
    }, { once: true });
    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.title || (tab.url ? safeHost(tab.url) : "Aureus.");
    const select = document.createElement("button");
    select.type = "button";
    select.className = "tab-select";
    select.setAttribute("aria-label", `Switch to ${label.textContent}`);
    if (tab.id === activeId) select.setAttribute("aria-current", "page");
    select.append(icon, label);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "tab-close";
    close.setAttribute("aria-label", "Close tab");
    close.title = "Close tab";
    close.textContent = "×";
    item.append(select, close);
    tabsBar.insertBefore(item, addButton);
  }
  if (!restoringTabs) {
    writeStorage(SESSION_KEY, {
      activeId,
      tabs: tabs.map(({ id, url, title, history, historyIndex }) => ({ id, url, title, history: history.slice(-30), historyIndex }))
    });
  }
}

function safeHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, "") || "Aureus."; }
  catch { return "Aureus."; }
}

function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch { return "/favicon.ico"; }
}

function showTab(tab) {
  activeId = tab.id;
  address.value = tab.url || "";
  home.classList.toggle("hidden", Boolean(tab.url));
  viewer.classList.toggle("visible", Boolean(tab.url));
  loading.classList.toggle("active", Boolean(tab.loading));
  for (const item of tabs) {
    if (item.iframe) item.iframe.classList.toggle("active", item.id === tab.id);
  }
  $("#backBtn").disabled = !tab.url || tab.historyIndex <= 0;
  $("#forwardBtn").disabled = !tab.url || tab.historyIndex >= tab.history.length - 1;
  renderTabs();
  if (tab.url && !tab.iframe) navigate(tab.url, { recordHistory: false, preserveTitle: true });
}

function createTab(url = "") {
  const tab = { id: nextId++, url: "", title: "", iframe: null, history: [], historyIndex: -1, loading: false };
  tabs.push(tab);
  showTab(tab);
  if (url) navigate(url);
  else $("#searchInput").focus();
  return tab;
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  const [tab] = tabs.splice(index, 1);
  if (tab.iframe) {
    tab.iframe.src = "about:blank";
    tab.iframe.remove();
  }
  if (!tabs.length) { createTab(); return; }
  if (id === activeId) showTab(tabs[Math.min(index, tabs.length - 1)]);
  else renderTabs();
}

function normalizeAddress(raw) {
  const value = raw.trim();
  if (!value) return null;
  if (/^(https?:\/\/|about:blank)/i.test(value)) return value;
  if (/^(localhost|127(?:\.\d{1,3}){3})(:\d+)?([/?#]|$)/i.test(value)) return `http://${value}`;
  if (/^[\w-]+(?:\.[\w-]+)+(?:\:\d+)?(?:[/?#].*)?$/i.test(value)) return `https://${value}`;
  return selectedEngine.template.replaceAll("{query}", encodeURIComponent(value));
}

const proxyReady = (async () => {
  if (!("serviceWorker" in navigator)) throw new Error("This browser does not support service workers.");
  if (!window.__uv$config) throw new Error("Ultraviolet files did not load. Run the build command from the Aureus folder.");

  // Replace any previous root-scoped interception worker so UV owns proxy requests.
  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    const scope = new URL(registration.scope);
    const isRootScope = scope.origin === location.origin && scope.pathname === "/";
    if (isRootScope && !registration.active?.scriptURL.includes("/uv.sw.js")) {
      await registration.unregister();
    }
  }
  await navigator.serviceWorker.register("/uv.sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller || !navigator.serviceWorker.controller.scriptURL.includes("/uv.sw.js")) {
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; navigator.serviceWorker.removeEventListener("controllerchange", check); resolve(); } };
      const check = () => {
        if (navigator.serviceWorker.controller?.scriptURL.includes("/uv.sw.js")) finish();
      };
      navigator.serviceWorker.addEventListener("controllerchange", check);
      setTimeout(finish, 8000);
    });
  }

  const connection = new BareMuxConnection("/baremux/worker.js");
  // The WISP backend is deployed separately from this frontend.
  // Railway provides HTTPS, so its WebSocket endpoint uses WSS.
  const wispUrl = "wss://aureus-wisp-backend-production.up.railway.app/wisp/";
  await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
})();

async function navigate(raw, { recordHistory = true, preserveTitle = false } = {}) {
  const url = normalizeAddress(raw);
  if (!url) return;
  const tab = activeTab() || createTab();
  tab.url = url;
  if (!preserveTitle) tab.title = "";
  saveHistory(url);
  tab.loading = true;
  if (recordHistory) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(url);
    tab.historyIndex = tab.history.length - 1;
  }
  if (!tab.iframe) {
    tab.iframe = document.createElement("iframe");
    tab.iframe.title = "Proxied website";
    tab.iframe.referrerPolicy = "no-referrer";
    tab.iframe.allow = "fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; gamepad";
    tab.iframe.addEventListener("load", () => onFrameLoad(tab));
    viewer.appendChild(tab.iframe);
  }
  tab.iframe.classList.add("active");
  home.classList.add("hidden");
  viewer.classList.add("visible");
  address.value = url;
  loading.classList.add("active");
  renderTabs();
  syncNavButtons();
  try {
    await proxyReady;
    if (tab.id !== activeId || tab.url !== url) return;
    tab.iframe.src = `${window.__uv$config.prefix}${window.__uv$config.encodeUrl(url)}`;
  } catch (error) {
    tab.loading = false;
    if (tab.id === activeId) loading.classList.remove("active");
    showNotice(`Ultraviolet could not start: ${error.message}`);
    console.error("Ultraviolet initialization failed:", error);
  }
}

function onFrameLoad(tab) {
  tab.loading = false;
  try {
    const pageTitle = tab.iframe.contentDocument?.title?.trim();
    if (pageTitle && pageTitle.length < 100) {
      tab.title = pageTitle;
      saveHistory(tab.url, pageTitle);
      renderTabs();
    }
  } catch { /* Cross-origin page titles are optional. */ }
  if (tab.id !== activeId) return;
  loading.classList.remove("active");
  try {
    const current = new URL(tab.iframe.contentWindow.location.href);
    const config = window.__uv$config;
    if (current.origin === location.origin && current.pathname.startsWith(config.prefix)) {
      const encoded = current.pathname.slice(config.prefix.length).split("/")[0];
      const decoded = config.decodeUrl(encoded);
      if (decoded && decoded !== tab.url) {
        tab.url = decoded;
        tab.history = tab.history.slice(0, tab.historyIndex + 1);
        tab.history.push(decoded);
        tab.historyIndex = tab.history.length - 1;
        address.value = decoded;
        renderTabs();
      }
    }
  } catch { /* Cross-origin content cannot be inspected; keep the entered URL. */ }
  syncNavButtons();
}

function syncNavButtons() {
  const tab = activeTab();
  $("#backBtn").disabled = !tab || tab.historyIndex <= 0;
  $("#forwardBtn").disabled = !tab || tab.historyIndex >= tab.history.length - 1;
}

function goHistory(direction) {
  const tab = activeTab();
  if (!tab || !tab.iframe) return;
  const next = tab.historyIndex + direction;
  if (next < 0 || next >= tab.history.length) return;
  tab.historyIndex = next;
  const url = tab.history[next];
  tab.url = url;
  tab.loading = true;
  address.value = url;
  renderTabs();
  syncNavButtons();
  loading.classList.add("active");
  proxyReady.then(() => {
    tab.iframe.src = `${window.__uv$config.prefix}${window.__uv$config.encodeUrl(url)}`;
  }).catch((error) => showNotice(error.message));
}

function goHome() {
  const tab = activeTab();
  if (!tab) return;
  tab.url = "";
  tab.title = "";
  tab.loading = false;
  tab.history = [];
  tab.historyIndex = -1;
  if (tab.iframe) { tab.iframe.src = "about:blank"; tab.iframe.classList.remove("active"); }
  address.value = "";
  home.classList.remove("hidden");
  viewer.classList.remove("visible");
  renderTabs();
  syncNavButtons();
  $("#searchInput").focus();
}

$("#addressForm").addEventListener("submit", (event) => { event.preventDefault(); navigate(address.value); });
$("#homeSearch").addEventListener("submit", (event) => { event.preventDefault(); navigate($("#searchInput").value); });
$("#homeBtn").addEventListener("click", goHome);
$("#backBtn").addEventListener("click", () => goHistory(-1));
$("#forwardBtn").addEventListener("click", () => goHistory(1));
$("#reloadBtn").addEventListener("click", () => {
  const tab = activeTab();
  if (tab?.url && tab.iframe) { tab.loading = true; loading.classList.add("active"); tab.iframe.src = tab.iframe.src; }
});
$("#newTab").addEventListener("click", () => createTab());
$("#fullscreenBtn").addEventListener("click", async () => {
  const tab = activeTab();
  if (!tab?.iframe) { showNotice("Open a page first to use fullscreen."); return; }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await tab.iframe.requestFullscreen();
  } catch { showNotice("Fullscreen was blocked by this browser."); }
});

tabsBar.addEventListener("click", (event) => {
  if (event.target.closest("#newTab")) return;
  const button = event.target.closest(".tab");
  if (!button) return;
  const id = Number(button.dataset.tab);
  if (event.target.closest(".tab-close")) { closeTab(id); return; }
  const tab = tabs.find((item) => item.id === id);
  if (tab) showTab(tab);
});

document.querySelectorAll(".quick-app[data-url]").forEach((button, index) => {
  button.style.setProperty("--i", String(index));
  button.addEventListener("click", () => navigate(button.dataset.url));
});

function updateInspector() {
  const tab = activeTab();
  const output = $("#inspectOutput");
  if (!tab?.iframe || !tab.url) { output.textContent = "Open a page to inspect its document."; return; }
  try {
    const source = tab.iframe.contentDocument?.documentElement?.outerHTML;
    output.textContent = source ? source.slice(0, 40000) + (source.length > 40000 ? "\n\n… preview truncated at 40,000 characters" : "") : "The page does not expose its document to the inspector.";
  } catch { output.textContent = "This page blocks document inspection."; }
}

$("#engineToggle").addEventListener("click", () => setEngineMenu($("#engineMenu").hidden));
document.addEventListener("click", (event) => {
  if (!event.target.closest(".engine-picker")) setEngineMenu(false);
});
$("#moreBtn").addEventListener("click", () => {
  const panel = $("#toolsPanel");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    $("#toolsTitle").textContent = "History";
    $("#historyList").hidden = false;
    $("#inspectView").hidden = true;
    document.querySelectorAll(".tool-tab").forEach((item) => item.classList.toggle("active", item.dataset.tool === "history"));
  }
});
$("#closeTools").addEventListener("click", closeTools);
document.querySelectorAll(".tool-tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tool-tab").forEach((item) => item.classList.toggle("active", item === button));
  const inspect = button.dataset.tool === "inspect";
  $("#toolsTitle").textContent = inspect ? "Inspect page" : "History";
  $("#historyList").hidden = inspect;
  $("#inspectView").hidden = !inspect;
  if (inspect) updateInspector();
}));
renderHistory();
renderEngines();

document.addEventListener("keydown", (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === "t") { event.preventDefault(); createTab(); }
  if (modifier && event.key.toLowerCase() === "w") { event.preventDefault(); closeTab(activeId); }
  if (modifier && event.key.toLowerCase() === "l") { event.preventDefault(); address.focus(); address.select(); }
  if (modifier && event.key.toLowerCase() === "r") { event.preventDefault(); $("#reloadBtn").click(); }
  if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); goHistory(-1); }
  if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); goHistory(1); }
  if (modifier && event.key === "Tab" && tabs.length > 1) {
    event.preventDefault();
    const current = tabs.findIndex((tab) => tab.id === activeId);
    const step = event.shiftKey ? -1 : 1;
    showTab(tabs[(current + step + tabs.length) % tabs.length]);
  }
});

const savedSession = readStorage(SESSION_KEY, null);
if (Array.isArray(savedSession?.tabs) && savedSession.tabs.length) {
  for (const saved of savedSession.tabs.slice(0, 12)) {
    const url = typeof saved.url === "string" && /^https?:\/\//i.test(saved.url) ? saved.url : "";
    const history = Array.isArray(saved.history) ? saved.history.filter((item) => typeof item === "string" && /^https?:\/\//i.test(item)).slice(-30) : [];
    const id = Number.isInteger(saved.id) && saved.id > 0 ? saved.id : nextId;
    const historyIndex = Number.isInteger(saved.historyIndex) ? Math.max(-1, Math.min(saved.historyIndex, history.length - 1)) : -1;
    tabs.push({ id, url, title: typeof saved.title === "string" ? saved.title.slice(0, 100) : "", iframe: null, history, historyIndex, loading: false });
    nextId = Math.max(nextId, id + 1);
  }
  activeId = tabs.some((tab) => tab.id === savedSession.activeId) ? savedSession.activeId : tabs[0].id;
}
restoringTabs = false;
if (tabs.length) {
  const tab = activeTab();
  showTab(tab);
  if (!tab.url) $("#searchInput").focus();
} else createTab();
proxyReady.catch((error) => {
  console.error("Ultraviolet initialization failed:", error);
  showNotice(`Proxy setup needs attention: ${error.message}`);
});

