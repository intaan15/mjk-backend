const express = require("express");
const router = express.Router();
const artikel = require("./artikel.model");

router.post("/create", async (req, res) => {
    try {
        const newArtikel = new artikel(req.body);
        const savedArtikel = await newArtikel.save();
        res.status(201).json(savedArtikel);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const artikels = await artikel.find();
        res.status(200).json(artikels);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;