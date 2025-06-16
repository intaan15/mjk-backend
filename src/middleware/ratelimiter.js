const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 menit
  max: 3, // max 3 percobaan
  statusCode: 429,
  message: "Terlalu banyak percobaan login. Coba lagi nanti.",
});

const createLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 menit
    max: 2, // Maksimal 2 request per menit per IP
    message: {
        message: "Terlalu banyak permintaan, coba lagi nanti",
        error: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = loginLimiter, createLimiter;
