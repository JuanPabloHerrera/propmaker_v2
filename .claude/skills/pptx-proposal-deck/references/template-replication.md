# Replicar un template exacto (modo "réplica")

Cuando el usuario quiere que la salida **respete el template real** (mismo fondo, estilo,
títulos, tamaños, formas — TODO), se **mide** el template y se **reproduce forma por forma** en
pptxgenjs, re-incrustando las imágenes reales; luego se sustituye el texto de las formas de
contenido por la narrativa de la propuesta. El generador reconstruido es la **réplica**
(reutilizable) y, con overrides, la **salida final**.

> Modo alterno: si NO hay que calcar un template (diseño desde cero con la marca), usa
> `scripts/build_deck.js` (ver SKILL.md, modo B).

## Por qué así (hallazgo real)

En estos templates el DISEÑO vive en los slide **LAYOUTS**: cada layout trae un **fondo
full-bleed como imagen** + un **rectángulo overlay semi-transparente** (contraste) + formas de
color (rect/roundRect/ellipse) + logos + texto. Los slides sólo referencian un layout. Por eso
medimos layouts **y** slides, con TODO: geometría, fondos, imágenes, y por forma su
relleno/transparencia/borde/tipo + texto enriquecido. Reproducir "a ojo" no funciona; se mide.

## Paso 1 — Setup

```bash
bash scripts/setup.sh   # incluye python-pptx (medición) + deps de generación
```

## Paso 2 — Medir el template

```bash
python scripts/inspect_template.py <template.pptx>        # escribe en la raíz de trabajo
```
Produce:
- `template_spec.json` — por **layout** y **slide**, y por forma: `preset` (rect/roundRect/
  ellipse), `fill` (color + `transparency`), `line`, `rotation`, geometría `xIn/yIn/wIn/hIn`
  (pulgadas), y `richText` (párrafos→runs con fuente/tamaño/negrita/color/alineación). Los
  grupos se **aplanan** (sus hijos aparecen con coords absolutas). Incluye `theme` (fuentes/colores).
- `assets/backgrounds/*` — el **fondo real full-bleed** de cada layout (byte-idéntico).
- `assets/media/*` — logos y decoraciones (deduplicados por contenido).
- `template_layouts_preview.pptx` — **un slide por layout** (para el análisis VISUAL del paso 3).

## Paso 3 — Análisis VISUAL (thumbnails)

Renderiza a imágenes temporales el preview de layouts **y** los slides originales, y **míralos**
con `view` para entender el sistema de diseño (jerarquía, espaciado, imágenes, uso de color) y
cruzar-verificar la medición:
```bash
python /mnt/skills/public/pptx/scripts/office/soffice.py --headless --convert-to pdf template_layouts_preview.pptx
rm -f tpl-*.jpg && pdftoppm -jpeg -r 110 template_layouts_preview.pdf tpl
# (alternativa: python /mnt/skills/public/pptx/scripts/thumbnail.py template_layouts_preview.pptx)
```
Revisa cada `tpl-*.jpg` con `view`. En el preview, el slide 1 es el original y los siguientes
son **un layout cada uno**. Anota qué layout usar para cada parte de la propuesta y qué formas
son "contenido" (a sustituir) vs. "marca/estructura" (a conservar).

## Paso 4 — Reconstruir con `replica_deck.js` (spec-driven)

`replica_deck.js` **reproduce automáticamente** cada forma del spec (fondo, formas con relleno/
transparencia/borde, imágenes, texto enriquecido). Tú sólo editas el bloque **`DECK`**:

```bash
node scripts/replica_deck.js --list      # imprime, por layout/slide, el índice y texto de cada forma
```
En `scripts/replica_deck.js` edita:
- **`DECK`** — una entrada por slide de salida: `{ from:"layout"|"slide", index:<n>, overrides:{ "<shapeIndex>":"texto de la propuesta" } }`. Elige qué layouts usar, en qué orden, y qué formas rellenar con la narrativa (mapa: `references/propmaker-narrative-map.md` — conserva títulos del template, sustituye contenido). Los índices salen de `--list`.
- **`meta.fileName`** — `Replica_<Cliente>.pptx`.
Todo lo NO incluido en `overrides` se reproduce idéntico al template.

## Paso 5 — Generar y QA visual

```bash
node scripts/replica_deck.js
python /mnt/skills/public/pptx/scripts/rezip.py Replica_<Cliente>.pptx
python /mnt/skills/public/pptx/scripts/office/soffice.py --headless --convert-to pdf Replica_<Cliente>.pptx
rm -f rep-*.jpg && pdftoppm -jpeg -r 110 Replica_<Cliente>.pdf rep
```
Compara cada `rep-*.jpg` con su `tpl-*.jpg` (paso 3) **lado a lado** con `view`: mismo fondo,
mismas formas/posiciones/tamaños, mismo estilo de texto, sin desbordes ni solapes, sin texto de
ejemplo del template. Ajusta coords/overrides, re-genera lo afectado, repite hasta que calce.

## Fuentes

El template declara su fuente (aquí runs en **Open Sans**; tema en Calibri). El renderer usa la
fuente medida por forma. Para QA/render fiel instálala:
```bash
fc-list | grep -i "open sans" || echo "instala Open Sans para un preview fiel"
```
Sin ella, LibreOffice sustituye la fuente (el ancho cambia); PowerPoint del cliente la
renderiza bien si la tiene.

## Caveats (honestos)

- **Mejor esfuerzo, no pixel-perfect.** Fondos exactos (imágenes reales, byte-idénticas). Formas
  básicas (rect/roundRect/ellipse, rellenos sólidos + transparencia), texto y logos se
  reproducen fielmente (este template no tiene freeforms). Degradados y efectos de imagen se
  aproximan; el QA visual cierra la brecha.
- Los thumbnails (`tpl-*.jpg`, `rep-*.jpg`) y `template_layouts_preview.pptx` son **artefactos
  temporales** de QA, no el entregable.
- **Por template, guiado por el agente, en la nube.** El generador reconstruido es reutilizable:
  replica una vez (import), rellena por propuesta (salida final).
