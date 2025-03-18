const express = require('express')
const router = express.Router()
const masyarakat = require('./masyarakat.model')

router.post('/create_mas', async (req, res) => {
    try {
        const newMasyarakat = new masyarakat(req.body)
        const {nik_masyarakat} = newMasyarakat

        const nikExist = await masyarakat.findOne({nik_masyarakat})
        if (nikExist){
            return res.status(400).json({message: "Sudah terdaftar."})
        }

        const savedMasyarakat = await newMasyarakat.save()
        res.status(200).json(savedMasyarakat)
    } catch (e) {
        res.status(400).json(e.message)
    }
})

module.exports = router;
