const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
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
})

module.exports = mongoose.model("rating", ratingSchema, "rating");