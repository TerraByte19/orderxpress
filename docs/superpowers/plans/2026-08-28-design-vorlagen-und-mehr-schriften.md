# Design-Vorlagen + mehr Schriften — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fünf benannte Design-Vorlagen (ein Klick füllt alle Design-Felder), drei zusätzliche Schriften (4 → 7) und ein Hell/Dunkel-Schalter pro Laden.

**Architecture:** Der Vorlagen-Mechanismus lebt **nur im Inhaber-Frontend** (feste Kombis in `public/js/admin.js`, ein Klick setzt die vorhandenen Formularfelder). Hell/Dunkel ist ein neues **nullable** `Restaurant.darkMode` (Muster wie `kitchenDisplayEnabled`, `null` = hell), ausgeliefert über `RestaurantThemeDto`. Die drei neuen Schriften erweitern das bestehende `displayFont`-Enum, die `@fontsource`-Importe, die `[data-font]`-Blöcke und die `SCHRIFT`-Map. Die Gäste-Seite kennt keine Vorlagen — sie liest nur die aufgelösten Einzelfelder.

**Tech Stack:** Java 17 / Spring Boot 4.1, H2 (`ddl-auto: update`), JUnit 6 + MockMvc; Frontend Vite 6 + TypeScript 5.7, Vitest (jsdom), `@fontsource`-Pakete; alte Inhaber-Seite als statisches `frontend/admin.html` + `frontend/public/js/admin.js`.

## Global Constraints

- **Neue DB-Spalte `nullable`** — `ddl-auto: update` muss ohne DB-Reset laufen. `data/` niemals löschen, solange eine Instanz auf Port 8080 läuft.
- **Java:** Bezeichner Englisch, Kommentare/Meldungen Deutsch mit ASCII-Umschreibung (ue/oe/ae). Keine direkten `com.fasterxml.jackson.*`-Importe.
- **`@Pattern` validiert `null` nicht** — alte Clients ohne Feld bleiben gültig.
- **`MeResponse` / `MeController` bleiben unangetastet** — Gast nutzt `/api/guest/theme`, Admin `/api/admin/design`; beide liefern `RestaurantThemeDto`.
- **`frontend/src/main/resources/static`** ist generiert und gitignored — nie von Hand editieren. Nur unter `frontend/` arbeiten.
- **`frontend/admin.html` + `frontend/public/js/admin.js`** sind die ALTE Stack-Fassung (Inline-`onclick`, Inline-`style`, HTML-Entities `&uuml;` statt Umlaute) — dem bestehenden Stil dieser Dateien folgen, KEINEN Build-Schritt für `admin.js` einführen (wird 1:1 ausgeliefert).
- **CSS-Familiennamen exakt:** `"Manrope Variable"`, `"Sora Variable"`, `"DM Serif Display"`.
- **`@fontsource`-Pakete brauchen Netz** — `npm install` lokal ausführen, `package-lock.json` mit committen (der Maven-Build läuft `npm ci` offline).
- **Prüfnetz:** Backend `mvn clean test`; Frontend `cd frontend && npm run build && npm test`. Nach Änderungen `mvn clean …` (Zeitstempel-Falle auf Windows).

### Enum-Werte (verbindlich)

`displayFont` neu: `BRICOLAGE | FRAUNCES | SPACE_GROTESK | INSTRUMENT_SERIF | MANROPE | SORA | DM_SERIF` (Standard `BRICOLAGE`).
Frontend-Abbildung: `MANROPE → data-font="manrope"`, `SORA → "sora"`, `DM_SERIF → "dmserif"` (die bestehenden: `FRAUNCES → "fraunces"`, `SPACE_GROTESK → "space"`, `INSTRUMENT_SERIF → "iserif"`, `BRICOLAGE → Attribut fehlt`).
`darkMode`: `Boolean` nullable, `null` = hell (kein `data-theme`), `true` = `data-theme="dark"`.

