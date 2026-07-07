# Replicar un template exacto (modo "réplica")

Cuando el usuario quiere que la salida **respete el template real** (mismo fondo,
estilo, títulos, layout) y no un diseño propio, se reconstruye el template en
pptxgenjs con **medidas exactas** y se **re-incrustan las imágenes reales** del
template; luego se rellenan las zonas de contenido con la narrativa de la propuesta.
El generador reconstruido es a la vez la **réplica** (import/template reutilizable) y,
relleno, la **salida final**.

> Modo alterno: si NO hay que calcar un template (diseño desde cero con la marca),
> usa `scripts/build_deck.js` (ver SKILL.md, modo B).

## Por qué así (hallazgo real)

Los templates tipo MoveMinds guardan el DISEÑO en los **slide LAYOUTS**: cada layout
trae un **fondo full-bleed como imagen** (`<p:pic>` 13.33×7.5) + logos + formas +
títulos; los slides sólo referencian un layout y rellenan texto. Por eso medimos
layouts **y** slides. Reproducir eso "a ojo" no funciona; hay que **medirlo**.

## Paso 1 — Medir el template

```bash
python scripts/inspect_template.py <template.pptx>        # escribe en la raíz de trabajo
```
Produce:
- `template_spec.json` — por **layout** y **slide**: tamaño, tema (fuentes/colores) y,
  por forma: `kind`, `placeholder`, geometría `xIn/yIn/wIn/hIn` (pulgadas), `text`,
  `font` (face, sizePt, bold, color, align) e `image`+`fullbleed` en las imágenes.
- `assets/backgrounds/*` — el **fondo real full-bleed** de cada layout (byte-idéntico).
- `assets/media/*` — logos y decoraciones (deduplicados por contenido).

## Paso 2 — Reconstruir cada slide (pptxgenjs)

Parte de `scripts/replica_deck.js` (andamio con 2 slides de ejemplo ya reconstruidos
de un template real). Para **cada** layout/slide del spec, escribe una función que:

1. **Fondo real:** `bgFull(slide, "assets/backgrounds/L<n>_pic.jpg")` (la ruta sale de
   `layout.background` en el spec).
2. **Decoración/logos:** `addImageAt(slide, "assets/media/…", x, y, w, h)` con las
   coords del spec (pulgadas).
3. **Títulos del template:** `textAt(slide, "<título>", x, y, w, h, {face,size,bold,color,align})`
   copiando texto/posición/fuente del spec. **Consérvalos** salvo que la propuesta pida cambiarlos.
4. **Zonas de contenido:** identifica la caja de texto grande del layout (la de mayor
   área con texto, o el placeholder BODY) y rellénala con la narrativa vía `textAt`.

Copia las coordenadas del spec **tal cual** — están en pulgadas y pptxgenjs usa pulgadas.
Colores en hex sin `#`. Fuente: la del template (abajo).

## Paso 3 — Mapear la narrativa

Rellena las zonas de contenido con el `ProposalBrief`/documento (ver
`references/propmaker-narrative-map.md`): **mantén los títulos del template** y coloca el
cuerpo en la región medida de cada slide. Lo que la propuesta no aporte se omite o queda
«Por confirmar». Sin precios por defecto.

## Fuentes

El template usa **Open Sans** (los runs lo declaran; el tema cae a Calibri). Úsala en el
generador (`FONT = "Open Sans"`). Para que el **QA visual** y el render del cliente la
muestren fiel, instálala en el entorno:
```bash
fc-list | grep -i "open sans" || echo "instala Open Sans (p.ej. fonts-open-sans) para QA fiel"
```
Si no está, LibreOffice sustituye la fuente en el preview (el ancho cambia); PowerPoint del
cliente la renderiza bien si la tiene instalada.

## Paso 4 — Generar y QA

```bash
node scripts/replica_deck.js                     # (DRY_RUN=1 para no escribir)
python /mnt/skills/public/pptx/scripts/rezip.py <fileName>.pptx
# QA visual: compara CADA slide contra el original del template
python /mnt/skills/public/pptx/scripts/office/soffice.py --headless --convert-to pdf <fileName>.pptx
rm -f slide-*.jpg && pdftoppm -jpeg -r 110 <fileName>.pdf slide
# (opcional) render del template original para comparar lado a lado:
python /mnt/skills/public/pptx/scripts/thumbnail.py <template.pptx>
```
Revisa cada `slide-*.jpg` con `view` **junto al slide original**. Fidelidad:
- Fondo idéntico (se re-incrustó la imagen real → debe calzar exacto).
- Título en la misma posición/fuente/tamaño/color/alineación.
- Contenido dentro de su región, sin desbordes ni solapes; contraste correcto.
- Logos/decoración en su lugar.
Ajusta coords/tamaños, re-genera lo afectado, repite hasta que calce.

## Caveats (honestos)

- **Mejor esfuerzo, no garantiza pixel-perfect.** Los fondos se re-incrustan exactos
  (imágenes reales); títulos/cajas/decoración se reproducen desde geometría medida (muy
  cerca). Degradados, grupos, SmartArt, gráficos y efectos "horneados" pueden no calzar al
  100% — el **QA visual** cierra la brecha.
- **Por template, guiado por el agente, en la nube** (python-pptx + LibreOffice + el stack).
- El generador reconstruido es **reutilizable**: replica una vez (import), rellena por
  propuesta (salida final).
