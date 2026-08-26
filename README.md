# Umbral

<!-- Deploy trigger: VITE_SUPABASE_ANON_KEY estaba marcada sólo para Development en Vercel; ahora está en Production, Preview y Development. Este commit fuerza el build fresco que lo confirma. -->

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
npm run verify:rls  # comprueba el aislamiento entre usuarios (ver más abajo)
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

## Verificar el aislamiento entre usuarios

Esto no es opcional. Umbral no tiene backend propio: el navegador habla directo
con Postgres usando la `anon key`, que es pública. Lo único que impide que un
usuario lea los datos de otro son las políticas de RLS del esquema. Escribirlas
no es lo mismo que comprobarlas.

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run verify:rls
```

El script crea dos usuarios de prueba, le hace escribir una sesión a cada uno y
después, desde la sesión del usuario A, intenta:

- leer las ocho tablas (no tiene que aparecer ninguna fila de B);
- pedir la sesión de B por su `id` (tiene que devolver vacío);
- hacerle `UPDATE` y `DELETE` a la sesión de B (tiene que fallar o no afectar
  filas);
- insertar una sesión firmada con el `user_id` de B (suplantación: tiene que ser
  rechazada);
- subir una imagen a la carpeta de Storage de B y listar su contenido (ambas
  tienen que fallar).

Termina con código 0 sólo si pasan todos los chequeos. Requisitos: **Confirm
email** desactivado (si no, los usuarios de prueba no pueden iniciar sesión), y
correrlo contra un proyecto de desarrollo, no contra producción. Los dos
usuarios que crea quedan en **Authentication** → **Users** para que los borres.

Volvé a correrlo cada vez que toques `supabase/schema.sql`.

---

## Storage de las capturas del reloj

La pantalla `/sesion/:id/imagen` sube la foto de la pantalla del reloj al bucket
`session-images`, que `schema.sql` crea **privado** (`public = false`). Las
imágenes no son accesibles por URL: se leen con URLs firmadas de duración corta.

La ruta de cada archivo es `<user_id>/<session_id>.<ext>`, y las cuatro
políticas de `storage.objects` (leer, subir, reemplazar, borrar) exigen que el
primer segmento de la ruta sea el `auth.uid()` de quien pide. Ése es el
mecanismo de aislamiento; la carpeta no es una convención de orden, es la
condición de la política.

Después de correr el esquema, verificá en **Storage** que el bucket
`session-images` exista y figure como **Private**. El chequeo automático está
incluido en `npm run verify:rls`.

---

## Deploy en Vercel

Estos pasos asumen que el repositorio **todavía no está conectado** a Vercel.

### 1. Crear el proyecto

1. Entrá a [vercel.com](https://vercel.com) e iniciá sesión con la cuenta de
   GitHub que tiene acceso al repositorio.
2. **Add New…** → **Project**.
3. En la lista de repositorios, buscá `UMBRAL-App` y tocá **Import**. Si no
   aparece, entrá a **Adjust GitHub App Permissions** y dale acceso a ese
   repositorio.

### 2. Revisar la configuración de build

Vercel detecta Vite solo. Confirmá que quede así:

| Campo | Valor |
| --- | --- |
| Framework Preset | **Vite** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | 20.x o superior |

`npm run build` corre `tsc --noEmit` antes de compilar: un error de tipos frena
el deploy en vez de publicarlo.

### 3. Cargar las variables de entorno

**Antes** del primer deploy, en **Environment Variables**, agregá las dos y
marcalas para los tres entornos (Production, Preview, Development):

| Nombre | Valor | De dónde sale |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → **Project Settings** → **API** → **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi…` | Supabase → **Project Settings** → **API** → **Project API keys** → `anon` `public` |

Son las mismas dos del `.env` local. Vite las inserta en el bundle en tiempo de
build, así que **si las cambiás hay que volver a deployar**: no alcanza con
guardarlas.

> Nunca cargues la `service_role` key. Saltea RLS por completo, y todo lo que
> lleva prefijo `VITE_` termina en el JavaScript que se descarga el navegador.

### 4. Deploy

Tocá **Deploy** y esperá. Vercel queda conectado a la rama por defecto: cada
push a `main` publica producción y cada PR genera un deploy de preview.

El [`vercel.json`](vercel.json) del repositorio ya trae el rewrite de SPA, que
manda cualquier ruta que no sea un asset a `index.html`. Sin eso, entrar directo
a `/analisis` o recargar la página daría 404, porque el ruteo es del cliente.

### 5. Avisarle a Supabase cuál es la URL

Con la URL de producción a mano, en Supabase → **Authentication** → **URL
Configuration**:

- **Site URL**: `https://tu-proyecto.vercel.app`
- **Redirect URLs**: agregá `https://tu-proyecto.vercel.app/**` y, si vas a
  probar sobre los previews, `https://*-tu-cuenta.vercel.app/**`.

Si este paso falta, el link de confirmación del mail devuelve a `localhost` y el
registro parece roto en producción.

### 6. Reactivar la confirmación por email

En **Authentication** → **Sign In / Providers** → **Email**, volvé a activar
**Confirm email**, que habías desactivado para probar en local. Sin eso,
cualquiera se registra con un mail que no le pertenece.

### 7. Comprobar

1. Abrí la URL de producción en el teléfono.
2. Registrate, confirmá el mail y completá el onboarding.
3. Entrá directo a `https://tu-proyecto.vercel.app/analisis` (verifica el
   rewrite de SPA).
4. Corré `npm run verify:rls` apuntando al mismo proyecto de Supabase. El
   script necesita **Confirm email desactivado** para poder loguear a sus dos
   usuarios de prueba (si no, el registro queda pendiente y choca con el rate
   limit de envío de Supabase de Confirm email). Si ya hiciste el paso 6,
   desactivalo de nuevo en **Authentication** → **Sign In / Providers** →
   **Email**, corré el script y volvé a activarlo apenas termine — no dejes
   producción con Confirm email desactivado.
