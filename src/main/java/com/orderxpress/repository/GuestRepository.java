package com.orderxpress.repository;

import com.orderxpress.domain.Guest;
import com.orderxpress.domain.GuestStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GuestRepository extends JpaRepository<Guest, Long> {

    /** Person inkl. Sitzung + Tisch laden (fuer Bestellung/Status). */
    @EntityGraph(attributePaths = {"session", "session.restaurantTable"})
    Optional<Guest> findByGuestToken(String guestToken);

    /** Alle Personen einer Sitzung (fuer die geteilte Rechnung). */
    List<Guest> findBySessionIdOrderByCreatedAtAsc(Long sessionId);

    /** Offene Beitritts-Anfragen einer Sitzung. */
    List<Guest> findBySessionIdAndStatusOrderByCreatedAtAsc(Long sessionId, GuestStatus status);

    /** Der Gastgeber (erste Person) einer Sitzung. */
    Optional<Guest> findFirstBySessionIdAndHostTrue(Long sessionId);

    long countBySessionId(Long sessionId);
}
