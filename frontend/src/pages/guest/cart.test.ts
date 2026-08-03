/* Absicherung von cart.ts - dem Warenkorb der Gaeste-Seite.
 *
 * Zwei Dinge verdienen besondere Sorgfalt (siehe Aufgabenstellung):
 *
 * 1. stelleWiederHer() darf Name und Preis NIE aus dem Speicher uebernehmen,
 *    nur aus der frisch geladenen Speisekarte. Der entscheidende Test
 *    unterschiebt beim Speichern einen ANDEREN Preis, als die neue Karte
 *    beim Wiederherstellen liefert, und prueft, dass der NEUE Preis
 *    gewinnt - eine Implementierung, die (faelschlich) Preis/Name mit
 *    speichert und beim Wiederherstellen von dort liest, wuerde hier den
 *    ALTEN Preis liefern und der Test wuerde rot.
 * 2. hinzufuegen() darf zwei Zeilen nur zusammenfuehren, wenn Gericht UND
 *    Hinweis gleich sind. Unterschiedliche Hinweise muessen als eigene
 *    Zeilen bestehen bleiben, sonst verliert die Kueche Sonderwuensche. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Gericht, Kategorie } from "../../lib/types";

vi.mock("../../lib/api", () => ({
    api: vi.fn()
}));

import { api } from "../../lib/api";
import { Warenkorb, bestelle } from "./cart";

const apiMock = vi.mocked(api);

/** Vollstaendiges Gericht, per Feld ueberschreibbar. */
function gericht(ueberschreibungen: Partial<Gericht> = {}): Gericht {
    return {
        id: 1,
        name: "Margherita",
        description: "Tomate, Mozzarella, Basilikum",
        details: null,
        price: 9.5,
        imageUrl: null,
        ...ueberschreibungen
    };
}

/** Vollstaendige Kategorie, per Feld ueberschreibbar. */
function kategorie(ueberschreibungen: Partial<Kategorie> = {}): Kategorie {
    return {
        id: 1,
        name: "Pizza",
        items: [gericht()],
        ...ueberschreibungen
    };
}

beforeEach(() => {
    apiMock.mockReset();
    localStorage.clear();
});

afterEach(() => {
    localStorage.clear();
});

describe("hinzufuegen - Zusammenfuehren gleicher Zeilen", () => {
    it("dasselbe Gericht zweimal mit demselben Hinweis wird zu EINER Zeile mit Menge 2", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "ohne Zwiebeln");
        wk.hinzufuegen(gericht({ id: 1 }), 1, "ohne Zwiebeln");

        expect(wk.zeilen()).toHaveLength(1);
        expect(wk.zeilen()[0].menge).toBe(2);
        expect(wk.zeilen()[0].hinweis).toBe("ohne Zwiebeln");
    });

    it("dasselbe Gericht mit VERSCHIEDENEN Hinweisen bleibt ZWEI Zeilen - sonst verliert die Kueche die Sonderwuensche", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "ohne Zwiebeln");
        wk.hinzufuegen(gericht({ id: 1 }), 1, "extra scharf");

        const zeilen = wk.zeilen();
        expect(zeilen).toHaveLength(2);
        // Beide Mengen bleiben einzeln bei 1 - keine der beiden Zeilen darf
        // die andere ueberschrieben oder ihre Menge mitgezaehlt haben.
        expect(zeilen.every((z) => z.menge === 1)).toBe(true);
        expect(zeilen.map((z) => z.hinweis).sort()).toEqual(["extra scharf", "ohne Zwiebeln"]);
    });

    it("kein Hinweis zaehlt auch als 'gleicher Hinweis' - zwei leere Hinweise fuehren zusammen", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");
        wk.hinzufuegen(gericht({ id: 1 }), 2, "");

        expect(wk.zeilen()).toHaveLength(1);
        expect(wk.zeilen()[0].menge).toBe(3);
    });

    it("Hinweis wird vor dem Vergleich getrimmt - Leerzeichen allein erzeugen keine neue Zeile", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "ohne Zwiebeln");
        wk.hinzufuegen(gericht({ id: 1 }), 1, "  ohne Zwiebeln  ");

        expect(wk.zeilen()).toHaveLength(1);
        expect(wk.zeilen()[0].menge).toBe(2);
        expect(wk.zeilen()[0].hinweis).toBe("ohne Zwiebeln");
    });

    it("verschiedene Gerichte werden nie zusammengefuehrt, auch nicht mit gleichem Hinweis", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1, name: "Margherita" }), 1, "ohne Zwiebeln");
        wk.hinzufuegen(gericht({ id: 2, name: "Salami" }), 1, "ohne Zwiebeln");

        expect(wk.zeilen()).toHaveLength(2);
    });

    it("die Menge einer Zeile wird bei 50 gedeckelt, auch ueber mehrere hinzufuegen()-Aufrufe hinweg", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 40, "");
        wk.hinzufuegen(gericht({ id: 1 }), 40, "");

        expect(wk.zeilen()[0].menge).toBe(50);
    });

    it("uebernimmt Name und Preis vom uebergebenen Gericht in die neue Zeile", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1, name: "Margherita", price: 9.5 }), 1, "");

        expect(wk.zeilen()[0]).toMatchObject({ gerichtId: 1, name: "Margherita", preis: 9.5 });
    });
});

