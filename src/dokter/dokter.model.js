const mongoose = require("mongoose");

const jamSchema = new mongoose.Schema({
  time: {
    type: String,
    required: true,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

const jadwalSchema = new mongoose.Schema({
  tanggal: {
    type: Date,
    required: true,
  },
  jam: [jamSchema],
});

const dokterSchema = new mongoose.Schema({
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
  email_dokter: {
    type: String,
    required: true,
    unique: true,
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
    default: "",
  },
  role: {
    type: String,
    enum: ["admin", "dokter", "masyarakat"],
    default: "dokter",
  },
  jadwal: [jadwalSchema],
}, {
  timestamps: true,
});

module.exports = mongoose.model("Dokter", dokterSchema, "dokter");
