/* Vorhang-Animation beim Oeffnen der Speisekarte (Design-Achse introStyle:
 * HOCHKLAPPEN | FADE | MITTE | VORHANG, siehe Restaurant/DesignRequest).
 *
 * Spielt bei JEDEM Seitenaufruf (Entscheidung vom 19.09.2026). Vorher lief er
 * nur einmal pro Gast, gemerkt ueber ein localStorage-Flag - der Auftakt war
 * damit fuer den Gast, der die Seite am Tisch noch einmal oeffnet, weg. Der
 * Merker ist ersatzlos entfallen, deshalb braucht die Funktion auch keinen
 * guestToken mehr.
 *
 * Wichtig fuer das Verstaendnis, wie oft das wirklich ist: die Gaeste-Seite
 * wechselt ihre Ansichten OHNE Seitenwechsel (zeigeAnsicht in index.ts blendet
 * nur um). Der Weg Speisekarte -> Warenkorb -> Bestellungen loest also keinen
 * Vorhang aus; nur ein echtes Neuladen im Browser tut es.
 *
 * Respektiert bewegungAus() wie der Rest der Bewegungen.
 *
 * Optional: Logo (theme.logoUrl, kein neuer Upload-Platz - das bestehende
 * Design-Logo wird wiederverwendet) + kurzer Text (theme.introText) blenden
 * sich zentriert waehrend des Vorhangs ein. Nur dann haelt der Vorhang kurz
 * (HALT_MIT_MARKE_MS) an, bevor er aufgeht - sonst laeuft er direkt durch
 * wie zuvor, keine Verhaltensaenderung ohne gesetzte Marke.
 *
 * Tempo (theme.introSpeed: LANGSAM|NORMAL|SCHNELL) skaliert die in CSS
 * hinterlegte Grund-Dauer jedes Stils (BASIS_DAUER_MS) ueber die Variable
 * --ox-vorhang-dauer auf dem Container - die CSS-Datei (vorhang.css) kennt
 * dieselben Grundwerte nur noch als Rueckfall, falls die Variable fehlt. */

import { bewegungAus } from "./animation";
import { textfarbeAuf } from "../../lib/theme";

/** Lesezeit fuer Logo/Willkommenstext. Bewusst NICHT von introSpeed
 *  abgeleitet: Tempo betrifft die Vorhang-Bewegung, die Lesezeit eines
 *  Menschen ist etwas anderes - deshalb die eigene Achse introHold.
 *  OHNE ist ausdruecklich erlaubt: der Laden zeigt seine Marke, laesst den
 *  Gast aber nicht warten (spuerbar, seit der Vorhang bei JEDEM Aufruf
 *  spielt - siehe Dateikopf). */
const HALT_MS: Record<string, number> = {
    OHNE: 0,
    KURZ: 800,
    NORMAL: 2000,
    LANG: 3500
};
const GUELTIGE_HALTEZEITEN = new Set(Object.keys(HALT_MS));

/** Logo-Groessen auf dem Vorhang. KLEIN ist der bisherige Wert (64px, so
 *  gross wie in der Kopfzeile); GROSS traegt einen ganzen Bildschirm, wenn
 *  kein Text daneben steht. Die Pixelwerte stehen in vorhang.css, hier nur
 *  die Zuordnung zur Klasse. */
const LOGO_KLASSE: Record<string, string> = {
    KLEIN: "ox-vorhang__marke-logo--klein",
    GROSS: "ox-vorhang__marke-logo--gross"
};

/** Merker fuer introRepeat = EINMAL. Bewusst pro LADEN, nicht pro Gast:
 *  "einmal" meint aus Sicht des Gastes "einmal auf diesem Handy in diesem
 *  Laden". Ein Gast, der neu scannt, bekommt einen neuen guestToken - mit
 *  einem Token-Schluessel liefe der Vorhang trotz EINMAL wieder. */
const SCHLUESSEL_PREFIX = "ox-intro-laden-";
const GUELTIGE_STILE = new Set(["HOCHKLAPPEN", "FADE", "MITTE", "VORHANG", "KINO"]);
const ZWEI_HAELFTEN = new Set(["MITTE", "VORHANG", "KINO"]);
/** Stile mit Vorhangstange oben. */
const MIT_STANGE = new Set(["VORHANG", "KINO"]);

/** Muss zu den ms-Rueckfallwerten in vorhang.css passen (dort als
 *  var(--ox-vorhang-dauer, XXXms) hinterlegt). */
const BASIS_DAUER_MS: Record<string, number> = {
    HOCHKLAPPEN: 600,
    FADE: 550,
    MITTE: 650,
    VORHANG: 750,
    // KINO hat mehrere Bewegungen nacheinander (Vorhang, Leinwand breit,
    // Leinwand hoch, Licht). Diese Zahl ist die GESAMTdauer; die einzelnen
    // Teile rechnen sich in vorhang.css als Bruchteil davon aus, damit das
    // Tempo des Ladens (introSpeed) weiterhin alles gemeinsam skaliert.
    // Die Vorlage braucht rund 6 s - fuer jemanden, der am Tisch bestellen
    // will, ist das zu lang, deshalb auf 1,8 s zusammengezogen.
    KINO: 1800
};

