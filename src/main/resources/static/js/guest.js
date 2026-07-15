/* Gaeste-Seite: Scan -> Warten auf Freigabe -> Menue -> Warenkorb -> Bestellen */
const Guest = {

    qrToken: null,
    sessionToken: null,
    tableNumber: null,
    restaurantId: null,
    hamburger: false,
    menu: [],
    cart: {},          // menuItemId -> { item, quantity, note }
    pollTimer: null,
    detailItem: null,  // aktuell geoeffnetes Gericht in der Detail-Ansicht
    detailQty: 1,

    /* ---------- Start ---------- */

    init() {
        // Klick neben die Detail-Box schliesst sie
        document.getElementById("overlay").onclick = () => this.closeDetail();

        // Token aus der Adresse lesen: /t/<qrToken> (aus dem QR-Code) oder ?token=...
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
        this.scan();
    },

    async scan() {
        this.show("view-wait");
        try {
            const res = await OX.api("/api/guest/scan/" + encodeURIComponent(this.qrToken), { method: "POST" });
            this.sessionToken = res.sessionToken;
            this.tableNumber = res.tableNumber;
            this.restaurantId = res.restaurantId;
            this.showTableBadge();
            this.loadTheme(); // Design des Ladens (Farben/Logo/Hintergrund) anwenden
            if (res.status === "APPROVED") {
                this.loadMenu();
            } else {
                document.getElementById("wait-text").textContent =
                    "Tisch " + this.tableNumber + " wurde gemeldet - das Personal gibt ihn gleich frei.";
                this.pollStatus();
            }
        } catch (e) {
            if (e.status === 404) this.showError("QR-Code ungültig", "Bitte das Personal ansprechen.");
            else this.showError("Das hat nicht geklappt", e.message);
        }
    },

    /* Alle 3 Sekunden nachsehen, ob der Inhaber freigegeben hat */
    pollStatus() {
        clearTimeout(this.pollTimer);
        this.pollTimer = setTimeout(async () => {
            try {
                const res = await OX.api("/api/guest/sessions/" + this.sessionToken);
                if (res.status === "APPROVED") { this.loadMenu(); return; }
                if (res.status === "REJECTED" || res.status === "EXPIRED") {
                    this.showError("Anfrage nicht freigegeben",
                        "Bitte sprich kurz das Personal an.");
                    return;
                }
                if (res.status === "CLOSED") {
                    this.showError("Sitzung beendet", "Bitte den QR-Code neu scannen.");
                    return;
                }
                this.pollStatus();
            } catch (e) {
                this.pollStatus(); // kurzer Netzwerkfehler -> weiter versuchen
            }
        }, 3000);
    },

    /* ---------- Menue ---------- */

    async loadMenu() {
        this.menu = await OX.api("/api/guest/menu/" + this.restaurantId);
        this.renderMenu();
        this.showMenu();
    },

    /* Design des Ladens laden und anwenden (Farben, Logo, Hintergrund, Hamburger) */
    async loadTheme() {
        if (!this.restaurantId) return;
        try {
            const t = await OX.api("/api/guest/theme/" + this.restaurantId);
            this.hamburger = !!t.categoriesAsHamburger;

            const root = document.documentElement;
            if (t.accentColor) root.style.setProperty("--primary", t.accentColor);
            if (t.backgroundColor) root.style.setProperty("--bg", t.backgroundColor);

            if (t.name) {
                document.getElementById("page-title").textContent = t.name;
                document.title = t.name + " - Bestellen";
            }

            // Cache-Bust, damit ein ersetztes/entferntes Bild nicht aus dem
            // Browser-Cache haengen bleibt.
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
        } catch (e) {
            /* Design ist optional - bei Fehler bleibt das Standard-Aussehen */
        }
    },

    /* Hamburger-Menue auf-/zuklappen */
    toggleCatPanel() {
        document.getElementById("cat-panel").classList.toggle("open");
    },

    scrollToCategory(id) {
        document.getElementById("cat-panel").classList.remove("open");
        const el = document.getElementById("cat-" + id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    renderMenu() {
        const container = document.getElementById("menu-container");
        container.innerHTML = "";

        // Kategorie-Leiste (Hamburger) nur zeigen, wenn der Laden das aktiviert hat
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
                // Klick auf die Zeile -> Detail-Ansicht mit grossem Bild und Zutaten
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
        if (item.imageUrl) {
            img.src = item.imageUrl;
            img.style.display = "";
        } else {
            img.style.display = "none";
        }

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

    closeDetail() {
        document.getElementById("overlay").classList.remove("show");
    },

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
                body: JSON.stringify({ sessionToken: this.sessionToken, items: items })
            });
            this.cart = {};
            this.updateCartbar();
            await this.loadMyOrders();
            this.show("view-done");
        } catch (e) {
            OX.toast(e.message, true);
            if (e.status === 409) setTimeout(() => location.reload(), 2500);
        } finally {
            btn.disabled = false;
        }
    },

    async loadMyOrders() {
        const orders = await OX.api("/api/guest/sessions/" + this.sessionToken + "/orders");
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
        for (const v of ["view-wait", "view-error", "view-menu", "view-cart", "view-done"]) {
            document.getElementById(v).style.display = (v === id) ? "" : "none";
        }
        if (id !== "view-menu") document.getElementById("cartbar").style.display = "none";
        document.getElementById("page-title").textContent =
            (id === "view-menu") ? "Speisekarte" :
            (id === "view-cart") ? "Warenkorb" : "Willkommen!";
    },

    showTableBadge() {
        const b = document.getElementById("table-badge");
        b.textContent = "Tisch " + this.tableNumber;
        b.style.display = "";
    },

    showError(title, text) {
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
