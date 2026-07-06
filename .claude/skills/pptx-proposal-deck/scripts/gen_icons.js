/* gen_icons.js — Genera el set de iconos PNG en los colores de la marca.
 *
 * Uso:
 *   node scripts/gen_icons.js [accentHex] [primaryHex]
 *   node scripts/gen_icons.js 7CB518 002060
 *
 * La mayoría de los iconos son BLANCOS (van dentro de círculos de color, así que
 * el color lo da el círculo, no el icono). Solo el check sobre fondo claro se
 * pinta con el color de acento para que resalte. Por eso basta con pasar el
 * acento; el primario es opcional (para iconos que quieras teñir a futuro).
 *
 * Requiere: npm i -g sharp react react-dom react-icons
 */
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const fs = require("fs");

const ACCENT  = "#" + (process.argv[2] || "7CB518").replace("#", "");
const PRIMARY = "#" + (process.argv[3] || "002060").replace("#", "");
const WHITE = "#FFFFFF";

fs.mkdirSync("assets/icons", { recursive: true });

async function iconPng(Icon, color, file, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  fs.writeFileSync("assets/icons/" + file, buf);
  console.log("saved", file);
}

(async () => {
  // Iconos blancos (viven dentro de círculos de color)
  const white = {
    ic_team: fa.FaUsers, ic_alert: fa.FaExclamationTriangle, ic_clock: fa.FaClock,
    ic_report: fa.FaFileAlt, ic_question: fa.FaQuestionCircle, ic_robot: fa.FaRobot,
    ic_chat: fa.FaComments, ic_grad: fa.FaGraduationCap, ic_chart: fa.FaChartLine,
    ic_shield: fa.FaShieldAlt, ic_route: fa.FaRoute, ic_usershield: fa.FaUserShield,
    ic_check_w: fa.FaCheckCircle, ic_lock: fa.FaLock, ic_server: fa.FaServer,
    ic_cert: fa.FaCertificate, ic_sitemap: fa.FaSitemap, ic_plug: fa.FaPlug,
    ic_cogs: fa.FaCogs, ic_target: fa.FaBullseye, ic_cal: fa.FaCalendarAlt,
    ic_mentor: fa.FaUserGraduate, ic_video: fa.FaVideo, ic_brain: fa.FaBrain,
    ic_handshake: fa.FaHandshake, ic_filter: fa.FaFilter, ic_chartbar: fa.FaChartBar,
    ic_layers: fa.FaLayerGroup, ic_clipboard: fa.FaClipboardCheck,
  };
  for (const [file, Icon] of Object.entries(white)) await iconPng(Icon, WHITE, file + ".png");
  // Check en color de acento (para listas sobre fondo claro)
  await iconPng(fa.FaCheckCircle, ACCENT, "ic_check.png");
  // Flecha en color primario (separador de pasos sobre fondo claro)
  await iconPng(fa.FaArrowRight, PRIMARY, "ic_arrow.png");
  console.log("ALL DONE");
})();
