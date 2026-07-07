/* =====================================================================
 * replica_deck.js  —  RÉPLICA fiel de un template (spec-driven)
 * =====================================================================
 *
 * QUÉ ES (modo "replicar template" del skill)
 *   Lee `template_spec.json` (lo produce scripts/inspect_template.py) y
 *   REPRODUCE cada slide/layout del template tal cual: fondo full-bleed real,
 *   TODAS las formas (rect/roundRect/ellipse con su relleno/transparencia/
 *   borde), imágenes reales y texto con su fuente/tamaño/color/alineación.
 *   Luego SUSTITUYE el texto de las formas de contenido por la narrativa de
 *   la propuesta (overrides), conservando el diseño. El resultado es la
 *   réplica del template y, con overrides, la salida final.
 *
 * FLUJO (ver references/template-replication.md)
 *   1. python scripts/inspect_template.py <template.pptx>
 *        -> template_spec.json + assets/backgrounds/* + assets/media/*
 *   2. Edita SOLO el bloque DECK (abajo): qué layouts/slides del spec usar,
 *      en qué orden, y qué formas sustituir con contenido de la propuesta
 *      (por índice de forma). Todo lo demás se reproduce automáticamente.
 *   3. node scripts/replica_deck.js   (o DRY_RUN=1 para contar)
 *      python /mnt/skills/public/pptx/scripts/rezip.py <fileName>.pptx
 *   4. QA visual comparando cada slide contra el template original.
 *
 * EJECUTA desde la carpeta con template_spec.json y assets/ (raíz de trabajo).
 * ===================================================================== */

const fs = require("fs");
const pptxgen = require("pptxgenjs");

const spec = JSON.parse(fs.readFileSync("template_spec.json", "utf8"));
const FONT = spec.theme.minorFont || spec.theme.majorFont || "Arial";

const pres = new pptxgen();
pres.defineLayout({ name: "TPL", width: spec.slideWidthIn, height: spec.slideHeightIn });
pres.layout = "TPL";

// ================ CONFIGURA EL DECK AQUÍ ============================
// Cada entrada = un slide de salida basado en un LAYOUT (o SLIDE) del spec.
//   from:      "layout" | "slide"
//   index:     índice 1-based dentro de spec.layouts / spec.slides
//   fileName:  (en meta) nombre de salida
//   overrides: { "<shapeIndex>": "texto de la propuesta" }
//              sustituye el texto de esa forma; el resto se reproduce igual.
//              Descubre los índices con: node scripts/replica_deck.js --list
const meta = { author: "«Proveedor»", company: "«Proveedor»", title: "«Propuesta»", fileName: "Replica_«Cliente».pptx" };
const DECK = [
  // Ejemplo — reemplaza por los layouts que use tu propuesta y su contenido:
  { from: "layout", index: 2, overrides: { /* 2: "«valor principal para el cliente»" */ } },
  { from: "layout", index: 3, overrides: { /* 3: "«clientes o experiencia del sector»" */ } },
];

pres.author = meta.author;
pres.company = meta.company;
pres.title = meta.title;

// ---------- HELPERS (spec → pptxgenjs — NO TOCAR) ----------
const THEME_KEY = {
  TEXT_1: "dk1", BACKGROUND_1: "lt1", TEXT_2: "dk2", BACKGROUND_2: "lt2", DARK_1: "dk1",
  LIGHT_1: "lt1", DARK_2: "dk2", LIGHT_2: "lt2", ACCENT_1: "accent1", ACCENT_2: "accent2",
  ACCENT_3: "accent3", ACCENT_4: "accent4", ACCENT_5: "accent5", ACCENT_6: "accent6",
  HYPERLINK: "hlink", FOLLOWED_HYPERLINK: "folHlink",
};
function resolveColor(c) {
  if (!c) return null;
  if (/^[0-9A-Fa-f]{6}$/.test(c)) return c.toUpperCase();
  if (c.startsWith("theme:")) {
    const key = THEME_KEY[c.slice(6)] || c.slice(6).toLowerCase();
    const hex = spec.theme.colors && spec.theme.colors[key];
    if (hex && /^[0-9A-Fa-f]{6}$/.test(hex)) return hex.toUpperCase();
  }
  return null;
}
const PRESET = { RECTANGLE: "rect", ROUNDED_RECTANGLE: "roundRect", OVAL: "ellipse" };
function presetShape(p) {
  if (!p) return null;
  return PRESET[p.split(" (")[0]] || "rect";
}
function mapAlign(a) {
  if (!a) return null;
  const k = a.split(" (")[0];
  return { LEFT: "left", CENTER: "center", RIGHT: "right", JUSTIFY: "justify" }[k] || null;
}
function mapValign(v) {
  if (!v) return "top";
  const k = v.split(" (")[0];
  return { TOP: "top", MIDDLE: "middle", BOTTOM: "bottom" }[k] || "top";
}

