/* Gaeste-Seite: die Klammer. Verdrahtet session.ts/menu.ts/cart.ts/orders.ts/
 * bill.ts zu einer Seite und ist der ERSTE Verbraucher von theme.ts. Drei
 * weitere Bausteine dieser Seite leben aus Groessengruenden in eigenen
 * Dateien (siehe Bericht zu Aufgabe 9): laden-design.ts (Theme holen/
 * anwenden), ansichten.ts (Ansichts-Inhalt, Kopf-/Namensleiste, Wartehinweis)
 * und live-daten.ts (der Takt, den der Dateikopf unten beschreibt). Der
 * Zustand und die Verdrahtung der Ablaeufe (Start, Warenkorb, Bestellungen,
 * Rechnung, Beitritts-Anfragen) bleiben bewusst HIER - sie teilen sich
 * denselben veraenderlichen Zustand und werden zur Laufzeit (nicht beim
 * Zeichnen) ausgewertet; siehe Bericht fuer die Abwaegung.
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
 * keine der beiden Listen). Dafuer EIN eigener, schlanker Takt (live-daten.ts)
 * - bewusst nur einer, nicht zwei, und nur aktiv, waehrend er etwas zu tun
 * hat. Abwaegung dazu im Bericht.
 *
 * Cache-Buster (?v=Zeitstempel) fuer Logo/Hintergrundbild aus der alten
 * Fassung uebernommen (guest.js, loadTheme()) - ohne ihn haengt ein
 * ausgetauschtes Bild im Browser-Cache fest. Liegt jetzt in laden-design.ts. */

import "../../styles/app.css";
import "../../styles/fonts";
import "./guest.css";

import { ApiFehler } from "../../lib/api";
import { el, toast } from "../../lib/ui";
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
import { ladeSpeisekarte, oeffneDetail, setzeBestellenErlaubt, zeichneSpeisekarte, zeigeSkelett } from "./menu";
import { fliegeZu, mitAnsichtsWechsel, staffelEin, zaehleHoch } from "./animation";
import { bestaetigeBestellung, fliegeBonWeg, schmueckeBon, setzeBonZurueck } from "./bon";
import { Warenkorb, bestelle } from "./cart";
import type { WarenkorbZeile } from "./cart";
import { holeMeineBestellungen, zeichneBestellungen } from "./orders";
import { holeRechnung, zeichneRechnung } from "./bill";
import type { Auswahl } from "./bill";
import { ladeTheme, leseModi, leseStruktur, wendeThemeAn, zeigeGalerie } from "./laden-design";
import { istVorschau, starteVorschau } from "./vorschau";
import { zeigeVorhang } from "./vorhang";
import {
    aktualisiereFreigabeKnoepfe,
    beobachteKopfhoehe,
    aktualisiereNameAnzeige,
    aktualisiereTischmarke,
    fuelleFehlerAnsicht,
    zeigeAnsichtInhalt,
    zeigeWartehinweis
} from "./ansichten";
import type { Ansicht } from "./ansichten";
import { starteLiveDatenTakt } from "./live-daten";

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
let aktuelleAnsicht: Ansicht = "view-wait";

/* Laden-Stile fuer die Bewegungen: Flieger als "+1" oder rundes Foto,
 * Bestell-Bestaetigung als Stempel oder Haken. Standard bis das Theme geladen
 * ist; danach aus leseModi() gesetzt (siehe ladeThemeUndSpeisekarte). */
let flyModus: "PLUS" | "PHOTO" = "PLUS";
let confirmModus: "STAMP" | "CHECK" = "CHECK";

/* Struktur-Achsen, die beim Zeichnen gebraucht werden (Karten-Aufbau und
 * Kategorien-Navigation). Die uebrigen Achsen wirken rein ueber CSS und
 * stehen nach wendeThemeAn() als data-Attribute auf <html>. */
let struktur = { layout: "LISTE", kategorieStil: "REITER" };

/* Letzte angezeigte Warenkorb-Summe - Ausgangswert fuer das Hochzaehlen in
 * der Warenkorb-Leiste (siehe aktualisiereWarenkorbLeiste). */
let letzteKorbSumme = 0;

const warenkorb = new Warenkorb();
let aktuelleAuswahl: Auswahl | null = null;
let statusAbfrage: { stop(): void } | null = null;

/** Siehe live-daten.ts: istGastgeber/aktuelleAnsicht werden dort ERST beim
 *  jeweiligen Tick gelesen (Rueckruf), nicht hier einmalig als Wert
 *  uebergeben - sonst wuerde der Takt einen zwischenzeitlichen Wechsel
 *  (Ansicht, Gastgeber-Rolle) verpassen. */
