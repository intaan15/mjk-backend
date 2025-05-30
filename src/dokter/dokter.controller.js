const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const Dokter = require("./dokter.model");
const { encrypt, decrypt } = require("../utils/encryption");
const mongoose = require("mongoose");
const { hashString } = require("../utils/hash");
const multer = require("multer");
const path = require("path");
const dokterAuthorization = require("../middleware/dokterAuthorization");
const masyarakatAuthorization = require("../middleware/masyarakatAuthorization");
const adminAuthorization = require("../middleware/adminAuthorization");
const verifyToken = require("../middleware/verifyToken");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/images/");
  },
  filename: function (req, file, cb) {
    const originalName = file.originalname;
    const sanitized = originalName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.\-]/g, "");

    const uniqueName = Date.now() + "-" + sanitized;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.post("/upload", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const dokterId = req.body.id;

    if (!req.file) {
      return res.status(400).json({ error: "File tidak ditemukan" });
    }

    const filePath = `/images/${req.file.filename}`;

    const updated = await Dokter.findByIdAndUpdate(dokterId, {
      foto_profil_dokter: filePath,
    });

    if (!updated) {
      return res.status(404).json({ error: "Dokter tidak ditemukan" });
    }

    res.status(200).json({ message: "Upload berhasil", path: filePath });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload gagal" });
  }
});

router.post("/create", adminAuthorization, async (req, res, next) => {
  try {
    const {
      nama_dokter,
      username_dokter,
      password_dokter,
      email_dokter,
      spesialis_dokter,
      notlp_dokter,
      str_dokter,
      rating_dokter,
      foto_profil_dokter,
    } = req.body;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email_dokter)) {
      return res.status(400).json({ message: "Email tidak valid" });
    }

    if (await Dokter.exists({ username_dokter })) {
      return res.status(400).json({ message: "Username sudah digunakan" });
    }

    if (await Dokter.exists({ str_dokter })) {
      return res.status(400).json({ message: "STR sudah terdaftar" });
    }

    const allDokter = await Dokter.find(); // Ambil semua dokter
    const emailAlreadyUsed = allDokter.some((dok) => {
      try {
        return decrypt(dok.email_dokter) === email_dokter;
      } catch (e) {
        return false;
      }
    });

    if (emailAlreadyUsed) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    const hashedPassword = await bcrypt.hash(password_dokter, 10);

    const newDokter = new Dokter({
      nama_dokter,
      username_dokter,
      password_dokter: hashedPassword,
      email_dokter: encrypt(email_dokter),
      spesialis_dokter,
      notlp_dokter: encrypt(notlp_dokter),
      str_dokter,
      rating_dokter:
        rating_dokter >= 0 && rating_dokter <= 5 ? rating_dokter : 0,
      foto_profil_dokter,
    });

    await newDokter.save();
    res.status(201).json({
      message: "Dokter berhasil didaftarkan",
      dokter: newDokter,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/getall", verifyToken, async (req, res, next) => {
  try {
    const dokterList = await Dokter.find().select("-password_dokter");

    // Lakukan dekripsi pada tiap objek dokter
    const decryptedList = dokterList.map((dokter) => {
      return {
        ...dokter._doc,
        email_dokter: decrypt(dokter.email_dokter),
        notlp_dokter: decrypt(dokter.notlp_dokter),
      };
    });

    res.status(200).json(decryptedList);
  } catch (e) {
    next(e);
  }
});


router.get("/getbyid/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Dokter.findById(id).select("-password_dokter");
    if (!user)
      return res.status(404).json({ message: "Dokter tidak ditemukan" });

    const decryptedUser = {
      ...user._doc,
      email_dokter: decrypt(user.email_dokter),
      notlp_dokter: decrypt(user.notlp_dokter),
    };

    res.status(200).json(decryptedUser);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/getbyname/:doctorName", verifyToken, async (req, res) => {
  try {
    const { doctorName } = req.params;

    const dokter = await Dokter.findOne({ nama_dokter: doctorName }).select(
      "-password_dokter"
    );

    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }

    const decryptedUser = {
      ...dokter._doc,
      email_dokter: decrypt(dokter.email_dokter),
      notlp_dokter: decrypt(dokter.notlp_dokter),
    };

    res.status(200).json(decryptedUser);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.patch("/update/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      username_dokter,
      email_dokter,
      str_dokter,
      password_dokter,
      rating_dokter,
      notlp_dokter,
    } = req.body;

    const dokterExist = await Dokter.findById(id);
    if (!dokterExist) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    if (username_dokter) {
      const usernameExist = await Dokter.exists({
        username_dokter,
        _id: { $ne: id },
      });
      if (usernameExist) {
        return res
          .status(400)
          .json({ message: "Username sudah digunakan oleh pengguna lain" });
      }
    }

    if (str_dokter) {
      const strExist = await Dokter.exists({
        str_dokter,
        _id: { $ne: id },
      });
      if (strExist) {
        return res
          .status(400)
          .json({ message: "STR sudah terdaftar oleh pengguna lain" });
      }
    }

    if (email_dokter) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email_dokter)) {
        return res.status(400).json({ message: "Email tidak valid" });
      }

      const allDokter = await Dokter.find({ _id: { $ne: id } });
      const emailExist = allDokter.some((dok) => {
        try {
          return decrypt(dok.email_dokter) === email_dokter;
        } catch (e) {
          return false;
        }
      });

      if (emailExist) {
        return res
          .status(400)
          .json({ message: "Email sudah digunakan oleh pengguna lain" });
      }

      req.body.email_dokter = encrypt(email_dokter);
    }

    if (notlp_dokter) {
      req.body.notlp_dokter = encrypt(notlp_dokter);
    }

    if (password_dokter) {
      req.body.password_dokter = await bcrypt.hash(password_dokter, 10);
    }

    if (rating_dokter !== undefined) {
      req.body.rating_dokter =
        rating_dokter >= 0 && rating_dokter <= 5 ? rating_dokter : 0;
    }

    const updatedDokter = await Dokter.findByIdAndUpdate(id, req.body, {
      new: true,
    }).select("-password_dokter");

    res.status(200).json(updatedDokter);
  } catch (e) {
    next(e);
  }
});

