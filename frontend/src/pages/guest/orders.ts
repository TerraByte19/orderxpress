/* Bestell-Status fuer den Gast - die zweite Ablauf-Verbesserung des Plans:
 * heute erfaehrt der Gast nach dem Absenden gar nichts mehr ueber seine
 * Bestellung. Neu zeigt eine Karte je Bestellung einen Status-Chip
 * (Angenommen -> In der Kueche -> Fertig -> Serviert, oder Storniert),
 * dazu Uhrzeit, Summe und die Positionen.
 *
 * KEINE Backend-Aenderung noetig: GET /api/guest/guests/{token}/orders
 * liefert OrderResponse bereits inklusive status (siehe Bericht fuer den
 * genauen Beleg im Java-Code). KEIN zweiter Abfrage-Takt: der Aufruf
 * haengt sich an die BESTEHENDE Statusabfrage aus session.ts
 * (starteStatusAbfrage, 3000 ms) - dieses Modul startet selbst keinen
 * eigenen Zeitgeber.
 *
 * NEW und SERVED sind laut Vorgabe beide "neutral", muessen aber
 * unterscheidbar bleiben (SERVED zusaetzlich "gedaempft" - eine servierte
 * Bestellung ist erledigt und tritt optisch zurueck). components.css deckt
 * mit .ox-chip nur gut/warn/gefahr/akzent ab; die gedaempfte Variante fehlt
 * dort und wird darum in guest.css ergaenzt (siehe dort). */

import { api } from "../../lib/api";
import { preis, zeit } from "../../lib/format";
import { el } from "../../lib/ui";
import type { Bestellung, BestellStatus } from "../../lib/types";

export function holeMeineBestellungen(guestToken: string): Promise<Bestellung[]> {
    return api<Bestellung[]>(`/api/guest/guests/${encodeURIComponent(guestToken)}/orders`);
}

const STATUS_TEXT: Record<BestellStatus, string> = {
    NEW: "Angenommen",
    IN_PREPARATION: "In der Küche",
    READY: "Fertig",
    SERVED: "Serviert",
    CANCELLED: "Storniert"
};

export function statusText(status: BestellStatus): string {
    return STATUS_TEXT[status];
}

/** Volle Klassenliste des Chips (inkl. Basisklasse "ox-chip") - direkt als
 *  className zuweisbar, analog zu toast() in lib/ui.ts. NEW bleibt bewusst
 *  ohne Zusatzklasse (neutrale Basisoptik), SERVED bekommt trotz gleicher
 *  Signalfarbe eine ZUSAETZLICHE Klasse, damit beide unterscheidbar bleiben. */
const STATUS_KLASSE: Record<BestellStatus, string> = {
    NEW: "ox-chip",
    IN_PREPARATION: "ox-chip ox-chip--warn",
    READY: "ox-chip ox-chip--gut",
    SERVED: "ox-chip ox-chip--gedaempft",
    CANCELLED: "ox-chip ox-chip--gefahr"
};

export function statusKlasse(status: BestellStatus): string {
    return STATUS_KLASSE[status];
}

/** Zeichnet alle Bestellungen in `ziel` (wird vorher geleert). Sortiert
 *  IMMER selbst neueste zuerst - verlaesst sich nicht auf die Reihenfolge
 *  des Aufrufers oder des Backends. Stornierte Bestellungen werden einzeln
 *  angezeigt (mit erkennbarem Chip), zaehlen aber nicht in die
 *  Gesamtsumme oben - sie wurden nicht geliefert und nicht berechnet. */
export function zeichneBestellungen(bestellungen: Bestellung[], ziel: HTMLElement): void {
    ziel.textContent = "";

    if (bestellungen.length === 0) {
        ziel.appendChild(el("p", "ox-muted", "Noch keine Bestellungen."));
        return;
    }

    const sortiert = [...bestellungen].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    ziel.appendChild(baueGesamtzeile(sortiert));
    for (const bestellung of sortiert) ziel.appendChild(baueBestellKarte(bestellung));
}

function baueGesamtzeile(bestellungen: Bestellung[]): HTMLElement {
    const gesamt = bestellungen
        .filter((b) => b.status !== "CANCELLED")
        .reduce((summe, b) => summe + b.totalAmount, 0);

    const zeile = el("div", "ox-row ox-bestellungen__gesamt");
    zeile.append(
        el("span", "ox-muted", "Bisher bestellt"),
        el("span", "ox-spacer"),
        el("strong", "ox-preis", preis(gesamt))
    );
    return zeile;
}

/** Kopf mit Nummer/Status/Uhrzeit/Summe, darunter die Positionen - siehe
 *  Dateikopf und Aufgabenstellung ("Uhrzeit ueber .ox-zeit, Summe ueber
 *  .ox-preis, darunter die Positionen"). */
function baueBestellKarte(bestellung: Bestellung): HTMLElement {
    const karte = el("article", "ox-card");

    const kopf = el("div", "ox-row");
    kopf.append(
        el("strong", undefined, `Bestellung #${bestellung.id}`),
        el("span", statusKlasse(bestellung.status), statusText(bestellung.status)),
        el("span", "ox-spacer"),
        el("span", "ox-zeit", zeit(bestellung.createdAt)),
        el("strong", "ox-preis", preis(bestellung.totalAmount))
    );
    karte.appendChild(kopf);

    const positionen = el("ul", "ox-list");
    for (const position of bestellung.items) {
        const eintrag = el("li");
        eintrag.appendChild(el("span", undefined, `${position.quantity}× ${position.name}`));
        if (position.note) eintrag.appendChild(el("span", "ox-muted", ` (${position.note})`));
        positionen.appendChild(eintrag);
    }
    karte.appendChild(positionen);

    return karte;
}
