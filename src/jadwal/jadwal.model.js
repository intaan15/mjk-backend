const mongoose = require("mongoose");

const jadwalSchema = new mongoose.Schema({
    dokter_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Dokter",
        required: true,
    },
    masyarakat_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Masyarakat",
        required: true,
    },
    tgl_konsul: {
        type: Date,
        required: true,
    },
    jam_konsul: {
        type: String,
        required: true
    },
    keluhan_pasien: {
        type: String,
        required: true,
    },
    jumlah_konsul: {
        type: Number,
        required: true,
    },
    status_konsul: {
        type: String,
        enum: ["menunggu", "ditolak", "diterima", "berlangsung", "selesai"],
        default: "menunggu",
        required: true,
    },
}, { timestamps: true }
);

module.exports = mongoose.model("jadwal", jadwalSchema, "jadwal");