// Runs enriquecidos (multi-run/paragraph) → array de pptxgenjs.
function richRuns(rt) {
  if (!rt || !rt.paragraphs) return null;
  const runs = [];
  rt.paragraphs.forEach((p) => {
    const prs = p.runs && p.runs.length ? p.runs : [{ text: "" }];
    prs.forEach((r, ri) => {
      runs.push({
        text: r.text || "",
        options: {
          fontFace: r.face || FONT,
          fontSize: r.sizePt || 14,
          bold: !!r.bold,
          italic: !!r.italic,
          color: resolveColor(r.color) || "000000",
          breakLine: ri === prs.length - 1,
        },
      });
    });
  });
  return runs.length ? runs : null;
}
function firstRun(rt) {
  const p0 = rt && rt.paragraphs && rt.paragraphs[0];
  return (p0 && p0.runs && p0.runs[0]) || {};
}

function renderShape(slide, sh, overrideText) {
  const x = sh.xIn, y = sh.yIn, w = sh.wIn, h = sh.hIn;
  if (x == null || y == null || w == null || h == null) return;

  // Imagen real (fondo full-bleed, logo, decoración).
  if (sh.image) {
    slide.addImage({ path: sh.image, x, y, w, h, rotate: sh.rotation || 0 });
    return;
  }
  // Forma con relleno/borde (rect/roundRect/ellipse con solidFill + alfa).
  const preset = presetShape(sh.preset);
  const fillColor = sh.fill && sh.fill.type === "solid" ? resolveColor(sh.fill.color) : null;
  const line = sh.line && resolveColor(sh.line.color) ? { color: resolveColor(sh.line.color), width: sh.line.widthPt || 1 } : { type: "none" };
  if (preset && (fillColor || (sh.line && sh.line.color))) {
    const opts = { x, y, w, h, line, rotate: sh.rotation || 0 };
    opts.fill = fillColor ? { color: fillColor, transparency: (sh.fill && sh.fill.transparency) || 0 } : { type: "none" };
    if (preset === "roundRect") opts.rectRadius = Math.min(0.1, h / 4);
    slide.addShape(preset, opts);
  }

  // Texto: override de la propuesta, o el del template (enriquecido).
  const hasText = (sh.text && sh.text.trim()) || overrideText != null;
  if (hasText) {
    const p0 = sh.richText && sh.richText.paragraphs && sh.richText.paragraphs[0];
    const fr = firstRun(sh.richText);
    const box = {
      x, y, w, h, margin: 0,
      align: mapAlign(p0 && p0.align) || "left",
      valign: mapValign(sh.richText && sh.richText.valign),
      rotate: sh.rotation || 0,
    };
    if (overrideText != null) {
      slide.addText(overrideText, {
        ...box,
        fontFace: fr.face || FONT,
        fontSize: fr.sizePt || 14,
        bold: !!fr.bold,
        italic: !!fr.italic,
        color: resolveColor(fr.color) || "000000",
      });
    } else {
      const runs = richRuns(sh.richText);
      slide.addText(runs || sh.text, { ...box, fontFace: fr.face || FONT, fontSize: fr.sizePt || 14, color: resolveColor(fr.color) || "000000" });
    }
  }
}

function renderContainer(slide, container, overrides) {
  container.shapes.forEach((sh, i) => {
    const ov = overrides && Object.prototype.hasOwnProperty.call(overrides, String(i)) ? overrides[String(i)] : null;
    try {
      renderShape(slide, sh, ov);
    } catch (e) {
      console.error("shape", i, "error:", e.message);
    }
  });
}

// --list: imprime los índices de forma de cada layout/slide para armar overrides.
if (process.argv.includes("--list")) {
  const dump = (arr, label) =>
    arr.forEach((c) => {
      console.log(`\n${label} ${c.index} "${c.name || c.layoutName || ""}" (bg=${c.background ? "yes" : "no"})`);
      c.shapes.forEach((sh, i) => {
        if (sh.text && sh.text.trim()) console.log(`  [${i}] ${sh.kind}  text="${sh.text.slice(0, 50).replace(/\n/g, " ")}"`);
      });
    });
  dump(spec.layouts, "LAYOUT");
  dump(spec.slides, "SLIDE");
  process.exit(0);
}

function buildDeck() {
  DECK.forEach((entry) => {
    const arr = entry.from === "slide" ? spec.slides : spec.layouts;
    const container = arr[entry.index - 1];
    if (!container) return;
    const s = pres.addSlide();
    renderContainer(s, container, entry.overrides);
  });
}

buildDeck();

if (process.env.DRY_RUN) {
  console.log("DRY_RUN · slides:", DECK.length);
} else {
  pres.writeFile({ fileName: meta.fileName }).then((f) => console.log("SAVED", f, "· slides:", DECK.length));
}
