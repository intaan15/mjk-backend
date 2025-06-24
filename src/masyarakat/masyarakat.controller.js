const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const masyarakat = require("./masyarakat.model");
const verifyToken = require("../middleware/verifyToken");
const { encrypt, decrypt } = require("../utils/encryption");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs").promises;
const masyarakatAuthorization = require("../middleware/masyarakatAuthorization");
const { createLimiter, uploadLimiter } = require("../middleware/ratelimiter");

// Fungsi untuk mengompres gambar profil - otomatis compress tanpa batasan size
async function compressImage(inputPath, outputPath) {
  try {
    // Compress dengan setting optimal untuk foto profil
    await sharp(inputPath)
      .resize(800, 800, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 80,
        effort: 4,
      })
      .toFile(outputPath);

    // Dapatkan ukuran file hasil kompresi
    const stats = await fs.stat(outputPath);
    const fileSizeKB = stats.size / 1024;

    console.log(`File berhasil dikompres, ukuran: ${fileSizeKB.toFixed(2)}KB`);

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

// Konfigurasi multer tanpa batasan ukuran - biar auto compress
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
  await ensureDirectoryExists("public/imagesmasyarakat");
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

router.post("/upload", uploadLimiter, (req, res) => {
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

    const masyarakatId = req.body.id;
    if (!masyarakatId) {
      // Bersihkan file jika tidak ada ID
      await fs.unlink(req.file.path).catch(console.log);
      return res.status(400).json({
        message: "ID masyarakat diperlukan",
        error: "MISSING_ID",
      });
    }

    // Gunakan lock untuk mencegah race condition
    const lockKey = `upload_${masyarakatId}`;
    await lockManager.acquireLock(lockKey);

    try {
      // Ambil data masyarakat untuk mendapatkan foto lama
      const userData = await masyarakat.findById(masyarakatId);
      if (!userData) {
        await fs.unlink(req.file.path).catch(console.log);
        return res.status(404).json({
          message: "Masyarakat tidak ditemukan",
          error: "USER_NOT_FOUND",
        });
      }

      // Path file sementara dan final
      const tempFilePath = req.file.path;
      const originalName = req.file.originalname
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9.\-]/g, "");
      const finalFileName =
        Date.now() + "-" + originalName.replace(/\.[^/.]+$/, "") + ".webp";
      const finalFilePath = path.join(
        "public/imagesmasyarakat/",
        finalFileName
      );

      // Kompres gambar otomatis
      console.log(`Mulai kompresi foto profil: ${req.file.originalname}`);
      const compressionSuccess = await compressImage(
        tempFilePath,
        finalFilePath
      );

      // Hapus foto lama jika ada
      if (userData.foto_profil_masyarakat) {
        const oldPhotoPath = path.join(
          "public",
          userData.foto_profil_masyarakat
        );
        try {
          await fs.unlink(oldPhotoPath);
          console.log(`Foto lama berhasil dihapus: ${oldPhotoPath}`);
        } catch (unlinkError) {
          // Log error tapi jangan gagalkan proses upload
          console.warn(`Gagal menghapus foto lama: ${unlinkError.message}`);
        }
      }

      // Update database dengan foto baru
      const dbFilePath = `/imagesmasyarakat/${finalFileName}`;
      const updated = await masyarakat.findByIdAndUpdate(masyarakatId, {
        foto_profil_masyarakat: dbFilePath,
      });

      if (!updated) {
        // Hapus file yang sudah diupload jika gagal update database
        await fs.unlink(finalFilePath).catch(console.log);
        return res.status(404).json({
          message: "Gagal memperbarui data masyarakat",
          error: "UPDATE_FAILED",
        });
      }

      // Hapus file temporary
      await fs.unlink(tempFilePath).catch(console.log);

      // Dapatkan ukuran file final
      const finalStats = await fs.stat(finalFilePath);
      const finalSizeKB = finalStats.size / 1024;

      res.status(200).json({
        message: "Upload dan kompresi berhasil",
        path: dbFilePath,
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
        compressed: true,
        oldPhotoDeleted: userData.foto_profil_masyarakat ? true : false,
      });
    } catch (error) {
      console.log("Upload error:", error);
      // Bersihkan file jika ada error
      if (req.file && req.file.path) {
        await fs.unlink(req.file.path).catch(console.log);
      }
      res.status(500).json({
        message: "Upload gagal",
        error: error.message,
      });
    } finally {
      lockManager.releaseLock(lockKey);
    }
  });
});

