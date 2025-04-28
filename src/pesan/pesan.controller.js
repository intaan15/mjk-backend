const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const cors = require("cors");
const {
  router: pesanRouter,
  addMessage,
  getMessages,
} = require("./pesan");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // kasih izin dari semua origin
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/api/pesan", pesanRouter);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("A user connected");

  // Kirim semua chat history ke client baru
  socket.emit("chat history", getMessages());

  socket.on("chat message", (msg) => {
    console.log("Received message:", msg);
    addMessage(msg); // Simpan ke memori
    io.emit("chat message", msg); // Kirim ke semua client
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Start server
const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
