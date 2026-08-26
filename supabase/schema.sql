-- ═══════════════════════════════════════════════════════════════════════════
-- Umbral — esquema de base de datos
--
-- Pegá este archivo entero en el SQL Editor de Supabase y ejecutalo. Es
-- idempotente: se puede volver a correr sin romper nada.
--
-- Principios que sostienen el diseño:
--
-- 1. TODO dato del usuario está aislado por Row Level Security. No hay backend
--    propio: el navegador habla directo con Postgres, así que RLS no es una capa
--    de más, es LA capa de seguridad. Cada tabla tiene user_id y políticas que
--    lo comparan contra auth.uid().
--
-- 2. La entidad de entrenamiento es una SESIÓN GENÉRICA, no una "corrida". La
--    columna discipline distingue running de fuerza o de cualquier otra cosa.
--    El MVP sólo implementa 'running', pero el esquema ya no lo excluye.
--
-- 3. La carga metabólica es un concepto UNIFICADO: cualquier sesión, de
--    cualquier disciplina, aporta al modelo de recuperación.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Tipos
-- ───────────────────────────────────────────────────────────────────────────

do $$ begin
  create type discipline as enum ('running', 'strength', 'other');
exception when duplicate_object then null; end $$;

-- F = Largo/Fondo · E = Específico · R = Recuperación · D = Descanso
do $$ begin
  create type training_type as enum ('F', 'E', 'R', 'D');
exception when duplicate_object then null; end $$;

do $$ begin
  create type race_distance as enum ('5K', '10K', '21K', '42K');
exception when duplicate_object then null; end $$;

do $$ begin
  create type zone_id as enum ('Z1', 'Z2', 'Z3', 'Z4', 'Z5a', 'Z5b', 'Z5c');
exception when duplicate_object then null; end $$;

do $$ begin
  create type load_week as enum ('carga', 'carga+', 'carga++', 'descarga');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mesocycle_scheme as enum ('1:1', '2:1', '3:1');
exception when duplicate_object then null; end $$;

do $$ begin
  create type base_pace_level as enum
    ('suave', 'promedio', 'moderado', 'fuerte', 'rapido', 'ultra');
exception when duplicate_object then null; end $$;

-- Cómo se obtuvo el umbral. Importa para saber cuánto confiar en el dato.
do $$ begin
  create type threshold_source as enum ('test_30min', 'test_20min', 'manual');
exception when duplicate_object then null; end $$;

-- De dónde salieron los datos de la sesión.
do $$ begin
  create type session_source as enum ('manual', 'tcx', 'gpx', 'kml');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_status as enum ('activo', 'completado', 'abandonado');
exception when duplicate_object then null; end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Utilidades
-- ───────────────────────────────────────────────────────────────────────────

-- Mantiene updated_at al día sin que la app se tenga que acordar.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- profiles — datos del corredor
--
-- Se crea sola al registrarse (ver el trigger sobre auth.users más abajo), así
-- que la app nunca tiene que insertar acá.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  birth_year integer check (birth_year between 1900 and 2200),
  weight_kg numeric(5, 2) check (weight_kg > 0),
  -- Ritmo base para la Tabla 7. Se puede recalcular desde las sesiones reales.
  base_pace_level base_pace_level,
  -- Volumen semanal actual en km: el punto de partida de la progresión.
  current_weekly_km numeric(6, 2) check (current_weekly_km >= 0),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is
  'Perfil del corredor. Una fila por usuario, creada automáticamente al registrarse.';
comment on column profiles.base_pace_level is
  'Ritmo base de la Tabla 7 de progresión de volumen.';

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- thresholds — historial de umbral
--
-- Es un HISTORIAL, no un valor único: el re-test al cerrar cada mesociclo
-- agrega una fila nueva y las anteriores quedan para el gráfico de
-- re-calibración (antes/después). El umbral vigente es el de tested_at más
-- reciente.
--
-- Las zonas NO se guardan: se derivan del umbral en el dominio. Guardarlas
-- sería duplicar la metodología en la base y arriesgarse a que queden
-- desincronizadas si se recalibra config.ts.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists thresholds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- FC de umbral en pulsaciones por minuto. Dato SECUNDARIO: el reloj mide mal.
  lthr integer check (lthr between 80 and 240),
  -- Pace de umbral en segundos por km. Es el ancla objetiva más confiable.
  threshold_pace_sec_per_km integer check (threshold_pace_sec_per_km between 120 and 900),
  lthr_source threshold_source,
  pace_source threshold_source,
  -- FC promedio cruda del test, antes de aplicar la corrección del 5%.
  test_avg_bpm integer check (test_avg_bpm between 80 and 240),
  -- Pace promedio crudo del test de 20 min, antes del factor 1.05.
  test_avg_pace_sec_per_km integer check (test_avg_pace_sec_per_km between 120 and 900),
  tested_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  -- Un umbral sin ninguno de los dos valores no sirve para nada.
  constraint thresholds_needs_a_value
    check (lthr is not null or threshold_pace_sec_per_km is not null)
);

