# Bild-Zuschnitt mit echter Gast-Vorschau — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vor jedem Bild-Upload im OrderXpress-Inhaberbereich einen Zuschnitt-Schritt (ziehen/zoomen) zeigen, dessen Vorschau die echte Gäste-Ansicht als eingebettetes iframe darstellt und das Kandidatenbild live per postMessage einblendet.

**Architecture:** Ein Vanilla-Widget `frontend/public/js/bildcropper.js` setzt `window.OX.oeffneCropper(opts)` und wird als klassisches `<script>` in `admin.html` und `menu-editor.html` geladen (admin.js ist klassisch, der TS-Menü-Editor nutzt den Globalwert per `declare`). Die Gäste-Seite bekommt einen Vorschau-Modus (`?vorschau=1&restaurant=<id>&fokus=<ziel>`): kein Scan/Session, direkt Theme+Menü+Galerie rendern, Bestellen aus, `message`-Handler tauscht Logo/Hintergrund/Gericht-Foto/Galerie gegen eine übergebene dataURL. Kein Backend-Umbau — die vorhandenen öffentlichen `GET /api/guest/*`-Endpunkte reichen.

**Tech Stack:** TypeScript + Vite (Multi-Page), Vitest + jsdom für Tests, klassisches ES5-taugliches JS für das Widget. Kein neues npm-Paket.

## Global Constraints

- Kein Backend-Code ändern. Bestehende Endpunkte bleiben: `POST /api/admin/design/logo`, `POST /api/admin/design/background`, `POST /api/admin/menu-items/{id}/image`, `POST /api/admin/gallery` (alle `MultipartFile file`).
- Kein neues npm-Paket, keine externe Bibliothek.
- `frontend/public/js/*.js` sind KLASSISCHE Skripte (kein `import`/`export`, kein `type=module`). ES2017-Syntax ok (async/await), aber keine ES-Module-Syntax.
- Kommentare/Text auf Deutsch. In `.ts`/`.js` normale Umlaute erlaubt (nur Java nutzt ue/oe/ae).
- Tests laufen mit `cd frontend && npm test` (= `vitest run`, jsdom). Test-Dateien liegen neben dem Code als `*.test.ts`.
- Build-Prüfung: `cd frontend && npm run build` (= `tsc --noEmit && vite build`). Muss fehlerfrei sein.
- `postMessage` immer mit `window.location.origin` als targetOrigin; Empfänger prüft `event.origin === window.location.origin`.
- Zuschnitt-Formen + Ausgabegrößen (aus der Spec, verbindlich):
  - Logo: `form:"kreis"`, `ausgabe:600`
  - Hintergrund: `form:"breit"`, `ratio:2.5`, `ausgabe:1500`
  - Gericht-Foto: `form:"quadrat"`, `ausgabe:900`
  - Galerie: `form:"breit"`, `ratio:1.5`, `ausgabe:1200`
- Vorschau-Modus schaltet Bestellen NICHT serverseitig frei; UI-Sperre reicht, Backend lehnt ohne guestToken ohnehin ab.

Spec: `docs/superpowers/specs/2026-09-06-bild-zuschnitt-mit-gast-vorschau-design.md`

---

## Dateien im Überblick

| Datei | Zweck |
|---|---|
| `frontend/public/js/bildcropper.js` | **neu.** Vanilla-Widget. Setzt `window.OX.oeffneCropper` + reine Helfer `window.OX._crop` (für Tests). Injiziert sein eigenes CSS beim ersten Aufruf. |
| `frontend/src/lib/bildcropper.test.ts` | **neu.** Testet die reinen Helfer aus `bildcropper.js` per Seiteneffekt-Import. |
| `frontend/src/pages/guest/vorschau.ts` | **neu.** Vorschau-Modus der Gäste-Seite: erkennen, hochfahren, `message`-Handler, Fokus-Highlight. |
| `frontend/src/pages/guest/vorschau.test.ts` | **neu.** Testet Erkennung + `message`-Handler isoliert. |
| `frontend/src/pages/guest/index.ts` | **ändern.** `start()`: bei `vorschau=1` in `vorschau.ts` abbiegen. |
| `frontend/src/pages/guest/guest.css` | **ändern.** `:root[data-vorschau] { ... }` blendet Bestell-Bedienelemente aus; `.ox-vorschau-fokus` Rahmen-Puls. |
| `frontend/src/pages/menu-editor/sheet.ts` | **ändern.** `baueFotoBereich`: Datei-Auswahl → Cropper → dann `ladeGerichtFoto`. |
| `frontend/src/lib/types.ts` | **ändern.** `Window`-Deklaration für `OX.oeffneCropper`. |
| `frontend/public/js/admin.js` | **ändern.** `uploadAsset`, `uploadGalleryImage`, Menü-Foto-Aufruf → Cropper vorschalten. |
| `frontend/admin.html` | **ändern.** `<script src="/js/bildcropper.js">` ergänzen. |
| `frontend/menu-editor.html` | **ändern.** `<script src="/js/bildcropper.js">` vor dem Modul ergänzen. |

---

## Task 1: Reine Zuschnitt-Mathematik in `bildcropper.js`

**Files:**
- Create: `frontend/public/js/bildcropper.js`
- Test: `frontend/src/lib/bildcropper.test.ts`

**Interfaces:**
- Produces (global, gesetzt beim Laden des Skripts, ohne DOM-Zugriff):
  - `window.OX._crop.minSkala(bildB, bildH, maskB, maskH) → number` — kleinste Skala, sodass Maske voll bedeckt ist ("cover").
  - `window.OX._crop.klemmeVersatz(versatz, bildMass, skala, maskMass) → number` — klemmt einen Achsen-Versatz (px) auf den erlaubten Bereich.
  - `window.OX._crop.ausgabeMasse(ausgabe, ratio) → {w:number, h:number}` — Ausgabe-Canvas-Maße; `ratio` = B/H (1 bei kreis/quadrat).
- Consumes: nichts.

- [ ] **Step 1: Test schreiben**

