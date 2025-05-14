import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 menit
  max: 3, // max 10 percobaan
  message: "Terlalu banyak percobaan login. Coba lagi nanti.",
});

export default loginLimiter;
