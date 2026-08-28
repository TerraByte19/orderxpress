/* Kellner-Ansicht: belegte Tische live (Positionen je Person) UND abrechnen
   (Positionen als bezahlt markieren). Anmeldung nur per QR-Code (Geraetetoken). */
const Waiter = {

    sse: null,
    pollTimer: null,
    open: {},          // tableNumber -> aufgeklappt?
    tables: [],        // letzte Tischliste (fuer Neu-Rendern ohne erneuten Abruf)
    mode: "list",      // "list" | "kasse"
    kasseTable: null,  // BillDto des Tisches, der gerade abgerechnet wird
    kasseSel: {},      // orderItemId -> lineTotal

    async init() {
        if (!OX.deviceToken()) { this.showNoLogin(); return; }
        try { await OX.api("/api/waiter/tables"); }
        catch (e) { OX.clearAuth(); this.showNoLogin(); return; }
        this.start();
    },

    showNoLogin() { document.getElementById("view-nologin").style.display = ""; },

    start() {
        document.getElementById("view-app").style.display = "";
        this.load();
        this.pollTimer = setInterval(() => this.load(), 15000);
        this.sse = OX.connectSse("/api/waiter/events",
            (event, data) => {
                if (event === "waiter-called" && data) { OX.toast("Tisch " + data.tableNumber + " ruft!"); OX.callAlert.flash(); }
                this.load();
            },
            (online) => document.getElementById("live-dot").classList.toggle("on", online));
    },

    /* ---------- Tischliste ---------- */

    async load() {
        this.loadCalls();                   // Rufe immer aktualisieren
        if (this.mode === "kasse") return;  // beim Abrechnen die Liste nicht neu aufbauen
        try { this.tables = await OX.api("/api/waiter/tables"); }
        catch (e) { return; }
        this.renderList();
    },

    /* ---------- Kellner-Rufe ---------- */

    async loadCalls() {
        let calls;
        try { calls = await OX.api("/api/calls"); }
        catch (e) { return; }
        OX.callAlert.update(calls, (id) => this.callDone(id));  // Dauer-Banner (je Ruf "Erledigt") + Blitz
        const box = document.getElementById("calls");
        if (!calls.length) { box.innerHTML = ""; return; }
        box.innerHTML = "";
        for (const c of calls) {
            const card = document.createElement("div");
            card.className = "card";
            card.style.cssText = "margin:0 0 10px;border-color:var(--amber)";
            const row = document.createElement("div");
            row.className = "row";
            row.innerHTML = "<span class='big'>Tisch " + c.tableNumber + " ruft</span>" +
                "<span class='muted'>" + this.esc(c.guestName) + "</span><span class='spacer'></span>";
            const done = document.createElement("button");
            done.className = "green small";
            done.textContent = "Erledigt";
            done.onclick = () => this.callDone(c.id);
            row.appendChild(done);
            card.appendChild(row);
            box.appendChild(card);
        }
    },

    async callDone(id) {
        try { await OX.api("/api/calls/" + id + "/done", { method: "POST" }); }
        catch (e) { OX.toast(e.message, true); }
        this.loadCalls();
    },

    renderList() {
        const box = document.getElementById("tables");
        if (!this.tables.length) {
            box.innerHTML = "<p class='muted'>Gerade sind keine Tische belegt.</p>";
            return;
        }
        box.innerHTML = "";
        for (const t of this.tables) {
            const card = document.createElement("div");
            card.className = "card";
            card.style.margin = "0 0 12px";

            const head = document.createElement("div");
            head.className = "row clickable";
            head.innerHTML = "<span class='big'>Tisch " + t.tableNumber + "</span>" +
                "<span class='badge blue'>" + t.participants.length + " Pers.</span>" +
                "<span class='spacer'></span>" +
                "<strong>" + OX.preis(t.grandTotal) + "</strong>" +
                (Number(t.openTotal) > 0 ? " <span class='badge amber'>offen " + OX.preis(t.openTotal) + "</span>" : "");
            head.onclick = () => { this.open[t.tableNumber] = !this.open[t.tableNumber]; this.renderList(); };
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
                if (Number(t.openTotal) > 0) {
                    const btn = document.createElement("button");
                    btn.className = "green small";
                    btn.style.marginTop = "8px";
                    btn.textContent = "Kassieren";
                    btn.onclick = () => this.openKasse(t);
                    card.appendChild(btn);
                }
            }
            box.appendChild(card);
        }
    },

    /* ---------- Abrechnen ---------- */

    openKasse(table) {
        this.mode = "kasse";
        this.kasseTable = table;
        this.kasseSel = {};
        document.getElementById("view-app").style.display = "none";
        document.getElementById("view-kasse").style.display = "";
        this.renderKasse();
        window.scrollTo(0, 0);
    },

    renderKasse() {
        const t = this.kasseTable;
        const box = document.getElementById("view-kasse");
        box.innerHTML = "";

        const card = document.createElement("div");
        card.className = "card";
        card.style.borderColor = "var(--primary)";
        card.innerHTML = "<div class='row'><h2 style='margin:0'>Kasse &ndash; Tisch " + t.tableNumber + "</h2>" +
            "<span class='spacer'></span>" +
            "<button class='ghost small' onclick='Waiter.backToList()'>Zur&uuml;ck</button></div>";

        for (const p of t.participants) {
            const block = document.createElement("div");
            block.style.cssText = "border:1px solid var(--line);border-radius:10px;padding:10px;margin:10px 0";
            block.innerHTML = "<div class='row'><strong>" + this.esc(p.name) + "</strong>" +
                (p.isHost ? " <span class='badge blue'>Gastgeber</span>" : "") +
                "<span class='spacer'></span><span class='muted'>offen: " + OX.preis(p.openTotal) + "</span></div>";
            for (const line of p.items) {
                const row = document.createElement("label");
                row.className = "row";
                row.style.cssText = "padding:8px 0;border-bottom:1px dashed var(--line);cursor:pointer";
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.style.width = "auto";
                cb.disabled = line.paid;
                cb.onchange = () => this.toggleLine(line.orderItemId, line.lineTotal, cb.checked);
                const text = document.createElement("span");
                text.style.flex = "1";
                text.innerHTML = line.quantity + "x " + this.esc(line.name) +
                    (line.paid ? " <span class='badge green'>bezahlt</span>" : "");
                const price = document.createElement("span");
                price.textContent = OX.preis(line.lineTotal);
                row.append(cb, text, price);
                block.appendChild(row);
            }
            card.appendChild(block);
        }

        const bar = document.createElement("div");
        bar.className = "row";
        bar.style.cssText = "position:sticky;bottom:0;background:var(--card);border-top:1px solid var(--line);padding-top:10px";
        bar.innerHTML = "<strong id='kasse-sum'>Ausgew&auml;hlt: " + OX.preis(0) + "</strong><span class='spacer'></span>";
        const allBtn = document.createElement("button");
        allBtn.className = "ghost small";
        allBtn.textContent = "Alles offene";
        allBtn.onclick = () => this.selectAll();
        const payBtn = document.createElement("button");
        payBtn.className = "green";
        payBtn.textContent = "Als bezahlt markieren";
        payBtn.onclick = () => this.settle();
        bar.append(allBtn, payBtn);
        card.appendChild(bar);

        box.appendChild(card);
        this.updateSum();
    },

    toggleLine(id, lineTotal, checked) {
        if (checked) this.kasseSel[id] = lineTotal;
        else delete this.kasseSel[id];
        this.updateSum();
    },

    selectAll() {
        this.kasseSel = {};
        document.querySelectorAll("#view-kasse input[type=checkbox]").forEach(cb => {
            if (!cb.disabled) { cb.checked = true; }
        });
        // Auswahl aus den Zeilen neu aufbauen
        for (const p of this.kasseTable.participants) {
            for (const line of p.items) {
                if (!line.paid) this.kasseSel[line.orderItemId] = line.lineTotal;
            }
        }
        this.updateSum();
    },

    updateSum() {
        const sum = Object.values(this.kasseSel).reduce((s, v) => s + Number(v), 0);
        const el = document.getElementById("kasse-sum");
        if (el) el.textContent = "Ausgewählt: " + OX.preis(sum);
    },

    async settle() {
        const ids = Object.keys(this.kasseSel).map(Number);
        if (!ids.length) { OX.toast("Bitte zuerst Positionen auswählen", true); return; }
        const sum = Object.values(this.kasseSel).reduce((s, v) => s + Number(v), 0);
        if (!confirm("Ausgewählte Positionen (" + OX.preis(sum) + ") als bezahlt markieren?")) return;
        try {
            await OX.api("/api/waiter/settle", { method: "POST", body: JSON.stringify({ orderItemIds: ids }) });
            OX.toast("Als bezahlt markiert");
        } catch (e) { OX.toast(e.message, true); return; }
        this.backToList();
    },

    backToList() {
        this.mode = "list";
        this.kasseTable = null;
        this.kasseSel = {};
        document.getElementById("view-kasse").style.display = "none";
        document.getElementById("view-app").style.display = "";
        this.load();
    },

    esc(s) {
        return String(s ?? "").replace(/[&<>"']/g,
            c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
};

Waiter.init();
