package com.orderxpress.domain;

/**
 * Art eines Laden-Bildes: Logo (oben), Hintergrundbild der Gaeste-Seite oder
 * Vorhang-Bild (Auftakt beim Oeffnen der Karte).
 *
 * Wie bei allen Bildern dieser App gilt: hochgeladen = wird gezeigt,
 * geloescht = weg. Es gibt bewusst keine zusaetzliche "Bild an/aus"-Spalte.
 */
public enum AssetKind {
    LOGO,
    BACKGROUND,
    INTRO
}
