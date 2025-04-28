const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const pesanRouter = require("./pesan.controller"); // Import router pesan.js

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let messages = [];

app.use(cors());
app.use(express.json());

// Gunakan router pesan
app.use(pesanRouter(io)); // Pass io ke router pesan.js

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.emit("chat history", messages);

  socket.on("chat message", (msg) => {
    const newMsg = {
      id: Date.now().toString(),
      ...msg,
    };
    messages.push(newMsg);
    io.emit("chat message", newMsg);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(3333, () => {
  console.log("Server berjalan di http://10.52.170.225:3000");
});
