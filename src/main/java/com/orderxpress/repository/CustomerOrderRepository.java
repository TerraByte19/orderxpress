package com.orderxpress.repository;

import com.orderxpress.domain.CustomerOrder;
import com.orderxpress.domain.OrderStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

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

    /** Letzte Bestellungen fuer die Inhaber-Uebersicht EINES Ladens. */
    @EntityGraph(attributePaths = {"items", "session.restaurantTable"})
    List<CustomerOrder> findTop100BySession_RestaurantTable_Restaurant_IdOrderByCreatedAtDesc(Long restaurantId);
}