describe("aendereMenge", () => {
    it("erhoeht die Menge einer bestehenden Zeile um delta", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");
        wk.aendereMenge(1, 3);

        expect(wk.zeilen()[0].menge).toBe(4);
    });

    it("Menge auf 0 entfernt die Zeile", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 2, "");
        wk.aendereMenge(1, -2);

        expect(wk.zeilen()).toHaveLength(0);
    });

    it("ein delta, das unter 0 fuehrt, entfernt die Zeile ebenfalls (keine negative Geister-Menge)", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 2, "");
        wk.aendereMenge(1, -9);

        expect(wk.zeilen()).toHaveLength(0);
    });

    it("eine teilweise Verringerung entfernt die Zeile NICHT", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 2, "");
        wk.aendereMenge(1, -1);

        expect(wk.zeilen()).toHaveLength(1);
        expect(wk.zeilen()[0].menge).toBe(1);
    });

    it("eine unbekannte gerichtId aendert nichts und wirft nicht", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");

        expect(() => wk.aendereMenge(999, 1)).not.toThrow();
        expect(wk.zeilen()).toHaveLength(1);
        expect(wk.zeilen()[0].menge).toBe(1);
    });

    it("trifft bei zwei Zeilen desselben Gerichts NUR die Zeile mit passendem Hinweis", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "ohne Zwiebeln");
        wk.hinzufuegen(gericht({ id: 1 }), 1, "extra scharf");

        wk.aendereMenge(1, 5, "extra scharf");

        const zeilen = wk.zeilen();
        expect(zeilen.find((z) => z.hinweis === "extra scharf")?.menge).toBe(6);
        expect(zeilen.find((z) => z.hinweis === "ohne Zwiebeln")?.menge).toBe(1);
    });

    it("die Menge wird bei 50 gedeckelt", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 45, "");
        wk.aendereMenge(1, 10);

        expect(wk.zeilen()[0].menge).toBe(50);
    });
});

describe("entferne", () => {
    it("entfernt die Zeile ohne Hinweis, laesst die Zeile MIT Hinweis unberuehrt", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");
        wk.hinzufuegen(gericht({ id: 1 }), 1, "extra scharf");

        wk.entferne(1);

        const zeilen = wk.zeilen();
        expect(zeilen).toHaveLength(1);
        expect(zeilen[0].hinweis).toBe("extra scharf");
    });

    it("entfernt gezielt die Zeile MIT dem angegebenen Hinweis", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "ohne Zwiebeln");
        wk.hinzufuegen(gericht({ id: 1 }), 1, "extra scharf");

        wk.entferne(1, "ohne Zwiebeln");

        const zeilen = wk.zeilen();
        expect(zeilen).toHaveLength(1);
        expect(zeilen[0].hinweis).toBe("extra scharf");
    });

    it("eine unbekannte Kombination aus gerichtId/Hinweis aendert nichts", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");
        wk.entferne(1, "gibt es nicht");

        expect(wk.zeilen()).toHaveLength(1);
    });
});

