/* Kuechen-Monitor: offene Bestellungen live, Status weiterschalten, Bon nachdrucken */
const Kitchen = {

    sse: null,
    pollTimer: null,

    /* ---------- Login ---------- */

    async init() {
        if (OX.hasAuth()) {
            try { await OX.api("/api/kitchen/orders"); this.start(); return; }
            catch (e) { OX.clearAuth(); }
        }
        document.getElementById("view-login").style.display = "";
    },

    async login() {
        OX.setAuth(
            document.getElementById("login-user").value.trim(),
            document.getElementById("login-pass").value);
        try {
            await OX.api("/api/kitchen/orders");
            this.start();
        } catch (e) {
            OX.clearAuth();
            OX.toast(e.status === 401 ? "Falsche Zugangsdaten" : e.message, true);
        }
    },

    logout() {
        OX.clearAuth();
        if (this.sse) this.sse.stop();
        clearInterval(this.pollTimer);
        location.reload();
    },

    /* ---------- Start ---------- */

    start() {
        document.getElementById("view-login").style.display = "none";
        document.getElementById("view-app").style.display = "";
        document.getElementById("btn-logout").style.display = "";

        this.load();
        this.pollTimer = setInterval(() => this.load(), 10000); // Sicherheitsnetz

        this.sse = OX.connectSse("/api/kitchen/events",
            (event, data) => {
                if (event === "order-created" && data) OX.toast("Neue Bestellung - Tisch " + data.tableNumber);
                this.load();
            },
            (online) => document.getElementById("live-dot").classList.toggle("on", online));
    },

    /* ---------- Board ---------- */

    async load() {
        const orders = await OX.api("/api/kitchen/orders");
        for (const col of ["NEW", "IN_PREPARATION", "READY"]) {
            const box = document.getElementById("col-" + col);
            box.innerHTML = "";
            const list = orders.filter(o => o.status === col);
            if (!list.length) box.innerHTML = "<p class='muted'>leer</p>";
            for (const o of list) box.appendChild(this.orderCard(o));
        }
    },

    orderCard(o) {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML =
            "<div class='row'><span class='big'>Tisch " + o.tableNumber + "</span>" +
            "<span class='muted'>#" + o.id + " · " + OX.zeit(o.createdAt) + "</span>" +
            (o.printed ? "" : "<span class='badge amber'>Bon nicht gedruckt</span>") +
            "</div>" +
            "<ul class='plain'>" +
            o.items.map(i =>
                "<li><strong>" + i.quantity + "x</strong> " + this.esc(i.name) +
                (i.note ? "<br><span class='badge red'>&#9998; " + this.esc(i.note) + "</span>" : "") +
                "</li>").join("") +
            "</ul>";

        const row = document.createElement("div");
        row.className = "row";

        if (o.status === "NEW") {
            row.appendChild(this.btn("Zubereiten", "green", () => this.setStatus(o.id, "IN_PREPARATION")));
            row.appendChild(this.btn("Storno", "red", () => this.cancel(o)));
        } else if (o.status === "IN_PREPARATION") {
            row.appendChild(this.btn("Fertig", "green", () => this.setStatus(o.id, "READY")));
            row.appendChild(this.btn("Storno", "red", () => this.cancel(o)));
        } else if (o.status === "READY") {
            row.appendChild(this.btn("Serviert", "green", () => this.setStatus(o.id, "SERVED")));
        }
        row.appendChild(this.btn("Bon drucken", "ghost", () => this.reprint(o.id)));

        card.appendChild(row);
        return card;
    },

    btn(text, cls, onclick) {
        const b = document.createElement("button");
        b.className = "small " + cls;
        b.textContent = text;
        b.onclick = onclick;
        return b;
    },

    async setStatus(id, status) {
        try {
            await OX.api("/api/kitchen/orders/" + id + "/status", {
                method: "POST",
                body: JSON.stringify({ status: status })
            });
        } catch (e) { OX.toast(e.message, true); }
        this.load();
    },

    cancel(o) {
        if (confirm("Bestellung #" + o.id + " (Tisch " + o.tableNumber + ") wirklich stornieren?")) {
            this.setStatus(o.id, "CANCELLED");
        }
    },

    async reprint(id) {
        try {
            await OX.api("/api/kitchen/orders/" + id + "/print", { method: "POST" });
            OX.toast("Bon wird gedruckt");
        } catch (e) { OX.toast(e.message, true); }
    },

    esc(s) {
        return String(s ?? "").replace(/[&<>"']/g,
            c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
};

Kitchen.init();
