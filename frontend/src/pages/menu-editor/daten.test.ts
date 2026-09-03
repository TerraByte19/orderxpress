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
        sortOrder: 1, imageUrl: null, badges: [], ...ueberschreibungen
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
        expect(g).toEqual({ id: 1, name: "Margherita", description: null, details: null, price: 9.5, imageUrl: null, badges: [] });
    });
});
