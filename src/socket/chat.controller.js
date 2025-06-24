const express = require("express");
const router = express.Router();
const Chat = require("./chat.model"); // asumsikan ini sudah benar, pointing ke model Chat
const verifyToken = require("../middleware/verifyToken");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// GET /api/chat/history/:senderId/:receiverId
router.get("/history/:senderId/:receiverId", verifyToken, async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;

    if (!ObjectId.isValid(senderId) || !ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid ObjectId" });
    }

    const sender = new ObjectId(senderId);
    const receiver = new ObjectId(receiverId);

    const messages = await Chat.find({
      $or: [
        { senderId: sender, receiverId: receiver },
        { senderId: receiver, receiverId: sender },
      ],
    }).sort({ waktu: 1 });

    res.json(messages);
  } catch (error) {
    console.log("Catch error in /history/:senderId/:receiverId:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});



module.exports = router;
