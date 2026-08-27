# Gäste-Seite: Bewegung + Laden-Stile — Design-Dokument

**Datum:** 27.08.2026
**Status:** Abgenommen (Grundrichtung), Umsetzungsplan folgt
**Vorläufer:** `2026-08-01-frontend-redesign-design.md` (Gäste-Seite wurde damit
bereits auf Vite/TypeScript + Design-System umgebaut). Dieses Dokument baut darauf
auf und ändert nur die Gäste-Seite plus vier neue Design-Felder.

## 1. Anlass

Die neu gebaute Gäste-Seite ist funktional vollständig, wirkt aber statisch und
„nach Vorlage" (Standard-Serif auf hellem Papier — genau einer der drei Looks, um
die sich generierte Gestaltung häufig sammelt). Gewünscht: deutlich mehr Bewegung
und eine Optik, die der Laden selbst in mehrere klar unterschiedliche Richtungen
drehen kann.

Ein interaktives Muster (`guest-prototype.html`, im Arbeitsverzeichnis der
Sitzung, nicht eingecheckt) wurde gebaut, gemeinsam durchgesehen und Element für
Element abgestimmt. Dieses Dokument hält das Ergebnis fest.

## 2. Getroffene Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Umfang | Nur Gäste-Seite + 4 Design-Felder | Küche/Kasse/Kellner/Inhaber bleiben unangetastet; kleinstmögliche Angriffsfläche |
| Bewegungsmenge | Viel, aber als eine zusammenhängende Idee | Verstreute Effekte lesen sich „generiert"; eine physische Metapher (Papier/Bon) trägt viel Bewegung, ohne beliebig zu wirken |
| Wiedererkennung | Der Warenkorb **ist** ein Kassenbon | Knüpft an den echten ESC/POS-Ausdruck an, den jeder OX-Laden ohnehin hat — überlebt jede Farb-/Form-Einstellung des Ladens |
| Konfigurierbarkeit | Vier neue Optionen pro Laden | Ausdrücklich so gewünscht: „lass alles so, dass man sich das selber aussuchen kann" |
| Barrierefreiheit | `prefers-reduced-motion` schaltet **alle** Animationen ab | Nicht verhandelbar; ist der Sicherheitsschalter für die vielen Effekte |
| Schriften | Weiter selbst gehostet (`@fontsource`) | CSP eng halten, PWA offline-fähig — Vorgabe aus dem Vorläufer-Dokument |
| Backend-Muster | Vier **nullable** Spalten an `Restaurant` | Wie `darkMode` / `kitchenDisplayEnabled`: `ddl-auto: update` reicht, **kein DB-Reset** |

### Bewusst nicht im Umfang

- Keine Migration von Admin/Küche/Kasse/Kellner/Statistik auf das neue System —
  die vier Auswahlfelder werden in die **bestehende** (noch alte) Design-Karte in
  `admin.html` / `frontend/public/js/admin.js` eingehängt.
- Keine neuen fachlichen Funktionen (keine Bezahlung, keine Reservierung).
- Keine Chart-Bibliothek, kein React/SPA-Umbau.
- Kein zusätzlicher Netzwerk-Takt auf der Gäste-Seite — alle Live-Effekte hängen
  sich an die bestehende 3-Sekunden-Status-Abfrage bzw. an SSE.

## 3. Laden-Optionen im Detail

Vier Felder, jeweils Enum als String-Spalte, **nullable**, `null` = Standardwert.

| Feld (`Restaurant`) | Werte | `null` gilt als | Wirkung auf der Gäste-Seite |
|---|---|---|---|
| `styleShape` | `SQUARE`, `SOFT` | `SQUARE` | setzt `--ox-radius-*` und die Kartenkanten: eckig (8 px) vs. weich (18 px). Rein geometrisch — Farben bleiben bei der bestehenden Akzent-/Hell-Dunkel-Logik. |
| `displayFont` | `BRICOLAGE`, `FRAUNCES`, `SPACE_GROTESK`, `INSTRUMENT_SERIF` | `BRICOLAGE` | setzt nur `--ox-font-display` (Gerichtnamen, Überschriften). Fließtext bleibt Instrument Sans, Zahlen bleiben IBM Plex Mono. |
| `cartFlyStyle` | `PLUS`, `PHOTO` | `PLUS` | Was beim Hinzufügen zum Bon-Zähler fliegt: ein „+1"-Chip oder ein rundes Gericht-Foto (fällt ohne Foto automatisch auf „+1" zurück). |
| `orderConfirmStyle` | `STAMP`, `CHECK` | `CHECK` | Bestätigung nach „Jetzt bestellen": roter „ANGENOMMEN"-Stempel (dreht sich rein) oder grüner Haken (zeichnet sich). Danach in beiden Fällen: der Bon fliegt nach oben „zur Küche" weg. |

