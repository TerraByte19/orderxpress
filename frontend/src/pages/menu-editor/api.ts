/* Typisierte Admin-Aufrufe fuer den Speisekarten-Editor. Dieselben
 * Endpunkte wie im alten admin.js (Menue-Tab), nur mit Typen statt
 * inline-JSON. */

import { api } from "../../lib/api";
import { authKopfzeilen } from "../../lib/auth";
import type { AdminGericht, AdminKategorie } from "../../lib/types";

export function holeKategorien(): Promise<AdminKategorie[]> {
    return api<AdminKategorie[]>("/api/admin/categories");
}

export function holeGerichte(): Promise<AdminGericht[]> {
    return api<AdminGericht[]>("/api/admin/menu-items");
}

export interface GerichtNeuEingabe {
    categoryId: number;
    name: string;
    description: string | null;
    details: string | null;
    price: number;
    sortOrder: number;
    badges: string[];
}

export interface GerichtEingabe extends GerichtNeuEingabe {
    available: boolean;
}

export function legeGerichtAn(eingabe: GerichtNeuEingabe): Promise<AdminGericht> {
    return api<AdminGericht>("/api/admin/menu-items", { method: "POST", body: JSON.stringify(eingabe) });
}

export function aendereGericht(id: number, eingabe: GerichtEingabe): Promise<AdminGericht> {
    return api<AdminGericht>(`/api/admin/menu-items/${id}`, { method: "PUT", body: JSON.stringify(eingabe) });
}

export function loescheGericht(id: number): Promise<void> {
    return api<void>(`/api/admin/menu-items/${id}`, { method: "DELETE" });
}

export async function ladeGerichtFoto(id: number, datei: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", datei);
    const antwort = await fetch(`/api/admin/menu-items/${id}/image`, {
        method: "POST",
        headers: authKopfzeilen(),
        body: formData
    });
    if (!antwort.ok) throw new Error("Foto konnte nicht hochgeladen werden");
}

export function loescheGerichtFoto(id: number): Promise<void> {
    return api<void>(`/api/admin/menu-items/${id}/image`, { method: "DELETE" });
}

export interface KategorieNeuEingabe {
    name: string;
    sortOrder: number;
}

export interface KategorieEingabe extends KategorieNeuEingabe {
    active: boolean;
}

export function legeKategorieAn(eingabe: KategorieNeuEingabe): Promise<AdminKategorie> {
    return api<AdminKategorie>("/api/admin/categories", { method: "POST", body: JSON.stringify(eingabe) });
}

export function aendereKategorie(id: number, eingabe: KategorieEingabe): Promise<AdminKategorie> {
    return api<AdminKategorie>(`/api/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(eingabe) });
}

export function loescheKategorie(id: number): Promise<void> {
    return api<void>(`/api/admin/categories/${id}`, { method: "DELETE" });
}
