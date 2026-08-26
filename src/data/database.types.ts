/**
 * Tipos de las tablas de Supabase.
 *
 * Se escriben a mano contra `supabase/schema.sql` en lugar de generarlos con la
 * CLI: el esquema es chico, estable, y esto evita agregar un paso de generación
 * al build. Si cambia el SQL, cambia este archivo — están al lado uno del otro
 * a propósito.
 *
 * OJO: estos son los tipos de la BASE, con snake_case y nulls de Postgres. No
 * se usan en la UI: los repositorios los traducen a los tipos del dominio.
 */

import type {
  BasePaceLevel,
  Discipline,
  LoadWeek,
  MesocycleScheme,
  RaceDistance,
  TrainingType,
  ZoneId,
} from '@/domain/types';

export type ThresholdSource = 'test_30min' | 'test_20min' | 'manual';
export type SessionSource = 'manual' | 'tcx' | 'gpx' | 'kml';
export type GoalStatus = 'activo' | 'completado' | 'abandonado';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  birth_year: number | null;
  weight_kg: number | null;
  base_pace_level: BasePaceLevel | null;
  current_weekly_km: number | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type ThresholdRow = {
  id: string;
  user_id: string;
  lthr: number | null;
  threshold_pace_sec_per_km: number | null;
  lthr_source: ThresholdSource | null;
  pace_source: ThresholdSource | null;
  test_avg_bpm: number | null;
  test_avg_pace_sec_per_km: number | null;
  tested_at: string;
  notes: string | null;
  created_at: string;
};

export type GoalRow = {
  id: string;
  user_id: string;
  distance: RaceDistance;
  target_seconds: number;
  race_date: string;
  start_date: string;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
};

export type PlanRow = {
  id: string;
  user_id: string;
  goal_id: string;
  scheme: MesocycleScheme;
  days_per_week: number;
  base_pace_level: BasePaceLevel;
  initial_weekly_km: number;
  base_weeks: number;
  total_weeks: number;
  post_race_rest_weeks: number;
  compressed: boolean;
  warnings: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanWeekRow = {
  id: string;
  user_id: string;
  plan_id: string;
  week_number: number;
  mesocycle_index: number;
  load: LoadWeek;
  total_km: number;
  starts_on: string;
  created_at: string;
};

export type PlanDayRow = {
  id: string;
  user_id: string;
  plan_week_id: string;
  day_index: number;
  type: TrainingType;
  discipline: Discipline;
  km: number;
  target_zone: ZoneId | null;
  target_rpe: number | null;
  notes: string | null;
  scheduled_on: string;
  created_at: string;
};

export type SessionRow = {
  id: string;
  user_id: string;
  plan_day_id: string | null;
  discipline: Discipline;
  training_type: TrainingType | null;
  occurred_at: string;
  rpe: number;
  feeling: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  pace_sec_per_km: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  cadence_spm: number | null;
  calories: number | null;
  elevation_gain_m: number | null;
  metabolic_load: number | null;
  source: SessionSource;
  track: unknown | null;
  splits: unknown | null;
  import_warnings: string[];
  image_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Fila lista para insertar: sin las columnas que pone la base sola. */
type Insertable<T, Required extends keyof T> = Pick<T, Required> &
  Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | Required>>;

/**
 * Envuelve una tabla en la forma que espera supabase-js.
 *
 * `Relationships` es obligatorio aunque esté vacío: sin esa clave el cliente no
 * reconoce el tipo como una tabla y todas las operaciones colapsan a `never`.
 * No se declaran relaciones porque la app nunca usa joins anidados de Postgrest
 * — los repositorios arman el árbol del plan a mano.
 */
interface Table<Row, Insert> {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
}

/** Diccionario vacío, en la forma que espera supabase-js. */
type Vacio = { [_ in never]: never };

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Insertable<ProfileRow, 'id'>>;
      thresholds: Table<ThresholdRow, Insertable<ThresholdRow, 'user_id'>>;
      goals: Table<
        GoalRow,
        Insertable<GoalRow, 'user_id' | 'distance' | 'target_seconds' | 'race_date'>
      >;
      plans: Table<
        PlanRow,
        Insertable<
          PlanRow,
          | 'user_id'
          | 'goal_id'
          | 'days_per_week'
          | 'base_pace_level'
          | 'initial_weekly_km'
          | 'base_weeks'
          | 'total_weeks'
          | 'post_race_rest_weeks'
        >
      >;
      plan_weeks: Table<
        PlanWeekRow,
        Insertable<
          PlanWeekRow,
          | 'user_id'
          | 'plan_id'
          | 'week_number'
          | 'mesocycle_index'
          | 'load'
          | 'total_km'
          | 'starts_on'
        >
      >;
      plan_days: Table<
        PlanDayRow,
        Insertable<PlanDayRow, 'user_id' | 'plan_week_id' | 'day_index' | 'type' | 'scheduled_on'>
      >;
      sessions: Table<SessionRow, Insertable<SessionRow, 'user_id' | 'rpe'>>;
    };
    Views: Vacio;
    Functions: Vacio;
    Enums: Vacio;
    CompositeTypes: Vacio;
  };
}
