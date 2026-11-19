import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackPoint } from '../domain/geo';

interface Props {
  segments: TrackPoint[][];
  /** Suivre la dernière position (enregistrement en direct). */
  follow?: boolean;
  className?: string;
}

/** Carte OpenStreetMap avec le tracé (Leaflet). */
export function TrackMap({ segments, follow = false, className = 'map' }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.setView([46.6, 2.4], 5);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const all = segments.flat();
    if (all.length === 0) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f2551d';
    for (const seg of segments) if (seg.length > 1) L.polyline(seg.map((p): L.LatLngTuple => [p.lat, p.lon]), { color, weight: 4, opacity: 0.9 }).addTo(g);
    const first = all[0]!;
    const last = all[all.length - 1]!;
    L.circleMarker([first.lat, first.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#1baf7a', fillOpacity: 1 }).addTo(g).bindTooltip('Départ');
    L.circleMarker([last.lat, last.lon], { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(g).bindTooltip(follow ? 'Position' : 'Arrivée');
    if (follow) m.setView([last.lat, last.lon], Math.max(m.getZoom(), 16));
    else m.fitBounds(L.latLngBounds(all.map((p): L.LatLngTuple => [p.lat, p.lon])), { padding: [24, 24] });
  }, [segments, follow]);

  return <div ref={el} className={className} role="img" aria-label="Carte du parcours" />;
}
