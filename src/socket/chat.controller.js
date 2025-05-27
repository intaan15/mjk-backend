const express = require("express");
const router = express.Router();
const Chat = require("./chat.model"); // asumsikan ini sudah benar, pointing ke model Chat
const verifyToken = require("../middleware/verifyToken");
const ObjectId = mongoose.Types.ObjectId;

// GET /api/chat/history/:senderId/:receiverId
router.get("/history/:senderId/:receiverId", verifyToken, async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    console.log("Fetch chat history:", senderId, receiverId);

    const messages = await Chat.find({
      $or: [
        { senderId: ObjectId(senderId), receiverId: ObjectId(receiverId) },
        { senderId: ObjectId(receiverId), receiverId: ObjectId(senderId) },
      ],
    }).sort({ waktu: 1 });

    res.json(messages);
  } catch (error) {
    console.error("Error get chat history:", error);
    res.status(500).json({ error: "Server error ambil riwayat chat" });
  }
});


module.exports = router;
