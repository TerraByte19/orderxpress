/* Geteilte Rechnung der Gaeste-Seite: der Gast SIEHT hier nur und waehlt
 * Positionen an, um seine EIGENE Summe zu erkennen ("was zahle ich?").
 * Kassiert wird an der Kasse - die Auswahl wird NIE ans Backend geschickt
 * (siehe Aufgabenstellung/Plan-Kopf, Abschnitt "Was die Seite fachlich tut").
 *
 * Fachliche Referenz: frontend/public/js/guest.js, Zeilen 580-689
 * (showBill/toggleBillLine/updateBillSum/clearBillSelection). Uebernommenes
 * Verhalten: Auswahl je Position, personenuebergreifende Summe ueber alle
 * ausgewaehlten Positionen, "offen" je Person. NEU strukturiert: die alte
 * Fassung hielt die Auswahl in einem rohen Objekt (this.billSelected) UND
 * manipulierte das DOM an derselben Stelle direkt - hier ist die Auswahl
 * eine eigene, DOM-freie Klasse (Auswahl, analog zu Warenkorb in cart.ts),
 * damit sie fuer sich allein getestet werden kann.
 *
 * WICHTIGSTER PUNKT (Aufgabenstellung): bereits BEZAHLTE Positionen sind
 * nicht auswaehlbar. baueZeile() haengt fuer bezahlte Positionen gar KEINEN
 * Ereignis-Handler an (nicht nur "disabled") - ein Klick kann
 * Auswahl.umschalten() so unter keinen Umstaenden erreichen, unabhaengig
 * davon, ob eine Umgebung "disabled" beim Klick tatsaechlich respektiert.
 * Zusaetzlich macht ein eigener Chip "bezahlt" den Zustand deutlich sichtbar.
 *
 * ZWEITER PUNKT: Auswahl.leeren() muss die ANZEIGE mitzuruecksetzen (siehe
 * guest.html: der Knopf "Auswahl leeren" ausserhalb von #bill-container
 * ruft spaeter genau das auf). Auswahl kennt selbst kein DOM, bekommt aber
 * im Konstruktor einen Rueckruf, der bei JEDER Aenderung feuert - umschalten()
 * UND leeren() gleichermassen. zeichneRechnung() nutzt genau diesen Rueckruf,
 * um die Kontrollkaestchen synchron zum Zustand zu halten UND den Aufrufer
 * (spaeter index.ts, das darueber #bill-selected aktualisiert) zu
 * benachrichtigen - auch schon einmal sofort nach dem ersten Zeichnen, damit
 * der "Auswahl leeren"-Knopf verdrahtet werden kann, bevor der Gast
 * ueberhaupt etwas antippt. */

import { api } from "../../lib/api";
import { preis } from "../../lib/format";
import { el } from "../../lib/ui";
import type { Rechnung, RechnungsPerson, RechnungsZeile } from "../../lib/types";

export function holeRechnung(guestToken: string): Promise<Rechnung> {
    return api<Rechnung>(`/api/guest/guests/${encodeURIComponent(guestToken)}/bill`);
}

/** Reine Zustandsklasse (kein DOM-Zugriff, analog zu Warenkorb in cart.ts):
 *  haelt NUR, welche Positionen der Gast gerade angetippt hat, und ihre
 *  Betraege - personenuebergreifend, Auswahl kennt keine Personen, nur
 *  orderItemId -> Betrag. Wird NIRGENDS ans Backend geschickt. */
export class Auswahl {
    private readonly zeilen = new Map<number, number>();

    /** beiAenderung feuert bei JEDER Aenderung (umschalten UND leeren) -
     *  siehe Dateikopf. Ohne Angabe ein No-Op, damit Auswahl auch ganz ohne
     *  DOM instanziiert und getestet werden kann. */
    constructor(private readonly beiAenderung: () => void = () => {}) {}

    /** Waehlt eine Position an- oder ab (echtes Umschalten). */
    umschalten(orderItemId: number, betrag: number): void {
        if (this.zeilen.has(orderItemId)) this.zeilen.delete(orderItemId);
        else this.zeilen.set(orderItemId, betrag);
        this.beiAenderung();
    }

    enthaelt(orderItemId: number): boolean {
        return this.zeilen.has(orderItemId);
    }

    /** Summe ueber ALLE ausgewaehlten Positionen. */
    summe(): number {
        let summe = 0;
        for (const betrag of this.zeilen.values()) summe += betrag;
        return summe;
    }

    /** Setzt die Auswahl vollstaendig zurueck - loest beiAenderung() aus,
     *  damit auch eine bereits gezeichnete Anzeige zurueckspringt. */
    leeren(): void {
        this.zeilen.clear();
        this.beiAenderung();
    }
}

