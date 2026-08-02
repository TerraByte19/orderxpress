/* Kleine Helfer fuer die Oberflaeche. Kein Framework - nur DOM. */

let toastZeitgeber: number | undefined;

/** Kurze Einblend-Meldung am unteren Rand. */
export function toast(nachricht: string, istFehler = false): void {
    let element = document.querySelector<HTMLDivElement>(".ox-toast");
    if (!element) {
        element = document.createElement("div");
        element.className = "ox-toast";
        element.setAttribute("role", "status");
        element.setAttribute("aria-live", "polite");
        document.body.appendChild(element);
    }
    element.textContent = nachricht;
    element.className = "ox-toast is-open" + (istFehler ? " is-error" : "");

    window.clearTimeout(toastZeitgeber);
    toastZeitgeber = window.setTimeout(() => {
        element.className = "ox-toast" + (istFehler ? " is-error" : "");
    }, 3500);
}

/** Element bauen - spart das immergleiche createElement-Dreierpack. */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    klasse?: string,
    text?: string
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (klasse) element.className = klasse;
    if (text !== undefined) element.textContent = text;
    return element;
}

/** Element mit dieser Id ein- oder ausblenden. */
export function zeige(id: string, sichtbar: boolean): void {
    const element = document.getElementById(id);
    if (element) element.hidden = !sichtbar;
}

/** Genau EINE aus einer Gruppe von Ansichten zeigen. */
export function zeigeNur(sichtbareId: string, alleIds: readonly string[]): void {
    for (const id of alleIds) zeige(id, id === sichtbareId);
}

/** Rueckfrage vor einer nicht umkehrbaren Aktion. */
export function frage(text: string): boolean {
    return window.confirm(text);
}

/* Die Tischmarke - das Erkennungszeichen quer ueber alle Ansichten.
   Immer ueber diesen Helfer bauen, damit die fuehrende Null und die
   Beschriftung ueberall gleich sind. */
export function tischmarke(nummer: number, gross = false): HTMLSpanElement {
    const marke = document.createElement("span");
    marke.className = "ox-tischmarke" + (gross ? " ox-tischmarke--gross" : "");
    marke.textContent = `Tisch ${String(nummer).padStart(2, "0")}`;
    return marke;
}
