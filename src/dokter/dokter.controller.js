const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const Dokter = require("./dokter.model");
const Jadwal = require("../jadwal/jadwal.model");
const { encrypt, decrypt } = require("../utils/encryption");
const mongoose = require("mongoose");
const { hashString } = require("../utils/hash");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs").promises;
const dokterAuthorization = require("../middleware/dokterAuthorization");
const masyarakatAuthorization = require("../middleware/masyarakatAuthorization");
const adminAuthorization = require("../middleware/adminAuthorization");
const verifyToken = require("../middleware/verifyToken");
const { createLimiter, uploadLimiter } = require("../middleware/ratelimiter");
const roleAuthorization = require("../middleware/roleAuthorization");

// Fungsi untuk mengompres gambar
async function compressImage(inputPath, outputPath, maxSizeKB = 3072) {
  // 3MB = 3072KB
  try {
    let quality = 90;
    let compressed = false;

    while (quality > 10 && !compressed) {
      await sharp(inputPath)
        .jpeg({
          quality: quality,
          progressive: true,
          mozjpeg: true,
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
          .jpeg({
            quality: 70,
            progressive: true,
            mozjpeg: true,
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

async function deleteImageFile(imagePath) {
  if (!imagePath) {
    console.log("Tidak ada path gambar untuk dihapus");
    return;
  }

  try {
    console.log(`Mencoba menghapus gambar dokter dengan path: ${imagePath}`);

    // Berbagai kemungkinan format path yang perlu ditangani
    let possiblePaths = [];

    // Jika path dimulai dengan /imagesdokter/
    if (imagePath.startsWith("/imagesdokter/")) {
      const fileName = imagePath.replace("/imagesdokter/", "");
      possiblePaths.push(path.join("public/imagesdokter/", fileName));
    }
    // Coba hapus dari semua kemungkinan path
    let deleted = false;
    for (const fullPath of possiblePaths) {
      try {
        await fs.access(fullPath);
        await fs.unlink(fullPath);
        console.log(`✅ File gambar dokter berhasil dihapus: ${fullPath}`);
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
        `⚠️ File gambar dokter tidak ditemukan di semua lokasi yang dicoba untuk path: ${imagePath}`
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
    const originalName = file.originalname;
    const sanitized = originalName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.\-]/g, "");

    const uniqueName = Date.now() + "-temp-" + sanitized;
    cb(null, uniqueName);
  },
});

// Konfigurasi multer tanpa batasan ukuran file
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // Batas 20MB untuk upload (akan dikompres nanti)
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
  upload.single("image")(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message:
            "Ukuran file terlalu besar. Maksimal 20MB diizinkan untuk upload.",
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
      const dokterId = req.body.id;

      if (!dokterId) {
        // Hapus file temp jika tidak ada ID dokter
        await fs.unlink(req.file.path).catch(console.error);
        return res.status(400).json({
          message: "ID dokter tidak ditemukan",
          error: "NO_DOCTOR_ID",
        });
      }

      // Ambil data dokter untuk mendapatkan foto lama
      const dokterLama = await Dokter.findById(dokterId);
      if (!dokterLama) {
        await fs.unlink(req.file.path).catch(console.error);
        return res.status(404).json({
          message: "Dokter tidak ditemukan",
          error: "DOCTOR_NOT_FOUND",
        });
      }

      // Path file sementara dan final
      const tempFilePath = req.file.path;
      const originalName = req.file.originalname
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9.\-]/g, "");
      const finalFileName =
        Date.now() + "-" + originalName.replace(/\.[^/.]+$/, "") + ".jpg";
      const finalFilePath = path.join("public/imagesdokter/", finalFileName);

      // Kompres gambar
      console.log(`Mulai kompresi file: ${req.file.originalname}`);
      const compressionSuccess = await compressImage(
        tempFilePath,
        finalFilePath,
        3072
      ); // 3MB

      // Hapus foto lama jika ada
      if (dokterLama.foto_profil_dokter) {
        const oldPhotoPath = path.join("public", dokterLama.foto_profil_dokter);
        try {
          await fs.unlink(oldPhotoPath);
          console.log(`Foto lama berhasil dihapus: ${oldPhotoPath}`);
        } catch (unlinkError) {
          // Log error tapi jangan gagalkan proses upload
          console.warn(`Gagal menghapus foto lama: ${unlinkError.message}`);
        }
      }

      // Update database dengan foto baru
      const updated = await Dokter.findByIdAndUpdate(dokterId, {
        foto_profil_dokter: `/imagesdokter/${finalFileName}`,
      });

      if (!updated) {
        // Hapus file baru jika update database gagal
        await fs.unlink(finalFilePath).catch(console.error);
        return res.status(404).json({
          message: "Gagal update data dokter",
          error: "UPDATE_FAILED",
        });
      }

      // Hapus file temporary
      await fs.unlink(tempFilePath).catch(console.error);

      // Dapatkan ukuran file final
      const finalStats = await fs.stat(finalFilePath);
      const finalSizeKB = finalStats.size / 1024;

      res.status(200).json({
        message: "Upload dan kompresi berhasil",
        path: `/imagesdokter/${finalFileName}`,
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
        oldPhotoDeleted: dokterLama.foto_profil_dokter ? true : false,
      });
    } catch (error) {
      console.log("Upload error:", error);
      // Bersihkan file jika ada error
      if (req.file && req.file.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ message: "Upload gagal", error: error.message });
    }
  });
});

