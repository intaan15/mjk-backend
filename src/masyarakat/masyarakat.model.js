const mongoose = require("mongoose");

const masyarakatSchema = new mongoose.Schema(
  {
    nama_masyarakat: {
      type: String,
      required: true,
    },
    username_masyarakat: {
      type: String,
      required: true,
      unique: true,
    },
    password_masyarakat: {
      type: String,
      required: true,
    },
    email_masyarakat: {
      type: String,
      required: true,
      unique: true,
      // match: [/^\S+@\S+\.\S+$/, "Email tidak valid"],
    },
    nik_masyarakat: {
      type: String,
      required: true,
      unique: true,
      // match: [/^\d{16}$/, "NIK harus 16 digit"],
    },
    alamat_masyarakat: {
      type: String,
      required: true,
    },
    notlp_masyarakat: {
      type: String,
      required: true,
    },
    jeniskelamin_masyarakat: {
      type: String,
      enum: ["Laki-laki", "Perempuan"],
      required: true,
    },
    tgl_lahir_masyarakat: {
      type: Date,
      required: true,
    },
    foto_ktp_masyarakat: {
      type: String,
      required: true,
    },
    selfie_ktp_masyarakat: {
      type: String,
      required: true,
    },
    foto_profil_masyarakat: {
      type: String,
      required: false,
    },
    verifikasi_akun_masyarakat: {
      type: String,
      enum: ["pending", "diterima", "ditolak"],
      default: "pending",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "dokter", "masyarakat"],
      default: "masyarakat",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Masyarakat", masyarakatSchema, "masyarakat");
