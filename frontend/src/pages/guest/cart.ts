/* Warenkorb der Gaeste-Seite: Zeilen, Zusammenfuehren gleicher Positionen,
 * Wiederherstellung aus localStorage, Bestellung abschicken.
 *
 * WICHTIGSTER PUNKT: sichere() legt NUR gerichtId, Menge und Hinweis ab -
 * NIE Name oder Preis (siehe GespeicherteZeile). Der Preis wird ohnehin
 * serverseitig bestimmt - PlaceOrderRequest.OrderItemRequest hat gar kein
 * Preisfeld, der Warenkorb zeigt den Preis nur an. stelleWiederHer() schlaegt
 * Name und Preis darum bei JEDEM Aufruf in der FRISCH uebergebenen
 * Speisekarte nach: hat der Laden zwischenzeitlich den Preis geaendert,
 * zeigt der wiederhergestellte Warenkorb den NEUEN Preis; hat er ein Gericht
 * entfernt, faellt die Zeile still heraus.
 *
 * ZWEITWICHTIGSTER PUNKT: hinzufuegen() fuehrt zwei Aufrufe fuer dasselbe
 * Gericht nur zusammen, wenn auch der (getrimmte) Hinweis gleich ist.
 * Unterschiedliche Hinweise bleiben als eigene Zeilen bestehen - sonst
 * verliert die Kueche Sonderwuensche (z.B. "ohne Zwiebeln" vs. "extra
 * scharf" fuer dieselbe Pizza).
 *
 * Deshalb reicht "gerichtId" allein nicht mehr aus, um EINE Zeile
 * eindeutig zu identifizieren, sobald es zwei Zeilen desselben Gerichts mit
 * verschiedenem Hinweis gibt. aendereMenge()/entferne() nehmen darum - ueber
 * die Kurzform aus dem Auftrag hinaus - einen optionalen hinweis-Parameter
 * an: ohne ihn zielen sie auf die notizlose Zeile (der Normalfall beim
 * schnellen "+" auf der Speisekarte), mit ihm auf die Zeile MIT diesem
 * Hinweis. So bleibt die einfache Ein-Zeile-Karte trivial ansprechbar,
 * waehrend zwei Zeilen desselben Gerichts nicht verwechselt werden koennen. */

import { api } from "../../lib/api";
import type { Gericht, Kategorie } from "../../lib/types";

/** Groesste erlaubte Menge je Zeile - identisch zur Server-Validierung
 *  (PlaceOrderRequest.OrderItemRequest, @Max(50)) und zum Mengen-Stepper
 *  im Detail-Overlay (menu.ts, oeffneDetail). */
const MAX_MENGE = 50;

/** Eine Zeile im Warenkorb - Name/Preis sind eine ANZEIGE-Momentaufnahme
 *  der Speisekarte zum Zeitpunkt von hinzufuegen()/stelleWiederHer(), nie
 *  die Quelle der Wahrheit fuer den tatsaechlichen Bestellpreis. */
export interface WarenkorbZeile {
    gerichtId: number;
    name: string;
    preis: number;
    menge: number;
    hinweis: string;
}

/** Das einzige Format, das localStorage sieht - siehe Dateikopf. */
interface GespeicherteZeile {
    gerichtId: number;
    menge: number;
    hinweis: string;
}

function schluessel(guestToken: string): string {
    return `ox-cart-${guestToken}`;
}

export class Warenkorb {
    private readonly liste: WarenkorbZeile[] = [];

    /** Fuegt eine neue Zeile hinzu oder erhoeht die Menge einer bestehenden -
     *  siehe Dateikopf: Zusammenfuehrung nur bei gleichem Gericht UND
     *  gleichem (getrimmtem) Hinweis. */
    hinzufuegen(gericht: Gericht, menge: number, hinweis: string): void {
        const bereinigterHinweis = hinweis.trim();
        const vorhandene = this.finde(gericht.id, bereinigterHinweis);
        if (vorhandene) {
            vorhandene.menge = Math.min(MAX_MENGE, vorhandene.menge + menge);
            return;
        }
        this.liste.push({
            gerichtId: gericht.id,
            name: gericht.name,
            preis: gericht.price,
            menge: Math.min(MAX_MENGE, Math.max(1, menge)),
            hinweis: bereinigterHinweis
        });
    }

    /** delta auf die Menge einer Zeile. Faellt die Menge auf 0 oder
     *  darunter, verschwindet die Zeile ganz - keine Geister-Zeile mit
     *  Menge 0. hinweis identifiziert bei mehreren Zeilen desselben
     *  Gerichts die richtige Zeile (siehe Dateikopf); ohne Angabe ist es
     *  die Zeile ohne Hinweis. */
    aendereMenge(gerichtId: number, delta: number, hinweis: string = ""): void {
        const zeile = this.finde(gerichtId, hinweis);
        if (!zeile) return;
        const neueMenge = zeile.menge + delta;
        if (neueMenge <= 0) {
            this.entferne(gerichtId, hinweis);
            return;
        }
        zeile.menge = Math.min(MAX_MENGE, neueMenge);
    }

