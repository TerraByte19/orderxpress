package com.orderxpress.service;

import com.orderxpress.domain.CustomerOrder;
import com.orderxpress.repository.CustomerOrderRepository;
import com.orderxpress.service.printing.ReceiptData;
import com.orderxpress.service.printing.ReceiptPrinter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Druckt Kuechenbons im Hintergrund. Ein Druckfehler (Drucker aus, Papier leer)
 * darf NIE die Bestellung selbst scheitern lassen - er wird an der Bestellung
 * vermerkt, damit die Kueche den Bon nachdrucken kann.
 */
@Service
public class PrintService {

    private static final Logger log = LoggerFactory.getLogger(PrintService.class);

    private final CustomerOrderRepository orderRepository;
    private final ReceiptPrinter printer;

    public PrintService(CustomerOrderRepository orderRepository, ReceiptPrinter printer) {
        this.orderRepository = orderRepository;
        this.printer = printer;
    }

    /** Laeuft asynchron, damit der Gast nicht auf den Drucker warten muss. */
    @Async
    @Transactional
    public void printOrder(Long orderId) {
        CustomerOrder order = orderRepository.findDetailedById(orderId).orElse(null);
        if (order == null) {
            log.warn("Bondruck uebersprungen: Bestellung {} nicht gefunden", orderId);
            return;
        }

        try {
            printer.print(toReceiptData(order));
            order.setPrinted(true);
            order.setPrintError(null);
            log.info("Kuechenbon fuer Bestellung {} gedruckt", orderId);
        } catch (Exception e) {
            order.setPrinted(false);
            order.setPrintError(shorten(e.getMessage()));
            log.error("Bondruck fuer Bestellung {} fehlgeschlagen", orderId, e);
        }
    }

    private ReceiptData toReceiptData(CustomerOrder order) {
        return new ReceiptData(
                order.getId(),
                order.getSession().getRestaurantTable().getNumber(),
                order.getCreatedAt(),
                order.getItems().stream()
                        .map(i -> new ReceiptData.Line(i.getQuantity(), i.getItemName(), i.getNote()))
                        .toList(),
                order.getTotalAmount());
    }

    private static String shorten(String message) {
        if (message == null) {
            return "Unbekannter Fehler";
        }
        return message.length() <= 500 ? message : message.substring(0, 500);
    }
}
