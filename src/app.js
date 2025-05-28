const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyparser = require("body-parser");
const createSocketServer = require("./socket/socket.controller");
dotenv.config();
const PORT = process.env.PORT
const app = express();
const MONGO_URL = process.env.MONGO_URL;
const logHistory = require("./middleware/loghistory");
const adminAuthorization = require("./middleware/adminAuthorization");
const httpServer = require("http").createServer(app);
const io = createSocketServer(httpServer); 
const startCronJob = require("./socket/autoMessageCron");
startCronJob(io);

app.use(logHistory);
console.log("Mulai aplikasi..")
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("Database konek"))
  .catch((error) => console.log("MongoDB error:", error));

app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from /api/test!" });
});

app.use(express.urlencoded({ extended: true }));
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyparser.json());
app.use(cors());
// createSocketServer(httpServer);
// require("./socket/autoMessageCron"); // Atau sesuai nama file cron job kamu

httpServer.listen(PORT, () => {
  console.log('server port = ' + PORT)
})

const masyarakatController = require("./masyarakat/masyarakat.controller");
const authController = require("./auth/auth.controller");
const dokterController = require("./dokter/dokter.controller");
const artikelController = require("./artikel/artikel.controller");
const ratingController = require("./rating/rating.controller");
const jadwalController = require("./jadwal/jadwal.controller");
const captchaController = require("./admin/captcha.controller");
const adminController = require("./admin/admin.controller");
const chatController= require("./socket/chat.controller");
const chatListController = require("./socket/chatlist.controller");
const startCronJob = require("./socket/autoMessageCron");


app.use("/api/chatlist", chatListController);
app.use("/api/chat", chatController);
app.use("/api/masyarakat", masyarakatController);
app.use("/api/auth", authController);
app.use("/api/dokter", dokterController);
app.use("/api/artikel", artikelController);
app.use("/api/rating", ratingController);
app.use("/api/jadwal", jadwalController);
app.use("/api/captcha", captchaController);
app.use("/api/admin",adminAuthorization, adminController);
app.set("trust proxy", 1);
app.use("/images/", express.static("/public/images"));


module.exports = app;