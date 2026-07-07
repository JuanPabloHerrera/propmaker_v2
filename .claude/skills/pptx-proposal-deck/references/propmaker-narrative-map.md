# Mapa: narrativa de PropMaker → los slides del deck

Este skill NO reinventa la narrativa. Toma **la narrativa que ya produjo PropMaker**
(el `ProposalBrief` revisado y/o el documento de propuesta) y la renderiza con el
diseño de este deck. El **documento** de propuesta de PropMaker se queda tal cual; lo
que cambia es cómo se ve la versión **.pptx**.

> Regla base: **el `CONTENT` de `scripts/build_deck.js` se llena desde estas fuentes.**
> Si una fuente no aporta algo, se omite el slide o se marca «Por confirmar». Nunca
> inventes datos ni precios.

> **El deck se adapta al contenido — no siempre son 14 slides.** El número de slides
> sale del `CONTENT` que llenes: `useCases` de cualquier longitud, y las secciones
> opcionales (`context`, `methodology`, `demo`, `security`, `scope`) puestas en `null`
> se omiten. Ver "Regla de adaptación" abajo.

---

## Contrato de entrada (qué le das al agente)

1. **`ProposalBrief`** (fuente primaria — es la columna vertebral del deck). Es el
   objeto que PropMaker persiste en `meetings.proposal_brief`. Campos:
   `overview`, `clientGoals[]`, `priorities[]` (deliverables priorizados),
   `scope[]`, `outOfScope[]`, `recommendedProducts[]`, `budgetNotes`,
   `timelineNotes`, `openQuestions[]`.
2. **Documento de propuesta** (Markdown/Tiptap de `proposals.content_json`) —
   secciones fijas: *Executive Summary, Priorities & Key Deliverables, Scope of Work,
   Timeline & Milestones, Recommended Line Items, Budget & Pricing*. Úsalo para prosa
   que el brief no detalla.
3. **Template de marca `.pptx`** — para extraer paleta, fuente, logo y ratio
   (`references/brand-extraction.md`).
4. **Identidad del proveedor** (de `user_profiles`): `company_name`, `tagline`,
   `industry`, `logo_url`, `brand_colors`, `signature_name`, `signature_title`.
5. **Metadatos de reunión** (opcional): `client_company`, fecha/responsable del
   próximo hito, y el resumen/contexto de la reunión para lo que el brief no cubra.

**Idioma:** el de la propuesta (por defecto español). **Precios:** no van en el deck
por defecto (ver abajo).

---

## Mapa primario: `ProposalBrief` → sección de `CONTENT`

| Campo del brief | Alimenta la sección | Clave en `CONTENT` |
|---|---|---|
| `overview` | Portada (subtítulo) · Contexto y retos (intro) | `cover.subtitle`, `context.intro` |
| `clientGoals[]` | **Necesidades del cliente (citadas)** — ancla del alcance · pilares de portada | `needs.items[*][2]`, `cover.pillars` |
| `priorities[]` (deliverables priorizados) | **`useCases[]`: 1 tarjeta en el overview "La solución" + 1 slide de detalle por prioridad.** La espina del deck; respeta el orden. | `useCases[]` (+ `solution`) |
| `scope[]` | Alcance · detalle de casos de uso | `scope.items`, `useCases[*]` |
| `outOfScope[]` | Alcance — qué NO incluye | `scope.items` |
| `recommendedProducts[]` | Capacidades en Quiénes somos · soluciones de necesidades | `provider.verticals`, `needs.items[*][3]` |
| `timelineNotes` | Metodología · Próximos pasos | `methodology.steps`, `nextSteps.sessionDate/Time` |
| `budgetNotes` | **No se muestra en el deck** (precios diferidos). Va como acuerdo en Próximos pasos: "definir esquema comercial en fase técnica". | `nextSteps.steps` (último) |
| `openQuestions[]` | Próximos pasos / marcar «Por confirmar» | `nextSteps.steps` |

**Identidad del proveedor** (`user_profiles`) → Quiénes somos, Seguridad/infra, Cierre:
`provider.*`, `security.*`, `close.*`, `meta.author/company`, y el logo/`logoRatio` en `BRAND`.

**Metadatos de reunión** → Próximos pasos: fecha/hora/responsable del próximo hito
(`nextSteps.sessionDate`, `nextSteps.sessionTime`, `nextSteps.responsableName/Role`).

---

## Mapa alterno: documento de 6 secciones → sección de `CONTENT`

Si trabajas desde el documento en vez del brief:

| Sección del documento | Sección de `CONTENT` |
|---|---|
| Executive Summary | `cover` + `context` |
| **Priorities & Key Deliverables** | `solution` + `useCases[]` (1 por prioridad) |
| Scope of Work | `needs` + `scope` |
| Timeline & Milestones | `methodology` + `nextSteps` |
| Recommended Line Items | **omitido** en el deck (precios diferidos) |
| Budget & Pricing | **omitido** en el deck (precios diferidos) |

`provider` (Quiénes somos), `security` y `close` provienen de la identidad del proveedor,
no del documento.

---

## Regla de adaptación (cuántos slides)

El deck se ajusta a lo que traiga la narrativa:

- **Casos de uso = prioridades.** `CONTENT.useCases` lleva **una entrada por
  `ProposalBrief.priorities`** (o por deliverable de *Priorities & Key Deliverables*). N
  prioridades → N slides de detalle + N tarjetas en el overview. El orden se respeta.
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
- **No inventes.** Lo que el brief/propuesta no traiga se omite o queda «Por confirmar»
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
  BODY del `template_spec.json`) con lo que corresponda de la narrativa: `overview`/`clientGoals`
  donde el template hable de contexto/valor, `priorities`/`scope` donde liste soluciones, etc.
- Mismas reglas: **sin precios** por defecto, **no inventes** (lo que falte se omite o va
  «Por confirmar»), vocabulario del proveedor.

## Después de llenar `CONTENT`

Sigue el flujo de `SKILL.md`: `node scripts/build_deck.js` (o `DRY_RUN=1 node …` para ver el
nº de slides) → `rezip.py` → **QA visual** + **grep de tokens huérfanos** (ningún `«`, ni
"Gentera/MoveMinds" del ejemplo, en la salida).