router.patch("/update/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nama_masyarakat,
      username_masyarakat,
      nik_masyarakat,
      email_masyarakat,
      password_masyarakat,
      alamat_masyarakat,
      notlp_masyarakat,
      ...otherFields
    } = req.body;

    const userExist = await masyarakat.exists({ _id: id });
    if (!userExist) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    if (nik_masyarakat) {
      const nikExist = await masyarakat.exists({
        nik_masyarakat,
        _id: { $ne: id },
      });
      if (nikExist) {
        return res.status(400).json({ message: "NIK sudah terdaftar." });
      }
    }

    if (username_masyarakat) {
      const usernameExist = await masyarakat.exists({
        username_masyarakat,
        _id: { $ne: id },
      });
      if (usernameExist) {
        return res.status(400).json({ message: "Username sudah terdaftar." });
      }
    }

    if (nama_masyarakat) {
      const namaExist = await masyarakat.exists({
        nama_masyarakat,
        _id: { $ne: id },
      });
      if (namaExist) {
        return res.status(400).json({ message: "Nama sudah terdaftar." });
      }
    }

    if (email_masyarakat) {
      const emailExist = await masyarakat.exists({
        email_masyarakat,
        _id: { $ne: id },
      });
      if (emailExist) {
        return res.status(400).json({ message: "Email sudah terdaftar." });
      }
    }

    const updateData = { ...otherFields };
    if (nama_masyarakat) updateData.nama_masyarakat = nama_masyarakat;
    if (username_masyarakat)
      updateData.username_masyarakat = username_masyarakat;
    if (nik_masyarakat) updateData.nik_masyarakat = encrypt(nik_masyarakat);
    if (email_masyarakat)
      updateData.email_masyarakat = encrypt(email_masyarakat);
    if (alamat_masyarakat)
      updateData.alamat_masyarakat = encrypt(alamat_masyarakat);
    if (notlp_masyarakat)
      updateData.notlp_masyarakat = encrypt(notlp_masyarakat);
    if (password_masyarakat) {
      const salt = await bcrypt.genSalt(17);
      updateData.password_masyarakat = await bcrypt.hash(
        password_masyarakat,
        salt
      );
    }

    const updatedUser = await masyarakat
      .findByIdAndUpdate(id, updateData, { new: true })
      .select("-password_masyarakat");

    res.status(200).json(updatedUser);
  } catch (e) {
    console.log("Update error:", e);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat memperbarui data" });
  }
});

