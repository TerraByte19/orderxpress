# Frontend-Redesign OrderXpress — Design-Dokument

**Datum:** 01.08.2026
**Status:** Entwurf zur Abnahme

## 1. Ziel

Das gesamte Frontend wird neu gebaut. Die fachlichen Funktionen bleiben vollständig
erhalten; drei Abläufe werden gezielt verbessert. Anlass: die heutige Oberfläche
wirkt wie eine Standard-Vorlage (system-ui, Standard-Blau, Inline-Styles,
`onclick` im HTML). Die Gäste-Seite ist das Aushängeschild und bekommt die meiste
Sorgfalt; die Optik zielt auf ein **gehobenes Restaurant**.

### Erfolgskriterien

1. Alle heutigen Funktionen laufen unverändert — nachgewiesen über die bestehenden
   ~76 Integrationstests, `test-api.ps1` und den manuellen Durchlauf aus
   `ANLEITUNG-TESTEN.md`.
2. Die Gäste-Seite sieht nach Restaurant aus, nicht nach Liefer-App oder Baukasten.
3. Ein Laden kann seine Seite weiterhin über Akzentfarbe, Hintergrund, Logo und
   Hintergrundbild anpassen — zusätzlich neu über Hell/Dunkel.
4. Keine Datei über ~250 Zeilen. Kein Inline-Style, kein `onclick` im HTML.
5. Der Render-Deploy funktioniert unverändert.

## 2. Getroffene Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Unterbau | Eigener `frontend/`-Ordner mit Vite | Echte Projektstruktur gewünscht; Multi-Page-Build passt exakt zu den 9 bestehenden Seiten |
| Sprache | TypeScript | Backend-DTOs werden als Typen abgebildet; falsche Feldnamen fallen beim Bauen auf statt im Browser |
| Optik | Foto-Karten + Serifen-Gerichtnamen | Fotos sind Pflicht; Serif/Sans-Kontrast hebt die Seite vom Liefer-App-Look ab |
| Hell/Dunkel | Einstellung **pro Laden** | Löst die Wahl zwischen heller und dunkler Richtung auf: der Laden entscheidet |
| Inhaber-Seite | Bleibt **eine** Seite | Ausdrücklich so gewünscht; nur der Code dahinter wird modularisiert |
| Build-Anbindung | `frontend-maven-plugin` in der `pom.xml` | `mvn spring-boot:run` baut das Frontend mit; **Dockerfile und `render.yaml` bleiben unverändert** |

### Bewusst nicht im Umfang

- Kein React/Vue/SPA-Umbau. Die ~2400 Zeilen funktionierende Logik (SSE, Auth,
  Warenkorb, Kasse, Geräte-Token) würden neu geschrieben — zu hohes Risiko für
  Funktionsverlust bei null sichtbarem Gewinn.
- Keine Aufteilung der Inhaber-Seite in Unterseiten.
- Kein Umbau von Statistik-Diagrammen auf eine Chart-Bibliothek — bleibt reines CSS.
- Keine neuen fachlichen Funktionen (keine Bezahlung, keine Reservierung).

## 3. Ordnerstruktur

