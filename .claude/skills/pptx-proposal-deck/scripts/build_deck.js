/* =====================================================================
 * build_deck.js  —  Generador de propuestas branded desde un template
 * =====================================================================
 *
 * QUÉ ES
 *   Motor que produce una propuesta comercial branded (16:9 wide) a partir
 *   de: (a) la NARRATIVA de la propuesta de PropMaker (el ProposalBrief y/o
 *   el documento), y (b) la identidad de marca extraída del template. Salida
 *   sin números/precios por defecto (el esquema comercial se cierra después).
 *
 *   EL DECK SE ADAPTA AL CONTENIDO — no siempre son 14 slides:
 *   - Secciones OPCIONALES (`context`, `methodology`, `demo`, `security`,
 *     `scope`): pon `null` (o quítalas) y su slide NO se genera.
 *   - `useCases: [ … ]` de CUALQUIER longitud: cada caso genera una tarjeta
 *     en el overview "La solución" + un slide de detalle. N casos → N slides.
 *   - Las grids se ajustan al número de elementos (2–5 por fila van bien).
 *   El número de slide se calcula solo; el orden vive en `buildDeck()` abajo.
 *
 * DOS COSAS QUE EDITA EL AGENTE — nada más:
 *   1. BLOQUE BRAND (abajo): colores, fuente, logo y ratio del template.
 *      Guía: references/brand-extraction.md + scripts/extract_brand.sh.
 *   2. BLOQUE CONTENT (abajo): la narrativa por sección, con placeholders
 *      «...». Guía de MAPEO: references/propmaker-narrative-map.md
 *      + references/slide-catalog.md.
 *   Las FUNCIONES DE RENDER, HELPERS y el DRIVER son agnósticos y ya están
 *   QA-probados (contraste, overflow, layout). NO los toques.
 *
 *   ¿Cómo se ve todo lleno? Mira scripts/example_deck_gentera.js — ejemplo
 *   REAL y completo (cliente Gentera, 3 casos → 14 slides). Solo referencia:
 *   NO copies sus textos (la QA de tokens huérfanos los prohíbe).
 *
 * REGLAS DE ORO (ver references/design-system.md y build-guide.md)
 *   - Fuente segura en TODO (Calibri por defecto; embarca con Office).
 *   - Tarjetas translúcidas sobre fondo oscuro: transparency ALTA (~88).
 *   - Nunca barras/stripes decorativas ni subrayados bajo títulos.
 *   - Verifica que cada texto quepa en su caja (QA visual obligatorio).
 *   - No dejes ningún placeholder «...» ni token del ejemplo en la salida.
 *
 * EJECUCIÓN (desde la raíz del skill):
 *   bash scripts/setup.sh                 # una vez por entorno (deps)
 *   node scripts/build_deck.js
 *   DRY_RUN=1 node scripts/build_deck.js  # imprime nº de slides sin escribir
 *   python /mnt/skills/public/pptx/scripts/rezip.py <fileName>.pptx
 *   # luego QA visual + grep de tokens huérfanos (ver SKILL.md)
 * ===================================================================== */

const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
const PW = 13.333, PH = 7.5;

// === RUTAS DE ASSETS (relativas a la raíz del skill) ===================
const ASSETS = "assets";
const ICONS  = ASSETS + "/icons";

// ================ CONFIGURA LA MARCA AQUÍ ============================
// Rellena BRAND con lo que extraigas del template (extract_brand.sh +
// references/brand-extraction.md). Valores de abajo = EJEMPLO neutro.
const BRAND = {
  primary:   "1E3A5F",  // color DOMINANTE: fondos oscuros, títulos sobre claro
  primaryDk: "2A4A73",  // variante oscura para el degradado del fondo
  secondary: "3B6EA5",  // acento frío secundario (sub-encabezados)
  accent:    "E8552D",  // ACENTO de marca: círculos de icono, checks, kickers
  accentLt:  "F5936F",  // acento claro: números/kickers grandes sobre fondo oscuro
  ink:       "1A2333",  // texto de cuerpo sobre claro
  gray:      "5B6472",  // texto secundario / captions
  light:     "F4F6FA",  // fondo de slides de contenido
  card:      "FFFFFF",  // tarjetas sobre claro
  cardTint:  "EEF2F9",  // tarjeta "estado actual / hoy"
  font:      "Calibri", // fuente segura (embarca con Office)
  fontLight: "Calibri Light",
  logo:      ASSETS+"/logo.png",   // logo recortado del template
  logoRatio: 2.1554,               // ancho/alto del logo — MÍDELO del template real
  bgDark:    ASSETS+"/bg_dark.png",// fondo degradado (genera con gen_background.py)
};
// --- mapeo interno a los nombres que usa el render (NO TOCAR) ---
const NAVY=BRAND.primary, NAVY2=BRAND.primaryDk, BLUE=BRAND.secondary,
      LIME=BRAND.accent,  LIME2=BRAND.accentLt,   INK=BRAND.ink,
      GRAY=BRAND.gray,    LIGHT=BRAND.light,       CARD=BRAND.card, CARDT=BRAND.cardTint;
const F=BRAND.font, FL=BRAND.fontLight;
const LOGO=BRAND.logo, LOGO_RATIO=BRAND.logoRatio, BG_NAVY=BRAND.bgDark;

