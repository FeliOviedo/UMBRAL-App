/**
 * Utilidades de parseo XML compartidas por TCX, GPX y KML.
 *
 * Se usa @xmldom/xmldom en lugar del DOMParser nativo para que los parsers se
 * comporten igual en el navegador y en los tests de Node, sin depender de jsdom.
 */

import { DOMParser } from '@xmldom/xmldom';

/** Parsea un string XML y devuelve el documento. Lanza si el XML es inválido. */
export function parseXml(xml: string): Document {
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (level, message) => {
      if (level === 'error' || level === 'fatalError') errors.push(message);
    },
  }).parseFromString(xml, 'text/xml') as unknown as Document;

  if (errors.length > 0) {
    throw new Error(`El archivo no es XML válido: ${errors[0]}`);
  }
  if (!doc.documentElement) {
    throw new Error('El archivo no es XML válido: no tiene elemento raíz.');
  }
  return doc;
}

/**
 * Devuelve los elementos con ese nombre local, ignorando el prefijo de namespace.
 *
 * Hace falta porque cada reloj declara los namespaces a su manera y
 * `getElementsByTagName` con prefijo se vuelve frágil.
 */
export function findAll(root: Document | Element, localName: string): Element[] {
  const all = root.getElementsByTagName('*');
  const out: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i]!;
    if (stripPrefix(el.nodeName) === localName) out.push(el);
  }
  return out;
}

/** Primer descendiente con ese nombre local, o `null`. */
export function findFirst(root: Document | Element, localName: string): Element | null {
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i]!;
    if (stripPrefix(el.nodeName) === localName) return el;
  }
  return null;
}

/** Texto del primer descendiente con ese nombre local, ya recortado. */
export function textOf(root: Document | Element, localName: string): string | undefined {
  const el = findFirst(root, localName);
  const text = el?.textContent?.trim();
  return text ? text : undefined;
}

/** Número del primer descendiente con ese nombre local, o `undefined`. */
export function numberOf(root: Document | Element, localName: string): number | undefined {
  const text = textOf(root, localName);
  if (text === undefined) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/** Convierte una fecha ISO del archivo a ms epoch, o `undefined` si no parsea. */
export function parseTime(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? undefined : ms;
}

function stripPrefix(nodeName: string): string {
  const idx = nodeName.indexOf(':');
  return idx === -1 ? nodeName : nodeName.slice(idx + 1);
}
