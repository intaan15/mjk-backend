const { Server } = require("socket.io");

const createSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

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

  return io; // Return the io instance for future use if needed
};

module.exports = createSocketServer;
