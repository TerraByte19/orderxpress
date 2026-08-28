/* Der Warenkorb der Gaeste-Seite als Kassenbon: Perforierung, Mono-Schrift,
 * Zeilen die sich nacheinander "eintippen". Beim Bestellen eine Bestaetigung
 * (Stempel oder Haken, Laden-Wahl), danach fliegt der Bon "zur Kueche" weg.
 * Vorlage: guest-prototype.html. */

import { bewegungAus } from "./animation";

export function schmueckeBon(karte: HTMLElement, zeilen: HTMLElement[]): void {
    // Beim ERSTEN Schmuecken tippen sich die Zeilen gestaffelt ein. Danach ist
    // .ox-bon schon da (index.ts baut #cart-lines bei jedem Mengen-Stepper neu
    // auf) - dann nur noch Mono/Abstand geben, das Eintippen NICHT erneut
    // abspielen (--still schaltet das Keyframe aus).
    const erstesMal = !karte.classList.contains("ox-bon");
    karte.classList.add("ox-bon");
    zeilen.forEach((zeile, i) => {
        zeile.classList.add("ox-bon-zeile");
        if (erstesMal) {
            zeile.style.animationDelay = `${i * 60}ms`;
        } else {
            zeile.classList.add("ox-bon-zeile--still");
        }
    });
}

export function bestaetigeBestellung(modus: "STAMP" | "CHECK"): Promise<void> {
    if (bewegungAus()) return Promise.resolve();

    const overlay = document.createElement("div");
    overlay.className = "ox-bestaetigung";
    overlay.setAttribute("aria-hidden", "true"); // rein dekorativ
    overlay.innerHTML = modus === "STAMP"
        ? `<span class="ox-stempel">ANGENOMMEN</span>`
        : `<svg class="ox-haken" viewBox="0 0 52 52">
             <circle class="ox-haken__kreis" cx="26" cy="26" r="24" fill="none" stroke-width="3"/>
             <path class="ox-haken__pfad" fill="none" stroke-width="4" stroke-linecap="round"
                   stroke-linejoin="round" d="M14 27 l8 8 l16 -18"/>
           </svg>`;
    document.body.appendChild(overlay);

    return new Promise((fertig) => {
        window.setTimeout(() => { overlay.remove(); fertig(); }, 900);
    });
}

export function fliegeBonWeg(karte: HTMLElement): Promise<void> {
    if (bewegungAus()) return Promise.resolve();
    karte.classList.add("ox-bon--weg");
    // Klasse bleibt bewusst DRAN: .ox-bon--weg traegt die transition, ein
    // sofortiges remove() liesse die Karte sichtbar zurueck ins Bild gleiten,
    // bevor die Ansicht auf view-orders wechselt. Zuruecksetzen erst beim
    // naechsten Oeffnen der Warenkorb-Ansicht (setzeBonZurueck).
    return new Promise((fertig) => {
        window.setTimeout(fertig, 480);
    });
}

/** Holt einen weggeflogenen Bon zurueck in die Ausgangslage. index.ts ruft
 *  das beim (Wieder-)Betreten der Warenkorb-Ansicht auf - dann ist
 *  #view-cart ausgeblendet, das Entfernen der Klasse loest also keine
 *  sichtbare Rueckwaerts-Animation aus. Bei ausgeschalteter Bewegung wurde
 *  nie eine Klasse gesetzt - der Aufruf ist dann ein harmloses No-op. */
export function setzeBonZurueck(karte: HTMLElement): void {
    karte.classList.remove("ox-bon--weg");
}
