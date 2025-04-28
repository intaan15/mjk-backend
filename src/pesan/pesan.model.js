const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  text: String,
  mediaUrl: String,
  timestamp: Date,
});

module.exports = mongoose.model("Message", MessageSchema);
