/* Statistik-Seite (nur Inhaber): Zeitraeume, Kennzahlen, Diagramme und die
   beiden Loesch-Wege (zuruecksetzen / Verlauf endgueltig loeschen). */
const Stats = {

    range: "today",
    from: null,
    to: null,

    /* ---------- Login ---------- */

    async init() {
        if (OX.hasAuth()) {
            try { await OX.api("/api/admin/stats?range=today"); this.start(); return; }
            catch (e) { if (e.status === 403) { this.nurInhaber(); return; } OX.clearAuth(); }
        }
        document.getElementById("view-login").style.display = "";
    },

    async login() {
        OX.setAuth(
            document.getElementById("login-user").value.trim(),
            document.getElementById("login-pass").value);
        try {
            await OX.api("/api/admin/stats?range=today");
            this.start();
        } catch (e) {
            OX.clearAuth();
            OX.toast(e.status === 401 || e.status === 403 ? "Falsche Zugangsdaten" : e.message, true);
        }
    },

    nurInhaber() {
        document.getElementById("view-login").innerHTML =
            "<h2>Nur f&uuml;r den Inhaber</h2><p class='muted'>Diese Seite zeigt die Statistik " +
            "und ist nur mit dem Inhaber-Login erreichbar.</p>";
        document.getElementById("view-login").style.display = "";
    },

    logout() { OX.clearAuth(); location.reload(); },

    start() {
        OX.buildNav("stats");
        document.getElementById("view-login").style.display = "none";
        document.getElementById("view-app").style.display = "";
        document.getElementById("btn-logout").style.display = "";
        this.load();
    },

    /* ---------- Zeitraum ---------- */

    setRange(range) {
        this.range = range;
        for (const b of document.querySelectorAll("#range-tabs button")) {
            b.classList.toggle("active", b.dataset.range === range);
        }
        document.getElementById("custom-range").style.display = (range === "custom") ? "" : "none";
        if (range === "custom") return; // erst nach "Anzeigen" laden
        this.load();
    },

    applyCustom() {
        this.from = document.getElementById("date-from").value || null;
        this.to = document.getElementById("date-to").value || null;
        if (!this.from || !this.to) { OX.toast("Bitte von- und bis-Datum wählen", true); return; }
        this.load();
    },

    async load() {
        let path = "/api/admin/stats?range=" + encodeURIComponent(this.range);
        if (this.range === "custom" && this.from && this.to) {
            path += "&from=" + this.from + "&to=" + this.to;
        }
        let s;
        try { s = await OX.api(path); }
        catch (e) { OX.toast(e.message, true); return; }
        this.render(s);
    },

    /* ---------- Anzeige ---------- */

    render(s) {
        document.getElementById("range-label").textContent =
            "Zeitraum: " + this.fmtDay(s.from) + " – " + this.fmtDay(s.to);

        document.getElementById("kpi-revenue").textContent = OX.preis(s.revenue);
        document.getElementById("kpi-orders").textContent = s.orderCount;
        document.getElementById("kpi-items").textContent = s.itemCount;
        document.getElementById("kpi-avg").textContent = OX.preis(s.avgOrder);

        this.renderTop(s.topProducts);
        this.renderDays(s.byDay);
        this.renderHours(s.byHour);
    },

    renderTop(top) {
        const box = document.getElementById("top-products");
        if (!top || !top.length) { box.innerHTML = "<p class='muted'>Noch keine Verkäufe in diesem Zeitraum.</p>"; return; }
        const max = top[0].quantity || 1;
        box.innerHTML = "";
        for (const p of top) {
            const pct = Math.round((p.quantity / max) * 100);
            const row = document.createElement("div");
            row.style.cssText = "padding:6px 0;border-bottom:1px dashed var(--line)";
            row.innerHTML =
                "<div class='row'><strong>" + this.esc(p.name) + "</strong>" +
                "<span class='spacer'></span>" +
                "<span class='muted'>" + p.quantity + "x · " + OX.preis(p.revenue) + "</span></div>" +
                "<div class='bar'><div class='bar-fill' style='width:" + pct + "%'></div></div>";
            box.appendChild(row);
        }
    },

    renderDays(days) {
        const box = document.getElementById("chart-days");
        if (!days || !days.length) { box.innerHTML = "<p class='muted'>Keine Daten.</p>"; return; }
        const max = Math.max(...days.map(d => Number(d.revenue)), 0);
        box.innerHTML = "";
        for (const d of days) {
            box.appendChild(this.vbar(
                this.fmtDay(d.day),
                Number(d.revenue), max,
                d.revenue > 0 ? this.kurzEuro(d.revenue) : "",
                this.fmtDay(d.day) + ": " + OX.preis(d.revenue) + " (" + d.orderCount + " Best.)"));
        }
    },

    renderHours(hours) {
        const box = document.getElementById("chart-hours");
        if (!hours || !hours.length) { box.innerHTML = "<p class='muted'>Keine Daten.</p>"; return; }
        const max = Math.max(...hours.map(h => Number(h.revenue)), 0);
        box.innerHTML = "";
        for (const h of hours) {
            // Nur jede 3. Stunde beschriften, sonst wird es zu eng
            const label = (h.hour % 3 === 0) ? (h.hour + "") : "";
            box.appendChild(this.vbar(
                label,
                Number(h.revenue), max,
                "",
                h.hour + ":00 Uhr: " + OX.preis(h.revenue) + " (" + h.orderCount + " Best.)"));
        }
    },

    /* Ein senkrechter Balken fuer die Diagramme */
    vbar(label, value, max, cap, title) {
        const pct = max > 0 ? Math.round((value / max) * 100) : 0;
        const wrap = document.createElement("div");
        wrap.className = "vbar";
        wrap.title = title;
        wrap.innerHTML =
            "<span class='cap'>" + (cap || "") + "</span>" +
            "<div class='fill" + (value > 0 ? "" : " empty") + "' style='height:" + Math.max(pct, value > 0 ? 3 : 0) + "%'></div>" +
            "<span class='lab'>" + this.esc(label) + "</span>";
        return wrap;
    },

    /* ---------- Zuruecksetzen / Loeschen ---------- */

    async reset() {
        if (!confirm("Statistik zurücksetzen? Ab jetzt wird neu gezählt. " +
                     "Bestellungen und Rechnungen bleiben erhalten.")) return;
        try {
            await OX.api("/api/admin/stats/reset", { method: "POST" });
            OX.toast("Statistik zurückgesetzt");
            this.load();
        } catch (e) { OX.toast(e.message, true); }
    },

    async deleteHistory() {
        if (!confirm("Bestellverlauf ENDGÜLTIG löschen? Abgeschlossene Bestellungen werden " +
                     "unwiderruflich entfernt (laufende Tische bleiben).")) return;
        if (!confirm("Wirklich sicher? Das kann nicht rückgängig gemacht werden.")) return;
        try {
            const res = await OX.api("/api/admin/stats/history", { method: "DELETE" });
            const n = res && typeof res.deleted === "number" ? res.deleted : 0;
            OX.toast(n + " Bestellung(en) gelöscht");
            this.load();
        } catch (e) { OX.toast(e.message, true); }
    },

    /* ---------- Helfer ---------- */

    fmtDay(iso) {
        if (!iso || iso.indexOf("-") < 0) return iso || "";
        const [y, m, d] = iso.split("-");
        return d + "." + m + ".";
    },

    kurzEuro(v) { return Math.round(Number(v)) + "€"; },

    esc(s) {
        return String(s ?? "").replace(/[&<>"']/g,
            c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
};

Stats.init();