### Die fünf Vorlagen (Werte verbindlich)

| Schlüssel | `styleShape` | `displayFont` | `accentColor` | `backgroundColor` | `darkMode` | `cartFlyStyle` | `orderConfirmStyle` | Anzeigename |
|---|---|---|---|---|---|---|---|---|
| `bistro` | `SOFT` | `FRAUNCES` | `#b3502e` | `#f7f4ef` | `false` | `PHOTO` | `STAMP` | Bistro |
| `kasse` | `SQUARE` | `BRICOLAGE` | `#1f3d34` | `#f6f6f4` | `false` | `PLUS` | `STAMP` | Kasse |
| `nacht` | `SQUARE` | `SPACE_GROTESK` | `#c9a227` | `#15181a` | `true` | `PHOTO` | `CHECK` | Nacht |
| `frisch` | `SOFT` | `MANROPE` | `#0f9d8f` | `#ffffff` | `false` | `PHOTO` | `CHECK` | Frisch |
| `klassik` | `SQUARE` | `DM_SERIF` | `#1a1a1a` | `#faf9f6` | `false` | `PLUS` | `CHECK` | Klassik |

---

## File Structure

**Backend (ändern):**
- `src/main/java/com/orderxpress/domain/Restaurant.java` — Feld `darkMode` + `isDarkMode()` / `setDarkMode(boolean)`.
- `src/main/java/com/orderxpress/web/dto/DesignRequest.java` — `Boolean darkMode` + `darkModeOrDefault()`; `displayFont`-`@Pattern` um 3 Werte.
- `src/main/java/com/orderxpress/web/dto/RestaurantThemeDto.java` — `boolean darkMode` ans Ende.
- `src/main/java/com/orderxpress/service/RestaurantAdminService.java` — `updateDesign` setzt `darkMode`, `buildTheme` reicht `isDarkMode()` durch.
- `src/test/java/com/orderxpress/DarkModeAndFontsIntegrationTest.java` (neu).

**Frontend-Fundament (ändern):**
- `frontend/package.json` / `frontend/package-lock.json` — 3 `@fontsource`-Pakete.
- `frontend/src/styles/fonts.ts` — 3 Importe.
- `frontend/src/styles/tokens.css` — 3 `:root[data-font="…"]`-Blöcke.
- `frontend/src/lib/theme.ts` — `SCHRIFT`-Map um 3 Werte; `LadenDesign.font`-Kommentar.
- `frontend/src/lib/types.ts` — `LadenTheme.darkMode: boolean`.
- `frontend/src/pages/guest/laden-design.ts` — `wendeThemeAn` reicht `dunkel: theme.darkMode` durch; Dateikopf-Kommentar aktualisieren.
- `frontend/src/lib/theme.test.ts` — Fall für eine neue Schrift-Zuordnung + `dunkel`-Fall (falls noch nicht vorhanden).

**Admin (ändern, alte Dateien):**
- `frontend/admin.html` — Vorlagen-Reihe, Hell/Dunkel-Schalter, 3 neue `<option>`s.
- `frontend/public/js/admin.js` — `VORLAGEN`-Konstante, `applyVorlage`, `loadDesign`/`saveDesign` um `darkMode`.

**Nicht geändert:** `MeResponse`, `MeController`, die Gäste-Seiten-Module außer `types.ts`/`laden-design.ts`/`theme.ts`.

---

## Task 1: Backend — `darkMode` + drei neue Schrift-Werte

**Files:**
- Modify: `src/main/java/com/orderxpress/domain/Restaurant.java` (nach `orderConfirmStyle`-Feld / bei den Gettern nach `setOrderConfirmStyle`)
- Modify: `src/main/java/com/orderxpress/web/dto/DesignRequest.java`
- Modify: `src/main/java/com/orderxpress/web/dto/RestaurantThemeDto.java`
- Modify: `src/main/java/com/orderxpress/service/RestaurantAdminService.java:87-93` (`updateDesign`), `buildTheme` (Konstruktoraufruf-Ende)
- Test: `src/test/java/com/orderxpress/DarkModeAndFontsIntegrationTest.java` (neu)

