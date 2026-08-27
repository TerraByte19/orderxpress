# Gäste-Seite: Bewegung + Laden-Stile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Gäste-Seite bekommt durchgehend Bewegung (14 Effekte) und vier neue, pro Laden einstellbare Design-Achsen (Form, Schrift, Warenkorb-Flieger, Bestell-Bestätigung).

**Architecture:** Vier nullable Spalten an `Restaurant` (Muster wie `kitchenDisplayEnabled`), ausgeliefert über den bestehenden `RestaurantThemeDto`. Das Frontend (Vite/TypeScript, Gäste-Seite bereits modularisiert) setzt `data-shape`/`data-font` auf `<html>` und liest Flieger-/Bestätigungs-Modus als Modulzustand. Animationen liegen zentral in `animation.css` + neuem Helfer `animation.ts`; der Kassenbon-Warenkorb bekommt ein kleines Modul `bon.ts`. Alle Animationen stehen hinter dem bestehenden `prefers-reduced-motion`-Ausschalter.

**Tech Stack:** Java 17 / Spring Boot 4.1, H2 (`ddl-auto: update`), JUnit 6 + MockMvc; Frontend Vite 6 + TypeScript 5.7, Vitest (jsdom), `@fontsource`-Pakete.

## Global Constraints

- **Bezeichner Englisch, Kommentare/Meldungen Deutsch.** In `.java`-Dateien ASCII-Umschreibung (ue/oe/ae). In `.ts`/`.css`/`.md` sind echte Umlaute erlaubt.
- **Keine direkten `com.fasterxml.jackson`-Importe.** Records + jakarta-Validation genügen.
- **Neue Spalten immer `nullable`.** `ddl-auto: update` muss ohne DB-Reset durchlaufen. `data/` niemals löschen, solange eine Instanz auf Port 8080 läuft.
- **`src/main/resources/static/` ist generiert und gitignored.** Nie dort editieren — nur unter `frontend/`.
- **Kein fester Farb-/Abstands-/Größenwert in CSS** außerhalb von `tokens.css` — immer `var(--ox-...)`. **Ausgenommen: reine Bewegungs-Geometrie in `animation.css` / `guest-motion.css` / `@keyframes`** — Transform-Versätze (`translateY(16px)`), Rotationswinkel (`rotate(-14deg)`), Keyframe-Prozente, `z-index`-Stapelung, `font-weight`, `border-radius: 50%` und einmalige `cubic-bezier(...)`-Kurven für einen bestimmten Effekt sind KEINE Design-Tokens und dürfen dort als Literal stehen. Farben, Abstände, Radien-Token (`--ox-radius-*`), Dauern und die zwei benannten Easings (`--ox-ease-out`/`--ox-ease-spring`) bleiben Pflicht als `var(--ox-...)`.
- **Kein `onclick`/Inline-Style in neuem HTML.** (Die alte `admin.html` nutzt beides bereits — dort dem bestehenden Stil folgen.)
- **Keine Datei über ~250 Zeilen**, außer der bereits bewusst größeren `frontend/src/pages/guest/index.ts` (~537 Zeilen) — dort NICHTS Größeres hinzufügen, neue Logik kommt in neue Module. **Neue Gäste-Seiten-CSS-Regeln (neue Selektoren, `@keyframes`, `transition`/`animation`) gehören in `frontend/src/pages/guest/guest-motion.css`** (in Task 2 angelegt, von `guest.css` per `@import` eingebunden); `guest.css` selbst wird nur an BESTEHENDEN Selektoren geändert (z. B. Karten-Layout), damit es unter ~250 Zeilen bleibt.
- **Kein zweiter Netzwerk-Takt** auf der Gäste-Seite. Alle Live-Effekte hängen an der bestehenden 3-Sekunden-Statusabfrage.
- **Prüfnetz:** `mvn clean test` (~76 Integrationstests + neue), `frontend/`: `npm test`, `test-api.ps1` (33/33). Nach Claude-Änderungen `mvn clean ...` (Zeitstempel-Falle).
- **Referenz-Muster mit funktionierendem Animationscode:** `guest-prototype.html` (im Arbeitsverzeichnis der Brainstorming-Sitzung; nicht eingecheckt). Die CSS-`@keyframes` und JS-Helfer dort sind die Vorlage für die Frontend-Tasks — Werte übernehmen, aber in Tokens/Variablen überführen.

### Enum-Werte (verbindlich, überall gleich)

| Feld | Erlaubte Werte | Standard (bei `null`/leer) |
|---|---|---|
| `styleShape` | `SQUARE`, `SOFT` | `SQUARE` |
| `displayFont` | `BRICOLAGE`, `FRAUNCES`, `SPACE_GROTESK`, `INSTRUMENT_SERIF` | `BRICOLAGE` |
| `cartFlyStyle` | `PLUS`, `PHOTO` | `PLUS` |
| `orderConfirmStyle` | `STAMP`, `CHECK` | `CHECK` |

Frontend-Abbildung: `SQUARE→data-shape=square` (Standard, Attribut kann auch fehlen), `SOFT→soft`; `BRICOLAGE→bricolage`, `FRAUNCES→fraunces`, `SPACE_GROTESK→space`, `INSTRUMENT_SERIF→iserif`.

---

## File Structure

**Backend (ändern):**
- `src/main/java/com/orderxpress/domain/Restaurant.java` — 4 String-Felder + auflösende Getter/Setter.
- `src/main/java/com/orderxpress/web/dto/DesignRequest.java` — 4 Felder + `@Pattern` + `…OrDefault()`.
- `src/main/java/com/orderxpress/web/dto/RestaurantThemeDto.java` — 4 Felder ans Ende.
- `src/main/java/com/orderxpress/service/RestaurantAdminService.java` — `updateDesign` setzt sie, `buildTheme` liefert sie.
- `src/test/java/com/orderxpress/GuestPageDesignIntegrationTest.java` (neu) — die 4 Achsen.

**Frontend — Fundament (ändern):**
- `frontend/package.json`, `frontend/src/styles/fonts.ts` — 3 neue `@fontsource`-Pakete.
- `frontend/src/styles/tokens.css` — Bewegungs-Tokens, `[data-shape="soft"]`, `[data-font="…"]`.
- `frontend/src/styles/animation.css` (neu) — alle globalen `@keyframes` + Bewegungsklassen.
- `frontend/src/styles/app.css` — `animation.css` importieren.
- `frontend/src/pages/guest/guest-motion.css` (neu) — alle NEUEN Bewegungs-/Animationsregeln der Gäste-Seite; von `guest.css` per `@import` eingebunden.
- `frontend/src/lib/types.ts` — `LadenTheme` + 4 Felder.
- `frontend/src/lib/theme.ts` — `LadenDesign` + `shape`/`font`; `setzeLadenDesign` setzt die Attribute.
- `frontend/src/pages/guest/laden-design.ts` — `wendeThemeAn` gibt Flieger-/Bestätigungs-Modus zurück.

**Frontend — Gäste-Seite (ändern/neu):**
- `frontend/src/pages/guest/animation.ts` (neu) — `staffelEin`, `fliegeZu`, `mitAnsichtsWechsel`.
- `frontend/src/pages/guest/bon.ts` (neu) — `bestaetigeBestellung`, `fliegeBonWeg`.
- `frontend/src/pages/guest/menu.ts` — Thumbnail-Karte, Stagger-Aufruf, gleitender Kategorie-Strich, Flieger am „+".
- `frontend/src/pages/guest/orders.ts` — Chip morpht in place + blinkender Punkt.
- `frontend/src/pages/guest/ansichten.ts` — `aktualisiereTischmarke(nr, wartet)`.
- `frontend/src/pages/guest/index.ts` — Modus-Zustand, Verdrahtung: Bon-Klassen, Bestätigung, Ansichtswechsel über `mitAnsichtsWechsel`.
- `frontend/src/pages/guest/guest.css` — nur BESTEHENDE Selektoren ändern (Thumbnail-Karten-Layout) + `@import "./guest-motion.css";` am Anfang.
- `frontend/src/pages/guest/guest-motion.css` — Kategorie-Strich, Warte-Puls, Bon-Perforierung + Zeilen-Tippen, Stempel/Haken, Chip-Übergang, Tischmarke-Zustände.
- `frontend/guest.html` — `#view-wait` Puls-Markup.
- Tests: `animation.test.ts` (neu), Anpassungen in `menu.test.ts` / `orders.test.ts`.

**Admin (ändern, alte Dateien):**
- `frontend/admin.html` — 4 `<select>` in der Design-Karte.
- `frontend/public/js/admin.js` — `loadDesign`/`saveDesign` um 4 Felder.

**Bewusst NICHT geändert:** `MeResponse`/`MeController` (die Gäste-Seite nutzt `/api/guest/theme`, die Admin-Karte `/api/admin/design` — beide liefern `RestaurantThemeDto`; `/api/me` braucht die Felder nicht). `cart.ts` (reines Datenmodul, bleibt).

---

## Task 1: Backend — vier Design-Felder

**Files:**
- Modify: `src/main/java/com/orderxpress/domain/Restaurant.java`
- Modify: `src/main/java/com/orderxpress/web/dto/DesignRequest.java`
- Modify: `src/main/java/com/orderxpress/web/dto/RestaurantThemeDto.java`
- Modify: `src/main/java/com/orderxpress/service/RestaurantAdminService.java:85-93` (`updateDesign`), `:196-208` (`buildTheme`)
- Test: `src/test/java/com/orderxpress/GuestPageDesignIntegrationTest.java` (neu)

**Interfaces:**
- Produces:
  - `Restaurant#getStyleShape(): String` / `setStyleShape(String)` (Getter liefert `"SQUARE"` bei null/blank; analog `getDisplayFont`→`"BRICOLAGE"`, `getCartFlyStyle`→`"PLUS"`, `getOrderConfirmStyle`→`"CHECK"`).
  - `DesignRequest` mit zusätzlich `String styleShape, String displayFont, String cartFlyStyle, String orderConfirmStyle` und `styleShapeOrDefault()` / `displayFontOrDefault()` / `cartFlyStyleOrDefault()` / `orderConfirmStyleOrDefault()`.
  - `RestaurantThemeDto` mit vier zusätzlichen `String`-Feldern am Ende: `styleShape, displayFont, cartFlyStyle, orderConfirmStyle` (JSON-Keys gleichnamig).

