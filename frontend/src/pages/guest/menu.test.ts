/* Absicherung von menu.ts - der Speisekarte, dem "Aushaengeschild" der
 * Gaeste-Seite (siehe Design-Spec Abschnitt 5).
 *
 * Schwerpunkte, die laut Aufgabenstellung leicht still falsch sein koennen:
 *
 * 1. Eine Kategorie ohne Gerichte darf NICHT als leere Ueberschrift auftauchen.
 * 2. Ein Gericht ohne Bild darf KEIN kaputtes <img src=""> erzeugen, sondern
 *    eine ruhige Flaeche ohne Symbol.
 * 3. Der Preis kommt IMMER ueber preis() - geprueft an einem Betrag
 *    (1234,50), bei dem sich preis() und jede naive Eigenbau-Variante
 *    (toFixed, Vorzeichen-Verkettung) sichtbar unterscheiden wuerden:
 *    preis(1234.5) === "1.234,50 €" (Tausenderpunkt, Komma-Dezimalzeichen,
 *    SCHMALES geschuetztes Leerzeichen vor dem Euro-Zeichen).
 * 4. setzeBestellenErlaubt(false) sperrt ALLE Hinzufuegen-Knoepfe, true
 *    entsperrt sie wieder OHNE die Liste neu zu zeichnen - sonst verliert
 *    der Gast seine Scrollposition waehrend er in der Karte blaettert und
 *    auf die Freigabe wartet. Geprueft ueber Referenzgleichheit (===) des
 *    Karten-Knotens, nicht nur ueber den sichtbaren Inhalt.
 * 5. Gerichtnamen (und Kategorienamen) kommen aus einer Datenbank, die der
 *    Ladeninhaber befuellt - sie muessen ueber textContent gesetzt werden.
 *    Ein Name mit < oder & darf NIE zu echtem Markup werden. Anders als bei
 *    Zahlen ist der Unterschied zwischen textContent und innerHTML hier
 *    sicherheitsrelevant, deshalb wird explizit auf childElementCount === 0
 *    geprueft (haette die Implementierung innerHTML genutzt, waeren echte
 *    Kindelemente entstanden).
 * 6. Die Karte (Foto/Name) und der "+"-Knopf in der Preiszeile rufen ZWEI
 *    GETRENNTE Rueckrufe auf (beiAuswahl vs. beiSchnellHinzufuegen). Eine
 *    zwischenzeitliche Regression liess "+" denselben Rueckruf wie die Karte
 *    aufrufen, wodurch "+" faelschlich das Detail-Overlay statt des
 *    Schnell-Hinzufuegens ausloeste - deshalb hier mit ZWEI unterscheidbaren
 *    Spionen geprueft (welcher Rueckruf kam, nicht nur "irgendeiner kam").
 *
 * Zusaetzlich: categoriesAsHamburger (Laden-Einstellung) muss BEIDE Wege
 * unterstuetzen, und das Detail-Overlay (Bild, Preis, Beschreibung, Zutaten &
 * Details, Mengen-Stepper, Hinweisfeld) folgt der alten guest.js (Zeilen
 * 309-460) als fachlicher Referenz. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Gericht, Kategorie } from "../../lib/types";
import { preis } from "../../lib/format";

vi.mock("../../lib/api", () => ({
    api: vi.fn()
}));

import { api } from "../../lib/api";
import { ladeSpeisekarte, oeffneDetail, setzeBestellenErlaubt, zeichneSpeisekarte } from "./menu";

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
        badges: [],
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

/** Wartet einen Animationsframe ab. oeffneDetail setzt .is-open bewusst erst
 *  im naechsten requestAnimationFrame, damit die Slide-up-Transition des
 *  Sheets von ihrem Ausgangszustand (translateY(100%)) aus sichtbar laeuft. */
const naechsterFrame = (): Promise<void> =>
    new Promise((aufloesen) => requestAnimationFrame(() => aufloesen()));

beforeEach(() => {
    apiMock.mockReset();
});