**Interfaces:**
- Produces:
  - `Restaurant#isDarkMode(): boolean` (`darkMode != null && darkMode`), `Restaurant#setDarkMode(boolean)`.
  - `DesignRequest` mit zusätzlichem `Boolean darkMode` (letzter Record-Parameter) + `darkModeOrDefault(): boolean` (`null` → `false`). `displayFont`-Regex `BRICOLAGE|FRAUNCES|SPACE_GROTESK|INSTRUMENT_SERIF|MANROPE|SORA|DM_SERIF`.
  - `RestaurantThemeDto` mit zusätzlichem `boolean darkMode` (letzter Record-Parameter). JSON-Key `darkMode`.

- [ ] **Step 1: Failing test schreiben** — `src/test/java/com/orderxpress/DarkModeAndFontsIntegrationTest.java`

```java
package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hell/Dunkel pro Laden (neues nullable Feld darkMode) und die drei neuen
 * displayFont-Werte MANROPE / SORA / DM_SERIF. Muster wie GuestPageDesignIntegrationTest:
 * ueber /api/admin/design setzen, ueber /api/guest/theme lesen.
 */
class DarkModeAndFontsIntegrationTest extends IntegrationTestBase {

    private String design(String extra) {
        return "{\"accentColor\":\"#2563eb\",\"backgroundColor\":\"#f4f5f7\","
                + "\"categoriesAsHamburger\":false" + extra + "}";
    }

    @Test
    void darkModeWirdGesetztUndOeffentlichGelesen() throws Exception {
        Owner o = createRestaurant("dark");

        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design(",\"darkMode\":true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.darkMode").value(true));

        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.darkMode").value(true));
    }

    @Test
    void altesDesignOhneDarkModeIstHell() throws Exception {
        Owner o = createRestaurant("dark-legacy");
        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design("")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.darkMode").value(false));
    }

    @Test
    void neueSchriftenWerdenAngenommen() throws Exception {
        Owner o = createRestaurant("fonts");
        for (String font : new String[] {"MANROPE", "SORA", "DM_SERIF"}) {
            mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                            .content(design(",\"displayFont\":\"" + font + "\"")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.displayFont").value(font));
        }
    }

    @Test
    void unbekannteSchriftWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("badfont");
        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design(",\"displayFont\":\"COMIC_SANS\"")))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `mvn -q test -Dtest=DarkModeAndFontsIntegrationTest`
Expected: Kompilierfehler / FAIL — `darkMode` in `RestaurantThemeDto` unbekannt, `DesignRequest` kennt es nicht, `SORA` matcht die Regex nicht.

- [ ] **Step 3: `Restaurant.java` — Feld + Getter/Setter**

Nach dem `orderConfirmStyle`-Feld (`@Column(name = "order_confirm_style", length = 20) private String orderConfirmStyle;`) einfügen:

```java
    /**
     * true = die Gaeste-Seite nutzt die dunkle Haut (data-theme="dark"). Nullable,
     * damit bestehende Datenbanken ohne Reset auskommen; null gilt als hell.
     */
    @Column(name = "dark_mode")
    private Boolean darkMode;
```

Bei den Gettern, nach `setOrderConfirmStyle(...)` (Ende der Klasse, vor der schliessenden `}`):

```java
    /** null (alte Datensaetze) gilt als hell. */
    public boolean isDarkMode() {
        return darkMode != null && darkMode;
    }

    public void setDarkMode(boolean darkMode) {
        this.darkMode = darkMode;
    }
```

- [ ] **Step 4: `DesignRequest.java` — Feld + `@Pattern` erweitern**

Den `displayFont`-Parameter ändern:

```java
        @Pattern(regexp = "BRICOLAGE|FRAUNCES|SPACE_GROTESK|INSTRUMENT_SERIF|MANROPE|SORA|DM_SERIF",
                message = "Unbekannte Schrift.") String displayFont,
