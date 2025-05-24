const express = require("express");
const router = express.Router();
const Chat = require("./chat.model"); // sudah benar karena masih di folder socket
const verifyToken = require("../middleware/verifyToken");

// GET /api/chat/history/:user1/:user2
router.get("/history/:user1/:user2", verifyToken, async (req, res) => {
  const { user1, user2 } = req.params;

  try {
    const messages = await Chat.find({
      $or: [
        { dari: user1, ke: user2 },
        { dari: user2, ke: user1 },
      ],
    }).sort({ waktu: 1 });

    res.status(200).json(messages);
  } catch (err) {
    console.error("Error ambil chat:", err);
    res.status(500).json({ message: "Gagal ambil chat" });
  }
});

module.exports = router;
