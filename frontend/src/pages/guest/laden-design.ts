/* Laden-Design der Gaeste-Seite: Theme holen und anwenden (theme.ts, erster
 * Einsatz ueberhaupt in der App - siehe index.ts, Dateikopf).
 *
 * wendeThemeAn() setzt NICHT restaurantName: das bleibt Zustand von index.ts
 * (dort auch aus GastStatusAntwort befuellt) - der Aufrufer entscheidet, ob
 * der Theme-Name als Rueckfall uebernommen wird (siehe index.ts,
 * ladeThemeUndSpeisekarte).
 *
 * DAS ist die Stelle, an der die Plan-1-Kontrast-Rechnung zum ersten Mal
 * greift: Knopf-Textfarbe wird aus der Akzentfarbe berechnet (nicht mehr
 * immer weiss), Text-Textfarbe aus dem Laden-Hintergrund. "dunkel" kommt
 * jetzt aus theme.darkMode (Backend-Feld seit 28.08.2026): setzeLadenDesign
 * setzt data-theme="dark" bzw. entfernt es. Der Laden-Hintergrund-Hex bleibt
 * fuehrend fuer --ox-text (Luminanz-Rechnung), die dunkle Haut tauscht
 * zusaetzlich Flaechen/Rahmen/Signalfarben. */

import { api } from "../../lib/api";
import { setzeLadenDesign } from "../../lib/theme";
import type { LadenTheme } from "../../lib/types";

export function ladeTheme(restaurantId: number): Promise<LadenTheme> {
    return api<LadenTheme>(`/api/guest/theme/${restaurantId}`);
}

export function wendeThemeAn(theme: LadenTheme): void {
    setzeLadenDesign({
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        shape: theme.styleShape,
        font: theme.displayFont,
        dunkel: theme.darkMode
    });

    if (theme.name) {
        document.title = `${theme.name} – Bestellen`;
    }

    // Cache-Buster wie in der alten Fassung (guest.js, loadTheme()): ohne ihn
    // bleibt ein ausgetauschtes Logo/Hintergrundbild im Browser-Cache haengen.
    const zeitstempel = `?v=${Date.now()}`;

    const logo = document.getElementById("brand-logo") as HTMLImageElement | null;
    if (logo) {
        if (theme.logoUrl) {
            logo.src = theme.logoUrl + zeitstempel;
            logo.hidden = false;
        } else {
            logo.removeAttribute("src");
            logo.hidden = true;
        }
    }

    // Hero-Band auf der Menue-Ansicht: dasselbe Hintergrundbild-Asset, das
    // frueher die ganze Seite hinterlegt hat, sitzt jetzt NUR hier als
    // Foto-Streifen (siehe guest.css, .ox-hero) - kein zweiter Upload-Platz,
    // kein Vollseiten-Hintergrund mehr (bewusste Vereinfachung, siehe
    // Design-Gespraech: klareres Lesen der Karte beim Scrollen).
    const hero = document.getElementById("menu-hero");
    if (hero) {
        if (theme.backgroundUrl) {
            hero.style.backgroundImage = `url("${theme.backgroundUrl}${zeitstempel}")`;
            hero.classList.add("ox-hero--bild");
        } else {
            hero.style.backgroundImage = "";
            hero.classList.remove("ox-hero--bild");
        }
    }
    const heroLogo = document.getElementById("hero-logo") as HTMLImageElement | null;
    if (heroLogo) {
        if (theme.logoUrl) {
            heroLogo.src = theme.logoUrl + zeitstempel;
            heroLogo.hidden = false;
        } else {
            heroLogo.removeAttribute("src");
            heroLogo.hidden = true;
        }
    }
    const heroName = document.getElementById("hero-name");
    if (heroName) heroName.textContent = theme.name || "";
}

/** Flieger-/Bestaetigungs-Modus aus dem Theme, auf die im Frontend genutzten
 *  Literale eingegrenzt (Fallback = Standard). */
export function leseModi(theme: LadenTheme): { fly: "PLUS" | "PHOTO"; confirm: "STAMP" | "CHECK" } {
    return {
        fly: theme.cartFlyStyle === "PHOTO" ? "PHOTO" : "PLUS",
        confirm: theme.orderConfirmStyle === "STAMP" ? "STAMP" : "CHECK"
    };
}
