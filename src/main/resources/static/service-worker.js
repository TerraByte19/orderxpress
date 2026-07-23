/* OrderXpress Service Worker - macht die App installierbar und offline-tauglich.
 *
 * Strategie:
 *  - /api/**  : NICHT anfassen -> immer frisch aus dem Netz (Bestellungen, Status).
 *  - Rest (HTML/CSS/JS/Icons): "network-first" -> online immer aktuell, offline aus
 *    dem Cache. So gibt es keine veralteten Dateien, die App startet aber auch ohne
 *    Netz (z.B. kurzer WLAN-Aussetzer im Laden).
 */
const CACHE = "ox-shell-v1";

const SHELL = [
    "/", "/index.html",
    "/css/app.css",
    "/js/api.js", "/js/pwa.js",
    "/admin.html", "/js/admin.js",
    "/service.html", "/js/service.js",
    "/kitchen.html", "/js/kitchen.js",
    "/waiter.html", "/js/waiter.js",
    "/stats.html", "/js/stats.js",
    "/guest.html", "/js/guest.js",
    "/device.html", "/js/device.js",
    "/platform.html", "/js/platform.js",
    "/icons/icon-192.png", "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
    // Einzelne Fehler (falls eine Datei fehlt) sollen die Installation NICHT abbrechen.
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;                 // nur GET; POST/PUT/DELETE nie cachen

    const url = new URL(req.url);
    if (url.origin !== location.origin) return;       // fremde Hosts nicht anfassen
    if (url.pathname.startsWith("/api/")) return;     // Daten immer frisch aus dem Netz

    // network-first: online aktuell, offline aus dem Cache
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req).then((cached) => cached || caches.match("/index.html")))
    );
});
