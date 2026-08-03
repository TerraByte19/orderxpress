/* Absicherung von bill.ts - der geteilten Rechnung der Gaeste-Seite. Der Gast
 * SIEHT hier nur und waehlt Positionen an, um seine EIGENE Summe zu
 * erkennen ("was zahle ich?"). Kassiert wird an der Kasse - die Auswahl geht
 * NIE ans Backend (Aufgabenstellung/Plan-Kopf, Abschnitt "Was die Seite
 * fachlich tut").
 *
 * Schwerpunkte, die laut Aufgabenstellung/Testregel des Projekts leicht
 * still falsch sein koennen:
 *
 * 1. WICHTIGSTER PUNKT: eine bereits BEZAHLTE Position darf sich nicht
 *    auswaehlen lassen. Geprueft wird nicht nur "ist als bezahlt markiert",
 *    sondern dass ein tatsaechlicher Klick auf ihr Kontrollkaestchen die
 *    Auswahl-SUMME nicht veraendert - das ist die fachlich entscheidende
 *    Eigenschaft (Aufgabenstellung: sonst "rechnet ein Gast eine Summe
 *    zusammen, die er gar nicht mehr schuldet").
 * 2. Auswahl.leeren() muss die ANZEIGE mit zuruecksetzen, nicht nur den
 *    internen Zustand - geprueft am tatsaechlich gerenderten Kontrollkaestchen
 *    (.checked), nicht nur an summe().
 * 3. Die Auswahl-Summe muss ueber MEHRERE Personen hinweg korrekt
 *    aufsummieren - Auswahl kennt selbst keine Personen, nur
 *    orderItemId -> Betrag.
 * 4. Klassenpruefungen laufen ueber classList.contains, NIE ueber
 *    toContain()/Teilzeichenkette - "ox-chip" ist Praefix von z.B.
 *    "ox-chip--gut", ein Teilzeichenkettenvergleich waere hier truegerisch
 *    (gleiches Muster wie in orders.test.ts).
 * 5. Personen- UND Positionsnamen kommen aus der Datenbank (Gast bzw.
 *    Ladeninhaber befuellen sie) - ein Name mit < oder & darf NIE zu echtem
 *    Markup werden (textContent, nicht innerHTML). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Rechnung, RechnungsPerson, RechnungsZeile } from "../../lib/types";
import { preis } from "../../lib/format";

vi.mock("../../lib/api", () => ({
    api: vi.fn()
}));

import { api } from "../../lib/api";
import { Auswahl, holeRechnung, zeichneRechnung } from "./bill";

const apiMock = vi.mocked(api);

/** Vollstaendige Rechnungsposition, per Feld ueberschreibbar. */
function zeile(ueberschreibungen: Partial<RechnungsZeile> = {}): RechnungsZeile {
    return {
        orderItemId: 1,
        name: "Pizza Margherita",
        quantity: 1,
        unitPrice: 9.5,
        lineTotal: 9.5,
        note: null,
        paid: false,
        ...ueberschreibungen
    };
}

/** Vollstaendige Person, per Feld ueberschreibbar. */
function person(ueberschreibungen: Partial<RechnungsPerson> = {}): RechnungsPerson {
    return {
        guestId: 1,
        name: "Anna",
        isHost: false,
        items: [zeile()],
        total: 9.5,
        paidTotal: 0,
        openTotal: 9.5,
        ...ueberschreibungen
    };
}

/** Vollstaendige Rechnung, per Feld ueberschreibbar. */
function rechnung(ueberschreibungen: Partial<Rechnung> = {}): Rechnung {
    return {
        tableNumber: 7,
        sessionId: 100,
        participants: [person()],
        grandTotal: 9.5,
        paidTotal: 0,
        openTotal: 9.5,
        ...ueberschreibungen
    };
}

/** Kontrollkaestchen einer bestimmten Position (ueber data-order-item-id) -
 *  wirft, wenn keins gefunden wird, statt still mit null weiterzuarbeiten. */