describe("zeilen / anzahl / summe", () => {
    it("zeilen() liefert eine Kopie - externe Veraenderung wirkt sich nicht auf den Warenkorb aus", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");

        const kopie = wk.zeilen();
        kopie[0].menge = 999;

        expect(wk.zeilen()[0].menge).toBe(1);
    });

    it("anzahl() summiert die Mengen ueber mehrere Zeilen", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 2, "");
        wk.hinzufuegen(gericht({ id: 2 }), 3, "");

        expect(wk.anzahl()).toBe(5);
    });

    it("summe() rechnet menge * preis korrekt ueber mehrere Zeilen", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1, price: 9.5 }), 2, ""); // 19,00
        wk.hinzufuegen(gericht({ id: 2, price: 2.5 }), 3, ""); // 7,50

        expect(wk.summe()).toBeCloseTo(26.5, 5);
    });

    it("ein leerer Warenkorb hat anzahl 0 und summe 0", () => {
        const wk = new Warenkorb();
        expect(wk.anzahl()).toBe(0);
        expect(wk.summe()).toBe(0);
    });
});

describe("leeren", () => {
    it("entfernt alle Zeilen", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");
        wk.hinzufuegen(gericht({ id: 2 }), 1, "");

        wk.leeren();

        expect(wk.zeilen()).toHaveLength(0);
        expect(wk.anzahl()).toBe(0);
    });
});

describe("sichere", () => {
    it("speichert NUR gerichtId, Menge und Hinweis - NICHT Name und Preis", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1, name: "Margherita", price: 9.5 }), 2, "ohne Zwiebeln");

        wk.sichere("g1");

        const roh = localStorage.getItem("ox-cart-g1");
        expect(roh).not.toBeNull();
        // toEqual verlangt exakte Uebereinstimmung der Felder - zusaetzliche
        // Felder wie "name" oder "preis" liessen den Test rot werden.
        expect(JSON.parse(roh!)).toEqual([{ gerichtId: 1, menge: 2, hinweis: "ohne Zwiebeln" }]);
        // Doppelt abgesichert: Name/Preis duerfen nicht einmal als Rohtext auftauchen.
        expect(roh).not.toContain("Margherita");
        expect(roh).not.toContain("9.5");
    });

    it("speichert unter dem Schluessel ox-cart-<guestToken>", () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");
        wk.sichere("mein-token");

        expect(localStorage.getItem("ox-cart-mein-token")).not.toBeNull();
    });

    it("speichert einen leeren Warenkorb als leeres Array (loescht alte Eintraege beim naechsten Laden)", () => {
        const wk = new Warenkorb();
        wk.sichere("g1");

        expect(JSON.parse(localStorage.getItem("ox-cart-g1")!)).toEqual([]);
    });

    it("wirft nicht, wenn localStorage beim Schreiben verwirft (z.B. privater Modus)", () => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new DOMException("privater Modus"); };
        try {
            const wk = new Warenkorb();
            wk.hinzufuegen(gericht({ id: 1 }), 1, "");
            expect(() => wk.sichere("g1")).not.toThrow();
        } finally {
            Storage.prototype.setItem = original;
        }
    });
});