// Alles, was ein Test an document.body haengt (Container fuer
// setzeBestellenErlaubt, das Detail-Overlay), muss danach wieder weg -
// sonst sieht der naechste Test Reste des vorigen (vgl. ui.test.ts).
afterEach(() => {
    document.body.innerHTML = "";
});

describe("ladeSpeisekarte", () => {
    it("ruft GET /api/guest/menu/<restaurantId> auf und liefert die Kategorien unveraendert zurueck", async () => {
        const antwort: Kategorie[] = [kategorie()];
        apiMock.mockResolvedValueOnce(antwort);

        const ergebnis = await ladeSpeisekarte(42);

        expect(apiMock).toHaveBeenCalledWith("/api/guest/menu/42");
        expect(ergebnis).toBe(antwort);
    });
});

describe("zeichneSpeisekarte - Grundfunktion", () => {
    it("zeichnet jede Kategorie mit ihren Gerichten in der richtigen Reihenfolge", () => {
        const ziel = document.createElement("div");
        const kategorien = [
            kategorie({ id: 1, name: "Vorspeisen", items: [gericht({ id: 1, name: "Suppe" })] }),
            kategorie({
                id: 2, name: "Hauptgerichte",
                items: [gericht({ id: 2, name: "Schnitzel" }), gericht({ id: 3, name: "Currywurst" })]
            })
        ];

        zeichneSpeisekarte(kategorien, ziel, () => {}, () => {}, true);

        expect(ziel.querySelectorAll("h2").length).toBe(2);
        expect(Array.from(ziel.querySelectorAll(".ox-gericht__name")).map((n) => n.textContent))
            .toEqual(["Suppe", "Schnitzel", "Currywurst"]);
    });

    it("Kategorie ohne Gerichte erscheint NICHT als leere Ueberschrift", () => {
        const ziel = document.createElement("div");
        const kategorien = [
            kategorie({ id: 1, name: "Vorspeisen", items: [gericht({ id: 1 })] }),
            kategorie({ id: 2, name: "Saisonal (gerade leer)", items: [] })
        ];

        zeichneSpeisekarte(kategorien, ziel, () => {}, () => {}, true);

        const ueberschriften = Array.from(ziel.querySelectorAll("h2")).map((h) => h.textContent);
        expect(ueberschriften).toEqual(["Vorspeisen"]);
        expect(ziel.textContent).not.toContain("Saisonal");
    });

    it("leert ein zuvor befuelltes Ziel-Element bei erneutem Aufruf, statt anzuhaengen", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ items: [gericht({ name: "Alt" })] })], ziel, () => {}, () => {}, true);
        zeichneSpeisekarte([kategorie({ items: [gericht({ name: "Neu" })] })], ziel, () => {}, () => {}, true);

        expect(Array.from(ziel.querySelectorAll(".ox-gericht__name")).map((n) => n.textContent)).toEqual(["Neu"]);
    });
});

describe("zeichneSpeisekarte - Bild-Handling", () => {
    it("Gericht ohne Bild bekommt eine ruhige Flaeche statt eines <img> mit leerem src", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ items: [gericht({ imageUrl: null })] })], ziel, () => {}, () => {}, true);

        expect(ziel.querySelectorAll("img").length).toBe(0);
        const flaeche = ziel.querySelector(".ox-gericht__bild--leer");
        expect(flaeche).not.toBeNull();
        expect(flaeche!.tagName).not.toBe("IMG");
    });

    it("Gericht MIT Bild bekommt ein <img loading=lazy> mit der korrekten Quelle", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte(
            [kategorie({ items: [gericht({ imageUrl: "https://cdn.example.com/pizza.jpg" })] })],
            ziel, () => {}, () => {}, true
        );

        const bild = ziel.querySelector<HTMLImageElement>("img")!;
        expect(bild).not.toBeNull();
        expect(bild.getAttribute("src")).toBe("https://cdn.example.com/pizza.jpg");
        expect(bild.getAttribute("loading")).toBe("lazy");
    });
});