function kaestchenVon(ziel: HTMLElement, orderItemId: number): HTMLInputElement {
    const kaestchen = ziel.querySelector<HTMLInputElement>(`input[data-order-item-id="${orderItemId}"]`);
    if (!kaestchen) throw new Error(`kein Kontrollkaestchen fuer orderItemId=${orderItemId} gefunden`);
    return kaestchen;
}

beforeEach(() => {
    apiMock.mockReset();
});

// jsdom-Luecke (empirisch gefunden, siehe Bericht): .click() auf einer
// Checkbox loest "change" NUR aus, wenn das Element an document HAENGT -
// bei einem nur lose erzeugten `document.createElement("div")` als `ziel`
// bleibt .checked zwar korrekt, aber "change" feuert nie, jeder
// Klick-Test waere also wortlos gruen (checked landet zufaellig beim
// Ausgangswert). Jeder Test, der per .click() eine Auswahl-Aenderung
// ausloesen will, haengt `ziel` darum bewusst an document.body - und
// raeumt hier wieder auf.
afterEach(() => {
    document.body.innerHTML = "";
});

describe("holeRechnung", () => {
    it("ruft GET /api/guest/guests/<guestToken>/bill auf und liefert die Rechnung unveraendert zurueck", async () => {
        const antwort: Rechnung = rechnung();
        apiMock.mockResolvedValueOnce(antwort);

        const ergebnis = await holeRechnung("g1");

        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/g1/bill");
        expect(ergebnis).toBe(antwort);
    });

    it("kodiert Sonderzeichen im Gast-Token fuer die URL", async () => {
        apiMock.mockResolvedValueOnce(rechnung());
        await holeRechnung("a b");
        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/a%20b/bill");
    });
});

describe("Auswahl - reine Zustandslogik (kein DOM)", () => {
    it("frisch erzeugt: enthaelt nichts, Summe 0", () => {
        const auswahl = new Auswahl();
        expect(auswahl.enthaelt(1)).toBe(false);
        expect(auswahl.summe()).toBe(0);
    });

    it("umschalten fuegt eine Position hinzu: enthaelt wird true, Summe der Betrag", () => {
        const auswahl = new Auswahl();
        auswahl.umschalten(1, 9.5);
        expect(auswahl.enthaelt(1)).toBe(true);
        expect(auswahl.summe()).toBe(9.5);
    });

    it("zweites umschalten DERSELBEN Position nimmt sie wieder heraus (echtes Umschalten)", () => {
        const auswahl = new Auswahl();
        auswahl.umschalten(1, 9.5);
        auswahl.umschalten(1, 9.5);
        expect(auswahl.enthaelt(1)).toBe(false);
        expect(auswahl.summe()).toBe(0);
    });

    it("summe() addiert ueber mehrere verschiedene Positionen", () => {
        const auswahl = new Auswahl();
        auswahl.umschalten(1, 9.5);
        auswahl.umschalten(2, 3);
        auswahl.umschalten(3, 12.5);
        expect(auswahl.summe()).toBe(25);
    });

    it("leeren() setzt Zustand vollstaendig zurueck", () => {
        const auswahl = new Auswahl();
        auswahl.umschalten(1, 9.5);
        auswahl.umschalten(2, 3);

        auswahl.leeren();

        expect(auswahl.summe()).toBe(0);
        expect(auswahl.enthaelt(1)).toBe(false);
        expect(auswahl.enthaelt(2)).toBe(false);
    });
});