router.delete("/delete/:id", verifyToken, async (req, res, next) => {
  try {
    const deletedDokter = await Dokter.findByIdAndDelete(req.params.id);
    if (!deletedDokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }
    res.status(200).json({ message: "Dokter berhasil dihapus" });
  } catch (e) {
    next(e);
  }
});

router.patch("/ubah-password", dokterAuthorization, async (req, res) => {
  try {
    const { password_lama, password_baru, konfirmasi_password_baru } = req.body;

    if (!password_lama || !password_baru || !konfirmasi_password_baru) {
      return res.status(400).json({ message: "Semua field harus diisi" });
    }

    if (password_baru !== konfirmasi_password_baru) {
      return res
        .status(400)
        .json({ message: "Konfirmasi password tidak cocok" });
    }

    const user = await Dokter.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const validPassword = await bcrypt.compare(
      password_lama,
      user.password_dokter
    );
    if (!validPassword) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password_baru, salt);

    user.password_dokter = hashedPassword;
    await user.save();
    res.status(200).json({ message: "Password berhasil diubah" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// jadwal dokter
router.get("/jadwal/:dokterId", verifyToken, async (req, res) => {
  try {
    const { dokterId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(dokterId)) {
      return res.status(400).json({ message: "ID dokter tidak valid" });
    }
    const dokter = await Dokter.findById(dokterId).select("jadwal");
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }
    res.status(200).json(dokter.jadwal);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// router.post("/jadwal/:dokterId", verifyToken, async (req, res) => {
//   try {
//     const { dokterId } = req.params;
//     const { tanggal, jam_mulai, jam_selesai } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(dokterId)) {
//       return res.status(400).json({ message: "ID dokter tidak valid" });
//     }
//     const dokter = await Dokter.findById(dokterId);
//     if (!dokter) {
//       return res.status(404).json({ message: "Dokter tidak ditemukan" });
//     }

//     dokter.jadwal.push({ tanggal, jam_mulai, jam_selesai });
//     await dokter.save();

//     res
//       .status(201)
//       .json({ message: "Jadwal berhasil ditambahkan", jadwal: dokter.jadwal });
//   } catch (e) {
//     res.status(500).json({ message: e.message });
//   }
// });

router.patch("/jadwal/:dokterId/:jadwalId", verifyToken, async (req, res) => {
  try {
    const { dokterId, jadwalId } = req.params;
    const { tanggal, jam_mulai, jam_selesai } = req.body;

    const dokter = await Dokter.findById(dokterId);
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }

    const jadwal = dokter.jadwal.id(jadwalId);
    if (!jadwal) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan" });
    }

    if (tanggal) jadwal.tanggal = tanggal;
    if (jam_mulai) jadwal.jam_mulai = jam_mulai;
    if (jam_selesai) jadwal.jam_selesai = jam_selesai;

    await dokter.save();
    res.status(200).json({ message: "Jadwal berhasil diupdate", jadwal });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

function generateSlots(start, end, interval = 1) {
  const slots = [];
  let [hour, minute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  let currentTimeInMinutes = hour * 60 + minute;
  const endTimeInMinutes = endHour * 60 + endMinute;

  while (currentTimeInMinutes <= endTimeInMinutes) {
    const slotHour = Math.floor(currentTimeInMinutes / 60);
    const slotMinute = currentTimeInMinutes % 60;
    const time = `${slotHour.toString().padStart(2, "0")}:${slotMinute
      .toString()
      .padStart(2, "0")}`;
    slots.push({ time, available: true });
    currentTimeInMinutes += interval;
  }
  return slots;
}

router.post("/jadwal/add/:dokterId", dokterAuthorization, async (req, res) => {
  try {
    const { dokterId } = req.params;
    const { tanggal, jam_mulai, jam_selesai } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dokterId)) {
      return res.status(400).json({ message: "ID dokter tidak valid" });
    }
    const dokter = await Dokter.findById(dokterId);
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }
    const slots = generateSlots(jam_mulai, jam_selesai);
    dokter.jadwal.push({
      tanggal,
      jam: slots,
    });

    await dokter.save();
    res
      .status(201)
      .json({ message: "Jadwal berhasil ditambahkan", data: dokter.jadwal });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
});

router.patch("/:dokterId/jadwal/update", dokterAuthorization, async (req, res) => {
  const { dokterId } = req.params;
  const { tanggal, jam_mulai, jam_selesai, interval = 1 } = req.body;

  try {
    if (!tanggal || !jam_mulai || !jam_selesai) {
      return res.status(400).json({
        success: false,
        message: "Tanggal, jam_mulai, dan jam_selesai harus diisi",
      });
    }

    const dokter = await Dokter.findById(dokterId);
    if (!dokter) {
      return res.status(404).json({
        success: false,
        message: "Dokter tidak ditemukan",
      });
    }

    const targetDate = new Date(tanggal);
    const jadwalIndex = dokter.jadwal.findIndex((j) => {
      const jadwalDate = new Date(j.tanggal);
      return (
        jadwalDate.toISOString().slice(0, 10) ===
        targetDate.toISOString().slice(0, 10)
      );
    });

    if (jadwalIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Jadwal pada tanggal tersebut tidak ditemukan",
      });
    }

    const newSlots = [];
    const [startH, startM] = jam_mulai.split(":").map(Number);
    const [endH, endM] = jam_selesai.split(":").map(Number);

    let currentH = startH;
    let currentM = startM;
    let currentInMinutes = startH * 60 + startM;
    let endInMinutes = endH * 60 + endM;

    while (currentInMinutes + interval <= endInMinutes || currentInMinutes <= endInMinutes) {
      newSlots.push({
        time: `${Math.floor(currentInMinutes / 60).toString().padStart(2, '0')}:${(currentInMinutes % 60).toString().padStart(2, '0')}`,
        available: true
      });

      currentInMinutes += interval;
    }

    dokter.jadwal[jadwalIndex].jam = newSlots;
    await dokter.save();
    return res.status(200).json({
      success: true,
      message: "Jadwal berhasil diperbarui",
      data: dokter.jadwal[jadwalIndex],
    });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
});

router.patch("/jadwal/:dokterId/jam/:jamId", masyarakatAuthorization, async (req, res) => {
  const { dokterId, jamId } = req.params;
  const { tanggal, jam_mulai, jam_selesai } = req.body;

  try {
    const dokter = await Dokter.findById(dokterId);
    if (!dokter) return res.status(404).json({ message: "Dokter tidak ditemukan" });

    const jadwal = dokter.jadwal.find(j => {
      const tgl = new Date(j.tanggal).toISOString().split("T")[0];
      const targetTgl = new Date(tanggal).toISOString().split("T")[0];
      return tgl === targetTgl;
    });

    if (!jadwal) return res.status(404).json({ message: "Jadwal tidak ditemukan" });

    const jamItem = jadwal.jam.find(j => j._id.toString() === jamId);
    if (!jamItem) return res.status(404).json({ message: "Jam tidak ditemukan" });

    jamItem.available = false;

    await dokter.save();
    return res.status(200).json({ message: "Jadwal diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
});

router.delete("/jadwal/hapus/:dokterId", dokterAuthorization, async (req, res) => {
  try {
    const { dokterId } = req.params;
    const { tanggal } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dokterId)) {
      return res.status(400).json({
        success: false,
        message: "ID Dokter tidak valid"
      });
    }

    if (!tanggal) {
      return res.status(400).json({
        success: false,
        message: "Parameter tanggal diperlukan"
      });
    }

    const targetDate = new Date(tanggal);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Format tanggal tidak valid"
      });
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    console.log('Rentang tanggal untuk penghapusan:', {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    });

    const dokter = await Dokter.findOne({
      _id: dokterId,
      'jadwal.tanggal': {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    if (!dokter) {
      return res.status(404).json({
        success: false,
        message: `Tidak ada jadwal pada tanggal ${targetDate.toLocaleDateString('id-ID')} untuk dihapus`
      });
    }

    const result = await Dokter.findByIdAndUpdate(
      dokterId,
      {
        $pull: {
          jadwal: {
            tanggal: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          }
        }
      },
      { new: true }
    );

    const jadwalTerhapus = dokter.jadwal.filter(j => {
      const jadwalDate = new Date(j.tanggal);
      return jadwalDate >= startOfDay && jadwalDate <= endOfDay;
    });

    if (jadwalTerhapus.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Tidak ada jadwal pada tanggal ${targetDate.toLocaleDateString('id-ID')} untuk dihapus`
      });
    }

    const formattedDate = targetDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    res.status(200).json({
      success: true,
      message: `Jadwal pada tanggal ${formattedDate} berhasil dihapus`,
      data: {
        deletedCount: jadwalTerhapus.length,
        deletedSchedules: jadwalTerhapus
      }
    });

  } catch (error) {
    console.error('Error saat menghapus jadwal:', error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
module.exports = router;