```
C:\OrderXpress\
├── frontend/                          ← NEU
│   ├── package.json
│   ├── vite.config.ts                 Multi-Page-Konfiguration, Proxy /api → :8080
│   ├── tsconfig.json
│   ├── index.html  guest.html  admin.html  kitchen.html
│   ├── service.html  waiter.html  stats.html  platform.html  device.html
│   ├── public/                        1:1 übernommen: icons/, manifest.webmanifest,
│   │                                  service-worker.js, favicon.ico
│   └── src/
│       ├── styles/
│       │   ├── tokens.css             Farbe, Abstand, Radius, Schriftgrad, Schatten
│       │   ├── base.css               Reset, Typografie, Hell/Dunkel-Ebene
│       │   ├── components.css         Karte, Knopf, Feld, Chip, Overlay, Liste, Leiste
│       │   └── pages/                 guest.css, kitchen.css, admin.css, stats.css …
│       ├── styles/fonts.ts            bindet Fraunces, Instrument Sans, Plex Mono ein
│       ├── lib/
│       │   ├── types.ts               Backend-DTOs als TypeScript-Typen
│       │   ├── api.ts                 fetch-Hülle, Auth-Header, Fehlerbehandlung
│       │   ├── auth.ts                localStorage, /api/me, ensureAuth
│       │   ├── sse.ts                 SSE über fetch-Stream (bestehender Trick)
│       │   ├── theme.ts               Laden-Theming, Hell/Dunkel, Kontrast-Rechnung
│       │   ├── nav.ts                 Rollen-Navigation (buildNav)
│       │   ├── format.ts              Geld, Uhrzeit, Dauer
│       │   └── ui.ts                  Toast, Overlay, Bestätigen-Dialog
│       ├── components/                wiederverwendbare Bausteine (Karte, Dialog,
│       │                              QR-Anzeige, Mengen-Stepper, Status-Chip)
│       └── pages/
│           ├── guest/     menu.ts · cart.ts · bill.ts · join.ts · orders.ts · index.ts
│           ├── admin/     tables.ts · menu.ts · design.ts · devices.ts · staff.ts
│           │              · orders.ts · index.ts
│           ├── service/   approvals.ts · calls.ts · checkout.ts · devices.ts · index.ts
│           ├── waiter/    tables.ts · checkout.ts · index.ts
│           └── kitchen.ts  stats.ts  platform.ts  device.ts
└── src/main/resources/static/         ← Build-Ziel (generiert, in .gitignore)
```

Aus `admin.js` (819 Zeilen) werden 6 Module à ~120 Zeilen, aus `guest.js` (689
Zeilen) werden 5. `jsQR.js` (10.101 Zeilen einkopierter Fremdcode) entfällt und
wird durch die npm-Abhängigkeit `jsqr` ersetzt — statt einer globalen Variable
ein normaler Import, den Vite mitbündelt.

## 4. Design-System

### Leitentscheidung

Akzentfarbe und Hell/Dunkel stellt **jeder Laden selbst** ein. Über Farbe kann
diese Plattform also gar keine eigene Handschrift haben — sie würde bei jedem
Kunden überschrieben. Die Eigenständigkeit liegt deshalb in **Schrift und
Struktur**.

### Schriften

Selbst mitgeliefert als npm-Pakete (`@fontsource…`), kein Aufruf an Google Fonts
— die PWA muss offline funktionieren und die Content-Security-Policy soll eng
bleiben. Drei Schnitte mit klar getrennten Aufgaben:

- **Fraunces** (variabler Serif, OFL) — Gerichtnamen, Überschriften. Trägt den
  Charakter; wird mit `WONK`-Achse gesetzt, aber sparsam eingesetzt.
- **Instrument Sans** (variabler Sans, OFL) — Fließtext, Bedienelemente.
- **IBM Plex Mono** (OFL, Schnitte 400 und 600) — **alle Zahlen**: Preise,
  Zeiten, Tisch- und Bestellnummern, gesetzt mit `tabular-nums`.

Zur Mono-Entscheidung: die meisten Bestell-Oberflächen setzen Preise in der
Fließtextschrift. Mono ist hier funktional begründet — in der geteilten Rechnung
fluchten die Spalten dadurch tatsächlich untereinander, und es greift den
**gedruckten Bon** auf, den das System ohnehin über ESC/POS ausgibt. Die Wärme
kommt aus Fraunces und den Fotos, die Präzision aus den Zahlen.

### Erkennungszeichen: die Tischmarke

Das System dreht sich um den Tisch: der Gast sitzt an einem, die Küche kocht für
einen, der Kellner kassiert einen, die Rechnung gehört zu einem. Die Marke
(`TISCH 07` — Mono, gesperrt, Großbuchstaben, führende Null, dünner Rahmen)
sieht auf **allen fünf Rollen-Ansichten identisch** aus. Sie ist das einzige
bewusst auffällige Element; alles andere bleibt ruhig. Die führende Null ist
nicht Zierde — sie lässt Nummern in Listen untereinander fluchten.

### Tokens (`tokens.css`)

Abstände auf 4px-Raster: `--ox-space-1: 4px` bis `--ox-space-8: 64px`.
Radien: `--ox-radius-sm: 8px`, `-md: 12px`, `-lg: 18px`, `-pill: 999px`.
Schriftgrade: `--ox-text-xs: 12px` bis `--ox-text-3xl: 34px`, Basis 15px.

