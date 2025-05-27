const { Server } = require("socket.io");
const Chat = require("./chat.model");

const createSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    console.log("Client connected:", socket.id);

    socket.emit("connected", { message: "Successfully connected to backend" });

    try {
      // Ambil 50 pesan terakhir, urut waktu ascending
      const recentChats = await Chat.find()
        .sort({ waktu: -1 }) // ambil terbaru dulu
        .limit(50)
        .lean(); // lebih ringan
      socket.emit("chat history", recentChats.reverse()); // tampilkan urut lama ke baru
    } catch (err) {
      console.error("Gagal ambil chat history:", err.message);
    }

    socket.on("chat message", async (msg) => {
      try {
        // Validasi minimal
        if (!msg.senderId || !msg.receiverId) {
          console.warn("Pesan tidak lengkap:", msg);
          return;
        }

        const newMsg = new Chat({
          text: msg.text || "",
          sender: msg.sender || "User",
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          image: msg.image || null,
          type: msg.type || "text",
          waktu: msg.waktu || new Date(),
        });

        const savedMsg = await newMsg.save();
        io.emit("chat message", savedMsg); // broadcast ke semua
      } catch (err) {
        console.error("Error saat simpan pesan:", err.message);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

module.exports = createSocketServer;
