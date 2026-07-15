# ============================================================================
#  OrderXpress - API-Testscript
#  Testet den kompletten Ablauf: Sicherheit, Scan -> Freigabe -> Bestellung
#  -> Kueche -> Bon, Spam-Schutz, Verwaltung, QR-Code.
#
#  Voraussetzung: Die App laeuft in einem ZWEITEN Fenster (mvn spring-boot:run).
#  Aufruf:        cd C:\OrderXpress
#                 powershell -ExecutionPolicy Bypass -File .\test-api.ps1
# ============================================================================

# Jeder unerwartete Fehler bricht sofort mit Meldung ab (kein stilles Weiterlaufen)
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8080"

# Logins wie in src/main/resources/application.yml
function New-AuthHeader([string]$pair) {
    @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair)) }
}
$ownerAuth   = New-AuthHeader "inhaber:inhaber123"
$kitchenAuth = New-AuthHeader "kueche:kueche123"
$demoRestaurantId = 1   # Demo-Laden bei frischer DB (Multi-Store)

$script:passed = 0; $script:failed = 0; $script:skipped = 0

function Pass($msg)    { $script:passed++;  Write-Host "  [OK]      $msg" -ForegroundColor Green }
function Fail($msg)    { $script:failed++;  Write-Host "  [FEHLER]  $msg" -ForegroundColor Red }
function Skipped($msg) { $script:skipped++; Write-Host "  [SKIP]    $msg" -ForegroundColor Yellow }
function Section($t)   { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }

function Get-StatusCode($err) {
    try { return [int]$err.Exception.Response.StatusCode } catch { return -1 }
}

# Erwartet, dass der Aufruf mit einem bestimmten HTTP-Fehler abgelehnt wird
function Expect-HttpError([scriptblock]$call, [int]$expected, [string]$name) {
    try {
        & $call | Out-Null
        Fail "$name - Aufruf ging durch, erwartet war HTTP $expected"
    } catch {
        $code = Get-StatusCode $_
        if ($code -eq $expected) { Pass "$name (HTTP $code wie erwartet)" }
        else { Fail "$name (HTTP $code statt $expected)" }
    }
}

function Find-MenuItem($menu, [string]$name) {
    foreach ($cat in @($menu)) {
        foreach ($it in @($cat.items)) {
            if ($it.name -eq $name) { return $it }
        }
    }
    return $null
}

# Holt eine JSON-LISTE vom Server. Wichtig: Windows PowerShell 5.1 liefert
# JSON-Arrays aus Invoke-RestMethod als "Liste in der Liste" zurueck -
# dieser Helfer packt sie zuverlaessig aus (funktioniert auch in PowerShell 7).
# ACHTUNG: Ergebnis beim Zuweisen IMMER in @(...) einwickeln, sonst verliert
# PowerShell 5.1 bei GENAU EINEM Element die Listen-Eigenschaft (.Count fehlt)!
function Get-JsonList([string]$url, $headers) {
    $raw = if ($headers) { Invoke-RestMethod -Uri $url -Headers $headers }
           else          { Invoke-RestMethod -Uri $url }
    if ($null -eq $raw) { return ,@() }
    return @($raw | ForEach-Object { $_ })
}

