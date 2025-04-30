const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const Dokter = require("./dokter.model");
const verifyToken = require("../middleware/verifyToken");
const { encrypt, decrypt } = require("../utils/encryption");
const mongoose = require("mongoose");

// const { encrypt } = require("../utils/encryption");
const { hashString } = require("../utils/hash");

router.post("/create", async (req, res, next) => {
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


router.get("/getall", async (req, res, next) => {
  try {
    const dokterList = await Dokter.find().select("-password_dokter -email_dokter -notlp_dokter");
    res.status(200).json(dokterList);
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

router.get("/getbyname/:doctorName", async (req, res) => {
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

router.patch("/update/:id", async (req, res, next) => {
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



router.delete("/delete/:id", async (req, res, next) => {
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

router.patch("/ubah-password", verifyToken, async (req, res) => {
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
router.get("/jadwal/:dokterId", async (req, res) => {
  try {
    const { dokterId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(dokterId)) {
      return res.status(400).json({ message: "ID dokter tidak valid" });
    }
    console.log("doctorId:", dokterId);  
    const dokter = await Dokter.findById(dokterId).select("jadwal");
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }
    res.status(200).json(dokter.jadwal);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/jadwal/:dokterId", async (req, res) => {
  try {
    const { dokterId } = req.params;
    const { tanggal, jam_mulai, jam_selesai } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dokterId)) {
      return res.status(400).json({ message: "ID dokter tidak valid" });
    }
    console.log("doctorId:", dokterId);  
    const dokter = await Dokter.findById(doctorObjectId);
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }

    dokter.jadwal.push({ tanggal, jam_mulai, jam_selesai });
    await dokter.save();

    res.status(201).json({ message: "Jadwal berhasil ditambahkan", jadwal: dokter.jadwal });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


router.patch("/jadwal/:dokterId/:jadwalId", async (req, res) => {
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

router.delete("/jadwal/:dokterId/:jadwalId", async (req, res) => {
  try {
    const { dokterId, jadwalId } = req.params;

    const dokter = await Dokter.findById(dokterId);
    if (!dokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }

    dokter.jadwal = dokter.jadwal.filter((jadwal) => jadwal.id !== jadwalId);
    await dokter.save();

    res.status(200).json({ message: "Jadwal berhasil dihapus" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

function generateSlots(start, end, interval = 30) {
  const slots = [];
  let [hour, minute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  while (hour < endHour || (hour === endHour && minute < endMinute)) {
    const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    slots.push({ time, available: true });
    minute += interval;
    if (minute >= 60) {
      minute -= 60;
      hour++;
    }
  }
  return slots;
}

router.post("/jadwal/add/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { tanggal, jam_mulai, jam_selesai } = req.body;

    const dokter = await Dokter.findById(doctorId);
    if (!dokter) return res.status(404).json({ message: "Dokter tidak ditemukan" });

    const slots = generateSlots(jam_mulai, jam_selesai);
    dokter.jadwal.push({ tanggal, slots });

    await dokter.save();
    res.status(201).json({ message: "Jadwal berhasil ditambahkan", data: dokter.jadwal });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;