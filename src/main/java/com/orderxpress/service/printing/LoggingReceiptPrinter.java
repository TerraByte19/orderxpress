package com.orderxpress.service.printing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * "Drucker" fuer die Entwicklung: schreibt den Bon ins Log,
 * damit man den Ablauf ohne echten Bondrucker testen kann.
 */
public class LoggingReceiptPrinter implements ReceiptPrinter {

    private static final Logger log = LoggerFactory.getLogger(LoggingReceiptPrinter.class);

    private final ReceiptFormatter formatter;

    public LoggingReceiptPrinter(ReceiptFormatter formatter) {
        this.formatter = formatter;
    }

    @Override
    public void print(ReceiptData data) {
        log.info("Kuechenbon (printer.mode=log, kein echter Drucker):\n{}", formatter.format(data));
    }
}