    /** Entfernt genau die Zeile mit dieser gerichtId UND diesem Hinweis. */
    entferne(gerichtId: number, hinweis: string = ""): void {
        const index = this.liste.findIndex((z) => z.gerichtId === gerichtId && z.hinweis === hinweis);
        if (index !== -1) this.liste.splice(index, 1);
    }

    /** Kopie der Zeilen - Aufrufer duerfen den internen Zustand nicht
     *  versehentlich durch Mutation des Rueckgabewerts veraendern. */
    zeilen(): WarenkorbZeile[] {
        return this.liste.map((zeile) => ({ ...zeile }));
    }

    /** Gesamtzahl aller Positionen (Summe der Mengen), z.B. fuer die
     *  Warenkorb-Leiste "3 Artikel". */
    anzahl(): number {
        return this.liste.reduce((summe, zeile) => summe + zeile.menge, 0);
    }

    /** Anzeige-Summe. Der tatsaechlich berechnete Preis kommt serverseitig
     *  beim Absenden - siehe Dateikopf. */
    summe(): number {
        return this.liste.reduce((summe, zeile) => summe + zeile.menge * zeile.preis, 0);
    }

    leeren(): void {
        this.liste.length = 0;
    }

    /** Speichert NUR gerichtId/Menge/Hinweis unter ox-cart-<guestToken> -
     *  siehe Dateikopf. Scheitert das Schreiben (privater Modus o.ae.),
     *  bleibt der Warenkorb einfach nur fuer diese Sitzung im Speicher. */
    sichere(guestToken: string): void {
        try {
            const daten: GespeicherteZeile[] = this.liste.map((zeile) => ({
                gerichtId: zeile.gerichtId,
                menge: zeile.menge,
                hinweis: zeile.hinweis
            }));
            localStorage.setItem(schluessel(guestToken), JSON.stringify(daten));
        } catch {
            /* privater Modus o.ae. */
        }
    }

    /** Ersetzt die Zeilen durch den gespeicherten Stand. Name und Preis
     *  kommen IMMER aus `kategorien` (der frisch geladenen Karte), nie aus
     *  dem Speicher - siehe Dateikopf. Ein nicht mehr vorhandenes Gericht
     *  faellt still heraus. Fehlende/kaputte Speicherdaten ergeben einen
     *  leeren Warenkorb statt eines Absturzes. */
    stelleWiederHer(guestToken: string, kategorien: Kategorie[]): void {
        const daten = this.leseGespeicherteZeilen(guestToken);
        this.liste.length = 0;
        if (!daten) return;

        const speisekarte = new Map<number, Gericht>();
        for (const kategorie of kategorien) {
            for (const gericht of kategorie.items) speisekarte.set(gericht.id, gericht);
        }

        for (const eintrag of daten) {
            const gericht = speisekarte.get(eintrag.gerichtId);
            if (!gericht) continue; // Gericht gibt es nicht mehr - faellt still heraus
            this.liste.push({
                gerichtId: gericht.id,
                name: gericht.name,
                preis: gericht.price,
                menge: Math.min(MAX_MENGE, Math.max(1, eintrag.menge)),
                hinweis: eintrag.hinweis || ""
            });
        }
    }

    private finde(gerichtId: number, hinweis: string): WarenkorbZeile | undefined {
        return this.liste.find((zeile) => zeile.gerichtId === gerichtId && zeile.hinweis === hinweis);
    }

    private leseGespeicherteZeilen(guestToken: string): GespeicherteZeile[] | null {
        try {
            const roh = localStorage.getItem(schluessel(guestToken));
            if (!roh) return null;
            const geparst: unknown = JSON.parse(roh);
            return Array.isArray(geparst) ? (geparst as GespeicherteZeile[]) : null;
        } catch {
            return null;
        }
    }
}

/** Schickt den Warenkorb als Bestellung ab (POST /api/guest/orders). Leert
 *  ihn samt Speicher NUR bei Erfolg - schlaegt die Anfrage fehl (Netzwerk,
 *  Gericht inzwischen nicht mehr verfuegbar, ...), bleiben die Zeilen
 *  erhalten, sonst waere die Auswahl des Gasts nach einem Fehler weg. */
export async function bestelle(guestToken: string, warenkorb: Warenkorb): Promise<void> {
    const items = warenkorb.zeilen().map((zeile) => ({
        menuItemId: zeile.gerichtId,
        quantity: zeile.menge,
        note: zeile.hinweis || null
    }));

    await api("/api/guest/orders", {
        method: "POST",
        body: JSON.stringify({ guestToken, items })
    });

    warenkorb.leeren();
    try {
        localStorage.removeItem(schluessel(guestToken));
    } catch {
        /* privater Modus o.ae. */
    }
}
