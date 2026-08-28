# Design-Vorlagen + mehr Schriften — Design-Dokument

**Datum:** 28.08.2026
**Status:** Abgenommen (Grundrichtung), Umsetzungsplan folgt
**Vorläufer:** `2026-08-27-gaeste-seite-bewegung-und-laden-stile-design.md` (vier
Design-Achsen pro Laden: `styleShape`, `displayFont`, `cartFlyStyle`,
`orderConfirmStyle`). Dieses Dokument baut darauf auf.

## 1. Ziel

Der Inhaber soll ein Laden-Design **in einem Klick** setzen können, statt jede
Achse einzeln zu wählen: eine Handvoll benannter, aufeinander abgestimmter
**Design-Vorlagen**. Dazu **mehr Schrift-Auswahl** (von 4 auf 7) und der bisher
fehlende **Hell/Dunkel**-Schalter, damit eine Vorlage ein echtes Gesamtpaket ist
(Farbe + Form + Schrift + Bewegungs-Details + Haut).

### Erfolgskriterien

1. In der Design-Karte des Inhaber-Frontends steht eine Reihe „Vorlagen"; ein
   Klick füllt Akzentfarbe, Hintergrundfarbe, Hell/Dunkel, Form, Schrift,
   Warenkorb-Flieger und Bestell-Bestätigung. Jedes Feld bleibt danach einzeln
   änderbar; gespeichert wird über den bestehenden „Speichern"-Knopf.
2. Sieben Display-Schriften zur Wahl.
3. Ein Laden kann Hell/Dunkel unabhängig von einer Vorlage setzen.
4. `ddl-auto: update` läuft ohne DB-Reset durch.
5. Bestehende ~76 + neue Integrationstests grün; Frontend `npm test` grün.

## 2. Getroffene Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Vorlagen-Mechanismus | **Nur Frontend** — feste Kombis in `admin.js` | Eine Vorlage ist eine Abkürzung, die die vorhandenen Felder füllt; kein Server-Zustand, kein `designPreset`-Feld, keine Migration |
| Hell/Dunkel | Neues **nullable** Feld `Restaurant.darkMode` | War im 01.08.-Plan (Abschnitt 6) vorgesehen, nie gebaut. Muster identisch zu den vier Achsen; `null` = hell |
| Farbe in der Vorlage | Vorlage setzt IMMER einen expliziten `backgroundColor`-Hex (auch dunkle) | `theme.ts` leitet Textfarbe/`--ox-text-muted` bereits per Luminanz aus dem Hintergrund-Hex ab (Commit `93467fc`); so ist Kontrast auch bei einer dunklen Vorlage automatisch sicher, `data-theme="dark"` tauscht zusätzlich Flächen/Rahmen/Signalfarben |
| Schrift-Zahl | 4 → 7 (Manrope, Sora, DM Serif Display neu) | Deckt geometrische Sans, technische Sans und kontrastreichen Serif ab — die Lücken der bisherigen vier |
| `MeResponse` | Bleibt unangetastet | Wie bei den vier Achsen: Gast nutzt `/api/guest/theme`, Admin `/api/admin/design` — beide `RestaurantThemeDto` |

### Bewusst nicht im Umfang

- Kein serverseitiges „welche Vorlage ist aktiv" — nach dem Anwenden zählen nur
  die Einzelfelder.
- Keine vom Inhaber selbst speicherbaren Vorlagen.
- Keine Migration von Admin/Küche/… auf das neue Frontend-System.
- Keine Änderung an der Gäste-Seiten-Bewegung.

## 3. Die sieben Schriften

