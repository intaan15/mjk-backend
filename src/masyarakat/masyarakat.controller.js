const express = require('express')
const router = express.Router()
const masyarakat = require('./masyarakat.model')

router.post('/create_masyarakat', async (req, res) => {
    try {
        const newMasyarakat = new masyarakat(req.body)
        const {nik_masyarakat} = newMasyarakat

        const nikExist = await masyarakat.findOne({nik_masyarakat})
        if (nikExist){
            return res.status(400).json({message: "Sudah terdaftar."})
        }
        newMasyarakat.save()
            .then((result) => {
                res.status(200).json(result);
            })
            .catch((err) => {
                console.log("Gagal menyimpan data:", err);
                res.status(500).json(err);
            });
    } catch (e) {
        res.status(400).json(e.message)
    }
})

module.exports = router;
