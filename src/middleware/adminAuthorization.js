const jwt = require("jsonwebtoken");

const authorizeAdmin = (req, res, next) => {
  const token = req.headers.authorization;
  console.log("token : ",token)
  if (!token) {
    return res.status(401).json({ message: "Token not provided" });
  }

  try {
    const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    console.log("dekodet : ",decoded)
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized - not admin" });
    }

    req.user = decoded; 
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = authorizeAdmin;