describe("stelleWiederHer - der wichtigste Teil", () => {
    it("ein Gericht, das nicht mehr in der Karte ist, faellt beim Wiederherstellen still heraus", () => {
        const alt = new Warenkorb();
        alt.hinzufuegen(gericht({ id: 1 }), 1, "");
        alt.hinzufuegen(gericht({ id: 2 }), 1, "");
        alt.sichere("g1");

        const neueKarte: Kategorie[] = [kategorie({ items: [gericht({ id: 1 })] })]; // Gericht 2 entfernt

        const neu = new Warenkorb();
        neu.stelleWiederHer("g1", neueKarte);

        expect(neu.zeilen()).toHaveLength(1);
        expect(neu.zeilen()[0].gerichtId).toBe(1);
    });

    it("uebrige Zeilen behalten Menge und Hinweis aus dem Speicher", () => {
        const alt = new Warenkorb();
        alt.hinzufuegen(gericht({ id: 1 }), 4, "ohne Zwiebeln");
        alt.sichere("g1");

        const neu = new Warenkorb();
        neu.stelleWiederHer("g1", [kategorie({ items: [gericht({ id: 1 })] })]);

        expect(neu.zeilen()[0]).toMatchObject({ menge: 4, hinweis: "ohne Zwiebeln" });
    });

    it("KRITISCH: Name und Preis kommen aus der FRISCHEN Speisekarte, nicht aus dem Speicher - " +
       "getestet mit einem beim Speichern untergeschobenen ANDEREN Preis", () => {
        const alt = new Warenkorb();
        // Preis beim Speichern: 9,50 EUR
        alt.hinzufuegen(gericht({ id: 1, name: "Margherita", price: 9.5 }), 1, "");
        alt.sichere("g1");

        // Der Laden hat zwischenzeitlich Name UND Preis geaendert (z.B. neue Kalkulation).
        const neueKarte: Kategorie[] = [
            kategorie({ items: [gericht({ id: 1, name: "Margherita Grande", price: 12.9 })] })
        ];

        const neu = new Warenkorb();
        neu.stelleWiederHer("g1", neueKarte);

        // Waere die Implementierung (fehlerhaft) so gebaut, dass sie Name/Preis
        // aus dem Speicher liest statt aus der Karte, kaeme hier 9.5/"Margherita"
        // heraus statt der neuen Werte - der Test wuerde dann rot.
        expect(neu.zeilen()[0].preis).toBe(12.9);
        expect(neu.zeilen()[0].name).toBe("Margherita Grande");
    });

    it("ersetzt vorhandene Zeilen, statt sie anzuhaengen (Wiederherstellen ist idempotent)", () => {
        const alt = new Warenkorb();
        alt.hinzufuegen(gericht({ id: 1 }), 1, "");
        alt.sichere("g1");

        const neu = new Warenkorb();
        neu.hinzufuegen(gericht({ id: 2 }), 1, ""); // bereits vorhandene Zeile vor dem Wiederherstellen

        neu.stelleWiederHer("g1", [kategorie({ items: [gericht({ id: 1 })] })]);

        expect(neu.zeilen()).toHaveLength(1);
        expect(neu.zeilen()[0].gerichtId).toBe(1);
    });

    it("ohne gespeicherte Daten bleibt der Warenkorb leer und es wird nicht geworfen", () => {
        const wk = new Warenkorb();
        expect(() => wk.stelleWiederHer("nie-gespeichert", [kategorie()])).not.toThrow();
        expect(wk.zeilen()).toHaveLength(0);
    });

    it("bei kaputten JSON-Daten im Speicher bleibt der Warenkorb leer statt abzustuerzen", () => {
        localStorage.setItem("ox-cart-g1", "{das ist kein json[");

        const wk = new Warenkorb();
        expect(() => wk.stelleWiederHer("g1", [kategorie()])).not.toThrow();
        expect(wk.zeilen()).toHaveLength(0);
    });

    it("Kategorien ohne passendes Gericht liefern einen leeren Warenkorb, kein Absturz", () => {
        const alt = new Warenkorb();
        alt.hinzufuegen(gericht({ id: 1 }), 1, "");
        alt.sichere("g1");

        const wk = new Warenkorb();
        wk.stelleWiederHer("g1", []); // Speisekarte komplett leer

        expect(wk.zeilen()).toHaveLength(0);
    });
});

describe("bestelle", () => {
    it("schickt POST /api/guest/orders mit menuItemId/quantity/note je Zeile", async () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 2, "ohne Zwiebeln");
        wk.hinzufuegen(gericht({ id: 2 }), 1, "");
        apiMock.mockResolvedValueOnce({});

        await bestelle("g1", wk);

        expect(apiMock).toHaveBeenCalledWith("/api/guest/orders", {
            method: "POST",
            body: JSON.stringify({
                guestToken: "g1",
                items: [
                    { menuItemId: 1, quantity: 2, note: "ohne Zwiebeln" },
                    { menuItemId: 2, quantity: 1, note: null }
                ]
            })
        });
    });

    it("nach erfolgreicher Bestellung ist der Warenkorb leer und der Speicher geraeumt", async () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");
        wk.sichere("g1");
        expect(localStorage.getItem("ox-cart-g1")).not.toBeNull();
        apiMock.mockResolvedValueOnce({});

        await bestelle("g1", wk);

        expect(wk.zeilen()).toHaveLength(0);
        expect(localStorage.getItem("ox-cart-g1")).toBeNull();
    });

    it("bei fehlgeschlagener Bestellung bleibt der Warenkorb ERHALTEN (nicht geleert)", async () => {
        const wk = new Warenkorb();
        wk.hinzufuegen(gericht({ id: 1 }), 1, "");
        apiMock.mockRejectedValueOnce(new Error("Netzwerkfehler"));

        await expect(bestelle("g1", wk)).rejects.toThrow("Netzwerkfehler");

        expect(wk.zeilen()).toHaveLength(1);
    });
});
