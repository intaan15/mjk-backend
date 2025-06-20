const { Server } = require("socket.io");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model");
const Jadwal = require("../jadwal/jadwal.model");
const fs = require("fs");
const path = require("path");

const createSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Membuat folder public/imageschat jika belum ada
  const imagesDir = path.join(__dirname, "../../public/imageschat");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log("📁 Folder imageschat berhasil dibuat:", imagesDir);
  }

  // Fungsi untuk menyimpan gambar
  const saveImageToFile = (imageData, filename) => {
    try {
      console.log("💾 Mulai menyimpan gambar:");
      console.log("- Filename:", filename);
      console.log("- ImageData length:", imageData.length);
      console.log("- ImageData preview:", imageData.substring(0, 50) + "...");

      // Hapus header data:image/jpeg;base64, atau data:image/png;base64,
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "");
      console.log(
        "- Base64 data length after header removal:",
        base64Data.length
      );

      const filePath = path.join(imagesDir, filename);
      console.log("- Full file path:", filePath);

      fs.writeFileSync(filePath, base64Data, "base64");

      console.log("✅ Gambar berhasil disimpan:", filePath);
      return `/imageschat/${filename}`; // Return relative path untuk URL
    } catch (error) {
      console.error("❌ Error menyimpan gambar:", error.message);
      console.error("❌ Error stack:", error.stack);
      throw error;
    }
  };

  // Fungsi untuk generate nama file unik
  const generateImageFilename = (senderId, type = "jpg") => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${senderId}_${timestamp}_${random}.${type}`;
  };

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("joinRoom", (userId) => {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room: ${userId}`);
    });

    // Socket handler untuk menangani image dengan penyimpanan ke file
    socket.on("chat message", async (msg) => {
      try {
        const { senderId, receiverId, text, role, type, image } = msg;

        // DEBUG: Log seluruh data yang diterima
        console.log("🔍 DEBUG - Data lengkap yang diterima:");
        console.log("- senderId:", senderId);
        console.log("- receiverId:", receiverId);
        console.log("- type:", type);
        console.log("- text:", text);
        console.log("- role:", role);
        console.log("- hasImage:", !!image);
        console.log("- imageLength:", image ? image.length : 0);
        console.log("- imageType:", image ? typeof image : "undefined");

        if (image) {
          console.log("- imagePreview:", image.substring(0, 50) + "...");
        }

        console.log(
          "📩 Menerima pesan dari:",
          senderId,
          "ke:",
          receiverId,
          "type:",
          type,
          "text:",
          text,
          "hasImage:",
          !!image
        );

        const chatList = await ChatList.findOne({
          "participants.user": { $all: [senderId, receiverId] },
        })
          .populate("jadwal")
          .sort({ "jadwal.tgl_konsul": -1 });

        console.log("🔍 ChatList ditemukan:", !!chatList);
        console.log("🔍 Jadwal ditemukan:", !!chatList?.jadwal);

        if (!chatList || !chatList.jadwal) {
          console.log("❌ ChatList atau jadwal tidak ditemukan");
          return socket.emit("errorMessage", {
            message:
              "❌ Tidak ada sesi konsultasi aktif. Silakan buat jadwal konsultasi baru.",
          });
        }

        const jadwal = chatList.jadwal;
        console.log("📅 Status jadwal:", jadwal.status_konsul);

        if (jadwal.status_konsul === "selesai") {
          console.log("⛔ Status konsultasi: selesai");
          return socket.emit("errorMessage", {
            message:
              "⛔ Konsultasi telah selesai. Silakan buat jadwal konsultasi baru untuk melanjutkan.",
          });
        }

        if (
          jadwal.status_konsul !== "berlangsung" &&
          jadwal.status_konsul !== "aktif"
        ) {
          console.log(
            "⏳ Status konsultasi:",
            jadwal.status_konsul,
            "- tidak berlangsung"
          );
          return socket.emit("errorMessage", {
            message: `⏳ Konsultasi belum dimulai. Status saat ini: ${jadwal.status_konsul}`,
          });
        }

        // Time validation
        try {
          const [hour, minute] = jadwal.jam_konsul.split(":").map(Number);
          if (!isNaN(hour) && !isNaN(minute)) {
            const startTime = new Date(jadwal.tgl_konsul);
            startTime.setHours(hour, minute, 0, 0);
            const endTime = new Date(startTime.getTime() + 120 * 60 * 1000);

            const now1 = new Date();
            const jakartaOffset = 7 * 60; // 7 hours in minutes
            const now = new Date(now1.getTime() + jakartaOffset * 60 * 1000);

            if (now >= endTime) {
              console.log(
                "⏰ Waktu konsultasi habis, mengupdate status ke selesai"
              );
              jadwal.status_konsul = "selesai";
              await jadwal.save();
              return socket.emit("errorMessage", {
                message:
                  "⛔ Waktu konsultasi telah habis. Konsultasi otomatis ditutup.",
              });
            }
          }
        } catch (timeError) {
          console.log(
            "⚠️ Error validasi waktu (diabaikan):",
            timeError.message
          );
        }

        console.log("💾 Menyimpan pesan ke database...");

        // Buat object berdasarkan type
        const chatData = {
          senderId,
          receiverId,
          role,
          type: type || "text",
          waktu: new Date(),
        };

        // DEBUG: Log sebelum memproses
        console.log("🔍 DEBUG - Sebelum memproses:");
        console.log("- Kondisi type === 'image':", type === "image");
        console.log("- Kondisi !!image:", !!image);
        console.log("- Gabungan kondisi:", type === "image" && !!image);

        // Tambahkan field berdasarkan type
        if (type === "image" && image && image.trim() !== "") {
          console.log("🖼️ Memproses gambar...");

          // Validasi format base64
          if (!image.startsWith("data:image/")) {
            throw new Error(
              "Format gambar tidak valid. Harus berupa base64 dengan header data:image/"
            );
          }

          // Deteksi format gambar dari base64 header
          const imageFormat = image.match(/^data:image\/([a-z]+);base64,/);
          const fileExtension = imageFormat ? imageFormat[1] : "jpg";

          console.log("📝 Format gambar terdeteksi:", fileExtension);

          // Generate nama file unik
          const filename = generateImageFilename(senderId, fileExtension);
          console.log("📝 Nama file yang akan dibuat:", filename);

          // Simpan gambar ke file
          const imagePath = saveImageToFile(image, filename);

          chatData.image = imagePath; // Simpan path relatif
          chatData.text = text || null; // Tetap simpan text jika ada

          console.log("✅ Gambar berhasil disimpan dengan path:", imagePath);
        } else if (type === "text" || !type) {
          console.log("📝 Memproses text...");
          chatData.text = text;
          chatData.image = null; // Set image null untuk text
        } else {
          console.log("⚠️ Kondisi tidak terpenuhi untuk menyimpan gambar:");
          console.log("- type:", type);
          console.log("- image exists:", !!image);
          console.log(
            "- image empty:",
            image === "" || image === null || image === undefined
          );

          // Default ke text jika kondisi tidak jelas
          chatData.text = text;
          chatData.image = null;
        }

        const newChat = await Chat.create(chatData);
        console.log(
          "✅ Pesan berhasil disimpan:",
          newChat._id,
          "Type:",
          newChat.type
        );

        // Emit pesan lengkap ke kedua user
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

        io.to(receiverId).emit("chat message", messageToSend);
        io.to(senderId).emit("chat message", messageToSend);

        // Update lastMessage di ChatList
        if (type === "image") {
          chatList.lastMessage = "📷 Gambar";
        } else {
          chatList.lastMessage = text;
        }
        chatList.lastMessageDate = new Date();
        await chatList.save();

        console.log("✅ Pesan berhasil dikirim dan diupdate di ChatList");
      } catch (error) {
        console.log("❌ Error detail saat mengirim pesan:");
        console.log("- Message:", error.message);
        console.log("- Stack:", error.stack);
        console.log("- Data pesan:", msg);
        socket.emit("errorMessage", {
          message: "❌ Terjadi kesalahan saat mengirim pesan: " + error.message,
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
            lastMessageDate: new Date(),
          });
        }

        io.to(senderId).emit("consultationStarted", {
          message: "✅ Konsultasi dimulai! Anda sekarang bisa mengirim pesan.",
          chatListId: chatList._id,
        });

        io.to(receiverId).emit("consultationStarted", {
          message: "✅ Konsultasi dimulai! Anda sekarang bisa mengirim pesan.",
          chatListId: chatList._id,
        });
      } catch (error) {
        console.log("❌ Error saat memulai konsultasi:", error.message);
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
          console.log("❌ Jadwal tidak ditemukan untuk ID:", jadwalId);
          return socket.emit("errorMessage", {
            message: "❌ Jadwal konsultasi tidak ditemukan.",
          });
        }

        jadwal.status_konsul = "selesai";
        await jadwal.save();
        console.log("✅ Jadwal status updated to selesai for ID:", jadwalId);

        const chatList = await ChatList.findOne({ jadwal: jadwalId }).populate(
          "participants.user"
        );

        if (chatList) {
          console.log(
            "📢 Emitting consultationEnded to participants:",
            chatList.participants.map((p) => p.user._id.toString())
          );
          chatList.participants.forEach((participant) => {
            io.to(participant.user._id.toString()).emit("consultationEnded", {
              message: "⛔ Konsultasi telah selesai.",
              endedBy: endedBy,
              jadwalId: jadwalId,
            });
          });
        } else {
          console.log("❌ ChatList tidak ditemukan untuk jadwal ID:", jadwalId);
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
