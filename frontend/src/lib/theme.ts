/* Laden-Design: Akzentfarbe, Hintergrund und helle/dunkle Haut.
 *
 * Wichtig ist die Kontrast-Rechnung. Frueher stand auf der Akzentfarbe
 * IMMER weisser Text - bei einem gelben Akzent war der Knopf unlesbar.
 * Jetzt entscheidet die Helligkeit der Farbe, ob Schwarz oder Weiss
 * daraufkommt (Verfahren nach WCAG 2.1). */

function hexZuRgb(hex: string): [number, number, number] {
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
    }
}
