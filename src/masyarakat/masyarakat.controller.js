const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const masyarakat = require("./masyarakat.model");
const verifyToken = require("../middleware/verifyToken");
const { encrypt, decrypt } = require("../utils/encryption");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const masyarakatAuthorization = require("../middleware/masyarakatAuthorization");
const createLimiter = require("../middleware/ratelimiter");
const rateLimit = require("express-rate-limit");

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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/imagesmasyarakat/");
  },
  filename: function (req, file, cb) {
    const originalName = file.originalname;
    const sanitized = originalName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.\-]/g, "");

    const uniqueName = Date.now() + "-" + sanitized;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.post("/upload", uploadLimiter, upload.single("image"), async (req, res) => {
  try {
    const masyarakatId = req.body.id;

    if (!req.file) {
      console.log("⛔ Tidak ada file yang diunggah");
      return res.status(400).json({ error: "File tidak ditemukan" });
    }

    const filePath = `/imagesmasyarakat/${req.file.filename}`;
    const updated = await masyarakat.findByIdAndUpdate(masyarakatId, {
      foto_profil_masyarakat: filePath,
    });

    if (!updated) {
      console.log("⚠️ Masyarakat tidak ditemukan dengan ID:", masyarakatId);
      return res.status(404).json({ error: "Masyarakat tidak ditemukan" });
    }

    res.status(200).json({ message: "Upload berhasil", path: filePath });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload gagal" });
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

    const hashedPassword = await bcrypt.hash(password_masyarakat, 10);

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
    console.error("Error:", e);
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
    console.error("Error:", e);
    res.status(500).json({ message: e.message });
  }
});

router.patch("/update/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
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
      const salt = await bcrypt.genSalt(10);
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
    console.error("Update error:", e);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat memperbarui data" });
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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password_baru, salt);

    user.password_masyarakat = hashedPassword;
    await user.save();
    res.status(200).json({ message: "Password berhasil diubah" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
module.exports = router;