- [ ] **Step 1: Failing test schreiben** — `src/test/java/com/orderxpress/GuestPageDesignIntegrationTest.java`

```java
package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Vier pro Laden einstellbare Achsen der Gaeste-Seite: Form, Ueberschrift-Schrift,
 * Warenkorb-Flieger und Bestell-Bestaetigung. Muster wie KitchenDisplayIntegrationTest:
 * Wert ueber /api/admin/design setzen, ueber das oeffentliche /api/guest/theme lesen.
 */
class GuestPageDesignIntegrationTest extends IntegrationTestBase {

    private String design(String extra) {
        return "{\"accentColor\":\"#2563eb\",\"backgroundColor\":\"#f4f5f7\","
                + "\"categoriesAsHamburger\":false" + extra + "}";
    }

    @Test
    void vierAchsenWerdenGesetztUndOeffentlichGelesen() throws Exception {
        Owner o = createRestaurant("axes");

        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design(",\"styleShape\":\"SOFT\",\"displayFont\":\"FRAUNCES\","
                                + "\"cartFlyStyle\":\"PHOTO\",\"orderConfirmStyle\":\"STAMP\"")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.styleShape").value("SOFT"))
                .andExpect(jsonPath("$.displayFont").value("FRAUNCES"))
                .andExpect(jsonPath("$.cartFlyStyle").value("PHOTO"))
                .andExpect(jsonPath("$.orderConfirmStyle").value("STAMP"));

        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.styleShape").value("SOFT"))
                .andExpect(jsonPath("$.displayFont").value("FRAUNCES"))
                .andExpect(jsonPath("$.cartFlyStyle").value("PHOTO"))
                .andExpect(jsonPath("$.orderConfirmStyle").value("STAMP"));
    }

    @Test
    void altesDesignOhneAchsenLiefertStandardwerte() throws Exception {
        Owner o = createRestaurant("axes-legacy");
        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design("")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.styleShape").value("SQUARE"))
                .andExpect(jsonPath("$.displayFont").value("BRICOLAGE"))
                .andExpect(jsonPath("$.cartFlyStyle").value("PLUS"))
                .andExpect(jsonPath("$.orderConfirmStyle").value("CHECK"));

        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(jsonPath("$.displayFont").value("BRICOLAGE"));
    }

    @Test
    void ungueltigerWertWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("axes-bad");
        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design(",\"styleShape\":\"ROUND\"")))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `mvn -q test -Dtest=GuestPageDesignIntegrationTest`
Expected: Kompilierfehler bzw. FAIL — `RestaurantThemeDto` kennt die Felder nicht, `DesignRequest` auch nicht.

- [ ] **Step 3: `Restaurant.java` erweitern**

Nach `kitchenDisplayEnabled` (Zeile ~61) einfügen:

```java
    /** Form der Gaeste-Seite: "SQUARE" (eckig) oder "SOFT" (weiche Radien). null/leer = SQUARE. */
    @Column(name = "style_shape", length = 20)
    private String styleShape;

    /** Ueberschrift-/Gerichtnamen-Schrift: BRICOLAGE | FRAUNCES | SPACE_GROTESK | INSTRUMENT_SERIF. null/leer = BRICOLAGE. */
    @Column(name = "display_font", length = 30)
    private String displayFont;

    /** Was beim Hinzufuegen zum Warenkorb-Zaehler fliegt: "PLUS" oder "PHOTO". null/leer = PLUS. */
    @Column(name = "cart_fly_style", length = 20)
    private String cartFlyStyle;

    /** Bestaetigung nach dem Bestellen: "STAMP" (Stempel) oder "CHECK" (Haken). null/leer = CHECK. */
    @Column(name = "order_confirm_style", length = 20)
    private String orderConfirmStyle;
```

Getter/Setter (auflösend, Muster wie `isKitchenDisplayEnabled`):

```java
    private static String orDefault(String wert, String fallback) {
        return (wert == null || wert.isBlank()) ? fallback : wert;
    }

    public String getStyleShape() { return orDefault(styleShape, "SQUARE"); }
    public void setStyleShape(String v) { this.styleShape = v; }

    public String getDisplayFont() { return orDefault(displayFont, "BRICOLAGE"); }
    public void setDisplayFont(String v) { this.displayFont = v; }

    public String getCartFlyStyle() { return orDefault(cartFlyStyle, "PLUS"); }
    public void setCartFlyStyle(String v) { this.cartFlyStyle = v; }

    public String getOrderConfirmStyle() { return orDefault(orderConfirmStyle, "CHECK"); }
    public void setOrderConfirmStyle(String v) { this.orderConfirmStyle = v; }
```

- [ ] **Step 4: `DesignRequest.java` erweitern**

```java
public record DesignRequest(
        @NotBlank @Pattern(regexp = "#[0-9a-fA-F]{6}",
                message = "Farbe muss ein Hex-Wert wie #2563eb sein.") String accentColor,
        @NotBlank @Pattern(regexp = "#[0-9a-fA-F]{6}",
                message = "Farbe muss ein Hex-Wert wie #f4f5f7 sein.") String backgroundColor,
        Boolean categoriesAsHamburger,
        Boolean kitchenDisplayEnabled,
        @Pattern(regexp = "SQUARE|SOFT",
                message = "Form muss SQUARE oder SOFT sein.") String styleShape,
        @Pattern(regexp = "BRICOLAGE|FRAUNCES|SPACE_GROTESK|INSTRUMENT_SERIF",
                message = "Unbekannte Schrift.") String displayFont,
        @Pattern(regexp = "PLUS|PHOTO",
                message = "Flieger muss PLUS oder PHOTO sein.") String cartFlyStyle,
        @Pattern(regexp = "STAMP|CHECK",
                message = "Bestaetigung muss STAMP oder CHECK sein.") String orderConfirmStyle) {

    public boolean hamburgerOrDefault() {
        return categoriesAsHamburger != null && categoriesAsHamburger;
    }

    public boolean kitchenEnabledOrDefault() {
        return kitchenDisplayEnabled == null || kitchenDisplayEnabled;
    }

    public String styleShapeOrDefault() {
        return (styleShape == null || styleShape.isBlank()) ? "SQUARE" : styleShape;
    }

    public String displayFontOrDefault() {
        return (displayFont == null || displayFont.isBlank()) ? "BRICOLAGE" : displayFont;
    }

    public String cartFlyStyleOrDefault() {
        return (cartFlyStyle == null || cartFlyStyle.isBlank()) ? "PLUS" : cartFlyStyle;
    }

    public String orderConfirmStyleOrDefault() {
        return (orderConfirmStyle == null || orderConfirmStyle.isBlank()) ? "CHECK" : orderConfirmStyle;
    }
}
```

Hinweis: `@Pattern` validiert `null` nicht — alte Clients ohne die Felder bleiben gültig (bestehende `DesignThemeIntegrationTest`-Fälle).

- [ ] **Step 5: `RestaurantThemeDto.java` erweitern**

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
                                 String orderConfirmStyle) {
}
```

- [ ] **Step 6: `RestaurantAdminService` — `updateDesign` und `buildTheme`**

In `updateDesign` (nach `setKitchenDisplayEnabled`):

```java
        restaurant.setStyleShape(request.styleShapeOrDefault());
        restaurant.setDisplayFont(request.displayFontOrDefault());
        restaurant.setCartFlyStyle(request.cartFlyStyleOrDefault());
        restaurant.setOrderConfirmStyle(request.orderConfirmStyleOrDefault());
```

In `buildTheme` den Konstruktoraufruf ergänzen (nach `backgroundUrl`):

```java
                kinds.contains(AssetKind.BACKGROUND) ? base + "/background" : null,
                restaurant.getStyleShape(),
                restaurant.getDisplayFont(),
                restaurant.getCartFlyStyle(),
                restaurant.getOrderConfirmStyle());
```

- [ ] **Step 7: Tests laufen lassen**

Run: `mvn -q test -Dtest=GuestPageDesignIntegrationTest,DesignThemeIntegrationTest,KitchenDisplayIntegrationTest`
Expected: PASS (neu + Regression grün).

- [ ] **Step 8: Voller Backend-Lauf**

Run: `mvn -q clean test`
Expected: alle ~76 + 3 neue grün.

- [ ] **Step 9: Commit**

```bash
git add src/main/java/com/orderxpress/domain/Restaurant.java \
        src/main/java/com/orderxpress/web/dto/DesignRequest.java \
        src/main/java/com/orderxpress/web/dto/RestaurantThemeDto.java \
        src/main/java/com/orderxpress/service/RestaurantAdminService.java \
        src/test/java/com/orderxpress/GuestPageDesignIntegrationTest.java
git commit -m "feat: vier Design-Achsen pro Laden (Form, Schrift, Flieger, Bestaetigung)"
```

---

## Task 2: Frontend-Fundament — Schriften, Tokens, animation.css

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/styles/fonts.ts`
- Modify: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/animation.css`
- Modify: `frontend/src/styles/app.css`
- Create: `frontend/src/pages/guest/guest-motion.css` (Skelett)
- Modify: `frontend/src/pages/guest/guest.css` (`@import` am Anfang)

**Interfaces:**
- Produces (für alle folgenden Frontend-Tasks):
  - CSS-Variablen in `:root`: `--ox-ease-out`, `--ox-ease-spring`, `--ox-dur-fast` (140ms), `--ox-dur` (260ms), `--ox-dur-slow` (460ms).
  - `<html>`-Attribute: `data-shape="soft"` überschreibt `--ox-radius-{sm,md,lg}`; `data-font="{bricolage|fraunces|space|iserif}"` überschreibt `--ox-font-display`. Standard (Attribut fehlt) = eckig / Bricolage.
  - Klassen aus `animation.css`: `.ox-anim-stagger` (Startzustand unsichtbar+versetzt) / `.ox-anim-stagger.is-in` (sichtbar), `.ox-flieger`, `.ox-bon--weg`. `@keyframes`: `ox-atmen`, `ox-welle`, `ox-schnapp`, `ox-pop`, `ox-zeile-rein`, `ox-stempeln`, `ox-haken-zeichnen`, `ox-blinken`.

