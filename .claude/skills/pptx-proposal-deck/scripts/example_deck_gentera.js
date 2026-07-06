/* =====================================================================
 * example_deck_gentera.js  —  EJEMPLO COMPLETO Y RESUELTO (NO EDITAR)
 * =====================================================================
 *
 *   Ejemplo REAL y funcional (cliente: Gentera · proveedor: MoveMinds AI)
 *   que muestra el MISMO motor que scripts/build_deck.js pero con `CONTENT`
 *   ya lleno (3 casos → 14 slides). Úsalo SOLO como referencia de cómo
 *   mapear la narrativa a cada sección. NO lo ejecutes para un cliente real
 *   y NO copies sus textos. El archivo de trabajo es scripts/build_deck.js,
 *   que trae `CONTENT` con placeholders por rellenar y secciones opcionales.
 *
 *   Todo el contenido Gentera/MoveMinds de este archivo es exactamente lo
 *   que la QA de "tokens huérfanos" (ver SKILL.md) prohíbe en la salida.
 *
 *   El deck se ADAPTA al contenido: aquí hay 3 `useCases` y todas las
 *   secciones presentes → 14 slides. Con menos casos o secciones en `null`,
 *   salen menos slides (el motor y el orden viven en build_deck.js).
 * ===================================================================== */

const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
const PW = 13.333, PH = 7.5;

const ASSETS = "assets";
const ICONS  = ASSETS + "/icons";

const BRAND = {
  primary:   "1E3A5F",
  primaryDk: "2A4A73",
  secondary: "3B6EA5",
  accent:    "E8552D",
  accentLt:  "F5936F",
  ink:       "1A2333",
  gray:      "5B6472",
  light:     "F4F6FA",
  card:      "FFFFFF",
  cardTint:  "EEF2F9",
  font:      "Calibri",
  fontLight: "Calibri Light",
  logo:      ASSETS+"/logo.png",
  logoRatio: 2.1554,
  bgDark:    ASSETS+"/bg_dark.png",
};
const NAVY=BRAND.primary, NAVY2=BRAND.primaryDk, BLUE=BRAND.secondary,
      LIME=BRAND.accent,  LIME2=BRAND.accentLt,   INK=BRAND.ink,
      GRAY=BRAND.gray,    LIGHT=BRAND.light,       CARD=BRAND.card, CARDT=BRAND.cardTint;
const F=BRAND.font, FL=BRAND.fontLight;
const LOGO=BRAND.logo, LOGO_RATIO=BRAND.logoRatio, BG_NAVY=BRAND.bgDark;

