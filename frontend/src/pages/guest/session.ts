/* Sitzungs-Logik der Gaeste-Seite: Scan, Status, Beitritt, Name.
 *
 * Tisch und Person haben je einen EIGENEN Status (sessionStatus / guestStatus):
 * der Tisch wird vom Personal freigegeben, jede weitere Person am Tisch vom
 * Gastgeber (der ersten Person, siehe TableSessionService.scan()). Beide
 * Staende aendern sich UNABHAENGIG voneinander und muessen darum als
 * vollstaendiges Objekt weitergereicht werden - ein einzelnes
 * "freigegeben ja/nein"-Flag wuerde fachlich verschiedene Faelle verschlucken:
 *
 *   guestStatus   sessionStatus   Bedeutung
 *   -----------   -------------   --------------------------------------------
 *   REJECTED      beliebig        Diese Person wurde abgelehnt (vom Personal,
 *                                 wenn sie Gastgeber ist; sonst vom Gastgeber).
 *   ungleich       REJECTED        Der ganze Tisch wurde vom Personal abgelehnt
 *   REJECTED                       (TableSessionService.reject() lehnt danach
 *                                   zwar auch alle Gaeste einzeln ab, aber die
 *                                   Reihenfolge der Prüfung - erst guestStatus,
 *                                   dann sessionStatus - entscheidet, welche
 *                                   Meldung ein Beitretender sieht).
 *   ungleich       EXPIRED         Freigabe-Anfrage verfallen, niemand hat
 *                                   geantwortet. TableSessionService.
 *   REJECTED                       expireStalePendingSessions() aendert NUR
 *                                   session.status, nie die Guest-Zeilen -
 *                                   guestStatus bleibt also PENDING.
 *   ungleich       CLOSED          Sitzung regulaer beendet (Gaeste haben
 *   REJECTED                       bezahlt/sind gegangen). TableSessionService.
 *                                   close() aendert ebenfalls nur die Sitzung,
 *                                   guestStatus bleibt APPROVED.
 *   APPROVED       APPROVED        Normalfall: darf bestellen.
 *   PENDING        PENDING/APPROVED Wartet noch (auf Laden- bzw. Gastgeber-
 *                                   Freigabe).
 *
 * Wer diese Datei aufruft (index.ts), muss also guestStatus UND sessionStatus
 * einzeln auswerten. starteStatusAbfrage() meldet deshalb bei jeder Aenderung
 * irgendeines Feldes - nie nur, wenn ein abgeleitetes "genehmigt"-Flag kippt.
 *
 * Die Ablauf-Verbesserung gegenueber der alten Fassung (frontend/public/js/guest.js):
 * die Speisekarte ist schon direkt nach dem Scan sichtbar und durchblaetterbar,
 * nicht erst nach der Freigabe. Das funktioniert ohne Backend-Aenderung, weil
 * ScanResponse.restaurantId schon bei sessionStatus=PENDING gefuellt ist -
 * TableSessionService.scan() liest restaurantId aus der Tisch-Entity, BEVOR
 * es nach Sitzungsstatus verzweigt, und reicht es in allen drei Zweigen
 * (Beitritt zu freigegebener Sitzung, Beitritt zu wartender Sitzung, neue
 * Anfrage als Gastgeber) unveraendert an ScanResponse weiter. GET
 * /api/guest/menu/{restaurantId} kann also sofort geladen werden.
 *
 * Dieses Modul liefert nur Daten und Rueckrufe, keine DOM-Zugriffe - mit einer
 * Ausnahme: die Sichtbarkeits-Erkennung (visibilitychange) haengt zwangslaeufig
 * an document. Ansichten/Texte entscheidet spaeter index.ts. */

import { api } from "../../lib/api";
import type { BeitrittsAnfrage, GastStatusAntwort, ScanAntwort } from "../../lib/types";

/** Takt der Statusabfrage - identisch zur alten Fassung (guest.js, pollTimer).
 *  Nicht aendern, das Backend ist darauf ausgelegt. */
const STANDARD_TAKT_MS = 3000;

/** QR-Token aus dem Pfad (/t/<token>) lesen, im Entwicklungsbetrieb ersatzweise
 *  aus dem Query-Parameter ?t=. Leerer String, wenn beides fehlt. */
export function leseQrToken(): string {
    const pfad = location.pathname;
    if (pfad.startsWith("/t/")) {
        return decodeURIComponent(pfad.split("/")[2] || "");
    }
    return new URLSearchParams(location.search).get("t") || "";
}

/** Legt eine neue Person am Tisch an. Die erste Person wird zum Gastgeber,
 *  jede weitere muss vom Gastgeber freigegeben werden (siehe Dateikopf). */
export function scanne(qrToken: string): Promise<ScanAntwort> {
    return api<ScanAntwort>(`/api/guest/scan/${encodeURIComponent(qrToken)}`, { method: "POST" });
}

/** Aktueller Status dieser Person UND ihres Tisches. */
export function holeStatus(guestToken: string): Promise<GastStatusAntwort> {
    return api<GastStatusAntwort>(`/api/guest/guests/${encodeURIComponent(guestToken)}`);
}

/** Anzeigenamen setzen/aendern. Kann schon waehrend des Wartens auf Freigabe
 *  aufgerufen werden - die Namenspflicht bleibt fachlich bestehen, sie rueckt
 *  nur zeitlich vor (siehe Dateikopf). */
