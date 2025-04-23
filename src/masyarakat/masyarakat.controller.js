const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const masyarakat = require("./masyarakat.model");
const verifyToken = require("../middleware/verifyToken"); 
const { encrypt, decrypt } = require("../utils/encryption");

// const { encrypt } = require("../utils/encryption");
const { hashString } = require("../utils/hash");

router.post("/create", async (req, res) => {
  try {
    const {
      nama_masyarakat,
      username_masyarakat,
      password_masyarakat,
      email_masyarakat,
      nik_masyarakat,
      alamat_masyarakat,
      notlp_masyarakat,
      jeniskelamin_masyarakat,
      tgl_lahir_masyarakat,
      foto_ktp_masyarakat,
      selfie_ktp_masyarakat,
      foto_profil_masyarakat,
    } = req.body;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const nikRegex = /^\d{16}$/;

    if (!emailRegex.test(email_masyarakat)) {
      return res.status(400).json({ message: "Email tidak valid" });
    }

    if (!nikRegex.test(nik_masyarakat)) {
      return res.status(400).json({ message: "NIK harus 16 digit" });
    }

    const usernameExist = await masyarakat.exists({ username_masyarakat });
    if (usernameExist)
      return res.status(400).json({ message: "Username sudah digunakan" });

    const emailHash = hashString(email_masyarakat);
    const nikHash = hashString(nik_masyarakat);

    const emailExist = await masyarakat.exists({ email_hash: emailHash });
    if (emailExist)
      return res.status(400).json({ message: "Email sudah terdaftar" });

    const nikExist = await masyarakat.exists({ nik_hash: nikHash });
    if (nikExist)
      return res.status(400).json({ message: "NIK sudah terdaftar" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password_masyarakat, salt);

    const newUser = new masyarakat({
      nama_masyarakat,
      username_masyarakat,
      password_masyarakat: hashedPassword,
      email_masyarakat: encrypt(email_masyarakat),
      email_hash: emailHash,
      nik_masyarakat: encrypt(nik_masyarakat),
      nik_hash: nikHash,
      alamat_masyarakat: encrypt(alamat_masyarakat),
      notlp_masyarakat: encrypt(notlp_masyarakat),
      jeniskelamin_masyarakat,
      tgl_lahir_masyarakat,
      foto_ktp_masyarakat,
      selfie_ktp_masyarakat,
      foto_profil_masyarakat,
    });

    await newUser.save();
    res.status(201).json({ message: "Registrasi berhasil", user: newUser });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/getall", async (req, res) => {
  try {
      const readMasyarakat = await masyarakat.find().select("-password_masyarakat");
      if (readMasyarakat.length === 0) {
          return res.status(404).json({ message: "Tidak ada data" });
      }
      res.status(200).json(readMasyarakat);
  } catch (e) {
      res.status(500).json({ message: e.message });
  }
});

router.get("/getbyid/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await masyarakat.findById(id).select("-password_masyarakat");
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const decryptedUser = {
      ...user._doc,
      email_masyarakat: decrypt(user.email_masyarakat),
      nik_masyarakat: decrypt(user.nik_masyarakat),
      alamat_masyarakat: decrypt(user.alamat_masyarakat),
      notlp_masyarakat: decrypt(user.notlp_masyarakat),
    };

    res.status(200).json(decryptedUser);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.patch("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username_masyarakat,
      nik_masyarakat,
      email_masyarakat,
      password_masyarakat,
    } = req.body;

    const userExist = await masyarakat.exists({ _id: id });
    if (!userExist) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    if (nik_masyarakat) {
      const nikExist = await masyarakat.exists({
        nik_masyarakat,
        _id: { $ne: id },
      });
      if (nikExist) {
        return res
          .status(400)
          .json({ message: "NIK sudah terdaftar oleh pengguna lain." });
      }
    }

    if (username_masyarakat) {
      const usernameExist = await masyarakat.exists({
        username_masyarakat,
        _id: { $ne: id },
      });
      if (usernameExist) {
        return res
          .status(400)
          .json({ message: "Username sudah terdaftar oleh pengguna lain." });
      }
    }

    if (email_masyarakat) {
      const emailExist = await masyarakat.exists({
        email_masyarakat,
        _id: { $ne: id },
      });
      if (emailExist) {
        return res
          .status(400)
          .json({ message: "Email sudah terdaftar oleh pengguna lain." });
      }
    }

    if (password_masyarakat) {
      const salt = await bcrypt.genSalt(10);
      req.body.password_masyarakat = await bcrypt.hash(
        password_masyarakat,
        salt
      );
    }

    const updatedUser = await masyarakat
      .findByIdAndUpdate(id, req.body, { new: true })
      .select("-password_masyarakat");
    res.status(200).json(updatedUser);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const userExist = await masyarakat.exists({ _id: id });
    if (!userExist) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    await masyarakat.findByIdAndDelete(id);
    res.status(200).json({ message: "Data berhasil dihapus" });
  } catch (e) {
    res.status(500).json({ message: e.message });
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