/** Zeichnet alle Personen mit ihren Positionen in `ziel` (wird vorher
 *  geleert) und meldet jede Aenderung der Auswahl ueber beiAuswahl - auch
 *  einmal sofort nach dem ersten Zeichnen (siehe Dateikopf). Jeder Aufruf
 *  beginnt mit einer FRISCHEN, leeren Auswahl. */
export function zeichneRechnung(
    rechnung: Rechnung,
    ziel: HTMLElement,
    beiAuswahl: (auswahl: Auswahl) => void
): void {
    ziel.textContent = "";

    const kontrollkaestchen = new Map<number, HTMLInputElement>();
    let auswahl!: Auswahl;
    auswahl = new Auswahl(() => {
        for (const [orderItemId, kaestchen] of kontrollkaestchen) {
            kaestchen.checked = auswahl.enthaelt(orderItemId);
        }
        beiAuswahl(auswahl);
    });

    if (rechnung.participants.length === 0) {
        ziel.appendChild(el("p", "ox-muted", "Noch nichts bestellt."));
        beiAuswahl(auswahl);
        return;
    }

    for (const person of rechnung.participants) {
        ziel.appendChild(bauePersonenKarte(person, auswahl, kontrollkaestchen));
    }

    beiAuswahl(auswahl);
}

/** Kopf mit Name/Gastgeber-Kennzeichnung/offenem Betrag, darunter die
 *  Positionen dieser Person. */
function bauePersonenKarte(
    person: RechnungsPerson,
    auswahl: Auswahl,
    kontrollkaestchen: Map<number, HTMLInputElement>
): HTMLElement {
    // .ox-bon (bereits fuer den Warenkorb-Bon da, siehe bon.ts) gibt jeder
    // Person eine eigene perforierte "Bon"-Flaeche mit Mono-Zahlen statt
    // einer schlichten Liste - keine neue Klasse, reine Wiederverwendung.
    const karte = el("article", "ox-card ox-bon");

    const kopf = el("div", "ox-row");
    kopf.appendChild(el("strong", undefined, person.name));
    // Neutrale Basisklasse OHNE Zusatz: Akzentfarbe ist laut Spec nur fuer
    // den Hinzufuegen-Knopf und den aktiven Kategorie-Reiter reserviert,
    // sonst nirgends auf der Gaeste-Seite (siehe guest.css).
    if (person.isHost) kopf.appendChild(el("span", "ox-chip", "Gastgeber"));
    kopf.appendChild(el("span", "ox-spacer"));
    kopf.appendChild(el("span", "ox-muted", "offen"));
    kopf.appendChild(el("strong", "ox-preis", preis(person.openTotal)));
    karte.appendChild(kopf);

    const liste = el("ul", "ox-list");
    for (const zeile of person.items) {
        liste.appendChild(baueZeile(zeile, auswahl, kontrollkaestchen));
    }
    karte.appendChild(liste);

    return karte;
}

/** Eine Position: Kontrollkaestchen + Menge×Name + Preis, komplett ueber ein
 *  <label> anklickbar (Klick irgendwo in der Zeile trifft das Kaestchen).
 *  Bezahlte Positionen bekommen KEINEN Ereignis-Handler (siehe Dateikopf)
 *  und einen zusaetzlichen "bezahlt"-Chip. */
function baueZeile(
    zeile: RechnungsZeile,
    auswahl: Auswahl,
    kontrollkaestchen: Map<number, HTMLInputElement>
): HTMLElement {
    const eintrag = el("li");
    const zeilenKlasse = "ox-row ox-rechnung__zeile" + (zeile.paid ? " ox-rechnung__zeile--bezahlt" : "");
    const reihe = el("label", zeilenKlasse);

    const kaestchen = document.createElement("input");
    kaestchen.type = "checkbox";
    kaestchen.dataset.orderItemId = String(zeile.orderItemId);
    if (zeile.paid) {
        kaestchen.disabled = true;
    } else {
        kaestchen.addEventListener("change", () => auswahl.umschalten(zeile.orderItemId, zeile.lineTotal));
        kontrollkaestchen.set(zeile.orderItemId, kaestchen);
    }
    reihe.appendChild(kaestchen);

    reihe.appendChild(el("span", "ox-spacer", `${zeile.quantity}× ${zeile.name}`));
    if (zeile.paid) reihe.appendChild(el("span", "ox-chip ox-chip--gut", "bezahlt"));
    reihe.appendChild(el("span", "ox-preis", preis(zeile.lineTotal)));

    eintrag.appendChild(reihe);
    return eintrag;
}
