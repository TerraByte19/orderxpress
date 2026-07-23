package com.orderxpress.repository;

import com.orderxpress.domain.CustomerOrder;
import com.orderxpress.domain.OrderStatus;
import com.orderxpress.domain.SessionStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long> {

    /** Bestellung inkl. Positionen und Tisch in einer Abfrage laden. */
    @EntityGraph(attributePaths = {"items", "session.restaurantTable"})
    Optional<CustomerOrder> findDetailedById(Long id);

    /** Aktive Bestellungen fuer die Kuechen-Ansicht EINES Ladens. */
    @EntityGraph(attributePaths = {"items", "session.restaurantTable"})
    List<CustomerOrder> findByStatusInAndSession_RestaurantTable_Restaurant_IdOrderByCreatedAtAsc(
            Collection<OrderStatus> statuses, Long restaurantId);

    /** Alle Bestellungen einer Tisch-Sitzung (Gast-Ansicht "Meine Bestellungen"). */
    @EntityGraph(attributePaths = {"items", "session.restaurantTable"})
    List<CustomerOrder> findBySessionIdOrderByCreatedAtDesc(Long sessionId);

    /** Bestellungen einer Sitzung inkl. Positionen + Person (fuer die geteilte Rechnung). */
    @EntityGraph(attributePaths = {"items", "guest", "session.restaurantTable"})
    List<CustomerOrder> findBySessionIdOrderByCreatedAtAsc(Long sessionId);

    /** Bestellungen einer einzelnen Person (Gast-Ansicht "Meine Bestellungen"). */
    @EntityGraph(attributePaths = {"items", "session.restaurantTable"})
    List<CustomerOrder> findByGuestIdOrderByCreatedAtDesc(Long guestId);

    /** Letzte Bestellungen fuer die Inhaber-Uebersicht EINES Ladens. */
    @EntityGraph(attributePaths = {"items", "session.restaurantTable"})
    List<CustomerOrder> findTop100BySession_RestaurantTable_Restaurant_IdOrderByCreatedAtDesc(Long restaurantId);

    /** Bestellungen eines Ladens in einem Zeitfenster (fuer die Statistik-Zeitraeume). */
    @EntityGraph(attributePaths = "items")
    List<CustomerOrder> findBySession_RestaurantTable_Restaurant_IdAndCreatedAtBetween(
            Long restaurantId, Instant from, Instant to);

    /**
     * Bestellungen eines Ladens aus ABGESCHLOSSENEN Sitzungen (CLOSED/REJECTED/EXPIRED) -
     * Grundlage fuer "Bestellverlauf loeschen", ohne laufende Tische anzutasten.
     */
    @EntityGraph(attributePaths = "items")
    List<CustomerOrder> findBySession_RestaurantTable_Restaurant_IdAndSession_StatusIn(
            Long restaurantId, Collection<SessionStatus> statuses);
}