describe("zeichneSpeisekarte - Preisformatierung", () => {
    it("formatiert den Preis ueber preis() statt ihn selbst zusammenzubauen", () => {
        // 1234.5 waehlt bewusst einen Betrag, bei dem sich preis() UND jede
        // naive Eigenbau-Variante deutlich unterscheiden wuerden:
        // `${price} €` -> "1234.5 €", `${price.toFixed(2)} €` -> "1234.50 €"
        // (Punkt statt Komma, kein Tausenderpunkt, normales statt schmales
        // Leerzeichen) - preis(1234.5) dagegen "1.234,50 €".
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ items: [gericht({ price: 1234.5 })] })], ziel, () => {}, () => {}, true);

        const preisElement = ziel.querySelector(".ox-preis")!;
        expect(preisElement.textContent).toBe(preis(1234.5));
        expect(preisElement.textContent).toBe("1.234,50 €");
    });
});

describe("zeichneSpeisekarte - Sicherheit: reiner Text statt Markup", () => {
    it("ein Gerichtname mit < und & erzeugt KEIN Markup (textContent, nicht innerHTML)", () => {
        const boesartig = 'Königsberger Klopse <img src=x onerror="alert(1)"> & Kartoffeln';
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ items: [gericht({ name: boesartig, imageUrl: null })] })], ziel, () => {}, () => {}, true);

        const nameElement = ziel.querySelector(".ox-gericht__name")!;
        expect(nameElement.textContent).toBe(boesartig);
        expect(nameElement.childElementCount).toBe(0);
        // Waere der String als HTML geparst worden, gaebe es jetzt ein
        // zusaetzliches <img>, obwohl das Gericht kein Foto hat (imageUrl: null).
        expect(ziel.querySelectorAll("img").length).toBe(0);
    });

    it("ein Kategoriename mit Markup erzeugt ebenfalls kein Markup", () => {
        const boesartig = "Snacks <b>fett</b> & Getränke";
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ name: boesartig, items: [gericht()] })], ziel, () => {}, () => {}, true);

        const ueberschrift = ziel.querySelector("h2")!;
        expect(ueberschrift.textContent).toBe(boesartig);
        expect(ueberschrift.childElementCount).toBe(0);
    });
});

