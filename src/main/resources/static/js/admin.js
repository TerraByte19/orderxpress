/* Inhaber-Ansicht: Freigaben ("Tisch Nr. X freigeben?"), Tische verwalten,
   Speisekarte mit Fotos pflegen, Bestell-Uebersicht */
const Admin = {

    sse: null,
    pollTimer: null,
    categories: [],
    maxTableNumber: 0,
    cacheBust: Date.now(),

    /* ================= Login ================= */

    async init() {
        if (OX.hasAuth()) {
            try { await OX.api("/api/admin/sessions/pending"); this.start(); return; }
            catch (e) { OX.clearAuth(); }
        }
        document.getElementById("view-login").style.display = "";
    },

    async login() {
        OX.setAuth(
            document.getElementById("login-user").value.trim(),
            document.getElementById("login-pass").value);
        try {
            await OX.api("/api/admin/sessions/pending");
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

    start() {
        document.getElementById("view-login").style.display = "none";
        document.getElementById("view-app").style.display = "";
        document.getElementById("btn-logout").style.display = "";

        this.refreshAll();
        this.pollTimer = setInterval(() => this.refreshLive(), 15000); // Sicherheitsnetz

        this.sse = OX.connectSse("/api/admin/events",
            (event, data) => this.onEvent(event, data),
            (online) => document.getElementById("live-dot").classList.toggle("on", online));
    },

    onEvent(event, data) {
        if (event === "session-requested" && data && data.message) {
            OX.toast(data.message); // "Tisch Nr. X freigeben?"
        }
        this.refreshLive();
    },

    /* Alles neu laden (nach Login und nach eigenen Aenderungen) */
    refreshAll() {
        this.refreshLive();
        this.loadMenuAdmin();
        this.loadDesign();
        this.loadUsers();
    },

    /* Nur die "lebendigen" Bereiche (bei SSE-Ereignissen und im 15s-Takt) */
    refreshLive() {
        this.loadPending();
        this.loadTables();
        this.loadOrders();
    },

    /* ================= Freigabe-Anfragen ================= */

    async loadPending() {
        const list = await OX.api("/api/admin/sessions/pending");
        const box = document.getElementById("pending-list");
        if (!list.length) { box.innerHTML = "<p class='muted'>Keine offenen Anfragen.</p>"; return; }
        box.innerHTML = "";
        for (const s of list) {
            const row = document.createElement("div");
            row.className = "row";
            row.style.padding = "10px 0";
            row.innerHTML = "<span class='big'>Tisch Nr. " + s.tableNumber + " freigeben?</span>" +
                            "<span class='muted'>" + OX.zeit(s.createdAt) + "</span><span class='spacer'></span>";
            row.appendChild(this.btn("Freigeben", "green", () => this.decide(s.id, "approve")));
            row.appendChild(this.btn("Ablehnen", "red", () => this.decide(s.id, "reject")));
            box.appendChild(row);
        }
    },

    async decide(id, action) {
        try {
            await OX.api("/api/admin/sessions/" + id + "/" + action, { method: "POST" });
            OX.toast(action === "approve" ? "Tisch freigegeben" : "Anfrage abgelehnt");
        } catch (e) { OX.toast(e.message, true); }
        this.refreshLive();
    },

    /* ================= Tische ================= */

    async loadTables() {
        const tables = await OX.api("/api/admin/tables");
        this.maxTableNumber = tables.reduce((m, t) => Math.max(m, t.number), 0);
        const grid = document.getElementById("tables-grid");
        grid.innerHTML = "";
        for (const t of tables) {
            grid.appendChild(this.tableCard(t));
        }
    },

    tableCard(t) {
        const card = document.createElement("div");
        card.className = "card";
        card.style.margin = "0";
        card.innerHTML =
            "<div class='row'><span class='big'>Tisch " + t.number + "</span>" +
            "<span class='badge " + (t.occupied ? "red" : "green") + "'>" +
            (t.occupied ? "belegt" : "frei") + "</span>" +
            (t.active ? "" : "<span class='badge'>inaktiv</span>") + "</div>" +
            (t.name ? "<p class='muted'>" + this.esc(t.name) + "</p>" : "");

        const row = document.createElement("div");
        row.className = "row";
        row.style.marginTop = "8px";

        row.appendChild(this.btn("QR", "ghost", () => this.showQr(t)));
        row.appendChild(this.btn("Gast-Ansicht", "ghost", () => window.open("/t/" + t.qrToken, "_blank")));
        row.appendChild(this.btn("Bearbeiten", "ghost", () => this.editTable(t, card)));

        if (t.occupied && t.currentSessionId) {
            row.appendChild(this.btn("Sitzung beenden", "red", async () => {
                if (!confirm("Sitzung an Tisch " + t.number + " beenden?")) return;
                try { await OX.api("/api/admin/sessions/" + t.currentSessionId + "/close", { method: "POST" }); }
                catch (e) { OX.toast(e.message, true); }
                this.refreshLive();
            }));
        } else {
            row.appendChild(this.btn("Löschen", "red", () => this.deleteTable(t)));
        }
        card.appendChild(row);
        return card;
    },

    showNewTableForm() {
        this.buildForm(document.getElementById("new-table-form"), [
            { key: "number", label: "Tischnummer", type: "number", value: this.maxTableNumber + 1 },
            { key: "name", label: "Name (optional, z.B. Terrasse)", value: "" }
        ], async (inputs) => {
            await OX.api("/api/admin/tables", {
                method: "POST",
                body: JSON.stringify({ number: parseInt(inputs.number.value, 10), name: inputs.name.value.trim() || null })
            });
            OX.toast("Tisch angelegt");
            document.getElementById("new-table-form").innerHTML = "";
            this.loadTables();
        });
    },

    editTable(t, card) {
        card.innerHTML = "<div class='row'><span class='big'>Tisch " + t.number + " bearbeiten</span></div>";
        const holder = document.createElement("div");
        card.appendChild(holder);
        this.buildForm(holder, [
            { key: "number", label: "Tischnummer", type: "number", value: t.number },
            { key: "name", label: "Name (optional)", value: t.name || "" },
            { key: "active", label: "Status", type: "checkbox", value: t.active, checkLabel: "Tisch aktiv (scannbar)" }
        ], async (inputs) => {
            await OX.api("/api/admin/tables/" + t.id, {
                method: "PUT",
                body: JSON.stringify({
                    number: parseInt(inputs.number.value, 10),
                    name: inputs.name.value.trim() || null,
                    active: inputs.active.checked
                })
            });
            OX.toast("Tisch gespeichert");
            this.loadTables();
        }, () => this.loadTables());
    },

    async deleteTable(t) {
        if (!confirm("Tisch " + t.number + " wirklich löschen?")) return;
        try {
            await OX.api("/api/admin/tables/" + t.id, { method: "DELETE" });
            OX.toast("Tisch gelöscht");
        } catch (e) { OX.toast(e.message, true); }
        this.loadTables();
    },

    /* QR-Code mit Login laden und als Bild anzeigen */
    async showQr(table) {
        try {
            const res = await fetch("/api/admin/tables/" + table.id + "/qrcode?size=512",
                { headers: OX.authHeader() });
            if (!res.ok) throw new Error("QR-Code konnte nicht geladen werden");
            const blob = await res.blob();
            document.getElementById("qr-img").src = URL.createObjectURL(blob);
            document.getElementById("qr-title").textContent = "Tisch " + table.number;
            document.getElementById("overlay").classList.add("show");
        } catch (e) { OX.toast(e.message, true); }
    },

    /* ================= Speisekarte ================= */

    async loadMenuAdmin() {
        const [categories, items] = await Promise.all([
            OX.api("/api/admin/categories"),
            OX.api("/api/admin/menu-items")
        ]);
        this.categories = categories;
        this.cacheBust = Date.now();

        const box = document.getElementById("menu-admin");
        box.innerHTML = categories.length ? "" :
            "<p class='muted'>Noch keine Kategorien - oben auf '+ Kategorie' klicken.</p>";

        for (const cat of categories) {
            box.appendChild(this.categoryBlock(cat, items.filter(i => i.categoryId === cat.id)));
        }
    },

    categoryBlock(cat, items) {
        const block = document.createElement("div");
        block.style.marginBottom = "16px";

        const head = document.createElement("div");
        head.className = "row";
        head.innerHTML = "<strong style='font-size:15px'>" + this.esc(cat.name) + "</strong>" +
            (cat.active ? "" : "<span class='badge'>inaktiv</span>") +
            "<span class='muted'>Position " + cat.sortOrder + "</span><span class='spacer'></span>";
        head.appendChild(this.btn("Bearbeiten", "ghost", () => this.editCategory(cat, block)));
        head.appendChild(this.btn("Löschen", "ghost", () => this.deleteCategory(cat)));
        block.appendChild(head);

        if (!items.length) {
            const p = document.createElement("p");
            p.className = "muted";
            p.textContent = "Keine Gerichte in dieser Kategorie.";
            block.appendChild(p);
        }
        for (const item of items) {
            block.appendChild(this.itemRow(item));
        }
        return block;
    },

    itemRow(item) {
        const row = document.createElement("div");
        row.className = "row";
        row.style.cssText = "padding:8px 0;border-bottom:1px dashed var(--line)";

        // Foto bzw. Platzhalter
        if (item.imageUrl) {
            const img = document.createElement("img");
            img.className = "thumb";
            img.src = item.imageUrl + "?v=" + this.cacheBust;
            img.alt = "";
            row.appendChild(img);
        } else {
            const ph = document.createElement("div");
            ph.className = "thumb-placeholder";
            ph.textContent = "\u{1F37D}";
            row.appendChild(ph);
        }

        const info = document.createElement("div");
        info.style.flex = "1";
        info.innerHTML = "<strong>" + this.esc(item.name) + "</strong> · " + OX.preis(item.price) +
            (item.available ? "" : " <span class='badge amber'>ausverkauft</span>") +
            (item.description ? "<br><span class='muted'>" + this.esc(item.description) + "</span>" : "");
        row.appendChild(info);

        // Verfuegbarkeit umschalten
        row.appendChild(this.btn(item.available ? "Ausverkauft" : "Verfügbar", "ghost",
            () => this.toggleAvailable(item)));

        // Foto hochladen (verstecktes Datei-Feld)
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/jpeg,image/png";
        fileInput.style.display = "none";
        fileInput.onchange = () => this.uploadImage(item.id, fileInput.files[0]);
        row.appendChild(fileInput);
        row.appendChild(this.btn(item.imageUrl ? "Foto ändern" : "Foto", "ghost", () => fileInput.click()));
        if (item.imageUrl) {
            row.appendChild(this.btn("Foto löschen", "ghost", () => this.deleteImage(item.id)));
        }

        row.appendChild(this.btn("Bearbeiten", "ghost", () => this.editItem(item, row)));
        row.appendChild(this.btn("Löschen", "red", () => this.deleteItem(item)));
        return row;
    },

    /* ---------- Kategorien ---------- */

    showNewCategoryForm() {
        this.buildForm(document.getElementById("new-menu-form"), [
            { key: "name", label: "Name der Kategorie", value: "", full: true },
            { key: "sortOrder", label: "Position (Reihenfolge)", type: "number", value: this.categories.length + 1 }
        ], async (inputs) => {
            await OX.api("/api/admin/categories", {
                method: "POST",
                body: JSON.stringify({ name: inputs.name.value.trim(), sortOrder: parseInt(inputs.sortOrder.value, 10) || 0 })
            });
            OX.toast("Kategorie angelegt");
            document.getElementById("new-menu-form").innerHTML = "";
            this.loadMenuAdmin();
        });
    },

    editCategory(cat, block) {
        const holder = document.createElement("div");
        block.prepend(holder);
        this.buildForm(holder, [
            { key: "name", label: "Name", value: cat.name },
            { key: "sortOrder", label: "Position", type: "number", value: cat.sortOrder },
            { key: "active", label: "Status", type: "checkbox", value: cat.active, checkLabel: "Kategorie sichtbar" }
        ], async (inputs) => {
            await OX.api("/api/admin/categories/" + cat.id, {
                method: "PUT",
                body: JSON.stringify({
                    name: inputs.name.value.trim(),
                    sortOrder: parseInt(inputs.sortOrder.value, 10) || 0,
                    active: inputs.active.checked
                })
            });
            OX.toast("Kategorie gespeichert");
            this.loadMenuAdmin();
        }, () => this.loadMenuAdmin());
    },

    async deleteCategory(cat) {
        if (!confirm("Kategorie '" + cat.name + "' löschen? (Geht nur, wenn sie leer ist.)")) return;
        try {
            await OX.api("/api/admin/categories/" + cat.id, { method: "DELETE" });
            OX.toast("Kategorie gelöscht");
        } catch (e) { OX.toast(e.message, true); }
        this.loadMenuAdmin();
    },

    /* ---------- Gerichte ---------- */

    showNewItemForm() {
        if (!this.categories.length) { OX.toast("Bitte zuerst eine Kategorie anlegen", true); return; }
        this.buildForm(document.getElementById("new-menu-form"), [
            { key: "categoryId", label: "Kategorie", type: "select", value: this.categories[0].id,
              options: this.categories.map(c => ({ value: c.id, label: c.name })) },
            { key: "name", label: "Name des Gerichts", value: "" },
            { key: "price", label: "Preis in EUR (z.B. 9,50)", value: "" },
            { key: "sortOrder", label: "Position", type: "number", value: 1 },
            { key: "description", label: "Kurzbeschreibung (steht in der Karte)", value: "", full: true },
            { key: "details", label: "Zutaten & Details (Detail-Ansicht: Inhalte, Allergene, ...)",
              type: "textarea", value: "", full: true }
        ], async (inputs) => {
            await OX.api("/api/admin/menu-items", {
                method: "POST",
                body: JSON.stringify({
                    categoryId: parseInt(inputs.categoryId.value, 10),
                    name: inputs.name.value.trim(),
                    description: inputs.description.value.trim() || null,
                    details: inputs.details.value.trim() || null,
                    price: this.parsePrice(inputs.price.value),
                    sortOrder: parseInt(inputs.sortOrder.value, 10) || 0
                })
            });
            OX.toast("Gericht angelegt - jetzt noch ein Foto dazu?");
            document.getElementById("new-menu-form").innerHTML = "";
            this.loadMenuAdmin();
        });
    },

    editItem(item, row) {
        const holder = document.createElement("div");
        holder.style.width = "100%";
        row.after(holder);
        row.style.display = "none";
        this.buildForm(holder, [
            { key: "categoryId", label: "Kategorie", type: "select", value: item.categoryId,
              options: this.categories.map(c => ({ value: c.id, label: c.name })) },
            { key: "name", label: "Name", value: item.name },
            { key: "price", label: "Preis in EUR", value: String(item.price).replace(".", ",") },
            { key: "sortOrder", label: "Position", type: "number", value: item.sortOrder },
            { key: "available", label: "Status", type: "checkbox", value: item.available, checkLabel: "bestellbar" },
            { key: "description", label: "Kurzbeschreibung (steht in der Karte)", value: item.description || "", full: true },
            { key: "details", label: "Zutaten & Details (Detail-Ansicht: Inhalte, Allergene, ...)",
              type: "textarea", value: item.details || "", full: true }
        ], async (inputs) => {
            await OX.api("/api/admin/menu-items/" + item.id, {
                method: "PUT",
                body: JSON.stringify({
                    categoryId: parseInt(inputs.categoryId.value, 10),
                    name: inputs.name.value.trim(),
                    description: inputs.description.value.trim() || null,
                    details: inputs.details.value.trim() || null,
                    price: this.parsePrice(inputs.price.value),
                    available: inputs.available.checked,
                    sortOrder: parseInt(inputs.sortOrder.value, 10) || 0
                })
            });
            OX.toast("Gericht gespeichert");
            this.loadMenuAdmin();
        }, () => this.loadMenuAdmin());
    },

    async toggleAvailable(item) {
        try {
            await OX.api("/api/admin/menu-items/" + item.id, {
                method: "PUT",
                body: JSON.stringify({
                    categoryId: item.categoryId,
                    name: item.name,
                    description: item.description,
                    details: item.details,
                    price: item.price,
                    available: !item.available,
                    sortOrder: item.sortOrder
                })
            });
            OX.toast(item.available ? "Als ausverkauft markiert" : "Wieder bestellbar");
        } catch (e) { OX.toast(e.message, true); }
        this.loadMenuAdmin();
    },

    async deleteItem(item) {
        if (!confirm("'" + item.name + "' wirklich löschen?")) return;
        try {
            await OX.api("/api/admin/menu-items/" + item.id, { method: "DELETE" });
            OX.toast("Gericht gelöscht");
        } catch (e) { OX.toast(e.message, true); }
        this.loadMenuAdmin();
    },

    /* ---------- Fotos ---------- */

    async uploadImage(itemId, file) {
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        // Bewusst fetch statt OX.api: bei multipart setzt der Browser den
        // Content-Type (inkl. Boundary) selbst.
        const res = await fetch("/api/admin/menu-items/" + itemId + "/image", {
            method: "POST",
            headers: OX.authHeader(),
            body: formData
        });
        if (res.ok) {
            OX.toast("Foto gespeichert");
        } else {
            let detail = null;
            try { detail = (await res.json()).detail; } catch (e) { /* keine JSON-Antwort */ }
            OX.toast(detail || "Upload fehlgeschlagen", true);
        }
        this.loadMenuAdmin();
    },

    async deleteImage(itemId) {
        try {
            await OX.api("/api/admin/menu-items/" + itemId + "/image", { method: "DELETE" });
            OX.toast("Foto gelöscht");
        } catch (e) { OX.toast(e.message, true); }
        this.loadMenuAdmin();
    },

    /* ================= Bestellungen ================= */

    async loadOrders() {
        const orders = await OX.api("/api/admin/orders");
        const box = document.getElementById("orders-list");
        if (!orders.length) { box.innerHTML = "<p class='muted'>Noch keine Bestellungen.</p>"; return; }
        box.innerHTML = "";
        for (const o of orders.slice(0, 20)) {
            const div = document.createElement("div");
            div.className = "row";
            div.style.cssText = "padding:8px 0;border-bottom:1px dashed var(--line)";
            div.innerHTML =
                "<strong>#" + o.id + "</strong>" +
                "<span>Tisch " + o.tableNumber + "</span>" +
                "<span class='badge " + this.statusColor(o.status) + "'>" + this.statusText(o.status) + "</span>" +
                (o.printed ? "" : " <span class='badge amber'>Bon offen</span>") +
                "<span class='spacer'></span>" +
                "<span class='muted'>" + o.items.map(i => i.quantity + "x " + this.esc(i.name)).join(", ") + "</span>" +
                "<strong>" + OX.preis(o.totalAmount) + "</strong>" +
                "<span class='muted'>" + OX.zeit(o.createdAt) + "</span>";
            box.appendChild(div);
        }
    },

    /* ================= Design ================= */

    async loadDesign() {
        try {
            const t = await OX.api("/api/admin/design");
            document.getElementById("design-accent").value = t.accentColor || "#2563eb";
            document.getElementById("design-bg").value = t.backgroundColor || "#f4f5f7";
            document.getElementById("design-hamburger").checked = !!t.categoriesAsHamburger;

            const logo = document.getElementById("logo-preview");
            if (t.logoUrl) { logo.src = t.logoUrl + "?v=" + Date.now(); logo.style.display = ""; }
            else { logo.style.display = "none"; }

            const bg = document.getElementById("bg-preview");
            if (t.backgroundUrl) { bg.src = t.backgroundUrl + "?v=" + Date.now(); bg.style.display = ""; }
            else { bg.style.display = "none"; }
        } catch (e) { /* Design ist optional */ }
    },

    async saveDesign() {
        try {
            await OX.api("/api/admin/design", {
                method: "PUT",
                body: JSON.stringify({
                    accentColor: document.getElementById("design-accent").value,
                    backgroundColor: document.getElementById("design-bg").value,
                    categoriesAsHamburger: document.getElementById("design-hamburger").checked
                })
            });
            OX.toast("Design gespeichert");
        } catch (e) { OX.toast(e.message, true); }
    },

    /* kind: "logo" | "background" */
    async uploadAsset(kind) {
        const input = document.getElementById(kind === "logo" ? "logo-file" : "bg-file");
        const file = input.files[0];
        if (!file) { OX.toast("Bitte zuerst eine Datei auswählen", true); return; }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/admin/design/" + kind, {
            method: "POST", headers: OX.authHeader(), body: formData
        });
        if (res.ok) {
            OX.toast(kind === "logo" ? "Logo gespeichert" : "Hintergrund gespeichert");
            input.value = "";
        } else {
            let detail = null;
            try { detail = (await res.json()).detail; } catch (e) { /* keine JSON-Antwort */ }
            OX.toast(detail || "Upload fehlgeschlagen", true);
        }
        this.loadDesign();
    },

    async deleteAsset(kind) {
        try {
            await OX.api("/api/admin/design/" + kind, { method: "DELETE" });
            OX.toast("Bild entfernt");
        } catch (e) { OX.toast(e.message, true); }
        this.loadDesign();
    },

    /* ================= Kuechen-Logins ================= */

    async loadUsers() {
        const users = await OX.api("/api/admin/users");
        const box = document.getElementById("users-list");
        if (!users.length) { box.innerHTML = "<p class='muted'>Noch keine Mitarbeiter-Logins.</p>"; return; }
        box.innerHTML = "";
        for (const u of users) {
            const row = document.createElement("div");
            row.className = "row";
            row.style.cssText = "padding:8px 0;border-bottom:1px dashed var(--line)";
            row.innerHTML = "<strong>" + this.esc(u.username) + "</strong>" +
                "<span class='badge blue'>" + this.roleText(u.role) + "</span>" +
                (u.active ? "" : "<span class='badge'>gesperrt</span>") + "<span class='spacer'></span>";
            row.appendChild(this.btn(u.active ? "Sperren" : "Entsperren", "ghost",
                () => this.toggleUser(u)));
            row.appendChild(this.btn("Passwort ändern", "ghost", () => this.resetUserPassword(u)));
            row.appendChild(this.btn("Löschen", "red", () => this.deleteUser(u)));
            box.appendChild(row);
        }
    },

    roleText(role) {
        return { SERVICE: "Service/Kasse", KITCHEN: "Küche", OWNER: "Inhaber" }[role] || role;
    },

    showNewUserForm() {
        this.buildForm(document.getElementById("new-user-form"), [
            { key: "role", label: "Rolle", type: "select", value: "SERVICE",
              options: [{ value: "SERVICE", label: "Service / Kasse (Tische freigeben)" },
                        { value: "KITCHEN", label: "Küche (Küchen-Monitor)" }] },
            { key: "username", label: "Benutzername", value: "" },
            { key: "password", label: "Passwort (mind. 6 Zeichen)", type: "password", value: "" }
        ], async (inputs) => {
            await OX.api("/api/admin/users", {
                method: "POST",
                body: JSON.stringify({
                    username: inputs.username.value.trim(),
                    password: inputs.password.value,
                    role: inputs.role.value
                })
            });
            OX.toast("Login angelegt");
            document.getElementById("new-user-form").innerHTML = "";
            this.loadUsers();
        });
    },

    async toggleUser(u) {
        try {
            await OX.api("/api/admin/users/" + u.id, {
                method: "PUT", body: JSON.stringify({ active: !u.active })
            });
            OX.toast(u.active ? "Login gesperrt" : "Login entsperrt");
        } catch (e) { OX.toast(e.message, true); }
        this.loadUsers();
    },

    async resetUserPassword(u) {
        const pw = prompt("Neues Passwort für '" + u.username + "' (mind. 6 Zeichen):");
        if (!pw) return;
        try {
            await OX.api("/api/admin/users/" + u.id, {
                method: "PUT", body: JSON.stringify({ password: pw })
            });
            OX.toast("Passwort geändert");
        } catch (e) { OX.toast(e.message, true); }
    },

    async deleteUser(u) {
        if (!confirm("Küchen-Login '" + u.username + "' wirklich löschen?")) return;
        try {
            await OX.api("/api/admin/users/" + u.id, { method: "DELETE" });
            OX.toast("Login gelöscht");
        } catch (e) { OX.toast(e.message, true); }
        this.loadUsers();
    },

    /* ================= Helfer ================= */

    /** Baut ein kleines Formular in den Container. fields: {key,label,type,value,options,checkLabel,full} */
    buildForm(container, fields, onSave, onCancel) {
        const form = document.createElement("div");
        form.className = "mini-form";
        const inputs = {};

        for (const f of fields) {
            const wrap = document.createElement("div");
            if (f.full) wrap.className = "full";
            const label = document.createElement("label");
            label.textContent = f.label;
            wrap.appendChild(label);

            let input;
            if (f.type === "select") {
                input = document.createElement("select");
                for (const o of f.options) {
                    const opt = document.createElement("option");
                    opt.value = o.value;
                    opt.textContent = o.label;
                    input.appendChild(opt);
                }
                input.value = f.value;
            } else if (f.type === "textarea") {
                input = document.createElement("textarea");
                input.rows = 3;
                input.value = f.value ?? "";
            } else if (f.type === "checkbox") {
                const check = document.createElement("div");
                check.className = "check";
                input = document.createElement("input");
                input.type = "checkbox";
                input.checked = !!f.value;
                const span = document.createElement("span");
                span.textContent = f.checkLabel || "";
                check.append(input, span);
                wrap.appendChild(check);
                inputs[f.key] = input;
                form.appendChild(wrap);
                continue;
            } else {
                input = document.createElement("input");
                input.type = f.type || "text";
                input.value = f.value ?? "";
            }
            inputs[f.key] = input;
            wrap.appendChild(input);
            form.appendChild(wrap);
        }

        const buttons = document.createElement("div");
        buttons.className = "row full";
        const save = this.btn("Speichern", "green", async () => {
            try { await onSave(inputs); } catch (e) { OX.toast(e.message, true); }
        });
        const cancel = this.btn("Abbrechen", "ghost", () => {
            container.innerHTML = "";
            if (onCancel) onCancel();
        });
        buttons.append(save, cancel);
        form.appendChild(buttons);

        container.innerHTML = "";
        container.appendChild(form);
    },

    parsePrice(value) {
        const num = parseFloat(String(value).trim().replace(",", "."));
        if (isNaN(num) || num < 0) throw new Error("Bitte einen gültigen Preis eingeben, z.B. 9,50");
        return Math.round(num * 100) / 100;
    },

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

Admin.init();
