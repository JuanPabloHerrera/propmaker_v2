#!/usr/bin/env python3
"""inspect_template.py — Mide un template .pptx para RECONSTRUIRLO fiel en pptxgenjs.

Uso:
    python scripts/inspect_template.py <template.pptx> [outDir]

En estos templates el DISEÑO vive en los slide LAYOUTS (fondos full-bleed como
imágenes, logos, formas y títulos); los slides sólo referencian un layout y
rellenan texto. Por eso volcamos LAYOUTS y SLIDES.

Produce (por defecto en outDir = ".", normalmente la raíz del skill):
    template_spec.json          geometría exacta (pulgadas) por layout y slide,
                                fuentes/colores de tema, y la ruta del fondo/imagenes
    assets/backgrounds/*.jpg    el fondo REAL full-bleed de cada layout
    assets/media/*              logos y decoraciones (deduplicadas por contenido)

Con eso el agente reconstruye cada slide en `scripts/replica_deck.js` con
coordenadas medidas (no a ojo) y re-incrusta las imágenes reales del template.
Guía: references/template-replication.md.

Requiere:  pip install python-pptx   (ver scripts/setup.sh)
"""
import hashlib
import json
import os
import sys

try:
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    from pptx.oxml.ns import qn
except Exception as e:  # pragma: no cover
    sys.stderr.write("Falta python-pptx. Instala con: pip install python-pptx\n(%s)\n" % e)
    sys.exit(1)

EMU = 914400.0


def inches(v):
    return round(v / EMU, 3) if v is not None else None


class ImageSaver:
    """Guarda blobs de imagen deduplicando por contenido; devuelve la ruta relativa."""

    def __init__(self, out):
        self.out = out
        self.by_hash = {}
        os.makedirs(os.path.join(out, "assets", "backgrounds"), exist_ok=True)
        os.makedirs(os.path.join(out, "assets", "media"), exist_ok=True)

    def save(self, blob, ext, subdir, name):
        h = hashlib.md5(blob).hexdigest()
        if h in self.by_hash:
            return self.by_hash[h]
        ext = (ext or "png").lstrip(".")
        fn = "%s.%s" % (name, ext)
        rel = "assets/%s/%s" % (subdir, fn)
        with open(os.path.join(self.out, "assets", subdir, fn), "wb") as fh:
            fh.write(blob)
        self.by_hash[h] = rel
        return rel


def first_run_font(shape):
    if not getattr(shape, "has_text_frame", False):
        return None
    for p in shape.text_frame.paragraphs:
        align = str(p.alignment).split(".")[-1] if p.alignment is not None else None
        for r in p.runs:
            f = r.font
            color = None
            try:
                if f.color is not None and f.color.type is not None:
                    if getattr(f.color, "rgb", None) is not None:
                        color = str(f.color.rgb)
                    elif getattr(f.color, "theme_color", None) is not None:
                        color = "theme:" + str(f.color.theme_color).split(".")[-1]
            except Exception:
                color = None
            return {
                "face": f.name,
                "sizePt": float(f.size.pt) if f.size is not None else None,
                "bold": f.bold,
                "italic": f.italic,
                "color": color,
                "align": align,
            }
        if align:
            return {"face": None, "sizePt": None, "bold": None, "italic": None, "color": None, "align": align}
    return None


def shape_record(shape, saver, tag, sw, sh_h):
    kind = str(getattr(shape, "shape_type", None))
    ph = None
    try:
        if shape.is_placeholder:
            ph = str(shape.placeholder_format.type).split(".")[-1]
    except Exception:
        ph = None
    text = ""
    try:
        text = shape.text if shape.has_text_frame else ""
    except Exception:
        text = ""
    rec = {
        "name": getattr(shape, "name", None),
        "kind": kind,
        "placeholder": ph,
        "xIn": inches(shape.left),
        "yIn": inches(shape.top),
        "wIn": inches(shape.width),
        "hIn": inches(shape.height),
        "text": text,
        "font": first_run_font(shape),
    }
    # Imagen (pictures y placeholders de imagen) + detección de fondo full-bleed.
    if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
        try:
            img = shape.image
            w, h = inches(shape.width) or 0, inches(shape.height) or 0
            x, y = inches(shape.left) or 0, inches(shape.top) or 0
            fullbleed = w >= sw * 0.9 and h >= sh_h * 0.9 and x <= 0.2 and y <= 0.2
            sub = "backgrounds" if fullbleed else "media"
            rec["image"] = saver.save(img.blob, img.ext, sub, "%s_pic" % tag if fullbleed else "%s_%s" % (tag, shape.shape_id))
            rec["fullbleed"] = fullbleed
        except Exception as e:
            rec["image"] = None
            rec["imageError"] = str(e)
    return rec


