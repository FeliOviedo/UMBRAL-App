/**
 * Fachada de la capa de datos. La UI importa desde acá.
 *
 * Todo lo que sale de estos repositorios ya está traducido a tipos del dominio:
 * nada de snake_case ni de nulls de Postgres más allá de esta frontera.
 */

export * from './errors';
export * from './auth.repo';
export * from './profile.repo';
export * from './threshold.repo';
export * from './goal.repo';
export * from './plan.repo';
export * from './session.repo';
export * from './adaptation.repo';
export * from './image.repo';
export type { GoalStatus, SessionSource, ThresholdSource } from './database.types';
