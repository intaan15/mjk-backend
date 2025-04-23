// const express = require('express')
// const app = express()
// const mongoose = require('mongoose')
// const http = require('http').Server(app)
// const cors = require('cors')
// const dotenv = require('dotenv')
// const bodyparser = require('body-parser')
// dotenv.config()
// const PORT = process.env.PORT
// const MONGO_URL = process.env.MONGO_URL

// mongoose.connect(MONGO_URL).then(()=>{
//     console.log('databes konek')
//     app.listen(PORT, ()=>{
//         console.log('server port = ' + PORT)
//     })
// }).catch((error)=>console.log(error))

// app.use(express.urlencoded({extended : true}))
// app.use(bodyparser.urlencoded({extended : true}))
// app.use(express.json())
// app.use(bodyparser.json())
// app.use(cors())

// const masyarakatController = require('./masyarakat/masyarakat.controller')
// const authController = require('./auth/auth.controller')
// const dokterController = require('./dokter/dokter.controller')
// const artikelController = require('./artikel/artikel.controller')
// const ratingController = require('./rating/rating.controller')
// const jadwalController = require('./jadwal/jadwal.controller');
// const captchaController = require('./admin/captcha.controller')
// // const verifikasiController = require('./verifikasi/verifikasi.controller');

// app.use('/api/masyarakat', masyarakatController)
// app.use('/api/auth', authController)
// app.use('/api/dokter', dokterController)
// app.use('/api/artikel', artikelController)
// app.use('/api/rating', ratingController)
// app.use("/api/jadwal", jadwalController);
// app.use("/api/captcha", captchaController);
// app.use("/api/verifikasi", verifikasiController);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyparser = require('body-parser');
const serverless = require('serverless-http');

dotenv.config();

const app = express();
const MONGO_URL = process.env.MONGO_URL;

mongoose.connect(MONGO_URL)
  .then(() => console.log('Database connected'))
  .catch((error) => console.log('MongoDB error:', error));

alert("helloworld");

  
app.use(express.urlencoded({ extended: true }));
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyparser.json());
app.use(cors());

// Controllers
const masyarakatController = require('../masyarakat/masyarakat.controller');
const authController = require('../auth/auth.controller');
const dokterController = require('../dokter/dokter.controller');
const artikelController = require('../artikel/artikel.controller');
const ratingController = require('../rating/rating.controller');
const jadwalController = require('../jadwal/jadwal.controller');
const captchaController = require('../admin/captcha.controller');

app.use('/api/masyarakat', masyarakatController);
app.use('/api/auth', authController);
app.use('/api/dokter', dokterController);
app.use('/api/artikel', artikelController);
app.use('/api/rating', ratingController);
app.use('/api/jadwal', jadwalController);
app.use('/api/captcha', captchaController);

module.exports = app;
module.exports.handler = serverless(app);
