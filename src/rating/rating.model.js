const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
    nama_masyarakat: {
        type: String,
        required: true,
    },
    nama_dokter: {
        type: Date,
        required: true,
        unique: true,
    },
    rating: {
        type: String,
        required: true,
    },
})

module.exports = mongoose.model("rating", ratingSchema, "rating");