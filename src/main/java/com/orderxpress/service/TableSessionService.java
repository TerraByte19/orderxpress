package com.orderxpress.service;

import com.orderxpress.config.AppProperties;
import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.Guest;
import com.orderxpress.domain.GuestStatus;
import com.orderxpress.domain.RestaurantTable;
import com.orderxpress.domain.SessionStatus;
import com.orderxpress.domain.TableSession;
import com.orderxpress.repository.GuestRepository;
import com.orderxpress.repository.RestaurantTableRepository;
import com.orderxpress.repository.TableSessionRepository;
import com.orderxpress.service.event.DomainEvents;
import com.orderxpress.web.dto.ScanResponse;
import com.orderxpress.web.dto.SessionDto;
import com.orderxpress.web.dto.SessionStatusResponse;
import com.orderxpress.web.error.ConflictException;
import com.orderxpress.web.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Kernstueck des Freigabe-Ablaufs:
 * QR-Scan -> Anfrage "Tisch Nr. X freigeben?" -> Inhaber genehmigt -> Gast darf bestellen.
 */
@Service
public class TableSessionService {

    private static final Logger log = LoggerFactory.getLogger(TableSessionService.class);

    /**
     * Nach einer Ablehnung akzeptiert der Tisch so lange keine neue Anfrage.
     * Verhindert, dass jemand mit abfotografiertem QR-Code den Inhaber
     * mit "Tisch freigeben?"-Meldungen bombardiert.
     */
    private static final Duration REJECTION_COOLDOWN = Duration.ofMinutes(5);

    private final RestaurantTableRepository tableRepository;
    private final TableSessionRepository sessionRepository;
    private final GuestRepository guestRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final AppProperties properties;

    public TableSessionService(RestaurantTableRepository tableRepository,
                               TableSessionRepository sessionRepository,
                               GuestRepository guestRepository,
                               ApplicationEventPublisher eventPublisher,
                               AppProperties properties) {
        this.tableRepository = tableRepository;
        this.sessionRepository = sessionRepository;
        this.guestRepository = guestRepository;
        this.eventPublisher = eventPublisher;
        this.properties = properties;
    }

    /**
     * Gast scannt den QR-Code am Tisch.
     * - Laeuft bereits eine freigegebene Sitzung (z.B. zweite Person am selben Tisch),
     *   bekommt der Gast denselben Sitzungs-Token.
     * - Wartet bereits eine Anfrage auf Freigabe, wird keine zweite erzeugt.
     * - Sonst entsteht eine neue Anfrage und der Inhaber wird benachrichtigt.
     */
    @Transactional
    public ScanResponse scan(String qrToken) {
        RestaurantTable table = tableRepository.findByQrToken(qrToken)
                .filter(RestaurantTable::isActive)
                .filter(t -> t.getRestaurant().isActive())
                .orElseThrow(() -> new NotFoundException("Dieser QR-Code ist ungueltig."));

        Long restaurantId = table.getRestaurant().getId();
        String restaurantName = table.getRestaurant().getName();

        // Laeuft schon eine freigegebene Sitzung? -> Diese Person tritt als weiterer
        // Gast bei und muss vom Gastgeber (erste Person) freigegeben werden.
        var approved = sessionRepository
                .findFirstByRestaurantTableIdAndStatus(table.getId(), SessionStatus.APPROVED);
        if (approved.isPresent()) {
            Guest joiner = createGuest(approved.get(), false);
            log.info("Beitritts-Anfrage an Tisch {} (Gast {})", table.getNumber(), joiner.getName());
            return scanResponse(joiner, approved.get(), table, restaurantId, restaurantName);
        }

        // Wartet die Sitzung noch auf die Laden-Freigabe? -> ebenfalls beitreten
        // (der Gastgeber existiert bereits als erste Person und gibt spaeter frei).
        var pending = sessionRepository
                .findFirstByRestaurantTableIdAndStatus(table.getId(), SessionStatus.PENDING);
        if (pending.isPresent()) {
            Guest joiner = createGuest(pending.get(), false);
            return scanResponse(joiner, pending.get(), table, restaurantId, restaurantName);
        }

        // Spam-Schutz: kurz nach einer Ablehnung keine neue Anfrage zulassen
        Instant cooldownStart = Instant.now().minus(REJECTION_COOLDOWN);
        if (sessionRepository.existsByRestaurantTableIdAndStatusAndCreatedAtAfter(
                table.getId(), SessionStatus.REJECTED, cooldownStart)) {
            throw new ConflictException(
                    "Die Anfrage fuer diesen Tisch wurde gerade abgelehnt. Bitte wende dich an das Personal.");
        }

        // Freier Tisch: neue Sitzung + Gastgeber (erste Person). Der Laden gibt frei.
        TableSession session = sessionRepository.save(new TableSession(table));
        Guest host = createGuest(session, true);
        eventPublisher.publishEvent(new DomainEvents.SessionRequested(
                restaurantId,
                session.getId(),
                table.getNumber(),
                "Tisch Nr. %d freigeben?".formatted(table.getNumber())));
        log.info("Neue Freigabe-Anfrage fuer Tisch {} (Laden {}, Gastgeber {})",
                table.getNumber(), restaurantId, host.getName());
        return scanResponse(host, session, table, restaurantId, restaurantName);
    }

    /** Legt eine neue Person in der Sitzung an; Name automatisch "Gast N". */
    private Guest createGuest(TableSession session, boolean host) {
        long number = guestRepository.countBySessionId(session.getId()) + 1;
        return guestRepository.save(new Guest(session, "Gast " + number, host));
    }