describe("zeichneSpeisekarte - Karte: Detail-Overlay vs. Schnell-Hinzufuegen", () => {
    it("ein Klick auf die Karte (Foto/Name) ruft NUR beiAuswahl auf, nicht beiSchnellHinzufuegen", () => {
        const g = gericht({ id: 7, name: "Calzone" });
        const beiAuswahl = vi.fn();
        const beiSchnellHinzufuegen = vi.fn();
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ items: [g] })], ziel, beiAuswahl, beiSchnellHinzufuegen, true);

        ziel.querySelector<HTMLButtonElement>(".ox-gericht__oeffnen")!.click();

        expect(beiAuswahl).toHaveBeenCalledWith(g);
        expect(beiSchnellHinzufuegen).not.toHaveBeenCalled();
    });

    it("der '+'-Knopf ruft NUR beiSchnellHinzufuegen auf, nicht beiAuswahl " +
       "(Regression: beide riefen zwischenzeitlich beiAuswahl auf, '+' oeffnete dadurch faelschlich das Overlay)", () => {
        const g = gericht({ id: 8, name: "Diavola" });
        const beiAuswahl = vi.fn();
        const beiSchnellHinzufuegen = vi.fn();
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ items: [g] })], ziel, beiAuswahl, beiSchnellHinzufuegen, true);

        ziel.querySelector<HTMLButtonElement>(".ox-gericht__hinzufuegen")!.click();

        // Neue Signatur: der auslösende Button reicht als zweites Argument mit
        // (der Aufrufer in index.ts macht daraus den Flieger).
        expect(beiSchnellHinzufuegen).toHaveBeenCalledWith(g, expect.any(HTMLElement));
        expect(beiAuswahl).not.toHaveBeenCalled();
    });

    it("Karte und '+' liefern beide dasselbe Gericht-Objekt an ihren jeweiligen Rueckruf", () => {
        const g = gericht({ id: 9, name: "Quattro Stagioni" });
        const beiAuswahl = vi.fn();
        const beiSchnellHinzufuegen = vi.fn();
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ items: [g] })], ziel, beiAuswahl, beiSchnellHinzufuegen, true);

        ziel.querySelector<HTMLButtonElement>(".ox-gericht__oeffnen")!.click();
        ziel.querySelector<HTMLButtonElement>(".ox-gericht__hinzufuegen")!.click();

        expect(beiAuswahl.mock.calls[0][0]).toBe(g);
        expect(beiSchnellHinzufuegen.mock.calls[0][0]).toBe(g);
    });

    it("der '+'-Knopf stoppt die Ereignis-Ausbreitung, damit kein umschliessender Klick-Handler zusaetzlich ausgeloest wird", () => {
        const ziel = document.createElement("div");
        const ausbreitungsSpion = vi.fn();
        ziel.addEventListener("click", ausbreitungsSpion);
        zeichneSpeisekarte([kategorie({ items: [gericht()] })], ziel, () => {}, () => {}, true);

        ziel.querySelector<HTMLButtonElement>(".ox-gericht__hinzufuegen")!.click();

        // Ohne stopPropagation wuerde der Klick bis zu "ziel" durchreichen
        // (echtes DOM-Bubbling in jsdom) - der Spion bliebe dann NICHT stumm.
        expect(ausbreitungsSpion).not.toHaveBeenCalled();
    });

    it("die Karte bleibt anklickbar (Browsen erlaubt), auch wenn bestellenErlaubt=false ist - " +
       "nur der Hinzufuegen-Knopf ist gesperrt", () => {
        const beiAuswahl = vi.fn();
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie({ items: [gericht()] })], ziel, beiAuswahl, () => {}, false);

        const oeffnenKnopf = ziel.querySelector<HTMLButtonElement>(".ox-gericht__oeffnen")!;
        expect(oeffnenKnopf.disabled).toBe(false);
        oeffnenKnopf.click();
        expect(beiAuswahl).toHaveBeenCalledTimes(1);

        const hinzufuegenKnopf = ziel.querySelector<HTMLButtonElement>(".ox-gericht__hinzufuegen")!;
        expect(hinzufuegenKnopf.disabled).toBe(true);
    });
});

describe("setzeBestellenErlaubt", () => {
    it("sperrt bei false ALLE Hinzufuegen-Knoepfe der Liste (nicht nur den ersten)", () => {
        const ziel = document.createElement("div");
        document.body.appendChild(ziel);
        const kategorien = [kategorie({ items: [gericht({ id: 1 }), gericht({ id: 2, name: "Diavola" })] })];
        zeichneSpeisekarte(kategorien, ziel, () => {}, () => {}, true);

        setzeBestellenErlaubt(false);

        const knoepfe = ziel.querySelectorAll<HTMLButtonElement>(".ox-gericht__hinzufuegen");
        expect(knoepfe.length).toBe(2);
        knoepfe.forEach((k) => expect(k.disabled).toBe(true));
    });

    it("entsperrt bei true wieder, OHNE die Liste neu zu zeichnen - " +
       "sonst verliert der Gast seine Scrollposition waehrend des Wartens", () => {
        const ziel = document.createElement("div");
        document.body.appendChild(ziel);
        zeichneSpeisekarte([kategorie({ items: [gericht()] })], ziel, () => {}, () => {}, false);

        const karteVorher = ziel.querySelector(".ox-gericht");
        const abschnittVorher = ziel.querySelector(".ox-kategorie-abschnitt");
        expect(karteVorher).not.toBeNull();

        setzeBestellenErlaubt(true);

        // Dieselbe Knoten-INSTANZ (===) - kein Neuaufbau des Teilbaums.
        // Ein Implementierung, die hier zeichneSpeisekarte erneut aufruft,
        // wuerde NEUE Elemente erzeugen und diese Pruefung risse.
        expect(ziel.querySelector(".ox-gericht")).toBe(karteVorher);
        expect(ziel.querySelector(".ox-kategorie-abschnitt")).toBe(abschnittVorher);

        // ... und tatsaechlich entsperrt, nicht nur "nicht neu gezeichnet".
        const knopf = ziel.querySelector<HTMLButtonElement>(".ox-gericht__hinzufuegen")!;
        expect(knopf.disabled).toBe(false);
    });

    it("wirkt auch auf den Hinzufuegen-Knopf eines gerade offenen Detail-Overlays", () => {
        oeffneDetail(gericht(), () => {}, false);
        const knopfImOverlay = document.querySelector<HTMLButtonElement>(".ox-detail__hinzufuegen")!;
        expect(knopfImOverlay.disabled).toBe(true);

        setzeBestellenErlaubt(true);

        expect(knopfImOverlay.disabled).toBe(false);
    });
});

