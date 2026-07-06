#!/usr/bin/env bash
# extract_brand.sh — Extrae la identidad de marca de CUALQUIER template PPTX.
#
# Uso:  bash scripts/extract_brand.sh /ruta/al/template.pptx
#
# Produce en ./brand_extracted:
#   - La lista de COLORES (srgbClr) por frecuencia  → tu paleta primary/accent.
#   - Las TIPOGRAFÍAS (typeface) por frecuencia      → fuente de marca.
#   - Todas las IMÁGENES del template                → identifica el logo.
#   - El TAMAÑO de slide (para confirmar 16:9).
#
# Cómo interpretar (ver references/brand-extraction.md para el detalle):
#   * PRIMARY  = el color oscuro/corporativo más frecuente (fondos, títulos).
#   * ACCENT   = el color vivo que aparece en menor cantidad (resaltados, CTAs).
#   * FUENTE   = la typeface más usada; si NO es segura (Calibri/Arial), usa
#               Calibri para el cuerpo igualmente y reserva la de marca para
#               títulos con holgura (ver design-system.md).
#   * LOGO     = la imagen con el nombre/isotipo de la empresa (suele tener
#               transparencia y aspecto de marca, no una foto).

set -e
TEMPLATE="${1:?Pasa la ruta al template .pptx}"
PPTX_SKILL="/mnt/skills/public/pptx"
OUT="brand_extracted"

rm -rf "$OUT" && mkdir -p "$OUT/media"
python "$PPTX_SKILL/scripts/office/unpack.py" "$TEMPLATE" "$OUT/unpacked" >/dev/null

echo "=== TAMAÑO DE SLIDE (confirma 16:9 = 12192000 x 6858000) ==="
grep -oE '<p:sldSz[^/]*/>' "$OUT/unpacked/ppt/presentation.xml" || true

echo ""
echo "=== COLORES (srgbClr, por frecuencia) — elige primary (oscuro) y accent (vivo) ==="
grep -rhoE 'srgbClr val="[0-9A-Fa-f]{6}"' \
  "$OUT/unpacked/ppt/slides" "$OUT/unpacked/ppt/slideLayouts" "$OUT/unpacked/ppt/slideMasters" 2>/dev/null \
  | grep -oE '[0-9A-Fa-f]{6}' | sort | uniq -c | sort -rn | head -15

echo ""
echo "=== TIPOGRAFÍAS (typeface, por frecuencia) ==="
grep -rhoE 'typeface="[^"]*"' "$OUT/unpacked/ppt" 2>/dev/null \
  | sed -E 's/typeface="([^"]*)"/\1/' | sort | uniq -c | sort -rn | head -10

echo ""
echo "=== IMÁGENES (identifica el logo) ==="
cp "$OUT/unpacked/ppt/media/"* "$OUT/media/" 2>/dev/null || true
python3 - "$OUT/media" <<'PY'
import os, sys
from PIL import Image
d = sys.argv[1]
for f in sorted(os.listdir(d)):
    try:
        im = Image.open(os.path.join(d, f))
        alpha = "con-alpha" if im.mode in ("RGBA","LA","P") else "sin-alpha"
        print(f"  {f:16s} {im.size[0]}x{im.size[1]}  {im.mode}  {alpha}")
    except Exception as e:
        print(f"  {f}: {e}")
PY

echo ""
echo "Recorta el logo al contenido no transparente y guárdalo como assets/logo.png:"
cat <<'PY'
python3 - <<'EOF'
from PIL import Image
im = Image.open("brand_extracted/media/imageN.png").convert("RGBA")
crop = im.crop(im.getbbox())
crop.save("assets/logo.png")
print("logo listo, ratio ancho/alto =", round(crop.size[0]/crop.size[1], 4))
EOF
PY
echo ""
echo "Anota ese ratio: va en BRAND.logoRatio dentro de scripts/build_deck.js."