// ================ CONFIGURA EL CONTENIDO AQUÍ =======================
// La narrativa por sección, con placeholders «...». Mapa de qué va en cada
// campo desde el ProposalBrief/documento: references/propmaker-narrative-map.md.
// - Secciones OPCIONALES → `null` omite su slide.
// - `useCases` de cualquier longitud → tantos slides de caso como haya.
// - Iconos (ic_*.png) y colores (NAVY/LIME/…) son de diseño; cámbialos solo
//   si el significado lo pide. NO inventes datos ni precios.
// - Ejemplo lleno: scripts/example_deck_gentera.js
const CONTENT = {
  meta: {
    author:   "«Proveedor»",
    company:  "«Proveedor»",
    title:    "«Título de la propuesta»",
    fileName: "Propuesta_«Cliente».pptx",
  },

  // PORTADA (fondo oscuro) — un pilar por eje/caso: [icono, etiqueta 2 líneas]
  cover: {
    kicker:   "«KICKER DE PORTADA — p.ej. PROPUESTA DE SOLUCIÓN CON IA»",
    title:    "«Título grande de portada (tema central)»",
    subtitle: "«Subtítulo: líneas de solución + nombre del cliente y área»",
    pillars: [
      ["ic_filter.png",   "«Pilar 1»"],
      ["ic_chartbar.png", "«Pilar 2»"],
      ["ic_grad.png",     "«Pilar 3»"],
    ],
    footer:   "Documento preparado por «Proveedor»  ·  «Mes Año»  ·  Confidencial",
  },

  // CONTEXTO Y RETOS (claro) — OPCIONAL: pon `null` para omitir el slide.
  context: {
    kicker: "«Punto de partida»",
    title:  "«Contexto y retos de <área del cliente>»",
    intro:  "«Intro 1–2 líneas sobre la situación del área.»",
    // tarjetas de contexto/dolor: [icono, colorCírculo, título, descripción corta]
    cards: [
      ["ic_team.png",  NAVY, "«Reto 1»", "«Descripción corta (2–3 líneas).»"],
      ["ic_alert.png", NAVY, "«Reto 2»", "«Descripción corta (2–3 líneas).»"],
      ["ic_clock.png", NAVY, "«Reto 3»", "«Descripción corta (2–3 líneas).»"],
    ],
    bandTitle: "«Dolencias que concentran el problema»",
    // dolencias destacadas (banda oscura): [icono, título, descripción]
    pains: [
      ["ic_question.png", "«Dolencia 1»", "«Descripción de la dolencia (2–3 líneas).»"],
      ["ic_report.png",   "«Dolencia 2»", "«Descripción de la dolencia (2–3 líneas).»"],
    ],
  },

  // NECESIDADES DEL CLIENTE (claro) ← ancla del alcance
  needs: {
    kicker: "«Lo que nos pide <Cliente>»",
    title:  "«Necesidades finales del cliente»",
    intro:  "«Estas son las necesidades definidas por <Cliente>. Cada una se atiende con una línea de solución.»",
    // una tarjeta por necesidad: [icono, etiqueta, enunciado del cliente, "Solución: …", [bullet1, bullet2]]
    items: [
      ["ic_chartbar.png", "«Necesidad 1»", "«Enunciado del cliente, citado»",
        "Solución: «línea del proveedor»", ["«Bullet 1»", "«Bullet 2»"]],
      ["ic_route.png",    "«Necesidad 2»", "«Enunciado del cliente, citado»",
        "Solución: «línea del proveedor»", ["«Bullet 1»", "«Bullet 2»"]],
      ["ic_grad.png",     "«Necesidad 3»", "«Enunciado del cliente, citado»",
        "Solución: «línea del proveedor»", ["«Bullet 1»", "«Bullet 2»"]],
    ],
    footnote: "Fuente: necesidades definidas por el cliente («Cliente»).",
  },

  // QUIÉNES SOMOS / LA PROPUESTA (claro)
  provider: {
    kicker: "«Quiénes somos»",
    title:  "«<Proveedor>: <promesa de valor>»",
    intro:  "«Qué hace el proveedor y sobre qué construye (a la medida, confidencialidad).»",
    // verticales/capacidades (se apilan): [icono, título, descripción]
    verticals: [
      ["ic_chat.png",  "«Capacidad 1»", "«Descripción (1–2 líneas).»"],
      ["ic_robot.png", "«Capacidad 2»", "«Descripción (1–2 líneas).»"],
    ],
    panelTitle: "«Sobre qué construimos»",
    // features de infra/confianza (se apilan): [icono, texto]
    features: [
      ["ic_server.png", "«Infraestructura / nube.»"],
      ["ic_cogs.png",   "«Enfoque a la medida.»"],
      ["ic_lock.png",   "«Confidencialidad / NDA.»"],
    ],
    dividerLabel: "«EXPERIENCIA EN <SECTOR>»",
    clients:      "«Cliente A · Cliente B · Cliente C»",
  },

  // METODOLOGÍA (claro) — OPCIONAL: `null` para omitir.
  methodology: {
    kicker: "«Cómo trabajamos»",
    title:  "«Un modelo a la medida, probado antes de lanzar»",
    timelineTitle: "«De la definición al lanzamiento»",
    // pasos del timeline: [icono, título, descripción]
    steps: [
      ["ic_sitemap.png",   "«Paso 1»", "«Descripción corta.»"],
      ["ic_cogs.png",      "«Paso 2»", "«Descripción corta.»"],
      ["ic_clipboard.png", "«Paso 3»", "«Descripción corta.»"],
      ["ic_target.png",    "«Paso 4»", "«Descripción corta.»"],
    ],
    modelTitle: "«Modelo / metodología distintiva»",
    modelDesc:  "«Descripción del modelo (1–2 líneas).»",
    // banda con proporciones/fases (≈3): [número, etiqueta, color]
    model: [
      ["«70%»", "«Etiqueta»", LIME],
      ["«20%»", "«Etiqueta»", LIME2],
      ["«10%»", "«Etiqueta»", "5B9BD5"],
    ],
  },

  // LA SOLUCIÓN — overview (fondo oscuro). Las tarjetas salen de `useCases`.
  solution: {
    kicker: "LA SOLUCIÓN",
    title:  "«N casos de uso para <Cliente>»",
    intro:  "«Cada necesidad del cliente se traduce en una línea de solución concreta.»",
  },

  // CASOS DE USO — N de cualquier longitud. Cada caso = 1 tarjeta en el overview
  // + 1 slide de detalle. `pattern`: 'flow' | 'beforeAfter' | 'features'.
  //   overview (todas): num, icon, needRef, title, overviewText
  useCases: [
    {
      num: "01", icon: "ic_filter.png", needRef: "«Necesidad X»",
      title: "«Título del caso 1»",
      overviewText: "«Párrafo del caso 1 (overview).»",
      pattern: "flow",
      flowTitle: "«Cómo funciona»",
      // pasos del flujo (conectados): [icono, título, descripción]
      flow: [
        ["ic_chat.png",      "«Paso 1»", "«Descripción.»"],
        ["ic_question.png",  "«Paso 2»", "«Descripción.»"],
        ["ic_route.png",     "«Paso 3»", "«Descripción.»"],
        ["ic_handshake.png", "«Paso 4»", "«Descripción.»"],
      ],
      statTitle:   "«Titular del dato destacado»",
      statNumber:  "«+00%»",
      statCaption: "«Contexto del dato (una frase).»",
      benefitsTitle: "«Qué resuelve para <Cliente>»",
      ben: ["«Beneficio 1.»", "«Beneficio 2.»", "«Beneficio 3.»", "«Beneficio 4.»"],
    },
    {
      num: "02", icon: "ic_chartbar.png", needRef: "«Necesidad X»",
      title: "«Título del caso 2»",
      overviewText: "«Párrafo del caso 2 (overview).»",
      pattern: "beforeAfter",
      sectionTitle: "«Del <estado actual> al <estado deseado>»",
      beforeLabel: "HOY",
      beforeStat:  "«Estado actual (dato)»",
      beforeDesc:  "«Descripción del estado actual.»",
      afterLabel:  "CON «PROVEEDOR»",
      afterStat:   "«Estado deseado (dato)»",
      afterDesc:   "«Descripción del estado deseado.»",
      dimsTitle: "«Dimensiones disponibles»",
      // capacidades/dimensiones: [icono, título, descripción]
      dims: [
        ["ic_route.png",   "«Dimensión 1»", "«Descripción.»"],
        ["ic_layers.png",  "«Dimensión 2»", "«Descripción.»"],
        ["ic_clock.png",   "«Dimensión 3»", "«Descripción.»"],
        ["ic_sitemap.png", "«Dimensión 4»", "«Descripción.»"],
      ],
    },
    {
      num: "03", icon: "ic_grad.png", needRef: "«Necesidad X»",
      title: "«Título del caso 3»",
      overviewText: "«Párrafo del caso 3 (overview).»",
      pattern: "features",
      intro: "«Intro del caso 3 (2 líneas).»",
      // features (se apilan): [icono, título, descripción]
      feats: [
        ["ic_brain.png",     "«Feature 1»", "«Descripción.»"],
        ["ic_layers.png",    "«Feature 2»", "«Descripción.»"],
        ["ic_clipboard.png", "«Feature 3»", "«Descripción.»"],
      ],
      panelTitle: "«Pensado para escalar»",
      scaleNum1:   "«00,000»",
      scaleLabel1: "«qué representa la cifra 1»",
      scaleNum2:   "«hasta 000,000»",
      scaleLabel2: "«qué representa la cifra 2»",
      scaleNote:   "«Frase de reemplazo del modelo actual.»",
    },
  ],

  // CÓMO SE VE EN LA PRÁCTICA / DEMO (claro) — OPCIONAL: `null` para omitir.
  demo: {
    kicker: "«Cómo se ve en la práctica»",
    title:  "«Título de la demo»",
    intro:  "«Narra la demo (2 líneas). Si no hubo demo, describe cómo funciona.»",
    compsTitle: "«Criterios / competencias evaluadas»",
    comps: ["«Criterio 1»", "«Criterio 2»", "«Criterio 3»", "«Criterio 4»"],
    reporteTitle: "«Reporte / entregable individual»",
    reporteDesc:  "«Qué incluye el entregable individual.»",
    metricsTitle: "«Métricas grupales»",
    metricsDesc:  "«Qué ve el área a nivel grupo/población.»",
    statPre:     "«hasta »",
    statNum:     "«00%»",
    statCaption: "«Qué mide el resultado.»",
  },

  // SEGURIDAD, INFRAESTRUCTURA Y GOBIERNO (fondo oscuro) — OPCIONAL: `null`.
  security: {
    kicker: "«CONFIANZA Y CUMPLIMIENTO»",
    title:  "«Seguridad, infraestructura y gobierno»",
    intro:  "«Marco regulatorio/estándar aplicable al cliente (1–2 líneas).»",
    // tarjetas de seguridad/infra: [icono, título, descripción]
    cards: [
      ["ic_server.png", "«Entorno»",           "«Descripción.»"],
      ["ic_shield.png", "«Nube / compliance»", "«Descripción.»"],
      ["ic_cert.png",   "«Certificaciones»",   "«Descripción.»"],
      ["ic_lock.png",   "«Confidencialidad»",  "«Descripción.»"],
    ],
    govTitle: "«Puntos de gobierno a definir con <área técnica del cliente>»",
    gov: ["«Punto de gobierno 1.»", "«Punto de gobierno 2.»", "«Punto de gobierno 3.»"],
    pluginTitle: "«Complementar o integrar»",
    pluginDesc:  "«Cómo encaja con las capacidades internas del cliente.»",
  },

  // ALCANCE Y ACLARACIONES (claro) · grid 2 columnas — OPCIONAL: `null`.
  scope: {
    kicker: "«Para tener claro»",
    title:  "«Alcance de la solución»",
    // límites/condiciones: [icono, título, descripción]
    items: [
      ["ic_layers.png",     "«Aclaración 1»", "«Descripción.»"],
      ["ic_cogs.png",       "«Aclaración 2»", "«Descripción.»"],
      ["ic_clipboard.png",  "«Aclaración 3»", "«Descripción.»"],
      ["ic_server.png",     "«Aclaración 4»", "«Descripción.»"],
      ["ic_plug.png",       "«Aclaración 5»", "«Descripción.»"],
      ["ic_usershield.png", "«Aclaración 6»", "«Descripción.»"],
    ],
  },

  // PRÓXIMOS PASOS (claro)
  nextSteps: {
    kicker: "«Hacia adelante»",
    title:  "«Próximos pasos»",
    sessionLabel: "«Próxima sesión / hito»",
    sessionDate:  "«Día DD de mes»",
    sessionTime:  "«HH:MM»",
    responsableRole: "«Responsable de <Cliente>»",
    responsableName: "«Nombre del responsable»",
    responsableDesc: "«Rol y nota (p.ej. se incluye en la invitación).»",
    stepsTitle: "«Acuerdos y siguientes acciones»",
    // acuerdos numerados: [título, descripción]
    steps: [
      ["«Acuerdo 1»", "«Detalle del acuerdo.»"],
      ["«Acuerdo 2»", "«Detalle del acuerdo.»"],
      ["«Acuerdo 3»", "«Detalle del acuerdo.»"],
      ["Definir el esquema comercial", "«Se trabaja en la fase técnica (por usuario, por consulta u otro modelo).»"],
    ],
  },

  // CIERRE (fondo oscuro)
  close: {
    value:  "«Frase de valor que sintetiza la solución (1–2 líneas).»",
    thanks: "Gracias, «Cliente».",
    footer: "«Proveedor»  ·  Propuesta confidencial  ·  «Mes Año»",
  },
};

