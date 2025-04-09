const express = require('express')
const app = express()
const mongoose = require('mongoose')
const http = require('http').Server(app)
const cors = require('cors')
const dotenv = require('dotenv')
const bodyparser = require('body-parser')
dotenv.config()
const PORT = process.env.PORT
const MONGO_URL = process.env.MONGO_URL

mongoose.connect(MONGO_URL).then(()=>{
    console.log('databes konek')
    app.listen(PORT, ()=>{
        console.log('server port = ' + PORT)
    })
}).catch((error)=>console.log(error))

app.use(express.urlencoded({extended : true}))
app.use(bodyparser.urlencoded({extended : true}))
app.use(express.json())
app.use(bodyparser.json())
app.use(cors())

const masyarakatController = require('./masyarakat/masyarakat.controller')
const authController = require('./auth/auth.controller')
const dokterController = require('./dokter/dokter.controller')
const artikelController = require('./artikel/artikel.controller')
const ratingController = require('./rating/rating.controller')
const jadwalController = require('./jadwal/jadwal.controller');
const verifikasiController = require('./verifikasi/verifikasi.controller');

app.use('/api/masyarakat', masyarakatController)
app.use('/api/auth', authController)
app.use('/api/dokter', dokterController)
app.use('/api/artikel', artikelController)
app.use('/api/rating', ratingController)
app.use("/api/jadwal", jadwalController);
app.use("/api/verifikasi", verifikasiController);