const liveDaten = starteLiveDatenTakt({
    istGastgeber: () => istGastgeber,
    aktuelleAnsicht: () => aktuelleAnsicht,
    aktualisiereBeitrittsAnfragen,
    aktualisiereBestellungen
});

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

/* ---------- Ansichten umschalten (Inhalt/Konstanten: ansichten.ts) ---------- */

function zeigeAnsicht(id: Ansicht): void {
    aktuelleAnsicht = id;
    mitAnsichtsWechsel(() => zeigeAnsichtInhalt(id, restaurantName));
    aktualisiereWarenkorbLeiste();
}

function zeigeFehler(titel: string, text: string): void {
    fuelleFehlerAnsicht(titel, text);
    zeigeAnsicht("view-error");
}

/* ---------- Start: Scan / Wiederaufnahme ---------- */

async function start(): Promise<void> {
    // Vorschau-Modus des Inhaber-Zuschnitt-Widgets (?vorschau=1&restaurant=<id>&fokus=<ziel>):
    // KEIN Scan, KEINE Statusabfrage, KEIN Live-Takt, KEIN Vorhang - nur Theme +
    // Speisekarte laden und ansehen. Der Zweig kehrt vor jeder Session-Logik zurueck.
    if (istVorschau()) {
        await starteVorschau({
            ladeTheme,
            ladeSpeisekarte,
            zeigeGalerie,
            wendeThemeAn: (theme) => {
                wendeThemeAn(theme as LadenTheme);
                // Die Vorschau soll den Aufbau des Ladens zeigen, nicht den
                // Standard - zeichneSpeisekarte laeuft direkt danach.
                struktur = leseStruktur(theme as LadenTheme);
            },
            zeichneSpeisekarte: (gerichte, hamburger) => {
                kategorien = Array.isArray(gerichte) ? (gerichte as Kategorie[]) : [];
                const ziel = document.getElementById("menu-container");
                if (!ziel) return;
                // Bestellen ist aus - die Rueckrufe (Detail/Schnell-Hinzufuegen)
                // bleiben nur als Signatur-Fueller, die "+"-Knoepfe sind per
                // CSS (:root[data-vorschau]) ohnehin verborgen. Hamburger-Modus
                // kommt aus dem Theme (vorschau.ts), damit die Vorschau die
                // echte Kategorien-Nav zeigt.
                zeichneSpeisekarte(kategorien, ziel, beiGerichtAusgewaehlt, beiSchnellHinzufuegen, false, hamburger,
                    undefined, false, struktur);
                staffelEin(Array.from(ziel.querySelectorAll<HTMLElement>(".ox-gericht")));
            },
            setzeBestellenErlaubt,
            zeigeAnsichtInhalt: (id) => zeigeAnsichtInhalt(id as Ansicht, restaurantName)
        });
        return;
    }

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
    aktualisiereNameAnzeige(meinName);

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
    zeigeWartehinweis(!genehmigt, istGastgeber);
    aktualisiereFreigabeKnoepfe(genehmigt);
    // Tischmarke atmet, solange nicht freigegeben - schnappt beim Uebergang ein.
    aktualisiereTischmarke(tischNummer, !genehmigt);
    if (genehmigt && !warGenehmigt && !istErsterAufruf) {
        toast("Der Tisch wurde freigegeben – du kannst jetzt bestellen!");
    }
    liveDaten.aktualisiere(genehmigt);
    return true;
}

function beendeMitFehler(titel: string, text: string): void {
    statusAbfrage?.stop();
    statusAbfrage = null;
    liveDaten.stoppe();
    genehmigt = false;
    warenkorb.leeren();
    const ordersKnopf = document.getElementById("btn-orders");
    if (ordersKnopf) ordersKnopf.hidden = true;
    zeigeFehler(titel, text);
}

/* ---------- Speisekarte laden + Warenkorb wiederherstellen (Theme: laden-design.ts) ---------- */

/** Theme und Speisekarte laufen PARALLEL; das Theme ist fachlich optional
 *  (fehlt es, bleibt die Standard-Optik aus tokens.css). allSettled() statt
 *  all(), damit ein Fehlschlag des einen den anderen nicht mit reisst. */
