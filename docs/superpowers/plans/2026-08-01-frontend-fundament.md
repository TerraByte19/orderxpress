# Frontend-Fundament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Vite-Build-Kette von `frontend/` bis in die laufende Spring-App aufbauen, das Design-System und die gemeinsame TypeScript-Bibliothek anlegen, und mit `index.html` und `device.html` zwei echte Seiten darauf umstellen.

**Architecture:** Neuer Ordner `frontend/` mit Vite im Multi-Page-Betrieb. Alle neun HTML-Seiten ziehen sofort dorthin um — zunächst unverändert, damit nichts kaputtgeht. Die alten `css/app.css` und `js/*.js` wandern nach `frontend/public/` und werden von Vite unverändert durchgereicht; spätere Pläne lösen sie Seite für Seite ab. Vite schreibt nach `src/main/resources/static`, ausgelöst vom `frontend-maven-plugin` in der Phase `generate-resources`.

**Tech Stack:** Vite 6, TypeScript 5 (strict), Vitest, `@fontsource-variable/inter`, `@fontsource-variable/lora`, `jsqr`, `frontend-maven-plugin` 1.15.1, Spring Boot 4.1.0, Java 17.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-01-frontend-redesign-design.md`. Bei Widerspruch gewinnt die Spec.
- **Branch:** `frontend-redesign`. Nicht auf `main` arbeiten.
- **Sprache:** Bezeichner Englisch **oder** Deutsch, aber Kommentare und alle Texte für Nutzer auf Deutsch. In `.java`-Dateien Umlaute als `ue/oe/ae` umschreiben; in `.ts`/`.css`/`.html` sind echte Umlaute erlaubt (UTF-8).
- **Keine Inline-Styles und kein `onclick` in neu geschriebenem HTML.** Ereignisse werden in TypeScript per `addEventListener` gebunden.
- **Keine Datei über ~250 Zeilen.**
- **Keine externen Laufzeit-Aufrufe** — keine Google Fonts, keine CDN-Skripte. Alles wird mitgebündelt.
- **TypeScript strict.** `npm run build` läuft `tsc --noEmit` vor dem Bündeln; Typfehler brechen den Build ab.
- **Das Backend wird in diesem Plan nicht angefasst.** Kein `.java` und keine `application.yml` ändern. (Das `darkMode`-Feld kommt erst in Plan 4.)
- **Vorhandene Tests sind das Sicherheitsnetz:** `mvn clean test` muss nach jeder Aufgabe grün bleiben.
- **Betrieb:** Nur eine App-Instanz auf Port 8080. `data/` niemals löschen, solange eine Instanz läuft.

---

## File Structure

**Neu angelegt:**

| Datei | Verantwortung |
|---|---|
| `frontend/package.json` | Abhängigkeiten und Skripte (`dev`, `build`, `test`) |
| `frontend/vite.config.ts` | Multi-Page-Einstiege, Ausgabeziel, Entwicklungs-Proxy |
| `frontend/tsconfig.json` | TypeScript streng, kein Emit (Vite bündelt) |
| `frontend/*.html` (9 Stück) | Seiten-Einstiege für Vite |
| `frontend/public/**` | Unverändert durchgereichte Dateien: Icons, Manifest, Service Worker, Favicon **und übergangsweise die alten `css/`+`js/`** |
| `frontend/src/styles/tokens.css` | Farb-, Abstands-, Radius-, Schriftgrad-Variablen (hell + dunkel) |
| `frontend/src/styles/base.css` | Reset, Grundtypografie, Seitengerüst |
| `frontend/src/styles/components.css` | Karte, Knopf, Feld, Chip, Leiste, Overlay, Toast |
| `frontend/src/styles/app.css` | Sammelt tokens + base + components |
| `frontend/src/styles/fonts.ts` | Bindet die beiden Schriftpakete ein |
| `frontend/src/lib/types.ts` | Backend-DTOs als TypeScript-Typen |
| `frontend/src/lib/format.ts` | Geld, Uhrzeit, Dauer |
| `frontend/src/lib/theme.ts` | Laden-Theming, Hell/Dunkel, Kontrast-Rechnung |
| `frontend/src/lib/api.ts` | fetch-Hülle mit Auth-Header und Fehlertyp |
| `frontend/src/lib/auth.ts` | localStorage-Anmeldung und Auth-Kopfzeilen (importiert nichts) |
| `frontend/src/lib/session.ts` | `/api/me` mit Zwischenspeicher, Aufbau ohne Login-Aufblitzen |
| `frontend/src/lib/sse.ts` | Ereignis-Strom über fetch mit Auth-Header |
| `frontend/src/lib/ui.ts` | Toast, Overlay, Element-Helfer |
| `frontend/src/lib/pwa.ts` | Service-Worker-Anmeldung |
| `frontend/src/pages/index.ts` | Startseite |
| `frontend/src/pages/device.ts` | Geräte-Aktivierung |
| `frontend/src/lib/*.test.ts` | Vitest-Tests zu `format`, `theme`, `api` |

**Geändert:**

| Datei | Änderung |
|---|---|
| `pom.xml:106-113` | `frontend-maven-plugin` in den `<build><plugins>`-Block |
| `.gitignore` | `frontend/node_modules/`, `src/main/resources/static/` |

**Entfernt (aus der Versionsverwaltung, Inhalt wandert nach `frontend/`):**
Der gesamte bisherige Inhalt von `src/main/resources/static/`.

---

### Task 1: Vite-Gerüst und Maven-Anbindung

Beweist die ganze Kette: `mvn spring-boot:run` baut das Frontend und Spring liefert es aus. Alle neun Seiten ziehen um, laufen aber noch mit dem alten CSS/JS — dadurch bleibt die App zu jedem Zeitpunkt vollständig funktionsfähig.

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/.npmrc`
- Move: `src/main/resources/static/*.html` → `frontend/*.html` (9 Dateien, Inhalt unverändert)
- Move: `src/main/resources/static/{css,js,icons}/`, `manifest.webmanifest`, `service-worker.js`, `favicon.ico` → `frontend/public/…` (Inhalt unverändert)
- Modify: `pom.xml:106-113`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nichts (erste Aufgabe)
- Produces: `npm run build` in `frontend/` schreibt nach `src/main/resources/static`. Alle späteren Aufgaben legen neue Dateien unter `frontend/src/` ab und binden sie per `<script type="module" src="/src/pages/<name>.ts"></script>` in die zugehörige HTML-Seite ein.

- [ ] **Step 1: Dateien verschieben**

Mit `git mv`, damit die Historie erhalten bleibt.

```bash
cd /c/OrderXpress
mkdir -p frontend/public
git mv src/main/resources/static/index.html    frontend/index.html
git mv src/main/resources/static/guest.html    frontend/guest.html
git mv src/main/resources/static/admin.html    frontend/admin.html
git mv src/main/resources/static/kitchen.html  frontend/kitchen.html
git mv src/main/resources/static/service.html  frontend/service.html
git mv src/main/resources/static/waiter.html   frontend/waiter.html
git mv src/main/resources/static/stats.html    frontend/stats.html
git mv src/main/resources/static/platform.html frontend/platform.html
git mv src/main/resources/static/device.html   frontend/device.html
git mv src/main/resources/static/css               frontend/public/css
git mv src/main/resources/static/js                frontend/public/js
git mv src/main/resources/static/icons             frontend/public/icons
git mv src/main/resources/static/manifest.webmanifest frontend/public/manifest.webmanifest
git mv src/main/resources/static/service-worker.js    frontend/public/service-worker.js
git mv src/main/resources/static/favicon.ico          frontend/public/favicon.ico
```

Prüfen, dass `src/main/resources/static/` jetzt leer ist:

```bash
ls -A src/main/resources/static 2>/dev/null
```

Erwartet: keine Ausgabe.

- [ ] **Step 2: `frontend/package.json` anlegen**

```json
{
  "name": "orderxpress-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.1.1",
    "@fontsource-variable/lora": "^5.1.1",
    "jsqr": "^1.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vite": "^6.0.11",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 3: `frontend/.npmrc` anlegen**

Damit `npm ci` im Docker-Bau nicht auf Audit-Server wartet.

```
audit=false
fund=false
```

- [ ] **Step 4: `frontend/vite.config.ts` anlegen**

```ts
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const hier = dirname(fileURLToPath(import.meta.url));

/** Jede Seite ist ein eigener Einstiegspunkt (Multi-Page-Betrieb). */
const seiten = [
  "index", "guest", "admin", "kitchen", "service",
  "waiter", "stats", "platform", "device"
];

