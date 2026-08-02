/* Anmeldung. Zwei Wege, wie bisher:
 *  1. Personen (Inhaber/Service/Kueche): Benutzername + Passwort (Basic Auth).
 *  2. Geraete (Kuechen-Tablet, Kasse, Kellner-Handy): Geraetetoken aus dem
 *     QR-Code, wird als "X-Device-Token" geschickt.
 *
 * Beides liegt im localStorage, gilt also tab-uebergreifend - einmal
 * anmelden reicht fuer alle Personal-Ansichten.
 *
 * ACHTUNG: Die Schluessel "ox-auth" und "ox-device" duerfen sich NICHT
 * aendern. Sonst waeren bereits eingerichtete Geraete abgemeldet und
 * muessten neu per QR-Code aktiviert werden.
 *
 * Diese Datei importiert absichtlich KEIN Modul mit Laufzeit-Code. Sie ist
 * die unterste Ebene; api.ts baut darauf auf. */

import type { Rolle } from "./types";

const SCHLUESSEL_AUTH = "ox-auth";
const SCHLUESSEL_GERAET = "ox-device";

/** Wird gerufen, wenn sich die Anmeldung aendert - session.ts haengt sich ein. */
const beiAenderung: Array<() => void> = [];

export function beiAnmeldungsWechsel(rueckruf: () => void): void {
    beiAenderung.push(rueckruf);
}

function meldeWechsel(): void {
    for (const rueckruf of beiAenderung) rueckruf();
}

function lies(schluessel: string): string | null {
    try { return localStorage.getItem(schluessel); } catch { return null; }
}

function schreibe(schluessel: string, wert: string): void {
    try { localStorage.setItem(schluessel, wert); } catch { /* privater Modus */ }
}

export function setzeAnmeldung(benutzer: string, passwort: string): void {
    // btoa() gehoert in den try: bei Zeichen ausserhalb von Latin-1 (€, kyrillisch,
    // Emoji) wirft es eine DOMException - wie im alten api.js soll das verschluckt
    // werden, statt setzeAnmeldung() zu verlassen, bevor meldeWechsel() laeuft.
    try { schreibe(SCHLUESSEL_AUTH, "Basic " + btoa(benutzer + ":" + passwort)); } catch { /* ungueltige Zeichen fuer btoa */ }
    meldeWechsel();
}

export function setzeGeraeteToken(token: string): void {
    schreibe(SCHLUESSEL_GERAET, token);
    meldeWechsel();
}

export function geraeteToken(): string | null {
    return lies(SCHLUESSEL_GERAET);
}

export function loescheAnmeldung(): void {
    try {
        localStorage.removeItem(SCHLUESSEL_AUTH);
        localStorage.removeItem(SCHLUESSEL_GERAET);
    } catch { /* privater Modus */ }
    meldeWechsel();
}

export function hatAnmeldung(): boolean {
    return Boolean(lies(SCHLUESSEL_AUTH) || lies(SCHLUESSEL_GERAET));
}

/** Geraetetoken hat Vorrang vor Passwort. */
export function authKopfzeilen(): Record<string, string> {
    const geraet = lies(SCHLUESSEL_GERAET);
    if (geraet) return { "X-Device-Token": geraet };
    const basic = lies(SCHLUESSEL_AUTH);
    return basic ? { Authorization: basic } : {};
}

export function rollenText(rolle: Rolle | string): string {
    const namen: Record<string, string> = {
        OWNER: "Inhaber",
        SERVICE: "Service/Kasse",
        KITCHEN: "Küche",
        WAITER: "Kellner"
    };
    return namen[rolle] ?? rolle;
}