Alle vier kommen zusätzlich zur bereits bestehenden Laden-Anpassung:
Akzentfarbe, Hell/Dunkel, Logo, Hintergrundbild, Kategorien-als-Hamburger.

**OX-Standard** (wenn der Laden nichts einstellt): eckig · Bricolage · „+1" · Haken.

### Wie die Achsen zusammenspielen

`styleShape` und `displayFont` sind **unabhängig** — jede Kombination ist erlaubt
(weiche Karten mit Grotesk, eckige Karten mit Serif …). Im CSS überlagern sich
drei Ebenen auf `<html>`, in dieser Reihenfolge (letzte gewinnt bei gleicher
Spezifität):

1. Grundpalette + Standard-Tokens (`tokens.css`)
2. `[data-theme="dark"]` — dunkle Haut (bestehend)
3. `[data-shape="soft"]` — überschreibt `--ox-radius-*`
4. `[data-font="fraunces|space|iserif"]` — überschreibt `--ox-font-display`
5. `theme.ts` setzt `--ox-accent` / `--ox-bg` als Inline-Variablen (bestehend)

`cartFlyStyle` und `orderConfirmStyle` sind kein CSS, sondern Modul-Zustand:
`laden-design.ts` liest sie aus dem Theme-Endpunkt und gibt sie an `cart.ts`
weiter.

## 4. Animations-Inventar

Alle Werte als Richtwert; die genauen Kurven kommen als Tokens in `tokens.css`
(`--ox-ease-out`, `--ox-ease-spring`, `--ox-dur-fast: 140ms`, `--ox-dur: 260ms`,
`--ox-dur-slow: 460ms`). Jede Regel steht hinter dem globalen
`@media (prefers-reduced-motion: reduce)`-Ausschalter aus `base.css`.

| # | Auslöser | Effekt | Datei |
|---|---|---|---|
| 1 | Tisch wartet auf Freigabe | Tischmarke „atmet" (Opazität/Skalierung, 2 s Schleife) | `session.ts` |
| 2 | Freigabe kommt | Tischmarke schnappt federnd auf „frei", Rahmen wird grün | `session.ts` |
| 3 | Warte-Ansicht sichtbar | Kreis mit zwei auslaufenden Puls-Ringen | `session.ts` / `guest.css` |
| 4 | Gericht-Karte scrollt in den Blick | gestaffeltes Einfaden (translateY 16 px → 0), `IntersectionObserver`, ~45 ms Versatz | `menu.ts` |
| 5 | Kategorie-Wechsel | Unterstrich gleitet + wächst zur aktiven Kategorie | `menu.ts` |
| 6 | „+"-Knopf gedrückt | Knopf dreht 90° + skaliert kurz | `guest.css` |
| 7 | Hinzufügen (Karte oder Detail) | Flieger-Klon (`PLUS` oder `PHOTO`) fliegt zum Bon-Zähler; Zähler ploppt federnd | `menu.ts` / `cart.ts` |
| 8 | Gericht angetippt | Detail-Sheet slidet von unten herein (Feder am Ende), Abdunklung faded | `menu.ts` / `components.css` |
| 9 | Bon-Ansicht geöffnet | Positionen tippen sich nacheinander rein (~60 ms Versatz) | `cart.ts` |
| 10 | Bon-Karte (immer) | gezackte Abrisskante unten via CSS-`mask` — Papier-Look | `guest.css` |
| 11 | „Jetzt bestellen" | `STAMP`: roter Stempel dreht sich groß rein · `CHECK`: grüner Haken zeichnet sich (SVG-`stroke-dashoffset`) | `cart.ts` / `guest.css` |
| 12 | Direkt danach | Bon-Karte fliegt nach oben weg (translateY −140 %, leichte Rotation, Fade) „zur Küche", dann Wechsel in die Bestellungen-Ansicht | `cart.ts` |
| 13 | Bestell-Status ändert sich | Status-Chip morpht farblich (Angenommen → In der Küche → Fertig → Serviert); Punkt blinkt bei „In der Küche" | `orders.ts` |
| 14 | Ansichtswechsel (Speisekarte / Bon / Bestellungen) | Slide-Fade über die View-Transitions-API, harter Fallback wo nicht unterstützt | `ansichten.ts` / `index.ts` |

