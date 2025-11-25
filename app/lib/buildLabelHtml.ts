// app/lib/buildLabelHtml.ts

export function buildLabelHtml(opts: {
  name: string;
  artNumber: string;
  weight: string;
  mhd: string;
  ingredientsHtml: string; // Richtext mit <strong>, <u>, ...
  barcodeData: string;     // EAN/GS1-128 String
}) {
  const { name, artNumber, weight, mhd, ingredientsHtml, barcodeData } = opts;

  // barcodeData sicher in JS einbauen
  const barcodeJsLiteral = JSON.stringify(barcodeData);

  return /* html */ `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Label</title>

  <style>
    /* Canvas-Größe: 60×30 mm @ 203 dpi ≈ 480×240 Pixel */
    body {
      margin: 0;
      padding: 0;
      background: #eee;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      font-family: Arial, sans-serif;
    }

    .preview-wrapper {
      padding: 20px;
    }

    /* Tatsächliches Label */
    .label {
      width: 480px;
      height: 240px;
      background: white;
      padding: 12px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      border: 1px solid #ccc;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }

    .name {
      font-size: 20px;
      font-weight: bold;
      line-height: 1.1;
      max-width: 60%;
    }

    .art-number {
      font-size: 11px;
      text-align: right;
      white-space: nowrap;
      margin-left: 8px;
    }

    .meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-top: 2px;
      margin-bottom: 4px;
    }

    .zutaten-label {
      font-weight: bold;
      margin-top: 4px;
      margin-bottom: 2px;
      font-size: 11px;
    }

    .zutaten {
      font-size: 10px;
      line-height: 1.25;
      overflow: hidden;
      flex-grow: 1;
      margin-bottom: 4px;
    }

    .barcode-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 4px;
    }

    .barcode-box {
      flex: 1;
      margin-right: 8px;
    }

    #barcode {
      width: 100%;
      height: 70px;
    }

    .footer {
      font-size: 9px;
      line-height: 1.2;
      margin-top: 4px;
    }
  </style>

  <!-- JsBarcode über CDN -->
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>

<body>
  <div class="preview-wrapper">
    <div class="label">

      <div class="header">
        <div class="name">${name}</div>
        <div class="art-number">
          Art.-Nr.: ${artNumber}<br>
          ${weight}
        </div>
      </div>

      <div class="meta">
        <div>Mindestens haltbar bis: <strong>${mhd}</strong></div>
        <div>- verzehrfertig -</div>
      </div>

      <div class="zutaten-label">Zutaten:</div>

      <div class="zutaten">
        ${ingredientsHtml}
      </div>

      <div class="barcode-row">
        <div class="barcode-box">
          <!-- GS1-128 / EAN-128 Barcode -->
          <svg id="barcode"></svg>
        </div>
      </div>

      <div class="footer">
        SAF Tepasse GmbH &amp; Co. KG<br>
        Wüppings Weide 6 · 46395 Bocholt<br>
        Bei +5°C bis +7°C lagern
      </div>

    </div>
  </div>

  <script>
    document.addEventListener("DOMContentLoaded", function () {
      const gs1Data = ${barcodeJsLiteral};

      JsBarcode("#barcode", gs1Data, {
        format: "CODE128",
        ean128: true,
        displayValue: true,
        fontSize: 12,
        textMargin: 2,
        width: 1.2,
        height: 60,
        margin: 0
      });
    });
  </script>
</body>
</html>`;
}