export async function setzeName(guestToken: string, name: string): Promise<void> {
    await api(`/api/guest/guests/${encodeURIComponent(guestToken)}/name`, {
        method: "PUT",
        body: JSON.stringify({ name })
    });
}

/** Offene Beitritts-Anfragen - fachlich nur fuer den freigegebenen Gastgeber
 *  relevant (das Backend liefert sonst ohnehin eine leere Liste). */
export function holeBeitrittsAnfragen(guestToken: string): Promise<BeitrittsAnfrage[]> {
    return api<BeitrittsAnfrage[]>(`/api/guest/guests/${encodeURIComponent(guestToken)}/join-requests`);
}

/** Gastgeber laesst eine weitere Person an den Tisch oder lehnt sie ab. */
export async function entscheideBeitritt(
    guestToken: string,
    joinerId: number,
    aktion: "approve" | "reject"
): Promise<void> {
    await api(
        `/api/guest/guests/${encodeURIComponent(guestToken)}/join-requests/${joinerId}/${aktion}`,
        { method: "POST" }
    );
}

/** "Kellner rufen" - meldet dem Personal, dass der Tisch etwas braucht. */
export async function rufeKellner(guestToken: string): Promise<void> {
    await api(`/api/guest/guests/${encodeURIComponent(guestToken)}/call`, { method: "POST" });
}

/** true, wenn beide Antworten fachlich gleich sind. Vergleicht ALLE Felder
 *  einzeln statt eines abgeleiteten "freigegeben"-Flags - siehe Dateikopf:
 *  sessionStatus und guestStatus koennen sich unabhaengig voneinander aendern,
 *  und beide Aenderungen muessen gemeldet werden. */
function gleicherStatus(a: GastStatusAntwort, b: GastStatusAntwort): boolean {
    return a.guestStatus === b.guestStatus
        && a.sessionStatus === b.sessionStatus
        && a.isHost === b.isHost
        && a.name === b.name
        && a.tableNumber === b.tableNumber
        && a.restaurantId === b.restaurantId
        && a.restaurantName === b.restaurantName;
}

/** Fragt im festen Takt den Status ab und meldet NUR eine tatsaechliche
 *  Aenderung ueber beiAenderung (der allererste Abruf zaehlt immer als
 *  Aenderung, es gibt ja noch keinen Vergleichswert). Pausiert, solange die
 *  Seite im Hintergrund liegt (visibilitychange), und laeuft danach im
 *  selben Takt weiter - spart Akku am Gaestehandy, neu gegenueber der alten
 *  Fassung. stop() beendet Zeitgeber und Ereignis-Anmeldung wirklich. */
export function starteStatusAbfrage(
    guestToken: string,
    beiAenderung: (status: GastStatusAntwort) => void,
    intervallMs: number = STANDARD_TAKT_MS
): { stop(): void } {
    let zeitgeber: ReturnType<typeof setTimeout> | null = null;
    let angehalten = false;
    let gestoppt = false;
    let letzterStatus: GastStatusAntwort | null = null;

    function planeNaechstenTakt(): void {
        if (gestoppt || angehalten) return;
        zeitgeber = setTimeout(tick, intervallMs);
    }

    async function tick(): Promise<void> {
        zeitgeber = null;
        try {
            const aktuell = await holeStatus(guestToken);
            if (gestoppt) return; // stop() kam waehrend die Anfrage noch offen war
            if (!letzterStatus || !gleicherStatus(letzterStatus, aktuell)) {
                letzterStatus = aktuell;
                beiAenderung(aktuell);
            }
        } catch {
            // Netzwerk-Aussetzer: naechster Takt versucht es erneut, wie in der alten Fassung.
        }
        planeNaechstenTakt();
    }

    function beiSichtbarkeitswechsel(): void {
        if (document.hidden) {
            if (angehalten) return;
            angehalten = true;
            if (zeitgeber !== null) {
                clearTimeout(zeitgeber);
                zeitgeber = null;
            }
        } else if (angehalten) {
            angehalten = false;
            planeNaechstenTakt();
        }
    }

    document.addEventListener("visibilitychange", beiSichtbarkeitswechsel);
    planeNaechstenTakt();

    return {
        stop(): void {
            gestoppt = true;
            if (zeitgeber !== null) {
                clearTimeout(zeitgeber);
                zeitgeber = null;
            }
            document.removeEventListener("visibilitychange", beiSichtbarkeitswechsel);
        }
    };
}

/* ---------- Gemerkter Gast-Token pro QR-Code (localStorage) ---------- */

function schluessel(qrToken: string): string {
    return `ox-guest-${qrToken}`;
}

/** Merkt den guestToken zu diesem QR-Code, damit ein Neuladen dieselbe Person
 *  fortsetzt statt eine neue anzulegen. */
export function merkeToken(qrToken: string, guestToken: string): void {
    try {
        localStorage.setItem(schluessel(qrToken), guestToken);
    } catch {
        /* privater Modus o.ae. - dann faengt der naechste Aufruf neu mit scanne() an */
    }
}

/** Gemerkten guestToken zu diesem QR-Code lesen, oder null. Zwei verschiedene
 *  QR-Codes (= zwei verschiedene Tische) teilen sich nie denselben Eintrag,
 *  weil der QR-Token Teil des Schluessels ist. */
export function geleseneToken(qrToken: string): string | null {
    try {
        return localStorage.getItem(schluessel(qrToken));
    } catch {
        return null;
    }
}
