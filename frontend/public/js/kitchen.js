/* Kuechen-Monitor: offene Bestellungen live, Status weiterschalten, Bon nachdrucken */
const Kitchen = {

    sse: null,
    pollTimer: null,

    /* ---------- Login ---------- */

    init() {
        // Bei vorhandener Anmeldung sofort die App zeigen (kein Login-Flash),
        // Pruefung laeuft im Hintergrund.
        OX.ensureAuth(() => this.start(),
            () => { document.getElementById("view-login").style.display = ""; });
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
        OX.buildNav("kitchen");
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
            if (!list.length) { box.innerHTML = "<p class='muted'>leer</p>"; continue; }
            // Pro Tisch buendeln: alle Bestellungen desselben Tisches in EINE Karte.
            for (const group of this.groupByTable(list)) {
                box.appendChild(this.tableCard(group, col));
            }
        }
    },

    /* Bestellungen (gleiche Spalte/Status) nach Tisch gruppieren, aeltester Tisch zuerst */
    groupByTable(orders) {
        const map = new Map();
        for (const o of orders) {
            if (!map.has(o.tableNumber)) map.set(o.tableNumber, []);
            map.get(o.tableNumber).push(o);
        }
        return [...map.entries()]
            .map(([tableNumber, list]) => ({ tableNumber, orders: list }))
            .sort((a, b) => (this.earliest(a.orders) < this.earliest(b.orders) ? -1 : 1));
    },

    earliest(orders) {
        return orders.reduce((min, o) => (o.createdAt < min ? o.createdAt : min), orders[0].createdAt);
    },

    /* Gleiche Positionen (Name + Hinweis) zusammenfassen -> eine Liste je Tisch */
    mergedItems(orders) {
        const map = new Map();
        for (const o of orders) {
            for (const i of o.items) {
                const key = i.name + "|" + (i.note || "");
                if (!map.has(key)) map.set(key, { name: i.name, note: i.note || "", quantity: 0 });
                map.get(key).quantity += i.quantity;
            }
        }
        return [...map.values()];
    },

    tableCard(group, status) {
        const ids = group.orders.map(o => o.id);
        const count = group.orders.length;
        const anyUnprinted = group.orders.some(o => !o.printed);

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML =
            "<div class='row'><span class='big'>Tisch " + group.tableNumber + "</span>" +
            "<span class='muted'>" + count + (count === 1 ? " Bestellung" : " Bestellungen") +
            " · " + OX.zeit(this.earliest(group.orders)) + "</span>" +
            (anyUnprinted ? "<span class='badge amber'>Bon nicht gedruckt</span>" : "") +
            "</div>" +
            "<ul class='plain'>" +
            this.mergedItems(group.orders).map(i =>
                "<li><strong>" + i.quantity + "x</strong> " + this.esc(i.name) +
                (i.note ? "<br><span class='badge red'>&#9998; " + this.esc(i.note) + "</span>" : "") +
                "</li>").join("") +
            "</ul>";

        const row = document.createElement("div");
        row.className = "row";
        if (status === "NEW") {
            row.appendChild(this.btn("Zubereiten", "green", () => this.setStatusAll(ids, "IN_PREPARATION")));
            row.appendChild(this.btn("Storno", "red", () => this.cancelAll(group)));
        } else if (status === "IN_PREPARATION") {
            row.appendChild(this.btn("Fertig", "green", () => this.setStatusAll(ids, "READY")));
            row.appendChild(this.btn("Storno", "red", () => this.cancelAll(group)));
        } else if (status === "READY") {
            row.appendChild(this.btn("Serviert", "green", () => this.setStatusAll(ids, "SERVED")));
        }
        row.appendChild(this.btn("Bon drucken", "ghost", () => this.reprintAll(ids)));

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

    /* Status fuer ALLE gebuendelten Bestellungen des Tisches setzen */
    async setStatusAll(ids, status) {
        try {
            for (const id of ids) {
                await OX.api("/api/kitchen/orders/" + id + "/status", {
                    method: "POST",
                    body: JSON.stringify({ status: status })
                });
            }
        } catch (e) { OX.toast(e.message, true); }
        this.load();
    },

    cancelAll(group) {
        const ids = group.orders.map(o => o.id);
        const frage = ids.length === 1
            ? "Bestellung an Tisch " + group.tableNumber + " stornieren?"
            : "Alle " + ids.length + " Bestellungen an Tisch " + group.tableNumber + " stornieren?";
        if (confirm(frage)) this.setStatusAll(ids, "CANCELLED");
    },

    async reprintAll(ids) {
        try {
            for (const id of ids) {
                await OX.api("/api/kitchen/orders/" + id + "/print", { method: "POST" });
            }
            OX.toast(ids.length > 1 ? "Bons werden gedruckt" : "Bon wird gedruckt");
        } catch (e) { OX.toast(e.message, true); }
    },

    esc(s) {
        return String(s ?? "").replace(/[&<>"']/g,
            c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
};

Kitchen.init();