| `displayFont` | `[data-font]` | `@fontsource`-Paket | CSS-Familie | Charakter |
|---|---|---|---|---|
| `BRICOLAGE` (Standard) | (Attribut fehlt) | `@fontsource-variable/bricolage-grotesque` | `"Bricolage Grotesque Variable"` | moderne Grotesk mit Eigenwillen |
| `FRAUNCES` | `fraunces` | `@fontsource-variable/fraunces` | `"Fraunces Variable"` | warmer Editorial-Serif (`SOFT`/`WONK`) |
| `SPACE_GROTESK` | `space` | `@fontsource-variable/space-grotesk` | `"Space Grotesk Variable"` | geometrisch, technisch |
| `INSTRUMENT_SERIF` | `iserif` | `@fontsource/instrument-serif` | `"Instrument Serif"` | schlanker Display-Serif |
| `MANROPE` *(neu)* | `manrope` | `@fontsource-variable/manrope` | `"Manrope Variable"` | klare, freundliche geometrische Sans |
| `SORA` *(neu)* | `sora` | `@fontsource-variable/sora` | `"Sora Variable"` | kantige, technisch-moderne Sans |
| `DM_SERIF` *(neu)* | `dmserif` | `@fontsource/dm-serif-display` | `"DM Serif Display"` | kontrastreicher, klassischer Display-Serif |

`fonts.ts` importiert die drei neuen Pakete zusätzlich. `tokens.css` bekommt drei
weitere `:root[data-font="…"]`-Blöcke, die nur `--ox-font-display` überschreiben
(nach den bestehenden, gleiche Spezifität). `theme.ts`' `SCHRIFT`-Map bekommt
`MANROPE → "manrope"`, `SORA → "sora"`, `DM_SERIF → "dmserif"`. Fraunces' `SOFT`/
`WONK`-Feintuning bleibt hinter `:root[data-font="fraunces"]` (aus dem
Fix-Durchgang von Plan 1) — für die anderen sechs greift `font-optical-sizing: auto`.

## 4. Backend-Änderung

Genau ein neues Feld plus drei erweiterte Regex — Muster wie `styleShape`:

- **`Restaurant`**: `darkMode` (`Boolean`, **nullable**, Spalte `dark_mode`).
  Getter `isDarkMode()` → `darkMode != null && darkMode` (null = hell). Setter
  `setDarkMode(boolean)`.
- **`DesignRequest`**: Feld `Boolean darkMode` + `darkModeOrDefault()` (null → false).
  `displayFont`-`@Pattern` erweitert auf
  `BRICOLAGE|FRAUNCES|SPACE_GROTESK|INSTRUMENT_SERIF|MANROPE|SORA|DM_SERIF`.
- **`RestaurantThemeDto`**: `boolean darkMode` ans Ende.
- **`RestaurantAdminService.updateDesign`** setzt `restaurant.setDarkMode(request.darkModeOrDefault())`;
  **`buildTheme`** reicht `restaurant.isDarkMode()` durch.
- **Test** (`DarkModeAndFontsIntegrationTest`, neu, oder Erweiterung von
  `GuestPageDesignIntegrationTest`): `darkMode` true wird über `/api/admin/design`
  gesetzt und über `/api/guest/theme/{id}` gelesen; altes Design ohne das Feld →
  `false`; die drei neuen `displayFont`-Werte werden angenommen; ein unbekannter
  Schrift-Wert ergibt 400.

Kein `MeResponse`, keine weiteren Controller-Änderungen.

## 5. Frontend — Gäste-Seite (minimal)

- **`types.ts`**: `LadenTheme` bekommt `darkMode: boolean`.
- **`laden-design.ts`**: `wendeThemeAn` ruft `setzeLadenDesign({ … , dunkel: theme.darkMode })`.
  `setzeLadenDesign` behandelt `design.dunkel` bereits (`data-theme="dark"` an/aus).
- **`theme.ts`**: nur die `SCHRIFT`-Map um die drei neuen Werte erweitern.
- Bestehende `LadenTheme`-Testfixtures um `darkMode: false` ergänzen; ein
  `theme.test.ts`-Fall für eine neue Schrift-Zuordnung (z. B. `MANROPE` →
  `data-font="manrope"`).

Die Gäste-Seite kennt **keine** Vorlagen — sie liest nur die aufgelösten Felder.