describe("Kategorie-Leiste", () => {
    it("zeigt bei mindestens zwei Kategorien mit Inhalt eine Reiter-Leiste, die erste ist aktiv", () => {
        const ziel = document.createElement("div");
        const kategorien = [
            kategorie({ id: 1, name: "Vorspeisen", items: [gericht({ id: 1 })] }),
            kategorie({ id: 2, name: "Hauptgerichte", items: [gericht({ id: 2 })] })
        ];
        zeichneSpeisekarte(kategorien, ziel, () => {}, () => {}, true, false);

        const reiter = ziel.querySelectorAll<HTMLButtonElement>(".ox-kategorie-reiter");
        expect(reiter.length).toBe(2);
        expect(reiter[0].textContent).toBe("Vorspeisen");
        expect(reiter[0].classList.contains("is-active")).toBe(true);
        expect(reiter[1].classList.contains("is-active")).toBe(false);
        expect(ziel.querySelector(".ox-kategorie-hamburger")).toBeNull();
    });

    it("die Reiter-Leiste hat einen gleitenden Strich bei mindestens zwei Kategorien", () => {
        const ziel = document.createElement("div");
        const zweiKategorien = [
            kategorie({ id: 1, name: "Vorspeisen", items: [gericht({ id: 1 })] }),
            kategorie({ id: 2, name: "Hauptgerichte", items: [gericht({ id: 2 })] })
        ];
        zeichneSpeisekarte(zweiKategorien, ziel, () => {}, () => {}, true, false);

        expect(ziel.querySelector(".ox-kategorie-strich")).not.toBeNull();
    });

    it("wechselt is-active beim Klick auf einen anderen Reiter", () => {
        const ziel = document.createElement("div");
        const kategorien = [
            kategorie({ id: 1, name: "Vorspeisen", items: [gericht({ id: 1 })] }),
            kategorie({ id: 2, name: "Hauptgerichte", items: [gericht({ id: 2 })] })
        ];
        zeichneSpeisekarte(kategorien, ziel, () => {}, () => {}, true, false);

        const reiter = ziel.querySelectorAll<HTMLButtonElement>(".ox-kategorie-reiter");
        reiter[1].click();

        expect(reiter[0].classList.contains("is-active")).toBe(false);
        expect(reiter[1].classList.contains("is-active")).toBe(true);
    });

    it("zeigt KEINE Kategorie-Leiste, wenn nur eine Kategorie Inhalt hat (auch wenn formal mehr existieren)", () => {
        const ziel = document.createElement("div");
        const kategorien = [
            kategorie({ id: 1, name: "Vorspeisen", items: [gericht({ id: 1 })] }),
            kategorie({ id: 2, name: "Saisonal", items: [] })
        ];
        zeichneSpeisekarte(kategorien, ziel, () => {}, () => {}, true, false);

        expect(ziel.querySelector(".ox-kategorie-leiste")).toBeNull();
        expect(ziel.querySelector(".ox-kategorie-hamburger")).toBeNull();
    });

    it("baut im Hamburger-Modus (categoriesAsHamburger) einen Umschalt-Knopf mit Panel statt der Reiter-Leiste", () => {
        const ziel = document.createElement("div");
        const kategorien = [
            kategorie({ id: 1, name: "Vorspeisen", items: [gericht({ id: 1 })] }),
            kategorie({ id: 2, name: "Hauptgerichte", items: [gericht({ id: 2 })] })
        ];
        zeichneSpeisekarte(kategorien, ziel, () => {}, () => {}, true, true);

        expect(ziel.querySelector(".ox-kategorie-leiste")).toBeNull();
        const hamburgerKnopf = ziel.querySelector<HTMLButtonElement>(".ox-kategorie-hamburger button");
        expect(hamburgerKnopf).not.toBeNull();

        const panel = ziel.querySelector<HTMLElement>(".ox-kategorie-panel")!;
        expect(panel.hidden).toBe(true);

        hamburgerKnopf!.click();
        expect(panel.hidden).toBe(false);

        const eintraege = panel.querySelectorAll(".ox-kategorie-panel__eintrag");
        expect(eintraege.length).toBe(2);
        expect(eintraege[1].textContent).toBe("Hauptgerichte");

        (eintraege[1] as HTMLButtonElement).click();
        expect(panel.hidden).toBe(true); // schliesst nach Auswahl wieder
    });
});