pres.author  = CONTENT.meta.author;
pres.company = CONTENT.meta.company;
pres.title   = CONTENT.meta.title;

// =====================================================================
// HELPERS (agnósticos — NO TOCAR)
// =====================================================================
const pad = (i) => String(i).padStart(2, "0");

// Contador global de slide (para la numeración discreta). Se incrementa en
// CADA slide, así el número refleja la posición real aunque el deck se adapte.
let SLIDE_NO = 0;
function newSlide(){ SLIDE_NO++; return pres.addSlide(); }

// Ajusta una fila de N columnas conservando la geometría canónica: en n===nCanon
// reproduce (wCanon, gapCanon) exactos; para otro n reparte el mismo ancho total.
function fitCols(n, x0, wCanon, gapCanon, nCanon){
  const span = nCanon*wCanon + (nCanon-1)*gapCanon;
  const gap = gapCanon;
  const w = (span - (n-1)*gap) / n;
  const xs = [];
  for(let i=0;i<n;i++) xs.push(x0 + i*(w+gap));
  return { w, gap, xs };
}

function shadow(){ return { type:"outer", color:"1A2333", blur:10, offset:3, angle:90, opacity:0.14 }; }
function shadowSoft(){ return { type:"outer", color:"1A2333", blur:8, offset:2, angle:90, opacity:0.10 }; }