## 6. Frontend — Inhaber-Seite (alte `admin.html` / `public/js/admin.js`)

- **Hell/Dunkel-Schalter**: `<input type="checkbox" id="design-dark">` in der
  `.mini-form` der Design-Karte (bei den anderen Schaltern). `loadDesign` setzt
  `.checked = t.darkMode === true`; `saveDesign` nimmt
  `darkMode: document.getElementById("design-dark").checked` in den PUT-Body.
- **Drei neue Schrift-`<option>`s** im `design-font`-`<select>`: Manrope
  (`MANROPE`), Sora (`SORA`), DM Serif Display (`DM_SERIF`).
- **Vorlagen-Reihe**: über den Einzelfeldern eine Reihe mit einem Knopf je
  Vorlage (`class="small"`, `onclick="Admin.applyVorlage('bistro')"` usw. — der
  Inline-`onclick`-Stil der alten Datei). Darüber eine kurze `p.muted`:
  „Vorlage wählen, danach bei Bedarf einzeln anpassen, dann speichern."
- **`admin.js`**: Konstante `VORLAGEN` (Objekt name → Werte-Objekt) und
  `Admin.applyVorlage(name)`, das jedes Control (`design-accent`, `design-bg`,
  `design-dark`, `design-shape`, `design-font`, `design-fly`, `design-confirm`)
  auf den Vorlagenwert setzt. Speichern bleibt der bestehende
  `Admin.saveDesign()`-Knopf. `applyVorlage` schreibt NICHT selbst zum Server.

### Die fünf Start-Vorlagen

| Name (Schlüssel) | `styleShape` | `displayFont` | `accentColor` | `backgroundColor` | `darkMode` | `cartFlyStyle` | `orderConfirmStyle` |
|---|---|---|---|---|---|---|---|
| **Bistro** (`bistro`) | `SOFT` | `FRAUNCES` | `#b3502e` | `#f7f4ef` | false | `PHOTO` | `STAMP` |
| **Kasse** (`kasse`) | `SQUARE` | `BRICOLAGE` | `#1f3d34` | `#f6f6f4` | false | `PLUS` | `STAMP` |
| **Nacht** (`nacht`) | `SQUARE` | `SPACE_GROTESK` | `#c9a227` | `#15181a` | **true** | `PHOTO` | `CHECK` |
| **Frisch** (`frisch`) | `SOFT` | `MANROPE` | `#0f9d8f` | `#ffffff` | false | `PHOTO` | `CHECK` |
| **Klassik** (`klassik`) | `SQUARE` | `DM_SERIF` | `#1a1a1a` | `#faf9f6` | false | `PLUS` | `CHECK` |

`#15181a` bei „Nacht" ist bewusst der Wert der dunklen Haut aus `tokens.css`
(`--ox-bg`), damit Haut und Laden-Hintergrund deckungsgleich sind.

## 7. Umsetzungsreihenfolge (grob — der Plan verfeinert)

1. **Backend:** `darkMode`-Feld + `displayFont`-Regex + Service + Tests.
2. **Frontend-Fundament:** drei `@fontsource`-Pakete, drei `[data-font]`-Blöcke,
   `SCHRIFT`-Map, `types.ts`/`laden-design.ts` für `darkMode`, Testfixtures.
3. **Admin:** Vorlagen-Reihe + `applyVorlage` + Hell/Dunkel-Schalter + drei
   Schrift-`<option>`s + `loadDesign`/`saveDesign`.

## 8. Prüfung und Abnahme

- `mvn clean test` grün (bestehende + neue Backend-Tests).
- `frontend/`: `npm run build` + `npm test` grün.
- Manuell: im Admin jede der fünf Vorlagen anklicken → Felder füllen sich →
  speichern → Gäste-Seite neu laden → Optik entspricht der Vorlage; „Nacht"
  zeigt die dunkle Haut mit lesbarem Text; danach ein Einzelfeld ändern und
  erneut speichern.
- Betriebs-Regeln unverändert (eine App-Instanz, `data/` nicht löschen).