    private ScanResponse scanResponse(Guest guest, TableSession session, RestaurantTable table,
                                      Long restaurantId, String restaurantName) {
        return new ScanResponse(
                guest.getGuestToken(),
                guest.isHost(),
                session.getStatus(),
                guest.getStatus(),
                guest.getName(),
                table.getNumber(),
                restaurantId,
                restaurantName);
    }

    /** Gast fragt regelmaessig nach, ob der Tisch inzwischen freigegeben wurde. */
    @Transactional(readOnly = true)
    public SessionStatusResponse getStatus(String sessionToken) {
        TableSession session = findByToken(sessionToken);
        return new SessionStatusResponse(session.getStatus(), session.getRestaurantTable().getNumber());
    }

    /** Offene Freigabe-Anfragen fuer die Inhaber-Ansicht (nur eigener Laden). */
    @Transactional(readOnly = true)
    public List<SessionDto> getPendingSessions() {
        return sessionRepository.findByStatusAndRestaurantTable_Restaurant_IdOrderByCreatedAtAsc(
                        SessionStatus.PENDING, CurrentUser.restaurantId())
                .stream()
                .map(SessionDto::from)
                .toList();
    }

    /** Inhaber gibt den Tisch frei. */
    @Transactional
    public SessionDto approve(Long sessionId) {
        TableSession session = findOwnedSession(sessionId);
        if (session.getStatus() == SessionStatus.APPROVED) {
            return SessionDto.from(session); // schon freigegeben -> kein Fehler (idempotent)
        }
        requirePending(session);
        Long tableId = session.getRestaurantTable().getId();
        if (sessionRepository.existsByRestaurantTableIdAndStatus(tableId, SessionStatus.APPROVED)) {
            throw new ConflictException(
                    "Tisch %d ist bereits freigegeben.".formatted(session.getRestaurantTable().getNumber()));
        }
        session.approve();
        // Der Gastgeber (erste Person) wird mit der Sitzung freigegeben und darf bestellen.
        guestRepository.findFirstBySessionIdAndHostTrue(sessionId).ifPresent(Guest::approve);
        publishChange(session);
        log.info("Tisch {} freigegeben (Sitzung {})", session.getRestaurantTable().getNumber(), sessionId);
        return SessionDto.from(session);
    }

    /** Inhaber lehnt die Anfrage ab (z.B. QR-Code wurde von ausserhalb gescannt). */
    @Transactional
    public SessionDto reject(Long sessionId) {
        TableSession session = findOwnedSession(sessionId);
        requirePending(session);
        session.reject();
        // Alle Personen dieser Sitzung mit ablehnen.
        guestRepository.findBySessionIdOrderByCreatedAtAsc(sessionId).forEach(Guest::reject);
        publishChange(session);
        return SessionDto.from(session);
    }

    /** Inhaber beendet die Sitzung (Gaeste sind gegangen) -> Tisch ist wieder frei. */
    @Transactional
    public SessionDto close(Long sessionId) {
        TableSession session = findOwnedSession(sessionId);
        if (session.getStatus() != SessionStatus.APPROVED) {
            throw new ConflictException(
                    "Nur freigegebene Sitzungen koennen beendet werden (Status: %s).".formatted(session.getStatus()));
        }
        session.close();
        publishChange(session);
        log.info("Sitzung {} an Tisch {} beendet", sessionId, session.getRestaurantTable().getNumber());
        return SessionDto.from(session);
    }

    /** Laesst unbeantwortete Freigabe-Anfragen nach der eingestellten Zeit verfallen. */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireStalePendingSessions() {
        Instant cutoff = Instant.now()
                .minus(Duration.ofMinutes(properties.session().pendingTimeoutMinutes()));
        List<TableSession> stale = sessionRepository
                .findByStatusAndCreatedAtBefore(SessionStatus.PENDING, cutoff);
        for (TableSession session : stale) {
            session.expire();
            publishChange(session);
            log.info("Freigabe-Anfrage fuer Tisch {} verfallen",
                    session.getRestaurantTable().getNumber());
        }
    }

    private TableSession findByToken(String sessionToken) {
        return sessionRepository.findBySessionToken(sessionToken)
                .orElseThrow(() -> new NotFoundException("Sitzung nicht gefunden. Bitte QR-Code erneut scannen."));
    }

    private TableSession findWithTable(Long sessionId) {
        return sessionRepository.findWithTableById(sessionId)
                .orElseThrow(() -> new NotFoundException("Sitzung %d nicht gefunden.".formatted(sessionId)));
    }

    /** Sitzung laden UND pruefen, dass sie zum Laden des angemeldeten Inhabers gehoert. */
    private TableSession findOwnedSession(Long sessionId) {
        TableSession session = findWithTable(sessionId);
        if (!session.getRestaurantTable().getRestaurant().getId().equals(CurrentUser.restaurantId())) {
            // Bewusst wie "nicht gefunden" behandeln, um fremde IDs nicht zu bestaetigen.
            throw new NotFoundException("Sitzung %d nicht gefunden.".formatted(sessionId));
        }
        return session;
    }

    private void requirePending(TableSession session) {
        if (session.getStatus() != SessionStatus.PENDING) {
            throw new ConflictException(
                    "Anfrage ist nicht mehr offen (Status: %s).".formatted(session.getStatus()));
        }
    }

    private void publishChange(TableSession session) {
        eventPublisher.publishEvent(new DomainEvents.SessionChanged(
                session.getRestaurantTable().getRestaurant().getId(),
                session.getId(),
                session.getRestaurantTable().getNumber(),
                session.getStatus()));
    }
}