describe("oeffneDetail - Inhalt", () => {
    it("zeigt Name, Preis und Beschreibung eines Gerichts und oeffnet das Overlay", async () => {
        const g = gericht({ name: "Lasagne", price: 11.9, description: "Hausgemacht" });
        oeffneDetail(g, () => {}, true);

        const overlay = document.querySelector(".ox-detail-overlay")!;
        expect(document.querySelector(".ox-detail-overlay h2")!.textContent).toBe("Lasagne");
        expect(document.querySelector(".ox-detail-overlay .ox-preis")!.textContent).toBe(preis(11.9));
        expect(overlay.textContent).toContain("Hausgemacht");
        await naechsterFrame();
        expect(overlay.classList.contains("is-open")).toBe(true);
    });

    it("der Gerichtname wird ueber textContent gesetzt - Markup im Namen bleibt reiner Text", () => {
        const boesartig = "Flammkuchen <script>alert(1)</script>";
        oeffneDetail(gericht({ name: boesartig }), () => {}, true);

        const nameElement = document.querySelector(".ox-detail-overlay h2")!;
        expect(nameElement.textContent).toBe(boesartig);
        expect(nameElement.childElementCount).toBe(0);
        expect(document.querySelector(".ox-detail-overlay script")).toBeNull();
    });

    it("zeigt ein <img loading=lazy>, wenn das Gericht ein Bild hat", () => {
        oeffneDetail(gericht({ imageUrl: "https://cdn.example.com/pizza.jpg" }), () => {}, true);
        const bild = document.querySelector<HTMLImageElement>(".ox-detail-overlay img")!;
        expect(bild).not.toBeNull();
        expect(bild.getAttribute("src")).toBe("https://cdn.example.com/pizza.jpg");
        expect(bild.getAttribute("loading")).toBe("lazy");
    });

    it("zeigt KEIN <img>, wenn das Gericht kein Bild hat", () => {
        oeffneDetail(gericht({ imageUrl: null }), () => {}, true);
        expect(document.querySelector(".ox-detail-overlay img")).toBeNull();
    });

    it("zeigt 'Zutaten & Details' nur, wenn details gesetzt ist", () => {
        oeffneDetail(gericht({ details: "Enthält Gluten, Milch" }), () => {}, true);
        const block = document.querySelector(".ox-detail__zutaten")!;
        expect(block).not.toBeNull();
        expect(block.textContent).toContain("Enthält Gluten, Milch");
    });

    it("blendet 'Zutaten & Details' aus, wenn details null ist", () => {
        oeffneDetail(gericht({ details: null }), () => {}, true);
        expect(document.querySelector(".ox-detail__zutaten")).toBeNull();
    });

    it("verwendet bei wiederholtem Oeffnen dasselbe Overlay-Element - kein Duplikat im DOM", () => {
        oeffneDetail(gericht({ id: 1, name: "A" }), () => {}, true);
        oeffneDetail(gericht({ id: 2, name: "B" }), () => {}, true);

        expect(document.querySelectorAll(".ox-detail-overlay").length).toBe(1);
        expect(document.querySelector(".ox-detail-overlay h2")!.textContent).toBe("B");
    });
});

