# WebSockets Examples

This folder contains runnable TypeScript versions of the examples from `websockets.txt`.

There are two demos:

- `Socket.IO` demo: event names, automatic reconnection, broadcasting, acknowledgements, and rooms.
- Raw `WebSocket` demo: manual JSON message types, manual acknowledgements, manual room tracking, reconnect logic, and heartbeat checks.

## Install

```bash
npm install
```

The server-side examples are written in TypeScript:

- `server.ts` runs the Socket.IO example.
- `raw-websocket-server.ts` runs the raw WebSocket example.

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

## Files

- `server.ts`: Socket.IO server from the presentation, expanded with rooms and acknowledgements.
- `public/index.html`: Socket.IO browser client.
- `public/styles.css`: Socket.IO browser styles.
- `public/app.js`: Socket.IO browser client JavaScript.
- `raw-websocket-server.ts`: raw WebSocket server using the `ws` package.
- `raw-public/index.html`: raw WebSocket browser HTML.
- `raw-public/styles.css`: raw WebSocket browser styles.
- `raw-public/app.js`: raw WebSocket browser client with reconnect logic.
- `tsconfig.json`: TypeScript compiler configuration.
- `websockets.txt`: original presentation notes.

## Notes About TypeScript

The browser files are still plain HTML, CSS, and JavaScript because they run directly in the browser.

The Node.js server files are TypeScript because they benefit from typed request/event payloads, safer WebSocket client state, and compile-time checks.
