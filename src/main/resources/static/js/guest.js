/* Gaeste-Seite:
   Scan -> (Gastgeber: warten auf Laden | Beitretender: warten auf Gastgeber)
   -> Menue -> Warenkorb -> Bestellen. Zusaetzlich: Gastgeber gibt weitere
   Personen frei, geteilte Rechnung mit Auswahl-Summe. */
const Guest = {

    qrToken: null,
    guestToken: null,
    isHost: false,
    myName: "",
    tableNumber: null,
    restaurantId: null,
    restaurantName: "",
    hamburger: false,
    approved: false,
    menuLoaded: false,
    menu: [],
    cart: {},          // menuItemId -> { item, quantity, note }
    pollTimer: null,
    billSelected: {},  // orderItemId -> lineTotal (nur unbezahlte)
    detailItem: null,
    detailQty: 1,

    /* ---------- Start ---------- */

    init() {
        document.getElementById("overlay").onclick = () => this.closeDetail();

        const path = location.pathname;
        if (path.startsWith("/t/")) {
            this.qrToken = decodeURIComponent(path.split("/")[2] || "");
        } else {
            this.qrToken = new URLSearchParams(location.search).get("token") || "";
        }
        if (!this.qrToken) {
            this.showError("Kein Tisch-Code gefunden", "Bitte den QR-Code am Tisch scannen.");
            return;
        }

        // Bei Neuladen dieselbe Person behalten (Token pro QR-Code gespeichert).
        const saved = this.loadSavedToken();
        if (saved) {
            this.guestToken = saved;
            this.resume();
        } else {
            this.scan();
        }
    },

    storageKey() { return "ox-guest-" + this.qrToken; },
    loadSavedToken() { try { return localStorage.getItem(this.storageKey()); } catch (e) { return null; } },
    saveToken(t) { try { localStorage.setItem(this.storageKey(), t); } catch (e) { /* ignore */ } },
    clearToken() { try { localStorage.removeItem(this.storageKey()); } catch (e) { /* ignore */ } },

    async scan() {
        this.show("view-wait");
        try {
            const res = await OX.api("/api/guest/scan/" + encodeURIComponent(this.qrToken), { method: "POST" });
            this.applyScan(res);
            this.saveToken(this.guestToken);
            this.afterStatus(res);
        } catch (e) {
            if (e.status === 404) this.showError("QR-Code ungültig", "Bitte das Personal ansprechen.");
            else this.showError("Das hat nicht geklappt", e.message);
        }
    },

    /* Nach Neuladen: gespeicherte Person fortsetzen */
    async resume() {
        this.show("view-wait");
        try {
            const res = await OX.api("/api/guest/guests/" + this.guestToken);
            this.applyStatus(res);
            this.afterStatus(res);
        } catch (e) {
            // Token ungueltig/abgelaufen -> neu scannen
            this.clearToken();
            this.guestToken = null;
            this.scan();
        }
    },

    applyScan(res) {
        this.guestToken = res.guestToken;
        this.isHost = res.isHost;
        this.myName = res.guestName;
        this.tableNumber = res.tableNumber;
        this.restaurantId = res.restaurantId;
        this.restaurantName = res.restaurantName || "";
    },

    applyStatus(res) {
        // gemeinsame Felder aus scan- bzw. status-Antwort
        this.isHost = res.isHost;
        this.myName = res.name != null ? res.name : this.myName;
        this.tableNumber = res.tableNumber;
        this.restaurantId = res.restaurantId;
        if (res.restaurantName) this.restaurantName = res.restaurantName;
    },

    /* Entscheidet anhand des Status, welche Ansicht gezeigt wird */
    afterStatus(res) {
        this.showTableBadge();
        this.loadTheme();

        const gs = res.guestStatus;
        const ss = res.sessionStatus;

        if (gs === "REJECTED") {
            this.clearToken();
            this.showError("Nicht freigegeben", this.isHost
                ? "Das Personal hat die Anfrage abgelehnt."
                : "Der Tisch hat dich nicht reingelassen. Bitte sprich das Personal an.");
            return;
        }
        if (ss === "REJECTED" || ss === "EXPIRED") {
            this.clearToken();
            this.showError("Anfrage nicht freigegeben", "Bitte sprich kurz das Personal an.");
            return;
        }
        if (ss === "CLOSED") {
            this.clearToken();
            this.showError("Sitzung beendet", "Bitte den QR-Code neu scannen.");
            return;
        }

        if (gs === "APPROVED") {
            this.onApproved();
        } else {
            // wartet auf Freigabe
            document.getElementById("wait-text").textContent = this.isHost
                ? "Tisch " + this.tableNumber + " wurde gemeldet - das Personal gibt ihn gleich frei."
                : "Bitte warte kurz - jemand am Tisch (der Gastgeber) lässt dich gleich rein.";
            this.show("view-wait");
        }
        this.startPolling();
    },

    onApproved() {
        this.approved = true;
        document.getElementById("my-name").textContent = this.myName;
        document.getElementById("name-bar").style.display = "flex";
        document.getElementById("btn-bill").style.display = "";
        if (!this.menuLoaded) {
            this.loadMenu();
        } else {
            this.showMenu();
        }
    },

    /* Alle 3 Sekunden Status abfragen (und als Gastgeber Beitritts-Anfragen holen) */
    startPolling() {
        clearTimeout(this.pollTimer);
        const tick = async () => {
            try {
                const res = await OX.api("/api/guest/guests/" + this.guestToken);
                this.applyStatus(res);

                if (res.guestStatus === "REJECTED"
                    || res.sessionStatus === "REJECTED"
                    || res.sessionStatus === "EXPIRED"
                    || res.sessionStatus === "CLOSED") {
                    this.afterStatus(res); // fuehrt zur passenden Fehlermeldung
                    return;
                }
                if (res.guestStatus === "APPROVED" && !this.approved) {
                    this.onApproved();
                }
                if (this.approved && this.isHost) {
                    this.loadJoinRequests();
                }
            } catch (e) { /* Netzwerk-Aussetzer -> weiter versuchen */ }
            this.pollTimer = setTimeout(tick, 3000);
        };
        this.pollTimer = setTimeout(tick, 3000);
    },

    /* ---------- Gastgeber: Beitritts-Anfragen ---------- */

    async loadJoinRequests() {
        let list = [];
        try { list = await OX.api("/api/guest/guests/" + this.guestToken + "/join-requests"); }
        catch (e) { return; }
        const box = document.getElementById("join-banner");
        if (!list.length) { box.style.display = "none"; box.innerHTML = ""; return; }
        box.style.display = "";
        box.innerHTML = "";
        for (const j of list) {
            const card = document.createElement("div");
            card.className = "card";
            card.style.cssText = "margin:0 0 10px;border-color:var(--amber)";
            card.innerHTML = "<strong>" + this.esc(j.name) + "</strong> möchte an deinen Tisch. Reinlassen?";
            const row = document.createElement("div");
            row.className = "row";
            row.style.marginTop = "8px";
            const ok = document.createElement("button");
            ok.className = "small green"; ok.textContent = "Ja, reinlassen"; ok.style.flex = "1";
            ok.onclick = () => this.decideJoin(j.id, "approve");
            const no = document.createElement("button");
            no.className = "small red"; no.textContent = "Ablehnen"; no.style.flex = "1";
            no.onclick = () => this.decideJoin(j.id, "reject");
            row.append(ok, no);
            card.appendChild(row);
            box.appendChild(card);
        }
    },

    async decideJoin(id, action) {
        try {
            await OX.api("/api/guest/guests/" + this.guestToken + "/join-requests/" + id + "/" + action,
                { method: "POST" });
            OX.toast(action === "approve" ? "Person reingelassen" : "Abgelehnt");
        } catch (e) { OX.toast(e.message, true); }
        this.loadJoinRequests();
    },

    /* ---------- Name ---------- */

    async changeName() {
        const name = prompt("Dein Name (wird in der geteilten Rechnung angezeigt):", this.myName);
        if (name == null) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
            const res = await OX.api("/api/guest/guests/" + this.guestToken + "/name",
                { method: "PUT", body: JSON.stringify({ name: trimmed }) });
            this.myName = res.name;
            document.getElementById("my-name").textContent = this.myName;
            OX.toast("Name geändert");
        } catch (e) { OX.toast(e.message, true); }
    },

    /* ---------- Menue ---------- */

    async loadMenu() {
        this.menu = await OX.api("/api/guest/menu/" + this.restaurantId);
        this.menuLoaded = true;
        this.renderMenu();
        this.showMenu();
    },

    async loadTheme() {
        if (!this.restaurantId) return;
        try {
            const t = await OX.api("/api/guest/theme/" + this.restaurantId);
            this.hamburger = !!t.categoriesAsHamburger;

            const root = document.documentElement;
            if (t.accentColor) root.style.setProperty("--primary", t.accentColor);
            if (t.backgroundColor) root.style.setProperty("--bg", t.backgroundColor);
            if (t.name) { document.title = t.name + " - Bestellen"; }

            const v = "?v=" + Date.now();
            const logo = document.getElementById("brand-logo");
            if (t.logoUrl) { logo.src = t.logoUrl + v; logo.style.display = ""; }
            else { logo.removeAttribute("src"); logo.style.display = "none"; }

            if (t.backgroundUrl) {
                document.body.classList.add("has-bg-image");
                document.body.style.backgroundImage = "url('" + t.backgroundUrl + v + "')";
            } else {
                document.body.classList.remove("has-bg-image");
                document.body.style.backgroundImage = "";
            }
        } catch (e) { /* Design ist optional */ }
    },

    toggleCatPanel() { document.getElementById("cat-panel").classList.toggle("open"); },

    scrollToCategory(id) {
        document.getElementById("cat-panel").classList.remove("open");
        const el = document.getElementById("cat-" + id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    renderMenu() {
        const container = document.getElementById("menu-container");
        container.innerHTML = "";

        const bar = document.getElementById("cat-bar");
        const panel = document.getElementById("cat-panel");
        panel.innerHTML = "";
        panel.classList.remove("open");
        if (this.hamburger && this.menu.length) {
            bar.style.display = "flex";
            for (const cat of this.menu) {
                const b = document.createElement("button");
                b.textContent = cat.name;
                b.onclick = () => this.scrollToCategory(cat.id);
                panel.appendChild(b);
            }
        } else {
            bar.style.display = "none";
        }

        for (const cat of this.menu) {
            const card = document.createElement("div");
            card.className = "card";
            card.id = "cat-" + cat.id;
            card.innerHTML = "<h2>" + this.esc(cat.name) + "</h2>";
            for (const item of cat.items) {
                const row = document.createElement("div");
                row.className = "row clickable";
                row.style.padding = "8px 0";
                row.title = "Antippen für Details";
                row.innerHTML =
                    (item.imageUrl
                        ? "<img class='thumb' src='" + item.imageUrl + "' alt='' loading='lazy'>"
                        : "") +
                    "<div style='flex:1'><strong>" + this.esc(item.name) + "</strong>" +
                    (item.description ? "<br><span class='muted'>" + this.esc(item.description) + "</span>" : "") +
                    "</div>" +
                    "<span>" + OX.preis(item.price) + "</span>";
                row.onclick = () => this.openDetail(item);
                const btn = document.createElement("button");
                btn.className = "small";
                btn.textContent = "+";
                btn.title = "Schnell in den Warenkorb";
                btn.onclick = (event) => { event.stopPropagation(); this.addToCart(item); };
                row.appendChild(btn);
                card.appendChild(row);
            }
            container.appendChild(card);
        }
    },

    /* ---------- Detail-Ansicht ---------- */

    openDetail(item) {
        this.detailItem = item;
        this.detailQty = 1;
        document.getElementById("detail-qty").textContent = "1";

        const img = document.getElementById("detail-img");
        if (item.imageUrl) { img.src = item.imageUrl; img.style.display = ""; }
        else { img.style.display = "none"; }

        document.getElementById("detail-name").textContent = item.name;
        document.getElementById("detail-price").textContent = OX.preis(item.price);

        const desc = document.getElementById("detail-desc");
        desc.textContent = item.description || "";
        desc.style.display = item.description ? "" : "none";

        const detailsWrap = document.getElementById("detail-details-wrap");
        if (item.details) {
            document.getElementById("detail-details").textContent = item.details;
            detailsWrap.style.display = "";
        } else {
            detailsWrap.style.display = "none";
        }

        const line = this.cart[item.id];
        document.getElementById("detail-note").value = line && line.note ? line.note : "";
        document.getElementById("detail-add").textContent = "In den Warenkorb";
        document.getElementById("overlay").classList.add("show");
    },

    closeDetail() { document.getElementById("overlay").classList.remove("show"); },

    detailQtyChange(delta) {
        this.detailQty = Math.min(50, Math.max(1, this.detailQty + delta));
        document.getElementById("detail-qty").textContent = this.detailQty;
    },

    detailAddToCart() {
        const item = this.detailItem;
        if (!item) return;
        const line = this.cart[item.id] || { item: item, quantity: 0, note: "" };
        line.quantity = Math.min(50, line.quantity + this.detailQty);
        const note = document.getElementById("detail-note").value.trim();
        if (note) line.note = note;
        this.cart[item.id] = line;
        this.closeDetail();
        OX.toast(this.detailQty + "x " + item.name + " hinzugefügt");
        this.updateCartbar();
    },

    /* ---------- Warenkorb ---------- */

    addToCart(item) {
        const line = this.cart[item.id] || { item: item, quantity: 0, note: "" };
        line.quantity++;
        this.cart[item.id] = line;
        OX.toast(item.name + " hinzugefügt");
        this.updateCartbar();
    },

    cartCount() { return Object.values(this.cart).reduce((n, l) => n + l.quantity, 0); },
    cartTotal() { return Object.values(this.cart).reduce((s, l) => s + l.quantity * l.item.price, 0); },

    updateCartbar() {
        const bar = document.getElementById("cartbar");
        const count = this.cartCount();
        if (count > 0 && document.getElementById("view-menu").style.display !== "none") {
            bar.style.display = "flex";
            document.getElementById("cartbar-info").textContent =
                count + " Artikel · " + OX.preis(this.cartTotal());
        } else {
            bar.style.display = "none";
        }
    },

    showCart() {
        const box = document.getElementById("cart-lines");
        box.innerHTML = "";
        for (const line of Object.values(this.cart)) {
            const row = document.createElement("div");
            row.className = "row";
            row.style.padding = "10px 0";
            row.innerHTML =
                "<div style='flex:1'><strong>" + this.esc(line.item.name) + "</strong><br>" +
                "<span class='muted'>" + OX.preis(line.item.price) + " / Stück</span></div>";

            const qty = document.createElement("span");
            qty.className = "qty";
            const minus = document.createElement("button");
            minus.textContent = "−";
            minus.onclick = () => { this.changeQty(line.item.id, -1); };
            const num = document.createElement("strong");
            num.textContent = line.quantity;
            const plus = document.createElement("button");
            plus.textContent = "+";
            plus.onclick = () => { this.changeQty(line.item.id, 1); };
            qty.append(minus, num, plus);
            row.appendChild(qty);

            const note = document.createElement("input");
            note.placeholder = "Hinweis, z.B. ohne Zwiebeln";
            note.value = line.note;
            note.maxLength = 200;
            note.style.marginTop = "6px";
            note.oninput = () => { line.note = note.value; };

            const wrap = document.createElement("div");
            wrap.style.padding = "6px 0";
            wrap.style.borderBottom = "1px dashed var(--line)";
            wrap.append(row, note);
            box.appendChild(wrap);
        }
        document.getElementById("cart-total").textContent = "Summe: " + OX.preis(this.cartTotal());
        this.show("view-cart");
    },

    changeQty(itemId, delta) {
        const line = this.cart[itemId];
        if (!line) return;
        line.quantity += delta;
        if (line.quantity <= 0) delete this.cart[itemId];
        if (this.cartCount() === 0) { this.showMenu(); return; }
        this.showCart();
    },

    /* ---------- Bestellen ---------- */

    async placeOrder() {
        const btn = document.getElementById("btn-send");
        btn.disabled = true;
        try {
            const items = Object.values(this.cart).map(l => ({
                menuItemId: l.item.id,
                quantity: l.quantity,
                note: l.note || null
            }));
            await OX.api("/api/guest/orders", {
                method: "POST",
                body: JSON.stringify({ guestToken: this.guestToken, items: items })
            });
            this.cart = {};
            this.updateCartbar();
            await this.loadMyOrders();
            this.show("view-done");
        } catch (e) {
            OX.toast(e.message, true);
        } finally {
            btn.disabled = false;
        }
    },

    async loadMyOrders() {
        const orders = await OX.api("/api/guest/guests/" + this.guestToken + "/orders");
        const box = document.getElementById("my-orders");
        box.innerHTML = orders.length ? "" : "<p class='muted'>Noch keine Bestellungen.</p>";
        for (const o of orders) {
            const div = document.createElement("div");
            div.className = "card";
            div.innerHTML =
                "<div class='row'><strong>Bestellung #" + o.id + "</strong>" +
                "<span class='badge " + this.statusColor(o.status) + "'>" + this.statusText(o.status) + "</span>" +
                "<span class='spacer'></span><span class='muted'>" + OX.zeit(o.createdAt) + "</span></div>" +
                "<ul class='plain'>" +
                o.items.map(i => "<li>" + i.quantity + "x " + this.esc(i.name) +
                    (i.note ? " <span class='muted'>(" + this.esc(i.note) + ")</span>" : "") + "</li>").join("") +
                "</ul><strong>" + OX.preis(o.totalAmount) + "</strong>";
            box.appendChild(div);
        }
    },

    /* ---------- Geteilte Rechnung ---------- */

    async showBill() {
        this.billSelected = {};
        let bill;
        try { bill = await OX.api("/api/guest/guests/" + this.guestToken + "/bill"); }
        catch (e) { OX.toast(e.message, true); return; }

        const box = document.getElementById("bill-container");
        box.innerHTML = "";
        if (!bill.participants.length) {
            box.innerHTML = "<p class='muted'>Noch nichts bestellt.</p>";
        }
        for (const p of bill.participants) {
            const card = document.createElement("div");
            card.style.cssText = "border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:10px";
            card.innerHTML = "<div class='row'><strong>" + this.esc(p.name) + "</strong>" +
                (p.isHost ? "<span class='badge blue'>Gastgeber</span>" : "") +
                "<span class='spacer'></span><span>offen: " + OX.preis(p.openTotal) + "</span></div>";
            for (const line of p.items) {
                const row = document.createElement("label");
                row.className = "row";
                row.style.cssText = "padding:6px 0;border-bottom:1px dashed var(--line);cursor:pointer";
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.style.width = "auto";
                cb.disabled = line.paid;
                cb.onchange = () => this.toggleBillLine(line.orderItemId, line.lineTotal, cb.checked);
                const text = document.createElement("span");
                text.style.flex = "1";
                text.innerHTML = line.quantity + "x " + this.esc(line.name) +
                    (line.paid ? " <span class='badge green'>bezahlt</span>" : "");
                const price = document.createElement("span");
                price.textContent = OX.preis(line.lineTotal);
                row.append(cb, text, price);
                card.appendChild(row);
            }
            box.appendChild(card);
        }
        this.updateBillSum();
        this.show("view-bill");
    },

    toggleBillLine(id, lineTotal, checked) {
        if (checked) this.billSelected[id] = lineTotal;
        else delete this.billSelected[id];
        this.updateBillSum();
    },

    updateBillSum() {
        const sum = Object.values(this.billSelected).reduce((s, v) => s + Number(v), 0);
        document.getElementById("bill-selected").textContent = "Ausgewählt: " + OX.preis(sum);
    },

    clearBillSelection() {
        this.billSelected = {};
        document.querySelectorAll("#bill-container input[type=checkbox]").forEach(cb => { cb.checked = false; });
        this.updateBillSum();
    },

    /* ---------- Anzeige-Helfer ---------- */

    statusText(s) {
        return { NEW: "Eingegangen", IN_PREPARATION: "In Zubereitung", READY: "Fertig",
                 SERVED: "Serviert", CANCELLED: "Storniert" }[s] || s;
    },
    statusColor(s) {
        return { NEW: "blue", IN_PREPARATION: "amber", READY: "green",
                 SERVED: "", CANCELLED: "red" }[s] || "";
    },

    showMenu() { this.show("view-menu"); this.updateCartbar(); },

    show(id) {
        for (const v of ["view-wait", "view-error", "view-menu", "view-cart", "view-done", "view-bill"]) {
            document.getElementById(v).style.display = (v === id) ? "" : "none";
        }
        if (id !== "view-menu") document.getElementById("cartbar").style.display = "none";
        // Namensleiste nur nach Freigabe und nicht im Warte-/Fehlerbildschirm
        const showBar = this.approved && (id === "view-menu" || id === "view-cart"
            || id === "view-done" || id === "view-bill");
        document.getElementById("name-bar").style.display = showBar ? "flex" : "none";
        document.getElementById("page-title").textContent =
            (id === "view-menu") ? "Speisekarte" :
            (id === "view-cart") ? "Warenkorb" :
            (id === "view-bill") ? "Rechnung" : (this.restaurantName || "Willkommen!");
    },

    showTableBadge() {
        const b = document.getElementById("table-badge");
        b.textContent = "Tisch " + this.tableNumber;
        b.style.display = "";
    },

    showError(title, text) {
        this.approved = false;
        document.getElementById("name-bar").style.display = "none";
        document.getElementById("join-banner").style.display = "none";
        document.getElementById("error-title").textContent = title;
        document.getElementById("error-text").textContent = text;
        this.show("view-error");
    },

    esc(s) {
        return String(s ?? "").replace(/[&<>"']/g,
            c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
};

Guest.init();
