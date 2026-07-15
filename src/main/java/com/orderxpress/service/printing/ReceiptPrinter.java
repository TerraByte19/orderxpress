package com.orderxpress.service.printing;

/**
 * Schnittstelle fuer den Kuechendruck. Implementierungen:
 * - LoggingReceiptPrinter: schreibt den Bon nur ins Log (Entwicklung)
 * - EscPosNetworkPrinter: druckt auf einem Netzwerk-Bondrucker (Betrieb)
 */
public interface ReceiptPrinter {

    /**
     * Druckt den Bon. Wirft eine Exception, wenn der Druck fehlschlaegt -
     * die Bestellung selbst bleibt davon unberuehrt.
     */
    void print(ReceiptData data);
}
