const socket = io();

const connectionStatus = document.getElementById("connection-status");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const messages = document.getElementById("messages");
const joinForm = document.getElementById("join-form");
const orderId = document.getElementById("order-id");
const orderForm = document.getElementById("order-form");
const updateOrderId = document.getElementById("update-order-id");
const orderStatus = document.getElementById("order-status");
const events = document.getElementById("events");

function addMessage(text, metadata = "") {
  const item = document.createElement("div");
  item.className = "message";
  item.textContent = text;

  if (metadata) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = metadata;
    item.appendChild(meta);
  }

  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function addEvent(text) {
  const item = document.createElement("div");
  item.className = "event";
  item.textContent = text;
  events.appendChild(item);
  events.scrollTop = events.scrollHeight;
}

socket.on("connect", () => {
  connectionStatus.textContent = `Connected as ${socket.id}`;
});

socket.on("disconnect", () => {
  connectionStatus.textContent = "Disconnected. Socket.IO will try to reconnect.";
});

socket.on("user:joined", (event) => {
  addEvent(`User joined: ${event.id}`);
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = chatInput.value.trim();
  if (!text) {
    return;
  }

  socket.emit("chat:message", { text }, (response) => {
    addEvent(`Chat acknowledgement: ${response.status}`);
  });

  chatInput.value = "";
});

socket.on("chat:message", (message) => {
  addMessage(`${message.id}: ${message.text}`, message.sentAt);
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  socket.emit("order:join", orderId.value.trim(), (response) => {
    addEvent(`Joined ${response.roomId}`);
  });
});

socket.on("order:joined", (event) => {
  addEvent(`Server confirmed order room: ${event.roomId}`);
});

orderForm.addEventListener("submit", (event) => {
  event.preventDefault();

  socket.emit(
    "order:update",
    {
      orderId: updateOrderId.value.trim(),
      status: orderStatus.value
    },
    (response) => {
      addEvent(`Order update acknowledgement: ${response.status}`);
    }
  );
});

socket.on("order:updated", (event) => {
  addEvent(`Order ${event.orderId} changed to ${event.status} at ${event.updatedAt}`);
});
