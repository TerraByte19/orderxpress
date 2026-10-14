/* Laden-Design der Personal-Ansichten SOFORT setzen, vor dem ersten Malen.

   Ohne das malte jede Seite (Inhaber, Statistik, Service, Kueche, Kellner)
   zuerst mit dem festen Standard aus app.css (dunkelgruen #1f3d34, eckig,
   hell) und wechselte erst nach zwei Netz-Runden (/api/me -> /api/guest/theme)
   auf die Laden-Farben - bei JEDEM Wechsel zwischen den Ansichten blitzte
   kurz die alte Farbe auf.

   OX.applyLadenTheme() (api.js) schreibt nach jedem Anwenden den FERTIGEN
   Zustand von <html> unter "ox-personal-design" weg; dieses Skript spielt ihn
   nur zurueck. Bewusst der fertige Zustand und nicht das Theme - sonst stuende
   die Kontrast-Rechnung ein zweites Mal hier (gleiches Muster wie guest.html).

   Muss als blockierendes Skript im <head> stehen, NACH app.css. */
(function () {
    try {
        var stand = JSON.parse(localStorage.getItem("ox-personal-design") || "null");
        if (!stand) return;
        var wurzel = document.documentElement;
        if (stand.stil) wurzel.style.cssText = stand.stil;
        if (stand.dunkel) wurzel.setAttribute("data-theme", "dark");
        if (stand.fontHref) {
            var link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = stand.fontHref;
            document.head.appendChild(link);
        }
    } catch (e) { /* kein Speicher / kaputter Eintrag - dann eben Standard-Optik */ }
})();
