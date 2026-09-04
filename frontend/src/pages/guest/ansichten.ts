/* Ansichten der Gaeste-Seite: welche der sieben Ansichten sichtbar ist,
 * Kopfzeile (Titel, Tischmarke), Namensleiste, Freigabe-Knoepfe, Inhalt der
 * Fehler-Ansicht und der Wartehinweis in view-menu.
 *
 * Reine Anzeige: jede Funktion bekommt, was sie zeigen soll, als Parameter -
 * aktuelleAnsicht/genehmigt/istGastgeber/meinName/tischNummer/restaurantName
 * bleiben Zustand von index.ts. Einzige Ausnahme ist wartehinweisElement
 * (lazy angelegtes Element fuer zeigeWartehinweis): reiner Anzeigezustand
 * dieses Moduls, wird nirgendwo sonst gebraucht.
 *
 * Kennt NICHT die Warenkorb-Leiste (cartbar): die haengt vom Warenkorb-Inhalt
 * ab, nicht nur von Ansicht/Session, und bleibt darum bei index.ts - ebenso
 * das eigentliche Umschalten (index.ts' zeigeAnsicht ruft zeigeAnsichtInhalt
 * hier auf und aktualisiert danach selbst die Warenkorb-Leiste). */

import { el, tischmarke, zeigeNur } from "../../lib/ui";

export const ANSICHTEN = ["view-wait", "view-error", "view-menu", "view-cart", "view-orders", "view-bill", "view-name"] as const;
export type Ansicht = (typeof ANSICHTEN)[number];

const NAME_BAR_ANSICHTEN: readonly Ansicht[] = ["view-menu", "view-cart", "view-orders", "view-bill"];
const TITEL: Partial<Record<Ansicht, string>> = {
    "view-menu": "Speisekarte",
    "view-cart": "Warenkorb",
    "view-orders": "Deine Bestellungen",
    "view-bill": "Rechnung teilen",
    "view-name": "Wie heißt du?"
};

/** Blendet die Ansicht `id` ein (alle anderen aus), setzt Kopftitel und
 *  Sichtbarkeit der Namensleiste. */
export function zeigeAnsichtInhalt(id: Ansicht, restaurantName: string): void {
    zeigeNur(id, ANSICHTEN);

    const titel = document.getElementById("page-title");
    if (titel) titel.textContent = TITEL[id] ?? (restaurantName || "Willkommen!");

    const nameLeiste = document.getElementById("name-bar");
    if (nameLeiste) nameLeiste.hidden = !NAME_BAR_ANSICHTEN.includes(id);

    // Kategorien-Sprungnav in der Kopfzeile (menu.ts befuellt sie, hier nur
    // sichtbar/unsichtbar je Ansicht) - nur auf der Speisekarte UND nur,
    // wenn ueberhaupt eine Leiste/ein Hamburger-Knopf drinsteckt (weniger
    // als 2 Kategorien: menu.ts laesst den Container dann leer).
    const topbarKategorien = document.getElementById("topbar-kategorien");
    if (topbarKategorien) {
        topbarKategorien.hidden = !(id === "view-menu" && topbarKategorien.childElementCount > 0);
    }
}

/** Fuellt nur den INHALT von view-error - das Umschalten dorthin bleibt bei
 *  index.ts' zeigeFehler(), das danach seinerseits zeigeAnsicht() aufruft. */
export function fuelleFehlerAnsicht(titel: string, text: string): void {
    const titelFeld = document.getElementById("error-title");
    const textFeld = document.getElementById("error-text");
    if (titelFeld) titelFeld.textContent = titel;
    if (textFeld) textFeld.textContent = text;
    const banner = document.getElementById("join-banner");
    if (banner) banner.hidden = true;
}

/** Tischmarke im Kopf. `wartet` steuert den Zustand: solange der Tisch auf
 *  Freigabe wartet, atmet die Marke (`.ox-tischmarke--wartet`); beim Uebergang
 *  wartet -> frei kommt einmalig `.ox-tischmarke--frei` (Schnapp-Animation)
 *  dazu. Der Marken-Knoten wird EINMAL ueber tischmarke() aus lib/ui.ts
 *  gebaut (fuehrende Null steckt dort - hier NICHT dupliziert) und danach nur
 *  noch um Klassen ergaenzt. */
export function aktualisiereTischmarke(tischNummer: number, wartet: boolean): void {
    const badge = document.getElementById("table-badge");
    if (!badge) return;
    let marke = badge.querySelector<HTMLElement>(".ox-tischmarke");
    if (!marke) {
        badge.textContent = "";
        marke = tischmarke(tischNummer);
        badge.appendChild(marke);
    }
    marke.classList.toggle("ox-tischmarke--wartet", wartet);
    if (!wartet) marke.classList.add("ox-tischmarke--frei");
}

/** "Kellner rufen"/"Rechnung teilen" sind erst nach Freigabe sinnvoll -
 *  bleiben bis dahin hidden (Ausgangszustand in guest.html). */
export function aktualisiereFreigabeKnoepfe(genehmigt: boolean): void {
    const anruf = document.getElementById("btn-call");
    if (anruf) anruf.hidden = !genehmigt;
    const rechnung = document.getElementById("btn-bill");
    if (rechnung) rechnung.hidden = !genehmigt;
}

export function aktualisiereNameAnzeige(meinName: string): void {
    const feld = document.getElementById("my-name");
    if (feld) feld.textContent = meinName;
}

let wartehinweisElement: HTMLParagraphElement | null = null;

/** Persistenter Hinweis oben in view-menu, solange nicht genehmigt. Wird
 *  EINMAL lazy angelegt (Text haengt vom Gastgeber-Status ab, der sich fuer
 *  eine Person nie aendert) und danach nur ein-/ausgeblendet - kein
 *  erneutes Zeichnen der Speisekarte darunter, siehe menu.ts. */
export function zeigeWartehinweis(sichtbar: boolean, istGastgeber: boolean): void {
    const menu = document.getElementById("view-menu");
    if (!menu) return;
    if (!wartehinweisElement) {
        wartehinweisElement = el("p", "ox-muted");
        wartehinweisElement.textContent = istGastgeber
            ? "Dein Tisch wird gleich freigegeben – bestellen kannst du, sobald es so weit ist."
            : "Der Gastgeber lässt dich gleich rein – bestellen kannst du, sobald es so weit ist.";
        menu.insertBefore(wartehinweisElement, menu.firstChild);
    }
    wartehinweisElement.hidden = !sichtbar;
}
