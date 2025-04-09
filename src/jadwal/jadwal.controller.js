const express = require("express");
const router = express.Router();
const jadwal = require("./jadwal.model");

router.post("/create", async (req, res) => {
    try {
        const newJadwal = new jadwal(req.body);
        const savedJadwal = await newJadwal.save();
        res.status(201).json({ message: "Jadwal berhasil dibuat", data: savedJadwal });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const allJadwal = await jadwal.find()
            .populate("verifikasi_id", "nama_masyarakat") // sesuaikan field jika perlu
            .populate("dokter_id", "nama_dokter");
        res.status(200).json(allJadwal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const oneJadwal = await jadwal.findById(req.params.id)
            .populate("verifikasi_id", "nama_masyarakat")
            .populate("dokter_id", "nama_dokter");
        if (!oneJadwal) return res.status(404).json({ message: "Jadwal tidak ditemukan" });
        res.status(200).json(oneJadwal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;