Nichts davon ändert Zustände oder löst Netzwerkaufrufe aus — rein visuell.

## 5. Frontend-Struktur (was sich ändert)

Kein neues Seitengerüst; die Modul-Aufteilung der Gäste-Seite aus dem Vorläufer
bleibt (`session · menu · cart · orders · bill · ansichten · laden-design ·
live-daten · index`). Jede Datei bleibt unter ~250 Zeilen; wo eine Datei dadurch
zu groß würde, wandert die Animationslogik in eine kleine Nachbardatei.

- **`src/styles/tokens.css`** — neu: Bewegungs-Tokens (Kurven, Dauern);
  `[data-shape="soft"]`-Block (Radien); `[data-font="…"]`-Blöcke
  (`--ox-font-display`). Weiterhin keine festen Werte außerhalb der Tokens.
- **`src/styles/animation.css`** (neu) — alle `@keyframes` und die
  wiederverwendbaren Bewegungsklassen an einem Ort, importiert von `app.css`.
  Beginnt mit einem Kommentar, der auf den reduced-motion-Ausschalter verweist.
- **`src/styles/components.css`** — Sheet-Transition, Chip-Übergänge,
  Bonbar-Einblendung.
- **`src/pages/guest/guest.css`** — Bon-Perforierung + Zeilen-Tippen,
  Foto-Thumbnail-Karte, Kategorie-Leiste, Warte-Puls, Stempel/Haken.
- **`src/lib/theme.ts`** bzw. **`src/pages/guest/laden-design.ts`** — die vier
  neuen Theme-Felder lesen; `data-shape` / `data-font` auf `<html>` setzen;
  `cartFlyStyle` / `orderConfirmStyle` als Zustand an `cart.ts` reichen.
- **`src/pages/guest/menu.ts`** — Stagger-Observer, „+"-Flieger, Sheet-Slide,
  Kategorie-Unterstrich.
- **`src/pages/guest/cart.ts`** — Zeilen-Tippen, Flieger-Ziel/Pop,
  Stempel/Haken, Bon-fliegt-zur-Küche.
- **`src/pages/guest/orders.ts`** — Chip-Morph beim Statuswechsel.
- **`src/pages/guest/session.ts`** — Tischmarke atmen/schnappen, Warte-Puls
  ein/aus.
- **`src/lib/types.ts`** — `RestaurantThemeDto` um die vier Felder erweitern.

### Schriften (`@fontsource`)

Stand `frontend/package.json` heute: `@fontsource-variable/fraunces`,
`@fontsource-variable/instrument-sans`, `@fontsource/ibm-plex-mono`.

Neu als Abhängigkeit **hinzufügen** und in `src/styles/fonts.ts` importieren:

- `@fontsource-variable/bricolage-grotesque` (OFL) — neuer OX-Standard-Display
- `@fontsource-variable/space-grotesk` (OFL)
- `@fontsource/instrument-serif` (OFL, ein Schnitt)

CSS-Familiennamen (für die `[data-font]`-Blöcke in `tokens.css`):
`"Bricolage Grotesque Variable"`, `"Fraunces Variable"` (bestehend),
`"Space Grotesk Variable"`, `"Instrument Serif"`.

`tokens.css` setzt heute `--ox-font-display: "Fraunces Variable"`. Der neue
Standard ist Bricolage — d. h. der Grundwert von `--ox-font-display` ändert sich,
Fraunces bleibt als `[data-font="fraunces"]`-Wahl erhalten. Instrument Sans
(Fließtext) und IBM Plex Mono (Zahlen) bleiben unverändert. Kein Aufruf an
Google Fonts.

## 6. Backend-Änderung

Genau ein Muster, viermal — analog zu `kitchenDisplayEnabled`:

- **`Restaurant`**: vier Felder `styleShape`, `displayFont`, `cartFlyStyle`,
  `orderConfirmStyle`. Typ `String` (oder ein `@Enumerated(EnumType.STRING)`-Enum
  je Feld), **nullable**. Nullable heißt: `ddl-auto: update` fügt die Spalten
  hinzu, **kein DB-Reset**.