comment on table thresholds is
  'Historial de umbral. El vigente es el de tested_at más reciente; los anteriores alimentan la re-calibración.';

create index if not exists thresholds_user_tested_idx
  on thresholds (user_id, tested_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- goals — objetivo de carrera
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  distance race_distance not null,
  -- Tiempo objetivo en segundos. Ubica al corredor en la Tabla 3.
  target_seconds integer not null check (target_seconds > 0),
  race_date date not null,
  start_date date not null default current_date,
  status goal_status not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_race_after_start check (race_date >= start_date)
);

comment on table goals is 'Objetivo de carrera. Puede haber varios, pero sólo uno activo por vez.';

-- Un solo objetivo activo por usuario: el índice parcial lo garantiza en la
-- base, no sólo en la app.
create unique index if not exists goals_one_active_per_user
  on goals (user_id) where status = 'activo';

drop trigger if exists goals_set_updated_at on goals;
create trigger goals_set_updated_at
  before update on goals
  for each row execute function set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- plans — plan generado para un objetivo
--
-- El plan es el resultado de correr el generador con ciertos parámetros. Se
-- guardan los parámetros de entrada además del resultado, así se puede
-- regenerar y explicar por qué el plan es como es.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references goals (id) on delete cascade,
  -- Parámetros de entrada del generador.
  scheme mesocycle_scheme not null default '3:1',
  days_per_week integer not null check (days_per_week between 3 and 6),
  base_pace_level base_pace_level not null,
  initial_weekly_km numeric(6, 2) not null check (initial_weekly_km > 0),
  -- Resultado del generador (Tabla 6).
  base_weeks integer not null check (base_weeks > 0),
  total_weeks integer not null check (total_weeks > 0),
  post_race_rest_weeks integer not null check (post_race_rest_weeks >= 0),
  -- true si hubo que comprimir el plan porque la fecha dejaba menos semanas.
  compressed boolean not null default false,
  -- Avisos del generador, en español, listos para mostrar.
  warnings jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table plans is
  'Plan generado. Guarda los parámetros de entrada además del resultado, para poder regenerarlo y explicarlo.';

create unique index if not exists plans_one_active_per_user
  on plans (user_id) where is_active;

create index if not exists plans_user_goal_idx on plans (user_id, goal_id);

drop trigger if exists plans_set_updated_at on plans;
create trigger plans_set_updated_at
  before update on plans
  for each row execute function set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- plan_weeks — microciclos del plan
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists plan_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references plans (id) on delete cascade,
  week_number integer not null check (week_number > 0),
  mesocycle_index integer not null check (mesocycle_index > 0),
  load load_week not null,
  total_km numeric(6, 2) not null check (total_km >= 0),
  -- Lunes de la semana. Permite ubicar el plan en el calendario real.
  starts_on date not null,
  created_at timestamptz not null default now(),
  unique (plan_id, week_number)
);

create index if not exists plan_weeks_user_plan_idx on plan_weeks (user_id, plan_id, week_number);

-- ───────────────────────────────────────────────────────────────────────────
-- plan_days — días planificados
--
-- El plan es lo PLANIFICADO. Lo que pasó de verdad vive en sessions, y se
-- vincula por session.plan_day_id. Separarlos es lo que permite comparar plan
-- contra realidad, que es de lo que vive el motor de adaptación.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_week_id uuid not null references plan_weeks (id) on delete cascade,
  day_index integer not null check (day_index between 0 and 6),
  type training_type not null,
  discipline discipline not null default 'running',
  km numeric(5, 2) not null default 0 check (km >= 0),
  target_zone zone_id,
  -- RPE objetivo: el ancla PRINCIPAL de intensidad de la sesión.
  target_rpe integer check (target_rpe between 1 and 10),
  notes text,
  scheduled_on date not null,
  created_at timestamptz not null default now(),
  unique (plan_week_id, day_index),
  -- El descanso pasivo no lleva carga ni intensidad objetivo.
  constraint plan_days_rest_has_no_load
    check (type <> 'D' or (km = 0 and target_zone is null and target_rpe is null))
);

create index if not exists plan_days_user_scheduled_idx on plan_days (user_id, scheduled_on);