async function ladeThemeUndSpeisekarte(): Promise<void> {
    // Platzhalter, solange beides unterwegs ist: der Gast sieht sofort die
    // Form seiner Karte statt einer leeren Flaeche. Das Theme ist noch nicht
    // da, also im Standard-Aufbau - beim Eintreffen wird ohnehin neu gezeichnet.
    const skelettZiel = document.getElementById("menu-container");
    if (skelettZiel) zeigeSkelett(skelettZiel);

    const [themeErgebnis, menuErgebnis] = await Promise.allSettled([
        ladeTheme(restaurantId),
        ladeSpeisekarte(restaurantId)
    ]);

    if (themeErgebnis.status === "fulfilled") {
        wendeThemeAn(themeErgebnis.value);
        // Rueckfall wie zuvor in wendeThemeAn: nur uebernehmen, wenn die
        // Statusabfrage noch keinen restaurantName geliefert hat (siehe laden-design.ts, Dateikopf).
        if (themeErgebnis.value.name && !restaurantName) restaurantName = themeErgebnis.value.name;
        // Spielt nur einmal pro Gast (localStorage-Flag in vorhang.ts) - bei
        // spaeteren Aufrufen von ladeThemeUndSpeisekarte (gibt es hier nicht,
        // aber zur Sicherheit) waere das ein no-op.
        zeigeVorhang(themeErgebnis.value, guestToken);
    }
    void zeigeGalerie(restaurantId);
    const hamburgerModus = themeErgebnis.status === "fulfilled" && themeErgebnis.value.categoriesAsHamburger;
    const modi = themeErgebnis.status === "fulfilled" ? leseModi(themeErgebnis.value) : null;
    if (modi) {
        flyModus = modi.fly;
        confirmModus = modi.confirm;
    }
    if (themeErgebnis.status === "fulfilled") struktur = leseStruktur(themeErgebnis.value);

    kategorien = menuErgebnis.status === "fulfilled" ? menuErgebnis.value : [];
    const ziel = document.getElementById("menu-container");
    if (ziel) {
        zeichneSpeisekarte(kategorien, ziel, beiGerichtAusgewaehlt, beiSchnellHinzufuegen, genehmigt, hamburgerModus,
            undefined, false, struktur);
        staffelEin(Array.from(ziel.querySelectorAll<HTMLElement>(".ox-gericht")));
    }
    if (menuErgebnis.status === "rejected") {
        toast("Speisekarte konnte nicht geladen werden.", true);
    }

    warenkorb.stelleWiederHer(guestToken, kategorien);
    aktualisiereWarenkorbLeiste();
}

/** Karte antippen (Foto/Name): oeffnet das Detail-Overlay - Menge/Hinweis
 *  werden dort gewaehlt. menu.ts ruft diesen Rueckruf NUR vom .oeffnen-Knopf
 *  auf, NICHT vom "+"-Knopf (der hat einen eigenen Rueckruf, siehe
 *  beiSchnellHinzufuegen direkt darunter). */
function beiGerichtAusgewaehlt(gericht: Gericht, quelle?: HTMLElement): void {
    // quelle ist das Foto der angetippten Karte: das Detail-Blatt laesst es
    // in seine grosse Fassung wachsen (menu.ts -> animation.ts wachseFoto).
    oeffneDetail(gericht, beiHinzufuegen, genehmigt, { layout: struktur.layout, quelle });
}

/** "+"-Knopf in der Preiszeile der Karte: EIN Tipp statt drei - legt sofort
 *  mit Menge 1 und leerem Hinweis in den Warenkorb, ohne das Detail-Overlay
 *  zu oeffnen. Eigener Rueckruf an zeichneSpeisekarte (siehe menu.ts). */
function beiSchnellHinzufuegen(gericht: Gericht, quelle: HTMLElement): void {
    beiHinzufuegen(gericht, 1, "", quelle);
}

function beiHinzufuegen(gericht: Gericht, menge: number, hinweis: string, quelle: HTMLElement): void {
    warenkorb.hinzufuegen(gericht, menge, hinweis);
    warenkorb.sichere(guestToken);
    aktualisiereWarenkorbLeiste();
    const zaehler = document.getElementById("cartbar-info");
    if (zaehler) fliegeZu(quelle, zaehler, { modus: flyModus, bildUrl: gericht.imageUrl });
    toast(`${menge}× ${gericht.name} hinzugefügt`);
}

/* ---------- Warenkorb-Ansicht (cart.ts liefert nur Daten, keine Anzeige) ---------- */

