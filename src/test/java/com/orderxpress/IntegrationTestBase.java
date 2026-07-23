package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Gemeinsame Basis fuer die Integrationstests: MockMvc + kleine Helfer, um
 * schnell einen frischen Laden (mit eigenem Inhaber-Login) samt Kategorie,
 * Gericht und Tisch anzulegen und den Gast-/Freigabe-Ablauf durchzuspielen.
 *
 * Jeder Test legt seinen EIGENEN Laden mit eindeutigem slug an, damit sich die
 * Tests nicht gegenseitig stoeren (gemeinsame In-Memory-DB).
 */
@SpringBootTest
@AutoConfigureMockMvc
abstract class IntegrationTestBase {

    /** Plattform-Admin aus src/test/resources/application.yml. */
    protected static final RequestPostProcessor PLATFORM = httpBasic("admin", "test-admin");

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    protected MockMvc mvc;

    protected record Owner(long restaurantId, String username, String password) {}

    protected record TableRef(long id, int number, String qrToken) {}

    protected RequestPostProcessor as(Owner o) {
        return httpBasic(o.username(), o.password());
    }

    protected String uniqueSlug(String prefix) {
        return prefix + "-" + SEQ.incrementAndGet();
    }

    // ---------- Aufbau-Helfer ----------

    protected Owner createRestaurant(String prefix) throws Exception {
        String slug = uniqueSlug(prefix);
        String user = slug + "-chef";
        String json = "{\"name\":\"Laden " + slug + "\",\"slug\":\"" + slug
                + "\",\"ownerUsername\":\"" + user + "\",\"ownerPassword\":\"geheim123\"}";
        String body = mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return new Owner(num(JsonPath.read(body, "$.id")), user, "geheim123");
    }

    protected long createCategory(Owner o, String name) throws Exception {
        String body = mvc.perform(post("/api/admin/categories").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return num(JsonPath.read(body, "$.id"));
    }

    protected long createItem(Owner o, long categoryId, String name, String price) throws Exception {
        String body = mvc.perform(post("/api/admin/menu-items").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":" + categoryId + ",\"name\":\"" + name
                                + "\",\"price\":\"" + price + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return num(JsonPath.read(body, "$.id"));
    }

    protected TableRef createTable(Owner o, int number) throws Exception {
        String body = mvc.perform(post("/api/admin/tables").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":" + number + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return new TableRef(num(JsonPath.read(body, "$.id")), number, JsonPath.read(body, "$.qrToken"));
    }

    /** Kompletter Mini-Laden: Kategorie + Gericht + Tisch. */
    protected long createStaffUser(Owner o, String username, String role) throws Exception {
        String body = mvc.perform(post("/api/admin/users").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"geheim123\",\"role\":\"" + role + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return num(JsonPath.read(body, "$.id"));
    }

    // ---------- Gast-/Freigabe-Helfer ----------

    protected String scan(String qrToken) throws Exception {
        return mvc.perform(post("/api/guest/scan/" + qrToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    protected long pendingSessionId(Owner o, int tableNumber) throws Exception {
        String body = mvc.perform(get("/api/admin/sessions/pending").with(as(o)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Integer> ids = JsonPath.read(body, "$[?(@.tableNumber == " + tableNumber + ")].id");
        return ids.get(0).longValue();
    }

    protected void approveSession(Owner o, long sessionId) throws Exception {
        mvc.perform(post("/api/admin/sessions/" + sessionId + "/approve").with(as(o)))
                .andExpect(status().isOk());
    }

    /** Scannt als Gastgeber und laesst den Tisch vom Laden freigeben; liefert den guestToken. */
    protected String hostAtApprovedTable(Owner o, TableRef table) throws Exception {
        String token = JsonPath.read(scan(table.qrToken()), "$.guestToken");
        approveSession(o, pendingSessionId(o, table.number()));
        return token;
    }

    protected long orderOneItem(String guestToken, long menuItemId) throws Exception {
        String body = mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestToken\":\"" + guestToken + "\",\"items\":[{\"menuItemId\":"
                                + menuItemId + ",\"quantity\":1}]}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return num(JsonPath.read(body, "$.id"));
    }

    protected static long num(Object v) {
        return ((Number) v).longValue();
    }

    /**
     * Prueft einen Geldbetrag im JSON UNABHAENGIG von der Zahlendarstellung.
     * Jackson schreibt BigDecimal je nach Nachkommastellen als 0, 0.0 oder 0.00 -
     * ein direkter equals-Vergleich waere also zufaellig. Deshalb BigDecimal.compareTo.
     */
    protected void assertMoney(String body, String jsonPath, String expected) {
        Object raw = JsonPath.read(body, jsonPath);
        java.math.BigDecimal actual = new java.math.BigDecimal(String.valueOf(raw));
        org.junit.jupiter.api.Assertions.assertEquals(0,
                actual.compareTo(new java.math.BigDecimal(expected)),
                () -> "Betrag bei " + jsonPath + ": erwartet " + expected + ", war " + raw);
    }
}