```

Nach `String orderConfirmStyle` einen weiteren Record-Parameter anhängen (Komma nicht vergessen):

```java
        @Pattern(regexp = "STAMP|CHECK",
                message = "Bestaetigung muss STAMP oder CHECK sein.") String orderConfirmStyle,
        Boolean darkMode) {
```

Neue Methode zu den `…OrDefault()`:

```java
    /** Fehlt der Wert (alte Clients), gilt "hell". */
    public boolean darkModeOrDefault() {
        return darkMode != null && darkMode;
    }
```

- [ ] **Step 5: `RestaurantThemeDto.java` — Feld anhängen**

```java
public record RestaurantThemeDto(Long id,
                                 String name,
                                 String accentColor,
                                 String backgroundColor,
                                 boolean categoriesAsHamburger,
                                 boolean kitchenDisplayEnabled,
                                 String logoUrl,
                                 String backgroundUrl,
                                 String styleShape,
                                 String displayFont,
                                 String cartFlyStyle,
                                 String orderConfirmStyle,
                                 boolean darkMode) {
}
```

- [ ] **Step 6: `RestaurantAdminService` — `updateDesign` + `buildTheme`**

In `updateDesign`, nach `restaurant.setOrderConfirmStyle(request.orderConfirmStyleOrDefault());`:

```java
        restaurant.setDarkMode(request.darkModeOrDefault());
```

In `buildTheme`, den Konstruktoraufruf-Schluss (`… restaurant.getOrderConfirmStyle());`) auf:

```java
                restaurant.getOrderConfirmStyle(),
                restaurant.isDarkMode());
```

- [ ] **Step 7: Tests laufen lassen**

Run: `mvn -q test -Dtest=DarkModeAndFontsIntegrationTest,GuestPageDesignIntegrationTest,DesignThemeIntegrationTest,KitchenDisplayIntegrationTest`
Expected: PASS (neu + Regression grün).

- [ ] **Step 8: Voller Backend-Lauf**

Run: `mvn -q clean test`
Expected: alle grün (123 + 4 neu).

- [ ] **Step 9: Commit**

```bash
git add src/main/java/com/orderxpress/domain/Restaurant.java \
        src/main/java/com/orderxpress/web/dto/DesignRequest.java \
        src/main/java/com/orderxpress/web/dto/RestaurantThemeDto.java \
        src/main/java/com/orderxpress/service/RestaurantAdminService.java \
        src/test/java/com/orderxpress/DarkModeAndFontsIntegrationTest.java
git commit -m "feat: Hell/Dunkel pro Laden + drei neue displayFont-Werte"
```

---

## Task 2: Frontend-Fundament — drei Schriften, Tokens, `darkMode`-Plumbing

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json`
- Modify: `frontend/src/styles/fonts.ts`
- Modify: `frontend/src/styles/tokens.css:121-124` (nach den bestehenden `[data-font]`-Blöcken)
- Modify: `frontend/src/lib/theme.ts:98-109` (`LadenDesign.font`-Kommentar, `SCHRIFT`-Map)
- Modify: `frontend/src/lib/types.ts:52` (Ende des `LadenTheme`-Interfaces)
- Modify: `frontend/src/pages/guest/laden-design.ts` (`wendeThemeAn`, Dateikopf)
- Modify: `frontend/src/lib/theme.test.ts`

**Interfaces:**
- Consumes: `RestaurantThemeDto.darkMode` (JSON, aus Task 1).
- Produces:
  - `LadenTheme.darkMode: boolean` (nicht optional).
  - `theme.ts` `SCHRIFT`-Map enthält `MANROPE`, `SORA`, `DM_SERIF`.
  - `wendeThemeAn(theme)` ruft `setzeLadenDesign` zusätzlich mit `dunkel: theme.darkMode`.
  - `[data-font="manrope"|"sora"|"dmserif"]`-Blöcke in `tokens.css`.