**Helle Grundpalette** — kühles Papier, bewusst kein warmes Creme: ein warmer
Grund legt einen Gelbstich über jedes Gericht-Foto, und die Karte verkauft über
Fotos.

```
--ox-bg: #f6f6f4       --ox-text: #16171a
--ox-surface: #ffffff  --ox-text-muted: #6e7076
--ox-surface-2: #efefec
--ox-border: #e2e2dd
--ox-accent: #1f3d34   (Standard; vom Laden überschreibbar)
--ox-success: #16794f  --ox-warn: #b26a00  --ox-danger: #b3261e
```

**Dunkle Haut** (`[data-theme="dark"]` auf `<html>`) — drei klar
unterscheidbare Flächenstufen statt Fast-Schwarz mit einem einzelnen Akzent.
Das ist der Unterschied zwischen „gedimmter Gastraum" und „Entwickler-Terminal".

```
--ox-bg: #15181a       --ox-text: #edeeec
--ox-surface: #1d2124  --ox-text-muted: #949a9e
--ox-surface-2: #262b2f
--ox-border: #333a3f
--ox-accent: #c9a227
--ox-success: #4caf82  --ox-warn: #e0a145  --ox-danger: #e5776d
```

### Drei Farb-Ebenen

Die Ebenen überlagern sich in dieser Reihenfolge:

1. **Grundpalette** aus `tokens.css` (hell)
2. **Haut**: `[data-theme="dark"]` überschreibt die Variablen
3. **Laden**: `theme.ts` setzt `--ox-accent` und `--ox-bg` als Inline-Variablen auf
   `<html>` — genau wie die heutige Lösung, nur über die neuen Variablennamen

### Kontrast-Absicherung (behebt einen bestehenden Fehler)

Heute wird auf die Akzentfarbe **immer** weißer Text gesetzt. Wählt ein Laden
Gelb oder Hellgrün, ist die Beschriftung auf Knöpfen praktisch unlesbar.

Neu berechnet `theme.ts` die relative Luminanz der gewählten Akzentfarbe und
setzt `--ox-accent-text` automatisch auf Schwarz oder Weiß. Ziel: mindestens
WCAG-AA-Kontrast (4.5:1) für Text, 3:1 für große Schrift und Bedienelemente.

### Touch-Ziele

Mindestens 44×44px überall. In Küche und Kasse 56×56px, weil dort unter Zeitdruck
und teils mit fettigen Fingern bedient wird.

## 5. Seiten im Detail

### Gäste-Seite (höchste Priorität)

**Optik:** Foto-Karten mit 16:9-Bild, Gerichtname in Fraunces, Beschreibung in
Instrument Sans, Preis in Plex Mono, Tischmarke oben rechts,
Haarlinien-Rahmen statt Schatten, Kategorie-Reiter klein und gesperrt
(Großbuchstaben, weite Buchstabenabstände). Akzentfarbe nur am Hinzufügen-Knopf
und am aktiven Reiter. Hell oder Dunkel je nach Laden-Einstellung.

**Verbesserung 1 — Einstieg glätten.** Heute: Scan → Wartebildschirm → Name
eingeben → erst dann das Menü. Drei Hürden vor dem ersten Gericht.

Neu: Direkt nach dem Scan ist das Menü sichtbar und durchblätterbar. Der
Bestellknopf ist gesperrt und trägt den Hinweis, dass der Tisch noch freigegeben
wird; die Namenseingabe erscheint als ruhige Leiste darüber und kann während des
Wartens erledigt werden. Sobald die Freigabe kommt, entsperrt sich das Bestellen
ohne Seitenwechsel.

*Technisch:* Keine Backend-Änderung nötig. `ScanResponse` liefert `restaurantId`
bereits bei `sessionStatus = PENDING`, damit kann `GET /api/guest/menu/{restaurantId}`
sofort geladen werden. Die Namenspflicht bleibt fachlich bestehen — sie wird nur
zeitlich vorgezogen statt nachgelagert.

**Verbesserung 2 — Bestell-Status für den Gast.** Heute erfährt der Gast nach dem
Absenden nichts mehr. Neu zeigt eine Karte je Bestellung einen Status-Chip:
*Angenommen → In der Küche → Fertig → Serviert*, dazu die Uhrzeit der Bestellung.