function logoLight(slide, x, y, h){ slide.addImage({ path: LOGO, x, y, h, w: h*LOGO_RATIO }); }

// Encabezado estándar para slides de contenido (claro). Usa SLIDE_NO.
function contentHeader(slide, kicker, title){
  slide.addText(kicker.toUpperCase(), { x:0.7, y:0.42, w:9.5, h:0.32, fontFace:F, fontSize:12.5, bold:true, color:LIME, charSpacing:2, margin:0 });
  slide.addText(title, { x:0.7, y:0.72, w:10.6, h:0.75, fontFace:F, fontSize:27, bold:true, color:NAVY, margin:0 });
  logoLight(slide, PW-2.35, 0.42, 0.42);
  slide.addText(pad(SLIDE_NO), { x:PW-0.95, y:PH-0.55, w:0.6, h:0.3, fontFace:F, fontSize:10, color:GRAY, align:"right", margin:0 });
}

// Encabezado para slides oscuros (kicker + título blanco + logo). No numera.
function darkHeader(slide, kicker, title){
  slide.addText(kicker.toUpperCase(), { x:0.7, y:0.5, w:9, h:0.32, fontFace:F, fontSize:12.5, bold:true, color:LIME2, charSpacing:2, margin:0 });
  slide.addText(title, { x:0.7, y:0.82, w:11, h:0.7, fontFace:F, fontSize:28, bold:true, color:"FFFFFF", margin:0 });
  slide.addImage({ path: LOGO, x:PW-2.35, y:0.5, h:0.42, w:0.42*LOGO_RATIO });
}

function iconCircle(slide, x, y, d, fill, icon, iconScale=0.52){
  slide.addShape(pres.shapes.OVAL, { x, y, w:d, h:d, fill:{color:fill}, line:{type:"none"}, shadow:shadowSoft() });
  const id = d*iconScale;
  slide.addImage({ path:icon, x:x+(d-id)/2, y:y+(d-id)/2, w:id, h:id });
}

function card(slide, x, y, w, h, fill=CARD, rad=0.12){
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius:rad, fill:{color:fill}, line:{type:"none"}, shadow:shadow() });
}

// =====================================================================
// RENDERERS DE SLIDE (uno por tipo — NO TOCAR)
// =====================================================================

function renderCover(d){
  const s = newSlide();
  s.background = { path: BG_NAVY };
  s.addImage({ path: LOGO, x:0.9, y:0.85, h:0.95, w:0.95*LOGO_RATIO });
  s.addText(d.kicker, { x:0.95, y:2.75, w:11, h:0.4, fontFace:F, fontSize:13.5, bold:true, color:LIME2, charSpacing:2.5, margin:0 });
  s.addText(d.title, { x:0.9, y:3.15, w:11.4, h:1.0, fontFace:F, fontSize:46, bold:true, color:"FFFFFF", margin:0 });
  s.addText(d.subtitle, { x:0.95, y:4.25, w:10.6, h:0.9, fontFace:F, fontSize:17, color:"C9D6EC", lineSpacingMultiple:1.15, margin:0 });
  const n = d.pillars.length;
  const step = n<=3 ? 3.75 : (11.4/n);      // ≤3 conserva el espaciado canónico
  let px = 0.95;
  d.pillars.forEach((p)=>{
    s.addShape(pres.shapes.OVAL, { x:px, y:5.75, w:0.62, h:0.62, fill:{color:"FFFFFF",transparency:88}, line:{color:LIME2,width:1} });
    s.addImage({ path:ICONS+"/"+p[0], x:px+0.17, y:5.92, w:0.28, h:0.28 });
    s.addText(p[1], { x:px+0.75, y:5.72, w:Math.min(2.9, step-0.85), h:0.7, fontFace:F, fontSize:11.5, color:"E6EEF9", bold:true, valign:"middle", lineSpacingMultiple:0.95, margin:0 });
    px += step;
  });
  s.addText(d.footer, { x:0.95, y:6.95, w:11.4, h:0.3, fontFace:F, fontSize:10.5, color:"8FA6C9", margin:0 });
}

function renderContext(d){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, d.kicker, d.title);
  s.addText(d.intro, { x:0.7, y:1.6, w:12, h:0.6, fontFace:F, fontSize:13.5, color:GRAY, lineSpacingMultiple:1.1, margin:0 });
  const g = fitCols(d.cards.length, 0.7, 3.94, 0.24, 3);
  d.cards.forEach((c,i)=>{
    const x = g.xs[i], w = g.w;
    card(s, x, 2.35, w, 1.75, CARD);
    iconCircle(s, x+0.3, 2.6, 0.72, c[1], ICONS+"/"+c[0], 0.5);
    s.addText(c[2], { x:x+0.3, y:3.4, w:w-0.6, h:0.3, fontFace:F, fontSize:14, bold:true, color:NAVY, margin:0 });
    s.addText(c[3], { x:x+0.3, y:3.68, w:w-0.55, h:0.42, fontFace:F, fontSize:10.7, color:GRAY, lineSpacingMultiple:1.0, margin:0 });
  });
  s.addText(d.bandTitle, { x:0.7, y:4.4, w:12, h:0.35, fontFace:F, fontSize:15, bold:true, color:NAVY, margin:0 });
  const dg = fitCols(d.pains.length, 0.7, 6.06, 0.35, 2);
  d.pains.forEach((p,i)=>{
    const dx = dg.xs[i], dw = dg.w;
    card(s, dx, 4.85, dw, 1.75, NAVY);
    iconCircle(s, dx+0.35, 5.15, 0.78, LIME, ICONS+"/"+p[0], 0.5);
    s.addText(p[1], { x:dx+1.35, y:5.18, w:dw-1.6, h:0.5, fontFace:F, fontSize:15.5, bold:true, color:"FFFFFF", valign:"middle", margin:0 });
    s.addText(p[2], { x:dx+0.35, y:5.95, w:dw-0.7, h:0.55, fontFace:F, fontSize:11.5, color:"C9D6EC", lineSpacingMultiple:1.05, margin:0 });
  });
}

