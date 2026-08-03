/* Laden-Design: Akzentfarbe, Hintergrund und helle/dunkle Haut.
 *
 * Wichtig ist die Kontrast-Rechnung. Frueher stand auf der Akzentfarbe
 * IMMER weisser Text - bei einem gelben Akzent war der Knopf unlesbar.
 * Jetzt entscheidet die Helligkeit der Farbe, ob Schwarz oder Weiss
 * daraufkommt (Verfahren nach WCAG 2.1). */

/** Wirft bei ungueltiger Hex-Farbe, statt parseInt unten still NaN liefern
 *  zu lassen. Ohne diesen Waechter ist NaN >= NaN false, und textfarbeAuf
 *  faellt still auf #ffffff zurueck - genau der Fehler, den die Funktion
 *  eigentlich beheben soll. Bisher unerreichbar, weil nur setzeLadenDesign()
 *  ruft und dort istHexFarbe vorgeschaltet ist; ruft eine Seite luminanz,
 *  kontrast oder textfarbeAuf direkt auf, ist es scharf. */
function hexZuRgb(hex: string): [number, number, number] {
    if (!istHexFarbe(hex)) {
        throw new Error(`Ungueltige Hex-Farbe: "${hex}"`);
    }
    const roh = hex.replace("#", "");
    return [
        parseInt(roh.slice(0, 2), 16),
        parseInt(roh.slice(2, 4), 16),
        parseInt(roh.slice(4, 6), 16)
    ];
}

/** Relative Luminanz nach WCAG 2.1 (0 = Schwarz, 1 = Weiss). */
export function luminanz(hex: string): number {
    const [r, g, b] = hexZuRgb(hex).map((wert) => {
        const anteil = wert / 255;
        return anteil <= 0.03928
            ? anteil / 12.92
            : Math.pow((anteil + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhaeltnis zweier Farben (1 = gleich, 21 = Schwarz zu Weiss). */
export function kontrast(hexA: string, hexB: string): number {
    const a = luminanz(hexA);
    const b = luminanz(hexB);
    const hell = Math.max(a, b);
    const dunkel = Math.min(a, b);
    return (hell + 0.05) / (dunkel + 0.05);
}

/** Schwarz oder Weiss - was auf dieser Farbe besser lesbar ist. */
export function textfarbeAuf(hex: string): "#000000" | "#ffffff" {
    return kontrast(hex, "#000000") >= kontrast(hex, "#ffffff") ? "#000000" : "#ffffff";
}

/** Nur echte Hex-Farben durchlassen - das Backend prueft #rrggbb. */
function istHexFarbe(wert: unknown): wert is string {
    return typeof wert === "string" && /^#[0-9a-fA-F]{6}$/.test(wert);
}

/** Mischt zwei Hex-Farben linear je Kanal - dieselbe Rechnung wie die
 *  CSS-Funktion color-mix(in srgb, ...), mit der das Ergebnis unten
 *  tatsaechlich geschrieben wird. Dient hier nur der Kontrast-Vorabpruefung,
 *  bevor der fertige color-mix()-Ausdruck auf <html> landet. */
function mischeHex(hexA: string, hexB: string, anteilA: number): string {
    const [ar, ag, ab] = hexZuRgb(hexA);
    const [br, bg, bb] = hexZuRgb(hexB);
    const t = anteilA / 100;
    const kanal = (a: number, b: number) => Math.round(a * t + b * (1 - t)).toString(16).padStart(2, "0");
    return `#${kanal(ar, br)}${kanal(ag, bg)}${kanal(ab, bb)}`;
}

/** Gedaempfter, aber weiterhin WCAG-AA-lesbarer Ton fuer --ox-text-muted:
 *  dieselbe Textfarbe wie --ox-text, per color-mix() Richtung Hintergrund
 *  abgeschwaecht. Start bei 60% Textfarbe; reicht das nicht fuer 4.5:1 (z. B.
 *  bei einem mittelgrauen Laden-Hintergrund), wird der Anteil erhoeht. Reine
 *  Textfarbe (100%, = --ox-text selbst) erreicht laut WCAG-Rechnung immer
 *  mindestens ~4.58:1 gegen jeden Hintergrund - die Schleife terminiert also
 *  immer, bevor der Notanker unten noetig wird. */
function gedaempfterText(textfarbe: string, hintergrund: string): string {
    for (const anteil of [60, 70, 80, 90, 100]) {
        if (kontrast(mischeHex(textfarbe, hintergrund, anteil), hintergrund) >= 4.5) {
            return `color-mix(in srgb, ${textfarbe} ${anteil}%, ${hintergrund} ${100 - anteil}%)`;
        }
    }
    return textfarbe; // Notanker, falls Rundung den Grenzfall verschieben sollte
}

export interface LadenDesign {
    accentColor?: string | null;
    backgroundColor?: string | null;
    dunkel?: boolean;
}

/** Schreibt das Design des Ladens als Variablen auf <html>. */
export function setzeLadenDesign(design: LadenDesign): void {
    const wurzel = document.documentElement;

    if (design.dunkel) {
        wurzel.setAttribute("data-theme", "dark");
    } else {
        wurzel.removeAttribute("data-theme");
    }

    if (istHexFarbe(design.accentColor)) {
        wurzel.style.setProperty("--ox-accent", design.accentColor);
        wurzel.style.setProperty("--ox-accent-text", textfarbeAuf(design.accentColor));
    }

    if (istHexFarbe(design.backgroundColor)) {
        wurzel.style.setProperty("--ox-bg", design.backgroundColor);

        // Inline-Stile schlagen jede Stylesheet-Regel, auch die der dunklen
        // Haut (:root[data-theme="dark"]). Ohne dies bliebe --ox-text auf
        // dem Haut-Wert stehen, z. B. der helle Text der dunklen Haut auf
        // dem (haeufigen) hellen Laden-Hintergrund: fast-weiss auf fast-weiss.
        const textfarbe = textfarbeAuf(design.backgroundColor);
        wurzel.style.setProperty("--ox-text", textfarbe);
        wurzel.style.setProperty("--ox-text-muted", gedaempfterText(textfarbe, design.backgroundColor));
    }
}
