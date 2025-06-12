const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  jadwal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "jadwal",
    required: true,
  },
  masyarakat_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Masyarakat",
    required: true,
  },
  dokter_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Dokter",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 0,
    max: 5,
  },
}, { timestamps: true });

ratingSchema.index({ jadwal: 1, masyarakat_id: 1 }, { unique: true });

module.exports = mongoose.model("Rating", ratingSchema, "rating");