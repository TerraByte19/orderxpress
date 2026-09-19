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

    /* ---------- Eigene Vorhangfarbe ----------
       Der Akzent ist eine Knopf-Farbe; bildschirmfuellend ist derselbe Ton
       oft zu hart. Wichtig dabei: die Schriftfarbe wird gegen die VORHANG-
       farbe gerechnet, nicht gegen den Akzent geerbt - sonst stuende auf
       einem dunklen Vorhang der schwarze Kontrastwert einer hellen
       Akzentfarbe. */
    it("setzt eigene Vorhangfarbe samt passend gerechneter Schriftfarbe", () => {
        zeigeVorhang(theme({ introColor: "#141210" }));
        const v = document.querySelector<HTMLElement>(".ox-vorhang")!;
        expect(v.style.getPropertyValue("--ox-vorhang-farbe")).toBe("#141210");
        expect(v.style.getPropertyValue("--ox-vorhang-text")).toBe("#ffffff");
    });

    it("rechnet auf heller Vorhangfarbe schwarze Schrift", () => {
        zeigeVorhang(theme({ introColor: "#ffe08a" }));
        const v = document.querySelector<HTMLElement>(".ox-vorhang")!;
        expect(v.style.getPropertyValue("--ox-vorhang-text")).toBe("#000000");
    });

    it("laesst ohne eigene Farbe beide Variablen weg - dann greift der Akzent aus dem Stylesheet", () => {
        zeigeVorhang(theme({ introColor: null }));
        const v = document.querySelector<HTMLElement>(".ox-vorhang")!;
        expect(v.style.getPropertyValue("--ox-vorhang-farbe")).toBe("");
    });

    it("bricht bei kaputter Farbe aus der Datenbank nicht ab, sondern spielt ohne sie", () => {
        // textfarbeAuf() wirft bei ungueltigem Hex - ein Datenfehler darf den
        // Auftakt nicht mit einer Ausnahme beenden.
        expect(() => zeigeVorhang(theme({ introColor: "dunkelrot" }))).not.toThrow();
        expect(vorhaenge().length).toBe(1);
    });

    /* ---------- Logo ---------- */
    it("zeigt das Logo klein (bisheriges Verhalten), wenn nichts anderes gewaehlt ist", () => {
        zeigeVorhang(theme({ logoUrl: "/logo.png" }));
        const logo = document.querySelector(".ox-vorhang__marke-logo")!;
        expect(logo.classList.contains("ox-vorhang__marke-logo--klein")).toBe(true);
    });

    it("zeigt das Logo gross, wenn der Laden es so will", () => {
        zeigeVorhang(theme({ logoUrl: "/logo.png", introLogo: "GROSS" }));
        const logo = document.querySelector(".ox-vorhang__marke-logo")!;
        expect(logo.classList.contains("ox-vorhang__marke-logo--gross")).toBe(true);
    });

    it("laesst das Logo bei OHNE weg, obwohl eins hinterlegt ist", () => {
        zeigeVorhang(theme({ logoUrl: "/logo.png", introLogo: "OHNE" }));
        expect(document.querySelector(".ox-vorhang__marke-logo")).toBeNull();
    });

    it("haelt bei OHNE-Logo und ohne Text gar nicht an - es gibt nichts zu lesen", () => {
        vi.useFakeTimers();
        zeigeVorhang(theme({ introStyle: "HOCHKLAPPEN", logoUrl: "/logo.png", introLogo: "OHNE", introText: null }));
        const v = document.querySelector(".ox-vorhang")!;
        vi.advanceTimersByTime(10);
        expect(v.classList.contains("ox-vorhang--los")).toBe(true);
    });

    /* ---------- Haltezeit ---------- */
    it("haelt gar nicht an, wenn der Laden OHNE gewaehlt hat", () => {
        vi.useFakeTimers();
        zeigeVorhang(theme({ introStyle: "HOCHKLAPPEN", introText: "Willkommen", introHold: "OHNE" }));
        const v = document.querySelector(".ox-vorhang")!;
        vi.advanceTimersByTime(10);
        expect(v.classList.contains("ox-vorhang--los")).toBe(true);
    });

    it("haelt bei KURZ deutlich kuerzer als bei NORMAL", () => {
        vi.useFakeTimers();
        zeigeVorhang(theme({ introStyle: "HOCHKLAPPEN", introText: "Willkommen", introHold: "KURZ" }));
        const v = document.querySelector(".ox-vorhang")!;
        vi.advanceTimersByTime(500);
        expect(v.classList.contains("ox-vorhang--los")).toBe(false);
        vi.advanceTimersByTime(400);
        expect(v.classList.contains("ox-vorhang--los")).toBe(true);
    });

    /* ---------- Wiederholung ----------
       Standard bleibt IMMER; EINMAL ist die Wahl des Ladens, nicht der
       Rueckfall. Gemerkt wird pro LADEN, nicht pro Gast: wer neu scannt,
       bekommt einen neuen guestToken und saehe den Vorhang sonst trotz
       EINMAL wieder. */
    it("spielt bei EINMAL nur beim ersten Mal", () => {
        zeigeVorhang(theme({ introRepeat: "EINMAL", id: 7 }));
        expect(vorhaenge().length).toBe(1);
        zeigeVorhang(theme({ introRepeat: "EINMAL", id: 7 }));
        expect(vorhaenge().length).toBe(1);
    });

    it("merkt sich EINMAL je Laden - ein anderer Laden spielt trotzdem", () => {
        zeigeVorhang(theme({ introRepeat: "EINMAL", id: 7 }));
        zeigeVorhang(theme({ introRepeat: "EINMAL", id: 8 }));
        expect(vorhaenge().length).toBe(2);
    });

    it("spielt bei EINMAL ohne Laden-Id lieber jedes Mal, als nie", () => {
        zeigeVorhang(theme({ introRepeat: "EINMAL" }));
        zeigeVorhang(theme({ introRepeat: "EINMAL" }));
        expect(vorhaenge().length).toBe(2);
    });

    it("merkt sich bei IMMER weiterhin nichts", () => {
        zeigeVorhang(theme({ introRepeat: "IMMER", id: 7 }));
        zeigeVorhang(theme({ introRepeat: "IMMER", id: 7 }));
        expect(vorhaenge().length).toBe(2);
        expect(localStorage.length).toBe(0);
    });

    /* ---------- Vorhang-Bild ----------
       Zwei ganz verschiedene Dinge aus EINEM hochgeladenen Bild: AUFGELEGT
       haengt es als Plakat in die Marke, FLAECHE macht es zum Vorhang
       selbst. Verwechselt man die beiden, sieht man es nicht sofort - der
       Vorhang ist in beiden Faellen "da". */
    it("haengt das Bild als Plakat in die Marke (AUFGELEGT)", () => {
        zeigeVorhang(theme({ introImageUrl: "/api/guest/restaurants/1/intro", introImageStyle: "AUFGELEGT" }));
        const bild = document.querySelector<HTMLImageElement>(".ox-vorhang__marke-bild");
        expect(bild).not.toBeNull();
        expect(bild!.src).toContain("/api/guest/restaurants/1/intro");
        // Als Plakat gehoert es NICHT auf den Stoff.
        expect(document.querySelector(".ox-vorhang")!.classList.contains("ox-vorhang--bild")).toBe(false);
    });

    it("macht das Bild zum Vorhang selbst (FLAECHE) - kein Plakat in der Marke", () => {
        zeigeVorhang(theme({ introImageUrl: "/bild.jpg", introImageStyle: "FLAECHE", introText: "Hallo" }));
        const v = document.querySelector<HTMLElement>(".ox-vorhang")!;
        expect(v.classList.contains("ox-vorhang--bild")).toBe(true);
        expect(v.style.getPropertyValue("--ox-vorhang-bild")).toBe('url("/bild.jpg")');
        expect(document.querySelector(".ox-vorhang__marke-bild")).toBeNull();
    });

    it("baut ohne hochgeladenes Bild weder Plakat noch Flaeche", () => {
        zeigeVorhang(theme({ introImageUrl: null, introImageStyle: "FLAECHE" }));
        const v = document.querySelector<HTMLElement>(".ox-vorhang")!;
        expect(v.classList.contains("ox-vorhang--bild")).toBe(false);
        expect(document.querySelector(".ox-vorhang__marke-bild")).toBeNull();
    });

    it("haelt fuer ein aufgelegtes Plakat an, auch ohne Text und Logo", () => {
        vi.useFakeTimers();
        zeigeVorhang(theme({
            introStyle: "HOCHKLAPPEN", introText: null, logoUrl: null,
            introImageUrl: "/plakat.jpg", introImageStyle: "AUFGELEGT", introHold: "NORMAL"
        }));
        const v = document.querySelector(".ox-vorhang")!;
        vi.advanceTimersByTime(1500);
        expect(v.classList.contains("ox-vorhang--los")).toBe(false);
    });

    it("haelt bei FLAECHE ohne Text und Logo NICHT an - es gibt nichts zu lesen", () => {
        vi.useFakeTimers();
        zeigeVorhang(theme({
            introStyle: "HOCHKLAPPEN", introText: null, logoUrl: null,
            introImageUrl: "/bild.jpg", introImageStyle: "FLAECHE", introHold: "LANG"
        }));
        const v = document.querySelector(".ox-vorhang")!;
        vi.advanceTimersByTime(10);
        expect(v.classList.contains("ox-vorhang--los")).toBe(true);
    });

    /* ---------- Kinoleinwand ----------
       Anders als die vier aelteren Stile baut KINO zusaetzliche Elemente:
       die Leinwand umschliesst den Vorhang (sie dehnt sich aus, der Vorhang
       waechst mit) und traegt das Buehnenlicht. Wer das spaeter umbaut,
       merkt an diesen Tests, wenn die Schachtelung kippt. */
    it("baut Leinwand, Stange und Licht - und der Vorhang liegt IN der Leinwand", () => {
        zeigeVorhang(theme({ introStyle: "KINO" }));
        const v = document.querySelector(".ox-vorhang")!;
        expect(v.classList.contains("ox-vorhang--kino")).toBe(true);

        const leinwand = v.querySelector(".ox-vorhang__leinwand")!;
        expect(leinwand).not.toBeNull();
        // Kein Buehnenlicht mehr: auf Wunsch entfernt, zusammen mit dem
        // Anstrahl-Licht auf dem Stoff - das verfaelschte die eingestellte
        // Vorhangfarbe (siehe vorhang.css).
        expect(v.querySelector(".ox-vorhang__licht")).toBeNull();

        // Vorhang und Stange sind GESCHWISTER der Leinwand, keine Kinder.
        // Gesehen und behoben: lagen sie darin, hing der Vorhang als kleines
        // Rechteck mitten im schwarzen Saal, statt den Bildschirm zu fuellen.
        expect(v.querySelectorAll(":scope > .ox-vorhang__feld").length).toBe(2);
        expect(v.querySelector(":scope > .ox-vorhang__stange")).not.toBeNull();
        expect(leinwand.querySelector(".ox-vorhang__feld")).toBeNull();
    });

    it("gibt dem Buehnenvorhang KEINE Leinwand", () => {
        zeigeVorhang(theme({ introStyle: "VORHANG" }));
        expect(document.querySelector(".ox-vorhang__leinwand")).toBeNull();
        expect(document.querySelector(".ox-vorhang__stange")).not.toBeNull();
    });

    it("rechnet die Gesamtdauer aus 1800 ms und dem Tempo des Ladens", () => {
        zeigeVorhang(theme({ introStyle: "KINO", introSpeed: "SCHNELL" }));
        const v = document.querySelector<HTMLElement>(".ox-vorhang")!;
        // 1800 * 0.6 = 1080; die Einzelteile rechnen sich in der CSS daraus.
        expect(v.style.getPropertyValue("--ox-vorhang-dauer")).toBe("1080ms");
    });

    it("nimmt die eigene Vorhangfarbe auch im Kino an", () => {
        zeigeVorhang(theme({ introStyle: "KINO", introColor: "#141210" }));
        const v = document.querySelector<HTMLElement>(".ox-vorhang")!;
        expect(v.style.getPropertyValue("--ox-vorhang-farbe")).toBe("#141210");
    });

    it("dehnt die Leinwand NICHT schon waehrend der Haltezeit aus", () => {
        // Gesehen und behoben: die Ausdehnung hing am blossen Vorhandensein
        // des Vorhangs statt an .ox-vorhang--los. Bei introHold NORMAL (2 s)
        // war das Bildfenster dadurch bildschirmfuellend, bevor der Vorhang
        // ueberhaupt aufging - der Kino-Moment fiel weg. jsdom wertet die
        // CSS nicht aus, geprueft wird darum die Klasse, an der es haengt.
        vi.useFakeTimers();
        zeigeVorhang(theme({ introStyle: "KINO", introText: "Willkommen", introHold: "NORMAL" }));
        const v = document.querySelector(".ox-vorhang")!;
        vi.advanceTimersByTime(1500);
        expect(v.classList.contains("ox-vorhang--los")).toBe(false);
        vi.advanceTimersByTime(600);
        expect(v.classList.contains("ox-vorhang--los")).toBe(true);
    });
});
