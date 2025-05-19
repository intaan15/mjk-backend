const jwt = require("jsonwebtoken");

// const adminAuthorization = (req, res, next) => {
//   const token = req.headers.authorization;
//   console.log("token : ",token)
//   if (!token) {
//     return res.status(401).json({ message: "Token not provided" });
//   }

//   try {
//     const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
//     console.log("dekodet : ",decoded)
//     if (decoded.role !== "admin") {
//       return res.status(403).json({ message: "Unauthorized - not admin" });
//     }

//     req.user = decoded; 
//     next();
//   } catch (error) {
//     return res.status(401).json({ message: "Invalid token" });
//   }
// };

const adminAuthorization = (req, res, next) => {
  // Debug: Log headers lengkap
  console.log('Headers received:', req.headers);
  
  const authHeader = req.headers.authorization;
  
  // Validasi 1: Cek keberadaan header
  if (!authHeader) {
    console.error('No authorization header');
    return res.status(401).json({ 
      success: false,
      message: "Authorization header required" 
    });
  }

  // Validasi 2: Cek format Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    console.error('Invalid token format:', authHeader);
    return res.status(401).json({ 
      success: false,
      message: "Format token tidak valid. Gunakan: Bearer <token>" 
    });
  }

  const token = authHeader.split(' ')[1];
  
  // Debug: Log token yang diterima
  console.log('Token extracted:', token);
  console.log('JWT Secret:', process.env.JWT_SECRET); // Pastikan ini tampil

  try {
    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);

    // Validasi role
    if (decoded.role !== "admin") {
      console.error('Role not admin:', decoded.role);
      return res.status(403).json({ 
        success: false,
        message: "Akses ditolak - Hanya untuk admin" 
      });
    }

    req.user = decoded;
    next();

  } catch (error) {
    console.error('Token verification failed:', error.message);
    
    // Handle error spesifik
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Token expired" 
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false,
        message: "Token tidak valid",
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    return res.status(500).json({ 
      success: false,
      message: "Error verifikasi token" 
    });
  }
};

module.exports = adminAuthorization;