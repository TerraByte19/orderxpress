/* Bearbeiten/Anlegen-Sheet fuer ein Gericht. Wiederverwendet das
 * .ox-overlay/.ox-overlay__box--sheet-Muster aus guest/menu.ts (Detail-
 * Overlay), aber als eigene Instanz (.ox-editor-overlay) mit editierbaren
 * Feldern statt Nur-Lese-Ansicht. Kategorie und Position werden NICHT im
 * Sheet getippt - Kategorie ergibt sich aus der Stelle, Position aus den
 * Pfeilen (siehe Spec/Plan, bewusste Vereinfachung). */

import { api } from "../../lib/api";
import { el } from "../../lib/ui";
import type { AdminGericht, Me } from "../../lib/types";
import { GERICHT_MARKEN } from "../../lib/types";
import { aendereGericht, ladeGerichtFoto, legeGerichtAn, loescheGerichtFoto } from "./api";

/* Laden-Id fuer die Gast-Vorschau im Zuschnitt-Dialog. Der Editor kennt
 * sie schon aus /api/me (index.ts) - hier einmal nachladen und merken,
 * damit baueFotoBereich sie ohne Umweg erreicht. Faellt bei Fehler auf 0
 * zurueck (der Cropper zeigt dann nur den Zuschnitt ohne Vorschau). */
let restaurantIdCache: number | null = null;
async function holeRestaurantId(): Promise<number> {
    if (restaurantIdCache !== null) return restaurantIdCache;
    try {
        restaurantIdCache = (await api<Me>("/api/me")).restaurantId;
    } catch {
        restaurantIdCache = 0;
    }
    return restaurantIdCache;
}

function versteckeOverlay(overlay: HTMLElement): void {
    overlay.classList.remove("is-open");
    overlay.style.display = "";
}

document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key !== "Escape") return;
    const offen = document.querySelector<HTMLElement>(".ox-editor-overlay.is-open");
    if (offen) versteckeOverlay(offen);
});

function holeOderErstelleOverlay(): HTMLDivElement {
    const vorhanden = document.querySelector<HTMLDivElement>(".ox-editor-overlay");
    if (vorhanden) return vorhanden;
    const overlay = document.createElement("div");
    overlay.className = "ox-overlay ox-editor-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.appendChild(el("div", "ox-overlay__box ox-overlay__box--sheet"));
    overlay.addEventListener("click", (ereignis) => {
        if (ereignis.target === overlay) versteckeOverlay(overlay);
    });
    document.body.appendChild(overlay);
    return overlay;
}

function parsePreis(text: string): number {
    return Number(text.replace(",", "."));
}

export function oeffneGerichtBearbeiten(gericht: AdminGericht, beiGespeichert: () => void): void {
    oeffneSheet(gericht, beiGespeichert);
}

export function oeffneGerichtNeu(kategorieId: number, naechstePosition: number, beiGespeichert: () => void): void {
    oeffneSheet(null, beiGespeichert, kategorieId, naechstePosition);
}

function oeffneSheet(
    gericht: AdminGericht | null,
    beiGespeichert: () => void,
    neueKategorieId?: number,
    neuePosition?: number
): void {
    const overlay = holeOderErstelleOverlay();
    const box = overlay.querySelector<HTMLDivElement>(".ox-overlay__box")!;
    box.textContent = "";

    box.appendChild(el("h2", undefined, gericht ? "Gericht bearbeiten" : "Neues Gericht"));

    const nameFeld = baueTextfeld("Name");
    nameFeld.input.value = gericht?.name ?? "";
    const preisFeld = baueTextfeld("Preis (EUR)");
    preisFeld.input.value = gericht ? String(gericht.price).replace(".", ",") : "";
    const beschreibungFeld = baueTextfeld("Kurzbeschreibung");
    beschreibungFeld.input.value = gericht?.description ?? "";
    const detailsFeld = baueTextarea("Zutaten & Details");
    detailsFeld.input.value = gericht?.details ?? "";
    const verfuegbarFeld = baueCheckbox("Verfügbar");
    verfuegbarFeld.input.checked = gericht?.available ?? true;
    const markenFeld = baueMarkenAuswahl(gericht?.badges ?? []);
    box.append(nameFeld.zeile, preisFeld.zeile, beschreibungFeld.zeile, detailsFeld.zeile, verfuegbarFeld.zeile, markenFeld.zeile);

    const fehlerAnzeige = el("p", "ox-muted");

    if (gericht) box.appendChild(baueFotoBereich(gericht, fehlerAnzeige, () => { versteckeOverlay(overlay); beiGespeichert(); }));

    box.appendChild(fehlerAnzeige);

    const knopfZeile = el("div", "ox-row");
    const abbrechenKnopf = baueKnopf("ox-btn ox-btn--geist", "Abbrechen");
    abbrechenKnopf.addEventListener("click", () => versteckeOverlay(overlay));
    const speichernKnopf = baueKnopf("ox-btn", "Speichern");
    speichernKnopf.addEventListener("click", () => { void speichere(); });
    knopfZeile.append(abbrechenKnopf, el("span", "ox-spacer"), speichernKnopf);
    box.appendChild(knopfZeile);

    async function speichere(): Promise<void> {
        const name = nameFeld.input.value.trim();
        if (!name) { fehlerAnzeige.textContent = "Bitte einen Namen eingeben."; return; }
        const preisWert = parsePreis(preisFeld.input.value);
        if (!Number.isFinite(preisWert) || preisWert < 0) { fehlerAnzeige.textContent = "Bitte einen gültigen Preis eingeben."; return; }

        speichernKnopf.disabled = true;
        fehlerAnzeige.textContent = "";
        try {
            const gemeinsam = {
                categoryId: gericht?.categoryId ?? neueKategorieId!,
                name,
                description: beschreibungFeld.input.value.trim() || null,
                details: detailsFeld.input.value.trim() || null,
                price: preisWert,
                sortOrder: gericht?.sortOrder ?? neuePosition!,
                badges: markenFeld.gewaehlt()
            };
            if (gericht) {
                await aendereGericht(gericht.id, { ...gemeinsam, available: verfuegbarFeld.input.checked });
            } else {
                await legeGerichtAn(gemeinsam);
            }
            versteckeOverlay(overlay);
            beiGespeichert();
        } catch (fehler) {
            fehlerAnzeige.textContent = (fehler as Error).message;
        } finally {
            speichernKnopf.disabled = false;
        }
    }

    overlay.style.display = "flex";
    requestAnimationFrame(() => overlay.classList.add("is-open"));
}