- [ ] **Step 1: `@fontsource`-Pakete hinzufügen** — im Ordner `frontend/` (BRAUCHT NETZ, lokal ausführen):

```bash
cd frontend
npm install @fontsource-variable/bricolage-grotesque @fontsource-variable/space-grotesk @fontsource/instrument-serif
```

Erwartung: `package.json` bekommt 3 Einträge, `package-lock.json` wird aktualisiert. (Im `frontend-maven-plugin`-Build läuft `npm ci` aus dem Lockfile — dieser Schritt MUSS committet sein, sonst schlägt der Maven-Build ohne Netz fehl.)

- [ ] **Step 2: `fonts.ts` erweitern**

```ts
/* Schriften werden mitgeliefert - kein Aufruf an Google Fonts.
 *
 * Bricolage Grotesque  Ueberschriften/Gerichtnamen - OX-Standard (variabel)
 * Fraunces             dito, als Laden-Wahl "fraunces" (variabel)
 * Space Grotesk        dito, als Laden-Wahl "space" (variabel)
 * Instrument Serif     dito, als Laden-Wahl "iserif" (ein Schnitt)
 * Instrument Sans      Fliesstext und Bedienelemente (variabel)
 * IBM Plex Mono        alle Zahlen - nur die zwei benoetigten Schnitte */
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/space-grotesk";
import "@fontsource/instrument-serif";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
```

- [ ] **Step 3: `tokens.css` — Bewegungs-Tokens**

In den `:root`-Block (nach den Schatten-Tokens):

```css
    /* --- Bewegung --- */
    --ox-ease-out: cubic-bezier(.2, .7, .2, 1);
    --ox-ease-spring: cubic-bezier(.34, 1.56, .64, 1);
    --ox-dur-fast: 140ms;
    --ox-dur: 260ms;
    --ox-dur-slow: 460ms;
```

- [ ] **Step 4: `tokens.css` — Form- und Schrift-Achsen**

Der Standardwert von `--ox-font-display` wechselt von Fraunces auf Bricolage. Die Fraunces-eigene `WONK`-Achse (`font-variation-settings` in `base.css`/`components.css`/`guest.css`) ist für andere Schriften ein No-op und bleibt unverändert stehen — kein Handlungsbedarf, nur zur Kenntnis.

`--ox-font-display` in `:root` ändern auf:

```css
    --ox-font-display: "Bricolage Grotesque Variable", "Fraunces Variable", Georgia, serif;
```

Ans Ende von `tokens.css` (nach dem `[data-theme="dark"]`-Block) anfügen:

```css
/* --- Form pro Laden: weiche Radien. Standard (Attribut fehlt) = eckig,
   die Werte oben in :root. --- */
:root[data-shape="soft"] {
    --ox-radius-sm: 14px;
    --ox-radius-md: 18px;
    --ox-radius-lg: 26px;
}

/* --- Ueberschrift-Schrift pro Laden. Kommt NACH data-shape und data-theme,
   gleiche Spezifitaet -> gewinnt bei --ox-font-display. --- */
:root[data-font="bricolage"] { --ox-font-display: "Bricolage Grotesque Variable", system-ui, sans-serif; }
:root[data-font="fraunces"]  { --ox-font-display: "Fraunces Variable", Georgia, "Times New Roman", serif; }
:root[data-font="space"]     { --ox-font-display: "Space Grotesk Variable", system-ui, sans-serif; }
:root[data-font="iserif"]    { --ox-font-display: "Instrument Serif", Georgia, serif; }
```

- [ ] **Step 5: `animation.css` anlegen** — `frontend/src/styles/animation.css`

```css
/* Alle Keyframes und wiederverwendbaren Bewegungsklassen der App an einem Ort.
 *
 * AUSSCHALTER: base.css setzt unter @media (prefers-reduced-motion: reduce)
 * bereits alle animation-/transition-Dauern auf ~0. Hier zusaetzlich die
 * Startzustaende neutralisieren, damit "unsichtbar bis Animation" nicht
 * dauerhaft unsichtbar bleibt. */

@keyframes ox-atmen {
    0%, 100% { opacity: .5; transform: scale(.98); }
    50%      { opacity: 1;  transform: scale(1); }
}
@keyframes ox-welle {
    0%   { transform: scale(1);   opacity: .7; }
    100% { transform: scale(2.6); opacity: 0; }
}
@keyframes ox-schnapp {
    0%   { transform: scale(.8); }
    60%  { transform: scale(1.12); }
    100% { transform: scale(1); }
}
@keyframes ox-pop {
    0% { transform: scale(1); } 40% { transform: scale(1.5); } 100% { transform: scale(1); }
}
@keyframes ox-zeile-rein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes ox-stempeln {
    0%   { transform: rotate(-14deg) scale(2.4); opacity: 0; }
    60%  { transform: rotate(-14deg) scale(.92); opacity: 1; }
    100% { transform: rotate(-14deg) scale(1);   opacity: 1; }
}
@keyframes ox-haken-zeichnen { to { stroke-dashoffset: 0; } }
@keyframes ox-blinken { 50% { opacity: .3; } }

/* Gestaffeltes Einblenden (Karten, Listen). is-in wird per JS gesetzt
   (animation.ts staffelEin). */
.ox-anim-stagger {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity var(--ox-dur-slow) var(--ox-ease-out),
                transform var(--ox-dur-slow) var(--ox-ease-out);
}
.ox-anim-stagger.is-in { opacity: 1; transform: none; }

/* Flieger-Klon (animation.ts fliegeZu) */
.ox-flieger {
    position: fixed;
    z-index: 70;
    border-radius: var(--ox-radius-sm);
    background: var(--ox-accent);
    color: var(--ox-accent-text);
    display: grid;
    place-items: center;
    font-family: var(--ox-font-mono);
    font-weight: 600;
    pointer-events: none;
    transition: transform var(--ox-dur-slow) cubic-bezier(.5, 0, .75, 0),
                opacity var(--ox-dur-slow) linear;
}
.ox-flieger img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* Bon fliegt zur Kueche */
.ox-bon--weg {
    transition: transform var(--ox-dur-slow) cubic-bezier(.5, 0, .75, 0),
                opacity var(--ox-dur-slow) linear;
    transform: translateY(-140%) rotate(-6deg) scale(.88);
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
    .ox-anim-stagger { opacity: 1; transform: none; }
    .ox-bon--weg { transform: none; opacity: 0; }
}
```

- [ ] **Step 6: `app.css` — Import ergänzen**

```css
@import "./tokens.css";
@import "./base.css";
@import "./components.css";
@import "./animation.css";
```

- [ ] **Step 7: `guest-motion.css` anlegen + in `guest.css` einbinden**

`frontend/src/pages/guest/guest-motion.css` (neu):

```css
/* Bewegungs- und Animationsregeln der Gaeste-Seite (Kategorie-Strich,
 * Warte-Puls, Kassenbon, Stempel/Haken, Chip-Uebergang, Tischmarke-Zustaende).
 * Getrennt von guest.css, damit beide Dateien unter ~250 Zeilen bleiben.
 * Keyframes selbst liegen global in styles/animation.css.
 * Alle Effekte respektieren prefers-reduced-motion (eigene @media-Bloecke). */
```

In `frontend/src/pages/guest/guest.css` als ERSTE Zeile (vor dem Datei-Kommentar oder direkt danach):

```css
@import "./guest-motion.css";
```

- [ ] **Step 8: Build + Tests prüfen**

Run: `cd frontend && npm run build && npm test`
Expected: `tsc --noEmit` grün, Vite-Build erzeugt `../src/main/resources/static`, bestehende Vitest-Suite grün (keine Teständerung in diesem Task).

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/package-lock.json \
        frontend/src/styles/fonts.ts frontend/src/styles/tokens.css \
        frontend/src/styles/animation.css frontend/src/styles/app.css \
        frontend/src/pages/guest/guest-motion.css frontend/src/pages/guest/guest.css
git commit -m "feat: Bewegungs-Tokens, Form-/Schrift-Achsen, animation.css, guest-motion.css"
```

---

## Task 3: Theme-Plumbing — types, theme.ts, laden-design.ts

**Files:**
- Modify: `frontend/src/lib/types.ts:42-52` (`LadenTheme`)
- Modify: `frontend/src/lib/theme.ts:95-99` (`LadenDesign`), `:101-127` (`setzeLadenDesign`)
- Modify: `frontend/src/pages/guest/laden-design.ts`
- Modify: `frontend/src/lib/theme.test.ts` (Fälle ergänzen)

**Interfaces:**
- Consumes: `RestaurantThemeDto` JSON-Felder aus Task 1.
- Produces:
  - `LadenTheme` mit `styleShape: string; displayFont: string; cartFlyStyle: string; orderConfirmStyle: string;`
  - `LadenDesign` mit optional `shape?: string | null; font?: string | null;` (Werte in Backend-Schreibweise, z. B. `"SOFT"`, `"FRAUNCES"`).
  - `setzeLadenDesign` setzt `data-shape` / `data-font` auf `<html>` (bzw. entfernt sie bei Standard/Unbekannt).
  - `wendeThemeAn(theme)` ruft `setzeLadenDesign` mit `shape`/`font` mit auf. Neuer Rückgabewert von `laden-design.ts`: `wendeThemeAn` bleibt `void`; stattdessen neue reine Funktion `leseModi(theme): { fly: "PLUS" | "PHOTO"; confirm: "STAMP" | "CHECK" }` exportieren.

- [ ] **Step 1: Failing test** — in `frontend/src/lib/theme.test.ts` ergänzen:

```ts
import { setzeLadenDesign } from "./theme";

