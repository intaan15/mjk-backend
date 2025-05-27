const express = require("express");
const router = express.Router();
const Chat = require("./chat.model"); // asumsikan ini sudah benar, pointing ke model Chat
const verifyToken = require("../middleware/verifyToken");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// GET /api/chat/history/:senderId/:receiverId
router.get("/history/:senderId/:receiverId", verifyToken, async (req, res) => {
  try {
    const sender = ObjectId(senderId);
    const receiver = ObjectId(receiverId);

    const messages = await Chat.find({
      $or: [
        { senderId: sender, receiverId: receiver },
        { senderId: receiver, receiverId: sender },
      ],
    }).sort({ waktu: 1 });

    res.json(messages);
  } catch (error) {
    console.error("Error casting ObjectId:", error.message);
    return res.status(400).json({ error: "Invalid ObjectId" });
  }
  
});


module.exports = router;