*Technisch:* Keine Backend-Änderung nötig. `GET /api/guest/guests/{token}/orders`
liefert `OrderResponse` inklusive `status` (`NEW`, `IN_PREPARATION`, `READY`,
`SERVED`, `CANCELLED`). Der Abruf hängt sich an die bestehende Gast-Status-Abfrage
an, die heute alle 3 Sekunden läuft (`guest.js`, `pollTimer`) — kein zweiter
Takt. Neu: der Takt pausiert, wenn die Seite im Hintergrund liegt
(`visibilitychange`), das spart Akku am Gästehandy.

**Unverändert:** Warenkorb mit Wiederherstellung aus `localStorage`,
Detail-Overlay je Gericht, Beitritts-Freigabe durch den Gastgeber, geteilte
Rechnung mit Auswahl-Summe, „Kellner rufen“ samt 30-Sekunden-Sperre,
Hamburger-Kategorien als Laden-Option.

### Küchen-Monitor

Board mit drei Spalten (Neu / In Arbeit / Fertig), eine Karte pro Tisch mit
gebündelten Positionen — wie heute. Neu:

- **Wartezeit-Uhr** je Karte. Bis 10 Minuten neutral, danach Warn-, ab 20 Minuten
  Gefahr-Farbe. Rein visuell, kein Statuswechsel.
- 56px-Knöpfe für Zubereiten / Fertig / Serviert / Storno / Bon.
- **Optionaler Ton** bei neuer Bestellung, umschaltbar, Zustand in `localStorage`.
  Browser erlauben Ton erst nach einer Nutzergeste — beim ersten Aktivieren wird
  ein stummer Ton abgespielt, um die Freigabe zu holen. Der Schalter zeigt an,
  wenn der Browser blockiert.

### Kasse (Service) und Kellner

- **Freigabe-Anfragen und Kellner-Rufe** wandern aus dem Karten-Fluss in eine
  auffällige Leiste am oberen Rand — das sind die einzigen Dinge, die sofortiges
  Handeln verlangen.
- Abrechnen mit großen Auswahlzielen; die ausgewählte Summe steht fett und bleibt
  beim Scrollen sichtbar.
- Geräte- und QR-Verwaltung bleibt inhaltlich unverändert.

### Inhaber-Seite

Bleibt **eine** Seite mit den bekannten Karten (Freigaben, Tische, Speisekarte,
Design, Geräte, Mitarbeiter-Logins, letzte Bestellungen). Neu obendrauf eine
Sprungleiste zu den Abschnitten. In der Design-Karte kommt ein Schalter
**Hell / Dunkel** dazu.

### Statistik, Plattform, Gerät, Startseite

Auf das neue System gezogen. Diagramme bleiben reines CSS (keine Bibliothek).
Funktional unverändert.

## 6. Backend-Änderung

Genau eine, nach dem bewährten Muster von `kitchenDisplayEnabled`:

- `Restaurant.darkMode` — `Boolean`, **nullable**; `null` gilt als hell.
  Nullable heißt: `ddl-auto: update` fügt die Spalte hinzu, **kein DB-Reset nötig**.
- `DesignRequest` bekommt das Feld plus `darkModeOrDefault()`.
- `RestaurantThemeDto` und `MeResponse` liefern es aus.
- `RestaurantAdminService.updateDesign` und `buildTheme` setzen bzw. lesen es.
- Neuer Test in `DesignThemeIntegrationTest`: Schalter wirkt, altes Design ohne
  Feld bleibt hell.

Alles Übrige am Backend bleibt unangetastet.

## 7. Build-Anbindung

`frontend-maven-plugin` in der `pom.xml`, gebunden an die Phase
`generate-resources`:

1. `install-node-and-npm` — das Plugin lädt eine feste Node-Version nach
   `target/node/`. **Es muss kein Node auf dem System oder im Docker-Bild
   installiert sein.** `target/` ist bereits ignoriert.
2. `npm ci` — Abhängigkeiten nach `frontend/node_modules/`
3. `npm run build` — Vite schreibt nach `src/main/resources/static`

`frontend/node_modules/` kommt ebenfalls in die `.gitignore`.

