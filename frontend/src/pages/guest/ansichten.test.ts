/* Absicherung der Tischmarke-Zustaende aus ansichten.ts (Aufgabe 7):
 *
 * Waehrend der Tisch auf Freigabe wartet, atmet die Marke
 * (.ox-tischmarke--wartet). Beim Uebergang wartet -> frei schnappt sie
 * einmalig ein (.ox-tischmarke--frei). Der Marken-Knoten wird dabei EINMAL
 * ueber tischmarke() aus lib/ui.ts gebaut (fuehrende Null dort, nicht hier
 * dupliziert) und danach nur noch um Klassen ergaenzt - nicht bei jedem
 * Aufruf neu erzeugt. */

import { describe, expect, it } from "vitest";
import { aktualisiereTischmarke } from "./ansichten";

describe("aktualisiereTischmarke - Warte-/Frei-Zustand", () => {
    it("traegt --wartet bei wartet=true und --frei nach dem Uebergang", () => {
        document.body.innerHTML = `<span id="table-badge"></span>`;

        aktualisiereTischmarke(7, true);
        expect(document.querySelector(".ox-tischmarke")!.classList.contains("ox-tischmarke--wartet")).toBe(true);

        aktualisiereTischmarke(7, false);
        const marke = document.querySelector(".ox-tischmarke")!;
        expect(marke.classList.contains("ox-tischmarke--wartet")).toBe(false);
        expect(marke.classList.contains("ox-tischmarke--frei")).toBe(true);
    });

    it("baut die Marke nur EINMAL (gleicher Knoten ueber mehrere Aufrufe) mit fuehrender Null aus tischmarke()", () => {
        document.body.innerHTML = `<span id="table-badge"></span>`;

        aktualisiereTischmarke(3, true);
        const zuerst = document.querySelector(".ox-tischmarke");
        expect(zuerst!.textContent).toBe("Tisch 03");

        aktualisiereTischmarke(3, true);
        aktualisiereTischmarke(3, false);

        expect(document.querySelectorAll(".ox-tischmarke")).toHaveLength(1);
        expect(document.querySelector(".ox-tischmarke")).toBe(zuerst);
    });

    it("tut nichts (und wirft nicht) ohne #table-badge im DOM", () => {
        document.body.innerHTML = "";
        expect(() => aktualisiereTischmarke(1, true)).not.toThrow();
    });
});