const GUELTIGE_GESCHWINDIGKEITEN = new Set(["LANGSAM", "NORMAL", "SCHNELL"]);
const GESCHWINDIGKEIT_FAKTOR: Record<string, number> = {
    LANGSAM: 1.6,
    NORMAL: 1,
    SCHNELL: 0.6
};

/** Eigener kleiner Waechter: lib/theme.ts haelt seinen istHexFarbe privat,
 *  und textfarbeAuf() wirft bei ungueltiger Farbe. Ein kaputter Wert aus der
 *  Datenbank darf den Auftakt nicht mit einer Ausnahme abbrechen. */
function istHexFarbe(wert: unknown): wert is string {
    return typeof wert === "string" && /^#[0-9a-fA-F]{6}$/.test(wert);
}

export interface VorhangTheme {
    introStyle: string;
    introText?: string | null;
    logoUrl?: string | null;
    introSpeed?: string | null;
    /** Eigene Vorhangfarbe; fehlt sie, faerbt die Akzentfarbe den Stoff. */
    introColor?: string | null;
    introLogo?: string | null;
    introHold?: string | null;
    introRepeat?: string | null;
    /** Vorhang-Bild des Ladens (AssetKind.INTRO), null wenn keins da ist. */
    introImageUrl?: string | null;
    /** AUFGELEGT = liegt mittig auf dem Vorhang, FLAECHE = IST der Vorhang. */
    introImageStyle?: string | null;
    /** Nur fuer introRepeat = EINMAL noetig (Merker-Schluessel). */
    id?: number;
}

/** Hat dieser Laden auf diesem Geraet schon einmal gespielt?
 *  Nur gefragt, wenn introRepeat = EINMAL. Ohne Laden-Id (oder ohne
 *  Speicher, z. B. privater Modus) wird nichts gemerkt und der Vorhang
 *  spielt - lieber einmal zu viel als ein Auftakt, der nie kommt. */
function schonGespielt(ladenId?: number): boolean {
    if (!ladenId) return false;
    try {
        return localStorage.getItem(SCHLUESSEL_PREFIX + ladenId) === "1";
    } catch {
        return false;
    }
}

function merkeGespielt(ladenId?: number): void {
    if (!ladenId) return;
    try {
        localStorage.setItem(SCHLUESSEL_PREFIX + ladenId, "1");
    } catch { /* privater Modus - dann spielt er eben wieder */ }
}

/** Baut den Vorhang, haengt ihn an document.body und entfernt ihn nach der
 *  Animation wieder selbst - der Aufrufer muss sich um nichts kuemmern. */
