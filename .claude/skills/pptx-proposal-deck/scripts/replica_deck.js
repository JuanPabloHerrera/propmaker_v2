/* =====================================================================
 * replica_deck.js  —  RÉPLICA de un template + relleno con la propuesta
 * =====================================================================
 *
 * QUÉ ES (modo "replicar template" del skill)
 *   Reconstruye en pptxgenjs los slides EXACTOS de un template de marca
 *   (fondo, estilo, títulos, layout) usando las MEDIDAS reales que produce
 *   scripts/inspect_template.py (template_spec.json + assets/), y re-incrusta
 *   las imágenes reales del template. Luego rellena las zonas de contenido
 *   con la narrativa de la propuesta. El resultado es a la vez la RÉPLICA
 *   del template y (relleno) la salida final.
 *
 * FLUJO (ver references/template-replication.md)
 *   1. python scripts/inspect_template.py <template.pptx>
 *        -> template_spec.json + assets/backgrounds/* + assets/media/*
 *   2. Para CADA slide/layout del spec, escribe una función de render que:
 *        - pone el fondo full-bleed real (bgFull),
 *        - re-coloca logos/decoración con addImageAt (coords del spec),
 *        - reproduce los TÍTULOS del template con textAt (texto/pos/fuente),
 *        - rellena las zonas de contenido con la narrativa (textAt).
 *      Copia las coordenadas/fuentes tal cual del spec (están en pulgadas).
 *   3. node scripts/replica_deck.js  (DRY_RUN=1 para contar sin escribir)
 *      python /mnt/skills/public/pptx/scripts/rezip.py <fileName>.pptx
 *   4. QA visual comparando cada slide contra el template original.
 *
 * REGLAS
 *   - Fuente: usa la del template (aquí "Open Sans"); si no está instalada en
 *     el entorno de QA, el preview la sustituye (ver template-replication.md).
 *   - No inventes datos ni precios. Mantén los títulos del template salvo que
 *     la propuesta pida cambiarlos.
 *   - Este archivo es un ANDAMIO con 2 slides de ejemplo (reconstruidos de un
 *     template MoveMinds real). Duplica/edita una función por slide del spec.
 * ===================================================================== */

const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5  (usa slideWidthIn/HeightIn del spec)
const PW = 13.333, PH = 7.5;

// === ASSETS (del inspector — rutas relativas a la raíz de trabajo) =====
const BG = {
  vive:     "assets/backgrounds/L2_pic.jpg", // layout "Vive el futuro HOY"
  clientes: "assets/backgrounds/L3_pic.png", // layout "Clientes"
};
const FONT = "Open Sans"; // fuente real del template (theme fallback: Calibri)

// === CONTENIDO (rellena las zonas de contenido con la propuesta) =======
// Mantén los títulos del template; sustituye el cuerpo por la narrativa.
const CONTENT = {
  meta: { author: "«Proveedor»", company: "«Proveedor»", title: "«Propuesta»", fileName: "Replica_«Cliente».pptx" },
  vive: {
    // zona de contenido grande del layout "Vive el futuro HOY"
    body: "«Frase / valor principal para el cliente (mantén el estilo del template).»",
  },
  clientes: {
    title: "Nuestros Clientes",              // título del template (se conserva)
    body:  "«Clientes o experiencia relevante al sector del prospecto.»",
  },
};

pres.author = CONTENT.meta.author;
pres.company = CONTENT.meta.company;
pres.title = CONTENT.meta.title;

// ---------- HELPERS (agnósticos — reproducen el spec) ----------
// Fondo full-bleed real del layout.
function bgFull(slide, imgPath) {
  slide.background = { path: imgPath };
}
// Imagen (logo/decoración) en coords medidas (pulgadas).
function addImageAt(slide, imgPath, x, y, w, h) {
  slide.addImage({ path: imgPath, x, y, w, h });
}
// Caja de texto en coords/fuente medidas. opts: {face,size,bold,color,align,valign,lineSpacingMultiple}
function textAt(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: opts.face || FONT,
    fontSize: opts.size || 18,
    bold: !!opts.bold,
    italic: !!opts.italic,
    color: opts.color || "FFFFFF",
    align: opts.align || "left",
    valign: opts.valign || "top",
    lineSpacingMultiple: opts.lineSpacingMultiple || 1.05,
    margin: 0,
  });
}

// =====================================================================
// SLIDE (ejemplo) — layout "Vive el futuro HOY" (L2 del spec)
//   bg full-bleed L2_pic.jpg · texto Open Sans 26.67 bold verde A5C723,
//   centrado, @ x=0.372 y=1.657 w=12.59 h=4.186 (medidas reales).
// =====================================================================
function slideVive(d) {
  const s = pres.addSlide();
  bgFull(s, BG.vive);
  textAt(s, d.body, 0.372, 1.657, 12.59, 4.186, {
    face: FONT, size: 26.67, bold: true, color: "A5C723", align: "center", valign: "middle", lineSpacingMultiple: 1.1,
  });
}

// =====================================================================
// SLIDE (ejemplo) — layout "Clientes" (L3 del spec)
//   bg full-bleed L3_pic.png · título "Nuestros Clientes" Open Sans 17.33
//   bold centrado @ x=5.027 y=3.873 w=2.445 h=0.426 (medidas reales).
// =====================================================================
function slideClientes(d) {
  const s = pres.addSlide();
  bgFull(s, BG.clientes);
  textAt(s, d.title, 5.027, 3.873, 2.445, 0.6, {
    face: FONT, size: 17.33, bold: true, color: "1A2333", align: "center", valign: "top",
  });
  // zona de contenido (ajusta a la región real del layout)
  textAt(s, d.body, 1.0, 4.6, 11.33, 2.2, { face: FONT, size: 14, color: "1A2333", align: "center" });
}

// =====================================================================
// DECK ASSEMBLY — una llamada por slide (duplica por cada layout del spec).
// =====================================================================
function buildDeck() {
  slideVive(CONTENT.vive);
  slideClientes(CONTENT.clientes);
  // ...añade un slideXxx() por cada layout/slide de template_spec.json
}

buildDeck();

if (process.env.DRY_RUN) {
  console.log("DRY_RUN · slides:", pres.slides ? pres.slides.length : "(built)");
} else {
  pres.writeFile({ fileName: CONTENT.meta.fileName }).then((f) => console.log("SAVED", f));
}
