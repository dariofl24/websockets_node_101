import L from "leaflet";
import type { Airport, FlightPosition } from "../flight-types";
import { routePoints } from "../flight-geo";

// Material Design "flight" glyph, pointing north so heading maps directly to rotation.
const PLANE_SVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>' +
  "</svg>";

export interface FlightMap {
  drawAirports(airports: Airport[]): void;
  upsertPlane(position: FlightPosition): void;
  removePlane(id: string): void;
  setSelected(id: string | null): void;
  drawRoute(origin: Airport, destination: Airport, progress: number): void;
  clearRoute(): void;
}

export function createFlightMap(containerId: string, onPlaneClick: (id: string) => void): FlightMap {
  const map = L.map(containerId, {
    center: [25, 10],
    zoom: 3,
    minZoom: 2,
    worldCopyJump: true,
    zoomControl: false
  });

  L.control.zoom({ position: "bottomleft" }).addTo(map);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 12
  }).addTo(map);

  const planeMarkers = new Map<string, L.Marker>();
  let selectedId: string | null = null;
  let routeKey: string | null = null;
  let routeLatLngs: [number, number][] = [];
  let flownLine: L.Polyline | null = null;
  let remainingLine: L.Polyline | null = null;

  function planeIcon(position: FlightPosition, selected: boolean): L.DivIcon {
    const classes = selected ? "plane-icon plane-icon--selected" : "plane-icon";

    return L.divIcon({
      className: "plane-marker",
      html: `<div class="${classes}" style="transform: rotate(${Math.round(position.heading)}deg)">${PLANE_SVG}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }

  return {
    drawAirports(airports) {
      for (const airport of airports) {
        L.circleMarker([airport.lat, airport.lng], {
          radius: 4,
          color: "#39434e",
          weight: 1,
          fillColor: "#5c6a78",
          fillOpacity: 0.9
        })
          .bindTooltip(`${airport.code} · ${airport.name}`, { direction: "top", className: "airport-tooltip" })
          .addTo(map);
      }
    },

    upsertPlane(position) {
      const existing = planeMarkers.get(position.id);
      const selected = position.id === selectedId;

      if (existing) {
        existing.setLatLng([position.lat, position.lng]);

        const icon = existing.getElement()?.querySelector<HTMLElement>(".plane-icon");

        if (icon) {
          icon.style.transform = `rotate(${Math.round(position.heading)}deg)`;
          icon.classList.toggle("plane-icon--selected", selected);
        }

        return;
      }

      const marker = L.marker([position.lat, position.lng], {
        icon: planeIcon(position, selected),
        keyboard: false
      })
        .bindTooltip(position.callsign, { direction: "top", offset: [0, -12], className: "plane-tooltip" })
        .on("click", () => onPlaneClick(position.id))
        .addTo(map);

      planeMarkers.set(position.id, marker);
    },

    removePlane(id) {
      planeMarkers.get(id)?.remove();
      planeMarkers.delete(id);
    },

    setSelected(id) {
      selectedId = id;

      for (const [markerId, marker] of planeMarkers) {
        marker
          .getElement()
          ?.querySelector(".plane-icon")
          ?.classList.toggle("plane-icon--selected", markerId === id);
      }
    },

    // Solid line for the part of the route already flown, dashed for what remains.
    drawRoute(origin, destination, progress) {
      const key = `${origin.code}-${destination.code}`;

      if (key !== routeKey) {
        routeKey = key;
        routeLatLngs = routePoints(origin, destination).map((point): [number, number] => [point.lat, point.lng]);
      }

      const splitIndex = Math.round(progress * (routeLatLngs.length - 1));
      const flown = routeLatLngs.slice(0, splitIndex + 1);
      const remaining = routeLatLngs.slice(splitIndex);

      if (flownLine && remainingLine) {
        flownLine.setLatLngs(flown);
        remainingLine.setLatLngs(remaining);
        return;
      }

      flownLine = L.polyline(flown, {
        color: "#f5b942",
        weight: 2.5,
        opacity: 0.9
      }).addTo(map);

      remainingLine = L.polyline(remaining, {
        color: "#5c6a78",
        weight: 2,
        opacity: 0.7,
        dashArray: "6 6"
      }).addTo(map);
    },

    clearRoute() {
      flownLine?.remove();
      remainingLine?.remove();
      flownLine = null;
      remainingLine = null;
      routeKey = null;
      routeLatLngs = [];
    }
  };
}
