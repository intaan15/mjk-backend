

// Start server
const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require("express");
const router = express.Router();

// Simpan pesan di memori sementara
let messages = [];

// Endpoint untuk ambil semua pesan
router.get("/", (req, res) => {
  res.status(200).json(messages);
});

// Function untuk diakses dari luar (server.js)
function addMessage(newMsg) {
  messages.push(newMsg);
}

function getMessages() {
  return messages;
}

module.exports = { router, addMessage, getMessages };

