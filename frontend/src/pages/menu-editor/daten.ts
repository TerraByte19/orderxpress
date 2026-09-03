/* Baut aus den Admin-Listen (categories/menu-items) dieselbe Kategorie[]-
 * Struktur, die zeichneSpeisekarte() vom Gast-Endpunkt bekommt - inklusive
 * inaktiver Kategorien und ausverkaufter Gerichte, die der Gast-Endpunkt
 * nie liefert (siehe Spec, Abschnitt 3). */

import type { AdminGericht, AdminKategorie, Gericht, Kategorie } from "../../lib/types";

export interface EditorDaten {
    kategorien: Kategorie[];
    kategorieInfo: Map<number, AdminKategorie>;
    gerichtInfo: Map<number, AdminGericht>;
}

function zuGericht(g: AdminGericht): Gericht {
    return { id: g.id, name: g.name, description: g.description, details: g.details, price: g.price, imageUrl: g.imageUrl, badges: g.badges };
}

export function baueEditorDaten(kategorienRoh: AdminKategorie[], gerichteRoh: AdminGericht[]): EditorDaten {
    const kategorieInfo = new Map(kategorienRoh.map((k) => [k.id, k]));
    const gerichtInfo = new Map(gerichteRoh.map((g) => [g.id, g]));

    const kategorien = [...kategorienRoh]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((k) => ({
            id: k.id,
            name: k.name,
            items: gerichteRoh
                .filter((g) => g.categoryId === k.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(zuGericht)
        }));

    return { kategorien, kategorieInfo, gerichtInfo };
}