-- ───────────────────────────────────────────────────────────────────────────
-- sessions — lo que realmente pasó
--
-- ⚠️ ACÁ ES DONDE SE ENCHUFA LA MULTIDISCIPLINA.
--
-- Esta tabla es genérica a propósito: no se llama "runs". La columna discipline
-- distingue running de fuerza o de cualquier otra actividad, y las columnas
-- específicas de running son todas nullable.
--
-- Cuando llegue el módulo de fuerza, NO hace falta una tabla nueva ni migrar
-- nada: se agrega una tabla hija `strength_sets` (session_id, ejercicio, series,
-- reps, peso) que referencia sessions, y las filas con discipline='strength'
-- pasan a tener su detalle ahí. Las columnas de running quedan en null, que es
-- exactamente lo que corresponde.
--
-- La carga metabólica (metabolic_load) es el puente entre disciplinas: la
-- calcula el dominio a partir de duración e intensidad percibida, sirve igual
-- para una corrida que para una sesión de gimnasio o un partido de fútbol, y es
-- lo que alimenta el modelo de homeostasis y recuperación.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Qué día del plan cumple esta sesión. null = actividad no planificada
  -- (complementaria, o una corrida espontánea).
  plan_day_id uuid references plan_days (id) on delete set null,

  discipline discipline not null default 'running',
  -- Sólo aplica a running; en fuerza queda null.
  training_type training_type,
  occurred_at timestamptz not null default now(),

  -- ── Inputs PRINCIPALES de intensidad ────────────────────────────────────
  -- El RPE es obligatorio: es el dato en el que se apoya toda la metodología.
  rpe integer not null check (rpe between 1 and 10),
  feeling integer check (feeling between 1 and 5),

  -- ── Datos objetivos (todos opcionales) ──────────────────────────────────
  duration_seconds integer check (duration_seconds > 0),
  distance_meters numeric(9, 2) check (distance_meters >= 0),
  pace_sec_per_km integer check (pace_sec_per_km > 0),
  -- FC promedio. Dato SECUNDARIO Y OPCIONAL: el reloj del usuario mide mal.
  avg_hr integer check (avg_hr between 30 and 240),
  max_hr integer check (max_hr between 30 and 240),
  cadence_spm integer check (cadence_spm > 0),
  calories integer check (calories >= 0),
  elevation_gain_m numeric(7, 2),

  -- Carga metabólica unificada: el puente entre disciplinas.
  metabolic_load numeric(8, 2) check (metabolic_load >= 0),

  -- ── Procedencia y datos crudos ──────────────────────────────────────────
  source session_source not null default 'manual',
  -- Traza completa para redibujar la ruta en Leaflet: [{lat, lon, time, ...}].
  track jsonb,
  -- Splits por km: [{km, seconds, paceSecPerKm, meters}].
  splits jsonb,
  -- Avisos del parser (distancias discrepantes, campos ausentes…).
  import_warnings jsonb not null default '[]'::jsonb,
  -- Captura del reloj en Supabase Storage. La detección por visión es
  -- OPCIONAL y sus resultados siempre se confirman a mano (Fase 4).
  image_path text,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- El pace se deriva de distancia y tiempo; si viene, tienen que venir los dos.
  constraint sessions_pace_needs_distance_and_time
    check (pace_sec_per_km is null or (distance_meters > 0 and duration_seconds > 0))
);

comment on table sessions is
  'Sesión de entrenamiento de CUALQUIER disciplina. Genérica a propósito: el módulo de fuerza se enchufa con una tabla hija, sin migrar nada.';
comment on column sessions.rpe is
  'Percepción de esfuerzo 1-10. Input PRINCIPAL de intensidad: no depende de que el reloj mida bien.';
comment on column sessions.avg_hr is
  'FC promedio. Dato secundario y opcional; se usa como apoyo, nunca como fuente única.';
comment on column sessions.metabolic_load is
  'Carga metabólica unificada. Cualquier disciplina aporta al mismo modelo de homeostasis.';

create index if not exists sessions_user_occurred_idx on sessions (user_id, occurred_at desc);
create index if not exists sessions_plan_day_idx on sessions (plan_day_id);
-- El análisis de la Caja Negra filtra por disciplina y fecha.
create index if not exists sessions_user_discipline_idx
  on sessions (user_id, discipline, occurred_at desc);

drop trigger if exists sessions_set_updated_at on sessions;
create trigger sessions_set_updated_at
  before update on sessions
  for each row execute function set_updated_at();

-- Acá iría, en el futuro:
--
--   create table strength_sets (
--     id uuid primary key default gen_random_uuid(),
--     user_id uuid not null references auth.users (id) on delete cascade,
--     session_id uuid not null references sessions (id) on delete cascade,
--     exercise text not null, set_number integer not null,
--     reps integer, weight_kg numeric(6,2), rpe integer
--   );
--
-- con las mismas políticas RLS que el resto. No hace falta tocar sessions.

