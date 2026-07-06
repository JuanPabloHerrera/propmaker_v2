# Extracción de marca desde el template

El template del cliente es la **fuente de verdad** de la identidad. De él sacas 4 cosas que alimentan el bloque `BRAND` en `scripts/build_deck.js`: **paleta**, **fuente**, **logo** y **ratio del logo**.

## Paso 1 — Inspeccionar el template

```bash
bash scripts/extract_brand.sh <ruta/al/template.pptx>
```
Esto imprime, desde `brand_extracted/`:
- Tamaño de slide (confirma 16:9).
- **Colores** `srgbClr` por frecuencia.
- **Tipografías** por frecuencia.
- **Imágenes** del template (con dimensiones y si tienen alpha) para identificar el logo.

## Paso 2 — Elegir la paleta

De la lista de colores por frecuencia, asigna roles:

- **primary** — el color **oscuro/corporativo** dominante (suele ser el más frecuente en fondos y títulos). Va en portada, aperturas de sección, cierre y tarjetas oscuras.
- **primaryDk** — una variante un poco más oscura para el degradado del fondo. Si no hay una obvia, oscurece el primary ~15%.
- **secondary** — un azul/tono frío secundario para sub-encabezados. Si no existe, usa el primary.
- **accent** — el color **vivo** de la marca (el que aparece en menor cantidad, en CTAs/resaltados). Va en círculos de icono, checks y kickers.
- **accentLt** — versión clara del acento para números/kickers grandes sobre fondo oscuro. Si no hay, aclara el accent.

Deja tinta/gris/fondo claro/tarjetas en sus valores por defecto salvo que el template pida otra cosa:
`ink 1A2333`, `gray 5B6472`, `light F4F6FA`, `card FFFFFF`, `cardTint EEF2F9`.

> Regla de dominancia: un color manda (60-70% del peso visual), el acento puntúa. Nunca repartas peso igual.

## Paso 3 — Elegir la fuente

Toma la typeface más usada. **Pero para el cuerpo usa siempre una fuente segura que embarque con Office** (Calibri, Arial, Cambria): garantiza que el deck se vea igual en la máquina del cliente y que el QA por LibreOffice sea confiable. Si la fuente de marca es exótica (p. ej. una de Google Fonts), resérvala para títulos con holgura de ~10% y no confíes el ajuste fino de esos textos al preview de QA. Por defecto: `font: "Calibri"`.

## Paso 4 — Recortar el logo

Identifica la imagen del logo (normalmente con transparencia, aspecto de marca, no una foto). Recórtala al bounding box de contenido y mide su ratio:

```bash
python3 - <<'EOF'
from PIL import Image
im = Image.open("brand_extracted/media/imageN.png").convert("RGBA")
crop = im.crop(im.getbbox())
crop.save("assets/logo.png")
print("ratio ancho/alto =", round(crop.size[0]/crop.size[1], 4))
EOF
```
Anota ese ratio → va en `BRAND.logoRatio`. Es crítico: el script coloca el logo con `w = h * logoRatio`; si el ratio está mal, el logo sale deformado.

**Legibilidad del logo sobre fondo oscuro:** casi todos los logos con wordmark de color o claro contrastan bien sobre el `primary`. Si el logo es oscuro (p. ej. negro sobre transparente), busca una variante clara/mono del template, o colócalo solo sobre fondos claros y usa un recuadro claro en portada/cierre.

## Paso 5 — Generar fondo e iconos en los colores de la marca

```bash
python scripts/gen_background.py <primaryHex> <primaryDkHex>   # -> assets/bg_dark.png
node scripts/gen_icons.js <accentHex> <primaryHex>            # -> assets/icons/*.png
```

## Paso 6 — Volcar todo en BRAND

Edita el objeto `BRAND` al inicio de `scripts/build_deck.js` con los hex elegidos, la fuente, `logo`, `logoRatio` y las rutas de `bg_dark.png`. Nada más del script cambia por marca.

## Si el template NO es 16:9

El script asume `LAYOUT_WIDE` (13.333×7.5). Si el template es 4:3 u otro, tendrías que reescalar coordenadas — no es el caso de uso previsto. Confírmalo con el usuario antes de continuar.
