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

/** titelZusatz: menu-editor.ts nutzt dieselbe Funktion fuer die
 *  Hero-Pixelparitaet (siehe dessen index.ts), braucht als Editor-Werkzeug
 *  aber "Speisekarte" statt "Bestellen" im Tab-Titel - sonst klingt es wie
 *  die Gaeste-Ansicht selbst. Default bleibt "Bestellen" fuer guest/index.ts. */
export function wendeThemeAn(theme: LadenTheme, titelZusatz = "Bestellen"): void {
    setzeLadenDesign({
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        backgroundColor2: theme.backgroundColor2,
        shape: theme.styleShape,
        font: theme.displayFont,
        dunkel: theme.darkMode,
        layout: theme.menuLayout,
        hero: theme.heroStyle,
        textur: theme.textureStyle,
        control: theme.controlStyle,
        kategorie: theme.categoryStyle,
        bewegung: theme.motionLevel
    });

    if (theme.name) {
        document.title = `${theme.name} – ${titelZusatz}`;
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
        // SCHLICHT ist der Kopf OHNE Foto: dann wird das Bild auch gar nicht
        // erst geladen - der Laden hat sich fuer die reine Schrift
        // entschieden, ein Download waere reine Verschwendung. Ein spaeter
        // hinterlegtes Foto bleibt erhalten und erscheint wieder, sobald der
        // Laden auf BAND oder VOLL umstellt.
        if (theme.backgroundUrl && theme.heroStyle !== "SCHLICHT") {
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

    baueHeroLinks(theme);
    baueFooter(theme);
}

/** Ids der Ambiente-Fotos eines Ladens (Bildergalerie), in Anlegereihenfolge. */
export function ladeGalerieIds(restaurantId: number): Promise<number[]> {
    return api<number[]>(`/api/guest/restaurants/${restaurantId}/gallery`);
}

/** Baut den Foto-Streifen unter der Speisekarte - bleibt hidden ohne Fotos.
 *  Eigener Aufruf (nicht Teil von wendeThemeAn): menu-editor.ts nutzt
 *  wendeThemeAn ebenfalls fuer die Hero-Pixelparitaet, braucht die Galerie
 *  dort aber nicht - siehe index.ts (nur die Gaeste-Seite ruft dies auf). */
export async function zeigeGalerie(restaurantId: number): Promise<void> {
    const container = document.getElementById("menu-gallery");
    if (!container) return;
    let ids: number[];
    try {
        ids = await ladeGalerieIds(restaurantId);
    } catch {
        return; // Galerie ist rein dekorativ - kein Fehlerzustand noetig
    }
    container.textContent = "";
    for (const id of ids) {
        const bild = document.createElement("img");
        bild.className = "ox-galerie__bild";
        bild.src = `/api/guest/restaurants/gallery/${id}`;
        bild.alt = "";
        bild.setAttribute("loading", "lazy");
        container.appendChild(bild);
    }
    container.hidden = ids.length === 0;
}

/** Oeffnungszeiten/Adresse/Telefon - jede Zeile blendet sich einzeln aus,
 *  wenn der Laden sie nicht hinterlegt hat (kein leerer Footer-Rand ohne
 *  jede Angabe). Route-Link baut eine Google-Maps-Suche aus der Adresse
 *  (kein eigener Kartendienst/API-Key noetig). WhatsApp-Link nur, wenn eine
 *  Telefonnummer gesetzt ist - Ziffern-Extraktion reicht fuer wa.me. */
function baueFooter(theme: LadenTheme): void {
    const footer = document.getElementById("menu-footer");
    if (!footer) return;

    const hoursRow = document.getElementById("footer-hours-row");
    const hoursText = document.getElementById("footer-hours");
    if (hoursRow && hoursText) {
        hoursRow.hidden = !theme.openingHours;
        hoursText.textContent = theme.openingHours || "";
    }

    const addressRow = document.getElementById("footer-address-row");
    const addressText = document.getElementById("footer-address");
    const routeLink = document.getElementById("footer-route") as HTMLAnchorElement | null;
    if (addressRow && addressText && routeLink) {
        addressRow.hidden = !theme.address;
        addressText.textContent = theme.address || "";
        routeLink.href = theme.address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(theme.address)}`
            : "#";
    }

    const phoneRow = document.getElementById("footer-phone-row");
    const phoneLink = document.getElementById("footer-phone") as HTMLAnchorElement | null;
    const whatsappLink = document.getElementById("footer-whatsapp") as HTMLAnchorElement | null;
    if (phoneRow && phoneLink && whatsappLink) {
        phoneRow.hidden = !theme.phone;
        if (theme.phone) {
            phoneLink.href = `tel:${theme.phone.replace(/\s+/g, "")}`;
            const ziffern = theme.phone.replace(/[^0-9]/g, "");
            whatsappLink.href = `https://wa.me/${ziffern}`;
            whatsappLink.hidden = ziffern.length < 6;
        }
    }

    footer.hidden = !theme.openingHours && !theme.address && !theme.phone;
}

/** Nur gesetzte Social-Links (Instagram/Facebook/Webseite) werden angezeigt -
 *  der Container bleibt hidden, wenn keiner gesetzt ist (kein leerer
 *  Platzhalter-Streifen im Hero). */
function baueHeroLinks(theme: LadenTheme): void {
    const container = document.getElementById("hero-links");
    if (!container) return;
    container.textContent = "";

    const eintraege: Array<[string, string | null]> = [
        ["Instagram", theme.instagramUrl],
        ["Facebook", theme.facebookUrl],
        ["Webseite", theme.websiteUrl]
    ];
    for (const [beschriftung, url] of eintraege) {
        if (!url) continue;
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "ox-hero__link";
        a.textContent = beschriftung;
        container.appendChild(a);
    }
    container.hidden = container.childElementCount === 0;
}

/** Flieger-/Bestaetigungs-Modus aus dem Theme, auf die im Frontend genutzten
 *  Literale eingegrenzt (Fallback = Standard). */
export function leseModi(theme: LadenTheme): { fly: "PLUS" | "PHOTO"; confirm: "STAMP" | "CHECK" } {
    return {
        fly: theme.cartFlyStyle === "PHOTO" ? "PHOTO" : "PLUS",
        confirm: theme.orderConfirmStyle === "STAMP" ? "STAMP" : "CHECK"
    };
}

/** Die beiden Struktur-Achsen, die menu.ts beim Zeichnen braucht (die
 *  uebrigen wirken rein ueber CSS, siehe theme.ts). Unbekannte Werte fallen
 *  auf den Standard zurueck, damit ein neuerer Server die Seite nie
 *  durcheinanderbringt. */
export function leseStruktur(theme: LadenTheme): { layout: string; kategorieStil: string } {
    const LAYOUTS = ["LISTE", "KACHELN", "TAFEL"];
    const STILE = ["REITER", "HAMBURGER", "KAPITEL"];
    return {
        layout: LAYOUTS.includes(theme.menuLayout) ? theme.menuLayout : "LISTE",
        kategorieStil: STILE.includes(theme.categoryStyle) ? theme.categoryStyle : "REITER"
    };
}