function renderNeeds(d){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, d.kicker, d.title);
  s.addText(d.intro, { x:0.7, y:1.6, w:12, h:0.4, fontFace:F, fontSize:13.5, color:GRAY, margin:0 });
  const g = fitCols(d.items.length, 0.7, 3.94, 0.235, 3);
  d.items.forEach((n,i)=>{
    const x = g.xs[i], w = g.w;
    card(s, x, 2.15, w, 4.55, CARD);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:2.15, w, h:1.15, rectRadius:0.12, fill:{color:NAVY}, line:{type:"none"} });
    s.addShape(pres.shapes.RECTANGLE, { x, y:2.75, w, h:0.55, fill:{color:NAVY}, line:{type:"none"} });
    iconCircle(s, x+0.32, 2.42, 0.62, LIME, ICONS+"/"+n[0], 0.5);
    s.addText(n[1].toUpperCase(), { x:x+1.1, y:2.44, w:w-1.3, h:0.3, fontFace:F, fontSize:12.5, bold:true, color:LIME2, charSpacing:1, margin:0 });
    s.addText(n[2], { x:x+1.1, y:2.72, w:w-1.3, h:0.5, fontFace:F, fontSize:11.5, bold:true, color:"FFFFFF", lineSpacingMultiple:0.95, margin:0, valign:"top" });
    s.addText(n[3], { x:x+0.32, y:3.55, w:w-0.64, h:0.35, fontFace:F, fontSize:15, bold:true, color:BLUE, margin:0 });
    const bullets = n[4].map((t)=>({ text:t, options:{ bullet:{code:"2022", indent:14}, color:INK, fontSize:12, breakLine:true, paraSpaceAfter:8 } }));
    s.addText(bullets, { x:x+0.34, y:4.0, w:w-0.6, h:1.5, fontFace:F, valign:"top", margin:0 });
  });
  s.addText(d.footnote, { x:0.7, y:6.85, w:8, h:0.3, fontFace:F, fontSize:9.5, italic:true, color:GRAY, margin:0 });
}

function renderProvider(d){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, d.kicker, d.title);
  s.addText(d.intro, { x:0.7, y:1.6, w:7.3, h:0.9, fontFace:F, fontSize:13.5, color:GRAY, lineSpacingMultiple:1.15, margin:0 });
  let y=2.7;
  d.verticals.forEach(v=>{
    card(s, 0.7, y, 7.3, 1.35, CARD);
    iconCircle(s, 0.95, y+0.3, 0.75, NAVY, ICONS+"/"+v[0], 0.5);
    s.addText(v[1], { x:1.95, y:y+0.22, w:5.9, h:0.4, fontFace:F, fontSize:14.5, bold:true, color:NAVY, margin:0 });
    s.addText(v[2], { x:1.95, y:y+0.62, w:5.9, h:0.55, fontFace:F, fontSize:11.5, color:GRAY, lineSpacingMultiple:1.05, margin:0 });
    y += 1.55;
  });
  card(s, 8.3, 1.6, 4.33, 5.1, NAVY);
  s.addText(d.panelTitle, { x:8.6, y:1.85, w:3.8, h:0.35, fontFace:F, fontSize:14, bold:true, color:LIME2, margin:0 });
  let fy=2.35;
  d.features.forEach(f=>{
    s.addImage({ path:ICONS+"/"+f[0], x:8.62, y:fy+0.03, w:0.32, h:0.32 });
    s.addText(f[1], { x:9.08, y:fy-0.05, w:3.45, h:0.65, fontFace:F, fontSize:11.5, color:"E6EEF9", lineSpacingMultiple:1.05, valign:"top", margin:0 });
    fy += 0.85;
  });
  s.addShape(pres.shapes.LINE, { x:8.62, y:5.05, w:3.75, h:0, line:{color:"FFFFFF",width:0.75,transparency:70} });
  s.addText(d.dividerLabel, { x:8.62, y:5.2, w:3.8, h:0.28, fontFace:F, fontSize:11, bold:true, color:LIME2, charSpacing:1.5, margin:0 });
  s.addText(d.clients, { x:8.62, y:5.5, w:3.8, h:1.0, fontFace:F, fontSize:13.5, bold:true, color:"FFFFFF", lineSpacingMultiple:1.2, valign:"top", margin:0 });
}

function renderMethodology(d){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, d.kicker, d.title);
  s.addText(d.timelineTitle, { x:0.7, y:1.6, w:12, h:0.35, fontFace:F, fontSize:15, bold:true, color:NAVY, margin:0 });
  const g = fitCols(d.steps.length, 0.7, 2.94, 0.13, 4);
  d.steps.forEach((st,i)=>{
    const x = g.xs[i], w = g.w;
    card(s, x, 2.05, w, 2.15, CARD);
    iconCircle(s, x+0.28, 2.3, 0.7, NAVY, ICONS+"/"+st[0], 0.5);
    s.addText("PASO "+(i+1), { x:x+1.1, y:2.4, w:w-1.2, h:0.28, fontFace:F, fontSize:10.5, bold:true, color:LIME, charSpacing:1, margin:0 });
    s.addText(st[1], { x:x+0.28, y:3.12, w:w-0.5, h:0.55, fontFace:F, fontSize:13.5, bold:true, color:NAVY, lineSpacingMultiple:0.95, margin:0 });
    s.addText(st[2], { x:x+0.28, y:3.62, w:w-0.5, h:0.55, fontFace:F, fontSize:10.5, color:GRAY, lineSpacingMultiple:1.0, margin:0 });
    if(i<d.steps.length-1){ s.addImage({ path:ICONS+"/ic_arrow.png", x:x+w+g.gap/2-0.09, y:3.0, w:0.2, h:0.2 }); }
  });
  card(s, 0.7, 4.5, 11.93, 2.15, NAVY);
  s.addText(d.modelTitle, { x:1.0, y:4.72, w:6, h:0.4, fontFace:F, fontSize:16, bold:true, color:"FFFFFF", margin:0 });
  s.addText(d.modelDesc, { x:1.0, y:5.12, w:5.4, h:0.9, fontFace:F, fontSize:12, color:"C9D6EC", lineSpacingMultiple:1.1, valign:"top", margin:0 });
  let mx=6.7; const mw=1.9;
  d.model.forEach(m=>{
    s.addText(m[0], { x:mx, y:4.78, w:mw, h:0.7, fontFace:F, fontSize:38, bold:true, color:m[2], align:"center", margin:0 });
    s.addText(m[1], { x:mx, y:5.55, w:mw, h:0.7, fontFace:F, fontSize:11.5, color:"E6EEF9", align:"center", lineSpacingMultiple:1.0, valign:"top", margin:0 });
    mx += mw;
  });
}

