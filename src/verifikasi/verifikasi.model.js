const mongoose = require("mongoose");

const verifikasiSchema = new mongoose.Schema({
    masyarakat_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "masyarakat", 
        required: true,
    },
    dokter_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "dokter", 
        required: true,
    },
    status_verif: {
        type: String,
        enum: ["menunggu", "ditolak", "diterima"],
        default: "menunggu",
        required: true,
    },
    tgl_verif: {
        type: Date,
        required: true,
    },
});

module.exports = mongoose.model("verifikasi", verifikasiSchema, "verifikasi");