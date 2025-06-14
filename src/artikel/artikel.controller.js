const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const artikel = require("./artikel.model");
const multer = require("multer");
const path = require("path");
const adminAuthorization = require("../middleware/adminAuthorization");
const verifyToken = require("../middleware/verifyToken");

// Konfigurasi tempat penyimpanan file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/imagesartikel");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Konfigurasi multer dengan validasi ukuran file dan tipe file
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB dalam bytes
  },
  fileFilter: function (req, file, cb) {
    // Validasi tipe file - hanya menerima gambar
    const allowedTypes = /jpeg|jpg|png|heic|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Hanya file gambar (JPEG, JPG, PNG, HEIC, WEBP) yang diizinkan!"
        )
      );
    }
  },
});

// Endpoint upload file dengan error handling untuk validasi
router.post("/upload", verifyToken, (req, res) => {
  upload.single("foto")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Error dari multer
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Ukuran file terlalu besar. Maksimal 2MB diizinkan.",
          error: "FILE_TOO_LARGE",
        });
      }
      return res.status(400).json({
        message: "Error upload file",
        error: err.message,
      });
    } else if (err) {
      // Error custom dari fileFilter
      return res.status(400).json({
        message: err.message,
        error: "INVALID_FILE_TYPE",
      });
    }

    // Jika tidak ada file yang diupload
    if (!req.file) {
      return res.status(400).json({
        message: "Tidak ada file yang diupload",
        error: "NO_FILE",
      });
    }

    try {
      const filePath = `/imagesartikel/${req.file.filename}`;
      res.status(200).json({
        message: "Upload berhasil",
        path: filePath,
        filename: req.file.filename,
        size: req.file.size,
        originalname: req.file.originalname,
      });
    } catch (error) {
      res.status(500).json({ message: "Upload gagal", error: error.message });
    }
  });
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
    const updatedArtikel = await artikel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
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