router.post("/create", createLimiter, verifyToken, async (req, res) => {
  try {
    const {
      nama_masyarakat,
      username_masyarakat,
      password_masyarakat,
      email_masyarakat,
      nik_masyarakat,
      alamat_masyarakat,
      notlp_masyarakat,
      jeniskelamin_masyarakat,
      tgl_lahir_masyarakat,
      foto_ktp_masyarakat,
      selfie_ktp_masyarakat,
      foto_profil_masyarakat,
    } = req.body;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const nikRegex = /^\d{16}$/;

    if (!emailRegex.test(email_masyarakat)) {
      return res.status(400).json({ message: "Email tidak valid" });
    }

    if (!nikRegex.test(nik_masyarakat)) {
      return res.status(400).json({ message: "NIK harus 16 digit" });
    }

    const usernameExist = await masyarakat.exists({ username_masyarakat });
    if (usernameExist) {
      return res.status(400).json({ message: "Username sudah digunakan" });
    }

    const allUsers = await masyarakat.find();

    const emailExist = allUsers.some((user) => {
      const decryptedEmail = decrypt(user.email_masyarakat);
      return decryptedEmail && decryptedEmail === email_masyarakat;
    });

    if (emailExist) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    const nikExist = allUsers.some((user) => {
      const decryptedNIK = decrypt(user.nik_masyarakat);
      return decryptedNIK && decryptedNIK === nik_masyarakat;
    });

    if (nikExist) {
      return res.status(400).json({ message: "NIK sudah terdaftar" });
    }

    const hashedPassword = await bcrypt.hash(password_masyarakat, 17);

    const newUser = new masyarakat({
      nama_masyarakat,
      username_masyarakat,
      password_masyarakat: hashedPassword,
      email_masyarakat: encrypt(email_masyarakat),
      nik_masyarakat: encrypt(nik_masyarakat),
      alamat_masyarakat: encrypt(alamat_masyarakat),
      notlp_masyarakat: encrypt(notlp_masyarakat),
      jeniskelamin_masyarakat,
      tgl_lahir_masyarakat,
      foto_ktp_masyarakat,
      selfie_ktp_masyarakat,
      foto_profil_masyarakat,
    });

    await newUser.save();

    res.status(201).json({ message: "Registrasi berhasil", user: newUser });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/getall", verifyToken, async (req, res) => {
  try {
    const allUsers = await masyarakat.find().select("-password_masyarakat");

    if (allUsers.length === 0) {
      return res.status(404).json({ message: "Tidak ada data" });
    }

    const decryptedUsers = allUsers.map((user) => ({
      ...user._doc,
      email_masyarakat: decrypt(user.email_masyarakat),
      nik_masyarakat: decrypt(user.nik_masyarakat),
      alamat_masyarakat: decrypt(user.alamat_masyarakat),
      notlp_masyarakat: decrypt(user.notlp_masyarakat),
    }));

    res.status(200).json(decryptedUsers);
  } catch (e) {
    console.log("Error:", e);
    res.status(500).json({ message: e.message });
  }
});

router.get("/getbyid/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID tidak valid" });
    }

    const user = await masyarakat.findById(id).select("-password_masyarakat");
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const decryptedUser = {
      ...user._doc,
      email_masyarakat: decrypt(user.email_masyarakat),
      nik_masyarakat: decrypt(user.nik_masyarakat),
      alamat_masyarakat: decrypt(user.alamat_masyarakat),
      notlp_masyarakat: decrypt(user.notlp_masyarakat),
    };

    res.status(200).json(decryptedUser);
  } catch (e) {
    console.log("Error:", e);
    res.status(500).json({ message: e.message });
  }
});

router.delete("/delete/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const userExist = await masyarakat.exists({ _id: id });
    if (!userExist) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    await masyarakat.findByIdAndDelete(id);
    res.status(200).json({ message: "Data berhasil dihapus" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.patch("/ubah-password", masyarakatAuthorization, async (req, res) => {
  try {
    const { password_lama, password_baru, konfirmasi_password_baru } = req.body;

    if (!password_lama || !password_baru || !konfirmasi_password_baru) {
      return res.status(400).json({ message: "Semua field harus diisi" });
    }

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

    const user = await masyarakat.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const validPassword = await bcrypt.compare(
      password_lama,
      user.password_masyarakat
    );
    if (!validPassword) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    const salt = await bcrypt.genSalt(17);
    const hashedPassword = await bcrypt.hash(password_baru, salt);

    user.password_masyarakat = hashedPassword;
    await user.save();
    return res.status(200).json({ message: "Password berhasil diubah" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});


router.delete(
  "/delete-profile-image/:id",
  masyarakatAuthorization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const lockKey = `delete_${id}`;
      await lockManager.acquireLock(lockKey);

      try {
        const masyarakatData = await masyarakat.findById(id);
        if (!masyarakatData) {
          return res.status(404).json({
            success: false,
            message: "Masyarakat tidak ditemukan",
          });
        }
        const fotoProfilPath = masyarakatData.foto_profil_masyarakat;
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
        const updateResult = await masyarakat.findByIdAndUpdate(
          id,
          { foto_profil_masyarakat: "" },
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
            nama_masyarakat: updateResult.nama_masyarakat,
            foto_profil_masyarakat: updateResult.foto_profil_masyarakat,
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
          message: "ID masyarakat tidak valid",
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
