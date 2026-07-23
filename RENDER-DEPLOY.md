# OrderXpress auf Render deployen (zum Testen)

Ziel: die App bekommt eine echte `https://...onrender.com`-Adresse, die du (und
andere) vom Handy aufrufen kannst. QR-Codes funktionieren dann von überall, nicht
nur im heimischen WLAN.

Es gibt zwei Ausbaustufen:

- **Stufe 1 – schnell (H2):** in ein paar Minuten live. Daten gehen aber bei
  jedem Neustart/Deploy verloren. Perfekt zum kurzen Ausprobieren.
- **Stufe 2 – bleibende Daten (PostgreSQL):** ein paar Klicks mehr, dafür
  überleben Läden/Bestellungen einen Neustart.

Alles Nötige liegt schon im Projekt: `Dockerfile`, `.dockerignore`, `render.yaml`.

---

## 0. Code muss auf GitHub liegen

Render deployt aus einem Git-Repo. Falls noch nicht geschehen, in PowerShell:

```powershell
cd C:\OrderXpress
git init
git add .
git commit -m "OrderXpress bereit für Render"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/orderxpress.git
git push -u origin main
```

(Beim `push` öffnet sich das GitHub-Login. Repo vorher leer anlegen, ohne README.)

---

## Stufe 1 – Schnellstart mit H2

1. Auf **render.com** anmelden → **New +** → **Blueprint**.
2. Dein `orderxpress`-Repo auswählen. Render liest die `render.yaml`.
3. Render fragt nach dem Wert für **`ORDERXPRESS_SECURITY_PLATFORMADMIN_PASSWORD`**
   → dein neues Plattform-Admin-Passwort eintragen (nicht `admin123`!).
4. **Apply** → Render baut das Docker-Image und startet. Der erste Build dauert
   ein paar Minuten (Maven lädt Abhängigkeiten).
5. Fertig: `https://orderxpress-xxxx.onrender.com` öffnen.

**Anmelden:**

- Plattform-Admin: `admin` + das eben gesetzte Passwort → `/platform.html`
- Demo-Laden: `inhaber` / `inhaber123` → `/admin.html`
  (Die Demo-Logins werden beim ersten Start automatisch angelegt.)

**QR-Codes:** funktionieren sofort mit der Render-Adresse – du musst nichts
eintragen. (Die App merkt, dass sie nicht auf localhost läuft, und nimmt die
echte Domain.)

> **Zwei Render-Free-Eigenheiten:**
> 1. Nach ~15 Min ohne Zugriff „schläft" der Dienst ein; der nächste Aufruf
>    dauert dann ~30 Sek (Kaltstart).
> 2. Beim Einschlafen/Deploy ist die H2-Datenbank **weg** – Demo-Laden wird neu
>    angelegt, deine Test-Bestellungen sind aber verschwunden. Für bleibende
>    Daten → Stufe 2.

---

## Stufe 2 – Bleibende Daten mit PostgreSQL

1. Render → **New +** → **PostgreSQL** → Name `orderxpress-db`, Plan **Free** →
   erstellen. (Free-Datenbanken laufen 30 Tage – zum Testen reicht das.)
2. Auf der DB-Seite die **Connection**-Infos ansehen. Du brauchst: `Hostname`,
   `Port` (meist 5432), `Database`, `Username`, `Password`.
3. Zu deinem **Webdienst** → **Environment** → diese vier Variablen anlegen:

   | Key | Value |
   |-----|-------|
   | `SPRING_DATASOURCE_URL` | `jdbc:postgresql://HOSTNAME:5432/DATABASE` |
   | `SPRING_DATASOURCE_USERNAME` | dein DB-Username |
   | `SPRING_DATASOURCE_PASSWORD` | dein DB-Passwort |
   | `SPRING_DATASOURCE_DRIVER_CLASS_NAME` | `org.postgresql.Driver` |

   `HOSTNAME` und `DATABASE` aus Schritt 2 einsetzen. Wichtig: vorne
   **`jdbc:`** davor – Render zeigt die URL sonst als `postgresql://...`.

   > Tipp: Nutze die **Internal Database URL** (Web-Dienst und DB liegen im
   > selben Render-Netz) – die ist schneller und braucht kein `?sslmode`.

4. **Save** → Render startet neu. `ddl-auto: update` legt die Tabellen in
   PostgreSQL automatisch an, DataInitializer füllt den Demo-Laden.

Ab jetzt überleben Läden, Speisekarte, Geräte und Bestellungen jeden Neustart.

---

## Was das Setup schon absichert

- **H2-Konsole und Swagger sind auf Render gesperrt** (`ORDERXPRESS_DEV_TOOLS=false`).
  Lokal bleiben sie offen wie gewohnt.
- **Plattform-Admin-Passwort** kommt aus einer Umgebungsvariable, steht nicht im Code.
- **HTTPS** stellt Render automatisch bereit; die App wertet die Proxy-Header aus.

## Was noch fehlt (bewusst offen)

Das ist ein **Test-Deployment**, kein echter Produktionsbetrieb. Vor echtem
Einsatz weiterhin offen: eigene Domain, PostgreSQL + Flyway-Migrationen statt
`ddl-auto: update`, Demo-Logins entfernen, Backups, und die rechtlichen Punkte
(Kassensicherung/TSE, DSGVO, Impressum, Allergene) aus unserer Liste.

---

## Wenn der Build fehlschlägt

- **„no main manifest attribute" / falsches JAR:** Der Docker-Build baut das
  ausführbare Spring-Boot-JAR – nichts zu tun, das ist schon eingerichtet.
- **Out of memory beim Start:** Render Free hat 512 MB. Das Image begrenzt den
  Heap bereits (`MaxRAMPercentage=75`). Wenn es trotzdem eng wird, hilft ein
  bezahlter 512-MB+-Plan.
- **Änderungen erscheinen nicht:** neuen Commit pushen – Render deployt bei
  `autoDeploy: true` automatisch neu.