describe("zeichneRechnung - Personen und Positionen vollstaendig dargestellt", () => {
    it("zeigt jede Person mit all ihren Positionen (Menge x Name), in der gegebenen Reihenfolge", () => {
        const ziel = document.createElement("div");
        const r = rechnung({
            participants: [
                person({
                    guestId: 1, name: "Anna", items: [
                        zeile({ orderItemId: 1, name: "Pizza Margherita", quantity: 2 }),
                        zeile({ orderItemId: 2, name: "Cola", quantity: 1 })
                    ]
                }),
                person({
                    guestId: 2, name: "Ben", items: [
                        zeile({ orderItemId: 3, name: "Schnitzel", quantity: 1 })
                    ]
                })
            ]
        });

        zeichneRechnung(r, ziel, () => {});

        expect(ziel.querySelectorAll(".ox-card")).toHaveLength(2);
        const namen = Array.from(ziel.querySelectorAll(".ox-card"))
            .map((karte) => karte.querySelector("strong")?.textContent);
        expect(namen).toEqual(["Anna", "Ben"]);

        const positionen = Array.from(ziel.querySelectorAll(".ox-list li")).map((li) => li.textContent);
        expect(positionen).toHaveLength(3);
        expect(positionen[0]).toContain("2× Pizza Margherita");
        expect(positionen[1]).toContain("1× Cola");
        expect(positionen[2]).toContain("1× Schnitzel");
    });

    it("Gastgeber ist ueber einen (neutralen, NICHT akzentfarbenen) Chip erkennbar - ein Nicht-Gastgeber hat keinen", () => {
        const ziel = document.createElement("div");
        const r = rechnung({
            participants: [
                person({ guestId: 1, name: "Anna", isHost: true }),
                person({ guestId: 2, name: "Ben", isHost: false })
            ]
        });

        zeichneRechnung(r, ziel, () => {});

        const karten = Array.from(ziel.querySelectorAll(".ox-card"));
        const annaChip = karten[0].querySelector(".ox-chip");
        const benChip = karten[1].querySelector(".ox-chip");

        expect(annaChip).not.toBeNull();
        expect(annaChip!.classList.contains("ox-chip")).toBe(true);
        // Akzentfarbe ist laut Spec NUR fuer den Hinzufuegen-Knopf und den
        // aktiven Kategorie-Reiter reserviert (siehe guest.css) - der
        // Gastgeber-Chip muss die neutrale Basisklasse OHNE Zusatz sein.
        expect(annaChip!.classList.contains("ox-chip--akzent")).toBe(false);
        expect(annaChip!.textContent).toBe("Gastgeber");
        expect(benChip).toBeNull();
    });

    it("Person ohne Positionen zeigt trotzdem ihre Kopfzeile, ohne Fehler", () => {
        const ziel = document.createElement("div");
        zeichneRechnung(
            rechnung({ participants: [person({ name: "Chris", items: [], openTotal: 0 })] }),
            ziel,
            () => {}
        );

        const karte = ziel.querySelector(".ox-card")!;
        expect(karte.querySelector("strong")?.textContent).toBe("Chris");
        expect(karte.querySelectorAll(".ox-list li")).toHaveLength(0);
    });

    it("leere Teilnehmerliste zeigt eine ruhige Meldung statt einer leeren Flaeche", () => {
        const ziel = document.createElement("div");
        // Rest vom vorherigen Zeichnen - zeichneRechnung muss ihn ersetzen.
        ziel.appendChild(document.createElement("span"));

        zeichneRechnung(rechnung({ participants: [] }), ziel, () => {});

        expect(ziel.children).toHaveLength(1);
        expect(ziel.textContent).toBe("Noch nichts bestellt.");
        expect(ziel.querySelector("p")?.classList.contains("ox-muted")).toBe(true);
    });

    it("erneutes Zeichnen ersetzt den Inhalt vollstaendig und beginnt mit einer LEEREN Auswahl", () => {
        const ziel = document.createElement("div");
        document.body.appendChild(ziel); // .click() braucht ein an document haengendes Element (siehe afterEach)
        const r = rechnung({ participants: [person({ items: [zeile({ orderItemId: 1 })] })] });

        let ersteAuswahl!: Auswahl;
        zeichneRechnung(r, ziel, (a) => { ersteAuswahl = a; });
        kaestchenVon(ziel, 1).click();
        expect(ersteAuswahl.summe()).toBeGreaterThan(0);

        let zweiteAuswahl!: Auswahl;
        zeichneRechnung(r, ziel, (a) => { zweiteAuswahl = a; });

        expect(zweiteAuswahl.summe()).toBe(0);
        expect(kaestchenVon(ziel, 1).checked).toBe(false);
    });
});

