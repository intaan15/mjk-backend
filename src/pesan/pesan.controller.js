// routes/pesan.js
const express = require("express");
const router = express.Router();

let messages = [];

// Endpoint untuk menerima pesan melalui HTTP
router.post("/pesan", (req, res) => {
  const { senderId, receiverId, text, mediaUrl } = req.body;

  const newMsg = {
    id: Date.now().toString(),
    senderId,
    receiverId,
    text,
    mediaUrl,
    timestamp: new Date().toISOString(),
  };

  messages.push(newMsg);

  // Kirim pesan ke semua client yang terhubung melalui Socket.IO
  req.io.emit("chat message", newMsg);

  res.status(200).json(newMsg); // Kirim kembali pesan yang baru ditambahkan
});

// Endpoint untuk mendapatkan riwayat chat
router.get("/api/pesan", (req, res) => {
  res.status(200).json(messages); // Kirim semua pesan
});

module.exports = router;
