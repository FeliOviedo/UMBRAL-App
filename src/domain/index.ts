/**
 * Fachada del dominio. La UI y la capa de datos importan desde acá, nunca de
 * los archivos internos, para que reordenar el dominio no rompa las pantallas.
 */

export * from './types';
export * from './config';
export * from './zones';
export * from './rules';
export * from './progression';
export * from './planner';
export * from './calendar';
export * from './sessionAnalysis';
export * from './homeostasis';
export * from './analysis';
export * from './adaptation';
export * from './vision';

// `./import` NO se reexporta acá a propósito: arrastra el parser de XML, que
// pesa lo suyo y sólo hace falta en las pantallas de importación. Quien lo
// necesite lo importa de '@/domain/import' y el bundler lo separa solo.
