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
    // Ambil semua chat di mana user menjadi peserta
    const chatlists = await ChatList.find({
      "participants.user": userId,
    })
      .sort({ lastMessageDate: -1 })
      .populate("participants.user"); // Populate agar dapat detail user

    const formattedChatlists = chatlists.map((chat) => {
      // Cari peserta selain user yang login
      const otherParticipant = chat.participants.find(
        (p) => p.user._id.toString() !== userId
      );

      const selfParticipant = chat.participants.find(
        (p) => p.user._id.toString() === userId
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

      return {
        _id: chat._id,
        lastMessage: chat.lastMessage,
        lastMessageDate: chat.lastMessageDate,
        unreadCount:
          chat.unreadCount?.get?.(userId) ?? chat.unreadCount?.[userId] ?? 0,
        participant: {
          _id: otherParticipant.user._id,
          role: otherParticipant.role.toLowerCase(),
          nama,
          foto_profil,
        },
        status: chat.status || "berlangsung",
      };
    });

    res.status(200).json(formattedChatlists);
  } catch (error) {
    console.error("Gagal ambil daftar chat:", error);
    res.status(500).json({ message: "Gagal ambil daftar chat" });
  }
});

module.exports = router;
