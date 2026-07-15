package com.orderxpress.service.printing;

import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Baut den Text des Kuechenbons (42 Zeichen breit, passend fuer 80mm-Bondrucker).
 */
@Component
public class ReceiptFormatter {

    /** Zeichen pro Zeile bei 80mm-Thermodruckern im Standardfont. */
    public static final int WIDTH = 42;

    private static final DateTimeFormatter TIMESTAMP =
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.systemDefault());

    public String format(ReceiptData data) {
        StringBuilder sb = new StringBuilder();
        String divider = "-".repeat(WIDTH);
        String heavyDivider = "=".repeat(WIDTH);

        sb.append(heavyDivider).append('\n');
        sb.append(center("NEUE BESTELLUNG")).append('\n');
        sb.append(heavyDivider).append('\n');
        sb.append(leftRight("Tisch: " + data.tableNumber(), "Bestellung #" + data.orderId())).append('\n');
        sb.append(TIMESTAMP.format(data.createdAt())).append('\n');
        sb.append(divider).append('\n');

        for (ReceiptData.Line line : data.lines()) {
            sb.append(String.format("%2dx %s", line.quantity(), line.name())).append('\n');
            if (line.note() != null && !line.note().isBlank()) {
                sb.append("    > ").append(line.note()).append('\n');
            }
        }

        sb.append(divider).append('\n');
        String total = String.format(Locale.GERMANY, "%,.2f EUR", data.total());
        sb.append(leftRight("SUMME:", total)).append('\n');
        return sb.toString();
    }

    private static String center(String text) {
        int padding = Math.max(0, (WIDTH - text.length()) / 2);
        return " ".repeat(padding) + text;
    }

    private static String leftRight(String left, String right) {
        int spaces = Math.max(1, WIDTH - left.length() - right.length());
        return left + " ".repeat(spaces) + right;
    }
}
