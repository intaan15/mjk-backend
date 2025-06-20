const { Server } = require("socket.io");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model");
const Jadwal = require("../jadwal/jadwal.model");
const fs = require("fs");
const path = require("path");

const createSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Untuk production, ganti dengan domain spesifik
      methods: ["GET", "POST"],
      credentials: true
    },
    // Konfigurasi khusus untuk Cloudflare
    transports: ['websocket', 'polling'], // Pastikan polling enabled
    allowEIO3: true, // Backward compatibility
    pingTimeout: 60000, // 60 detik
    pingInterval: 25000, // 25 detik
    upgradeTimeout: 30000, // 30 detik
    maxHttpBufferSize: 1e8, // 100MB untuk file upload
    // Cookie configuration untuk Cloudflare
    cookie: {
      name: "io",
      httpOnly: true,
      sameSite: "none", // Penting untuk cross-origin
      secure: true // Wajib true untuk HTTPS
    },
  });

  // Middleware untuk debugging connection
  io.use((socket, next) => {
    console.log("🔌 Socket middleware - Client attempting to connect:");
    console.log("- Socket ID:", socket.id);
    console.log("- Headers:", socket.handshake.headers);
    console.log("- Origin:", socket.handshake.headers.origin);
    console.log("- User-Agent:", socket.handshake.headers['user-agent']);
    console.log("- Transport:", socket.conn.transport.name);
    next();
  });

  // Enhanced connection logging
  io.engine.on("connection_error", (err) => {
    console.log("❌ Connection Error:");
    console.log("- Code:", err.code);
    console.log("- Message:", err.message);
    console.log("- Context:", err.context);
    console.log("- Type:", err.type);
  });

  // Membuat folder public/imageschat jika belum ada
  const imagesDir = path.join(__dirname, "../../public/imageschat");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log("📁 Folder imageschat berhasil dibuat:", imagesDir);
  }

  // Fungsi untuk mendapatkan waktu Jakarta
  const getJakartaTime = () => {
    const now = new Date();
    const jakartaTime = new Date(
      now.toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
      })
    );
    return jakartaTime;
  };

  // Fungsi untuk menyimpan gambar
  const saveImageToFile = (imageData, filename) => {
    try {
      console.log("💾 Mulai menyimpan gambar:");
      console.log("- Filename:", filename);
      console.log("- ImageData length:", imageData.length);

      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "");
      const filePath = path.join(imagesDir, filename);
      
      fs.writeFileSync(filePath, base64Data, "base64");
      console.log("✅ Gambar berhasil disimpan:", filePath);
      return `/imageschat/${filename}`;
    } catch (error) {
      console.error("❌ Error menyimpan gambar:", error.message);
      throw error;
    }
  };

  // Fungsi untuk generate nama file unik
  const generateImageFilename = (senderId, type = "jpg") => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${senderId}_${timestamp}_${random}.${type}`;
  };

  console.log("🚀 Socket.IO Server initialized with Cloudflare-compatible settings");

  io.on("connection", (socket) => {
    console.log("✅ Client connected successfully:");
    console.log("- Socket ID:", socket.id);
    console.log("- Transport:", socket.conn.transport.name);
    console.log("- IP Address:", socket.handshake.address);
    console.log("- Headers:", JSON.stringify(socket.handshake.headers, null, 2));
    
    // Emit welcome message untuk konfirmasi koneksi
    socket.emit("connectionConfirmed", {
      message: "✅ Connected to server successfully",
      socketId: socket.id,
      timestamp: getJakartaTime()
    });

    // Enhanced transport monitoring
    socket.conn.on("upgrade", () => {
      console.log("⬆️ Transport upgraded to:", socket.conn.transport.name);
    });

    socket.conn.on("upgradeError", (err) => {
      console.log("❌ Transport upgrade error:", err);
    });

    socket.on("joinRoom", (userId) => {
      socket.join(userId);
      console.log(`📥 Socket ${socket.id} joined room: ${userId}`);
      
      // Konfirmasi join room
      socket.emit("roomJoined", {
        userId: userId,
        socketId: socket.id,
        message: `✅ Successfully joined room: ${userId}`
      });
    });

    // Ping-pong untuk keep alive
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // Enhanced error handling
    socket.on("error", (error) => {
      console.log("❌ Socket error:", error);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Client disconnected:");
      console.log("- Socket ID:", socket.id);
      console.log("- Reason:", reason);
      console.log("- Transport:", socket.conn.transport.name);
    });

    // Socket handler untuk menangani image dengan penyimpanan ke file
    socket.on("chat message", async (msg) => {
      try {
        const { senderId, receiverId, text, role, type, image } = msg;

        console.log("📩 Menerima pesan dari:", senderId, "ke:", receiverId);

        const chatList = await ChatList.findOne({
          "participants.user": { $all: [senderId, receiverId] },
        })
          .populate("jadwal")
          .sort({ "jadwal.tgl_konsul": -1 });

        if (!chatList || !chatList.jadwal) {
          console.log("❌ ChatList atau jadwal tidak ditemukan");
          return socket.emit("errorMessage", {
            message: "❌ Tidak ada sesi konsultasi aktif. Silakan buat jadwal konsultasi baru.",
          });
        }

        const jadwal = chatList.jadwal;

        if (jadwal.status_konsul === "selesai") {
          return socket.emit("errorMessage", {
            message: "⛔ Konsultasi telah selesai. Silakan buat jadwal konsultasi baru untuk melanjutkan.",
          });
        }

        if (jadwal.status_konsul !== "berlangsung" && jadwal.status_konsul !== "aktif") {
          return socket.emit("errorMessage", {
            message: `⏳ Konsultasi belum dimulai. Status saat ini: ${jadwal.status_konsul}`,
          });
        }

        // Time validation
        try {
          const [hour, minute] = jadwal.jam_konsul.split(":").map(Number);
          if (!isNaN(hour) && !isNaN(minute)) {
            const consultationDate = new Date(jadwal.tgl_konsul);
            const startTime = new Date(
              consultationDate.getFullYear(),
              consultationDate.getMonth(),
              consultationDate.getDate(),
              hour,
              minute,
              0,
              0
            );
            const endTime = new Date(startTime.getTime() + 3 * 60 * 1000);
            const nowJakarta = getJakartaTime();

            if (nowJakarta >= endTime) {
              jadwal.status_konsul = "selesai";
              await jadwal.save();
              return socket.emit("errorMessage", {
                message: "⛔ Waktu konsultasi telah habis. Konsultasi otomatis ditutup.",
              });
            }
          }
        } catch (timeError) {
          console.log("⚠️ Error validasi waktu:", timeError.message);
        }

        // Buat object chat
        const chatData = {
          senderId,
          receiverId,
          role,
          type: type || "text",
          waktu: getJakartaTime(),
        };

        // Process image or text
        if (type === "image" && image && image.trim() !== "") {
          if (!image.startsWith("data:image/")) {
            throw new Error("Format gambar tidak valid");
          }

          const imageFormat = image.match(/^data:image\/([a-z]+);base64,/);
          const fileExtension = imageFormat ? imageFormat[1] : "jpg";
          const filename = generateImageFilename(senderId, fileExtension);
          const imagePath = saveImageToFile(image, filename);

          chatData.image = imagePath;
          chatData.text = text || null;
        } else {
          chatData.text = text;
          chatData.image = null;
        }

        const newChat = await Chat.create(chatData);

        const messageToSend = {
          _id: newChat._id,
          senderId: newChat.senderId,
          receiverId: newChat.receiverId,
          text: newChat.text,
          image: newChat.image,
          type: newChat.type,
          role: newChat.role,
          waktu: newChat.waktu,
        };

        // Emit dengan retry mechanism
        const emitWithRetry = (targetId, event, data, retries = 3) => {
          const targetSocket = io.sockets.sockets.get(targetId);
          if (targetSocket && targetSocket.connected) {
            targetSocket.emit(event, data);
          } else {
            io.to(targetId).emit(event, data);
          }
        };

        emitWithRetry(receiverId, "chat message", messageToSend);
        emitWithRetry(senderId, "chat message", messageToSend);

        // Update ChatList
        chatList.lastMessage = type === "image" ? "📷 Gambar" : text;
        chatList.lastMessageDate = getJakartaTime();
        await chatList.save();

        console.log("✅ Pesan berhasil dikirim");
      } catch (error) {
        console.log("❌ Error saat mengirim pesan:", error.message);
        socket.emit("errorMessage", {
          message: "❌ Terjadi kesalahan: " + error.message,
        });
      }
    });

    socket.on("startConsultation", async (data) => {
      try {
        const { senderId, receiverId, jadwalId } = data;
        const jadwal = await Jadwal.findById(jadwalId);

        if (!jadwal) {
          return socket.emit("errorMessage", {
            message: "❌ Jadwal konsultasi tidak ditemukan.",
          });
        }

        jadwal.status_konsul = "berlangsung";
        await jadwal.save();

        let chatList = await ChatList.findOne({
          "participants.user": { $all: [senderId, receiverId] },
        });

        if (chatList) {
          chatList.jadwal = jadwalId;
          await chatList.save();
        } else {
          chatList = await ChatList.create({
            participants: [{ user: senderId }, { user: receiverId }],
            jadwal: jadwalId,
            lastMessage: "",
            lastMessageDate: getJakartaTime(),
          });
        }

        io.to(senderId).emit("consultationStarted", {
          message: "✅ Konsultasi dimulai!",
          chatListId: chatList._id,
        });

        io.to(receiverId).emit("consultationStarted", {
          message: "✅ Konsultasi dimulai!",
          chatListId: chatList._id,
        });
      } catch (error) {
        console.log("❌ Error memulai konsultasi:", error.message);
        socket.emit("errorMessage", {
          message: "❌ Gagal memulai konsultasi.",
        });
      }
    });

    socket.on("endConsultation", async (data) => {
      try {
        const { jadwalId, endedBy } = data;
        const jadwal = await Jadwal.findById(jadwalId);

        if (!jadwal) {
          return socket.emit("errorMessage", {
            message: "❌ Jadwal konsultasi tidak ditemukan.",
          });
        }

        jadwal.status_konsul = "selesai";
        await jadwal.save();

        const chatList = await ChatList.findOne({ jadwal: jadwalId }).populate(
          "participants.user"
        );

        if (chatList) {
          chatList.participants.forEach((participant) => {
            io.to(participant.user._id.toString()).emit("consultationEnded", {
              message: "⛔ Konsultasi telah selesai.",
              endedBy: endedBy,
              jadwalId: jadwalId,
            });
          });
        }
      } catch (error) {
        console.error("❌ Error mengakhiri konsultasi:", error.message);
        socket.emit("errorMessage", {
          message: "❌ Gagal mengakhiri konsultasi.",
        });
      }
    });
  });

  return io;
};

module.exports = createSocketServer;