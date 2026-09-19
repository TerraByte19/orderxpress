/* Inhaber-Ansicht: Freigaben ("Tisch Nr. X freigeben?"), Tische verwalten,
   Speisekarte mit Fotos pflegen, Bestell-Uebersicht */
const Admin = {

    sse: null,
    pollTimer: null,
    categories: [],
    maxTableNumber: 0,
    cacheBust: Date.now(),

    /* ================= Login ================= */

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
            await OX.api("/api/admin/sessions/pending");
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
        OX.buildNav("admin");
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
        this.loadGallery();
        this.loadUsers();
        this.loadDevices();
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
            // Bon-Vorschau blendet #qr-box aus statt sie zu loeschen (siehe
            // zeigeBonVorschau) - hier wieder einblenden, falls sie zuletzt
            // versteckt war.
            document.getElementById("qr-box").style.display = "";
            this.entferneBonBox();
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
        fileInput.onchange = () => {
            const foto = fileInput.files[0];
            fileInput.value = "";
            if (!foto) return;
            // Rueckfall, falls bildcropper.js nicht geladen wurde: direkt hochladen.
            if (!OX.oeffneCropper) { this.uploadImage(item.id, foto); return; }
            // Erst Zuschnitt-Dialog (mit Gast-Vorschau), dann Upload
            (async () => {
                let restaurantId = 0;
                try { restaurantId = (await OX.me()).restaurantId; } catch (e) { /* Vorschau faellt dann zurueck */ }
                OX.oeffneCropper({
                    datei: foto, restaurantId: restaurantId,
                    form: "quadrat", ausgabe: 900, fokus: "gericht:" + item.id,
                    onFertig: (blob) => this.uploadImage(item.id, new File([blob], "foto.png", { type: "image/png" }))
                });
            })();
        };
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
                    sortOrder: parseInt(inputs.sortOrder.value, 10) || 0,
                    // Marken werden hier (noch) nicht bearbeitet - unveraendert
                    // mitschicken, sonst gehen sie beim Speichern verloren
                    // (gleiche Falle wie schon bei toggleAvailable/details).
                    badges: item.badges || []
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
                    sortOrder: item.sortOrder,
                    badges: item.badges || []
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
            div.appendChild(this.btn("Bon-Vorschau", "ghost", () => this.zeigeBonVorschau(o)));
            box.appendChild(div);
        }
    },

    /* Reine Bildschirm-Vorschau (kein echter Druck) - wie der ESC/POS-Bon
       ungefaehr aussieht, bevor man ihn ausdruckt/nachdruckt. Nutzt Daten,
       die die Bestellliste eh schon geladen hat - kein neuer Endpunkt. */
    async zeigeBonVorschau(o) {
        const me = await OX.me().catch(() => null);
        const overlay = document.getElementById("overlay");

        // Bestehende QR-Box NICHT loeschen (sonst bricht Admin.showQr fuer
        // den Rest der Sitzung) - nur ausblenden, waehrend die Bon-Vorschau
        // gezeigt wird. Eine vorherige Bon-Box (falls zweimal hintereinander
        // geoeffnet) wird ersetzt statt sich anzuhaeufen.
        document.getElementById("qr-box").style.display = "none";
        this.entferneBonBox();

        const box = document.createElement("div");
        box.className = "box bon-box";

        const zeilen = o.items.map(i =>
            "<div class='bon-zeile'><span>" + i.quantity + "x " + this.esc(i.name) +
            (i.note ? " <em>(" + this.esc(i.note) + ")</em>" : "") + "</span>" +
            "<span>" + OX.preis(i.lineTotal) + "</span></div>"
        ).join("");

        box.innerHTML =
            "<div class='bon-kopf'>" + this.esc(me?.restaurantName || "") + "</div>" +
            "<div class='bon-sub'>NEUE BESTELLUNG</div>" +
            "<div class='bon-sub'>Tisch " + o.tableNumber + " &middot; Best.-Nr. " + o.id + "</div>" +
            "<div class='bon-sub'>" + OX.zeit(o.createdAt) + "</div>" +
            "<hr>" + zeilen + "<hr>" +
            "<div class='bon-zeile bon-summe'><span>Summe</span><span>" + OX.preis(o.totalAmount) + "</span></div>" +
            "<p class='muted' style='margin-top:12px'>Reine Bildschirm-Vorschau, kein echter Ausdruck.</p>";

        overlay.appendChild(box);
        overlay.classList.add("show");
    },

    entferneBonBox() {
        document.querySelector("#overlay .bon-box")?.remove();
    },

    /* ================= Design ================= */

    /* Feste Design-Vorlagen (nur Frontend). applyVorlage() fuellt die Felder,
       gespeichert wird ueber den normalen "Speichern"-Knopf. */
    /* Eine Vorlage fuellt ALLE Design-Felder, auch die sechs Struktur-Achsen
       (Aufbau, Kopf, Kategorien, Textur, Knoepfe, Bewegung). Erst die machen
       aus einer Farbpalette einen erkennbaren Laden - zwei Vorlagen mit
       gleicher Struktur unterscheiden sich sonst nur durch den Anstrich. */
    VORLAGEN: {
        bistro:  { accentColor: "#b3502e", backgroundColor: "#f7f4ef", darkMode: false,
                   styleShape: "SOFT",   displayFont: "FRAUNCES",      cartFlyStyle: "PHOTO", orderConfirmStyle: "STAMP", introStyle: "VORHANG",
                   menuLayout: "LISTE",   heroStyle: "BAND",     categoryStyle: "REITER",  textureStyle: "PAPIER",   controlStyle: "FLACH",   motionLevel: "NORMAL",
                   introLogo: "KLEIN", introHold: "NORMAL" },
        kasse:   { accentColor: "#1f3d34", backgroundColor: "#f6f6f4", darkMode: false,
                   styleShape: "SQUARE", displayFont: "BRICOLAGE",     cartFlyStyle: "PLUS",  orderConfirmStyle: "STAMP", introStyle: "HOCHKLAPPEN",
                   menuLayout: "LISTE",   heroStyle: "BAND",     categoryStyle: "REITER",  textureStyle: "KEIN",     controlStyle: "FLACH",   motionLevel: "DEZENT",
                   introLogo: "OHNE",  introHold: "OHNE" },
        nacht:   { accentColor: "#c9a227", backgroundColor: "#15181a", darkMode: true,
                   styleShape: "SQUARE", displayFont: "SPACE_GROTESK", cartFlyStyle: "PHOTO", orderConfirmStyle: "CHECK", introStyle: "FADE",
                   menuLayout: "KACHELN", heroStyle: "VOLL",     categoryStyle: "REITER",  textureStyle: "KEIN",     controlStyle: "RAHMEN",  motionLevel: "NORMAL",
                   introLogo: "KLEIN", introHold: "NORMAL" },
        frisch:  { accentColor: "#0f9d8f", backgroundColor: "#ffffff", darkMode: false,
                   styleShape: "SOFT",   displayFont: "MANROPE",       cartFlyStyle: "PHOTO", orderConfirmStyle: "CHECK", introStyle: "MITTE",
                   menuLayout: "KACHELN", heroStyle: "BAND",     categoryStyle: "REITER",  textureStyle: "KEIN",     controlStyle: "ERHOBEN", motionLevel: "VERSPIELT",
                   introLogo: "KLEIN", introHold: "KURZ" },
        klassik: { accentColor: "#1a1a1a", backgroundColor: "#faf9f6", darkMode: false,
                   styleShape: "SQUARE", displayFont: "DM_SERIF",      cartFlyStyle: "PLUS",  orderConfirmStyle: "CHECK", introStyle: "HOCHKLAPPEN",
                   menuLayout: "LISTE",   heroStyle: "SCHLICHT", categoryStyle: "KAPITEL", textureStyle: "PAPIER",   controlStyle: "RAHMEN",  motionLevel: "DEZENT",
                   introLogo: "KLEIN", introHold: "NORMAL" },
        /* Bar: Getraenkekarte ohne Bildmaterial - genau der Fall, fuer den
           TAFEL gedacht ist. Dunkel, ruhig, die Schrift traegt alles. */
        bar:     { accentColor: "#c0873c", backgroundColor: "#141210", darkMode: true,
                   styleShape: "SQUARE", displayFont: "INSTRUMENT_SERIF", cartFlyStyle: "PLUS", orderConfirmStyle: "CHECK", introStyle: "FADE",
                   menuLayout: "TAFEL",   heroStyle: "SCHLICHT", categoryStyle: "KAPITEL", textureStyle: "LINIEN",   controlStyle: "RAHMEN",  motionLevel: "DEZENT",
                   introLogo: "GROSS", introHold: "LANG" },
        /* Imbiss: das Foto verkauft, und es darf sich etwas bewegen. */
        imbiss:  { accentColor: "#e2571f", backgroundColor: "#fffaf3", darkMode: false,
                   styleShape: "SOFT",   displayFont: "SORA",          cartFlyStyle: "PHOTO", orderConfirmStyle: "STAMP", introStyle: "MITTE",
                   menuLayout: "KACHELN", heroStyle: "VOLL",     categoryStyle: "REITER",  textureStyle: "TERRAZZO", controlStyle: "ERHOBEN", motionLevel: "VERSPIELT",
                   introLogo: "OHNE",  introHold: "KURZ" },
        /* Atelier: Cafe oder Baeckerei - hell, viel Luft, Schrift vorn. */
        atelier: { accentColor: "#5a6650", backgroundColor: "#f2f0eb", darkMode: false,
                   styleShape: "SOFT",   displayFont: "FRAUNCES",      cartFlyStyle: "PLUS",  orderConfirmStyle: "CHECK", introStyle: "HOCHKLAPPEN",
                   menuLayout: "TAFEL",   heroStyle: "SCHLICHT", categoryStyle: "KAPITEL", textureStyle: "PAPIER",   controlStyle: "FLACH",   motionLevel: "NORMAL",
                   introLogo: "GROSS", introHold: "NORMAL" }
    },

    applyVorlage(name) {
        const v = this.VORLAGEN[name];
        if (!v) return;
        document.getElementById("design-accent").value = v.accentColor;
        document.getElementById("design-bg").value = v.backgroundColor;
        document.getElementById("design-dark").checked = v.darkMode;
        document.getElementById("design-shape").value = v.styleShape;
        document.getElementById("design-font").value = v.displayFont;
        document.getElementById("design-fly").value = v.cartFlyStyle;
        document.getElementById("design-confirm").value = v.orderConfirmStyle;
        document.getElementById("design-intro").value = v.introStyle;
        document.getElementById("design-layout").value = v.menuLayout;
        document.getElementById("design-hero").value = v.heroStyle;
        document.getElementById("design-kategorie").value = v.categoryStyle;
        document.getElementById("design-textur").value = v.textureStyle;
        document.getElementById("design-control").value = v.controlStyle;
        document.getElementById("design-motion").value = v.motionLevel;
        // Keine der Vorlagen kennt bislang einen Verlauf - eine Vorlage
        // "fuellt alle Felder", also auch diesen zuruecksetzen statt einen
        // vorher von Hand gesetzten Verlauf stehen zu lassen.
        document.getElementById("design-bg-gradient").checked = false;
        document.getElementById("design-intro-speed").value = "NORMAL";
        // Der Vorhang gehoert zum Gesamtbild einer Vorlage. Keine Vorlage
        // bringt bisher eine eigene Vorhangfarbe mit - also zuruecksetzen,
        // statt eine von Hand gesetzte stehen zu lassen (gleiche Regel wie
        // beim Hintergrund-Verlauf darueber).
        document.getElementById("design-intro-logo").value = v.introLogo || "KLEIN";
        document.getElementById("design-intro-hold").value = v.introHold || "NORMAL";
        document.getElementById("design-intro-repeat").value = "IMMER";
        document.getElementById("design-intro-eigene-farbe").checked = false;
        this.sendeVorschau();
        OX.toast("Vorlage '" + name + "' uebernommen - jetzt speichern");
    },

    async loadDesign() {
        try {
            const t = await OX.api("/api/admin/design");
            document.getElementById("design-accent").value = t.accentColor || "#2563eb";
            document.getElementById("design-bg").value = t.backgroundColor || "#f4f5f7";
            document.getElementById("design-kitchen").checked = t.kitchenDisplayEnabled !== false;
            // Die Kategorien-Navigation ist seit den Struktur-Achsen eine
            // Auswahl mit drei Werten. Liefert ein aelterer Server sie noch
            // nicht, wird sie aus dem alten Schalter abgeleitet - genau wie
            // im Backend (DesignRequest.categoryStyleOrDefault).
            document.getElementById("design-kategorie").value =
                t.categoryStyle || (t.categoriesAsHamburger ? "HAMBURGER" : "REITER");
            document.getElementById("design-layout").value = t.menuLayout || "LISTE";
            document.getElementById("design-hero").value = t.heroStyle || "BAND";
            document.getElementById("design-textur").value = t.textureStyle || "KEIN";
            document.getElementById("design-control").value = t.controlStyle || "FLACH";
            document.getElementById("design-motion").value = t.motionLevel || "NORMAL";
            document.getElementById("design-shape").value = t.styleShape || "SQUARE";
            document.getElementById("design-font").value = t.displayFont || "BRICOLAGE";
            document.getElementById("design-fly").value = t.cartFlyStyle || "PLUS";
            document.getElementById("design-confirm").value = t.orderConfirmStyle || "CHECK";
            document.getElementById("design-dark").checked = t.darkMode === true;
            document.getElementById("design-intro").value = t.introStyle || "HOCHKLAPPEN";
            document.getElementById("design-intro-speed").value = t.introSpeed || "NORMAL";
            document.getElementById("design-intro-text").value = t.introText || "";
            document.getElementById("design-intro-logo").value = t.introLogo || "KLEIN";
            document.getElementById("design-intro-hold").value = t.introHold || "NORMAL";
            document.getElementById("design-intro-repeat").value = t.introRepeat || "IMMER";
            // Leer heisst "keine eigene Farbe" - der Waehler zeigt dann die
            // Akzentfarbe als Ausgangspunkt, bleibt aber abgeschaltet.
            document.getElementById("design-intro-eigene-farbe").checked = !!t.introColor;
            document.getElementById("design-intro-color").value =
                t.introColor || t.accentColor || "#7a1f2b";
            document.getElementById("design-instagram").value = t.instagramUrl || "";
            document.getElementById("design-facebook").value = t.facebookUrl || "";
            document.getElementById("design-website").value = t.websiteUrl || "";
            document.getElementById("design-bg-gradient").checked = !!t.backgroundColor2;
            document.getElementById("design-bg2").value = t.backgroundColor2 || t.backgroundColor || "#f4f5f7";
            document.getElementById("design-hours").value = t.openingHours || "";
            document.getElementById("design-address").value = t.address || "";
            document.getElementById("design-phone").value = t.phone || "";

            const logo = document.getElementById("logo-preview");
            if (t.logoUrl) { logo.src = t.logoUrl + "?v=" + Date.now(); logo.style.display = ""; }
            else { logo.style.display = "none"; }

            const bg = document.getElementById("bg-preview");
            if (t.backgroundUrl) { bg.src = t.backgroundUrl + "?v=" + Date.now(); bg.style.display = ""; }
            else { bg.style.display = "none"; }

            this.vorschauVorbereiten();
        } catch (e) { /* Design ist optional */ }
    },

    /* ---------- Live-Vorschau der Gaeste-Seite ----------
       Der Inhaber stellt hier Werte ein, die erst beim Gast sichtbar werden -
       ohne Vorschau muesste er jedes Mal speichern und die Gaeste-Seite
       oeffnen. Das iframe laedt die ECHTE Gaeste-Seite im Vorschau-Modus
       (?vorschau=1, kein Scan, keine Session, kein Bestellen - siehe
       frontend/src/pages/guest/vorschau.ts) und bekommt bei jeder Aenderung
       den aktuellen Formularstand per postMessage. Gespeichert wird dabei
       nichts: was im iframe steht, ist ein Entwurf.

       Dieselbe Mechanik nutzt schon der Bild-Zuschnitt (bildcropper.js) -
       hier kommt nur eine zweite Nachrichtenart dazu. */

    vorschauBereit: false,
    vorschauTakt: null,

    async vorschauVorbereiten() {
        const frame = document.getElementById("design-vorschau-frame");
        if (!frame || frame.dataset.bereit === "1") return;
        frame.dataset.bereit = "1";

        // Die Vorschau klebt beim Scrollen oben - aber unter der (ebenfalls
        // klebenden) Kopfleiste. Deren Hoehe haengt an Schriftgroesse und
        // Fensterbreite, also wird sie gemessen statt geraten; das
        // Stylesheet haelt nur einen Rueckfallwert bereit.
        const kopf = document.querySelector("header.topbar");
        if (kopf) {
            const setzeHoehe = () => document.documentElement.style.setProperty(
                "--topbar-hoehe", Math.round(kopf.getBoundingClientRect().height) + "px");
            setzeHoehe();
            if (typeof ResizeObserver !== "undefined") new ResizeObserver(setzeHoehe).observe(kopf);
        }

        // Antwort des iframe ("ich stehe") - erst danach lohnt das Senden.
        window.addEventListener("message", (e) => {
            if (e.origin !== window.location.origin) return;
            if (e.data && e.data.typ === "ox-vorschau-bereit") {
                this.vorschauBereit = true;
                this.sendeVorschau();
            }
        });

        // Jede Aenderung in der Design-Karte geht an die Vorschau. Ein
        // gemeinsamer Zuhoerer auf dem Container statt 20 einzelne: neue
        // Felder wirken dadurch automatisch mit.
        const karte = document.querySelector(".design-werkstatt .mini-form");
        if (karte) {
            karte.addEventListener("input", () => this.sendeVorschauGedrosselt());
            karte.addEventListener("change", () => this.sendeVorschauGedrosselt());
        }

        let restaurantId = 0;
        try { restaurantId = (await OX.me()).restaurantId; } catch (e) { /* ohne Id keine Vorschau */ }
        if (!restaurantId) {
            const hinweis = document.getElementById("design-vorschau-hinweis");
            if (hinweis) hinweis.textContent = "Vorschau nicht verfügbar.";
            return;
        }
        frame.src = "/guest.html?vorschau=1&restaurant=" + encodeURIComponent(restaurantId);
    },

    /* Farbwaehler feuern bei jedem Ziehen - ohne Drosselung waere das ein
       Neuzeichnen pro Mausbewegung. 120 ms sind kurz genug, dass es sich
       weiterhin unmittelbar anfuehlt. */
    sendeVorschauGedrosselt() {
        clearTimeout(this.vorschauTakt);
        this.vorschauTakt = setTimeout(() => this.sendeVorschau(), 120);
    },

    sendeVorschau() {
        if (!this.vorschauBereit) return;
        const frame = document.getElementById("design-vorschau-frame");
        if (!frame || !frame.contentWindow) return;
        try {
            frame.contentWindow.postMessage(
                { typ: "ox-vorschau-design", design: this.designAusFormular() },
                window.location.origin
            );
        } catch (e) { /* iframe noch nicht bereit */ }
    },

    /* Spielt den Vorhang in der Vorschau ab - mit dem aktuellen, noch NICHT
       gespeicherten Stand. Erst den Formularstand hinueberschieben, dann das
       Abspielen anstossen: beide Nachrichten gehen in dieser Reihenfolge an
       dasselbe Fenster, die Vorschau hat den neuen Stand also sicher, bevor
       sie zeichnet. */
    vorschauVorhang() {
        if (!this.vorschauBereit) { OX.toast("Vorschau ist noch nicht bereit", true); return; }
        const frame = document.getElementById("design-vorschau-frame");
        if (!frame || !frame.contentWindow) return;
        this.sendeVorschau();
        try {
            frame.contentWindow.postMessage({ typ: "ox-vorschau-vorhang" }, window.location.origin);
        } catch (e) { /* iframe noch nicht bereit */ }
    },

    vorschauNeuLaden() {
        const frame = document.getElementById("design-vorschau-frame");
        if (!frame || !frame.src) return;
        this.vorschauBereit = false;
        frame.src = frame.src;
    },

    /* Der aktuelle Stand der Design-Karte als Objekt - EINE Quelle fuer das
       Speichern und fuer die Vorschau. Frueher baute saveDesign() dieses
       Objekt inline; zwei Fassungen waeren sofort auseinandergelaufen. */
    designAusFormular() {
        const wert = (id) => document.getElementById(id).value;
        const text = (id) => document.getElementById(id).value.trim() || null;
        const an = (id) => document.getElementById(id).checked;
        const kategorieStil = wert("design-kategorie");
        return {
            accentColor: wert("design-accent"),
            backgroundColor: wert("design-bg"),
            // Bleibt im Datensatz mitgefuehrt, damit aeltere Ansichten und
            // Clients weiter damit arbeiten koennen; fuehrend ist categoryStyle.
            categoriesAsHamburger: kategorieStil === "HAMBURGER",
            categoryStyle: kategorieStil,
            kitchenDisplayEnabled: an("design-kitchen"),
            styleShape: wert("design-shape"),
            displayFont: wert("design-font"),
            cartFlyStyle: wert("design-fly"),
            orderConfirmStyle: wert("design-confirm"),
            darkMode: an("design-dark"),
            introStyle: wert("design-intro"),
            introText: text("design-intro-text"),
            introSpeed: wert("design-intro-speed"),
            introLogo: wert("design-intro-logo"),
            introHold: wert("design-intro-hold"),
            introRepeat: wert("design-intro-repeat"),
            introColor: an("design-intro-eigene-farbe") ? wert("design-intro-color") : null,
            instagramUrl: text("design-instagram"),
            facebookUrl: text("design-facebook"),
            websiteUrl: text("design-website"),
            backgroundColor2: an("design-bg-gradient") ? wert("design-bg2") : null,
            openingHours: text("design-hours"),
            address: text("design-address"),
            phone: text("design-phone"),
            menuLayout: wert("design-layout"),
            heroStyle: wert("design-hero"),
            textureStyle: wert("design-textur"),
            controlStyle: wert("design-control"),
            motionLevel: wert("design-motion")
        };
    },

    async saveDesign() {
        try {
            const theme = await OX.api("/api/admin/design", {
                method: "PUT",
                body: JSON.stringify(this.designAusFormular())
            });
            // Eigene Seite sofort mit umfaerben, statt erst nach einem
            // Neuladen - saveDesign() bekommt das frische Theme direkt
            // als Antwort zurueck, kein zweiter Abruf noetig.
            OX.applyLadenTheme(theme);
            OX.toast("Design gespeichert");
        } catch (e) { OX.toast(e.message, true); }
    },

    /* kind: "logo" | "background" */
    async uploadAsset(kind) {
        const input = document.getElementById(kind === "logo" ? "logo-file" : "bg-file");
        const file = input.files[0];
        input.value = "";
        if (!file) { OX.toast("Bitte zuerst eine Datei auswählen", true); return; }

        // Rueckfall, falls bildcropper.js nicht geladen wurde: Datei roh hochladen.
        if (!OX.oeffneCropper) {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/admin/design/" + kind, {
                method: "POST", headers: OX.authHeader(), body: fd
            });
            if (res.ok) {
                OX.toast(kind === "logo" ? "Logo gespeichert" : "Hintergrund gespeichert");
            } else {
                let detail = null;
                try { detail = (await res.json()).detail; } catch (e) { /* keine JSON-Antwort */ }
                OX.toast(detail || "Upload fehlgeschlagen", true);
            }
            this.loadDesign();
            return;
        }

        let restaurantId = 0;
        try { restaurantId = (await OX.me()).restaurantId; } catch (e) { /* Vorschau faellt dann zurueck */ }

        const cfg = kind === "logo"
            ? { form: "kreis", ausgabe: 600, fokus: "logo" }
            : { form: "breit", ratio: 2.5, ausgabe: 1500, fokus: "background" };

        OX.oeffneCropper({
            datei: file, restaurantId: restaurantId,
            form: cfg.form, ratio: cfg.ratio, ausgabe: cfg.ausgabe, fokus: cfg.fokus,
            onFertig: async (blob) => {
                const fd = new FormData();
                fd.append("file", blob, kind + ".png");
                const res = await fetch("/api/admin/design/" + kind, {
                    method: "POST", headers: OX.authHeader(), body: fd
                });
                if (res.ok) {
                    OX.toast(kind === "logo" ? "Logo gespeichert" : "Hintergrund gespeichert");
                } else {
                    let detail = null;
                    try { detail = (await res.json()).detail; } catch (e) { /* keine JSON-Antwort */ }
                    OX.toast(detail || "Upload fehlgeschlagen", true);
                }
                this.loadDesign();
            }
        });
    },

    async deleteAsset(kind) {
        try {
            await OX.api("/api/admin/design/" + kind, { method: "DELETE" });
            OX.toast("Bild entfernt");
        } catch (e) { OX.toast(e.message, true); }
        this.loadDesign();
    },

    /* ================= Bildergalerie (Ambiente-Fotos) ================= */

    async loadGallery() {
        try {
            const ids = await OX.api("/api/admin/gallery");
            const box = document.getElementById("gallery-list");
            box.innerHTML = "";
            for (const id of ids) {
                const wrap = document.createElement("div");
                wrap.style.textAlign = "center";
                const img = document.createElement("img");
                img.src = "/api/guest/restaurants/gallery/" + id;
                img.className = "thumb";
                wrap.appendChild(img);
                wrap.appendChild(document.createElement("br"));
                wrap.appendChild(this.btn("Entfernen", "red", () => this.deleteGalleryImage(id)));
                box.appendChild(wrap);
            }
            if (!ids.length) box.innerHTML = "<p class='muted'>Noch keine Fotos.</p>";
        } catch (e) { /* Galerie ist optional */ }
    },

    async uploadGalleryImage() {
        const input = document.getElementById("gallery-file");
        const dateien = Array.from(input.files || []);
        input.value = "";
        if (!dateien.length) { OX.toast("Bitte zuerst eine Datei auswählen", true); return; }

        // Rueckfall, falls bildcropper.js nicht geladen wurde: Dateien roh hochladen.
        if (!OX.oeffneCropper) {
            for (const datei of dateien) {
                const fd = new FormData();
                fd.append("file", datei);
                const res = await fetch("/api/admin/gallery", {
                    method: "POST", headers: OX.authHeader(), body: fd
                });
                if (res.ok) OX.toast("Foto hinzugefügt");
                else {
                    let detail = null;
                    try { detail = (await res.json()).detail; } catch (e) { /* keine JSON-Antwort */ }
                    OX.toast(detail || "Upload fehlgeschlagen", true);
                }
            }
            this.loadGallery();
            return;
        }

        let restaurantId = 0;
        try { restaurantId = (await OX.me()).restaurantId; } catch (e) { /* egal */ }

        const naechste = (i) => {
            if (i >= dateien.length) { this.loadGallery(); return; }
            OX.oeffneCropper({
                datei: dateien[i], restaurantId: restaurantId,
                form: "breit", ratio: 1.5, ausgabe: 1200, fokus: "galerie",
                onAbbrechen: () => naechste(i + 1),
                onFertig: async (blob) => {
                    try {
                        const fd = new FormData();
                        fd.append("file", blob, "galerie.png");
                        const res = await fetch("/api/admin/gallery", {
                            method: "POST", headers: OX.authHeader(), body: fd
                        });
                        if (res.ok) OX.toast("Foto hinzugefügt");
                        else {
                            let detail = null;
                            try { detail = (await res.json()).detail; } catch (e) { /* keine JSON-Antwort */ }
                            OX.toast(detail || "Upload fehlgeschlagen", true);
                        }
                    } catch (e) {
                        // Netzfehler (offline): Toast zeigen, aber die Queue NICHT
                        // haengen lassen - naechste() laeuft unten im finally.
                        OX.toast("Upload fehlgeschlagen", true);
                    } finally {
                        naechste(i + 1);
                    }
                }
            });
        };
        naechste(0);
    },

    async deleteGalleryImage(id) {
        try {
            await OX.api("/api/admin/gallery/" + id, { method: "DELETE" });
            OX.toast("Foto entfernt");
        } catch (e) { OX.toast(e.message, true); }
        this.loadGallery();
    },

    /* ================= Geraete (QR-Anmeldung) ================= */

    async loadDevices() {
        const devices = await OX.api("/api/admin/devices");
        const box = document.getElementById("devices-list");
        if (!devices.length) {
            box.innerHTML = "<p class='muted'>Noch keine Geräte. Lege eins an, um ein Tablet anzumelden.</p>";
            return;
        }
        box.innerHTML = "";
        for (const d of devices) {
            const row = document.createElement("div");
            row.className = "row";
            row.style.cssText = "padding:8px 0;border-bottom:1px dashed var(--line)";
            row.innerHTML =
                "<strong>" + this.esc(d.label) + "</strong>" +
                "<span class='badge blue'>" + this.roleText(d.role) + "</span>" +
                (d.revoked ? "<span class='badge red'>gesperrt</span>"
                    : d.activated ? "<span class='badge green'>angemeldet</span>"
                        : "<span class='badge amber'>wartet auf Scan</span>") +
                "<span class='spacer'></span>" +
                "<span class='muted'>" + (d.lastUsedAt ? "zuletzt aktiv " + OX.zeit(d.lastUsedAt) : "noch nie benutzt") + "</span>";

            if (!d.revoked) {
                if (d.activationUrl) {
                    row.appendChild(this.btn("QR anzeigen", "green", () => this.showDeviceQr(d)));
                } else {
                    row.appendChild(this.btn("Neu einrichten", "ghost", () => this.regenerateDevice(d)));
                }
                row.appendChild(this.btn("Sperren", "red", () => this.revokeDevice(d)));
            }
            box.appendChild(row);
        }
    },

    showNewDeviceForm() {
        this.buildForm(document.getElementById("new-device-form"), [
            { key: "label", label: "Name des Geräts (z.B. Küchen-Tablet)", value: "" },
            { key: "role", label: "Wofür ist das Gerät?", type: "select", value: "KITCHEN",
              options: [{ value: "KITCHEN", label: "Küche (Küchen-Monitor)" },
                        { value: "SERVICE", label: "Service / Kasse" }] }
        ], async (inputs) => {
            const created = await OX.api("/api/admin/devices", {
                method: "POST",
                body: JSON.stringify({
                    label: inputs.label.value.trim(),
                    role: inputs.role.value
                })
            });
            document.getElementById("new-device-form").innerHTML = "";
            await this.loadDevices();
            this.showDeviceQr(created);   // QR direkt zum Scannen anzeigen
        });
    },

    /* QR-Code laden (mit Login) und im Overlay anzeigen */
    async showDeviceQr(device) {
        try {
            const res = await fetch("/api/admin/devices/" + device.id + "/qrcode?size=512",
                { headers: OX.authHeader() });
            if (!res.ok) throw new Error("QR-Code konnte nicht geladen werden");
            const blob = await res.blob();
            document.getElementById("qr-img").src = URL.createObjectURL(blob);
            document.getElementById("qr-title").textContent =
                device.label + " – mit dem Gerät scannen";
            document.getElementById("overlay").classList.add("show");
        } catch (e) { OX.toast(e.message, true); }
    },

    async regenerateDevice(device) {
        if (!confirm("Neuen QR-Code für '" + device.label + "' erzeugen? Das alte Gerät bleibt angemeldet.")) return;
        try {
            const updated = await OX.api("/api/admin/devices/" + device.id + "/regenerate", { method: "POST" });
            await this.loadDevices();
            this.showDeviceQr(updated);
        } catch (e) { OX.toast(e.message, true); }
    },

    async revokeDevice(device) {
        if (!confirm("'" + device.label + "' sperren? Das Gerät fliegt sofort raus.")) return;
        try {
            await OX.api("/api/admin/devices/" + device.id, { method: "DELETE" });
            OX.toast("Gerät gesperrt");
        } catch (e) { OX.toast(e.message, true); }
        this.loadDevices();
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
