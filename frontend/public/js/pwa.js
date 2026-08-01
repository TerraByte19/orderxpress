/* Macht OrderXpress zur installierbaren App (PWA).
 *
 * - Verlinkt das Manifest und die App-Icons und setzt die noetigen Meta-Tags,
 *   damit sich die Seite auf Handy/Tablet "zum Startbildschirm hinzufuegen"
 *   und auf dem PC (Chrome/Edge) als eigenes Fenster installieren laesst.
 * - Registriert den Service Worker (Voraussetzung fuer die Installation).
 *
 * Wird frueh im <head> eingebunden, damit die Tags schon beim Anzeigen da sind.
 */
(function () {
    var tags = [
        '<link rel="manifest" href="/manifest.webmanifest">',
        '<meta name="theme-color" content="#111827">',
        '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
        '<meta name="apple-mobile-web-app-capable" content="yes">',
        '<meta name="mobile-web-app-capable" content="yes">',
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
        '<meta name="apple-mobile-web-app-title" content="OrderXpress">'
    ];
    document.head.insertAdjacentHTML("beforeend", tags.join(""));

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register("/service-worker.js").catch(function () { /* egal, App laeuft trotzdem */ });
        });
    }
})();
