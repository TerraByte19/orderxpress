/* Speisekarte der Gaeste-Seite: Kategorien, Foto-Karten, Detail-Overlay.
 * Design-Referenz: Spec Abschnitt 5 - Akzentfarbe NUR am Hinzufuegen-Knopf
 * und am aktiven Reiter, Haarlinien-Rahmen statt Schatten.
 *
 * Kennt keine Element-Ids aus guest.html: zeichneSpeisekarte bekommt sein
 * Ziel uebergeben, oeffneDetail haengt sein Overlay selbst an document.body
 * (wie toast() in lib/ui.ts).
 *
 * WICHTIG: setzeBestellenErlaubt() zeichnet NICHT neu - der Gast blaettert
 * waehrend des Wartens in der Karte, ein erneutes zeichneSpeisekarte wuerfe
 * ihn an den Anfang zurueck. Stattdessen werden vorhandene Knoepfe per
 * document.querySelectorAll gesucht und nur ihr disabled umgeschaltet. */

import { api } from "../../lib/api";
import { preis } from "../../lib/format";
import { el } from "../../lib/ui";
import type { Gericht, Kategorie } from "../../lib/types";
import { GERICHT_MARKEN } from "../../lib/types";

const MARKEN_LABEL = new Map(GERICHT_MARKEN.map((m) => [m.wert, m.label]));

/** Kleine Text-Pillen fuer die gesetzten Marken (scharf/vegetarisch/...) -
 *  leer, wenn keine gesetzt sind (dann haengt der Aufrufer nichts an). */
function markenLeiste(badges: string[]): HTMLElement | null {
    if (!badges.length) return null;
    const leiste = el("div", "ox-marken");
    for (const wert of badges) {
        leiste.appendChild(el("span", "ox-marke ox-marke--" + wert.toLowerCase(), MARKEN_LABEL.get(wert) ?? wert));
    }
    return leiste;
}

/** Traegt jeder Hinzufuegen-Knopf (Karte UND Detail-Overlay) - eine einzige
 *  Auswahl, ueber die setzeBestellenErlaubt() beide Stellen erreicht. */
const HINZUFUEGEN_AUSWAHL = ".ox-gericht__hinzufuegen, .ox-detail__hinzufuegen";

export function ladeSpeisekarte(restaurantId: number): Promise<Kategorie[]> {
    return api<Kategorie[]>(`/api/guest/menu/${restaurantId}`);
}

/** Button-Fabrik analog zu el() aus lib/ui.ts, plus optionalem aria-label -
 *  spart das immergleiche type/className/textContent-Paket. */
function knopf(klasse: string, text?: string, ariaLabel?: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = klasse;
    if (text !== undefined) b.textContent = text;
    if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
    return b;
}

/** setAttribute statt der .loading-Property: jsdom spiegelt sie nicht auf
 *  das Attribut (siehe Bericht) - setAttribute landet zuverlaessig im HTML. */
function bildElement(url: string): HTMLImageElement {
    const bild = document.createElement("img");
    bild.className = "ox-gericht__bild";
    bild.src = url;
    bild.alt = "";
    bild.setAttribute("loading", "lazy");
    return bild;
}

/* ---------- Speisekarte zeichnen ---------- */

/** beiAuswahl (Karte antippen: Foto/Name) oeffnet das Detail-Overlay,
 *  beiSchnellHinzufuegen (der "+"-Knopf in der Preiszeile) legt sofort mit
 *  Menge 1 hinzu - zwei GETRENNTE Rueckrufe, siehe baueGerichtKarte unten.
 *  hamburger (Standardwert false, also weiter mit fuenf Argumenten aufrufbar)
 *  ist die bewusste Erweiterung fuer categoriesAsHamburger aus dem Theme:
 *  der Laden kann Kategorien als Hamburger-Menue statt als Reiter zeigen. */
