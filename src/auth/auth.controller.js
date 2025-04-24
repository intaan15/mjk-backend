const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const masyarakat = require("../masyarakat/masyarakat.model");
const dokter = require("../dokter/dokter.model");
const superadmin = require("../admin/admin.model");
const router = express.Router();
const loginLimiter = require("../middleware/ratelimiter");
// const dokterAuthorization = require('./middleware/dokterAuthorization')

router.post("/register_masyarakat", async (req, res) => {
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
            foto_profil_masyarakat
        } = req.body;

        const usernameExist = await masyarakat.exists({ username_masyarakat });
        if (usernameExist) return res.status(400).json({ message: "Username sudah digunakan" });

        const nikExist = await masyarakat.exists({ nik_masyarakat });
        if (nikExist) return res.status(400).json({ message: "NIK sudah terdaftar" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password_masyarakat, salt);

        const newUser = new masyarakat({
            nama_masyarakat,
            username_masyarakat,
            password_masyarakat: hashedPassword,
            email_masyarakat,
            nik_masyarakat,
            alamat_masyarakat,
            notlp_masyarakat,
            jeniskelamin_masyarakat,
            tgl_lahir_masyarakat,
            foto_ktp_masyarakat,
            selfie_ktp_masyarakat,
            foto_profil_masyarakat
        });

        await newUser.save();

        res.status(201).json({ message: "Registrasi berhasil", user: newUser });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post("/login_masyarakat", async (req, res) => {
    try {
        const { identifier_masyarakat, password_masyarakat } = req.body;
        if (!identifier_masyarakat || !password_masyarakat) {
            return res.status(400).json({ message: "Harap masukkan username/NIK dan password" });
        }
        const user = await masyarakat.findOne({
            $or: [{ username_masyarakat: identifier_masyarakat }, { nik_masyarakat: identifier_masyarakat }]
        }).lean();

        if (!user) return res.status(400).json({ message: "Akun tidak ditemukan" });
        if (user.verifikasi_akun_masyarakat === "Pending") return res.status(403).json({ message: "Akun belum diverifikasi" });
        if (user.verifikasi_akun_masyarakat === "Tolak") return res.status(403).json({ message: "Akun anda ditolak" })

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
                role: "dokter",
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(200).json({ message: "Login berhasil", token });
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