export default defineConfig({
  build: {
    // Spring liefert alles aus diesem Ordner aus
    outDir: resolve(hier, "../src/main/resources/static"),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        seiten.map((name) => [name, resolve(hier, `${name}.html`)])
      )
    }
  },
  server: {
    port: 5173,
    // Im Entwicklungsbetrieb laeuft Spring parallel auf 8080
    proxy: {
      "/api": "http://localhost:8080"
    }
  }
});
```

- [ ] **Step 5: `frontend/tsconfig.json` anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 6: `.gitignore` ergänzen**

An das Ende der Datei anhängen:

```
frontend/node_modules/
src/main/resources/static/
```

Die alten Dateien liegen jetzt unter `frontend/`, deshalb darf der Build-Ordner ignoriert werden.

- [ ] **Step 7: `frontend-maven-plugin` in `pom.xml` eintragen**

In `pom.xml` den `<build><plugins>`-Block (Zeile 106-113) ersetzen durch:

```xml
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>

            <!-- Baut das Frontend (Ordner "frontend") und legt das Ergebnis in
                 src/main/resources/static ab. Node wird vom Plugin selbst nach
                 target/ geladen - es muss KEIN Node auf dem Rechner oder im
                 Docker-Bild installiert sein. Die Ziele haengen an der Phase
                 generate-resources, laufen also auch bei "mvn spring-boot:run". -->
            <plugin>
                <groupId>com.github.eirslett</groupId>
                <artifactId>frontend-maven-plugin</artifactId>
                <version>1.15.1</version>
                <configuration>
                    <workingDirectory>frontend</workingDirectory>
                    <installDirectory>target</installDirectory>
                </configuration>
                <executions>
                    <execution>
                        <id>install-node-and-npm</id>
                        <goals><goal>install-node-and-npm</goal></goals>
                        <configuration>
                            <nodeVersion>v22.13.1</nodeVersion>
                        </configuration>
                    </execution>
                    <execution>
                        <id>npm-ci</id>
                        <goals><goal>npm</goal></goals>
                        <configuration><arguments>ci</arguments></configuration>
                    </execution>
                    <execution>
                        <id>npm-build</id>
                        <goals><goal>npm</goal></goals>
                        <configuration><arguments>run build</arguments></configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
```

- [ ] **Step 8: Abhängigkeiten installieren und `package-lock.json` erzeugen**

`npm ci` braucht eine `package-lock.json`. Die gibt es noch nicht, deshalb einmalig `npm install`:

```bash
cd /c/OrderXpress/frontend && npm install
```

Erwartet: `frontend/package-lock.json` entsteht, `node_modules/` wird gefüllt.

- [ ] **Step 9: Bau prüfen — die Kette muss stehen**

```bash
cd /c/OrderXpress && mvn clean generate-resources
```

Erwartet: `BUILD SUCCESS`. Danach:

```bash
ls /c/OrderXpress/src/main/resources/static
```

Erwartet: die neun `.html`-Dateien, ein Ordner `assets/`, dazu `css/`, `js/`, `icons/`, `manifest.webmanifest`, `service-worker.js`, `favicon.ico`.

Schlägt der Bau mit `EPERM` oder Netzwerkfehler beim Node-Download fehl: `mvn clean generate-resources -X` für die genaue Meldung, und prüfen, ob eine Firewall den Download von `nodejs.org` blockiert.

- [ ] **Step 10: App starten und alle Seiten prüfen**

```bash
cd /c/OrderXpress && mvn spring-boot:run
```

Im Browser prüfen — **alle müssen aussehen und funktionieren wie vorher**, weil nur die Dateien umgezogen sind:

- `http://localhost:8080/` — Startseite mit der Linkliste
- `http://localhost:8080/admin.html` — Anmeldemaske erscheint
- `http://localhost:8080/manifest.webmanifest` — liefert JSON
- `http://localhost:8080/service-worker.js` — liefert JavaScript

App danach mit `Strg+C` beenden.

- [ ] **Step 11: Backend-Tests prüfen**

```bash
cd /c/OrderXpress && mvn clean test
```

Erwartet: `BUILD SUCCESS`, alle Tests grün.

- [ ] **Step 12: Commit**

```bash
cd /c/OrderXpress
git add -A
git commit -m "build: Frontend-Ordner mit Vite aufgesetzt und an Maven gehaengt

Alle neun HTML-Seiten sowie css/js/icons ziehen nach frontend/ um; die
alten Dateien laufen unveraendert weiter (Vite reicht public/ durch).
Das frontend-maven-plugin baut in der Phase generate-resources nach
src/main/resources/static, das damit generiert und ignoriert ist.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Design-Tokens, Basis-Stile und Schriften

**Files:**
- Create: `frontend/src/styles/tokens.css`, `frontend/src/styles/base.css`, `frontend/src/styles/app.css`, `frontend/src/styles/fonts.ts`

**Interfaces:**
- Consumes: das Vite-Gerüst aus Task 1
- Produces: CSS-Variablen `--ox-*` (unten vollständig gelistet) und die Schriftfamilien `--ox-font-sans` / `--ox-font-serif`. Spätere Aufgaben schreiben **keine** festen Farb-, Abstands- oder Größenwerte mehr, sondern nur noch `var(--ox-…)`. Seiten-Einstiege binden das System mit `import "../styles/app.css";` und `import "../styles/fonts";` ein.

- [ ] **Step 1: `frontend/src/styles/tokens.css` anlegen**

```css
/* Design-Tokens. Kein anderer Stil darf feste Farb-, Abstands- oder
   Groessenwerte enthalten - immer var(--ox-...) benutzen.

   Drei Ebenen ueberlagern sich:
   1. diese Grundpalette (hell)
   2. [data-theme="dark"] auf <html>  -> dunkle Haut
   3. theme.ts setzt --ox-accent / --ox-bg als Inline-Variable -> Laden-Design */
:root {
    /* --- Flaechen und Text --- */
    --ox-bg: #fdfcfa;
    --ox-surface: #ffffff;
    --ox-surface-2: #f7f6f3;
    --ox-border: #eceae5;
    --ox-text: #1a1917;
    --ox-text-muted: #83807a;

    /* --- Akzent (vom Laden ueberschreibbar) --- */
    --ox-accent: #1f3d34;
    --ox-accent-text: #ffffff;   /* wird von theme.ts berechnet */

    /* --- Signalfarben --- */
    --ox-success: #16794f;
    --ox-warn: #b26a00;
    --ox-danger: #b3261e;
    --ox-on-signal: #ffffff;

    /* --- Abstaende (4px-Raster) --- */
    --ox-space-1: 4px;
    --ox-space-2: 8px;
    --ox-space-3: 12px;
    --ox-space-4: 16px;
    --ox-space-5: 24px;
    --ox-space-6: 32px;
    --ox-space-7: 48px;
    --ox-space-8: 64px;

    /* --- Radien --- */
    --ox-radius-sm: 8px;
    --ox-radius-md: 12px;
    --ox-radius-lg: 18px;
    --ox-radius-pill: 999px;

    /* --- Schrift --- */
    --ox-font-sans: "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
    --ox-font-serif: "Lora Variable", Georgia, "Times New Roman", serif;
    --ox-text-xs: 12px;
    --ox-text-sm: 13px;
    --ox-text-base: 15px;
    --ox-text-lg: 17px;
    --ox-text-xl: 21px;
    --ox-text-2xl: 27px;
    --ox-text-3xl: 34px;

    /* --- Schatten (sparsam) --- */
    --ox-shadow-1: 0 1px 2px rgba(0, 0, 0, .04);
    --ox-shadow-2: 0 8px 24px rgba(0, 0, 0, .12);

    /* --- Mindestgroesse fuer Beruehrungsziele --- */
    --ox-touch: 44px;
    --ox-touch-lg: 56px;   /* Kueche und Kasse */
}

/* Dunkle Haut. Wird pro Laden gesetzt (Plan 4), nicht ueber die
   Systemeinstellung - der Inhaber entscheidet, wie seine Seite aussieht. */
:root[data-theme="dark"] {
    --ox-bg: #131211;
    --ox-surface: #1a1815;
    --ox-surface-2: #221f1c;
    --ox-border: #26231f;
    --ox-text: #f3efe8;
    --ox-text-muted: #8d867a;

    --ox-accent: #c9a227;
    --ox-accent-text: #131211;

    --ox-success: #4caf82;
    --ox-warn: #e0a145;
    --ox-danger: #e5776d;
    --ox-on-signal: #131211;

    --ox-shadow-1: 0 1px 2px rgba(0, 0, 0, .4);
    --ox-shadow-2: 0 8px 24px rgba(0, 0, 0, .55);
}
```

- [ ] **Step 2: `frontend/src/styles/base.css` anlegen**

```css
/* Reset und Grundtypografie. Nur Element-Selektoren - alles Benannte
   gehoert nach components.css. */

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
    margin: 0;
    background: var(--ox-bg);
    color: var(--ox-text);
    font-family: var(--ox-font-sans);
    font-size: var(--ox-text-base);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
    font-family: var(--ox-font-serif);
    font-weight: 600;
    line-height: 1.25;
    margin: 0;
}
h1 { font-size: var(--ox-text-xl); }
h2 { font-size: var(--ox-text-lg); }
h3 { font-size: var(--ox-text-base); }

p { margin: 0 0 var(--ox-space-3); }
p:last-child { margin-bottom: 0; }

a { color: inherit; }

img { max-width: 100%; }

/* Tastatur-Bedienung muss sichtbar bleiben */
:focus-visible {
    outline: 2px solid var(--ox-accent);
    outline-offset: 2px;
}

/* Seitengeruest */
main {
    max-width: 1100px;
    margin: 0 auto;
    padding: var(--ox-space-4);
}

@media (max-width: 600px) {
    main { padding: var(--ox-space-3); }
}

@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: .01ms !important;
        transition-duration: .01ms !important;
    }
}
```

- [ ] **Step 3: `frontend/src/styles/fonts.ts` anlegen**

```ts
/* Schriften werden mitgeliefert - kein Aufruf an Google Fonts.
   Die Pakete bringen variable woff2-Dateien mit; Vite buendelt sie. */
