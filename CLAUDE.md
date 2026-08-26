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
| `src/domain/calendar.ts` | `calendarizarPlan`: aterriza la numeración abstracta del plan en fechas reales. |
| `src/domain/import/` | Parsers TCX/GPX/KML, Haversine, splits, cadencia, reconciliación de distancia. |
| `supabase/schema.sql` | Tablas, tipos, RLS, trigger de alta de perfil y bucket de Storage. |
| `src/data/` | Repositorios hacia Supabase. Traducen filas ↔ dominio y los errores al español. |
| `src/store/session.store.ts` | Estado de sesión: usuario, perfil, umbral, objetivo y plan. |
| `src/screens/` | Pantallas. |
| `src/lib/format.ts` | Formateo y parseo de tiempos, paces y fechas. |
| `src/index.css` | Tokens de color del design system (variables CSS) y clases base. |
| `tailwind.config.ts` | Tipografías, escala hero, colores de zona, radios. |

**El barrel de dominio (`src/domain/index.ts`) NO reexporta `./import`** a
propósito: arrastra el parser de XML, que sólo hace falta en las pantallas de
importación. Quien lo necesite importa de `@/domain/import` y el bundler lo
separa solo (son ~87 kB de diferencia en el bundle principal).

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

Modo oscuro por defecto, UI en español, estilo sobrio: **menos cajas, más aire**.

**Colores** — fondo `#0B0E13`, superficie `#151A22`, borde `#232B36`, texto
`#F4F6F8` / secundario `#9AA7B4`, acento lima `#CDFF4F`.
Zonas: Z1 `#5B6B7A` · Z2 `#2FB6C4` · Z3 `#54C48A` · Z4 `#F2B43D` ·
Z5a `#F58A3C` · Z5b `#EF5F3C` · Z5c `#E23B4E`.

**Tipografías** (Google Fonts) — `Archivo Black` para números protagonistas
(distancia, pace, cronómetro), `Space Grotesk` para títulos de sección, `Inter`
para cuerpo y etiquetas, `IBM Plex Mono` con números tabulares para tablas de
datos.

**Reglas de composición:**

- Jerarquía de **dos niveles**: un dato hero grande + un texto secundario chico.
  Nunca 3-4 niveles compitiendo.
- 1-2 datos protagonistas por pantalla; el resto va como texto secundario.
- Separar secciones con espacio, no con bordes ni fondos de tarjeta.
- Labels en mayúscula: chicas y discretas, nunca como títulos de sección.
- Un solo acento de color a la vez. Iconografía outline 2px, radio 16px en los
  pocos contenedores con fondo.

Clases utilitarias en `src/index.css`: `.u-hero`, `.u-sub`, `.u-label`,
`.u-section-title`, `.u-section`, `.u-panel`, `.u-table`.

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

## Comandos

```bash
npm install
npm run dev         # servidor de desarrollo
npm test            # 229 tests (dominio + utilidades)
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + build de producción
```

---

## Estado del plan de fases

| Fase | Alcance | Estado |
| --- | --- | --- |
| **1** | Scaffolding + design system + `config.ts` con todas las tablas + módulos de dominio (zones, import, planner, rules, progression) + tests | ✅ **Completa** |
| **2** | Supabase (`schema.sql` con sesión genérica + `discipline` + RLS + Auth) + repositorios + onboarding + umbral/zonas + objetivo + generación de plan | ✅ **Completa** |
| **3** | Importación de archivos + análisis con mapa + registro de sesión (RPE primario) + vistas macro/meso/micro + dashboard | ⬜ Pendiente |
| **4** | Motor de adaptación + re-calibración + actividades complementarias + carga por imagen (`vision.ts` conectable) | ⬜ Pendiente |
| **5** | Caja Negra (gráficos) + progreso de volumen + calendario + deploy Vercel + README + pulido | ⬜ Pendiente |

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

### Módulos de dominio todavía por escribir

- `analysis.ts` (Fase 4) — `cajaNegra`, `estadoSupercompensacion`. `feasibilidadObjetivo`
  ya está, en `planner.ts`.
- `adaptation.ts` (Fase 4) — los 7 casos del motor de adaptación. Sus umbrales ya
  están en `ADAPTATION_CONFIG`.
- `vision.ts` (Fase 4) — interfaz para el modelo de visión que lee la captura del
  reloj. Los datos detectados **siempre** se muestran editables y nunca se
  guardan solos.

---

## Convenciones

- **UI y dominio en español**: nombres de funciones, mensajes y comentarios.
- Comentarios que explican el **porqué**, no el qué. Los "no obvios" de la
  metodología van documentados donde se toma la decisión.
- Cada regla de metodología nueva entra con su test.
- Al cerrar cada fase, **actualizar este archivo** (la tabla de estado y lo que
  quedó listo). Es el contexto persistente entre sesiones.
