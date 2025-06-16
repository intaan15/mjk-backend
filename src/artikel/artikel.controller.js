const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const artikel = require("./artikel.model");
const multer = require("multer");
const path = require("path");
const adminAuthorization = require("../middleware/adminAuthorization");
const verifyToken = require("../middleware/verifyToken");
const rateLimit = require("express-rate-limit");

// Lock manager untuk mencegah race condition
const uploadLockManager = {
    locks: new Map(), // Menggunakan Map untuk menyimpan metadata lock
    
    async acquireLock(key, timeout = 30000) {
        const startTime = Date.now();
        
        while (this.locks.has(key)) {
            // Check timeout
            if (Date.now() - startTime > timeout) {
                throw new Error(`Lock timeout untuk ${key}`);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.locks.set(key, {
            timestamp: Date.now(),
            pid: process.pid
        });
    },
    
    releaseLock(key) {
        this.locks.delete(key);
    },
    
    // Cleanup locks yang terlalu lama (fallback safety)
    cleanup() {
        const now = Date.now();
        const maxAge = 60000; // 1 menit
        
        for (const [key, metadata] of this.locks.entries()) {
            if (now - metadata.timestamp > maxAge) {
                this.locks.delete(key);
                console.warn(`Cleanup expired lock: ${key}`);
            }
        }
    }
};

// Jalankan cleanup setiap 2 menit
setInterval(() => {
    uploadLockManager.cleanup();
}, 120000);

// Rate limiter khusus untuk upload
const uploadRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 menit
    max: 1, // Maksimal 1 upload per menit per IP
    message: {
        message: "Terlalu banyak upload, coba lagi dalam 1 menit",
        error: "UPLOAD_RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Kombinasi IP dan user ID untuk rate limiting yang lebih spesifik
        return `${req.ip}_${req.user?.id || 'anonymous'}`;
    }
});

// Konfigurasi tempat penyimpanan file dengan race condition protection
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/imagesartikel");
    },
    filename: function (req, file, cb) {
        // Buat filename yang lebih unique untuk menghindari collision
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e9);
        const userId = req.user?.id || 'anonymous';
        const uniqueSuffix = `${timestamp}-${userId}-${random}`;
        
        const filename = uniqueSuffix + path.extname(file.originalname);
        cb(null, filename);
    },
});

// Konfigurasi multer dengan validasi yang lebih ketat
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB dalam bytes
        files: 1, // Hanya 1 file per request
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

// Fungsi untuk validasi file yang sudah diupload
async function validateUploadedFile(filePath) {
    try {
        const stats = await fs.stat(filePath);
        
        // Cek ukuran file
        if (stats.size === 0) {
            throw new Error("File kosong");
        }
        
        if (stats.size > 2 * 1024 * 1024) {
            throw new Error("File terlalu besar");
        }
        
        return true;
    } catch (error) {
        throw new Error(`File tidak valid: ${error.message}`);
    }
}

// Fungsi untuk cleanup file jika terjadi error
async function cleanupFile(filePath) {
    try {
        await fs.unlink(filePath);
        console.log(`Cleanup file: ${filePath}`);
    } catch (error) {
        console.error(`Gagal cleanup file ${filePath}:`, error.message);
    }
}

// Endpoint upload file dengan race condition protection
router.post("/upload", 
    uploadRateLimiter,
    verifyToken, 
    async (req, res) => {
        const userId = req.user?.id || req.ip;
        const lockKey = `upload_${userId}_${Date.now()}`;
        let uploadedFilePath = null;
        
        try {
            // 1. Acquire lock berdasarkan user
            await uploadLockManager.acquireLock(lockKey);
            
            // 2. Process upload dengan Promise wrapper
            const uploadResult = await new Promise((resolve, reject) => {
                upload.single("foto")(req, res, function (err) {
                    if (err instanceof multer.MulterError) {
                        // Error dari multer
                        if (err.code === "LIMIT_FILE_SIZE") {
                            return reject({
                                status: 400,
                                message: "Ukuran file terlalu besar. Maksimal 2MB diizinkan.",
                                error: "FILE_TOO_LARGE",
                            });
                        }
                        if (err.code === "LIMIT_FILE_COUNT") {
                            return reject({
                                status: 400,
                                message: "Hanya boleh upload 1 file per request.",
                                error: "TOO_MANY_FILES",
                            });
                        }
                        return reject({
                            status: 400,
                            message: "Error upload file",
                            error: err.message,
                        });
                    } else if (err) {
                        // Error custom dari fileFilter
                        return reject({
                            status: 400,
                            message: err.message,
                            error: "INVALID_FILE_TYPE",
                        });
                    }

                    // Jika tidak ada file yang diupload
                    if (!req.file) {
                        return reject({
                            status: 400,
                            message: "Tidak ada file yang diupload",
                            error: "NO_FILE",
                        });
                    }
                    
                    resolve(req.file);
                });
            });
            
            // 3. Set path file yang diupload untuk cleanup jika error
            uploadedFilePath = path.join("public/imagesartikel", uploadResult.filename);
            
            // 4. Validasi file yang sudah diupload
            await validateUploadedFile(uploadedFilePath);
            
            // 5. Cek duplikasi filename (optional - jika perlu)
            const existingFile = await artikel.findOne({
                gambar_artikel: `/imagesartikel/${uploadResult.filename}`
            });
            
            if (existingFile) {
                await cleanupFile(uploadedFilePath);
                return res.status(409).json({
                    message: "File dengan nama yang sama sudah ada",
                    error: "DUPLICATE_FILE"
                });
            }
            
            // 6. Response sukses
            const filePath = `/imagesartikel/${uploadResult.filename}`;
            res.status(200).json({
                message: "Upload berhasil",
                data: {
                    path: filePath,
                    filename: uploadResult.filename,
                    size: uploadResult.size,
                    originalname: uploadResult.originalname,
                    uploadedAt: new Date().toISOString(),
                    userId: userId
                }
            });
            
        } catch (error) {
            console.error("Upload error:", error);
            
            // Cleanup file jika ada error setelah upload
            if (uploadedFilePath) {
                await cleanupFile(uploadedFilePath);
            }
            
            // Handle different types of errors
            if (error.status) {
                // Error yang sudah diformat
                return res.status(error.status).json({
                    message: error.message,
                    error: error.error
                });
            }
            
            // Error tidak terduga
            res.status(500).json({ 
                message: "Upload gagal", 
                error: "INTERNAL_ERROR",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            // 7. Release lock
            uploadLockManager.releaseLock(lockKey);
        }
    }
);

const lockManager = {
    locks: new Set(),
    
    async acquireLock(key) {
        while (this.locks.has(key)) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this.locks.add(key);
    },
    
    releaseLock(key) {
        this.locks.delete(key);
    }
};

const createArtikelLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 menit
    max: 1, // Maksimal 1 request per menit per IP
    message: {
        message: "Terlalu banyak permintaan, coba lagi nanti",
        error: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/create", createArtikelLimiter, adminAuthorization, async (req, res) => {
    const lockKey = `artikel_${req.body.nama_artikel}_${req.body.kategori_artikel}`;
    
    try {
        await lockManager.acquireLock(lockKey);

        const existingArtikel = await artikel.findOne({
            nama_artikel: req.body.nama_artikel
        });
        
        if (existingArtikel) {
            return res.status(409).json({
                message: "Artikel dengan nama tersebut sudah ada",
                error: "DUPLICATE_ARTIKEL"
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
                field: field
            });
        }
        
        res.status(400).json({ 
            message: error.message,
            error: "CREATE_FAILED"
        });
    } finally {
        lockManager.releaseLock(lockKey);
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
