import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

describe("Eingabe-Waechter", () => {
    // luminanz, kontrast und textfarbeAuf nahmen bisher jeden String an. Bei
    // ungueltigem Wert lieferte parseInt NaN, der Vergleich NaN >= NaN ist
    // false, und textfarbeAuf fiel still auf #ffffff zurueck - genau der
    // Fehler, den die Funktion eigentlich beheben soll. Bisher unerreichbar,
    // weil nur setzeLadenDesign() ruft und dort istHexFarbe vorgeschaltet
    // ist. Ruft eine Seite die Funktionen direkt auf, ist es scharf.
    const ungueltigeWerte = ["kaputt", "", "#fff", "#gggggg", "1f3d34", "#1f3d3"];

    it("luminanz wirft bei ungueltiger Eingabe, statt NaN zurueckzugeben", () => {
        for (const wert of ungueltigeWerte) {
            expect(() => luminanz(wert)).toThrow();
        }
    });

    it("kontrast wirft, wenn die erste oder die zweite Farbe ungueltig ist", () => {
        expect(() => kontrast("kaputt", "#ffffff")).toThrow();
        expect(() => kontrast("#000000", "kaputt")).toThrow();
    });

    it("textfarbeAuf wirft, statt still auf #ffffff zurueckzufallen", () => {
        expect(() => textfarbeAuf("kaputt")).toThrow();
    });

    it("laesst gueltige Hex-Farben weiterhin unangetastet durch", () => {
        expect(() => luminanz("#1f3d34")).not.toThrow();
        expect(() => kontrast("#000000", "#ffffff")).not.toThrow();
        expect(() => textfarbeAuf("#c9a227")).not.toThrow();
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

    describe("Textfarbe bei gesetztem Laden-Hintergrund", () => {
        // Abschnitt 12 im Design-Dokument: Inline-Stile schlagen jede
        // Stylesheet-Regel, auch die der dunklen Haut. Jeder Laden hat einen
        // backgroundColor (Standard #f4f5f7, siehe Restaurant.java) - ohne
        // Korrektur bliebe --ox-text auf dem dunklen Hautwert #edeeec
        // stehen: fast-weisser Text auf fast-weissem Grund.
        // #757575 liegt bewusst nahe am WCAG-Grenzfall (Kontrast von Schwarz
        // UND Weiss liegt dort nur knapp ueber 4.5:1) und zwingt die
        // Anteil-Erhoehung bei --ox-text-muted bis auf 100%.
        const hintergruende = ["#f4f5f7", "#1a1a1a", "#ffff00", "#1f3d34", "#757575", "#2d3a2e"];

        it("macht --ox-text dunkel, wenn ein heller Hintergrund auf dunkler Haut steht - der Fehlerfall aus der Aufgabe", () => {
            setzeLadenDesign({ dunkel: true, backgroundColor: "#f4f5f7" });
            expect(document.documentElement.style.getPropertyValue("--ox-text")).toBe("#000000");
        });

        it("macht --ox-text hell, wenn ein dunkler Hintergrund auf heller Haut steht", () => {
            setzeLadenDesign({ dunkel: false, backgroundColor: "#1a1a1a" });
            expect(document.documentElement.style.getPropertyValue("--ox-text")).toBe("#ffffff");
        });

        it("laesst --ox-text unangetastet, wenn kein Hintergrund gesetzt wird", () => {
            setzeLadenDesign({ backgroundColor: "#1a1a1a" });
            const vorher = document.documentElement.style.getPropertyValue("--ox-text");
            expect(vorher).toBe("#ffffff"); // Kontrolle: der erste Aufruf hat wirklich gesetzt

            setzeLadenDesign({ accentColor: "#1f3d34" }); // kein backgroundColor mehr
            expect(document.documentElement.style.getPropertyValue("--ox-text")).toBe(vorher);
        });

        it("erreicht fuer --ox-text immer mindestens 4.5:1 Kontrast zum tatsaechlichen Hintergrund", () => {
            for (const hintergrund of hintergruende) {
                setzeLadenDesign({ dunkel: true, backgroundColor: hintergrund });
                const text = document.documentElement.style.getPropertyValue("--ox-text");
                expect(kontrast(text, hintergrund)).toBeGreaterThanOrEqual(4.5);
            }
        });

        it("setzt --ox-text-muted als abgeschwaechten, aber weiterhin ausreichend lesbaren Ton", () => {
            // --ox-text-muted ist ein fertig ausgerechneter Hex-Wert (siehe
            // gedaempfterText in theme.ts) - kein color-mix()-Ausdruck, den
            // jsdom ohnehin nicht auswerten wuerde. Der Kontrast wird darum
            // direkt auf dem tatsaechlich gelesenen Wert geprueft, nicht auf
            // einer im Test parallel nachgerechneten Mischung.
            for (const hintergrund of hintergruende) {
                setzeLadenDesign({ dunkel: true, backgroundColor: hintergrund });
                const gedaempft = document.documentElement.style.getPropertyValue("--ox-text-muted");

                expect(gedaempft).toMatch(/^#[0-9a-fA-F]{6}$/);
                expect(kontrast(gedaempft, hintergrund)).toBeGreaterThanOrEqual(4.5);
            }
        });
    });
});

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

    it("MANROPE setzt data-font=manrope", () => {
        setzeLadenDesign({ font: "MANROPE" });
        expect(document.documentElement.getAttribute("data-font")).toBe("manrope");
    });
});
