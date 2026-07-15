package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import com.orderxpress.domain.RestaurantTable;
import com.orderxpress.repository.RestaurantTableRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testet den kompletten Ablauf:
 * QR-Scan -> "Tisch freigeben?" -> Freigabe -> Menue -> Bestellung -> Kueche -> Sitzung beenden.
 */
@SpringBootTest
@AutoConfigureMockMvc
class OrderFlowIntegrationTest {

    private static final String OWNER = "inhaber";
    private static final String OWNER_PASSWORD = "inhaber123";
    private static final String KITCHEN = "kueche";
    private static final String KITCHEN_PASSWORD = "kueche123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RestaurantTableRepository tableRepository;

    @Test
    void kompletterBestellablaufVonScanBisServiert() throws Exception {
        RestaurantTable table = firstTable(0);

        // 1) Gast scannt den QR-Code -> Freigabe-Anfrage entsteht
        String scanBody = mockMvc.perform(post("/api/guest/scan/" + table.getQrToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.tableNumber").value(table.getNumber()))
                .andReturn().getResponse().getContentAsString();
        String sessionToken = JsonPath.read(scanBody, "$.sessionToken");
        Integer restaurantId = JsonPath.read(scanBody, "$.restaurantId");

        // 2) Gast sieht die Karte des Ladens (oeffentlich)
        String menuBody = mockMvc.perform(get("/api/guest/menu/" + restaurantId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].items[0].id").exists())
                .andReturn().getResponse().getContentAsString();
        Integer menuItemId = JsonPath.read(menuBody, "$[0].items[0].id");

        // 3) Bestellen VOR der Freigabe ist nicht erlaubt
        mockMvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderJson(sessionToken, menuItemId)))
                .andExpect(status().isConflict());

        // 4) Inhaber sieht die Anfrage "Tisch Nr. X freigeben?"
        // (gezielt nach Tischnummer filtern - andere Tests koennen parallel
        //  eigene Anfragen in der Liste haben, die Reihenfolge ist nicht garantiert)
        String pendingBody = mockMvc.perform(get("/api/admin/sessions/pending")
                        .with(httpBasic(OWNER, OWNER_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.tableNumber == %d)]".formatted(table.getNumber())).exists())
                .andReturn().getResponse().getContentAsString();
        List<Integer> pendingIds = JsonPath.read(pendingBody,
                "$[?(@.tableNumber == %d)].id".formatted(table.getNumber()));
        Integer sessionId = pendingIds.get(0);

        // 5) Inhaber gibt den Tisch frei
        mockMvc.perform(post("/api/admin/sessions/" + sessionId + "/approve")
                        .with(httpBasic(OWNER, OWNER_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // 6) Gast sieht die Freigabe
        mockMvc.perform(get("/api/guest/sessions/" + sessionToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // 7) Gast bestellt -> Preis kommt vom Server, Status NEW
        String orderBody = mockMvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderJson(sessionToken, menuItemId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("NEW"))
                .andExpect(jsonPath("$.tableNumber").value(table.getNumber()))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.totalAmount").isNumber())
                .andReturn().getResponse().getContentAsString();
        Integer orderId = JsonPath.read(orderBody, "$.id");

        // 7b) Gast sieht seine Bestellung unter "Meine Bestellungen"
        mockMvc.perform(get("/api/guest/sessions/" + sessionToken + "/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(orderId))
                .andExpect(jsonPath("$[0].items[0].quantity").value(2));

        // 8) Kueche sieht die Bestellung
        mockMvc.perform(get("/api/kitchen/orders")
                        .with(httpBasic(KITCHEN, KITCHEN_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == %d)]".formatted(orderId)).exists());

        // 9) Kueche schaltet den Status weiter
        updateStatus(orderId, "IN_PREPARATION").andExpect(status().isOk());
        updateStatus(orderId, "READY").andExpect(status().isOk());
        updateStatus(orderId, "SERVED").andExpect(status().isOk());

        // 10) Unsinniger Statuswechsel wird abgelehnt
        updateStatus(orderId, "IN_PREPARATION").andExpect(status().isConflict());

        // 11) Inhaber beendet die Sitzung -> Tisch wieder frei, Bestellen nicht mehr moeglich
        mockMvc.perform(post("/api/admin/sessions/" + sessionId + "/close")
                        .with(httpBasic(OWNER, OWNER_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));

        mockMvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderJson(sessionToken, menuItemId)))
                .andExpect(status().isConflict());
    }

    @Test
    void zweiterScanLiefertDieselbePendingSitzung() throws Exception {
        RestaurantTable table = firstTable(1);

        String first = mockMvc.perform(post("/api/guest/scan/" + table.getQrToken()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String second = mockMvc.perform(post("/api/guest/scan/" + table.getQrToken()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String firstToken = JsonPath.read(first, "$.sessionToken");
        String secondToken = JsonPath.read(second, "$.sessionToken");
        org.junit.jupiter.api.Assertions.assertEquals(firstToken, secondToken,
                "Doppelter Scan darf keine zweite Freigabe-Anfrage erzeugen");
    }

    @Test
    void nachAblehnungGreiftDieAbklingzeit() throws Exception {
        RestaurantTable table = firstTable(2);

        // Scan -> Anfrage entsteht
        mockMvc.perform(post("/api/guest/scan/" + table.getQrToken()))
                .andExpect(status().isOk());

        // Inhaber lehnt genau die Anfrage dieses Tisches ab
        String pendingBody = mockMvc.perform(get("/api/admin/sessions/pending")
                        .with(httpBasic(OWNER, OWNER_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Integer> ids = JsonPath.read(pendingBody,
                "$[?(@.tableNumber == %d)].id".formatted(table.getNumber()));
        mockMvc.perform(post("/api/admin/sessions/" + ids.get(0) + "/reject")
                        .with(httpBasic(OWNER, OWNER_PASSWORD)))
                .andExpect(status().isOk());

        // Sofortiger erneuter Scan wird abgeblockt (Spam-Schutz)
        mockMvc.perform(post("/api/guest/scan/" + table.getQrToken()))
                .andExpect(status().isConflict());
    }

    @Test
    void unbekannterQrCodeWirdAbgelehnt() throws Exception {
        mockMvc.perform(post("/api/guest/scan/gibt-es-nicht"))
                .andExpect(status().isNotFound());
    }

    @Test
    void bestellungOhnePositionenIstUngueltig() throws Exception {
        mockMvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionToken\":\"egal\",\"items\":[]}"))
                .andExpect(status().isBadRequest());
    }

    private org.springframework.test.web.servlet.ResultActions updateStatus(Integer orderId, String status)
            throws Exception {
        return mockMvc.perform(post("/api/kitchen/orders/" + orderId + "/status")
                .with(httpBasic(KITCHEN, KITCHEN_PASSWORD))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}"));
    }

    private RestaurantTable firstTable(int index) {
        List<RestaurantTable> tables = tableRepository.findAll().stream()
                .sorted(java.util.Comparator.comparingInt(RestaurantTable::getNumber))
                .toList();
        return tables.get(index);
    }

    private static String orderJson(String sessionToken, Integer menuItemId) {
        return """
                {
                  "sessionToken": "%s",
                  "items": [
                    {"menuItemId": %d, "quantity": 2, "note": "ohne Zwiebeln"}
                  ]
                }
                """.formatted(sessionToken, menuItemId);
    }
}
