const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
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
    nama_masyarakat: {
        type: String,
        required: true,
    },
    nama_dokter: {
        type: String,
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 0,
        max: 5,
    },
}, { timestamps: true }
);

module.exports = mongoose.model("rating", ratingSchema, "rating");