function renderSolutionOverview(sol, useCases){
  const s = newSlide();
  s.background = { path: BG_NAVY };
  darkHeader(s, sol.kicker, sol.title);
  s.addText(sol.intro, { x:0.7, y:1.6, w:11.5, h:0.4, fontFace:F, fontSize:13.5, color:"C9D6EC", margin:0 });
  const g = fitCols(useCases.length, 0.7, 3.94, 0.235, 3);
  useCases.forEach((uc,i)=>{
    const x = g.xs[i], w = g.w;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:2.25, w, h:4.35, rectRadius:0.12, fill:{color:"FFFFFF",transparency:88}, line:{color:"FFFFFF",width:0.75,transparency:70} });
    s.addText(uc.num || pad(i+1), { x:x+0.3, y:2.45, w:2, h:0.85, fontFace:F, fontSize:46, bold:true, color:LIME2, margin:0 });
    iconCircle(s, x+w-1.15, 2.55, 0.82, LIME, ICONS+"/"+uc.icon, 0.5);
    s.addText((uc.needRef||"").toUpperCase(), { x:x+0.32, y:3.5, w:w-0.6, h:0.28, fontFace:F, fontSize:11, bold:true, color:LIME2, charSpacing:1, margin:0 });
    s.addText(uc.title, { x:x+0.32, y:3.8, w:w-0.6, h:1.0, fontFace:F, fontSize:16, bold:true, color:"FFFFFF", lineSpacingMultiple:1.0, valign:"top", margin:0 });
    s.addText(uc.overviewText, { x:x+0.32, y:4.95, w:w-0.6, h:1.5, fontFace:F, fontSize:12, color:"D4DFF0", lineSpacingMultiple:1.15, valign:"top", margin:0 });
  });
}

function renderUseCase(uc, idx){
  const kicker = "Caso de uso "+(uc.num||pad(idx+1))+" · "+(uc.needRef||"");
  if(uc.pattern === "beforeAfter") return renderUCBeforeAfter(uc, kicker);
  if(uc.pattern === "features")    return renderUCFeatures(uc, kicker);
  return renderUCFlow(uc, kicker); // 'flow' por defecto
}

function renderUCFlow(uc, kicker){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, kicker, uc.title);
  s.addText(uc.flowTitle, { x:0.7, y:1.62, w:6, h:0.32, fontFace:F, fontSize:14, bold:true, color:NAVY, margin:0 });
  let y=2.05;
  uc.flow.forEach((f,i)=>{
    iconCircle(s, 0.7, y, 0.62, NAVY, ICONS+"/"+f[0], 0.5);
    s.addText(f[1], { x:1.5, y:y-0.02, w:5.6, h:0.35, fontFace:F, fontSize:13.5, bold:true, color:NAVY, margin:0, valign:"top" });
    s.addText(f[2], { x:1.5, y:y+0.3, w:5.6, h:0.4, fontFace:F, fontSize:11, color:GRAY, lineSpacingMultiple:1.0, margin:0, valign:"top" });
    if(i<uc.flow.length-1){ s.addShape(pres.shapes.LINE, { x:1.01, y:y+0.62, w:0, h:0.5, line:{color:LIME,width:1.5} }); }
    y += 1.12;
  });
  card(s, 7.35, 1.95, 5.28, 2.05, NAVY);
  s.addText(uc.statTitle, { x:7.65, y:2.2, w:4.7, h:0.4, fontFace:F, fontSize:15, bold:true, color:"FFFFFF", margin:0 });
  s.addText([{ text:uc.statNumber, options:{ fontSize:40, bold:true, color:LIME2 } }], { x:7.65, y:2.65, w:2.2, h:0.85, fontFace:F, valign:"middle", margin:0 });
  s.addText(uc.statCaption, { x:9.75, y:2.7, w:2.7, h:1.1, fontFace:F, fontSize:11, color:"C9D6EC", lineSpacingMultiple:1.1, valign:"middle", margin:0 });
  s.addText(uc.benefitsTitle, { x:7.35, y:4.25, w:5.3, h:0.32, fontFace:F, fontSize:14, bold:true, color:NAVY, margin:0 });
  card(s, 7.35, 4.6, 5.28, 2.0, CARD);
  let by=4.78;
  uc.ben.forEach(t=>{
    s.addImage({ path:ICONS+"/ic_check.png", x:7.6, y:by+0.02, w:0.24, h:0.24 });
    s.addText(t, { x:7.95, y:by-0.04, w:4.5, h:0.45, fontFace:F, fontSize:11.3, color:INK, lineSpacingMultiple:1.0, valign:"top", margin:0 });
    by += 0.47;
  });
}

function renderUCBeforeAfter(uc, kicker){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, kicker, uc.title);
  s.addText(uc.sectionTitle, { x:0.7, y:1.6, w:12, h:0.35, fontFace:F, fontSize:15, bold:true, color:NAVY, margin:0 });
  card(s, 0.7, 2.05, 5.85, 2.0, CARDT);
  s.addText(uc.beforeLabel, { x:1.0, y:2.25, w:2, h:0.3, fontFace:F, fontSize:12, bold:true, color:GRAY, charSpacing:2, margin:0 });
  s.addText(uc.beforeStat, { x:1.0, y:2.5, w:5.2, h:0.45, fontFace:F, fontSize:19, bold:true, color:NAVY, margin:0 });
  s.addText(uc.beforeDesc, { x:1.0, y:3.02, w:5.25, h:0.9, fontFace:F, fontSize:12, color:GRAY, lineSpacingMultiple:1.1, valign:"top", margin:0 });
  card(s, 6.78, 2.05, 5.85, 2.0, NAVY);
  s.addText(uc.afterLabel, { x:7.08, y:2.25, w:3, h:0.3, fontFace:F, fontSize:12, bold:true, color:LIME2, charSpacing:2, margin:0 });
  s.addText(uc.afterStat, { x:7.08, y:2.5, w:5.2, h:0.45, fontFace:F, fontSize:19, bold:true, color:"FFFFFF", margin:0 });
  s.addText(uc.afterDesc, { x:7.08, y:3.02, w:5.25, h:0.9, fontFace:F, fontSize:12, color:"C9D6EC", lineSpacingMultiple:1.1, valign:"top", margin:0 });
  s.addText(uc.dimsTitle, { x:0.7, y:4.35, w:12, h:0.32, fontFace:F, fontSize:14, bold:true, color:NAVY, margin:0 });
  const g = fitCols(uc.dims.length, 0.7, 2.94, 0.13, 4);
  uc.dims.forEach((dm,i)=>{
    const x = g.xs[i], w = g.w;
    card(s, x, 4.75, w, 1.85, CARD);
    iconCircle(s, x+0.28, 5.0, 0.68, LIME, ICONS+"/"+dm[0], 0.5);
    s.addText(dm[1], { x:x+0.28, y:5.8, w:w-0.5, h:0.3, fontFace:F, fontSize:14, bold:true, color:NAVY, margin:0 });
    s.addText(dm[2], { x:x+0.28, y:6.1, w:w-0.45, h:0.45, fontFace:F, fontSize:10.7, color:GRAY, lineSpacingMultiple:1.0, valign:"top", margin:0 });
  });
}

