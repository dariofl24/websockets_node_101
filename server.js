import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = process.env.PORT || 3000;
const host = process.env.HOST || "127.0.0.1";

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.broadcast.emit("user:joined", {
    id: socket.id
  });

  socket.on("chat:message", async (message, callback) => {
    console.log("Saving message:", message);

    const savedMessage = {
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
  });

  socket.on("order:join", (orderId, callback) => {
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
  });

  socket.on("order:update", (event, callback) => {
    const update = {
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
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

httpServer.listen(port, host, () => {
  console.log(`Socket.IO server running on http://${host}:${port}`);
});
