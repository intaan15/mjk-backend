const mongoose = require("mongoose");

const dokterSchema = new mongoose.Schema({
    nama_dokter: {
        type: String,
        required: true,
    },
    username_dokter: {
        type: String,
        required: true,
    },
    password_dokter: {
        type: String,
        required: true,
    },
    email_dokter: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, "Email tidak valid"],
    },
    spesialis_dokter: {
        type: String,
        required: true,
    },
    notlp_dokter: {
        type: String,
        required: true,
    },
    str_dokter: {
        type: String,
        required: true,
    },
    rating_dokter: {
        type: Float64Array,
        required: true,
    },
    foto_profil_dokter: {
        type: String,
        required: false,
    },
})