describe("setzeLadenDesign Form/Schrift", () => {
    afterEach(() => {
        document.documentElement.removeAttribute("data-shape");
        document.documentElement.removeAttribute("data-font");
    });

    it("SOFT/FRAUNCES setzen die Attribute", () => {
        setzeLadenDesign({ shape: "SOFT", font: "FRAUNCES" });
        expect(document.documentElement.getAttribute("data-shape")).toBe("soft");
        expect(document.documentElement.getAttribute("data-font")).toBe("fraunces");
    });

    it("SQUARE/BRICOLAGE bzw. Unbekanntes entfernen die Attribute (Standard)", () => {
        document.documentElement.setAttribute("data-shape", "soft");
        document.documentElement.setAttribute("data-font", "space");
        setzeLadenDesign({ shape: "SQUARE", font: "BRICOLAGE" });
        expect(document.documentElement.hasAttribute("data-shape")).toBe(false);
        expect(document.documentElement.hasAttribute("data-font")).toBe(false);
    });
});
```

Run: `cd frontend && npm test -- theme` — Expected: FAIL (`shape`/`font` werden nicht behandelt).

- [ ] **Step 2: `types.ts` — `LadenTheme` erweitern**

```ts
/** RestaurantThemeDto */
export interface LadenTheme {
    id: number;
    name: string;
    accentColor: string;
    backgroundColor: string;
    categoriesAsHamburger: boolean;
    kitchenDisplayEnabled: boolean;
    logoUrl: string | null;
    backgroundUrl: string | null;
    styleShape: string;
    displayFont: string;
    cartFlyStyle: string;
    orderConfirmStyle: string;
}
```

- [ ] **Step 3: `theme.ts` — `LadenDesign` + `setzeLadenDesign`**

`LadenDesign` erweitern:

```ts
export interface LadenDesign {
    accentColor?: string | null;
    backgroundColor?: string | null;
    dunkel?: boolean;
    shape?: string | null;   // "SQUARE" | "SOFT"
    font?: string | null;    // "BRICOLAGE" | "FRAUNCES" | "SPACE_GROTESK" | "INSTRUMENT_SERIF"
}
```

In `setzeLadenDesign` am Anfang (nach `const wurzel = ...`) ergänzen:

```ts
    const FORM: Record<string, string> = { SOFT: "soft" };
    const SCHRIFT: Record<string, string> = {
        FRAUNCES: "fraunces", SPACE_GROTESK: "space", INSTRUMENT_SERIF: "iserif"
    };
    setzeOderEntferne(wurzel, "data-shape", design.shape ? FORM[design.shape] : undefined);
    setzeOderEntferne(wurzel, "data-font", design.font ? SCHRIFT[design.font] : undefined);
```

Helfer am Dateiende:

```ts
/** Setzt das Attribut auf `wert` oder entfernt es (Standard). Unbekannte
 *  Backend-Werte kommen als undefined an -> Attribut weg -> Standard-Optik. */
function setzeOderEntferne(el: HTMLElement, attribut: string, wert: string | undefined): void {
    if (wert) el.setAttribute(attribut, wert);
    else el.removeAttribute(attribut);
}
```

(`SQUARE` und `BRICOLAGE` sind absichtlich NICHT in den Maps — sie führen zu `undefined` = Attribut entfernt = Standard.)

- [ ] **Step 4: Test grün**

Run: `cd frontend && npm test -- theme` — Expected: PASS.

- [ ] **Step 5: `laden-design.ts` — Modi durchreichen**

`wendeThemeAn` ruft `setzeLadenDesign` mit `shape`/`font`:

```ts
export function wendeThemeAn(theme: LadenTheme): void {
    setzeLadenDesign({
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        shape: theme.styleShape,
        font: theme.displayFont
    });
    // ... Rest unveraendert (Titel, Logo, Hintergrundbild)
}

/** Flieger-/Bestaetigungs-Modus aus dem Theme, auf die im Frontend genutzten
 *  Literale eingegrenzt (Fallback = Standard). */
export function leseModi(theme: LadenTheme): { fly: "PLUS" | "PHOTO"; confirm: "STAMP" | "CHECK" } {
    return {
        fly: theme.cartFlyStyle === "PHOTO" ? "PHOTO" : "PLUS",
        confirm: theme.orderConfirmStyle === "STAMP" ? "STAMP" : "CHECK"
    };
}
```

- [ ] **Step 6: Testdaten anpassen** — überall wo Tests ein `LadenTheme`-Objekt bauen (Suche: `grep -rl "categoriesAsHamburger" frontend/src`), die 4 neuen Pflichtfelder ergänzen (`styleShape: "SQUARE", displayFont: "BRICOLAGE", cartFlyStyle: "PLUS", orderConfirmStyle: "CHECK"`). `tsc --noEmit` zeigt jede fehlende Stelle.

Run: `cd frontend && npm run build && npm test`
Expected: grün.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/theme.ts \
        frontend/src/lib/theme.test.ts frontend/src/pages/guest/laden-design.ts
git commit -m "feat: Form-/Schrift-/Modus-Felder aus dem Theme anwenden"
```

---

> **Ab hier parallelisierbar.** Task 4 (`animation.ts`) sollte zuerst fertig sein, weil Task 5 und 6 seine Helfer nutzen. Task 7 und 8 sind unabhängig.

## Task 4: `animation.ts` — Bewegungs-Helfer

**Files:**
- Create: `frontend/src/pages/guest/animation.ts`
- Create: `frontend/src/pages/guest/animation.test.ts`

**Interfaces:**
- Consumes: Klassen/Keyframes aus `animation.css` (Task 2).
- Produces:
  - `staffelEin(elemente: HTMLElement[], versatzMs?: number): void` — hängt `.ox-anim-stagger` an, blendet per `IntersectionObserver` gestaffelt ein (`.is-in`). Ohne `IntersectionObserver` (jsdom) oder bei `prefers-reduced-motion`: sofort alle `.is-in`.
  - `fliegeZu(quelle: HTMLElement, ziel: HTMLElement, opt: { modus: "PLUS" | "PHOTO"; bildUrl?: string | null }): void` — Klon (`.ox-flieger`, Text `+1` oder rundes `<img>`) fliegt von `quelle` zu `ziel`, entfernt sich nach `--ox-dur-slow`. Bei `prefers-reduced-motion`: no-op.
  - `mitAnsichtsWechsel(wechsel: () => void): void` — ruft `document.startViewTransition(wechsel)` wenn vorhanden, sonst direkt `wechsel()`.
  - `bewegungAus(): boolean` — `matchMedia("(prefers-reduced-motion: reduce)").matches`, defensiv (jsdom: `matchMedia` kann fehlen → `false`).

- [ ] **Step 1: Failing test** — `animation.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { staffelEin, fliegeZu, mitAnsichtsWechsel } from "./animation";

describe("animation.ts", () => {
    it("staffelEin blendet ohne IntersectionObserver sofort alle ein", () => {
        const a = document.createElement("div");
        const b = document.createElement("div");
        document.body.append(a, b);
        staffelEin([a, b]);
        expect(a.classList.contains("ox-anim-stagger")).toBe(true);
        expect(a.classList.contains("is-in")).toBe(true);
        expect(b.classList.contains("is-in")).toBe(true);
    });

    it("mitAnsichtsWechsel ruft den Wechsel auch ohne View-Transitions-API", () => {
        const spy = vi.fn();
        mitAnsichtsWechsel(spy);
        expect(spy).toHaveBeenCalledOnce();
    });

    it("fliegeZu haengt einen Klon an und raeumt ihn wieder ab", async () => {
        vi.useFakeTimers();
        const q = document.createElement("button");
        const z = document.createElement("span");
        document.body.append(q, z);
        fliegeZu(q, z, { modus: "PLUS" });
        expect(document.querySelectorAll(".ox-flieger").length).toBe(1);
        vi.advanceTimersByTime(600);
        expect(document.querySelectorAll(".ox-flieger").length).toBe(0);
        vi.useRealTimers();
    });
});
```

Run: `cd frontend && npm test -- animation` — Expected: FAIL (Modul fehlt).

- [ ] **Step 2: `animation.ts` implementieren**

```ts
/* Bewegungs-Helfer der Gaeste-Seite. Alle respektieren prefers-reduced-motion
 * und degradieren sauber, wo eine Browser-API fehlt (jsdom in den Tests).
 * Vorlage: guest-prototype.html (Brainstorming-Sitzung). */

export function bewegungAus(): boolean {
    try {
        return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    } catch {
        return false;
    }
}

/** Gestaffeltes Einblenden. Haengt .ox-anim-stagger an; sobald ein Element in
 *  den Blick scrollt, .is-in mit `versatzMs`-Staffelung. Ohne IntersectionObserver
 *  oder bei reduzierter Bewegung: sofort alle. */
export function staffelEin(elemente: HTMLElement[], versatzMs = 45): void {
    for (const el of elemente) el.classList.add("ox-anim-stagger");

    if (bewegungAus() || typeof IntersectionObserver === "undefined") {
        for (const el of elemente) el.classList.add("is-in");
        return;
    }

    const beobachter = new IntersectionObserver((eintraege, self) => {
        eintraege.forEach((eintrag, i) => {
            if (!eintrag.isIntersecting) return;
            window.setTimeout(() => eintrag.target.classList.add("is-in"), i * versatzMs);
            self.unobserve(eintrag.target);
        });
    }, { threshold: 0.1 });

    for (const el of elemente) beobachter.observe(el);
}

/** Klon fliegt von `quelle` zu `ziel`. modus PHOTO + bildUrl -> rundes Foto,
 *  sonst "+1". Bei reduzierter Bewegung: nichts. */
export function fliegeZu(
    quelle: HTMLElement,
    ziel: HTMLElement,
    opt: { modus: "PLUS" | "PHOTO"; bildUrl?: string | null }
): void {
    if (bewegungAus()) return;

    const q = quelle.getBoundingClientRect();
    const z = ziel.getBoundingClientRect();
    const flieger = document.createElement("div");
    flieger.className = "ox-flieger";

    let x = q.left, y = q.top, b = q.width, h = q.height;
    if (opt.modus === "PHOTO" && opt.bildUrl) {
        b = h = 56;
        x = q.left + q.width / 2 - 28;
        y = q.top + q.height / 2 - 28;
        flieger.style.borderRadius = "50%";
        const bild = document.createElement("img");
        bild.src = opt.bildUrl;
        bild.alt = "";
        bild.addEventListener("error", () => { flieger.textContent = "+1"; });
        flieger.appendChild(bild);
    } else {
        flieger.textContent = "+1";
    }
    flieger.style.left = `${x}px`;
    flieger.style.top = `${y}px`;
    flieger.style.width = `${b}px`;
    flieger.style.height = `${h}px`;
    document.body.appendChild(flieger);

    requestAnimationFrame(() => {
        const dx = z.left - x + (z.width - b) / 2;
        const dy = z.top - y;
        flieger.style.transform = `translate(${dx}px, ${dy}px) scale(.3)`;
        flieger.style.opacity = "0";
    });
    window.setTimeout(() => flieger.remove(), 480);
}

/** Ansichtswechsel mit weichem Uebergang, wo der Browser die View-Transitions-
 *  API kennt - sonst unmittelbar. */
export function mitAnsichtsWechsel(wechsel: () => void): void {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === "function") doc.startViewTransition(wechsel);
    else wechsel();
}
```

