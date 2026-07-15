# OrderXpress Backend

QR-Bestellsystem für Restaurants (Spring Boot 4.1, Java 17, REST API).

**Der Ablauf:** Jeder Tisch hat einen QR-Code. Scannt ein Gast ihn, erscheint beim
Inhaber die Meldung **"Tisch Nr. X freigeben?"** (Absicherung gegen Fremd-Scans).
Nach der Freigabe sieht der Gast die Speisekarte und bestellt. Die Bestellung
geht live an die Küche und wird als Bon gedruckt.

## Starten

Voraussetzungen: JDK 17 oder neuer, Maven (in IntelliJ bereits enthalten).

```bash
mvn spring-boot:run      # App starten -> http://localhost:8080
mvn test                 # Integrationstests ausführen
```

Beim ersten Start werden automatisch 8 Tische und eine Beispiel-Speisekarte angelegt.
Die Daten liegen in `./data/` (dateibasierte H2-Datenbank, kein DB-Server nötig).

**Logins** (in `src/main/resources/application.yml` ändern!):

| Rolle   | Benutzer  | Passwort     | Darf                                  |
|---------|-----------|--------------|---------------------------------------|
| Inhaber | `inhaber` | `inhaber123` | alles (`/api/admin/**`, `/api/kitchen/**`) |
| Küche   | `kueche`  | `kueche123`  | Küchen-Ansicht (`/api/kitchen/**`)     |

Datenbank-Konsole (nur Entwicklung): http://localhost:8080/h2-console
(JDBC-URL `jdbc:h2:file:./data/orderxpress`, Benutzer `sa`, kein Passwort).

**API testen mit Swagger:** http://localhost:8080/swagger-ui.html -
alle Endpunkte anklickbar ausprobieren. Für Admin-/Küchen-Endpunkte oben rechts
auf **Authorize** klicken und mit `inhaber`/`inhaber123` (oder `kueche`/`kueche123`)
anmelden. Gast-Endpunkte funktionieren ohne Anmeldung.

## Der komplette Ablauf per curl

```bash
# 0) QR-Token eines Tisches holen (Inhaber)
curl -u inhaber:inhaber123 http://localhost:8080/api/admin/tables

# 1) Gast scannt den QR-Code (Inhalt des QR-Codes: <base-url>/t/<qrToken>)
curl -X POST http://localhost:8080/api/guest/scan/<qrToken>
# -> {"sessionToken":"...","status":"PENDING","tableNumber":1}

# 2) Inhaber sieht "Tisch Nr. 1 freigeben?" und gibt frei
curl -u inhaber:inhaber123 http://localhost:8080/api/admin/sessions/pending
curl -u inhaber:inhaber123 -X POST http://localhost:8080/api/admin/sessions/<id>/approve

# 3) Gast sieht die Karte und bestellt
curl http://localhost:8080/api/guest/menu
curl -X POST http://localhost:8080/api/guest/orders \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"<token>","items":[{"menuItemId":6,"quantity":2,"note":"ohne Basilikum"}]}'

# 4) Küche sieht die Bestellung und schaltet den Status weiter
curl -u kueche:kueche123 http://localhost:8080/api/kitchen/orders
curl -u kueche:kueche123 -X POST http://localhost:8080/api/kitchen/orders/<id>/status \
  -H "Content-Type: application/json" -d '{"status":"IN_PREPARATION"}'

# 5) Gäste gehen -> Inhaber beendet die Sitzung, Tisch ist wieder frei
curl -u inhaber:inhaber123 -X POST http://localhost:8080/api/admin/sessions/<id>/close
```

## Endpunkte

**Gast (öffentlich, abgesichert über geheime Tokens + Freigabe):**

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/guest/scan/{qrToken}` | QR gescannt -> Freigabe-Anfrage |
| GET | `/api/guest/sessions/{sessionToken}` | Freigabe-Status abfragen |
| GET | `/api/guest/menu` | Speisekarte |
| POST | `/api/guest/orders` | Bestellung abschicken |
| GET | `/api/guest/sessions/{sessionToken}/orders` | Eigene Bestellungen |

**Inhaber (`/api/admin/**`):** `sessions/pending`, `sessions/{id}/approve|reject|close`,
`orders`, `events` (SSE-Livestream), CRUD für `tables`, `categories`, `menu-items`,
`tables/{id}/qrcode` (PNG zum Ausdrucken), `tables/{id}/regenerate-qr`.

**Küche (`/api/kitchen/**`):** `orders` (offene Bestellungen), `orders/{id}/status`,
`orders/{id}/print` (Bon nachdrucken), `events` (SSE-Livestream).

Statuswechsel einer Bestellung: `NEW -> IN_PREPARATION -> READY -> SERVED`,
stornieren (`CANCELLED`) geht solange nichts serviert ist.

## Bondrucker einrichten

Standardmäßig wird der Bon nur ins Log geschrieben (`printer.mode: log`).
Für einen echten ESC/POS-Netzwerkdrucker (z.B. Epson TM-Serie) in `application.yml`:

```yaml
orderxpress:
  printer:
    mode: network
    host: "192.168.1.50"   # IP des Bondruckers
    port: 9100
```

Schlägt der Druck fehl (Drucker aus, Papier leer), bleibt die Bestellung erhalten -
der Fehler wird an der Bestellung vermerkt und die Küche kann den Bon nachdrucken.

## Vor dem echten Einsatz

1. Passwörter in `application.yml` ändern (BCrypt-Hashes werden unterstützt).
2. H2-Konsole abschalten (`spring.h2.console.enabled: false`).
3. `public-base-url` auf die echte, für Gäste erreichbare Adresse setzen und QR-Codes drucken.
4. HTTPS vorschalten (z.B. Reverse Proxy) - Basic Auth gehört nicht über unverschlüsseltes HTTP.
5. Später sinnvoll: PostgreSQL statt H2, Flyway-Migrationen statt `ddl-auto: update`.

## Wie geht es weiter (Frontend)

Das Backend ist so gebaut, dass jedes Frontend andocken kann (Web-App, React, ...):
Gäste-Seite unter `/t/{qrToken}` -> ruft `POST /api/guest/scan/{qrToken}` auf und pollt
den Sitzungs-Status; Inhaber- und Küchen-Ansicht verbinden sich zusätzlich mit den
SSE-Streams (`/api/admin/events`, `/api/kitchen/events`) für Live-Updates.
Hinweis: Der Browser-`EventSource` kann kein Basic-Auth-Header setzen - fürs Frontend
später Token-/Cookie-Login ergänzen oder einen fetch-basierten SSE-Client nutzen.
