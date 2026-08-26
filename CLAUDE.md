# Umbral

App web mobile-first de entrenamiento de running inteligente y adaptable.
Planifica hacia un objetivo, sigue los resultados reales (carga manual +
importación de archivos de reloj) y ajusta el plan automáticamente.

**Principio rector:** la intensidad se mide sobre todo por **percepción de
esfuerzo (RPE)** y sensaciones. La frecuencia cardíaca es un dato **secundario y
opcional**, porque el reloj del usuario mide mal las pulsaciones. Cada zona se
ancla a tres referencias —FC, pace y RPE— y el RPE es el que manda.

---

## Stack

| Capa | Elección |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS + shadcn/ui |
| Estado | Zustand |
| Gráficos | Recharts |
| Mapas | react-leaflet + Leaflet (OpenStreetMap, sin API key) |
| Backend | Supabase (Postgres + Auth email + Row Level Security) |
| Tests | Vitest |
| Deploy | Vercel |

No hay backend propio: el frontend habla directo con Supabase y el aislamiento
por usuario lo da RLS.

---

## Arquitectura

Tres capas, con una sola dirección de dependencias:

```
UI (screens + components)                    ← src/screens/, src/components/
  ↓ importa
Dominio (funciones puras, sin I/O)           ← src/domain/
  ↑ no importa nada de UI ni de datos
Datos (repositorios hacia Supabase)          ← src/data/
```

El estado de sesión vive en Zustand (`src/store/session.store.ts`) y es la única
fuente de verdad sobre el usuario actual: las pantallas leen de ahí en lugar de
consultar Supabase por su cuenta.

Reglas que sostienen esto:

1. **`src/domain/` es puro.** Sin React, sin Supabase, sin `fetch`, sin `Date.now()`
   escondido. Mismas entradas → mismas salidas. Por eso se puede testear entero
   sin mocks.
2. **Todos los parámetros de metodología viven en `src/domain/config.ts`.** Si un
   número de la metodología aparece en otro archivo, es un bug. Recalibrar la
   metodología tiene que ser tocar un solo archivo.
3. **La UI importa desde `src/domain` (el barrel)**, nunca de archivos internos.
4. **El motor de reglas es determinista y explica sus decisiones** en lenguaje
   natural. La capa LLM que redacte el coaching más natural se enchufa después,
   detrás de una interfaz; en el MVP son plantillas de texto.

### Dónde está cada cosa

| Archivo | Qué contiene |
| --- | --- |
| `src/domain/config.ts` | **Todas las tablas de metodología.** Zonas Friel, Tablas 3-7, esquemas de mesociclo, escalas de RPE y sensación, protocolo de calibración, umbrales de adaptación. |
| `src/domain/types.ts` | Tipos del dominio. Incluye `Discipline` y la entidad genérica de sesión. |
| `src/domain/zones.ts` | `calcularLTHR`, `calcularPaceUmbral`, `generarZonasFC`, `generarZonasPace`, `zonaPorRPE`, `zonaPorFC`. |
| `src/domain/rules.ts` | `validarMicrociclo`, `repararMicrociclo`, `reordenarPorSesionOmitida`. Las reglas R1-R4. |
| `src/domain/progression.ts` | Tabla 7: `calcularIncrementoSemanal`, `aplicarProgresion`, `proyectarVolumen`. |
| `src/domain/planner.ts` | `generarMacrociclo`, `generarMesociclo`, `generarMicrociclo`, `nivelPorObjetivo`, `feasibilidadObjetivo`. |
| `src/domain/trainingDays.ts` | Días entrenables elegidos por el corredor: acomoda las sesiones de la Tabla 4 sobre esos días respetando R1-R4. |
| `src/domain/planEdit.ts` | Edición manual del plan: mover/intercambiar una sesión y adelantar un mesociclo. |
| `src/domain/calendar.ts` | `calendarizarPlan`: aterriza la numeración abstracta del plan en fechas reales. |
| `src/domain/sessionAnalysis.ts` | Carga metabólica, distribución por zona y comparación plan vs. real. |
| `src/domain/homeostasis.ts` | Modelo de fatiga/forma y estado de supercompensación. |
| `src/domain/analysis.ts` | Caja negra (progreso a igual pace) y serie de balance. |
| `src/domain/adaptation.ts` | **Motor de adaptación.** Los casos de la metodología, con su explicación. |
| `src/domain/vision.ts` | Interfaz conectable para leer capturas del reloj. |
| `src/domain/import/` | Parsers TCX/GPX/KML, Haversine, splits, cadencia, reconciliación de distancia. |
| `supabase/schema.sql` | Tablas, tipos, RLS, trigger de alta de perfil y bucket de Storage. |
| `src/data/` | Repositorios hacia Supabase. Traducen filas ↔ dominio y los errores al español. |
| `src/store/session.store.ts` | Estado de sesión: usuario, perfil, umbral, objetivo y plan. |
| `src/screens/` | Pantallas. |
| `src/lib/format.ts` | Formateo y parseo de tiempos, paces y fechas. |
| `src/index.css` | Tokens de color del design system (variables CSS) y clases base. |
| `tailwind.config.ts` | Tipografías, escala hero, colores de zona, radios. Medido de `design-reference/`. |
| `design-reference/` | **Los HTML y PNG de Stitch.** La fuente de verdad del diseño. |