try {

# ----------------------------------------------------------------------------
Section "0) Ist die App erreichbar - und ist es die AKTUELLE Version?"
# ----------------------------------------------------------------------------
try {
    $null = Invoke-RestMethod "$baseUrl/api/guest/menu/$demoRestaurantId"
    Pass "App antwortet unter $baseUrl"
} catch {
    Write-Host ""
    Write-Host "App nicht erreichbar! Bitte zuerst in einem zweiten Fenster starten:" -ForegroundColor Red
    Write-Host "    mvn spring-boot:run" -ForegroundColor Yellow
    exit 1
}

# Die aktuelle Version hat Swagger (/v3/api-docs ist oeffentlich).
# Antwortet das nicht, laeuft noch eine ALTE Instanz auf Port 8080!
try {
    $null = Invoke-RestMethod "$baseUrl/v3/api-docs"
    Pass "Aktuelle Version laeuft (Swagger vorhanden)"
} catch {
    Write-Host ""
    Write-Host "  Auf Port 8080 laeuft eine VERALTETE Instanz (kein Swagger)!" -ForegroundColor Red
    Write-Host "  So beendest du sie:" -ForegroundColor Yellow
    Write-Host "      netstat -ano | findstr :8080     (PID am Zeilenende ablesen)" -ForegroundColor Yellow
    Write-Host "      taskkill /PID <PID> /F" -ForegroundColor Yellow
    Write-Host "  Danach EINMAL neu starten: mvn spring-boot:run" -ForegroundColor Yellow
    exit 1
}

# ----------------------------------------------------------------------------
Section "1) Sicherheit: Wer darf was?"
# ----------------------------------------------------------------------------
Expect-HttpError { Invoke-RestMethod "$baseUrl/api/admin/tables" } 401 "Inhaber-Bereich OHNE Login gesperrt"
Expect-HttpError { Invoke-RestMethod "$baseUrl/api/kitchen/orders" } 401 "Kuechen-Bereich OHNE Login gesperrt"
Expect-HttpError { Invoke-RestMethod "$baseUrl/api/admin/tables" -Headers $kitchenAuth } 403 "Kuechen-Login darf NICHT in die Verwaltung"

try {
    $null = Invoke-RestMethod "$baseUrl/api/kitchen/orders" -Headers $ownerAuth
    Pass "Inhaber-Login darf in die Kuechen-Ansicht"
} catch { Fail "Inhaber-Login in Kuechen-Ansicht (HTTP $(Get-StatusCode $_))" }

# ----------------------------------------------------------------------------
Section "2) Stammdaten laden"
# ----------------------------------------------------------------------------
$tables = @(Get-JsonList "$baseUrl/api/admin/tables" $ownerAuth)
if ($tables.Count -eq 0) { Fail "Keine Tische gefunden - Datenbank leer?"; exit 1 }
if (-not $tables[0].qrToken) {
    Fail "Antwort von /api/admin/tables sieht nicht wie eine Tischliste aus:"
    $tables | ConvertTo-Json -Depth 5 | Write-Host
    exit 1
}
Pass "Tische vorhanden: $($tables.Count)"

$menu = @(Get-JsonList "$baseUrl/api/guest/menu/$demoRestaurantId")
if ($menu.Count -eq 0) { Fail "Speisekarte ist leer"; exit 1 }
$firstItem = @($menu[0].items)[0]
if ($firstItem) { Pass "Speisekarte geladen, erstes Gericht: '$($firstItem.name)' ($($firstItem.price) EUR)" }
else { Fail "Speisekarte ist leer"; exit 1 }

$freeTables = @($tables | Where-Object { -not $_.occupied })

# Zu wenige freie Tische? Maximal 3x versuchen, selbst welche anzulegen.
$attempts = 0
while ($freeTables.Count -lt 2 -and $attempts -lt 3) {
    $attempts++
    $newNumber = [int](($tables | Measure-Object -Property number -Maximum).Maximum) + 1
    $newBody = @{ number = $newNumber; name = "Test-Tisch" } | ConvertTo-Json
    $null = Invoke-RestMethod -Method Post "$baseUrl/api/admin/tables" -Headers $ownerAuth -ContentType "application/json" -Body $newBody
    Write-Host "  Tisch $newNumber automatisch angelegt (zu wenige freie Tische)" -ForegroundColor Yellow
    $tables = @(Get-JsonList "$baseUrl/api/admin/tables" $ownerAuth)
    $freeTables = @($tables | Where-Object { -not $_.occupied })
}
if ($freeTables.Count -lt 2) {
    Fail "Nicht genug freie Tische. Offene Sitzungen schliessen (POST /api/admin/sessions/{id}/close) und neu versuchen."
    exit 1
}

$tableA = $freeTables[0]                       # fuer den Bestell-Durchlauf
$tableB = $freeTables[$freeTables.Count - 1]   # fuer den Spam-Schutz-Test
Write-Host "  Testtische: Tisch $($tableA.number) (Bestellung), Tisch $($tableB.number) (Spam-Schutz)"

# ----------------------------------------------------------------------------
Section "3) Gast-Ablauf: Scan -> 'Tisch freigeben?' -> Bestellung -> Kueche"
# ----------------------------------------------------------------------------

# Falscher QR-Code wird abgelehnt
Expect-HttpError { Invoke-RestMethod -Method Post "$baseUrl/api/guest/scan/gibt-es-nicht" } 404 "Unbekannter QR-Code wird abgelehnt"

# Gast scannt den QR-Code
$scan = Invoke-RestMethod -Method Post "$baseUrl/api/guest/scan/$($tableA.qrToken)"
if ($scan.status -eq "PENDING") { Pass "Scan Tisch $($tableA.number): Freigabe-Anfrage erstellt (PENDING)" }
else { Fail "Scan lieferte Status '$($scan.status)' statt PENDING" }
$sessionToken = $scan.sessionToken

# Zweiter Scan (zweite Person am Tisch) erzeugt KEINE zweite Anfrage
$scan2 = Invoke-RestMethod -Method Post "$baseUrl/api/guest/scan/$($tableA.qrToken)"
if ($scan2.sessionToken -eq $sessionToken) { Pass "Doppelter Scan liefert dieselbe Sitzung" }
else { Fail "Doppelter Scan hat eine zweite Sitzung erzeugt" }

# Bestellen VOR der Freigabe ist verboten
$orderBody = @{ sessionToken = $sessionToken; items = @(@{ menuItemId = $firstItem.id; quantity = 2; note = "ohne Zwiebeln" }) } | ConvertTo-Json -Depth 5
Expect-HttpError { Invoke-RestMethod -Method Post "$baseUrl/api/guest/orders" -ContentType "application/json" -Body $orderBody } 409 "Bestellung VOR Freigabe wird abgelehnt"

# Inhaber sieht die Anfrage ("Tisch Nr. X freigeben?")
$pending = @(Get-JsonList "$baseUrl/api/admin/sessions/pending" $ownerAuth)
$mySession = $pending | Where-Object { $_.tableNumber -eq $tableA.number } | Select-Object -First 1
if ($mySession) { Pass "Inhaber sieht Anfrage: 'Tisch Nr. $($mySession.tableNumber) freigeben?'" }
else { Fail "Anfrage taucht nicht in der Freigabe-Liste auf"; exit 1 }

# Inhaber gibt frei
$approved = Invoke-RestMethod -Method Post "$baseUrl/api/admin/sessions/$($mySession.id)/approve" -Headers $ownerAuth
if ($approved.status -eq "APPROVED") { Pass "Tisch freigegeben (APPROVED)" } else { Fail "Freigabe fehlgeschlagen: $($approved.status)" }

# Gast sieht die Freigabe
$status = Invoke-RestMethod "$baseUrl/api/guest/sessions/$sessionToken"
if ($status.status -eq "APPROVED") { Pass "Gast sieht die Freigabe" } else { Fail "Gast sieht Status '$($status.status)'" }

# Gast bestellt 2x das erste Gericht
$order = Invoke-RestMethod -Method Post "$baseUrl/api/guest/orders" -ContentType "application/json" -Body $orderBody
if ($order.status -eq "NEW") { Pass "Bestellung angelegt (Nr. $($order.id), Status NEW)" } else { Fail "Bestellstatus: $($order.status)" }

# Stimmt die Summe? (Preis kommt vom Server, nie vom Gast)
$expectedTotal = [decimal]$firstItem.price * 2
if ([decimal]$order.totalAmount -eq $expectedTotal) { Pass "Summe korrekt berechnet: $($order.totalAmount) EUR" }
else { Fail "Summe $($order.totalAmount) statt $expectedTotal" }

Write-Host "  --> Jetzt im App-Fenster nachsehen: dort steht der gedruckte Kuechenbon im Log!" -ForegroundColor Yellow

# Gast sieht seine eigenen Bestellungen
$myOrders = @(Get-JsonList "$baseUrl/api/guest/sessions/$sessionToken/orders")
if ($myOrders.Count -ge 1) { Pass "Gast sieht seine Bestellungen ($($myOrders.Count))" } else { Fail "Gast sieht keine Bestellungen" }

# Kueche sieht die Bestellung
$kitchenOrders = @(Get-JsonList "$baseUrl/api/kitchen/orders" $kitchenAuth)
if ($kitchenOrders | Where-Object { $_.id -eq $order.id }) { Pass "Kueche sieht Bestellung Nr. $($order.id)" }
else { Fail "Bestellung nicht in der Kuechen-Ansicht" }

# Kueche schaltet den Status durch: NEW -> IN_PREPARATION -> READY -> SERVED
foreach ($s in @("IN_PREPARATION", "READY", "SERVED")) {
    $upd = Invoke-RestMethod -Method Post "$baseUrl/api/kitchen/orders/$($order.id)/status" -Headers $kitchenAuth -ContentType "application/json" -Body (@{ status = $s } | ConvertTo-Json)
    if ($upd.status -eq $s) { Pass "Status -> $s" } else { Fail "Status -> $s fehlgeschlagen" }
}

# Unsinniger Statuswechsel wird abgelehnt (serviert ist serviert)
Expect-HttpError { Invoke-RestMethod -Method Post "$baseUrl/api/kitchen/orders/$($order.id)/status" -Headers $kitchenAuth -ContentType "application/json" -Body (@{ status = "IN_PREPARATION" } | ConvertTo-Json) } 409 "Statuswechsel SERVED -> IN_PREPARATION wird abgelehnt"

# Bon nachdrucken
try {
    Invoke-RestMethod -Method Post "$baseUrl/api/kitchen/orders/$($order.id)/print" -Headers $kitchenAuth | Out-Null
    Pass "Bon-Nachdruck angestossen (siehe App-Log)"
} catch { Fail "Nachdruck fehlgeschlagen (HTTP $(Get-StatusCode $_))" }

# Inhaber beendet die Sitzung -> Tisch wieder frei
$closed = Invoke-RestMethod -Method Post "$baseUrl/api/admin/sessions/$($mySession.id)/close" -Headers $ownerAuth
if ($closed.status -eq "CLOSED") { Pass "Sitzung beendet, Tisch $($tableA.number) wieder frei" } else { Fail "Schliessen fehlgeschlagen" }

# Nach dem Schliessen kann mit dem alten Token nicht mehr bestellt werden
Expect-HttpError { Invoke-RestMethod -Method Post "$baseUrl/api/guest/orders" -ContentType "application/json" -Body $orderBody } 409 "Bestellung NACH Sitzungsende wird abgelehnt"

# ----------------------------------------------------------------------------
Section "4) Spam-Schutz: Nach Ablehnung ist 5 Minuten Pause"
# ----------------------------------------------------------------------------
try {
    $null = Invoke-RestMethod -Method Post "$baseUrl/api/guest/scan/$($tableB.qrToken)"
    $pendingB = Get-JsonList "$baseUrl/api/admin/sessions/pending" $ownerAuth |
                Where-Object { $_.tableNumber -eq $tableB.number } | Select-Object -First 1
    $null = Invoke-RestMethod -Method Post "$baseUrl/api/admin/sessions/$($pendingB.id)/reject" -Headers $ownerAuth
    Pass "Anfrage fuer Tisch $($tableB.number) abgelehnt"
    Expect-HttpError { Invoke-RestMethod -Method Post "$baseUrl/api/guest/scan/$($tableB.qrToken)" } 409 "Sofortiger neuer Scan wird geblockt (Abklingzeit)"
} catch {
    if ((Get-StatusCode $_) -eq 409) { Skipped "Abklingzeit von frueherem Testlauf noch aktiv (max. 5 Min warten)" }
    else { Fail "Spam-Schutz-Test (HTTP $(Get-StatusCode $_))" }
}

# ----------------------------------------------------------------------------
Section "5) Verwaltung: Kategorie + Gericht anlegen, verstecken, loeschen"
# ----------------------------------------------------------------------------
$catBody = @{ name = "Test-Kategorie"; sortOrder = 99 } | ConvertTo-Json
$cat = Invoke-RestMethod -Method Post "$baseUrl/api/admin/categories" -Headers $ownerAuth -ContentType "application/json" -Body $catBody
Pass "Kategorie 'Test-Kategorie' angelegt (Id $($cat.id))"

Expect-HttpError { Invoke-RestMethod -Method Post "$baseUrl/api/admin/categories" -Headers $ownerAuth -ContentType "application/json" -Body $catBody } 409 "Doppelte Kategorie wird abgelehnt"

$itemBody = @{ categoryId = $cat.id; name = "Test-Gericht"; description = "nur zum Testen"; price = 9.99; sortOrder = 1 } | ConvertTo-Json
$item = Invoke-RestMethod -Method Post "$baseUrl/api/admin/menu-items" -Headers $ownerAuth -ContentType "application/json" -Body $itemBody
Pass "Gericht 'Test-Gericht' angelegt (Id $($item.id))"

$menuNow = @(Get-JsonList "$baseUrl/api/guest/menu/$demoRestaurantId")
if (Find-MenuItem $menuNow "Test-Gericht") { Pass "Neues Gericht ist fuer Gaeste sichtbar" } else { Fail "Neues Gericht fehlt in der Gaeste-Karte" }

# Auf "ausverkauft" setzen -> verschwindet aus der Gaeste-Karte
$updBody = @{ categoryId = $cat.id; name = "Test-Gericht"; description = "nur zum Testen"; price = 9.99; sortOrder = 1; available = $false } | ConvertTo-Json
$null = Invoke-RestMethod -Method Put "$baseUrl/api/admin/menu-items/$($item.id)" -Headers $ownerAuth -ContentType "application/json" -Body $updBody
$menuNow = @(Get-JsonList "$baseUrl/api/guest/menu/$demoRestaurantId")
if (-not (Find-MenuItem $menuNow "Test-Gericht")) { Pass "'available=false' versteckt das Gericht vor Gaesten" }
else { Fail "Verstecktes Gericht ist noch sichtbar" }

# Aufraeumen (damit das Script mehrfach laufen kann)
$null = Invoke-RestMethod -Method Delete "$baseUrl/api/admin/menu-items/$($item.id)" -Headers $ownerAuth
$null = Invoke-RestMethod -Method Delete "$baseUrl/api/admin/categories/$($cat.id)" -Headers $ownerAuth
Pass "Testdaten wieder geloescht"

# ----------------------------------------------------------------------------
Section "6) QR-Code als PNG herunterladen"
# ----------------------------------------------------------------------------
$qrFile = Join-Path (Get-Location) "tisch-$($tableA.number)-qr.png"
Invoke-WebRequest "$baseUrl/api/admin/tables/$($tableA.id)/qrcode?size=384" -Headers $ownerAuth -OutFile $qrFile -UseBasicParsing
if ((Test-Path $qrFile) -and ((Get-Item $qrFile).Length -gt 100)) {
    Pass "QR-Code gespeichert: $qrFile (mit dem Handy scannen = Gast-Link!)"
} else { Fail "QR-PNG konnte nicht gespeichert werden" }

} catch {
    Write-Host ""
    Write-Host "ABBRUCH - unerwarteter Fehler:" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        Write-Host "  Server-Antwort: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
    exit 1
}

# ----------------------------------------------------------------------------
Section "Ergebnis"
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host ("Bestanden: {0}   Fehlgeschlagen: {1}   Uebersprungen: {2}" -f $script:passed, $script:failed, $script:skipped) `
    -ForegroundColor $(if ($script:failed -eq 0) { "Green" } else { "Red" })
Write-Host ""
Write-Host "Nicht per Script testbar: Live-Meldungen (SSE) - kommt mit dem Frontend." -ForegroundColor Yellow
if ($script:failed -gt 0) { exit 1 }