// Endpoint upload file untuk admin dengan kompresi
router.post("/upload/admin", uploadLimiter, verifyToken, (req, res) => {
  upload.single("foto")(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message:
            "Ukuran file terlalu besar. Maksimal 20MB diizinkan untuk upload.",
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
        Date.now() + "-" + originalName.replace(/\.[^/.]+$/, "") + ".jpg";
      const finalFilePath = path.join("public/imagesdokter/", finalFileName);

      // Kompres gambar
      console.log(`Mulai kompresi file admin: ${req.file.originalname}`);
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
        path: `/imagesdokter/${finalFileName}`,
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
      console.log("Upload admin error:", error);
      // Bersihkan file jika ada error
      if (req.file && req.file.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ message: "Upload gagal", error: error.message });
    }
  });
});

// Sisanya tetap sama seperti kode asli...
router.post(
  "/create",
  createLimiter,
  adminAuthorization,
  async (req, res, next) => {
    try {
      const {
        nama_dokter,
        username_dokter,
        password_dokter,
        email_dokter,
        spesialis_dokter,
        notlp_dokter,
        str_dokter,
        rating_dokter,
        foto_profil_dokter,
      } = req.body;

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      if (!emailRegex.test(email_dokter)) {
        return res.status(400).json({ message: "Email tidak valid" });
      }

      if (await Dokter.exists({ username_dokter })) {
        return res.status(400).json({ message: "Username sudah digunakan" });
      }

      if (await Dokter.exists({ str_dokter })) {
        return res.status(400).json({ message: "STR sudah terdaftar" });
      }

      const allDokter = await Dokter.find();
      const emailAlreadyUsed = allDokter.some((dok) => {
        try {
          return decrypt(dok.email_dokter) === email_dokter;
        } catch (e) {
          return false;
        }
      });

      if (emailAlreadyUsed) {
        return res.status(400).json({ message: "Email sudah terdaftar" });
      }

      const hashedPassword = await bcrypt.hash(password_dokter, 17);

      const newDokter = new Dokter({
        nama_dokter,
        username_dokter,
        password_dokter: hashedPassword,
        email_dokter: encrypt(email_dokter),
        spesialis_dokter,
        notlp_dokter: encrypt(notlp_dokter),
        str_dokter,
        rating_dokter:
          rating_dokter >= 0 && rating_dokter <= 5 ? rating_dokter : 0,
        foto_profil_dokter,
      });

      await newDokter.save();
      res.status(201).json({
        message: "Dokter berhasil didaftarkan",
        dokter: newDokter,
      });
    } catch (e) {
      next(e);
    }
  }
);

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
  await ensureDirectoryExists("public/imagesdokter");
})();

router.get(
  "/getall",
  roleAuthorization(["masyarakat", "admin"]),
  async (req, res, next) => {
    try {
      const dokterList = await Dokter.find().select("-password_dokter");

      // Lakukan dekripsi pada tiap objek dokter
      const decryptedList = dokterList.map((dokter) => {
        return {
          ...dokter._doc,
          email_dokter: decrypt(dokter.email_dokter),
          notlp_dokter: decrypt(dokter.notlp_dokter),
        };
      });

      res.status(200).json(decryptedList);
    } catch (e) {
      next(e);
    }
  }
);

