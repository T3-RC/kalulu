import { useEffect, useRef } from "react";
import L from "leaflet";

const PIN = L.divIcon({
  className: "kpin",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#667eea;border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number };
  onChange: (c: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (mapRef.current || !ref.current) return;
    const map = L.map(ref.current).setView([value.lat, value.lng], 14);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20 }).addTo(map);
    const marker = L.marker([value.lat, value.lng], { draggable: true, icon: PIN }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onChange({ lat: p.lat, lng: p.lng });
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapRef.current = map;
    markerRef.current = marker;
  }, []);

  // Re-center when the value changes externally (EXIF/geolocation arrives).
  useEffect(() => {
    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
      mapRef.current.setView([value.lat, value.lng]);
    }
  }, [value.lat, value.lng]);

  return <div ref={ref} className="loc-picker" />;
}
