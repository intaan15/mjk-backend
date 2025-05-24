const express = require("express");
const router = express.Router();
const Chat = require("./chat.model"); // sudah benar karena masih di folder socket
const verifyToken = require("../middleware/verifyToken");
const User = require("../masyarakat/masyarakat.model");     

// GET /api/chat/history/:user1/:user2
router.get("/chat/history/:senderId/:receiverId", async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    console.log("Fetch chat history:", senderId, receiverId);

    const messages = await MessageModel.find({
      $or: [
        { dari: senderId, kepada: receiverId },
        { dari: receiverId, kepada: senderId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error("Error get chat history:", error);
    res.status(500).json({ error: "Server error ambil riwayat chat" });
  }
});
  

router.get("/chatlist/:userId", verifyToken, async (req, res) => {
  const { userId } = req.params;

  try {
    // Cari chat yang melibatkan userId
    const chats = await Chat.find({
      $or: [{ dari: userId }, { ke: userId }],
    });

    // Kumpulkan unique lawan chat
    const kontakSet = new Set();
    chats.forEach((chat) => {
      if (chat.dari !== userId) kontakSet.add(chat.dari);
      if (chat.ke !== userId) kontakSet.add(chat.ke);
    });

    // Kalau mau lebih lengkap, bisa fetch detail user lawan chat
    // Contoh fetch nama dan foto user lawan
    const kontakArray = Array.from(kontakSet);

    // Contoh fetch data user lawan dari DB User collection (misal)
    // Asumsi ada model User dengan _id, nama, foto
    const users = await User.find(
      { _id: { $in: kontakArray } },
      "_id username_masyarakat foto_profil_masyarakat"
    );

    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal ambil daftar chat" });
  }
});
  

module.exports = router;