describe("oeffneDetail - Mengen-Stepper", () => {
    it("erhoeht und verringert die Menge per Knopf, Start bei 1", () => {
        oeffneDetail(gericht(), () => {}, true);
        const anzeige = document.querySelector(".ox-detail-overlay .ox-num")!;
        const plus = document.querySelector<HTMLButtonElement>('[aria-label="Menge erhöhen"]')!;
        const minus = document.querySelector<HTMLButtonElement>('[aria-label="Menge verringern"]')!;

        expect(anzeige.textContent).toBe("1");
        plus.click();
        plus.click();
        expect(anzeige.textContent).toBe("3");
        minus.click();
        expect(anzeige.textContent).toBe("2");
    });

    it("geht beim Verringern nicht unter 1", () => {
        oeffneDetail(gericht(), () => {}, true);
        const anzeige = document.querySelector(".ox-detail-overlay .ox-num")!;
        const minus = document.querySelector<HTMLButtonElement>('[aria-label="Menge verringern"]')!;

        minus.click();
        minus.click();
        minus.click();

        expect(anzeige.textContent).toBe("1");
    });

    it("geht beim Erhoehen nicht ueber 50", () => {
        oeffneDetail(gericht(), () => {}, true);
        const anzeige = document.querySelector(".ox-detail-overlay .ox-num")!;
        const plus = document.querySelector<HTMLButtonElement>('[aria-label="Menge erhöhen"]')!;

        for (let i = 0; i < 60; i++) plus.click();

        expect(anzeige.textContent).toBe("50");
    });
});

describe("oeffneDetail - In den Warenkorb", () => {
    it("ruft beiHinzufuegen mit Gericht, Menge und getrimmtem Hinweis auf und schliesst danach", async () => {
        const g = gericht({ id: 5, name: "Calzone" });
        const aufrufe: Array<[Gericht, number, string]> = [];
        oeffneDetail(g, (gr, menge, hinweis) => aufrufe.push([gr, menge, hinweis]), true);
        await naechsterFrame();

        document.querySelector<HTMLButtonElement>('[aria-label="Menge erhöhen"]')!.click();
        document.querySelector<HTMLButtonElement>('[aria-label="Menge erhöhen"]')!.click();
        const hinweisFeld = document.querySelector<HTMLInputElement>(".ox-detail-overlay .ox-field")!;
        hinweisFeld.value = "  ohne Oliven  ";

        document.querySelector<HTMLButtonElement>(".ox-detail__hinzufuegen")!.click();

        expect(aufrufe).toEqual([[g, 3, "ohne Oliven"]]);
        expect(document.querySelector(".ox-detail-overlay")!.classList.contains("is-open")).toBe(false);
    });

    it("der Hinzufuegen-Knopf ist gesperrt, wenn bestellenErlaubt=false beim Oeffnen ist", () => {
        oeffneDetail(gericht(), () => {}, false);
        expect(document.querySelector<HTMLButtonElement>(".ox-detail__hinzufuegen")!.disabled).toBe(true);
    });

    it("der Hinzufuegen-Knopf ist frei, wenn bestellenErlaubt=true beim Oeffnen ist", () => {
        oeffneDetail(gericht(), () => {}, true);
        expect(document.querySelector<HTMLButtonElement>(".ox-detail__hinzufuegen")!.disabled).toBe(false);
    });
});

