const express = require("express");
const router = express.Router();
const rating = require("./rating.model");

router.post("/create", async (req, res) => {
    try {
        const { nama_masyarakat, nama_dokter, rating: ratingValue } = req.body;

        if (ratingValue < 0 || ratingValue > 5) {
            return res.status(400).json({ message: "rating harus berada di antara 0 hingga 5." });
        }

        const newRating = new rating(req.body);
        const savedRating = await newRating.save();
        res.status(201).json(savedRating);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const ratings = await rating.find();
        res.status(200).json(ratings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
