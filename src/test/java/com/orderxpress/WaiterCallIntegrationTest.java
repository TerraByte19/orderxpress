package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * "Kellner rufen": ein freigegebener Gast loest einen Ruf aus, Kasse/Kellner
 * sehen ihn und haken ihn ab. Dazu: nur ein offener Ruf pro Tisch, nur
 * freigegebene Gaeste duerfen rufen, Mandanten-Trennung und Rollengrenzen.
 */
class WaiterCallIntegrationTest extends IntegrationTestBase {

    private void call(String guestToken) throws Exception {
        mvc.perform(post("/api/guest/guests/" + guestToken + "/call"))
                .andExpect(status().isNoContent());
    }

    @Test
    void gastRuftKasseSiehtUndErledigt() throws Exception {
        Owner o = createRestaurant("call");
        TableRef t = createTable(o, 4);
        String host = hostAtApprovedTable(o, t);
        mvc.perform(put("/api/guest/guests/" + host + "/name")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Adham\"}"))
                .andExpect(status().isOk());

        call(host);

        // Kasse sieht den offenen Ruf mit Tisch + Name
        String body = mvc.perform(get("/api/calls").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].tableNumber").value(4))
                .andExpect(jsonPath("$[0].guestName").value("Adham"))
                .andReturn().getResponse().getContentAsString();
        long callId = num(JsonPath.read(body, "$[0].id"));

        // erneutes Rufen erzeugt KEINEN zweiten Ruf (Dubletten-Schutz)
        call(host);
        mvc.perform(get("/api/calls").with(as(o)))
                .andExpect(jsonPath("$.length()").value(1));

        // erledigen -> Liste leer
        mvc.perform(post("/api/calls/" + callId + "/done").with(as(o)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/calls").with(as(o)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void gleichzeitigeRufeErzeugenNurEinenOffenenRuf() throws Exception {
        // Race-Condition-Regressionstest: zwei parallele Rufe desselben Tisches
        // duerfen (dank Sperre auf der Sitzungszeile) nicht zwei offene Eintraege anlegen.
        Owner o = createRestaurant("call-race");
        TableRef t = createTable(o, 7);
        String host = hostAtApprovedTable(o, t);

        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        try {
            for (int i = 0; i < threads; i++) {
                pool.submit(() -> {
                    ready.countDown();
                    try {
                        go.await();
                        call(host);
                    } catch (Exception ignored) {
                        // Einzelne Fehlschlaege sind fuer diesen Test nicht relevant.
                    }
                });
            }
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            go.countDown();
            pool.shutdown();
            assertTrue(pool.awaitTermination(20, TimeUnit.SECONDS));
        } finally {
            pool.shutdownNow();
        }

        mvc.perform(get("/api/calls").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void nichtFreigegebenerGastKannNichtRufen() throws Exception {
        Owner o = createRestaurant("call-pending");
        TableRef t = createTable(o, 1);
        // scannen, aber NICHT freigeben -> Gast ist PENDING
        String token = JsonPath.read(scan(t.qrToken()), "$.guestToken");
        mvc.perform(post("/api/guest/guests/" + token + "/call"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rufNurImEigenenLaden() throws Exception {
        Owner a = createRestaurant("call-a");
        Owner b = createRestaurant("call-b");
        TableRef tb = createTable(b, 1);
        String hostB = hostAtApprovedTable(b, tb);
        call(hostB);

        mvc.perform(get("/api/calls").with(as(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void kuecheDarfRufeNichtSehen() throws Exception {
        Owner o = createRestaurant("call-roles");
        // Benutzernamen sind plattformweit eindeutig (Login laeuft nur ueber den
        // Namen). Ein fester Name wie "kueche" kollidiert mit dem Demo-Zugang aus
        // dem DataInitializer -> 409. Deshalb wie in StaffUserIntegrationTest
        // einen eindeutigen Namen erzeugen.
        String kueche = uniqueSlug("call-kit");
        createStaffUser(o, kueche, "KITCHEN");

        mvc.perform(get("/api/calls").with(httpBasic(kueche, "geheim123")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/calls"))
                .andExpect(status().isUnauthorized());
    }
}