export function zeichneSpeisekarte(
    kategorien: Kategorie[],
    ziel: HTMLElement,
    beiAuswahl: (gericht: Gericht) => void,
    beiSchnellHinzufuegen: (gericht: Gericht, quelle: HTMLElement) => void,
    bestellenErlaubt: boolean,
    hamburger = false,
    istVerfuegbar?: (gerichtId: number) => boolean,
    zeigeLeereKategorien = false
): void {
    ziel.textContent = "";

    const sichtbareKategorien = zeigeLeereKategorien
        ? kategorien
        : kategorien.filter((kategorie) => kategorie.items.length > 0);

    const leiste = baueKategorieLeiste(sichtbareKategorien, ziel, hamburger);
    if (leiste) ziel.appendChild(leiste);

    for (const kategorie of sichtbareKategorien) {
        const abschnitt = el("section", "ox-kategorie-abschnitt");
        abschnitt.id = `cat-${kategorie.id}`;
        abschnitt.appendChild(el("h2", undefined, kategorie.name));

        const grid = el("div", "ox-grid");
        for (const gericht of kategorie.items) {
            grid.appendChild(baueGerichtKarte(
                gericht, beiAuswahl, beiSchnellHinzufuegen, bestellenErlaubt,
                istVerfuegbar ? istVerfuegbar(gericht.id) : true
            ));
        }
        abschnitt.appendChild(grid);
        ziel.appendChild(abschnitt);
    }
}

/** Foto-Karte auf .ox-card (Padding 0, Bild reicht randlos zum Rand). Zwei
 *  GESCHWISTER-Knoepfe statt Verschachtelung (ein <button> darf keinen
 *  weiteren enthalten): .oeffnen (immer aktiv - Browsen bleibt waehrend des
 *  Wartens erlaubt, ruft beiAuswahl -> Detail-Overlay) und .hinzufuegen (nur
 *  die Preis-Zeile, wird gesperrt, ruft beiSchnellHinzufuegen -> sofort mit
 *  Menge 1 in den Warenkorb, EIN Tipp statt drei). Regression (behoben):
 *  beide Knoepfe hingen zwischenzeitlich am selben Rueckruf, wodurch der
 *  "+"-Knopf faelschlich ebenfalls das Overlay oeffnete. */
function baueGerichtKarte(
    gericht: Gericht,
    beiAuswahl: (gericht: Gericht) => void,
    beiSchnellHinzufuegen: (gericht: Gericht, quelle: HTMLElement) => void,
    bestellenErlaubt: boolean,
    verfuegbar = true
): HTMLElement {
    const oeffnenKnopf = knopf("ox-gericht__oeffnen", undefined,
        `${gericht.name}, ${preis(gericht.price)} – Details öffnen`);
    const bild = gericht.imageUrl ? bildElement(gericht.imageUrl) : el("div", "ox-gericht__bild ox-gericht__bild--leer");
    oeffnenKnopf.appendChild(bild);

    const inhalt = el("div", "ox-gericht__inhalt");
    inhalt.appendChild(el("span", "ox-gericht__name", gericht.name));
    if (gericht.description) inhalt.appendChild(el("span", "ox-muted", gericht.description));
    const marken = markenLeiste(gericht.badges);
    if (marken) inhalt.appendChild(marken);
    oeffnenKnopf.appendChild(inhalt);
    oeffnenKnopf.addEventListener("click", () => beiAuswahl(gericht));

    const fuss = el("div", "ox-row ox-gericht__fuss");
    const hinzufuegenKnopf = knopf("ox-btn ox-btn--klein ox-gericht__hinzufuegen", "+", `${gericht.name} hinzufügen`);
    hinzufuegenKnopf.disabled = !bestellenErlaubt;
    // stopPropagation vorsorglich (Vorgabe CLAUDE.md): .oeffnen und .hinzufuegen
    // sind zwar GESCHWISTER, kein Klick-Bereich umschliesst den "+" also heute
    // schon - schadet hier aber nicht und schuetzt, falls sich die
    // Verschachtelung kuenftig aendert.
    hinzufuegenKnopf.addEventListener("click", (ereignis) => {
        ereignis.stopPropagation();
        beiSchnellHinzufuegen(gericht, hinzufuegenKnopf);
    });
    fuss.append(el("span", "ox-preis", preis(gericht.price)), el("span", "ox-spacer"), hinzufuegenKnopf);

    const karte = el("article", "ox-card ox-gericht" + (verfuegbar ? "" : " ox-gericht--ausverkauft"));
    karte.dataset.gerichtId = String(gericht.id);
    karte.append(oeffnenKnopf, fuss);
    if (!verfuegbar) karte.appendChild(el("span", "ox-badge", "Ausverkauft"));
    return karte;
}

/* ---------- Kategorie-Leiste: Standard-Reiter ODER Hamburger-Menue ---------- */

/** Standardweg: klein und gesperrt - Grossbuchstaben, weite Buchstaben-
 *  abstaende, nicht fett (Spec Abschnitt 5), Optik lebt in guest.css.
 *  Hamburger-Weg: Umschalt-Knopf mit ausklappbarem Panel statt Reitern -
 *  der Laden waehlt das ueber categoriesAsHamburger aus dem Theme. jsdom
 *  (Testumgebung) implementiert scrollIntoView nicht, daher per optional
 *  chaining auf die Methode SELBST abgesichert. */
