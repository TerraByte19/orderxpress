package com.orderxpress.service;

import com.orderxpress.domain.Guest;
import com.orderxpress.domain.GuestStatus;
import com.orderxpress.domain.SessionStatus;
import com.orderxpress.repository.GuestRepository;
import com.orderxpress.web.dto.GuestStatusResponse;
import com.orderxpress.web.dto.JoinRequestDto;
import com.orderxpress.web.error.ConflictException;
import com.orderxpress.web.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Verwaltet die einzelnen Personen (Guests) an einem Tisch: Status abfragen,
 * Namen aendern und - als Gastgeber - weitere Personen freigeben, die denselben
 * QR-Code gescannt haben.
 */
@Service
public class GuestService {

    private static final Logger log = LoggerFactory.getLogger(GuestService.class);

    private final GuestRepository guestRepository;

    public GuestService(GuestRepository guestRepository) {
        this.guestRepository = guestRepository;
    }

    @Transactional(readOnly = true)
    public GuestStatusResponse getStatus(String guestToken) {
        return GuestStatusResponse.from(findGuest(guestToken));
    }

    @Transactional
    public GuestStatusResponse rename(String guestToken, String name) {
        Guest guest = findGuest(guestToken);
        guest.setName(name.trim());
        return GuestStatusResponse.from(guest);
    }

    /** Offene Beitritts-Anfragen, die der Gastgeber genehmigen kann. */
    @Transactional(readOnly = true)
    public List<JoinRequestDto> listJoinRequests(String hostToken) {
        Guest host = findGuest(hostToken);
        if (!host.isHost() || host.getStatus() != GuestStatus.APPROVED) {
            return List.of(); // nur ein freigegebener Gastgeber sieht Anfragen
        }
        return guestRepository
                .findBySessionIdAndStatusOrderByCreatedAtAsc(host.getSession().getId(), GuestStatus.PENDING)
                .stream()
                .filter(g -> !g.isHost())
                .map(JoinRequestDto::from)
                .toList();
    }

    @Transactional
    public void approveJoin(String hostToken, Long joinerId) {
        Guest host = requireHost(hostToken);
        Guest joiner = findJoiner(host, joinerId);
        joiner.approve();
        log.info("Gastgeber {} hat {} an Tisch {} freigegeben",
                host.getName(), joiner.getName(), host.getSession().getRestaurantTable().getNumber());
    }

    @Transactional
    public void rejectJoin(String hostToken, Long joinerId) {
        Guest host = requireHost(hostToken);
        Guest joiner = findJoiner(host, joinerId);
        joiner.reject();
    }

    // ---------- Hilfsmethoden ----------

    private Guest findGuest(String guestToken) {
        return guestRepository.findByGuestToken(guestToken)
                .orElseThrow(() -> new NotFoundException("Sitzung nicht gefunden. Bitte QR-Code erneut scannen."));
    }

    private Guest requireHost(String hostToken) {
        Guest host = findGuest(hostToken);
        if (!host.isHost()) {
            throw new ConflictException("Nur der Gastgeber (erste Person am Tisch) kann weitere Gaeste freigeben.");
        }
        if (host.getStatus() != GuestStatus.APPROVED || host.getSession().getStatus() != SessionStatus.APPROVED) {
            throw new ConflictException("Der Tisch ist noch nicht freigegeben.");
        }
        return host;
    }

    private Guest findJoiner(Guest host, Long joinerId) {
        Guest joiner = guestRepository.findById(joinerId)
                .orElseThrow(() -> new NotFoundException("Gast %d nicht gefunden.".formatted(joinerId)));
        if (!joiner.getSession().getId().equals(host.getSession().getId())) {
            throw new NotFoundException("Gast %d nicht gefunden.".formatted(joinerId));
        }
        if (joiner.getStatus() != GuestStatus.PENDING) {
            throw new ConflictException("Diese Anfrage ist nicht mehr offen (Status: %s)."
                    .formatted(joiner.getStatus()));
        }
        return joiner;
    }
}
