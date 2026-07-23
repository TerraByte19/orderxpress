package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Plattform-Admin: Laeden anlegen, Duplikate/Validierung, aktiv schalten, loeschen, Rechte. */
class PlatformIntegrationTest extends IntegrationTestBase {

    private String restaurantJson(String name, String slug, String user, String pass) {
        return "{\"name\":\"" + name + "\",\"slug\":\"" + slug
                + "\",\"ownerUsername\":\"" + user + "\",\"ownerPassword\":\"" + pass + "\"}";
    }

    @Test
    void ladenAnlegenUndInhaberKannSichAnmelden() throws Exception {
        String slug = uniqueSlug("neu");
        String user = slug + "-chef";
        mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantJson("Mein Laden", slug, user, "geheim123")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value(slug))
                .andExpect(jsonPath("$.active").value(true));

        // Der neue Inhaber kann sich sofort anmelden (leere Tischliste).
        mvc.perform(get("/api/admin/tables").with(httpBasic(user, "geheim123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void doppelterSlugWirdAbgelehnt() throws Exception {
        String slug = uniqueSlug("dup");
        mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantJson("A", slug, slug + "-a", "geheim123")))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantJson("B", slug, slug + "-b", "geheim123")))
                .andExpect(status().isConflict());
    }

    @Test
    void doppelterInhaberNameWirdAbgelehnt() throws Exception {
        // "inhaber" existiert bereits im Demo-Laden.
        mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantJson("X", uniqueSlug("x"), "inhaber", "geheim123")))
                .andExpect(status().isConflict());
    }

    @Test
    void ungueltigerSlugWirdAbgelehnt() throws Exception {
        mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantJson("X", "Gross Und Leer!", "chef-a", "geheim123")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void zuKurzesInhaberPasswortWirdAbgelehnt() throws Exception {
        mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantJson("X", uniqueSlug("pw"), "chef-pw", "123")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ladenAktivierenDeaktivierenUndListe() throws Exception {
        String slug = uniqueSlug("act");
        String body = mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantJson("Aktiv", slug, slug + "-c", "geheim123")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = num(JsonPath.read(body, "$.id"));

        mvc.perform(post("/api/platform/restaurants/" + id + "/active?value=false").with(PLATFORM))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        // Filter-Ausdruecke sind im jsonPath-Matcher unzuverlaessig -> Wert direkt auslesen
        String list = mvc.perform(get("/api/platform/restaurants").with(PLATFORM))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        java.util.List<Boolean> actives = JsonPath.read(list, "$[?(@.slug == '" + slug + "')].active");
        org.junit.jupiter.api.Assertions.assertEquals(1, actives.size(),
                "Laden sollte genau einmal in der Liste stehen");
        org.junit.jupiter.api.Assertions.assertFalse(actives.get(0), "Laden sollte deaktiviert sein");
    }

    @Test
    void frischenLadenLoeschen() throws Exception {
        String slug = uniqueSlug("del");
        String body = mvc.perform(post("/api/platform/restaurants").with(PLATFORM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantJson("Weg", slug, slug + "-d", "geheim123")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = num(JsonPath.read(body, "$.id"));
        mvc.perform(delete("/api/platform/restaurants/" + id).with(PLATFORM))
                .andExpect(status().isNoContent());
    }

    @Test
    void deaktivierterLadenLaesstKeinenScanZu() throws Exception {
        Owner o = createRestaurant("inactive");
        TableRef t = createTable(o, 1);
        mvc.perform(post("/api/platform/restaurants/" + o.restaurantId() + "/active?value=false").with(PLATFORM))
                .andExpect(status().isOk());
        // QR-Scan bei inaktivem Laden -> ungueltig
        mvc.perform(post("/api/guest/scan/" + t.qrToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    void inhaberDarfNichtInDiePlattformVerwaltung() throws Exception {
        mvc.perform(get("/api/platform/restaurants").with(httpBasic("inhaber", "inhaber123")))
                .andExpect(status().isForbidden());
    }

    @Test
    void plattformOhneLoginAbgewiesen() throws Exception {
        mvc.perform(get("/api/platform/restaurants"))
                .andExpect(status().isUnauthorized());
    }
}
