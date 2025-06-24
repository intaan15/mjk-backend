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

    const formattedChatlists = chatlists
      .map((chat) => {
        try {
          // Find other participant with null check
          const otherParticipant = chat.participants.find(
            (p) => p.user && p.user._id && p.user._id.toString() !== userId
          );

          // If no valid other participant found, skip this chat
          if (!otherParticipant || !otherParticipant.user) {
            console.warn('[WARN] Skipping chat with missing participant data:', chat._id);
            return null;
          }

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
        } catch (error) {
          console.log('[ERROR] Error processing chat:', chat._id, error);
          return null;
        }
      })
      .filter(Boolean); // Remove null entries

    res.status(200).json(formattedChatlists);
  } catch (error) {
    console.log("Gagal ambil daftar chat:", error);
    res.status(500).json({ message: "Gagal ambil daftar chat" });
  }
});

module.exports = router;