function renderUCFeatures(uc, kicker){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, kicker, uc.title);
  s.addText(uc.intro, { x:0.7, y:1.6, w:7.4, h:0.85, fontFace:F, fontSize:13.5, color:GRAY, lineSpacingMultiple:1.15, margin:0 });
  let y=2.6;
  uc.feats.forEach(f=>{
    card(s, 0.7, y, 7.4, 1.15, CARD);
    iconCircle(s, 0.95, y+0.22, 0.72, NAVY, ICONS+"/"+f[0], 0.5);
    s.addText(f[1], { x:1.9, y:y+0.2, w:6.0, h:0.35, fontFace:F, fontSize:14, bold:true, color:NAVY, margin:0 });
    s.addText(f[2], { x:1.9, y:y+0.56, w:6.0, h:0.45, fontFace:F, fontSize:11.3, color:GRAY, lineSpacingMultiple:1.0, valign:"top", margin:0 });
    y += 1.3;
  });
  card(s, 8.4, 1.6, 4.23, 5.05, NAVY);
  s.addImage({ path:ICONS+"/ic_layers.png", x:8.7, y:1.9, w:0.5, h:0.5 });
  s.addText(uc.panelTitle, { x:8.7, y:2.5, w:3.7, h:0.4, fontFace:F, fontSize:16, bold:true, color:"FFFFFF", margin:0 });
  s.addText([
    { text:uc.scaleNum1, options:{ fontSize:34, bold:true, color:LIME2, breakLine:true } },
    { text:uc.scaleLabel1, options:{ fontSize:12, color:"C9D6EC", breakLine:true } },
  ], { x:8.7, y:3.0, w:3.7, h:1.0, fontFace:F, valign:"top", margin:0 });
  s.addShape(pres.shapes.LINE, { x:8.7, y:4.2, w:3.6, h:0, line:{color:"FFFFFF",width:0.75,transparency:70} });
  s.addText([
    { text:uc.scaleNum2, options:{ fontSize:30, bold:true, color:"FFFFFF", breakLine:true } },
    { text:uc.scaleLabel2, options:{ fontSize:12, color:"C9D6EC", breakLine:true } },
  ], { x:8.7, y:4.4, w:3.7, h:1.1, fontFace:F, valign:"top", margin:0 });
  s.addText(uc.scaleNote, { x:8.7, y:5.75, w:3.7, h:0.7, fontFace:F, fontSize:11.5, italic:true, color:LIME2, lineSpacingMultiple:1.1, valign:"top", margin:0 });
}

function renderDemo(d){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, d.kicker, d.title);
  s.addText(d.intro, { x:0.7, y:1.6, w:12, h:0.55, fontFace:F, fontSize:13.5, color:GRAY, lineSpacingMultiple:1.1, margin:0 });
  s.addText(d.compsTitle, { x:0.7, y:2.35, w:7, h:0.32, fontFace:F, fontSize:14, bold:true, color:NAVY, margin:0 });
  const g = fitCols(d.comps.length, 0.7, 1.83, 0.12, 4);
  d.comps.forEach((c,i)=>{
    const x = g.xs[i], w = g.w;
    card(s, x, 2.75, w, 1.5, CARD);
    s.addText(String(i+1), { x:x, y:2.9, w:w, h:0.5, fontFace:F, fontSize:26, bold:true, color:LIME, align:"center", margin:0 });
    s.addText(c, { x:x+0.15, y:3.42, w:w-0.3, h:0.75, fontFace:F, fontSize:11, bold:true, color:NAVY, align:"center", lineSpacingMultiple:0.98, valign:"top", margin:0 });
  });
  card(s, 8.5, 2.75, 4.13, 1.5, NAVY);
  s.addText(d.reporteTitle, { x:8.75, y:2.9, w:3.7, h:0.3, fontFace:F, fontSize:13.5, bold:true, color:LIME2, margin:0 });
  s.addText(d.reporteDesc, { x:8.75, y:3.25, w:3.65, h:0.95, fontFace:F, fontSize:11.5, color:"E6EEF9", lineSpacingMultiple:1.1, valign:"top", margin:0 });
  card(s, 0.7, 4.5, 7.68, 2.1, CARD);
  s.addText(d.metricsTitle, { x:1.0, y:4.75, w:5, h:0.32, fontFace:F, fontSize:14, bold:true, color:NAVY, margin:0 });
  s.addText(d.metricsDesc, { x:1.0, y:5.1, w:7.1, h:1.3, fontFace:F, fontSize:12.5, color:GRAY, lineSpacingMultiple:1.15, valign:"top", margin:0 });
  card(s, 8.55, 4.5, 4.08, 2.1, NAVY);
  s.addText([
    { text:d.statPre, options:{ fontSize:16, color:"C9D6EC" } },
    { text:d.statNum, options:{ fontSize:52, bold:true, color:LIME2 } },
  ], { x:8.55, y:4.75, w:4.08, h:1.0, fontFace:F, align:"center", valign:"middle", margin:0 });
  s.addText(d.statCaption, { x:8.85, y:5.75, w:3.5, h:0.75, fontFace:F, fontSize:12, color:"E6EEF9", align:"center", lineSpacingMultiple:1.05, valign:"top", margin:0 });
}

function renderSecurity(d){
  const s = newSlide();
  s.background = { path: BG_NAVY };
  darkHeader(s, d.kicker, d.title);
  s.addText(d.intro, { x:0.7, y:1.6, w:11.8, h:0.4, fontFace:F, fontSize:13.5, color:"C9D6EC", margin:0 });
  const g = fitCols(d.cards.length, 0.7, 2.94, 0.13, 4);
  d.cards.forEach((c,i)=>{
    const x = g.xs[i], w = g.w;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y:2.2, w, h:1.95, rectRadius:0.12, fill:{color:"FFFFFF",transparency:88}, line:{color:"FFFFFF",width:0.75,transparency:70} });
    iconCircle(s, x+0.28, 2.45, 0.68, LIME, ICONS+"/"+c[0], 0.5);
    s.addText(c[1], { x:x+0.28, y:3.25, w:w-0.5, h:0.35, fontFace:F, fontSize:14, bold:true, color:"FFFFFF", margin:0 });
    s.addText(c[2], { x:x+0.28, y:3.58, w:w-0.5, h:0.5, fontFace:F, fontSize:10.7, color:"C9D6EC", lineSpacingMultiple:1.05, valign:"top", margin:0 });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:0.7, y:4.4, w:7.55, h:2.25, rectRadius:0.12, fill:{color:"FFFFFF",transparency:88}, line:{color:LIME2,width:1,transparency:30} });
  s.addText(d.govTitle, { x:1.0, y:4.62, w:7, h:0.35, fontFace:F, fontSize:14, bold:true, color:LIME2, margin:0 });
  let gy=5.05;
  d.gov.forEach(t=>{
    s.addImage({ path:ICONS+"/ic_check_w.png", x:1.0, y:gy+0.02, w:0.24, h:0.24 });
    s.addText(t, { x:1.35, y:gy-0.03, w:6.7, h:0.4, fontFace:F, fontSize:12.5, color:"E6EEF9", valign:"top", margin:0 });
    gy += 0.5;
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:8.4, y:4.4, w:4.23, h:2.25, rectRadius:0.12, fill:{color:LIME}, line:{type:"none"}, shadow:shadowSoft() });
  s.addImage({ path:ICONS+"/ic_plug.png", x:8.7, y:4.65, w:0.5, h:0.5 });
  s.addText(d.pluginTitle, { x:8.7, y:5.25, w:3.7, h:0.35, fontFace:F, fontSize:15, bold:true, color:"FFFFFF", margin:0 });
  s.addText(d.pluginDesc, { x:8.7, y:5.62, w:3.65, h:1.0, fontFace:F, fontSize:11.5, color:"F0FBE6", lineSpacingMultiple:1.1, valign:"top", margin:0 });
}

