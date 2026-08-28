import { describe, expect, it, vi } from "vitest";
import { schmueckeBon, bestaetigeBestellung, fliegeBonWeg, setzeBonZurueck } from "./bon";

describe("bon.ts", () => {
    it("schmueckeBon markiert Karte und Zeilen mit gestaffeltem Verzug", () => {
        const karte = document.createElement("div");
        const z1 = document.createElement("div");
        const z2 = document.createElement("div");
        schmueckeBon(karte, [z1, z2]);
        expect(karte.classList.contains("ox-bon")).toBe(true);
        expect(z1.classList.contains("ox-bon-zeile")).toBe(true);
        expect(z2.style.animationDelay).not.toBe("");
        expect(z2.style.animationDelay).not.toBe(z1.style.animationDelay);
    });

    it("schmueckeBon spielt das Eintippen beim Re-Render (Karte schon .ox-bon) nicht erneut", () => {
        const karte = document.createElement("div");
        karte.classList.add("ox-bon"); // simuliert eine schon offene Bon-Karte
        const z1 = document.createElement("div");
        schmueckeBon(karte, [z1]);
        expect(z1.classList.contains("ox-bon-zeile")).toBe(true);
        expect(z1.classList.contains("ox-bon-zeile--still")).toBe(true);
        expect(z1.style.animationDelay).toBe("");
    });

    it("bestaetigeBestellung(CHECK) loest sich auf und hinterlaesst kein Overlay", async () => {
        vi.useFakeTimers();
        const p = bestaetigeBestellung("CHECK");
        vi.advanceTimersByTime(1000);
        await p;
        expect(document.querySelector(".ox-bestaetigung")).toBeNull();
        vi.useRealTimers();
    });

    it("fliegeBonWeg setzt die Klasse und behaelt sie bis setzeBonZurueck", async () => {
        vi.useFakeTimers();
        const karte = document.createElement("div");
        document.body.appendChild(karte);
        const p = fliegeBonWeg(karte);
        expect(karte.classList.contains("ox-bon--weg")).toBe(true);
        vi.advanceTimersByTime(600);
        await p;
        // Klasse bleibt dran - der Bon darf nicht sichtbar zurueckgleiten,
        // bevor die Ansicht wechselt; erst setzeBonZurueck entfernt sie.
        expect(karte.classList.contains("ox-bon--weg")).toBe(true);
        setzeBonZurueck(karte);
        expect(karte.classList.contains("ox-bon--weg")).toBe(false);
        vi.useRealTimers();
    });
});