function baueKategorieLeiste(kategorien: Kategorie[], ziel: HTMLElement, hamburger: boolean): HTMLElement | null {
    if (kategorien.length < 2) return null; // nichts zum Wechseln

    const springe = (kategorieId: number): void => {
        ziel.querySelector<HTMLElement>(`#cat-${kategorieId}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    };

    if (!hamburger) {
        const leiste = el("nav", "ox-kategorie-leiste");
        leiste.setAttribute("aria-label", "Kategorien");

        // Gleitender Strich unter dem aktiven Reiter (Optik: guest-motion.css).
        // jsdom liefert offsetWidth/offsetLeft als 0 - der Test prueft nur die
        // Existenz des Elements, nicht die Position.
        const strich = el("span", "ox-kategorie-strich");
        const setzeStrich = (reiter: HTMLElement): void => {
            strich.style.width = `${reiter.offsetWidth}px`;
            strich.style.transform = `translateX(${reiter.offsetLeft}px)`;
        };

        kategorien.forEach((kategorie, index) => {
            const reiter = knopf("ox-kategorie-reiter" + (index === 0 ? " is-active" : ""), kategorie.name);
            reiter.addEventListener("click", () => {
                leiste.querySelectorAll(".ox-kategorie-reiter").forEach((r) => r.classList.remove("is-active"));
                reiter.classList.add("is-active");
                setzeStrich(reiter);
                springe(kategorie.id);
            });
            leiste.appendChild(reiter);
        });

        leiste.appendChild(strich);
        // initial (nach Layout) auf den ersten Reiter
        requestAnimationFrame(() => {
            const ersterReiter = leiste.querySelector<HTMLElement>(".ox-kategorie-reiter");
            if (ersterReiter) setzeStrich(ersterReiter);
        });

        return leiste;
    }

    const panel = el("div", "ox-kategorie-panel");
    panel.hidden = true;
    const umschaltKnopf = knopf("ox-btn ox-btn--geist ox-btn--klein", "☰ Kategorien");
    umschaltKnopf.setAttribute("aria-expanded", "false");
    umschaltKnopf.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        umschaltKnopf.setAttribute("aria-expanded", String(!panel.hidden));
    });
    for (const kategorie of kategorien) {
        const eintrag = knopf("ox-kategorie-panel__eintrag", kategorie.name);
        eintrag.addEventListener("click", () => {
            panel.hidden = true;
            umschaltKnopf.setAttribute("aria-expanded", "false");
            springe(kategorie.id);
        });
        panel.appendChild(eintrag);
    }
    const wrapper = el("div", "ox-kategorie-hamburger");
    wrapper.append(umschaltKnopf, panel);
    return wrapper;
}

/* ---------- Detail-Overlay ---------- */

function versteckeOverlay(overlay: HTMLElement): void {
    overlay.classList.remove("is-open");
    // Das Slide-up setzt beim Oeffnen inline display:flex (damit der naechste
    // Frame die Transition starten kann) - hier wieder zuruecknehmen, sonst
    // bliebe der abgedunkelte Hintergrund nach dem Schliessen stehen.
    overlay.style.display = "";
}

// Einmalig registriert: sucht das GERADE offene Overlay zum Zeitpunkt des
// Tastendrucks statt eine Closure auf eine Instanz zu halten - so haeuft
// sich kein zweiter Listener an, auch wenn Tests das Overlay neu aufbauen.
document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key !== "Escape") return;
    const offen = document.querySelector<HTMLElement>(".ox-detail-overlay.is-open");
    if (offen) versteckeOverlay(offen);
});

function holeOderErstelleOverlay(): HTMLDivElement {
    const vorhanden = document.querySelector<HTMLDivElement>(".ox-detail-overlay");
    if (vorhanden) return vorhanden;

    // .ox-overlay/.ox-overlay__box kommen unveraendert aus components.css.
    const overlay = document.createElement("div");
    overlay.className = "ox-overlay ox-detail-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Gericht-Details");
    overlay.appendChild(el("div", "ox-overlay__box ox-overlay__box--sheet"));

    // Klick auf die abgedunkelte Flaeche schliesst, Klick auf die Box nicht.
    overlay.addEventListener("click", (ereignis) => {
        if (ereignis.target === overlay) versteckeOverlay(overlay);
    });

    document.body.appendChild(overlay);
    return overlay;
}

/** Foto, Preis, Beschreibung, "Zutaten & Details" (Allergene), Mengen-
 *  Stepper, Hinweisfeld - fachliche Referenz: guest.js Zeilen 309-460. Kennt
 *  den Warenkorb nicht, meldet nur einmalig ueber beiHinzufuegen zurueck. */
export function oeffneDetail(
    gericht: Gericht,
    beiHinzufuegen: (gericht: Gericht, menge: number, hinweis: string, quelle: HTMLElement) => void,
    bestellenErlaubt: boolean
): void {
    const overlay = holeOderErstelleOverlay();
    const box = overlay.querySelector<HTMLDivElement>(".ox-overlay__box")!;
    box.textContent = "";
    let menge = 1;

    if (gericht.imageUrl) box.appendChild(bildElement(gericht.imageUrl));
    box.appendChild(el("h2", undefined, gericht.name));
    const detailMarken = markenLeiste(gericht.badges);
    if (detailMarken) box.appendChild(detailMarken);
    box.appendChild(el("p", "ox-big ox-preis", preis(gericht.price)));
    if (gericht.description) box.appendChild(el("p", "ox-muted", gericht.description));

    if (gericht.details) {
        const zutaten = el("div", "ox-detail__zutaten");
        zutaten.appendChild(el("strong", undefined, "Zutaten & Details"));
        zutaten.appendChild(el("p", "ox-muted", gericht.details));
        box.appendChild(zutaten);
    }

    const mengeAnzeige = el("strong", "ox-num", String(menge));
    const setzeMenge = (neu: number): void => { menge = neu; mengeAnzeige.textContent = String(menge); };
    const minusKnopf = knopf("ox-btn ox-btn--geist ox-btn--klein", "−", "Menge verringern");
    minusKnopf.addEventListener("click", () => setzeMenge(Math.max(1, menge - 1)));
    const plusKnopf = knopf("ox-btn ox-btn--geist ox-btn--klein", "+", "Menge erhöhen");
    plusKnopf.addEventListener("click", () => setzeMenge(Math.min(50, menge + 1)));

    const stepperZeile = el("div", "ox-row");
    stepperZeile.append(el("span", undefined, "Menge:"), minusKnopf, mengeAnzeige, plusKnopf);
    box.appendChild(stepperZeile);

    box.appendChild(el("label", "ox-label", "Hinweis"));
    const hinweisFeld = document.createElement("input");
    hinweisFeld.type = "text";
    hinweisFeld.className = "ox-field";
    hinweisFeld.placeholder = "z. B. ohne Zwiebeln";
    hinweisFeld.maxLength = 200;
    box.appendChild(hinweisFeld);

    const schliessenKnopf = knopf("ox-btn ox-btn--geist ox-detail__schliessen", "Schließen");
    schliessenKnopf.addEventListener("click", () => versteckeOverlay(overlay));

    // Reine .ox-btn-Basisklasse = Akzentfarbe (laut Spec NUR hier + aktiver Reiter).
    const hinzufuegenKnopf = knopf("ox-btn ox-detail__hinzufuegen", "In den Warenkorb");
    hinzufuegenKnopf.disabled = !bestellenErlaubt;
    hinzufuegenKnopf.addEventListener("click", () => {
        beiHinzufuegen(gericht, menge, hinweisFeld.value.trim(), hinzufuegenKnopf);
        versteckeOverlay(overlay);
    });

    const knopfZeile = el("div", "ox-row");
    knopfZeile.append(schliessenKnopf, el("span", "ox-spacer"), hinzufuegenKnopf);
    box.appendChild(knopfZeile);

    // Erst rendern (display:flex), dann im naechsten Frame is-open setzen -
    // so hat das .ox-overlay__box--sheet einen Ausgangszustand
    // (transform: translateY(100%)), von dem aus die CSS-Transition
    // sichtbar nach oben slidet.
    overlay.style.display = "flex";
    requestAnimationFrame(() => overlay.classList.add("is-open"));
}

/* ---------- Bestellen sperren/entsperren ---------- */

/** Sperrt/entsperrt ALLE Hinzufuegen-Knoepfe (Liste UND ein gerade offenes
 *  Detail-Overlay). Zeichnet NICHTS neu - siehe Modulkopf. */
export function setzeBestellenErlaubt(erlaubt: boolean): void {
    document.querySelectorAll<HTMLButtonElement>(HINZUFUEGEN_AUSWAHL)
        .forEach((element) => { element.disabled = !erlaubt; });
}
