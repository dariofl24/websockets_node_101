import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import type {
  Airport,
  ClientToServerEvents,
  FlightDetail,
  FlightPosition,
  ServerToClientEvents
} from "./flight-types.js";
import { bearingDegrees, greatCircleDistanceNm, interpolatePosition } from "./flight-geo.js";

const AIRPORTS: Airport[] = [
  { code: "JFK", name: "New York John F. Kennedy", lat: 40.6413, lng: -73.7781 },
  { code: "LAX", name: "Los Angeles", lat: 33.9416, lng: -118.4085 },
  { code: "ORD", name: "Chicago O'Hare", lat: 41.9742, lng: -87.9073 },
  { code: "MIA", name: "Miami", lat: 25.7959, lng: -80.287 },
  { code: "YYZ", name: "Toronto Pearson", lat: 43.6777, lng: -79.6248 },
  { code: "GRU", name: "São Paulo Guarulhos", lat: -23.4356, lng: -46.4731 },
  { code: "MEX", name: "Mexico City", lat: 19.4363, lng: -99.0721 },
  { code: "LHR", name: "London Heathrow", lat: 51.47, lng: -0.4543 },
  { code: "CDG", name: "Paris Charles de Gaulle", lat: 49.0097, lng: 2.5479 },
  { code: "FRA", name: "Frankfurt", lat: 50.0379, lng: 8.5622 },
  { code: "AMS", name: "Amsterdam Schiphol", lat: 52.3105, lng: 4.7683 },
  { code: "MAD", name: "Madrid Barajas", lat: 40.4983, lng: -3.5676 },
  { code: "FCO", name: "Rome Fiumicino", lat: 41.8003, lng: 12.2389 },
  { code: "DXB", name: "Dubai", lat: 25.2532, lng: 55.3657 },
  { code: "DOH", name: "Doha Hamad", lat: 25.2731, lng: 51.6081 },
  { code: "BOM", name: "Mumbai", lat: 19.0896, lng: 72.8656 },
  { code: "SIN", name: "Singapore Changi", lat: 1.3644, lng: 103.9915 },
  { code: "HND", name: "Tokyo Haneda", lat: 35.5494, lng: 139.7798 },
  { code: "SYD", name: "Sydney", lat: -33.9399, lng: 151.1753 },
  { code: "JNB", name: "Johannesburg", lat: -26.1367, lng: 28.2411 }
];

const AIRLINE_PREFIXES = ["AA", "UA", "DL", "BA", "AF", "LH", "EK", "QR", "SQ", "JL", "QF", "IB", "KL", "AM", "LA"];

const CONCURRENT_FLIGHTS = 15;
const TICK_MS = 1000;
// Simulated time runs 60x faster than wall-clock time, so a long-haul flight
// completes in minutes instead of hours.
const TIME_SCALE = 60;

interface Flight {
  id: string;
  callsign: string;
  origin: Airport;
  destination: Airport;
  cruiseSpeedKt: number;
  cruiseAltitudeFt: number;
  totalDistanceNm: number;
  progress: number;
  departedAt: string;
}

// Trapezoid altitude profile: climb during the first 15% of the route, cruise,
// then descend during the last 15%.
function altitudeFt(flight: Flight): number {
  const climbFraction = 0.15;

  if (flight.progress < climbFraction) {
    return Math.round((flight.progress / climbFraction) * flight.cruiseAltitudeFt);
  }

  if (flight.progress > 1 - climbFraction) {
    return Math.round(((1 - flight.progress) / climbFraction) * flight.cruiseAltitudeFt);
  }

  return flight.cruiseAltitudeFt;
}

const randomItem = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

let nextFlightNumber = 1;