**El barrel de dominio (`src/domain/index.ts`) NO reexporta `./import`** a
propósito: arrastra el parser de XML, que sólo hace falta en las pantallas de
importación. Quien lo necesite importa de `@/domain/import`.

Por la misma razón, **`RegistrarScreen` y `SesionDetalleScreen` se cargan con
`lazy()`** en el router: son las dos que arrastran el parser de XML y Leaflet.
Entre las dos cosas son ~275 kB que no tienen por qué estar en el arranque
(bundle principal: 757 kB si se importan directo, 495 kB con el corte).

### Pantallas y rutas

| Ruta | Pantalla | Qué hace |
| --- | --- | --- |
| `/hoy` | Dashboard | Sesión de hoy, anillo de progreso semanal, próximo reto. |
| `/plan` | Macrociclo | El plan completo, agrupado por mesociclo. |
| `/plan/mesociclo/:index` | Mesociclo | Las semanas de un mesociclo con su carga. |
| `/plan/semana/:numero` | Microciclo | Los 7 días de la semana; se usa entrenando. |
| `/registrar` | Registro | Importar TCX/GPX/KML o cargar a mano. RPE protagonista. |
| `/sesion/:id` | Detalle | Mapa, splits, cadencia, distribución por zona. |
| `/zonas` | Mis Zonas | Las 7 zonas con RPE, pace y FC. |
| `/umbral` | Umbral | Test o carga directa. |
| `/objetivo` | Objetivo | Definir objetivo y generar el plan. |
| `/ajustes` | Re-calibración | Los ajustes del motor, con el diff antes/después. |
| `/complementaria` | Complementaria | Fuerza, fútbol, bici: carga que no es correr. |
| `/sesion/:id/imagen` | Captura | Adjuntar la foto del reloj y confirmar lo detectado. |
| `/analisis` | Caja Negra | Los cinco gráficos de progreso. Lazy. |
| `/volumen` | Volumen | Planificado vs. corrido, tendencia y descargas. Lazy. |
| `/calendario` | Calendario | Heatmap mensual navegable. Se arrastra para mover entrenos y se saltean desde acá. Lazy. |
| `/onboarding`, `/config` | Perfil | Datos del corredor. |

La navegación inferior tiene **cuatro destinos como máximo** (Hoy, Plan,
Análisis, Perfil): en mobile, una barra con más de cuatro íconos se vuelve imposible de
acertar con el pulgar. En desktop (md+) esa barra desaparece y la reemplaza una
**sidebar fija de 256px**, que no tiene esa restricción: ahí entran también
Calendario y Volumen.

Fuera de las rutas raíz, el layout muestra un **botón de volver**
(`BotonVolver`): en el app bar en móvil y sobre el contenido en desktop. Si no
hay historial propio —se entró por link directo— cae al padre que la ruta
declara, en vez de sacar al usuario de la app.

---

## Metodología: dónde está cada tabla

Todas en `src/domain/config.ts`.

