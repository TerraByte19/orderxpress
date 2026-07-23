package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Personen am Tisch: Beitreten, Gastgeber-Freigabe, Ablehnen, geteilte Rechnung, Kasse. */
class GuestJoinBillingIntegrationTest extends IntegrationTestBase {

    /** Legt Laden + Tisch + ein Gericht an und gibt den Gastgeber frei. */
    private Setup setup(String prefix) throws Exception {
        Owner o = createRestaurant(prefix);
        long cat = createCategory(o, "Speisen");
        long item = createItem(o, cat, "Cola", "3.50");
        TableRef table = createTable(o, 1);
        String host = hostAtApprovedTable(o, table);
        return new Setup(o, table, item, host);
    }

    private record Setup(Owner owner, TableRef table, long itemId, String hostToken) {}

    /** Scannt eine weitere Person; liefert deren guestToken. */
    private String join(TableRef table) throws Exception {
        return JsonPath.read(scan(table.qrToken()), "$.guestToken");
    }

    private long firstJoinRequestId(String hostToken) throws Exception {
        String reqs = mvc.perform(get("/api/guest/guests/" + hostToken + "/join-requests"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return num(JsonPath.read(reqs, "$[0].id"));
    }

    @Test
    void beitretenderWartetUndDarfNichtBestellen() throws Exception {
        Setup s = setup("join1");
        String joiner = join(s.table());

        mvc.perform(get("/api/guest/guests/" + joiner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isHost").value(false))
                .andExpect(jsonPath("$.guestStatus").value("PENDING"));

        mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestToken\":\"" + joiner + "\",\"items\":[{\"menuItemId\":" + s.itemId()
                                + ",\"quantity\":1}]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void nurGastgeberDarfFreigeben() throws Exception {
        Setup s = setup("join2");
        String joiner = join(s.table());
        long joinerId = firstJoinRequestId(s.hostToken());

        // Der Beitretende versucht, sich selbst freizugeben -> abgelehnt (kein Gastgeber)
        mvc.perform(post("/api/guest/guests/" + joiner + "/join-requests/" + joinerId + "/approve"))
                .andExpect(status().isConflict());
    }

    @Test
    void gastgeberGibtFreiUndDoppelteFreigabeSchlaegtFehl() throws Exception {
        Setup s = setup("join3");
        join(s.table());
        long joinerId = firstJoinRequestId(s.hostToken());

        mvc.perform(post("/api/guest/guests/" + s.hostToken() + "/join-requests/" + joinerId + "/approve"))
                .andExpect(status().isNoContent());
        // zweite Freigabe derselben Anfrage -> nicht mehr offen
        mvc.perform(post("/api/guest/guests/" + s.hostToken() + "/join-requests/" + joinerId + "/approve"))
                .andExpect(status().isConflict());
    }

    @Test
    void abgelehnterBeitretenderDarfNichtBestellen() throws Exception {
        Setup s = setup("join4");
        String joiner = join(s.table());
        long joinerId = firstJoinRequestId(s.hostToken());

        mvc.perform(post("/api/guest/guests/" + s.hostToken() + "/join-requests/" + joinerId + "/reject"))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/guest/guests/" + joiner))
                .andExpect(jsonPath("$.guestStatus").value("REJECTED"));
        mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestToken\":\"" + joiner + "\",\"items\":[{\"menuItemId\":" + s.itemId()
                                + ",\"quantity\":1}]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void fremdeBeitrittsAnfrageKannNichtFreigegebenWerden() throws Exception {
        Setup a = setup("cross-a");
        Setup b = setup("cross-b");
        join(b.table());
        long joinerB = firstJoinRequestId(b.hostToken());

        // Gastgeber A versucht, einen Beitretenden von Tisch B freizugeben -> nicht gefunden
        mvc.perform(post("/api/guest/guests/" + a.hostToken() + "/join-requests/" + joinerB + "/approve"))
                .andExpect(status().isNotFound());
    }

    @Test
    void nameAendernErscheintInDerGeteiltenRechnung() throws Exception {
        Setup s = setup("name");
        // Gastgeber benennt sich um und bestellt
        mvc.perform(put("/api/guest/guests/" + s.hostToken() + "/name")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Adham\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Adham"));
        orderOneItem(s.hostToken(), s.itemId());

        mvc.perform(get("/api/guest/guests/" + s.hostToken() + "/bill"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants[?(@.name == 'Adham')]").exists());
    }

    @Test
    void geteilteRechnungGruppiertNachPerson() throws Exception {
        Setup s = setup("bill");
        // Gastgeber bestellt
        orderOneItem(s.hostToken(), s.itemId());
        // Zweite Person beitreten + freigeben + bestellen
        String joiner = join(s.table());
        long joinerId = firstJoinRequestId(s.hostToken());
        mvc.perform(post("/api/guest/guests/" + s.hostToken() + "/join-requests/" + joinerId + "/approve"))
                .andExpect(status().isNoContent());
        orderOneItem(joiner, s.itemId());

        // Rechnung: zwei Personen, Gesamtsumme 7,00 (2x Cola je 3,50), nichts bezahlt
        String bill = mvc.perform(get("/api/guest/guests/" + s.hostToken() + "/bill"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        assertMoney(bill, "$.grandTotal", "7.00");
        assertMoney(bill, "$.openTotal", "7.00");
        assertMoney(bill, "$.paidTotal", "0.00");
        // jede Person genau 3,50
        assertMoney(bill, "$.participants[0].total", "3.50");
        assertMoney(bill, "$.participants[1].total", "3.50");
    }

    @Test
    void kasseMarkiertPositionAlsBezahlt() throws Exception {
        Setup s = setup("kasse");
        orderOneItem(s.hostToken(), s.itemId());

        String bill = mvc.perform(get("/api/service/tables/" + s.table().id() + "/bill").with(as(s.owner())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long lineId = num(JsonPath.read(bill, "$.participants[0].items[0].orderItemId"));

        mvc.perform(post("/api/service/settle").with(as(s.owner()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderItemIds\":[" + lineId + "]}"))
                .andExpect(status().isNoContent());

        String after = mvc.perform(get("/api/service/tables/" + s.table().id() + "/bill").with(as(s.owner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants[0].items[0].paid").value(true))
                .andReturn().getResponse().getContentAsString();
        // Nach dem Kassieren: bezahlt = 3,50 und NICHTS mehr offen
        assertMoney(after, "$.paidTotal", "3.50");
        assertMoney(after, "$.openTotal", "0.00");
        assertMoney(after, "$.participants[0].openTotal", "0.00");
    }

    @Test
    void gastKannKasseNichtBedienen() throws Exception {
        // Ohne Personal-Login kein Zugriff auf die Kasse
        mvc.perform(post("/api/service/settle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderItemIds\":[1]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unbekannterGuestTokenLiefert404() throws Exception {
        mvc.perform(get("/api/guest/guests/gibt-es-nicht"))
                .andExpect(status().isNotFound());
    }
}