import "@fontsource-variable/inter";
import "@fontsource-variable/lora";
```

- [ ] **Step 4: `frontend/src/styles/app.css` anlegen**

`components.css` kommt in Task 6 dazu; die Zeile wird jetzt schon eingetragen, deshalb muss die Datei existieren.

```css
@import "./tokens.css";
@import "./base.css";
@import "./components.css";
```

- [ ] **Step 5: Leere `frontend/src/styles/components.css` anlegen**

```css
/* Bausteine - wird in Task 6 gefuellt. */
```

- [ ] **Step 6: Bau prüfen**

```bash
cd /c/OrderXpress/frontend && npm run build
```

Erwartet: `built in …`, kein Fehler. Die Stile sind noch von keiner Seite eingebunden — das ist in Ordnung; geprüft wird nur, dass `@import` und die Schriftpakete auflösen.

- [ ] **Step 7: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/styles
git commit -m "feat: Design-Tokens, Basis-Stile und mitgelieferte Schriften

Alle Farb-, Abstands-, Radius- und Schriftwerte als --ox-*-Variablen,
inklusive dunkler Haut ueber [data-theme=dark]. Inter und Lora kommen
als variable Schriften aus npm statt von Google.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `format.ts` — Geld, Uhrzeit, Dauer

Erste Aufgabe mit echten Tests. Ersetzt `OX.preis` und `OX.zeit` aus `public/js/api.js` und liefert zusätzlich die Wartedauer, die der Küchen-Monitor in Plan 3 braucht.

**Files:**
- Create: `frontend/src/lib/format.ts`, `frontend/src/lib/format.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `preis(wert: number | string): string` — `7` → `"7,00 €"` (mit schmalem geschütztem Leerzeichen)
  - `zeit(iso: string): string` — ISO-Zeitstempel → `"14:05"`
  - `dauerMinuten(iso: string, jetzt?: number): number` — vergangene volle Minuten seit dem Zeitstempel

- [ ] **Step 1: Test schreiben**

Datei `frontend/src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { preis, zeit, dauerMinuten } from "./format";

/* Achtung: Intl setzt vor das Euro-Zeichen ein schmales geschuetztes
   Leerzeichen (U+00A0), kein normales. Deshalb steht im Test  . */
describe("preis", () => {
    it("formatiert ganze Zahlen mit zwei Nachkommastellen", () => {
        expect(preis(7)).toBe("7,00 €");
    });

    it("nimmt auch Zeichenketten, wie sie aus JSON kommen", () => {
        expect(preis("14.5")).toBe("14,50 €");
    });

    it("formatiert null als 0,00", () => {
        expect(preis(0)).toBe("0,00 €");
    });
});

describe("zeit", () => {
    it("gibt Stunde und Minute zweistellig aus", () => {
        // Feste Zeitzonen-Angabe, damit der Test ueberall gleich laeuft
        const ergebnis = zeit("2026-08-01T14:05:00Z");
        expect(ergebnis).toMatch(/^\d{2}:\d{2}$/);
    });
});

describe("dauerMinuten", () => {
    it("rechnet vergangene Minuten aus", () => {
        const jetzt = Date.parse("2026-08-01T14:30:00Z");
        expect(dauerMinuten("2026-08-01T14:08:00Z", jetzt)).toBe(22);
    });

    it("liefert 0 fuer die Zukunft statt einer negativen Zahl", () => {
        const jetzt = Date.parse("2026-08-01T14:00:00Z");
        expect(dauerMinuten("2026-08-01T14:09:00Z", jetzt)).toBe(0);
    });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

```bash
cd /c/OrderXpress/frontend && npm test
```

Erwartet: FAIL mit `Failed to resolve import "./format"`.

- [ ] **Step 3: `frontend/src/lib/format.ts` schreiben**

```ts
/* Anzeige-Formate. Immer deutsches Format - die App laeuft in Deutschland. */

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** Geldbetrag als "7,00 €". Nimmt Zahl oder Zeichenkette (JSON liefert beides). */
export function preis(wert: number | string): string {
    return euro.format(Number(wert));
}

