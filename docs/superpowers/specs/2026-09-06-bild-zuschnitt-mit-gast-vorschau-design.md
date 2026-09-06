# Bild-Zuschnitt mit echter Gast-Vorschau

**Datum:** 2026-09-06
**Status:** Entwurf, vom Nutzer freigegeben

## Ziel

Vor jedem Bild-Upload im Inhaber-Bereich von OrderXpress ein Zuschnitt-Schritt
im WhatsApp-Stil (Bild ziehen + zoomen, sichtbarer Ausschnitt wird
uebernommen). Die Vorschau zeigt dabei **die echte Gaeste-Ansicht**: das Bild
erscheint live an genau der Stelle, an der der Gast es spaeter sieht
(Hero-Band mit Abdunkel-Verlauf + Logo + Laden-Name, echte Gericht-Karte,
Galerie-Streifen). Umsetzung ueber ein eingebettetes `<iframe>` der echten
Gaeste-Seite in einem neuen Vorschau-Modus; das Kandidaten-Bild wird per
`postMessage` live hineingereicht und erst bei "Uebernehmen" hochgeladen.

## Betroffene Bild-Stellen (alle im Inhaber-Bereich)

| Bild | Gast-Anzeige heute | Zuschnitt-Form | Ausgabe |
|---|---|---|---|
| Laden-Logo | Kopfzeile `#brand-logo` (`object-fit:contain`, 32px hoch) **und** Hero-Band `.ox-hero__logo` (56x56, `border-radius:pill`, `object-fit:cover`) | Kreis 1:1 | 600px |
| Hintergrundbild | Hero-Band `#menu-hero` / `.ox-hero--bild`, Verlauf `linear-gradient(to top, rgba(0,0,0,.68), transparent 65%)` drüber; **kein** Vollseiten-Hintergrund | breites Rechteck, 5:2 | 1500x600 |
| Gericht-Foto | Karten-Thumbnail `.ox-gericht__bild` (84x84, `object-fit:cover`) + Detail-Overlay | Quadrat 1:1 | 900px |
| Galerie-Bild | Streifen `#menu-gallery` unter der Speisekarte | breites Rechteck, 3:2 | 1200x800 |

Newsletter/andere: es gibt in OrderXpress keine weiteren Bild-Uploads.

## Backend

**Keine Aenderung.** Die bestehenden Endpunkte bleiben unveraendert:

- `POST /api/admin/design/logo` (`MultipartFile file`)
- `POST /api/admin/design/background` (`MultipartFile file`)
- `POST /api/admin/menu-items/{id}/image` (`MultipartFile file`)
- `POST /api/admin/gallery` (`MultipartFile file`)

Die serverseitige Verkleinerung (`MenuImageService` 1000px, `RestaurantAdminService`
Logo 600 / Hintergrund 1600) laeuft danach wie bisher auf dem zugeschnittenen
PNG. Die Vorschau nutzt die vorhandenen **oeffentlichen** Gast-Endpunkte:

- `GET /api/guest/theme/{restaurantId}`
- `GET /api/guest/menu/{restaurantId}`
- `GET /api/guest/restaurants/{restaurantId}/gallery`

## Komponente 1: `bildcropper.js` (Vanilla-Widget)

**Ort:** `frontend/public/js/bildcropper.js`. Eingebunden per `<script>` in
`frontend/admin.html` und `frontend/menu-editor.html` (nach `api.js`). Setzt
`window.OX.oeffneCropper`.

Warum vanilla + global: `admin.js` ist altes Nicht-Modul-JS und kann nicht aus
`frontend/src/` importieren; der TS-Menue-Editor kann den Globalwert per
`declare` mitbenutzen. So eine Implementierung statt zwei.

### API

```js
OX.oeffneCropper({
  datei,        // File aus <input type="file">
  form,         // "kreis" | "quadrat" | "breit"
  ratio,        // Zahl B/H, nur bei form "breit" (z.B. 2.5 fuer 5:2)
  ausgabe,      // Ausgabe-Breite in px
  fokus,        // "logo" | "background" | "gericht:<id>" | "galerie"  -> iframe-Param
  restaurantId, // fuer die iframe-URL
  onFertig,     // (blob: Blob) => void   -- PNG des Ausschnitts
  onAbbrechen,  // () => void
});
```

### Aufbau

Vollflaechiger modaler Overlay (`position:fixed`, `z-index` ueber allem),
dunkler Hintergrund. Innen zwei Bereiche:

