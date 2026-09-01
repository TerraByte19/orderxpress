# Speisekarten-Editor mit Live-Vorschau Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine neue Admin-Seite, auf der der Inhaber seine Speisekarte in der
ECHTEN Optik der Gäste-Seite bearbeitet (gleiches Theme, gleiches Rendering),
statt in einem losgelösten Formular.

**Architecture:** Wiederverwendung der bestehenden `zeichneSpeisekarte()`-
Funktion aus `guest/menu.ts` (zwei neue optionale Parameter). Eine neue,
reine Datenzusammenbau-Funktion baut aus den Admin-Endpunkten dieselbe
`Kategorie[]`-Struktur, die der Gast sieht. DOM-Nachbearbeitung hängt
Bearbeiten-Pfeile, Kategorie-Kopf-Aktionen und "+"-Kacheln an. Jede Änderung
(Speichern, Löschen, Umsortieren) lädt die Admin-Daten neu und zeichnet den
Container komplett neu (kein Navigations-Reload der Seite, aber auch kein
gezieltes DOM-Patching einzelner Karten) — einfacher und robuster als
Patchen, für ein Admin-Werkzeug ohne Performance-Druck ein guter Tausch.

**Tech Stack:** TypeScript, Vite, Vitest + jsdom (bestehender Frontend-
Stack unter `frontend/src/`). Kein Backend-Code, keine DB-Änderung.

## Global Constraints

- Bestehende Backend-Endpunkte werden 1:1 verwendet, keine neuen Routen.
- Bezeichner/Kommentare im TS-Code auf Deutsch, wie im gesamten
  `frontend/src/pages/guest`-Modul (Projekt-Konvention dort, abweichend von
  der Backend-Regel "Bezeichner Englisch" in `CLAUDE.md`, die sich auf Java
  bezieht).
- `guest/menu.ts`-Änderungen müssen für den bestehenden Gast-Aufruf
  verhaltensgleich bleiben (neue Parameter optional, Standardwerte =
  heutiges Verhalten). Bestehende Tests in `menu.test.ts` dürfen nicht
  brechen.
- Kein `npm run build`/`mvn`-Aufruf in der Cowork-Sandbox nötig für diesen
  Plan — nur `npm test` (vitest) läuft ohne Netz/Maven-Abhängigkeit.
- Spec: `docs/superpowers/specs/2026-09-01-speisekarten-editor-live-vorschau-design.md`.

### Bewusste Vereinfachungen gegenüber der Spec (im Plan entschieden)

- **Kein gezieltes DOM-Patching einzelner Karten nach dem Speichern** —
  stattdessen: Admin-Daten neu laden + Container komplett neu zeichnen. Die
  Spec verlangt nur "kein volles Neuladen der Seite" (Erfolgskriterium 2) —
  das ist weiterhin erfüllt, nur die Spec-Abschnitte 5/7 ("nur die
  betroffene Karte patchen" / "Karten im DOM vertauschen") werden so
  umgesetzt.
- **Kein "Bearbeiten"-Symbol als eigenes Element** — die ganze Karte
  antippen öffnet das Sheet (nutzt den bestehenden `beiAuswahl`-Rückruf von
  `zeichneSpeisekarte` direkt). Erfüllt Erfolgskriterium 2 wortgleich
  ("Karte antippen öffnet ein Bottom-Sheet").
- **Keine manuelle Positions-Zahl in den Sheets** — nur die Pfeile bewegen
  ein Gericht/eine Kategorie. Neue Einträge bekommen automatisch die
  nächste freie Position ans Ende.

---

## Dateiübersicht

| Datei | Rolle |
|---|---|
| `frontend/src/pages/guest/menu.ts` | **Ändern** — zwei neue optionale Parameter |
| `frontend/src/pages/guest/guest.css` | **Ändern** — Badge/Dimmen-Klassen für ausverkaufte Gerichte |
| `frontend/src/lib/types.ts` | **Ändern** — `AdminKategorie`, `AdminGericht` |
| `frontend/src/pages/menu-editor/api.ts` | **Neu** — typisierte Admin-CRUD-Aufrufe |
| `frontend/src/pages/menu-editor/daten.ts` | **Neu** — Admin-Listen → `Kategorie[]` + Info-Maps |
| `frontend/src/pages/menu-editor/reihenfolge.ts` | **Neu** — reine Tausch-Logik für Pfeile |
| `frontend/src/pages/menu-editor/sheet.ts` | **Neu** — Bearbeiten/Anlegen-Sheet für Gerichte |
| `frontend/src/pages/menu-editor/kategorie-sheet.ts` | **Neu** — Bearbeiten/Anlegen-Sheet für Kategorien |
| `frontend/src/pages/menu-editor/dekoration.ts` | **Neu** — Pfeile, "+"-Kacheln, Kategorie-Kopf-Aktionen |
| `frontend/src/pages/menu-editor/editor.css` | **Neu** — Optik der Editor-only-Elemente |
| `frontend/src/pages/menu-editor/index.ts` | **Neu** — Orchestrierung (Auth, Theme, Laden, Zeichnen) |
| `frontend/menu-editor.html` | **Neu** — Vite-Einstiegspunkt |
| `frontend/vite.config.ts` | **Ändern** — `menu-editor` zu `seiten` |
| `frontend/public/js/admin.js` | **Ändern** — Link zur neuen Seite im Menü-Tab |

---

### Task 1: `zeichneSpeisekarte()` um Editor-Bedarf erweitern

**Files:**
- Modify: `frontend/src/pages/guest/menu.ts` (Signaturen `zeichneSpeisekarte`, `baueGerichtKarte`)
- Modify: `frontend/src/pages/guest/guest.css` (neue Klassen ans Ende)
- Test: `frontend/src/pages/guest/menu.test.ts` (neue `describe`-Blöcke ergänzen)

**Interfaces:**
- Produces: `zeichneSpeisekarte(kategorien, ziel, beiAuswahl, beiSchnellHinzufuegen, bestellenErlaubt, hamburger?, istVerfuegbar?: (gerichtId: number) => boolean, zeigeLeereKategorien?: boolean): void` — neue Parameter 7+8, alle optional.
- Produces: jede von `baueGerichtKarte` erzeugte Karte trägt `dataset.gerichtId` (String der Gericht-Id) — späterer Anker für `dekoration.ts`.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Am Ende von `frontend/src/pages/guest/menu.test.ts` (innerhalb der
bestehenden Test-Datei, gleiche Helfer `gericht()`/`kategorie()` von oben
nutzen):

```ts
describe("zeichneSpeisekarte - Editor-Erweiterungen", () => {
    it("setzt dataset.gerichtId auf jeder Karte", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie()], ziel, () => {}, () => {}, true);
        const karte = ziel.querySelector<HTMLElement>(".ox-gericht");
        expect(karte?.dataset.gerichtId).toBe("1");
    });

    it("markiert ein Gericht als ausverkauft, wenn istVerfuegbar false liefert", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte(
            [kategorie()], ziel, () => {}, () => {}, true, false,
            () => false
        );
        const karte = ziel.querySelector<HTMLElement>(".ox-gericht");
        expect(karte?.classList.contains("ox-gericht--ausverkauft")).toBe(true);
        expect(karte?.querySelector(".ox-badge")?.textContent).toBe("Ausverkauft");
    });

    it("laesst Gerichte ohne istVerfuegbar-Parameter unveraendert (Gast-Verhalten)", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie()], ziel, () => {}, () => {}, true);
        const karte = ziel.querySelector<HTMLElement>(".ox-gericht");
        expect(karte?.classList.contains("ox-gericht--ausverkauft")).toBe(false);
        expect(karte?.querySelector(".ox-badge")).toBeNull();
    });

    it("zeigt eine leere Kategorie nur mit zeigeLeereKategorien=true", () => {
        const leer = kategorie({ id: 2, name: "Getraenke", items: [] });

        const ohneFlag = document.createElement("div");
        zeichneSpeisekarte([leer], ohneFlag, () => {}, () => {}, true);
        expect(ohneFlag.querySelector("#cat-2")).toBeNull();

        const mitFlag = document.createElement("div");
        zeichneSpeisekarte([leer], mitFlag, () => {}, () => {}, true, false, undefined, true);
        expect(mitFlag.querySelector("#cat-2")).not.toBeNull();
    });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd frontend && npx vitest run src/pages/guest/menu.test.ts`
Expected: FAIL — `dataset.gerichtId` ist `undefined`, `ox-gericht--ausverkauft`/`ox-badge` existieren nicht, leere Kategorie erscheint nie.

- [ ] **Step 3: Minimale Implementierung**

In `frontend/src/pages/guest/menu.ts`, `zeichneSpeisekarte` ersetzen:

```ts
export function zeichneSpeisekarte(
    kategorien: Kategorie[],
    ziel: HTMLElement,
    beiAuswahl: (gericht: Gericht) => void,
    beiSchnellHinzufuegen: (gericht: Gericht, quelle: HTMLElement) => void,
    bestellenErlaubt: boolean,
    hamburger = false,
    istVerfuegbar?: (gerichtId: number) => boolean,
    zeigeLeereKategorien = false
): void {
    ziel.textContent = "";

    const sichtbareKategorien = zeigeLeereKategorien
        ? kategorien
        : kategorien.filter((kategorie) => kategorie.items.length > 0);

    const leiste = baueKategorieLeiste(sichtbareKategorien, ziel, hamburger);
    if (leiste) ziel.appendChild(leiste);

    for (const kategorie of sichtbareKategorien) {
        const abschnitt = el("section", "ox-kategorie-abschnitt");
        abschnitt.id = `cat-${kategorie.id}`;
        abschnitt.appendChild(el("h2", undefined, kategorie.name));

        const grid = el("div", "ox-grid");
        for (const gericht of kategorie.items) {
            grid.appendChild(baueGerichtKarte(
                gericht, beiAuswahl, beiSchnellHinzufuegen, bestellenErlaubt,
                istVerfuegbar ? istVerfuegbar(gericht.id) : true
            ));
        }
        abschnitt.appendChild(grid);
        ziel.appendChild(abschnitt);
    }
}
```

`baueGerichtKarte` Signatur + Ende der Funktion ersetzen:

```ts
function baueGerichtKarte(
    gericht: Gericht,
    beiAuswahl: (gericht: Gericht) => void,
    beiSchnellHinzufuegen: (gericht: Gericht, quelle: HTMLElement) => void,
    bestellenErlaubt: boolean,
    verfuegbar = true
): HTMLElement {
    const oeffnenKnopf = knopf("ox-gericht__oeffnen", undefined,
        `${gericht.name}, ${preis(gericht.price)} – Details öffnen`);
    const bild = gericht.imageUrl ? bildElement(gericht.imageUrl) : el("div", "ox-gericht__bild ox-gericht__bild--leer");
    oeffnenKnopf.appendChild(bild);

    const inhalt = el("div", "ox-gericht__inhalt");
    inhalt.appendChild(el("span", "ox-gericht__name", gericht.name));
    if (gericht.description) inhalt.appendChild(el("span", "ox-muted", gericht.description));
    oeffnenKnopf.appendChild(inhalt);
    oeffnenKnopf.addEventListener("click", () => beiAuswahl(gericht));

    const fuss = el("div", "ox-row ox-gericht__fuss");
    const hinzufuegenKnopf = knopf("ox-btn ox-btn--klein ox-gericht__hinzufuegen", "+", `${gericht.name} hinzufügen`);
    hinzufuegenKnopf.disabled = !bestellenErlaubt;
    hinzufuegenKnopf.addEventListener("click", (ereignis) => {
        ereignis.stopPropagation();
        beiSchnellHinzufuegen(gericht, hinzufuegenKnopf);
    });
    fuss.append(el("span", "ox-preis", preis(gericht.price)), el("span", "ox-spacer"), hinzufuegenKnopf);

    const karte = el("article", "ox-card ox-gericht" + (verfuegbar ? "" : " ox-gericht--ausverkauft"));
    karte.dataset.gerichtId = String(gericht.id);
    karte.append(oeffnenKnopf, fuss);
    if (!verfuegbar) karte.appendChild(el("span", "ox-badge", "Ausverkauft"));
    return karte;
}
```

Ans Ende von `frontend/src/pages/guest/guest.css` anhängen:

```css
.ox-gericht--ausverkauft {
    opacity: .55;
}

.ox-badge {
    position: absolute;
    top: var(--ox-space-2);
    left: var(--ox-space-2);
    font-size: var(--ox-text-xs);
    padding: .15em .6em;
    border-radius: var(--ox-radius-sm);
    background: var(--ox-surface);
    border: 1px solid var(--ox-border);
    color: var(--ox-text-muted);
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd frontend && npx vitest run src/pages/guest/menu.test.ts`
Expected: PASS — alle bisherigen UND die vier neuen Tests grün.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/guest/menu.ts frontend/src/pages/guest/guest.css frontend/src/pages/guest/menu.test.ts
git commit -m "feat: zeichneSpeisekarte um Editor-Bedarf erweitern (Verfuegbarkeit, leere Kategorien, Gericht-Id)"
```

---

### Task 2: Admin-Typen + `menu-editor/api.ts`

**Files:**
- Modify: `frontend/src/lib/types.ts` (zwei neue Interfaces ans Ende)
- Create: `frontend/src/pages/menu-editor/api.ts`
- Test: `frontend/src/pages/menu-editor/api.test.ts`

**Interfaces:**
- Consumes: `api()` aus `../../lib/api`, `authKopfzeilen()` aus `../../lib/auth`.
- Produces: `AdminKategorie { id, name, sortOrder, active }`, `AdminGericht { id, categoryId, categoryName, name, description, details, price, available, sortOrder, imageUrl }` (in `lib/types.ts`).
- Produces: `holeKategorien()`, `holeGerichte()`, `legeGerichtAn(eingabe)`, `aendereGericht(id, eingabe)`, `loescheGericht(id)`, `ladeGerichtFoto(id, datei)`, `loescheGerichtFoto(id)`, `legeKategorieAn(eingabe)`, `aendereKategorie(id, eingabe)`, `loescheKategorie(id)` (alle in `./api`).

- [ ] **Step 1: Typen ergänzen**

Ans Ende von `frontend/src/lib/types.ts`:

```ts
/** CategoryDto (Admin-Sicht) */
export interface AdminKategorie {
    id: number;
    name: string;
    sortOrder: number;
    active: boolean;
}

/** MenuItemAdminDto */
export interface AdminGericht {
    id: number;
    categoryId: number;
    categoryName: string;
    name: string;
    description: string | null;
    details: string | null;
    price: number;
    available: boolean;
    sortOrder: number;
    imageUrl: string | null;
}
```

- [ ] **Step 2: Fehlschlagenden Test schreiben**

`frontend/src/pages/menu-editor/api.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({ api: vi.fn() }));
vi.mock("../../lib/auth", () => ({ authKopfzeilen: vi.fn(() => ({ Authorization: "Basic xyz" })) }));