- [ ] **Step 1: `@fontsource`-Pakete hinzufügen** — im Ordner `frontend/` (BRAUCHT NETZ, lokal):

```bash
cd frontend
npm install @fontsource-variable/manrope @fontsource-variable/sora @fontsource/dm-serif-display
```

Erwartung: 3 Einträge in `package.json`, `package-lock.json` aktualisiert. Beides committen (Maven-Build läuft `npm ci` offline).

- [ ] **Step 2: `fonts.ts` erweitern**

Die drei Importe zwischen `instrument-serif` und `instrument-sans` einfügen und den Dateikopf ergänzen:

```ts
/* Schriften werden mitgeliefert - kein Aufruf an Google Fonts.
 *
 * Bricolage Grotesque  Ueberschriften/Gerichtnamen - OX-Standard (variabel)
 * Fraunces             Laden-Wahl "fraunces" (variabel, SOFT/WONK)
 * Space Grotesk        Laden-Wahl "space" (variabel)
 * Instrument Serif     Laden-Wahl "iserif" (ein Schnitt)
 * Manrope              Laden-Wahl "manrope" (variabel)
 * Sora                 Laden-Wahl "sora" (variabel)
 * DM Serif Display     Laden-Wahl "dmserif" (ein Schnitt)
 * Instrument Sans      Fliesstext und Bedienelemente (variabel)
 * IBM Plex Mono        alle Zahlen - nur die zwei benoetigten Schnitte */
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/space-grotesk";
import "@fontsource/instrument-serif";
import "@fontsource-variable/manrope";
import "@fontsource-variable/sora";
import "@fontsource/dm-serif-display";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
```

- [ ] **Step 3: `tokens.css` — drei `[data-font]`-Blöcke**

Direkt nach `:root[data-font="iserif"]  { --ox-font-display: "Instrument Serif", Georgia, serif; }` (Zeile 124) einfügen:

```css
:root[data-font="manrope"] { --ox-font-display: "Manrope Variable", system-ui, sans-serif; }
:root[data-font="sora"]    { --ox-font-display: "Sora Variable", system-ui, sans-serif; }
:root[data-font="dmserif"] { --ox-font-display: "DM Serif Display", Georgia, "Times New Roman", serif; }
```

- [ ] **Step 4: `theme.ts` — `SCHRIFT`-Map + Kommentar**

`LadenDesign.font`-Kommentar aktualisieren:

```ts
    font?: string | null;    // BRICOLAGE | FRAUNCES | SPACE_GROTESK | INSTRUMENT_SERIF | MANROPE | SORA | DM_SERIF
```

`SCHRIFT`-Map erweitern:

```ts
    const SCHRIFT: Record<string, string> = {
        FRAUNCES: "fraunces", SPACE_GROTESK: "space", INSTRUMENT_SERIF: "iserif",
        MANROPE: "manrope", SORA: "sora", DM_SERIF: "dmserif"
    };
```

(`BRICOLAGE` bleibt bewusst draußen → `undefined` → Attribut entfernt → Standard.)

- [ ] **Step 5: `types.ts` — `LadenTheme.darkMode`**

Am Ende des `LadenTheme`-Interfaces (nach `orderConfirmStyle: string;`):

```ts
    orderConfirmStyle: string;
    darkMode: boolean;
}
```

- [ ] **Step 6: `laden-design.ts` — `dunkel` durchreichen + Dateikopf**

Im Dateikopf den veralteten Absatz ersetzen:

```ts
 * "dunkel" kommt jetzt aus theme.darkMode (Backend-Feld seit 28.08.2026):
 * setzeLadenDesign setzt data-theme="dark" bzw. entfernt es. Der
 * Laden-Hintergrund-Hex bleibt fuehrend fuer --ox-text (Luminanz-Rechnung),
 * die dunkle Haut tauscht zusaetzlich Flaechen/Rahmen/Signalfarben.
```