- [ ] **Step 3: Test grün**

Run: `cd frontend && npm test -- animation` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/guest/animation.ts frontend/src/pages/guest/animation.test.ts
git commit -m "feat: animation.ts - Stagger, Flieger, Ansichtswechsel"
```

---

## Task 5: `menu.ts` — Thumbnail-Karte, Stagger, gleitender Kategorie-Strich, Flieger

**Files:**
- Modify: `frontend/src/pages/guest/menu.ts`
- Modify: `frontend/src/pages/guest/guest.css`
- Modify: `frontend/src/pages/guest/index.ts` (Stagger-Aufruf, Flieger-Verdrahtung)
- Modify: `frontend/src/pages/guest/menu.test.ts`

**Interfaces:**
- Consumes: `staffelEin`, `fliegeZu` aus Task 4; `.ox-kategorie-*` / `.ox-gericht*` aus `guest.css`.
- Produces:
  - `zeichneSpeisekarte(...)` unverändert in Signatur; erzeugt zusätzlich einen gleitenden Strich (`.ox-kategorie-strich`) in der Reiter-Leiste (nur nicht-Hamburger).
  - `beiSchnellHinzufuegen` und der Detail-„In den Warenkorb"-Rückruf reichen jetzt den auslösenden Button mit: der Aufrufer (`index.ts`) macht daraus den Flieger. Neue Callback-Form: `beiSchnellHinzufuegen: (gericht: Gericht, quelle: HTMLElement) => void`; `oeffneDetail`s `beiHinzufuegen: (gericht, menge, hinweis, quelle: HTMLElement) => void`.

- [ ] **Step 1: Karten-Test anpassen** — `menu.test.ts`: der Spion für `beiSchnellHinzufuegen` bekommt jetzt zwei Argumente. Assertions auf `expect(spionSchnell).toHaveBeenCalledWith(gericht, expect.any(HTMLElement))`. Neuer Test:

```ts
it("die Reiter-Leiste hat einen gleitenden Strich bei >= 2 Kategorien", () => {
    zeichneSpeisekarte(zweiKategorien, ziel, () => {}, () => {}, true, false);
    expect(ziel.querySelector(".ox-kategorie-strich")).not.toBeNull();
});
```

Run: `cd frontend && npm test -- menu` — Expected: FAIL.

- [ ] **Step 2: `menu.ts` — Callback-Signaturen + Flieger-Quelle**

`baueGerichtKarte`: `hinzufuegenKnopf`-Listener:

```ts
    hinzufuegenKnopf.addEventListener("click", (ereignis) => {
        ereignis.stopPropagation();
        beiSchnellHinzufuegen(gericht, hinzufuegenKnopf);
    });
```

Typen von `zeichneSpeisekarte`/`baueGerichtKarte` entsprechend auf `(gericht: Gericht, quelle: HTMLElement) => void` ändern.

`oeffneDetail`: `hinzufuegenKnopf`-Listener:

```ts
    hinzufuegenKnopf.addEventListener("click", () => {
        beiHinzufuegen(gericht, menge, hinweisFeld.value.trim(), hinzufuegenKnopf);
        versteckeOverlay(overlay);
    });
```

Signatur `oeffneDetail(gericht, beiHinzufuegen: (g, m, h, quelle: HTMLElement) => void, bestellenErlaubt)`.

- [ ] **Step 3: `menu.ts` — gleitender Kategorie-Strich**

In `baueKategorieLeiste`, nicht-Hamburger-Zweig: nach dem Erzeugen der Reiter einen Strich einhängen und beim Klick/initial positionieren.

```ts
        const strich = el("span", "ox-kategorie-strich");
        leiste.appendChild(strich);

        const setzeStrich = (reiter: HTMLElement): void => {
            strich.style.width = `${reiter.offsetWidth}px`;
            strich.style.transform = `translateX(${reiter.offsetLeft}px)`;
        };
        // initial (nach Layout) auf den ersten Reiter
        requestAnimationFrame(() => {
            const ersterReiter = leiste.querySelector<HTMLElement>(".ox-kategorie-reiter");
            if (ersterReiter) setzeStrich(ersterReiter);
        });
```

Im Reiter-Klick-Listener nach `reiter.classList.add("is-active")` ergänzen: `setzeStrich(reiter);`

(jsdom liefert `offsetWidth`/`offsetLeft` als `0` — Test prüft nur die Existenz des Elements, nicht die Position.)

- [ ] **Step 4: Thumbnail-Karte (`guest.css`) + Strich/„+"-Dreh (`guest-motion.css`)**

Die Umstellung der BESTEHENDEN `.ox-gericht*`-Regeln bleibt in `guest.css`. NEUE Selektoren (`.ox-kategorie-strich`, `.ox-gericht:active`, `.ox-gericht__hinzufuegen`-Übergang, `.ox-anim-pop`) kommen nach `guest-motion.css`.

`.ox-gericht` / `.ox-gericht__oeffnen` in `guest.css` auf Zeilen-Layout umstellen (Bild links, Text rechts), Bild fest 84×84:

```css
.ox-gericht { padding: 0; overflow: hidden; }
.ox-gericht__oeffnen {
    all: unset;
    box-sizing: border-box;
    display: flex;
    gap: var(--ox-space-3);
    align-items: flex-start;
    width: 100%;
    padding: var(--ox-space-3) var(--ox-space-4);
    cursor: pointer;
}
.ox-gericht__oeffnen:focus-visible { outline: 2px solid var(--ox-accent); outline-offset: -2px; }
.ox-gericht__bild {
    flex: none;
    width: 84px; height: 84px;
    border-radius: var(--ox-radius-sm);
    object-fit: cover;
    background: var(--ox-surface-2);
}
.ox-gericht__bild--leer { background: var(--ox-surface-2); }
.ox-gericht__inhalt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
```

`.ox-gericht__fuss` bleibt (Preiszeile unter dem Öffnen-Knopf).

Kategorie-Strich — **in `guest-motion.css`** (die Leiste ist bereits `position: relative`-fähig via `border-bottom`; Strich absolut):

```css
.ox-kategorie-leiste { position: relative; }
.ox-kategorie-strich {
    position: absolute;
    bottom: -1px;
    left: 0;
    height: 2px;
    background: var(--ox-accent);
    transition: transform var(--ox-dur) var(--ox-ease-spring),
                width var(--ox-dur) var(--ox-ease-spring);
}
```

`.ox-gericht__oeffnen:active` leichtes Anheben:

```css
.ox-gericht:active { box-shadow: var(--ox-shadow-2); }
```

`.ox-gericht__hinzufuegen` (der „+") Dreh beim Drücken:

```css
.ox-gericht__hinzufuegen { transition: transform var(--ox-dur-fast) var(--ox-ease-spring); }
.ox-gericht__hinzufuegen:active { transform: scale(.82) rotate(90deg); }
```

- [ ] **Step 5: `index.ts` — Stagger + Flieger verdrahten**

Import: `import { staffelEin, fliegeZu } from "./animation";` und `import { leseModi } from "./laden-design";`

Zustand ergänzen: `let flyModus: "PLUS" | "PHOTO" = "PLUS";` `let confirmModus: "STAMP" | "CHECK" = "CHECK";`

In `ladeThemeUndSpeisekarte`, nach `if (themeErgebnis.status === "fulfilled")`:

```ts
        const modi = themeErgebnis.status === "fulfilled" ? leseModi(themeErgebnis.value) : null;
        if (modi) { flyModus = modi.fly; confirmModus = modi.confirm; }
```

Nach `zeichneSpeisekarte(...)`:

```ts
        staffelEin(Array.from(ziel.querySelectorAll<HTMLElement>(".ox-gericht")));
```

`beiSchnellHinzufuegen` / `beiHinzufuegen` an die neue Signatur anpassen und den Flieger auslösen:

```ts
function beiSchnellHinzufuegen(gericht: Gericht, quelle: HTMLElement): void {
    beiHinzufuegen(gericht, 1, "", quelle);
}

function beiHinzufuegen(gericht: Gericht, menge: number, hinweis: string, quelle: HTMLElement): void {
    warenkorb.hinzufuegen(gericht, menge, hinweis);
    warenkorb.sichere(guestToken);
    aktualisiereWarenkorbLeiste();
    const zaehler = document.getElementById("cartbar-info");
    if (zaehler) fliegeZu(quelle, zaehler, { modus: flyModus, bildUrl: gericht.imageUrl });
    toast(`${menge}× ${gericht.name} hinzugefügt`);
}
```

`beiGerichtAusgewaehlt` ruft `oeffneDetail(gericht, beiHinzufuegen, genehmigt)` — Signatur passt jetzt (4. Param `quelle`).

Der Zähler-Pop (`ox-pop`) auf `#cartbar` bzw. dem Info-Element: in `aktualisiereWarenkorbLeiste` nach dem Setzen des Texts:

```ts
        info.classList.remove("ox-anim-pop");
        void info.offsetWidth;
        info.classList.add("ox-anim-pop");
```

und in `animation.css` `.ox-anim-pop { animation: ox-pop .4s var(--ox-ease-spring); }`.

- [ ] **Step 6: Tests + Build**

