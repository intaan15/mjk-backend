const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 1 * 30 * 1000, // 15 menit
  max: 2, // max 10 percobaan
  message: "Terlalu banyak percobaan login. Coba lagi nanti.",
});

module.exports = loginLimiter;