Damit baut `mvn spring-boot:run` das Frontend automatisch mit (die Phase läuft im
Vorlauf), und `Dockerfile` sowie `render.yaml` bleiben unverändert — dort läuft
ohnehin bereits ein Maven-Schritt.

`src/main/resources/static/` wird in `.gitignore` aufgenommen, da ab jetzt
generiert.

**Entwicklung:** `npm run dev` im `frontend/`-Ordner startet den Vite-Server mit
sofortigem Neuladen; `/api` wird auf `http://localhost:8080` durchgereicht. Die
Spring-App läuft dabei wie gewohnt parallel. Optional, aber beim Stylen deutlich
schneller.

## 8. Service-Worker und PWA

Vite hängt Prüfsummen an die Dateinamen (`guest-a3f2c1.js`). Die heutige feste
Cache-Liste im `service-worker.js` würde damit ins Leere greifen.

**Lösung:** Der Service-Worker cached beim Installieren nur noch die HTML-Seiten
(feste, unveränderliche Namen) und bleibt für alles Übrige network-first mit
Cache-Rückfall zur Laufzeit. Das ist unabhängig von Prüfsummen und behält das
heutige Verhalten: `/api/**` geht immer ans Netz, die Gäste-Seite bleibt
absichtlich außerhalb der PWA.

`manifest.webmanifest` und die Icons werden unverändert übernommen. Die
`SecurityConfig`-Whitelist (`/manifest.webmanifest`, `/service-worker.js`,
`/icons/**`, die einzelnen `.html`-Seiten) wird nach dem Umbau gegengeprüft, weil
`anyRequest().denyAll()` sonst neue Pfade blockiert.

## 9. Reihenfolge der Umsetzung

Jeder Schritt ist für sich lauffähig und prüfbar.

1. **Gerüst und Kette beweisen.** `frontend/` anlegen, Vite-Multi-Page, TypeScript,
   `frontend-maven-plugin` in die `pom.xml`, `.gitignore` anpassen. Nur die
   Startseite portieren. Prüfen: `mvn clean spring-boot:run` liefert sie aus.
2. **Design-System und Bibliothek.** `tokens.css`, `base.css`, `components.css`,
   Schriften; `lib/types.ts`, `api.ts`, `auth.ts`, `sse.ts`, `theme.ts`, `nav.ts`,
   `format.ts`, `ui.ts`.
3. **Gäste-Seite** samt beider Ablauf-Verbesserungen.
4. **Küche, Kasse, Kellner** samt Stress-Tauglichkeit.
5. **Inhaber, Statistik, Plattform, Gerät.**
6. **Backend:** das `darkMode`-Feld plus Schalter in der Design-Karte und Test.
7. **Aufräumen:** die alten, von Hand gepflegten Dateien unter
   `src/main/resources/static` aus der Versionsverwaltung nehmen
   (`git rm -r --cached src/main/resources/static`, danach greift der neue
   `.gitignore`-Eintrag), `SecurityConfig`-Whitelist prüfen, Gesamtlauf.

## 10. Prüfung und Abnahme

- `mvn clean test` — die bestehenden ~76 Integrationstests müssen grün bleiben.
  Sie sind das Sicherheitsnetz: da das Backend fast unberührt bleibt, schlagen sie
  an, sobald doch etwas kaputtgeht.
- `test-api.ps1` gegen die laufende App — unverändert, muss 33/33 bestehen.
- Manueller Durchlauf nach `ANLEITUNG-TESTEN.md` auf Handy und PC.
- Sichtprüfung hell und dunkel, mit und ohne Laden-Logo, mit und ohne
  Hintergrundbild.
- Kontrast-Stichprobe mit einer grellen Akzentfarbe (z. B. Gelb), um die
  automatische Textfarbe zu bestätigen.

**Betriebs-Regeln bleiben gültig:** nur eine App-Instanz auf Port 8080; `data/`
niemals löschen, solange eine Instanz läuft.

## 11. Offene Punkte nach diesem Umbau

Unverändert aus `CLAUDE.md` übernommen, nicht Teil dieses Vorhabens:

1. Vor echtem Einsatz: Passwörter ändern, H2-Konsole und Swagger sperren, HTTPS,
   `public-base-url` setzen.
2. Später: PostgreSQL mit Flyway statt `ddl-auto: update`, echten Bondrucker
   testen, eventuell Bezahlung.
