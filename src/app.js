const express = require('express')
const app = express()
const mongoose = require('mongoose')
const http = require('http').Server(app)
const cors = require('cors')
const dotenv = require('dotenv')
const bodyparser = require('body-parser')
app.use(bodyparser.json())
dotenv.config()
const PORT = process.env.PORT || 5000
const MONGO_URL = process.env.MONGO_URL

mongoose.connect(MONGO_URL).then(()=>{
    console.log('databes konek')
    app.listen(PORT, ()=>{
        console.log('server port = ' + PORT)
    })
}).catch((error)=>console.log(error))

// app.use(express.urlencoded({extended : true}))
app.use(express.json())
app.use(cors())

const masyarakatController = require('./masyarakat/masyarakat.controller')

app.use('/api/masyarakat', masyarakatController)
