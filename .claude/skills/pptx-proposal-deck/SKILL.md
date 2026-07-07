---
name: pptx-proposal-deck
description: Construye la versión PowerPoint (.pptx) de una propuesta de PropMaker. Toma la NARRATIVA que PropMaker ya generó (el ProposalBrief revisado y/o el documento de propuesta) y un template de marca del que se extrae la identidad visual (logo, paleta, fuente), y produce un deck con arco de propuesta B2B (portada, contexto y retos, necesidades citadas del cliente, quiénes somos, metodología, casos de uso, demo, seguridad e infraestructura, alcance, próximos pasos, cierre), motivo de iconos en círculos, tarjetas y estructura sándwich claro/oscuro. El deck se ADAPTA al contenido: el nº de slides no es fijo (un slide de detalle por cada prioridad/caso de uso, y las secciones opcionales se omiten si la narrativa no las sustenta) — típicamente ~14. Funciona para CUALQUIER proveedor y cualquier template 16:9. Úsalo SIEMPRE que se pida la versión "pptx / deck / presentación / pitch" de una propuesta y haya (a) la narrativa de la propuesta o el resumen de la reunión, y (b) un template de marca. El documento de propuesta de PropMaker NO se toca: este skill solo define cómo se hace el .pptx. Tiene DOS modos: (A) **REPLICAR el template exacto** — mismo fondo, estilo y títulos, reconstruido en pptxgenjs con medidas reales (`inspect_template.py` + `template-replication.md`), re-incrustando las imágenes reales del template; o (B) **diseño propio branded** (`build_deck.js`). Por defecto NO incluye números ni precios (el esquema comercial se cierra en fase técnica). Salida: un .pptx en el idioma de la propuesta, con la marca del template, verificado con QA visual y grep de tokens huérfanos.
---

# Deck de propuesta branded (PPTX) desde la narrativa de PropMaker

Convierte la **narrativa de la propuesta de PropMaker** (el `ProposalBrief` revisado y/o el documento) + un **template de marca** en una **propuesta `.pptx`**. La identidad (logo, colores, fuente) se **extrae del template**, así que sirve para cualquier proveedor. La salida va en el idioma de la propuesta, sin números ni precios por defecto. **El nº de slides se adapta al contenido** (un slide por caso de uso; secciones opcionales omitibles) — típicamente ~14.

> **El documento de propuesta de PropMaker se queda como está.** Este skill solo determina **cómo se construye la versión `.pptx`**, alimentándola con esa misma narrativa (deck y documento cuentan la misma historia).

## Cuándo usar este skill

Actívalo cuando el usuario:
- Pide la versión **pptx / deck / presentación / pitch** de una propuesta y aporta (a) la narrativa (el `ProposalBrief` o el documento de propuesta de PropMaker, o el resumen de la reunión) **y** (b) un template de presentación de marca.
- Pide "convertir esta propuesta/reunión en una presentación con base en el template".
- Pide adaptar o regenerar un deck previo hecho con este flujo.

No usar para: minutas, documentos Word (usa `docx`), o cuando no hay template de marca (ahí conviene un diseño desde cero con el skill `pptx` + `frontend-design`).

## Dos modos — elige antes de empezar

- **Modo A · REPLICAR el template exacto** (cuando el usuario quiere que la salida **respete
  el template real**: mismo fondo, estilo, TÍTULOS, tamaños y **todas las formas** — no sólo
  colores y fuentes). Se **mide** el template con `scripts/inspect_template.py` (por forma:
  preset, relleno + transparencia, borde, rotación, texto enriquecido, imágenes/fondos reales;
  aplana grupos) **y se analiza visualmente** (thumbnails de cada layout con `view`).
  `scripts/replica_deck.js` **reproduce cada forma** del spec automáticamente y sólo sustituye
  el texto de contenido por la narrativa. **Guía: `references/template-replication.md`.**
  Úsalo cuando el template sea un deck diseñado (fondos full-bleed, layouts propios).
- **Modo B · Diseño propio branded** (cuando NO hay que calcar un template: se extrae la marca
  y se construye el arco B2B propio del skill). Sigue el "Flujo de alto nivel" de abajo con
  `build_deck.js`. Adapta el nº de slides al contenido.

El resto de este documento describe el **Modo B**. Para el **Modo A** ve directo a
`references/template-replication.md` (usa `setup.sh` igual, que instala también `python-pptx`).

## Qué produce

