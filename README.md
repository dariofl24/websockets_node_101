# WebSockets Examples

This folder contains runnable versions of the examples from `websockets.txt`.

There are two demos:

- `Socket.IO` demo: event names, automatic reconnection, broadcasting, acknowledgements, and rooms.
- Raw `WebSocket` demo: manual JSON message types, manual acknowledgements, manual room tracking, reconnect logic, and heartbeat checks.

## Install

```bash
npm install
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

## Files

- `server.js`: Socket.IO server from the presentation, expanded with rooms and acknowledgements.
- `public/index.html`: Socket.IO browser client.
- `raw-websocket-server.js`: raw WebSocket server using the `ws` package.
- `raw-client.html`: raw browser WebSocket client with reconnect logic.
- `websockets.txt`: original presentation notes.