- **`DesignRequest`**: die vier Felder plus `…OrDefault()`-Methoden, die `null`
  auf den Standardwert abbilden (`SQUARE` / `BRICOLAGE` / `PLUS` / `CHECK`).
- **`RestaurantThemeDto`** (Gast: `GET /api/guest/theme/{restaurantId}`) und
  **`MeResponse`** (für die Admin-Vorschau): die vier Werte ausliefern, immer
  aufgelöst (nie `null` nach außen).
- **`RestaurantAdminService.updateDesign`** setzt sie; **`buildTheme`** liest sie.
- **Ungültige Werte** (nicht in der Enum-Menge) → 400 über den bestehenden
  `GlobalExceptionHandler`, deutsche Meldung.
- **`DesignThemeIntegrationTest`**: je Feld ein Test (Wert wird gesetzt und im
  Theme-Endpunkt zurückgegeben; altes Design ohne die Felder liefert die
  Standardwerte; ein ungültiger Wert ergibt 400).

Alles Übrige am Backend bleibt unberührt.

## 7. Admin-Oberfläche

In die bestehende Design-Karte in `admin.html` (alte `frontend/public/js/admin.js`,
noch nicht migriert) kommen vier `<select>`-Felder — Form, Schrift, Flieger,
Bestätigung — mit denselben Optionen wie oben. `Admin.loadDesign` /
`Admin.saveDesign` (bzw. die vorhandenen Entsprechungen) werden um die vier
Felder erweitert; gespeichert wird über den bestehenden `PUT /api/admin/design`.
Keine neue Route. Eine kurze Live-Vorschau ist nicht Teil dieses Umfangs.

## 8. Barrierefreiheit / Qualitätsuntergrenze

- `@media (prefers-reduced-motion: reduce)` in `base.css` bleibt der zentrale
  Ausschalter und wird um die neuen Effekte ergänzt (Stagger-Karten sofort
  sichtbar, keine Flieger, keine Puls-Ringe, Sheet ohne Slide).
- Sichtbarer Tastatur-Fokus auf allen neuen Bedienelementen (Kategorie-Reiter,
  „+"-Knopf, Sheet-Schließen).
- Berührungsziele mindestens 44 × 44 px (Vorgabe aus dem Design-System).
- Der „ANGENOMMEN"-Stempel / Haken ist rein dekorativ — die verbindliche
  Rückmeldung bleibt der Ansichtswechsel zu den Bestellungen samt Status-Text.
- Fotos: `loading="lazy"`, `object-fit: cover`, sauberer Rückfall auf einen
  ruhigen Platzhalter, wenn kein Bild vorhanden ist (bestehendes Verhalten).

## 9. Prüfung und Abnahme

- `mvn clean test` — die bestehenden ~76 Integrationstests plus die neuen
  `DesignThemeIntegrationTest`-Fälle müssen grün sein.
- `test-api.ps1` gegen die laufende App — unverändert 33/33.
- Manueller Durchlauf der Gäste-Seite auf Handy und PC: scannen → warten →
  Name → Menü → Detail → Bon → bestellen → Status; einmal je Form (eckig/weich),
  Stichprobe je Schrift, beide Flieger, beide Bestätigungen.
- Sichtprüfung mit „Bewegung reduzieren" im Betriebssystem: die Seite muss
  vollständig bedienbar und statisch sein.
- Kontrast-Stichprobe mit einer grellen Akzentfarbe (bestehende Absicherung aus
  `theme.ts`).

**Betriebs-Regeln bleiben gültig:** nur eine App-Instanz auf Port 8080; `data/`
niemals löschen, solange eine Instanz läuft.

## 10. Umsetzungsreihenfolge (grob — der Plan verfeinert das)

1. **Backend:** die vier Felder + `DesignRequest` + DTOs + Service + Tests.
2. **Design-System:** Bewegungs-Tokens, `[data-shape]`/`[data-font]`,
   `animation.css`, neue `@fontsource`-Pakete in `fonts.ts`.
3. **Gäste-Seite — Theme-Achsen:** `data-shape`/`data-font` anwenden,
   `cartFlyStyle`/`orderConfirmStyle` durchreichen; noch ohne Animation prüfbar.
4. **Gäste-Seite — Bewegung:** Effekte 1–14 aus dem Inventar, je Modul.
5. **Admin:** die vier `<select>` in die Design-Karte.
6. **Gesamtlauf:** Tests, `test-api.ps1`, manuelle Sichtprüfung inкл.
   reduced-motion.
