const express = require("express");
const router = express.Router();
const Chat = require("./chat.model"); // sudah benar karena masih di folder socket
const verifyToken = require("../middleware/verifyToken");

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
  

module.exports = router;