/** Zeitstempel als "14:05". */
export function zeit(iso: string): string {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Volle Minuten seit dem Zeitstempel. Nie negativ. */
export function dauerMinuten(iso: string, jetzt: number = Date.now()): number {
    const vergangen = jetzt - Date.parse(iso);
    return vergangen <= 0 ? 0 : Math.floor(vergangen / 60000);
}
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

```bash
cd /c/OrderXpress/frontend && npm test
```

Erwartet: `8 passed` (bzw. alle Tests grün).

- [ ] **Step 5: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/lib/format.ts frontend/src/lib/format.test.ts
git commit -m "feat: format.ts fuer Geld, Uhrzeit und Wartedauer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `theme.ts` — Laden-Design mit Kontrast-Absicherung

Behebt einen bestehenden Fehler: heute wird auf die Akzentfarbe immer weißer Text gesetzt. Wählt ein Laden Gelb, ist die Beschriftung unlesbar.

**Files:**
- Create: `frontend/src/lib/theme.ts`, `frontend/src/lib/theme.test.ts`

**Interfaces:**
- Consumes: die Variablen `--ox-accent`, `--ox-accent-text`, `--ox-bg` aus Task 2
- Produces:
  - `luminanz(hex: string): number` — relative Luminanz nach WCAG 2.1, 0 bis 1
  - `kontrast(hexA: string, hexB: string): number` — Kontrastverhältnis, 1 bis 21
  - `textfarbeAuf(hex: string): "#000000" | "#ffffff"` — was auf der Farbe lesbar ist
  - `setzeLadenDesign(design: { accentColor?: string | null; backgroundColor?: string | null; dunkel?: boolean }): void` — schreibt die Variablen auf `<html>`

- [ ] **Step 1: Test schreiben**

Datei `frontend/src/lib/theme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { luminanz, kontrast, textfarbeAuf, setzeLadenDesign } from "./theme";

describe("luminanz", () => {
    it("ist 0 fuer Schwarz", () => {
        expect(luminanz("#000000")).toBeCloseTo(0, 5);
    });

    it("ist 1 fuer Weiss", () => {
        expect(luminanz("#ffffff")).toBeCloseTo(1, 5);
    });
});

describe("kontrast", () => {
    it("ist 21 zwischen Schwarz und Weiss", () => {
        expect(kontrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    });

    it("ist 1 fuer zwei gleiche Farben", () => {
        expect(kontrast("#1f3d34", "#1f3d34")).toBeCloseTo(1, 5);
    });
});

describe("textfarbeAuf", () => {
    it("waehlt Schwarz auf Gelb - genau der Fehler, den wir beheben", () => {
        expect(textfarbeAuf("#ffff00")).toBe("#000000");
    });

    it("waehlt Weiss auf dunklem Tannengruen", () => {
        expect(textfarbeAuf("#1f3d34")).toBe("#ffffff");
    });

    it("waehlt Schwarz auf hellem Gold", () => {
        expect(textfarbeAuf("#c9a227")).toBe("#000000");
    });

    it("erreicht auf jeden Fall mindestens 4.5:1", () => {
        for (const farbe of ["#ffff00", "#1f3d34", "#c9a227", "#2563eb", "#7fdb8a"]) {
            expect(kontrast(farbe, textfarbeAuf(farbe))).toBeGreaterThanOrEqual(4.5);
        }
    });
});

describe("setzeLadenDesign", () => {
    beforeEach(() => {
        document.documentElement.removeAttribute("style");
        document.documentElement.removeAttribute("data-theme");
    });

    it("setzt Akzent samt passender Textfarbe", () => {
        setzeLadenDesign({ accentColor: "#ffff00" });
        const stil = document.documentElement.style;
        expect(stil.getPropertyValue("--ox-accent")).toBe("#ffff00");
        expect(stil.getPropertyValue("--ox-accent-text")).toBe("#000000");
    });

    it("setzt die dunkle Haut ueber data-theme", () => {
        setzeLadenDesign({ dunkel: true });
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("entfernt data-theme wieder, wenn hell gewaehlt ist", () => {
        setzeLadenDesign({ dunkel: true });
        setzeLadenDesign({ dunkel: false });
        expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    });

    it("ignoriert fehlende Werte, statt kaputte Farben zu schreiben", () => {
        setzeLadenDesign({ accentColor: null, backgroundColor: undefined });
        expect(document.documentElement.style.getPropertyValue("--ox-accent")).toBe("");
    });
});
```

- [ ] **Step 2: Vitest auf Browser-Umgebung stellen**

Die Tests brauchen `document`. In `frontend/vite.config.ts` unterhalb von `server` ergänzen:

```ts
  test: {
    environment: "jsdom"
  }
```

Damit die Eigenschaft typgeprüft wird, muss der Import oben in derselben Datei geändert werden — `defineConfig` aus Vitest statt aus Vite:

```ts
import { defineConfig } from "vitest/config";
```

Und `jsdom` als Entwicklungs-Abhängigkeit dazu:

```bash
cd /c/OrderXpress/frontend && npm install -D jsdom
```

- [ ] **Step 3: Test laufen lassen — muss fehlschlagen**

```bash
cd /c/OrderXpress/frontend && npm test
```

Erwartet: FAIL mit `Failed to resolve import "./theme"`.

- [ ] **Step 4: `frontend/src/lib/theme.ts` schreiben**

```ts
/* Laden-Design: Akzentfarbe, Hintergrund und helle/dunkle Haut.
 *
 * Wichtig ist die Kontrast-Rechnung. Frueher stand auf der Akzentfarbe
 * IMMER weisser Text - bei einem gelben Akzent war der Knopf unlesbar.
 * Jetzt entscheidet die Helligkeit der Farbe, ob Schwarz oder Weiss
 * daraufkommt (Verfahren nach WCAG 2.1). */

function hexZuRgb(hex: string): [number, number, number] {
    const roh = hex.replace("#", "");
    return [
        parseInt(roh.slice(0, 2), 16),
        parseInt(roh.slice(2, 4), 16),
        parseInt(roh.slice(4, 6), 16)
    ];
}

/** Relative Luminanz nach WCAG 2.1 (0 = Schwarz, 1 = Weiss). */
export function luminanz(hex: string): number {
    const [r, g, b] = hexZuRgb(hex).map((wert) => {
        const anteil = wert / 255;
        return anteil <= 0.03928
            ? anteil / 12.92
            : Math.pow((anteil + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhaeltnis zweier Farben (1 = gleich, 21 = Schwarz zu Weiss). */
export function kontrast(hexA: string, hexB: string): number {
    const a = luminanz(hexA);
    const b = luminanz(hexB);
    const hell = Math.max(a, b);
    const dunkel = Math.min(a, b);
    return (hell + 0.05) / (dunkel + 0.05);
}

/** Schwarz oder Weiss - was auf dieser Farbe besser lesbar ist. */
export function textfarbeAuf(hex: string): "#000000" | "#ffffff" {
    return kontrast(hex, "#000000") >= kontrast(hex, "#ffffff") ? "#000000" : "#ffffff";
}

/** Nur echte Hex-Farben durchlassen - das Backend prueft #rrggbb. */
function istHexFarbe(wert: unknown): wert is string {
    return typeof wert === "string" && /^#[0-9a-fA-F]{6}$/.test(wert);
}

export interface LadenDesign {
    accentColor?: string | null;
    backgroundColor?: string | null;
    dunkel?: boolean;
}

/** Schreibt das Design des Ladens als Variablen auf <html>. */
export function setzeLadenDesign(design: LadenDesign): void {
    const wurzel = document.documentElement;

    if (design.dunkel) {
        wurzel.setAttribute("data-theme", "dark");
    } else {
        wurzel.removeAttribute("data-theme");
    }

    if (istHexFarbe(design.accentColor)) {
        wurzel.style.setProperty("--ox-accent", design.accentColor);
        wurzel.style.setProperty("--ox-accent-text", textfarbeAuf(design.accentColor));
    }

    if (istHexFarbe(design.backgroundColor)) {
        wurzel.style.setProperty("--ox-bg", design.backgroundColor);
    }
}
```

- [ ] **Step 5: Tests laufen lassen — müssen bestehen**

```bash
cd /c/OrderXpress/frontend && npm test
```

Erwartet: alle Tests grün, auch die aus Task 3.

- [ ] **Step 6: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/lib/theme.ts frontend/src/lib/theme.test.ts frontend/vite.config.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: theme.ts mit Kontrast-Absicherung fuer die Akzentfarbe

Berechnet die Textfarbe auf dem Akzent aus dessen Luminanz statt immer
Weiss zu nehmen. Behebt unlesbare Knoepfe bei hellen Laden-Farben.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `types.ts` — Backend-DTOs als TypeScript-Typen

Nur Typen, kein Laufzeit-Code, deshalb ohne eigene Tests — die Prüfung ist `tsc --noEmit`. Jeder Typ bildet einen Java-Record ab; bei Änderungen am Backend ist diese Datei die Gegenstelle.

**Files:**
- Create: `frontend/src/lib/types.ts`

**Interfaces:**
- Consumes: nichts
- Produces: die unten definierten Typen. Alle späteren Aufgaben tippen ihre `api()`-Aufrufe damit, z. B. `await api<ScanResponse>("/api/guest/scan/" + token, { method: "POST" })`.

- [ ] **Step 1: `frontend/src/lib/types.ts` schreiben**

Die Felder stammen 1:1 aus den Java-Records unter `src/main/java/com/orderxpress/web/dto/`.

```ts
/* Gegenstelle zu den Java-Records unter web/dto.
   Aendert sich dort ein Feld, muss es hier nachgezogen werden. */

export type Rolle = "OWNER" | "SERVICE" | "KITCHEN" | "WAITER";
export type SitzungsStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CLOSED";
export type GastStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BestellStatus = "NEW" | "IN_PREPARATION" | "READY" | "SERVED" | "CANCELLED";

/** MeResponse */
export interface Me {
    name: string;
    role: Rolle;
    restaurantId: number;
    restaurantName: string;
    kitchenDisplayEnabled: boolean;
}

/** ScanResponse */
export interface ScanAntwort {
    guestToken: string;
    isHost: boolean;
    sessionStatus: SitzungsStatus;
    guestStatus: GastStatus;
    guestName: string;
    tableNumber: number;
    restaurantId: number;
    restaurantName: string;
}

/** GuestStatusResponse - Achtung: das Feld heisst "name", nicht "guestName"
    (anders als in ScanResponse). */
export interface GastStatusAntwort {
    guestStatus: GastStatus;
    sessionStatus: SitzungsStatus;
    isHost: boolean;
    name: string;
    tableNumber: number;
    restaurantId: number;
    restaurantName: string;
}

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
}

/** OrderResponse.OrderLineDto */
export interface BestellZeile {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    note: string | null;
}

/** OrderResponse */
export interface Bestellung {
    id: number;
    tableNumber: number;
    status: BestellStatus;
    createdAt: string;
    totalAmount: number;
    printed: boolean;
    items: BestellZeile[];
}

/** DeviceActivationResponse */
export interface GeraetAktivierung {
    deviceToken: string;
    label: string;
    role: Rolle;
    restaurantId: number;
    restaurantName: string;
}

/** ProblemDetail aus dem GlobalExceptionHandler */
export interface ProblemDetail {
    title?: string;
    detail?: string;
    status?: number;
}
```

- [ ] **Step 2: Typen gegen das Backend gegenprüfen**

Die obigen Felder wurden gegen die Java-Records geprüft. Zur Sicherheit noch einmal vergleichen:

```bash
cd /c/OrderXpress
cat src/main/java/com/orderxpress/web/dto/MeResponse.java
cat src/main/java/com/orderxpress/web/dto/ScanResponse.java
cat src/main/java/com/orderxpress/web/dto/GuestStatusResponse.java
cat src/main/java/com/orderxpress/web/dto/RestaurantThemeDto.java
cat src/main/java/com/orderxpress/web/dto/OrderResponse.java
cat src/main/java/com/orderxpress/web/dto/DeviceActivationResponse.java
```

Weicht ein Feld ab, gilt das Java-Record — `types.ts` anpassen, den TypeScript-Namen aber beibehalten.

**Stolperfalle, schon eingearbeitet:** `ScanResponse` nennt den Namen der Person `guestName`, `GuestStatusResponse` nennt ihn `name`. Beide Endpunkte werden von der Gäste-Seite benutzt — nicht verwechseln.

- [ ] **Step 3: Typprüfung laufen lassen**

```bash
cd /c/OrderXpress/frontend && npx tsc --noEmit
```

Erwartet: keine Ausgabe (= fehlerfrei).

- [ ] **Step 4: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/lib/types.ts
git commit -m "feat: Backend-DTOs als TypeScript-Typen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `api.ts`, `auth.ts`, `session.ts`, `sse.ts` — die Verbindung zum Backend

Portiert `public/js/api.js` (das globale `OX`-Objekt) in getrennte Module. Verhalten bleibt identisch, damit die alten Seiten und die neuen dieselbe Anmeldung teilen — insbesondere die **localStorage-Schlüssel `ox-auth` und `ox-device` dürfen sich nicht ändern**, sonst wären angemeldete Geräte plötzlich abgemeldet.

**Aufteilung mit Absicht:** `auth.ts` kennt nur den Speicher und die Kopfzeilen und importiert **nichts**. `api.ts` holt sich die Kopfzeilen von dort. `session.ts` ruft `/api/me` und braucht daher beide. Ohne diese Trennung würden sich `api.ts` und `auth.ts` gegenseitig importieren — ein Ringschluss, der je nach Ladereihenfolge zu `undefined` führt.

**Files:**
- Create: `frontend/src/lib/api.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/sse.ts`, `frontend/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `Me`, `Rolle`, `ProblemDetail` aus Task 5
- Produces:
  - `api.ts`: `class ApiFehler extends Error { readonly status: number }`, `api<T>(pfad: string, optionen?: RequestInit): Promise<T>`
  - `auth.ts`: `setzeAnmeldung(benutzer: string, passwort: string): void`, `setzeGeraeteToken(token: string): void`, `geraeteToken(): string | null`, `loescheAnmeldung(): void`, `hatAnmeldung(): boolean`, `authKopfzeilen(): Record<string, string>`, `rollenText(rolle: Rolle | string): string`
  - `session.ts`: `me(): Promise<Me>`, `vergissMe(): void`, `sichereAnmeldung(beiBereit: () => void, beiLogin: () => void): Promise<void>`
  - `sse.ts`: `verbindeSse(pfad: string, beiEreignis: (name: string, daten: unknown) => void, beiStatus?: (verbunden: boolean) => void): { stop(): void }`

- [ ] **Step 1: Test für `api.ts` schreiben**

Datei `frontend/src/lib/api.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { api, ApiFehler } from "./api";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

function antwort(status: number, koerper: string, ok = status < 400): Response {
    return {
        ok,
        status,
        text: async () => koerper
    } as unknown as Response;
}

describe("api", () => {
    it("liefert den geparsten Koerper zurueck", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => antwort(200, '{"name":"Test"}')));
        const ergebnis = await api<{ name: string }>("/api/me");
        expect(ergebnis.name).toBe("Test");
    });

    it("liefert null bei 204 ohne Inhalt", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => antwort(204, "")));
        expect(await api("/api/guest/guests/x/call", { method: "POST" })).toBeNull();
    });

    it("wirft ApiFehler mit Status und Meldung aus dem ProblemDetail", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => antwort(400, '{"detail":"Tisch nicht frei"}')));
        await expect(api("/api/guest/orders")).rejects.toMatchObject({
            message: "Tisch nicht frei",
            status: 400
        });
    });

    it("wirft ApiFehler auch ohne JSON-Koerper", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => antwort(500, "<html>kaputt</html>")));
        await expect(api("/api/me")).rejects.toBeInstanceOf(ApiFehler);
    });

    it("schickt den Geraetetoken als X-Device-Token", async () => {
        const gefaelscht = vi.fn(async () => antwort(200, "{}"));
        vi.stubGlobal("fetch", gefaelscht);
        localStorage.setItem("ox-device", "abc123");

        await api("/api/me");

        const kopfzeilen = gefaelscht.mock.calls[0][1].headers;
        expect(kopfzeilen["X-Device-Token"]).toBe("abc123");
        expect(kopfzeilen.Authorization).toBeUndefined();
    });

    it("bevorzugt den Geraetetoken vor Basic Auth", async () => {
        const gefaelscht = vi.fn(async () => antwort(200, "{}"));
        vi.stubGlobal("fetch", gefaelscht);
        localStorage.setItem("ox-auth", "Basic xyz");
        localStorage.setItem("ox-device", "abc123");

        await api("/api/me");

        expect(gefaelscht.mock.calls[0][1].headers["X-Device-Token"]).toBe("abc123");
    });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