function zeigeWarenkorbAnsicht(): void {
    // Einen zuvor "weggeflogenen" Bon zuruecksetzen, solange #view-cart noch
    // ausgeblendet ist - sonst gleitet die Karte beim Wechsel sichtbar zurueck
    // ins Bild (siehe bon.ts fliegeBonWeg/setzeBonZurueck).
    const karte = document.querySelector<HTMLElement>("#view-cart .ox-card");
    if (karte) setzeBonZurueck(karte);
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

    // Kassenbon-Optik: Perforierung an die Karte, gestaffeltes Zeilen-Tippen (bon.ts).
    const karte = document.querySelector<HTMLElement>("#view-cart .ox-card");
    if (karte && ziel) schmueckeBon(karte, Array.from(ziel.children) as HTMLElement[]);
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
    // Die Leiste federt nur herein, wenn sie vorher WEG war - nicht bei
    // jeder Mengenaenderung. Der Uebergang muss also vor dem Setzen von
    // hidden gelesen werden.
    const kommtHerein = sichtbar && leiste.hidden;
    leiste.hidden = !sichtbar;
    if (kommtHerein) {
        // Klasse entfernen, Reflow erzwingen, neu setzen - sonst laeuft die
        // Animation beim zweiten Mal nicht (gleiches Muster wie ox-anim-pop).
        leiste.classList.remove("ox-leiste-rein");
        void leiste.offsetWidth;
        leiste.classList.add("ox-leiste-rein");
    }
    if (sichtbar) {
        const info = document.getElementById("cartbar-info");
        if (info) {
            // Zahl und Preis als eigene Elemente statt Fliesstext - Zahl in
            // Mono/tabular-nums (.ox-num, wie ueberall bei Stueckzahlen),
            // Preis wie ueberall ueber .ox-preis. fliegeZu() liest weiterhin
            // nur die Position DIESES Containers (#cartbar-info bleibt das
            // Flugziel), Kindelemente aendern daran nichts.
            const summe = warenkorb.summe();
            const preisFeld = el("strong", "ox-preis", preis(summe));
            info.textContent = "";
            info.append(
                el("strong", "ox-num", String(anzahl)),
                document.createTextNode(" Artikel · "),
                preisFeld
            );
            // Die Summe laeuft auf ihren neuen Wert, statt zu springen - sie
            // ist die Zahl, auf die der Gast achtet. Bei Stufe "dezent" oder
            // reduzierter Bewegung schreibt zaehleHoch sofort den Endwert.
            zaehleHoch(letzteKorbSumme, summe, (wert) => { preisFeld.textContent = preis(wert); });
            letzteKorbSumme = summe;
            // Kurzer "Pop" bei jeder Aenderung - Klasse entfernen, Reflow
            // erzwingen, neu setzen (sonst startet die Animation nicht neu).
            info.classList.remove("ox-anim-pop");
            void info.offsetWidth;
            info.classList.add("ox-anim-pop");
        }
    }
}

async function sendeBestellung(): Promise<void> {
    const knopf = document.getElementById("btn-send") as HTMLButtonElement | null;
    if (knopf) knopf.disabled = true;
    try {
        await bestelle(guestToken, warenkorb);
        await bestaetigeBestellung(confirmModus);
        const karte = document.querySelector<HTMLElement>("#view-cart .ox-card");
        if (karte) await fliegeBonWeg(karte);
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
        const bestellungen = await holeMeineBestellungen(guestToken);
        zeichneBestellungen(bestellungen, ziel);
        // "Bestellungen"-Knopf in der Namensleiste zeigen, sobald es welche gibt.
        const knopf = document.getElementById("btn-orders");
        if (knopf && bestellungen.length > 0) knopf.hidden = false;
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
   nur ueber "Namen ändern" in der Namensleiste erreichbar; Anzeige: ansichten.ts). ---------- */

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
        aktualisiereNameAnzeige(meinName);
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

/* ---------- Ereignisse verdrahten ---------- */

function verdraheStatischeEreignisse(): void {
    document.getElementById("btn-retry")?.addEventListener("click", () => { void neuScannen(); });

    document.getElementById("my-name")?.addEventListener("click", oeffneNamensAnsicht);
    document.getElementById("btn-name-save")?.addEventListener("click", () => { void speichereName(); });
    document.getElementById("name-input")?.addEventListener("keydown", (ereignis) => {
        if ((ereignis as KeyboardEvent).key === "Enter") void speichereName();
    });

    document.getElementById("btn-call")?.addEventListener("click", () => { void rufeKellnerAn(); });
    document.getElementById("btn-orders")?.addEventListener("click", () => {
        void aktualisiereBestellungen();
        zeigeAnsicht("view-orders");
    });
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
beobachteKopfhoehe();
void start();
