# Guía de construcción (pptxgenjs)

Detalle técnico de `scripts/build_deck.js`. Léelo antes de tocar las funciones de render.

## Los dos bloques editables: BRAND y CONTENT

El script tiene **dos** bloques al inicio que tú editas — nada más:

- **`BRAND`** — colores, fuente, logo y ratio del template. Se mapea internamente a los nombres que usa el render (`NAVY`, `LIME`, etc. — nombres históricos, ya agnósticos por su valor). **No renombres esas variables internas**; solo cambia los valores de `BRAND`.
- **`CONTENT`** — la narrativa por **sección** (`cover`, `context`, `needs`, `provider`, `methodology`, `solution` + `useCases[]`, `demo`, `security`, `scope`, `nextSteps`, `close`), con placeholders `«...»`. Cada función de render lee de su sección, así que rellenar `CONTENT` es todo lo que necesitas. Mapa de qué va en cada campo: `references/propmaker-narrative-map.md`. Ejemplo lleno: `scripts/example_deck_gentera.js`.

Los nombres de icono (`ic_*.png`) y colores (`NAVY`/`LIME`/…) dentro de `CONTENT` son de diseño: cámbialos solo si el significado lo pide. Las **funciones de render, helpers y el driver `buildDeck()`** (debajo de `CONTENT`) son QA-probados: no los toques.

## Motor: cómo se adapta el deck

- El deck se ensambla en **`buildDeck()`** (al final): llama a una función de render por sección, **omite** las opcionales cuando su valor es `null` (`context`, `methodology`, `demo`, `security`, `scope`) y **recorre `CONTENT.useCases`** generando 1 slide de detalle por caso (`renderUseCase` despacha según `uc.pattern`: `flow` | `beforeAfter` | `features`). El número de slide se lleva en un contador global (`SLIDE_NO`), no es fijo.
- Para **más/menos casos**: agrega o quita entradas en `CONTENT.useCases` — el overview y los pilares se ajustan solos. Para **omitir** una sección opcional: ponla en `null`.
- Comprueba el conteo sin escribir el archivo: `DRY_RUN=1 node scripts/build_deck.js` imprime `slides: N`.

## Helpers estables (no tocar salvo necesidad real)

- `newSlide()` — crea un slide e incrementa el contador `SLIDE_NO` (numeración correcta aunque el deck se adapte). Todas las funciones de render lo usan.
- `shadow()` / `shadowSoft()` — devuelven un objeto de sombra **nuevo cada vez** (pptxgenjs muta las opciones in-place; compartir un objeto corrompe la segunda forma).
- `logoLight(slide, x, y, h)` — coloca el logo respetando `logoRatio`.
- `contentHeader(slide, kicker, title)` — kicker accent + título primary + logo chico arriba-derecha + número de slide (usa `SLIDE_NO`). En los slides de contenido claros.
- `darkHeader(slide, kicker, title)` — kicker accentLt + título blanco + logo, para slides oscuros (overview, seguridad). No numera.
- `fitCols(n, x0, wCanon, gapCanon, nCanon)` — reparte una fila de `n` columnas: en `n===nCanon` reproduce la geometría canónica exacta; para otro `n` reajusta el ancho manteniendo el mismo span. Devuelve `{ w, gap, xs }`.
- `iconCircle(slide, x, y, d, fill, icon, iconScale)` — el motivo visual (círculo + icono centrado).
- `card(slide, x, y, w, h, fill, rad)` — tarjeta redondeada con sombra.

## Layouts probados (las grids se adaptan con `fitCols`)

Los valores son los **canónicos** (para el número de elementos original); `fitCols` los mantiene idénticos a ese número y reajusta el ancho para otros. Van bien 2–5 por fila; verifica en QA.

- **Grid de 3 tarjetas** (ancho útil 0.7→12.63): `w=3.94`, `gap=0.235`, `x=0.7`.
- **Grid de 4 tarjetas**: `w=2.94`, `gap=0.13`.
- **Grid 2 columnas** (alcance): `w=5.96`, `gapx=0.24`, `h=1.5`, `gapy=0.2`; alterna `x`, avanza `y` cada 2 (cualquier nº de items).
- **Fila de pasos con flechas**: `ic_arrow.png` (0.2") entre tarjetas a media altura (flecha si `i<n-1`).
- **Stat sobre oscuro**: número 30-52pt en accentLt, label 11-12pt claro.

## Colores de texto por fondo

- Sobre claro: títulos primary, cuerpo ink, secundario gray.
- Sobre oscuro: títulos blanco, cuerpo azul-claro (`C9D6EC`/`E6EEF9` sirven para casi cualquier primary oscuro), acento/números accentLt.

## Trampas que ya costaron un ciclo de QA

1. **Tarjetas translúcidas casi blancas.** `transparency:6` sobre oscuro = tarjeta opaca blanca → texto blanco invisible. Usa `transparency:88`. (Slides 6 y 11.)
2. **Texto desbordado en tarjetas cortas.** Una descripción de 3 líneas en tarjeta de `h:1.75` se sale. Acorta o agranda la caja. Verifica en QA.
3. **Fuentes no instaladas en QA.** LibreOffice sustituye fuentes; el ancho varía. Por eso Calibri (segura) para cuerpo y no confiar el ajuste fino a fuentes fuera de la lista segura.
4. **`extract-text | grep xxx`** marca falsos positivos con texto legítimo ("3 externos", "2–3 días"). No son placeholders.

## Iconos (`assets/icons/`, generados por gen_icons.js)

`ic_team, ic_alert, ic_clock, ic_report, ic_question, ic_robot, ic_chat, ic_grad, ic_chart, ic_shield, ic_route, ic_usershield, ic_check, ic_check_w, ic_lock, ic_server, ic_cert, ic_sitemap, ic_plug, ic_cogs, ic_target, ic_arrow, ic_cal, ic_mentor, ic_video, ic_brain, ic_handshake, ic_filter, ic_chartbar, ic_layers, ic_clipboard`.

¿Falta uno? Añádelo en `scripts/gen_icons.js` (Font Awesome vía `react-icons/fa`) y re-ejecuta con el acento de la marca. Casi todos son blancos (viven en círculos de color); solo `ic_check` va en color de acento y `ic_arrow` en primary.

## Comandos (desde la raíz del skill)

```bash
bash scripts/extract_brand.sh <template.pptx>              # inspeccionar marca
# recortar logo -> assets/logo.png (ver brand-extraction.md)
python scripts/gen_background.py <primaryHex> <primaryDkHex>
node scripts/gen_icons.js <accentHex> <primaryHex>
# editar BRAND + CONTENT en scripts/build_deck.js, luego:
node scripts/build_deck.js
# (DRY_RUN=1 node scripts/build_deck.js  → imprime el nº de slides sin escribir)
python /mnt/skills/public/pptx/scripts/rezip.py Propuesta_<Cliente>.pptx
# QA visual:
python /mnt/skills/public/pptx/scripts/office/soffice.py --headless --convert-to pdf Propuesta_<Cliente>.pptx
rm -f slide-*.jpg && pdftoppm -jpeg -r 110 Propuesta_<Cliente>.pdf slide
# revisa cada slide-*.jpg con el tool `view`
```

## Renombrar la salida

Cambia `CONTENT.meta.fileName` a `Propuesta_<Cliente>.pptx` (el `writeFile` final ya lo usa).
