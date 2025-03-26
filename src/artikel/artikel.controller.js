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

router.get("/:id", async (req, res) => {
    try {
        const artikelItem = await artikel.findById(req.params.id);
        if (!artikelItem) {
            return res.status(404).json({ message: "Artikel tidak ditemukan" });
        }
        res.status(200).json(artikelItem);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.patch("/update/:id", async (req, res) => {
    try {
        const updatedArtikel = await artikel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedArtikel) {
            return res.status(404).json({ message: "Artikel tidak ditemukan" });
        }
        res.status(200).json(updatedArtikel);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.delete("/delete/:id", async (req, res) => {
    try {
        const deletedArtikel = await artikel.findByIdAndDelete(req.params.id);
        if (!deletedArtikel) {
            return res.status(404).json({ message: "Artikel tidak ditemukan" });
        }
        res.status(200).json({ message: "Artikel berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;