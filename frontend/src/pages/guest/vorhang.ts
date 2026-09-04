/* Vorhang-Animation beim ersten Oeffnen der Speisekarte (Design-Achse
 * introStyle: HOCHKLAPPEN | FADE | MITTE | VORHANG, siehe Restaurant/
 * DesignRequest). Spielt nur EINMAL pro Gast - localStorage-Flag, gleiches
 * Muster wie ox-named-<guestToken> in session.ts - nicht bei jedem Neuladen
 * derselben Person. Respektiert bewegungAus() wie der Rest der Bewegungen.
 *
 * Optional: Logo (theme.logoUrl, kein neuer Upload-Platz - das bestehende
 * Design-Logo wird wiederverwendet) + kurzer Text (theme.introText) blenden
 * sich zentriert waehrend des Vorhangs ein. Nur dann haelt der Vorhang kurz
 * (HALT_MIT_MARKE_MS) an, bevor er aufgeht - sonst laeuft er direkt durch
 * wie zuvor, keine Verhaltensaenderung ohne gesetzte Marke.
 *
 * Tempo (theme.introSpeed: LANGSAM|NORMAL|SCHNELL) skaliert die in CSS
 * hinterlegte Grund-Dauer jedes Stils (BASIS_DAUER_MS) ueber die Variable
 * --ox-vorhang-dauer auf dem Container - die CSS-Datei (vorhang.css) kennt
 * dieselben Grundwerte nur noch als Rueckfall, falls die Variable fehlt. */

import { bewegungAus } from "./animation";

const SCHLUESSEL_PREFIX = "ox-intro-";
/** Lesezeit fuer Logo/Willkommenstext - bewusst FEST (nicht von introSpeed
 *  skaliert): Tempo betrifft nur die Vorhang-Bewegung, die Lesezeit eines
 *  Menschen ist keine Stiloption. 2s reichen fuer einen kurzen Satz. */
const HALT_MIT_MARKE_MS = 2000;
const GUELTIGE_STILE = new Set(["HOCHKLAPPEN", "FADE", "MITTE", "VORHANG"]);
const ZWEI_HAELFTEN = new Set(["MITTE", "VORHANG"]);

/** Muss zu den ms-Rueckfallwerten in vorhang.css passen (dort als
 *  var(--ox-vorhang-dauer, XXXms) hinterlegt). */
const BASIS_DAUER_MS: Record<string, number> = {
    HOCHKLAPPEN: 600,
    FADE: 550,
    MITTE: 650,
    VORHANG: 750
};

const GUELTIGE_GESCHWINDIGKEITEN = new Set(["LANGSAM", "NORMAL", "SCHNELL"]);
const GESCHWINDIGKEIT_FAKTOR: Record<string, number> = {
    LANGSAM: 1.6,
    NORMAL: 1,
    SCHNELL: 0.6
};

export interface VorhangTheme {
    introStyle: string;
    introText?: string | null;
    logoUrl?: string | null;
    introSpeed?: string | null;
}

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
export function zeigeVorhang(theme: VorhangTheme, guestToken: string): void {
    if (!guestToken || schonGezeigt(guestToken)) return;
    merkeGezeigt(guestToken);
    if (bewegungAus()) return;

    const stilSicher = GUELTIGE_STILE.has(theme.introStyle) ? theme.introStyle : "HOCHKLAPPEN";
    const text = (theme.introText || "").trim();
    const hatMarke = Boolean(text || theme.logoUrl);

    const geschwindigkeitSicher = GUELTIGE_GESCHWINDIGKEITEN.has(theme.introSpeed || "")
        ? (theme.introSpeed as string)
        : "NORMAL";
    const dauerMs = Math.round(BASIS_DAUER_MS[stilSicher] * GESCHWINDIGKEIT_FAKTOR[geschwindigkeitSicher]);
    // Lesezeit bleibt fest (siehe HALT_MIT_MARKE_MS) - nur die Vorhang-Bewegung
    // selbst (dauerMs oben) folgt dem gewaehlten Tempo.
    const haltMitMarkeMs = HALT_MIT_MARKE_MS;

    const vorhang = document.createElement("div");
    vorhang.className = `ox-vorhang ox-vorhang--${stilSicher.toLowerCase()}`;
    vorhang.setAttribute("aria-hidden", "true");
    vorhang.style.setProperty("--ox-vorhang-dauer", `${dauerMs}ms`);

    if (ZWEI_HAELFTEN.has(stilSicher)) {
        const links = document.createElement("div");
        links.className = "ox-vorhang__feld ox-vorhang__feld--links";
        const rechts = document.createElement("div");
        rechts.className = "ox-vorhang__feld ox-vorhang__feld--rechts";
        vorhang.append(links, rechts);
        if (stilSicher === "VORHANG") {
            const stange = document.createElement("div");
            stange.className = "ox-vorhang__stange";
            vorhang.appendChild(stange);
        }
    } else {
        const feld = document.createElement("div");
        feld.className = "ox-vorhang__feld";
        vorhang.appendChild(feld);
    }

    if (hatMarke) {
        const marke = document.createElement("div");
        marke.className = "ox-vorhang__marke";
        if (theme.logoUrl) {
            const logo = document.createElement("img");
            logo.className = "ox-vorhang__marke-logo";
            logo.src = theme.logoUrl;
            logo.alt = "";
            marke.appendChild(logo);
        }
        if (text) {
            const beschriftung = document.createElement("span");
            beschriftung.className = "ox-vorhang__marke-text";
            beschriftung.textContent = text;
            marke.appendChild(beschriftung);
        }
        vorhang.appendChild(marke);
    }

    document.body.appendChild(vorhang);

    const haltMs = hatMarke ? haltMitMarkeMs : 0;
    // Erst rendern (Ausgangszustand), dann im naechsten Frame die Marke einblenden
    // (falls vorhanden) - sonst startet die Transition nicht sichtbar von ihrem
    // Anfang aus (gleiches Muster wie das Detail-Overlay in menu.ts). Die
    // "los"-Klasse fuer Vorhang-Bewegung + Marke-Ausblenden kommt erst nach dem
    // Halt, damit ohne Marke (haltMs=0) exakt das bisherige Verhalten bleibt.
    requestAnimationFrame(() => {
        if (hatMarke) vorhang.classList.add("ox-vorhang--marke-ein");
    });
    window.setTimeout(() => vorhang.classList.add("ox-vorhang--los"), haltMs);
    window.setTimeout(() => vorhang.remove(), haltMs + dauerMs);
}