1. **Zuschnitt-Feld** (`<canvas>`): das geladene Bild, per Pointer-Events
   (Maus + Touch vereint) verschiebbar, per Regler / Mausrad / 2-Finger-Pinch
   zoombar. Form-Maske (Kreis / Quadrat / breites Rechteck) als sichtbare
   Umrandung wie bei Stampits `BildCropper`.
2. **`<iframe>`** mit `src = "/guest.html?vorschau=1&restaurant=<id>&fokus=<fokus>"`.
   Zeigt die echte Gaeste-Seite. Auf Handy gestapelt (Feld oben, iframe
   darunter, iframe scrollbar); auf breitem Schirm nebeneinander.

Knoepfe: **Abbrechen** (ruft `onAbbrechen`, schliesst) und **Uebernehmen**
(schneidet zu, ruft `onFertig(blob)`, schliesst).

### Zuschnitt-Mathematik (wie Stampit `BildCropper`)

- `minSkala = max(maskeBreite/bildBreite, maskeHoehe/bildHoehe)` ("cover" -
  die Maske ist immer voll vom Bild bedeckt).
- `maxSkala = minSkala * 4`.
- Verschiebung begrenzt: `|versatzX| <= (bildBreite*skala - maskeBreite)/2`,
  analog Y.
- "Uebernehmen": Ausgabe-Canvas `ausgabe` x `ausgabe/ratio` (bei Kreis/Quadrat
  `ratio=1`), `faktor = ausgabeBreite / maskeBreiteCss`, Bild an
  `mitte +/- versatz*faktor` zeichnen; bei Kreis vorher kreisfoermig
  `clip()`. `canvas.toBlob(..., "image/png")`.

### Live-Vorschau ins iframe

Bei jeder Aenderung (verschieben, zoomen), gedrosselt auf ~1x/80ms:

```js
iframe.contentWindow.postMessage(
  { typ: "ox-vorschau", ziel: fokusZiel, dataUrl: aktuellerAusschnittAlsDataUrl },
  window.location.origin
);
```

`fokusZiel` = `"logo"` | `"background"` | `"gericht"` (mit separatem
`gerichtId`) | `"galerie"`. Der Ausschnitt fuer die Vorschau wird in kleiner
Aufloesung (z.B. 400px) erzeugt, damit das Nachzeichnen fluessig bleibt; erst
"Uebernehmen" rendert in voller `ausgabe`.

### Rueckfall ohne iframe

Laedt das iframe nicht (Timeout 4s ohne `ox-vorschau-bereit`-Antwort) oder
schlaegt der Vorschau-Modus fehl, wird der iframe-Bereich ausgeblendet und nur
das Zuschnitt-Feld gezeigt. Das Widget bleibt voll funktionsfaehig.

## Komponente 2: Gaeste-Seite - Vorschau-Modus

**Datei:** `frontend/src/pages/guest/index.ts` (Einstieg `starte()`), plus ein
kleiner Nachrichten-Handler in `frontend/src/pages/guest/laden-design.ts`.

### Aktivierung

`starte()` liest `URLSearchParams`. Bei `vorschau=1`:

- **Kein** `leseQrToken` / `scanne` / `starteStatusAbfrage` / `starteLiveDatenTakt`.
- `restaurantId` aus `restaurant`-Param (Pflicht; fehlt er -> `zeigeFehler`).
- Direkt: `ladeTheme(restaurantId)` -> `wendeThemeAn`, `ladeSpeisekarte(restaurantId)`
  -> `zeichneSpeisekarte`, `zeigeGalerie(restaurantId)`.
- `zeigeAnsichtInhalt("menu")` (view-menu) sofort, ohne Vorhang
  (`zeigeVorhang` ueberspringen - im iframe stoert die Intro-Animation).
- `setzeBestellenErlaubt(false)` dauerhaft; Namensleiste, Warenkorb-Leiste
  (`#cartbar`), "Kellner rufen", Beitritts-Banner, Bestellungen-/Rechnung-
  Knoepfe bleiben verborgen. Detail-Overlay eines Gerichts darf sich oeffnen
  (nur ansehen), aber ohne "Hinzufuegen"-Knopf.
- `document.documentElement.dataset.vorschau = "1"` setzen; `guest.css` blendet
  darueber alle Bestell-Bedienelemente aus (ein Regelblock), damit nichts
  durch Timing-Luecken kurz aufblitzt.

