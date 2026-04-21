import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { REGION_CENTERS } from '../data/gujaratPlaces';

function pickIcon() {
  return L.divIcon({
    className: 'nl-mini-pin',
    html: `<div style="width:18px;height:18px;background:#f97316;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(249,115,22,0.6);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function MapClickLayer({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.35 });
  }, [center[0], center[1], zoom, map]);
  return null;
}

/**
 * Small dark map: click to set lat/lng. Recenters when `region` changes.
 */
export default function MapLocationPicker({ region, lat, lng, onPick }) {
  const base = REGION_CENTERS[region] || REGION_CENTERS.Mehsana;
  const center = useMemo(() => {
    if (lat != null && lng != null) return [lat, lng];
    return [base.lat, base.lng];
  }, [lat, lng, base.lat, base.lng]);

  const zoom = lat != null && lng != null ? 12 : 10;
  const showMarker = lat != null && lng != null;

  return (
    <div
      style={{
        height: 260,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(148,163,184,0.25)',
        position: 'relative',
      }}
    >
      <MapContainer
        key={region}
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        scrollWheelZoom
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <RecenterMap center={center} zoom={zoom} />
        <MapClickLayer onPick={onPick} />
        {showMarker && <Marker position={[lat, lng]} icon={pickIcon()} />}
      </MapContainer>
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          right: 8,
          zIndex: 500,
          pointerEvents: 'none',
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(248,250,252,0.85)',
          background: 'rgba(15,23,42,0.75)',
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        Click map to place pin · {showMarker ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'No pin yet'}
      </div>
      <style>{`
        .nl-mini-pin { background: none !important; border: none !important; }
      `}</style>
    </div>
  );
}
