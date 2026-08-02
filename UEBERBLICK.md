# OrderXpress – Überblick & Ablauf

*Stand: 26.07.2026 – dieses Dokument beschreibt, was das System kann, wer was darf und wie der Ablauf funktioniert.*

---

## 1. Was ist OrderXpress?

OrderXpress ist ein **QR-Bestellsystem für Restaurants**. Jeder Tisch hat einen QR-Code; der Gast scannt ihn, sieht die Speisekarte auf seinem Handy und bestellt. Die Bestellung geht live an die Küche und wird als Bon gedruckt. Kasse und Kellner behalten die Tische im Blick und rechnen ab.

Das System ist eine **Plattform mit mehreren Läden** (Multi-Store): Jeder Laden hat seine eigenen Tische, Speisekarte, Design, Mitarbeiter und Bestellungen – strikt getrennt von anderen Läden.

---

## 2. Die Beteiligten (Rollen)

| Rolle | Was sie tut | Wie sie sich anmeldet |
|-------|-------------|------------------------|
| **Plattform-Admin** | Legt neue Läden + den ersten Inhaber an | Passwort (global, aus der Konfiguration) |
| **Inhaber (OWNER)** | Speisekarte, Tische, Design, Statistik, Mitarbeiter, Geräte – **sieht alles**; nur er bearbeitet die Speisekarte | Passwort |
| **Kasse / Service (SERVICE)** | Tische freigeben, abrechnen, alle Geräte-QRs verwalten | Passwort **oder** QR-Gerät |
| **Küche (KITCHEN)** | Küchen-Monitor: Bestellungen abarbeiten | Passwort **oder** QR-Gerät |
| **Kellner (WAITER)** | Sieht Bestellungen pro Tisch und rechnet ab (kein Freigeben) | **nur** QR-Gerät (kein Passwort) |
| **Gast** | Scannt den QR, gibt seinen Namen ein, bestellt | **kein Login** – nur QR + Name |

---

## 3. Anmelde-Möglichkeiten (Login)

- **Passwort-Login** für Inhaber (Pflicht) sowie optional Kasse und Küche.
- **QR-Gerät:** Ein Tablet/Handy scannt einen QR-Code einmalig und ist danach **dauerhaft angemeldet** – ohne Passwort. Gedacht für ein festes Küchen-Tablet, ein Kassen-Handy oder das Handy eines Kellners.
- **QR-Scan mit Kamera:** Auf den Login-Seiten (Inhaber, Kasse, Küche) gibt es den Knopf „Mit QR-Code anmelden (Kamera)"; bei den Kellnern ist der Scan der Hauptweg. Die Kamera geht auf, liest den Geräte-QR und meldet direkt an. *(Funktioniert im Browser nur über HTTPS oder localhost – siehe Betriebshinweise.)*
- **Ein Login fürs ganze Personal:** Der Inhaber meldet sich **einmal** an und wechselt über die Leiste oben zwischen Inhaber, Statistik, Service und Küche – ohne sich erneut anzumelden. Kein Login-„Aufblitzen" mehr beim Umschalten.
- **Gäste** brauchen gar kein Login – Schutz läuft über geheime QR-Tokens und die Freigabe durch den Laden.

---

## 4. Der komplette Ablauf

### 4.1 Einrichtung (einmalig)

