const express = require("express");
const router = express.Router();
const Jadwal = require("./jadwal.model"); // Ganti nama model jadi 'Jadwal'
const verifyToken = require("../middleware/verifyToken");
const Chat = require("../socket/chat.model");

router.post("/create", verifyToken, async (req, res) => {
  try {
    const newJadwal = new Jadwal(req.body);
    const savedJadwal = await newJadwal.save();
    res
      .status(201)
      .json({ message: "Jadwal berhasil dibuat", data: savedJadwal });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/getall", verifyToken, async (req, res) => {
  try {
    const allJadwal = await Jadwal.find()
      .populate({ path: "masyarakat_id", select: "nama_masyarakat" })
      .populate({
        path: "dokter_id",
        select: "nama_dokter rating_dokter spesialis_dokter",
      });

    res.status(200).json(allJadwal);
  } catch (error) {
    console.error("Error getall jadwal:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/getbyid/:id", verifyToken, async (req, res) => {
  try {
    const oneJadwal = await Jadwal.findById(req.params.id)
      .populate({ path: "masyarakat_id", select: "nama_masyarakat" })
      .populate({
        path: "dokter_id",
        select: "nama_dokter rating_dokter spesialis_dokter",
      });

    if (!oneJadwal) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    res.status(200).json(oneJadwal);
  } catch (error) {
    console.error("Error getbyid jadwal:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/update/:id", verifyToken, async (req, res) => {
  try {
    const updated = await Jadwal.findByIdAndUpdate(req.params.id, req.body, {
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

router.delete("/delete/:id", verifyToken, async (req, res) => {
  try {
    const deleted = await Jadwal.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    res.status(200).json({ message: "Jadwal berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/update/status/:id", verifyToken, async (req, res) => {
  try {
    const { status_konsul } = req.body;
    if (!["menunggu", "ditolak", "diterima"].includes(status_konsul)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    const updated = await Jadwal.findByIdAndUpdate(
      req.params.id,
      { status_konsul },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });

    res
      .status(200)
      .json({ message: "Status berhasil diperbarui", data: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/terima", async (req, res) => {
  const jadwalId = req.params.id;

  // Ambil data jadwal dari DB
  const jadwalData = await Jadwal.findById(jadwalId)
    .populate("dokter_id")
    .populate("masyarakat_id");

  if (!jadwalData)
    return res.status(404).json({ message: "jadwal tidak ditemukan" });

  // Update status jadwal jadi 'diterima'
  jadwalData.status_konsul = "diterima";
  await jadwalData.save();

  // Kirim pesan template ke chat system
  const pesanTemplate = "Halo, ada yang bisa dibantu?";
  await Chat.create({
    dari: jadwalData.dokter_id._id,
    ke: jadwalData.masyarakat_id._id,
    text: pesanTemplate, // ✅ ubah dari 'isi' ke 'text'
    type: "text", // ✅ WAJIB isi karena required
    role: "dokter",
    waktu: new Date(),
  });

  return res.json({ message: "jadwal diterima dan pesan dikirim." });
});

module.exports = router;
