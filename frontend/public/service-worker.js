/* OrderXpress Service Worker - macht die App installierbar und offline-tauglich.
 *
 * Strategie:
 *  - /api/**  : NICHT anfassen -> immer frisch aus dem Netz (Bestellungen, Status).
 *  - Rest     : "network-first" -> online immer aktuell, offline aus dem Cache.
 *
 * Beim Installieren werden NUR die HTML-Seiten vorgeladen. Deren Namen sind
 * fest; alles andere (JavaScript, CSS, Schriften) traegt seit dem Umstieg auf
 * Vite eine Pruefsumme im Namen und kann hier gar nicht aufgezaehlt werden.
 * Diese Dateien landen beim ersten Aufruf von selbst im Cache - dafuer sorgt
 * der fetch-Abschnitt weiter unten.
 *
 * Die Gaeste-Seite fehlt bewusst: Gaeste sollen die App nicht installieren,
 * sie scannen den QR-Code und bestellen im Browser. */
const CACHE = "ox-shell-v2";

const SEITEN = [
    "/", "/index.html",
    "/admin.html", "/service.html", "/kitchen.html",
    "/waiter.html", "/stats.html", "/device.html", "/platform.html"
];

self.addEventListener("install", (event) => {
    // Einzelne Fehler duerfen die Installation NICHT abbrechen.
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => Promise.allSettled(SEITEN.map((pfad) => cache.add(pfad))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    // Alte Cache-Staende (auch ox-shell-v1) wegwerfen
    event.waitUntil(
        caches.keys()
            .then((namen) => Promise.all(
                namen.filter((name) => name !== CACHE).map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const anfrage = event.request;
    if (anfrage.method !== "GET") return;              // POST/PUT/DELETE nie cachen

    const adresse = new URL(anfrage.url);
    if (adresse.origin !== location.origin) return;    // fremde Hosts nicht anfassen
    if (adresse.pathname.startsWith("/api/")) return;  // Daten immer frisch aus dem Netz

    // network-first: online aktuell, offline aus dem Cache.
    // Erfolgreiche Antworten werden mitgeschrieben - so landen auch die
    // Dateien mit Pruefsumme im Namen automatisch im Cache.
    event.respondWith(
        fetch(anfrage)
            .then((antwort) => {
                if (antwort && antwort.ok) {
                    const kopie = antwort.clone();
                    caches.open(CACHE).then((cache) => cache.put(anfrage, kopie));
                }
                return antwort;
            })
            .catch(() => caches.match(anfrage).then((zwischengespeichert) =>
                zwischengespeichert || caches.match("/index.html")
            ))
    );
});
