package com.orderxpress.service;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.CustomerOrder;
import com.orderxpress.domain.MenuItem;
import com.orderxpress.domain.OrderItem;
import com.orderxpress.domain.OrderStatus;
import com.orderxpress.domain.SessionStatus;
import com.orderxpress.domain.TableSession;
import com.orderxpress.repository.CustomerOrderRepository;
import com.orderxpress.repository.MenuItemRepository;
import com.orderxpress.repository.TableSessionRepository;
import com.orderxpress.service.event.DomainEvents;
import com.orderxpress.web.dto.OrderResponse;
import com.orderxpress.web.dto.PlaceOrderRequest;
import com.orderxpress.web.error.ConflictException;
import com.orderxpress.web.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Nimmt Bestellungen entgegen und verwaltet ihren Status fuer die Kueche.
 */
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    /** Erlaubte Statuswechsel (NEW -> READY erlaubt das Ueberspringen der Zubereitung). */
    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED_TRANSITIONS = Map.of(
            OrderStatus.NEW, EnumSet.of(OrderStatus.IN_PREPARATION, OrderStatus.READY, OrderStatus.CANCELLED),
            OrderStatus.IN_PREPARATION, EnumSet.of(OrderStatus.READY, OrderStatus.CANCELLED),
            OrderStatus.READY, EnumSet.of(OrderStatus.SERVED),
            OrderStatus.SERVED, EnumSet.noneOf(OrderStatus.class),
            OrderStatus.CANCELLED, EnumSet.noneOf(OrderStatus.class));

    /** Bestellungen, die die Kueche standardmaessig sieht. */
    private static final Set<OrderStatus> ACTIVE_STATUSES =
            EnumSet.of(OrderStatus.NEW, OrderStatus.IN_PREPARATION, OrderStatus.READY);

    private final CustomerOrderRepository orderRepository;
    private final TableSessionRepository sessionRepository;
    private final MenuItemRepository menuItemRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final PrintService printService;

    public OrderService(CustomerOrderRepository orderRepository,
                        TableSessionRepository sessionRepository,
                        MenuItemRepository menuItemRepository,
                        ApplicationEventPublisher eventPublisher,
                        PrintService printService) {
        this.orderRepository = orderRepository;
        this.sessionRepository = sessionRepository;
        this.menuItemRepository = menuItemRepository;
        this.eventPublisher = eventPublisher;
        this.printService = printService;
    }

    /**
     * Gast schickt eine Bestellung ab. Preise werden IMMER serverseitig aus der
     * Datenbank uebernommen - was der Client schickt, spielt keine Rolle.
     */
    @Transactional
    public OrderResponse placeOrder(PlaceOrderRequest request) {
        TableSession session = sessionRepository.findBySessionToken(request.sessionToken())
                .orElseThrow(() -> new NotFoundException("Sitzung nicht gefunden. Bitte QR-Code erneut scannen."));

        if (session.getStatus() != SessionStatus.APPROVED) {
            throw new ConflictException(
                    "Der Tisch ist nicht freigegeben (Status: %s). Bitte auf die Freigabe warten oder das Personal ansprechen."
                            .formatted(session.getStatus()));
        }

        Long restaurantId = session.getRestaurantTable().getRestaurant().getId();
        CustomerOrder order = new CustomerOrder(session);
        for (PlaceOrderRequest.OrderItemRequest itemRequest : request.items()) {
            // Nur Gerichte des EIGENEN Ladens sind bestellbar (Mandanten-Schutz).
            MenuItem menuItem = menuItemRepository.findByIdAndRestaurantId(itemRequest.menuItemId(), restaurantId)
                    .orElseThrow(() -> new NotFoundException(
                            "Gericht %d nicht gefunden.".formatted(itemRequest.menuItemId())));
            if (!menuItem.isAvailable() || !menuItem.getCategory().isActive()) {
                throw new ConflictException("'%s' ist derzeit nicht bestellbar.".formatted(menuItem.getName()));
            }
            String note = itemRequest.note() == null ? null : itemRequest.note().trim();
            order.addItem(new OrderItem(menuItem, itemRequest.quantity(), note));
        }
        order.recalculateTotal();

        CustomerOrder saved = orderRepository.save(order);
        int tableNumber = session.getRestaurantTable().getNumber();
        eventPublisher.publishEvent(new DomainEvents.OrderCreated(restaurantId, saved.getId(), tableNumber));
        log.info("Neue Bestellung {} fuer Tisch {} ({} Positionen, {} EUR)",
                saved.getId(), tableNumber, saved.getItems().size(), saved.getTotalAmount());
        return OrderResponse.from(saved);
    }

    /** Alle Bestellungen der eigenen Tisch-Sitzung (Gast-Ansicht). */
    @Transactional(readOnly = true)
    public List<OrderResponse> getOrdersForSession(String sessionToken) {
        TableSession session = sessionRepository.findBySessionToken(sessionToken)
                .orElseThrow(() -> new NotFoundException("Sitzung nicht gefunden."));
        return orderRepository.findBySessionIdOrderByCreatedAtDesc(session.getId())
                .stream()
                .map(OrderResponse::from)
                .toList();
    }

    /** Bestellungen fuer die Kuechen-Ansicht des eigenen Ladens (optional nach Status gefiltert). */
    @Transactional(readOnly = true)
    public List<OrderResponse> getKitchenOrders(OrderStatus statusFilter) {
        Set<OrderStatus> statuses = statusFilter == null ? ACTIVE_STATUSES : EnumSet.of(statusFilter);
        return orderRepository.findByStatusInAndSession_RestaurantTable_Restaurant_IdOrderByCreatedAtAsc(
                        statuses, CurrentUser.restaurantId())
                .stream()
                .map(OrderResponse::from)
                .toList();
    }

    /** Letzte Bestellungen fuer die Inhaber-Uebersicht des eigenen Ladens. */
    @Transactional(readOnly = true)
    public List<OrderResponse> getRecentOrders() {
        return orderRepository.findTop100BySession_RestaurantTable_Restaurant_IdOrderByCreatedAtDesc(
                        CurrentUser.restaurantId())
                .stream()
                .map(OrderResponse::from)
                .toList();
    }

    /** Bon erneut drucken (z.B. nach Papierstau). Druck laeuft asynchron. */
    @Transactional(readOnly = true)
    public void requestReprint(Long orderId) {
        loadOwnedOrder(orderId); // stellt sicher, dass die Bestellung zum eigenen Laden gehoert
        printService.printOrder(orderId);
    }

    /** Kueche/Inhaber aendert den Bestellstatus (z.B. NEW -> IN_PREPARATION). */
    @Transactional
    public OrderResponse updateStatus(Long orderId, OrderStatus newStatus) {
        CustomerOrder order = loadOwnedOrder(orderId);

        Set<OrderStatus> allowed = ALLOWED_TRANSITIONS.getOrDefault(order.getStatus(), Set.of());
        if (!allowed.contains(newStatus)) {
            throw new ConflictException(
                    "Statuswechsel von %s nach %s ist nicht moeglich.".formatted(order.getStatus(), newStatus));
        }

        order.setStatus(newStatus);
        eventPublisher.publishEvent(new DomainEvents.OrderStatusChanged(
                order.getSession().getRestaurantTable().getRestaurant().getId(),
                order.getId(),
                order.getSession().getRestaurantTable().getNumber(),
                newStatus));
        return OrderResponse.from(order);
    }

    /** Bestellung laden UND pruefen, dass sie zum Laden des angemeldeten Benutzers gehoert. */
    private CustomerOrder loadOwnedOrder(Long orderId) {
        CustomerOrder order = orderRepository.findDetailedById(orderId)
                .orElseThrow(() -> new NotFoundException("Bestellung %d nicht gefunden.".formatted(orderId)));
        if (!order.getSession().getRestaurantTable().getRestaurant().getId().equals(CurrentUser.restaurantId())) {
            throw new NotFoundException("Bestellung %d nicht gefunden.".formatted(orderId));
        }
        return order;
    }
}
