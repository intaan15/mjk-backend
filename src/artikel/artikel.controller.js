const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const artikel = require("./artikel.model");
const multer = require("multer");
const path = require("path");
const adminAuthorization = require("../middleware/adminAuthorization")
const verifyToken = require("../middleware/verifyToken")

// Konfigurasi tempat penyimpanan file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/images"); // folder tujuan
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // beri nama unik
  },
});

const upload = multer({ storage: storage });

// Endpoint upload file
router.post("/upload", upload.single("foto"), (req, res) => {
  try {
    const filePath = `/images/${req.file.filename}`;
    res.status(200).json({ message: "Upload berhasil", path: filePath });
  } catch (error) {
    res.status(500).json({ message: "Upload gagal", error });
  }
});


router.post("/create", adminAuthorization, async (req, res) => {
    try {
        const newArtikel = new artikel(req.body);
        const savedArtikel = await newArtikel.save();
        res.status(201).json(savedArtikel);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get("/getall", verifyToken, async (req, res) => {
    try {
        const artikels = await artikel.find();
        res.status(200).json(artikels);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get("/getbyid/:id", verifyToken, async (req, res) => {
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

router.patch("/update/:id", adminAuthorization, async (req, res) => {
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

router.delete("/delete/:id", adminAuthorization, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "ID tidak valid" });
  }

  try {
    const deletedArtikel = await artikel.findByIdAndDelete(req.params.id);
    if (!deletedArtikel) {
      return res.status(404).json({ message: "Artikel tidak ditemukan" });
    }
    res.status(200).json({ message: "Artikel berhasil dihapus" });
  } catch (error) {
    console.error("Gagal hapus artikel:", error);
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;