| Tabla | Constante | Qué define |
| --- | --- | --- |
| Zonas Friel (7) | `ZONES` | %LTHR, rango de RPE, test del habla y color por zona. |
| Factores de pace | `PACE_ZONE_FACTORS` | Multiplicadores del pace umbral por zona. |
| Test de umbral | `THRESHOLD_TEST` | Correcciones de los tests de 30/20 min y factor 1.05 del pace. |
| Tabla 3 | `LEVEL_TABLE` | Días/semana según el tiempo objetivo, en las cuatro distancias. |
| Tabla 4 | `MICROCYCLE_TEMPLATES` | Plantillas de microciclo para 3, 4, 5 y 6 días. |
| Tabla 5 | `MESOCYCLE_SCHEMES` | Esquemas 1:1, 2:1 y 3:1. **Default: 3:1.** |
| Tabla 6 | `MACROCYCLE_TABLE` | Semanas de base, totales y descanso post-carrera por distancia. |
| Tabla 7 | `PROGRESSION_TABLE` | Km a sumar por semana según ritmo base y distancia. |
| RPE / sensación | `RPE_SCALE`, `FEELING_SCALE` | Escalas 1-10 y 1-5. |
| Calibración | `RPE_CALIBRATION_PROTOCOL` | Bloques guiados de sensibilización de RPE. |
| Adaptación | `ADAPTATION_CONFIG` | Umbrales que disparan cada caso del motor. |
| Homeostasis | `HOMEOSTASIS_CONFIG` | Constantes de fatiga y forma, y umbrales de estado. |
| Complementarias | `COMPLEMENTARY_ACTIVITIES` | Actividades y su factor de carga. |

### Reglas inquebrantables del microciclo (`rules.ts`)

- **R1** — después de F, sólo R o D (nunca E).
- **R2** — prohibido dos E consecutivos (siempre R o D en medio).
- **R3** — los R son comodines: se mueven de día para reparar la semana.
- **R4** — mínimo 1 D absoluto por semana.

Ninguna semana generada, reordenada o adaptada puede violarlas.

### Decisiones tomadas al transcribir la metodología

Tres puntos donde las tablas de origen tenían ambigüedades o huecos, resueltos
explícitamente y cubiertos por tests:

1. **Zonas contiguas.** Friel enuncia los rangos con enteros (Z2 85-89, Z3
   90-94), lo que deja sin clasificar una FC al 89.5% de la LTHR. Internamente
   las zonas usan intervalos semiabiertos `[min, max)`; el enunciado original se
   conserva en `lthrLabel` para mostrarlo en la UI.
2. **Plantilla de 6 días.** La Tabla 4 la da como `R E R E E D F`, que viola R2
   (dos E pegados). Se transcribe fiel a la tabla y `generarMicrociclo` la repara
   antes de usarla, conservando la carga.
3. **Progresión conservadora por defecto.** La Tabla 7 da rangos. El default es
   el **piso** del rango, que es lo que reproduce el ejemplo canónico (10K ritmo
   Promedio → 20, 22, 24, descarga). Ir al techo es una decisión explícita
   (`agresividad: 'maximo'`), y con fatiga externa siempre gana el piso.

---

## Base de datos

Siete tablas en `supabase/schema.sql`, todas con Row Level Security:

| Tabla | Qué guarda |
| --- | --- |
| `profiles` | Perfil del corredor. La crea sola el trigger `handle_new_user`. |
| `thresholds` | **Historial** de umbral. El vigente es el de `tested_at` más reciente. |
| `goals` | Objetivos de carrera. Índice parcial: uno solo activo por usuario. |
| `plans` | Plan generado. Guarda los parámetros de entrada además del resultado. |
| `plan_weeks` | Microciclos, con su lunes en `starts_on`. |
| `plan_days` | Días planificados, con su fecha en `scheduled_on`. |
| `sessions` | **Lo que realmente pasó.** Genérica, con `discipline`. |
| `adaptations` | Decisiones del motor, con el antes y el después de la semana. |

Decisiones que conviene no revertir sin pensarlo:

- **RLS no es una capa de más, es LA capa.** No hay backend propio: el navegador
  habla directo con Postgres con una clave pública. Las políticas se generan en
  un bucle sobre la lista de tablas para que ninguna quede sin cubrir.
- **Las zonas no se guardan.** Se derivan del umbral en el dominio. Persistirlas
  sería duplicar la metodología en la base y arriesgarse a que quedaran
  desincronizadas al recalibrar `config.ts`.
- **El plan se marca `is_active` al final.** No hay transacciones desde el
  navegador, así que un guardado interrumpido queda invisible en lugar de
  aparecer a medias.
- **Plan y realidad viven separados.** `plan_days` es lo planificado, `sessions`
  lo que pasó, y se vinculan por `sessions.plan_day_id`. De esa comparación vive
  el motor de adaptación.

