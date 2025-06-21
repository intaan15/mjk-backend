const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const artikel = require("./artikel.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");
const adminAuthorization = require("../middleware/adminAuthorization");
const verifyToken = require("../middleware/verifyToken");
const createLimiter = require("../middleware/ratelimiter");
const rateLimit = require("express-rate-limit");
const masyarakatAuthorization = require("../middleware/masyarakatAuthorization");
const roleAuthorization = require("../middleware/roleAuthorization");

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 2, // maksimal 2 upload per 1 menit per IP
  message: {
    message: "Terlalu banyak request upload. Coba lagi dalam 1 menit.",
    error: "UPLOAD_RATE_LIMIT_EXCEEDED",
    retryAfter: Math.ceil(1 * 60),
  },
  standardHeaders: true,
  legacyHeaders: false, // menonaktifkan headers `X-RateLimit-*`

  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    return false;
  },
});

// Fungsi untuk mengompres gambar
async function compressImage(inputPath, outputPath, maxSizeKB = 3072) {
  // 3MB = 3072KB
  try {
    let quality = 90;
    let compressed = false;

    while (quality > 10 && !compressed) {
      await sharp(inputPath)
        .webp({
          quality: quality,
          effort: 4,
        })
        .toFile(outputPath);

      // Cek ukuran file hasil kompresi
      const stats = await fs.stat(outputPath);
      const fileSizeKB = stats.size / 1024;

      if (fileSizeKB <= maxSizeKB) {
        compressed = true;
        console.log(
          `File berhasil dikompres dengan quality ${quality}%, ukuran: ${fileSizeKB.toFixed(
            2
          )}KB`
        );
      } else {
        quality -= 10;
        console.log(
          `Mencoba kompresi dengan quality ${quality}%, ukuran saat ini: ${fileSizeKB.toFixed(
            2
          )}KB`
        );
      }
    }

    // Jika masih terlalu besar, resize gambar
    if (!compressed) {
      let width = 1920;
      let resized = false;

      while (width > 400 && !resized) {
        await sharp(inputPath)
          .resize(width, null, {
            withoutEnlargement: true,
            fit: "inside",
          })
          .webp({
            quality: 70,
            effort: 4,
          })
          .toFile(outputPath);

        const stats = await fs.stat(outputPath);
        const fileSizeKB = stats.size / 1024;

        if (fileSizeKB <= maxSizeKB) {
          resized = true;
          console.log(
            `File berhasil diresize dan dikompres, lebar: ${width}px, ukuran: ${fileSizeKB.toFixed(
              2
            )}KB`
          );
        } else {
          width -= 200;
          console.log(
            `Mencoba resize dengan lebar ${width}px, ukuran saat ini: ${fileSizeKB.toFixed(
              2
            )}KB`
          );
        }
      }
    }

    // Hapus file asli setelah kompresi berhasil
    await fs.unlink(inputPath);

    return true;
  } catch (error) {
    console.error("Error saat mengompres gambar:", error);
    // Jika gagal kompres, tetap gunakan file asli
    try {
      await fs.rename(inputPath, outputPath);
    } catch (renameError) {
      console.error("Error saat rename file:", renameError);
    }
    return false;
  }
}

// Konfigurasi tempat penyimpanan file sementara
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/temp/"); // Folder sementara untuk file sebelum dikompres
  },
  filename: function (req, file, cb) {
    const originalName = file.originalname;
    const sanitized = originalName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.\-]/g, "");

    const uniqueName = Date.now() + "-temp-" + sanitized;
    cb(null, uniqueName);
  },
});

// Konfigurasi multer dengan batasan ukuran file untuk upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Batas 50MB untuk upload (akan dikompres nanti)
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

// Endpoint upload file dengan kompresi otomatis
router.post("/upload", uploadLimiter, verifyToken, (req, res) => {
  upload.single("foto")(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message:
            "Ukuran file terlalu besar. Maksimal 50MB diizinkan untuk upload.",
          error: "FILE_TOO_LARGE",
        });
      }
      return res.status(400).json({
        message: "Error upload file",
        error: err.message,
      });
    } else if (err) {
      return res.status(400).json({
        message: err.message,
        error: "INVALID_FILE_TYPE",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "File tidak ditemukan",
        error: "NO_FILE",
      });
    }

    try {
      // Path file sementara dan final
      const tempFilePath = req.file.path;
      const originalName = req.file.originalname
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9.\-]/g, "");
      const finalFileName =
        Date.now() + "-" + originalName.replace(/\.[^/.]+$/, "") + ".webp";
      const finalFilePath = path.join("public/imagesartikel/", finalFileName);

      // Kompres gambar
      console.log(`Mulai kompresi file artikel: ${req.file.originalname}`);
      const compressionSuccess = await compressImage(
        tempFilePath,
        finalFilePath,
        3072
      ); // 3MB

      // Dapatkan ukuran file final
      const finalStats = await fs.stat(finalFilePath);
      const finalSizeKB = finalStats.size / 1024;

      res.status(200).json({
        message: "Upload dan kompresi berhasil",
        path: `/imagesartikel/${finalFileName}`,
        filename: finalFileName,
        originalSize: req.file.size,
        compressedSize: finalStats.size,
        originalSizeKB: (req.file.size / 1024).toFixed(2),
        compressedSizeKB: finalSizeKB.toFixed(2),
        compressionRatio:
          (((req.file.size - finalStats.size) / req.file.size) * 100).toFixed(
            2
          ) + "%",
        originalname: req.file.originalname,
      });
    } catch (error) {
      console.error("Upload error:", error);
      // Bersihkan file jika ada error
      if (req.file && req.file.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ message: "Upload gagal", error: error.message });
    }
  });
});

// Tambahkan middleware untuk memastikan folder ada
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

// Jalankan saat server start
(async () => {
  await ensureDirectoryExists("public/temp");
  await ensureDirectoryExists("public/imagesartikel");
})();

const lockManager = {
  locks: new Set(),

  async acquireLock(key) {
    while (this.locks.has(key)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.locks.add(key);
  },

  releaseLock(key) {
    this.locks.delete(key);
  },
};

router.post("/create", createLimiter, adminAuthorization, async (req, res) => {
  const lockKey = `artikel_${req.body.nama_artikel}_${req.body.kategori_artikel}`;

  try {
    await lockManager.acquireLock(lockKey);

    const existingArtikel = await artikel.findOne({
      nama_artikel: req.body.nama_artikel,
    });

    if (existingArtikel) {
      return res.status(409).json({
        message: "Artikel dengan nama tersebut sudah ada",
        error: "DUPLICATE_ARTIKEL",
      });
    }

    const newArtikel = new artikel(req.body);
    const savedArtikel = await newArtikel.save();

    res.status(201).json(savedArtikel);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        message: `Artikel dengan ${field} tersebut sudah ada`,
        error: "DUPLICATE_KEY",
        field: field,
      });
    }

    res.status(400).json({
      message: error.message,
      error: "CREATE_FAILED",
    });
  } finally {
    lockManager.releaseLock(lockKey);
  }
});

router.get(
  "/getall",
  roleAuthorization(["masyarakat", "admin"]),
  async (req, res) => {
    try {
      const artikels = await artikel.find();
      res.status(200).json(artikels);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.get(
  "/getbyid/:id",
  roleAuthorization(["masyarakat", "admin"]),
  async (req, res) => {
    try {
      const artikelItem = await artikel.findById(req.params.id);
      if (!artikelItem) {
        return res.status(404).json({ message: "Artikel tidak ditemukan" });
      }
      res.status(200).json(artikelItem);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

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
