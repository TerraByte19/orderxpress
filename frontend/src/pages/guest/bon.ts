/* Der Warenkorb der Gaeste-Seite als Kassenbon: Perforierung, Mono-Schrift,
 * Zeilen die sich nacheinander "eintippen". Beim Bestellen eine Bestaetigung
 * (Stempel oder Haken, Laden-Wahl), danach fliegt der Bon "zur Kueche" weg.
 * Vorlage: guest-prototype.html. */

import { bewegungAus } from "./animation";

export function schmueckeBon(karte: HTMLElement, zeilen: HTMLElement[]): void {
    karte.classList.add("ox-bon");
    zeilen.forEach((zeile, i) => {
        zeile.classList.add("ox-bon-zeile");
        zeile.style.animationDelay = `${i * 60}ms`;
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
    return new Promise((fertig) => {
        window.setTimeout(() => { karte.classList.remove("ox-bon--weg"); fertig(); }, 480);
    });
}
