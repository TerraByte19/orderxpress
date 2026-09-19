/* Design-Gedaechtnis der Gaeste-Seite.
 *
 * Das Theme kommt erst nach zwei Runden uebers Netz (scannen -> restaurantId
 * -> Theme). Bis dahin malte die Seite mit den Standardwerten aus tokens.css,
 * also dunkelgruen - der Gast sah kurz eine fremde Farbe.
 *
 * merkeDesignStand() schreibt darum den FERTIGEN Zustand von <html> weg; ein
 * kleines Skript im Kopf von guest.html spielt ihn beim naechsten Besuch vor
 * dem ersten Malen zurueck. Beide Seiten muessen sich ueber Schluessel und
 * Form einig sein - genau das halten diese Tests fest. Der Aufbau des
 * Eintrags ist deshalb hier festgeschrieben und nicht nur "irgendein JSON".
 */

import { beforeEach, describe, expect, it } from "vitest";
import { merkeDesignStand } from "./laden-design";

const SCHLUESSEL = (token: string) => "ox-design-" + token;

describe("merkeDesignStand", () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute("style");
        for (const a of ["data-theme", "data-shape", "data-font", "data-layout",
                         "data-hero", "data-textur", "data-control",
                         "data-kategorie", "data-motion"]) {
            document.documentElement.removeAttribute(a);
        }
    });

    it("schreibt Inline-Variablen und data-Attribute unter den QR-Token", () => {
        const wurzel = document.documentElement;
        wurzel.style.setProperty("--ox-accent", "#7a1f2b");
        wurzel.setAttribute("data-theme", "dark");
        wurzel.setAttribute("data-layout", "tafel");

        merkeDesignStand("abc");

        const stand = JSON.parse(localStorage.getItem(SCHLUESSEL("abc"))!);
        expect(stand.stil).toContain("--ox-accent");
        expect(stand.attr["data-theme"]).toBe("dark");
        expect(stand.attr["data-layout"]).toBe("tafel");
    });

    it("merkt nur gesetzte Attribute - der Standard soll nichts erzwingen", () => {
        document.documentElement.setAttribute("data-layout", "kacheln");
        merkeDesignStand("abc");

        const stand = JSON.parse(localStorage.getItem(SCHLUESSEL("abc"))!);
        expect(stand.attr["data-layout"]).toBe("kacheln");
        // data-theme war nie gesetzt (heller Laden) - darf auch nicht
        // auftauchen, sonst zwaenge der naechste Besuch die dunkle Haut auf.
        expect("data-theme" in stand.attr).toBe(false);
    });

    it("trennt nach QR-Token - zwei Laeden ueberschreiben sich nicht", () => {
        document.documentElement.setAttribute("data-layout", "tafel");
        merkeDesignStand("laden-a");
        document.documentElement.setAttribute("data-layout", "kacheln");
        merkeDesignStand("laden-b");

        expect(JSON.parse(localStorage.getItem(SCHLUESSEL("laden-a"))!).attr["data-layout"]).toBe("tafel");
        expect(JSON.parse(localStorage.getItem(SCHLUESSEL("laden-b"))!).attr["data-layout"]).toBe("kacheln");
    });

    it("schreibt ohne Token gar nichts", () => {
        merkeDesignStand("");
        expect(localStorage.length).toBe(0);
    });
});
