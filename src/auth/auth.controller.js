const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const masyarakat = require("../masyarakat/masyarakat.model");
const dokter = require("../dokter/dokter.model");
const superadmin = require("../admin/admin.model");
const { encrypt, decrypt } = require("../utils/encryption");
const router = express.Router();
const loginLimiter = require("../middleware/ratelimiter");
const multer = require("multer");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "public/images-be"); 
    },
    filename: function (req, file, cb) {
      const uniqueName = Date.now() + "-" + file.originalname;
      cb(null, uniqueName);
    },
  });
  
  const upload = multer({ storage: storage });
  
  router.post(
    "/register_masyarakat",
    upload.fields([
      { name: "foto_ktp_masyarakat", maxCount: 1 },
      { name: "selfie_ktp_masyarakat", maxCount: 1 },
    ]),
    async (req, res) => {
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
        } = req.body;
  
        const foto_ktp_masyarakat =
          req.files["foto_ktp_masyarakat"]?.[0]?.filename;
        const selfie_ktp_masyarakat =
          req.files["selfie_ktp_masyarakat"]?.[0]?.filename;
  
        // Cek data wajib
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
          !selfie_ktp_masyarakat
        ) {
          return res
            .status(400)
            .json({ message: "Semua data harus diisi dengan lengkap" });
        }
  
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email_masyarakat)) {
          return res.status(400).json({ message: "Email tidak valid" });
        }
  
        const nikRegex = /^\d{16}$/;
        if (!nikRegex.test(nik_masyarakat)) {
          return res.status(400).json({ message: "NIK harus 16 digit angka" });
        }
  
        const usernameExist = await masyarakat.exists({ username_masyarakat });
        if (usernameExist) {
          return res.status(400).json({ message: "Username sudah digunakan" });
        }
  
        const allUsers = await masyarakat.find();
  
        const emailExist = allUsers.some((user) => {
          const decrypted = decrypt(user.email_masyarakat);
          return decrypted === email_masyarakat;
        });
  
        if (emailExist) {
          return res.status(400).json({ message: "Email sudah terdaftar" });
        }
  
        const nikExist = allUsers.some((user) => {
          const decrypted = decrypt(user.nik_masyarakat);
          return decrypted === nik_masyarakat;
        });
  
        if (nikExist) {
          return res.status(400).json({ message: "NIK sudah terdaftar" });
        }

        const passwordRegex =
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&/#^()[\]{}<>]).{8,}$/;

        if (!passwordRegex.test(password_masyarakat)) {
          return res.status(400).json({
            message:
              "Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, angka, dan simbol",
          });
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
        });
  
        await newUser.save();
  
        return res
          .status(201)
          .json({ message: "Registrasi berhasil", user: newUser });
      } catch (err) {
        console.error("Error saat registrasi:", err);
        return res.status(500).json({
          message: "Terjadi kesalahan pada server. Silakan coba lagi nanti.",
        });
      }
    }
  );
  

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
            role: user.role
        }, process.env.JWT_SECRET);

        res.status(200).json({
            message: "Login berhasil",
            token,
            userId: user._id,
            username: user.username_masyarakat,
            role: user.role
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
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
                role: user.role,
            }, process.env.JWT_SECRET);

        res.status(200).json({
            message: "Login berhasil",
            token,
            userId: user._id,
            username: user.username_masyarakat,
            role: user.role
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
                role: user.role,
            }, process.env.JWT_SECRET,
            //  { expiresIn: "1d" }
            );

            res.status(200).json({
                message: "Login berhasil",
                token,
                userId: user._id,
                username: user.username_superadmin,
                role: user.role
            });    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;