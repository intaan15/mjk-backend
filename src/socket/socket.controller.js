const { Server } = require("socket.io");
const Chat = require("./chat.model");

const createSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("joinRoom", (userId) => {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room: ${userId}`);
    });

    socket.on("chat message", async (msg) => {
      try {
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

        // Emit ke receiver dan sender supaya realtime di kedua sisi
        io.to(savedMsg.receiverId.toString()).emit("chat message", savedMsg);
        io.to(savedMsg.senderId.toString()).emit("chat message", savedMsg);
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
