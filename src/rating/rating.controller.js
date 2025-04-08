const express = require("express");
const router = express.Router();
const rating = require("./rating.model");
const dokter = require("../dokter/dokter.model");

router.post("/create", async (req, res) => {
    try {
        const { nama_masyarakat, dokter_id, rating } = req.body;

        const dokterData = await dokter.findById(dokter_id);
        if (!dokterData) {
            return res.status(404).json({ message: "Dokter tidak ditemukan" });
        }

        const newRating = new rating({ nama_masyarakat, dokter_id, rating });
        await newRating.save();

        const ratings = await rating.find({ dokter_id });
        const avgRating = ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length;

        dokterData.rating_dokter = parseFloat(avgRating.toFixed(1));
        await dokterData.save();

        res.status(201).json({ message: "Rating berhasil ditambahkan", rating: newRating, avgRating });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const ratings = await rating.find().populate("dokter_id", "nama_dokter rating_dokter");
        res.status(200).json(ratings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;