# Mapa: narrativa de PropMaker → los slides del deck

Este skill NO reinventa la narrativa. Toma **el documento de propuesta que ya produjo
PropMaker** (Markdown/Tiptap de `meeting_documents.content_json`, generado en un solo
paso desde la reunión) y lo renderiza con el diseño de este deck. El **documento** de
propuesta de PropMaker se queda tal cual; lo que cambia es cómo se ve la versión
**.pptx**. (Nota: el antiguo `ProposalBrief` intermedio ya no existe en PropMaker.)

> Regla base: **el `CONTENT` de `scripts/build_deck.js` se llena desde estas fuentes.**
> Si una fuente no aporta algo, se omite el slide o se marca «Por confirmar». Nunca
> inventes datos ni precios.

> **El deck se adapta al contenido — no siempre son 14 slides.** El número de slides
> sale del `CONTENT` que llenes: `useCases` de cualquier longitud, y las secciones
> opcionales (`context`, `methodology`, `demo`, `security`, `scope`) puestas en `null`
> se omiten. Ver "Regla de adaptación" abajo.

---

## Contrato de entrada (qué le das al agente)

1. **Documento de propuesta** (fuente primaria — es la columna vertebral del deck).
   Markdown/Tiptap de `meeting_documents.content_json` (`doc_type='proposal'`) —
   secciones fijas: *Executive Summary, Priorities & Key Deliverables, Scope of Work,
   Timeline & Milestones, Recommended Line Items, Budget & Pricing* (los títulos van
   en el idioma del documento).
2. **Template de marca `.pptx`** — para extraer paleta, fuente, logo y ratio
   (`references/brand-extraction.md`).
3. **Identidad del proveedor** (de `user_profiles`): `company_name`, `tagline`,
   `industry`, `logo_url`, `brand_colors`, `signature_name`, `signature_title`.
4. **Metadatos de reunión** (opcional): `client_company`, `context_summary`,
   fecha/responsable del próximo hito, y el idioma del documento
   (`meeting_documents.language`).

**Idioma:** el del documento (`language`; por defecto español). **Precios:** no van
en el deck por defecto (ver abajo).

---

## Mapa primario: documento de 6 secciones → sección de `CONTENT`

| Sección del documento | Sección de `CONTENT` |
|---|---|
| Executive Summary | `cover` (subtítulo) + `context` (intro) |
| **Priorities & Key Deliverables** | **`solution` + `useCases[]` (1 tarjeta en el overview + 1 slide de detalle por bullet).** La espina del deck; respeta el orden de los bullets. |
| Scope of Work (incl. "Out of scope") | `needs` + `scope.items` |
| Timeline & Milestones | `methodology.steps` + `nextSteps.sessionDate/Time` |
| Recommended Line Items | **omitido** en el deck (precios diferidos) |
| Budget & Pricing | **omitido** en el deck (precios diferidos). Va como acuerdo en Próximos pasos: "definir esquema comercial en fase técnica". |

Las **necesidades citadas del cliente** salen de lo que el Executive Summary y el
Scope atribuyen al cliente (y del `context_summary` de la reunión): úsalo con las
palabras del cliente en `needs.items[*][2]` y `cover.pillars`.

**Identidad del proveedor** (`user_profiles`) → Quiénes somos, Seguridad/infra, Cierre:
`provider.*`, `security.*`, `close.*`, `meta.author/company`, y el logo/`logoRatio` en `BRAND`.

**Metadatos de reunión** → Próximos pasos: fecha/hora/responsable del próximo hito
(`nextSteps.sessionDate`, `nextSteps.sessionTime`, `nextSteps.responsableName/Role`).

---

## Regla de adaptación (cuántos slides)

El deck se ajusta a lo que traiga la narrativa:

- **Casos de uso = prioridades.** `CONTENT.useCases` lleva **una entrada por bullet de
  *Priorities & Key Deliverables*** del documento. N prioridades → N slides de detalle +
  N tarjetas en el overview. El orden se respeta.
- **Patrón por caso.** Cada `useCase` elige `pattern`: `'flow'` (flujo + beneficios),
  `'beforeAfter'` (hoy vs. con-proveedor + dimensiones) o `'features'` (features + escala).
  Elige el que mejor cuente ese deliverable (ver `references/slide-catalog.md`).
- **Secciones opcionales.** Incluye `context`, `methodology`, `demo`, `security` y `scope`
  **solo si la narrativa las sustenta**; si no, ponlas en `null` y su slide no se genera.
  Ejemplos: sin demo en la reunión → `demo: null`; prospecto no regulado y sin requisitos de
  gobierno → `security: null`.
- **Grids adaptables.** Las filas (retos, necesidades, pasos, dimensiones, features de
  seguridad) se ajustan al número de elementos; 2–5 por fila se ven bien. La QA visual
  confirma que nada se desborde.
- **Siempre presentes:** portada, necesidades, quiénes somos, overview + ≥1 caso, próximos
  pasos y cierre.

---

## Reglas del "mix" (consistencia deck ↔ documento)

- **Cita al cliente en Necesidades.** Usa `clientGoals[]` con las palabras del cliente; es lo
  que legitima el alcance.
- **Sin precios en el deck.** El documento conserva *Recommended Line Items* y *Budget &
  Pricing*; el deck NO. En Próximos pasos deja "definir el esquema comercial en la fase
  técnica" (ya viene como último paso en `CONTENT.nextSteps.steps`).
- **No inventes.** Lo que el documento no traiga se omite o queda «Por confirmar»
  (año de la propuesta, fecha exacta del hito, esquema comercial).
- **Vocabulario del proveedor.** Renombra capacidades ("avatares/agentes", etc.) según lo
  que el proveedor realmente hace, sin cambiar la estructura de slides.

---

## Modo réplica de template (Modo A)

Cuando **replicas un template exacto** (ver `references/template-replication.md`), la narrativa
NO se mapea al arco propio del skill sino a los **slides del template**:
- **Conserva los títulos del template** (salvo que la propuesta pida cambiarlos); el template
  define la estructura y el orden de los slides.
- Rellena la **zona de contenido medida** de cada slide (la caja de texto grande / placeholder
  BODY del `template_spec.json`) con lo que corresponda de la narrativa: el *Executive Summary*
  donde el template hable de contexto/valor, *Priorities & Key Deliverables* / *Scope of Work*
  donde liste soluciones, etc.
- Mismas reglas: **sin precios** por defecto, **no inventes** (lo que falte se omite o va
  «Por confirmar»), vocabulario del proveedor.

## Después de llenar `CONTENT`

Sigue el flujo de `SKILL.md`: `node scripts/build_deck.js` (o `DRY_RUN=1 node …` para ver el
nº de slides) → `rezip.py` → **QA visual** + **grep de tokens huérfanos** (ningún `«`, ni
"Gentera/MoveMinds" del ejemplo, en la salida).
