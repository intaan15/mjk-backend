// file: chat.model.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  dari: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ke: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isi: { type: String, required: true },
  role: { type: String, enum: ["dokter", "masyarakat"], required: true },
  waktu: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Chat", chatSchema);
