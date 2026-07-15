package com.orderxpress;

import com.orderxpress.repository.MenuItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testet Fotos fuer Gerichte: Upload durch den Inhaber, Abruf durch Gaeste,
 * Ablehnung von Nicht-Bildern, Loeschen.
 */
@SpringBootTest
@AutoConfigureMockMvc
class MenuImageIntegrationTest {

    private static final String OWNER = "inhaber";
    private static final String OWNER_PASSWORD = "inhaber123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MenuItemRepository menuItemRepository;

    @Test
    void bildHochladenAbrufenUndLoeschen() throws Exception {
        Long itemId = menuItemRepository.findAll().get(0).getId();

        // 1) Inhaber laedt ein (grosses) JPG hoch -> wird angenommen und verkleinert
        mockMvc.perform(multipart("/api/admin/menu-items/" + itemId + "/image")
                        .file(new MockMultipartFile("file", "essen.jpg", "image/jpeg", testJpeg()))
                        .with(httpBasic(OWNER, OWNER_PASSWORD)))
                .andExpect(status().isNoContent());

        // 2) Gast kann das Bild ohne Login abrufen
        mockMvc.perform(get("/api/guest/menu-items/" + itemId + "/image"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG));

        // 3) Nicht-Bilder werden abgelehnt
        mockMvc.perform(multipart("/api/admin/menu-items/" + itemId + "/image")
                        .file(new MockMultipartFile("file", "boese.txt", "text/plain", "kein Bild".getBytes()))
                        .with(httpBasic(OWNER, OWNER_PASSWORD)))
                .andExpect(status().isBadRequest());

        // 4) Upload ohne Login ist gesperrt
        mockMvc.perform(multipart("/api/admin/menu-items/" + itemId + "/image")
                        .file(new MockMultipartFile("file", "essen.jpg", "image/jpeg", testJpeg())))
                .andExpect(status().isUnauthorized());

        // 5) Inhaber loescht das Bild -> Abruf liefert 404
        mockMvc.perform(delete("/api/admin/menu-items/" + itemId + "/image")
                        .with(httpBasic(OWNER, OWNER_PASSWORD)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/guest/menu-items/" + itemId + "/image"))
                .andExpect(status().isNotFound());
    }

    /** Erzeugt ein Test-JPG (1600x900), groesser als die 1000px-Grenze. */
    private static byte[] testJpeg() throws Exception {
        BufferedImage image = new BufferedImage(1600, 900, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(200, 80, 40));
        graphics.fillRect(0, 0, 1600, 900);
        graphics.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", out);
        return out.toByteArray();
    }
}