function renderScope(d){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, d.kicker, d.title);
  let x=0.7, y=1.75; const w=5.96, h=1.5, gapx=0.24, gapy=0.2;
  d.items.forEach((it,i)=>{
    card(s, x, y, w, h, CARD);
    iconCircle(s, x+0.28, y+0.3, 0.72, NAVY, ICONS+"/"+it[0], 0.5);
    s.addText(it[1], { x:x+1.25, y:y+0.22, w:w-1.5, h:0.45, fontFace:F, fontSize:13.5, bold:true, color:NAVY, lineSpacingMultiple:0.95, margin:0, valign:"top" });
    s.addText(it[2], { x:x+1.25, y:y+0.7, w:w-1.5, h:0.7, fontFace:F, fontSize:11, color:GRAY, lineSpacingMultiple:1.05, valign:"top", margin:0 });
    if(i%2===0){ x += w+gapx; } else { x = 0.7; y += h+gapy; }
  });
}

function renderNextSteps(d){
  const s = newSlide();
  s.background = { color: LIGHT };
  contentHeader(s, d.kicker, d.title);
  card(s, 0.7, 1.8, 5.5, 4.85, NAVY);
  s.addImage({ path:ICONS+"/ic_cal.png", x:1.0, y:2.1, w:0.55, h:0.55 });
  s.addText(d.sessionLabel, { x:1.0, y:2.75, w:4.9, h:0.35, fontFace:F, fontSize:16, bold:true, color:LIME2, margin:0 });
  s.addText(d.sessionDate, { x:1.0, y:3.1, w:4.9, h:0.6, fontFace:F, fontSize:32, bold:true, color:"FFFFFF", margin:0 });
  s.addText(d.sessionTime, { x:1.0, y:3.75, w:4.9, h:0.45, fontFace:F, fontSize:20, bold:true, color:"C9D6EC", margin:0 });
  s.addShape(pres.shapes.LINE, { x:1.0, y:4.4, w:4.85, h:0, line:{color:"FFFFFF",width:0.75,transparency:70} });
  s.addImage({ path:ICONS+"/ic_usershield.png", x:1.0, y:4.6, w:0.4, h:0.4 });
  s.addText(d.responsableRole, { x:1.55, y:4.58, w:4.4, h:0.3, fontFace:F, fontSize:11.5, color:"C9D6EC", margin:0 });
  s.addText(d.responsableName, { x:1.55, y:4.85, w:4.4, h:0.35, fontFace:F, fontSize:16, bold:true, color:"FFFFFF", margin:0 });
  s.addText(d.responsableDesc, { x:1.0, y:5.35, w:4.9, h:0.8, fontFace:F, fontSize:11.5, color:"C9D6EC", lineSpacingMultiple:1.1, valign:"top", margin:0 });
  s.addText(d.stepsTitle, { x:6.6, y:1.85, w:6, h:0.35, fontFace:F, fontSize:15, bold:true, color:NAVY, margin:0 });
  let y=2.35;
  d.steps.forEach((st,i)=>{
    card(s, 6.6, y, 6.03, 0.98, CARD);
    s.addShape(pres.shapes.OVAL, { x:6.82, y:y+0.26, w:0.46, h:0.46, fill:{color:LIME}, line:{type:"none"} });
    s.addText(String(i+1), { x:6.82, y:y+0.26, w:0.46, h:0.46, fontFace:F, fontSize:16, bold:true, color:"FFFFFF", align:"center", valign:"middle", margin:0 });
    s.addText(st[0], { x:7.45, y:y+0.14, w:5.0, h:0.35, fontFace:F, fontSize:13, bold:true, color:NAVY, margin:0, valign:"top" });
    s.addText(st[1], { x:7.45, y:y+0.46, w:5.0, h:0.5, fontFace:F, fontSize:10.3, color:GRAY, lineSpacingMultiple:1.0, valign:"top", margin:0 });
    y += 1.11;
  });
}

function renderClose(d){
  const s = newSlide();
  s.background = { path: BG_NAVY };
  s.addImage({ path: LOGO, x:(PW-2.6)/2, y:2.15, h:1.2, w:1.2*LOGO_RATIO });
  s.addText(d.value, { x:1.5, y:3.75, w:PW-3, h:1.0, fontFace:F, fontSize:22, bold:true, color:"FFFFFF", align:"center", lineSpacingMultiple:1.15, margin:0 });
  s.addText(d.thanks, { x:1.5, y:4.9, w:PW-3, h:0.5, fontFace:F, fontSize:16, color:LIME2, align:"center", bold:true, margin:0 });
  s.addText(d.footer, { x:1.5, y:6.7, w:PW-3, h:0.35, fontFace:F, fontSize:11, color:"8FA6C9", align:"center", margin:0 });
}

// =====================================================================
// DECK ASSEMBLY — el orden e inclusión de slides vive AQUÍ.
// Las secciones opcionales se omiten si su valor es null/undefined.
// =====================================================================
function buildDeck(){
  renderCover(CONTENT.cover);
  if (CONTENT.context)     renderContext(CONTENT.context);
  renderNeeds(CONTENT.needs);
  renderProvider(CONTENT.provider);
  if (CONTENT.methodology) renderMethodology(CONTENT.methodology);
  renderSolutionOverview(CONTENT.solution, CONTENT.useCases);
  CONTENT.useCases.forEach((uc, i) => renderUseCase(uc, i));
  if (CONTENT.demo)        renderDemo(CONTENT.demo);
  if (CONTENT.security)    renderSecurity(CONTENT.security);
  if (CONTENT.scope)       renderScope(CONTENT.scope);
  renderNextSteps(CONTENT.nextSteps);
  renderClose(CONTENT.close);
}

buildDeck();

if (process.env.DRY_RUN) {
  console.log("DRY_RUN · slides:", SLIDE_NO);
} else {
  pres.writeFile({ fileName: CONTENT.meta.fileName }).then(f => console.log("SAVED", f, "· slides:", SLIDE_NO));
}
