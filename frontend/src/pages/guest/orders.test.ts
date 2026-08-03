/* Absicherung von orders.ts - dem Bestell-Status fuer den Gast (die zweite
 * Ablauf-Verbesserung des Plans: heute erfaehrt der Gast nach dem Absenden
 * gar nichts mehr).
 *
 * Schwerpunkte laut Aufgabenstellung:
 *
 * 1. Jeder der fuenf Status braucht seinen eigenen Text UND seine eigene
 *    Chip-Klasse. Geprueft wird am tatsaechlich gerenderten Chip-Element
 *    ueber classList.contains() je erwarteter UND je explizit
 *    ausgeschlossener Klasse - NICHT ueber eine Teilzeichenkette auf
 *    className. Ein Teilzeichenkettenvergleich waere hier besonders
 *    truegerisch: "ox-chip" selbst ist eine Teilzeichenkette JEDER Variante
 *    (z.B. "ox-chip--warn"), ".toContain('ox-chip')" wuerde also fuer
 *    JEDEN Status gruen bleiben, egal welche Signalfarbe tatsaechlich
 *    verwendet wird.
 * 2. NEW ("Angenommen") und SERVED ("Serviert") sind beide "neutral", muessen
 *    aber unterscheidbar bleiben (SERVED zusaetzlich "gedaempft") - sonst
 *    kann der Gast eine servierte nicht von einer frisch angenommenen
 *    Bestellung unterscheiden.
 * 3. Eine stornierte Bestellung zaehlt nicht in die angezeigte Gesamtsumme
 *    ueber alle Bestellungen.
 * 4. zeichneBestellungen() darf sich NICHT auf eine bereits sortierte
 *    Eingabe verlassen - der Test uebergibt absichtlich unsortierte Daten. */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bestellung, BestellStatus, BestellZeile } from "../../lib/types";
import { preis } from "../../lib/format";

vi.mock("../../lib/api", () => ({
    api: vi.fn()
}));

import { api } from "../../lib/api";
import { holeMeineBestellungen, statusKlasse, statusText, zeichneBestellungen } from "./orders";

const apiMock = vi.mocked(api);

/** Vollstaendige Bestellzeile, per Feld ueberschreibbar. */
function position(ueberschreibungen: Partial<BestellZeile> = {}): BestellZeile {
    return {
        name: "Pizza Margherita",
        quantity: 2,
        unitPrice: 9.5,
        lineTotal: 19,
        note: null,
        ...ueberschreibungen
    };
}

/** Vollstaendige Bestellung, per Feld ueberschreibbar. */
function bestellung(ueberschreibungen: Partial<Bestellung> = {}): Bestellung {
    return {
        id: 1,
        tableNumber: 5,
        status: "NEW",
        createdAt: "2026-08-01T10:00:00.000Z",
        totalAmount: 19,
        printed: false,
        items: [position()],
        ...ueberschreibungen
    };
}

/** Rendert eine einzelne Bestellung und liefert ihren Status-Chip. */
function chipVon(b: Bestellung): HTMLElement {
    const ziel = document.createElement("div");
    zeichneBestellungen([b], ziel);
    const chip = ziel.querySelector<HTMLElement>(".ox-chip");
    if (!chip) throw new Error("kein .ox-chip im gerenderten Ergebnis gefunden");
    return chip;
}

beforeEach(() => {
    apiMock.mockReset();
});

describe("holeMeineBestellungen", () => {
    it("ruft GET /api/guest/guests/<guestToken>/orders auf und liefert die Liste unveraendert zurueck", async () => {
        const liste: Bestellung[] = [bestellung()];
        apiMock.mockResolvedValueOnce(liste);

        const ergebnis = await holeMeineBestellungen("g1");

        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/g1/orders");
        expect(ergebnis).toBe(liste);
    });

    it("kodiert Sonderzeichen im Gast-Token fuer die URL", async () => {
        apiMock.mockResolvedValueOnce([]);
        await holeMeineBestellungen("a b");
        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/a%20b/orders");
    });
});

describe("statusText - reiner Text je Status", () => {
    it("NEW -> 'Angenommen'", () => expect(statusText("NEW")).toBe("Angenommen"));
    it("IN_PREPARATION -> 'In der Küche'", () => expect(statusText("IN_PREPARATION")).toBe("In der Küche"));
    it("READY -> 'Fertig'", () => expect(statusText("READY")).toBe("Fertig"));
    it("SERVED -> 'Serviert'", () => expect(statusText("SERVED")).toBe("Serviert"));
    it("CANCELLED -> 'Storniert'", () => expect(statusText("CANCELLED")).toBe("Storniert"));
});

