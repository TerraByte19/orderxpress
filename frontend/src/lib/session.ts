/* "Wer bin ich?" und der Aufbau ohne Login-Aufblitzen.
   Liegt getrennt von auth.ts, weil hier das Backend gerufen wird -
   auth.ts bleibt dadurch importfrei und der Ringschluss mit api.ts
   entsteht gar nicht erst. */

import { api } from "./api";
import { beiAnmeldungsWechsel, hatAnmeldung, loescheAnmeldung } from "./auth";
import type { Me } from "./types";

let zwischenspeicher: Me | null = null;

/** Merkt die Antwort, damit nicht jede Seite mehrfach /api/me ruft. */
export async function me(): Promise<Me> {
    if (!zwischenspeicher) {
        zwischenspeicher = await api<Me>("/api/me");
    }
    return zwischenspeicher;
}

export function vergissMe(): void {
    zwischenspeicher = null;
}

// Wechselt die Anmeldung, ist die gemerkte Antwort ungueltig
beiAnmeldungsWechsel(vergissMe);

/* Personal-Ansicht ohne Login-Aufblitzen aufbauen: liegt eine Anmeldung vor,
   wird sofort losgelegt und im Hintergrund geprueft. Gilt sie nicht mehr,
   wird sie verworfen und die Seite neu geladen - erst dann erscheint die
   Anmeldemaske. */
export async function sichereAnmeldung(
    beiBereit: () => void,
    beiLogin: () => void
): Promise<void> {
    if (!hatAnmeldung()) { beiLogin(); return; }
    beiBereit();
    try {
        await me();
    } catch (fehler) {
        const status = (fehler as { status?: number }).status;
        if (status === 401 || status === 403) {
            loescheAnmeldung();
            location.reload();
        }
    }
}