-- ───────────────────────────────────────────────────────────────────────────
-- adaptations — historial de decisiones del motor
--
-- Cada vez que el motor propone un cambio se guarda acá, con la semana antes y
-- después. Sirve para tres cosas:
--
-- 1. Mostrar el diff en la pantalla de re-calibración ANTES de aplicar.
-- 2. Poder deshacer: `snapshot_antes` tiene el plan original.
-- 3. Dejar rastro de por qué el plan es como es. Un plan que cambió solo, sin
--    registro del motivo, es indistinguible de un bug.
-- ───────────────────────────────────────────────────────────────────────────

do $$ begin
  create type adaptation_reason as enum (
    'sesion-omitida', 'carga-externa', 'feedback-pobre',
    'buena-adaptacion', 'retest-mesociclo', 'progresion-volumen',
    'feasibilidad-objetivo'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type adaptation_action as enum (
    'reordenar', 'degradar-sesion', 'insertar-recuperacion', 'ninguna'
  );
exception when duplicate_object then null; end $$;

create table if not exists adaptations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_week_id uuid references plan_weeks (id) on delete cascade,
  reason adaptation_reason not null,
  action adaptation_action not null,
  title text not null,
  -- La explicación en lenguaje de entrenador, tal como se le mostró al usuario.
  explanation text not null,
  -- Los días de la semana antes y después. Permiten mostrar el diff y deshacer.
  snapshot_antes jsonb,
  snapshot_despues jsonb,
  -- La sesión o actividad que disparó la adaptación, si hubo una.
  trigger_session_id uuid references sessions (id) on delete set null,
  -- false mientras está propuesta; true cuando el usuario la confirmó.
  applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table adaptations is
  'Decisiones del motor de adaptación. Nunca se aplica nada sin dejar registro del motivo.';

create index if not exists adaptations_user_created_idx
  on adaptations (user_id, created_at desc);
create index if not exists adaptations_week_idx on adaptations (plan_week_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Sin esto, cualquiera con la anon key podría leer los datos de todos. La anon
-- key es pública por diseño; RLS es lo que hace que eso no importe.
-- ───────────────────────────────────────────────────────────────────────────

alter table profiles    enable row level security;
alter table thresholds  enable row level security;
alter table goals       enable row level security;
alter table plans       enable row level security;
alter table plan_weeks  enable row level security;
alter table plan_days   enable row level security;
alter table sessions    enable row level security;
alter table adaptations enable row level security;

-- profiles: la fila la crea el trigger, así que no hay política de insert.
-- El usuario sólo puede ver y editar la suya.
drop policy if exists "profiles: leer la propia" on profiles;
create policy "profiles: leer la propia" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: editar la propia" on profiles;
create policy "profiles: editar la propia" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- El resto de las tablas comparten la misma forma: cuatro políticas contra
-- user_id. Se generan en un bucle para que ninguna quede olvidada por descuido
-- y para que agregar una tabla sea agregar un nombre a la lista.
do $$
declare
  t text;
begin
  foreach t in array array['thresholds', 'goals', 'plans', 'plan_weeks', 'plan_days', 'sessions', 'adaptations']
  loop
    execute format('drop policy if exists "%1$s: leer lo propio" on %1$I', t);
    execute format(
      'create policy "%1$s: leer lo propio" on %1$I for select using (auth.uid() = user_id)', t);

    execute format('drop policy if exists "%1$s: insertar lo propio" on %1$I', t);
    execute format(
      'create policy "%1$s: insertar lo propio" on %1$I for insert with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "%1$s: editar lo propio" on %1$I', t);
    execute format(
      'create policy "%1$s: editar lo propio" on %1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "%1$s: borrar lo propio" on %1$I', t);
    execute format(
      'create policy "%1$s: borrar lo propio" on %1$I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Alta automática del perfil
--
-- El perfil se crea en el mismo momento que el usuario. Si lo hiciera la app,
-- un registro interrumpido a mitad de camino dejaría un usuario sin perfil.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
-- search_path explícito: sin esto, una función security definer es un vector de
-- escalada de privilegios.
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────────────────────────────────────────────────────────────────────
-- Storage: capturas de pantalla del reloj (se usa en la Fase 4)
--
-- Bucket privado. Cada usuario sólo alcanza su propia carpeta, que se llama
-- como su uid: el primer segmento del path tiene que coincidir con auth.uid().
-- ───────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('session-images', 'session-images', false)
on conflict (id) do nothing;

drop policy if exists "session-images: leer lo propio" on storage.objects;
create policy "session-images: leer lo propio" on storage.objects
  for select using (
    bucket_id = 'session-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "session-images: subir lo propio" on storage.objects;
create policy "session-images: subir lo propio" on storage.objects
  for insert with check (
    bucket_id = 'session-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "session-images: borrar lo propio" on storage.objects;
create policy "session-images: borrar lo propio" on storage.objects
  for delete using (
    bucket_id = 'session-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