### Multidisciplina: los cimientos ya están

No hay features de gimnasio en el MVP, pero el modelo no las excluye:

- La entidad base es una **sesión genérica** con `discipline: 'running' |
  'strength' | 'other'`. El MVP sólo implementa `'running'`.
- La **carga metabólica es un concepto unificado** (`sessions.metabolic_load`):
  cualquier sesión, de cualquier disciplina, aporta al modelo de homeostasis y
  recuperación. Las actividades complementarias entran por ese mismo mecanismo.
- La tabla se llama `sessions`, no `runs`, y todas sus columnas de running son
  nullable. Cuando llegue el módulo de fuerza **no hace falta migrar nada**: se
  agrega una tabla hija `strength_sets` que referencia `sessions`. El lugar
  exacto está marcado con un comentario en el SQL.

---

## Identidad visual

**La fuente de verdad es `design-reference/`**, no este resumen ni el brief
original. Son los HTML y los PNG que exportó Stitch. Cuando haya que decidir un
tamaño, un espaciado o un radio, se mide del HTML correspondiente — sobre todo
de `dashboard_minimalista`, `esta_semana_minimalista` y
`registro_actividad_minimalista_claro`, que son las tres pantallas contra las
que se calibró el sistema.

Modo oscuro por defecto, UI en español.

### Tipografías

| Uso | Familia | Tamaño |
| --- | --- | --- |
| Números protagonistas | Archivo Black | 40 / 56 / **96** px, `-0.04em` |
| Títulos y nombres de sesión | **Archivo Black** | 28px (`u-title`), 18px (`u-title-sm`) |
| Wordmark y botón principal | Space Grotesk | 24px, 700, `tracking-tighter` |
| Labels | **JetBrains Mono** | 11px, `0.1em`, 600, mayúscula |
| Datos numéricos | JetBrains Mono | 18px / 14px, 500 |
| Cuerpo | Inter | 14px / 16px |

Dos diferencias con el brief textual de la Fase 1, tomadas del diseño real:

- **Los títulos son Archivo Black, no Space Grotesk.** Space Grotesk queda para
  el wordmark y el botón principal, nada más.
- **La mono es JetBrains Mono, no IBM Plex Mono.** Es la que usan las dos
  pantallas oscuras de referencia, que definen el tema por defecto.

### Composición

- **Casi no hay cajas.** Los bloques no llevan fondo ni borde: se separan con
  32px de aire (`gap-section`) y 48px entre bloques grandes del dashboard
  (`gap-block`). `u-panel` existe pero casi no se usa.
- **Los únicos bordes** son el `border-b` que separa filas de una lista
  (`u-row`) y el del app bar.
- **Radio de 8px como máximo**, y buena parte de los controles no lleva radio:
  el botón principal, los chips y los botones de sensación son rectángulos. El
  "16px" del brief textual no coincidía con el diseño.
- **Margen lateral de 20px** (`px-edge`).
- **Jerarquía de dos niveles**: un dato hero grande + un texto secundario chico.
- **Un solo acento por pantalla.** El lima siempre viene con halo
  (`shadow-glow`): barras de progreso, la barra vertical de la sesión dura, el
  badge del tipo de entrenamiento. Es la única decoración del sistema.

### Colores

Fondo `#0B0E13` · superficie `#151A22` · superficie alta `#252A33` · borde
`#232B36` · texto `#F4F6F8` · secundario `#9AA7B4` · **outline `#8E937C`** (el
gris verdoso de las labels) · acento `#CDFF4F` · acento apagado `#A7D626`.

Zonas: Z1 `#5B6B7A` · Z2 `#2FB6C4` · Z3 `#54C48A` · Z4 `#F2B43D` ·
Z5a `#F58A3C` · Z5b `#EF5F3C` · Z5c `#E23B4E`.

### Utilidades

En `src/index.css`: `.u-hero` / `.u-hero-lg` / `.u-hero-sm`, `.u-unit`,
`.u-title` / `.u-title-sm`, `.u-wordmark`, `.u-label`, `.u-sub`, `.u-data` /
`.u-data-sm`, `.u-section`, `.u-row`, `.u-panel`, `.u-bar` / `.u-bar-fill`.

**Los encabezados de sección van con `.u-label`**, no con `.u-title-sm`: en
Stitch son labels en mono mayúscula. Archivo Black queda para el dato o el
nombre protagonista.