describe("zeichneRechnung - bezahlte Positionen sind NICHT auswaehlbar", () => {
    it("bezahlte Position: Kontrollkaestchen deaktiviert UND deutlich als 'bezahlt' gekennzeichnet", () => {
        const ziel = document.createElement("div");
        zeichneRechnung(
            rechnung({ participants: [person({ items: [zeile({ orderItemId: 1, paid: true })] })] }),
            ziel,
            () => {}
        );

        const kaestchen = kaestchenVon(ziel, 1);
        expect(kaestchen.disabled).toBe(true);

        const zeilenElement = kaestchen.closest("li")!;
        const bezahltChip = zeilenElement.querySelector(".ox-chip");
        expect(bezahltChip).not.toBeNull();
        expect(bezahltChip!.textContent).toBe("bezahlt");
        expect(bezahltChip!.classList.contains("ox-chip--gut")).toBe(true);
    });

    it("KERNPUNKT: ein Klick auf eine bezahlte Position aendert die Auswahl-Summe NICHT", () => {
        const ziel = document.createElement("div");
        document.body.appendChild(ziel); // .click() braucht ein an document haengendes Element (siehe afterEach)
        let auswahlAktuell!: Auswahl;
        zeichneRechnung(
            rechnung({
                participants: [person({
                    items: [
                        zeile({ orderItemId: 1, lineTotal: 9.5, paid: true }),
                        zeile({ orderItemId: 2, lineTotal: 3, paid: false })
                    ]
                })]
            }),
            ziel,
            (a) => { auswahlAktuell = a; }
        );

        expect(auswahlAktuell.summe()).toBe(0);

        kaestchenVon(ziel, 1).click();

        expect(auswahlAktuell.summe()).toBe(0);
        expect(auswahlAktuell.enthaelt(1)).toBe(false);
        expect(kaestchenVon(ziel, 1).checked).toBe(false);

        // Kontrollprobe: die UNBEZAHLTE Nachbarposition laesst sich weiter
        // ganz normal auswaehlen - der Ausfall betrifft wirklich nur "paid".
        kaestchenVon(ziel, 2).click();
        expect(auswahlAktuell.summe()).toBe(3);
    });
});

describe("zeichneRechnung + Auswahl - Auswahl-Summe ueber mehrere Personen hinweg", () => {
    it("summiert ausgewaehlte Positionen VERSCHIEDENER Personen korrekt und reagiert auf Abwaehlen", () => {
        const ziel = document.createElement("div");
        document.body.appendChild(ziel); // .click() braucht ein an document haengendes Element (siehe afterEach)
        let auswahlAktuell!: Auswahl;
        zeichneRechnung(
            rechnung({
                participants: [
                    person({ guestId: 1, name: "Anna", items: [zeile({ orderItemId: 1, lineTotal: 9.5 })] }),
                    person({ guestId: 2, name: "Ben", items: [zeile({ orderItemId: 2, lineTotal: 12 })] })
                ]
            }),
            ziel,
            (a) => { auswahlAktuell = a; }
        );

        kaestchenVon(ziel, 1).click(); // Annas Position
        kaestchenVon(ziel, 2).click(); // Bens Position
        expect(auswahlAktuell.summe()).toBe(21.5);

        kaestchenVon(ziel, 1).click(); // Anna wieder abgewaehlt
        expect(auswahlAktuell.summe()).toBe(12);
    });
});

