// file: chat.model.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  image: { type: String, default: null }, // penting!
  text: { type: String, default: "text" },
  type: { type: String, enum: ["text", "image"], required: true },
  role: { type: String, enum: ["dokter", "masyarakat"], required: true },
  waktu: { type: Date, default: Date.now },
});
  

module.exports = mongoose.model("Chat", chatSchema);