In `wendeThemeAn` den `setzeLadenDesign`-Aufruf:

```ts
    setzeLadenDesign({
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        shape: theme.styleShape,
        font: theme.displayFont,
        dunkel: theme.darkMode
    });
```

- [ ] **Step 7: `theme.test.ts` — zwei Fälle**

In den bestehenden `describe("setzeLadenDesign Form/Schrift", …)`-Block (oder einen neuen) aufnehmen:

```ts
    it("MANROPE setzt data-font=manrope", () => {
        setzeLadenDesign({ font: "MANROPE" });
        expect(document.documentElement.getAttribute("data-font")).toBe("manrope");
    });

    it("dunkel=true setzt data-theme=dark, dunkel=false entfernt es", () => {
        setzeLadenDesign({ dunkel: true });
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
        setzeLadenDesign({ dunkel: false });
        expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });
```

`afterEach` muss `data-theme` mit aufräumen (falls noch nicht): `document.documentElement.removeAttribute("data-theme")`.

- [ ] **Step 8: `LadenTheme`-Verwender prüfen**

Run: `cd frontend && grep -rl "styleShape" src` — jede Stelle, die ein `LadenTheme`-Objekt-Literal baut, um `darkMode: false` ergänzen. `tsc --noEmit` (Step 9) zeigt fehlende Stellen.

- [ ] **Step 9: Build + Tests**

Run: `cd frontend && npm run build && npm test`
Expected: `tsc --noEmit` grün, Vite-Build OK (die 3 Font-Pakete lösen auf), Vitest grün (+2 neue theme-Fälle).

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/package-lock.json \
        frontend/src/styles/fonts.ts frontend/src/styles/tokens.css \
        frontend/src/lib/theme.ts frontend/src/lib/theme.test.ts \
        frontend/src/lib/types.ts frontend/src/pages/guest/laden-design.ts
git commit -m "feat: drei Schriften (Manrope/Sora/DM Serif) + darkMode aus dem Theme anwenden"
```

---

## Task 3: Admin — Vorlagen-Reihe, Hell/Dunkel-Schalter, neue Schriften

**Files:**
- Modify: `frontend/admin.html:63-113` (Design-Karten-`.mini-form`)
- Modify: `frontend/public/js/admin.js:495-532` (`loadDesign` / `saveDesign`) + neue `VORLAGEN`/`applyVorlage` im `Admin`-Objekt

**Interfaces:**
- Consumes: `RestaurantThemeDto.darkMode` + die neuen `displayFont`-Werte (Task 1); nichts aus Task 2 (Admin ist alte Fassung, kein Import).
- Produces: keine — Endpunkt.

- [ ] **Step 1: `admin.html` — Vorlagen-Reihe (oben in der `.mini-form`)**

Direkt nach `<div class="mini-form">` (Zeile 63), VOR dem Akzentfarbe-`<div>`:

```html
                <div class="full">
                    <label style="margin-bottom:4px">Vorlage</label>
                    <p class="muted" style="margin:0 0 6px">Eine Vorlage f&uuml;llt alle Felder unten - danach bei Bedarf einzeln anpassen, dann speichern.</p>
                    <div class="row">
                        <button class="small" onclick="Admin.applyVorlage('bistro')">Bistro</button>
                        <button class="small" onclick="Admin.applyVorlage('kasse')">Kasse</button>
                        <button class="small" onclick="Admin.applyVorlage('nacht')">Nacht</button>
                        <button class="small" onclick="Admin.applyVorlage('frisch')">Frisch</button>
                        <button class="small" onclick="Admin.applyVorlage('klassik')">Klassik</button>
                    </div>
                </div>
