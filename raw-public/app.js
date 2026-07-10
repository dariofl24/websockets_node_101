let socket;
let reconnectTimer;
let retryCount = 0;
let currentRoom = "global";

const status = document.getElementById("status");
const roomForm = document.getElementById("room-form");
const roomId = document.getElementById("room-id");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const messages = document.getElementById("messages");
const events = document.getElementById("events");

function addEntry(container, text, metadata = "") {
  const item = document.createElement("div");
  item.className = "entry";
  item.textContent = text;

  if (metadata) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = metadata;
    item.appendChild(meta);
  }

  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    addEntry(events, "Cannot send because the socket is not open.");
    return;
  }

  socket.send(JSON.stringify(message));
}

function connect() {
  if (socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(socket.readyState)) {
    return;
  }

  socket = new WebSocket(`ws://${window.location.host}`);
  status.textContent = "Connecting...";

  socket.onopen = () => {
    retryCount = 0;
    status.textContent = "Connected";

    sendMessage({
      id: createId(),
      type: "room:join",
      payload: {
        roomId: currentRoom
      }
    });
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "connection:ready") {
      addEntry(events, message.payload.message);
    }

    if (message.type === "chat:message") {
      addEntry(messages, message.payload.text, message.payload.sentAt);
    }

    if (message.type === "user:typing") {
      addEntry(events, `${message.payload.user} is typing`);
    }

    if (message.replyTo) {
      addEntry(events, `Acknowledgement for ${message.replyTo}: ${message.status}`);
    }

    if (message.type === "error") {
      addEntry(events, `Error: ${message.payload.message}`);
    }
  };

  socket.onclose = () => {
    status.textContent = "Disconnected. Reconnecting...";
    const delay = Math.min(1000 * 2 ** retryCount, 10000);
    retryCount += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, delay);
  };

  socket.onerror = () => {
    status.textContent = "Connection error";
  };
}

roomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  currentRoom = roomId.value.trim() || "global";

  sendMessage({
    id: createId(),
    type: "room:join",
    payload: {
      roomId: currentRoom
    }
  });
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = chatInput.value.trim();
  if (!text) {
    return;
  }

  sendMessage({
    id: createId(),
    type: "chat:message",
    payload: {
      roomId: currentRoom,
      text
    }
  });

  chatInput.value = "";
});

chatInput.addEventListener("input", () => {
  sendMessage({
    type: "user:typing",
    payload: {
      roomId: currentRoom,
      user: "Browser client"
    }
  });
});

connect();