describe("Auswahl.leeren() setzt auch die Anzeige zurueck", () => {
    it("nach leeren(): Summe 0 UND alle zuvor angehakten Kontrollkaestchen wieder leer", () => {
        const ziel = document.createElement("div");
        document.body.appendChild(ziel); // .click() braucht ein an document haengendes Element (siehe afterEach)
        let auswahlAktuell!: Auswahl;
        zeichneRechnung(
            rechnung({
                participants: [person({
                    items: [
                        zeile({ orderItemId: 1, lineTotal: 5 }),
                        zeile({ orderItemId: 2, lineTotal: 7 })
                    ]
                })]
            }),
            ziel,
            (a) => { auswahlAktuell = a; }
        );

        const k1 = kaestchenVon(ziel, 1);
        const k2 = kaestchenVon(ziel, 2);
        k1.click();
        k2.click();
        expect(k1.checked).toBe(true);
        expect(k2.checked).toBe(true);
        expect(auswahlAktuell.summe()).toBe(12);

        auswahlAktuell.leeren();

        expect(auswahlAktuell.summe()).toBe(0);
        expect(k1.checked).toBe(false);
        expect(k2.checked).toBe(false);
    });

    it("beiAuswahl wird bei jeder Aenderung erneut aufgerufen - beim Zeichnen, beim Klick UND beim leeren()", () => {
        const ziel = document.createElement("div");
        document.body.appendChild(ziel); // .click() braucht ein an document haengendes Element (siehe afterEach)
        const beiAuswahl = vi.fn();
        zeichneRechnung(
            rechnung({ participants: [person({ items: [zeile({ orderItemId: 1 })] })] }),
            ziel,
            beiAuswahl
        );
        expect(beiAuswahl).toHaveBeenCalledTimes(1);
        expect(beiAuswahl.mock.calls[0][0]).toBeInstanceOf(Auswahl);

        kaestchenVon(ziel, 1).click();
        expect(beiAuswahl).toHaveBeenCalledTimes(2);

        const auswahl = beiAuswahl.mock.calls[0][0] as Auswahl;
        auswahl.leeren();
        expect(beiAuswahl).toHaveBeenCalledTimes(3);
    });
});

describe("zeichneRechnung - Betraege ueber .ox-preis", () => {
    it("Positionspreis und offener Betrag je Person erscheinen ueber .ox-preis, formatiert mit preis()", () => {
        const ziel = document.createElement("div");
        // 1234.5 bewusst gewaehlt: preis() liefert "1.234,50 €"
        // (Tausenderpunkt, Komma-Dezimalzeichen) - eine naive Eigenbau-
        // Formatierung (z.B. toFixed(2)) ergaebe sichtbar "1234.50 €".
        zeichneRechnung(
            rechnung({ participants: [person({ openTotal: 1234.5, items: [zeile({ lineTotal: 1234.5 })] })] }),
            ziel,
            () => {}
        );

        const preisElemente = Array.from(ziel.querySelectorAll(".ox-preis"));
        expect(preisElemente).toHaveLength(2); // offener Betrag der Person + Positionspreis
        for (const element of preisElemente) {
            expect(element.textContent).toBe(preis(1234.5));
        }
    });
});

describe("zeichneRechnung - Namen aus der Datenbank erzeugen kein Markup", () => {
    it("Personenname mit < oder & erzeugt kein echtes Element (textContent, nicht innerHTML)", () => {
        const ziel = document.createElement("div");
        const rohName = "<b>Anna</b> & Co";
        zeichneRechnung(rechnung({ participants: [person({ name: rohName })] }), ziel, () => {});

        expect(ziel.querySelector("b")).toBeNull();
        const karte = ziel.querySelector(".ox-card")!;
        expect(karte.querySelector("strong")?.textContent).toBe(rohName);
    });

    it("Positionsname mit < oder & erzeugt kein echtes Element (textContent, nicht innerHTML)", () => {
        const ziel = document.createElement("div");
        const rohName = "<img src=x> & Pommes";
        zeichneRechnung(
            rechnung({ participants: [person({ items: [zeile({ name: rohName })] })] }),
            ziel,
            () => {}
        );

        expect(ziel.querySelector("img")).toBeNull();
        const zeilenText = ziel.querySelector(".ox-list li")!.textContent!;
        expect(zeilenText).toContain(rohName);
    });
});
