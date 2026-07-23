package com.orderxpress.domain;

/**
 * Rolle eines Laden-Benutzers. Der Plattform-Admin ist KEIN AppUser, sondern
 * kommt aus der Konfiguration (application.yml) - er verwaltet Laeden, nicht
 * einzelne Bestellungen.
 */
public enum UserRole {
    /** Inhaber: volle Verwaltung (Speisekarte, Tische, Design, Logins) + alles was Service/Kueche darf. */
    OWNER,
    /** Kasse/Service: Tische freigeben ("Tisch Nr. X freigeben?"), kassieren, Kellner-QRs anlegen. */
    SERVICE,
    /** Kueche: eingehende Bestellungen abarbeiten. */
    KITCHEN,
    /** Kellner: meldet sich nur per QR-Code an und SIEHT die Bestellungen pro Tisch (nur lesen). */
    WAITER
}
