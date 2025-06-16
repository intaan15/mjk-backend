// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const dotenv = require("dotenv");
// const bodyparser = require("body-parser");
// const path = require("path");
// const fs = require("fs");
// const createSocketServer = require("./socket/socket.controller");

// dotenv.config();
// const PORT = process.env.PORT;
// const app = express();
// const MONGO_URL = process.env.MONGO_URL;
// const logHistory = require("./middleware/loghistory");
// const adminAuthorization = require("./middleware/adminAuthorization");
// const httpServer = require("http").createServer(app);
// const io = createSocketServer(httpServer);
// const startCronJob = require("./socket/autoMessageCron");
// startCronJob(io);

// app.use(logHistory);
// console.log("Mulai aplikasi..");

// // Debug path information
// // console.log("📂 Path Debug Info:");
// // console.log("  __dirname:", __dirname);
// // console.log("  process.cwd():", process.cwd());

// // Function untuk setup static folder
// function setupStaticFolder(folderName) {
//   const possiblePaths = [
//     path.join(__dirname, `public/${folderName}`), // ./src/public/[folder]
//     path.join(__dirname, `../public/${folderName}`), // ./public/[folder] (jika src di subfolder)
//     path.join(process.cwd(), `public/${folderName}`), // dari root project
//     path.join(process.cwd(), `src/public/${folderName}`), // dari root dengan src folder
//   ];

//   let staticPath = null;

//   // Cek path mana yang exist
//   for (const testPath of possiblePaths) {
//     // console.log(
//     //   `  Testing path: ${testPath} - Exists: ${fs.existsSync(testPath)}`
//     // );
//     if (fs.existsSync(testPath)) {
//       staticPath = testPath;
//       break;
//     }
//   }

//   // Jika tidak ada yang exist, buat folder
//   if (!staticPath) {
//     const defaultPath = path.join(__dirname, `public/${folderName}`);
//     console.log(`  📁 Creating default folder: ${defaultPath}`);
//     fs.mkdirSync(defaultPath, { recursive: true });
//     staticPath = defaultPath;
//   }

//   console.log(`✅ Static files path for ${folderName}:`, staticPath);
//   return staticPath;
// }

// // Setup static folders
// const imagesdokterPath = setupStaticFolder("imagesdokter");
// const imagesmasyarakatPath = setupStaticFolder("imagesmasyarakat");
// const imageartikelPath = setupStaticFolder("imageartikel");

// mongoose
//   .connect(MONGO_URL)
//   .then(() => console.log("Database konek"))
//   .catch((error) => console.log("MongoDB error:", error));

// // Basic middleware
// app.use(express.urlencoded({ extended: true }));
// app.use(bodyparser.urlencoded({ extended: true }));
// app.use(express.json());
// app.use(bodyparser.json());
// app.use(cors());

// // STATIC FILES CONFIGURATION
// app.use("/imagesdokter", express.static(imagesdokterPath));
// app.use("/imagesmasyarakat", express.static(imagesmasyarakatPath));
// app.use("/imageartikel", express.static(imageartikelPath));

// // Debug route untuk test akses file imagesdokter
// app.get("/debug/imagesdokter", (req, res) => {
//   try {
//     const files = fs.readdirSync(imagesdokterPath);
//     res.json({
//       staticPath: imagesdokterPath,
//       files: files,
//       totalFiles: files.length,
//       sampleAccess:
//         files.length > 0 ? `/imagesdokter/${files[0]}` : "No files yet",
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Debug route untuk test akses file imagesmasyarakat
// app.get("/debug/imagesmasyarakat", (req, res) => {
//   try {
//     const files = fs.readdirSync(imagesmasyarakatPath);
//     res.json({
//       staticPath: imagesmasyarakatPath,
//       files: files,
//       totalFiles: files.length,
//       sampleAccess:
//         files.length > 0 ? `/imagesmasyarakat/${files[0]}` : "No files yet",
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Debug route untuk test akses file imageartikel
// app.get("/debug/imageartikel", (req, res) => {
//   try {
//     const files = fs.readdirSync(imageartikelPath);
//     res.json({
//       staticPath: imageartikelPath,
//       files: files,
//       totalFiles: files.length,
//       sampleAccess:
//         files.length > 0 ? `/imageartikel/${files[0]}` : "No files yet",
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Debug route untuk semua static folders
// app.get("/debug/static", (req, res) => {
//   try {
//     const dokterFiles = fs.readdirSync(imagesdokterPath);
//     const masyarakatFiles = fs.readdirSync(imagesmasyarakatPath);
//     const artikelFiles = fs.readdirSync(imageartikelPath);

//     res.json({
//       imagesdokter: {
//         path: imagesdokterPath,
//         files: dokterFiles,
//         totalFiles: dokterFiles.length,
//         sampleAccess:
//           dokterFiles.length > 0
//             ? `/imagesdokter/${dokterFiles[0]}`
//             : "No files yet",
//       },
//       imagesmasyarakat: {
//         path: imagesmasyarakatPath,
//         files: masyarakatFiles,
//         totalFiles: masyarakatFiles.length,
//         sampleAccess:
//           masyarakatFiles.length > 0
//             ? `/imagesmasyarakat/${masyarakatFiles[0]}`
//             : "No files yet",
//       },
//       imageartikel: {
//         path: imageartikelPath,
//         files: artikelFiles,
//         totalFiles: artikelFiles.length,
//         sampleAccess:
//           artikelFiles.length > 0
//             ? `/imageartikel/${artikelFiles[0]}`
//             : "No files yet",
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Test route
// app.get("/api/test", (req, res) => {
//   res.json({ message: "Hello from /api/test!" });
// });

