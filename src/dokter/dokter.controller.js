const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const dokter = require("./dokter.model");

router.post("/create", async (req, res) => {
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

    const usernameExist = await dokter.findOne({ username_dokter });
    if (usernameExist)
      return res.status(400).json({ message: "Username sudah digunakan" });

    const strExist = await dokter.findOne({ str_dokter });
    if (strExist)
      return res.status(400).json({ message: "STR sudah terdaftar" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password_dokter, salt);

    const newDokter = new Dokter({
      nama_dokter,
      username_dokter,
      password_dokter: hashedPassword,
      email_dokter,
      spesialis_dokter,
      notlp_dokter,
      str_dokter,
      rating_dokter,
      foto_profil_dokter,
    });

    await newDokter.save();
    res.status(201).json({ message: "Dokter berhasil didaftarkan" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Read (Get All Dokter)
router.get("/getall", async (req, res) => {
  try {
    const dokterList = await dokter.find();
    res.status(200).json(dokterList);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Read (Get Dokter by ID)
router.get("/getbyid/:id", async (req, res) => {
  try {
    const dokter = await dokter.findById(req.params.id);
    if (!dokter)
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    res.status(200).json(dokter);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/update/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { str_dokter, password_dokter } = req.body;

        const userExist = await dokter.exists({ _id: id });
        if (!userExist) {
            return res.status(404).json({ message: "Data tidak ditemukan" });
        }

        if (str_dokter) {
            const strExist = await dokter.exists({ str_dokter, _id: { $ne: id } });
            if (strExist) {
                return res.status(400).json({ message: "STR sudah terdaftar oleh pengguna lain." });
            }
        }

        if (password_dokter) {
            const salt = await bcrypt.genSalt(10);
            req.body.password_dokter = await bcrypt.hash(password_dokter, salt);
        }

        const updatedUser = await dokter.findByIdAndUpdate(id, req.body, { new: true }).select("-password_dokter");
        res.status(200).json(updatedUser);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});


// Delete Dokter
router.delete("/delete/:id", async (req, res) => {
  try {
    const deletedDokter = await dokter.findByIdAndDelete(req.params.id);
    if (!deletedDokter) {
      return res.status(404).json({ message: "Dokter tidak ditemukan" });
    }
    res.status(200).json({ message: "Dokter berhasil dihapus" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
