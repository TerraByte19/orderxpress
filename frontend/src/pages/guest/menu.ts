/* Speisekarte der Gaeste-Seite: Kategorien, Foto-Karten, Detail-Overlay.
 * Design-Referenz: Spec Abschnitt 5 - Akzentfarbe NUR am Hinzufuegen-Knopf
 * und am aktiven Reiter, Haarlinien-Rahmen statt Schatten.
 *
 * Kennt keine Element-Ids aus guest.html: zeichneSpeisekarte bekommt sein
 * Ziel uebergeben, oeffneDetail haengt sein Overlay selbst an document.body
 * (wie toast() in lib/ui.ts).
 *
 * Der Laden waehlt ueber menuLayout (LISTE | KACHELN | TAFEL), wie die Karte
 * aufgebaut ist. LISTE und KACHELN unterscheiden sich NUR im Stylesheet
 * (laden-layout.css) - dasselbe Markup, einmal als Zeile, einmal als Kachel.
 * TAFEL greift dagegen bis hierher durch: es entsteht gar kein Bildelement
 * (die gedruckte Karte hat keine Fotos, und so wird das Bild auch nicht
 * uebertragen) und der Gerichtname bekommt die Punktlinie zum Preis.
 *
 * WICHTIG: setzeBestellenErlaubt() zeichnet NICHT neu - der Gast blaettert
 * waehrend des Wartens in der Karte, ein erneutes zeichneSpeisekarte wuerfe
 * ihn an den Anfang zurueck. Stattdessen werden vorhandene Knoepfe per
 * document.querySelectorAll gesucht und nur ihr disabled umgeschaltet. */

import { api } from "../../lib/api";
import { preis } from "../../lib/format";
import { el } from "../../lib/ui";
import { bewegungAus, wachseFoto } from "./animation";
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

/** Struktur-Achsen, die bis ins Markup durchschlagen. Beide optional: ohne
 *  sie verhaelt sich das Modul genau wie zuvor (LISTE + Reiter/Hamburger). */
export interface KartenOptionen {
    /** LISTE | KACHELN | TAFEL - nur TAFEL aendert das Markup. */
    layout?: string;
    /** REITER | HAMBURGER | KAPITEL. Fehlt der Wert, entscheidet weiterhin
     *  das aeltere hamburger-Argument. */
    kategorieStil?: string;
}

function istTafel(layout?: string): boolean {
    return layout === "TAFEL";
}

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
function bildElement(url: string, klasse = "ox-gericht__bild"): HTMLImageElement {
    const bild = document.createElement("img");
    bild.className = klasse;
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
    beiAuswahl: (gericht: Gericht, quelle?: HTMLElement) => void,
    beiSchnellHinzufuegen: (gericht: Gericht, quelle: HTMLElement) => void,
    bestellenErlaubt: boolean,
    hamburger = false,
    istVerfuegbar?: (gerichtId: number) => boolean,
    zeigeLeereKategorien = false,
    optionen: KartenOptionen = {}
): void {
    ziel.textContent = "";

    // Die Achse fuehrt, das aeltere hamburger-Argument ist der Rueckfall -
    // dieselbe Reihenfolge wie im Backend (DesignRequest.categoryStyleOrDefault).
    const kategorieStil = optionen.kategorieStil ?? (hamburger ? "HAMBURGER" : "REITER");

    const sichtbareKategorien = zeigeLeereKategorien
        ? kategorien
        : kategorien.filter((kategorie) => kategorie.items.length > 0);

    const leiste = baueKategorieLeiste(sichtbareKategorien, ziel, kategorieStil);
    // Sitzt lieber IN der (ohnehin schon sticky) Kopfzeile als frei im
    // Seiteninhalt (siehe guest.html #topbar-kategorien) - Feedback: eine
    // zweite, eigene sticky-Flaeche im Inhalt kam mit dem Ansichtswechsel
    // (View-Transitions-API) durcheinander, die Kopfzeile selbst nie.
    // ansichten.ts blendet den Container je nach Ansicht ein/aus, hier wird
    // nur befuellt - menu-editor.html hat den Container nicht, faellt also
    // automatisch auf die alte Stelle im Inhalt zurueck.
    const topbarZiel = document.getElementById("topbar-kategorien");
    if (topbarZiel) {
        topbarZiel.textContent = "";
        if (leiste) topbarZiel.appendChild(leiste);
    } else if (leiste) {
        ziel.appendChild(leiste);
    }

    for (const kategorie of sichtbareKategorien) {
        const abschnitt = el("section", "ox-kategorie-abschnitt");
        abschnitt.id = `cat-${kategorie.id}`;
        abschnitt.appendChild(el("h2", undefined, kategorie.name));

        const grid = el("div", "ox-grid");
        for (const gericht of kategorie.items) {
            grid.appendChild(baueGerichtKarte(
                gericht, beiAuswahl, beiSchnellHinzufuegen, bestellenErlaubt,
                istVerfuegbar ? istVerfuegbar(gericht.id) : true, optionen.layout
            ));
        }
        abschnitt.appendChild(grid);
        ziel.appendChild(abschnitt);
    }
}

