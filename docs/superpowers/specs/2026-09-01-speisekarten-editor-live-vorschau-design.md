# Speisekarten-Editor mit Live-Vorschau — Design-Dokument

**Datum:** 01.09.2026
**Status:** Abgenommen (Grundrichtung), Umsetzungsplan folgt
**Vorläufer:** keiner direkt. Baut auf der bestehenden Gäste-Seite
(`frontend/src/pages/guest/`) und den bestehenden Admin-Endpunkten auf.
**Verwandtes, spaeteres Thema (bewusst getrennt):** "Struktur-Freiheit pro
Laden" (Hero-Bereich, eigene Sektionen, mehr als Logo+Theme) — eigene
Brainstorming-Runde, eigene Spec.

## 1. Ziel

Der Inhaber pflegt seine Speisekarte heute über ein Formular, das mit der
echten Optik der Gäste-Seite nichts zu tun hat (Kategorie per Dropdown,
Formularfelder mit Label, kein Bezug zum tatsächlichen Layout/Theme des
Ladens). Ziel: der Inhaber sieht beim Bearbeiten **genau das, was der Gast
sieht** — gleiches Rendering, gleiches Theme (Farbe/Schrift/Form/Hell-Dunkel)
— und legt Gerichte **direkt in dieser Ansicht** an, inklusive Umsortieren.

### Erfolgskriterien

1. Neue Seite zeigt die Speisekarte über die **echte** `zeichneSpeisekarte()`-
   Funktion aus der Gäste-Seite, mit dem echten Laden-Theme. Optik ist
   ununterscheidbar von der Gäste-Seite (gleicher Viewport).
2. Karte antippen öffnet ein Bottom-Sheet zum Bearbeiten; Speichern
   aktualisiert nur diese Karte im DOM, kein Neuladen der ganzen Seite.
3. Jede Kategorie hat am Ende eine gestrichelte "+ Gericht"-Kachel im
   Kartenformat; öffnet dasselbe Sheet, leer.
4. Ausverkaufte/inaktive Gerichte sind im Editor sichtbar (gedimmt + Badge)
   statt wie beim Gast herausgefiltert.
5. Gerichte UND Kategorien lassen sich per Pfeil hoch/runter umsortieren
   (tauscht `sortOrder` mit dem Nachbarn).
6. Bestehende Backend-Endpunkte reichen unverändert — keine neue Migration.
7. Bestehende + neue Frontend-Tests grün (`npm test`, `npm run build`).

## 2. Getroffene Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Rendering-Basis | Bestehende `zeichneSpeisekarte()` aus `guest/menu.ts` **wiederverwendet** (importiert, nicht kopiert) | Garantiert Pixel-Gleichheit mit der Gäste-Seite, kein zweiter Rendering-Pfad, kein Drift-Risiko zwischen "Vorschau" und "echt" |
| Kein Iframe | Direktes Einbinden im selben Dokument | Kein `postMessage`, kein Cross-Frame-Overhead; das Bearbeiten-Sheet setzt direkt auf dem echten DOM auf |
| Stack | Neue Seite im **neuen** TS/Vite-Stack (wie `guest`/`device`), nicht im alten `admin.js` | `menu.ts` ist TS und dort beheimatet — Wiederverwendung ist nur so ohne Bruch möglich |
| Auth | Bestehende `lib/auth.ts`/`lib/api.ts` (localStorage-Schlüssel `ox-auth`/`ox-device`) — **kein neuer Login-Screen** | Bereits seiten-übergreifend kompatibel mit dem Login aus `admin.html` (Kommentar in `auth.ts`: Schlüssel dürfen sich nicht ändern). Editor prüft `hatAnmeldung()`, leitet sonst zu `/admin.html` um |
| Sheet/Overlay | Bestehendes `.ox-overlay` / `.ox-overlay__box--sheet`-Muster (Detail-Overlay) wiederverwendet | Gleiche Bewegung/Reduced-Motion-Behandlung existiert schon, kein neues CSS-System nötig |
| Sichtbarkeit ausverkaufter Gerichte | Editor holt **alle** Gerichte über das bestehende `/api/admin/menu-items` (nicht den Gast-Endpunkt), baut daraus selbst die `Kategorie[]`-Struktur für `zeichneSpeisekarte()`; Admin-only-Zusatzdaten (`available`, `sortOrder`, `categoryId`) bleiben in einer separaten Map neben dem Gast-Shape | Gast-DTOs (`MenuCategoryDto`/`MenuItemDto`) haben diese Felder bewusst nicht; das Admin-DTO (`MenuItemAdminDto`) hat sie bereits |
| Umsortieren | Pfeil-Buttons, zwei `PUT`-Aufrufe mit getauschtem `sortOrder` | Nutzer-Entscheidung (siehe Brainstorm); kein neuer Endpunkt nötig |
| Alter Menü-Tab in `admin.html` | Bleibt vorerst bestehen, bekommt nur einen Link zur neuen Seite | Migration/Löschung ist ein eigener Schritt, kein Teil dieser Spec — vermeidet unnötiges Risiko am laufenden alten Stack |

