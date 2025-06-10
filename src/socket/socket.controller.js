const { Server } = require("socket.io");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model");

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

        console.log("📩 Menerima pesan dari:", senderId, "ke:", receiverId, "pesan:", text);

        // 1. Cari ChatList dengan jadwal terdapat yang sedang berlangsung
        const chatList = await ChatList.findOne({
          "participants.user": { $all: [senderId, receiverId] },
        }).populate("jadwal").sort({ "jadwal.tgl_konsul": -1 }); // Ambil jadwal terbaru

        console.log("🔍 ChatList ditemukan:", !!chatList);
        console.log("🔍 Jadwal ditemukan:", !!chatList?.jadwal);

        if (!chatList || !chatList.jadwal) {
          console.log("❌ ChatList atau jadwal tidak ditemukan");
          return socket.emit("errorMessage", {
            message: "❌ Tidak ada sesi konsultasi aktif. Silakan buat jadwal konsultasi baru.",
          });
        }

        const jadwal = chatList.jadwal;
        console.log("📅 Status jadwal:", jadwal.status_konsul);
        console.log("📅 Tanggal konsul:", jadwal.tgl_konsul);
        console.log("📅 Jam konsul:", jadwal.jam_konsul);

        // 2. Cek status konsultasi terlebih dahulu (paling penting)
        if (jadwal.status_konsul === "selesai") {
          console.log("⛔ Status konsultasi: selesai");
          return socket.emit("errorMessage", {
            message: "⛔ Konsultasi telah selesai. Silakan buat jadwal konsultasi baru untuk melanjutkan.",
          });
        }

        // 3. Cek apakah status konsultasi berlangsung
        if (jadwal.status_konsul !== "berlangsung" && jadwal.status_konsul !== "aktif") {
          console.log("⏳ Status konsultasi:", jadwal.status_konsul, "- tidak berlangsung");
          return socket.emit("errorMessage", {
            message: `⏳ Konsultasi belum dimulai. Status saat ini: ${jadwal.status_konsul}`,
          });
        }

        // 4. Validasi waktu (opsional, bisa dinonaktifkan jika tidak diperlukan)
        try {
          const [hour, minute] = jadwal.jam_konsul.split(":").map(Number);
          if (!isNaN(hour) && !isNaN(minute)) {
            const startTime = new Date(jadwal.tgl_konsul);
            startTime.setHours(hour, minute, 0, 0);
            const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
            const now = new Date();

            console.log("⏰ Start Time:", startTime.toISOString());
            console.log("⏰ End Time:", endTime.toISOString());
            console.log("⏰ Now:", now.toISOString());

            // Auto-update status jika waktu habis
            if (now >= endTime) {
              console.log("⏰ Waktu konsultasi habis, mengupdate status ke selesai");
              jadwal.status_konsul = "selesai";
              await jadwal.save();
              
              return socket.emit("errorMessage", {
                message: "⛔ Waktu konsultasi telah habis. Konsultasi otomatis ditutup.",
              });
            }
          }
        } catch (timeError) {
          console.log("⚠️ Error validasi waktu (diabaikan):", timeError.message);
          // Jangan block pengiriman pesan jika ada error waktu
        }

        // 5. Simpan & emit pesan
        console.log("💾 Menyimpan pesan ke database...");
        const newChat = await Chat.create({
          senderId,
          receiverId,
          text,
          role,
          waktu: new Date(),
        });

        console.log("✅ Pesan berhasil disimpan:", newChat._id);

        // Emit pesan ke semua participant
        io.to(receiverId).emit("chat message", newChat);
        io.to(senderId).emit("chat message", newChat);

        // Update last message di ChatList
        chatList.lastMessage = text;
        chatList.lastMessageDate = new Date();
        await chatList.save();

        console.log("✅ Pesan berhasil dikirim dan diupdate di ChatList");

      } catch (error) {
        console.error("❌ Error detail saat mengirim pesan:");
        console.error("- Message:", error.message);
        console.error("- Stack:", error.stack);
        console.error("- Data pesan:", msg);
        
        socket.emit("errorMessage", {
          message: "❌ Terjadi kesalahan saat mengirim pesan: " + error.message,
        });
      }
    });

    // Event untuk memulai konsultasi (update status menjadi berlangsung)
    socket.on("startConsultation", async (data) => {
      try {
        const { senderId, receiverId, jadwalId } = data;
        
        // Cari dan update jadwal menjadi berlangsung
        const Jadwal = require("./jadwal.model"); // Sesuaikan dengan model jadwal Anda
        const jadwal = await Jadwal.findById(jadwalId);
        
        if (!jadwal) {
          return socket.emit("errorMessage", {
            message: "❌ Jadwal konsultasi tidak ditemukan.",
          });
        }

        // Update status menjadi berlangsung
        jadwal.status_konsul = "berlangsung";
        await jadwal.save();

        // Update atau buat ChatList
        let chatList = await ChatList.findOne({
          "participants.user": { $all: [senderId, receiverId] },
        });

        if (chatList) {
          // Update jadwal yang ada
          chatList.jadwal = jadwalId;
          await chatList.save();
        } else {
          // Buat ChatList baru jika belum ada
          chatList = await ChatList.create({
            participants: [
              { user: senderId },
              { user: receiverId }
            ],
            jadwal: jadwalId,
            lastMessage: "",
            lastMessageDate: new Date(),
          });
        }

        // Emit ke semua participant bahwa konsultasi sudah dimulai
        io.to(senderId).emit("consultationStarted", {
          message: "✅ Konsultasi dimulai! Anda sekarang bisa mengirim pesan.",
          chatListId: chatList._id
        });
        
        io.to(receiverId).emit("consultationStarted", {
          message: "✅ Konsultasi dimulai! Anda sekarang bisa mengirim pesan.",
          chatListId: chatList._id
        });

      } catch (error) {
        console.error("❌ Error saat memulai konsultasi:", error.message);
        socket.emit("errorMessage", {
          message: "❌ Gagal memulai konsultasi.",
        });
      }
    });

    // Event untuk mengakhiri konsultasi manual
    socket.on("endConsultation", async (data) => {
      try {
        const { jadwalId, endedBy } = data;
        
        const Jadwal = require("./jadwal.model");
        const jadwal = await Jadwal.findById(jadwalId);
        
        if (!jadwal) {
          return socket.emit("errorMessage", {
            message: "❌ Jadwal konsultasi tidak ditemukan.",
          });
        }

        jadwal.status_konsul = "selesai";
        await jadwal.save();

        // Emit ke semua participant bahwa konsultasi selesai
        const chatList = await ChatList.findOne({ jadwal: jadwalId }).populate("participants.user");
        
        if (chatList) {
          chatList.participants.forEach(participant => {
            io.to(participant.user._id.toString()).emit("consultationEnded", {
              message: "⛔ Konsultasi telah selesai.",
              endedBy: endedBy
            });
          });
        }

      } catch (error) {
        console.error("❌ Error saat mengakhiri konsultasi:", error.message);
        socket.emit("errorMessage", {
          message: "❌ Gagal mengakhiri konsultasi.",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

module.exports = createSocketServer;

    
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
        

//     socket.on("disconnect", () => {
//       console.log("Client disconnected:", socket.id);
//     });
//   });

//   return io;
// };

// module.exports = createSocketServer;
