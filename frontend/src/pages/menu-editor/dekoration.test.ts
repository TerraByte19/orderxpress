import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Gericht, Kategorie } from "../../lib/types";
import { zeichneSpeisekarte } from "../guest/menu";
import { dekoriereSpeisekarte } from "./dekoration";

function gericht(ueberschreibungen: Partial<Gericht> = {}): Gericht {
    return { id: 1, name: "Margherita", description: null, details: null, price: 9.5, imageUrl: null, badges: [], ...ueberschreibungen };
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

    it("zeigt bei zwei Kategorien Verschiebe-Pfeile korrekt an und ruft beiKategorieVerschieben auf", () => {
        const zweiKategorien = [
            kategorie({ id: 1, name: "Pizza" }),
            kategorie({ id: 2, name: "Pasta", items: [gericht({ id: 3, name: "Lasagne" })] })
        ];
        zeichneSpeisekarte(zweiKategorien, ziel, () => {}, () => {}, true);
        const aufrufe = standardAufrufe();
        const katMap = new Map([
            [1, { id: 1, name: "Pizza", sortOrder: 1, active: true }],
            [2, { id: 2, name: "Pasta", sortOrder: 2, active: true }]
        ]);
        dekoriereSpeisekarte(ziel, katMap, aufrufe);

        const kategorieKoepfe = Array.from(ziel.querySelectorAll(".ox-kategorie-kopf"));
        expect(kategorieKoepfe[0].querySelector('[aria-label="Nach oben verschieben"]')).toBeNull();
        expect(kategorieKoepfe[0].querySelector('[aria-label="Nach unten verschieben"]')).not.toBeNull();
        expect(kategorieKoepfe[1].querySelector('[aria-label="Nach oben verschieben"]')).not.toBeNull();
        expect(kategorieKoepfe[1].querySelector('[aria-label="Nach unten verschieben"]')).toBeNull();

        (kategorieKoepfe[0].querySelector('[aria-label="Nach unten verschieben"]') as HTMLButtonElement).click();
        expect(aufrufe.beiKategorieVerschieben).toHaveBeenCalledWith(1, 1);
    });

    it("zeigt ein Inaktiv-Badge bei inaktiven Kategorien und versteckt es bei aktiven", () => {
        const zweiKategorien = [
            kategorie({ id: 1, name: "Pizza" }),
            kategorie({ id: 2, name: "Pasta", items: [gericht({ id: 3, name: "Lasagne" })] })
        ];
        zeichneSpeisekarte(zweiKategorien, ziel, () => {}, () => {}, true);
        const aufrufe = standardAufrufe();
        const katMap = new Map([
            [1, { id: 1, name: "Pizza", sortOrder: 1, active: true }],
            [2, { id: 2, name: "Pasta", sortOrder: 2, active: false }]
        ]);
        dekoriereSpeisekarte(ziel, katMap, aufrufe);

        const kategorieKoepfe = Array.from(ziel.querySelectorAll(".ox-kategorie-kopf"));
        expect(kategorieKoepfe[0].querySelector(".ox-badge")).toBeNull();
        const badge = kategorieKoepfe[1].querySelector<HTMLElement>(".ox-badge");
        expect(badge).not.toBeNull();
        expect(badge?.textContent).toBe("Inaktiv");
    });
});
