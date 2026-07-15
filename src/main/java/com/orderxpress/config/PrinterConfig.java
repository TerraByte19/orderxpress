package com.orderxpress.config;

import com.orderxpress.service.printing.EscPosNetworkPrinter;
import com.orderxpress.service.printing.LoggingReceiptPrinter;
import com.orderxpress.service.printing.ReceiptFormatter;
import com.orderxpress.service.printing.ReceiptPrinter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Waehlt den Drucker anhand von orderxpress.printer.mode:
 * log = nur ins Log schreiben, network = echter ESC/POS-Netzwerkdrucker.
 */
@Configuration
public class PrinterConfig {

    @Bean
    public ReceiptPrinter receiptPrinter(AppProperties properties, ReceiptFormatter formatter) {
        return switch (properties.printer().mode()) {
            case NETWORK -> new EscPosNetworkPrinter(properties.printer(), formatter);
            case LOG -> new LoggingReceiptPrinter(formatter);
        };
    }
}