export function zeigeVorhang(theme: VorhangTheme): void {
    if (bewegungAus()) return;
    if (theme.introRepeat === "EINMAL") {
        if (schonGespielt(theme.id)) return;
        merkeGespielt(theme.id);
    }

    const stilSicher = GUELTIGE_STILE.has(theme.introStyle) ? theme.introStyle : "HOCHKLAPPEN";
    const text = (theme.introText || "").trim();
    // Das Logo ist dasselbe Design-Logo wie in der Kopfzeile; OHNE laesst es
    // nur auf dem Vorhang weg.
    const logoKlasse = LOGO_KLASSE[theme.introLogo || "KLEIN"];
    const zeigeLogo = Boolean(theme.logoUrl) && Boolean(logoKlasse);

    // Das Vorhang-Bild kann zweierlei sein: ein Plakat AUF dem Stoff
    // (AUFGELEGT, gehoert dann in die Marke wie Logo und Text) oder der Stoff
    // SELBST (FLAECHE, dann traegt es der Vorhang als Hintergrund und die
    // Falten treten zurueck - Samtfalten ueber einem Foto werden matschig).
    // Bewusst OHNE Cache-Buster: der Vorhang spielt seit dem 19.09. bei jedem
    // Seitenaufruf, ein erzwungener Neu-Download waere auf dem Handy teuer.
    // Der Endpunkt erlaubt 10 Minuten Zwischenspeicher (GuestController).
    const bildUrl = theme.introImageUrl || null;
    const bildFuelltFlaeche = Boolean(bildUrl) && theme.introImageStyle === "FLAECHE";
    const zeigeBildAufgelegt = Boolean(bildUrl) && !bildFuelltFlaeche;

    const hatMarke = Boolean(text) || zeigeLogo || zeigeBildAufgelegt;

    const geschwindigkeitSicher = GUELTIGE_GESCHWINDIGKEITEN.has(theme.introSpeed || "")
        ? (theme.introSpeed as string)
        : "NORMAL";
    const dauerMs = Math.round(BASIS_DAUER_MS[stilSicher] * GESCHWINDIGKEIT_FAKTOR[geschwindigkeitSicher]);
    const haltSicher = GUELTIGE_HALTEZEITEN.has(theme.introHold || "") ? (theme.introHold as string) : "NORMAL";

    const vorhang = document.createElement("div");
    vorhang.className = `ox-vorhang ox-vorhang--${stilSicher.toLowerCase()}`;
    vorhang.setAttribute("aria-hidden", "true");
    vorhang.style.setProperty("--ox-vorhang-dauer", `${dauerMs}ms`);

    // Eigene Vorhangfarbe: faerbt Stoff UND Marke. Die Schriftfarbe wird
    // dabei NEU gerechnet (textfarbeAuf) statt --ox-accent-text zu erben -
    // sonst stuende die Kontrastfarbe der Akzentfarbe auf einem ganz anderen
    // Ton, und ein dunkler Vorhang bekaeme schwarzen Text. Die Falten sind
    // ein halbdurchsichtiges SVG darueber und faerben sich automatisch mit.
    if (bildFuelltFlaeche) {
        vorhang.classList.add("ox-vorhang--bild");
        vorhang.style.setProperty("--ox-vorhang-bild", `url("${bildUrl}")`);
    }

    if (istHexFarbe(theme.introColor)) {
        vorhang.style.setProperty("--ox-vorhang-farbe", theme.introColor as string);
        vorhang.style.setProperty("--ox-vorhang-text", textfarbeAuf(theme.introColor as string));
    }

    if (ZWEI_HAELFTEN.has(stilSicher)) {
        const links = document.createElement("div");
        links.className = "ox-vorhang__feld ox-vorhang__feld--links";
        const rechts = document.createElement("div");
        rechts.className = "ox-vorhang__feld ox-vorhang__feld--rechts";
        const stange = MIT_STANGE.has(stilSicher) ? document.createElement("div") : null;
        if (stange) stange.className = "ox-vorhang__stange";

        if (stilSicher === "KINO") {
            // Die Leinwand liegt HINTER dem Vorhang, nicht um ihn herum.
            // Erster Versuch war andersherum (Vorhang als Kind der Leinwand)
            // - dann hing der Vorhang als kleines Rechteck mitten im
            // schwarzen Saal, statt den Bildschirm zu fuellen. Jetzt:
            // Vorhang zu = ganzer Bildschirm, wie bei jedem anderen Stil.
            // Erst beim Aufgehen kommt dahinter das kleine, dunkel gerahmte
            // Bildfenster zum Vorschein und dehnt sich aus.
            const leinwand = document.createElement("div");
            leinwand.className = "ox-vorhang__leinwand";
            vorhang.appendChild(leinwand);
        }
        vorhang.append(links, rechts);
        if (stange) vorhang.appendChild(stange);
    } else {
        const feld = document.createElement("div");
        feld.className = "ox-vorhang__feld";
        vorhang.appendChild(feld);
    }

    if (hatMarke) {
        const marke = document.createElement("div");
        marke.className = "ox-vorhang__marke";
        if (zeigeBildAufgelegt) {
            // Zuoberst und am groessten: wer ein Plakat aufhaengt, will es
            // zuerst sehen. object-fit: contain schneidet nichts ab - es ist
            // ein Bildwerk, kein Hintergrund (Optik: vorhang.css).
            const bild = document.createElement("img");
            bild.className = "ox-vorhang__marke-bild";
            bild.src = bildUrl as string;
            bild.alt = "";
            marke.appendChild(bild);
        }
        if (zeigeLogo) {
            const logo = document.createElement("img");
            logo.className = `ox-vorhang__marke-logo ${logoKlasse}`;
            logo.src = theme.logoUrl as string;
            logo.alt = "";
            marke.appendChild(logo);
        }
        if (text) {
            const beschriftung = document.createElement("span");
            beschriftung.className = "ox-vorhang__marke-text";
            beschriftung.textContent = text;
            marke.appendChild(beschriftung);
        }
        vorhang.appendChild(marke);
    }

    document.body.appendChild(vorhang);

    // Ohne Marke gibt es nichts zu lesen - dann haelt der Vorhang nie an,
    // egal was introHold sagt.
    const haltMs = hatMarke ? HALT_MS[haltSicher] : 0;
    // Erst rendern (Ausgangszustand), dann im naechsten Frame die Marke einblenden
    // (falls vorhanden) - sonst startet die Transition nicht sichtbar von ihrem
    // Anfang aus (gleiches Muster wie das Detail-Overlay in menu.ts). Die
    // "los"-Klasse fuer Vorhang-Bewegung + Marke-Ausblenden kommt erst nach dem
    // Halt, damit ohne Marke (haltMs=0) exakt das bisherige Verhalten bleibt.
    requestAnimationFrame(() => {
        if (hatMarke) vorhang.classList.add("ox-vorhang--marke-ein");
    });
    window.setTimeout(() => vorhang.classList.add("ox-vorhang--los"), haltMs);
    window.setTimeout(() => vorhang.remove(), haltMs + dauerMs);
}
