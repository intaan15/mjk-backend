const mongoose = require("mongoose");

const dokterSchema = new mongoose.Schema(
  {
    nama_dokter: {
      type: String,
      required: true,
    },
    username_dokter: {
      type: String,
      required: true,
      unique: true,
    },
    password_dokter: {
      type: String,
      required: true,
    },
    email_hash: String,
    email_dokter: {
      type: String,
      required: true,
      unique: true,
    //   match: [/^\S+@\S+\.\S+$/, "Email tidak valid"],
    },
    spesialis_dokter: {
      type: String,
      required: true,
    },
    notlp_dokter: {
      type: String,
      required: true,
    },
    str_dokter: {
      type: String,
      required: true,
      unique: true,
    },
    rating_dokter: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    foto_profil_dokter: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ["admin", "dokter", "masyarakat"],
      default: "dokter",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Dokter", dokterSchema, "dokter");