const mongoose = require("mongoose");

const artikelSchema = new mongoose.Schema({
    nama_artikel: {
        type: String,
        required: true,
    },
    // tgl_terbit_artikel: {
    //     type: Date,
    //     required: true,
    //     unique: true,
    // },
    detail_artikel: {
        type: String,
        required: true,
    },
    gambar_artikel: {
        type: String,
        required: true,
    },
    kategori_artikel: {
        type: String,
        enum: ["Kesehatan", "Obat"],
        required: true,
    },
}, { timestamps: true }
)

module.exports = mongoose.model("artikel", artikelSchema, "artikel");