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
