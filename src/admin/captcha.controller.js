const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const captchaStore = {};

function generateCaptchaText() {
  return Math.random().toString(36).substring(2, 8);
}

// Endpoint untuk generate captcha
router.get("/captcha", (req, res) => {
  const captchaText = generateCaptchaText();
  const captchaId = crypto.randomUUID();

  // Simpan captcha ke store
  captchaStore[captchaId] = captchaText;

  setTimeout(() => {
    delete captchaStore[captchaId];
  }, 15000); 

  res.json({
    captcha: captchaText, 
    captchaId, 
    expiresIn: 20, 
  });
});

// Endpoint untuk validasi captcha
router.post("/validate", (req, res) => {
  const { captchaId, userInput } = req.body;

  console.log("Received captchaId:", captchaId);
  console.log("captchaStore:", captchaStore);
  console.log("User input:", userInput);

  const storedCaptcha = captchaStore[captchaId];

  if (!storedCaptcha) {
    return res.status(400).json({
      success: false,
      message: "Captcha tidak valid atau sudah kedaluwarsa",
    });
  }

  // Cek kecocokan captcha
  if (
    typeof userInput === "string" &&
    storedCaptcha.toLowerCase() === userInput.toLowerCase()
  ) {
    delete captchaStore[captchaId];
    return res.json({ success: true });
  }

  return res.json({
    success: false,
    message: "Captcha salah",
  });
});

module.exports = router;