```

- [ ] **Step 2: `admin.html` — Hell/Dunkel-Schalter**

Nach dem `design-kitchen`-`<div class="full check">` (endet Zeile 80), vor dem `design-shape`-`<div>`:

```html
                <div class="full check">
                    <input type="checkbox" id="design-dark">
                    <label for="design-dark" style="margin:0">Dunkle Haut verwenden
                        <span class="muted">(hell/dunkel; Vorlage &bdquo;Nacht&ldquo; nutzt dunkel)</span></label>
                </div>
```

- [ ] **Step 3: `admin.html` — drei neue Schrift-`<option>`s**

Im `design-font`-`<select>` nach `<option value="INSTRUMENT_SERIF">Instrument Serif</option>`:

```html
                        <option value="MANROPE">Manrope</option>
                        <option value="SORA">Sora</option>
                        <option value="DM_SERIF">DM Serif Display</option>
```

- [ ] **Step 4: `admin.js` — `loadDesign` / `saveDesign` um `darkMode`**

In `loadDesign`, nach `document.getElementById("design-confirm").value = t.orderConfirmStyle || "CHECK";`:

```js
            document.getElementById("design-dark").checked = t.darkMode === true;
```

In `saveDesign`, im `body`-Objekt nach `orderConfirmStyle: …`:

```js
                    orderConfirmStyle: document.getElementById("design-confirm").value,
                    darkMode: document.getElementById("design-dark").checked
```

- [ ] **Step 5: `admin.js` — `VORLAGEN` + `applyVorlage`**

Im `Admin`-Objekt, direkt vor `async loadDesign() {` (Zeile 495), einfügen:

```js
    /* Feste Design-Vorlagen (nur Frontend). applyVorlage() fuellt die Felder,
       gespeichert wird ueber den normalen "Speichern"-Knopf. */
    VORLAGEN: {
        bistro:  { accentColor: "#b3502e", backgroundColor: "#f7f4ef", darkMode: false,
                   styleShape: "SOFT",   displayFont: "FRAUNCES",      cartFlyStyle: "PHOTO", orderConfirmStyle: "STAMP" },
        kasse:   { accentColor: "#1f3d34", backgroundColor: "#f6f6f4", darkMode: false,
                   styleShape: "SQUARE", displayFont: "BRICOLAGE",     cartFlyStyle: "PLUS",  orderConfirmStyle: "STAMP" },
        nacht:   { accentColor: "#c9a227", backgroundColor: "#15181a", darkMode: true,
                   styleShape: "SQUARE", displayFont: "SPACE_GROTESK", cartFlyStyle: "PHOTO", orderConfirmStyle: "CHECK" },
        frisch:  { accentColor: "#0f9d8f", backgroundColor: "#ffffff", darkMode: false,
                   styleShape: "SOFT",   displayFont: "MANROPE",       cartFlyStyle: "PHOTO", orderConfirmStyle: "CHECK" },
        klassik: { accentColor: "#1a1a1a", backgroundColor: "#faf9f6", darkMode: false,
                   styleShape: "SQUARE", displayFont: "DM_SERIF",      cartFlyStyle: "PLUS",  orderConfirmStyle: "CHECK" }
    },

    applyVorlage(name) {
        const v = this.VORLAGEN[name];
        if (!v) return;
        document.getElementById("design-accent").value = v.accentColor;
        document.getElementById("design-bg").value = v.backgroundColor;
        document.getElementById("design-dark").checked = v.darkMode;
        document.getElementById("design-shape").value = v.styleShape;
        document.getElementById("design-font").value = v.displayFont;
        document.getElementById("design-fly").value = v.cartFlyStyle;
        document.getElementById("design-confirm").value = v.orderConfirmStyle;
        OX.toast("Vorlage '" + name + "' uebernommen - jetzt speichern");
    },
```

(Komma nach dem schliessenden `},` von `applyVorlage` nicht vergessen — es folgt `async loadDesign()`.)

- [ ] **Step 6: Frontend-Build**

Run: `cd frontend && npm run build && npm test`
Expected: Vite-Build OK (kopiert `public/js/admin.js` + `admin.html` nach `static/`), Vitest unverändert grün (keine Tests für die alte Admin-Fassung).

- [ ] **Step 7: Manuelle Prüfung**

App starten (`mvn spring-boot:run`), `http://localhost:8080/admin.html`, Login `inhaber` / `inhaber123`:
- Die fünf Vorlagen-Knöpfe erscheinen über den Feldern.
- Klick „Nacht" → Akzent `#c9a227`, Hintergrund `#15181a`, Haken bei „Dunkle Haut", Form „Eckig", Schrift „Space Grotesk", Flieger „Gericht-Foto", Bestätigung „Grüner Haken". Toast erscheint.
- „Speichern" → Bestätigung. Seite neu laden → Werte erhalten, „Dunkle Haut" angehakt.
- Gäste-Seite (`/t/<token>`, Tisch freigeben) neu laden → dunkle Haut, lesbarer Text, Space Grotesk in den Überschriften.
- Eine der neuen Schriften (Manrope) einzeln wählen + speichern → greift auf der Gäste-Seite.