describe("oeffneDetail - Schliessen", () => {
    it("Schliessen-Knopf schliesst das Overlay OHNE beiHinzufuegen aufzurufen", async () => {
        const beiHinzufuegen = vi.fn();
        oeffneDetail(gericht(), beiHinzufuegen, true);

        const overlay = document.querySelector(".ox-detail-overlay")!;
        await naechsterFrame();
        expect(overlay.classList.contains("is-open")).toBe(true);

        document.querySelector<HTMLButtonElement>(".ox-detail__schliessen")!.click();

        expect(overlay.classList.contains("is-open")).toBe(false);
        expect(beiHinzufuegen).not.toHaveBeenCalled();
    });

    it("ein Klick auf den abgedunkelten Hintergrund schliesst das Overlay", async () => {
        oeffneDetail(gericht(), () => {}, true);
        const overlay = document.querySelector<HTMLElement>(".ox-detail-overlay")!;
        await naechsterFrame();

        overlay.click(); // Klick landet direkt auf dem Scrim, nicht auf einem Kind

        expect(overlay.classList.contains("is-open")).toBe(false);
    });

    it("ein Klick auf den Inhalt (die Box) schliesst das Overlay NICHT", async () => {
        oeffneDetail(gericht(), () => {}, true);
        const overlay = document.querySelector<HTMLElement>(".ox-detail-overlay")!;
        const box = document.querySelector<HTMLElement>(".ox-overlay__box")!;
        await naechsterFrame();

        box.click();

        expect(overlay.classList.contains("is-open")).toBe(true);
    });

    it("die Escape-Taste schliesst ein offenes Overlay", async () => {
        oeffneDetail(gericht(), () => {}, true);
        const overlay = document.querySelector<HTMLElement>(".ox-detail-overlay")!;
        await naechsterFrame();

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

        expect(overlay.classList.contains("is-open")).toBe(false);
    });

    it("andere Tasten schliessen das Overlay NICHT", async () => {
        oeffneDetail(gericht(), () => {}, true);
        const overlay = document.querySelector<HTMLElement>(".ox-detail-overlay")!;
        await naechsterFrame();

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(overlay.classList.contains("is-open")).toBe(true);
    });
});

describe("zeichneSpeisekarte - Editor-Erweiterungen", () => {
    it("setzt dataset.gerichtId auf jeder Karte", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie()], ziel, () => {}, () => {}, true);
        const karte = ziel.querySelector<HTMLElement>(".ox-gericht");
        expect(karte?.dataset.gerichtId).toBe("1");
    });

    it("markiert ein Gericht als ausverkauft, wenn istVerfuegbar false liefert", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte(
            [kategorie()], ziel, () => {}, () => {}, true, false,
            () => false
        );
        const karte = ziel.querySelector<HTMLElement>(".ox-gericht");
        expect(karte?.classList.contains("ox-gericht--ausverkauft")).toBe(true);
        expect(karte?.querySelector(".ox-badge")?.textContent).toBe("Ausverkauft");
    });

    it("laesst Gerichte ohne istVerfuegbar-Parameter unveraendert (Gast-Verhalten)", () => {
        const ziel = document.createElement("div");
        zeichneSpeisekarte([kategorie()], ziel, () => {}, () => {}, true);
        const karte = ziel.querySelector<HTMLElement>(".ox-gericht");
        expect(karte?.classList.contains("ox-gericht--ausverkauft")).toBe(false);
        expect(karte?.querySelector(".ox-badge")).toBeNull();
    });

    it("zeigt eine leere Kategorie nur mit zeigeLeereKategorien=true", () => {
        const leer = kategorie({ id: 2, name: "Getraenke", items: [] });

        const ohneFlag = document.createElement("div");
        zeichneSpeisekarte([leer], ohneFlag, () => {}, () => {}, true);
        expect(ohneFlag.querySelector("#cat-2")).toBeNull();

        const mitFlag = document.createElement("div");
        zeichneSpeisekarte([leer], mitFlag, () => {}, () => {}, true, false, undefined, true);
        expect(mitFlag.querySelector("#cat-2")).not.toBeNull();
    });
});
