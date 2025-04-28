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

// Endpoint untuk mengambil semua chat
app.get("/pesan", (req, res) => {
  res.json(messages);
});

// Endpoint untuk mengirim chat baru
app.post("/pesan", (req, res) => {
  const { username, text } = req.body;
  if (!username || !text) {
    return res.status(400).json({ error: "username dan text harus diisi" });
  }

  const newMsg = {
    id: Date.now().toString(),
    username,
    text,
  };

  messages.push(newMsg);

  // Setelah nambah pesan, broadcast ke semua socket
  io.emit("chat message", newMsg);

  res.status(201).json(newMsg);
});

io.on("connection", (socket) => {
  console.log("Client connected");

  // Kirim riwayat chat ke user baru
  socket.emit("chat history", messages);

  // Saat pesan diterima via websocket
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
  console.log("Server jalan di https://mjk-backend-five.vercel.app:3333");
});
