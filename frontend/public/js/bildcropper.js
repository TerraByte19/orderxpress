/* OrderXpress - Bild-Zuschnitt (WhatsApp-Stil) mit echter Gast-Vorschau.
 * Klassisches Skript. Setzt window.OX.oeffneCropper(opts) und - fuer Tests -
 * die reinen Helfer window.OX._crop. KEIN DOM-Zugriff beim Laden. */
(function () {
  "use strict";
  var OX = (window.OX = window.OX || {});

  /* ----- reine Mathematik (testbar, kein DOM) ----- */
  var _crop = {
    minSkala: function (bildB, bildH, maskB, maskH) {
      return Math.max(maskB / bildB, maskH / bildH);
    },
    klemmeVersatz: function (versatz, bildMass, skala, maskMass) {
      var max = Math.max(0, (bildMass * skala - maskMass) / 2);
      return Math.min(max, Math.max(-max, versatz));
    },
    ausgabeMasse: function (ausgabe, ratio) {
      return { w: ausgabe, h: Math.round(ausgabe / (ratio || 1)) };
    }
  };
  OX._crop = _crop;

  _crop.zielAusFokus = function (fokus) {
    if (fokus && fokus.indexOf("gericht:") === 0) {
      return { ziel: "gericht", gerichtId: fokus.slice("gericht:".length) };
    }
    return { ziel: fokus || "logo" };
  };

  /* ----- CSS einmalig injizieren ----- */
  function styleEinfuegen() {
    if (document.getElementById("ox-cropper-style")) return;
    var s = document.createElement("style");
    s.id = "ox-cropper-style";
    s.textContent = [
      ".ox-crop-ov{position:fixed;inset:0;z-index:5000;background:rgba(10,12,14,.72);",
      "display:flex;align-items:center;justify-content:center;padding:12px}",
      ".ox-crop-karte{background:#1b1f21;color:#e7e9ea;border-radius:16px;padding:16px;",
      "width:min(920px,96vw);max-height:94vh;overflow:auto;",
      "font:14px/1.5 -apple-system,system-ui,'Segoe UI',sans-serif;",
      "box-shadow:0 24px 70px rgba(0,0,0,.5)}",
      ".ox-crop-titel{font-weight:700;margin:0 0 10px}",
      ".ox-crop-grid{display:grid;gap:14px;grid-template-columns:1fr}",
      "@media(min-width:760px){.ox-crop-grid{grid-template-columns:320px 1fr}}",
      ".ox-crop-buehne{position:relative;width:100%;aspect-ratio:1;border-radius:12px;",
      "overflow:hidden;background:#000;cursor:grab;touch-action:none;user-select:none}",
      ".ox-crop-buehne canvas{position:absolute;inset:0;width:100%;height:100%;display:block}",
      ".ox-crop-maske{position:absolute;pointer-events:none;",
      "box-shadow:0 0 0 2000px rgba(0,0,0,.55);outline:2px solid rgba(255,255,255,.9)}",
      ".ox-crop-frame{width:100%;aspect-ratio:1;border:0;border-radius:12px;background:#0f1113}",
      ".ox-crop-regler{display:flex;align-items:center;gap:12px;margin-top:12px}",
      ".ox-crop-regler input{flex:1;accent-color:#fff}",
      ".ox-crop-regler button{background:#2a2e31;color:#e7e9ea;border:0;width:34px;height:34px;",
      "border-radius:9px;font-size:18px;cursor:pointer;flex:none}",
      ".ox-crop-btns{display:flex;gap:10px;margin-top:14px;justify-content:flex-end}",
      ".ox-crop-btns button{border:0;border-radius:11px;padding:11px 18px;font:inherit;",
      "font-weight:700;cursor:pointer}",
      ".ox-crop-geist{background:#2a2e31;color:#e7e9ea}",
      ".ox-crop-haupt{background:#1f3d34;color:#fff}",
      ".ox-crop-hinweis{font-size:12px;color:#9aa0a6;margin-top:8px}"
    ].join("");
    document.head.appendChild(s);
  }

  /* ----- Hauptfunktion ----- */
  OX.oeffneCropper = function (opts) {
    styleEinfuegen();
    var form = opts.form || "kreis";
    var ratio = form === "breit" ? (opts.ratio || 3) : 1;
    var rund = form === "kreis";
    var maskAnteil = form === "breit" ? 0.92 : 0.86;
    var zielInfo = _crop.zielAusFokus(opts.fokus);

    var ov = document.createElement("div");
    ov.className = "ox-crop-ov";
    ov.innerHTML =
      '<div class="ox-crop-karte">' +
      '  <p class="ox-crop-titel">Bildausschnitt wählen</p>' +
      '  <div class="ox-crop-grid">' +
      '    <div>' +
      '      <div class="ox-crop-buehne"><canvas></canvas><div class="ox-crop-maske"></div></div>' +
      '      <div class="ox-crop-regler">' +
      '        <button type="button" data-z="aus" aria-label="rauszoomen">–</button>' +
      '        <input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">' +
      '        <button type="button" data-z="ein" aria-label="reinzoomen">+</button>' +
      '      </div>' +
      '      <p class="ox-crop-hinweis">Ziehen zum Verschieben · Regler / zwei Finger zum Zoomen</p>' +
      '    </div>' +
      '    <div><iframe class="ox-crop-frame" title="Vorschau der Gäste-Ansicht"></iframe>' +
      '      <p class="ox-crop-hinweis" data-rolle="vorschau-hinweis">Vorschau der echten Gäste-Ansicht.</p>' +
      '    </div>' +
      '  </div>' +
      '  <div class="ox-crop-btns">' +
      '    <button type="button" class="ox-crop-geist" data-a="ab">Abbrechen</button>' +
      '    <button type="button" class="ox-crop-haupt" data-a="ok">Übernehmen</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(ov);

    var buehne = ov.querySelector(".ox-crop-buehne");
    var canvas = ov.querySelector("canvas");
    var ctx = canvas.getContext("2d");
    var maske = ov.querySelector(".ox-crop-maske");
    var range = ov.querySelector("input[type=range]");
    var frame = ov.querySelector("iframe");
    var vorschauHinweis = ov.querySelector('[data-rolle="vorschau-hinweis"]');

    var bild = new Image();
    var skala = 1, minSkala = 1, maxSkala = 4, x = 0, y = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var zeiger = {}, zeigerAnzahl = 0, letzterPinch = 0;
    var letzterPost = 0;
    var iframeBereit = false;

    function maskMasse() {
      var r = buehne.getBoundingClientRect();
      var w = Math.min(r.width, r.height) * maskAnteil;
      var h = w / ratio;
      // Hochformat (ratio < 1): die Maske waere hoeher als die Buehne und
      // liefe unten heraus. Dann ueber die HOEHE begrenzen und die Breite
      // nachziehen. Fuer ratio >= 1 aendert das nichts (h <= w <= Hoehe).
      var maxH = r.height * maskAnteil;
      if (h > maxH) { h = maxH; w = h * ratio; }
      return { w: w, h: h, rechteck: r };
    }
    function maskeStellen() {
      var m = maskMasse();
      maske.style.width = m.w + "px";
      maske.style.height = m.h + "px";
      maske.style.left = (m.rechteck.width / 2 - m.w / 2) + "px";
      maske.style.top = (m.rechteck.height / 2 - m.h / 2) + "px";
      maske.style.borderRadius = rund ? "50%" : "10px";
    }
    function canvasStellen() {
      var r = buehne.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    }
    function begrenze() {
      var m = maskMasse();
      x = _crop.klemmeVersatz(x, bild.width, skala, m.w);
      y = _crop.klemmeVersatz(y, bild.height, skala, m.h);
    }
    function zeichne() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!bild.width) return;
      var cx = canvas.width / 2, cy = canvas.height / 2;
      var w = bild.width * skala * dpr, h = bild.height * skala * dpr;
      ctx.drawImage(bild, cx + x * dpr - w / 2, cy + y * dpr - h / 2, w, h);
      postVorschau();
    }
    function start() {
      var m = maskMasse();
      minSkala = _crop.minSkala(bild.width, bild.height, m.w, m.h);
      maxSkala = minSkala * 4;
      skala = minSkala; x = 0; y = 0;
      range.min = String(minSkala);
      range.max = String(maxSkala);
      range.step = String((maxSkala - minSkala) / 200 || 0.01);
      range.value = String(skala);
      begrenze(); zeichne();
    }
    function setzeZoom(v) {
      skala = Math.min(maxSkala, Math.max(minSkala, v));
      range.value = String(skala);
      begrenze(); zeichne();
    }
    function ausschnitt(ausgabeBreite) {
      var g = _crop.ausgabeMasse(ausgabeBreite, ratio);
      var m = maskMasse();
      var faktor = g.w / m.w;
      var cv = document.createElement("canvas");
      cv.width = g.w; cv.height = g.h;
      var c = cv.getContext("2d");
      if (rund) { c.save(); c.beginPath();
        c.arc(g.w / 2, g.h / 2, Math.min(g.w, g.h) / 2, 0, Math.PI * 2); c.clip(); }
      var bw = bild.width * skala * faktor, bh = bild.height * skala * faktor;
      c.drawImage(bild, g.w / 2 + x * faktor - bw / 2, g.h / 2 + y * faktor - bh / 2, bw, bh);
      if (rund) c.restore();
      return cv;
    }
    function postVorschau() {
      if (!iframeBereit) return;
      var jetzt = Date.now();
      if (jetzt - letzterPost < 80) return;
      letzterPost = jetzt;
      var url = ausschnitt(400).toDataURL("image/png");
      var msg = { typ: "ox-vorschau", ziel: zielInfo.ziel, dataUrl: url };
      if (zielInfo.gerichtId) msg.gerichtId = zielInfo.gerichtId;
      try { frame.contentWindow.postMessage(msg, window.location.origin); } catch (e) { /* ignore */ }
    }

    /* Zeiger (Maus + Touch) */
    buehne.addEventListener("pointerdown", function (e) {
      buehne.setPointerCapture(e.pointerId);
      zeiger[e.pointerId] = { x: e.clientX, y: e.clientY }; zeigerAnzahl++;
    });
    buehne.addEventListener("pointermove", function (e) {
      var alt = zeiger[e.pointerId];
      if (!alt || !bild.width) return;
      zeiger[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (zeigerAnzahl === 1) {
        x += e.clientX - alt.x; y += e.clientY - alt.y; begrenze(); zeichne();
      } else if (zeigerAnzahl === 2) {
        var ids = Object.keys(zeiger);
        var a = zeiger[ids[0]], b = zeiger[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (letzterPinch) setzeZoom(skala * (d / letzterPinch));
        letzterPinch = d;
      }
    });
    function zeigerEnde(e) {
      if (zeiger[e.pointerId]) { delete zeiger[e.pointerId]; zeigerAnzahl--; }
      if (zeigerAnzahl < 2) letzterPinch = 0;
    }
    buehne.addEventListener("pointerup", zeigerEnde);
    buehne.addEventListener("pointercancel", zeigerEnde);
    buehne.addEventListener("wheel", function (e) {
      if (!bild.width) return;
      e.preventDefault();
      setzeZoom(skala * (e.deltaY < 0 ? 1.08 : 0.92));
    }, { passive: false });
    range.addEventListener("input", function () { setzeZoom(parseFloat(range.value)); });
    ov.querySelector('[data-z="ein"]').addEventListener("click", function () { setzeZoom(skala * 1.15); });
    ov.querySelector('[data-z="aus"]').addEventListener("click", function () { setzeZoom(skala / 1.15); });

    // Benannt, damit schliessen() ihn wieder abmelden kann (sonst Leak).
    function beiResize() { maskeStellen(); canvasStellen(); begrenze(); zeichne(); }

    function schliessen() {
      window.removeEventListener("message", aufNachricht);
      window.removeEventListener("resize", beiResize);
      ov.remove();
    }
    ov.querySelector('[data-a="ab"]').addEventListener("click", function () {
      schliessen(); if (opts.onAbbrechen) opts.onAbbrechen();
    });
    ov.querySelector('[data-a="ok"]').addEventListener("click", function () {
      if (!bild.width) { schliessen(); return; }
      ausschnitt(opts.ausgabe).toBlob(function (blob) {
        schliessen(); if (opts.onFertig) opts.onFertig(blob);
      }, "image/png");
    });

    /* iframe + Vorschau-Bereitschaft */
    function aufNachricht(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.typ === "ox-vorschau-bereit") {
        iframeBereit = true;
        postVorschau();
      }
    }
    window.addEventListener("message", aufNachricht);
    frame.src = "/guest.html?vorschau=1&restaurant=" +
      encodeURIComponent(opts.restaurantId) + "&fokus=" + encodeURIComponent(opts.fokus);
    setTimeout(function () {
      if (!iframeBereit) {
        // Rueckfall: Vorschau-Spalte weg, nur Zuschnitt-Feld
        frame.style.display = "none";
        vorschauHinweis.textContent = "Live-Vorschau nicht verfügbar - der Ausschnitt wird trotzdem gespeichert.";
      }
    }, 4000);

    /* Bild laden */
    var objUrl = URL.createObjectURL(opts.datei);
    bild.onload = function () {
      URL.revokeObjectURL(objUrl);
      maskeStellen(); canvasStellen(); start();
      window.addEventListener("resize", beiResize);
    };
    bild.onerror = function () {
      URL.revokeObjectURL(objUrl); schliessen();
      if (window.OX && OX.toast) OX.toast("Bild konnte nicht geladen werden", true);
      if (opts.onAbbrechen) opts.onAbbrechen();
    };
    bild.src = objUrl;
  };
})();