```bash
cd /c/OrderXpress/frontend && npm test
```

Erwartet: FAIL mit `Failed to resolve import "./api"`.

- [ ] **Step 3: `frontend/src/lib/auth.ts` schreiben**

Zuerst `auth.ts`, weil `api.ts` die Kopfzeilen davon holt. Diese Datei importiert bewusst **nichts** außer Typen — sonst entsteht ein Ringschluss mit `api.ts`.

```ts
/* Anmeldung. Zwei Wege, wie bisher:
 *  1. Personen (Inhaber/Service/Kueche): Benutzername + Passwort (Basic Auth).
 *  2. Geraete (Kuechen-Tablet, Kasse, Kellner-Handy): Geraetetoken aus dem
 *     QR-Code, wird als "X-Device-Token" geschickt.
 *
 * Beides liegt im localStorage, gilt also tab-uebergreifend - einmal
 * anmelden reicht fuer alle Personal-Ansichten.
 *
 * ACHTUNG: Die Schluessel "ox-auth" und "ox-device" duerfen sich NICHT
 * aendern. Sonst waeren bereits eingerichtete Geraete abgemeldet und
 * muessten neu per QR-Code aktiviert werden.
 *
 * Diese Datei importiert absichtlich KEIN Modul mit Laufzeit-Code. Sie ist
 * die unterste Ebene; api.ts baut darauf auf. */

import type { Rolle } from "./types";

const SCHLUESSEL_AUTH = "ox-auth";
const SCHLUESSEL_GERAET = "ox-device";

/** Wird gerufen, wenn sich die Anmeldung aendert - session.ts haengt sich ein. */
const beiAenderung: Array<() => void> = [];

export function beiAnmeldungsWechsel(rueckruf: () => void): void {
    beiAenderung.push(rueckruf);
}

function meldeWechsel(): void {
    for (const rueckruf of beiAenderung) rueckruf();
}

function lies(schluessel: string): string | null {
    try { return localStorage.getItem(schluessel); } catch { return null; }
}

function schreibe(schluessel: string, wert: string): void {
    try { localStorage.setItem(schluessel, wert); } catch { /* privater Modus */ }
}

export function setzeAnmeldung(benutzer: string, passwort: string): void {
    schreibe(SCHLUESSEL_AUTH, "Basic " + btoa(benutzer + ":" + passwort));
    meldeWechsel();
}

export function setzeGeraeteToken(token: string): void {
    schreibe(SCHLUESSEL_GERAET, token);
    meldeWechsel();
}

export function geraeteToken(): string | null {
    return lies(SCHLUESSEL_GERAET);
}

export function loescheAnmeldung(): void {
    try {
        localStorage.removeItem(SCHLUESSEL_AUTH);
        localStorage.removeItem(SCHLUESSEL_GERAET);
    } catch { /* privater Modus */ }
    meldeWechsel();
}

export function hatAnmeldung(): boolean {
    return Boolean(lies(SCHLUESSEL_AUTH) || lies(SCHLUESSEL_GERAET));
}

/** Geraetetoken hat Vorrang vor Passwort. */
export function authKopfzeilen(): Record<string, string> {
    const geraet = lies(SCHLUESSEL_GERAET);
    if (geraet) return { "X-Device-Token": geraet };
    const basic = lies(SCHLUESSEL_AUTH);
    return basic ? { Authorization: basic } : {};
}

export function rollenText(rolle: Rolle | string): string {
    const namen: Record<string, string> = {
        OWNER: "Inhaber",
        SERVICE: "Service/Kasse",
        KITCHEN: "Küche",
        WAITER: "Kellner"
    };
    return namen[rolle] ?? rolle;
}
```

- [ ] **Step 4: `frontend/src/lib/api.ts` schreiben**

```ts
/* Alle Aufrufe ans Backend laufen hier durch: Auth-Kopfzeile dran,
   Fehler als ApiFehler mit Status, 204 als null. */

import { authKopfzeilen } from "./auth";
import type { ProblemDetail } from "./types";

export class ApiFehler extends Error {
    readonly status: number;

    constructor(nachricht: string, status: number) {
        super(nachricht);
        this.name = "ApiFehler";
        this.status = status;
    }
}

export async function api<T>(pfad: string, optionen: RequestInit = {}): Promise<T> {
    const antwort = await fetch(pfad, {
        ...optionen,
        headers: {
            "Content-Type": "application/json",
            ...authKopfzeilen(),
            ...(optionen.headers as Record<string, string> | undefined)
        }
    });

    if (antwort.status === 204) return null as T;

    const text = await antwort.text();
    let koerper: unknown = null;
    try { koerper = text ? JSON.parse(text) : null; } catch { /* keine JSON-Antwort */ }

    if (!antwort.ok) {
        const detail = (koerper as ProblemDetail | null)?.detail;
        throw new ApiFehler(detail ?? `Fehler ${antwort.status}`, antwort.status);
    }

    return koerper as T;
}
```

- [ ] **Step 5: `frontend/src/lib/session.ts` schreiben**

```ts
/* "Wer bin ich?" und der Aufbau ohne Login-Aufblitzen.
   Liegt getrennt von auth.ts, weil hier das Backend gerufen wird -
   auth.ts bleibt dadurch importfrei und der Ringschluss mit api.ts
   entsteht gar nicht erst. */

import { api } from "./api";
import { beiAnmeldungsWechsel, hatAnmeldung, loescheAnmeldung } from "./auth";
import type { Me } from "./types";

let zwischenspeicher: Me | null = null;

/** Merkt die Antwort, damit nicht jede Seite mehrfach /api/me ruft. */
export async function me(): Promise<Me> {
    if (!zwischenspeicher) {
        zwischenspeicher = await api<Me>("/api/me");
    }
    return zwischenspeicher;
}

export function vergissMe(): void {
    zwischenspeicher = null;
}

// Wechselt die Anmeldung, ist die gemerkte Antwort ungueltig
beiAnmeldungsWechsel(vergissMe);

/* Personal-Ansicht ohne Login-Aufblitzen aufbauen: liegt eine Anmeldung vor,
   wird sofort losgelegt und im Hintergrund geprueft. Gilt sie nicht mehr,
   wird sie verworfen und die Seite neu geladen - erst dann erscheint die
   Anmeldemaske. */
export async function sichereAnmeldung(
    beiBereit: () => void,
    beiLogin: () => void
): Promise<void> {
    if (!hatAnmeldung()) { beiLogin(); return; }
    beiBereit();
    try {
        await me();
    } catch (fehler) {
        const status = (fehler as { status?: number }).status;
        if (status === 401 || status === 403) {
            loescheAnmeldung();
            location.reload();
        }
    }
}
```

- [ ] **Step 6: `frontend/src/lib/sse.ts` schreiben**

```ts
/* Live-Ereignisse.
 *
 * Der eingebaute EventSource kann KEINEN Authorization-Header senden,
 * deshalb lesen wir den Ereignis-Strom selbst per fetch. Bei Abbruch wird
 * nach 5 Sekunden neu verbunden. */

import { authKopfzeilen } from "./auth";

export interface SseVerbindung {
    stop(): void;
}

export function verbindeSse(
    pfad: string,
    beiEreignis: (name: string, daten: unknown) => void,
    beiStatus?: (verbunden: boolean) => void
): SseVerbindung {
    let gestoppt = false;

    const lauf = async (): Promise<void> => {
        while (!gestoppt) {
            try {
                const antwort = await fetch(pfad, {
                    headers: { Accept: "text/event-stream", ...authKopfzeilen() }
                });
                if (!antwort.ok || !antwort.body) throw new Error("SSE-Verbindung fehlgeschlagen");
                beiStatus?.(true);

                const leser = antwort.body.getReader();
                const dekodierer = new TextDecoder();
                let puffer = "";

                for (;;) {
                    const { done, value } = await leser.read();
                    if (done) break;
                    puffer += dekodierer.decode(value, { stream: true });

                    let grenze: number;
                    while ((grenze = puffer.indexOf("\n\n")) >= 0) {
                        const block = puffer.slice(0, grenze);
                        puffer = puffer.slice(grenze + 2);

                        let name = "message";
                        let daten = "";
                        for (const zeile of block.split("\n")) {
                            if (zeile.startsWith("event:")) name = zeile.slice(6).trim();
                            else if (zeile.startsWith("data:")) daten += zeile.slice(5).trim();
                        }

                        if (name === "ping" || name === "connected") continue;
                        try {
                            beiEreignis(name, daten ? JSON.parse(daten) : null);
                        } catch {
                            beiEreignis(name, daten);
                        }
                    }
                }
            } catch {
                /* Verbindung weg - unten neu versuchen */
            }
            beiStatus?.(false);
            if (!gestoppt) await new Promise((weiter) => setTimeout(weiter, 5000));
        }
    };

    void lauf();
    return { stop() { gestoppt = true; } };
}
```