### Bewusst nicht im Umfang

- Echtes Drag & Drop (siehe Brainstorm-Entscheidung: Pfeile statt Ziehen).
- Massen-Import von Gerichten.
- Kategorie-Wechsel eines Gerichts direkt im Sheet (Kategorie ist durch die
  Position in der Ansicht vorgegeben).
- Die "Struktur-Freiheit pro Laden" (Hero, eigene Sektionen) — eigenes
  späteres Thema.
- Löschen/Migrieren des alten Menü-Tabs in `admin.html`.
- Neue Backend-Endpunkte oder DB-Änderungen.

## 3. Architektur / Datenfluss

Neue Dateien analog zum bestehenden Muster (`guest.html`+`guest/`,
`device.html`+`device.ts`):

- `frontend/menu-editor.html` — Vite-Einstiegspunkt (root neben `guest.html`).
- `frontend/src/pages/menu-editor/index.ts` — Ablauf/Orchestrierung.
- `frontend/src/pages/menu-editor/editor.css` — nur admin-eigene Elemente
  (Plus-Kachel, Pfeile, Dimm-Badge). Importiert zusätzlich `guest/guest.css`
  für die eigentliche Karten-/Kategorie-Optik.

Ablauf beim Laden:

1. `hatAnmeldung()` prüfen (aus `lib/auth.ts`) — sonst Redirect zu
   `/admin.html`.
2. `GET /api/me` → `restaurantId` + Rolle. Nur `OWNER` darf rein; jede andere
   Rolle wird mit Hinweis zurück zu `/admin.html` geschickt (Muster wie
   `stats.html`, das ebenfalls owner-only ist).
3. Parallel laden: `GET /api/guest/theme/{restaurantId}` (echtes Theme, **der
   gleiche** öffentliche Endpunkt, den der Gast auch bekommt), `GET
   /api/admin/categories`, `GET /api/admin/menu-items`.
4. Admin-Daten (`CategoryDto[]`, `MenuItemAdminDto[]`) werden zu `Kategorie[]`
   im Gast-Shape zusammengesetzt: **alle** Kategorien (auch inaktive, auch
   leere) mit **allen** ihren Gerichten (auch ausverkauften), sortiert nach
   `sortOrder`. Eine parallele `Map<kategorieId|gerichtId, ...>` hält die
   Admin-Zusatzfelder (`active`, `available`) für Sheet, Dimmen und Pfeile
   bereit.
5. `wendeThemeAn`/`setzeLadenDesign` (aus `guest/laden-design.ts`,
   wiederverwendet) trägt das Theme auf `<html>` auf — exakt dieselben
   CSS-Variablen wie beim Gast.
6. `zeichneSpeisekarte(kategorien, ziel, beiAuswahl, beiSchnellHinzufuegen,
   bestellenErlaubt=false, hamburger, istVerfuegbar, zeigeLeereKategorien=true)`
   rendert die Karte. `bestellenErlaubt=false` unterdrückt den Warenkorb-"+"-
   Schnell-Knopf, den der Editor nicht braucht (kein Warenkorb hier).
7. Nach dem Rendern hängt der Editor DOM-Zusätze an (kein Fork von
   `zeichneSpeisekarte`): pro Kategorie-Sektion eine "+ Gericht"-Kachel, pro
   Karte ein Bearbeiten-Symbol + zwei Pfeile, Dimmen/Badge für ausverkaufte
   Gerichte UND für inaktive Kategorien (Badge "inaktiv", wie bisher in
   `admin.js`) anhand der Zusatz-Map aus Schritt 4.

## 4. Kleine Erweiterung an geteiltem Code (`guest/menu.ts`)

Zwei rückwärtskompatible, **optionale** Ergänzungen, damit derselbe Code für
Gast **und** Editor taugt — fehlen sie (Gast-Aufruf), bleibt das Verhalten
exakt wie heute:

- `baueGerichtKarte` kennt heute kein Konzept von "ausverkauft", weil der
  Gast-Endpunkt nicht verfügbare Gerichte schon herausfiltert. Neuer
  optionaler Parameter `istVerfuegbar?: (gerichtId: number) => boolean` —
  fehlt er, gilt weiter alles als verfügbar.