```ts
// frontend/src/lib/bildcropper.test.ts
import { describe, it, expect, beforeAll } from "vitest";

// Klassisches Skript per Seiteneffekt laden: es setzt window.OX.
import "../../public/js/bildcropper.js";

const crop = (window as any).OX._crop as {
  minSkala(bB: number, bH: number, mB: number, mH: number): number;
  klemmeVersatz(v: number, bildMass: number, skala: number, maskMass: number): number;
  ausgabeMasse(ausgabe: number, ratio: number): { w: number; h: number };
};

describe("bildcropper _crop.minSkala", () => {
  it("wählt die Achse mit dem größeren Bedarf (breites Bild, quadratische Maske)", () => {
    // Bild 400x200, Maske 100x100 -> Höhe bestimmt: 100/200 = 0.5
    expect(crop.minSkala(400, 200, 100, 100)).toBeCloseTo(0.5);
  });
  it("hohes Bild, quadratische Maske -> Breite bestimmt", () => {
    // Bild 200x400, Maske 100x100 -> 100/200 = 0.5
    expect(crop.minSkala(200, 400, 100, 100)).toBeCloseTo(0.5);
  });
  it("breite Maske", () => {
    // Bild 1000x1000, Maske 500x200 -> max(0.5, 0.2) = 0.5
    expect(crop.minSkala(1000, 1000, 500, 200)).toBeCloseTo(0.5);
  });
});

describe("bildcropper _crop.klemmeVersatz", () => {
  it("lässt Versatz im erlaubten Rahmen unverändert", () => {
    // bildMass*skala = 400, maskMass = 100 -> max = (400-100)/2 = 150
    expect(crop.klemmeVersatz(50, 400, 1, 100)).toBe(50);
  });
  it("klemmt zu großen positiven Versatz", () => {
    expect(crop.klemmeVersatz(999, 400, 1, 100)).toBe(150);
  });
  it("klemmt zu großen negativen Versatz", () => {
    expect(crop.klemmeVersatz(-999, 400, 1, 100)).toBe(-150);
  });
  it("bei Bild kleiner/gleich Maske ist der einzige erlaubte Versatz 0", () => {
    expect(crop.klemmeVersatz(20, 100, 1, 100)).toBe(0);
  });
});

describe("bildcropper _crop.ausgabeMasse", () => {
  it("quadratisch bei ratio 1", () => {
    expect(crop.ausgabeMasse(600, 1)).toEqual({ w: 600, h: 600 });
  });
  it("breit bei ratio 2.5", () => {
    expect(crop.ausgabeMasse(1500, 2.5)).toEqual({ w: 1500, h: 600 });
  });
  it("rundet die Höhe", () => {
    expect(crop.ausgabeMasse(1000, 3).h).toBe(333);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd frontend && npx vitest run src/lib/bildcropper.test.ts`
Expected: FAIL — `Cannot find module '../../public/js/bildcropper.js'` bzw. `window.OX is undefined`.

- [ ] **Step 3: `bildcropper.js` mit reinen Helfern anlegen**

