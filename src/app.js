const express = require('express')
const app = express()
const http = require('http').Server(app)
const cors = require('cors')

const PORT = 3000

app.use(express.urlencoded({extended : true}))
app.use(express.json())
app.use(cors())

app.get('/api', (req,res)=>{console.log(req,res)})

http.listen(PORT, ()=>{console.log('server port = ' + PORT)})