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

module.exports = router;