router.get("/getbyid/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Dokter.findById(id).select("-password_dokter");
    if (!user)
      return res.status(404).json({ message: "Dokter tidak ditemukan" });

    const decryptedUser = {
      ...user._doc,
      email_dokter: decrypt(user.email_dokter),
      notlp_dokter: decrypt(user.notlp_dokter),
    };

    res.status(200).json(decryptedUser);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/getbyname/:doctorName", verifyToken, async (req, res) => {
  try {
    const { doctorName } = req.params;

    const dokter = await Dokter.findOne({ nama_dokter: doctorName }).select(
      "-password_dokter"
    );

    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }

    const decryptedUser = {
      ...dokter._doc,
      email_dokter: decrypt(dokter.email_dokter),
      notlp_dokter: decrypt(dokter.notlp_dokter),
    };

    res.status(200).json(decryptedUser);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// UPDATE ENDPOINT - PERBAIKAN
router.patch(
  "/update/:id",
  roleAuthorization(["dokter", "admin"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        username_dokter,
        email_dokter,
        str_dokter,
        // password_dokter,
        rating_dokter,
        notlp_dokter,
      } = req.body;

      const existingDokter = await Dokter.findById(id);
      if (!existingDokter) {
        return res.status(404).json({ message: "Dokter tidak ditemukan" });
      }

      // Validasi username
      if (username_dokter) {
        const usernameExist = await Dokter.exists({
          username_dokter,
          _id: { $ne: id },
        });
        if (usernameExist) {
          return res
            .status(400)
            .json({ message: "Username sudah digunakan oleh pengguna lain" });
        }
      }

      // Validasi STR
      if (str_dokter) {
        const strExist = await Dokter.exists({
          str_dokter,
          _id: { $ne: id },
        });
        if (strExist) {
          return res
            .status(400)
            .json({ message: "STR sudah terdaftar oleh pengguna lain" });
        }
      }

      // Validasi dan enkripsi email
      if (email_dokter) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email_dokter)) {
          return res.status(400).json({ message: "Email tidak valid" });
        }

        const allDokter = await Dokter.find({ _id: { $ne: id } });
        const emailExist = allDokter.some((dok) => {
          try {
            return decrypt(dok.email_dokter) === email_dokter;
          } catch (e) {
            return false;
          }
        });

        if (emailExist) {
          return res
            .status(400)
            .json({ message: "Email sudah digunakan oleh pengguna lain" });
        }

        req.body.email_dokter = encrypt(email_dokter);
      }

      // Enkripsi nomor telepon
      if (notlp_dokter) {
        req.body.notlp_dokter = encrypt(notlp_dokter);
      }

      // Validasi rating
      if (rating_dokter !== undefined) {
        req.body.rating_dokter =
          rating_dokter >= 0 && rating_dokter <= 5 ? rating_dokter : 0;
      }

      // 🔄 UPDATE DOKTER
      const updatedDokter = await Dokter.findByIdAndUpdate(id, req.body, {
        new: true,
      }).select("-password_dokter");

      const possibleImageFields = ["foto_profil_dokter"];

      for (const field of possibleImageFields) {
        const oldImagePath = existingDokter[field];
        const newImagePath = req.body[field];

        if (oldImagePath && newImagePath && oldImagePath !== newImagePath) {
          console.log(`🔄 Mengganti gambar pada field '${field}':`);
          console.log(`   Gambar lama: ${oldImagePath}`);
          console.log(`   Gambar baru: ${newImagePath}`);
          await deleteImageFile(oldImagePath);
        } else if (oldImagePath && newImagePath === null) {
          // Jika gambar dihapus (set ke null)
          console.log(
            `🗑️ Menghapus gambar pada field '${field}': ${oldImagePath}`
          );
          await deleteImageFile(oldImagePath);
        }
      }

      res.status(200).json(updatedDokter);
    } catch (e) {
      next(e);
    }
  }
);