function baueFotoBereich(gericht: AdminGericht, fehlerAnzeige: HTMLElement, beiErfolg: () => void): HTMLElement {
    const bereich = el("div", "ox-row");
    const dateiFeld = document.createElement("input");
    dateiFeld.type = "file";
    dateiFeld.accept = "image/jpeg,image/png";
    dateiFeld.addEventListener("change", () => {
        const datei = dateiFeld.files?.[0];
        dateiFeld.value = "";
        if (!datei) return;

        const hochladen = (f: File): void => {
            ladeGerichtFoto(gericht.id, f)
                .then(beiErfolg)
                .catch((fehler: unknown) => { fehlerAnzeige.textContent = (fehler as Error).message; });
        };

        const cropper = window.OX?.oeffneCropper;
        if (!cropper) { hochladen(datei); return; }

        void holeRestaurantId().then((restaurantId) => {
            cropper({
                datei,
                form: "quadrat",
                ausgabe: 900,
                fokus: "gericht:" + gericht.id,
                restaurantId,
                onFertig: (blob: Blob) => hochladen(new File([blob], "foto.png", { type: "image/png" }))
            });
        });
    });
    bereich.appendChild(dateiFeld);
    if (gericht.imageUrl) {
        const loeschen = baueKnopf("ox-btn ox-btn--geist ox-btn--klein", "Foto löschen");
        loeschen.addEventListener("click", () => {
            loescheGerichtFoto(gericht.id)
                .then(beiErfolg)
                .catch((fehler: unknown) => { fehlerAnzeige.textContent = (fehler as Error).message; });
        });
        bereich.appendChild(loeschen);
    }
    return bereich;
}

function baueTextfeld(label: string): { zeile: HTMLElement; input: HTMLInputElement } {
    const zeile = el("div");
    zeile.appendChild(el("label", "ox-label", label));
    const input = document.createElement("input");
    input.type = "text";
    input.className = "ox-field";
    zeile.appendChild(input);
    return { zeile, input };
}

function baueTextarea(label: string): { zeile: HTMLElement; input: HTMLTextAreaElement } {
    const zeile = el("div");
    zeile.appendChild(el("label", "ox-label", label));
    const input = document.createElement("textarea");
    input.className = "ox-field";
    zeile.appendChild(input);
    return { zeile, input };
}

/** Mehrere Checkboxen (SCHARF/VEGETARISCH/...) in einer Zeile - gewaehlt()
 *  liefert die aktuell angehakten Werte fuer das Speichern. */
function baueMarkenAuswahl(vorhandene: string[]): { zeile: HTMLElement; gewaehlt: () => string[] } {
    const zeile = el("div");
    zeile.appendChild(el("label", "ox-label", "Marken"));
    const reihe = el("div", "ox-row");
    const kontrollkaestchen: Array<{ wert: string; input: HTMLInputElement }> = [];
    for (const marke of GERICHT_MARKEN) {
        const feld = document.createElement("label");
        feld.className = "ox-row";
        feld.style.gap = "4px";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = vorhandene.includes(marke.wert);
        feld.append(input, document.createTextNode(marke.label));
        reihe.appendChild(feld);
        kontrollkaestchen.push({ wert: marke.wert, input });
    }
    zeile.appendChild(reihe);
    return { zeile, gewaehlt: () => kontrollkaestchen.filter((k) => k.input.checked).map((k) => k.wert) };
}

function baueCheckbox(label: string): { zeile: HTMLElement; input: HTMLInputElement } {
    const zeile = el("label", "ox-row");
    const input = document.createElement("input");
    input.type = "checkbox";
    zeile.append(input, document.createTextNode(label));
    return { zeile, input };
}

function baueKnopf(klasse: string, text: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = klasse;
    b.textContent = text;
    return b;
}
