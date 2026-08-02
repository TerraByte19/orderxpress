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
