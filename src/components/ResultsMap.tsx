"use client";

import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

export interface RestaurantPin {
  name: string;
  lat: number;
  lng: number;
  healthScore?: number;
  photoReference?: string;
  walkingMinutes?: number;
  rating?: number;
  placeId?: string;
}

interface Props {
  userLat: number;
  userLng: number;
  restaurants: RestaurantPin[];
  selectedRestaurant: string | null;
  onSelectRestaurant: (name: string | null) => void;
}

const userIcon = new L.DivIcon({
  html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(59,130,246,.5)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: "",
});

function scorePinIcon(score: number, selected: boolean): L.DivIcon {
  return new L.DivIcon({
    html: `<div class="map-pin ${selected ? "map-pin-selected" : ""}"><div class="map-pin-badge">${score}</div><div class="map-pin-arrow"></div></div>`,
    iconSize: [44, 54],
    iconAnchor: [22, 54],
    className: "",
  });
}

function dotPinIcon(selected: boolean): L.DivIcon {
  return new L.DivIcon({
    html: `<div class="map-dot ${selected ? "map-dot-selected" : ""}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: "",
  });
}

function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
}

function DeselectOnMapClick({ onDeselect }: { onDeselect: () => void }) {
  useMapEvents({ click: () => onDeselect() });
  return null;
}

export default function ResultsMap({
  userLat,
  userLng,
  restaurants,
  selectedRestaurant,
  onSelectRestaurant,
}: Props) {
  return (
    <MapContainer
      center={[userLat, userLng]}
      zoom={15}
      scrollWheelZoom
      className="h-full w-full min-h-[300px]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FlyToLocation lat={userLat} lng={userLng} />
      <DeselectOnMapClick onDeselect={() => onSelectRestaurant(null)} />
      <Circle
        center={[userLat, userLng]}
        radius={1600}
        pathOptions={{
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.04,
          weight: 1,
        }}
      />
      <Marker position={[userLat, userLng]} icon={userIcon} />
      {restaurants.map((r) => {
        const isSelected = r.name === selectedRestaurant;
        const icon =
          r.healthScore !== undefined
            ? scorePinIcon(r.healthScore, isSelected)
            : dotPinIcon(isSelected);
        return (
          <Marker
            key={r.name}
            position={[r.lat, r.lng]}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : r.healthScore !== undefined ? 100 : 0}
            eventHandlers={{
              click: () => {
                onSelectRestaurant(isSelected ? null : r.name);
              },
            }}
          />
        );
      })}
    </MapContainer>
  );
}