---

## Importación de archivos

Prioridad **TCX > GPX > KML** (`elegirMejorFormato`).

- **TCX (principal).** Además de la ruta, trae el resumen del Lap:
  `DistanceMeters`, `TotalTimeSeconds`, `Calories`, `HeartRateBpm`,
  `AverageSpeed` y `Steps` (de ahí sale la cadencia media).
  **Nota de campo:** en los TCX del creator "Mi Fitness"/Xiaomi la FC viene sólo
  como **un valor promedio de Lap**, no como serie por trackpoint — los puntos
  traen apenas Time + Position. Por eso el análisis Pace-FC trabaja a nivel de
  **sesión**, que es justo lo que la metodología pide para el ciclo de base.
- **GPX (respaldo).** lat/lon/time. Distancia por Haversine. Puede no traer FC ni
  elevación; la app funciona igual apoyada en el RPE.
- **KML (último recurso).** Sólo geometría. Soporta `gx:Track` (con tiempos) y
  `LineString` (sin tiempos, sin pace ni splits).

La distancia calculada se **reconcilia** con la declarada por el archivo: si
difieren más del 5%, gana la del dispositivo y se avisa al usuario.

**Caso de prueba real:** `tests/fixtures/run-mifitness.tcx` — 1799 puntos a 1 Hz,
~4.5 km, ~30 min, FC media 160, 4373 pasos, 394 kcal. Se regenera con
`node scripts/generate-tcx-fixture.mjs`.

---

## Fase 6 — desktop, tema claro y plan editable

Lo que agregó esta fase, y las decisiones que conviene no revertir sin pensarlas:

**Layout de dos formas.** Móvil sigue igual (app bar + barra inferior de cuatro
destinos). En md+ aparece una sidebar fija y el contenido se suelta hasta
1280px. El ancho de página vive en **una sola clase**, `.u-page`: cambiarlo es
tocar un lugar, no dieciocho pantallas.

**Tema claro.** Segundo juego de tokens bajo `:root[data-theme='light']`, con
el tema resuelto por un script inline en `index.html` **antes** del primer
pintado — si se esperara a React, cada carga arrancaría con un flash oscuro.
Dos cosas que parecen inconsistencias y no lo son:

- El acento del tema claro es el lima **apagado** (`#A7D626`), no el brillante.
  Sobre blanco, `#CDFF4F` da 1.4:1 contra el fondo. Es lo que hacen todas las
  pantallas `*_claro` de `design-reference/`.
- El halo (`shadow-glow`) baja de 0.5 a 0.22 de opacidad en claro. Sobre blanco
  un halo lima fuerte se lee como una mancha, no como brillo. Sale de
  `--glow-strength`, así que el gesto sigue siendo el mismo en los dos temas.

**Días de entrenamiento elegibles** (`trainingDays.ts`). El corredor dice qué
días tiene libres y el plan pone las sesiones **sólo ahí**. Se respeta la
COMPOSICIÓN de la Tabla 4 (cuántas E, cuántas R, una F) y se negocia el ORDEN,
por backtracking sobre el multiconjunto de tipos. Nunca devuelve una semana que
viole R1-R4: si no hay orden legal, cae a la plantilla de tabla y **lo avisa**.

El techo es 6 días y no 7 por R4, no por la Tabla 4: la semana necesita un
Descanso absoluto, así que entrenar los siete días es inexpresable en esta
metodología. Los días elegidos mandan sobre la Tabla 3; si son menos de los que
la tabla recomienda, se genera igual y se avisa.

**Plan editable** (`planEdit.ts`), con dos operaciones y una regla común —el
plan nunca cambia en silencio:

| Operación | Qué hace |
| --- | --- |
| Mover una sesión | Arrastrar en el calendario. Si el destino está ocupado, las dos se **intercambian**: así mover no puede cambiar la carga de la semana por accidente. |
| Saltear una sesión | Es el caso "sesión omitida" del motor de adaptación, no lógica nueva: reordena lo que queda usando los R como comodines. |
| Adelantar un mesociclo | Saltea sus semanas **que todavía no arrancaron** y corre el resto hacia atrás, sin dejar hueco. Lo ya vivido no se toca. |

Mover **valida pero no prohíbe**: el resultado trae las violaciones de R1-R4
que provoque, explicadas, y la persona decide con el botón "Mover igual". El
motor automático sigue sin poder publicar una semana inválida; una persona que
sabe lo que hace, sí — pero enterándose. Adelantar avisa que saltea carga
acumulada.

