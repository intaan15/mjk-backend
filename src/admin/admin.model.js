const mongoose = require("mongoose");


const superadminSchema = new mongoose.Schema({
  username_superadmin: { type: String, required: true, unique: true },
  password_superadmin: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "dokter", "masyarakat"],
    default: "admin",
  },
});

module.exports = mongoose.model("superadmin", superadminSchema, "superadmin");