// ============ CONTENT (EJEMPLO Gentera — solo referencia) ============
const CONTENT = {
  meta: {
    author:   "MoveMinds AI",
    company:  "MoveMinds AI",
    title:    "Propuesta de Solución IA — Gentera",
    fileName: "Propuesta_Gentera.pptx",
  },

  cover: {
    kicker:   "PROPUESTA DE SOLUCIÓN CON INTELIGENCIA ARTIFICIAL",
    title:    "Ética y Cumplimiento con IA",
    subtitle: "Avatares guía, agentes de automatización y entrenamiento en criterio ético\npara el equipo de Ética y Cumplimiento de Gentera",
    pillars: [
      ["ic_filter.png",   "Filtro previo\na la denuncia"],
      ["ic_chartbar.png", "Automatización\nde reportería"],
      ["ic_grad.png",     "Entrenamiento\nen criterio ético"],
    ],
    footer:   "Documento preparado por MoveMinds AI  ·  Julio 2025  ·  Confidencial",
  },

  context: {
    kicker: "Punto de partida",
    title:  "Contexto y retos del equipo de Ética",
    intro:  "El equipo de Ética y Cumplimiento opera con una estructura reducida frente a un volumen de denuncias que supera su capacidad. Dos cuellos de botella concentran el desgaste del área.",
    cards: [
      ["ic_team.png",  NAVY, "Equipo reducido",     "2–3 investigadores, 1 persona para consultas éticas y 3 externos para todo el volumen."],
      ["ic_alert.png", NAVY, "Prioridad forzada",   "Los casos urgentes (acoso, violencia laboral) desplazan a los casos menores."],
      ["ic_clock.png", NAVY, "Rezago y sobrecarga", "Casos menores esperan hasta mes y medio; jornadas hasta las 7–8 PM sin alcanzar la meta."],
    ],
    bandTitle: "Dos dolencias que concentran el problema",
    pains: [
      ["ic_question.png", "Orientación previa a la denuncia", "Los colaboradores no saben si su caso es denunciable ni por qué canal encauzarlo. Muchos casos entran mal clasificados o no entran."],
      ["ic_report.png",   "Reportería lenta",                "Una sola denuncia toma 2–3 días completos de trabajo por investigador. Todo se arma manualmente desde una “sábana” de datos."],
    ],
  },

  needs: {
    kicker: "Lo que nos pide Gentera",
    title:  "Necesidades finales del cliente",
    intro:  "Estas son las tres necesidades definidas por Gentera. Cada una se atiende con una línea de solución de MoveMinds.",
    items: [
      ["ic_chartbar.png", "Necesidad 1", "Optimización de procesos y reducción de tiempos de reporting",
        "Solución: Agentes IA", ["Automatización de la reportería", "Analítica e inteligencia de datos"]],
      ["ic_route.png",    "Necesidad 2", "Línea de Atención Primaria: “¿Esto se denuncia?”",
        "Solución: Avatares guía", ["Hacen más fácil la atención", "Resuelven con avatar y pasan el caso al equipo a cargo"]],
      ["ic_grad.png",     "Necesidad 3", "Ética: fortalecer el criterio del colaborador",
        "Solución: Entrenamiento", ["Entrenamiento en criterios éticos", "Práctica real y medible, no solo teoría"]],
    ],
    footnote: "Fuente: necesidades definidas por el cliente (Gentera).",
  },

  provider: {
    kicker: "Quiénes somos",
    title:  "MoveMinds AI: soluciones de IA a la medida",
    intro:  "Construimos soluciones de inteligencia artificial entrenadas con la filosofía, las políticas y el código de conducta de cada organización. No es “copy-paste”: cada implementación se diseña para el contexto del cliente.",
    verticals: [
      ["ic_chat.png",  "Avatares para desarrollo de habilidades", "Práctica conversacional con feedback automatizado y estructurado por competencias."],
      ["ic_robot.png", "Agentes para automatización de procesos", "Reportería, analítica y clasificación de información en tiempo real."],
    ],
    panelTitle: "Sobre qué construimos",
    features: [
      ["ic_server.png", "Plataforma sobre Azure (preferido para compliance) y AWS según el caso."],
      ["ic_cogs.png",   "100% a la medida: entrenada con la filosofía y políticas de la organización."],
      ["ic_lock.png",   "Firmamos NDA y todos los acuerdos de confidencialidad necesarios."],
    ],
    dividerLabel: "EXPERIENCIA EN BANCA",
    clients:      "Scotiabank · Banorte · Itaú · Banco Caja Social (Colombia) · Patria",
  },

  methodology: {
    kicker: "Cómo trabajamos",
    title:  "Un modelo a la medida, probado antes de lanzar",
    timelineTitle: "De la definición al lanzamiento",
    steps: [
      ["ic_sitemap.png",   "Definición conjunta",   "Sesiones para definir contexto, competencias y tipo de feedback."],
      ["ic_cogs.png",      "Configuración",         "Montaje del avatar o agente: 15 días a 3 semanas por configuración inicial."],
      ["ic_clipboard.png", "Prueba piloto",         "Piloto controlado antes del lanzamiento, con ajustes hasta la satisfacción del cliente."],
      ["ic_target.png",    "Lanzamiento y mejora",  "Puesta en marcha y medición continua del desempeño."],
    ],
    modelTitle: "Modelo de aprendizaje 70 · 20 · 10",
    modelDesc:  "Combinamos práctica autónoma, acompañamiento y contenido personalizado para que el aprendizaje se sostenga.",
    model: [
      ["70%", "Práctica con avatar",       LIME],
      ["20%", "Acompañamiento de mentor",  LIME2],
      ["10%", "Cápsula personalizada",     "5B9BD5"],
    ],
  },

  solution: {
    kicker: "LA SOLUCIÓN",
    title:  "Tres casos de uso para Gentera",
    intro:  "Cada necesidad del cliente se traduce en una línea de solución concreta, entrenada con el contexto de Gentera.",
  },

  useCases: [
    {
      num: "01", icon: "ic_filter.png", needRef: "Necesidad 2",
      title: "Orientación y filtro previo a la denuncia",
      overviewText: "Un avatar guía orienta al colaborador, determina si el caso es denunciable, lo resuelve en primera instancia y lo canaliza al equipo correcto.",
      pattern: "flow",
      flowTitle: "Cómo funciona",
      flow: [
        ["ic_chat.png",      "El colaborador conversa con el avatar guía",       "Un espacio de atención primaria, disponible y sin fricción."],
        ["ic_question.png",  "El avatar determina si el caso es denunciable",    "Aclara la duda “¿esto se denuncia?” con base en las políticas de Gentera."],
        ["ic_route.png",     "Redirige al canal correcto",                       "Ética, Recursos Humanos o jefe inmediato, según corresponda."],
        ["ic_handshake.png", "Resuelve y hace el handoff al equipo a cargo",     "Levanta el caso estructurado y lo pasa listo al equipo responsable."],
      ],
      statTitle:   "Más confidencialidad percibida",
      statNumber:  "+90%",
      statCaption: "de los usuarios en otras organizaciones prefiere el avatar sobre hablar con una persona.",
      benefitsTitle: "Qué resuelve para Gentera",
      ben: [
        "Reduce los casos mal clasificados y los que no llegan por desconocimiento.",
        "Descarga al equipo de las consultas iniciales de orientación.",
        "Encauza cada caso al canal correcto desde el primer contacto.",
        "Ofrece un canal percibido como más confidencial por el colaborador.",
      ],
    },
    {
      num: "02", icon: "ic_chartbar.png", needRef: "Necesidad 1",
      title: "Automatización de reportería e inteligencia analítica",
      overviewText: "Un agente genera el reporte en tiempo real durante la investigación y habilita analítica por región, tema, temporalidad y dirección.",
      pattern: "beforeAfter",
      sectionTitle: "Del trabajo manual al reporte en tiempo real",
      beforeLabel: "HOY",
      beforeStat:  "2–3 días por denuncia",
      beforeDesc:  "Cada reporte se arma manualmente desde una “sábana” de datos. El investigador dedica días completos a una sola denuncia.",
      afterLabel:  "CON MOVEMINDS",
      afterStat:   "Reporte en tiempo real",
      afterDesc:   "El agente genera el reporte durante la propia llamada de investigación y estructura la información al instante.",
      dimsTitle: "Inteligencia analítica disponible",
      dims: [
        ["ic_route.png",   "Por región",      "Comparativos geográficos de incidencia."],
        ["ic_layers.png",  "Por temática",    "Agrupación por tipo de caso o conducta."],
        ["ic_clock.png",   "Por temporalidad","Tendencias y estacionalidad en el tiempo."],
        ["ic_sitemap.png", "Por dirección",   "Vista por área y grupal vs. individual."],
      ],
    },
    {
      num: "03", icon: "ic_grad.png", needRef: "Necesidad 3",
      title: "Entrenamiento en criterio ético",
      overviewText: "Casos prácticos con avatar, asincrónicos y medibles, que fortalecen el criterio ético de forma escalable a toda la población.",
      pattern: "features",
      intro: "De la recertificación anual a la práctica real y medible. En lugar de cápsula + evaluación teórica, el colaborador practica casos con un avatar y su criterio se mide con evidencia.",
      feats: [
        ["ic_brain.png",     "Casos prácticos con avatar", "El colaborador enfrenta dilemas éticos reales y decide; el avatar da feedback."],
        ["ic_layers.png",    "Asincrónico y autogestivo",  "Cada persona practica a su ritmo, sin depender de sesiones presenciales."],
        ["ic_clipboard.png", "Criterio medible",           "Se mide el desempeño real, no solo la respuesta a un examen."],
      ],
      panelTitle: "Pensado para escalar",
      scaleNum1:   "27,000",
      scaleLabel1: "colaboradores en la población actual",
      scaleNum2:   "hasta 200,000",
      scaleLabel2: "colaboradores de capacidad de escalamiento",
      scaleNote:   "Reemplaza el modelo de cápsulas + evaluación por práctica medible.",
    },
  ],

  demo: {
    kicker: "Cómo se ve en la práctica",
    title:  "Un avatar que practica, evalúa y da feedback",
    intro:  "En la demostración, el avatar “Camilo” sostuvo una conversación de feedback de bajo desempeño y el mentor “Max” entregó retroalimentación estructurada por competencias.",
    compsTitle: "Evaluación por competencias",
    comps: [
      "Inicio empático y asertivo",
      "Feedback objetivo",
      "Impacto en negocio, equipo y desarrollo personal",
      "Feedback aterrizado en acciones a futuro",
    ],
    reporteTitle: "Reporte individual",
    reporteDesc:  "Grabación de la sesión · Calificación por competencia · Checklist de comportamientos observados.",
    metricsTitle: "Métricas grupales",
    metricsDesc:  "Además del reporte individual, el área ve el desempeño de toda la población: dónde están las brechas, qué competencias fortalecer y cómo evoluciona el grupo sesión a sesión.",
    statPre:     "hasta ",
    statNum:     "76%",
    statCaption: "de mejora promedio entre la primera y la tercera sesión de práctica.",
  },

  security: {
    kicker: "CONFIANZA Y CUMPLIMIENTO",
    title:  "Seguridad, infraestructura y gobierno",
    intro:  "Gentera es una entidad regulada bajo normativa bancaria. Diseñamos la solución para cumplir con ese estándar desde el primer día.",
    cards: [
      ["ic_server.png", "Servidor cerrado",     "Operación en entorno cerrado con guardrails de ciberseguridad."],
      ["ic_shield.png", "Azure para compliance","Infraestructura preferida para entornos regulados; AWS según el caso."],
      ["ic_cert.png",   "Certificaciones ISO",  "En proceso de obtener certificaciones ISO para IA."],
      ["ic_lock.png",   "Confidencialidad",     "NDA y acuerdos de confidencialidad firmados con el cliente."],
    ],
    govTitle: "Puntos de gobierno a definir con el Centro de IA de Gentera",
    gov: [
      "Dónde vive la información y cómo se contextualiza.",
      "Arquitectura, conexiones y modelo de gobierno.",
      "Esquema de integración con las capacidades internas de Gentera.",
    ],
    pluginTitle: "Complementar o integrar",
    pluginDesc:  "Gentera tiene capacidad interna de desarrollo de agentes. La solución puede operar como plugin sobre esos agentes o integrarse con su back según convenga.",
  },

  scope: {
    kicker: "Para tener claro",
    title:  "Alcance de la solución",
    items: [
      ["ic_layers.png",     "Ética es uno de varios verticales",              "MoveMinds no es una plataforma exclusiva de ética y compliance; es una de las áreas donde aplicamos la misma tecnología."],
      ["ic_cogs.png",       "Configuración inicial: 15 días a 3 semanas",     "Por cada avatar, con sesiones conjuntas para definir contexto, competencias y tipo de feedback."],
      ["ic_clipboard.png",  "Piloto antes del lanzamiento",                   "Realizamos una prueba piloto y ajustamos hasta que el cliente quede satisfecho."],
      ["ic_server.png",     "Back adaptable a la infraestructura del cliente","El back del avatar puede adaptarse por completo a la infraestructura de Gentera."],
      ["ic_plug.png",       "Posibilidad de plugin",                          "Si Gentera ya tiene agentes propios para ciertas funciones, la solución puede conectarse a ellos."],
      ["ic_usershield.png", "Trabajo 100% a la medida",                       "Nada es “copy-paste”: se entrena con la filosofía, políticas y código de la organización."],
    ],
  },

  nextSteps: {
    kicker: "Hacia adelante",
    title:  "Próximos pasos",
    sessionLabel: "Sesión técnica",
    sessionDate:  "Jueves 16 de julio",
    sessionTime:  "12:00 PM",
    responsableRole: "Responsable técnico de Gentera",
    responsableName: "Rafael Maldonado",
    responsableDesc: "Líder del Centro de IA de Gentera. Se incluye en la invitación de la sesión.",
    stepsTitle: "Acuerdos y siguientes acciones",
    steps: [
      ["Presentar esta propuesta formal",           "Cubriendo los tres casos de uso: filtro de denuncias, automatización de reportería y entrenamiento en criterio ético."],
      ["Incluir a Rafael Maldonado en la invitación","Ailín confirma que lo agrega al invite de la sesión del 16 de julio."],
      ["Resolver preguntas técnicas por correo",     "MoveMinds enviará dudas técnicas por correo si surgen antes de la siguiente sesión."],
      ["Definir el esquema comercial",               "Se trabajará junto con el Centro de IA (por usuario, por consulta u otro modelo) en la fase técnica."],
    ],
  },

  close: {
    value:  "Convertimos el reto del equipo de Ética en\nun sistema que orienta, automatiza y entrena.",
    thanks: "Gracias, Gentera.",
    footer: "MoveMinds AI  ·  Propuesta confidencial  ·  Julio 2025",
  },
};