- [ ] **Step 8: Commit**

```bash
git add frontend/admin.html frontend/public/js/admin.js
git commit -m "feat: fuenf Design-Vorlagen + Hell/Dunkel-Schalter + drei Schriften im Admin"
```

---

## Task 4: Gesamtlauf + CLAUDE.md

- [ ] **Step 1: Backend + Frontend gesamt**

Run: `mvn -q clean test` → alle grün.
Run: `cd frontend && npm run build && npm test` → grün, `static/` frisch gebaut.

- [ ] **Step 2: `CLAUDE.md`** — im „Neu (28.08.2026)"-Abschnitt ergänzen (oder einen zweiten 28.08.-Eintrag): fünf Frontend-Design-Vorlagen im Admin (`Admin.VORLAGEN`/`applyVorlage`, kein Server-Zustand), drei zusätzliche Schriften (`MANROPE`/`SORA`/`DM_SERIF`, `@fontsource` + `[data-font]`-Blöcke + `SCHRIFT`-Map), neues nullable `Restaurant.darkMode` (null = hell, kein DB-Reset) plus Hell/Dunkel-Schalter in der Design-Karte.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Design-Vorlagen + Schriften + Hell/Dunkel in der Uebergabe"
```

---

## Self-Review (durchgeführt)

**Spec-Abdeckung:** Spec §1 Vorlagen-Klick → Task 3 (`applyVorlage` + Reihe). §2 `darkMode` → Task 1 (Feld) + Task 2 (Gast wendet an) + Task 3 (Schalter). §3 sieben Schriften → Task 1 (Regex) + Task 2 (`@fontsource`/Tokens/`SCHRIFT`) + Task 3 (`<option>`s). §4 Backend → Task 1. §5 Gäste-Seite → Task 2. §6 Admin → Task 3. §7/§8 → Task 4.

**Abweichungen von der Spec:** Testklasse heißt `DarkModeAndFontsIntegrationTest` (Spec ließ „neu oder Erweiterung" offen — hier als neue Klasse festgelegt).

**Platzhalter:** keine — jeder Code-Schritt mit vollständigem Code.

**Typkonsistenz:** `darkMode` durchgängig `boolean` (Java-DTO/`RestaurantThemeDto`/`LadenTheme`), `Boolean` nur als Record-Eingang in `DesignRequest` mit `darkModeOrDefault()`. `isDarkMode()` (Restaurant) vs. `darkModeOrDefault()` (DesignRequest) — beide `null → false`, in Task 1 konsistent verwendet. Schrift-Schlüssel `MANROPE|SORA|DM_SERIF` und `[data-font]`-Werte `manrope|sora|dmserif` identisch in Task 1/2/3. `Admin.VORLAGEN`-Feldnamen = die `document.getElementById`-Ziele in Task 3 Step 5.
