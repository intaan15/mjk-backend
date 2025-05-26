const express = require("express");
const router = express.Router();
const Jadwal = require("./jadwal.model"); // model Jadwal
const verifyToken = require("../middleware/verifyToken");
const Chat = require("../socket/chat.model");
const ChatList = require("../socket/chatlist.model"); // import model ChatList

// Create jadwal baru
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

// Get all jadwal dengan populate dokter dan masyarakat
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

// Get jadwal by ID dengan populate dokter dan masyarakat
router.get("/getbyid/:id", verifyToken, async (req, res) => {
  try {
    const oneJadwal = await Jadwal.findById(req.params.id)
      .populate({ path: "masyarakat_id", select: "nama_masyarakat" })
      .populate({
        path: "dokter_id",
        select: "nama_dokter rating_dokter spesialis_dokter",
      });

    if (!oneJadwal)
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });

    res.status(200).json(oneJadwal);
  } catch (error) {
    console.error("Error getbyid jadwal:", error);
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

// Terima jadwal + kirim pesan template + update chatlist
router.post("/:id/terima", verifyToken, async (req, res) => {
  try {
    const jadwalId = req.params.id;
    console.log("Menerima jadwal dengan ID:", jadwalId);

    // 1. Ambil data jadwal
    const jadwalData = await Jadwal.findById(jadwalId)
      .populate("dokter_id")
      .populate("masyarakat_id");

    if (!jadwalData) {
      console.log("Jadwal tidak ditemukan");
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    console.log("Jadwal ditemukan:", jadwalData);

    // 2. Update status jadwal jadi 'diterima'
    jadwalData.status_konsul = "diterima";
    await jadwalData.save();
    console.log("Status jadwal diupdate ke 'diterima'");

    const dokterId = jadwalData.dokter_id._id.toString();
    const masyarakatId = jadwalData.masyarakat_id._id.toString();
    const pesanTemplate = "Halo, ada yang bisa dibantu?";

    // 3. Simpan pesan pertama ke koleksi Chat
    console.log("Menyimpan chat pertama...");
    await Chat.create({
      senderId: dokterId,
      receiverId: masyarakatId,
      text: pesanTemplate,
      type: "text",
      role: "dokter",
      waktu: new Date(),
    });
    console.log("Chat berhasil disimpan");

    // 4. Buat atau update ChatList
    console.log("Mencari chatlist antara:", dokterId, masyarakatId);
    let chatlist = await ChatList.findOne({
      participants: { $all: [dokterId, masyarakatId] },
    });

    if (!chatlist) {
      console.log("Chatlist belum ada, membuat baru...");
      chatlist = await ChatList.create({
        participants: [dokterId, masyarakatId],
        lastMessage: pesanTemplate,
        lastMessageDate: new Date(),
        unreadCount: {
          [dokterId]: 0,
          [masyarakatId]: 1,
        },
      });
      console.log("Chatlist baru berhasil dibuat");
    } else {
      console.log("Chatlist ditemukan, update lastMessage dan unreadCount");
      chatlist.lastMessage = pesanTemplate;
      chatlist.lastMessageDate = new Date();
      const currentUnread = chatlist.unreadCount.get(masyarakatId) || 0;
      chatlist.unreadCount.set(masyarakatId, currentUnread + 1);
      await chatlist.save();
      console.log("Chatlist berhasil diupdate");
    }

    return res.json({
      message: "Jadwal diterima, pesan dikirim, dan chatlist diperbarui.",
    });
  } catch (error) {
    console.error("Error terima jadwal:", error);
    return res.status(500).json({ message: "Gagal menerima jadwal" });
  }
});


module.exports = router;