import { api } from "../../lib/api";
import {
    aendereGericht, aendereKategorie, holeGerichte, holeKategorien,
    legeGerichtAn, legeKategorieAn, loescheGericht, loescheKategorie
} from "./api";

const apiMock = vi.mocked(api);

describe("menu-editor/api", () => {
    it("holt Kategorien ueber GET /api/admin/categories", async () => {
        apiMock.mockResolvedValueOnce([]);
        await holeKategorien();
        expect(apiMock).toHaveBeenCalledWith("/api/admin/categories");
    });

    it("holt Gerichte ueber GET /api/admin/menu-items", async () => {
        apiMock.mockResolvedValueOnce([]);
        await holeGerichte();
        expect(apiMock).toHaveBeenCalledWith("/api/admin/menu-items");
    });

    it("legt ein Gericht per POST an, ohne available im Body", async () => {
        apiMock.mockResolvedValueOnce({});
        await legeGerichtAn({ categoryId: 1, name: "Pizza", description: null, details: null, price: 9.5, sortOrder: 1 });
        expect(apiMock).toHaveBeenCalledWith("/api/admin/menu-items", {
            method: "POST",
            body: JSON.stringify({ categoryId: 1, name: "Pizza", description: null, details: null, price: 9.5, sortOrder: 1 })
        });
    });

    it("aendert ein Gericht per PUT mit available im Body", async () => {
        apiMock.mockResolvedValueOnce({});
        await aendereGericht(5, { categoryId: 1, name: "Pizza", description: null, details: null, price: 9.5, available: false, sortOrder: 1 });
        expect(apiMock).toHaveBeenCalledWith("/api/admin/menu-items/5", {
            method: "PUT",
            body: JSON.stringify({ categoryId: 1, name: "Pizza", description: null, details: null, price: 9.5, available: false, sortOrder: 1 })
        });
    });

    it("loescht ein Gericht per DELETE", async () => {
        apiMock.mockResolvedValueOnce(null);
        await loescheGericht(5);
        expect(apiMock).toHaveBeenCalledWith("/api/admin/menu-items/5", { method: "DELETE" });
    });

    it("legt eine Kategorie per POST an", async () => {
        apiMock.mockResolvedValueOnce({});
        await legeKategorieAn({ name: "Getraenke", sortOrder: 2 });
        expect(apiMock).toHaveBeenCalledWith("/api/admin/categories", {
            method: "POST",
            body: JSON.stringify({ name: "Getraenke", sortOrder: 2 })
        });
    });

    it("aendert eine Kategorie per PUT", async () => {
        apiMock.mockResolvedValueOnce({});
        await aendereKategorie(2, { name: "Getraenke", sortOrder: 2, active: false });
        expect(apiMock).toHaveBeenCalledWith("/api/admin/categories/2", {
            method: "PUT",
            body: JSON.stringify({ name: "Getraenke", sortOrder: 2, active: false })
        });
    });

    it("loescht eine Kategorie per DELETE", async () => {
        apiMock.mockResolvedValueOnce(null);
        await loescheKategorie(2);
        expect(apiMock).toHaveBeenCalledWith("/api/admin/categories/2", { method: "DELETE" });
    });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/api.test.ts`
Expected: FAIL — Modul `./api` existiert nicht.

- [ ] **Step 4: Implementierung**

`frontend/src/pages/menu-editor/api.ts`:

```ts
/* Typisierte Admin-Aufrufe fuer den Speisekarten-Editor. Dieselben
 * Endpunkte wie im alten admin.js (Menue-Tab), nur mit Typen statt
 * inline-JSON. */

import { api } from "../../lib/api";
import { authKopfzeilen } from "../../lib/auth";
import type { AdminGericht, AdminKategorie } from "../../lib/types";

export function holeKategorien(): Promise<AdminKategorie[]> {
    return api<AdminKategorie[]>("/api/admin/categories");
}

export function holeGerichte(): Promise<AdminGericht[]> {
    return api<AdminGericht[]>("/api/admin/menu-items");
}

export interface GerichtNeuEingabe {
    categoryId: number;
    name: string;
    description: string | null;
    details: string | null;
    price: number;
    sortOrder: number;
}

export interface GerichtEingabe extends GerichtNeuEingabe {
    available: boolean;
}

export function legeGerichtAn(eingabe: GerichtNeuEingabe): Promise<AdminGericht> {
    return api<AdminGericht>("/api/admin/menu-items", { method: "POST", body: JSON.stringify(eingabe) });
}

export function aendereGericht(id: number, eingabe: GerichtEingabe): Promise<AdminGericht> {
    return api<AdminGericht>(`/api/admin/menu-items/${id}`, { method: "PUT", body: JSON.stringify(eingabe) });
}

export function loescheGericht(id: number): Promise<void> {
    return api<void>(`/api/admin/menu-items/${id}`, { method: "DELETE" });
}

export async function ladeGerichtFoto(id: number, datei: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", datei);
    const antwort = await fetch(`/api/admin/menu-items/${id}/image`, {
        method: "POST",
        headers: authKopfzeilen(),
        body: formData
    });
    if (!antwort.ok) throw new Error("Foto konnte nicht hochgeladen werden");
}

export function loescheGerichtFoto(id: number): Promise<void> {
    return api<void>(`/api/admin/menu-items/${id}/image`, { method: "DELETE" });
}

export interface KategorieNeuEingabe {
    name: string;
    sortOrder: number;
}

export interface KategorieEingabe extends KategorieNeuEingabe {
    active: boolean;
}

export function legeKategorieAn(eingabe: KategorieNeuEingabe): Promise<AdminKategorie> {
    return api<AdminKategorie>("/api/admin/categories", { method: "POST", body: JSON.stringify(eingabe) });
}

export function aendereKategorie(id: number, eingabe: KategorieEingabe): Promise<AdminKategorie> {
    return api<AdminKategorie>(`/api/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(eingabe) });
}

export function loescheKategorie(id: number): Promise<void> {
    return api<void>(`/api/admin/categories/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/api.test.ts`
Expected: PASS (8 Tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/pages/menu-editor/api.ts frontend/src/pages/menu-editor/api.test.ts
git commit -m "feat: Admin-Typen + typisierte API-Aufrufe fuer den Speisekarten-Editor"
```

---

### Task 3: `daten.ts` — Admin-Listen zu `Kategorie[]` zusammenbauen

**Files:**
- Create: `frontend/src/pages/menu-editor/daten.ts`
- Test: `frontend/src/pages/menu-editor/daten.test.ts`

**Interfaces:**
- Consumes: `AdminKategorie`, `AdminGericht`, `Kategorie`, `Gericht` aus `../../lib/types`.
- Produces: `baueEditorDaten(kategorienRoh: AdminKategorie[], gerichteRoh: AdminGericht[]): EditorDaten` mit `EditorDaten { kategorien: Kategorie[]; kategorieInfo: Map<number, AdminKategorie>; gerichtInfo: Map<number, AdminGericht> }`.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`frontend/src/pages/menu-editor/daten.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AdminGericht, AdminKategorie } from "../../lib/types";
import { baueEditorDaten } from "./daten";

function kategorie(ueberschreibungen: Partial<AdminKategorie> = {}): AdminKategorie {
    return { id: 1, name: "Pizza", sortOrder: 1, active: true, ...ueberschreibungen };
}

function gericht(ueberschreibungen: Partial<AdminGericht> = {}): AdminGericht {
    return {
        id: 1, categoryId: 1, categoryName: "Pizza", name: "Margherita",
        description: null, details: null, price: 9.5, available: true,
        sortOrder: 1, imageUrl: null, ...ueberschreibungen
    };
}

describe("baueEditorDaten", () => {
    it("sortiert Kategorien und ihre Gerichte nach sortOrder", () => {
        const daten = baueEditorDaten(
            [kategorie({ id: 2, name: "Getraenke", sortOrder: 2 }), kategorie({ id: 1, sortOrder: 1 })],
            [
                gericht({ id: 2, categoryId: 1, sortOrder: 2, name: "Salami" }),
                gericht({ id: 1, categoryId: 1, sortOrder: 1, name: "Margherita" })
            ]
        );
        expect(daten.kategorien.map((k) => k.name)).toEqual(["Pizza", "Getraenke"]);
        expect(daten.kategorien[0].items.map((g) => g.name)).toEqual(["Margherita", "Salami"]);
    });

    it("nimmt ausverkaufte Gerichte und inaktive Kategorien mit auf", () => {
        const daten = baueEditorDaten([kategorie({ active: false })], [gericht({ available: false })]);
        expect(daten.kategorien).toHaveLength(1);
        expect(daten.kategorien[0].items).toHaveLength(1);
        expect(daten.kategorieInfo.get(1)?.active).toBe(false);
        expect(daten.gerichtInfo.get(1)?.available).toBe(false);
    });

    it("nimmt leere Kategorien mit auf", () => {
        const daten = baueEditorDaten([kategorie()], []);
        expect(daten.kategorien).toHaveLength(1);
        expect(daten.kategorien[0].items).toHaveLength(0);
    });

    it("wandelt ein AdminGericht in die schlanke Gast-Form um (kein categoryId/available/sortOrder)", () => {
        const daten = baueEditorDaten([kategorie()], [gericht()]);
        const g = daten.kategorien[0].items[0];
        expect(g).toEqual({ id: 1, name: "Margherita", description: null, details: null, price: 9.5, imageUrl: null });
    });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/daten.test.ts`
Expected: FAIL — Modul `./daten` existiert nicht.

- [ ] **Step 3: Implementierung**

`frontend/src/pages/menu-editor/daten.ts`:

```ts
/* Baut aus den Admin-Listen (categories/menu-items) dieselbe Kategorie[]-
 * Struktur, die zeichneSpeisekarte() vom Gast-Endpunkt bekommt - inklusive
 * inaktiver Kategorien und ausverkaufter Gerichte, die der Gast-Endpunkt
 * nie liefert (siehe Spec, Abschnitt 3). */

import type { AdminGericht, AdminKategorie, Gericht, Kategorie } from "../../lib/types";

export interface EditorDaten {
    kategorien: Kategorie[];
    kategorieInfo: Map<number, AdminKategorie>;
    gerichtInfo: Map<number, AdminGericht>;
}

function zuGericht(g: AdminGericht): Gericht {
    return { id: g.id, name: g.name, description: g.description, details: g.details, price: g.price, imageUrl: g.imageUrl };
}

export function baueEditorDaten(kategorienRoh: AdminKategorie[], gerichteRoh: AdminGericht[]): EditorDaten {
    const kategorieInfo = new Map(kategorienRoh.map((k) => [k.id, k]));
    const gerichtInfo = new Map(gerichteRoh.map((g) => [g.id, g]));

    const kategorien = [...kategorienRoh]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((k) => ({
            id: k.id,
            name: k.name,
            items: gerichteRoh
                .filter((g) => g.categoryId === k.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(zuGericht)
        }));

    return { kategorien, kategorieInfo, gerichtInfo };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/daten.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/menu-editor/daten.ts frontend/src/pages/menu-editor/daten.test.ts
git commit -m "feat: Admin-Daten zu Kategorie[] fuer die Live-Vorschau zusammenbauen"
```

---

### Task 4: `reihenfolge.ts` — Tausch-Logik für die Pfeile

**Files:**
- Create: `frontend/src/pages/menu-editor/reihenfolge.ts`
- Test: `frontend/src/pages/menu-editor/reihenfolge.test.ts`

**Interfaces:**
- Produces: `interface SortierbaresElement { id: number; sortOrder: number }`, `ermittleTausch<T extends SortierbaresElement>(liste: T[], id: number, richtung: -1 | 1): { a: T; b: T } | null`.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`frontend/src/pages/menu-editor/reihenfolge.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ermittleTausch } from "./reihenfolge";

const liste = [
    { id: 1, sortOrder: 1 },
    { id: 2, sortOrder: 2 },
    { id: 3, sortOrder: 3 }
];

describe("ermittleTausch", () => {
    it("liefert das Element und seinen Vorgaenger bei richtung -1", () => {
        expect(ermittleTausch(liste, 2, -1)).toEqual({ a: liste[1], b: liste[0] });
    });

    it("liefert das Element und seinen Nachfolger bei richtung 1", () => {
        expect(ermittleTausch(liste, 2, 1)).toEqual({ a: liste[1], b: liste[2] });
    });

    it("liefert null, wenn das erste Element nach oben soll", () => {
        expect(ermittleTausch(liste, 1, -1)).toBeNull();
    });

    it("liefert null, wenn das letzte Element nach unten soll", () => {
        expect(ermittleTausch(liste, 3, 1)).toBeNull();
    });

    it("liefert null bei unbekannter Id", () => {
        expect(ermittleTausch(liste, 99, 1)).toBeNull();
    });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/reihenfolge.test.ts`
Expected: FAIL — Modul `./reihenfolge` existiert nicht.

- [ ] **Step 3: Implementierung**

`frontend/src/pages/menu-editor/reihenfolge.ts`:

```ts
/* Reine Funktion, kein Netzwerk/DOM: ermittelt, welche zwei Nachbarn in
 * einer nach sortOrder aufsteigend sortierten Liste getauscht werden
 * muessen. Der Aufrufer (index.ts) verschickt die beiden PUT-Aufrufe mit
 * vertauschtem sortOrder. */

export interface SortierbaresElement {
    id: number;
    sortOrder: number;
}

export function ermittleTausch<T extends SortierbaresElement>(
    liste: T[],
    id: number,
    richtung: -1 | 1
): { a: T; b: T } | null {
    const index = liste.findIndex((element) => element.id === id);
    if (index === -1) return null;
    const nachbarIndex = index + richtung;
    if (nachbarIndex < 0 || nachbarIndex >= liste.length) return null;
    return { a: liste[index], b: liste[nachbarIndex] };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/reihenfolge.test.ts`
Expected: PASS (5 Tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/menu-editor/reihenfolge.ts frontend/src/pages/menu-editor/reihenfolge.test.ts
git commit -m "feat: reine Tausch-Logik fuer die Umsortieren-Pfeile"
```

---

### Task 5: `sheet.ts` — Bearbeiten/Anlegen-Sheet für Gerichte

**Files:**
- Create: `frontend/src/pages/menu-editor/sheet.ts`
- Test: `frontend/src/pages/menu-editor/sheet.test.ts`

**Interfaces:**
- Consumes: `legeGerichtAn`, `aendereGericht`, `ladeGerichtFoto`, `loescheGerichtFoto` aus `./api`; `el` aus `../../lib/ui`.
- Produces: `oeffneGerichtBearbeiten(gericht: AdminGericht, beiGespeichert: () => void): void`, `oeffneGerichtNeu(kategorieId: number, naechstePosition: number, beiGespeichert: () => void): void`.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`frontend/src/pages/menu-editor/sheet.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminGericht } from "../../lib/types";

vi.mock("./api", () => ({
    aendereGericht: vi.fn(),
    legeGerichtAn: vi.fn(),
    ladeGerichtFoto: vi.fn(),
    loescheGerichtFoto: vi.fn()
}));

import { aendereGericht, legeGerichtAn } from "./api";
import { oeffneGerichtBearbeiten, oeffneGerichtNeu } from "./sheet";

const aendereMock = vi.mocked(aendereGericht);
const legeAnMock = vi.mocked(legeGerichtAn);

function gericht(ueberschreibungen: Partial<AdminGericht> = {}): AdminGericht {
    return {
        id: 5, categoryId: 1, categoryName: "Pizza", name: "Margherita",
        description: "Tomate", details: null, price: 9.5, available: true,
        sortOrder: 1, imageUrl: null, ...ueberschreibungen
    };
}

const naechsterFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

beforeEach(() => { document.body.innerHTML = ""; vi.clearAllMocks(); });
afterEach(() => { document.body.innerHTML = ""; });

describe("oeffneGerichtBearbeiten", () => {
    it("befuellt die Felder mit dem bestehenden Gericht", async () => {
        oeffneGerichtBearbeiten(gericht(), () => {});
        await naechsterFrame();
        const name = document.querySelector<HTMLInputElement>(".ox-editor-overlay input[type=text]");
        expect(name?.value).toBe("Margherita");
    });

    it("speichert per aendereGericht und ruft beiGespeichert", async () => {
        aendereMock.mockResolvedValueOnce(gericht({ name: "Diavola" }));
        const beiGespeichert = vi.fn();
        oeffneGerichtBearbeiten(gericht(), beiGespeichert);
        await naechsterFrame();

        const felder = document.querySelectorAll<HTMLInputElement>(".ox-editor-overlay input[type=text]");
        felder[0].value = "Diavola";
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(aendereMock).toHaveBeenCalledWith(5, expect.objectContaining({ name: "Diavola", categoryId: 1 }));
        expect(beiGespeichert).toHaveBeenCalled();
    });

    it("blockt das Speichern bei leerem Namen", async () => {
        oeffneGerichtBearbeiten(gericht(), () => {});
        await naechsterFrame();
        const felder = document.querySelectorAll<HTMLInputElement>(".ox-editor-overlay input[type=text]");
        felder[0].value = "";
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
        expect(aendereMock).not.toHaveBeenCalled();
    });
});

describe("oeffneGerichtNeu", () => {
    it("legt per legeGerichtAn mit der uebergebenen Kategorie/Position an", async () => {
        legeAnMock.mockResolvedValueOnce(gericht({ id: 9 }));
        const beiGespeichert = vi.fn();
        oeffneGerichtNeu(3, 2, beiGespeichert);
        await naechsterFrame();

        const felder = document.querySelectorAll<HTMLInputElement>(".ox-editor-overlay input[type=text]");
        felder[0].value = "Calzone";
        felder[1].value = "8,00";
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(legeAnMock).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 3, sortOrder: 2, name: "Calzone", price: 8 }));
        expect(beiGespeichert).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/sheet.test.ts`
Expected: FAIL — Modul `./sheet` existiert nicht.

- [ ] **Step 3: Implementierung**

`frontend/src/pages/menu-editor/sheet.ts`:

```ts
/* Bearbeiten/Anlegen-Sheet fuer ein Gericht. Wiederverwendet das
 * .ox-overlay/.ox-overlay__box--sheet-Muster aus guest/menu.ts (Detail-
 * Overlay), aber als eigene Instanz (.ox-editor-overlay) mit editierbaren
 * Feldern statt Nur-Lese-Ansicht. Kategorie und Position werden NICHT im
 * Sheet getippt - Kategorie ergibt sich aus der Stelle, Position aus den
 * Pfeilen (siehe Spec/Plan, bewusste Vereinfachung). */

import { el } from "../../lib/ui";
import type { AdminGericht } from "../../lib/types";
import { aendereGericht, ladeGerichtFoto, legeGerichtAn, loescheGerichtFoto } from "./api";

function versteckeOverlay(overlay: HTMLElement): void {
    overlay.classList.remove("is-open");
    overlay.style.display = "";
}

document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key !== "Escape") return;
    const offen = document.querySelector<HTMLElement>(".ox-editor-overlay.is-open");
    if (offen) versteckeOverlay(offen);
});

function holeOderErstelleOverlay(): HTMLDivElement {
    const vorhanden = document.querySelector<HTMLDivElement>(".ox-editor-overlay");
    if (vorhanden) return vorhanden;
    const overlay = document.createElement("div");
    overlay.className = "ox-overlay ox-editor-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.appendChild(el("div", "ox-overlay__box ox-overlay__box--sheet"));
    overlay.addEventListener("click", (ereignis) => {
        if (ereignis.target === overlay) versteckeOverlay(overlay);
    });
    document.body.appendChild(overlay);
    return overlay;
}

function parsePreis(text: string): number {
    return Number(text.replace(",", "."));
}

export function oeffneGerichtBearbeiten(gericht: AdminGericht, beiGespeichert: () => void): void {
    oeffneSheet(gericht, beiGespeichert);
}

export function oeffneGerichtNeu(kategorieId: number, naechstePosition: number, beiGespeichert: () => void): void {
    oeffneSheet(null, beiGespeichert, kategorieId, naechstePosition);
}

function oeffneSheet(
    gericht: AdminGericht | null,
    beiGespeichert: () => void,
    neueKategorieId?: number,
    neuePosition?: number
): void {
    const overlay = holeOderErstelleOverlay();
    const box = overlay.querySelector<HTMLDivElement>(".ox-overlay__box")!;
    box.textContent = "";

    box.appendChild(el("h2", undefined, gericht ? "Gericht bearbeiten" : "Neues Gericht"));

    const nameFeld = baueTextfeld("Name");
    nameFeld.input.value = gericht?.name ?? "";
    const preisFeld = baueTextfeld("Preis (EUR)");
    preisFeld.input.value = gericht ? String(gericht.price).replace(".", ",") : "";
    const beschreibungFeld = baueTextfeld("Kurzbeschreibung");
    beschreibungFeld.input.value = gericht?.description ?? "";
    const detailsFeld = baueTextarea("Zutaten & Details");
    detailsFeld.input.value = gericht?.details ?? "";
    const verfuegbarFeld = baueCheckbox("Verfügbar");
    verfuegbarFeld.input.checked = gericht?.available ?? true;
    box.append(nameFeld.zeile, preisFeld.zeile, beschreibungFeld.zeile, detailsFeld.zeile, verfuegbarFeld.zeile);

    if (gericht) box.appendChild(baueFotoBereich(gericht));

    const fehlerAnzeige = el("p", "ox-muted");
    box.appendChild(fehlerAnzeige);

    const knopfZeile = el("div", "ox-row");
    const abbrechenKnopf = baueKnopf("ox-btn ox-btn--geist", "Abbrechen");
    abbrechenKnopf.addEventListener("click", () => versteckeOverlay(overlay));
    const speichernKnopf = baueKnopf("ox-btn", "Speichern");
    speichernKnopf.addEventListener("click", () => { void speichere(); });
    knopfZeile.append(abbrechenKnopf, el("span", "ox-spacer"), speichernKnopf);
    box.appendChild(knopfZeile);

    async function speichere(): Promise<void> {
        const name = nameFeld.input.value.trim();
        if (!name) { fehlerAnzeige.textContent = "Bitte einen Namen eingeben."; return; }
        const preisWert = parsePreis(preisFeld.input.value);
        if (!Number.isFinite(preisWert) || preisWert < 0) { fehlerAnzeige.textContent = "Bitte einen gültigen Preis eingeben."; return; }

        speichernKnopf.disabled = true;
        fehlerAnzeige.textContent = "";
        try {
            const gemeinsam = {
                categoryId: gericht?.categoryId ?? neueKategorieId!,
                name,
                description: beschreibungFeld.input.value.trim() || null,
                details: detailsFeld.input.value.trim() || null,
                price: preisWert,
                sortOrder: gericht?.sortOrder ?? neuePosition!
            };
            if (gericht) {
                await aendereGericht(gericht.id, { ...gemeinsam, available: verfuegbarFeld.input.checked });
            } else {
                await legeGerichtAn(gemeinsam);
            }
            versteckeOverlay(overlay);
            beiGespeichert();
        } catch (fehler) {
            fehlerAnzeige.textContent = (fehler as Error).message;
        } finally {
            speichernKnopf.disabled = false;
        }
    }

    overlay.style.display = "flex";
    requestAnimationFrame(() => overlay.classList.add("is-open"));
}

function baueFotoBereich(gericht: AdminGericht): HTMLElement {
    const bereich = el("div", "ox-row");
    const dateiFeld = document.createElement("input");
    dateiFeld.type = "file";
    dateiFeld.accept = "image/jpeg,image/png";
    dateiFeld.addEventListener("change", () => {
        const datei = dateiFeld.files?.[0];
        if (datei) void ladeGerichtFoto(gericht.id, datei);
    });
    bereich.appendChild(dateiFeld);
    if (gericht.imageUrl) {
        const loeschen = baueKnopf("ox-btn ox-btn--geist ox-btn--klein", "Foto löschen");
        loeschen.addEventListener("click", () => void loescheGerichtFoto(gericht.id));
        bereich.appendChild(loeschen);
    }
    return bereich;
}

function baueTextfeld(label: string): { zeile: HTMLElement; input: HTMLInputElement } {
    const zeile = el("div");
    zeile.appendChild(el("label", "ox-label", label));
    const input = document.createElement("input");
    input.type = "text";
    input.className = "ox-field";
    zeile.appendChild(input);
    return { zeile, input };
}

function baueTextarea(label: string): { zeile: HTMLElement; input: HTMLTextAreaElement } {
    const zeile = el("div");
    zeile.appendChild(el("label", "ox-label", label));
    const input = document.createElement("textarea");
    input.className = "ox-field";
    zeile.appendChild(input);
    return { zeile, input };
}

function baueCheckbox(label: string): { zeile: HTMLElement; input: HTMLInputElement } {
    const zeile = el("label", "ox-row");
    const input = document.createElement("input");
    input.type = "checkbox";
    zeile.append(input, document.createTextNode(label));
    return { zeile, input };
}

function baueKnopf(klasse: string, text: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = klasse;
    b.textContent = text;
    return b;
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/sheet.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/menu-editor/sheet.ts frontend/src/pages/menu-editor/sheet.test.ts
git commit -m "feat: Bearbeiten/Anlegen-Sheet fuer Gerichte"
```

---

### Task 6: `kategorie-sheet.ts` — Bearbeiten/Anlegen-Sheet für Kategorien

**Files:**
- Create: `frontend/src/pages/menu-editor/kategorie-sheet.ts`
- Test: `frontend/src/pages/menu-editor/kategorie-sheet.test.ts`

**Interfaces:**
- Consumes: `legeKategorieAn`, `aendereKategorie` aus `./api`.
- Produces: `oeffneKategorieBearbeiten(kategorie: AdminKategorie, beiGespeichert: () => void): void`, `oeffneKategorieNeu(naechstePosition: number, beiGespeichert: () => void): void`.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`frontend/src/pages/menu-editor/kategorie-sheet.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminKategorie } from "../../lib/types";

vi.mock("./api", () => ({ aendereKategorie: vi.fn(), legeKategorieAn: vi.fn() }));

import { aendereKategorie, legeKategorieAn } from "./api";
import { oeffneKategorieBearbeiten, oeffneKategorieNeu } from "./kategorie-sheet";

const aendereMock = vi.mocked(aendereKategorie);
const legeAnMock = vi.mocked(legeKategorieAn);

function kategorie(ueberschreibungen: Partial<AdminKategorie> = {}): AdminKategorie {
    return { id: 2, name: "Getraenke", sortOrder: 2, active: true, ...ueberschreibungen };
}

const naechsterFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

beforeEach(() => { document.body.innerHTML = ""; vi.clearAllMocks(); });
afterEach(() => { document.body.innerHTML = ""; });

describe("oeffneKategorieBearbeiten", () => {
    it("speichert Name und Sichtbarkeit per aendereKategorie", async () => {
        aendereMock.mockResolvedValueOnce(kategorie({ active: false }));
        const beiGespeichert = vi.fn();
        oeffneKategorieBearbeiten(kategorie(), beiGespeichert);
        await naechsterFrame();

        const name = document.querySelector<HTMLInputElement>(".ox-kategorie-overlay input[type=text]")!;
        name.value = "Getränke & Softdrinks";
        const sichtbar = document.querySelector<HTMLInputElement>(".ox-kategorie-overlay input[type=checkbox]")!;
        sichtbar.checked = false;
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(aendereMock).toHaveBeenCalledWith(2, { name: "Getränke & Softdrinks", active: false, sortOrder: 2 });
        expect(beiGespeichert).toHaveBeenCalled();
    });
});

describe("oeffneKategorieNeu", () => {
    it("legt mit der uebergebenen Position an", async () => {
        legeAnMock.mockResolvedValueOnce(kategorie({ id: 9 }));
        const beiGespeichert = vi.fn();
        oeffneKategorieNeu(4, beiGespeichert);
        await naechsterFrame();

        const name = document.querySelector<HTMLInputElement>(".ox-kategorie-overlay input[type=text]")!;
        name.value = "Desserts";
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(legeAnMock).toHaveBeenCalledWith({ name: "Desserts", sortOrder: 4 });
        expect(beiGespeichert).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/kategorie-sheet.test.ts`
Expected: FAIL — Modul `./kategorie-sheet` existiert nicht.

- [ ] **Step 3: Implementierung**

`frontend/src/pages/menu-editor/kategorie-sheet.ts`:

```ts
/* Bearbeiten/Anlegen-Sheet fuer eine Kategorie - gleiches Muster wie
 * sheet.ts, eigene Overlay-Instanz (.ox-kategorie-overlay). */

import { el } from "../../lib/ui";
import type { AdminKategorie } from "../../lib/types";
import { aendereKategorie, legeKategorieAn } from "./api";

function versteckeOverlay(overlay: HTMLElement): void {
    overlay.classList.remove("is-open");
    overlay.style.display = "";
}

document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key !== "Escape") return;
    const offen = document.querySelector<HTMLElement>(".ox-kategorie-overlay.is-open");
    if (offen) versteckeOverlay(offen);
});

function holeOderErstelleOverlay(): HTMLDivElement {
    const vorhanden = document.querySelector<HTMLDivElement>(".ox-kategorie-overlay");
    if (vorhanden) return vorhanden;
    const overlay = document.createElement("div");
    overlay.className = "ox-overlay ox-kategorie-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.appendChild(el("div", "ox-overlay__box ox-overlay__box--sheet"));
    overlay.addEventListener("click", (ereignis) => {
        if (ereignis.target === overlay) versteckeOverlay(overlay);
    });
    document.body.appendChild(overlay);
    return overlay;
}

export function oeffneKategorieBearbeiten(kategorie: AdminKategorie, beiGespeichert: () => void): void {
    oeffneSheet(kategorie, beiGespeichert, 0);
}

export function oeffneKategorieNeu(naechstePosition: number, beiGespeichert: () => void): void {
    oeffneSheet(null, beiGespeichert, naechstePosition);
}

function oeffneSheet(kategorie: AdminKategorie | null, beiGespeichert: () => void, naechstePosition: number): void {
    const overlay = holeOderErstelleOverlay();
    const box = overlay.querySelector<HTMLDivElement>(".ox-overlay__box")!;
    box.textContent = "";

    box.appendChild(el("h2", undefined, kategorie ? "Kategorie bearbeiten" : "Neue Kategorie"));

    const nameZeile = el("div");
    nameZeile.appendChild(el("label", "ox-label", "Name"));
    const nameFeld = document.createElement("input");
    nameFeld.type = "text";
    nameFeld.className = "ox-field";
    nameFeld.value = kategorie?.name ?? "";
    nameZeile.appendChild(nameFeld);
    box.appendChild(nameZeile);

    const sichtbarZeile = el("label", "ox-row");
    const sichtbarFeld = document.createElement("input");
    sichtbarFeld.type = "checkbox";
    sichtbarFeld.checked = kategorie?.active ?? true;
    sichtbarZeile.append(sichtbarFeld, document.createTextNode("Kategorie sichtbar"));
    box.appendChild(sichtbarZeile);

    const fehlerAnzeige = el("p", "ox-muted");
    box.appendChild(fehlerAnzeige);

    const knopfZeile = el("div", "ox-row");
    const abbrechenKnopf = baueKnopf("ox-btn ox-btn--geist", "Abbrechen");
    abbrechenKnopf.addEventListener("click", () => versteckeOverlay(overlay));
    const speichernKnopf = baueKnopf("ox-btn", "Speichern");
    speichernKnopf.addEventListener("click", () => { void speichere(); });
    knopfZeile.append(abbrechenKnopf, el("span", "ox-spacer"), speichernKnopf);
    box.appendChild(knopfZeile);

    async function speichere(): Promise<void> {
        const name = nameFeld.value.trim();
        if (!name) { fehlerAnzeige.textContent = "Bitte einen Namen eingeben."; return; }
        speichernKnopf.disabled = true;
        fehlerAnzeige.textContent = "";
        try {
            if (kategorie) {
                await aendereKategorie(kategorie.id, { name, active: sichtbarFeld.checked, sortOrder: kategorie.sortOrder });
            } else {
                await legeKategorieAn({ name, sortOrder: naechstePosition });
            }
            versteckeOverlay(overlay);
            beiGespeichert();
        } catch (fehler) {
            fehlerAnzeige.textContent = (fehler as Error).message;
        } finally {
            speichernKnopf.disabled = false;
        }
    }

    overlay.style.display = "flex";
    requestAnimationFrame(() => overlay.classList.add("is-open"));
}

function baueKnopf(klasse: string, text: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = klasse;
    b.textContent = text;
    return b;
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/kategorie-sheet.test.ts`
Expected: PASS (2 Tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/menu-editor/kategorie-sheet.ts frontend/src/pages/menu-editor/kategorie-sheet.test.ts
git commit -m "feat: Bearbeiten/Anlegen-Sheet fuer Kategorien"
```

---

### Task 7: `dekoration.ts` — Pfeile, "+"-Kacheln, Kategorie-Kopf-Aktionen

**Files:**
- Create: `frontend/src/pages/menu-editor/dekoration.ts`
- Create: `frontend/src/pages/menu-editor/editor.css`
- Test: `frontend/src/pages/menu-editor/dekoration.test.ts`

**Interfaces:**
- Consumes: DOM-Struktur, die `zeichneSpeisekarte()` erzeugt hat (`.ox-kategorie-abschnitt#cat-{id}`, `.ox-gericht[data-gericht-id]`, `.ox-grid`), `AdminKategorie` aus `../../lib/types`.
- Produces: `interface DekorationsAufrufe { beiGerichtNeu, beiGerichtVerschieben, beiKategorieBearbeiten, beiKategorieLoeschen, beiKategorieVerschieben, beiKategorieNeu }`, `dekoriereSpeisekarte(ziel: HTMLElement, kategorieInfo: Map<number, AdminKategorie>, aufrufe: DekorationsAufrufe): void`.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`frontend/src/pages/menu-editor/dekoration.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Gericht, Kategorie } from "../../lib/types";
import { zeichneSpeisekarte } from "../guest/menu";
import { dekoriereSpeisekarte } from "./dekoration";

function gericht(ueberschreibungen: Partial<Gericht> = {}): Gericht {
    return { id: 1, name: "Margherita", description: null, details: null, price: 9.5, imageUrl: null, ...ueberschreibungen };
}
function kategorie(ueberschreibungen: Partial<Kategorie> = {}): Kategorie {
    return { id: 1, name: "Pizza", items: [gericht()], ...ueberschreibungen };
}

let ziel: HTMLElement;
beforeEach(() => {
    ziel = document.createElement("div");
    document.body.appendChild(ziel);
});

function standardAufrufe() {
    return {
        beiGerichtNeu: vi.fn(),
        beiGerichtVerschieben: vi.fn(),
        beiKategorieBearbeiten: vi.fn(),
        beiKategorieLoeschen: vi.fn(),
        beiKategorieVerschieben: vi.fn(),
        beiKategorieNeu: vi.fn()
    };
}

describe("dekoriereSpeisekarte", () => {
    it("haengt eine + Gericht-Kachel je Kategorie an, die beiGerichtNeu mit der Kategorie-Id ruft", () => {
        zeichneSpeisekarte([kategorie()], ziel, () => {}, () => {}, true, false, undefined, true);
        const aufrufe = standardAufrufe();
        dekoriereSpeisekarte(ziel, new Map([[1, { id: 1, name: "Pizza", sortOrder: 1, active: true }]]), aufrufe);

        const kachel = ziel.querySelector<HTMLButtonElement>(".ox-gericht--neu")!;
        expect(kachel).not.toBeNull();
        kachel.click();
        expect(aufrufe.beiGerichtNeu).toHaveBeenCalledWith(1);
    });

    it("zeigt bei zwei Gerichten nur beim ersten den Runter-Pfeil und beim zweiten den Hoch-Pfeil", () => {
        const zweiGerichte = kategorie({ items: [gericht({ id: 1 }), gericht({ id: 2, name: "Salami" })] });
        zeichneSpeisekarte([zweiGerichte], ziel, () => {}, () => {}, true);
        const aufrufe = standardAufrufe();
        dekoriereSpeisekarte(ziel, new Map([[1, { id: 1, name: "Pizza", sortOrder: 1, active: true }]]), aufrufe);

        const karten = Array.from(ziel.querySelectorAll<HTMLElement>(".ox-gericht"));
        expect(karten[0].querySelector('[aria-label="Nach oben verschieben"]')).toBeNull();
        expect(karten[0].querySelector('[aria-label="Nach unten verschieben"]')).not.toBeNull();
        expect(karten[1].querySelector('[aria-label="Nach oben verschieben"]')).not.toBeNull();
        expect(karten[1].querySelector('[aria-label="Nach unten verschieben"]')).toBeNull();

        (karten[0].querySelector('[aria-label="Nach unten verschieben"]') as HTMLButtonElement).click();
        expect(aufrufe.beiGerichtVerschieben).toHaveBeenCalledWith(1, 1);
    });

    it("baut einen Kategorie-Kopf mit Bearbeiten/Loeschen und ruft die passenden Aufrufe", () => {
        zeichneSpeisekarte([kategorie()], ziel, () => {}, () => {}, true);
        const aufrufe = standardAufrufe();
        dekoriereSpeisekarte(ziel, new Map([[1, { id: 1, name: "Pizza", sortOrder: 1, active: true }]]), aufrufe);

        const bearbeiten = [...ziel.querySelectorAll("button")].find((b) => b.textContent === "Bearbeiten")!;
        bearbeiten.click();
        expect(aufrufe.beiKategorieBearbeiten).toHaveBeenCalledWith(1);

        const loeschen = [...ziel.querySelectorAll("button")].find((b) => b.textContent === "Löschen")!;
        loeschen.click();
        expect(aufrufe.beiKategorieLoeschen).toHaveBeenCalledWith(1);
    });

    it("haengt am Ende eine + Kategorie-Kachel an", () => {
        zeichneSpeisekarte([kategorie()], ziel, () => {}, () => {}, true);
        const aufrufe = standardAufrufe();
        dekoriereSpeisekarte(ziel, new Map([[1, { id: 1, name: "Pizza", sortOrder: 1, active: true }]]), aufrufe);

        const kachel = [...ziel.querySelectorAll("button")].find((b) => b.textContent === "+ Kategorie")!;
        kachel.click();
        expect(aufrufe.beiKategorieNeu).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/dekoration.test.ts`
Expected: FAIL — Modul `./dekoration` existiert nicht.

- [ ] **Step 3: Implementierung**

`frontend/src/pages/menu-editor/dekoration.ts`:

```ts
/* Haengt Editor-Bedienelemente an die von zeichneSpeisekarte() gebaute Karte
 * an - reine DOM-Nachbearbeitung, kein Fork der Gast-Rendering-Funktion.
 * Muss NACH zeichneSpeisekarte(..., zeigeLeereKategorien=true) laufen. */

import { el } from "../../lib/ui";
import type { AdminKategorie } from "../../lib/types";

export interface DekorationsAufrufe {
    beiGerichtNeu: (kategorieId: number) => void;
    beiGerichtVerschieben: (gerichtId: number, richtung: -1 | 1) => void;
    beiKategorieBearbeiten: (kategorieId: number) => void;
    beiKategorieLoeschen: (kategorieId: number) => void;
    beiKategorieVerschieben: (kategorieId: number, richtung: -1 | 1) => void;
    beiKategorieNeu: () => void;
}

export function dekoriereSpeisekarte(ziel: HTMLElement, kategorieInfo: Map<number, AdminKategorie>, aufrufe: DekorationsAufrufe): void {
    const abschnitte = Array.from(ziel.querySelectorAll<HTMLElement>(".ox-kategorie-abschnitt"));

    abschnitte.forEach((abschnitt, index) => {
        const kategorieId = Number(abschnitt.id.replace("cat-", ""));
        dekoriereKategorieKopf(abschnitt, kategorieId, index === 0, index === abschnitte.length - 1, aufrufe);
        dekoriereKarten(abschnitt, aufrufe.beiGerichtVerschieben);

        const grid = abschnitt.querySelector(".ox-grid");
        if (grid) grid.appendChild(baueNeueGerichtKachel(kategorieId, aufrufe.beiGerichtNeu));
    });

    const neueKategorieKnopf = knopf("ox-btn ox-btn--geist ox-editor-kategorie-neu", "+ Kategorie");
    neueKategorieKnopf.addEventListener("click", () => aufrufe.beiKategorieNeu());
    ziel.appendChild(neueKategorieKnopf);
}

function dekoriereKategorieKopf(
    abschnitt: HTMLElement,
    kategorieId: number,
    istErste: boolean,
    istLetzte: boolean,
    aufrufe: DekorationsAufrufe
): void {
    const kopf = abschnitt.querySelector("h2");
    if (!kopf) return;

    const zeile = el("div", "ox-row ox-kategorie-kopf");
    kopf.replaceWith(zeile);
    zeile.appendChild(kopf);
    zeile.appendChild(el("span", "ox-spacer"));
    zeile.appendChild(baueVerschiebeKnoepfe(istErste, istLetzte, (richtung) => aufrufe.beiKategorieVerschieben(kategorieId, richtung)));

    const bearbeiten = knopf("ox-btn ox-btn--geist ox-btn--klein", "Bearbeiten");
    bearbeiten.addEventListener("click", () => aufrufe.beiKategorieBearbeiten(kategorieId));
    zeile.appendChild(bearbeiten);

    const loeschen = knopf("ox-btn ox-btn--geist ox-btn--klein", "Löschen");
    loeschen.addEventListener("click", () => aufrufe.beiKategorieLoeschen(kategorieId));
    zeile.appendChild(loeschen);
}

function dekoriereKarten(abschnitt: HTMLElement, beiVerschieben: (gerichtId: number, richtung: -1 | 1) => void): void {
    const karten = Array.from(abschnitt.querySelectorAll<HTMLElement>(".ox-gericht"));
    karten.forEach((karte, index) => {
        const gerichtId = Number(karte.dataset.gerichtId);
        const knoepfe = baueVerschiebeKnoepfe(index === 0, index === karten.length - 1, (richtung) => beiVerschieben(gerichtId, richtung));
        knoepfe.classList.add("ox-editor-pfeile");
        karte.appendChild(knoepfe);
    });
}

function baueVerschiebeKnoepfe(istErste: boolean, istLetzte: boolean, beiKlick: (richtung: -1 | 1) => void): HTMLElement {
    const zeile = el("div", "ox-row");
    if (!istErste) {
        const hoch = knopf("ox-btn ox-btn--geist ox-btn--klein", "↑", "Nach oben verschieben");
        hoch.addEventListener("click", (ereignis) => { ereignis.stopPropagation(); beiKlick(-1); });
        zeile.appendChild(hoch);
    }
    if (!istLetzte) {
        const runter = knopf("ox-btn ox-btn--geist ox-btn--klein", "↓", "Nach unten verschieben");
        runter.addEventListener("click", (ereignis) => { ereignis.stopPropagation(); beiKlick(1); });
        zeile.appendChild(runter);
    }
    return zeile;
}

function baueNeueGerichtKachel(kategorieId: number, beiKlick: (kategorieId: number) => void): HTMLElement {
    const kachel = knopf("ox-card ox-gericht ox-gericht--neu", "+ Gericht");
    kachel.addEventListener("click", () => beiKlick(kategorieId));
    return kachel;
}

function knopf(klasse: string, text: string, ariaLabel?: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = klasse;
    b.textContent = text;
    if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
    return b;
}
```

`frontend/src/pages/menu-editor/editor.css`:

```css
/* Nur Editor-eigene Elemente - die Karten-/Kategorie-Optik selbst kommt
   unveraendert aus guest/guest.css (siehe menu-editor/index.ts, Imports). */

.ox-kategorie-kopf {
    align-items: center;
}

.ox-editor-pfeile {
    margin-top: var(--ox-space-2);
}

.ox-gericht--neu {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--ox-touch);
    border: 2px dashed var(--ox-border);
    background: transparent;
    color: var(--ox-text-muted);
    font-size: var(--ox-text-lg);
    cursor: pointer;
}

.ox-editor-kategorie-neu {
    margin-top: var(--ox-space-4);
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd frontend && npx vitest run src/pages/menu-editor/dekoration.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/menu-editor/dekoration.ts frontend/src/pages/menu-editor/dekoration.test.ts frontend/src/pages/menu-editor/editor.css
git commit -m "feat: Pfeile, Plus-Kacheln und Kategorie-Kopf-Aktionen fuer den Editor"
```

---

### Task 8: `index.ts` + `menu-editor.html` + Vite-Eintrag — Orchestrierung

**Files:**
- Create: `frontend/src/pages/menu-editor/index.ts`
- Create: `frontend/menu-editor.html`
- Modify: `frontend/vite.config.ts` (`seiten`-Array)

**Interfaces:**
- Consumes: alles aus Task 1–7 (`zeichneSpeisekarte`, `wendeThemeAn`/`ladeTheme`, `baueEditorDaten`, `dekoriereSpeisekarte`, `oeffneGerichtBearbeiten`/`oeffneGerichtNeu`, `oeffneKategorieBearbeiten`/`oeffneKategorieNeu`, `ermittleTausch`, `holeKategorien`/`holeGerichte`/`aendereGericht`/`aendereKategorie`/`loescheKategorie`), `hatAnmeldung` aus `../../lib/auth`, `api`/`ApiFehler` aus `../../lib/api`, `toast`/`frage` aus `../../lib/ui`, `Me` aus `../../lib/types`.
- Produces: keine (Einstiegspunkt, kein Export). Orchestrierungs-Dateien haben in diesem Projekt keine eigene Testdatei (Muster: `guest/index.ts` hat auch keine `index.test.ts` — die testbare Logik steckt in den importierten Modulen, die schon getestet sind).

Kein TDD-Zyklus für diesen Task (reine Verdrahtung ohne eigene Logik, wie
`guest/index.ts`). Stattdessen: schreiben, dann manuell im Dev-Server
prüfen (Step 4).

- [ ] **Step 1: `frontend/menu-editor.html` anlegen**

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Speisekarte – OrderXpress</title>
    <link rel="icon" href="/favicon.ico">
</head>
<body>
<header class="ox-topbar">
    <img id="brand-logo" alt="" hidden>
    <h1>Speisekarte</h1>
</header>
<main>
    <div id="menu-container"></div>
</main>
<script type="module" src="/src/pages/menu-editor/index.ts"></script>
</body>
</html>
```

- [ ] **Step 2: `frontend/src/pages/menu-editor/index.ts` schreiben**

```ts
/* Speisekarten-Editor: Auth-Check (nur OWNER), Theme + Daten laden, die
 * echte Gaeste-Ansicht zeichnen (zeichneSpeisekarte aus guest/menu.ts) und
 * mit Editor-Bedienelementen dekorieren (dekoration.ts). Jede Aenderung
 * laedt die Admin-Daten neu und zeichnet den Container komplett neu -
 * kein Navigations-Reload, aber auch kein gezieltes DOM-Patching (siehe
 * Plan, "Bewusste Vereinfachungen"). */

import "../../styles/app.css";
import "../../styles/fonts";
import "../guest/guest.css";
import "./editor.css";

import { api } from "../../lib/api";
import { hatAnmeldung } from "../../lib/auth";
import { frage, toast } from "../../lib/ui";
import type { AdminGericht, AdminKategorie, Me } from "../../lib/types";
import { ladeTheme, wendeThemeAn } from "../guest/laden-design";
import { zeichneSpeisekarte } from "../guest/menu";
import { aendereGericht, aendereKategorie, holeGerichte, holeKategorien, loescheKategorie } from "./api";
import { baueEditorDaten } from "./daten";
import { dekoriereSpeisekarte } from "./dekoration";
import { oeffneGerichtBearbeiten, oeffneGerichtNeu } from "./sheet";
import { oeffneKategorieBearbeiten, oeffneKategorieNeu } from "./kategorie-sheet";
import { ermittleTausch } from "./reihenfolge";

let kategorienRoh: AdminKategorie[] = [];
let gerichteRoh: AdminGericht[] = [];

async function start(): Promise<void> {
    if (!hatAnmeldung()) { location.href = "/admin.html"; return; }

    let me: Me;
    try {
        me = await api<Me>("/api/me");
    } catch {
        location.href = "/admin.html";
        return;
    }
    if (me.role !== "OWNER") {
        toast("Nur der Inhaber kann die Speisekarte hier bearbeiten.", true);
        location.href = "/admin.html";
        return;
    }

    try {
        wendeThemeAn(await ladeTheme(me.restaurantId));
    } catch { /* Theme optional, Standard-Optik greift */ }

    await ladeUndZeichne();
}

async function ladeUndZeichne(): Promise<void> {
    try {
        [kategorienRoh, gerichteRoh] = await Promise.all([holeKategorien(), holeGerichte()]);
    } catch (fehler) {
        toast((fehler as Error).message, true);
        return;
    }
    zeichneAlles();
}

function zeichneAlles(): void {
    const daten = baueEditorDaten(kategorienRoh, gerichteRoh);
    const ziel = document.getElementById("menu-container");
    if (!ziel) return;

    zeichneSpeisekarte(
        daten.kategorien,
        ziel,
        (gericht) => oeffneGerichtBearbeiten(daten.gerichtInfo.get(gericht.id)!, () => void ladeUndZeichne()),
        () => { /* kein Warenkorb im Editor */ },
        false,
        false,
        (gerichtId) => daten.gerichtInfo.get(gerichtId)?.available ?? true,
        true
    );

    dekoriereSpeisekarte(ziel, daten.kategorieInfo, {
        beiGerichtNeu: (kategorieId) => {
            const geschwister = gerichteRoh.filter((g) => g.categoryId === kategorieId);
            const naechstePosition = geschwister.length ? Math.max(...geschwister.map((g) => g.sortOrder)) + 1 : 1;
            oeffneGerichtNeu(kategorieId, naechstePosition, () => void ladeUndZeichne());
        },
        beiGerichtVerschieben: (gerichtId, richtung) => void verschiebeGericht(gerichtId, richtung),
        beiKategorieBearbeiten: (kategorieId) => {
            const kategorie = daten.kategorieInfo.get(kategorieId);
            if (kategorie) oeffneKategorieBearbeiten(kategorie, () => void ladeUndZeichne());
        },
        beiKategorieLoeschen: (kategorieId) => void loescheKategorieMitRueckfrage(kategorieId, daten.kategorieInfo.get(kategorieId)?.name ?? ""),
        beiKategorieVerschieben: (kategorieId, richtung) => void verschiebeKategorie(kategorieId, richtung),
        beiKategorieNeu: () => {
            const naechstePosition = kategorienRoh.length ? Math.max(...kategorienRoh.map((k) => k.sortOrder)) + 1 : 1;
            oeffneKategorieNeu(naechstePosition, () => void ladeUndZeichne());
        }
    });
}

function zuGerichtEingabe(g: AdminGericht) {
    return { categoryId: g.categoryId, name: g.name, description: g.description, details: g.details, price: g.price, available: g.available, sortOrder: g.sortOrder };
}

async function verschiebeGericht(gerichtId: number, richtung: -1 | 1): Promise<void> {
    const bewegtesGericht = gerichteRoh.find((g) => g.id === gerichtId);
    if (!bewegtesGericht) return;
    const geschwister = gerichteRoh
        .filter((g) => g.categoryId === bewegtesGericht.categoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    const tausch = ermittleTausch(geschwister, gerichtId, richtung);
    if (!tausch) return;

    try {
        await Promise.all([
            aendereGericht(tausch.a.id, { ...zuGerichtEingabe(tausch.a), sortOrder: tausch.b.sortOrder }),
            aendereGericht(tausch.b.id, { ...zuGerichtEingabe(tausch.b), sortOrder: tausch.a.sortOrder })
        ]);
    } catch (fehler) {
        toast((fehler as Error).message, true);
    }
    await ladeUndZeichne();
}

async function verschiebeKategorie(kategorieId: number, richtung: -1 | 1): Promise<void> {
    const sortiert = [...kategorienRoh].sort((a, b) => a.sortOrder - b.sortOrder);
    const tausch = ermittleTausch(sortiert, kategorieId, richtung);
    if (!tausch) return;

    try {
        await Promise.all([
            aendereKategorie(tausch.a.id, { name: tausch.a.name, active: tausch.a.active, sortOrder: tausch.b.sortOrder }),
            aendereKategorie(tausch.b.id, { name: tausch.b.name, active: tausch.b.active, sortOrder: tausch.a.sortOrder })
        ]);
    } catch (fehler) {
        toast((fehler as Error).message, true);
    }
    await ladeUndZeichne();
}

async function loescheKategorieMitRueckfrage(kategorieId: number, name: string): Promise<void> {
    if (!frage(`Kategorie "${name}" löschen? (Geht nur, wenn sie leer ist.)`)) return;
    try {
        await loescheKategorie(kategorieId);
        toast("Kategorie gelöscht");
    } catch (fehler) {
        toast((fehler as Error).message, true);
    }
    await ladeUndZeichne();
}

void start();
```

- [ ] **Step 3: `menu-editor` in `frontend/vite.config.ts` ergänzen**

```ts
const seiten = [
  "index", "guest", "admin", "kitchen", "service",
  "waiter", "stats", "platform", "device", "menu-editor"
];
```

- [ ] **Step 4: Manuell im Dev-Server prüfen**

Run: `cd frontend && npm run dev` (parallel Backend auf 8080, z. B. `mvn spring-boot:run` in einem zweiten Terminal)

Öffnen: `http://localhost:5173/menu-editor.html`, als Inhaber einloggen
(oder wenn schon in `admin.html` eingeloggt: direkt weiter).

Erwartet:
- Ohne Login → Redirect zu `/admin.html`.
- Eingeloggt als Inhaber → Speisekarte erscheint im Laden-Theme (Akzentfarbe/Schrift/Form stimmen mit `admin.html`-Design überein).
- Jede Kategorie hat eine gestrichelte "+ Gericht"-Kachel am Ende, ganz unten eine "+ Kategorie"-Kachel.
- Gericht antippen → Sheet mit vorbefüllten Feldern, Preis ändern, Speichern → Karte zeigt neuen Preis.
- Ausverkauft-Schalter im Sheet aus → Karte gedimmt mit "Ausverkauft"-Badge.
- Pfeile tauschen zwei Gerichte, Reihenfolge bleibt nach Neuladen der Seite erhalten.

- [ ] **Step 5: Alle bestehenden + neuen Tests zusammen laufen lassen**

Run: `cd frontend && npm test`
Expected: PASS — komplette Suite grün (bestehende Gast-Tests + alle neuen `menu-editor/*.test.ts`).

- [ ] **Step 6: `npm run build` prüfen (TypeScript-Fehler, fehlende Imports)**

Run: `cd frontend && npm run build`
Expected: baut ohne Fehler durch, `menu-editor.html` erscheint im Build-Output.

- [ ] **Step 7: Commit**

```bash
git add frontend/menu-editor.html frontend/src/pages/menu-editor/index.ts frontend/vite.config.ts
git commit -m "feat: Speisekarten-Editor Seite verdrahten (Auth, Theme, Zeichnen, Aktionen)"
```

---

### Task 9: Link im alten Menü-Tab (`admin.html`)

**Files:**
- Modify: `frontend/admin.html` (Menü-Tab-Bereich)
- Modify: `frontend/public/js/admin.js` (falls der Link Markup aus JS braucht — hier reicht reines HTML)

**Interfaces:** keine (statischer Link).

- [ ] **Step 1: Link ergänzen**

In `frontend/admin.html`, im Menü-Tab (Bereich um `id="menu-admin"` bzw.
die Knöpfe "+ Kategorie"/"+ Gericht" — Text im aktuellen Markup suchen und
direkt davor einfügen):

```html
<p class="muted">
    Neu: <a href="/menu-editor.html">Speisekarte direkt in der echten Ansicht bearbeiten →</a>
</p>
```

- [ ] **Step 2: Manuell prüfen**

Run: `cd frontend && npm run dev`, `admin.html` öffnen, Menü-Tab anklicken.
Expected: Link sichtbar, Klick öffnet `menu-editor.html` in identischer Anmeldung (kein erneutes Login nötig, da `localStorage`-Auth geteilt).

- [ ] **Step 3: Commit**

```bash
git add frontend/admin.html
git commit -m "feat: Link zum neuen Speisekarten-Editor im alten Menue-Tab"
```

---

## Self-Review (durchgeführt)

**Spec-Abdeckung:**

| Spec-Erfolgskriterium | Task |
|---|---|
| 1. Echtes Rendering + Theme | Task 8 (`zeichneAlles`, `ladeTheme`/`wendeThemeAn`) |
| 2. Karte antippen → Sheet, kein Neuladen | Task 5 + Task 8 (`beiAuswahl` → `oeffneGerichtBearbeiten`) |
| 3. "+ Gericht"-Kachel je Kategorie | Task 7 (`baueNeueGerichtKachel`) |
| 4. Ausverkauft/inaktiv sichtbar | Task 1 (Badge/Dimmen) + Task 7 (Kategorie-Kopf zeigt inaktive über `dekoriereKategorieKopf`/`kategorieInfo`) |
| 5. Pfeile für Gerichte + Kategorien | Task 4 (Logik) + Task 7 (DOM) + Task 8 (Verdrahtung) |
| 6. Keine Backend-Änderung | Alle Tasks nutzen ausschließlich bestehende Endpunkte |
| 7. Tests grün | Jeder Task hat eigene Tests, Task 8 Step 5 prüft die Gesamt-Suite |

**Placeholder-Scan:** Keine TBD/TODO, jeder Schritt hat vollständigen Code.

**Typkonsistenz geprüft:** `AdminKategorie`/`AdminGericht` (Task 2) werden
identisch in `daten.ts` (Task 3), `sheet.ts`/`kategorie-sheet.ts` (Task
5/6), `dekoration.ts` (Task 7) und `index.ts` (Task 8) verwendet.
`ermittleTausch<T extends SortierbaresElement>` (Task 4) wird in Task 8 mit
sowohl `AdminGericht[]` als auch `AdminKategorie[]` aufgerufen — beide
erfüllen `{ id: number; sortOrder: number }`, keine Anpassung nötig.
`karte.dataset.gerichtId` (Task 1) wird in `dekoriereKarten` (Task 7) exakt
so gelesen (`Number(karte.dataset.gerichtId)`).

**Scope-Check:** Ein zusammenhängendes Feature, keine weitere Aufteilung
nötig — jeder Task liefert für sich ein lauffähiges, getestetes Stück
(reine Funktion oder Modul), Task 8 fügt alles zu einer benutzbaren Seite
zusammen.
