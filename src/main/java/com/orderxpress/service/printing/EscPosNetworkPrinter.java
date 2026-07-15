package com.orderxpress.service.printing;

import com.orderxpress.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Druckt auf einem ESC/POS-Bondrucker im Netzwerk (z.B. Epson TM-Serie).
 * Die Drucker lauschen ueblicherweise auf Port 9100 ("RAW printing").
 */
public class EscPosNetworkPrinter implements ReceiptPrinter {

    private static final Logger log = LoggerFactory.getLogger(EscPosNetworkPrinter.class);

    private static final int CONNECT_TIMEOUT_MILLIS = 3_000;
    private static final int WRITE_TIMEOUT_MILLIS = 5_000;

    // ESC/POS-Steuerbefehle
    private static final byte[] INIT = {0x1B, 0x40};                  // Drucker zuruecksetzen
    private static final byte[] CODEPAGE_CP858 = {0x1B, 0x74, 19};    // Umlaute + Euro-Zeichen
    private static final byte[] DOUBLE_SIZE_ON = {0x1D, 0x21, 0x11};  // doppelte Breite+Hoehe
    private static final byte[] DOUBLE_SIZE_OFF = {0x1D, 0x21, 0x00};
    private static final byte[] FEED_4 = {0x1B, 0x64, 4};             // 4 Zeilen vorschieben
    private static final byte[] PARTIAL_CUT = {0x1D, 0x56, 66, 3};    // Bon abschneiden

    private final String host;
    private final int port;
    private final Charset charset;
    private final ReceiptFormatter formatter;

    public EscPosNetworkPrinter(AppProperties.Printer printerProperties, ReceiptFormatter formatter) {
        if (printerProperties.host() == null || printerProperties.host().isBlank()) {
            throw new IllegalStateException(
                    "printer.mode=network erfordert orderxpress.printer.host in application.yml");
        }
        this.host = printerProperties.host();
        this.port = printerProperties.port();
        this.charset = pickCharset();
        this.formatter = formatter;
        log.info("Netzwerk-Bondrucker konfiguriert: {}:{} (Zeichensatz {})", host, port, charset);
    }

    @Override
    public void print(ReceiptData data) {
        byte[] payload = buildPayload(data);
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MILLIS);
            socket.setSoTimeout(WRITE_TIMEOUT_MILLIS);
            OutputStream out = socket.getOutputStream();
            out.write(payload);
            out.flush();
        } catch (IOException e) {
            throw new PrintException(
                    "Bondrucker %s:%d nicht erreichbar: %s".formatted(host, port, e.getMessage()), e);
        }
    }

    private byte[] buildPayload(ReceiptData data) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try {
            buffer.write(INIT);
            buffer.write(CODEPAGE_CP858);

            // Tischnummer gross und deutlich - das Wichtigste fuer die Kueche
            buffer.write(DOUBLE_SIZE_ON);
            buffer.write(("TISCH " + data.tableNumber() + "\n").getBytes(charset));
            buffer.write(DOUBLE_SIZE_OFF);

            buffer.write(formatter.format(data).getBytes(charset));
            buffer.write(FEED_4);
            buffer.write(PARTIAL_CUT);
        } catch (IOException e) {
            // ByteArrayOutputStream wirft praktisch nie
            throw new PrintException("Bon konnte nicht aufgebaut werden", e);
        }
        return buffer.toByteArray();
    }

    /** CP858 enthaelt deutsche Umlaute und das Euro-Zeichen; Fallbacks fuer aeltere JVMs. */
    private static Charset pickCharset() {
        for (String name : List.of("IBM00858", "IBM850", "IBM437")) {
            if (Charset.isSupported(name)) {
                return Charset.forName(name);
            }
        }
        return StandardCharsets.US_ASCII;
    }

    /** Fehler beim Bondruck (Netzwerk, Drucker offline, ...). */
    public static class PrintException extends RuntimeException {
        public PrintException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
