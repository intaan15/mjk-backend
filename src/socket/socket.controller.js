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

    socket.on("chat message", async (msg) => {
      try {
        const { senderId, receiverId, text, role } = msg;

        // 1. Cek apakah ChatList masih aktif
        const chatList = await ChatList.findOne({
          "participants.user": { $all: [senderId, receiverId] },
        }).populate("jadwal");

        if (!chatList || !chatList.jadwal) {
          return socket.emit("errorMessage", {
            message: "❌ Chat tidak ditemukan atau jadwal tidak valid.",
          });
        }

        const jadwal = chatList.jadwal;
        const [hour, minute] = jadwal.jam_konsul.split(":").map(Number);
        const startTime = new Date(jadwal.tgl_konsul);
        startTime.setHours(hour);
        startTime.setMinutes(minute);
        startTime.setSeconds(0);

        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 30 menit
        const now = new Date();

        // 2. Jika sudah lewat waktu atau status selesai, tolak pengiriman
        if (jadwal.status_konsul === "selesai" || now >= endTime) {
          return socket.emit("errorMessage", {
            message:
              "⛔ Konsultasi telah selesai. Anda tidak dapat mengirim pesan.",
          });
        }

        // 3. Simpan & emit pesan
        const newChat = await Chat.create({
          senderId,
          receiverId,
          text,
          role,
          waktu: now,
        });

        io.to(receiverId).emit("chat message", newChat);
        io.to(senderId).emit("chat message", newChat);

        // Update last message
        chatList.lastMessage = text;
        chatList.lastMessageDate = now;
        await chatList.save();
      } catch (error) {
        console.error(
          "❌ Error saat mengirim pesan:",
          error.message,
          error.stack
        );
        socket.emit("errorMessage", {
          message: "❌ Terjadi kesalahan saat mengirim pesan.",
        });
      }
    });

    
    // socket.on("resetUnreadCount", async ({ chatId, userId }) => {
    //   try {
    //     const chat = await ChatList.findById(chatId);

    //     if (!chat) {
    //       console.warn("ChatList tidak ditemukan:", chatId);
    //       return;
    //     }

    //     // Reset unread count
    //     chat.unreadCount[userId] = 0;
    //     await chat.save();

    //     // Emit ke user terkait agar UI update
    //     io.to(userId).emit("unreadCountUpdated", {
    //       chatId,
    //       unreadCount: chat.unreadCount,
    //     });

    //     // Emit ke peserta lain jika mau
    //     const otherUserId = Object.keys(chat.unreadCount).find(
    //       (id) => id !== userId
    //     );
    //     if (otherUserId) {
    //       io.to(otherUserId).emit("unreadCountUpdated", {
    //         chatId,
    //         unreadCount: chat.unreadCount,
    //       });
    //     }
    //   } catch (error) {
    //     console.error("Gagal reset unread count:", error.message);
    //   }
    // });
    

    
    
    

    // BESOK LAGI INI 
    // socket.on("chat message", async (msg) => {
    //   try {
    //     if (!msg.senderId || !msg.receiverId) {
    //       console.warn("Pesan tidak lengkap:", msg);
    //       return;
    //     }

    //     const chatList = await ChatList.findOne({
    //       "participants.user": { $all: [msg.senderId, msg.receiverId] },
    //       jadwal: msg.jadwalId,
    //     }).populate("jadwal");

    //     // const chatList = await ChatList.findOne({
    //     //   "participants.user": { $all: [msg.senderId, msg.receiverId] },
    //     // }).populate("jadwal");

    //     if (!chatList) {
    //       return socket.emit("errorMessage", {
    //         message: "Sesi chat tidak ditemukan.",
    //       });
    //     }

    //     // Validasi apakah sesi sudah selesai
    //     const jadwal = chatList.jadwal;
    //     const [hour, minute] = jadwal.jam_konsul.split(":").map(Number);
    //     const startTime = new Date(jadwal.tgl_konsul);
    //     startTime.setHours(hour);
    //     startTime.setMinutes(minute);
    //     startTime.setSeconds(0);

    //     const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 3 menit

    //     const now = new Date();
    //     if (jadwal.status_konsul === "selesai") {
    //       return socket.emit("errorMessage", {
    //         message:
    //           "⛔ Konsultasi telah selesai. Anda tidak dapat mengirim pesan.",
    //       });
    //     }

    //     // Lanjut jika valid
    //     const newMsg = new Chat({
    //       text: msg.text || "",
    //       sender: msg.sender || "User",
    //       senderId: msg.senderId,
    //       receiverId: msg.receiverId,
    //       image: msg.image || null,
    //       type: msg.type || "text",
    //       role: msg.role || "unknown",
    //       waktu: msg.waktu || now,
    //     });

    //     const savedMsg = await newMsg.save();

    //     // Update chatlist
    //     if (chatList) {
    //       chatList.lastMessage =
    //         msg.text || (msg.type === "image" ? "📷 Gambar" : "Pesan baru");
    //       chatList.lastMessageDate = new Date();
    //       const currentUnread = chatList.unreadCount.get(msg.receiverId) || 0;
    //       chatList.unreadCount.set(msg.receiverId, currentUnread + 1);
    //       await chatList.save();
    //     }

    //     // Emit ke dua user
    //     io.to(savedMsg.receiverId.toString()).emit("chat message", savedMsg);
    //     io.to(savedMsg.senderId.toString()).emit("chat message", savedMsg);
    //   } catch (err) {
    //     console.error("Error saat simpan pesan:", err.message);
    //   }
    // });
        

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

module.exports = createSocketServer;
