package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fotos fuer Gerichte: Upload durch den Inhaber (mit Verkleinern), Abruf durch
 * Gaeste, Ablehnung von Nicht-Bildern, Loeschen. Nutzt einen eigenen Test-Laden.
 */
class MenuImageIntegrationTest extends IntegrationTestBase {

    @Test
    void bildHochladenAbrufenUndLoeschen() throws Exception {
        Owner o = createRestaurant("img");
        long cat = createCategory(o, "Speisen");
        long itemId = createItem(o, cat, "Burger", "12.00");

        // 1) Inhaber laedt ein (grosses) JPG hoch -> angenommen und verkleinert
        mvc.perform(multipart("/api/admin/menu-items/" + itemId + "/image").with(as(o))
                        .file(new MockMultipartFile("file", "essen.jpg", "image/jpeg", testJpeg())))
                .andExpect(status().isNoContent());

        // 2) Gast kann das Bild ohne Login abrufen
        mvc.perform(get("/api/guest/menu-items/" + itemId + "/image"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG));

        // 3) Nicht-Bilder werden abgelehnt
        mvc.perform(multipart("/api/admin/menu-items/" + itemId + "/image").with(as(o))
                        .file(new MockMultipartFile("file", "boese.txt", "text/plain", "kein Bild".getBytes())))
                .andExpect(status().isBadRequest());

        // 4) Upload ohne Login ist gesperrt
        mvc.perform(multipart("/api/admin/menu-items/" + itemId + "/image")
                        .file(new MockMultipartFile("file", "essen.jpg", "image/jpeg", testJpeg())))
                .andExpect(status().isUnauthorized());

        // 5) Inhaber loescht das Bild -> Abruf liefert 404
        mvc.perform(delete("/api/admin/menu-items/" + itemId + "/image").with(as(o)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/guest/menu-items/" + itemId + "/image"))
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
