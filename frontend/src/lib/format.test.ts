import { describe, it, expect } from "vitest";
import { preis, zeit, dauerMinuten } from "./format";

/* Achtung: Intl setzt vor das Euro-Zeichen ein schmales geschuetztes
   Leerzeichen (U+00A0), kein normales. Deshalb steht im Test . */
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
