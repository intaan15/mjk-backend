const { Server } = require("socket.io");
const Chat = require("./chat.model"); // pastikan path benar

const createSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    console.log("Client connected");

    socket.emit("connected", { message: "Successfully connected to backend" });

    // Ambil chat history dari DB, misalnya 50 chat terakhir, urut berdasarkan waktu
    const recentChats = await Chat.find()
      .sort({ waktu: -1 })
      .limit(50)
      .sort({ waktu: 1 }); // urutkan lagi ascending supaya enak dibaca

    socket.emit("chat history", recentChats);

    socket.on("chat message", async (msg) => {
      try {
        // Simpan ke DB
        const newMsg = new Chat(msg);
        const savedMsg = await newMsg.save();

        // Kirim ke semua client
        io.emit("chat message", savedMsg);
      } catch (err) {
        console.error("Error saving chat message:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  return io;
};

module.exports = createSocketServer;
