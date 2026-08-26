# Umbral

App web mobile-first de entrenamiento de running inteligente y adaptable.
Planifica hacia un objetivo, sigue los resultados reales y ajusta el plan.

La intensidad se mide por **percepción de esfuerzo (RPE)** y sensaciones. La
frecuencia cardíaca es un dato secundario y opcional: los relojes de muñeca
miden mal las pulsaciones, así que cada zona se ancla además al pace y al RPE.

---

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta.
2. **New project**. Elegí un nombre, una contraseña para la base y la región más
   cercana a vos.
3. Esperá un par de minutos a que termine de provisionarse.

### 2. Correr el esquema

1. En el panel del proyecto, andá a **SQL Editor** → **New query**.
2. Pegá el contenido completo de [`supabase/schema.sql`](supabase/schema.sql).
3. **Run**.

El script crea las tablas, los tipos, las políticas de Row Level Security, el
trigger que da de alta el perfil al registrarse y el bucket de Storage para las
capturas del reloj. Es idempotente: se puede volver a correr sin romper nada.

### 3. Configurar el email de acceso

En **Authentication** → **Providers**, verificá que **Email** esté habilitado.

Para probar en local conviene desactivar **Confirm email** (en
**Authentication** → **Sign In / Providers** → **Email**): así te podés registrar
y entrar sin salir a buscar el mail. Antes de publicar, volvé a activarlo.

### 4. Variables de entorno

```bash
cp .env.example .env
```

Completá las dos variables con lo que figura en **Project Settings** → **API**:

| Variable | De dónde sale |
| --- | --- |
| `VITE_SUPABASE_URL` | **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | **Project API keys** → `anon` `public` |

La `anon key` es pública por diseño: viaja al navegador en cada request. Lo que
aísla los datos de cada usuario es Row Level Security, no el secreto de esa
clave. **Nunca** pongas la `service_role` key en el `.env` de esta app: esa
clave saltea RLS por completo.

### 5. Correr en local

```bash
npm install
npm run dev
```

La app queda en `http://localhost:5173`. Si falta configuración, en vez de un
error de red te va a recibir una pantalla que explica qué falta.

---

## Comandos

```bash
npm run dev         # servidor de desarrollo
npm test            # tests (dominio + utilidades)
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + build de producción
npm run preview     # sirve el build de producción
```

---

## Cómo está organizado

```
src/
├── domain/       Metodología pura: sin React, sin red, sin base de datos.
│   ├── config.ts     TODOS los parámetros de metodología (zonas, Tablas 3-7).
│   ├── zones.ts      Umbral → las 7 zonas de Friel.
│   ├── rules.ts      Reglas R1-R4 del microciclo: validar y reparar.
│   ├── progression.ts Progresión de volumen semanal.
│   ├── planner.ts    Macrociclo, mesociclo, microciclo.
│   ├── calendar.ts   El plan aterrizado en fechas reales.
│   ├── sessionAnalysis.ts  Carga metabólica, zonas, plan vs. real.
│   └── import/       Parsers TCX, GPX y KML.
├── data/         Repositorios hacia Supabase. Traducen filas ↔ dominio.
├── store/        Estado de sesión (Zustand).
├── screens/      Pantallas.
├── components/   UI compartida.
└── lib/          Cliente de Supabase, formateo, utilidades.
```

Las dependencias van en una sola dirección: las pantallas usan el dominio y los
repositorios; el dominio no conoce a nadie. Por eso se puede testear entero sin
mocks.

Los detalles de arquitectura, las decisiones tomadas y el estado del plan de
fases están en [`CLAUDE.md`](CLAUDE.md).

---

## Deploy

El deploy en Vercel se documenta en la Fase 5. En resumen: importar el
repositorio, cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como
variables de entorno del proyecto, y agregar el redirect de SPA para que las
rutas del cliente resuelvan.
