import { useMemo } from 'react';
import { MapContainer, Polyline, TileLayer } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackPoint } from '@/domain/types';
import { cn } from '@/lib/utils';

/**
 * Dibuja una ruta sobre OpenStreetMap.
 *
 * Usa el tileset estándar de OSM: es gratuito y no pide API key, tal como
 * pide el proyecto. El mapa en sí queda con los colores propios de OSM (no se
 * fuerza un tema oscuro sobre los tiles) — es una ventana hacia afuera del
 * design system, como en cualquier app de running.
 */
export interface RouteMapProps {
  track: readonly TrackPoint[];
  className?: string;
  /** Alto del mapa. Por defecto ocupa 45vh: suficiente para leer la forma. */
  heightClassName?: string;
}

export default function RouteMap({ track, className, heightClassName }: RouteMapProps) {
  const puntos = useMemo<LatLngTuple[]>(
    () => track.map((p) => [p.lat, p.lon] as LatLngTuple),
    [track],
  );

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (puntos.length === 0) return null;
    let minLat = puntos[0]![0];
    let maxLat = puntos[0]![0];
    let minLon = puntos[0]![1];
    let maxLon = puntos[0]![1];
    for (const [lat, lon] of puntos) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ];
  }, [puntos]);

  if (puntos.length === 0 || !bounds) return null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg',
        heightClassName ?? 'h-[45vh]',
        className,
      )}
    >
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [24, 24] }}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={puntos} pathOptions={{ color: '#CDFF4F', weight: 4 }} />
      </MapContainer>
    </div>
  );
}