Un `.pptx` 16:9 wide con la marca del template (nº de slides según el contenido, típicamente ~14):
- Portada y cierre sobre fondo oscuro (color primario) con el logo del proveedor.
- Las **necesidades del cliente citadas textualmente** (ancla del alcance), cada una mapeada a una solución.
- **Un slide detallado por prioridad / caso de uso** (siguen a `ProposalBrief.priorities`; N variable).
- Metodología, seguridad/infraestructura/gobierno, alcance y próximos pasos — **secciones omitibles** si la narrativa no las sustenta.
- Sin tarifas por defecto.

## Flujo de alto nivel

**0. Preparar dependencias** (una vez por entorno)
```bash
bash scripts/setup.sh   # npm: pptxgenjs sharp react react-dom react-icons · pip: Pillow
```

**A. Extraer la marca del template** (ver `references/brand-extraction.md`)
1. `bash scripts/extract_brand.sh <template.pptx>` → inspecciona colores, fuentes e imágenes.
2. Elige **primary** (oscuro dominante) y **accent** (vivo). Toma la fuente (Calibri para cuerpo por defecto).
3. Recorta el logo → `assets/logo.png` y **mide su ratio ancho/alto**.
4. Genera assets de marca:
   ```bash
   python scripts/gen_background.py <primaryHex> <primaryDkHex>   # -> assets/bg_dark.png
   node scripts/gen_icons.js <accentHex> <primaryHex>            # -> assets/icons/*.png
   ```

**B. Leer la narrativa de la propuesta** (ver `references/propmaker-narrative-map.md`)
5. Fuente primaria: el **`ProposalBrief`** (`overview`, `clientGoals`, `priorities`, `scope`, `outOfScope`, `recommendedProducts`, `budgetNotes`, `timelineNotes`, `openQuestions`). Complementa con el **documento** de propuesta (6 secciones) y los metadatos de reunión (cliente, próximo hito). Las **prioridades** son la espina del deck (definen cuántos casos de uso).
6. Confirma solo lo crítico que falte: nombre exacto del cliente/área, número de casos, mes/año de la propuesta y fecha del próximo hito. No inventes tarifas ni datos; lo que falte va como "Por confirmar" o se omite.

**C. Construir el deck**
7. En `scripts/build_deck.js` edita **solo dos bloques** (todo lo demás es render QA-probado, NO lo toques):
   - **`BRAND`** — los valores del template (`references/brand-extraction.md`).
   - **`CONTENT`** — la narrativa por sección, reemplazando cada placeholder `«...»` (mapa: `references/propmaker-narrative-map.md` + `references/slide-catalog.md`). **Adapta el deck al contenido:** pon **una entrada en `CONTENT.useCases` por prioridad/caso** (N cualquiera → N slides de detalle) y deja en **`null`** las secciones opcionales que la narrativa no sustente (`context`, `methodology`, `demo`, `security`, `scope`).
   Ajusta `CONTENT.meta.fileName` a `Propuesta_<Cliente>.pptx`. Verifica el nº de slides con `DRY_RUN=1 node scripts/build_deck.js`. ¿Dudas de cómo se ve lleno? Mira `scripts/example_deck_gentera.js` (ejemplo completo — **referencia, no copiar**).
8. Genera y recomprime:
   ```bash
   node scripts/build_deck.js
   python /mnt/skills/public/pptx/scripts/rezip.py Propuesta_<Cliente>.pptx
   ```

**D. QA y entrega**
9. **QA obligatorio** (abajo): visual con ojos frescos + grep de tokens huérfanos.
10. Entrega con `present_files`. Lista qué quedó "Por confirmar" (típicamente año y esquema comercial).

## Reglas de marca (resumen — detalle en references/)

- **Colores por rol**, tomados del template: primary domina, accent puntúa. Detalle en `design-system.md`.
- **Estructura sándwich**: fondo oscuro en portada/cierre/aperturas de sección; claro en el resto.
- **Fuente segura** (Calibri por defecto) para el cuerpo, garantiza render en Office. La de marca solo para títulos con holgura.
- **Motivo único**: iconos en círculos de color. Nada de barras/stripes ni subrayados bajo títulos.
- **Logo**: respeta su `logoRatio` medido del template.
- **Tarjetas translúcidas sobre oscuro**: `transparency:88` (nunca baja, o el texto blanco desaparece).
- **Sin `#` en hex; sin hex de 8 dígitos.** Viñetas con `bullet:true`.
- **Sin precios en el deck** por defecto; el documento de PropMaker conserva la parte comercial.