- [ ] **Step 7: Tests laufen lassen — müssen bestehen**

```bash
cd /c/OrderXpress/frontend && npm test
```

Erwartet: alle Tests grün.

- [ ] **Step 8: Typprüfung**

```bash
cd /c/OrderXpress/frontend && npx tsc --noEmit
```

Erwartet: keine Ausgabe.

- [ ] **Step 9: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/lib/api.ts frontend/src/lib/auth.ts frontend/src/lib/session.ts frontend/src/lib/sse.ts frontend/src/lib/api.test.ts
git commit -m "feat: api, auth, session und sse als TypeScript-Module

Portiert das globale OX-Objekt aus js/api.js. localStorage-Schluessel
ox-auth und ox-device bleiben unveraendert, damit eingerichtete Geraete
angemeldet bleiben.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `components.css` und `ui.ts` — die Bausteine

**Files:**
- Modify: `frontend/src/styles/components.css` (in Task 2 leer angelegt)
- Create: `frontend/src/lib/ui.ts`

**Interfaces:**
- Consumes: die Variablen aus Task 2
- Produces:
  - CSS-Klassen: `.ox-topbar`, `.ox-card`, `.ox-btn` (+ `.ox-btn--geist`, `--gefahr`, `--gut`, `--klein`, `--gross`), `.ox-field`, `.ox-chip` (+ `--gut`, `--warn`, `--gefahr`), `.ox-row`, `.ox-spacer`, `.ox-muted`, `.ox-center`, `.ox-grid`, `.ox-overlay`, `.ox-toast`
  - `ui.ts`: `toast(nachricht: string, istFehler?: boolean): void`, `el<K extends keyof HTMLElementTagNameMap>(tag: K, klasse?: string, text?: string): HTMLElementTagNameMap[K]`, `zeige(id: string, sichtbar: boolean): void`, `zeigeNur(sichtbareId: string, alleIds: readonly string[]): void`, `frage(text: string): boolean`

- [ ] **Step 1: `frontend/src/styles/components.css` schreiben**

```css
/* Bausteine. Alle Werte kommen aus tokens.css. */

/* --- Kopfleiste --- */
.ox-topbar {
    display: flex;
    align-items: center;
    gap: var(--ox-space-3);
    padding: var(--ox-space-3) var(--ox-space-4);
    background: var(--ox-surface);
    border-bottom: 1px solid var(--ox-border);
    position: sticky;
    top: 0;
    z-index: 10;
}
.ox-topbar h1 { flex: 1; font-size: var(--ox-text-lg); }

/* Verbindungsanzeige (SSE) */
.ox-dot {
    width: 9px;
    height: 9px;
    border-radius: var(--ox-radius-pill);
    background: var(--ox-danger);
    flex: none;
}
.ox-dot.is-on { background: var(--ox-success); }

/* --- Karte --- */
.ox-card {
    background: var(--ox-surface);
    border: 1px solid var(--ox-border);
    border-radius: var(--ox-radius-md);
    padding: var(--ox-space-4);
    margin-bottom: var(--ox-space-3);
}
.ox-card > h2 { margin-bottom: var(--ox-space-3); }

/* --- Knopf --- */
.ox-btn {
    font: inherit;
    font-weight: 500;
    border: 1px solid transparent;
    border-radius: var(--ox-radius-sm);
    padding: 0 var(--ox-space-4);
    min-height: var(--ox-touch);
    background: var(--ox-accent);
    color: var(--ox-accent-text);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--ox-space-2);
}
.ox-btn:hover:not(:disabled) { filter: brightness(1.08); }
.ox-btn:disabled { opacity: .5; cursor: not-allowed; }

.ox-btn--geist {
    background: transparent;
    color: var(--ox-text);
    border-color: var(--ox-border);
}
.ox-btn--gut    { background: var(--ox-success); color: var(--ox-on-signal); }
.ox-btn--gefahr { background: var(--ox-danger);  color: var(--ox-on-signal); }
.ox-btn--klein  { min-height: 34px; padding: 0 var(--ox-space-3); font-size: var(--ox-text-sm); }
.ox-btn--gross  { min-height: var(--ox-touch-lg); font-size: var(--ox-text-lg); }
.ox-btn--voll   { width: 100%; }

/* --- Eingabefeld --- */
.ox-field {
    font: inherit;
    width: 100%;
    min-height: var(--ox-touch);
    padding: var(--ox-space-2) var(--ox-space-3);
    border: 1px solid var(--ox-border);
    border-radius: var(--ox-radius-sm);
    background: var(--ox-surface);
    color: var(--ox-text);
    resize: vertical;
}
.ox-field::placeholder { color: var(--ox-text-muted); }

.ox-label {
    display: block;
    font-size: var(--ox-text-xs);
    color: var(--ox-text-muted);
    margin-bottom: var(--ox-space-1);
}

/* --- Chip / Abzeichen --- */
.ox-chip {
    display: inline-block;
    padding: 2px var(--ox-space-3);
    border-radius: var(--ox-radius-pill);
    font-size: var(--ox-text-xs);
    font-weight: 600;
    background: var(--ox-surface-2);
    color: var(--ox-text-muted);
    border: 1px solid var(--ox-border);
}
.ox-chip--gut    { background: var(--ox-success); color: var(--ox-on-signal); border-color: transparent; }
.ox-chip--warn   { background: var(--ox-warn);    color: var(--ox-on-signal); border-color: transparent; }
.ox-chip--gefahr { background: var(--ox-danger);  color: var(--ox-on-signal); border-color: transparent; }
.ox-chip--akzent { background: var(--ox-accent);  color: var(--ox-accent-text); border-color: transparent; }

/* --- Anordnung --- */
.ox-row {
    display: flex;
    align-items: center;
    gap: var(--ox-space-3);
    flex-wrap: wrap;
}
.ox-spacer { flex: 1; }
.ox-grid {
    display: grid;
    gap: var(--ox-space-3);
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.ox-muted { color: var(--ox-text-muted); font-size: var(--ox-text-sm); }
.ox-center { text-align: center; padding: var(--ox-space-7) var(--ox-space-4); }
.ox-big { font-size: var(--ox-text-2xl); font-family: var(--ox-font-serif); }

.ox-list { list-style: none; margin: var(--ox-space-2) 0; padding: 0; }
.ox-list li {
    padding: var(--ox-space-2) 0;
    border-bottom: 1px solid var(--ox-border);
}
.ox-list li:last-child { border-bottom: none; }

/* --- Overlay --- */
.ox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, .6);
    display: none;
    align-items: center;
    justify-content: center;
    padding: var(--ox-space-4);
    z-index: 40;
}
.ox-overlay.is-open { display: flex; }
.ox-overlay__box {
    background: var(--ox-surface);
    color: var(--ox-text);
    border-radius: var(--ox-radius-lg);
    box-shadow: var(--ox-shadow-2);
    padding: var(--ox-space-5);
    max-width: 440px;
    width: 100%;
    max-height: 88vh;
    overflow-y: auto;
}

/* --- Toast --- */
.ox-toast {
    position: fixed;
    bottom: var(--ox-space-6);
    left: 50%;
    transform: translateX(-50%);
    max-width: 90%;
    padding: var(--ox-space-3) var(--ox-space-5);
    border-radius: var(--ox-radius-pill);
    background: var(--ox-text);
    color: var(--ox-bg);
    box-shadow: var(--ox-shadow-2);
    opacity: 0;
    transition: opacity .25s;
    pointer-events: none;
    z-index: 50;
}
.ox-toast.is-open { opacity: 1; }
.ox-toast.is-error { background: var(--ox-danger); color: var(--ox-on-signal); }

/* --- Rollen-Navigation --- */
.ox-nav {
    display: flex;
    align-items: center;
    gap: var(--ox-space-2);
    flex-wrap: wrap;
    background: var(--ox-surface);
    border: 1px solid var(--ox-border);
    border-radius: var(--ox-radius-md);
    padding: var(--ox-space-2) var(--ox-space-3);
    margin-bottom: var(--ox-space-4);
}
.ox-nav a {
    text-decoration: none;
    border: 1px solid var(--ox-border);
    border-radius: var(--ox-radius-pill);
    padding: var(--ox-space-1) var(--ox-space-4);
    font-size: var(--ox-text-sm);
}
.ox-nav a.is-current {
    background: var(--ox-accent);
    color: var(--ox-accent-text);
    border-color: transparent;
}
```

- [ ] **Step 2: `frontend/src/lib/ui.ts` schreiben**

```ts
/* Kleine Helfer fuer die Oberflaeche. Kein Framework - nur DOM. */

let toastZeitgeber: number | undefined;

/** Kurze Einblend-Meldung am unteren Rand. */
export function toast(nachricht: string, istFehler = false): void {
    let element = document.querySelector<HTMLDivElement>(".ox-toast");
    if (!element) {
        element = document.createElement("div");
        element.className = "ox-toast";
        element.setAttribute("role", "status");
        element.setAttribute("aria-live", "polite");
        document.body.appendChild(element);
    }
    element.textContent = nachricht;
    element.className = "ox-toast is-open" + (istFehler ? " is-error" : "");

    window.clearTimeout(toastZeitgeber);
    toastZeitgeber = window.setTimeout(() => {
        element.className = "ox-toast" + (istFehler ? " is-error" : "");
    }, 3500);
}

/** Element bauen - spart das immergleiche createElement-Dreierpack. */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    klasse?: string,
    text?: string
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (klasse) element.className = klasse;
    if (text !== undefined) element.textContent = text;
    return element;
}

/** Element mit dieser Id ein- oder ausblenden. */
export function zeige(id: string, sichtbar: boolean): void {
    const element = document.getElementById(id);
    if (element) element.hidden = !sichtbar;
}

/** Genau EINE aus einer Gruppe von Ansichten zeigen. */
export function zeigeNur(sichtbareId: string, alleIds: readonly string[]): void {
    for (const id of alleIds) zeige(id, id === sichtbareId);
}

/** Rueckfrage vor einer nicht umkehrbaren Aktion. */
export function frage(text: string): boolean {
    return window.confirm(text);
}
```

