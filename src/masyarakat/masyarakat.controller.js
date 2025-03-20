const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const masyarakat = require("./masyarakat.model");

router.post("/create", async (req, res) => {
    try {
        const { nik_masyarakat, password_masyarakat } = req.body;

        const usernameExist = await masyarakat.exists({ username_masyarakat });
        if (usernameExist) return res.status(400).json({ message: "Username sudah digunakan" });
        
        const nikExist = await masyarakat.exists({ nik_masyarakat });
        if (nikExist) return res.status(400).json({ message: "Sudah terdaftar." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password_masyarakat, salt);
        req.body.password_masyarakat = hashedPassword;

        const newMasyarakat = new masyarakat(req.body);
        const result = await newMasyarakat.save();
        res.status(201).json(result);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.get("/getall", async (req, res) => {
    try {
        const readMasyarakat = await masyarakat.find().select("-password_masyarakat"); // 🔹 Jangan tampilkan password
        if (readMasyarakat.length === 0) {
            return res.status(404).json({ message: "Data tidak ditemukan" });
        }
        res.status(200).json(readMasyarakat);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.patch("/update/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nik_masyarakat, password_masyarakat } = req.body;

        const userExist = await masyarakat.exists({ _id: id });
        if (!userExist) {
            return res.status(404).json({ message: "Data tidak ditemukan" });
        }

        if (nik_masyarakat) {
            const nikExist = await masyarakat.exists({ nik_masyarakat, _id: { $ne: id } });
            if (nikExist) {
                return res.status(400).json({ message: "NIK sudah terdaftar oleh pengguna lain." });
            }
        }

        if (password_masyarakat) {
            const salt = await bcrypt.genSalt(10);
            req.body.password_masyarakat = await bcrypt.hash(password_masyarakat, salt);
        }

        const updatedUser = await masyarakat.findByIdAndUpdate(id, req.body, { new: true }).select("-password_masyarakat");
        res.status(200).json(updatedUser);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.delete("/delete/:id", async (req, res) => {
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

module.exports = router;