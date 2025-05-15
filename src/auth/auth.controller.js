const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const masyarakat = require("../masyarakat/masyarakat.model");
const dokter = require("../dokter/dokter.model");
const superadmin = require("../admin/admin.model");
const { encrypt, decrypt } = require("../utils/encryption");
const router = express.Router();
const loginLimiter = require("../middleware/ratelimiter");
// const dokterAuthorization = require('./middleware/dokterAuthorization')

router.post("/register_masyarakat", async (req, res) => {
  try {
    console.log("Received data:", req.body);
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

    // ✅ Cek apakah ada field yang kosong
    if (
      !nama_masyarakat ||
      !username_masyarakat ||
      !password_masyarakat ||
      !email_masyarakat ||
      !nik_masyarakat ||
      !alamat_masyarakat ||
      !notlp_masyarakat ||
      !jeniskelamin_masyarakat ||
      !tgl_lahir_masyarakat ||
      !foto_ktp_masyarakat ||
      !selfie_ktp_masyarakat ||
      !foto_profil_masyarakat
    ) {
      return res
        .status(400)
        .json({ message: "Semua data harus diisi dengan lengkap" });
    }

    // Validasi email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email_masyarakat)) {
      return res.status(400).json({ message: "Email tidak valid" });
    }

    // Validasi NIK harus 16 digit angka
    const nikRegex = /^\d{16}$/;
    if (!nikRegex.test(nik_masyarakat)) {
      return res.status(400).json({ message: "NIK harus 16 digit" });
    }

    // Cek username sudah ada
    const usernameExist = await masyarakat.exists({ username_masyarakat });
    if (usernameExist) {
      return res.status(400).json({ message: "Username sudah digunakan" });
    }

    // Ambil semua user untuk cek email dan NIK dengan decrypt
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password_masyarakat, 10);

    // Simpan data user baru dengan encrypt untuk field tertentu
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
    // Kirim pesan error yang lebih ramah ke client
    res
      .status(500)
      .json({ message: "Terjadi kesalahan pada server. Coba lagi nanti." });
  }
});
  
  

router.post("/login_masyarakat", loginLimiter, async (req, res) => {
    try {
        const { identifier_masyarakat, password_masyarakat } = req.body;
        if (!identifier_masyarakat || !password_masyarakat) {
            return res.status(400).json({ message: "Harap masukkan username/NIK dan password" });
        }
        const user = await masyarakat.findOne({
            $or: [{ username_masyarakat: identifier_masyarakat }, { nik_masyarakat: identifier_masyarakat }]
        }).lean();

        if (!user) return res.status(400).json({ message: "Akun tidak ditemukan" });

        if (user.verifikasi_akun_masyarakat !== "diterima") {
            if (user.verifikasi_akun_masyarakat === "pending") return res.status(403).json({ message: "Akun belum diverifikasi" });
            if (user.verifikasi_akun_masyarakat === "ditolak") return res.status(403).json({ message: "Akun anda ditolak" });
                return res.status(403).json({ message: "Akun anda bodong" });
        }
        const isMatch = await bcrypt.compare(password_masyarakat, user.password_masyarakat);
        if (!isMatch) return res.status(400).json({ message: "Password salah" });

        const token = jwt.sign({
            id: user._id,
            username: user.username_masyarakat,
            nik: user.nik_masyarakat,
            role: 'masyarakat'
        },
            process.env.JWT_SECRET, { expiresIn: "1h" }
        );

        res.status(200).json({
            message: "Login berhasil",
            token,
            userId: user._id
        });
    } catch (e) {
        // res.status(500).json({ error: e.message });
    }
});

router.post("/login_dokter", loginLimiter, async (req, res) => {
    try {
        const { identifier_dokter, password_dokter } = req.body;

        if (!identifier_dokter || !password_dokter) {
            return res
                .status(400)
                .json({ message: "Harap masukkan username/str dan password" });
        }

        const user = await dokter
            .findOne({
                $or: [
                    { username_dokter: identifier_dokter },
                    { str_dokter: identifier_dokter },
                ],
            })
            .lean();

        if (!user) return res.status(400).json({ message: "Akun tidak ditemukan" });

        const isMatch = await bcrypt.compare(password_dokter, user.password_dokter);
        if (!isMatch) return res.status(400).json({ message: "Password salah" });

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username_dokter,
                str: user.str_dokter,
                role: "dokter",
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        res.status(200).json({
            message: "Login berhasil",
            token,
            userId: user._id
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


router.post("/login_superadmin", async (req, res) => {
    try {
        const { username_superadmin, password_superadmin } = req.body;
        if (!username_superadmin || !password_superadmin) {
            return res
                .status(400)
                .json({ message: "Harap masukkan username dan password" });
        }

        const user = await superadmin.findOne({ username_superadmin });

        if (!user) return res.status(400).json({ message: "Akun tidak ditemukan" });

        const isMatch = await bcrypt.compare(
            password_superadmin,
            user.password_superadmin
        );
        if (!isMatch) return res.status(400).json({ message: "Password salah" });

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username_superadmin,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(200).json({ message: "Login berhasil", token });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;