Run: `cd frontend && npm run build && npm test`
Expected: grün (menu.test.ts angepasst, Rest unberührt).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/guest/menu.ts frontend/src/pages/guest/menu.test.ts \
        frontend/src/pages/guest/guest.css frontend/src/pages/guest/index.ts \
        frontend/src/styles/animation.css
git commit -m "feat: Thumbnail-Karten, Stagger-Einblenden, Kategorie-Strich, Hinzufuegen-Flieger"
```

---

## Task 6: `bon.ts` — Kassenbon-Warenkorb, Stempel/Haken, Flug zur Küche

**Files:**
- Create: `frontend/src/pages/guest/bon.ts`
- Create: `frontend/src/pages/guest/bon.test.ts`
- Modify: `frontend/src/pages/guest/guest.css`
- Modify: `frontend/src/pages/guest/index.ts` (`zeichneWarenkorb`, `sendeBestellung`)
- Modify: `frontend/guest.html` (optional: Stempel-/Haken-Overlay-Markup — hier per JS erzeugt, kein HTML nötig)

**Interfaces:**
- Consumes: `--ox-*`-Tokens, `.ox-bon--weg` aus `animation.css`.
- Produces:
  - `schmueckeBon(karte: HTMLElement, zeilen: HTMLElement[]): void` — hängt `.ox-bon` an die Warenkorb-Karte, `.ox-bon-zeile` + gestaffeltes `animation-delay` an jede Zeile.
  - `bestaetigeBestellung(modus: "STAMP" | "CHECK"): Promise<void>` — blendet Stempel („ANGENOMMEN", `ox-stempeln`) oder Haken (SVG, `ox-haken-zeichnen`) ein, resolved nach ~900 ms und räumt das Overlay ab. Bei `bewegungAus()`: sofort resolved, kein Overlay.
  - `fliegeBonWeg(karte: HTMLElement): Promise<void>` — `.ox-bon--weg` an die Karte, resolved nach `--ox-dur-slow`, entfernt die Klasse wieder. Bei `bewegungAus()`: sofort resolved.

- [ ] **Step 1: Failing test** — `bon.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { schmueckeBon, bestaetigeBestellung, fliegeBonWeg } from "./bon";

describe("bon.ts", () => {
    it("schmueckeBon markiert Karte und Zeilen mit gestaffeltem Verzug", () => {
        const karte = document.createElement("div");
        const z1 = document.createElement("div");
        const z2 = document.createElement("div");
        schmueckeBon(karte, [z1, z2]);
        expect(karte.classList.contains("ox-bon")).toBe(true);
        expect(z1.classList.contains("ox-bon-zeile")).toBe(true);
        expect(z2.style.animationDelay).not.toBe("");
        expect(z2.style.animationDelay).not.toBe(z1.style.animationDelay);
    });

    it("bestaetigeBestellung(CHECK) loest sich auf und hinterlaesst kein Overlay", async () => {
        vi.useFakeTimers();
        const p = bestaetigeBestellung("CHECK");
        vi.advanceTimersByTime(1000);
        await p;
        expect(document.querySelector(".ox-bestaetigung")).toBeNull();
        vi.useRealTimers();
    });

    it("fliegeBonWeg setzt und entfernt die Klasse wieder", async () => {
        vi.useFakeTimers();
        const karte = document.createElement("div");
        document.body.appendChild(karte);
        const p = fliegeBonWeg(karte);
        expect(karte.classList.contains("ox-bon--weg")).toBe(true);
        vi.advanceTimersByTime(600);
        await p;
        expect(karte.classList.contains("ox-bon--weg")).toBe(false);
        vi.useRealTimers();
    });
});
```

Run: `cd frontend && npm test -- bon` — Expected: FAIL.

- [ ] **Step 2: `bon.ts` implementieren**

```ts
/* Der Warenkorb der Gaeste-Seite als Kassenbon: Perforierung, Mono-Schrift,
 * Zeilen die sich nacheinander "eintippen". Beim Bestellen eine Bestaetigung
 * (Stempel oder Haken, Laden-Wahl), danach fliegt der Bon "zur Kueche" weg.
 * Vorlage: guest-prototype.html. */

import { bewegungAus } from "./animation";

export function schmueckeBon(karte: HTMLElement, zeilen: HTMLElement[]): void {
    karte.classList.add("ox-bon");
    zeilen.forEach((zeile, i) => {
        zeile.classList.add("ox-bon-zeile");
        zeile.style.animationDelay = `${i * 60}ms`;
    });
}

export function bestaetigeBestellung(modus: "STAMP" | "CHECK"): Promise<void> {
    if (bewegungAus()) return Promise.resolve();

    const overlay = document.createElement("div");
    overlay.className = "ox-bestaetigung";
    overlay.setAttribute("aria-hidden", "true"); // rein dekorativ
    overlay.innerHTML = modus === "STAMP"
        ? `<span class="ox-stempel">ANGENOMMEN</span>`
        : `<svg class="ox-haken" viewBox="0 0 52 52">
             <circle class="ox-haken__kreis" cx="26" cy="26" r="24" fill="none" stroke-width="3"/>
             <path class="ox-haken__pfad" fill="none" stroke-width="4" stroke-linecap="round"
                   stroke-linejoin="round" d="M14 27 l8 8 l16 -18"/>
           </svg>`;
    document.body.appendChild(overlay);

    return new Promise((fertig) => {
        window.setTimeout(() => { overlay.remove(); fertig(); }, 900);
    });
}

