import { describe, expect, it, vi } from "vitest";
import { staffelEin, fliegeZu, mitAnsichtsWechsel } from "./animation";

describe("animation.ts", () => {
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
