const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyparser = require("body-parser");
const path = require("path");
const fs = require("fs");
const createSocketServer = require("./socket/socket.controller");

dotenv.config();
const PORT = process.env.PORT;
const app = express();
const MONGO_URL = process.env.MONGO_URL;
const logHistory = require("./middleware/loghistory");
const adminAuthorization = require("./middleware/adminAuthorization");
const httpServer = require("http").createServer(app);
const io = createSocketServer(httpServer);
const startCronJob = require("./socket/autoMessageCron");
startCronJob(io);

app.use(logHistory);
console.log("Mulai aplikasi..");

// Debug path information
// console.log("📂 Path Debug Info:");
// console.log("  __dirname:", __dirname);
// console.log("  process.cwd():", process.cwd());

// Coba beberapa kemungkinan path untuk static files
const possiblePaths = [
  path.join(__dirname, "public/imagesdokter"), // ./src/public/imagesdokter
  path.join(__dirname, "../public/imagesdokter"), // ./public/imagesdokter (jika src di subfolder)
  path.join(process.cwd(), "public/imagesdokter"), // dari root project
  path.join(process.cwd(), "src/public/imagesdokter"), // dari root dengan src folder
];

let staticPath = null;

// Cek path mana yang exist
for (const testPath of possiblePaths) {
  // console.log(
  //   `  Testing path: ${testPath} - Exists: ${fs.existsSync(testPath)}`
  // );
  if (fs.existsSync(testPath)) {
    staticPath = testPath;
    break;
  }
}

// Jika tidak ada yang exist, buat folder
if (!staticPath) {
  const defaultPath = path.join(__dirname, "public/imagesdokter");
  console.log("  📁 Creating default folder:", defaultPath);
  fs.mkdirSync(defaultPath, { recursive: true });
  staticPath = defaultPath;
}

// console.log("✅ Static files path:", staticPath);

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("Database konek"))
  .catch((error) => console.log("MongoDB error:", error));

// Basic middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyparser.json());
app.use(cors());

// STATIC FILES CONFIGURATION
app.use("/imagesdokter", express.static(staticPath));

// Debug route untuk test akses file
app.get("/debug/imagesdokter", (req, res) => {
  try {
    const files = fs.readdirSync(staticPath);
    res.json({
      staticPath: staticPath,
      files: files,
      totalFiles: files.length,
      sampleAccess: files.length > 0 ? `/imagesdokter/${files[0]}` : "No files yet",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from /api/test!" });
});

// Import controllers
const masyarakatController = require("./masyarakat/masyarakat.controller");
const authController = require("./auth/auth.controller");
const dokterController = require("./dokter/dokter.controller");
const artikelController = require("./artikel/artikel.controller");
const ratingController = require("./rating/rating.controller");
const jadwalController = require("./jadwal/jadwal.controller");
const captchaController = require("./admin/captcha.controller");
const adminController = require("./admin/admin.controller");
const chatController = require("./socket/chat.controller");
const chatListController = require("./socket/chatlist.controller");

// API Routes
app.use("/api/chatlist", chatListController);
app.use("/api/chat", chatController);
app.use("/api/masyarakat", masyarakatController);
app.use("/api/auth", authController);
app.use("/api/dokter", dokterController);
app.use("/api/artikel", artikelController);
app.use("/api/rating", ratingController);
app.use("/api/jadwal", jadwalController);
app.use("/api/captcha", captchaController);
app.use("/api/admin", adminAuthorization, adminController);

app.set("trust proxy", 1);

httpServer.listen(PORT, () => {
  console.log("server port = " + PORT);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  // console.log(`📷 Images accessible at: http://localhost:${PORT}/images/`);
  // console.log(`🔍 Debug images at: http://localhost:${PORT}/debug/images`);
});

module.exports = app;
