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

/* ---------- Fortschritts-Schiene ----------
   Der Chip sagt, WO die Bestellung steht. Die Schiene zeigt, WIE WEIT sie
   ist - die haeufigste Frage am Tisch ("wie lange noch?") beantwortet keine
   Statusbezeichnung, sondern der zurueckgelegte Weg. Drei Abschnitte:
   angenommen, in der Kueche, fertig.

   Bewusst ohne eigene Beschriftung und aria-hidden: den lesbaren Status
   traegt bereits der Chip daneben: zwei Ansagen fuer denselben Sachverhalt
   waeren fuer Screenreader nur Laerm. Stornierte Bestellungen bekommen gar
   keine Schiene - sie haben keinen Weg mehr vor sich. */

const ABSCHNITTE = 3;

/** Wie viele der drei Abschnitte erreicht sind. CANCELLED liefert 0 und
 *  bekommt (siehe baueFortschritt) gar keine Schiene. */
function erreichteAbschnitte(status: BestellStatus): number {
    switch (status) {
        case "NEW": return 1;
        case "IN_PREPARATION": return 2;
        case "READY":
        case "SERVED": return ABSCHNITTE;
        default: return 0;
    }
}

function baueFortschritt(status: BestellStatus): HTMLElement | null {
    if (status === "CANCELLED") return null;
    const schiene = el("div", "ox-fortschritt");
    schiene.setAttribute("aria-hidden", "true");
    for (let i = 0; i < ABSCHNITTE; i++) schiene.appendChild(el("span", "ox-fortschritt__abschnitt"));
    setzeFortschritt(schiene, status);
    return schiene;
}

/** Schaltet die Abschnitte um, ohne sie neu zu bauen - nur so kann der
 *  CSS-Uebergang auf .ox-fortschritt__abschnitt den Farbwechsel zeigen
 *  (gleiche Ueberlegung wie beim Chip, siehe aktualisiereBestellKarte). */
function setzeFortschritt(schiene: HTMLElement, status: BestellStatus): void {
    const erreicht = erreichteAbschnitte(status);
    schiene.querySelectorAll<HTMLElement>(".ox-fortschritt__abschnitt")
        .forEach((abschnitt, index) => abschnitt.classList.toggle("is-voll", index < erreicht));
}

/** Zeichnet alle Bestellungen in `ziel`. Sortiert IMMER selbst neueste
 *  zuerst - verlaesst sich nicht auf die Reihenfolge des Aufrufers oder des
 *  Backends. Stornierte Bestellungen werden einzeln angezeigt (mit
 *  erkennbarem Chip), zaehlen aber nicht in die Gesamtsumme oben - sie
 *  wurden nicht geliefert und nicht berechnet.
 *
 *  Bei erneutem Aufruf (die Statusabfrage taktet alle 3 s, siehe index.ts)
 *  wird eine BESTEHENDE Karte in place aktualisiert - Chip-Klasse/-Text und
 *  Positionen - statt neu gebaut. Nur so kann der CSS-`transition` auf
 *  `.ox-chip` (components.css) den Farb-Morph zeigen, wenn der Status
 *  fortschreitet. Neue Karten entstehen wie bisher; Karten zu nicht mehr
 *  gelieferten Bestellungen werden entfernt. Jede Karte traegt dafuer
 *  `data-bestellung-id`. */
