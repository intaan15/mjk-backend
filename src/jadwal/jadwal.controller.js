const express = require("express");
const router = express.Router();
const Jadwal = require("./jadwal.model"); 
const verifyToken = require("../middleware/verifyToken");
const Chat = require("../socket/chat.model");
const ChatList = require("../socket/chatlist.model");
const {createLimiter} = require("../middleware/ratelimiter"); 
const masyarakatAuthorization = require("../middleware/masyarakatAuthorization");
const dokterAuthorization = require("../middleware/dokterAuthorization");

// Create jadwal baru
router.post("/create", createLimiter, masyarakatAuthorization, async (req, res) => {
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

// Get all jadwal dengan populate dokter dan masyarakat
router.get("/getall", verifyToken, async (req, res) => {
  try {
    const allJadwal = await Jadwal.find()
      .populate({
        path: "masyarakat_id",
        select: "nama_masyarakat foto_profil_masyarakat", // ✅ TAMBAHKAN foto_profil_masyarakat
      })
      .populate({
        path: "dokter_id",
        select: "nama_dokter rating_dokter spesialis_dokter foto_profil_dokter", // ✅ TAMBAHKAN foto_profil_dokter
      })
      .sort({ createdAt: -1 });
    if (allJadwal.length > 0) {
      if (allJadwal[0].masyarakat_id) {
      }
      if (allJadwal[0].dokter_id) {
      }
    }

    res.status(200).json(allJadwal);
  } catch (error) {
    console.log("Error getall jadwal:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get jadwal by ID dengan populate dokter dan masyarakat
router.get("/getbyid/:id", verifyToken, async (req, res) => {
  try {
    const oneJadwal = await Jadwal.findById(req.params.id)
      .populate({
        path: "masyarakat_id",
        select: "nama_masyarakat foto_profil_masyarakat",
      })
      .populate({
        path: "dokter_id",
        select: "nama_dokter rating_dokter spesialis_dokter foto_profil_dokter",
      });

    if (!oneJadwal)
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });

    res.status(200).json(oneJadwal);
  } catch (error) {
    console.log("Error getbyid jadwal:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update jadwal by ID
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

// Delete jadwal by ID
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

// Update status jadwal by ID (validasi status)
router.patch("/update/status/:id", dokterAuthorization, async (req, res) => {
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

// Terima jadwal + kirim pesan template + update chatlist
router.post("/:id/terima", dokterAuthorization, async (req, res) => {
  try {
    const jadwalId = req.params.id;
    console.log("Menerima jadwal dengan ID:", jadwalId);

    // 1. Ambil data jadwal + populate dokter & masyarakat
    const jadwalData = await Jadwal.findById(jadwalId)
      .populate("dokter_id")
      .populate("masyarakat_id");

    if (!jadwalData) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    const dokter = jadwalData.dokter_id;
    const masyarakat = jadwalData.masyarakat_id;

    if (!dokter || !masyarakat) {
      return res
        .status(400)
        .json({ message: "Data dokter atau masyarakat tidak lengkap" });
    }

    const dokterId = dokter._id;
    const masyarakatId = masyarakat._id;
    const pesanTemplate = "Halo, ada yang bisa dibantu?";

    // 2. Update status jadwal
    jadwalData.status_konsul = "diterima";
    await jadwalData.save();

    // 3. Simpan pesan pertama
    await Chat.create({
      senderId: dokterId,
      receiverId: masyarakatId,
      text: pesanTemplate,
      type: "text",
      role: "dokter",
      waktu: new Date(),
    });

    // 4. Buat atau update ChatList
    const participantQuery = [
      { user: dokterId, role: "Dokter" },
      { user: masyarakatId, role: "Masyarakat" },
    ];

    let chatlist = await ChatList.findOne({
      "participants.user": { $all: [dokterId, masyarakatId] },
    });

    if (!chatlist) {
      chatlist = await ChatList.create({
        participants: participantQuery,
        lastMessage: pesanTemplate,
        lastMessageDate: new Date(),
        unreadCount: {
          [dokterId.toString()]: 0,
          [masyarakatId.toString()]: 1,
        },
      });
    } else {
      chatlist.lastMessage = pesanTemplate;
      chatlist.lastMessageDate = new Date();

      // Update unreadCount
      const currentUnread =
        chatlist.unreadCount.get(masyarakatId.toString()) || 0;
      chatlist.unreadCount.set(masyarakatId.toString(), currentUnread + 1);

      await chatlist.save();
    }

    return res.json({
      message: "Jadwal diterima, pesan dikirim, dan chatlist diperbarui.",
    });
  } catch (error) {
    console.log("Error terima jadwal:", error);
    return res.status(500).json({ message: "Gagal menerima jadwal" });
  }
});

module.exports = router;
