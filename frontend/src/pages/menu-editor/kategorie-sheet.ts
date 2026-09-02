/* Bearbeiten/Anlegen-Sheet fuer eine Kategorie - gleiches Muster wie
 * sheet.ts, eigene Overlay-Instanz (.ox-kategorie-overlay). */

import { el } from "../../lib/ui";
import type { AdminKategorie } from "../../lib/types";
import { aendereKategorie, legeKategorieAn } from "./api";

function versteckeOverlay(overlay: HTMLElement): void {
    overlay.classList.remove("is-open");
    overlay.style.display = "";
}

document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key !== "Escape") return;
    const offen = document.querySelector<HTMLElement>(".ox-kategorie-overlay.is-open");
    if (offen) versteckeOverlay(offen);
});

function holeOderErstelleOverlay(): HTMLDivElement {
    const vorhanden = document.querySelector<HTMLDivElement>(".ox-kategorie-overlay");
    if (vorhanden) return vorhanden;
    const overlay = document.createElement("div");
    overlay.className = "ox-overlay ox-kategorie-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.appendChild(el("div", "ox-overlay__box ox-overlay__box--sheet"));
    overlay.addEventListener("click", (ereignis) => {
        if (ereignis.target === overlay) versteckeOverlay(overlay);
    });
    document.body.appendChild(overlay);
    return overlay;
}

export function oeffneKategorieBearbeiten(kategorie: AdminKategorie, beiGespeichert: () => void): void {
    oeffneSheet(kategorie, beiGespeichert, 0);
}

export function oeffneKategorieNeu(naechstePosition: number, beiGespeichert: () => void): void {
    oeffneSheet(null, beiGespeichert, naechstePosition);
}

function oeffneSheet(kategorie: AdminKategorie | null, beiGespeichert: () => void, naechstePosition: number): void {
    const overlay = holeOderErstelleOverlay();
    const box = overlay.querySelector<HTMLDivElement>(".ox-overlay__box")!;
    box.textContent = "";

    box.appendChild(el("h2", undefined, kategorie ? "Kategorie bearbeiten" : "Neue Kategorie"));

    const nameZeile = el("div");
    nameZeile.appendChild(el("label", "ox-label", "Name"));
    const nameFeld = document.createElement("input");
    nameFeld.type = "text";
    nameFeld.className = "ox-field";
    nameFeld.value = kategorie?.name ?? "";
    nameZeile.appendChild(nameFeld);
    box.appendChild(nameZeile);

    const sichtbarZeile = el("label", "ox-row");
    const sichtbarFeld = document.createElement("input");
    sichtbarFeld.type = "checkbox";
    sichtbarFeld.checked = kategorie?.active ?? true;
    sichtbarZeile.append(sichtbarFeld, document.createTextNode("Kategorie sichtbar"));
    box.appendChild(sichtbarZeile);

    const fehlerAnzeige = el("p", "ox-muted");
    box.appendChild(fehlerAnzeige);

    const knopfZeile = el("div", "ox-row");
    const abbrechenKnopf = baueKnopf("ox-btn ox-btn--geist", "Abbrechen");
    abbrechenKnopf.addEventListener("click", () => versteckeOverlay(overlay));
    const speichernKnopf = baueKnopf("ox-btn", "Speichern");
    speichernKnopf.addEventListener("click", () => { void speichere(); });
    knopfZeile.append(abbrechenKnopf, el("span", "ox-spacer"), speichernKnopf);
    box.appendChild(knopfZeile);

    async function speichere(): Promise<void> {
        const name = nameFeld.value.trim();
        if (!name) { fehlerAnzeige.textContent = "Bitte einen Namen eingeben."; return; }
        speichernKnopf.disabled = true;
        fehlerAnzeige.textContent = "";
        try {
            if (kategorie) {
                await aendereKategorie(kategorie.id, { name, active: sichtbarFeld.checked, sortOrder: kategorie.sortOrder });
            } else {
                await legeKategorieAn({ name, sortOrder: naechstePosition });
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

function baueKnopf(klasse: string, text: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = klasse;
    b.textContent = text;
    return b;
}