**Calendario**: navegable sin tope hacia adelante (antes no dejaba ver el plan
futuro, que es la mitad de para qué existe) y en desktop el mes entra **entero**
en pantalla — la grilla toma la altura disponible y reparte seis filas iguales,
en vez de usar celdas de proporción fija que cortaban la última semana.

**Migración pendiente en Supabase.** Esta fase agrega dos columnas
(`profiles.training_days` y `plans.training_days`). Están en `schema.sql` con
`alter table … add column if not exists`, así que **hay que volver a correr
`schema.sql` en el SQL Editor** para que la selección de días funcione contra
una base ya creada.

---

## Comandos

```bash
npm install
npm run dev         # servidor de desarrollo
npm test            # 370 tests (dominio + utilidades)
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + build de producción
```

---

## Estado del plan de fases

| Fase | Alcance | Estado |
| --- | --- | --- |
| **1** | Scaffolding + design system + `config.ts` con todas las tablas + módulos de dominio (zones, import, planner, rules, progression) + tests | ✅ **Completa** |
| **2** | Supabase (`schema.sql` con sesión genérica + `discipline` + RLS + Auth) + repositorios + onboarding + umbral/zonas + objetivo + generación de plan | ✅ **Completa** |
| **3** | Importación de archivos + análisis con mapa + registro de sesión (RPE primario) + vistas macro/meso/micro + dashboard | ✅ **Completa** |
| **4** | Motor de adaptación + re-calibración + actividades complementarias + carga por imagen (`vision.ts` conectable) | ✅ **Completa** |
| **5** | Caja Negra (gráficos) + progreso de volumen + calendario + deploy Vercel + README + pulido | ✅ **Completa** |
| **6** | Layout desktop + tema claro + días de entrenamiento elegibles + calendario editable (mover/saltear) + navegación entre mesociclos y hacia atrás | ✅ **Completa** |

### Lo que la Fase 5 dejó listo

**Sistema de gráficos** (`src/lib/chart.ts`). Todos los gráficos salen de ahí:
tokens de eje/grilla/tooltip, la rampa de intensidad, la regresión lineal y el
normalizador de `ValueType` de Recharts. Reglas que la Fase 5 fijó y que hay que
respetar al agregar cualquier gráfico nuevo:

- **Un solo eje Y.** Nunca dos escalas en el mismo gráfico. Pace y FC son dos
  gráficos separados, no uno con doble eje.
- **La rampa `INTENSIDAD` está validada** (un hue, spread 3°, luminosidad
  monótona, ΔL ≥ 0.06, extremo bajo 2.01:1 sobre el fondo). Si se toca un color
  hay que volver a validarla con el script del skill de dataviz — no alcanza con
  que "se vea bien".
- **Codificación compuesta en el calendario**: el color dice magnitud, la letra
  dentro de la celda dice identidad. Ninguno de los dos hace los dos trabajos, y
  por eso el heatmap se lee sin distinguir colores.

**Caja Negra** (`/analisis`): Pace vs. RPE como gráfico principal, Pace vs. FC
como secundario y explícitamente recesivo (gris, más chico, con la advertencia
de que sólo hay que creerle si el reloj da números coherentes), curva de
supercompensación, producción de energía semanal y dispersión volumen vs.
esfuerzo.

**Registro de propuestas descartadas**: `descartarPropuesta` ya no borra la fila
— marca `dismissed_at`. Una propuesta que existió queda registrada aunque no se
haya aplicado, para poder explicar más adelante por qué una semana quedó como
quedó. El esquema tiene un check que hace excluyentes `applied_at` y
`dismissed_at`.

**Corrección de calibración del modelo de homeostasis.** El estado se clasifica
comparando el ratio fatiga/forma contra `RATIO_EQUILIBRIO`, que es el
estacionario del modelo **con la ventana truncada** —`τ × (1 − e^(−ventana/τ))`
en cada exponencial—, no contra constantes absolutas. Antes, un corredor con
nueve semanas de entrenamiento sostenido salía "sobre-descansado": con carga
constante la normalización daba 4.0 contra un umbral de 0.8, así que el estado
estacionario **nunca** podía leerse como "listo". El truncado no es un detalle:
con ventana de 42 días la fatiga (τ=7) ya llegó a su asíntota pero la forma
(τ=42) va por el 63% de la suya, y usar el equilibrio de horizonte infinito daría
1.57 para alguien que entrena perfectamente parejo. El desentrenamiento se
chequea aparte —ritmo de carga de las últimas dos semanas contra el ritmo
habitual— porque no es un punto de la misma escala: quien dejó de entrenar tiene
poca fatiga, igual que quien está en pico, y lo que los distingue no es el ratio
sino si sigue habiendo carga.

