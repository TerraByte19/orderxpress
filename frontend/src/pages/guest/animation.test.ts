import { afterEach, describe, expect, it, vi } from "vitest";
import { staffelEin, fliegeZu, mitAnsichtsWechsel, bewegungsStufe, wachseFoto, zaehleHoch } from "./animation";

describe("animation.ts", () => {
    afterEach(() => {
        document.documentElement.removeAttribute("data-motion");
    });

    it("staffelEin blendet ohne IntersectionObserver sofort alle ein", () => {
        const a = document.createElement("div");
        const b = document.createElement("div");
        document.body.append(a, b);
        staffelEin([a, b]);
        expect(a.classList.contains("ox-anim-stagger")).toBe(true);
        expect(a.classList.contains("is-in")).toBe(true);
        expect(b.classList.contains("is-in")).toBe(true);
    });

    it("mitAnsichtsWechsel ruft den Wechsel auch ohne View-Transitions-API", () => {
        const spy = vi.fn();
        mitAnsichtsWechsel(spy);
        expect(spy).toHaveBeenCalledOnce();
    });

    it("bewegungsStufe liest die Laden-Einstellung von <html>", () => {
        expect(bewegungsStufe()).toBe("normal"); // kein Attribut = Standard
        document.documentElement.dataset.motion = "verspielt";
        expect(bewegungsStufe()).toBe("verspielt");
        document.documentElement.dataset.motion = "dezent";
        expect(bewegungsStufe()).toBe("dezent");
        // Ein Wert, den dieses Frontend nicht kennt (neueres Backend), darf
        // nicht durchschlagen - sonst griffe kein einziger Zweig mehr.
        document.documentElement.dataset.motion = "wild";
        expect(bewegungsStufe()).toBe("normal");
    });

    it("wachseFoto tut ohne Layout nichts - jsdom liefert ueberall Groesse 0", () => {
        const klein = document.createElement("img");
        const gross = document.createElement("img");
        document.body.append(klein, gross);
        wachseFoto(klein, gross);
        expect(document.querySelectorAll(".ox-foto-klon").length).toBe(0);
        // Das Ziel darf dabei NICHT unsichtbar zurueckbleiben.
        expect(gross.style.visibility).toBe("");
    });

    it("zaehleHoch schreibt bei gleichem Wert sofort - ohne Animationsschleife", () => {
        const werte: number[] = [];
        zaehleHoch(7, 7, (w) => werte.push(w));
        expect(werte).toEqual([7]);
    });

    it("zaehleHoch schreibt bei Stufe dezent nur den Endwert", () => {
        document.documentElement.dataset.motion = "dezent";
        const werte: number[] = [];
        zaehleHoch(0, 21.5, (w) => werte.push(w));
        expect(werte).toEqual([21.5]);
    });

    it("fliegeZu haengt einen Klon an und raeumt ihn wieder ab", async () => {
        vi.useFakeTimers();
        const q = document.createElement("button");
        const z = document.createElement("span");
        document.body.append(q, z);
        fliegeZu(q, z, { modus: "PLUS" });
        expect(document.querySelectorAll(".ox-flieger").length).toBe(1);
        vi.advanceTimersByTime(600);
        expect(document.querySelectorAll(".ox-flieger").length).toBe(0);
        vi.useRealTimers();
    });
});
