import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

interface ChatMessageInput {
  text: string;
}

interface SavedChatMessage {
  id: string;
  text: string;
  sentAt: string;
}

interface OrderUpdateInput {
  orderId: string;
  status: string;
}

interface OrderUpdate {
  orderId: string;
  status: string;
  updatedAt: string;
}

type Acknowledgement<T> = (response: T) => void;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.broadcast.emit("user:joined", {
    id: socket.id
  });

  socket.on(
    "chat:message",
    async (
      message: ChatMessageInput,
      callback?: Acknowledgement<{ status: "saved"; message: SavedChatMessage }>
    ) => {
      console.log("Saving message:", message);

      const savedMessage: SavedChatMessage = {
        id: socket.id,
        text: message.text,
        sentAt: new Date().toISOString()
      };

      io.emit("chat:message", savedMessage);

      if (typeof callback === "function") {
        callback({
          status: "saved",
          message: savedMessage
        });
      }
    }
  );

  socket.on(
    "order:join",
    (orderId: string, callback?: Acknowledgement<{ status: "joined"; orderId: string; roomId: string }>) => {
      const roomId = `order:${orderId}`;

      socket.join(roomId);

      const response = {
        orderId,
        roomId
      };

      socket.emit("order:joined", response);

      if (typeof callback === "function") {
        callback({
          status: "joined",
          ...response
        });
      }
    }
  );

  socket.on(
    "order:update",
    (event: OrderUpdateInput, callback?: Acknowledgement<{ status: "sent"; update: OrderUpdate }>) => {
      const update: OrderUpdate = {
        orderId: event.orderId,
        status: event.status,
        updatedAt: new Date().toISOString()
      };

      io.to(`order:${event.orderId}`).emit("order:updated", update);

      if (typeof callback === "function") {
        callback({
          status: "sent",
          update
        });
      }
    }
  );

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

httpServer.listen(port, host, () => {
  console.log(`Socket.IO server running on http://${host}:${port}`);
});
