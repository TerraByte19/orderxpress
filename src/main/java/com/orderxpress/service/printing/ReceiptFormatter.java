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
        if (data.restaurantName() != null && !data.restaurantName().isBlank()) {
            sb.append(center(data.restaurantName().toUpperCase(Locale.GERMANY))).append('\n');
        }
        sb.append(center("NEUE BESTELLUNG")).append('\n');
        sb.append(heavyDivider).append('\n');
        sb.append(leftRight("Tisch: " + data.tableNumber(), "Best. #" + data.orderId())).append('\n');
        if (data.guestName() != null && !data.guestName().isBlank()) {
            sb.append("Gast: ").append(data.guestName()).append('\n');
        }
        sb.append(TIMESTAMP.format(data.createdAt())).append('\n');
        sb.append(divider).append('\n');

        for (ReceiptData.Line line : data.lines()) {
            // Menge + Name, lange Namen sauber umbrechen (Fortsetzung eingerueckt)
            appendWrapped(sb, String.format("%2dx ", line.quantity()), line.name(), "    ");
            if (line.note() != null && !line.note().isBlank()) {
                appendWrapped(sb, "    > ", line.note(), "      ");
            }
        }

        sb.append(divider).append('\n');
        String total = String.format(Locale.GERMANY, "%,.2f EUR", data.total());
        sb.append(leftRight("SUMME:", total)).append('\n');
        return sb.toString();
    }

    /** Text hinter einem Praefix ausgeben und am Wortende auf WIDTH umbrechen. */
    private static void appendWrapped(StringBuilder sb, String prefix, String text, String contIndent) {
        String indent = prefix;
        StringBuilder line = new StringBuilder();
        for (String word : text.trim().split("\\s+")) {
            if (line.length() == 0) {
                line.append(word);
            } else if (indent.length() + line.length() + 1 + word.length() <= WIDTH) {
                line.append(' ').append(word);
            } else {
                sb.append(indent).append(line).append('\n');
                indent = contIndent;
                line.setLength(0);
                line.append(word);
            }
        }
        sb.append(indent).append(line).append('\n');
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
