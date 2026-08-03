# Übergabe: Frontend-Umbau OrderXpress

**Stand:** 03.08.2026 · Branch `frontend-redesign`, 38 Commits vor `main` · `main` ist unberührt

Diese Datei ist für eine **neue Chat-Sitzung** gedacht. Sie enthält alles, was du brauchst,
um weiterzumachen, ohne die alte Unterhaltung zu kennen.

---

## Stand: die Gäste-Seite funktioniert, eine kleine Regression ist offen

Der komplette Bestellablauf wurde im laufenden Docker-Container Schritt für Schritt
nachgewiesen:

„+" antippen → Detail-Overlay öffnet sich → „In den Warenkorb" → Leiste zeigt
„1 Artikel · 6,50 €", `localStorage` enthält `[{"gerichtId":1,"menge":1,"hinweis":""}]`
→ „Warenkorb ansehen" → „Jetzt bestellen" → die Bestell-Ansicht erscheint von selbst
mit Status-Chip „Angenommen", „Bestellung #1", Uhrzeit und „1× Bruschetta".

### Die Regression ist behoben (Commit `5045c27`)

**Der „+"-Knopf fügt wieder direkt hinzu.** Live mit laufender App in beide Richtungen
nachgewiesen:

- „+" antippen → Overlay bleibt **zu**, `localStorage` enthält
  `[{"gerichtId":1,"menge":1,"hinweis":""}]`, Leiste zeigt „1 Artikel · 6,50 €".
  Ein Tipp statt drei.
- Karte antippen → Overlay öffnet sich, Warenkorb bleibt unverändert.

`zeichneSpeisekarte` und `baueGerichtKarte` haben jetzt einen zweiten Rückruf
`beiSchnellHinzufuegen`, der nur am „+" hängt, mit `stopPropagation`. Zwei neue Tests
mit **unterscheidbaren** Attrappen prüfen die Trennung in beide Richtungen — sie hätten
die Regression gefangen. Tests: 212 Frontend, 120 Backend.

Der folgende Abschnitt beschreibt den behobenen Zustand und bleibt als Beleg stehen.

<details>
<summary>Was die Regression war</summary>

**Der „+"-Knopf fügte nicht direkt hinzu, sondern öffnete das Detail-Overlay.**

`CLAUDE.md:46` hält die ursprüngliche Absicht fest: *„+"-Button bleibt für
Schnell-Hinzufügen, stopPropagation beachten*. Gedacht war: Zeile antippen öffnet das
Overlay, „+" fügt mit Menge 1 sofort hinzu. Jetzt tun beide dasselbe — aus einem Tipp
werden drei.

**Ursache, im Code dokumentiert:**

- `frontend/src/pages/guest/menu.ts:101` und `:106` hängen **denselben** Rückruf
  `beiAuswahl` an die Karte **und** an den „+"-Knopf.
- `frontend/src/pages/guest/index.ts:275` (`beiGerichtAusgewaehlt`) öffnet daraufhin für
  beide das Overlay. Der Kommentar darüber benennt das offen.

**Behebung:** `zeichneSpeisekarte` und `baueGerichtKarte` brauchen einen **zweiten**
Rückruf für das Schnell-Hinzufügen, der an den „+"-Knopf gebunden wird. `index.ts`
übergibt dafür `gericht => beiHinzufuegen(gericht, 1, "")`. Auf dem „+" gehört ein
`stopPropagation`, damit nicht zusätzlich die Karte auslöst — genau das meint der
Hinweis in `CLAUDE.md`.

`menu.ts` hatte 37 Tests; die Signaturänderung berührte sie.

</details>

**Noch offen, klein:** „Jetzt bestellen" ist bei leerem Warenkorb nicht gesperrt und läuft
in ein 400 vom Backend.

### Eine Warnung zur Arbeitsweise

