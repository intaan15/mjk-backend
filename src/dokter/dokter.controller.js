const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const Dokter = require("./dokter.model");
const verifyToken = require("../middleware/verifyToken"); 
const { encrypt, decrypt } = require("../utils/encryption");

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

    const emailHash = hashString(email_dokter);

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    // Validasi data unik
    if (await Dokter.exists({ username_dokter })) {
      return res.status(400).json({ message: "Username sudah digunakan" });
    }

    if (await Dokter.exists({ str_dokter })) {
      return res.status(400).json({ message: "STR sudah terdaftar" });
    }

    if (await Dokter.exists({ email_hash: emailHash })) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    if (!emailRegex.test(email_dokter)) {
      return res.status(400).json({ message: "Email tidak valid" });
    }

    const hashedPassword = await bcrypt.hash(password_dokter, 10);

    const newDokter = new Dokter({
      nama_dokter,
      username_dokter,
      password_dokter: hashedPassword,
      email_dokter: encrypt(email_dokter),
      email_hash: emailHash,
      spesialis_dokter,
      notlp_dokter: encrypt(notlp_dokter),
      str_dokter,
      rating_dokter:
        rating_dokter >= 0 && rating_dokter <= 5 ? rating_dokter : 0,
      foto_profil_dokter,
    });

    await newDokter.save();
    res
      .status(201)
      .json({ message: "Dokter berhasil didaftarkan", dokter: newDokter });
  } catch (e) {
    next(e);
  }
});

router.get("/getall", async (req, res, next) => {
  try {
    const dokterList = await Dokter.find().select("-password_dokter");
    res.status(200).json(dokterList);
  } catch (e) {
    next(e);
  }
});

router.get("/getbyid/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await masyarakat.findById(id).select("-password_dokter");
    if (!user) return res.status(404).json({ message: "Dokter tidak ditemukan" });

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

router.patch("/update/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { str_dokter, password_dokter, rating_dokter } = req.body;

    if (!(await Dokter.exists({ _id: id }))) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    if (username_dokter) {
        const usernameExist = await masyarakat.exists({ username_dokter, _id: { $ne: id } });
        if (usernameExist) { return res.status(400).json({ message: "Username sudah terdaftar oleh pengguna lain." }) }
    }

    if (str_dokter) {
      const strExist = await Dokter.exists({ str_dokter, _id: { $ne: id } });
      if (strExist) { return res.status(400).json({ message: "STR sudah terdaftar oleh pengguna lain." }) }
    }    

    if (email_dokter) {
      const emailExist = await Dokter.exists({ email_dokter, _id: { $ne: id } });
      if (emailExist) { return res.status(400).json({ message: "Email sudah terdaftar oleh pengguna lain." }) }
    }    

    if (password_dokter) {
      req.body.password_dokter = await bcrypt.hash(password_dokter, 10);
    }
    
    if (rating_dokter) {
      req.body.rating_dokter = rating_dokter >= 0 && rating_dokter <= 5 ? rating_dokter : 0
    }

    const updatedDokter = await Dokter.findByIdAndUpdate(id, req.body, { new: true }).select("-password_dokter");
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
      return res.status(400).json({ message: "Konfirmasi password tidak cocok" });
    }

    const user = await masyarakat.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const validPassword = await bcrypt.compare(password_lama, user.password_masyarakat);
    if (!validPassword) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password_baru, salt);

    user.password_masyarakat = hashedPassword;
    await user.save();
    res.status(200).json({ message: "Password berhasil diubah" });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
module.exports = router;
