package com.orderxpress.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Verwaltet die Live-Verbindungen (Server-Sent Events) zu den offenen
 * Inhaber- und Kuechen-Ansichten - GETRENNT je Laden (restaurantId). So bekommt
 * ein Laden ausschliesslich die Ereignisse seiner eigenen Tische und
 * Bestellungen, niemals die eines anderen Ladens.
 */
@Component
public class SseHub {

    private static final Logger log = LoggerFactory.getLogger(SseHub.class);

    /** Verbindung nach 30 Minuten serverseitig beenden; Clients verbinden sich neu. */
    private static final long TIMEOUT_MILLIS = 30L * 60 * 1000;

    // restaurantId -> Liste offener Verbindungen
    private final Map<Long, List<SseEmitter>> adminEmitters = new ConcurrentHashMap<>();
    private final Map<Long, List<SseEmitter>> kitchenEmitters = new ConcurrentHashMap<>();

    public SseEmitter subscribeAdmin(Long restaurantId) {
        return subscribe(listFor(adminEmitters, restaurantId));
    }

    public SseEmitter subscribeKitchen(Long restaurantId) {
        return subscribe(listFor(kitchenEmitters, restaurantId));
    }

    public void notifyAdmins(Long restaurantId, String eventName, Object payload) {
        broadcast(listFor(adminEmitters, restaurantId), eventName, payload);
    }

    public void notifyKitchen(Long restaurantId, String eventName, Object payload) {
        broadcast(listFor(kitchenEmitters, restaurantId), eventName, payload);
    }

    private List<SseEmitter> listFor(Map<Long, List<SseEmitter>> map, Long restaurantId) {
        return map.computeIfAbsent(restaurantId, key -> new CopyOnWriteArrayList<>());
    }

    private SseEmitter subscribe(List<SseEmitter> emitters) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MILLIS);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(t -> emitters.remove(emitter));
        emitters.add(emitter);
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    private void broadcast(List<SseEmitter> emitters, String eventName, Object payload) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (Exception e) {
                // Client ist weg -> Verbindung aufraeumen
                emitters.remove(emitter);
                try {
                    emitter.complete();
                } catch (Exception ignored) {
                    // bereits geschlossen
                }
                log.debug("SSE-Client entfernt: {}", e.getMessage());
            }
        }
    }

    /** Haelt die Verbindungen durch Proxies/Browser hinweg am Leben. */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        adminEmitters.values().forEach(list -> broadcast(list, "ping", "ping"));
        kitchenEmitters.values().forEach(list -> broadcast(list, "ping", "ping"));
    }
}
