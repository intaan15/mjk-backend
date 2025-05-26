const express = require("express");
const router = express.Router();
const Chat = require("../socket/chat.model");
const ChatList = require("../socket/chatlist.model"); // pastikan path-nya sesuai
const verifyToken = require("../middleware/verifyToken");
const Jadwal = require("../jadwal/jadwal.model"); // pastikan path-nya sesuai
const Masyarakat = require("../masyarakat/masyarakat.model");
const Dokter = require("../dokter/dokter.model");

router.get("/:userId", verifyToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const chatlists = await ChatList.find({
      participants: userId,
    }).sort({ lastMessageDate: -1 });

    const formattedChatlists = await Promise.all(
      chatlists.map(async (chat) => {
        // cari ID lawan bicara
        const otherUserId = chat.participants.find((id) => id !== userId);

        // Coba cari ke masyarakat
        let otherUser = await Masyarakat.findById(otherUserId).select(
          "_id nama_masyarakat foto_profil_masyarakat"
        );

        let role = "masyarakat";
        if (!otherUser) {
          // Kalau tidak ketemu di masyarakat, cari ke dokter
          otherUser = await Dokter.findById(otherUserId).select(
            "_id nama_dokter foto_profil_dokter"
          );
          role = "dokter";
        }

        return {
          _id: chat._id,
          lastMessage: chat.lastMessage,
          lastMessageDate: chat.lastMessageDate,
          unreadCount: chat.unreadCount.get(userId) || 0,
          participant: {
            _id: otherUser?._id || null,
            nama:
              role === "masyarakat"
                ? otherUser?.nama_masyarakat
                : otherUser?.nama_dokter,
            foto_profil:
              role === "masyarakat"
                ? otherUser?.foto_profil_masyarakat
                : otherUser?.foto_profil_dokter,
            role,
          },
        };
      })
    );

    res.status(200).json(formattedChatlists);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Gagal ambil daftar chat" });
  }
});

// router.post("/:id/terima", verifyToken, async (req, res) => {
//   const jadwalId = req.params.id;

//   // 1. Ambil data jadwal
//   const jadwalData = await Jadwal.findById(jadwalId)
//     .populate("dokter_id")
//     .populate("masyarakat_id");

//   if (!jadwalData)
//     return res.status(404).json({ message: "jadwal tidak ditemukan" });

//   // 2. Update status
//   jadwalData.status_konsul = "diterima";
//   await jadwalData.save();

//   const dokterId = jadwalData.dokter_id._id.toString();
//   const masyarakatId = jadwalData.masyarakat_id._id.toString();
//   const pesanTemplate = "Halo, ada yang bisa dibantu?";

//   // 3. Simpan pesan pertama ke koleksi Chat
//   await Chat.create({
//     senderid: dokterId,
//     receiverId: masyarakatId,
//     text: pesanTemplate,
//     type: "text",
//     role: "dokter",
//     waktu: new Date(),
//   });

//   // 4. Buat atau update ChatList
//   let chatlist = await ChatList.findOne({
//     participants: { $all: [dokterId, masyarakatId] },
//   });

//   if (!chatlist) {
//     chatlist = await ChatList.create({
//       participants: [dokterId, masyarakatId],
//       lastMessage: pesanTemplate,
//       lastMessageDate: new Date(),
//       unreadCount: {
//         [dokterId]: 0,
//         [masyarakatId]: 1,
//       },
//     });
//   } else {
//     chatlist.lastMessage = pesanTemplate;
//     chatlist.lastMessageDate = new Date();
//     const currentUnread = chatlist.unreadCount.get(masyarakatId) || 0;
//     chatlist.unreadCount.set(masyarakatId, currentUnread + 1);
//     await chatlist.save();
//   }

//   return res.json({
//     message: "Jadwal diterima, pesan dikirim, dan chatlist diperbarui.",
//   });
// });

// router.get("/chatlist/:userId", verifyToken, async (req, res) => {
//   const { userId } = req.params;

//   try {
//     // Ambil chatlist yang melibatkan userId
//     const chatlists = await ChatList.find({
//       participants: userId,
//     }).populate("participants", "_id username_masyarakat foto_profil_masyarakat");

//     res.status(200).json(chatlists);
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "Gagal ambil daftar chat" });
//   }
// });
// router.get("/chat/history/:senderId/:receiverId", async (req, res) => {
//   try {
//     const { senderId, receiverId } = req.params;

//     const messages = await Chat.find({
//       $or: [
//         { senderId: senderId, receiverId: receiverId },
//         { senderId: receiverId, receiverId: senderId },
//       ],
//     }).sort({ waktu: 1 });

//     res.json(messages);
//   } catch (error) {
//     console.log("Error get chat history:", error);
//     res.status(500).json({ error: "Server error ambil riwayat chat" });
//   }
// });
module.exports = router;
