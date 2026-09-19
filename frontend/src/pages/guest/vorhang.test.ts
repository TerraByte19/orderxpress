/* Vorhang beim Oeffnen der Speisekarte.
 *
 * Der wichtigste Punkt hier ist eine BEWUSSTE Verhaltensaenderung vom
 * 19.09.2026: der Vorhang lief vorher nur EINMAL pro Gast (localStorage-Merker
 * "ox-intro-<guestToken>"). Wer die Seite am Tisch neu lud, bekam ihn nie
 * wieder zu sehen. Jetzt spielt er bei jedem Seitenaufruf, und der Merker ist
 * ersatzlos entfallen.
 *
 * Genau das kann bei einer spaeteren Aufraeumaktion still zurueckfallen
 * ("wir merken uns das doch besser") - deshalb steht es hier als Test und
 * nicht nur als Kommentar. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zeigeVorhang } from "./vorhang";

const theme = (ueberschreibungen: Partial<Parameters<typeof zeigeVorhang>[0]> = {}) => ({
    introStyle: "VORHANG",
    introText: null,
    logoUrl: null,
    introSpeed: "NORMAL",
    ...ueberschreibungen
});

const vorhaenge = () => document.querySelectorAll(".ox-vorhang");

describe("zeigeVorhang", () => {
    beforeEach(() => {
        document.body.textContent = "";
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("spielt bei JEDEM Aufruf - kein Merker, der ihn beim zweiten Mal unterdrueckt", () => {
        zeigeVorhang(theme());
        expect(vorhaenge().length).toBe(1);

        // Zweiter Seitenaufruf derselben Person: frueher kam hier nichts mehr.
        zeigeVorhang(theme());
        expect(vorhaenge().length).toBe(2);
    });

    it("legt nichts im localStorage ab", () => {
        zeigeVorhang(theme());
        expect(localStorage.length).toBe(0);
    });

    it("raeumt sich nach Ablauf selbst wieder ab", () => {
        vi.useFakeTimers();
        zeigeVorhang(theme({ introStyle: "HOCHKLAPPEN" }));
        expect(vorhaenge().length).toBe(1);

        // 600 ms Grunddauer bei HOCHKLAPPEN, Tempo NORMAL (Faktor 1), keine Marke.
        vi.advanceTimersByTime(700);
        expect(vorhaenge().length).toBe(0);
    });

    it("haelt mit Willkommenstext an, bevor er aufgeht", () => {
        vi.useFakeTimers();
        zeigeVorhang(theme({ introStyle: "HOCHKLAPPEN", introText: "Willkommen" }));
        const vorhang = document.querySelector(".ox-vorhang")!;

        // Waehrend der Lesezeit (2000 ms) hat die Bewegung noch nicht begonnen.
        vi.advanceTimersByTime(1500);
        expect(vorhang.classList.contains("ox-vorhang--los")).toBe(false);

        vi.advanceTimersByTime(700);
        expect(vorhang.classList.contains("ox-vorhang--los")).toBe(true);
    });

    it("faellt bei unbekanntem Stil auf HOCHKLAPPEN zurueck, statt eine tote Klasse zu setzen", () => {
        zeigeVorhang(theme({ introStyle: "KONFETTI" }));
        const vorhang = document.querySelector(".ox-vorhang")!;
        expect(vorhang.classList.contains("ox-vorhang--hochklappen")).toBe(true);
    });

    it("setzt die Dauer aus dem gewaehlten Tempo als Variable auf den Container", () => {
        zeigeVorhang(theme({ introStyle: "VORHANG", introSpeed: "SCHNELL" }));
        const vorhang = document.querySelector<HTMLElement>(".ox-vorhang")!;
        // 750 ms Grunddauer * 0.6 = 450 ms
        expect(vorhang.style.getPropertyValue("--ox-vorhang-dauer")).toBe("450ms");
    });
});