**Deploy**: `vercel.json` con el rewrite de SPA, y el README documenta el
proceso completo asumiendo que el repositorio no está conectado.

**`scripts/verificar-rls.mjs`** (`npm run verify:rls`): crea dos usuarios, los
hace escribir datos y comprueba desde uno que no puede leer, modificar, borrar
ni suplantar al otro, en las ocho tablas y en Storage. **Ya se ejecutó contra un
proyecto real y el aislamiento quedó verificado** en las ocho tablas y en
Storage. Para correrlo hace falta "Confirm email" desactivado en
Authentication → Providers → Email (si no, el registro de las cuentas de
prueba choca con el rate limit de envío de Supabase).

### Lo que la Fase 4 dejó listo

**Motor de adaptación** (`adaptation.ts`) con los casos de la metodología. Dos
invariantes que no se pueden romper y están cubiertos por tests:

1. **Toda semana propuesta pasa por `validarMicrociclo`.** Si una adaptación
   dejara la semana violando R1-R4, se descarta y se explica por qué en lugar de
   aplicarla.
2. **Toda decisión viene con su explicación en español.** El motor nunca cambia
   el plan en silencio, ni siquiera cuando decide no cambiar nada.

| Caso | Qué hace |
| --- | --- |
| Sesión omitida | Reordena lo que queda usando los R como comodines. No comprime el calendario: si se perdió un día, se perdió. |
| Carga externa | Degrada la sesión exigente que caiga dentro de la ventana de recuperación (E/F → R, nunca a D). |
| Feedback pobre | Mete una Recuperación antes del próximo Específico. |
| Buena adaptación | Confirma el progreso **sin tocar el plan**. |
| Re-test de mesociclo | Avisa que las zonas quedaron viejas. |

**Modelo de homeostasis** (`homeostasis.ts`): dos exponenciales tipo Banister —
fatiga corta, forma larga— y su diferencia normalizada por la carga media, para
que el estado no dependa del volumen absoluto del corredor. La carga externa
entra por la misma puerta que cualquier sesión: no hay parámetro aparte para
las complementarias, y eso es la característica.

**Caja negra** (`analysis.ts`): compara el RPE a igual pace entre las sesiones
antiguas y las recientes. La FC entra sólo como confirmación; si contradice al
RPE, se ignora.

**`vision.ts`**: interfaz conectable con tres reglas — lo detectado nunca se
guarda solo, cada campo trae su confianza, y la app funciona sin proveedor
configurado. Hoy el proveedor por defecto es "no configurado" y falla con un
mensaje que ofrece cargar a mano.

**Pantallas nuevas**: `/ajustes` (re-calibración con el diff antes/después),
`/complementaria` (actividades que no son correr) y `/sesion/:id/imagen`
(captura del reloj con campos editables). El dashboard suma el estado de
recuperación y el aviso de ajustes pendientes.

**323 tests.** Los nuevos incluyen un test de integración que corre los tres
casos que tocan el plan sobre **todas** las semanas que produce el generador,
para cada día posible: es donde aparecen las combinaciones que uno no pensó al
escribir el caso.

### Lo que la Fase 4 NO incluye (a propósito)

Caja Negra como pantalla con gráficos, progreso de volumen, calendario heatmap y
deploy. Fase 5. Un proveedor de visión real: la interfaz está, la
implementación se enchufa cuando haya una API configurada.

### Lo que la Fase 3 dejó listo

- **Importación real** de TCX/GPX/KML desde la pantalla de registro: el archivo
  autocompleta distancia, tiempo, FC media y cadencia, y guarda la traza.
- **Mapa Leaflet** (`RouteMap`) sobre OpenStreetMap, sin API key.
- **Registro de sesión** con el RPE como slider protagonista y la sensación en
  caritas. El archivo sólo llena los campos objetivos: el RPE y la sensación los
  escribe siempre la persona.
- **Detalle de sesión**: mapa, RPE/sensación primero, datos objetivos después,
  distribución por zona y tabla de splits.
