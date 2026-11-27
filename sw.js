// Offline-Hülle: alles aus dem Cache, nichts aus dem Netz außer beim ersten Laden und bei neuer Version.
// Bei jeder Änderung an den Dateien VERSION erhöhen (der Test prüft die Dateiliste).
const VERSION = "atelier-v3";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "src/app.js",
  "src/validate.js",
  "src/scan.js",
  "src/zip.js",
  "src/template.js",
  "src/bundle.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  // cache: "reload" umgeht den HTTP-Cache (GitHub Pages liefert max-age=600): sonst landen veraltete Dateien im neuen Cache.
  const fresh = (u) => new Request(u, { cache: "reload" });
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map(fresh))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
