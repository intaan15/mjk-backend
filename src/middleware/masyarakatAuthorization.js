const jwt = require("jsonwebtoken");

const authorizeMasyarakat = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: 'Token not provided' });
  }

  try {
    const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== 'masyarakat') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};

module.exports = authorizeMasyarakat;