1. Der **Plattform-Admin** legt den Laden an und vergibt dem **Inhaber** einen Login.
2. Der **Inhaber** richtet ein:
   - **Speisekarte:** Kategorien und Gerichte mit Preis, Beschreibung, „Zutaten & Details" (Allergene) und **Foto**.
   - **Tische:** jeder Tisch bekommt automatisch einen QR-Code (Ausdruck über „QR anzeigen").
   - **Design:** Akzentfarbe, Hintergrundfarbe, Logo, Hintergrundbild, Kategorien optional als Hamburger-Menü, und **ob ein Küchen-Bildschirm verwendet wird**.
   - **Mitarbeiter:** Passwort-Logins (Kasse/Küche) und/oder **Geräte-QRs** (Kasse/Küche/Kellner).

### 4.2 Laufender Betrieb – pro Tisch

1. **Gast scannt** den QR am Tisch → beim Laden erscheint live „**Tisch X freigeben?**".
2. **Kasse** (oder Inhaber) gibt frei. Der erste Gast ist der **Gastgeber**.
3. **Weitere Personen** am selben Tisch scannen denselben Code → der **Gastgeber** lässt sie mit „Ja, reinlassen" herein.
4. Der Gast **gibt seinen Namen ein** (Pflicht) – erst danach erscheint die Speisekarte. Der Name steht später in der geteilten Rechnung.
5. Der Gast **bestellt**. Der Warenkorb bleibt auch nach einem Neuladen der Seite erhalten. Jede Bestellung geht **live** an die Küche und wird als **Bon gedruckt**.
6. **Küche:** eine Karte **pro Tisch** (alle Bestellungen zusammengefasst). Status: Zubereiten → Fertig → Serviert; dazu Storno und Bon-Nachdruck. *(Läden ohne Küchen-Bildschirm arbeiten nur mit dem gedruckten Bon.)*
7. **Kellner** sehen auf dem Handy pro Tisch, **wer was bestellt hat**.

### 4.3 Abrechnen & beenden

8. **Abrechnen:** Kasse **oder** Kellner öffnet die Rechnung des Tisches, wählt Positionen aus und markiert sie als **bezahlt** – auch geteilt (jeder zahlt seins).
9. **Beenden:** Kasse oder Inhaber **beendet die Sitzung** → der Tisch ist wieder frei.

---

## 5. Funktionen im Detail

### Inhaber
- Freigabe-Anfragen live annehmen/ablehnen.
- Tische anlegen/bearbeiten/aktiv schalten/löschen, QR-Code je Tisch anzeigen.
- Speisekarte komplett verwalten (Kategorien, Gerichte, Fotos, Verfügbarkeit, Details/Allergene).
- Design der Gäste-Seite (Farben, Logo, Hintergrund, Hamburger-Menü).
- **Küchen-Bildschirm an/aus** (aus = nur gedruckter Bon).
- Mitarbeiter-Logins (Kasse/Küche) und Geräte-QRs verwalten.
- **Statistik** (siehe unten).

### Kasse / Service
- Tische freigeben/ablehnen, Sitzungen beenden.
- Laufende Bestellungen im Blick.
- **Abrechnen:** geteilte Rechnung, Positionen als bezahlt markieren.
- **Alle Geräte-QRs verwalten** (Küche, Kasse, Kellner) – anlegen, QR anzeigen, neu einrichten, sperren. *(Gedacht, weil der Inhaber nicht immer im Laden ist, die Kasse aber schon.)*

### Küche
- Küchen-Monitor mit 3 Spalten (Neu / In Zubereitung / Fertig), **eine Karte pro Tisch**.
- Statuswechsel, Storno, Bon-Nachdruck.

### Kellner
- Alle belegten Tische live, Positionen je Person (wer hat was bestellt).
- **Kassieren:** Positionen wählen und als bezahlt markieren. Kein Freigeben.

### Gast
- Scan → warten auf Freigabe → Name eingeben → Speisekarte.
- Gericht antippen für Detail-Ansicht (großes Bild, Preis, Beschreibung, Zutaten/Allergene, Menge, Hinweis).
- Warenkorb mit Mengen und Hinweisen; übersteht Neuladen.
- Mehrere Personen am Tisch, Beitritt über den Gastgeber.
- Geteilte Rechnung ansehen und die eigene Summe auswählen.

### Statistik (nur Inhaber, eigene Seite)
- Zeiträume **Heute / Woche / Monat / Gesamt** und **freier Datumsbereich**.
- Kennzahlen: Umsatz, Anzahl Bestellungen, verkaufte Artikel, **Ø pro Bestellung**.
- **Meistverkaufte Produkte** (Balken) und Diagramme **Umsatz pro Tag** + **Stoßzeiten** (nach Uhrzeit).
- Stornierte Bestellungen zählen nie mit.
- **Zwei Lösch-Wege:** *Zurücksetzen* (ab jetzt neu zählen, Bestellungen bleiben) und *Bestellverlauf endgültig löschen* (nur abgeschlossene Sitzungen).

### Bon-Druck
- Sauberer Ausdruck: Ladenname (groß, zentriert), Tisch/Bestellnummer, **Gastname**, Uhrzeit, Positionen mit Hinweisen; lange Namen werden umgebrochen.
- Zwei Modi: nur ins Log schreiben (Entwicklung) oder echter Netzwerk-Bondrucker (ESC/POS, Port 9100). Ein Druckfehler bricht **nie** die Bestellung ab – die Küche kann nachdrucken.

### App-Installation (PWA)
- Alle **Personal-Seiten** lassen sich als App installieren: Handy/Tablet „zum Startbildschirm hinzufügen", PC über Chrome/Edge → eigenes Fenster mit eigenem Icon.
- **Gäste** bekommen bewusst **keine** Installation – sie bleiben im Browser.
- *(Echte Installation braucht HTTPS; lokal geht `localhost`.)*

---

## 6. Technischer Überblick

- **Stack:** Spring Boot 4.1 (Java 17, Maven), Spring Security 7, Spring Data JPA/Hibernate 7. Lokal H2 (dateibasiert), fürs Deployment PostgreSQL möglich.
- **Architektur:** Domäne (Restaurant, Tisch, Sitzung, Gast, Bestellung, Position, Gerät …), Services (Bestellung, Kasse/Billing, Menü, Druck, Statistik, Geräte …), Controller je Rolle (`/api/platform`, `/api/admin`, `/api/service`, `/api/waiter`, `/api/kitchen`, `/api/guest`, `/api/device`, `/api/me`).
- **Multi-Store:** Jede Abfrage ist auf den eigenen Laden beschränkt (`restaurantId` aus dem angemeldeten Benutzer bzw. Gerät). Fremde Daten werden wie „nicht gefunden" behandelt.
- **Live-Updates:** Server-Sent Events (SSE) je Laden – Freigabe-Anfragen und neue Bestellungen erscheinen sofort.
- **Sicherheit:** Basic Auth (Passwort) bzw. Geräte-Token im Header; Preise werden **nur serverseitig** berechnet; Gast-Schutz über geheime Tokens + Freigabe; Spam-Schutz mit 5 Min Abklingzeit nach Ablehnung.
- **Frontend:** eigener Ordner `frontend/` (Vite + TypeScript), gebaut nach `src/main/resources/static` – dieser Ordner ist **generiert** (nicht von Hand bearbeiten, jeder Bau leert ihn). Startseite und Geräte-Anmeldung sind bereits umgestellt; die restlichen sieben Seiten laufen unverändert als HTML/CSS/JS unter `frontend/public/` und werden von Vite nur durchgereicht, gemeinsames `api.js` weiterhin dabei.
- **Tests:** umfangreiche Integrationstests (Plattform, Mandanten-Trennung, Menü, Tische, Mitarbeiter, Design, Gäste/Beitritt/Rechnung, Küche, Statistik, Kellner, Geräte, Küchen-Schalter …).

---

## 7. Betriebshinweise (wichtig)

- **Kamera-Login & App-Installation brauchen HTTPS** (oder `localhost`). Im WLAN über `http://192.168…` bietet der Browser keine Kamera und keine Installation an. Über einen HTTPS-Server (z.B. Render) geht beides überall.
- **Nur eine App-Instanz** gleichzeitig laufen lassen (Port 8080).
- **Datenbank-Reset** (nur bei bestimmten Schema-Änderungen nötig): App stoppen → Ordner `data/` löschen → starten. `data/` **niemals** löschen, solange die App läuft.
- Nach Änderungen lokal immer **`mvn clean test`** bzw. **`mvn clean spring-boot:run`** (das `clean` erzwingt das Neukompilieren).

---

## 8. Demo-Zugänge (bei leerer Datenbank angelegt)

- **Plattform-Admin:** `admin` / `admin123`
- **Inhaber:** `inhaber` / `inhaber123`
- **Service/Kasse:** `service` / `service123`
- **Küche:** `kueche` / `kueche123`
- Demo-Laden „Demo-Restaurant" mit 8 Tischen und Musterkarte.

---

## 9. Was noch offen ist

1. Vor echtem Einsatz: Passwörter ändern, H2-Konsole + Swagger sperren, HTTPS aktivieren, echte Domain in `public-base-url` setzen.
2. Später: PostgreSQL + Flyway statt automatischem Schema-Update, echten Bondrucker testen, evtl. echte Bezahlung.