export function zeichneBestellungen(bestellungen: Bestellung[], ziel: HTMLElement): void {
    const sortiert = [...bestellungen].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    if (sortiert.length === 0) {
        ziel.textContent = "";
        ziel.appendChild(el("p", "ox-muted", "Noch keine Bestellungen."));
        return;
    }

    // Gesamtzeile immer neu bauen (billig, kein Zustand) und an Ort und
    // Stelle ersetzen bzw. voranstellen.
    const vorhandeneGesamt = ziel.querySelector(".ox-bestellungen__gesamt");
    const neueGesamt = baueGesamtzeile(sortiert);
    if (vorhandeneGesamt) vorhandeneGesamt.replaceWith(neueGesamt);
    else ziel.prepend(neueGesamt);

    for (const bestellung of sortiert) {
        const vorhanden = ziel.querySelector<HTMLElement>(`[data-bestellung-id="${bestellung.id}"]`);
        if (vorhanden) aktualisiereBestellKarte(vorhanden, bestellung);
        else ziel.appendChild(baueBestellKarte(bestellung));
    }

    // Reihenfolge (neueste zuerst) auch beim Re-Render halten: bestehende
    // Karten werden nur VERSCHOBEN (appendChild bewegt den Knoten), nicht
    // neu gebaut - Knoten-Identitaet und CSS-Uebergang bleiben erhalten.
    for (const bestellung of sortiert) {
        const karte = ziel.querySelector<HTMLElement>(`[data-bestellung-id="${bestellung.id}"]`);
        if (karte) ziel.appendChild(karte);
    }

    // Karten entfernter Bestellungen (selten) raeumen.
    const ids = new Set(sortiert.map((b) => String(b.id)));
    ziel.querySelectorAll<HTMLElement>("[data-bestellung-id]").forEach((karte) => {
        if (!ids.has(karte.dataset.bestellungId ?? "")) karte.remove();
    });
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
 *  .ox-preis, darunter die Positionen"). Die Karte traegt `data-bestellung-id`,
 *  damit ein spaeterer Aufruf sie wiederfindet und in place aktualisiert. */
function baueBestellKarte(bestellung: Bestellung): HTMLElement {
    const karte = el("article", "ox-card");
    karte.dataset.bestellungId = String(bestellung.id);

    const kopf = el("div", "ox-row");
    kopf.append(
        el("strong", undefined, `Bestellung #${bestellung.id}`),
        baueChip(bestellung.status),
        el("span", "ox-spacer"),
        el("span", "ox-zeit", zeit(bestellung.createdAt)),
        el("strong", "ox-preis", preis(bestellung.totalAmount))
    );
    karte.appendChild(kopf);
    const schiene = baueFortschritt(bestellung.status);
    if (schiene) karte.appendChild(schiene);
    karte.appendChild(bauePositionen(bestellung));

    return karte;
}

/** Aktualisiert eine bereits gezeichnete Karte in place: derselbe Chip-Knoten
 *  wechselt Klasse und Text (CSS-`transition` macht daraus einen Farb-Morph),
 *  die Positionsliste wird ersetzt. Nummer/Uhrzeit/Summe aendern sich fuer
 *  eine bestehende Bestellung nicht und bleiben unangetastet. */
function aktualisiereBestellKarte(karte: HTMLElement, bestellung: Bestellung): void {
    const chip = karte.querySelector<HTMLElement>(".ox-chip");
    if (chip) fuelleChip(chip, bestellung.status);

    // Schiene: vorhandene umschalten (Farbuebergang), bei einem Storno
    // entfernen - eine stornierte Bestellung hat keinen Weg mehr vor sich.
    const schiene = karte.querySelector<HTMLElement>(".ox-fortschritt");
    if (bestellung.status === "CANCELLED") {
        schiene?.remove();
    } else if (schiene) {
        setzeFortschritt(schiene, bestellung.status);
    } else {
        const neueSchiene = baueFortschritt(bestellung.status);
        // Zwischen Kopfzeile und Positionsliste, wie beim Neubau.
        if (neueSchiene) karte.querySelector(".ox-list")?.before(neueSchiene);
    }

    const alteListe = karte.querySelector(".ox-list");
    if (alteListe) alteListe.replaceWith(bauePositionen(bestellung));
}

/** Neuer Chip als eigenes Element mit stabiler Basisklasse `.ox-chip`. */
function baueChip(status: BestellStatus): HTMLElement {
    const chip = el("span");
    fuelleChip(chip, status);
    return chip;
}

/** Belegt einen Chip (neu oder bestehend) mit Klasse und Text zum Status.
 *  Fuer IN_PREPARATION kommt ein leerer `<span class="ox-chip__punkt">` als
 *  erstes Kind hinzu (blinkt per CSS, guest-motion.css) - er traegt keinen
 *  Text, `textContent` des Chips bleibt also der reine Statustext. */
function fuelleChip(chip: HTMLElement, status: BestellStatus): void {
    chip.className = statusKlasse(status);
    chip.textContent = statusText(status);
    if (status === "IN_PREPARATION") {
        chip.insertBefore(el("span", "ox-chip__punkt"), chip.firstChild);
    }
}

function bauePositionen(bestellung: Bestellung): HTMLElement {
    const positionen = el("ul", "ox-list");
    for (const position of bestellung.items) {
        const eintrag = el("li");
        eintrag.appendChild(el("span", undefined, `${position.quantity}× ${position.name}`));
        if (position.note) eintrag.appendChild(el("span", "ox-muted", ` (${position.note})`));
        positionen.appendChild(eintrag);
    }
    return positionen;
}
