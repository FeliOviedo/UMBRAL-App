import { describe, expect, it } from 'vitest';
import {
  aCamposRevisables,
  CONFIANZA_MINIMA,
  crearProveedorFalso,
  obtenerProveedorVision,
  proveedorNoConfigurado,
  type DatosDeImagen,
} from '@/domain/vision';

describe('proveedor de visión', () => {
  it('por defecto no hay ninguno configurado', () => {
    expect(obtenerProveedorVision().disponible).toBe(false);
  });

  it('el no configurado falla con un mensaje que ofrece la alternativa', async () => {
    await expect(proveedorNoConfigurado.analizar(new Blob())).rejects.toThrow(/a mano/);
  });

  it('el falso avisa que sus datos no salen de la imagen', async () => {
    const resultado = await crearProveedorFalso().analizar(new Blob());
    expect(resultado.avisos.join(' ')).toMatch(/simulado/);
    expect(resultado.datos.fcMaxima?.valor).toBe(178);
  });
});

describe('campos revisables', () => {
  it('convierte lo detectado en campos con etiqueta y sufijo', () => {
    const datos: DatosDeImagen = {
      fcMaxima: { valor: 178, confianza: 0.95 },
      zancadaCm: { valor: 108, confianza: 0.9 },
    };
    const campos = aCamposRevisables(datos);

    expect(campos).toHaveLength(2);
    expect(campos[0]).toMatchObject({
      campo: 'fcMaxima',
      etiqueta: 'FC máxima',
      sufijo: 'ppm',
      valor: 178,
      dudoso: false,
    });
  });

  it('marca como dudoso lo que tiene poca confianza', () => {
    const campos = aCamposRevisables({
      fcMaxima: { valor: 178, confianza: CONFIANZA_MINIMA - 0.1 },
    });
    expect(campos[0]!.dudoso).toBe(true);
  });

  it('marca como dudoso lo que cae fuera de rango, pero NO lo descarta', () => {
    // Si el modelo leyó 1780 donde decía 178, la persona tiene que verlo para
    // poder corregirlo. Descartarlo en silencio le haría creer que la imagen
    // no traía el dato.
    const campos = aCamposRevisables({ fcMaxima: { valor: 1780, confianza: 0.99 } });
    expect(campos).toHaveLength(1);
    expect(campos[0]!.valor).toBe(1780);
    expect(campos[0]!.dudoso).toBe(true);
  });

  it('omite los campos que no se detectaron', () => {
    expect(aCamposRevisables({})).toEqual([]);
    expect(aCamposRevisables({ trainingEffect: { valor: 3.2, confianza: 0.9 } })).toHaveLength(1);
  });

  it('acepta los cuatro campos que los archivos no traen', () => {
    const campos = aCamposRevisables({
      fcMaxima: { valor: 178, confianza: 0.9 },
      zancadaCm: { valor: 108, confianza: 0.9 },
      trainingEffect: { valor: 3.4, confianza: 0.9 },
      cadenciaSpm: { valor: 170, confianza: 0.9 },
    });
    expect(campos.map((c) => c.campo)).toEqual([
      'fcMaxima',
      'zancadaCm',
      'trainingEffect',
      'cadenciaSpm',
    ]);
    expect(campos.every((c) => !c.dudoso)).toBe(true);
  });
});
