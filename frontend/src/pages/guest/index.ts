/* Gaeste-Seite: die Klammer. Verdrahtet session.ts/menu.ts/cart.ts/orders.ts/
 * bill.ts zu einer Seite und ist der ERSTE Verbraucher von theme.ts.
 *
 * Ablauf: QR-Token lesen -> gemerkten guestToken nachschlagen, sonst scannen
 * -> SOFORT Theme + Speisekarte laden, view-menu zeigen (auch bei PENDING,
 * Bestellen gesperrt+Hinweis) -> Namensleiste einblenden -> Statusabfrage
 * starten, bei Freigabe entsperren -> als Gastgeber Beitritts-Anfragen
 * mitfuehren. Details siehe Bericht.
 *
 * Kein zweiter Takt fuer die SESSION: starteStatusAbfrage() (session.ts,
 * 3000 ms) bleibt einzige Quelle fuer Freigabe/Ablehnung, meldet aber nur bei
 * AENDERUNG von GastStatusAntwort - weder Beitritts-Anfragen noch
 * Bestell-Status stecken darin (geprueft: GuestStatusResponse.java kennt
 * keine der beiden Listen). Dafuer EIN eigener, schlanker Takt (LIVE_TAKT_MS)
 * - bewusst nur einer, nicht zwei, und nur aktiv, waehrend er etwas zu tun
 * hat. Abwaegung dazu im Bericht.
 *
 * Cache-Buster (?v=Zeitstempel) fuer Logo/Hintergrundbild aus der alten
 * Fassung uebernommen (guest.js, loadTheme()) - ohne ihn haengt ein
 * ausgetauschtes Bild im Browser-Cache fest. */

import "../../styles/app.css";
import "../../styles/fonts";
import "./guest.css";

import { api, ApiFehler } from "../../lib/api";
import { setzeLadenDesign } from "../../lib/theme";
import { el, tischmarke, toast, zeigeNur } from "../../lib/ui";
import { preis } from "../../lib/format";
import type { BeitrittsAnfrage, GastStatusAntwort, Gericht, Kategorie, LadenTheme, ScanAntwort } from "../../lib/types";

import {
    entscheideBeitritt,
    geleseneToken,
    holeBeitrittsAnfragen,
    holeStatus,
    leseQrToken,
    merkeToken,
    rufeKellner,
    scanne,
    setzeName,
    starteStatusAbfrage
} from "./session";
import { ladeSpeisekarte, oeffneDetail, setzeBestellenErlaubt, zeichneSpeisekarte } from "./menu";
import { Warenkorb, bestelle } from "./cart";
import type { WarenkorbZeile } from "./cart";
import { holeMeineBestellungen, zeichneBestellungen } from "./orders";
import { holeRechnung, zeichneRechnung } from "./bill";
import type { Auswahl } from "./bill";

/* ---------- Zustand ---------- */

let qrToken = "";
let guestToken = "";
let istGastgeber = false;
let meinName = "";
let tischNummer = 0;
let restaurantId = 0;
let restaurantName = "";
let genehmigt = false;
let kategorien: Kategorie[] = [];

const warenkorb = new Warenkorb();
let aktuelleAuswahl: Auswahl | null = null;
let wartehinweisElement: HTMLParagraphElement | null = null;
let statusAbfrage: { stop(): void } | null = null;

/** Eigener, schlanker Takt fuer Beitritts-Anfragen/Bestell-Status - siehe
 *  Dateikopf. Derselbe Wert wie session.ts' (dort private) STANDARD_TAKT_MS,
 *  damit sich die ganze Seite fuer den Gast gleich "schnell" anfuehlt. */
const LIVE_TAKT_MS = 3000;
let liveDatenAktiv = false;
let liveDatenZeitgeber: ReturnType<typeof setTimeout> | null = null;

/* ---------- Kleiner DOM-Helfer (analog zu el() aus lib/ui.ts, nur fuer
   Knoepfe mit type="button" - dieselbe Kurzform wie in menu.ts, dort privat
   und nicht exportiert) ---------- */

