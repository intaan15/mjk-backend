const { Server } = require("socket.io");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model"); // sesuaikan path kamu


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

    
    socket.on("resetUnreadCount", async ({ chatId, userId }) => {
      try {
        const chat = await ChatList.findById(chatId);

        if (!chat) {
          console.warn("ChatList tidak ditemukan:", chatId);
          return;
        }

        // Reset unread count
        chat.unreadCount[userId] = 0;
        await chat.save();

        // Emit ke user terkait agar UI update
        io.to(userId).emit("unreadCountUpdated", {
          chatId,
          unreadCount: chat.unreadCount,
        });

        // Emit ke peserta lain jika mau
        const otherUserId = Object.keys(chat.unreadCount).find(
          (id) => id !== userId
        );
        if (otherUserId) {
          io.to(otherUserId).emit("unreadCountUpdated", {
            chatId,
            unreadCount: chat.unreadCount,
          });
        }
      } catch (error) {
        console.error("Gagal reset unread count:", error.message);
      }
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
          role: role,
          waktu: msg.waktu || new Date(),
        });

        const savedMsg = await newMsg.save();

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
