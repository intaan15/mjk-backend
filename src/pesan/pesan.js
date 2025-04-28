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

app.use(cors());
app.use(express.json());

// Gunakan router pesan
app.use(pesanRouter); // Menggunakan router pesan

io.on("connection", (socket) => {
  console.log("Client connected");

  // Kirim riwayat chat ke user baru
  socket.emit("chat history", messages);

  // Saat pesan diterima melalui WebSocket
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

server.listen(3000, () => {
  console.log("Server jalan di http://10.52.170.225:3000");
});
