package com.orderxpress.domain;

/**
 * Rolle eines Laden-Benutzers. Der Plattform-Admin ist KEIN AppUser, sondern
 * kommt aus der Konfiguration (application.yml) - er verwaltet Laeden, nicht
 * einzelne Bestellungen.
 */
public enum UserRole {
    /** Inhaber: volle Verwaltung (Speisekarte, Tische, Design, Logins) + alles was Service/Kueche darf. */
    OWNER,
    /** Service/Kellner/Kasse: Tische freigeben ("Tisch Nr. X freigeben?") und Bestellungen im Blick behalten. */
    SERVICE,
    /** Kueche: eingehende Bestellungen abarbeiten. */
    KITCHEN
}
