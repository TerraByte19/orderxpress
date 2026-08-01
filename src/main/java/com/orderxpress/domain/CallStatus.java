package com.orderxpress.domain;

/**
 * Zustand eines Kellner-Rufs:
 * OPEN -> Gast hat gerufen, Personal muss reagieren
 * DONE -> Personal hat den Ruf erledigt
 */
public enum CallStatus {
    OPEN, DONE
}
