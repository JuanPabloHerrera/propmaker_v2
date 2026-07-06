#!/usr/bin/env python3
"""gen_background.py — Fondo degradado oscuro en el color primario de la marca.

Uso:
    python scripts/gen_background.py <primaryHex> [primaryDkHex]

Ej.:
    python scripts/gen_background.py 002060 0A2E73

Genera assets/bg_dark.png (1920x1080), un degradado diagonal premium que va de
una versión muy oscura del primario, al primario, a una versión un poco más viva.
Se usa como fondo de portada, aperturas de sección y cierre.
"""
import sys, os

def hx(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def darker(c, f):   # f in [0,1]; 0 = negro
    return tuple(int(x * f) for x in c)

def lighter(c, f):  # mezcla hacia un azul-vivo tenue
    return tuple(min(255, int(x + (x*0.3 + 20) * f)) for x in c)

def main():
    if len(sys.argv) < 2:
        print("Uso: python gen_background.py <primaryHex> [primaryDkHex]"); sys.exit(1)
    from PIL import Image
    primary = hx(sys.argv[1])
    c1 = darker(primary, 0.30)                       # esquina superior-izq, muy oscuro
    c2 = hx(sys.argv[2]) if len(sys.argv) > 2 else primary
    c3 = lighter(primary, 1.0)                        # esquina inferior-der, un poco más vivo
    W, H = 1920, 1080
    img = Image.new("RGB", (W, H)); px = img.load()
    for y in range(H):
        for x in range(0, W, 2):
            t = x / W * 0.55 + y / H * 0.45
            if t < 0.5:
                f = t / 0.5
                col = tuple(int(a + (b - a) * f) for a, b in zip(c1, c2))
            else:
                f = (t - 0.5) / 0.5
                col = tuple(int(a + (b - a) * f) for a, b in zip(c2, c3))
            px[x, y] = col
            if x + 1 < W:
                px[x + 1, y] = col
    os.makedirs("assets", exist_ok=True)
    img.save("assets/bg_dark.png")
    print("assets/bg_dark.png generado desde primary", sys.argv[1])

if __name__ == "__main__":
    main()
