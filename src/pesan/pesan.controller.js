const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

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

let messages = [];

io.on("connection", (socket) => {
  console.log("Client connected");

  // Kirim riwayat chat ke user baru
  socket.emit("chat history", messages);

  // Saat pesan diterima
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
  console.log("Server jalan dihttps://mjk-backend-five.vercel.app:3333");
});
