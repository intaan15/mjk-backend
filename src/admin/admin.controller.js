const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const admin = require("./admin.model");
const verifyToken = require("../middleware/verifyToken");
const { encrypt, decrypt } = require("../utils/encryption");
const mongoose = require("mongoose");
const { hashString } = require("../utils/hash");
const multer = require("multer");
const path = require("path");

router.post("/create", async (req, res, next) => {
  try {
    const { username_superadmin, password_superadmin } = req.body;

    if (await admin.exists({ username_superadmin })) {
      return res.status(400).json({ message: "Username sudah digunakan" });
    }

    const hashedPassword = await bcrypt.hash(password_superadmin, 13);

    const newAdmin = new admin({
      username_superadmin,
      password_superadmin: hashedPassword,
    });

    await newAdmin.save();
    res.status(201).json({
      message: "Admin berhasil didaftarkan",
      admin: newAdmin,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/getall", async (req, res, next) => {
  try {
    const adminList = await admin.find().select("");
    res.status(200).json(adminList);
  } catch (e) {
    next(e);
  }
});

router.get("/getbyid/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await admin.findById(id).select("");
    if (!user)
      return res.status(404).json({ message: "Admin tidak ditemukan" });

    res.status(200).json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/getbyname/:adminName", async (req, res) => {
  try {
    const { adminName } = req.params;

    const adminData = await admin
      .findOne({ nama_superadmin: adminName })
      .select("-password_superadmin");

    if (!adminData) {
      return res.status(404).json({ message: "Admin tidak ditemukan" });
    }

    res.status(200).json(adminData);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.patch("/update/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username_superadmin } = req.body;

    const adminExist = await admin.findById(id);
    if (!adminExist) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    if (username_superadmin) {
      const usernameExist = await admin.exists({
        username_superadmin,
        _id: { $ne: id },
      });
      if (usernameExist) {
        return res
          .status(400)
          .json({ message: "Username sudah digunakan oleh pengguna lain" });
      }
    }

    const updatedAdmin = await admin
      .findByIdAndUpdate(id, req.body, {
        new: true,
      })
      .select("-password_superadmin");

    res.status(200).json(updatedAdmin);
  } catch (e) {
    next(e);
  }
});

router.delete("/delete/:id", async (req, res, next) => {
  try {
    const deletedAdmin = await admin.findByIdAndDelete(req.params.id);
    if (!deletedAdmin) {
      return res.status(404).json({ message: "Admin tidak ditemukan" });
    }
    res.status(200).json({ message: "Admin berhasil dihapus" });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