/* ---------- Platzhalter waehrend des Ladens ---------- */

/** Graue Platzhalter-Karten, solange die Speisekarte unterwegs ist. Sie
 *  tragen dieselben Klassen wie echte Karten und folgen damit automatisch dem
 *  gewaehlten Aufbau (Zeile oder Kachel) - der Gast sieht sofort die Form
 *  seiner Karte statt einer leeren Flaeche, und beim Eintreffen der Daten
 *  springt nichts.
 *
 *  aria-hidden: es gibt hier nichts vorzulesen; die Ansage uebernimmt der
 *  Wartehinweis der Ansicht. */
export function zeigeSkelett(ziel: HTMLElement, anzahl = 6, layout?: string): void {
    ziel.textContent = "";
    const grid = el("div", "ox-grid");
    for (let i = 0; i < anzahl; i++) {
        const karte = el("article", "ox-card ox-gericht ox-skelett");
        karte.setAttribute("aria-hidden", "true");

        const zeile = el("div", "ox-gericht__oeffnen");
        if (!istTafel(layout)) zeile.appendChild(el("div", "ox-gericht__bild ox-skelett__block"));
        const inhalt = el("div", "ox-gericht__inhalt");
        inhalt.append(
            el("span", "ox-skelett__block ox-skelett__zeile"),
            el("span", "ox-skelett__block ox-skelett__zeile ox-skelett__zeile--kurz")
        );
        zeile.appendChild(inhalt);

        const fuss = el("div", "ox-row ox-gericht__fuss");
        fuss.appendChild(el("span", "ox-skelett__block ox-skelett__preis"));

        karte.append(zeile, fuss);
        grid.appendChild(karte);
    }
    ziel.appendChild(grid);
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
    beiAuswahl: (gericht: Gericht, quelle?: HTMLElement) => void,
    beiSchnellHinzufuegen: (gericht: Gericht, quelle: HTMLElement) => void,
    bestellenErlaubt: boolean,
    verfuegbar = true,
    layout?: string
): HTMLElement {
    const tafel = istTafel(layout);
    const oeffnenKnopf = knopf("ox-gericht__oeffnen", undefined,
        `${gericht.name}, ${preis(gericht.price)} – Details öffnen`);
    // TAFEL ist die gedruckte Karte: kein Foto und auch kein Platzhalter -
    // der leere Teller waere hier keine Luecke, sondern ein Fremdkoerper.
    //
    // Der Platzhalter (leerer Teller) erscheint nur noch in der LISTE: dort
    // ist er 84x84 gross und haelt die Zeile in Form. In der KACHEL waere er
    // eine 4:3-Flaeche ueber die halbe Kachel - dann lieber eine Textkachel.
    if (gericht.imageUrl && !tafel) {
        oeffnenKnopf.appendChild(bildElement(gericht.imageUrl));
    } else if (!tafel && layout !== "KACHELN") {
        oeffnenKnopf.appendChild(el("div", "ox-gericht__bild ox-gericht__bild--leer"));
    }

    const inhalt = el("div", "ox-gericht__inhalt");
    const name = el("span", "ox-gericht__name", gericht.name);
    if (tafel) {
        // Name + Punktlinie in einer Zeile; die Linie fuellt bis zur
        // Preisspalte (Optik: laden-layout.css). Rein dekorativ.
        const titelzeile = el("div", "ox-gericht__titelzeile");
        const leader = el("span", "ox-gericht__leader");
        leader.setAttribute("aria-hidden", "true");
        titelzeile.append(name, leader);
        inhalt.appendChild(titelzeile);
    } else {
        inhalt.appendChild(name);
    }
    if (gericht.description) inhalt.appendChild(el("span", "ox-muted", gericht.description));
    const marken = markenLeiste(gericht.badges);
    if (marken) inhalt.appendChild(marken);
    oeffnenKnopf.appendChild(inhalt);
    // Das Foto der Karte wird dem Aufrufer mitgegeben: oeffneDetail laesst es
    // in das grosse Foto des Blattes wachsen (animation.ts, wachseFoto).
    oeffnenKnopf.addEventListener("click", () =>
        beiAuswahl(gericht, oeffnenKnopf.querySelector<HTMLElement>(".ox-gericht__bild") ?? undefined));

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
function baueKategorieLeiste(kategorien: Kategorie[], ziel: HTMLElement, kategorieStil: string): HTMLElement | null {
    if (kategorien.length < 2) return null; // nichts zum Wechseln

    // KAPITEL kommt ohne Navigation aus: die Kategorienamen selbst bleiben
    // beim Scrollen stehen (laden-layout.css) - eine zusaetzliche Leiste
    // waere die gleiche Information ein zweites Mal.
    if (kategorieStil === "KAPITEL") return null;

    const springe = (kategorieId: number): void => {
        ziel.querySelector<HTMLElement>(`#cat-${kategorieId}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    };

    if (kategorieStil !== "HAMBURGER") {
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
    bestellenErlaubt: boolean,
    optionen: { layout?: string; quelle?: HTMLElement } = {}
): void {
    const overlay = holeOderErstelleOverlay();
    const box = overlay.querySelector<HTMLDivElement>(".ox-overlay__box")!;
    box.textContent = "";
    let menge = 1;

    // TAFEL bleibt auch im Blatt ohne Foto - der Laden hat sich bewusst fuer
    // die reine Schriftkarte entschieden, ein Foto nur hier waere ein Bruch.
    const zeigeFoto = Boolean(gericht.imageUrl) && !istTafel(optionen.layout);
    let grossesBild: HTMLImageElement | null = null;
    if (zeigeFoto) {
        // Eigene Klasse statt .ox-gericht__bild: im Blatt fuellt das Foto die
        // ganze Breite (siehe guest.css .ox-detail__bild). Vorher trug es die
        // Karten-Klasse und blieb bei 84x84 - wer ein Gericht antippt, will
        // es aber gross sehen.
        grossesBild = bildElement(gericht.imageUrl as string, "ox-detail__bild");
        box.appendChild(grossesBild);
    }
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
    // Wandert ein Foto in seine grosse Fassung, blendet das Blatt nur auf,
    // statt zusaetzlich hochzuschieben: zwei gleichzeitige Bewegungen auf
    // derselben Flaeche lesen sich als Zucken. Ohne Foto (oder bei
    // reduzierter Bewegung) bleibt es beim gewohnten Hochschieben - und nur
    // dann steht das Blatt beim Messen schon an seinem Platz.
    const mitFotoWechsel = Boolean(optionen.quelle && grossesBild) && !bewegungAus();
    overlay.classList.toggle("ox-detail-overlay--foto", mitFotoWechsel);

    overlay.style.display = "flex";
    requestAnimationFrame(() => {
        overlay.classList.add("is-open");
        // Das angetippte Foto wandert in seine grosse Fassung. Nur wenn beide
        // Fotos wirklich da sind - sonst bleibt es beim Hochschieben des
        // Blattes. wachseFoto misst erst NACH is-open, weil das Blatt dann
        // an seiner endgueltigen Stelle steht.
        if (mitFotoWechsel) wachseFoto(optionen.quelle as HTMLElement, grossesBild as HTMLImageElement);
    });
}

/* ---------- Bestellen sperren/entsperren ---------- */

/** Sperrt/entsperrt ALLE Hinzufuegen-Knoepfe (Liste UND ein gerade offenes
 *  Detail-Overlay). Zeichnet NICHTS neu - siehe Modulkopf. */
export function setzeBestellenErlaubt(erlaubt: boolean): void {
    document.querySelectorAll<HTMLButtonElement>(HINZUFUEGEN_AUSWAHL)
        .forEach((element) => { element.disabled = !erlaubt; });
}