function knopf(klasse: string, text: string, ariaLabel?: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = klasse;
    b.textContent = text;
    if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
    return b;
}

/* ---------- Ansichten ---------- */

const ANSICHTEN = ["view-wait", "view-error", "view-menu", "view-cart", "view-orders", "view-bill", "view-name"] as const;
type Ansicht = (typeof ANSICHTEN)[number];
const NAME_BAR_ANSICHTEN: readonly Ansicht[] = ["view-menu", "view-cart", "view-orders", "view-bill"];
const TITEL: Partial<Record<Ansicht, string>> = {
    "view-menu": "Speisekarte",
    "view-cart": "Warenkorb",
    "view-orders": "Deine Bestellungen",
    "view-bill": "Rechnung teilen",
    "view-name": "Wie heißt du?"
};

let aktuelleAnsicht: Ansicht = "view-wait";

function zeigeAnsicht(id: Ansicht): void {
    aktuelleAnsicht = id;
    zeigeNur(id, ANSICHTEN);

    const titel = document.getElementById("page-title");
    if (titel) titel.textContent = TITEL[id] ?? (restaurantName || "Willkommen!");

    const nameLeiste = document.getElementById("name-bar");
    if (nameLeiste) nameLeiste.hidden = !NAME_BAR_ANSICHTEN.includes(id);

    aktualisiereWarenkorbLeiste();
}

function zeigeFehler(titel: string, text: string): void {
    const titelFeld = document.getElementById("error-title");
    const textFeld = document.getElementById("error-text");
    if (titelFeld) titelFeld.textContent = titel;
    if (textFeld) textFeld.textContent = text;
    const banner = document.getElementById("join-banner");
    if (banner) banner.hidden = true;
    zeigeAnsicht("view-error");
}

/* ---------- Start: Scan / Wiederaufnahme ---------- */

async function start(): Promise<void> {
    qrToken = leseQrToken();
    if (!qrToken) {
        zeigeFehler("Kein Tisch-Code gefunden", "Bitte den QR-Code am Tisch scannen.");
        return;
    }
    zeigeAnsicht("view-wait");

    const gemerkt = geleseneToken(qrToken);
    if (!gemerkt) {
        await neuScannen();
        return;
    }
    guestToken = gemerkt;
    try {
        await nachErstemStatus(await holeStatus(guestToken));
    } catch {
        // Gemerkter Token ungueltig/abgelaufen -> frisch scannen (wie die alte Fassung: resume() -> scan()).
        await neuScannen();
    }
}

/** Legt eine NEUE Person an - auch als "Erneut versuchen" auf view-error:
 *  TableSessionService.scan() verwendet eine abgelehnte/verfallene Sitzung
 *  nie wieder, ausser der 5-Minuten-Cooldown des Tisches greift noch (dann
 *  meldet das die Fehlermeldung unten wortgleich vom Server). */
async function neuScannen(): Promise<void> {
    if (!qrToken) {
        zeigeFehler("Kein Tisch-Code gefunden", "Bitte den QR-Code am Tisch scannen.");
        return;
    }
    zeigeAnsicht("view-wait");
    try {
        const antwort = await scanne(qrToken);
        guestToken = antwort.guestToken;
        merkeToken(qrToken, guestToken);
        await nachErstemStatus(ausScan(antwort));
    } catch (fehler) {
        if (fehler instanceof ApiFehler && fehler.status === 404) {
            zeigeFehler("QR-Code ungültig", "Bitte das Personal ansprechen.");
        } else {
            zeigeFehler("Das hat nicht geklappt", (fehler as Error).message);
        }
    }
}

/** ScanResponse nennt den Namen "guestName", GastStatusAntwort "name" (siehe
 *  types.ts) - hier vereinheitlicht, damit wendeStatusAn nur EINE Form kennt. */
function ausScan(antwort: ScanAntwort): GastStatusAntwort {
    return {
        guestStatus: antwort.guestStatus,
        sessionStatus: antwort.sessionStatus,
        isHost: antwort.isHost,
        name: antwort.guestName,
        tableNumber: antwort.tableNumber,
        restaurantId: antwort.restaurantId,
        restaurantName: antwort.restaurantName
    };
}

