const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 menit
  max: 3, // max 10 percobaan
  statusCode: 429,
  message: "Terlalu banyak percobaan login. Coba lagi nanti.",
});

module.exports = loginLimiter;