def dump_container(container, saver, tag, sw, sh_h):
    shapes = []
    background = None
    for shp in container.shapes:
        try:
            r = shape_record(shp, saver, tag, sw, sh_h)
        except Exception as e:
            r = {"error": str(e), "name": getattr(shp, "name", None)}
        if r.get("fullbleed") and r.get("image") and background is None:
            background = r["image"]
        shapes.append(r)
    return background, shapes


def theme_info(prs):
    from lxml import etree

    major = minor = None
    colors = {}
    try:
        THEME = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
        tp = prs.slide_masters[0].part.part_related_by(THEME)
        troot = getattr(tp, "_element", None)
        if troot is None:
            troot = etree.fromstring(tp.blob)
        fs = troot.find(".//" + qn("a:fontScheme"))
        if fs is not None:
            mj = fs.find(qn("a:majorFont") + "/" + qn("a:latin"))
            mn = fs.find(qn("a:minorFont") + "/" + qn("a:latin"))
            major = mj.get("typeface") if mj is not None else None
            minor = mn.get("typeface") if mn is not None else None
        cs = troot.find(".//" + qn("a:clrScheme"))
        if cs is not None:
            for child in cs:
                nm = child.tag.split("}")[-1]
                srgb = child.find(qn("a:srgbClr"))
                sysc = child.find(qn("a:sysClr"))
                if srgb is not None:
                    colors[nm] = srgb.get("val")
                elif sysc is not None:
                    colors[nm] = sysc.get("lastClr") or sysc.get("val")
    except Exception:
        pass
    return {"majorFont": major, "minorFont": minor, "colors": colors}


def main():
    if len(sys.argv) < 2:
        sys.stderr.write(__doc__)
        sys.exit(1)
    template = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "."
    os.makedirs(out, exist_ok=True)
    saver = ImageSaver(out)

    prs = Presentation(template)
    sw = inches(prs.slide_width)
    sh_h = inches(prs.slide_height)

    spec = {
        "source": os.path.basename(template),
        "slideWidthIn": sw,
        "slideHeightIn": sh_h,
        "theme": theme_info(prs),
        "layouts": [],
        "slides": [],
    }

    for i, L in enumerate(prs.slide_layouts, start=1):
        bg, shapes = dump_container(L, saver, "L%d" % i, sw, sh_h)
        spec["layouts"].append({"index": i, "name": getattr(L, "name", None), "background": bg, "shapes": shapes})

    for i, s in enumerate(prs.slides, start=1):
        bg, shapes = dump_container(s, saver, "S%d" % i, sw, sh_h)
        spec["slides"].append(
            {"index": i, "layoutName": getattr(s.slide_layout, "name", None), "background": bg, "shapes": shapes}
        )

    with open(os.path.join(out, "template_spec.json"), "w") as fh:
        json.dump(spec, fh, ensure_ascii=False, indent=2)

    nbg = len(os.listdir(os.path.join(out, "assets", "backgrounds")))
    nmedia = len(os.listdir(os.path.join(out, "assets", "media")))
    print("template_spec.json · %d layouts · %d slides" % (len(spec["layouts"]), len(spec["slides"])))
    print("fondos:", nbg, "· media:", nmedia, "· fuentes:", spec["theme"].get("majorFont"), "/", spec["theme"].get("minorFont"))


if __name__ == "__main__":
    main()
