export interface Airport {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export type FlightStatus = "enroute" | "landed";

export interface FlightPosition {
  id: string;
  callsign: string;
  lat: number;
  lng: number;
  heading: number;
  progress: number;
  status: FlightStatus;
}

export interface FlightDetail extends FlightPosition {
  origin: Airport;
  destination: Airport;
  altitudeFt: number;
  groundSpeedKt: number;
  departedAt: string;
  etaMinutes: number;
}

export interface FlightJoinAck {
  status: "joined" | "not-found";
  flight?: FlightDetail;
}

export interface FlightLeaveAck {
  status: "left";
  flightId: string;
}

export interface FlightsSnapshot {
  airports: Airport[];
  flights: FlightDetail[];
}

export interface ServerToClientEvents {
  "flights:snapshot": (snapshot: FlightsSnapshot) => void;
  "flights:positions": (positions: FlightPosition[]) => void;
  "flight:telemetry": (flight: FlightDetail) => void;
  "flight:departed": (flight: FlightDetail) => void;
  "flight:landed": (flight: FlightDetail) => void;
  "clients:count": (count: number) => void;
}

export interface ClientToServerEvents {
  "flight:join": (flightId: string, callback: (ack: FlightJoinAck) => void) => void;
  "flight:leave": (flightId: string, callback: (ack: FlightLeaveAck) => void) => void;
}
