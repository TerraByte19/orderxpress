package com.orderxpress.repository;

import com.orderxpress.domain.CallStatus;
import com.orderxpress.domain.SessionStatus;
import com.orderxpress.domain.WaiterCall;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WaiterCallRepository extends JpaRepository<WaiterCall, Long> {

    /** Gibt es schon einen offenen Ruf fuer diese Sitzung? (verhindert Dubletten) */
    Optional<WaiterCall> findFirstBySession_IdAndStatus(Long sessionId, CallStatus status);

    /**
     * Offene Rufe eines Ladens - nur von Tischen, deren Sitzung noch aktiv
     * (APPROVED) ist, damit Rufe geschlossener Tische verschwinden.
     */
    @EntityGraph(attributePaths = {"guest", "session.restaurantTable"})
    List<WaiterCall> findByStatusAndSession_StatusAndSession_RestaurantTable_Restaurant_IdOrderByCreatedAtAsc(
            CallStatus status, SessionStatus sessionStatus, Long restaurantId);

    /** Einen Ruf des eigenen Ladens laden (Mandanten-Pruefung fuer "erledigt"). */
    Optional<WaiterCall> findByIdAndSession_RestaurantTable_Restaurant_Id(Long id, Long restaurantId);
}
