const rateLimit = require("express-rate-limit");

const loginlimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // max 10 percobaan
  message: "Terlalu banyak percobaan login. Coba lagi nanti.",
});

module.exports = loginlimiter;
