import { describe, expect, it, vi } from "vitest";
import { schmueckeBon, bestaetigeBestellung, fliegeBonWeg } from "./bon";

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

    it("bestaetigeBestellung(CHECK) loest sich auf und hinterlaesst kein Overlay", async () => {
        vi.useFakeTimers();
        const p = bestaetigeBestellung("CHECK");
        vi.advanceTimersByTime(1000);
        await p;
        expect(document.querySelector(".ox-bestaetigung")).toBeNull();
        vi.useRealTimers();
    });

    it("fliegeBonWeg setzt und entfernt die Klasse wieder", async () => {
        vi.useFakeTimers();
        const karte = document.createElement("div");
        document.body.appendChild(karte);
        const p = fliegeBonWeg(karte);
        expect(karte.classList.contains("ox-bon--weg")).toBe(true);
        vi.advanceTimersByTime(600);
        await p;
        expect(karte.classList.contains("ox-bon--weg")).toBe(false);
        vi.useRealTimers();
    });
});