function spawnFlight(initialProgress = 0): Flight {
  const origin = randomItem(AIRPORTS);
  let destination = randomItem(AIRPORTS);

  while (destination.code === origin.code) {
    destination = randomItem(AIRPORTS);
  }

  const id = `FL-${nextFlightNumber++}`;

  return {
    id,
    callsign: `${randomItem(AIRLINE_PREFIXES)}${Math.floor(randomBetween(100, 999))}`,
    origin,
    destination,
    cruiseSpeedKt: Math.round(randomBetween(460, 520)),
    cruiseAltitudeFt: Math.round(randomBetween(30, 38)) * 1000,
    totalDistanceNm: greatCircleDistanceNm(origin, destination),
    progress: initialProgress,
    departedAt: new Date().toISOString()
  };
}

function toPosition(flight: Flight): FlightPosition {
  const position = interpolatePosition(flight.origin, flight.destination, flight.progress);
  const lookAhead = interpolatePosition(flight.origin, flight.destination, Math.min(flight.progress + 0.01, 1));

  return {
    id: flight.id,
    callsign: flight.callsign,
    lat: position.lat,
    lng: position.lng,
    heading: bearingDegrees(position, flight.progress >= 1 ? flight.destination : lookAhead),
    progress: flight.progress,
    status: flight.progress >= 1 ? "landed" : "enroute"
  };
}

function toDetail(flight: Flight): FlightDetail {
  const remainingNm = flight.totalDistanceNm * (1 - flight.progress);
  const remainingWallClockMinutes = (remainingNm / (flight.cruiseSpeedKt * TIME_SCALE)) * 60;

  return {
    ...toPosition(flight),
    origin: flight.origin,
    destination: flight.destination,
    altitudeFt: altitudeFt(flight),
    groundSpeedKt: flight.cruiseSpeedKt,
    departedAt: flight.departedAt,
    etaMinutes: Math.max(0, Math.round(remainingWallClockMinutes * 10) / 10)
  };
}

const flights = new Map<string, Flight>();

// Start mid-flight so the map is populated with planes spread along their routes.
for (let i = 0; i < CONCURRENT_FLIGHTS; i++) {
  const flight = spawnFlight(Math.random() * 0.9);
  flights.set(flight.id, flight);
}

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
const port = Number(process.env.PORT || 3002);
const host = process.env.HOST || "127.0.0.1";

app.use(express.static("flight-public"));

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.emit("flights:snapshot", {
    airports: AIRPORTS,
    flights: [...flights.values()].map(toDetail)
  });
  io.emit("clients:count", io.engine.clientsCount);

  socket.on("flight:join", (flightId, callback) => {
    const flight = flights.get(flightId);

    if (!flight) {
      if (typeof callback === "function") {
        callback({ status: "not-found" });
      }
      return;
    }

    socket.join(`flight:${flightId}`);

    if (typeof callback === "function") {
      callback({
        status: "joined",
        flight: toDetail(flight)
      });
    }
  });

  socket.on("flight:leave", (flightId, callback) => {
    socket.leave(`flight:${flightId}`);

    if (typeof callback === "function") {
      callback({
        status: "left",
        flightId
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    io.emit("clients:count", io.engine.clientsCount);
  });
});

setInterval(() => {
  const tickHours = (TICK_MS / 1000 / 3600) * TIME_SCALE;

  for (const flight of flights.values()) {
    flight.progress += (flight.cruiseSpeedKt * tickHours) / flight.totalDistanceNm;

    if (flight.progress >= 1) {
      flight.progress = 1;

      io.emit("flight:landed", toDetail(flight));
      io.socketsLeave(`flight:${flight.id}`);
      flights.delete(flight.id);

      const replacement = spawnFlight();
      flights.set(replacement.id, replacement);
      io.emit("flight:departed", toDetail(replacement));
      continue;
    }

    const room = io.sockets.adapter.rooms.get(`flight:${flight.id}`);

    if (room && room.size > 0) {
      io.to(`flight:${flight.id}`).emit("flight:telemetry", toDetail(flight));
    }
  }

  io.emit(
    "flights:positions",
    [...flights.values()].map(toPosition)
  );
}, TICK_MS);

httpServer.listen(port, host, () => {
  console.log(`Flight tracker server running on http://${host}:${port}`);
});