pres.author  = CONTENT.meta.author;
pres.company = CONTENT.meta.company;
pres.title   = CONTENT.meta.title;

// =====================================================================
// HELPERS (idénticos a build_deck.js — NO TOCAR)
// =====================================================================
const pad = (i) => String(i).padStart(2, "0");

let SLIDE_NO = 0;
function newSlide(){ SLIDE_NO++; return pres.addSlide(); }

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

function contentHeader(slide, kicker, title){
  slide.addText(kicker.toUpperCase(), { x:0.7, y:0.42, w:9.5, h:0.32, fontFace:F, fontSize:12.5, bold:true, color:LIME, charSpacing:2, margin:0 });
  slide.addText(title, { x:0.7, y:0.72, w:10.6, h:0.75, fontFace:F, fontSize:27, bold:true, color:NAVY, margin:0 });
  logoLight(slide, PW-2.35, 0.42, 0.42);
  slide.addText(pad(SLIDE_NO), { x:PW-0.95, y:PH-0.55, w:0.6, h:0.3, fontFace:F, fontSize:10, color:GRAY, align:"right", margin:0 });
}

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
// RENDERERS DE SLIDE (idénticos a build_deck.js — NO TOCAR)
// =====================================================================

function renderCover(d){
  const s = newSlide();
  s.background = { path: BG_NAVY };
  s.addImage({ path: LOGO, x:0.9, y:0.85, h:0.95, w:0.95*LOGO_RATIO });
  s.addText(d.kicker, { x:0.95, y:2.75, w:11, h:0.4, fontFace:F, fontSize:13.5, bold:true, color:LIME2, charSpacing:2.5, margin:0 });
  s.addText(d.title, { x:0.9, y:3.15, w:11.4, h:1.0, fontFace:F, fontSize:46, bold:true, color:"FFFFFF", margin:0 });
  s.addText(d.subtitle, { x:0.95, y:4.25, w:10.6, h:0.9, fontFace:F, fontSize:17, color:"C9D6EC", lineSpacingMultiple:1.15, margin:0 });
  const n = d.pillars.length;
  const step = n<=3 ? 3.75 : (11.4/n);
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
  return renderUCFlow(uc, kicker);
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
// DECK ASSEMBLY (idéntico a build_deck.js)
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