- [ ] **Step 3: Typprüfung und Tests**

```bash
cd /c/OrderXpress/frontend && npx tsc --noEmit && npm test
```

Erwartet: keine Typfehler, alle Tests grün.

- [ ] **Step 4: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/styles/components.css frontend/src/lib/ui.ts
git commit -m "feat: Bausteine als CSS-Klassen plus ui.ts

Karte, Knopf, Feld, Chip, Overlay, Toast und Navigationsleiste - alle
Werte aus den Tokens, Beruehrungsziele mindestens 44px.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `index.html` auf das neue System

Erste Seite ohne Alt-Lasten. Klein und ohne API-Aufruf — beweist, dass Stile, Schriften und der TypeScript-Einstieg zusammenspielen.

**Files:**
- Modify: `frontend/index.html` (vollständig ersetzt)
- Create: `frontend/src/pages/index.ts`, `frontend/src/pages/index.css`, `frontend/src/lib/pwa.ts`

**Interfaces:**
- Consumes: `app.css` und `fonts.ts` aus Task 2
- Produces:
  - `pwa.ts`: `registriereServiceWorker(): void`
  - das Muster, nach dem alle folgenden Seiten gebaut werden — HTML ohne Inline-Styles und ohne `onclick`, ein `<script type="module" src="/src/pages/<name>.ts">` am Ende des `<body>`.

- [ ] **Step 1: `frontend/index.html` ersetzen**

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>OrderXpress</title>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <meta name="theme-color" content="#1f3d34">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="OrderXpress">
</head>
<body>
<header class="ox-topbar">
    <h1>OrderXpress</h1>
</header>
<main>
    <section class="ox-card">
        <h2>Ansichten</h2>
        <ul class="ox-list">
            <li><a href="/platform.html">Plattform-Verwaltung</a>
                <span class="ox-muted">– Läden anlegen (Plattform-Admin)</span></li>
            <li><a href="/admin.html">Inhaber-Ansicht</a>
                <span class="ox-muted">– Speisekarte, Tische, Design, Mitarbeiter-Logins</span></li>
            <li><a href="/service.html">Service / Kasse</a>
                <span class="ox-muted">– Tische freigeben, Bestellungen im Blick</span></li>
            <li><a href="/kitchen.html">Küchen-Monitor</a>
                <span class="ox-muted">– eingehende Bestellungen abarbeiten</span></li>
            <li><a href="/waiter.html">Kellner-Ansicht</a>
                <span class="ox-muted">– Tische einsehen und kassieren</span></li>
        </ul>
    </section>

    <section class="ox-card">
        <h2>Wie kommen Gäste auf ihre Seite?</h2>
        <p class="ox-muted">Jeder Tisch hat einen QR-Code. In der Inhaber-Ansicht bei
            einem Tisch auf „QR“ klicken (zum Ausdrucken) oder auf „Gast-Ansicht“, um
            die Seite direkt im Browser auszuprobieren.</p>
    </section>
</main>
<script type="module" src="/src/pages/index.ts"></script>
</body>
</html>
```

- [ ] **Step 2: `frontend/src/pages/index.css` anlegen**

```css
/* Startseite: die Beschreibung soll in einer Zeile hinter dem Link stehen,
   auf schmalen Bildschirmen darunter. */
.ox-list a { font-weight: 500; }

@media (max-width: 500px) {
    .ox-list .ox-muted { display: block; }
}
```

- [ ] **Step 3: `frontend/src/pages/index.ts` anlegen**

```ts
/* Startseite - reine Linkliste, kein Zustand. Bindet das Design-System ein
   und meldet den Service Worker an. */
import "../styles/app.css";
import "../styles/fonts";
import "./index.css";
import { registriereServiceWorker } from "../lib/pwa";

registriereServiceWorker();
```

- [ ] **Step 4: `frontend/src/lib/pwa.ts` anlegen**

Ersetzt `public/js/pwa.js`. Manifest und Meta-Tags stehen jetzt direkt im HTML — hier bleibt nur die Anmeldung des Service Workers.

```ts
/* Meldet den Service Worker an. Manifest und Meta-Tags stehen direkt im
   HTML jeder Seite - das frueher noetige Nachtragen per JavaScript entfaellt.
 *
 * Die Gaeste-Seite ruft das bewusst NICHT auf: Gaeste sollen die App nicht
 * installieren, sie scannen nur den QR-Code und bestellen im Browser. */
export function registriereServiceWorker(): void {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
        void navigator.serviceWorker.register("/service-worker.js").catch(() => {
            /* ohne Service Worker laeuft die App trotzdem */
        });
    });
}
```

- [ ] **Step 5: Bauen und im Browser prüfen**

```bash
cd /c/OrderXpress && mvn clean spring-boot:run
```

`http://localhost:8080/` öffnen. Prüfen:

- Schrift ist Inter, die Überschriften sind Lora (Serifen) — **nicht** mehr die Systemschrift
- Hintergrund ist das warme Off-White `#fdfcfa`, nicht das alte Grau
- Alle fünf Links führen auf ihre Seiten
- Entwicklerwerkzeuge → Konsole: keine Fehler
- Entwicklerwerkzeuge → Netzwerk: **kein** Aufruf an `fonts.googleapis.com` oder einen anderen fremden Host

App mit `Strg+C` beenden.

- [ ] **Step 6: Commit**

```bash
cd /c/OrderXpress
git add frontend/index.html frontend/src/pages/index.ts frontend/src/pages/index.css frontend/src/lib/pwa.ts
git commit -m "feat: Startseite auf das neue Design-System

Erste Seite ohne Inline-Styles und ohne onclick. pwa.js wird zu
lib/pwa.ts; Manifest und Meta-Tags stehen jetzt direkt im HTML.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: `device.html` auf das neue System

Erste Seite mit echtem Backend-Aufruf. Prüft `api.ts`, `auth.ts`, `types.ts` und `ui.ts` im Zusammenspiel. Verhalten muss identisch zu `public/js/device.js` bleiben, sonst funktionieren die QR-Codes der Personal-Geräte nicht mehr.

**Files:**
- Modify: `frontend/device.html` (vollständig ersetzt)
- Create: `frontend/src/pages/device.ts`
- Delete: `frontend/public/js/device.js`

**Interfaces:**
- Consumes: `api` (Task 6), `loescheAnmeldung`/`setzeGeraeteToken`/`rollenText` (Task 6), `GeraetAktivierung` (Task 5), `zeigeNur` (Task 7)
- Produces: nichts für spätere Aufgaben — Endpunkt der Kette

- [ ] **Step 1: `frontend/device.html` ersetzen**

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Gerät anmelden – OrderXpress</title>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <meta name="theme-color" content="#1f3d34">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="OrderXpress">
</head>
<body>
<header class="ox-topbar">
    <h1>Gerät anmelden</h1>
</header>
<main>

    <div id="view-wait" class="ox-center">
        <p class="ox-big">Einen Moment …</p>
        <p class="ox-muted">Das Gerät wird angemeldet.</p>
    </div>

    <div id="view-ok" class="ox-center" hidden>
        <p class="ox-big">Gerät angemeldet</p>
        <p id="ok-text" class="ox-muted"></p>
        <p class="ox-muted">Du wirst gleich weitergeleitet …</p>
        <p><button type="button" class="ox-btn" id="btn-go">Jetzt loslegen</button></p>
    </div>

    <div id="view-error" class="ox-center" hidden>
        <p class="ox-big">Das hat nicht geklappt</p>
        <p id="error-text" class="ox-muted"></p>
        <p class="ox-muted">Ein QR-Code funktioniert nur EINMAL. Bitte lass dir vom
            Inhaber einen neuen Code anzeigen.</p>
    </div>

</main>
<script type="module" src="/src/pages/device.ts"></script>
</body>
</html>
```

- [ ] **Step 2: `frontend/src/pages/device.ts` anlegen**

