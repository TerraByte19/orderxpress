/* Service-/Kassen-Ansicht: Tische freigeben ("Tisch Nr. X freigeben?"),
   Sitzungen beenden, laufende Bestellungen sehen. Fuer Kellner/Kasse. */
const Service = {

    sse: null,
    pollTimer: null,
    kasseTableId: null,
    kasseTableNumber: null,
    kasseSelected: {},   // orderItemId -> lineTotal

    async init() {
        if (OX.hasAuth()) {
            try { await OX.api("/api/service/sessions/pending"); this.start(); return; }
            catch (e) { OX.clearAuth(); }
        }
        document.getElementById("view-login").style.display = "";
    },

    async login() {
        OX.setAuth(
            document.getElementById("login-user").value.trim(),
            document.getElementById("login-pass").value);
        try {
            await OX.api("/api/service/sessions/pending");
            this.start();
        } catch (e) {
            OX.clearAuth();
            OX.toast(e.status === 401 || e.status === 403 ? "Falsche Zugangsdaten" : e.message, true);
        }
    },

    logout() {
        OX.clearAuth();
        if (this.sse) this.sse.stop();
        clearInterval(this.pollTimer);
        location.reload();
    },

    start() {
        OX.buildNav("service");
        document.getElementById("view-login").style.display = "none";
        document.getElementById("view-app").style.display = "";
        document.getElementById("btn-logout").style.display = "";

        this.refresh();
        this.pollTimer = setInterval(() => this.refresh(), 15000); // Sicherheitsnetz

        this.sse = OX.connectSse("/api/service/events",
            (event, data) => this.onEvent(event, data),
            (online) => document.getElementById("live-dot").classList.toggle("on", online));
    },

    onEvent(event, data) {
        if (event === "session-requested" && data && data.message) {
            OX.toast(data.message); // "Tisch Nr. X freigeben?"
        }
        this.refresh();
    },

    refresh() {
        this.loadPending();
        this.loadTables();
        this.loadOrders();
    },

    /* ---------- Freigabe-Anfragen ---------- */

    async loadPending() {
        const list = await OX.api("/api/service/sessions/pending");
        const box = document.getElementById("pending-list");
        if (!list.length) { box.innerHTML = "<p class='muted'>Keine offenen Anfragen.</p>"; return; }
        box.innerHTML = "";
        for (const s of list) {
            const card = document.createElement("div");
            card.className = "card";
            card.style.cssText = "margin:0 0 10px;border-color:var(--amber)";
            card.innerHTML = "<div class='big'>Tisch Nr. " + s.tableNumber + " freigeben?</div>" +
                "<p class='muted'>Angefragt " + OX.zeit(s.createdAt) + "</p>";
            const row = document.createElement("div");
            row.className = "row";
            const approve = this.btn("✓ Freigeben", "green", () => this.decide(s.id, "approve"));
            const reject = this.btn("✗ Ablehnen", "red", () => this.decide(s.id, "reject"));
            approve.style.flex = "1"; reject.style.flex = "1";
            approve.style.padding = "14px"; reject.style.padding = "14px";
            row.append(approve, reject);
            card.appendChild(row);
            box.appendChild(card);
        }
    },

    async decide(id, action) {
        try {
            await OX.api("/api/service/sessions/" + id + "/" + action, { method: "POST" });
            OX.toast(action === "approve" ? "Tisch freigegeben" : "Anfrage abgelehnt");
        } catch (e) { OX.toast(e.message, true); }
        this.refresh();
    },

    /* ---------- Tische ---------- */

    async loadTables() {
        const tables = await OX.api("/api/service/tables");
        const grid = document.getElementById("tables-grid");
        grid.innerHTML = "";
        for (const t of tables) {
            const card = document.createElement("div");
            card.className = "card";
            card.style.margin = "0";
            card.innerHTML =
                "<div class='row'><span class='big'>Tisch " + t.number + "</span>" +
                "<span class='badge " + (t.occupied ? "red" : "green") + "'>" +
                (t.occupied ? "belegt" : "frei") + "</span>" +
                (t.active ? "" : "<span class='badge'>inaktiv</span>") + "</div>" +
                (t.name ? "<p class='muted'>" + this.esc(t.name) + "</p>" : "");
            if (t.occupied && t.currentSessionId) {
                const row = document.createElement("div");
                row.className = "row";
                row.style.marginTop = "8px";
                row.appendChild(this.btn("Kasse", "green", () => this.openKasse(t.id, t.number)));
                row.appendChild(this.btn("Sitzung beenden", "red", async () => {
                    if (!confirm("Sitzung an Tisch " + t.number + " beenden?")) return;
                    try { await OX.api("/api/service/sessions/" + t.currentSessionId + "/close", { method: "POST" }); }
                    catch (e) { OX.toast(e.message, true); }
                    this.closeKasse();
                    this.refresh();
                }));
                card.appendChild(row);
            }
            grid.appendChild(card);
        }
    },

    /* ---------- Bestellungen (nur ansehen) ---------- */

    async loadOrders() {
        const orders = await OX.api("/api/service/orders");
        const box = document.getElementById("orders-list");
        if (!orders.length) { box.innerHTML = "<p class='muted'>Noch keine Bestellungen.</p>"; return; }
        box.innerHTML = "";
        for (const o of orders.slice(0, 25)) {
            const div = document.createElement("div");
            div.className = "row";
            div.style.cssText = "padding:8px 0;border-bottom:1px dashed var(--line)";
            div.innerHTML =
                "<strong>Tisch " + o.tableNumber + "</strong>" +
                "<span class='badge " + this.statusColor(o.status) + "'>" + this.statusText(o.status) + "</span>" +
                "<span class='spacer'></span>" +
                "<span class='muted'>" + o.items.map(i => i.quantity + "x " + this.esc(i.name)).join(", ") + "</span>" +
                "<strong>" + OX.preis(o.totalAmount) + "</strong>" +
                "<span class='muted'>" + OX.zeit(o.createdAt) + "</span>";
            box.appendChild(div);
        }
    },

    /* ---------- Kasse (Rechnung eines Tisches, Positionen kassieren) ---------- */

    async openKasse(tableId, tableNumber) {
        this.kasseTableId = tableId;
        this.kasseTableNumber = tableNumber;
        this.kasseSelected = {};
        await this.loadKasse();
        document.getElementById("kasse-card").style.display = "";
        document.getElementById("kasse-card").scrollIntoView({ behavior: "smooth", block: "start" });
    },

    async loadKasse() {
        let bill;
        try { bill = await OX.api("/api/service/tables/" + this.kasseTableId + "/bill"); }
        catch (e) { OX.toast(e.message, true); return; }

        document.getElementById("kasse-title").textContent = "Kasse - Tisch " + this.kasseTableNumber;
        document.getElementById("kasse-open").textContent = "offen gesamt: " + OX.preis(bill.openTotal);

        const body = document.getElementById("kasse-body");
        body.innerHTML = "";
        if (!bill.participants.length) {
            body.innerHTML = "<p class='muted'>Keine offenen Positionen an diesem Tisch.</p>";
        }
        for (const p of bill.participants) {
            const block = document.createElement("div");
            block.style.cssText = "border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:10px";
            block.innerHTML = "<div class='row'><strong>" + this.esc(p.name) + "</strong>" +
                (p.isHost ? "<span class='badge blue'>Gastgeber</span>" : "") +
                "<span class='spacer'></span><span class='muted'>offen: " + OX.preis(p.openTotal) + "</span></div>";
            for (const line of p.items) {
                const row = document.createElement("label");
                row.className = "row";
                row.style.cssText = "padding:8px 0;border-bottom:1px dashed var(--line);cursor:pointer";
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.style.width = "auto";
                cb.disabled = line.paid;
                cb.dataset.id = line.orderItemId;
                cb.dataset.total = line.lineTotal;
                cb.onchange = () => this.toggleKasse(line.orderItemId, line.lineTotal, cb.checked);
                const text = document.createElement("span");
                text.style.flex = "1";
                text.innerHTML = line.quantity + "x " + this.esc(line.name) +
                    (line.paid ? " <span class='badge green'>bezahlt</span>" : "");
                const price = document.createElement("span");
                price.textContent = OX.preis(line.lineTotal);
                row.append(cb, text, price);
                block.appendChild(row);
            }
            body.appendChild(block);
        }
        this.updateKasseSum();
    },

    toggleKasse(id, lineTotal, checked) {
        if (checked) this.kasseSelected[id] = lineTotal;
        else delete this.kasseSelected[id];
        this.updateKasseSum();
    },

    kasseSelectAll() {
        this.kasseSelected = {};
        document.querySelectorAll("#kasse-body input[type=checkbox]").forEach(cb => {
            if (!cb.disabled) {
                cb.checked = true;
                this.kasseSelected[cb.dataset.id] = Number(cb.dataset.total);
            }
        });
        this.updateKasseSum();
    },

    updateKasseSum() {
        const sum = Object.values(this.kasseSelected).reduce((s, v) => s + Number(v), 0);
        document.getElementById("kasse-selected").textContent = "Ausgewählt: " + OX.preis(sum);
    },

    async kassePay() {
        const ids = Object.keys(this.kasseSelected).map(Number);
        if (!ids.length) { OX.toast("Bitte zuerst Positionen auswählen", true); return; }
        const sum = Object.values(this.kasseSelected).reduce((s, v) => s + Number(v), 0);
        if (!confirm("Ausgewählte Positionen (" + OX.preis(sum) + ") als bezahlt markieren?")) return;
        try {
            await OX.api("/api/service/settle", { method: "POST", body: JSON.stringify({ orderItemIds: ids }) });
            OX.toast("Als bezahlt markiert");
        } catch (e) { OX.toast(e.message, true); }
        this.kasseSelected = {};
        await this.loadKasse();
    },

    closeKasse() {
        this.kasseTableId = null;
        this.kasseSelected = {};
        document.getElementById("kasse-card").style.display = "none";
    },

    /* ---------- Helfer ---------- */

    btn(text, cls, onclick) {
        const b = document.createElement("button");
        b.className = "small " + cls;
        b.textContent = text;
        b.onclick = onclick;
        return b;
    },

    statusText(s) {
        return { NEW: "Neu", IN_PREPARATION: "In Zubereitung", READY: "Fertig",
                 SERVED: "Serviert", CANCELLED: "Storniert" }[s] || s;
    },
    statusColor(s) {
        return { NEW: "blue", IN_PREPARATION: "amber", READY: "green",
                 SERVED: "", CANCELLED: "red" }[s] || "";
    },

    esc(s) {
        return String(s ?? "").replace(/[&<>"']/g,
            c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
};

Service.init();
