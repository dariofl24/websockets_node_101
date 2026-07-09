import { createServer } from "http";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { WebSocketServer } from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.RAW_PORT || 3001;
const host = process.env.HOST || "127.0.0.1";
const rooms = new Map();

const httpServer = createServer(async (request, response) => {
  if (request.url === "/" || request.url === "/raw-client.html") {
    const html = await readFile(join(__dirname, "raw-client.html"), "utf8");

    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8"
    });
    response.end(html);
    return;
  }

  response.writeHead(404, {
    "content-type": "text/plain; charset=utf-8"
  });
  response.end("Not found");
});

const wss = new WebSocketServer({ server: httpServer });

function sendJson(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function joinRoom(roomId, ws) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  rooms.get(roomId).add(ws);
  ws.rooms.add(roomId);
}

function leaveAllRooms(ws) {
  for (const roomId of ws.rooms) {
    const clients = rooms.get(roomId);

    if (!clients) {
      continue;
    }

    clients.delete(ws);

    if (clients.size === 0) {
      rooms.delete(roomId);
    }
  }
}

function sendToRoom(roomId, message) {
  const clients = rooms.get(roomId) || [];

  for (const client of clients) {
    sendJson(client, message);
  }
}

function handleMessage(ws, rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    sendJson(ws, {
      type: "error",
      payload: {
        message: "Messages must be valid JSON."
      }
    });
    return;
  }

  if (message.type === "chat:message") {
    console.log("Received chat message:", message.payload);

    sendToRoom(message.payload.roomId || "global", {
      type: "chat:message",
      payload: {
        id: message.id,
        text: message.payload.text,
        sentAt: new Date().toISOString()
      }
    });

    if (message.id) {
      sendJson(ws, {
        replyTo: message.id,
        status: "ok"
      });
    }
  }

  if (message.type === "room:join") {
    const roomId = message.payload.roomId;

    joinRoom(roomId, ws);

    sendJson(ws, {
      replyTo: message.id,
      status: "ok",
      payload: {
        roomId
      }
    });
  }

  if (message.type === "user:typing") {
    sendToRoom(message.payload.roomId || "global", {
      type: "user:typing",
      payload: {
        user: message.payload.user || "Anonymous"
      }
    });
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.isAlive = true;
  ws.rooms = new Set();
  joinRoom("global", ws);

  sendJson(ws, {
    type: "connection:ready",
    payload: {
      message: "Connected to raw WebSocket server.",
      defaultRoom: "global"
    }
  });

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (rawMessage) => {
    handleMessage(ws, rawMessage.toString());
  });

  ws.on("close", () => {
    leaveAllRooms(ws);
    console.log("Client disconnected");
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }

    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on("close", () => {
  clearInterval(heartbeat);
});

httpServer.listen(port, host, () => {
  console.log(`Raw WebSocket demo running on http://${host}:${port}`);
  console.log(`Raw WebSocket endpoint available at ws://${host}:${port}`);
});
