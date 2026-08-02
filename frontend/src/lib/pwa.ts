/* Meldet den Service Worker an. Manifest und Meta-Tags stehen direkt im
 * HTML jeder Seite - das frueher noetige Nachtragen per JavaScript entfaellt.
 *
 * Die Gaeste-Seite ruft das bewusst NICHT auf: Gaeste sollen die App nicht
 * installieren, sie scannen nur den QR-Code und bestellen im Browser. */
export function registriereServiceWorker(): void {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
        void navigator.serviceWorker.register("/service-worker.js").catch(() => {
            /* ohne Service Worker laeuft die App trotzdem */
        });
    });
}