async function nachErstemStatus(status: GastStatusAntwort): Promise<void> {
    const weiter = wendeStatusAn(status, true);
    if (!weiter) return;
    await ladeThemeUndSpeisekarte();
    zeigeAnsicht("view-menu");
    statusAbfrage = starteStatusAbfrage(guestToken, (neu) => wendeStatusAn(neu, false));
}

/** Zentrale Statuslogik - beim ersten Aufruf UND bei jeder spaeteren
 *  Aenderung aus der laufenden Statusabfrage. guestStatus/sessionStatus
 *  werden wie in session.ts' Dateikopf beschrieben EINZELN geprueft.
 *  Liefert false bei einem Endzustand (view-error wird dann schon gezeigt). */
function wendeStatusAn(status: GastStatusAntwort, istErsterAufruf: boolean): boolean {
    istGastgeber = status.isHost;
    meinName = status.name;
    tischNummer = status.tableNumber;
    restaurantId = status.restaurantId;
    if (status.restaurantName) restaurantName = status.restaurantName;
    aktualisiereNameAnzeige();
    aktualisiereTischmarke();

    if (status.guestStatus === "REJECTED") {
        beendeMitFehler("Nicht freigegeben", istGastgeber
            ? "Das Personal hat die Anfrage abgelehnt."
            : "Der Tisch hat dich nicht reingelassen. Bitte sprich das Personal an.");
        return false;
    }
    if (status.sessionStatus === "REJECTED" || status.sessionStatus === "EXPIRED") {
        beendeMitFehler("Anfrage nicht freigegeben", "Bitte sprich kurz das Personal an.");
        return false;
    }
    if (status.sessionStatus === "CLOSED") {
        beendeMitFehler("Sitzung beendet", "Bitte den QR-Code neu scannen.");
        return false;
    }

    const warGenehmigt = genehmigt;
    genehmigt = status.guestStatus === "APPROVED" && status.sessionStatus === "APPROVED";
    setzeBestellenErlaubt(genehmigt);
    zeigeWartehinweis(!genehmigt);
    aktualisiereFreigabeKnoepfe();
    if (genehmigt && !warGenehmigt && !istErsterAufruf) {
        toast("Der Tisch wurde freigegeben – du kannst jetzt bestellen!");
    }
    aktualisiereLiveDatenTakt();
    return true;
}

function beendeMitFehler(titel: string, text: string): void {
    statusAbfrage?.stop();
    statusAbfrage = null;
    liveDatenAktiv = false;
    if (liveDatenZeitgeber !== null) {
        clearTimeout(liveDatenZeitgeber);
        liveDatenZeitgeber = null;
    }
    genehmigt = false;
    warenkorb.leeren();
    zeigeFehler(titel, text);
}

/* ---------- Laden-Design (theme.ts, erster Einsatz ueberhaupt) ---------- */

function ladeTheme(restaurantId: number): Promise<LadenTheme> {
    return api<LadenTheme>(`/api/guest/theme/${restaurantId}`);
}

/** DAS ist die Stelle, an der die Plan-1-Kontrast-Rechnung zum ersten Mal
 *  greift: Knopf-Textfarbe wird aus der Akzentfarbe berechnet (nicht mehr
 *  immer weiss), Text-Textfarbe aus dem Laden-Hintergrund. "dunkel" wird
 *  bewusst NICHT gesetzt - das Feld gibt es im Backend noch nicht, die Seite
 *  bleibt bis dahin hell (theme.ts: ohne design.dunkel wird nur das
 *  data-theme-Attribut entfernt, nichts erzwungen). */
