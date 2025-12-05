// app/lib/buildLabelHtml.ts

export function buildLabelHtml(opts: {
  name: string;
  artNumber: string;         // aktuell unbenutzt im Layout, aber noch im Typ
  weight: string;
  mhd: string;
  ingredientsHtml: string;   // Richtext mit <strong>, <u>, ...
  barcodeData: string;       // EAN/GS1-128 String
  description: string;
  dietTypeSvg?: string;
}) {
  const {
    name,
    artNumber,               // wird nicht gerendert, kann später entfernt werden
    weight,
    mhd,
    ingredientsHtml,
    barcodeData,
    description,
    dietTypeSvg,
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
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
  }

  body {
    background: #eee;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    font-family: "Open Sans", Arial, sans-serif;
  }

  .label {
    background: white;
    padding: 24px 24px 120px 24px; /* unten Platz für gedrehten Footer */
    box-sizing: border-box;
    border: 1px solid #ccc;
    display: flex;
    flex-direction: column;
    position: relative;
    margin: 0;
    height: 100%;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    max-height: 100px;
  
  }

  .name {
    font-weight: bold;
  }

  .name-header {
  font-size: 45px;
  max-width: 70%;
  overflow: hidden;
  max-height: 100%;
  white-space: normal; /* wrap erlauben */
}

  /* Icon ersetzt Art.-Nr. */
  .diet-icon {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .diet-icon svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .description {
    font-size: 22px;
    margin-bottom: 12px;
  }

  .zutaten-label {
    font-weight: bold;
    font-size: 22px;
    margin-bottom: 6px;
  }

  .zutaten {
    font-size: 20px;
    line-height: 1.35;
    flex-grow: 1;
  }

  /* NORMALER FOOTER */
  .footer {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-top: 24px;
    align-items: flex-start;
  }

  .footer-text {
    font-size: 22px;
    line-height: 1.4;
    white-space: nowrap;
  }

  .footer-meta {
    font-size: 18px;
  }

  /* GEDREHTER Footer: Name rechts, Barcode links */
  .rotated-footer {
    position: absolute;
    bottom: 10px;
    left: 24px;
    right: 24px;
    height: 100px;
  

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;

    transform: rotate(180deg);
  }

 .name-footer {
  font-size: 45px;
  max-height:100%;
  flex: 1;
  overflow: hidden;
  white-space: normal; /* wrap erlauben */
}

  .rotated-footer-barcode {
    width: 250px;
    height: 90px;
  }
  </style>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>

<body>
  <div class="label">

    <!-- HEADER -->
    <div class="title-row">
      <div class="name name-header">${name}</div>
      ${
        dietTypeSvg
          ? `<div class="diet-icon">${dietTypeSvg}</div>`
          : ""
      }
    </div>

    ${
      safeDescription
        ? `<div class="description">${safeDescription}</div>`
        : ""
    }

    <div class="zutaten-label">Zutaten:</div>

    <div class="zutaten">
      ${ingredientsHtml}
    </div>

    <!-- NORMALER FOOTER -->
    <div class="footer">
      <div class="footer-text">
        <strong>SAF Tepasse GmbH &amp; Co. KG</strong><br>
        Wüppings Weide 6<br>
        46395 Bocholt<br>
      </div>

      <div class="footer-meta">
        Mindestens haltbar bei 7°C - 9°C bis:
        <div style="font-size: 30px; font-weight: bold;">
          ${mhd}
        </div>
        verzehrfertig • <strong>${weight}</strong>
      </div>
    </div>

    <!-- GEDREHTER FOOTER MIT NAME + BARCODE -->
    <div class="rotated-footer">
      <div class="name name-footer">${name}</div>
      <svg id="barcode-rotated" class="rotated-footer-barcode"></svg>
    </div>

  </div>

  <script>
    document.addEventListener("DOMContentLoaded", function () {
      const gs1Data = ${barcodeJsLiteral};

      JsBarcode("#barcode-rotated", gs1Data, {
        format: "CODE128",
        ean128: true,
        displayValue: false,
        width: 3,
        height: 90,
        margin: 0
      });

      autoShrinkNames();
    });

    function autoShrinkNames() {
  const elements = document.querySelectorAll(".name-header, .name-footer");

  elements.forEach((el) => {
    let size = parseInt(window.getComputedStyle(el).fontSize, 10);

    // Die sichtbare Größe des Elements
    const maxW = el.clientWidth;
    const maxH = el.clientHeight;

    // Falls Element keinen Platz hat → überspringen
    if (!maxW || !maxH) return;

    // Loop bis der Text passt
    while ((el.scrollWidth > maxW || el.scrollHeight > maxH) && size > 8) {
      size--;
      el.style.fontSize = size + "px";
    }
  });
}

  </script>
</body>
</html>`;
}
