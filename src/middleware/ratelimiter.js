const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 3, // max 3 percobaan
  statusCode: 429,
  message: "Terlalu banyak percobaan login. Coba lagi nanti.",
});

const createLimiter = rateLimit({
    windowMs: 10 * 1000, // 10 detik
    max: 1, // Maksimal 1 request per 10 detik per IP
    message: {
        message: "Terlalu banyak permintaan, coba lagi nanti",
        error: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 detik
  max: 1, // maksimal 1 upload per 10 detik per IP
  message: {
    message: "Terlalu banyak permintaan, coba lagi nanti.",
    error: "UPLOAD_RATE_LIMIT_EXCEEDED",
    retryAfter: Math.ceil(10),
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    return false;
  },
});

module.exports = { loginLimiter, createLimiter, uploadLimiter };