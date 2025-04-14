const express = require("express");
const router = express.Router();
const Verifikasi = require("./verifikasi.model");

router.post("/create", async (req, res) => {
  try {
    const { masyarakat_id, dokter_id, tgl_verif, status_verif } = req.body;

    const newVerifikasi = new Verifikasi({
      masyarakat_id,
      dokter_id,
      tgl_verif,
      status_verif,
    });

    await newVerifikasi.save();
    res.status(201).json({ message: "Verifikasi berhasil dibuat", verifikasi: newVerifikasi });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", async (req, res) => {
    try {
      const verifikasiList = await Verifikasi.find()
        .populate("masyarakat_id", "nama_masyarakat")
        .populate("dokter_id", "nama_dokter");
  
      res.status(200).json(verifikasiList);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  module.exports = router;
  