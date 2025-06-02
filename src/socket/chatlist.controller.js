const express = require("express");
const router = express.Router();
const Chat = require("../socket/chat.model");
const ChatList = require("../socket/chatlist.model"); 
const verifyToken = require("../middleware/verifyToken");
const Jadwal = require("../jadwal/jadwal.model"); 
const Masyarakat = require("../masyarakat/masyarakat.model");
const Dokter = require("../dokter/dokter.model");

router.get("/:userId", verifyToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const chatlists = await ChatList.find({
      "participants.user": userId,
    })
      .sort({ lastMessageDate: -1 })
      .populate("participants.user");

    const formattedChatlists = chatlists.map((chat) => {
      const otherParticipant = chat.participants.find(
        (p) => p.user._id.toString() !== userId
      );

      let nama = "";
      let foto_profil = "";

      if (otherParticipant.role === "Masyarakat") {
        nama = otherParticipant.user.nama_masyarakat || "Masyarakat";
        foto_profil = otherParticipant.user.foto_profil_masyarakat || "";
      } else if (otherParticipant.role === "Dokter") {
        nama = otherParticipant.user.nama_dokter || "Dokter";
        foto_profil = otherParticipant.user.foto_profil_dokter || "";
      }

      // Cek apakah ada pesan baru dengan bandingkan lastMessageDate dan lastReadAt user
      const lastReadAt = chat.lastReadAt?.get(userId) || new Date(0);
      const hasNewMessage = chat.lastMessageDate > lastReadAt;

      return {
        _id: chat._id,
        lastMessage: chat.lastMessage,
        lastMessageDate: chat.lastMessageDate,
        hasNewMessage, // true/false untuk frontend styling bold
        participant: {
          _id: otherParticipant.user._id,
          role: otherParticipant.role.toLowerCase(),
          nama,
          foto_profil,
        },
        status: chat.status,
      };
    });

    res.status(200).json(formattedChatlists);
  } catch (error) {
    console.error("Gagal ambil daftar chat:", error);
    res.status(500).json({ message: "Gagal ambil daftar chat" });
  }
});

// router.patch("/:chatId/read", verifyToken, async (req, res) => {
//   const { chatId } = req.params;
//   const userId = req.user.id;

//   try {
//     const chat = await ChatList.findById(chatId);
//     if (!chat) return res.status(404).json({ error: "Chat not found" });

//     // Update lastReadAt[userId]
//     chat.lastReadAt.set(userId, new Date());
//     await chat.save();

//     res.json({ success: true, updatedAt: chat.lastReadAt.get(userId) });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // POST /api/chats/:chatId/message
// router.post("/:chatId/message", async (req, res) => {
//   const { chatId } = req.params;
//   const { message } = req.body;

//   try {
//     const now = new Date();
//     const chat = await ChatList.findByIdAndUpdate(
//       chatId,
//       {
//         $set: {
//           lastMessage: message,
//           lastMessageDate: now,
//         },
//       },
//       { new: true }
//     );

//     res.json({ success: true, chat });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


module.exports = router;
