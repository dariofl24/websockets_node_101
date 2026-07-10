import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  FlightDetail,
  ServerToClientEvents
} from "../flight-types";
import { createFlightMap } from "./map";

type FlightSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const socket: FlightSocket = io();

const statusPill = document.querySelector<HTMLElement>("#status-pill")!;
const clientsCount = document.querySelector<HTMLElement>("#clients-count")!;
const flightList = document.querySelector<HTMLElement>("#flight-list")!;
const eventFeed = document.querySelector<HTMLElement>("#event-feed")!;
const telemetryPanel = document.querySelector<HTMLElement>("#telemetry")!;
const telemetryClose = document.querySelector<HTMLButtonElement>("#telemetry-close")!;
const telCallsign = document.querySelector<HTMLElement>("#tel-callsign")!;
const telRoute = document.querySelector<HTMLElement>("#tel-route")!;
const telAltitude = document.querySelector<HTMLElement>("#tel-altitude")!;
const telSpeed = document.querySelector<HTMLElement>("#tel-speed")!;
const telHeading = document.querySelector<HTMLElement>("#tel-heading")!;
const telEta = document.querySelector<HTMLElement>("#tel-eta")!;
const telOrigin = document.querySelector<HTMLElement>("#tel-origin")!;
const telDestination = document.querySelector<HTMLElement>("#tel-destination")!;
const telProgressBar = document.querySelector<HTMLElement>("#tel-progress-bar")!;

const map = createFlightMap("map", (flightId) => selectFlight(flightId));

const flightRows = new Map<string, HTMLButtonElement>();
let selectedId: string | null = null;
let airportsDrawn = false;

const EVENT_FEED_LIMIT = 12;

function logEvent(text: string) {
  const entry = document.createElement("li");
  entry.textContent = text;
  eventFeed.prepend(entry);

  while (eventFeed.children.length > EVENT_FEED_LIMIT) {
    eventFeed.lastElementChild?.remove();
  }
}

function setStatus(state: "live" | "offline") {
  statusPill.textContent = state === "live" ? "Live" : "Offline";
  statusPill.classList.toggle("status-pill--live", state === "live");
  statusPill.classList.toggle("status-pill--offline", state === "offline");
}

function addFlightRow(flight: FlightDetail) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "flight-row";
  row.innerHTML =
    `<span class="flight-row__callsign">${flight.callsign}</span>` +
    `<span class="flight-row__route">${flight.origin.code} → ${flight.destination.code}</span>`;
  row.addEventListener("click", () => selectFlight(flight.id));

  flightRows.set(flight.id, row);
  flightList.append(row);
}

function removeFlightRow(flightId: string) {
  flightRows.get(flightId)?.remove();
  flightRows.delete(flightId);
}

function updateTelemetry(flight: FlightDetail) {
  telCallsign.textContent = flight.callsign;
  telRoute.textContent = `${flight.origin.name} → ${flight.destination.name}`;
  telAltitude.textContent = flight.altitudeFt.toLocaleString("en-US");
  telSpeed.textContent = String(flight.groundSpeedKt);
  telHeading.textContent = `${String(Math.round(flight.heading)).padStart(3, "0")}°`;
  telEta.textContent = `${flight.etaMinutes.toFixed(1)}m`;
  telOrigin.textContent = flight.origin.code;
  telDestination.textContent = flight.destination.code;
  telProgressBar.style.width = `${Math.round(flight.progress * 100)}%`;
}

function deselectFlight() {
  if (!selectedId) {
    return;
  }

  const flightId = selectedId;
  selectedId = null;

  socket.emit("flight:leave", flightId, (ack) => {
    logEvent(`Ack: ${ack.status} room flight:${ack.flightId}`);
  });

  map.setSelected(null);
  map.clearRoute();
  telemetryPanel.hidden = true;

  flightRows.get(flightId)?.classList.remove("flight-row--selected");
}

function selectFlight(flightId: string) {
  if (selectedId === flightId) {
    deselectFlight();
    return;
  }

  deselectFlight();

  socket.emit("flight:join", flightId, (ack) => {
    if (ack.status !== "joined" || !ack.flight) {
      logEvent(`Ack: flight ${flightId} not found`);
      return;
    }

    logEvent(`Ack: joined room flight:${flightId}`);

    selectedId = flightId;
    map.setSelected(flightId);
    map.drawRoute(ack.flight.origin, ack.flight.destination, ack.flight.progress);
    updateTelemetry(ack.flight);
    telemetryPanel.hidden = false;

    flightRows.get(flightId)?.classList.add("flight-row--selected");
  });
}

telemetryClose.addEventListener("click", deselectFlight);

socket.on("connect", () => {
  setStatus("live");
  logEvent("Connected to server");
});

socket.on("disconnect", () => {
  setStatus("offline");
  logEvent("Disconnected — reconnecting…");

  // Room membership dies with the old connection; a fresh snapshot arrives on reconnect.
  selectedId = null;
  map.setSelected(null);
  map.clearRoute();
  telemetryPanel.hidden = true;
});

socket.on("flights:snapshot", (snapshot) => {
  if (!airportsDrawn) {
    map.drawAirports(snapshot.airports);
    airportsDrawn = true;
  }

  for (const flightId of flightRows.keys()) {
    map.removePlane(flightId);
  }

  flightRows.clear();
  flightList.replaceChildren();

  const flights = [...snapshot.flights].sort((a, b) => a.callsign.localeCompare(b.callsign));

  for (const flight of flights) {
    map.upsertPlane(flight);
    addFlightRow(flight);
  }
});

socket.on("flights:positions", (positions) => {
  for (const position of positions) {
    map.upsertPlane(position);
  }
});

socket.on("flight:telemetry", (flight) => {
  if (flight.id === selectedId) {
    updateTelemetry(flight);
    map.drawRoute(flight.origin, flight.destination, flight.progress);
  }
});

socket.on("flight:departed", (flight) => {
  map.upsertPlane(flight);
  addFlightRow(flight);
  logEvent(`${flight.callsign} departed ${flight.origin.code} → ${flight.destination.code}`);
});

socket.on("flight:landed", (flight) => {
  if (flight.id === selectedId) {
    selectedId = null;
    map.setSelected(null);
    map.clearRoute();
    telemetryPanel.hidden = true;
  }

  map.removePlane(flight.id);
  removeFlightRow(flight.id);
  logEvent(`${flight.callsign} landed at ${flight.destination.code}`);
});

socket.on("clients:count", (count) => {
  clientsCount.textContent = String(count);
});