## QA loop (no lo omitas)

**1) QA visual**
```bash
python /mnt/skills/public/pptx/scripts/office/soffice.py --headless --convert-to pdf Propuesta_<Cliente>.pptx
rm -f slide-*.jpg && pdftoppm -jpeg -r 110 Propuesta_<Cliente>.pdf slide
```
Revisa cada `slide-*.jpg` con el tool `view` (idealmente un subagente con ojos frescos). Prioriza:
- **Texto blanco sobre tarjeta translúcida casi blanca** (sube `transparency` a 88).
- **Texto desbordado** de su caja (acorta o agranda).
- **Contraste del logo** sobre el fondo oscuro (si el logo es oscuro, usa variante clara o recuadro).
- Solapes, márgenes < 0.5", columnas desalineadas, placeholders olvidados.

**2) Grep de tokens huérfanos** (bloqueante — no entregues si algo aparece)
```bash
# placeholders sin rellenar
grep -n '«' scripts/build_deck.js && echo "FALTAN PLACEHOLDERS ✗" || echo "sin placeholders ✓"
# residuos del ejemplo Gentera/MoveMinds (jamás deben salir en un deck real)
python /mnt/skills/public/pptx/scripts/office/unpack.py Propuesta_<Cliente>.pptx _qa_check >/dev/null
grep -rniE 'Gentera|MoveMinds|Rafael Maldonado|Scotiabank|Banorte|Camilo|Ailín|27,000|76%' _qa_check/ppt/slides && echo "RESIDUO DEL EJEMPLO ✗" || echo "sin residuo del ejemplo ✓"
rm -rf _qa_check
```

Arregla, re-renderiza solo lo afectado, detente tras un ciclo salvo defecto nuevo visible.

## Archivos del skill

```
pptx-proposal-deck/
├── SKILL.md                         (este archivo)
├── references/
│   ├── brand-extraction.md          cómo sacar paleta/fuente/logo de cualquier template → BRAND
│   ├── design-system.md             reglas de diseño por rol (agnósticas de marca)
│   ├── slide-catalog.md             los ~14 slides y el patrón de cada uno (modo B)
│   ├── propmaker-narrative-map.md   mapa: ProposalBrief / documento de PropMaker → los slides
│   ├── template-replication.md      MODO A: medir y reconstruir el template exacto
│   └── build-guide.md               helpers, layouts, trampas de QA, iconos, comandos
├── scripts/
│   ├── build_deck.js                (modo B) implementación de referencia (edita BRAND + CONTENT)
│   ├── example_deck_gentera.js      (modo B) EJEMPLO completo y resuelto (referencia, no copiar)
│   ├── inspect_template.py          (modo A) mide el template → template_spec.json + assets/
│   ├── replica_deck.js              (modo A) andamio de reconstrucción (edita ASSETS + CONTENT)
│   ├── setup.sh                     instala dependencias (npm + pip)
│   ├── extract_brand.sh             inspecciona colores/fuentes/imágenes de un template
│   ├── gen_background.py            fondo degradado en el color primario de la marca
│   └── gen_icons.js                 iconos PNG en los colores de la marca (parametrizado)
└── assets/                          (vacío en el skill; se genera por cliente — ver assets/README.md)
```

## Dependencias

`bash scripts/setup.sh` instala lo necesario: npm (`pptxgenjs sharp react react-dom react-icons`) + pip (`Pillow`, `python-pptx`). Para QA se usan LibreOffice (`soffice`) + Poppler (`pdftoppm`) y el skill público `pptx` en `/mnt/skills/public/pptx` (`rezip.py`, `unpack.py`, `office/soffice.py`, `thumbnail.py`) — presentes en el contenedor de Claude Code cloud. Para replicar un template con su fuente (p.ej. Open Sans) fielmente en el QA, instálala en el entorno.

## Ejemplo de disparo

**Input:** "Aquí está la propuesta de PropMaker para [cliente] (o su brief) y mi template de marca. Genérame el deck."
**Acción:** `setup.sh` → extraer marca del template → mapear la narrativa (ProposalBrief/documento) a los ~14 slides vía `propmaker-narrative-map.md` → editar `BRAND` + `CONTENT` en `build_deck.js` → generar → QA visual + grep de tokens → entregar `.pptx` + pendientes por confirmar.
