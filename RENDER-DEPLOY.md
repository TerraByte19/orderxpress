# OrderXpress auf Render deployen

Ein Blueprint (`render.yaml`) legt alles in einem Rutsch an:

- **Web-Dienst** `orderxpress` – Docker, Plan *Starter* (immer wach, kein Kaltstart)
- **PostgreSQL** `orderxpress-db` – Plan *Basic 256 MB* (Daten bleiben dauerhaft, tägliche Backups)
- beides in Region **Frankfurt**

Die App läuft dort mit dem Profil `prod` (`application-prod.yml`):
PostgreSQL statt H2, H2-Konsole und Swagger gesperrt, **kein Demo-Laden**
(keine bekannten Passwörter wie `inhaber/inhaber123` im Netz).

---

## Schritte

1. Code liegt auf GitHub: `github.com/TerraByte19/orderxpress`, Branch `main`.
2. **render.com** → **New** → **Blueprint** → GitHub verbinden (falls noch nicht) →
   Repo **orderxpress** wählen.
3. Render zeigt die zwei Ressourcen und fragt nach
   **`ORDERXPRESS_SECURITY_PLATFORMADMIN_PASSWORD`** → ein starkes, neues Passwort
   eintragen (Passwort-Manager). Ohne Wert startet die App absichtlich nicht.
4. **Apply**. Erst wird die Datenbank angelegt, dann das Docker-Image gebaut
   (erster Build ca. 5–10 Min., Maven + Node laden Abhängigkeiten).
5. Fertig, wenn der Dienst **Live** zeigt: `https://orderxpress-xxxx.onrender.com`.

## Erste Schritte nach dem Start

1. `https://…onrender.com/platform.html` → Login `admin` + Passwort aus Schritt 3.
2. Ersten echten Laden anlegen (Name, Kürzel, Inhaber-Login + Passwort).
3. Mit dem Inhaber-Login `/admin.html` → Speisekarte, Tische, Personal, Design.
4. QR-Codes der Tische drucken – sie enthalten automatisch die Render-Adresse.

## Kosten (Render, Stand bei Einrichtung)

Web *Starter* ca. 7 $/Monat + PostgreSQL *Basic 256 MB* ca. 6 $/Monat.
Pläne lassen sich im Dashboard jederzeit hoch- oder runterstufen.

---

## Was abgesichert ist

- Alle Integrationstests laufen zusätzlich gegen echtes PostgreSQL
  (`PostgresCompatibilityTest`), inkl. Prüfung des Produktivprofils.
- H2-Konsole/Swagger gesperrt, kein Demo-Laden, Plattform-Admin-Passwort Pflicht.
- HTTPS stellt Render automatisch bereit; die App wertet die Proxy-Header aus.
- Neue Commits auf `main` werden automatisch deployt (`autoDeploy: true`).

## Bewusst noch offen

- Schema-Änderungen laufen über `ddl-auto: update` (neue Spalten nullable halten);
  Umstieg auf Flyway steht weiter auf der Liste.
- Eigene Domain (Render → Settings → Custom Domains).
- Rechtliches: Kassensicherung/TSE, DSGVO/Impressum, Allergene.

## Wenn etwas schiefgeht

- **Start bricht ab mit „Could not resolve placeholder ORDERXPRESS_SECURITY_PLATFORMADMIN_PASSWORD“:**
  Variable im Dienst unter *Environment* setzen.
- **Datenbank-Verbindung schlägt fehl:** prüfen, dass Dienst und DB in derselben
  Region (Frankfurt) liegen; die `DB_*`-Variablen kommen automatisch aus der DB.
- **Änderungen erscheinen nicht:** Commit auf `main` pushen bzw. im Dienst
  *Manual Deploy* → *Deploy latest commit*.
- **Lokal weiter wie gewohnt:** ohne Profil läuft H2 mit Demo-Laden.
