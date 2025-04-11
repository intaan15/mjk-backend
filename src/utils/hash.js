const crypto = require("crypto");

function hashString(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

module.exports = { hashString };