### Nachrichten-Handler

`window.addEventListener("message", ...)`, nur aktiv wenn `vorschau=1`, nur
`event.origin === window.location.origin`, nur `data.typ === "ox-vorschau"`:

| `data.ziel` | Wirkung |
|---|---|
| `"logo"` | `#brand-logo.src` und `#hero-logo.src` (bzw. `.ox-hero__logo`) auf `data.dataUrl`, `hidden=false` |
| `"background"` | `#menu-hero.style.backgroundImage = url(data.dataUrl)`, Klasse `ox-hero--bild` setzen |
| `"gericht"` | `.ox-gericht__bild` des Gerichts mit `data.gerichtId` -> `src = data.dataUrl` (bzw. `--leer`-Platzhalter durch `<img>` ersetzen) |
| `"galerie"` | erstes `#menu-gallery img` -> `src = data.dataUrl`; ist die Galerie leer, ein `<img>` einfuegen |

Beim Empfang der ersten Nachricht schickt der Gast einmal
`parent.postMessage({ typ: "ox-vorschau-bereit" }, origin)` zurueck (fuer den
Rueckfall-Timeout des Widgets). Besser: direkt nach dem Rendern von
`view-menu` senden.

### `fokus`-Param

Nach dem Rendern: Element zu `fokus` (`#brand-logo` / `#menu-hero` /
`[data-gericht-id="<id>"]` / `#menu-gallery`) mit `scrollIntoView({block:"center"})`
und kurz (1.2s) eine Hervorhebungs-Klasse (`ox-vorschau-fokus`, weicher
Rahmen-Puls, respektiert `prefers-reduced-motion`).

## Komponente 3: Einhaengen in die Upload-Stellen

### `frontend/public/js/admin.js`

Drei Stellen (Logo ~Zeile 656, Hintergrund, Galerie ~Zeile 706). Muster
heute: verstecktes `<input type="file">`, `onchange` baut `FormData` und
`fetch`t direkt. Neu:

```js
input.onchange = (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  OX.oeffneCropper({
    datei: f, form: "kreis", ausgabe: 600,
    fokus: "logo", restaurantId: Admin.restaurantId,
    onFertig: async (blob) => {
      const fd = new FormData();
      fd.append("file", blob, "logo.png");
      await fetch("/api/admin/design/logo", { method: "POST", headers: OX.authHeader(), body: fd });
      Admin.loadDesign();   // bzw. was heute nach dem Upload passiert
    },
  });
};
```

- Logo: `form:"kreis"`, `ausgabe:600`, `fokus:"logo"`.
- Hintergrund: `form:"breit"`, `ratio:2.5`, `ausgabe:1500`, `fokus:"background"`.
- Galerie: `form:"breit"`, `ratio:1.5`, `ausgabe:1200`, `fokus:"galerie"`;
  bei Mehrfachauswahl die Dateien nacheinander durch den Cropper (Schleife,
  jede erst nach `onFertig` der vorigen).

`Admin.restaurantId` kommt aus dem bereits vorhandenen `/api/me`-Aufruf; falls
nicht gespeichert, dort ergaenzen.

### `frontend/src/pages/menu-editor/` (Gericht-Foto)

`sheet.ts` oeffnet heute den Datei-Dialog und ruft `api.ts`
`bildHochladen(id, file)`. Neu: dazwischen den globalen Cropper. Typ-Deklaration
in einer `.d.ts` oder oben in `sheet.ts`:

```ts
declare global {
  interface Window { OX: { oeffneCropper(o: CropperOpts): void; authHeader(): Record<string,string> } }
}
```

Aufruf: `form:"quadrat"`, `ausgabe:900`, `fokus:"gericht:" + gerichtId`,
`restaurantId` aus dem Editor-Zustand. `onFertig(blob)` ->
`bildHochladen(id, new File([blob], "foto.png", { type: "image/png" }))` ->
bestehendes Neu-Laden/Live-Vorschau des Editors.

`menu-editor.html` bindet `bildcropper.js` per `<script>` ein (wie `admin.html`).

## Datenfluss (Zusammenfassung)

1. Inhaber waehlt Datei -> `OX.oeffneCropper(...)`.
2. Dialog offen: `<canvas>` mit Bild + `<iframe src=guest.html?vorschau=1&...>`.
3. iframe: Gast-Vorschau-Modus rendert Theme + Menue + Galerie (oeffentliche
   Endpunkte), meldet `ox-vorschau-bereit`.
