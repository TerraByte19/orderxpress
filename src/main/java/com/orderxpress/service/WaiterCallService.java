package com.orderxpress.service;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.CallStatus;
import com.orderxpress.domain.Guest;
import com.orderxpress.domain.GuestStatus;
import com.orderxpress.domain.RestaurantTable;
import com.orderxpress.domain.SessionStatus;
import com.orderxpress.domain.TableSession;
import com.orderxpress.domain.WaiterCall;
import com.orderxpress.repository.GuestRepository;
import com.orderxpress.repository.WaiterCallRepository;
import com.orderxpress.service.event.DomainEvents;
import com.orderxpress.web.dto.WaiterCallDto;
import com.orderxpress.web.error.BadRequestException;
import com.orderxpress.web.error.NotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * "Kellner rufen": Ein freigegebener Gast loest einen Ruf fuer seinen Tisch aus.
 * Kasse und Kellner sehen offene Rufe live und haken sie ab. Pro Tisch gibt es
 * hoechstens EINEN offenen Ruf (kein Spam), ein erneutes Druecken meldet nur neu.
 */
@Service
public class WaiterCallService {

    private final GuestRepository guestRepository;
    private final WaiterCallRepository callRepository;
    private final ApplicationEventPublisher eventPublisher;

    public WaiterCallService(GuestRepository guestRepository,
                             WaiterCallRepository callRepository,
                             ApplicationEventPublisher eventPublisher) {
        this.guestRepository = guestRepository;
        this.callRepository = callRepository;
        this.eventPublisher = eventPublisher;
    }

    /** Gast (per guestToken) ruft den Kellner. */
    @Transactional
    public void call(String guestToken) {
        Guest guest = guestRepository.findByGuestToken(guestToken)
                .orElseThrow(() -> new NotFoundException("Sitzung nicht gefunden."));
        if (guest.getStatus() != GuestStatus.APPROVED) {
            throw new BadRequestException("Bitte warte, bis du freigegeben bist.");
        }
        TableSession session = guest.getSession();
        if (session.getStatus() != SessionStatus.APPROVED) {
            throw new BadRequestException("Der Tisch ist gerade nicht aktiv.");
        }
        RestaurantTable table = session.getRestaurantTable();

        // Nur einen offenen Ruf pro Tisch (Dubletten vermeiden); sonst neuen anlegen.
        callRepository.findFirstBySession_IdAndStatus(session.getId(), CallStatus.OPEN)
                .orElseGet(() -> callRepository.save(new WaiterCall(session, guest)));

        // In jedem Fall neu benachrichtigen (auch bei erneutem Druecken).
        eventPublisher.publishEvent(new DomainEvents.WaiterCalled(
                table.getRestaurant().getId(), table.getNumber(), guest.getName()));
    }

    /** Offene Rufe des eigenen Ladens (fuer Kasse/Kellner). */
    @Transactional(readOnly = true)
    public List<WaiterCallDto> listOpen() {
        return callRepository
                .findByStatusAndSession_StatusAndSession_RestaurantTable_Restaurant_IdOrderByCreatedAtAsc(
                        CallStatus.OPEN, SessionStatus.APPROVED, CurrentUser.restaurantId())
                .stream()
                .map(c -> new WaiterCallDto(
                        c.getId(),
                        c.getSession().getRestaurantTable().getNumber(),
                        c.getGuest().getName(),
                        c.getCreatedAt()))
                .toList();
    }

    /** Personal hakt einen Ruf ab (Mandanten-geprueft). */
    @Transactional
    public void markDone(Long id) {
        WaiterCall call = callRepository
                .findByIdAndSession_RestaurantTable_Restaurant_Id(id, CurrentUser.restaurantId())
                .orElseThrow(() -> new NotFoundException("Ruf %d nicht gefunden.".formatted(id)));
        call.markDone();
    }
}
