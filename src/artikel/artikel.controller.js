const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const artikel = require("./artikel.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");
const { fileTypeFromFile } = require("file-type"); // Tambahkan import file-type
const adminAuthorization = require("../middleware/adminAuthorization");
const verifyToken = require("../middleware/verifyToken");
const { createLimiter, uploadLimiter } = require("../middleware/ratelimiter");
const roleAuthorization = require("../middleware/roleAuthorization");

// Daftar tipe file gambar yang diizinkan berdasarkan magic number
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Fungsi untuk memvalidasi file berdasarkan magic number
async function validateFileType(filePath) {
  try {
    const fileType = await fileTypeFromFile(filePath);

    if (!fileType) {
      return {
        isValid: false,
        error: "Tidak dapat mendeteksi tipe file atau file tidak valid",
      };
    }

    if (!ALLOWED_IMAGE_TYPES.has(fileType.mime)) {
      return {
        isValid: false,
        error: `Tipe file tidak diizinkan. Terdeteksi: ${fileType.mime}. Hanya gambar JPEG, PNG, WebP, dan HEIC yang diizinkan.`,
      };
    }

    return {
      isValid: true,
      detectedType: fileType.mime,
      extension: fileType.ext,
    };
  } catch (error) {
    console.error("Error saat validasi file:", error);
    return {
      isValid: false,
      error: "Error saat memvalidasi file",
    };
  }
}

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
    console.log("Error saat mengompres gambar:", error);
    // Jika gagal kompres, tetap gunakan file asli
    try {
      await fs.rename(inputPath, outputPath);
    } catch (renameError) {
      console.log("Error saat rename file:", renameError);
    }
    return false;
  }
}

// Fungsi helper untuk menghapus file gambar
async function deleteImageFile(imagePath) {
  if (!imagePath) {
    console.log("Tidak ada path gambar untuk dihapus");
    return;
  }

  try {
    console.log(`Mencoba menghapus gambar dengan path: ${imagePath}`);

    // Berbagai kemungkinan format path yang perlu ditangani
    let possiblePaths = [];

    // Jika path dimulai dengan /imagesartikel/
    if (imagePath.startsWith("/imagesartikel/")) {
      const fileName = imagePath.replace("/imagesartikel/", "");
      possiblePaths.push(path.join("public/imagesartikel/", fileName));
    }

    let deleted = false;
    for (const fullPath of possiblePaths) {
      try {
        await fs.access(fullPath);
        await fs.unlink(fullPath);
        console.log(`✅ File gambar berhasil dihapus: ${fullPath}`);
        deleted = true;
        break;
      } catch (error) {
        if (error.code === "ENOENT") {
          console.log(`File tidak ditemukan di: ${fullPath}`);
        } else {
          console.log(`Error menghapus file di ${fullPath}:`, error.message);
        }
      }
    }

    if (!deleted) {
      console.log(
        `⚠️ File gambar tidak ditemukan di semua lokasi yang dicoba untuk path: ${imagePath}`
      );
    }
  } catch (error) {
    console.log("❌ Error dalam deleteImageFile:", error);
  }
}

// Konfigurasi tempat penyimpanan file sementara
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/temp/"); // Folder sementara untuk file sebelum dikompres
  },
  filename: function (req, file, cb) {
    // Gunakan nama file yang aman tanpa bergantung pada originalname
    const uniqueName = Date.now() + "-temp-upload";
    cb(null, uniqueName);
  },
});

// Konfigurasi multer dengan validasi minimal (akan divalidasi lebih lanjut setelah upload)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Batas 50MB untuk upload (akan dikompres nanti)
  },
  // Hapus fileFilter yang bergantung pada mimetype dan extension
  // Validasi sebenarnya akan dilakukan setelah file tersimpan
});

// Endpoint upload file dengan validasi magic number dan kompresi otomatis
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
        error: "UPLOAD_ERROR",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "File tidak ditemukan",
        error: "NO_FILE",
      });
    }

    let tempFilePath = req.file.path;

    try {
      // VALIDASI UTAMA: Cek magic number untuk memastikan file adalah gambar
      console.log(
        `Memvalidasi tipe file berdasarkan magic number: ${req.file.originalname}`
      );
      const validation = await validateFileType(tempFilePath);

      if (!validation.isValid) {
        // Hapus file yang tidak valid
        await fs.unlink(tempFilePath).catch(console.error);
        return res.status(400).json({
          message: validation.error,
          error: "INVALID_FILE_TYPE",
          detectedType: validation.detectedType || "unknown",
        });
      }

      console.log(
        `✅ File valid terdeteksi sebagai: ${validation.detectedType}`
      );

      // Buat nama file final berdasarkan timestamp dan ekstensi yang terdeteksi
      const finalFileName = Date.now() + "-artikel." + validation.extension;
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
        detectedFileType: validation.detectedType,
        detectedExtension: validation.extension,
      });
    } catch (error) {
      console.log("Upload error:", error);
      // Bersihkan file jika ada error
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(console.error);
      }
      res.status(500).json({
        message: "Upload gagal",
        error: error.message,
      });
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
    // Ambil data artikel lama untuk mendapatkan path gambar lama
    const existingArtikel = await artikel.findById(req.params.id);
    if (!existingArtikel) {
      return res.status(404).json({ message: "Artikel tidak ditemukan" });
    }

    // Update artikel dengan data baru
    const updatedArtikel = await artikel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    // Cek berbagai kemungkinan field yang menyimpan path gambar
    const possibleImageFields = [
      "foto_artikel",
      "gambar_artikel",
      "image",
      "foto",
      "gambar",
      "thumbnail",
    ];

    for (const field of possibleImageFields) {
      const oldImagePath = existingArtikel[field];
      const newImagePath = req.body[field];

      if (oldImagePath && newImagePath && oldImagePath !== newImagePath) {
        await deleteImageFile(oldImagePath);
      } else if (oldImagePath && !newImagePath) {
        await deleteImageFile(oldImagePath);
      }
    }

    res.status(200).json(updatedArtikel);
  } catch (error) {
    console.log("❌ Error updating artikel:", error);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/delete/:id", adminAuthorization, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "ID tidak valid" });
  }

  try {
    // Ambil data artikel sebelum dihapus untuk mendapatkan path gambar
    const existingArtikel = await artikel.findById(req.params.id);
    if (!existingArtikel) {
      return res.status(404).json({ message: "Artikel tidak ditemukan" });
    }

    console.log(
      "📋 Data artikel yang akan dihapus:",
      JSON.stringify(existingArtikel, null, 2)
    );

    const deletedArtikel = await artikel.findByIdAndDelete(req.params.id);

    const possibleImageFields = [
      "foto_artikel",
      "gambar_artikel",
      "image",
      "foto",
      "gambar",
      "thumbnail",
    ];

    let deletedImages = [];
    for (const field of possibleImageFields) {
      const imagePath = existingArtikel[field];
      if (imagePath) {
        console.log(`🗑️ Menghapus gambar dari field '${field}': ${imagePath}`);
        await deleteImageFile(imagePath);
        deletedImages.push({ field, path: imagePath });
      }
    }

    res.status(200).json({
      message: "Artikel berhasil dihapus",
      deletedArtikel: deletedArtikel,
      deletedImages: deletedImages,
      imageFieldsChecked: possibleImageFields,
    });
  } catch (error) {
    console.log("❌ Gagal hapus artikel:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
