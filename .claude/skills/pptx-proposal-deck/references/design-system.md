# Sistema de diseño (agnóstico de marca)

Reglas de diseño que aplican a **cualquier** marca. Los colores se expresan por **rol** (primary/accent), no por hex — los hex reales salen del template (ver `brand-extraction.md`) y viven en el objeto `BRAND`.

## Formato

- **Lienzo**: 16:9 wide → `pres.layout = "LAYOUT_WIDE"` (13.333" × 7.5").
- **Márgenes**: 0.7" laterales para contenido; los fondos sangran a borde.
- **Idioma**: el de la reunión (por defecto español). Tono profesional, directo, sin relleno.

## Roles de color (mapeados desde BRAND)

| Rol | Uso |
|-----|-----|
| **primary** (dominante) | Fondos de portada/cierre/aperturas de sección, tarjetas oscuras, títulos sobre claro |
| primaryDk | Variante para el degradado del fondo oscuro |
| secondary | Sub-encabezados fríos ("Solución:"), acentos secundarios |
| **accent** | Círculos de icono de acento, checks, kickers (MAYÚSCULAS con `charSpacing`) |
| accentLt | Números/stats grandes y kickers sobre fondo oscuro |
| ink | Texto de cuerpo sobre claro |
| gray | Texto secundario, captions |
| light | Fondo de slides de contenido |
| card / cardTint | Tarjetas sobre claro / tarjeta "estado actual" |

Dominancia: primary manda, accent puntúa. Nunca peso igual entre colores.

## Estructura "sándwich"

Fondos **oscuros** (`primary` vía `bg_dark.png`) en: portada, apertura de "La solución", slide de seguridad/infraestructura y cierre. Fondo **claro** (`light`) en el resto. Esto da ritmo y jerarquía.

## Tipografía

Fuente segura en todo (Calibri por defecto). La identidad la dan color + logo + layout, no la fuente.

| Elemento | Tamaño | Peso |
|----------|--------|------|
| Título de portada | 46 | bold |
| Título de slide | 27 | bold |
| Kicker (etiqueta superior) | 12.5 | bold, `charSpacing:2`, en accent, MAYÚSCULAS |
| Header de sección/tarjeta | 14-16 | bold |
| Cuerpo | 11-13.5 | regular |
| Caption / pie | 9.5-11 | regular/italic, gris |
| Número / stat grande | 30-52 | bold, en accentLt sobre oscuro |

## Motivo visual (único, repetido)

**Iconos en círculos de color.** Es el único motivo. Círculo `primary` con icono blanco sobre fondo claro; círculo `accent` con icono blanco sobre fondo oscuro. Diámetro 0.62-0.82"; el icono ocupa ~50%, centrado. Iconos en `assets/icons/` (Font Awesome, rasterizados en los colores de la marca por `gen_icons.js`).

## Tarjetas

- `ROUNDED_RECTANGLE`, `rectRadius: 0.12`, sombra suave (nunca stripes en el borde).
- Sobre claro: fill `card` (o `cardTint` para "estado actual/hoy").
- **Sobre oscuro (translúcidas): fill `FFFFFF` con `transparency: 88`** + borde blanco `transparency:70`. Deja ver el fondo oscuro y hace legible el texto blanco. **Nunca transparency baja (6, 4): la tarjeta queda casi blanca y el texto blanco desaparece.** (Bug real y recurrente en QA.)

## Logo

- Colócalo respetando `BRAND.logoRatio` (`w = h * logoRatio`), siempre.
- Slides de contenido: pequeño arriba-derecha (`h ≈ 0.42"`). Portada/cierre: grande (`h ≈ 0.95-1.2"`).

## Prohibiciones

- Sin barras/stripes decorativas (ancho completo o de borde de tarjeta) ni subrayados bajo títulos (marca de "hecho por IA").
- Sin fondos crema/beige.
- Sin `#` en hex (corrompe el archivo). Sin hex de 8 dígitos para opacidad (usa `opacity`/`transparency`).
- Sin viñetas unicode `•` (usa `bullet:true`). Sin reutilizar objetos de opciones entre llamadas (pptxgenjs los muta in-place).
- Sin texto desbordado: verifícalo en QA visual.
