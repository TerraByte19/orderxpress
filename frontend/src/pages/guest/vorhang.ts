/* Vorhang-Animation beim ersten Oeffnen der Speisekarte (Design-Achse
 * introStyle: HOCHKLAPPEN | FADE | MITTE | VORHANG, siehe Restaurant/
 * DesignRequest). Spielt nur EINMAL pro Gast - localStorage-Flag, gleiches
 * Muster wie ox-named-<guestToken> in session.ts - nicht bei jedem Neuladen
 * derselben Person. Respektiert bewegungAus() wie der Rest der Bewegungen. */

import { bewegungAus } from "./animation";

const SCHLUESSEL_PREFIX = "ox-intro-";
const DAUER_MS = 900;
const GUELTIGE_STILE = new Set(["HOCHKLAPPEN", "FADE", "MITTE", "VORHANG"]);
const ZWEI_HAELFTEN = new Set(["MITTE", "VORHANG"]);

function schonGezeigt(guestToken: string): boolean {
    try {
        return localStorage.getItem(SCHLUESSEL_PREFIX + guestToken) === "1";
    } catch {
        return true; // privater Modus o.ae. - lieber nicht jedes Mal zeigen
    }
}

function merkeGezeigt(guestToken: string): void {
    try {
        localStorage.setItem(SCHLUESSEL_PREFIX + guestToken, "1");
    } catch { /* privater Modus */ }
}

/** Baut den Vorhang, haengt ihn an document.body und entfernt ihn nach der
 *  Animation wieder selbst - der Aufrufer muss sich um nichts kuemmern. */
export function zeigeVorhang(stil: string, guestToken: string): void {
    if (!guestToken || schonGezeigt(guestToken)) return;
    merkeGezeigt(guestToken);
    if (bewegungAus()) return;

    const stilSicher = GUELTIGE_STILE.has(stil) ? stil : "HOCHKLAPPEN";

    const vorhang = document.createElement("div");
    vorhang.className = `ox-vorhang ox-vorhang--${stilSicher.toLowerCase()}`;
    vorhang.setAttribute("aria-hidden", "true");

    if (ZWEI_HAELFTEN.has(stilSicher)) {
        const links = document.createElement("div");
        links.className = "ox-vorhang__feld ox-vorhang__feld--links";
        const rechts = document.createElement("div");
        rechts.className = "ox-vorhang__feld ox-vorhang__feld--rechts";
        vorhang.append(links, rechts);
    } else {
        const feld = document.createElement("div");
        feld.className = "ox-vorhang__feld";
        vorhang.appendChild(feld);
    }

    document.body.appendChild(vorhang);
    // Erst rendern (Ausgangszustand), dann im naechsten Frame die "los"-Klasse -
    // sonst startet die Transition/Animation nicht sichtbar von ihrem Anfang aus
    // (gleiches Muster wie das Detail-Overlay in menu.ts).
    requestAnimationFrame(() => vorhang.classList.add("ox-vorhang--los"));
    window.setTimeout(() => vorhang.remove(), DAUER_MS);
}
