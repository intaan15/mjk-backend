const mongoose = require("mongoose");

const jadwalSchema = new mongoose.Schema({
    dokter_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "dokter",
        required: true,
    },
    masyarakat_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "masyarakat",
        required: true,
    },
    tgl_konsul: {
        type: Date,
        required: true,
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