import { createServer } from "http";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { WebSocket, WebSocketServer } from "ws";

interface StaticFile {
  fileName: string;
  contentType: string;
}

interface BaseMessage {
  id?: string;
  type: string;
}

interface ChatMessage extends BaseMessage {
  type: "chat:message";
  payload: {
    roomId?: string;
    text: string;
  };
}

interface RoomJoinMessage extends BaseMessage {
  type: "room:join";
  payload: {
    roomId: string;
  };
}

interface TypingMessage extends BaseMessage {
  type: "user:typing";
  payload: {
    roomId?: string;
    user?: string;
  };
}

type ClientMessage = ChatMessage | RoomJoinMessage | TypingMessage;

type ServerMessage =
  | {
      type: "connection:ready";
      payload: {
        message: string;
        defaultRoom: string;
      };
    }
  | {
      type: "chat:message";
      payload: {
        id?: string;
        text: string;
        sentAt: string;
      };
    }
  | {
      type: "user:typing";
      payload: {
        user: string;
      };
    }
  | {
      type: "error";
      payload: {
        message: string;
      };
    }
  | {
      replyTo?: string;
      status: "ok";
      payload?: {
        roomId: string;
      };
    };

interface DemoWebSocket extends WebSocket {
  isAlive: boolean;
  rooms: Set<string>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.RAW_PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
const rooms = new Map<string, Set<DemoWebSocket>>();
const staticFiles = new Map<string, StaticFile>([
  ["/", { fileName: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/index.html", { fileName: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/raw-client.html", { fileName: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/styles.css", { fileName: "styles.css", contentType: "text/css; charset=utf-8" }],
  ["/app.js", { fileName: "app.js", contentType: "text/javascript; charset=utf-8" }]
]);

const httpServer = createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host}`).pathname;
  const staticFile = staticFiles.get(pathname);

  if (staticFile) {
    const file = await readFile(join(__dirname, "raw-public", staticFile.fileName), "utf8");

    response.writeHead(200, {
      "content-type": staticFile.contentType
    });
    response.end(file);
    return;
  }

  response.writeHead(404, {
    "content-type": "text/plain; charset=utf-8"
  });
  response.end("Not found");
});

const wss = new WebSocketServer({ server: httpServer });

function sendJson(wsClient: DemoWebSocket, message: ServerMessage): void {
  if (wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(message));
  }
}

function joinRoom(roomId: string, wsClient: DemoWebSocket): void {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  rooms.get(roomId)?.add(wsClient);
  wsClient.rooms.add(roomId);
}

function leaveAllRooms(wsClient: DemoWebSocket): void {
  for (const roomId of wsClient.rooms) {
    const clients = rooms.get(roomId);

    if (!clients) {
      continue;
    }

    clients.delete(wsClient);

    if (clients.size === 0) {
      rooms.delete(roomId);
    }
  }
}

function sendToRoom(roomId: string, message: ServerMessage): void {
  const clients = rooms.get(roomId) || [];

  for (const client of clients) {
    sendJson(client, message);
  }
}

function parseClientMessage(rawMessage: string): ClientMessage | undefined {
  const message = JSON.parse(rawMessage) as ClientMessage;

  if (!message || typeof message !== "object" || typeof message.type !== "string") {
    return undefined;
  }

  return message;
}

function handleMessage(wsClient: DemoWebSocket, rawMessage: string): void {
  let message: ClientMessage | undefined;

  try {
    message = parseClientMessage(rawMessage);
  } catch {
    sendJson(wsClient, {
      type: "error",
      payload: {
        message: "Messages must be valid JSON."
      }
    });
    return;
  }

  if (!message) {
    sendJson(wsClient, {
      type: "error",
      payload: {
        message: "Messages must include a type."
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
      sendJson(wsClient, {
        replyTo: message.id,
        status: "ok"
      });
    }
  }

  if (message.type === "room:join") {
    const roomId = message.payload.roomId;

    joinRoom(roomId, wsClient);

    sendJson(wsClient, {
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

wss.on("connection", (socket) => {
  const wsClient = socket as DemoWebSocket;

  console.log("Client connected");

  wsClient.isAlive = true;
  wsClient.rooms = new Set();
  joinRoom("global", wsClient);

  sendJson(wsClient, {
    type: "connection:ready",
    payload: {
      message: "Connected to raw WebSocket server.",
      defaultRoom: "global"
    }
  });

  wsClient.on("pong", () => {
    wsClient.isAlive = true;
  });

  wsClient.on("message", (rawMessage) => {
    handleMessage(wsClient, rawMessage.toString());
  });

  wsClient.on("close", () => {
    leaveAllRooms(wsClient);
    console.log("Client disconnected");
  });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    const wsClient = socket as DemoWebSocket;

    if (!wsClient.isAlive) {
      wsClient.terminate();
      continue;
    }

    wsClient.isAlive = false;
    wsClient.ping();
  }
}, 30000);

wss.on("close", () => {
  clearInterval(heartbeat);
});

httpServer.listen(port, host, () => {
  console.log(`Raw WebSocket demo running on http://${host}:${port}`);
  console.log(`Raw WebSocket endpoint available at ws://${host}:${port}`);
});