4. Inhaber zieht/zoomt -> gedrosselt `postMessage({typ:"ox-vorschau", ziel, dataUrl})`
   -> iframe tauscht das Bild an der echten Stelle.
5. "Uebernehmen" -> `toBlob` in voller Aufloesung -> `onFertig(blob)`.
6. Aufrufer: `FormData` POST an den bestehenden Endpunkt -> Erfolg -> Liste/
   Design neu laden.
7. "Abbrechen" -> nichts gespeichert.

## Fehlerfaelle

- **iframe laedt nicht / kein `ox-vorschau-bereit` in 4s** -> iframe-Bereich
  ausblenden, nur Zuschnitt-Feld (Widget voll nutzbar).
- **Vorschau-Endpunkt liefert Fehler** (z.B. Menue leer) -> Gast zeigt im
  iframe seinen normalen leeren/Fehlerzustand; Widget stoert das nicht.
- **Upload schlaegt fehl** -> bestehende Fehlerbehandlung des Aufrufers
  (`admin.js` Toast / Editor-Fehler), Dialog ist bereits geschlossen; der
  Inhaber waehlt erneut. (Kein Sonderpfad noetig.)
- **`postMessage` von fremder Origin** -> Handler ignoriert (Origin-Pruefung).
- **Bild zu gross / kein Bild** -> `Image.onerror` -> `onAbbrechen`, kurzer Hinweis.

## Sicherheit

- Vorschau-Modus nutzt nur oeffentliche `GET /api/guest/*`-Endpunkte; kein
  Auth-Token im iframe.
- Ein Inhaber kann im `restaurant`-Param jede ID setzen und so JEDES Menue in
  der Vorschau sehen - aber genau das kann heute schon jeder ueber die
  oeffentlichen Endpunkte. Kein neuer Informationsabfluss.
- `postMessage` strikt auf `window.location.origin` beschraenkt (senden und
  empfangen).
- Der Vorschau-Modus schaltet Bestellen serverseitig NICHT frei (kein
  guestToken); selbst wenn die UI-Sperre umgangen wird, lehnt das Backend ab.

## Tests

**Vanilla-Widget (`frontend/public/js/bildcropper.js`)** - als Unit-Test mit
jsdom in `frontend/src/pages/.../bildcropper.test.ts` oder eigenem Ordner:
- `minSkala`/`maxSkala` fuer gegebene Bild- und Maskengroessen.
- Verschiebungs-Begrenzung: Versatz wird auf den erlaubten Rahmen geklemmt.
- Ausgabe-Canvas: Groesse = `ausgabe` x `ausgabe/ratio`; bei `form:"kreis"`
  sind die Ecken transparent (Alpha 0 an einer Ecke, >0 in der Mitte).
- `postMessage` wird bei einer Aenderung mit `{typ:"ox-vorschau", ziel}`
  aufgerufen (Spy auf `iframe.contentWindow.postMessage`).

**Gast-Vorschau-Modus (`frontend/src/pages/guest/index.test.ts` bzw.
`laden-design.test.ts`)**:
- `?vorschau=1&restaurant=7` -> `scanne` wird NICHT aufgerufen, `ladeTheme(7)`
  und `ladeSpeisekarte(7)` schon, `view-menu` ist sichtbar, `#cartbar` bleibt
  verborgen, `setzeBestellenErlaubt(false)`.
- Nachricht `{typ:"ox-vorschau", ziel:"logo", dataUrl:"data:..."}` von eigener
  Origin -> `#brand-logo.src` gesetzt; von fremder Origin -> ignoriert.
- `ziel:"gericht"` mit `gerichtId` -> nur die `.ox-gericht__bild` dieses
  Gerichts geaendert.

**Kein** echter iframe-/Browser-Test (jsdom kann kein echtes iframe laden);
der Nachrichten-Handler wird isoliert getestet.

## Nicht im Umfang

- Keine Aenderung an Backend-Endpunkten oder an der serverseitigen
  Bildverarbeitung.
- Kein Zuschnitt fuer Bilder, die es in OrderXpress nicht gibt.
- Kein Mehrfach-Zuschnitt-Editor mit Verlauf/Rueckgaengig - ein Bild, ein
  Ausschnitt, wie bei Stampit.
- Keine Portierung des Croppers auf ein TS-Komponenten-Design (bewusst
  vanilla + global, damit `admin.js` ihn ohne Umbau nutzen kann).
