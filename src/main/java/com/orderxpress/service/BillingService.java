package com.orderxpress.service;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.CustomerOrder;
import com.orderxpress.domain.Guest;
import com.orderxpress.domain.OrderItem;
import com.orderxpress.domain.OrderStatus;
import com.orderxpress.domain.RestaurantTable;
import com.orderxpress.domain.SessionStatus;
import com.orderxpress.domain.TableSession;
import com.orderxpress.repository.CustomerOrderRepository;
import com.orderxpress.repository.GuestRepository;
import com.orderxpress.repository.OrderItemRepository;
import com.orderxpress.repository.RestaurantTableRepository;
import com.orderxpress.repository.TableSessionRepository;
import com.orderxpress.web.dto.BillDto;
import com.orderxpress.web.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Geteilte Rechnung und Kasse: fasst alle Positionen eines Tisches nach Person
 * zusammen und markiert ausgewaehlte Positionen als bezahlt (Split-Zahlung).
 */
@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    private final GuestRepository guestRepository;
    private final CustomerOrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final RestaurantTableRepository tableRepository;
    private final TableSessionRepository sessionRepository;

    public BillingService(GuestRepository guestRepository,
                          CustomerOrderRepository orderRepository,
                          OrderItemRepository orderItemRepository,
                          RestaurantTableRepository tableRepository,
                          TableSessionRepository sessionRepository) {
        this.guestRepository = guestRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.tableRepository = tableRepository;
        this.sessionRepository = sessionRepository;
    }

    /** Geteilte Rechnung aus Sicht eines Gastes (er sieht den ganzen Tisch). */
    @Transactional(readOnly = true)
    public BillDto getBillForGuest(String guestToken) {
        Guest guest = guestRepository.findByGuestToken(guestToken)
                .orElseThrow(() -> new NotFoundException("Sitzung nicht gefunden."));
        return buildBill(guest.getSession());
    }

    /** Rechnung eines Tisches fuer die Kasse (Personal, nur eigener Laden). */
    @Transactional(readOnly = true)
    public BillDto getBillForTable(Long tableId) {
        RestaurantTable table = tableRepository.findByIdAndRestaurantId(tableId, CurrentUser.restaurantId())
                .orElseThrow(() -> new NotFoundException("Tisch %d nicht gefunden.".formatted(tableId)));
        return sessionRepository.findFirstByRestaurantTableIdAndStatus(tableId, SessionStatus.APPROVED)
                .map(this::buildBill)
                .orElseGet(() -> new BillDto(table.getNumber(), null, List.of(),
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
    }

    /** Kasse: ausgewaehlte Positionen als bezahlt markieren (nur eigener Laden). */
    @Transactional
    public void settle(List<Long> orderItemIds) {
        Long restaurantId = CurrentUser.restaurantId();
        List<OrderItem> items = orderItemRepository.findByIdIn(orderItemIds);
        int marked = 0;
        for (OrderItem item : items) {
            Long itemRestaurant = item.getOrder().getSession().getRestaurantTable().getRestaurant().getId();
            if (!itemRestaurant.equals(restaurantId)) {
                continue; // fremde Positionen ignorieren (Mandanten-Schutz)
            }
            if (!item.isPaid()) {
                item.markPaid();
                marked++;
            }
        }
        log.info("Kasse: {} Position(en) als bezahlt markiert (Laden {})", marked, restaurantId);
    }

    // ---------- Aufbau der Rechnung ----------

    private BillDto buildBill(TableSession session) {
        List<CustomerOrder> orders = orderRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
        List<Guest> guests = guestRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());

        // Positionen je Person sammeln (stornierte Bestellungen zaehlen nicht).
        Map<Long, List<BillDto.Line>> linesByGuest = new LinkedHashMap<>();
        for (Guest g : guests) {
            linesByGuest.put(g.getId(), new ArrayList<>());
        }
        for (CustomerOrder order : orders) {
            if (order.getStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            Long guestId = order.getGuest().getId();
            List<BillDto.Line> lines = linesByGuest.computeIfAbsent(guestId, k -> new ArrayList<>());
            for (OrderItem item : order.getItems()) {
                lines.add(new BillDto.Line(
                        item.getId(),
                        item.getItemName(),
                        item.getQuantity(),
                        item.getUnitPrice(),
                        item.getLineTotal(),
                        item.getNote(),
                        item.isPaid()));
            }
        }

        List<BillDto.Participant> participants = new ArrayList<>();
        BigDecimal grand = BigDecimal.ZERO;
        BigDecimal grandPaid = BigDecimal.ZERO;
        for (Guest g : guests) {
            List<BillDto.Line> lines = linesByGuest.getOrDefault(g.getId(), List.of());
            if (lines.isEmpty()) {
                continue; // Personen ohne Positionen nicht anzeigen
            }
            BigDecimal total = BigDecimal.ZERO;
            BigDecimal paid = BigDecimal.ZERO;
            for (BillDto.Line line : lines) {
                total = total.add(line.lineTotal());
                if (line.paid()) {
                    paid = paid.add(line.lineTotal());
                }
            }
            participants.add(new BillDto.Participant(
                    g.getId(), g.getName(), g.isHost(), lines, total, paid, total.subtract(paid)));
            grand = grand.add(total);
            grandPaid = grandPaid.add(paid);
        }

        return new BillDto(
                session.getRestaurantTable().getNumber(),
                session.getId(),
                participants,
                grand,
                grandPaid,
                grand.subtract(grandPaid));
    }
}
