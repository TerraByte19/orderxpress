package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sichert die Auslieferung der Vite-gebuendelten Frontend-Dateien ab.
 *
 * Seit der Umstellung auf Vite liegen alle gebuendelten JS-/CSS-/Font-Dateien
 * unter /assets/**, wobei jeder Dateiname einen Pruefsummen-Hash traegt (z.B.
 * index-Ty9hc2Lx.js) und sich bei jedem Frontend-Build aendert. Ein Test darf
 * sich also NICHT auf einen konkreten Dateinamen verlassen - genau das hat den
 * urspruenglichen Bug (fehlendes /assets/** in der permitAll()-Regel) durch
 * zehn Code-Reviews rutschen lassen, weil niemand die App gestartet hat.
 *
 * Der Trick: Eine Anfrage auf einen frei erfundenen Pfad unter einer
 * permitAll()-Route laeuft an Spring Security VORBEI und landet beim
 * ResourceHttpRequestHandler, der die (nicht vorhandene) Datei mit 404
 * meldet. Fehlt die Route dagegen in der permitAll()-Regel, weist schon der
 * Security-Filter mit 401 ab, bevor ueberhaupt nach der Datei gesucht wird.
 * Der Unterschied zwischen 404 und 401 beweist damit die Freigabe, ohne dass
 * der Test einen echten (und damit fluechtigen) Dateinamen kennen muss.
 *
 * /manifest.webmanifest und /service-worker.js sind dagegen feste, durch die
 * PWA-Spezifikation vorgegebene Dateinamen (kein Hash) - die koennen direkt
 * abgefragt werden.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AssetsSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void unbekannteDateiUnterAssetsLiefertNichtGefundenStattUnauthorized() throws Exception {
        // Pruefsummen-Dateiname ist frei erfunden. Er darf 404 liefern (Datei
        // gibt es nicht), aber NICHT 401 (das hiesse: Security blockt /assets/**
        // wieder, wie im urspruenglichen Bug).
        mockMvc.perform(get("/assets/gibtsnicht-Ab12Cd34.js"))
                .andExpect(status().isNotFound());
    }

    @Test
    void unbekannteDateiUnterIconsLiefertNichtGefundenStattUnauthorized() throws Exception {
        mockMvc.perform(get("/icons/gibtsnicht.png"))
                .andExpect(status().isNotFound());
    }

    @Test
    void manifestWebmanifestIstOeffentlichErreichbar() throws Exception {
        mockMvc.perform(get("/manifest.webmanifest"))
                .andExpect(status().isOk());
    }

    @Test
    void serviceWorkerJsIstOeffentlichErreichbar() throws Exception {
        mockMvc.perform(get("/service-worker.js"))
                .andExpect(status().isOk());
    }
}
