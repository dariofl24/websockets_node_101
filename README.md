# WebSockets Examples

This folder contains runnable TypeScript versions of the examples from `websockets.txt`.

There are three demos:

- `Socket.IO` demo: event names, automatic reconnection, broadcasting, acknowledgements, and rooms.
- Raw `WebSocket` demo: manual JSON message types, manual acknowledgements, manual room tracking, reconnect logic, and heartbeat checks.
- Flight tracker demo: a Flightradar-style map that streams simulated flight positions over Socket.IO, with per-flight rooms, acknowledgements, and a live client count.

## Install

```bash
npm install
```

The server-side examples are written in TypeScript:

- `server.ts` runs the Socket.IO example.
- `raw-websocket-server.ts` runs the raw WebSocket example.
- `flight-server.ts` runs the flight tracker example.

The project uses `tsx` to run TypeScript directly during development, so you do not need to manually compile the files before starting a demo.

## Typecheck

Run this any time you want to verify the TypeScript code:

```bash
npm run typecheck
```

## Run the Socket.IO demo

```bash
npm run dev:socketio
```

Open:

```text
http://127.0.0.1:3000
```

Try this:

1. Open `http://127.0.0.1:3000` in two browser windows.
2. Send a chat message from one window.
3. The message appears in both windows.
4. Join order `123` in both windows.
5. Send an order update for order `123`.
6. The update appears only for clients that joined that order room.

Use this command without auto-restart:

```bash
npm run start:socketio
```

Both commands run:

```bash
tsx server.ts
```

## Run the raw WebSocket demo

```bash
npm run dev:raw
```

Open:

```text
http://127.0.0.1:3001
```

Try this:

1. Open `http://127.0.0.1:3001` in two browser windows.
2. Keep both windows in room `global`, or join the same custom room in both windows.
3. Send a chat message.
4. The server manually routes that JSON message to clients in the room.
5. Stop and restart the server to see the client reconnect logic.

Use this command without auto-restart:

```bash
npm run start:raw
```

Both commands run:

```bash
tsx raw-websocket-server.ts
```

## Run the flight tracker demo

```bash
npm run dev:flights
```

Open:

```text
http://127.0.0.1:3002
```

Try this:

1. Open `http://127.0.0.1:3002` in two browser windows. Both show the same planes moving, and the connected-client count in the header shows `2`.
2. Click a plane on the map (or a row in the sidebar). The client emits `flight:join`, the server acknowledges it, and the socket joins that flight's room. The map draws the flight's route: the path already flown as a solid line, the remainder dashed.
3. Watch the telemetry panel: altitude, speed, heading, and ETA update every second. That `flight:telemetry` event is only sent to sockets in the flight's room — the other window does not receive it unless it selects the same flight.
4. Close the panel (or click the plane again) to emit `flight:leave`; the acknowledgement appears in the event feed.
5. Wait a few minutes: flights land and new ones depart, broadcast to everyone via `flight:landed` and `flight:departed`.
6. Stop the server and watch the status pill flip to Offline, then restart it to see Socket.IO reconnect and reload the snapshot.

The simulation runs at 60× real time, so long-haul flights complete in minutes. Unlike the other two demos, the browser client is also TypeScript: `esbuild` bundles `flight-client/main.ts` (plus `leaflet` and `socket.io-client` from npm) into `flight-public/app.js`, which is gitignored. The `dev:flights` and `start:flights` scripts build it automatically; if you are editing client code, run this in a second terminal to rebuild on save:

```bash
npm run watch:flights
```

Use this command without auto-restart:

```bash
npm run start:flights
```

## Files

- `server.ts`: Socket.IO server from the presentation, expanded with rooms and acknowledgements.
- `public/index.html`: Socket.IO browser client.
- `public/styles.css`: Socket.IO browser styles.
- `public/app.js`: Socket.IO browser client JavaScript.
- `raw-websocket-server.ts`: raw WebSocket server using the `ws` package.
- `raw-public/index.html`: raw WebSocket browser HTML.
- `raw-public/styles.css`: raw WebSocket browser styles.
- `raw-public/app.js`: raw WebSocket browser client with reconnect logic.
- `flight-server.ts`: flight tracker Socket.IO server with the flight simulation.
- `flight-types.ts`: event payload types shared by the flight server and client.
- `flight-geo.ts`: great-circle math shared by the flight server and client.
- `flight-client/main.ts`: flight tracker browser client (TypeScript, bundled with esbuild).
- `flight-client/map.ts`: Leaflet map, plane markers, and route drawing.
- `flight-client/tsconfig.json`: TypeScript configuration for the browser client.
- `flight-public/index.html`: flight tracker browser HTML.
- `flight-public/styles.css`: flight tracker browser styles.
- `tsconfig.json`: TypeScript compiler configuration for the server files.
- `websockets.txt`: original presentation notes.

## Notes About TypeScript

In the chat demos, the browser files are plain HTML, CSS, and JavaScript because they run directly in the browser. The flight tracker client is TypeScript compiled by `esbuild` into a single `app.js` bundle, which lets the client share event payload types with the server.

The Node.js server files are TypeScript because they benefit from typed request/event payloads, safer WebSocket client state, and compile-time checks.
