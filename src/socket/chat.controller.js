const express = require("express");
const router = express.Router();
const Chat = require("./chat.model"); // asumsikan ini sudah benar, pointing ke model Chat
const verifyToken = require("../middleware/verifyToken");

// GET /api/chat/history/:senderId/:receiverId
router.get("/history/:senderId/:receiverId", verifyToken, async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    console.log("Fetch chat history:", senderId, receiverId);

    const messages = await Chat.find({
      $or: [
        { senderId: senderId, receiverId: receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    }).sort({ waktu: 1 }); // urut berdasarkan waktu

    res.json(messages);
  } catch (error) {
    console.error("Error get chat history:", error);
    res.status(500).json({ error: "Server error ambil riwayat chat" });
  }
});

module.exports = router;