```ts
/* Geraet per QR-Code anmelden: /d/<activationToken>
   Der Einmal-Token wird gegen den dauerhaften Geraetetoken getauscht,
   der danach im Browser bleibt - kein Passwort noetig. */

import "../styles/app.css";
import "../styles/fonts";
import { api } from "../lib/api";
import { loescheAnmeldung, setzeGeraeteToken, rollenText } from "../lib/auth";
import { registriereServiceWorker } from "../lib/pwa";
import { zeigeNur } from "../lib/ui";
import type { GeraetAktivierung, Rolle } from "../lib/types";

const ANSICHTEN = ["view-wait", "view-ok", "view-error"] as const;

/** Zielseite je nach Rolle des Geraets. */
function zielFuerRolle(rolle: Rolle): string {
    if (rolle === "KITCHEN") return "/kitchen.html";
    if (rolle === "WAITER") return "/waiter.html";
    return "/service.html";
}

/** Token aus /d/<token> oder aus ?token=<token> (Entwicklungsbetrieb). */
function leseToken(): string {
    if (location.pathname.startsWith("/d/")) {
        return decodeURIComponent(location.pathname.split("/")[2] ?? "");
    }
    return new URLSearchParams(location.search).get("token") ?? "";
}

function zeigeFehler(text: string): void {
    const feld = document.getElementById("error-text");
    if (feld) feld.textContent = text;
    zeigeNur("view-error", ANSICHTEN);
}

async function start(): Promise<void> {
    const token = leseToken();
    if (!token) {
        zeigeFehler("Kein Anmelde-Code gefunden. Bitte den QR-Code scannen.");
        return;
    }

    try {
        const ergebnis = await api<GeraetAktivierung>(
            "/api/device/activate/" + encodeURIComponent(token),
            { method: "POST" }
        );

        // Eventuelle alte Anmeldung ersetzen
        loescheAnmeldung();
        setzeGeraeteToken(ergebnis.deviceToken);

        const ziel = zielFuerRolle(ergebnis.role);

        const text = document.getElementById("ok-text");
        if (text) {
            text.textContent = `${ergebnis.label} · ${rollenText(ergebnis.role)} · ${ergebnis.restaurantName}`;
        }
        document.getElementById("btn-go")?.addEventListener("click", () => {
            location.href = ziel;
        });

        zeigeNur("view-ok", ANSICHTEN);
        window.setTimeout(() => { location.href = ziel; }, 2000);
    } catch (fehler) {
        zeigeFehler((fehler as Error).message);
    }
}

registriereServiceWorker();
void start();
```

- [ ] **Step 3: Alte Datei löschen**

```bash
cd /c/OrderXpress && git rm frontend/public/js/device.js
```

- [ ] **Step 4: Typprüfung und Tests**

```bash
cd /c/OrderXpress/frontend && npx tsc --noEmit && npm test
```

Erwartet: keine Typfehler, alle Tests grün.

- [ ] **Step 5: Im Browser gegen das echte Backend prüfen**

```bash
cd /c/OrderXpress && mvn clean spring-boot:run
```

1. `http://localhost:8080/admin.html` — als `inhaber` / `inhaber123` anmelden
2. Karte „Geräte" → **+ Gerät** → Bezeichnung eingeben, Rolle **Küche**, anlegen
3. Der QR-Code erscheint. Die enthaltene Adresse endet auf `/d/<token>`
4. Diese Adresse im Browser öffnen

Erwartet:
- Kurz „Einen Moment …", dann „Gerät angemeldet" mit Bezeichnung, Rolle und Ladenname
- Nach zwei Sekunden Weiterleitung auf `/kitchen.html`, dort ist man **ohne Passwort** angemeldet
- Dieselbe `/d/<token>`-Adresse ein zweites Mal öffnen → Fehleransicht mit der Meldung des Backends (Einmal-Token verbraucht)

App mit `Strg+C` beenden.

- [ ] **Step 6: Backend-Tests prüfen**

```bash
cd /c/OrderXpress && mvn clean test
```

Erwartet: `BUILD SUCCESS`. Besonders `StaffDeviceIntegrationTest` muss grün sein.

- [ ] **Step 7: Commit**

```bash
cd /c/OrderXpress
git add -A
git commit -m "feat: Geraete-Anmeldung auf das neue System

Erste Seite mit echtem Backend-Aufruf; nutzt api, auth, types und ui.
Verhalten unveraendert, inklusive Fallback auf ?token= fuer den
Entwicklungsbetrieb. js/device.js entfaellt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Service Worker unabhängig von Prüfsummen machen

Vite hängt an jede gebündelte Datei eine Prüfsumme (`index-a3f2c1.js`). Die feste Liste im heutigen `service-worker.js` zeigt auf Namen, die es nach dem Bau nicht mehr gibt — und sie zeigt auf Dateien, die in den Plänen 2 bis 4 nach und nach verschwinden. Der Worker muss deshalb ohne feste Liste auskommen.

**Files:**
- Modify: `frontend/public/service-worker.js`

**Interfaces:**
- Consumes: nichts
- Produces: nichts — abgeschlossene Infrastruktur

- [ ] **Step 1: Aktuelles Verhalten festhalten**

Vor der Änderung im Browser prüfen, damit der Vergleich hinterher etwas wert ist:

```bash
cd /c/OrderXpress && mvn clean spring-boot:run
```

`http://localhost:8080/` öffnen → Entwicklerwerkzeuge → **Anwendung** → **Service Workers**.
Erwartet: ein aktiver Worker. Unter **Cache Storage → ox-shell-v1** stehen Einträge, darunter `/js/device.js` — die Datei gibt es seit Task 9 nicht mehr, der Eintrag ist also veraltet.

App mit `Strg+C` beenden.

- [ ] **Step 2: `frontend/public/service-worker.js` ersetzen**

```js
/* OrderXpress Service Worker - macht die App installierbar und offline-tauglich.
 *
 * Strategie:
 *  - /api/**  : NICHT anfassen -> immer frisch aus dem Netz (Bestellungen, Status).
 *  - Rest     : "network-first" -> online immer aktuell, offline aus dem Cache.
 *
 * Beim Installieren werden NUR die HTML-Seiten vorgeladen. Deren Namen sind
 * fest; alles andere (JavaScript, CSS, Schriften) traegt seit dem Umstieg auf
 * Vite eine Pruefsumme im Namen und kann hier gar nicht aufgezaehlt werden.
 * Diese Dateien landen beim ersten Aufruf von selbst im Cache - dafuer sorgt
 * der fetch-Abschnitt weiter unten.
 *
 * Die Gaeste-Seite fehlt bewusst: Gaeste sollen die App nicht installieren,
 * sie scannen den QR-Code und bestellen im Browser. */
const CACHE = "ox-shell-v2";

const SEITEN = [
    "/", "/index.html",
    "/admin.html", "/service.html", "/kitchen.html",
    "/waiter.html", "/stats.html", "/device.html", "/platform.html"
];

self.addEventListener("install", (event) => {
    // Einzelne Fehler duerfen die Installation NICHT abbrechen.
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => Promise.allSettled(SEITEN.map((pfad) => cache.add(pfad))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    // Alte Cache-Staende (auch ox-shell-v1) wegwerfen
    event.waitUntil(
        caches.keys()
            .then((namen) => Promise.all(
                namen.filter((name) => name !== CACHE).map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const anfrage = event.request;
    if (anfrage.method !== "GET") return;              // POST/PUT/DELETE nie cachen

    const adresse = new URL(anfrage.url);
    if (adresse.origin !== location.origin) return;    // fremde Hosts nicht anfassen
    if (adresse.pathname.startsWith("/api/")) return;  // Daten immer frisch aus dem Netz

    // network-first: online aktuell, offline aus dem Cache.
    // Erfolgreiche Antworten werden mitgeschrieben - so landen auch die
    // Dateien mit Pruefsumme im Namen automatisch im Cache.
    event.respondWith(
        fetch(anfrage)
            .then((antwort) => {
                if (antwort && antwort.ok) {
                    const kopie = antwort.clone();
                    caches.open(CACHE).then((cache) => cache.put(anfrage, kopie));
                }
                return antwort;
            })
            .catch(() => caches.match(anfrage).then((zwischengespeichert) =>
                zwischengespeichert || caches.match("/index.html")
            ))
    );
});
```

- [ ] **Step 3: Bauen und prüfen**

```bash
cd /c/OrderXpress && mvn clean spring-boot:run
```

Im Browser → Entwicklerwerkzeuge → **Anwendung**:

1. **Service Workers**: den alten Worker über **Unregister** entfernen, Seite neu laden. Erwartet: ein aktiver Worker.
2. **Cache Storage**: nur noch `ox-shell-v2`, `ox-shell-v1` ist verschwunden. Enthalten sind die neun HTML-Pfade, **keine** toten `/js/…`-Einträge.
3. Seite einmal normal benutzen, dann **Netzwerk → Offline** setzen und neu laden. Erwartet: die Seite erscheint weiterhin (aus dem Cache).
4. Offline auf `/admin.html` gehen. Erwartet: die Seite lädt, die Daten fehlen erwartungsgemäß.
5. Wieder online schalten.

App mit `Strg+C` beenden.

- [ ] **Step 4: Commit**

```bash
cd /c/OrderXpress
git add frontend/public/service-worker.js
git commit -m "fix: Service Worker ohne feste Datei-Liste

Vite vergibt Pruefsummen im Dateinamen, die alte SHELL-Liste zeigte
ins Leere. Vorgeladen werden nur noch die HTML-Seiten; alles andere
landet ueber den network-first-Zweig von selbst im Cache. Cache-Name
auf v2, damit der alte Stand beim Aktivieren geloescht wird.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Abschluss dieses Plans

Nach Task 10 ist der Zustand:

- `frontend/` steht, die Build-Kette läuft von `mvn spring-boot:run` bis in die Auslieferung
- Design-System und Bibliothek sind da und getestet
- Zwei Seiten laufen darauf, sieben laufen noch auf dem alten Stand — **die App ist zu jedem Zeitpunkt vollständig benutzbar**
- Backend unverändert, alle Tests grün

**Vor dem nächsten Plan noch prüfen:** ein Docker-Bau, damit sich der Render-Deploy nicht erst beim nächsten Push meldet.

```bash
cd /c/OrderXpress && docker build -t orderxpress-test .
```

Erwartet: `BUILD SUCCESS` bis zum letzten Schritt. Schlägt der Node-Download im Container fehl, im `Dockerfile` prüfen, ob die Maven-Stufe Netzzugang hat.

**Danach:** Plan 2 — Gäste-Seite.