Diese Regression wurde zuerst als **blockierender Defekt** gemeldet („+ tut gar nichts",
„Bestell-Ansicht unerreichbar"). Beides war falsch — gemessen wurde nur `localStorage`
und die Warenkorb-Leiste, nicht das Overlay; und der Testklick traf einen
Kategorie-Reiter statt den „+"-Knopf.

**Lehre: Wenn ein Klick scheinbar nichts tut, prüf zuerst, ob du den richtigen Knopf
getroffen hast und ob sich woanders etwas geöffnet hat.** Ein falscher Befund kostet
mehr als gar keiner.

---

## Was funktioniert (selbst im Docker-Container gemessen)

- **`docker build` läuft durch.** Container gestartet, `/`, `/guest.html`,
  `/device.html`, `/admin.html` und alle Assets liefern `200`. Der Render-Deploy-Pfad
  ist damit bewiesen, nicht nur simuliert.
- **Erste Ablauf-Verbesserung wirkt:** Die Speisekarte ist sofort nach dem Scan sichtbar,
  obwohl der Tisch noch nicht freigegeben ist — 14 Gerichte, alle 14 Bestellknöpfe
  gesperrt, Hinweis vorhanden. Nach der Freigabe **ohne Neuladen**: gesperrte Knöpfe
  14 → 0, Hinweis weg, „Kellner rufen" und „Rechnung teilen" erscheinen.
- **Design-System greift:** Fraunces für Gerichtnamen, Instrument Sans für Text, Preise
  in IBM Plex Mono mit `font-variant-numeric: tabular-nums`, Tischmarke `TISCH 01` mit
  führender Null.
- **Theming greift:** `--ox-text` wurde auf `#000000` gesetzt, abgeleitet aus dem hellen
  Laden-Hintergrund. `--ox-accent-text` wird aus der Akzentfarbe berechnet.
- **Tests:** 120 Backend, 210 Frontend, alle grün. `tsc --noEmit` sauber.

---

## Aufbau

```
C:\OrderXpress\
├── frontend/                     Vite + TypeScript, Quelle des Frontends
│   ├── *.html                    alle neun Seiten (Vite-Einstiegspunkte)
│   ├── public/css|js/            NOCH ALT: die sieben nicht umgestellten Seiten
│   └── src/
│       ├── styles/               tokens.css · base.css · components.css · app.css
│       ├── lib/                  api · auth · session · sse · theme · format · ui · types · pwa
│       └── pages/guest/          session · menu · cart · orders · bill · index (+ 3 Helfer)
└── src/main/resources/static/    GENERIERT — niemals von Hand bearbeiten
```

**`src/main/resources/static` wird bei jedem Bau geleert** (`emptyOutDir: true`) und ist
gitignoriert. Wer dort Dateien anlegt, verliert sie.

Das `frontend-maven-plugin` baut das Frontend in der Phase `generate-resources` mit —
`mvn spring-boot:run` genügt, ein eigener Schritt ist nicht nötig.

---

## Befehle

```bash
# Frontend
cd frontend && npm test          # 210 Tests
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd frontend && npm run dev       # Vite-Server, /api geht auf :8080

# Backend (baut das Frontend mit)
mvn clean test                   # 120 Tests
mvn spring-boot:run              # App auf :8080

# Docker
docker build -t orderxpress-test .
docker run -d --name ox-test -p 8081:8080 orderxpress-test
```

**Betriebsregeln:** Nur **eine** App-Instanz auf Port 8080 (`netstat -ano | findstr :8080`).
Den Ordner `data/` **niemals** löschen, solange eine Instanz läuft.

---

## Verbindliche Vorgaben

- Branch `frontend-redesign`, nicht auf `main` arbeiten.
- Kommentare und Nutzertexte auf **Deutsch**. In `.java`-Dateien Umlaute als `ue/oe/ae`;
  in `.ts`/`.css`/`.html` echte Umlaute (UTF-8).
- Kein Inline-Style, kein `onclick` in neuem HTML. Ereignisse über `addEventListener`.
- Keine Datei über ~250 Zeilen. *(Ausnahme mit Begründung: `index.ts` mit 528 — siehe unten.)*
- Keine externen Laufzeit-Aufrufe. Keine Google Fonts, kein CDN.
- TypeScript strict.
- Alle Zahlen über `.ox-preis` / `.ox-zeit` / `.ox-num` bzw. `tischmarke()` — nie selbst
  formatieren.
- Keine festen Farb-, Abstands-, Radius- oder Schriftgradwerte in CSS. Nur `var(--ox-…)`.
- Berührungsziele mindestens 44px, in Küche und Kasse 56px.

---

## Gelernt — die teuersten Fehler dieses Projekts

Diese vier haben **jede** Codeprüfung überstanden. Alle wurden erst sichtbar, als die
Anwendung tatsächlich lief:

1. **`/assets/**` war durch Spring Security gesperrt.** `SecurityConfig` erlaubte nur die
   alten Pfade `/css/**` und `/js/**`; Vite legt alles unter `/assets/` ab. Die Seiten
   lieferten `200` und luden dann weder CSS noch JavaScript. *Behoben, mit Test.*
2. **Das `Dockerfile` kopierte `frontend/` nicht ins Bild.** Der Render-Deploy wäre
   gebrochen. *Behoben, echter Build verifiziert.*
3. **Testtheater, dreimal.** `toContain` auf einer Klassenliste bleibt grün, wenn die
   Basisklasse *ersetzt* statt ergänzt wird. Ein Timer-Test, der exakt am Konvergenzpunkt
   prüft, bleibt auch ohne `clearTimeout` grün. Ein `textContent`-vs-`innerHTML`-Test ist
   mit reinen Ziffern prinzipiell blind.
4. **Der aktuelle Defekt** — Module einzeln getestet, Verdrahtung ungetestet.

**Die Regel, die daraus folgt und im Plan steht:** Bevor ein Test als fertig gilt, spiel
durch, was er täte, wenn die Implementierung den jeweiligen Fehler hätte. Wird er nicht
rot, prüft er nichts. Und: **Reine Codeprüfung reicht nicht — die App muss laufen.**

---

## Offene Punkte

Ausführlich in `docs/superpowers/specs/2026-08-01-frontend-redesign-design.md`,
Abschnitt 12 (versioniert):

| Punkt | Wann fällig |
|---|---|
| `index.ts` der Gäste-Seite hat 528 statt ~250 Zeilen | erst Tests dafür, dann aufteilen |
| `ProblemDetail` fehlen `type`, `instance`, `errors` | sobald Formulare Feldfehler zeigen |
| `theme-color` HTML gegen Manifest angleichen | wenn alle neun Seiten umgestellt sind |
| `frontend/public/css` und `js` entfernen | wenn die letzte Seite umgestellt ist |
| Service-Worker-Cache wächst unbegrenzt | irgendwann |

---

## Wo was liegt

| Was | Wo |
|---|---|
| Design-Entscheidungen samt Begründung | `docs/superpowers/specs/2026-08-01-frontend-redesign-design.md` |
| Plan 1 (Fundament, abgeschlossen) | `docs/superpowers/plans/2026-08-01-frontend-fundament.md` |
| Plan 2 (Gäste-Seite, umgesetzt) | `docs/superpowers/plans/2026-08-03-gaeste-seite.md` |
| Arbeitsprotokolle mit allen Befunden | `.superpowers/sdd/*/progress.md` *(gitignoriert)* |
| Projektkontext des Backends | `CLAUDE.md` |

---

## Nächste Schritte

1. **Optik beurteilen** — bisher hat noch niemand die Seite mit Augen gesehen. Besonders:
   eine grelle Akzentfarbe einstellen (Gelb `#ffff00`) und prüfen, dass die Knopfschrift
   schwarz wird.
2. **Plan 3** — Küche, Kasse, Kellner. Voraussetzung erfüllt: `sse.ts` hat inzwischen
   Tests, das war die Bedingung, bevor der Küchen-Monitor darauf aufbaut.
3. **Mergen** ist aus technischer Sicht möglich — Docker-Bau, Tests und der
   Bestellablauf sind nachgewiesen. Die Regression aus Punkt 1 ist eine
   Bedienverschlechterung, kein Fehlverhalten. Ob sie vorher raus soll, ist deine
   Entscheidung.
