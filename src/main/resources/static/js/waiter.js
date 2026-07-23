/* Kellner-Ansicht (nur lesen): belegte Tische live, Positionen je Person.
   Anmeldung ausschliesslich per QR-Code (Geraetetoken aus /d/<token>). */
const Waiter = {

    sse: null,
    pollTimer: null,
    open: {},   // tableNumber -> aufgeklappt? (Zustand ueber Neuladen der Liste halten)

    async init() {
        // Kellner haben kein Passwort-Login: nur mit Geraetetoken geht es weiter.
        if (!OX.deviceToken()) {
            document.getElementById("view-nologin").style.display = "";
            return;
        }
        try { await OX.api("/api/waiter/tables"); }
        catch (e) {
            // Token ungueltig/gesperrt -> zurueck auf die Scan-Aufforderung
            OX.clearAuth();
            document.getElementById("view-nologin").style.display = "";
            return;
        }
        this.start();
    },

    start() {
        document.getElementById("view-app").style.display = "";
        this.load();
        this.pollTimer = setInterval(() => this.load(), 15000); // Sicherheitsnetz
        this.sse = OX.connectSse("/api/waiter/events",
            () => this.load(),
            (online) => document.getElementById("live-dot").classList.toggle("on", online));
    },

    async load() {
        let tables;
        try { tables = await OX.api("/api/waiter/tables"); }
        catch (e) { return; }

        const box = document.getElementById("tables");
        if (!tables.length) {
            box.innerHTML = "<p class='muted'>Gerade sind keine Tische belegt.</p>";
            return;
        }
        box.innerHTML = "";
        for (const t of tables) {
            const card = document.createElement("div");
            card.className = "card";
            card.style.margin = "0 0 12px";

            const head = document.createElement("div");
            head.className = "row clickable";
            head.innerHTML = "<span class='big'>Tisch " + t.tableNumber + "</span>" +
                "<span class='badge blue'>" + this.personCount(t) + " Pers.</span>" +
                "<span class='spacer'></span>" +
                "<strong>" + OX.preis(t.grandTotal) + "</strong>" +
                (Number(t.openTotal) > 0 ? " <span class='badge amber'>offen " + OX.preis(t.openTotal) + "</span>" : "");
            head.onclick = () => { this.open[t.tableNumber] = !this.open[t.tableNumber]; this.load(); };
            card.appendChild(head);

            if (this.open[t.tableNumber]) {
                for (const p of t.participants) {
                    const block = document.createElement("div");
                    block.style.cssText = "margin-top:8px;padding-top:6px;border-top:1px dashed var(--line)";
                    block.innerHTML = "<strong>" + this.esc(p.name) + "</strong>" +
                        (p.isHost ? " <span class='badge blue'>Gastgeber</span>" : "");
                    for (const line of p.items) {
                        const row = document.createElement("div");
                        row.className = "row";
                        row.style.cssText = "padding:4px 0";
                        row.innerHTML =
                            "<span style='flex:1'>" + line.quantity + "x " + this.esc(line.name) +
                            (line.note ? " <span class='muted'>(" + this.esc(line.note) + ")</span>" : "") +
                            (line.paid ? " <span class='badge green'>bezahlt</span>" : "") + "</span>" +
                            "<span>" + OX.preis(line.lineTotal) + "</span>";
                        block.appendChild(row);
                    }
                    card.appendChild(block);
                }
            }
            box.appendChild(card);
        }
    },

    personCount(t) { return t.participants.length; },

    esc(s) {
        return String(s ?? "").replace(/[&<>"']/g,
            c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
};

Waiter.init();
