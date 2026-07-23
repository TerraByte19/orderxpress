package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Kellner-Ansicht (Rolle WAITER): Anmeldung per QR-Code, nur-lesender Blick auf
 * die Tische mit Zuordnung (wer hat was bestellt), Rollengrenzen und
 * Mandanten-Trennung. Ausserdem: die Kasse (SERVICE) darf Kellner-QRs anlegen.
 */
class WaiterViewIntegrationTest extends IntegrationTestBase {

    private String activate(String activationToken) throws Exception {
        String body = mvc.perform(post("/api/device/activate/" + activationToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.deviceToken");
    }

    /** Legt ueber den angegebenen Pfad ein Geraet an und aktiviert es -> Geraetetoken. */
    private String createDeviceToken(RequestPostProcessor creator, String basePath,
                                     String label, String role) throws Exception {
        String body = mvc.perform(post(basePath).with(creator)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"" + label + "\",\"role\":\"" + role + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String url = JsonPath.read(body, "$.activationUrl");
        return activate(url.substring(url.lastIndexOf('/') + 1));
    }

    @Test
    void kasseLegtKellnerQrAnUndKellnerSiehtDenTisch() throws Exception {
        Owner o = createRestaurant("waiter");
        long cat = createCategory(o, "Speisen");
        long pizza = createItem(o, cat, "Pizza", "7.00");
        TableRef t = createTable(o, 5);
        String host = hostAtApprovedTable(o, t);

        // Gastgeber benennt sich und bestellt
        mvc.perform(put("/api/guest/guests/" + host + "/name")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Adham\"}"))
                .andExpect(status().isOk());
        orderOneItem(host, pizza);

        // Die KASSE (Service-Login) legt den Kellner-QR selbst an
        createStaffUser(o, "kasse", "SERVICE");
        String waiterToken = createDeviceToken(httpBasic("kasse", "geheim123"),
                "/api/service/devices", "QR von Ahmad", "WAITER");

        // Der Kellner sieht den belegten Tisch mit Person + Position (nur lesen)
        mvc.perform(get("/api/waiter/tables").header("X-Device-Token", waiterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].tableNumber").value(5))
                .andExpect(jsonPath("$[0].participants.length()").value(1))
                .andExpect(jsonPath("$[0].participants[0].name").value("Adham"))
                .andExpect(jsonPath("$[0].participants[0].items[0].name").value("Pizza"));
    }

    @Test
    void kellnerDarfNichtsVeraendern() throws Exception {
        Owner o = createRestaurant("waiter-ro");
        String waiterToken = createDeviceToken(as(o), "/api/admin/devices", "QR von Tom", "WAITER");

        // Keine Verwaltung, keine Kasse, keine Kueche
        mvc.perform(get("/api/admin/tables").header("X-Device-Token", waiterToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/service/sessions/pending").header("X-Device-Token", waiterToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/kitchen/orders").header("X-Device-Token", waiterToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void kellnerProfilUeberApiMe() throws Exception {
        Owner o = createRestaurant("waiter-me");
        String waiterToken = createDeviceToken(as(o), "/api/admin/devices", "QR von Lea", "WAITER");
        mvc.perform(get("/api/me").header("X-Device-Token", waiterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("WAITER"));
    }

    @Test
    void kellnerSiehtNurEigenenLaden() throws Exception {
        Owner a = createRestaurant("waiter-a");
        Owner b = createRestaurant("waiter-b");
        TableRef tB = createTable(b, 1);
        hostAtApprovedTable(b, tB);   // Laden B hat einen belegten Tisch

        String waiterA = createDeviceToken(as(a), "/api/admin/devices", "QR A", "WAITER");
        mvc.perform(get("/api/waiter/tables").header("X-Device-Token", waiterA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void ownerDarfKellnerAnsichtAuchSehen() throws Exception {
        Owner o = createRestaurant("waiter-owner");
        mvc.perform(get("/api/waiter/tables").with(as(o)))
                .andExpect(status().isOk());
    }

    /**
     * Die Kasse ist immer im Laden, der Inhaber nicht: deshalb muss die Kasse ALLE
     * QR-Codes sehen und verwalten koennen - auch die vom Inhaber angelegten
     * Kuechen-/Kassen-Geraete, nicht nur die Kellner-QRs.
     */
    @Test
    void kasseSiehtUndVerwaltetAlleGeraete() throws Exception {
        Owner o = createRestaurant("kasse-dev");

        // Inhaber legt (waehrend er da ist) ein Kuechen-Geraet an
        String adminBody = mvc.perform(post("/api/admin/devices").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"Kuechen-Tablet\",\"role\":\"KITCHEN\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long kitchenId = num(JsonPath.read(adminBody, "$.id"));

        // Die Kasse (SERVICE) sieht dieses Geraet in ihrer Liste ...
        createStaffUser(o, "kasse2", "SERVICE");
        RequestPostProcessor kasse = httpBasic("kasse2", "geheim123");

        String list = mvc.perform(get("/api/service/devices").with(kasse))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> labels = JsonPath.read(list, "$[*].label");
        Assertions.assertTrue(labels.contains("Kuechen-Tablet"),
                () -> "Kasse sollte das Kuechen-Geraet des Inhabers sehen, war: " + labels);

        // ... und kann dessen QR-Code abrufen
        mvc.perform(get("/api/service/devices/" + kitchenId + "/qrcode").with(kasse))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));

        // ... und selbst ein Kuechen-Geraet anlegen (nicht nur Kellner)
        mvc.perform(post("/api/service/devices").with(kasse)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"Kueche 2\",\"role\":\"KITCHEN\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("KITCHEN"));
    }
}
