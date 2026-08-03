/* Live-Daten-Takt der Gaeste-Seite: EIN eigener, schlanker Zeitgeber fuer
 * Beitritts-Anfragen und Bestell-Status (siehe index.ts, Dateikopf) - bewusst
 * getrennt von session.ts' starteStatusAbfrage(), die bleibt die einzige
 * Quelle fuer Freigabe/Ablehnung. Nur aktiv, waehrend genehmigt === true, und
 * nur EINER (nicht zwei getrennte Takte fuer Beitritt/Bestellungen).
 *
 * Derselbe Takt-Wert wie session.ts' (dort private) STANDARD_TAKT_MS - siehe
 * index.ts, Dateikopf, fuer die Begruendung.
 *
 * istGastgeber/aktuelleAnsicht kommen als RUECKRUFE, nicht als einmalig
 * uebergebener Wert: der Tick feuert zeitversetzt, moeglicherweise lange nach
 * dem Start dieses Takts, und muss darum bei JEDEM Tick den JEWEILS
 * aktuellen Stand aus index.ts sehen (z.B. ob der Gast inzwischen auf
 * view-orders gewechselt hat oder Gastgeber wurde). */

import type { Ansicht } from "./ansichten";

const LIVE_TAKT_MS = 3000;

export interface LiveDatenAbhaengigkeiten {
    istGastgeber(): boolean;
    aktuelleAnsicht(): Ansicht;
    aktualisiereBeitrittsAnfragen(): Promise<void>;
    aktualisiereBestellungen(): Promise<void>;
}

/** Liefert ein Steuerobjekt (Muster wie session.ts' starteStatusAbfrage()):
 *  aktualisiere() bei jeder Statusaenderung aufrufen - startet den Takt beim
 *  Wechsel zu genehmigt, stoppt ihn beim Wechsel weg davon. stoppe() bei
 *  einem Endzustand (siehe index.ts, beendeMitFehler). */
export function starteLiveDatenTakt(
    abhaengigkeiten: LiveDatenAbhaengigkeiten
): { aktualisiere(genehmigt: boolean): void; stoppe(): void } {
    let aktiv = false;
    let zeitgeber: ReturnType<typeof setTimeout> | null = null;

    function planeTick(): void {
        zeitgeber = setTimeout(() => {
            void (async () => {
                if (!document.hidden) {
                    if (abhaengigkeiten.istGastgeber()) await abhaengigkeiten.aktualisiereBeitrittsAnfragen();
                    if (abhaengigkeiten.aktuelleAnsicht() === "view-orders") await abhaengigkeiten.aktualisiereBestellungen();
                }
                if (aktiv) planeTick();
            })();
        }, LIVE_TAKT_MS);
    }

    return {
        aktualisiere(genehmigt: boolean): void {
            if (genehmigt && !aktiv) {
                aktiv = true;
                if (abhaengigkeiten.istGastgeber()) void abhaengigkeiten.aktualisiereBeitrittsAnfragen();
                planeTick();
            } else if (!genehmigt && aktiv) {
                aktiv = false;
                if (zeitgeber !== null) {
                    clearTimeout(zeitgeber);
                    zeitgeber = null;
                }
            }
        },
        stoppe(): void {
            aktiv = false;
            if (zeitgeber !== null) {
                clearTimeout(zeitgeber);
                zeitgeber = null;
            }
        }
    };
}