- `zeichneSpeisekarte` blendet Kategorien ohne Gerichte komplett aus
  (`mitInhalt`-Filter) — für den Editor müssen leere/frisch angelegte
  Kategorien aber sichtbar bleiben, damit man sie befüllen kann. Neuer
  optionaler Parameter `zeigeLeereKategorien?: boolean` (Standard `false` =
  heutiges Gast-Verhalten).

Kein Eingriff in Detail-Overlay- oder Warenkorb-Logik.

## 5. Bearbeiten-Sheet

Wiederverwendet `.ox-overlay` / `.ox-overlay__box--sheet`. Felder identisch
zur heutigen `editItem`-Form in `admin.js` (kein Funktionsverlust ggü.
Status quo):

- Name, Preis (EUR), Kurzbeschreibung, Zutaten & Details (Textarea),
  Verfügbar (Schalter), Foto (Hochladen/Ändern/Löschen über die bestehenden
  Bild-Endpunkte).
- Kategorie-Auswahl entfällt — das Gericht liegt sichtbar in seiner
  Kategorie-Sektion.
- Speichern: bestehender `PUT`-Endpunkt, danach wird **nur die betroffene
  Karte** im DOM aktualisiert (Text/Preis/Badge patchen, Bild-Cache-Bust wie
  bisher) — kein volles Neuladen.
- Neues Gericht über die "+"-Kachel: gleiches Sheet, Kategorie ist durch die
  Kachel-Position vorgegeben, `POST`, dann Karte an der richtigen Stelle
  einfügen.

## 6. Kategorien

- "+ Kategorie"-Kachel am Ende der Seite.
- Jede Kategorie-Überschrift behält Bearbeiten/Löschen (wie bisher) und
  bekommt zusätzlich zwei Pfeile zum Tauschen mit der Nachbar-Kategorie.
- Eine leere Kategorie zeigt trotzdem ihre "+ Gericht"-Kachel, damit sie sich
  befüllen lässt.

## 7. Umsortieren (Pfeile)

- Pfeil hoch/runter auf einer Gericht-Karte tauscht `sortOrder` mit dem
  direkten Nachbarn **innerhalb derselben Kategorie** (erste Karte kein
  "hoch", letzte kein "runter").
- Zwei `PUT`-Aufrufe an `/api/admin/menu-items/{id}` mit getauschtem
  `sortOrder`, danach die beiden Karten im DOM vertauschen (kein Neuladen).
- Gleiches Prinzip für Kategorien über `/api/admin/categories/{id}`.

## 8. Navigation/Zugriff

- Neuer Link "Speisekarte (neu)" im bestehenden Menü-Tab von `admin.html`,
  führt zu `menu-editor.html`. Der alte Tab bleibt in dieser Spec unverändert
  bestehen (siehe Abschnitt 2/"Bewusst nicht im Umfang").
- Zugriff nur für `OWNER` (Prüfung über `/api/me`, siehe Abschnitt 3).

## 9. Umsetzungsreihenfolge (grob — der Plan verfeinert)

1. Erweiterung an `guest/menu.ts` (`istVerfuegbar`-Parameter) + Tests.
2. `menu-editor.html` + `frontend/src/pages/menu-editor/index.ts`: Laden,
   Auth-/Rollen-Check, Theme, Grund-Rendering.
3. Bearbeiten-Sheet für Gerichte inkl. Foto-Upload, inline DOM-Update nach
   Speichern.
4. "+ Gericht"-Kachel + Neu-Anlegen-Fluss.
5. Kategorie-Kopf (Bearbeiten/Löschen/Pfeile) + "+ Kategorie"-Kachel.
6. Pfeile für Gerichte (`sortOrder`-Tausch).
7. Link aus `admin.html` zur neuen Seite.

## 10. Prüfung und Abnahme

- `npm test` (neue/bestehende Komponententests für die `menu.ts`-Erweiterung
  und den neuen Editor).
- `npm run build`.
- Manuell: als Inhaber anmelden → neue Seite öffnen → Karte sieht wie die
  Gäste-Seite aus (gleiches Theme) → Gericht antippen, Preis ändern,
  speichern, Karte aktualisiert sich sofort → "+ Gericht" in einer Kategorie
  anlegen, erscheint sofort → ausverkauft schalten, Badge erscheint → zwei
  Gerichte per Pfeil tauschen, Reihenfolge stimmt danach auch auf der echten
  Gäste-Seite (neu laden).
