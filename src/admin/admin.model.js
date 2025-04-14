const mongoose = require("mongoose");


const superadminSchema = new mongoose.Schema({
  username_superadmin: { type: String, required: true, unique: true },
  password_superadmin: { type: String, required: true },
});

module.exports = mongoose.model("superadmin", superadminSchema, "superadmin");
