# assets/ — se genera por cliente (queda vacío en el skill)

Estos archivos NO vienen incluidos porque dependen del template de cada cliente.
Genéralos así, desde la raíz del skill, antes de correr build_deck.js:

    bash scripts/extract_brand.sh <template.pptx>      # inspecciona colores/fuentes/imágenes
    # recorta el logo del template -> assets/logo.png   (ver references/brand-extraction.md)
    python scripts/gen_background.py <primaryHex> <primaryDkHex>   # -> assets/bg_dark.png
    node scripts/gen_icons.js <accentHex> <primaryHex>            # -> assets/icons/*.png

Quedará:
    assets/logo.png        logo recortado del template (mide su ratio ancho/alto)
    assets/bg_dark.png     fondo degradado en el color primario
    assets/icons/*.png     ~30 iconos en los colores de la marca
