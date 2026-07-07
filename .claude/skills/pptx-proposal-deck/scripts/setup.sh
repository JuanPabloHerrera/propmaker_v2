#!/usr/bin/env bash
# setup.sh — Instala las dependencias del skill (idempotente; corre una vez por entorno).
#
# Uso:  bash scripts/setup.sh
#
# Instala:
#   - npm:  pptxgenjs (deck) · sharp + react + react-dom + react-icons (gen_icons.js)
#   - pip:  Pillow (gen_background.py + recorte de logo) · python-pptx
#           (inspect_template.py — modo réplica de template)
#
# QA (LibreOffice `soffice` + Poppler `pdftoppm`) y los helpers del skill público
# (/mnt/skills/public/pptx: rezip.py, unpack.py, office/soffice.py) ya vienen en el
# contenedor de Claude Code cloud. Este script solo cubre las libs de generación.

set -e

echo "== npm deps =="
if command -v npm >/dev/null 2>&1; then
  npm install --no-save pptxgenjs sharp react react-dom react-icons
else
  echo "!! npm no encontrado — instálalo antes de continuar." >&2
  exit 1
fi

echo ""
echo "== pip deps =="
PIP=""
command -v pip >/dev/null 2>&1 && PIP="pip"
[ -z "$PIP" ] && command -v pip3 >/dev/null 2>&1 && PIP="pip3"
if [ -z "$PIP" ]; then
  echo "!! pip no encontrado — instálalo antes de continuar." >&2
  exit 1
fi
$PIP install --quiet Pillow python-pptx

echo ""
echo "== chequeo de herramientas de QA (solo aviso) =="
command -v soffice   >/dev/null 2>&1 && echo "  soffice  OK" || echo "  soffice  FALTA (LibreOffice) — necesario para el QA visual"
command -v pdftoppm  >/dev/null 2>&1 && echo "  pdftoppm OK" || echo "  pdftoppm FALTA (Poppler) — necesario para el QA visual"
[ -d /mnt/skills/public/pptx ] && echo "  /mnt/skills/public/pptx OK" || echo "  /mnt/skills/public/pptx FALTA — rezip.py/unpack.py no estarán disponibles"
fc-list 2>/dev/null | grep -qi "open sans" && echo "  Open Sans OK" || echo "  Open Sans FALTA — instálala si vas a REPLICAR un template que la use (QA fiel)"

echo ""
echo "Listo."
echo "  · Modo réplica de template: inspect_template.py → replica_deck.js (ver references/template-replication.md)"
echo "  · Modo diseño propio:       extract_brand.sh → gen_background.py → gen_icons.js → build_deck.js"