export function fliegeBonWeg(karte: HTMLElement): Promise<void> {
    if (bewegungAus()) return Promise.resolve();
    karte.classList.add("ox-bon--weg");
    return new Promise((fertig) => {
        window.setTimeout(() => { karte.classList.remove("ox-bon--weg"); fertig(); }, 480);
    });
}
```

- [ ] **Step 3: `guest-motion.css` — Bon-Optik, Stempel, Haken, Zeilen-Tippen** (alle neuen Selektoren dort, NICHT in `guest.css`)

```css
/* ---------- Kassenbon-Warenkorb ---------- */
.ox-bon {
    font-family: var(--ox-font-mono);
    -webkit-mask:
        linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat,
        radial-gradient(circle 6px at 10px bottom, transparent 98%, #000) bottom left / 20px 12px repeat-x;
            mask:
        linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat,
        radial-gradient(circle 6px at 10px bottom, transparent 98%, #000) bottom left / 20px 12px repeat-x;
}
.ox-bon-zeile {
    opacity: 0;
    transform: translateY(6px);
    animation: ox-zeile-rein var(--ox-dur) var(--ox-ease-out) forwards;
}

/* Bestaetigungs-Overlay */
.ox-bestaetigung {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    z-index: 80;
    pointer-events: none;
}
.ox-stempel {
    font-family: var(--ox-font-mono);
    font-weight: 600;
    font-size: var(--ox-text-3xl);
    letter-spacing: .1em;
    color: var(--ox-danger);
    border: 4px solid var(--ox-danger);
    border-radius: 10px;
    padding: var(--ox-space-2) var(--ox-space-5);
    animation: ox-stempeln .5s var(--ox-ease-out) forwards;
}
.ox-haken { width: 96px; height: 96px; }
.ox-haken__kreis { stroke: var(--ox-success); stroke-dasharray: 151; stroke-dashoffset: 151; animation: ox-haken-zeichnen .4s var(--ox-ease-out) forwards; }
.ox-haken__pfad  { stroke: var(--ox-success); stroke-dasharray: 44;  stroke-dashoffset: 44;  animation: ox-haken-zeichnen .3s .35s var(--ox-ease-out) forwards; }

@media (prefers-reduced-motion: reduce) {
    .ox-bon-zeile { opacity: 1; transform: none; animation: none; }
}
```

- [ ] **Step 4: `index.ts` — verdrahten**

Import: `import { schmueckeBon, bestaetigeBestellung, fliegeBonWeg } from "./bon";`

In `zeichneWarenkorb`, nach dem Befüllen von `#cart-lines`:

```ts
    const karte = document.querySelector<HTMLElement>("#view-cart .ox-card");
    if (karte && ziel) schmueckeBon(karte, Array.from(ziel.children) as HTMLElement[]);
```

`sendeBestellung` umbauen — Bestätigung + Flug VOR dem Ansichtswechsel:

```ts
async function sendeBestellung(): Promise<void> {
    const knopf = document.getElementById("btn-send") as HTMLButtonElement | null;
    if (knopf) knopf.disabled = true;
    try {
        await bestelle(guestToken, warenkorb);
        await bestaetigeBestellung(confirmModus);
        const karte = document.querySelector<HTMLElement>("#view-cart .ox-card");
        if (karte) await fliegeBonWeg(karte);
        aktualisiereWarenkorbLeiste();
        await aktualisiereBestellungen();
        zeigeAnsicht("view-orders");
        toast("Bestellung aufgegeben");
    } catch (fehler) {
        toast((fehler as Error).message, true);
    } finally {
        if (knopf) knopf.disabled = false;
    }
}
```

(`confirmModus` kommt aus Task 5, Step 5.)

- [ ] **Step 5: Tests + Build**

Run: `cd frontend && npm run build && npm test`
Expected: grün.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/guest/bon.ts frontend/src/pages/guest/bon.test.ts \
        frontend/src/pages/guest/guest.css frontend/src/pages/guest/index.ts
git commit -m "feat: Kassenbon-Warenkorb mit Zeilen-Tippen, Stempel/Haken, Flug zur Kueche"
```

---

## Task 7: `orders.ts` + `ansichten.ts` + Warte-Puls

**Files:**
- Modify: `frontend/src/pages/guest/orders.ts`
- Modify: `frontend/src/pages/guest/orders.test.ts`
- Modify: `frontend/src/pages/guest/ansichten.ts`
- Modify: `frontend/src/pages/guest/index.ts` (Aufruf `aktualisiereTischmarke(nr, !genehmigt)`)
- Modify: `frontend/guest.html` (`#view-wait` Puls)
- Modify: `frontend/src/pages/guest/guest.css`
- Modify: `frontend/src/lib/ui.ts` NUR falls `tischmarke()` einen Zustandsparameter braucht — Alternative unten ohne ui.ts-Änderung.

**Interfaces:**
- Consumes: `.ox-chip` (components.css), Keyframes `ox-atmen`/`ox-welle`/`ox-schnapp`/`ox-blinken` (animation.css).
- Produces:
  - `zeichneBestellungen(bestellungen, ziel)` — bei erneutem Aufruf werden **bestehende Karten aktualisiert** (Chip-Klasse/-Text in place), statt alles neu zu bauen; so greift der CSS-`transition` auf `.ox-chip` = Farb-Morph. Neue Karten wie bisher.
  - `statusKlasse(status)` fügt für `IN_PREPARATION` einen `<span class="ox-chip__punkt">` ein (blinkt).
  - `aktualisiereTischmarke(tischNummer: number, wartet: boolean): void` — setzt `.ox-tischmarke--wartet` (atmen) bzw. entfernt sie und setzt einmalig `.ox-tischmarke--frei` (schnapp) beim Übergang wartet→frei.

- [ ] **Step 1: Failing tests**

`orders.test.ts`:

```ts
it("aktualisiert den Chip einer bestehenden Bestellung in place (kein Neuaufbau)", () => {
    const ziel = document.createElement("div");
    zeichneBestellungen([bestellung("NEW", 1)], ziel);
    const karteVorher = ziel.querySelector("[data-bestellung-id='1']");
    zeichneBestellungen([bestellung("IN_PREPARATION", 1)], ziel);
    const karteNachher = ziel.querySelector("[data-bestellung-id='1']");
    expect(karteNachher).toBe(karteVorher); // dieselbe DOM-Node
    expect(karteNachher!.querySelector(".ox-chip")!.textContent).toContain("In der Küche");
});
```

`ansichten.test.ts` (falls vorhanden, sonst in bestehende Suite):

```ts
it("Tischmarke traegt --wartet bei wartet=true und --frei nach dem Uebergang", () => {
    document.body.innerHTML = `<span id="table-badge"></span>`;
    aktualisiereTischmarke(7, true);
    expect(document.querySelector(".ox-tischmarke")!.classList.contains("ox-tischmarke--wartet")).toBe(true);
    aktualisiereTischmarke(7, false);
    const marke = document.querySelector(".ox-tischmarke")!;
    expect(marke.classList.contains("ox-tischmarke--wartet")).toBe(false);
    expect(marke.classList.contains("ox-tischmarke--frei")).toBe(true);
});
```

Run: `cd frontend && npm test -- orders ansichten` — Expected: FAIL.

- [ ] **Step 2: `orders.ts` — Chips in place aktualisieren**

`zeichneBestellungen` umbauen: Karten mit `data-bestellung-id` versehen; bei Re-Render vorhandene Karte finden und nur Chip + Positionen aktualisieren.

```ts
export function zeichneBestellungen(bestellungen: Bestellung[], ziel: HTMLElement): void {
    const sortiert = [...bestellungen].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    if (sortiert.length === 0) {
        ziel.textContent = "";
        ziel.appendChild(el("p", "ox-muted", "Noch keine Bestellungen."));
        return;
    }

    // Gesamtzeile immer neu (billig, kein Zustand).
    const vorhandeneGesamt = ziel.querySelector(".ox-bestellungen__gesamt");
    const neueGesamt = baueGesamtzeile(sortiert);
    if (vorhandeneGesamt) vorhandeneGesamt.replaceWith(neueGesamt);
    else ziel.prepend(neueGesamt);

    for (const bestellung of sortiert) {
        const vorhanden = ziel.querySelector<HTMLElement>(`[data-bestellung-id="${bestellung.id}"]`);
        if (vorhanden) aktualisiereBestellKarte(vorhanden, bestellung);
        else ziel.appendChild(baueBestellKarte(bestellung));
    }
    // Karten entfernter Bestellungen (sollte selten sein) raeumen:
    const ids = new Set(sortiert.map((b) => String(b.id)));
    ziel.querySelectorAll<HTMLElement>("[data-bestellung-id]").forEach((k) => {
        if (!ids.has(k.dataset.bestellungId ?? "")) k.remove();
    });
}
```

`baueBestellKarte`: `karte.dataset.bestellungId = String(bestellung.id);` und den Chip als eigenes Element mit stabiler Klasse `.ox-chip` erzeugen.

Neu `aktualisiereBestellKarte(karte, bestellung)`: Chip-`className` und -Text neu setzen (CSS-`transition` macht den Morph), Positionsliste ersetzen.

`STATUS_KLASSE` für `IN_PREPARATION` → beim Bauen des Chips einen `<span class="ox-chip__punkt">` als erstes Kind einfügen, wenn Status `IN_PREPARATION`.

- [ ] **Step 3: Chip-Übergang (`components.css`) + Punkt (`guest-motion.css`)**

In `components.css` bei `.ox-chip`:

```css
.ox-chip { transition: background var(--ox-dur) var(--ox-ease-out), color var(--ox-dur) var(--ox-ease-out); }
```

In `guest-motion.css`:

```css
.ox-chip__punkt {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: currentColor;
    margin-right: 6px;
    vertical-align: middle;
}
.ox-chip--warn .ox-chip__punkt { animation: ox-blinken 1s ease-in-out infinite; }
```

- [ ] **Step 4: `ansichten.ts` — Tischmarke-Zustand**

```ts
export function aktualisiereTischmarke(tischNummer: number, wartet: boolean): void {
    const badge = document.getElementById("table-badge");
    if (!badge) return;
    let marke = badge.querySelector<HTMLElement>(".ox-tischmarke");
    if (!marke) {
        badge.textContent = "";
        marke = tischmarke(tischNummer) as HTMLElement;
        badge.appendChild(marke);
    } else {
        // Nummer kann sich fuer eine Person nicht aendern - Text nur zur Sicherheit.
        marke.textContent = `Tisch ${String(tischNummer).padStart(2, "0")}`;
    }
    marke.classList.toggle("ox-tischmarke--wartet", wartet);
    if (!wartet) marke.classList.add("ox-tischmarke--frei");
}
```

Prüfen, wie `tischmarke()` in `lib/ui.ts` den Text formatiert (führende Null!) und hier identisch halten — sonst `tischmarke()` einmal aufrufen und nur die Klassen togglen (bevorzugt, kein Format-Duplikat):

```ts
    if (!marke) {
        badge.textContent = "";
        marke = tischmarke(tischNummer) as HTMLElement;
        badge.appendChild(marke);
    }
    marke.classList.toggle("ox-tischmarke--wartet", wartet);
    if (!wartet) marke.classList.add("ox-tischmarke--frei");
```

- [ ] **Step 5: `index.ts` — Aufruf anpassen**

In `wendeStatusAn`: `aktualisiereTischmarke(tischNummer, !genehmigt);` — Achtung: an der bestehenden Aufrufstelle steht `aktualisiereTischmarke(tischNummer);` VOR der Berechnung von `genehmigt`. Aufruf ans Ende von `wendeStatusAn` verschieben (nach `genehmigt = ...`), bzw. mit `status.guestStatus === "APPROVED" && status.sessionStatus === "APPROVED"` inline.

- [ ] **Step 6: `guest.html` — Warte-Puls-Markup + `guest-motion.css`**

`#view-wait` Inhalt ergänzen (vor dem `<p class="ox-big">`):

```html
    <div class="ox-puls" aria-hidden="true"></div>
```

`guest-motion.css`:

```css
.ox-puls {
    width: 64px; height: 64px;
    margin: 0 auto var(--ox-space-5);
    border-radius: 50%;
    background: var(--ox-accent);
    position: relative;
}
.ox-puls::before, .ox-puls::after {
    content: "";
    position: absolute; inset: 0;
    border-radius: 50%;
    border: 2px solid var(--ox-accent);
    animation: ox-welle 2s var(--ox-ease-out) infinite;
}
.ox-puls::after { animation-delay: 1s; }

.ox-tischmarke--wartet { animation: ox-atmen 2s var(--ox-ease-out) infinite; }
.ox-tischmarke--frei { animation: ox-schnapp .5s var(--ox-ease-spring); border-color: var(--ox-success); color: var(--ox-success); }

@media (prefers-reduced-motion: reduce) {
    .ox-puls::before, .ox-puls::after { animation: none; opacity: 0; }
    .ox-tischmarke--wartet, .ox-tischmarke--frei { animation: none; }
}
```

- [ ] **Step 7: Tests + Build**

Run: `cd frontend && npm run build && npm test`
Expected: grün.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/guest/orders.ts frontend/src/pages/guest/orders.test.ts \
        frontend/src/pages/guest/ansichten.ts frontend/src/pages/guest/index.ts \
        frontend/guest.html frontend/src/pages/guest/guest.css frontend/src/styles/components.css
git commit -m "feat: Status-Chip-Morph, Tischmarke atmen/schnappen, Warte-Puls"
```

---

## Task 8: Ansichtswechsel-Übergang + Admin-Auswahlfelder

**Files:**
- Modify: `frontend/src/pages/guest/index.ts` (`zeigeAnsicht` über `mitAnsichtsWechsel`)
- Modify: `frontend/src/pages/guest/components.css` bzw. `guest.css` (Sheet-Slide)
- Modify: `frontend/src/pages/guest/menu.ts` (Detail-Overlay Slide-Klasse) + `guest.css`
- Modify: `frontend/admin.html` (Design-Karte)
- Modify: `frontend/public/js/admin.js` (`loadDesign`/`saveDesign`)

**Interfaces:**
- Consumes: `mitAnsichtsWechsel` (Task 4).
- Produces: keine neuen Signaturen; `zeigeAnsichtInhalt`-Aufruf in `index.ts#zeigeAnsicht` wird in `mitAnsichtsWechsel(() => zeigeAnsichtInhalt(id, restaurantName))` gekapselt.

- [ ] **Step 1: `index.ts` — Ansichtswechsel weich**

```ts
import { mitAnsichtsWechsel } from "./animation";

function zeigeAnsicht(id: Ansicht): void {
    aktuelleAnsicht = id;
    mitAnsichtsWechsel(() => zeigeAnsichtInhalt(id, restaurantName));
    aktualisiereWarenkorbLeiste();
}
```

(`document.startViewTransition` blendet automatisch cross-fade; ohne API sofort. jsdom-Tests: `mitAnsichtsWechsel` ruft direkt — unverändertes Verhalten, bestehende Tests bleiben grün.)

- [ ] **Step 2: Detail-Overlay Slide-up** — `menu.ts` `holeOderErstelleOverlay`: der Box bekommt zusätzlich `.ox-overlay__box--sheet`. In `guest-motion.css`:

```css
.ox-overlay__box--sheet {
    align-self: end;
    width: 100%;
    max-width: 640px;
    border-radius: var(--ox-radius-lg) var(--ox-radius-lg) 0 0;
    transform: translateY(100%);
    transition: transform var(--ox-dur-slow) var(--ox-ease-spring);
}
.ox-overlay.is-open .ox-overlay__box--sheet { transform: none; }
@media (prefers-reduced-motion: reduce) {
    .ox-overlay__box--sheet { transition: none; transform: none; }
}
```

Damit die Transition greift, muss `.ox-overlay` beim Öffnen erst gerendert (display:flex) und im nächsten Frame `is-open` gesetzt werden — in `oeffneDetail` das `overlay.classList.add("is-open")` in `requestAnimationFrame` verpacken:

```ts
    overlay.style.display = "flex";
    requestAnimationFrame(() => overlay.classList.add("is-open"));
```

(Bestehender Escape-/Backdrop-Close bleibt.)

- [ ] **Step 3: `admin.html` — 4 `<select>` in die Design-Karte**

Nach dem `design-kitchen`-`<div class="full check">` (Zeile ~80), vor dem Speichern-Button, einfügen:

```html
                <div>
                    <label for="design-shape">Form</label>
                    <select id="design-shape">
                        <option value="SQUARE">Eckig</option>
                        <option value="SOFT">Weich (runde Ecken)</option>
                    </select>
                </div>
                <div>
                    <label for="design-font">Schrift der &Uuml;berschriften</label>
                    <select id="design-font">
                        <option value="BRICOLAGE">Bricolage Grotesque</option>
                        <option value="FRAUNCES">Fraunces</option>
                        <option value="SPACE_GROTESK">Space Grotesk</option>
                        <option value="INSTRUMENT_SERIF">Instrument Serif</option>
                    </select>
                </div>
                <div>
                    <label for="design-fly">Warenkorb-Flieger</label>
                    <select id="design-fly">
                        <option value="PLUS">&bdquo;+1&ldquo;</option>
                        <option value="PHOTO">Gericht-Foto</option>
                    </select>
                </div>
                <div>
                    <label for="design-confirm">Bestell-Best&auml;tigung</label>
                    <select id="design-confirm">
                        <option value="CHECK">Gr&uuml;ner Haken</option>
                        <option value="STAMP">Stempel &bdquo;ANGENOMMEN&ldquo;</option>
                    </select>
                </div>
```

- [ ] **Step 4: `admin.js` — `loadDesign` / `saveDesign`**

`loadDesign`, nach `design-kitchen`:

```js
            document.getElementById("design-shape").value = t.styleShape || "SQUARE";
            document.getElementById("design-font").value = t.displayFont || "BRICOLAGE";
            document.getElementById("design-fly").value = t.cartFlyStyle || "PLUS";
            document.getElementById("design-confirm").value = t.orderConfirmStyle || "CHECK";
```

`saveDesign`, im `body`-Objekt ergänzen:

```js
                    styleShape: document.getElementById("design-shape").value,
                    displayFont: document.getElementById("design-font").value,
                    cartFlyStyle: document.getElementById("design-fly").value,
                    orderConfirmStyle: document.getElementById("design-confirm").value
```

- [ ] **Step 5: Manuelle Prüfung Admin**

App lokal starten (`mvn spring-boot:run`), `http://localhost:8080/admin.html`, Login `inhaber`/`inhaber123`, Design-Karte: die 4 Auswahlfelder erscheinen, „Speichern" bestätigt, nach Reload sind die Werte erhalten.

- [ ] **Step 6: Build + Tests**

Run: `cd frontend && npm run build && npm test`
Expected: grün.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/guest/index.ts frontend/src/pages/guest/menu.ts \
        frontend/src/pages/guest/guest.css frontend/admin.html frontend/public/js/admin.js
git commit -m "feat: weicher Ansichtswechsel, Detail-Sheet slidet, Admin-Auswahlfelder"
```

---

## Task 9: Gesamtlauf, reduced-motion-Audit, manuelle Abnahme

**Files:** keine Code-Änderung außer Korrekturen, die dieser Lauf aufdeckt.

- [ ] **Step 1: reduced-motion-Audit** — jede neue `@keyframes`/`transition`/`animation`-Nutzung durchgehen (`grep -rn "animation\|transition" frontend/src/pages/guest frontend/src/styles/animation.css frontend/src/pages/guest/guest.css`). Sicherstellen: entweder von `base.css` `@media (prefers-reduced-motion: reduce)` (Dauer→0) abgedeckt ODER explizit ein `@media`-Block, der Startzustände (unsichtbar/verschoben) neutralisiert. `bewegungAus()` in `animation.ts`/`bon.ts` an allen JS-Effekten prüfen.

- [ ] **Step 2: Frontend gesamt**

Run: `cd frontend && npm run build && npm test`
Expected: `tsc --noEmit` grün, Vitest grün, `../src/main/resources/static` frisch gebaut.

- [ ] **Step 3: Backend gesamt**

Run: `mvn -q clean test`
Expected: ~76 + 3 neue grün.

- [ ] **Step 4: `test-api.ps1`** (laufende App vorausgesetzt, siehe Betriebs-Regeln)

Run (PowerShell): `./test-api.ps1`
Expected: 33/33.

- [ ] **Step 5: Manueller Gäste-Durchlauf** auf Handy UND PC:
  - Scannen → Warte-Ansicht mit Puls, Tischmarke atmet → Freigabe (im Admin/Service) → Tischmarke schnappt auf „frei".
  - Speisekarte: Karten faden gestaffelt ein, Thumbnail links; Kategorie-Reiter → Strich gleitet.
  - „+" → dreht, Flieger (`PLUS`) fliegt zur Warenkorb-Leiste, Zähler ploppt.
  - Karte antippen → Detail-Sheet slidet hoch; „In den Warenkorb".
  - Bon-Ansicht: Zeilen tippen sich rein, Abriss-Kante sichtbar.
  - „Jetzt bestellen" → Haken zeichnet sich (Standard) → Bon fliegt nach oben weg → Bestellungen-Ansicht.
  - Bestellstatus im Kitchen-Board weiterschalten → Chip morpht (Angenommen→In der Küche mit blinkendem Punkt→Fertig).
  - Ansichtswechsel Speisekarte/Bon/Bestellungen: weicher Übergang.
  - Im Admin je Achse umstellen (`SOFT`, `FRAUNCES`/`SPACE_GROTESK`/`INSTRUMENT_SERIF`, `PHOTO`, `STAMP`), Gäste-Seite neu laden: Form/Schrift/Flieger/Bestätigung ändern sich.
  - Betriebssystem „Bewegung reduzieren" an → gesamter Durchlauf ohne Animation, voll bedienbar.
  - Mit greller Akzentfarbe (z. B. `#ffdd00`): Knopf-Text bleibt lesbar (bestehende `theme.ts`-Absicherung).

- [ ] **Step 6: CLAUDE.md aktualisieren** — im Abschnitt „Neu (…)" einen Eintrag mit Datum 27.08.2026 ergänzen: vier Design-Achsen pro Laden (Enum-Werte + Defaults), 14 Gäste-Animationen zentral in `animation.css`/`animation.ts`, neues Modul `bon.ts`, keine DB-Reset (nullable Spalten), Admin-Karte um 4 `<select>` erweitert. Notieren, dass CLAUDE.md-Stand „Gäste-Seite läuft noch auf altem Stand" veraltet ist (die Seite ist seit Commit `3aa28fa` migriert).

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Gaeste-Seite Bewegung + Laden-Stile in der Uebergabe festgehalten"
```

---

## Self-Review (durchgeführt)

**Spec-Abdeckung:** Spec §3 (4 Optionen) → Task 1 + 3 + 8. §4 (14 Effekte): #1/#2/#3 Tischmarke/Puls → Task 7; #4 Stagger → Task 4/5; #5 Kategorie-Strich → Task 5; #6 „+"-Dreh → Task 5 (CSS); #7 Flieger+Pop → Task 4/5; #8 Sheet-Slide → Task 8; #9 Zeilen-Tippen → Task 6; #10 Abriss-Kante → Task 6; #11 Stempel/Haken → Task 6; #12 Bon-Flug → Task 6; #13 Chip-Morph → Task 7; #14 Ansichtswechsel → Task 8. §5 Frontend-Struktur → File Structure. §6 Backend → Task 1. §7 Admin → Task 8. §8 Barrierefreiheit → in jeder Task ein `@media`-Block + Task 9 Audit. §9 Abnahme → Task 9.

**Abweichungen von der Spec:** (a) `MeResponse`/`MeController` bleiben unangetastet — begründet in „File Structure". (b) Der Kassenbon-Warenkorb wird NICHT komplett nach `bon.ts` verlagert (die Zeilen-Steppers bleiben in `index.ts`); `bon.ts` liefert nur Schmuck + Bestätigung + Flug. Grund: `index.ts` soll nicht weiter wachsen, aber der Umbau der Stepper-Zeilen wäre riskant ohne Mehrwert.

**Platzhalter:** keine — alle Code-Schritte mit konkretem Code, Testcode ausformuliert.

**Typkonsistenz:** `styleShape/displayFont/cartFlyStyle/orderConfirmStyle` (Backend + `LadenTheme`), `shape/font` (`LadenDesign`, Backend-Schreibweise), `leseModi(): {fly,confirm}` mit Literalen `"PLUS"|"PHOTO"` / `"STAMP"|"CHECK"` — durchgehend gleich in Task 1/3/5/6. `staffelEin`/`fliegeZu`/`mitAnsichtsWechsel`/`bewegungAus` aus `animation.ts` gleich benannt in Task 4/5/6/8. `aktualisiereTischmarke(nr, wartet)` neue 2-Parameter-Form in Task 7 an einziger Aufrufstelle (`index.ts`).
