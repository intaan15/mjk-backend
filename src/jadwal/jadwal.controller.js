const express = require("express");
const router = express.Router();
const jadwal = require("./jadwal.model");

router.post("/create", async (req, res) => {
  try {
    const newJadwal = new jadwal(req.body);
    const savedJadwal = await newJadwal.save();
    res
      .status(201)
      .json({ message: "Jadwal berhasil dibuat", data: savedJadwal });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/getall", async (req, res) => {
  try {
    const allJadwal = await jadwal
      .find()
      .populate({ path: "masyarakat_id", select: "nama_masyarakat" })
      .populate({ path: "dokter_id", select: "nama_dokter rating_dokter spesialis_dokter" });

    res.status(200).json(allJadwal);
  } catch (error) {
    console.error("Error getall jadwal:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/getbyid/:id", async (req, res) => {
  try {
    const oneJadwal = await jadwal
      .findById(req.params.id)
      .populate({ path: "masyarakat_id", select: "nama_masyarakat" })
      .populate({ path: "dokter_id", select: "nama_dokter rating_dokter spesialis_dokter" });

    if (!oneJadwal) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    res.status(200).json(oneJadwal);
  } catch (error) {
    console.error("Error getbyid jadwal:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/update/:id", async (req, res) => {
  try {
    const updated = await jadwal.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated)
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    res
      .status(200)
      .json({ message: "Jadwal berhasil diperbarui", data: updated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const deleted = await jadwal.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    res.status(200).json({ message: "Jadwal berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/update/status/:id", async (req, res) => {
    try {
      const { status_konsul } = req.body;
      if (!["menunggu", "ditolak", "diterima"].includes(status_konsul)) {
        return res.status(400).json({ message: "Status tidak valid" });
      }
  
      const updated = await jadwal.findByIdAndUpdate(
        req.params.id,
        { status_konsul },
        { new: true }
      );
  
      if (!updated)
        return res.status(404).json({ message: "Jadwal tidak ditemukan" });
  
      res.status(200).json({
        message: "Status berhasil diperbarui",
        data: updated,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

module.exports = router;
