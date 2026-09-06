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

  /* oeffneCropper folgt in Task 2 */
})();