describe("statusKlasse - reine Klasse je Status (exakter String, kein Teilstring)", () => {
    it("NEW ist die neutrale Basisklasse ohne Signalfarben-Zusatz", () => {
        expect(statusKlasse("NEW")).toBe("ox-chip");
    });
    it("IN_PREPARATION traegt die Warnfarbe", () => {
        expect(statusKlasse("IN_PREPARATION")).toBe("ox-chip ox-chip--warn");
    });
    it("READY traegt die Erfolgsfarbe", () => {
        expect(statusKlasse("READY")).toBe("ox-chip ox-chip--gut");
    });
    it("SERVED ist neutral UND gedaempft - eine andere Klasse als NEW", () => {
        expect(statusKlasse("SERVED")).toBe("ox-chip ox-chip--gedaempft");
    });
    it("CANCELLED traegt die Gefahrfarbe", () => {
        expect(statusKlasse("CANCELLED")).toBe("ox-chip ox-chip--gefahr");
    });
});

describe("zeichneBestellungen - Status-Chip je Bestellung (classList, nicht Teilzeichenkette)", () => {
    const faelle: Array<{ status: BestellStatus; text: string; erwarteteKlasse: string }> = [
        { status: "NEW", text: "Angenommen", erwarteteKlasse: "" },
        { status: "IN_PREPARATION", text: "In der Küche", erwarteteKlasse: "ox-chip--warn" },
        { status: "READY", text: "Fertig", erwarteteKlasse: "ox-chip--gut" },
        { status: "SERVED", text: "Serviert", erwarteteKlasse: "ox-chip--gedaempft" },
        { status: "CANCELLED", text: "Storniert", erwarteteKlasse: "ox-chip--gefahr" }
    ];
    const alleVarianten = ["ox-chip--warn", "ox-chip--gut", "ox-chip--gedaempft", "ox-chip--gefahr"];

    for (const fall of faelle) {
        it(`${fall.status}: Chip zeigt '${fall.text}' und genau die richtige(n) Klasse(n) - keine der anderen`, () => {
            const chip = chipVon(bestellung({ status: fall.status }));

            expect(chip.textContent).toBe(fall.text);
            expect(chip.classList.contains("ox-chip")).toBe(true);

            for (const variante of alleVarianten) {
                const sollteVorhandenSein = variante === fall.erwarteteKlasse;
                expect(chip.classList.contains(variante)).toBe(sollteVorhandenSein);
            }
        });
    }

    it("NEW und SERVED sind trotz beider 'neutral' ueber classList unterscheidbar", () => {
        const neu = chipVon(bestellung({ status: "NEW" }));
        const serviert = chipVon(bestellung({ status: "SERVED" }));

        expect(neu.classList.contains("ox-chip--gedaempft")).toBe(false);
        expect(serviert.classList.contains("ox-chip--gedaempft")).toBe(true);
    });
});

describe("zeichneBestellungen - Gesamtsumme", () => {
    it("eine stornierte Bestellung ist erkennbar (Text+Klasse) und zaehlt NICHT in die Gesamtsumme", () => {
        const ziel = document.createElement("div");
        zeichneBestellungen(
            [
                bestellung({ id: 1, status: "NEW", totalAmount: 10, createdAt: "2026-08-01T10:00:00.000Z" }),
                bestellung({ id: 2, status: "CANCELLED", totalAmount: 5, createdAt: "2026-08-01T10:05:00.000Z" })
            ],
            ziel
        );

        // Erkennbarkeit der Stornierung.
        const chips = Array.from(ziel.querySelectorAll<HTMLElement>(".ox-chip"));
        const storniertChip = chips.find((c) => c.textContent === "Storniert");
        expect(storniertChip).toBeDefined();
        expect(storniertChip!.classList.contains("ox-chip--gefahr")).toBe(true);

        // Gesamtsumme (waere die stornierte mitgezaehlt, staende hier preis(15) statt preis(10)).
        const gesamt = ziel.querySelector(".ox-bestellungen__gesamt .ox-preis");
        expect(gesamt).not.toBeNull();
        expect(gesamt!.textContent).toBe(preis(10));
    });

    it("sind ALLE Bestellungen storniert, ist die Gesamtsumme 0 - nicht die Summe aller Betraege", () => {
        const ziel = document.createElement("div");
        zeichneBestellungen(
            [bestellung({ id: 1, status: "CANCELLED", totalAmount: 10 })],
            ziel
        );

        const gesamt = ziel.querySelector(".ox-bestellungen__gesamt .ox-preis");
        expect(gesamt!.textContent).toBe(preis(0));
    });
});

