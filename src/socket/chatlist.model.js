const mongoose = require("mongoose");
const { Schema } = mongoose;

const ChatListSchema = new Schema(
  {
    participants: [
      {
        user: {
          type: Schema.Types.ObjectId,
          required: true,
          refPath: "participants.role",
        },
        role: {
          type: String,
          required: true,
          enum: ["Masyarakat", "Dokter"],
        },
      },
    ],
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
    // lastReadAt: {
    //   type: Map,
    //   of: Date,
    //   default: {},
    // },
    jadwal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "jadwal",
      required: true,
    },

    status: {
      type: String,
      enum: ["berlangsung", "selesai"],
      default: "berlangsung",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatList", ChatListSchema);
