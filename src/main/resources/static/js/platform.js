/* Plattform-Admin: Laeden anlegen, auflisten, aktiv/inaktiv schalten, loeschen */
const Platform = {

    async init() {
        if (OX.hasAuth()) {
            try { await OX.api("/api/platform/restaurants"); this.start(); return; }
            catch (e) { OX.clearAuth(); }
        }
        document.getElementById("view-login").style.display = "";
    },

    async login() {
        OX.setAuth(
            document.getElementById("login-user").value.trim(),
            document.getElementById("login-pass").value);
        try {
            await OX.api("/api/platform/restaurants");
            this.start();
        } catch (e) {
            OX.clearAuth();
            OX.toast(e.status === 401 || e.status === 403 ? "Falsche Zugangsdaten" : e.message, true);
        }
    },

    logout() {
        OX.clearAuth();
        location.reload();
    },

    start() {
        document.getElementById("view-login").style.display = "none";
        document.getElementById("view-app").style.display = "";
        document.getElementById("btn-logout").style.display = "";
        this.load();
    },

    async load() {
        const list = await OX.api("/api/platform/restaurants");
        const box = document.getElementById("rest-list");
        if (!list.length) { box.innerHTML = "<p class='muted'>Noch keine Läden angelegt.</p>"; return; }
        box.innerHTML = "";
        for (const r of list) {
            const row = document.createElement("div");
            row.className = "row";
            row.style.cssText = "padding:10px 0;border-bottom:1px dashed var(--line)";
            row.innerHTML =
                "<strong>" + this.esc(r.name) + "</strong>" +
                "<span class='muted'>/" + this.esc(r.slug) + "</span>" +
                "<span class='badge " + (r.active ? "green" : "red") + "'>" +
                (r.active ? "aktiv" : "inaktiv") + "</span><span class='spacer'></span>";
            row.appendChild(this.btn(r.active ? "Deaktivieren" : "Aktivieren", "ghost",
                () => this.setActive(r)));
            row.appendChild(this.btn("Löschen", "red", () => this.remove(r)));
            box.appendChild(row);
        }
    },

    async create() {
        const name = document.getElementById("r-name").value.trim();
        const slug = document.getElementById("r-slug").value.trim().toLowerCase();
        const ownerUsername = document.getElementById("r-owner").value.trim();
        const ownerPassword = document.getElementById("r-pass").value;
        if (!name || !slug || !ownerUsername || !ownerPassword) {
            OX.toast("Bitte alle Felder ausfüllen", true); return;
        }
        try {
            await OX.api("/api/platform/restaurants", {
                method: "POST",
                body: JSON.stringify({ name, slug, ownerUsername, ownerPassword })
            });
            OX.toast("Laden '" + name + "' angelegt");
            document.getElementById("r-name").value = "";
            document.getElementById("r-slug").value = "";
            document.getElementById("r-owner").value = "";
            document.getElementById("r-pass").value = "";
            this.load();
        } catch (e) { OX.toast(e.message, true); }
    },

    async setActive(r) {
        try {
            await OX.api("/api/platform/restaurants/" + r.id + "/active?value=" + (!r.active), { method: "POST" });
            OX.toast(r.active ? "Laden deaktiviert" : "Laden aktiviert");
        } catch (e) { OX.toast(e.message, true); }
        this.load();
    },

    async remove(r) {
        if (!confirm("Laden '" + r.name + "' wirklich löschen? Das entfernt auch seine Logins.")) return;
        try {
            await OX.api("/api/platform/restaurants/" + r.id, { method: "DELETE" });
            OX.toast("Laden gelöscht");
        } catch (e) { OX.toast(e.message, true); }
        this.load();
    },

    btn(text, cls, onclick) {
        const b = document.createElement("button");
        b.className = "small " + cls;
        b.textContent = text;
        b.onclick = onclick;
        return b;
    },

    esc(s) {
        return String(s ?? "").replace(/[&<>"']/g,
            c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
};

Platform.init();
