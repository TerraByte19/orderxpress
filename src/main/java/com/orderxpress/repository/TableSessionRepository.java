package com.orderxpress.repository;

import com.orderxpress.domain.SessionStatus;
import com.orderxpress.domain.TableSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TableSessionRepository extends JpaRepository<TableSession, Long> {

    @EntityGraph(attributePaths = "restaurantTable")
    Optional<TableSession> findBySessionToken(String sessionToken);

    /**
     * Sperrt die Sitzungszeile (SELECT ... FOR UPDATE), damit gleichzeitige
     * "Kellner rufen"-Anfragen fuer denselben Tisch serialisiert werden und
     * nicht doppelt einen offenen Ruf anlegen koennen.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from TableSession s where s.id = ?1")
    Optional<TableSession> findByIdForUpdate(Long id);

    @EntityGraph(attributePaths = "restaurantTable")
    Optional<TableSession> findWithTableById(Long id);

    /** Offene Freigabe-Anfragen bzw. freigegebene Sitzungen EINES Ladens. */
    @EntityGraph(attributePaths = "restaurantTable")
    List<TableSession> findByStatusAndRestaurantTable_Restaurant_IdOrderByCreatedAtAsc(
            SessionStatus status, Long restaurantId);

    Optional<TableSession> findFirstByRestaurantTableIdAndStatus(Long tableId, SessionStatus status);

    boolean existsByRestaurantTableIdAndStatus(Long tableId, SessionStatus status);

    /** Gab es fuer diesen Tisch kuerzlich eine Sitzung im angegebenen Status? (Spam-Schutz) */
    boolean existsByRestaurantTableIdAndStatusAndCreatedAtAfter(Long tableId, SessionStatus status, Instant after);

    /** Fuer das automatische Verfallen alter Anfragen. */
    @EntityGraph(attributePaths = "restaurantTable")
    List<TableSession> findByStatusAndCreatedAtBefore(SessionStatus status, Instant cutoff);
}