function wendeThemeAn(theme: LadenTheme): void {
    setzeLadenDesign({ accentColor: theme.accentColor, backgroundColor: theme.backgroundColor });

    if (theme.name) {
        document.title = `${theme.name} – Bestellen`;
        if (!restaurantName) restaurantName = theme.name;
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

    if (theme.backgroundUrl) {
        document.body.classList.add("ox-bg-bild");
        document.body.style.backgroundImage = `url("${theme.backgroundUrl}${zeitstempel}")`;
    } else {
        document.body.classList.remove("ox-bg-bild");
        document.body.style.backgroundImage = "";
    }
}

/* ---------- Speisekarte laden + Warenkorb wiederherstellen ---------- */

/** Theme und Speisekarte laufen PARALLEL; das Theme ist fachlich optional
 *  (fehlt es, bleibt die Standard-Optik aus tokens.css). allSettled() statt
 *  all(), damit ein Fehlschlag des einen den anderen nicht mit reisst. */
async function ladeThemeUndSpeisekarte(): Promise<void> {
    const [themeErgebnis, menuErgebnis] = await Promise.allSettled([
        ladeTheme(restaurantId),
        ladeSpeisekarte(restaurantId)
    ]);

    if (themeErgebnis.status === "fulfilled") {
        wendeThemeAn(themeErgebnis.value);
    }
    const hamburgerModus = themeErgebnis.status === "fulfilled" && themeErgebnis.value.categoriesAsHamburger;

    kategorien = menuErgebnis.status === "fulfilled" ? menuErgebnis.value : [];
    const ziel = document.getElementById("menu-container");
    if (ziel) zeichneSpeisekarte(kategorien, ziel, beiGerichtAusgewaehlt, genehmigt, hamburgerModus);
    if (menuErgebnis.status === "rejected") {
        toast("Speisekarte konnte nicht geladen werden.", true);
    }

    warenkorb.stelleWiederHer(guestToken, kategorien);
    aktualisiereWarenkorbLeiste();
}

/** menu.ts unterscheidet "Foto/Name antippen" und "+ antippen" nicht (beide
 *  rufen beiAuswahl mit demselben Gericht auf, siehe menu.ts) - hier darum
 *  fuer beide dasselbe: das Detail-Overlay oeffnen, Menge/Hinweis waehlen. */
function beiGerichtAusgewaehlt(gericht: Gericht): void {
    oeffneDetail(gericht, beiHinzufuegen, genehmigt);
}

function beiHinzufuegen(gericht: Gericht, menge: number, hinweis: string): void {
    warenkorb.hinzufuegen(gericht, menge, hinweis);
    warenkorb.sichere(guestToken);
    aktualisiereWarenkorbLeiste();
    toast(`${menge}× ${gericht.name} hinzugefügt`);
}

/** Persistenter Hinweis oben in view-menu, solange nicht genehmigt. Wird
 *  EINMAL lazy angelegt (Text haengt vom Gastgeber-Status ab, der sich fuer
 *  eine Person nie aendert) und danach nur ein-/ausgeblendet - kein
 *  erneutes Zeichnen der Speisekarte darunter, siehe menu.ts. */
function zeigeWartehinweis(sichtbar: boolean): void {
    const menu = document.getElementById("view-menu");
    if (!menu) return;
    if (!wartehinweisElement) {
        wartehinweisElement = el("p", "ox-muted");
        wartehinweisElement.textContent = istGastgeber
            ? "Dein Tisch wird gleich freigegeben – bestellen kannst du, sobald es so weit ist."
            : "Der Gastgeber lässt dich gleich rein – bestellen kannst du, sobald es so weit ist.";
        menu.insertBefore(wartehinweisElement, menu.firstChild);
    }
    wartehinweisElement.hidden = !sichtbar;
}

/* ---------- Warenkorb-Ansicht (cart.ts liefert nur Daten, keine Anzeige) ---------- */

function zeigeWarenkorbAnsicht(): void {
    zeichneWarenkorb();
    zeigeAnsicht("view-cart");
}

function zeichneWarenkorb(): void {
    const ziel = document.getElementById("cart-lines");
    if (ziel) {
        ziel.textContent = "";
        for (const zeile of warenkorb.zeilen()) ziel.appendChild(baueWarenkorbZeile(zeile));
    }
    const summeFeld = document.getElementById("cart-total");
    if (summeFeld) summeFeld.textContent = "Summe: " + preis(warenkorb.summe());
}

/** Stepper wie im Detail-Overlay (menu.ts), aber mit Gerichtname im
 *  aria-label, da hier mehrere Zeilen gleichzeitig stehen koennen. Hinweis
 *  wird nur ANGEZEIGT: cart.ts bietet keine Methode, ihn nachtraeglich zu
 *  aendern - er wird ausschliesslich beim Hinzufuegen im Overlay gesetzt. */
function baueWarenkorbZeile(zeile: WarenkorbZeile): HTMLElement {
    const karte = el("article", "ox-card");

    const kopf = el("div", "ox-row");
    kopf.append(el("strong", undefined, zeile.name), el("span", "ox-spacer"), el("span", "ox-preis", preis(zeile.preis)));
    karte.appendChild(kopf);

    if (zeile.hinweis) karte.appendChild(el("p", "ox-muted", zeile.hinweis));

    const stepper = el("div", "ox-row");
    const minus = knopf("ox-btn ox-btn--geist ox-btn--klein", "−", `${zeile.name} – Menge verringern`);
    minus.addEventListener("click", () => { warenkorb.aendereMenge(zeile.gerichtId, -1, zeile.hinweis); nachWarenkorbAenderung(); });
    const plus = knopf("ox-btn ox-btn--geist ox-btn--klein", "+", `${zeile.name} – Menge erhöhen`);
    plus.addEventListener("click", () => { warenkorb.aendereMenge(zeile.gerichtId, 1, zeile.hinweis); nachWarenkorbAenderung(); });
    stepper.append(minus, el("strong", "ox-num", String(zeile.menge)), plus, el("span", "ox-spacer"),
        el("span", "ox-preis", preis(zeile.menge * zeile.preis)));
    karte.appendChild(stepper);

    return karte;
}

/** Faellt der Warenkorb auf leer, zurueck zur Speisekarte statt einer leeren
 *  view-cart (wie die alte Fassung, guest.js: changeQty() -> showMenu()). */
function nachWarenkorbAenderung(): void {
    warenkorb.sichere(guestToken);
    if (warenkorb.anzahl() === 0) {
        zeigeAnsicht("view-menu");
        return;
    }
    zeichneWarenkorb();
    aktualisiereWarenkorbLeiste();
}

function aktualisiereWarenkorbLeiste(): void {
    const leiste = document.getElementById("cartbar");
    if (!leiste) return;
    const anzahl = warenkorb.anzahl();
    const sichtbar = anzahl > 0 && aktuelleAnsicht === "view-menu";
    leiste.hidden = !sichtbar;
    if (sichtbar) {
        const info = document.getElementById("cartbar-info");
        if (info) info.textContent = `${anzahl} Artikel · ${preis(warenkorb.summe())}`;
    }
}

async function sendeBestellung(): Promise<void> {
    const knopf = document.getElementById("btn-send") as HTMLButtonElement | null;
    if (knopf) knopf.disabled = true;
    try {
        await bestelle(guestToken, warenkorb);
        aktualisiereWarenkorbLeiste();
        await aktualisiereBestellungen();
        zeigeAnsicht("view-orders");
        toast("Bestellung aufgegeben");
    } catch (fehler) {
        toast((fehler as Error).message, true);
    } finally {
        if (knopf) knopf.disabled = false;
    }
}

/* ---------- Bestellungen (orders.ts anbinden, kein eigener Takt hier -
   nur ein Aufruf, der Wiederholungsrhythmus kommt aus dem Live-Daten-Takt
   unten bzw. einmalig direkt nach dem Bestellen). ---------- */

async function aktualisiereBestellungen(): Promise<void> {
    const ziel = document.getElementById("orders-container");
    if (!ziel) return;
    try {
        zeichneBestellungen(await holeMeineBestellungen(guestToken), ziel);
    } catch {
        // naechster Takt versucht es erneut, solange view-orders sichtbar bleibt
    }
}

/* ---------- Rechnung ---------- */

function zeigeRechnungsAnsicht(): void {
    zeigeAnsicht("view-bill");
    const ziel = document.getElementById("bill-container");
    if (!ziel) return;
    holeRechnung(guestToken)
        .then((rechnung) => {
            zeichneRechnung(rechnung, ziel, (auswahl) => {
                aktuelleAuswahl = auswahl;
                aktualisiereAusgewaehlteSumme();
            });
        })
        .catch((fehler: unknown) => toast((fehler as Error).message, true));
}

function aktualisiereAusgewaehlteSumme(): void {
    const feld = document.getElementById("bill-selected");
    if (feld) feld.textContent = "Ausgewählt: " + preis(aktuelleAuswahl ? aktuelleAuswahl.summe() : 0);
}

/* ---------- Name (view-name ist NICHT mehr blockierend, siehe guest.html -
   nur ueber "Namen ändern" in der Namensleiste erreichbar). ---------- */

function aktualisiereNameAnzeige(): void {
    const feld = document.getElementById("my-name");
    if (feld) feld.textContent = meinName;
}

function oeffneNamensAnsicht(): void {
    const eingabe = document.getElementById("name-input") as HTMLInputElement | null;
    if (eingabe) {
        // Automatisch vergebene Namen ("Gast 3") nicht vorbefuellen - der Gast
        // soll aktiv tippen (wie die alte Fassung, guest.js: showNameGate()).
        eingabe.value = /^Gast\s*\d+$/i.test(meinName) ? "" : meinName;
    }
    zeigeAnsicht("view-name");
    window.setTimeout(() => eingabe?.focus(), 50);
}

async function speichereName(): Promise<void> {
    const eingabe = document.getElementById("name-input") as HTMLInputElement | null;
    const name = eingabe?.value.trim() ?? "";
    if (!name) {
        toast("Bitte gib deinen Namen ein", true);
        eingabe?.focus();
        return;
    }
    try {
        await setzeName(guestToken, name);
        meinName = name;
        aktualisiereNameAnzeige();
        toast("Name geändert");
        zeigeAnsicht("view-menu");
    } catch (fehler) {
        toast((fehler as Error).message, true);
    }
}

/* ---------- Kellner rufen ---------- */

async function rufeKellnerAn(): Promise<void> {
    const knopf = document.getElementById("btn-call") as HTMLButtonElement | null;
    try {
        await rufeKellner(guestToken);
        toast("Der Kellner wurde gerufen und kommt gleich.");
    } catch (fehler) {
        toast((fehler as Error).message, true);
        return;
    }
    // Kurze Sperre gegen Doppel-Rufe, wie die alte Fassung (guest.js, callWaiter()).
    if (knopf) {
        const beschriftung = knopf.textContent ?? "Kellner rufen";
        knopf.disabled = true;
        knopf.textContent = "Kellner gerufen";
        window.setTimeout(() => {
            knopf.disabled = false;
            knopf.textContent = beschriftung;
        }, 30000);
    }
}

/* ---------- Gastgeber: Beitritts-Anfragen ---------- */

async function aktualisiereBeitrittsAnfragen(): Promise<void> {
    try {
        zeichneJoinBanner(await holeBeitrittsAnfragen(guestToken));
    } catch {
        // naechster Takt versucht es erneut
    }
}

function zeichneJoinBanner(anfragen: BeitrittsAnfrage[]): void {
    const banner = document.getElementById("join-banner");
    if (!banner) return;
    banner.textContent = "";
    banner.hidden = anfragen.length === 0;
    for (const anfrage of anfragen) banner.appendChild(baueJoinKarte(anfrage));
}

function baueJoinKarte(anfrage: BeitrittsAnfrage): HTMLElement {
    const karte = el("article", "ox-card");
    // Name ueber el()/textContent (wie ueberall auf der Seite) - kein Markup aus dem Namen.
    karte.appendChild(el("p", undefined, `${anfrage.name} möchte an deinen Tisch. Reinlassen?`));
    const zeile = el("div", "ox-row");
    const ja = knopf("ox-btn ox-btn--gut ox-btn--klein", "Ja, reinlassen");
    ja.addEventListener("click", () => { void entscheide(anfrage.id, "approve"); });
    const nein = knopf("ox-btn ox-btn--gefahr ox-btn--klein", "Ablehnen");
    nein.addEventListener("click", () => { void entscheide(anfrage.id, "reject"); });
    zeile.append(ja, nein);
    karte.appendChild(zeile);
    return karte;
}

async function entscheide(joinerId: number, aktion: "approve" | "reject"): Promise<void> {
    try {
        await entscheideBeitritt(guestToken, joinerId, aktion);
        toast(aktion === "approve" ? "Person reingelassen" : "Abgelehnt");
    } catch (fehler) {
        toast((fehler as Error).message, true);
    }
    await aktualisiereBeitrittsAnfragen();
}

/* ---------- Live-Daten-Takt (Beitritts-Anfragen + Bestell-Status,
   siehe Dateikopf) ---------- */

function aktualisiereLiveDatenTakt(): void {
    if (genehmigt && !liveDatenAktiv) {
        liveDatenAktiv = true;
        if (istGastgeber) void aktualisiereBeitrittsAnfragen();
        planeLiveDatenTick();
    } else if (!genehmigt && liveDatenAktiv) {
        liveDatenAktiv = false;
        if (liveDatenZeitgeber !== null) {
            clearTimeout(liveDatenZeitgeber);
            liveDatenZeitgeber = null;
        }
    }
}

function planeLiveDatenTick(): void {
    liveDatenZeitgeber = setTimeout(() => {
        void (async () => {
            if (!document.hidden) {
                if (istGastgeber) await aktualisiereBeitrittsAnfragen();
                if (aktuelleAnsicht === "view-orders") await aktualisiereBestellungen();
            }
            if (liveDatenAktiv) planeLiveDatenTick();
        })();
    }, LIVE_TAKT_MS);
}

/* ---------- Tischmarke + Namensleisten-Knoepfe ---------- */

function aktualisiereTischmarke(): void {
    const badge = document.getElementById("table-badge");
    if (!badge) return;
    badge.textContent = "";
    badge.appendChild(tischmarke(tischNummer));
}

/** "Kellner rufen"/"Rechnung teilen" sind erst nach Freigabe sinnvoll -
 *  bleiben bis dahin hidden (Ausgangszustand in guest.html). */
function aktualisiereFreigabeKnoepfe(): void {
    const anruf = document.getElementById("btn-call");
    if (anruf) anruf.hidden = !genehmigt;
    const rechnung = document.getElementById("btn-bill");
    if (rechnung) rechnung.hidden = !genehmigt;
}

/* ---------- Ereignisse verdrahten ---------- */

function verdraheStatischeEreignisse(): void {
    document.getElementById("btn-retry")?.addEventListener("click", () => { void neuScannen(); });

    document.getElementById("btn-change-name")?.addEventListener("click", oeffneNamensAnsicht);
    document.getElementById("btn-name-save")?.addEventListener("click", () => { void speichereName(); });
    document.getElementById("name-input")?.addEventListener("keydown", (ereignis) => {
        if ((ereignis as KeyboardEvent).key === "Enter") void speichereName();
    });

    document.getElementById("btn-call")?.addEventListener("click", () => { void rufeKellnerAn(); });
    document.getElementById("btn-bill")?.addEventListener("click", zeigeRechnungsAnsicht);
    document.getElementById("btn-bill-back")?.addEventListener("click", () => zeigeAnsicht("view-menu"));
    document.getElementById("btn-bill-clear")?.addEventListener("click", () => aktuelleAuswahl?.leeren());

    document.getElementById("btn-cartbar-show")?.addEventListener("click", zeigeWarenkorbAnsicht);
    document.getElementById("btn-cart-back")?.addEventListener("click", () => zeigeAnsicht("view-menu"));
    document.getElementById("btn-send")?.addEventListener("click", () => { void sendeBestellung(); });

    document.getElementById("btn-orders-back")?.addEventListener("click", () => zeigeAnsicht("view-menu"));
}

/* ---------- Los geht's. Bewusst OHNE registriereServiceWorker() - Gaeste
   sollen die App nicht installieren (siehe guest.html, pwa.ts). ---------- */

verdraheStatischeEreignisse();
void start();
