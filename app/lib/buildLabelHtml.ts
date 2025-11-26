// app/lib/buildLabelHtml.ts

export function buildLabelHtml(opts: {
  name: string;
  artNumber: string;
  weight: string;
  mhd: string;
  ingredientsHtml: string; // Richtext mit <strong>, <u>, ...
  barcodeData: string;     // EAN/GS1-128 String
  description: string;
}) {
  const {
    name,
    artNumber,
    weight,
    mhd,
    ingredientsHtml,
    barcodeData,
    description,
  } = opts;

  const barcodeJsLiteral = JSON.stringify(barcodeData);

  const safeDescription = (description || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return /* html */ `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Label</title>

  <style>
  /* Canvas-Größe: 945 × 650 px */
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
    padding: 0;
  }

  .label {
    width: 945px;
    height: 680px;
    background: white;
    padding: 24px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border: 1px solid #ccc;
  }

  /* HEADER-BEREICH */

  .header {
    width: 100%;
    margin-bottom: 16px;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
  }

  .name {
    font-size: 35px;
    font-weight: bold;
    line-height: 1.1;
    max-width: 70%;   /* falls Name lang ist */
  }

  .art-number {
    font-size: 24px;
    white-space: nowrap;
    text-align: right;
    margin-left: 12px;
  }

  .description {
    font-size: 22px;
    line-height: 1.3;
    margin-top: 10px;
    width: 100%;      /* volle Breite */
    color: #222;
  }

  /* META-ZEILE */

  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 22px;
    margin-top: 4px;
    margin-bottom: 16px;
  }

  .zutaten-label {
    font-weight: bold;
    margin-top: 8px;
    margin-bottom: 4px;
    font-size: 22px;
  }

  .zutaten {
    font-size: 20px;
    line-height: 1.35;
    flex-grow: 1;
    margin-bottom: 16px;
  }

  /* FOOTER MIT TEXT LINKS + BARCODE RECHTS */

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: top;
    gap: 24px;
    margin-top: 8px;
  }

  .footer-text {
    font-size: 18px;
    line-height: 1.4;
    flex: 1;
  }

  .footer-barcode {
    width: 40%;        /* ggf. 30–50 % je nach Platz */
  }

  #barcode {
    width: 100%;
    height: 110px;
  }
  </style>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>

<body>
  <div class="preview-wrapper">
    <div class="label">

      <div class="header">
        <div class="title-row">
          <div class="name">${name}</div>
          <div class="art-number">Art.-Nr.: ${artNumber}</div>
        </div>
        ${
          safeDescription
            ? `<div class="description">${safeDescription}</div>`
            : ""
        }
      </div>

      <div class="meta">
        <div>Mindestens haltbar bis: <strong>${mhd}</strong></div>
        <div>verzehrfertig • <strong>${weight}</strong></div>
      </div>

      <div class="zutaten-label">Zutaten:</div>

      <div class="zutaten">
        ${ingredientsHtml}
      </div>

      <div class="footer">
        <div class="footer-text">
          SAF Tepasse GmbH &amp; Co. KG<br>
          Wüppings Weide 6<br>
          46395 Bocholt<br>
        </div>
        <div class="footer-barcode">
          <svg id="barcode"></svg>
        </div>
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
        fontSize: 30,
        textMargin: 4,
        width: 4,
        height: 110,
        margin: 0
      });
    });
  </script>
</body>
</html>`;
}
