/* Speisekarten-Editor: Auth-Check (nur OWNER), Theme + Daten laden, die
 * echte Gaeste-Ansicht zeichnen (zeichneSpeisekarte aus guest/menu.ts) und
 * mit Editor-Bedienelementen dekorieren (dekoration.ts). Jede Aenderung
 * laedt die Admin-Daten neu und zeichnet den Container komplett neu -
 * kein Navigations-Reload, aber auch kein gezieltes DOM-Patching (siehe
 * Plan, "Bewusste Vereinfachungen"). */

import "../../styles/app.css";
import "../../styles/fonts";
import "../guest/guest.css";
import "./editor.css";

import { api } from "../../lib/api";
import { hatAnmeldung } from "../../lib/auth";
import { frage, toast } from "../../lib/ui";
import type { AdminGericht, AdminKategorie, LadenTheme, Me } from "../../lib/types";
import { ladeTheme, wendeThemeAn } from "../guest/laden-design";
import { zeichneSpeisekarte } from "../guest/menu";
import { aendereGericht, aendereKategorie, holeGerichte, holeKategorien, loescheKategorie } from "./api";
import { baueEditorDaten } from "./daten";
import { dekoriereSpeisekarte } from "./dekoration";
import { oeffneGerichtBearbeiten, oeffneGerichtNeu } from "./sheet";
import { oeffneKategorieBearbeiten, oeffneKategorieNeu } from "./kategorie-sheet";
import { ermittleTausch } from "./reihenfolge";

let kategorienRoh: AdminKategorie[] = [];
let gerichteRoh: AdminGericht[] = [];
let geladenesTheme: LadenTheme | null = null;

async function start(): Promise<void> {
    if (!hatAnmeldung()) { location.href = "/admin.html"; return; }

    let me: Me;
    try {
        me = await api<Me>("/api/me");
    } catch {
        location.href = "/admin.html";
        return;
    }
    if (me.role !== "OWNER") {
        toast("Nur der Inhaber kann die Speisekarte hier bearbeiten.", true);
        location.href = "/admin.html";
        return;
    }

    try {
        geladenesTheme = await ladeTheme(me.restaurantId);
        wendeThemeAn(geladenesTheme);
    } catch { /* Theme optional, Standard-Optik greift */ }

    await ladeUndZeichne();
}

async function ladeUndZeichne(): Promise<void> {
    try {
        [kategorienRoh, gerichteRoh] = await Promise.all([holeKategorien(), holeGerichte()]);
    } catch (fehler) {
        toast((fehler as Error).message, true);
        return;
    }
    zeichneAlles();
}

function zeichneAlles(): void {
    const daten = baueEditorDaten(kategorienRoh, gerichteRoh);
    const ziel = document.getElementById("menu-container");
    if (!ziel) return;

    zeichneSpeisekarte(
        daten.kategorien,
        ziel,
        (gericht) => oeffneGerichtBearbeiten(daten.gerichtInfo.get(gericht.id)!, () => void ladeUndZeichne()),
        () => { /* kein Warenkorb im Editor */ },
        false,
        geladenesTheme?.categoriesAsHamburger ?? false,
        (gerichtId) => daten.gerichtInfo.get(gerichtId)?.available ?? true,
        true
    );

    dekoriereSpeisekarte(ziel, daten.kategorieInfo, {
        beiGerichtNeu: (kategorieId) => {
            const geschwister = gerichteRoh.filter((g) => g.categoryId === kategorieId);
            const naechstePosition = geschwister.length ? Math.max(...geschwister.map((g) => g.sortOrder)) + 1 : 1;
            oeffneGerichtNeu(kategorieId, naechstePosition, () => void ladeUndZeichne());
        },
        beiGerichtVerschieben: (gerichtId, richtung) => void verschiebeGericht(gerichtId, richtung),
        beiKategorieBearbeiten: (kategorieId) => {
            const kategorie = daten.kategorieInfo.get(kategorieId);
            if (kategorie) oeffneKategorieBearbeiten(kategorie, () => void ladeUndZeichne());
        },
        beiKategorieLoeschen: (kategorieId) => void loescheKategorieMitRueckfrage(kategorieId, daten.kategorieInfo.get(kategorieId)?.name ?? ""),
        beiKategorieVerschieben: (kategorieId, richtung) => void verschiebeKategorie(kategorieId, richtung),
        beiKategorieNeu: () => {
            const naechstePosition = kategorienRoh.length ? Math.max(...kategorienRoh.map((k) => k.sortOrder)) + 1 : 1;
            oeffneKategorieNeu(naechstePosition, () => void ladeUndZeichne());
        }
    });
}

function zuGerichtEingabe(g: AdminGericht) {
    return { categoryId: g.categoryId, name: g.name, description: g.description, details: g.details, price: g.price, available: g.available, sortOrder: g.sortOrder, badges: g.badges };
}

async function verschiebeGericht(gerichtId: number, richtung: -1 | 1): Promise<void> {
    const bewegtesGericht = gerichteRoh.find((g) => g.id === gerichtId);
    if (!bewegtesGericht) return;
    const geschwister = gerichteRoh
        .filter((g) => g.categoryId === bewegtesGericht.categoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    const tausch = ermittleTausch(geschwister, gerichtId, richtung);
    if (!tausch) return;

    try {
        await Promise.all([
            aendereGericht(tausch.a.id, { ...zuGerichtEingabe(tausch.a), sortOrder: tausch.b.sortOrder }),
            aendereGericht(tausch.b.id, { ...zuGerichtEingabe(tausch.b), sortOrder: tausch.a.sortOrder })
        ]);
    } catch (fehler) {
        toast((fehler as Error).message, true);
    }
    await ladeUndZeichne();
}

async function verschiebeKategorie(kategorieId: number, richtung: -1 | 1): Promise<void> {
    const sortiert = [...kategorienRoh].sort((a, b) => a.sortOrder - b.sortOrder);
    const tausch = ermittleTausch(sortiert, kategorieId, richtung);
    if (!tausch) return;

    try {
        await Promise.all([
            aendereKategorie(tausch.a.id, { name: tausch.a.name, active: tausch.a.active, sortOrder: tausch.b.sortOrder }),
            aendereKategorie(tausch.b.id, { name: tausch.b.name, active: tausch.b.active, sortOrder: tausch.a.sortOrder })
        ]);
    } catch (fehler) {
        toast((fehler as Error).message, true);
    }
    await ladeUndZeichne();
}

async function loescheKategorieMitRueckfrage(kategorieId: number, name: string): Promise<void> {
    if (!frage(`Kategorie "${name}" löschen? (Geht nur, wenn sie leer ist.)`)) return;
    try {
        await loescheKategorie(kategorieId);
        toast("Kategorie gelöscht");
    } catch (fehler) {
        toast((fehler as Error).message, true);
    }
    await ladeUndZeichne();
}

void start();
