/* Haengt Editor-Bedienelemente an die von zeichneSpeisekarte() gebaute Karte
 * an - reine DOM-Nachbearbeitung, kein Fork der Gast-Rendering-Funktion.
 * Muss NACH zeichneSpeisekarte(..., zeigeLeereKategorien=true) laufen. */

import { el } from "../../lib/ui";
import type { AdminKategorie } from "../../lib/types";

export interface DekorationsAufrufe {
    beiGerichtNeu: (kategorieId: number) => void;
    beiGerichtVerschieben: (gerichtId: number, richtung: -1 | 1) => void;
    beiKategorieBearbeiten: (kategorieId: number) => void;
    beiKategorieLoeschen: (kategorieId: number) => void;
    beiKategorieVerschieben: (kategorieId: number, richtung: -1 | 1) => void;
    beiKategorieNeu: () => void;
}

export function dekoriereSpeisekarte(ziel: HTMLElement, kategorieInfo: Map<number, AdminKategorie>, aufrufe: DekorationsAufrufe): void {
    const abschnitte = Array.from(ziel.querySelectorAll<HTMLElement>(".ox-kategorie-abschnitt"));

    abschnitte.forEach((abschnitt, index) => {
        const kategorieId = Number(abschnitt.id.replace("cat-", ""));
        dekoriereKategorieKopf(abschnitt, kategorieId, index === 0, index === abschnitte.length - 1, kategorieInfo, aufrufe);
        dekoriereKarten(abschnitt, aufrufe.beiGerichtVerschieben);

        const grid = abschnitt.querySelector(".ox-grid");
        if (grid) grid.appendChild(baueNeueGerichtKachel(kategorieId, aufrufe.beiGerichtNeu));
    });

    const neueKategorieKnopf = knopf("ox-btn ox-btn--geist ox-editor-kategorie-neu", "+ Kategorie");
    neueKategorieKnopf.addEventListener("click", () => aufrufe.beiKategorieNeu());
    ziel.appendChild(neueKategorieKnopf);
}

function dekoriereKategorieKopf(
    abschnitt: HTMLElement,
    kategorieId: number,
    istErste: boolean,
    istLetzte: boolean,
    kategorieInfo: Map<number, AdminKategorie>,
    aufrufe: DekorationsAufrufe
): void {
    const kopf = abschnitt.querySelector("h2");
    if (!kopf) return;

    const zeile = el("div", "ox-row ox-kategorie-kopf");
    kopf.replaceWith(zeile);
    zeile.appendChild(kopf);
    if (kategorieInfo.get(kategorieId)?.active === false) {
        zeile.appendChild(el("span", "ox-badge", "Inaktiv"));
    }
    zeile.appendChild(el("span", "ox-spacer"));
    zeile.appendChild(baueVerschiebeKnoepfe(istErste, istLetzte, (richtung) => aufrufe.beiKategorieVerschieben(kategorieId, richtung)));

    const bearbeiten = knopf("ox-btn ox-btn--geist ox-btn--klein", "Bearbeiten");
    bearbeiten.addEventListener("click", () => aufrufe.beiKategorieBearbeiten(kategorieId));
    zeile.appendChild(bearbeiten);

    const loeschen = knopf("ox-btn ox-btn--geist ox-btn--klein", "Löschen");
    loeschen.addEventListener("click", () => aufrufe.beiKategorieLoeschen(kategorieId));
    zeile.appendChild(loeschen);
}

function dekoriereKarten(abschnitt: HTMLElement, beiVerschieben: (gerichtId: number, richtung: -1 | 1) => void): void {
    const karten = Array.from(abschnitt.querySelectorAll<HTMLElement>(".ox-gericht"));
    karten.forEach((karte, index) => {
        const gerichtId = Number(karte.dataset.gerichtId);
        const knoepfe = baueVerschiebeKnoepfe(index === 0, index === karten.length - 1, (richtung) => beiVerschieben(gerichtId, richtung));
        knoepfe.classList.add("ox-editor-pfeile");
        karte.appendChild(knoepfe);
    });
}

function baueVerschiebeKnoepfe(istErste: boolean, istLetzte: boolean, beiKlick: (richtung: -1 | 1) => void): HTMLElement {
    const zeile = el("div", "ox-row");
    if (!istErste) {
        const hoch = knopf("ox-btn ox-btn--geist ox-btn--klein", "↑", "Nach oben verschieben");
        hoch.addEventListener("click", (ereignis) => { ereignis.stopPropagation(); beiKlick(-1); });
        zeile.appendChild(hoch);
    }
    if (!istLetzte) {
        const runter = knopf("ox-btn ox-btn--geist ox-btn--klein", "↓", "Nach unten verschieben");
        runter.addEventListener("click", (ereignis) => { ereignis.stopPropagation(); beiKlick(1); });
        zeile.appendChild(runter);
    }
    return zeile;
}

function baueNeueGerichtKachel(kategorieId: number, beiKlick: (kategorieId: number) => void): HTMLElement {
    const kachel = knopf("ox-card ox-gericht ox-gericht--neu", "+ Gericht");
    kachel.addEventListener("click", () => beiKlick(kategorieId));
    return kachel;
}

function knopf(klasse: string, text: string, ariaLabel?: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = klasse;
    b.textContent = text;
    if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
    return b;
}
