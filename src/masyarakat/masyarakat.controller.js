const express = require('express')
const router = express.Router()
const masyarakat = require('./masyarakat.model')

router.post('/create', async (req, res) => {
    try {
        const newMasyarakat = new masyarakat(req.body)
        const { nik_masyarakat } = newMasyarakat

        const nikExist = await masyarakat.findOne({ nik_masyarakat })
        if (nikExist) {
            return res.status(400).json({ message: "Sudah terdaftar." })
        }
        newMasyarakat.save()
            .then((result) => {
                res.status(200).json(result);
            })
            .catch((err) => {
                res.status(500).json(err);
            });
    } catch (e) {
        res.status(400).json(e.message)
    }
})

router.get('/getall', async (req, res, next) => {
    try {
        const readMasyarakat = await masyarakat.find()
        if (readMasyarakat.length === 0) {
            return res.status(404).json({ message: "Data tidak ditemukan" })
        }
        res.status(200).json(readMasyarakat)
    } catch (e) {
        res.status(400).json(e.message)
    }
})

module.exports = router;