// // Import controllers
// const masyarakatController = require("./masyarakat/masyarakat.controller");
// const authController = require("./auth/auth.controller");
// const dokterController = require("./dokter/dokter.controller");
// const artikelController = require("./artikel/artikel.controller");
// const ratingController = require("./rating/rating.controller");
// const jadwalController = require("./jadwal/jadwal.controller");
// const captchaController = require("./admin/captcha.controller");
// const adminController = require("./admin/admin.controller");
// const chatController = require("./socket/chat.controller");
// const chatListController = require("./socket/chatlist.controller");

// // API Routes
// app.use("/api/chatlist", chatListController);
// app.use("/api/chat", chatController);
// app.use("/api/masyarakat", masyarakatController);
// app.use("/api/auth", authController);
// app.use("/api/dokter", dokterController);
// app.use("/api/artikel", artikelController);
// app.use("/api/rating", ratingController);
// app.use("/api/jadwal", jadwalController);
// app.use("/api/captcha", captchaController);
// app.use("/api/admin", adminAuthorization, adminController);

// app.set("trust proxy", 1);

// httpServer.listen(PORT, () => {
//   console.log("server port = " + PORT);
//   console.log(`🌐 Server running at: http://localhost:${PORT}`);
//   console.log(
//     `👨‍⚕️ Images dokter accessible at: http://localhost:${PORT}/imagesdokter/`
//   );
//   console.log(
//     `👥 Images masyarakat accessible at: http://localhost:${PORT}/imagesmasyarakat/`
//   );
//   console.log(
//     `📄 Images artikel accessible at: http://localhost:${PORT}/imageartikel/`
//   );
//   console.log(
//     `🔍 Debug dokter images at: http://localhost:${PORT}/debug/imagesdokter`
//   );
//   console.log(
//     `🔍 Debug masyarakat images at: http://localhost:${PORT}/debug/imagesmasyarakat`
//   );
//   console.log(
//     `🔍 Debug artikel images at: http://localhost:${PORT}/debug/imageartikel`
//   );
//   console.log(
//     `🔍 Debug all static files at: http://localhost:${PORT}/debug/static`
//   );
// });

// module.exports = app;

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
const adminAuthorization = require("./middleware/adminAuthorization");
const httpServer = require("http").createServer(app);
const io = createSocketServer(httpServer);
const startCronJob = require("./socket/autoMessageCron");
startCronJob(io);

console.log("Mulai aplikasi..");

// Debug path information
// console.log("📂 Path Debug Info:");
// console.log("  __dirname:", __dirname);
// console.log("  process.cwd():", process.cwd());

// Function untuk setup static folder
function setupStaticFolder(folderName) {
  const possiblePaths = [
    path.join(__dirname, `public/${folderName}`), // ./src/public/[folder]
    path.join(__dirname, `../public/${folderName}`), // ./public/[folder] (jika src di subfolder)
    path.join(process.cwd(), `public/${folderName}`), // dari root project
    path.join(process.cwd(), `src/public/${folderName}`), // dari root dengan src folder
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
    const defaultPath = path.join(__dirname, `public/${folderName}`);
    console.log(`  📁 Creating default folder: ${defaultPath}`);
    fs.mkdirSync(defaultPath, { recursive: true });
    staticPath = defaultPath;
  }

  console.log(`✅ Static files path for ${folderName}:`, staticPath);
  return staticPath;
}

// Setup static folders
const imagesdokterPath = setupStaticFolder("imagesdokter");
const imagesmasyarakatPath = setupStaticFolder("imagesmasyarakat");
const imagesartikelPath = setupStaticFolder("imagesartikel");
const imageschatPath = setupStaticFolder("imageschat");
const imagesPath = setupStaticFolder("images-be");

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
app.use("/imagesdokter", express.static(imagesdokterPath));
app.use("/imagesmasyarakat", express.static(imagesmasyarakatPath));
app.use("/imagesartikel", express.static(imagesartikelPath));
app.use("/imageschat", express.static(imageschatPath));
app.use("/images-be", express.static(imagesPath));

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
  console.log(
    `👨‍⚕️ Images dokter accessible at: http://localhost:${PORT}/imagesdokter/`
  );
  console.log(
    `👥 Images masyarakat accessible at: http://localhost:${PORT}/imagesmasyarakat/`
  );
  console.log(
    `📄 Images artikel accessible at: http://localhost:${PORT}/imagesartikel/`
  );
  console.log(
    `📠 Images artikel accessible at: http://localhost:${PORT}/imageschat/`
  );
  console.log(
    `📷 Images artikel accessible at: http://localhost:${PORT}/images/`
  );
});

module.exports = app;