```js
// frontend/public/js/bildcropper.js
/* OrderXpress - Bild-Zuschnitt (WhatsApp-Stil) mit echter Gast-Vorschau.
 * Klassisches Skript. Setzt window.OX.oeffneCropper(opts) und - fuer Tests -
 * die reinen Helfer window.OX._crop. KEIN DOM-Zugriff beim Laden. */
(function () {
  "use strict";
  var OX = (window.OX = window.OX || {});

  /* ----- reine Mathematik (testbar, kein DOM) ----- */
  var _crop = {
    minSkala: function (bildB, bildH, maskB, maskH) {
      return Math.max(maskB / bildB, maskH / bildH);
    },
    klemmeVersatz: function (versatz, bildMass, skala, maskMass) {
      var max = Math.max(0, (bildMass * skala - maskMass) / 2);
      return Math.min(max, Math.max(-max, versatz));
    },
    ausgabeMasse: function (ausgabe, ratio) {
      return { w: ausgabe, h: Math.round(ausgabe / (ratio || 1)) };
    }
  };
  OX._crop = _crop;

  /* oeffneCropper folgt in Task 2 */
})();
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `cd frontend && npx vitest run src/lib/bildcropper.test.ts`
Expected: PASS (alle 10).

- [ ] **Step 5: Commit**

```bash
git add frontend/public/js/bildcropper.js frontend/src/lib/bildcropper.test.ts
git commit -m "feat(cropper): reine Zuschnitt-Mathematik + Testgeruest"
```

---

## Task 2: Widget-Dialog `OX.oeffneCropper` (Canvas + iframe + postMessage)

**Files:**
- Modify: `frontend/public/js/bildcropper.js`
- Test: `frontend/src/lib/bildcropper.test.ts` (ergänzen)

**Interfaces:**
- Produces:
  - `window.OX.oeffneCropper(opts)` mit
    `opts = { datei: File, form: "kreis"|"quadrat"|"breit", ratio?: number, ausgabe: number, fokus: string, restaurantId: number|string, onFertig: (blob: Blob) => void, onAbbrechen?: () => void }`.
    `fokus` ist `"logo" | "background" | "gericht:<id>" | "galerie"`.
  - `window.OX._crop.zielAusFokus(fokus) → { ziel: string, gerichtId?: string }` — reine Hilfsfunktion, testbar.
- Consumes: `window.OX._crop` (Task 1).

- [ ] **Step 1: Test für `zielAusFokus` schreiben** (ans Ende von `bildcropper.test.ts`)

```ts
describe("bildcropper _crop.zielAusFokus", () => {
  const z = (window as any).OX._crop.zielAusFokus as (f: string) => { ziel: string; gerichtId?: string };
  it("logo", () => expect(z("logo")).toEqual({ ziel: "logo" }));
  it("background", () => expect(z("background")).toEqual({ ziel: "background" }));
  it("galerie", () => expect(z("galerie")).toEqual({ ziel: "galerie" }));
  it("gericht mit id", () => expect(z("gericht:42")).toEqual({ ziel: "gericht", gerichtId: "42" }));
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd frontend && npx vitest run src/lib/bildcropper.test.ts`
Expected: FAIL — `zielAusFokus is not a function`.

- [ ] **Step 3: `zielAusFokus` + kompletten Dialog in `bildcropper.js` ergänzen**

Ersetze den Kommentar `/* oeffneCropper folgt in Task 2 */` durch:

```js
  _crop.zielAusFokus = function (fokus) {
    if (fokus && fokus.indexOf("gericht:") === 0) {
      return { ziel: "gericht", gerichtId: fokus.slice("gericht:".length) };
    }
    return { ziel: fokus || "logo" };
  };

  /* ----- CSS einmalig injizieren ----- */
  function styleEinfuegen() {
    if (document.getElementById("ox-cropper-style")) return;
    var s = document.createElement("style");
    s.id = "ox-cropper-style";
    s.textContent = [
      ".ox-crop-ov{position:fixed;inset:0;z-index:5000;background:rgba(10,12,14,.72);",
      "display:flex;align-items:center;justify-content:center;padding:12px}",
      ".ox-crop-karte{background:#1b1f21;color:#e7e9ea;border-radius:16px;padding:16px;",
      "width:min(920px,96vw);max-height:94vh;overflow:auto;",
      "font:14px/1.5 -apple-system,system-ui,'Segoe UI',sans-serif;",
      "box-shadow:0 24px 70px rgba(0,0,0,.5)}",
      ".ox-crop-titel{font-weight:700;margin:0 0 10px}",
      ".ox-crop-grid{display:grid;gap:14px;grid-template-columns:1fr}",
      "@media(min-width:760px){.ox-crop-grid{grid-template-columns:320px 1fr}}",
      ".ox-crop-buehne{position:relative;width:100%;aspect-ratio:1;border-radius:12px;",
      "overflow:hidden;background:#000;cursor:grab;touch-action:none;user-select:none}",
      ".ox-crop-buehne canvas{position:absolute;inset:0;width:100%;height:100%;display:block}",
      ".ox-crop-maske{position:absolute;pointer-events:none;",
      "box-shadow:0 0 0 2000px rgba(0,0,0,.55);outline:2px solid rgba(255,255,255,.9)}",
      ".ox-crop-frame{width:100%;aspect-ratio:1;border:0;border-radius:12px;background:#0f1113}",
      ".ox-crop-regler{display:flex;align-items:center;gap:12px;margin-top:12px}",
      ".ox-crop-regler input{flex:1;accent-color:#fff}",
      ".ox-crop-regler button{background:#2a2e31;color:#e7e9ea;border:0;width:34px;height:34px;",
      "border-radius:9px;font-size:18px;cursor:pointer;flex:none}",
      ".ox-crop-btns{display:flex;gap:10px;margin-top:14px;justify-content:flex-end}",
      ".ox-crop-btns button{border:0;border-radius:11px;padding:11px 18px;font:inherit;",
      "font-weight:700;cursor:pointer}",
      ".ox-crop-geist{background:#2a2e31;color:#e7e9ea}",
      ".ox-crop-haupt{background:#1f3d34;color:#fff}",
      ".ox-crop-hinweis{font-size:12px;color:#9aa0a6;margin-top:8px}"
    ].join("");
    document.head.appendChild(s);
  }

  /* ----- Hauptfunktion ----- */
  OX.oeffneCropper = function (opts) {
    styleEinfuegen();
    var form = opts.form || "kreis";
    var ratio = form === "breit" ? (opts.ratio || 3) : 1;
    var rund = form === "kreis";
    var maskAnteil = form === "breit" ? 0.92 : 0.86;
    var zielInfo = _crop.zielAusFokus(opts.fokus);

    var ov = document.createElement("div");
    ov.className = "ox-crop-ov";
    ov.innerHTML =
      '<div class="ox-crop-karte">' +
      '  <p class="ox-crop-titel">Bildausschnitt wählen</p>' +
      '  <div class="ox-crop-grid">' +
      '    <div>' +
      '      <div class="ox-crop-buehne"><canvas></canvas><div class="ox-crop-maske"></div></div>' +
      '      <div class="ox-crop-regler">' +
      '        <button type="button" data-z="aus" aria-label="rauszoomen">–</button>' +
      '        <input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">' +
      '        <button type="button" data-z="ein" aria-label="reinzoomen">+</button>' +
      '      </div>' +
      '      <p class="ox-crop-hinweis">Ziehen zum Verschieben · Regler / zwei Finger zum Zoomen</p>' +
      '    </div>' +
      '    <div><iframe class="ox-crop-frame" title="Vorschau der Gäste-Ansicht"></iframe>' +
      '      <p class="ox-crop-hinweis" data-rolle="vorschau-hinweis">Vorschau der echten Gäste-Ansicht.</p>' +
      '    </div>' +
      '  </div>' +
      '  <div class="ox-crop-btns">' +
      '    <button type="button" class="ox-crop-geist" data-a="ab">Abbrechen</button>' +
      '    <button type="button" class="ox-crop-haupt" data-a="ok">Übernehmen</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(ov);

    var buehne = ov.querySelector(".ox-crop-buehne");
    var canvas = ov.querySelector("canvas");
    var ctx = canvas.getContext("2d");
    var maske = ov.querySelector(".ox-crop-maske");
    var range = ov.querySelector("input[type=range]");
    var frame = ov.querySelector("iframe");
    var vorschauHinweis = ov.querySelector('[data-rolle="vorschau-hinweis"]');

    var bild = new Image();
    var skala = 1, minSkala = 1, maxSkala = 4, x = 0, y = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var zeiger = {}, zeigerAnzahl = 0, letzterPinch = 0;
    var letzterPost = 0;
    var iframeBereit = false;

    function maskMasse() {
      var r = buehne.getBoundingClientRect();
      var w = Math.min(r.width, r.height) * maskAnteil;
      return { w: w, h: w / ratio, rechteck: r };
    }
    function maskeStellen() {
      var m = maskMasse();
      maske.style.width = m.w + "px";
      maske.style.height = m.h + "px";
      maske.style.left = (m.rechteck.width / 2 - m.w / 2) + "px";
      maske.style.top = (m.rechteck.height / 2 - m.h / 2) + "px";
      maske.style.borderRadius = rund ? "50%" : "10px";
    }
    function canvasStellen() {
      var r = buehne.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    }
    function begrenze() {
      var m = maskMasse();
      x = _crop.klemmeVersatz(x, bild.width, skala, m.w);
      y = _crop.klemmeVersatz(y, bild.height, skala, m.h);
    }
    function zeichne() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!bild.width) return;
      var cx = canvas.width / 2, cy = canvas.height / 2;
      var w = bild.width * skala * dpr, h = bild.height * skala * dpr;
      ctx.drawImage(bild, cx + x * dpr - w / 2, cy + y * dpr - h / 2, w, h);
      postVorschau();
    }
    function start() {
      var m = maskMasse();
      minSkala = _crop.minSkala(bild.width, bild.height, m.w, m.h);
      maxSkala = minSkala * 4;
      skala = minSkala; x = 0; y = 0;
      range.min = String(minSkala);
      range.max = String(maxSkala);
      range.step = String((maxSkala - minSkala) / 200 || 0.01);
      range.value = String(skala);
      begrenze(); zeichne();
    }
    function setzeZoom(v) {
      skala = Math.min(maxSkala, Math.max(minSkala, v));
      range.value = String(skala);
      begrenze(); zeichne();
    }
    function ausschnitt(ausgabeBreite) {
      var g = _crop.ausgabeMasse(ausgabeBreite, ratio);
      var m = maskMasse();
      var faktor = g.w / m.w;
      var cv = document.createElement("canvas");
      cv.width = g.w; cv.height = g.h;
      var c = cv.getContext("2d");
      if (rund) { c.save(); c.beginPath();
        c.arc(g.w / 2, g.h / 2, Math.min(g.w, g.h) / 2, 0, Math.PI * 2); c.clip(); }
      var bw = bild.width * skala * faktor, bh = bild.height * skala * faktor;
      c.drawImage(bild, g.w / 2 + x * faktor - bw / 2, g.h / 2 + y * faktor - bh / 2, bw, bh);
      if (rund) c.restore();
      return cv;
    }
    function postVorschau() {
      if (!iframeBereit) return;
      var jetzt = Date.now();
      if (jetzt - letzterPost < 80) return;
      letzterPost = jetzt;
      var url = ausschnitt(400).toDataURL("image/png");
      var msg = { typ: "ox-vorschau", ziel: zielInfo.ziel, dataUrl: url };
      if (zielInfo.gerichtId) msg.gerichtId = zielInfo.gerichtId;
      try { frame.contentWindow.postMessage(msg, window.location.origin); } catch (e) { /* ignore */ }
    }

    /* Zeiger (Maus + Touch) */
    buehne.addEventListener("pointerdown", function (e) {
      buehne.setPointerCapture(e.pointerId);
      zeiger[e.pointerId] = { x: e.clientX, y: e.clientY }; zeigerAnzahl++;
    });
    buehne.addEventListener("pointermove", function (e) {
      var alt = zeiger[e.pointerId];
      if (!alt || !bild.width) return;
      zeiger[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (zeigerAnzahl === 1) {
        x += e.clientX - alt.x; y += e.clientY - alt.y; begrenze(); zeichne();
      } else if (zeigerAnzahl === 2) {
        var ids = Object.keys(zeiger);
        var a = zeiger[ids[0]], b = zeiger[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (letzterPinch) setzeZoom(skala * (d / letzterPinch));
        letzterPinch = d;
      }
    });
    function zeigerEnde(e) {
      if (zeiger[e.pointerId]) { delete zeiger[e.pointerId]; zeigerAnzahl--; }
      if (zeigerAnzahl < 2) letzterPinch = 0;
    }
    buehne.addEventListener("pointerup", zeigerEnde);
    buehne.addEventListener("pointercancel", zeigerEnde);
    buehne.addEventListener("wheel", function (e) {
      if (!bild.width) return;
      e.preventDefault();
      setzeZoom(skala * (e.deltaY < 0 ? 1.08 : 0.92));
    }, { passive: false });
    range.addEventListener("input", function () { setzeZoom(parseFloat(range.value)); });
    ov.querySelector('[data-z="ein"]').addEventListener("click", function () { setzeZoom(skala * 1.15); });
    ov.querySelector('[data-z="aus"]').addEventListener("click", function () { setzeZoom(skala / 1.15); });

    function schliessen() {
      window.removeEventListener("message", aufNachricht);
      ov.remove();
    }
    ov.querySelector('[data-a="ab"]').addEventListener("click", function () {
      schliessen(); if (opts.onAbbrechen) opts.onAbbrechen();
    });
    ov.querySelector('[data-a="ok"]').addEventListener("click", function () {
      if (!bild.width) { schliessen(); return; }
      ausschnitt(opts.ausgabe).toBlob(function (blob) {
        schliessen(); if (opts.onFertig) opts.onFertig(blob);
      }, "image/png");
    });

    /* iframe + Vorschau-Bereitschaft */
    function aufNachricht(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.typ === "ox-vorschau-bereit") {
        iframeBereit = true;
        postVorschau();
      }
    }
    window.addEventListener("message", aufNachricht);
    frame.src = "/guest.html?vorschau=1&restaurant=" +
      encodeURIComponent(opts.restaurantId) + "&fokus=" + encodeURIComponent(opts.fokus);
    setTimeout(function () {
      if (!iframeBereit) {
        // Rueckfall: Vorschau-Spalte weg, nur Zuschnitt-Feld
        frame.style.display = "none";
        vorschauHinweis.textContent = "Live-Vorschau nicht verfügbar - der Ausschnitt wird trotzdem gespeichert.";
      }
    }, 4000);

    /* Bild laden */
    var objUrl = URL.createObjectURL(opts.datei);
    bild.onload = function () {
      URL.revokeObjectURL(objUrl);
      maskeStellen(); canvasStellen(); start();
      window.addEventListener("resize", function () { maskeStellen(); canvasStellen(); begrenze(); zeichne(); });
    };
    bild.onerror = function () {
      URL.revokeObjectURL(objUrl); schliessen();
      if (window.OX && OX.toast) OX.toast("Bild konnte nicht geladen werden", true);
      if (opts.onAbbrechen) opts.onAbbrechen();
    };
    bild.src = objUrl;
  };
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `cd frontend && npx vitest run src/lib/bildcropper.test.ts`
Expected: PASS (jetzt 14).

- [ ] **Step 5: TS-Build prüfen (Widget ist JS, darf tsc nicht stören)**

Run: `cd frontend && npm run build`
Expected: `tsc --noEmit` + `vite build` fehlerfrei. (Das `.js` in `public/` wird nur kopiert.)

- [ ] **Step 6: Commit**

```bash
git add frontend/public/js/bildcropper.js frontend/src/lib/bildcropper.test.ts
git commit -m "feat(cropper): Dialog mit Canvas-Zuschnitt + iframe-Live-Vorschau"
```

---

## Task 3: Gast-Vorschau-Modul `vorschau.ts`

**Files:**
- Create: `frontend/src/pages/guest/vorschau.ts`
- Test: `frontend/src/pages/guest/vorschau.test.ts`

**Interfaces:**
- Consumes: nichts aus anderen Tasks.
- Produces (Import aus `index.ts`, Task 4):
  - `istVorschau(): boolean` — `true`, wenn `?vorschau=1` in `location.search`.
  - `vorschauRestaurantId(): number` — `Number` des `restaurant`-Params (`0`, wenn fehlt/ungültig).
  - `vorschauFokus(): string` — Wert des `fokus`-Params (`""`, wenn fehlt).
  - `verarbeiteVorschauNachricht(e: MessageEvent): void` — tauscht Bilder bei gültiger `ox-vorschau`-Nachricht.
  - `meldeVorschauBereit(): void` — schickt `{typ:"ox-vorschau-bereit"}` an `window.parent`.
  - `hebeFokusHervor(fokus: string): void` — scrollt zum Zielelement, setzt 1,2 s die Klasse `ox-vorschau-fokus`.

- [ ] **Step 1: Test schreiben**

```ts
// frontend/src/pages/guest/vorschau.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  istVorschau, vorschauRestaurantId, vorschauFokus,
  verarbeiteVorschauNachricht, meldeVorschauBereit
} from "./vorschau";

function setSearch(s: string) {
  Object.defineProperty(window, "location", {
    value: { ...window.location, search: s, origin: "http://localhost" },
    writable: true
  });
}

beforeEach(() => {
  document.body.innerHTML =
    '<img id="brand-logo" hidden>' +
    '<div id="menu-hero"></div>' +
    '<img id="hero-logo" hidden>' +
    '<div id="menu-gallery" hidden></div>' +
    '<div class="ox-gericht" data-gericht-id="7"><img class="ox-gericht__bild"></div>' +
    '<div class="ox-gericht" data-gericht-id="9"><div class="ox-gericht__bild ox-gericht__bild--leer"></div></div>';
});

describe("vorschau: Parameter", () => {
  it("erkennt vorschau=1", () => {
    setSearch("?vorschau=1&restaurant=3&fokus=logo");
    expect(istVorschau()).toBe(true);
    expect(vorschauRestaurantId()).toBe(3);
    expect(vorschauFokus()).toBe("logo");
  });
  it("ohne Parameter", () => {
    setSearch("");
    expect(istVorschau()).toBe(false);
    expect(vorschauRestaurantId()).toBe(0);
  });
});

describe("vorschau: Nachrichten-Handler", () => {
  const mk = (data: unknown, origin = "http://localhost") =>
    ({ origin, data } as MessageEvent);

  it("ignoriert fremde Origin", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "logo", dataUrl: "data:x" }, "http://boes"));
    expect((document.getElementById("brand-logo") as HTMLImageElement).getAttribute("src")).toBeNull();
  });
  it("logo -> brand-logo + hero-logo src + sichtbar", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "logo", dataUrl: "data:img" }));
    const b = document.getElementById("brand-logo") as HTMLImageElement;
    const h = document.getElementById("hero-logo") as HTMLImageElement;
    expect(b.src).toContain("data:img");
    expect(b.hidden).toBe(false);
    expect(h.src).toContain("data:img");
  });
  it("background -> menu-hero backgroundImage + Klasse", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "background", dataUrl: "data:bg" }));
    const hero = document.getElementById("menu-hero") as HTMLElement;
    expect(hero.style.backgroundImage).toContain("data:bg");
    expect(hero.classList.contains("ox-hero--bild")).toBe(true);
  });
  it("gericht mit id -> nur dieses Bild, --leer wird ersetzt", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "gericht", gerichtId: "9", dataUrl: "data:foto" }));
    const karte9 = document.querySelector('[data-gericht-id="9"] .ox-gericht__bild') as HTMLImageElement;
    expect(karte9.tagName).toBe("IMG");
    expect(karte9.src).toContain("data:foto");
    const karte7 = document.querySelector('[data-gericht-id="7"] .ox-gericht__bild') as HTMLImageElement;
    expect(karte7.getAttribute("src")).toBeNull();
  });
  it("galerie -> erstes Bild oder eingefügt, Container sichtbar", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "galerie", dataUrl: "data:g" }));
    const g = document.getElementById("menu-gallery") as HTMLElement;
    expect(g.hidden).toBe(false);
    expect((g.querySelector("img") as HTMLImageElement).src).toContain("data:g");
  });
  it("ignoriert fremden typ", () => {
    verarbeiteVorschauNachricht(mk({ typ: "anderes", ziel: "logo", dataUrl: "data:x" }));
    expect((document.getElementById("brand-logo") as HTMLImageElement).getAttribute("src")).toBeNull();
  });
});

describe("vorschau: meldeVorschauBereit", () => {
  it("postet an window.parent mit eigener Origin", () => {
    const spy = vi.fn();
    Object.defineProperty(window, "parent", { value: { postMessage: spy }, writable: true });
    setSearch("");
    meldeVorschauBereit();
    expect(spy).toHaveBeenCalledWith({ typ: "ox-vorschau-bereit" }, window.location.origin);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd frontend && npx vitest run src/pages/guest/vorschau.test.ts`
Expected: FAIL — `Cannot find module './vorschau'`.

- [ ] **Step 3: `vorschau.ts` schreiben**

```ts
// frontend/src/pages/guest/vorschau.ts
/* Vorschau-Modus der Gaeste-Seite: wird vom Inhaber-Zuschnitt-Widget als iframe
 * geladen (?vorschau=1&restaurant=<id>&fokus=<ziel>). Kein Scan, keine Session,
 * kein Bestellen - nur ansehen. Der Nachrichten-Handler tauscht Logo /
 * Hintergrund / Gericht-Foto / Galerie gegen eine per postMessage uebergebene
 * dataURL, damit der Inhaber live sieht, wie sein Bild beim Gast aussieht. */

function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function istVorschau(): boolean {
  return params().get("vorschau") === "1";
}

export function vorschauRestaurantId(): number {
  const n = Number(params().get("restaurant"));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function vorschauFokus(): string {
  return params().get("fokus") || "";
}

interface VorschauNachricht {
  typ: string;
  ziel: string;
  dataUrl: string;
  gerichtId?: string;
}

export function verarbeiteVorschauNachricht(e: MessageEvent): void {
  if (e.origin !== window.location.origin) return;
  const d = e.data as VorschauNachricht | null;
  if (!d || d.typ !== "ox-vorschau" || !d.dataUrl) return;

  if (d.ziel === "logo") {
    for (const id of ["brand-logo", "hero-logo"]) {
      const img = document.getElementById(id) as HTMLImageElement | null;
      if (img) { img.src = d.dataUrl; img.hidden = false; }
    }
    return;
  }
  if (d.ziel === "background") {
    const hero = document.getElementById("menu-hero");
    if (hero) {
      hero.style.backgroundImage = `url("${d.dataUrl}")`;
      hero.classList.add("ox-hero--bild");
    }
    return;
  }
  if (d.ziel === "gericht" && d.gerichtId) {
    const slot = document.querySelector(
      `[data-gericht-id="${CSS.escape(d.gerichtId)}"] .ox-gericht__bild`
    );
    if (!slot) return;
    if (slot.tagName === "IMG") {
      (slot as HTMLImageElement).src = d.dataUrl;
    } else {
      const img = document.createElement("img");
      img.className = "ox-gericht__bild";
      img.alt = "";
      img.src = d.dataUrl;
      slot.replaceWith(img);
    }
    return;
  }
  if (d.ziel === "galerie") {
    const g = document.getElementById("menu-gallery");
    if (!g) return;
    g.hidden = false;
    let img = g.querySelector("img");
    if (!img) { img = document.createElement("img"); g.appendChild(img); }
    img.src = d.dataUrl;
  }
}

export function meldeVorschauBereit(): void {
  try {
    window.parent.postMessage({ typ: "ox-vorschau-bereit" }, window.location.origin);
  } catch { /* ignore */ }
}

export function hebeFokusHervor(fokus: string): void {
  let sel = "";
  if (fokus === "logo") sel = "#brand-logo";
  else if (fokus === "background") sel = "#menu-hero";
  else if (fokus === "galerie") sel = "#menu-gallery";
  else if (fokus.indexOf("gericht:") === 0) sel = `[data-gericht-id="${CSS.escape(fokus.slice(8))}"]`;
  if (!sel) return;
  const elm = document.querySelector(sel) as HTMLElement | null;
  if (!elm) return;
  elm.scrollIntoView({ block: "center", behavior: "smooth" });
  elm.classList.add("ox-vorschau-fokus");
  setTimeout(() => elm.classList.remove("ox-vorschau-fokus"), 1200);
}
```

Hinweis: `CSS.escape` ist in jsdom vorhanden. Falls ein Test darüber stolpert, in der Testdatei `globalThis.CSS ??= { escape: (s: string) => s } as any;` vor den Tests setzen.

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `cd frontend && npx vitest run src/pages/guest/vorschau.test.ts`
Expected: PASS (alle).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/guest/vorschau.ts frontend/src/pages/guest/vorschau.test.ts
git commit -m "feat(gast-vorschau): Modul - Parameter, Nachrichten-Handler, Fokus"
```

---

## Task 4: Vorschau-Modus in `index.ts` verdrahten + CSS

**Files:**
- Modify: `frontend/src/pages/guest/index.ts` (Funktion `start()`, ~Zeile 135; Datei-Ende für den `message`-Listener)
- Modify: `frontend/src/pages/guest/guest.css` (ans Ende)
- Test: `frontend/src/pages/guest/vorschau.test.ts` (ein Integrationstest ergänzt)

**Interfaces:**
- Consumes: `vorschau.ts` (Task 3), `ladeTheme`/`ladeSpeisekarte`/`zeigeGalerie` (`laden-design.ts`), `zeichneSpeisekarte`/`setzeBestellenErlaubt` (`menu.ts`), `zeigeAnsichtInhalt` (`ansichten.ts`).
- Produces: nichts für spätere Tasks.

- [ ] **Step 1: Integrationstest ergänzen** (ans Ende von `vorschau.test.ts`)

```ts
describe("vorschau: starteVorschau", () => {
  it("rendert Theme+Menü ohne Scan und sperrt Bestellen", async () => {
    setSearch("?vorschau=1&restaurant=5&fokus=logo");
    document.body.innerHTML =
      '<div id="view-wait"></div><div id="view-menu" hidden></div>' +
      '<div id="menu-hero"></div><img id="brand-logo" hidden><img id="hero-logo" hidden>' +
      '<div id="menu-gallery" hidden></div><div id="cartbar" hidden></div>';

    const spies = {
      ladeTheme: vi.fn().mockResolvedValue({ accentColor: "#1f3d34" }),
      ladeSpeisekarte: vi.fn().mockResolvedValue([]),
      zeigeGalerie: vi.fn().mockResolvedValue(undefined),
      wendeThemeAn: vi.fn(),
      zeichneSpeisekarte: vi.fn(),
      setzeBestellenErlaubt: vi.fn(),
      zeigeAnsichtInhalt: vi.fn()
    };
    const { starteVorschau } = await import("./vorschau");
    await starteVorschau(spies);

    expect(spies.ladeTheme).toHaveBeenCalledWith(5);
    expect(spies.ladeSpeisekarte).toHaveBeenCalledWith(5);
    expect(spies.setzeBestellenErlaubt).toHaveBeenCalledWith(false);
    expect(document.documentElement.dataset.vorschau).toBe("1");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd frontend && npx vitest run src/pages/guest/vorschau.test.ts`
Expected: FAIL — `starteVorschau is not a function`.

- [ ] **Step 3: `starteVorschau` in `vorschau.ts` ergänzen**

Am Ende von `vorschau.ts`:

```ts
export interface VorschauAbhaengigkeiten {
  ladeTheme: (id: number) => Promise<unknown>;
  ladeSpeisekarte: (id: number) => Promise<unknown>;
  zeigeGalerie: (id: number) => Promise<void>;
  wendeThemeAn: (theme: unknown) => void;
  zeichneSpeisekarte: (gerichte: unknown) => void;
  setzeBestellenErlaubt: (erlaubt: boolean) => void;
  zeigeAnsichtInhalt: (id: string, name?: string) => void;
}

export async function starteVorschau(deps: VorschauAbhaengigkeiten): Promise<void> {
  document.documentElement.dataset.vorschau = "1";
  const id = vorschauRestaurantId();

  window.addEventListener("message", verarbeiteVorschauNachricht);

  const [theme, gerichte] = await Promise.all([
    deps.ladeTheme(id).catch(() => null),
    deps.ladeSpeisekarte(id).catch(() => [])
  ]);
  if (theme) deps.wendeThemeAn(theme);
  deps.zeichneSpeisekarte(gerichte);
  deps.setzeBestellenErlaubt(false);
  deps.zeigeAnsichtInhalt("view-menu");
  void deps.zeigeGalerie(id).catch(() => undefined);

  meldeVorschauBereit();
  hebeFokusHervor(vorschauFokus());
}
```

- [ ] **Step 4: `index.ts` abbiegen lassen**

In `frontend/src/pages/guest/index.ts`:

1. Import ergänzen (bei den anderen `./`-Imports):

```ts
import { istVorschau, starteVorschau } from "./vorschau";
```

2. Ganz am Anfang von `async function start()` (vor `qrToken = leseQrToken();`):

```ts
    if (istVorschau()) {
        await starteVorschau({
            ladeTheme,
            ladeSpeisekarte,
            zeigeGalerie,
            wendeThemeAn,
            zeichneSpeisekarte,
            setzeBestellenErlaubt,
            zeigeAnsichtInhalt
        });
        return;
    }
```

(`ladeTheme`, `ladeSpeisekarte`, `zeigeGalerie`, `wendeThemeAn` sind bereits aus `./laden-design` importiert; `zeichneSpeisekarte`, `setzeBestellenErlaubt` aus `./menu`; `zeigeAnsichtInhalt` aus `./ansichten`. Falls ein Name dort nicht exportiert ist: den vorhandenen Renderer der Speisekarte bzw. den Ansichts-Wechsel benutzen, den `start()`/`nachErstemStatus()` heute schon aufrufen — Signaturen unverändert lassen.)

- [ ] **Step 5: CSS ergänzen** — ans Ende von `frontend/src/pages/guest/guest.css`:

```css
/* ---------- Vorschau-Modus (Inhaber sieht die Gaeste-Ansicht im iframe) ----------
   ?vorschau=1 setzt data-vorschau="1" auf <html>. Alles, was mit Bestellen /
   Sitzung zu tun hat, bleibt aus - der Inhaber schaut nur. */
:root[data-vorschau] #cartbar,
:root[data-vorschau] #name-bar,
:root[data-vorschau] #join-banner,
:root[data-vorschau] .ox-gericht__plus,
:root[data-vorschau] #ruf-knopf {
    display: none !important;
}
:root[data-vorschau] {
    /* iframe: kein Seiten-Scrollbalken durch sticky-Elemente */
    scroll-behavior: auto;
}
.ox-vorschau-fokus {
    animation: ox-vorschau-puls 1.2s ease-out;
    border-radius: var(--ox-radius);
}
@keyframes ox-vorschau-puls {
    0%, 100% { box-shadow: 0 0 0 0 rgba(31, 61, 52, 0); }
    30%      { box-shadow: 0 0 0 4px var(--ox-accent); }
}
@media (prefers-reduced-motion: reduce) {
    .ox-vorschau-fokus { animation: none; }
}
```

(Die genauen Selektoren für „Hinzufügen"-Knopf / „Kellner rufen" / Beitritts-Banner an die echten Klassen/IDs in `guest.html` anpassen — vor dem Schreiben `grep -nE "plus|ruf|join|kellner" frontend/guest.html frontend/src/pages/guest/*.ts` prüfen und die real vorhandenen Namen einsetzen. Wichtig ist: kein Bedienelement zum Bestellen sichtbar.)

- [ ] **Step 6: Tests + Build**

Run: `cd frontend && npm test`
Expected: alle grün (inkl. bestehender Guest-Tests).

Run: `cd frontend && npm run build`
Expected: fehlerfrei.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/guest/index.ts frontend/src/pages/guest/vorschau.ts frontend/src/pages/guest/vorschau.test.ts frontend/src/pages/guest/guest.css
git commit -m "feat(gast-vorschau): index.ts biegt bei ?vorschau=1 ab + CSS-Sperren"
```

---

## Task 5: Cropper in `admin.js` einhängen (Logo, Hintergrund, Galerie)

**Files:**
- Modify: `frontend/public/js/admin.js` (Methoden `uploadAsset` ~Z. 651, `uploadGalleryImage` ~Z. 700, sowie die Aufrufstelle des Menü-Foto-Uploads)
- Modify: `frontend/admin.html` (Skript-Tags ~Z. 278-281)

**Interfaces:**
- Consumes: `window.OX.oeffneCropper` (Task 2), `OX.me()` (`api.js`, liefert `{restaurantId,...}`), `OX.authHeader()`, `OX.toast`.
- Produces: nichts.

- [ ] **Step 1: `bildcropper.js` in `admin.html` laden**

In `frontend/admin.html`, direkt nach `<script src="/js/api.js"></script>`:

```html
<script src="/js/bildcropper.js"></script>
```

- [ ] **Step 2: `uploadAsset` in `admin.js` auf Cropper umstellen**

Ersetze die Methode `uploadAsset(kind)` durch:

```js
    /* kind: "logo" | "background" */
    async uploadAsset(kind) {
        const input = document.getElementById(kind === "logo" ? "logo-file" : "bg-file");
        const file = input.files[0];
        input.value = "";
        if (!file) { OX.toast("Bitte zuerst eine Datei auswählen", true); return; }

        let restaurantId = 0;
        try { restaurantId = (await OX.me()).restaurantId; } catch (e) { /* Vorschau faellt dann zurueck */ }

        const cfg = kind === "logo"
            ? { form: "kreis", ausgabe: 600, fokus: "logo" }
            : { form: "breit", ratio: 2.5, ausgabe: 1500, fokus: "background" };

        OX.oeffneCropper({
            datei: file, restaurantId: restaurantId,
            form: cfg.form, ratio: cfg.ratio, ausgabe: cfg.ausgabe, fokus: cfg.fokus,
            onFertig: async (blob) => {
                const fd = new FormData();
                fd.append("file", blob, kind + ".png");
                const res = await fetch("/api/admin/design/" + kind, {
                    method: "POST", headers: OX.authHeader(), body: fd
                });
                if (res.ok) {
                    OX.toast(kind === "logo" ? "Logo gespeichert" : "Hintergrund gespeichert");
                } else {
                    let detail = null;
                    try { detail = (await res.json()).detail; } catch (e) { /* keine JSON-Antwort */ }
                    OX.toast(detail || "Upload fehlgeschlagen", true);
                }
                this.loadDesign();
            }
        });
    },
```

- [ ] **Step 3: `uploadGalleryImage` auf Cropper umstellen**

Ersetze `uploadGalleryImage()` durch:

```js
    async uploadGalleryImage() {
        const input = document.getElementById("gallery-file");
        const dateien = Array.from(input.files || []);
        input.value = "";
        if (!dateien.length) { OX.toast("Bitte zuerst eine Datei auswählen", true); return; }

        let restaurantId = 0;
        try { restaurantId = (await OX.me()).restaurantId; } catch (e) { /* egal */ }

        const naechste = (i) => {
            if (i >= dateien.length) { this.loadGallery(); return; }
            OX.oeffneCropper({
                datei: dateien[i], restaurantId: restaurantId,
                form: "breit", ratio: 1.5, ausgabe: 1200, fokus: "galerie",
                onAbbrechen: () => naechste(i + 1),
                onFertig: async (blob) => {
                    const fd = new FormData();
                    fd.append("file", blob, "galerie.png");
                    const res = await fetch("/api/admin/gallery", {
                        method: "POST", headers: OX.authHeader(), body: fd
                    });
                    if (res.ok) OX.toast("Foto hinzugefügt");
                    else {
                        let detail = null;
                        try { detail = (await res.json()).detail; } catch (e) { /* keine JSON-Antwort */ }
                        OX.toast(detail || "Upload fehlgeschlagen", true);
                    }
                    naechste(i + 1);
                }
            });
        };
        naechste(0);
    },
```

- [ ] **Step 4: Menü-Foto-Aufruf finden und umstellen**

`grep -n "uploadImage(" frontend/public/js/admin.js` zeigt die Aufrufstelle (ein `<input onchange>` bzw. ein Datei-Dialog, der `this.uploadImage(itemId, file)` ruft). Dort die Datei nicht direkt weiterreichen, sondern:

```js
// vorher: this.uploadImage(itemId, file);
(async () => {
    let restaurantId = 0;
    try { restaurantId = (await OX.me()).restaurantId; } catch (e) { /* egal */ }
    OX.oeffneCropper({
        datei: file, restaurantId: restaurantId,
        form: "quadrat", ausgabe: 900, fokus: "gericht:" + itemId,
        onFertig: (blob) => this.uploadImage(itemId, new File([blob], "foto.png", { type: "image/png" }))
    });
})();
```

`this.uploadImage(itemId, file)` selbst bleibt unverändert (nimmt schon einen `file`-Parameter).

- [ ] **Step 5: Kein Unit-Test (klassisches admin.js ohne Testaufbau). Stattdessen Build + manuelle Prüfung im nächsten Task-Block.**

Run: `cd frontend && npm run build`
Expected: fehlerfrei (admin.js wird nur kopiert; achte darauf, dass keine `import`/`export`-Syntax hineingerät).

- [ ] **Step 6: Commit**

```bash
git add frontend/public/js/admin.js frontend/admin.html
git commit -m "feat(admin): Zuschnitt-Dialog vor Logo-, Hintergrund-, Galerie- und Gericht-Foto-Upload"
```

---

## Task 6: Cropper in den Menü-Editor (`sheet.ts`) einhängen

**Files:**
- Modify: `frontend/src/pages/menu-editor/sheet.ts` (Funktion `baueFotoBereich`, ~Z. 126-135)
- Modify: `frontend/menu-editor.html` (Skript-Tag vor dem Modul)
- Modify: `frontend/src/lib/types.ts` (Window-Deklaration)

**Interfaces:**
- Consumes: `window.OX.oeffneCropper` (Task 2), `ladeGerichtFoto(id, File)` (`menu-editor/api.ts`, unverändert).
- Produces: nichts.

- [ ] **Step 1: Window-Typ deklarieren**

Ans Ende von `frontend/src/lib/types.ts`:

```ts
export interface CropperOptionen {
  datei: File;
  form: "kreis" | "quadrat" | "breit";
  ratio?: number;
  ausgabe: number;
  fokus: string;
  restaurantId: number | string;
  onFertig: (blob: Blob) => void;
  onAbbrechen?: () => void;
}

declare global {
  interface Window {
    OX?: {
      oeffneCropper(opts: CropperOptionen): void;
      me?(): Promise<{ restaurantId: number }>;
    };
  }
}
```

- [ ] **Step 2: `bildcropper.js` in `menu-editor.html` laden** — vor dem Modul-Skript:

```html
<script src="/js/bildcropper.js"></script>
<script type="module" src="/src/pages/menu-editor/index.ts"></script>
```

- [ ] **Step 3: `baueFotoBereich` umstellen**

In `frontend/src/pages/menu-editor/sheet.ts`, im `change`-Handler des `dateiFeld` (statt direkt `ladeGerichtFoto(gericht.id, datei)`):

```ts
    dateiFeld.addEventListener("change", () => {
        const datei = dateiFeld.files?.[0];
        dateiFeld.value = "";
        if (!datei) return;

        const cropper = window.OX?.oeffneCropper;
        const hochladen = (f: File) =>
            ladeGerichtFoto(gericht.id, f)
                .then(() => beiErfolg())
                .catch((e: Error) => { fehlerAnzeige.textContent = e.message; });

        if (!cropper) { void hochladen(datei); return; }

        void window.OX?.me?.().catch(() => ({ restaurantId: 0 })).then((me) => {
            cropper({
                datei,
                form: "quadrat",
                ausgabe: 900,
                fokus: "gericht:" + gericht.id,
                restaurantId: me?.restaurantId ?? 0,
                onFertig: (blob: Blob) =>
                    void hochladen(new File([blob], "foto.png", { type: "image/png" }))
            });
        });
    });
```

Den exakten heutigen Handler-Rumpf (`beiErfolg`, `fehlerAnzeige`) an die vorhandenen Namen in `baueFotoBereich` anpassen — Signatur der Funktion nicht ändern.

- [ ] **Step 4: Build + Tests**

Run: `cd frontend && npm run build`
Expected: `tsc --noEmit` fehlerfrei (Window-Typ muss passen).

Run: `cd frontend && npm test`
Expected: alle grün.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/menu-editor/sheet.ts frontend/menu-editor.html frontend/src/lib/types.ts
git commit -m "feat(menu-editor): Zuschnitt-Dialog vor Gericht-Foto-Upload"
```

---

## Task 7: Manuelle Abnahme + Übergabe

**Files:**
- Modify: `CLAUDE.md` (Statusabschnitt „Neu (…)" ergänzen)

**Interfaces:** keine.

- [ ] **Step 1: Voller Testlauf**

```bash
cd frontend && npm test && npm run build
```
Expected: alle Tests grün, Build ohne Fehler.

- [ ] **Step 2: App lokal starten und durchklicken**

```bash
# Terminal 1
mvn -q spring-boot:run
# Terminal 2 (schnellerer Frontend-Umschlag)
cd frontend && npm run dev
```

Prüfen (mit Demo-Zugang `inhaber`/`inhaber123`, Laden „Demo-Restaurant"):

1. **Admin → Design → Logo hochladen:** Zuschnitt-Dialog erscheint, Kreis-Maske. Rechts das iframe der echten Gäste-Seite; beim Ziehen/Zoomen wandert das Logo live in Kopfzeile **und** Hero-Band mit. „Übernehmen" → Toast „Logo gespeichert", Design-Karte lädt neu. „Abbrechen" → nichts passiert.
2. **Admin → Design → Hintergrund:** breite 5:2-Maske, iframe zeigt das Hero-Band mit Abdunkel-Verlauf + Logo + Laden-Name über dem Bild.
3. **Admin → Bildergalerie:** mehrere Dateien auf einmal → nacheinander je ein Zuschnitt-Dialog (3:2). iframe zeigt den Galerie-Streifen.
4. **Menü-Editor → Gericht → Foto:** quadratische Maske, iframe scrollt zur Gericht-Karte und hebt sie kurz hervor; das 84×84-Thumbnail aktualisiert live.
5. **Rückfall:** iframe blockieren (z. B. `restaurant`-Param im Widget-Code kurz auf `0` zwingen) → nach 4 s ist die Vorschau-Spalte weg, Zuschnitt funktioniert weiter, „Übernehmen" lädt hoch.
6. **Gast normal:** `/t/<qrToken>` ohne `?vorschau=1` läuft unverändert (Scan, Freigabe, Bestellen).

- [ ] **Step 3: `CLAUDE.md` ergänzen**

Im Statusbereich einen datierten Absatz `**Neu (06.09.2026): Bild-Zuschnitt mit echter Gast-Vorschau.**` mit 4-6 Zeilen: Vanilla-Widget `frontend/public/js/bildcropper.js` (`OX.oeffneCropper`), Gast-Vorschau-Modus `?vorschau=1&restaurant=&fokus=` (`vorschau.ts`, kein Scan/Bestellen, `message`-Handler tauscht Bilder), eingehängt in `admin.js` (Logo/Hintergrund/Galerie/Gericht-Foto) und `menu-editor/sheet.ts` (Gericht-Foto). Kein Backend-Umbau. Spec/Plan unter `docs/superpowers/`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Uebergabe - Bild-Zuschnitt mit Gast-Vorschau"
```

---

## Self-Review (vom Planautor)

**Spec-Abdeckung:**
- Widget `OX.oeffneCropper` mit Formen kreis/quadrat/breit → Task 1+2. ✓
- iframe echte Gäste-Seite + postMessage live → Task 2 (Sender) + Task 3/4 (Empfänger). ✓
- Vorschau-Modus: kein Scan/Session, Bestellen aus → Task 4 (`starteVorschau` + CSS). ✓
- `message`-Handler tauscht Logo/Hintergrund/Gericht/Galerie, Origin-geprüft → Task 3. ✓
- `fokus`-Scroll + Highlight → Task 3 (`hebeFokusHervor`) + Task 4 (CSS). ✓
- Rückfall ohne iframe (4 s Timeout) → Task 2. ✓
- Einhängen admin.js (Logo/Hintergrund/Galerie/Gericht) + menu-editor → Task 5+6. ✓
- Kein Backend-Umbau, öffentliche Endpunkte → durchgehend, Task-frei. ✓
- Ausgabegrößen/Formen je Bild → Global Constraints + Task 5/6. ✓
- Tests: Zuschnitt-Mathe, Ausgabe-Canvas, postMessage, Vorschau-Modus → Task 1/2/3/4. ✓

**Placeholder-Scan:** Keine „TBD"/„später". Zwei Stellen mit „an die echten Namen anpassen" (guest.css-Selektoren für Bestell-Bedienelemente, `sheet.ts`-Handler-Rumpf) — jeweils mit konkretem `grep`-Befehl und klarer Regel, weil die exakten Klassennamen erst im Code stehen; das ist eine gezielte Anweisung, kein Platzhalter.

**Typ-Konsistenz:** `OX.oeffneCropper(opts)` — Feldnamen `datei/form/ratio/ausgabe/fokus/restaurantId/onFertig/onAbbrechen` in Task 2, Task 5, Task 6, `types.ts` (Task 6) identisch. `_crop.{minSkala,klemmeVersatz,ausgabeMasse,zielAusFokus}` in Task 1/2 und Test gleich. `vorschau.ts`-Exporte (`istVorschau`, `vorschauRestaurantId`, `vorschauFokus`, `verarbeiteVorschauNachricht`, `meldeVorschauBereit`, `hebeFokusHervor`, `starteVorschau`, `VorschauAbhaengigkeiten`) in Task 3/4 und Tests gleich. Nachrichtenformat `{typ:"ox-vorschau", ziel, dataUrl, gerichtId?}` und `{typ:"ox-vorschau-bereit"}` in Task 2 (Sender) und Task 3 (Empfänger) gleich.
