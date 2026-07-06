# Catálogo de slides — el patrón de cada slide

Arco B2B de ~14 slides que **se adapta al contenido** (no es un número fijo). Cada slide es una **función de render** en `scripts/build_deck.js` que lee de su sección de `CONTENT` (`cover`, `context`, `needs`, `provider`, `methodology`, `solution` + `useCases[]`, `demo`, `security`, `scope`, `nextSteps`, `close`). Tú llenas `CONTENT` con la narrativa; el render y el orden (en `buildDeck()`) no se tocan. Si la propuesta no aporta algo, omítelo o marca "Por confirmar" — no inventes.

> **El deck se adapta:** `useCases[]` genera 1 slide de caso por entrada (N cualquiera), y las secciones **OPCIONALES** (`context`, `methodology`, `demo`, `security`, `scope`) se **omiten** si las pones en `null`. Los números de slide se recalculan solos.

> **Qué va en cada slide desde la narrativa de PropMaker** (`ProposalBrief` / documento): ver `references/propmaker-narrative-map.md`. Este catálogo describe el **patrón** de cada slide; el mapa dice **de dónde sale el contenido**.

Convención: **[FIJO]** = plantilla estable · **[DE LA REUNIÓN]** = de la narrativa/propuesta (brief o documento) · **[DE TU EMPRESA]** = datos de quien presenta (el proveedor) · **(opcional)** = `null` omite el slide.

---

### 1 · Portada  (fondo oscuro) · `cover`
- [FIJO] Logo (del proveedor), kicker tipo "PROPUESTA DE SOLUCIÓN…", pie "<Proveedor> · <mes año> · Confidencial".
- [DE LA REUNIÓN] Título grande (tema central), subtítulo (una frase con las líneas de solución + nombre del cliente y área) y N pilares con icono (uno por caso de uso/eje).

### 2 · Contexto y retos  (claro) · `context` · **(opcional)**
- [DE LA REUNIÓN] Intro de 1-2 líneas sobre la situación del área. 3 tarjetas de contexto/dolor + panel con los cuellos de botella nombrados por el cliente. Texto corto por tarjeta (cabe ~2-3 líneas).

### 3 · Necesidades / objetivos del cliente  (claro) · `needs` ← ancla del alcance
- [DE LA REUNIÓN] Las necesidades **en palabras del cliente** (si dieron lista/lámina, cítala). Una tarjeta por necesidad: etiqueta, enunciado del cliente, "Solución: <línea del proveedor>" y 2 bullets. Pie: "Fuente: necesidades definidas por el cliente (<cliente>)". Este slide amarra necesidad → solución.

### 4 · Quiénes somos / La propuesta  (claro) · `provider`
- [DE TU EMPRESA] Qué hace el proveedor (2 verticales/capacidades), sobre qué construye (infra, enfoque a la medida, confidencialidad/NDA).
- [DE LA REUNIÓN/EMPRESA] Clientes o experiencia relevante al **sector del prospecto**. Anonimiza si el prospecto es regulado y lo prefieren.

### 5 · Cómo trabajamos / Metodología  (claro) · `methodology` · **(opcional)**
- [DE TU EMPRESA] Timeline de 4 pasos (definición → configuración → piloto → lanzamiento) + una banda con el modelo/metodología distintiva del proveedor (proporciones, fases, o el marco que sea).

### 6 · Los casos de uso — overview  (fondo oscuro) · `solution` + `useCases[]` ← apertura "La solución"
- [DE LA REUNIÓN] Una tarjeta translúcida **por cada `useCase`**: `num`, `icon`, `needRef` ("Necesidad X"), `title` y `overviewText`. Las tarjetas se generan automáticamente desde `useCases`; la grid se ajusta a N. Mapea cada caso a la necesidad que resuelve. (transparency:88.)

### 7…(N) · Un slide por caso de uso  (claro) · `useCases[]` (uno por entrada)
Cada entrada de `useCases` genera un slide de detalle; su campo **`pattern`** elige el layout:
- **`'flow'` — Flujo + beneficios**: pasos numerados conectados a la izquierda; a la derecha un stat destacado (oscuro) + lista "Qué resuelve" con checks.
- **`'beforeAfter'` — Antes/Después + dimensiones**: tarjeta "HOY" (tinte) vs "CON <PROVEEDOR>" (oscuro), y fila de 3-4 tarjetas de capacidades (`dims`).
- **`'features'` — Features + escala**: filas de feature con icono + panel oscuro con números de escala y una frase de reemplazo del modelo actual.
> **N = número de prioridades/casos.** 2 casos → 2 slides; 5 casos → 5 slides. El overview (6) y los pilares de portada se ajustan solos.

### 10 · Cómo se ve en la práctica / demo  (claro) · `demo` · **(opcional)**
- [DE LA REUNIÓN si hubo demo] Narra la demo. Fila de criterios/competencias, panel "Reporte/entregable individual", panel de métricas y un stat de resultado. Si no hubo demo, reemplaza por un "cómo funciona" genérico.

### 11 · Seguridad, infraestructura y gobierno  (fondo oscuro) · `security` · **(opcional)**
- [DE TU EMPRESA] 4 tarjetas de seguridad/infra (entorno, nube/compliance, certificaciones, confidencialidad) + panel de acento "Complementar o integrar" (encaje con capacidades internas del cliente).
- [DE LA REUNIÓN] Panel "Puntos de gobierno a definir" con lo que pidió el área técnica del cliente; regulación aplicable al prospecto.

### 12 · Alcance y aclaraciones  (claro) · `scope` · **(opcional)**
- [DE TU EMPRESA/REUNIÓN] Grid de 2 columnas con los límites y condiciones del servicio (qué incluye/no, tiempos de configuración, piloto, adaptabilidad, integración, personalización). El número de tarjetas se ajusta a `scope.items`.

### 13 · Próximos pasos  (claro) · `nextSteps`
- [DE LA REUNIÓN] Panel oscuro con la **próxima sesión/hito** (fecha, hora, responsable del cliente y rol). Lista numerada de acuerdos y siguientes acciones tal como se pactaron. Incluye "definir esquema comercial" si el precio queda para después.

### 14 · Cierre  (fondo oscuro) · `close`
- [FIJO] Logo centrado, una frase de valor que sintetiza la solución, "Gracias, <cliente>." y pie de marca.

---

## Reglas de mapeo

- **Sin números/precios por defecto.** Si la reunión no trae tarifas, no las pongas; deja "el esquema comercial se define en la fase técnica" en Próximos pasos.
- **Cita al cliente en Necesidades (`needs`).** Es lo que legitima el alcance.
- **Fechas**: usa el mes/año de la propuesta y la fecha real del próximo hito del resumen. Confirma el año con el usuario si hay ambigüedad.
- **El deck se adapta:** `useCases[]` = una entrada por prioridad/caso (N cualquiera); el overview (6) y los pilares de portada se ajustan solos. Las secciones opcionales (`context`, `methodology`, `demo`, `security`, `scope`) en `null` no generan slide.
- **Adapta el vocabulario al proveedor**: "avatares/agentes" es propio de un proveedor de IA; si el proveedor hace otra cosa, renombra las capacidades sin cambiar la estructura.