- **Navegación del plan** en tres niveles: macrociclo (`/plan`) → mesociclo
  (`/plan/mesociclo/:index`) → microciclo (`/plan/semana/:numero`).
- **Dashboard** (`/hoy`): sesión de hoy, anillo de progreso semanal y próximo reto.
- `sessionAnalysis.ts`: carga metabólica, distribución por zona y comparación
  plan vs. real.
- **253 tests.** Los 24 nuevos cubren `zonaPorPace`, `sessionAnalysis` y un test
  de integración del pipeline completo (importar → derivar → analizar) sobre el
  TCX real de Xiaomi, que es donde aparecen los desajustes de unidades que
  ningún test unitario ve.

Verificado en navegador con Playwright: las siete pantallas renderizan sin
errores JS, y subir el TCX real autocompleta los cinco campos y dibuja la ruta.

### Lo que la Fase 3 NO incluye (a propósito)

Motor de adaptación, re-calibración, actividades complementarias, carga por
imagen, Caja Negra, calendario heatmap y deploy. Fases 4 y 5.

### Lo que la Fase 2 dejó listo

- `supabase/schema.sql` completo: 7 tablas, tipos, RLS, trigger de perfil y
  bucket de Storage. Idempotente.
- Repositorios en `src/data/`: auth, perfil, umbral, objetivos y planes, con los
  errores de Postgres y de Auth ya traducidos al español.
- Estado de sesión en Zustand, con las cuatro consultas del arranque en paralelo.
- Pantallas: login/registro, onboarding, umbral, mis zonas, objetivo y plan,
  más configuración y navegación inferior.
- La pantalla de objetivo **previsualiza el plan real** corriendo el dominio en
  vivo: lo que se ve antes de confirmar es exactamente lo que se guarda.
- `README.md` con los pasos para crear el proyecto Supabase, correr el SQL,
  setear las variables y levantar la app.
- **229 tests.** Los 51 nuevos cubren `calendarizarPlan` (donde puede colarse un
  off-by-one al aterrizar el plan en fechas) y el formateo/parseo de tiempos,
  paces y fechas.

### Lo que la Fase 2 NO incluye (a propósito)

Importación de archivos en la UI, registro de sesiones, mapa, dashboard,
adaptación, gráficos y deploy. Todo eso llega en las fases 3-5. La tabla
`sessions` ya existe en la base, pero todavía no la escribe nadie.

### Lo que la Fase 1 dejó listo

- Proyecto Vite + React + TS + Tailwind, con typecheck y build limpios.
- Design system completo: tokens, tipografías, escala hero, colores de zona.
- `config.ts` con las 7 zonas Friel (con RPE y test del habla) y las Tablas 3-7.
- Módulos de dominio puros: `zones`, `rules`, `progression`, `planner`,
  `import/` (TCX, GPX, KML).
- 178 tests, incluido el caso TCX real de Xiaomi.
- `src/App.tsx` era una verificación visual del design system sobre datos reales
  del dominio. La Fase 2 lo reemplazó por el router.

### Lo que la Fase 1 NO incluye (a propósito)

Supabase, Auth, repositorios, pantallas de producto y routing — todo eso llegó
en la Fase 2. Siguen pendientes Recharts, Leaflet, `vercel.json`, el deploy,
`vision.ts`, `analysis.ts` y `adaptation.ts`.

### Módulos de dominio

Todos escritos. Los tres que faltaban al cerrar la Fase 3:

- `analysis.ts` — `cajaNegra`, `estadoSupercompensacion`, `cargaEnVentana`,
  `serieDeBalance`.
- `adaptation.ts` — los casos del motor de adaptación, con sus umbrales en
  `ADAPTATION_CONFIG`.
- `vision.ts` — interfaz para el modelo de visión que lee la captura del reloj.
  Los datos detectados **siempre** se muestran editables y nunca se guardan
  solos. Falta enchufar un proveedor real.

---

## Convenciones

- **UI y dominio en español**: nombres de funciones, mensajes y comentarios.
- Comentarios que explican el **porqué**, no el qué. Los "no obvios" de la
  metodología van documentados donde se toma la decisión.
- Cada regla de metodología nueva entra con su test.
- Al cerrar cada fase, **actualizar este archivo** (la tabla de estado y lo que
  quedó listo). Es el contexto persistente entre sesiones.
