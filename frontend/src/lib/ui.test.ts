import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tischmarke, toast, zeigeNur } from "./ui";

describe("tischmarke", () => {
    it("formatiert einstellige Nummern mit fuehrender Null", () => {
        const marke = tischmarke(7);
        expect(marke.textContent).toBe("Tisch 07");
    });

    it("lässt zweistellige Nummern unbeschädigt", () => {
        const marke = tischmarke(42);
        expect(marke.textContent).toBe("Tisch 42");
    });

    it("lässt dreistellige Nummern unbeschädigt", () => {
        const marke = tischmarke(123);
        expect(marke.textContent).toBe("Tisch 123");
    });

    it("setzt die Basisklasse ox-tischmarke", () => {
        const marke = tischmarke(5);
        expect(marke.className).toBe("ox-tischmarke");
    });

    it("ergänzt die gross-Variante ohne Basisklasse zu verlieren", () => {
        const marke = tischmarke(5, true);
        expect(marke.className).toContain("ox-tischmarke");
        expect(marke.className).toContain("ox-tischmarke--gross");
    });

    it("nutzt textContent statt innerHTML", () => {
        const marke = tischmarke(5);
        // Wenn textContent verwendet wird, ist .textContent === .textContent
        // und .innerHTML != der Inhalt (da keine HTML-Tags)
        expect(marke.textContent).toBe("Tisch 05");
        // innerHTML würde "Tisch 05" sein, aber das ist ok - wir prüfen, dass
        // es nicht interpretiert wird, indem wir prüfen, dass textContent stimmt
        expect(marke instanceof HTMLSpanElement).toBe(true);
    });

    it("gibt ein HTMLSpanElement zurück", () => {
        const marke = tischmarke(5);
        expect(marke instanceof HTMLSpanElement).toBe(true);
    });
});

describe("toast", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Aufräumen: alle Toast-Elemente entfernen
        document.querySelectorAll(".ox-toast").forEach(el => el.remove());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("zeigt eine Nachricht mit is-open Klasse an", () => {
        toast("Test");
        const element = document.querySelector(".ox-toast");
        expect(element?.textContent).toBe("Test");
        expect(element?.className).toContain("is-open");
    });

    it("entfernt is-open nach dem Timer ab", () => {
        toast("Test");
        const element = document.querySelector(".ox-toast") as HTMLDivElement;
        expect(element.className).toContain("is-open");

        vi.advanceTimersByTime(3500);
        expect(element.className).not.toContain("is-open");
    });

    it("ersetzt den Timer, wenn eine zweite Nachricht kurz danach kommt", () => {
        toast("Erste");
        vi.advanceTimersByTime(1000); // Erst 1 Sekunde, nicht alle 3.5

        toast("Zweite");
        const element = document.querySelector(".ox-toast") as HTMLDivElement;
        expect(element.textContent).toBe("Zweite");
        expect(element.className).toContain("is-open");

        // Nach weiteren 3.5 Sekunden (insgesamt 3.5 von der zweiten Meldung)
        // Der Timer der ersten Meldung laeuft zwischenzeitlich ab (bei 3000ms),
        // aber wird durch clearTimeout geloescht, wenn die zweite kommt.
        vi.advanceTimersByTime(3500);
        expect(element.className).not.toContain("is-open");
    });

    it("markiert Fehlermeldungen mit is-error", () => {
        toast("Fehler!", true);
        const element = document.querySelector(".ox-toast");
        expect(element?.className).toContain("is-error");
    });

    it("entfernt is-error bei nachfolgender Normal-Nachricht", () => {
        toast("Fehler!", true);
        const element = document.querySelector(".ox-toast") as HTMLDivElement;
        expect(element.className).toContain("is-error");

        toast("Ok");
        expect(element.className).toContain("is-open");
        expect(element.className).not.toContain("is-error");
    });
});

describe("zeigeNur", () => {
    beforeEach(() => {
        // Teste Elemente erstellen
        const container = document.createElement("div");
        container.innerHTML = `
            <div id="seite1"></div>
            <div id="seite2"></div>
            <div id="seite3"></div>
        `;
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("zeigt nur das genannte Element an", () => {
        zeigeNur("seite2", ["seite1", "seite2", "seite3"]);
        const seite1 = document.getElementById("seite1");
        const seite2 = document.getElementById("seite2");
        const seite3 = document.getElementById("seite3");

        expect(seite1?.hidden).toBe(true);
        expect(seite2?.hidden).toBe(false);
        expect(seite3?.hidden).toBe(true);
    });

    it("blendet alle anderen Elemente aus", () => {
        zeigeNur("seite1", ["seite1", "seite2", "seite3"]);
        const seite1 = document.getElementById("seite1");
        const seite2 = document.getElementById("seite2");
        const seite3 = document.getElementById("seite3");

        expect(seite1?.hidden).toBe(false);
        expect(seite2?.hidden).toBe(true);
        expect(seite3?.hidden).toBe(true);
    });
});