describe("zeichneBestellungen - leere Liste", () => {
    it("zeigt eine ruhige Meldung statt einer leeren Flaeche", () => {
        const ziel = document.createElement("div");
        // Zielelement traegt bereits Inhalt vom vorherigen Zeichnen -
        // zeichneBestellungen muss ihn ersetzen, nicht nur ergaenzen.
        ziel.appendChild(document.createElement("span"));

        zeichneBestellungen([], ziel);

        expect(ziel.children).toHaveLength(1);
        expect(ziel.textContent).toBe("Noch keine Bestellungen.");
        const meldung = ziel.querySelector("p");
        expect(meldung?.classList.contains("ox-muted")).toBe(true);
    });
});

describe("zeichneBestellungen - Reihenfolge", () => {
    it("zeigt die neueste Bestellung zuerst, UNABHAENGIG von der Eingabereihenfolge", () => {
        const ziel = document.createElement("div");
        const alt = bestellung({ id: 1, createdAt: "2026-08-01T09:00:00.000Z" });
        const neu = bestellung({ id: 2, createdAt: "2026-08-01T11:00:00.000Z" });
        const mittel = bestellung({ id: 3, createdAt: "2026-08-01T10:00:00.000Z" });

        // Bewusst NICHT in der richtigen Reihenfolge uebergeben - eine
        // Implementierung, die einfach nur durchreicht statt selbst zu
        // sortieren, wuerde hier 1, 2, 3 zeichnen statt 2, 3, 1.
        zeichneBestellungen([alt, neu, mittel], ziel);

        // Jede Karte hat ZWEI <strong>-Elemente (Nummer und Summe) - darum
        // je Karte gezielt nur das ERSTE (die Nummer) einsammeln, statt
        // alle <strong> im Ziel flach zu durchsuchen.
        const ueberschriften = Array.from(ziel.querySelectorAll(".ox-card")).map(
            (karte) => karte.querySelector("strong")?.textContent
        );
        expect(ueberschriften[0]).toBe("Bestellung #2");
        expect(ueberschriften[1]).toBe("Bestellung #3");
        expect(ueberschriften[2]).toBe("Bestellung #1");
    });
});

describe("zeichneBestellungen - Karteninhalt je Bestellung", () => {
    it("zeigt Uhrzeit (.ox-zeit) und Summe (.ox-preis) im Kopf, Positionen darunter", () => {
        const ziel = document.createElement("div");
        zeichneBestellungen(
            [bestellung({
                id: 7,
                totalAmount: 21.5,
                createdAt: "2026-08-01T14:05:00.000Z",
                items: [
                    position({ name: "Pizza Margherita", quantity: 2, note: "ohne Zwiebeln" }),
                    position({ name: "Cola", quantity: 1, note: null })
                ]
            })],
            ziel
        );

        const karte = ziel.querySelector(".ox-card")!;
        expect(karte.querySelector(".ox-zeit")?.textContent).toBe("16:05");
        expect(karte.querySelector(".ox-preis")?.textContent).toBe(preis(21.5));

        const eintraege = karte.querySelectorAll(".ox-list li");
        expect(eintraege).toHaveLength(2);
        expect(eintraege[0].textContent).toContain("2× Pizza Margherita");
        expect(eintraege[0].textContent).toContain("ohne Zwiebeln");
        expect(eintraege[1].textContent).toContain("1× Cola");
        expect(eintraege[1].textContent).not.toContain("(");
    });

    it("setzt Gerichtnamen ueber textContent - ein Name mit < oder & erzeugt kein Markup", () => {
        const ziel = document.createElement("div");
        const rohName = "<b>Pizza</b> & Salat";
        zeichneBestellungen(
            [bestellung({ items: [position({ name: rohName })] })],
            ziel
        );

        // Waere der Name ueber innerHTML gesetzt worden, gaebe es jetzt ein
        // echtes <b>-Element und der Text waere nur "Pizza" statt des
        // vollstaendigen Rohstrings - beides wird hier geprueft.
        expect(ziel.querySelector("b")).toBeNull();
        const eintrag = ziel.querySelector(".ox-list li")!;
        expect(eintrag.textContent).toContain(rohName);
    });
});
