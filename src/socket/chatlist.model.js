const mongoose = require("mongoose");

const ChatListSchema = new mongoose.Schema(
  {
    participants: {
      type: [String], // id dari masyarakat atau dokter
      required: true,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageDate: {
      type: Date,
      default: Date.now,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatList", ChatListSchema);