// DELETE ENDPOINT - PERBAIKAN
router.delete(
  "/delete/:id",
  roleAuthorization(["dokter", "admin"]),
  async (req, res, next) => {
    try {
      // 🔍 AMBIL DATA SEBELUM DIHAPUS
      const existingDokter = await Dokter.findById(req.params.id);
      if (!existingDokter) {
        return res.status(404).json({ message: "Dokter tidak ditemukan" });
      }

      console.log(
        "📋 Data dokter yang akan dihapus:",
        JSON.stringify(existingDokter, null, 2)
      );

      const deletedDokter = await Dokter.findByIdAndDelete(req.params.id);

      const possibleImageFields = ["foto_profil_dokter"];

      let deletedImages = [];
      for (const field of possibleImageFields) {
        const imagePath = existingDokter[field]; // Gunakan existingDokter, bukan deletedDokter
        if (imagePath) {
          console.log(
            `🗑️ Menghapus gambar dari field '${field}': ${imagePath}`
          );
          await deleteImageFile(imagePath);
          deletedImages.push({ field, path: imagePath });
        }
      }

      res.status(200).json({
        message: "Dokter berhasil dihapus",
        deletedImages,
        imageFieldsChecked: possibleImageFields,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.patch("/ubah-password", dokterAuthorization, async (req, res) => {
  try {
    const { password_lama, password_baru, konfirmasi_password_baru } = req.body;

    // --- field wajib ---
    if (!password_lama || !password_baru || !konfirmasi_password_baru) {
      return res.status(400).json({ message: "Semua field harus diisi" });
    }

    // --- konfirmasi password ---
    if (password_baru !== konfirmasi_password_baru) {
      return res
        .status(400)
        .json({ message: "Konfirmasi password tidak cocok" });
    }
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&/#^()[\]{}<>]).{8,}$/;
    if (!passwordRegex.test(password_baru)) {
      return res.status(400).json({
        message:
          "Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, angka, dan simbol",
      });
    }

    const user = await Dokter.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const validPassword = await bcrypt.compare(
      password_lama,
      user.password_dokter
    );
    if (!validPassword) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    const salt = await bcrypt.genSalt(17);
    const hashedPassword = await bcrypt.hash(password_baru, salt);

    user.password_dokter = hashedPassword;
    await user.save();
    return res.status(200).json({ message: "Password berhasil diubah" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// jadwal dokter
router.get("/jadwal/:dokterId", verifyToken, async (req, res) => {
  try {
    const { dokterId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(dokterId)) {
      return res.status(400).json({ message: "ID dokter tidak valid" });
    }
    const dokter = await Dokter.findById(dokterId).select("jadwal");
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }
    res.status(200).json(dokter.jadwal);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.patch("/jadwal/:dokterId/:jadwalId", verifyToken, async (req, res) => {
  try {
    const { dokterId, jadwalId } = req.params;
    const { tanggal, jam_mulai, jam_selesai } = req.body;

    const dokter = await Dokter.findById(dokterId);
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }

    const jadwal = dokter.jadwal.id(jadwalId);
    if (!jadwal) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    if (tanggal) jadwal.tanggal = tanggal;
    if (jam_mulai) jadwal.jam_mulai = jam_mulai;
    if (jam_selesai) jadwal.jam_selesai = jam_selesai;

    await dokter.save();
    res.status(200).json({ message: "Jadwal berhasil diupdate", jadwal });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

function generateSlots(start, end, interval = 3) {
  const slots = [];
  let [hour, minute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  let currentTimeInMinutes = hour * 60 + minute;
  const endTimeInMinutes = endHour * 60 + endMinute;

  while (currentTimeInMinutes <= endTimeInMinutes) {
    const slotHour = Math.floor(currentTimeInMinutes / 60);
    const slotMinute = currentTimeInMinutes % 60;
    const time = `${slotHour.toString().padStart(2, "0")}:${slotMinute
      .toString()
      .padStart(2, "0")}`;
    slots.push({ time, available: true });
    currentTimeInMinutes += interval;
  }
  return slots;
}

router.post("/jadwal/add/:dokterId", dokterAuthorization, async (req, res) => {
  try {
    const { dokterId } = req.params;
    const { tanggal, jam_mulai, jam_selesai } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dokterId)) {
      return res.status(400).json({ message: "ID dokter tidak valid" });
    }
    const dokter = await Dokter.findById(dokterId);
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }
    const slots = generateSlots(jam_mulai, jam_selesai);
    dokter.jadwal.push({
      tanggal,
      jam: slots,
    });

    await dokter.save();
    res
      .status(201)
      .json({ message: "Jadwal berhasil ditambahkan", data: dokter.jadwal });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: error.message });
  }
});

router.patch(
  "/:dokterId/jadwal/update",
  dokterAuthorization,
  async (req, res) => {
    const { dokterId } = req.params;
    const { tanggal, jam_mulai, jam_selesai, interval = 3 } = req.body;

    try {
      if (!tanggal || !jam_mulai || !jam_selesai) {
        return res.status(400).json({
          success: false,
          message: "Tanggal, jam_mulai, dan jam_selesai harus diisi",
        });
      }

      const dokter = await Dokter.findById(dokterId);
      if (!dokter) {
        return res.status(404).json({
          success: false,
          message: "Dokter tidak ditemukan",
        });
      }

      if (req.user.id !== dokterId) {
        return res.status(403).json({
          success: false,
          message: "Anda hanya bisa mengupdate jadwal Anda sendiri",
        });
      }

      const targetDate = new Date(tanggal);
      const jadwalIndex = dokter.jadwal.findIndex((j) => {
        const jadwalDate = new Date(j.tanggal);
        return (
          jadwalDate.toISOString().slice(0, 10) ===
          targetDate.toISOString().slice(0, 10)
        );
      });

      if (jadwalIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Jadwal pada tanggal tersebut tidak ditemukan",
        });
      }

      // 🆕 OTOMATIS MENGUBAH STATUS JADWAL KONSULTASI MENJADI "DITOLAK"
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const updateResult = await Jadwal.updateMany(
        {
          dokter_id: new mongoose.Types.ObjectId(dokterId),
          tgl_konsul: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
          status_konsul: "diterima",
        },
        {
          $set: {
            status_konsul: { $in: ["diterima", "menunggu"] },
          },
        }
      );

      console.log(
        `📅 Auto-reject: ${
          updateResult.modifiedCount
        } jadwal konsultasi berhasil diubah menjadi ditolak untuk tanggal ${targetDate.toLocaleDateString(
          "id-ID"
        )}`
      );

      const newSlots = [];
      const [startH, startM] = jam_mulai.split(":").map(Number);
      const [endH, endM] = jam_selesai.split(":").map(Number);

      let currentInMinutes = startH * 60 + startM;
      let endInMinutes = endH * 60 + endM;

      while (
        currentInMinutes + interval <= endInMinutes ||
        currentInMinutes <= endInMinutes
      ) {
        newSlots.push({
          time: `${Math.floor(currentInMinutes / 60)
            .toString()
            .padStart(2, "0")}:${(currentInMinutes % 60)
            .toString()
            .padStart(2, "0")}`,
          available: true,
        });

        currentInMinutes += interval;
      }

      dokter.jadwal[jadwalIndex].jam = newSlots;
      await dokter.save();
      return res.status(200).json({
        success: true,
        message: "Jadwal berhasil diperbarui",
        data: {
          updatedSchedule: dokter.jadwal[jadwalIndex],
          autoRejectedCount: updateResult.modifiedCount,
          rejectedDate: targetDate.toLocaleDateString("id-ID"),
        },
      });
    } catch (err) {
      console.log("Error:", err);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan server",
      });
    }
  }
);

router.patch(
  "/jadwal/:dokterId/jam/:jamId",
  masyarakatAuthorization,
  async (req, res) => {
    const { dokterId, jamId } = req.params;
    const { tanggal, jam_mulai, jam_selesai } = req.body;

    try {
      const dokter = await Dokter.findById(dokterId);
      if (!dokter)
        return res.status(404).json({ message: "Dokter tidak ditemukan" });

      const jadwal = dokter.jadwal.find((j) => {
        const tgl = new Date(j.tanggal).toISOString().split("T")[0];
        const targetTgl = new Date(tanggal).toISOString().split("T")[0];
        return tgl === targetTgl;
      });

      if (!jadwal)
        return res.status(404).json({ message: "Jadwal tidak ditemukan" });

      const jamItem = jadwal.jam.find((j) => j._id.toString() === jamId);
      if (!jamItem)
        return res.status(404).json({ message: "Jam tidak ditemukan" });

      jamItem.available = false;

      await dokter.save();
      return res.status(200).json({ message: "Jadwal diperbarui" });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  }
);

router.delete(
  "/jadwal/hapus/:dokterId",
  dokterAuthorization,
  async (req, res) => {
    try {
      const { dokterId } = req.params;
      const { tanggal } = req.body;

      if (!mongoose.Types.ObjectId.isValid(dokterId)) {
        return res.status(400).json({
          success: false,
          message: "ID Dokter tidak valid",
        });
      }

      if (!tanggal) {
        return res.status(400).json({
          success: false,
          message: "Parameter tanggal diperlukan",
        });
      }

      const targetDate = new Date(tanggal);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Format tanggal tidak valid",
        });
      }

      if (req.user.id !== dokterId) {
        return res.status(403).json({
          success: false,
          message: "Anda hanya bisa menghapus jadwal Anda sendiri",
        });
      }

      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      console.log("Rentang tanggal untuk penghapusan:", {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
      });

      // 🆕 OTOMATIS MENGUBAH STATUS JADWAL KONSULTASI MENJADI "DITOLAK"
      const updateResult = await Jadwal.updateMany(
        {
          dokter_id: new mongoose.Types.ObjectId(dokterId),
          tgl_konsul: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
          status_konsul: { $in: ["diterima", "menunggu"] },
        },
        {
          $set: {
            status_konsul: "ditolak",
          },
        }
      );

      console.log(
        `📅 Auto-reject: ${
          updateResult.modifiedCount
        } jadwal konsultasi berhasil diubah menjadi ditolak untuk tanggal ${targetDate.toLocaleDateString(
          "id-ID"
        )}`
      );

      const dokter = await Dokter.findOne({
        _id: dokterId,
        "jadwal.tanggal": {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      if (!dokter) {
        return res.status(404).json({
          success: false,
          message: `Tidak ada jadwal pada tanggal ${targetDate.toLocaleDateString(
            "id-ID"
          )} untuk dihapus`,
        });
      }

      const result = await Dokter.findByIdAndUpdate(
        dokterId,
        {
          $pull: {
            jadwal: {
              tanggal: {
                $gte: startOfDay,
                $lte: endOfDay,
              },
            },
          },
        },
        { new: true }
      );

      const jadwalTerhapus = dokter.jadwal.filter((j) => {
        const jadwalDate = new Date(j.tanggal);
        return jadwalDate >= startOfDay && jadwalDate <= endOfDay;
      });

      if (jadwalTerhapus.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Tidak ada jadwal pada tanggal ${targetDate.toLocaleDateString(
            "id-ID"
          )} untuk dihapus`,
        });
      }

      const formattedDate = targetDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      res.status(200).json({
        success: true,
        message: `Jadwal pada tanggal ${formattedDate} berhasil dihapus`,
        data: {
          deletedCount: jadwalTerhapus.length,
          deletedSchedules: jadwalTerhapus,
          autoRejectedCount: updateResult.modifiedCount,
          rejectedDate: targetDate.toLocaleDateString("id-ID"),
        },
      });
    } catch (error) {
      console.log("Error saat menghapus jadwal:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan server",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

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

router.delete(
  "/delete-profile-image/:id",
  dokterAuthorization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const lockKey = `delete_${id}`;
      await lockManager.acquireLock(lockKey);

      try {
        const dokterData = await Dokter.findById(id);
        if (!dokterData) {
          return res.status(404).json({
            success: false,
            message: "Dokter tidak ditemukan",
          });
        }
        const fotoProfilPath = dokterData.foto_profil_dokter;
        if (fotoProfilPath && fotoProfilPath !== "") {
          try {
            const fullPath = path.join("public", fotoProfilPath);
            if (
              await fs
                .access(fullPath)
                .then(() => true)
                .catch(() => false)
            ) {
              await fs.unlink(fullPath);
              console.log("File foto profil berhasil dihapus:", fullPath);
            } else {
              console.log("File foto profil tidak ditemukan:", fullPath);
            }
          } catch (fileError) {
            console.log("Error menghapus file foto profil:", fileError);
          }
        }
        const updateResult = await Dokter.findByIdAndUpdate(
          id,
          { foto_profil_dokter: "" },
          { new: true }
        );
        if (!updateResult) {
          return res.status(400).json({
            success: false,
            message: "Gagal menghapus foto profil dari database",
          });
        }
        res.status(200).json({
          success: true,
          message: "Foto profil berhasil dihapus",
          data: {
            _id: updateResult._id,
            nama_dokter: updateResult.nama_dokter,
            foto_profil_dokter: updateResult.foto_profil_dokter,
          },
        });
      } finally {
        lockManager.releaseLock(lockKey);
      }
    } catch (error) {
      console.log("Error menghapus foto profil:", error);

      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "ID Dokter tidak valid",
        });
      }

      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan server saat menghapus foto profil",
      });
    }
  }
);

module.exports = router;
