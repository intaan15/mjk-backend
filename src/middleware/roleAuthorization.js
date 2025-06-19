const jwt = require("jsonwebtoken");


const roleAuthorization = (allowedRoles) => {
 return (req, res, next) => {
   const token = req.headers.authorization;
   if (!token) {
     return res.status(401).json({ message: "Token not provided" });
   }


   try {
     const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    
     if (!allowedRoles.includes(decoded.role)) {
       return res.status(403).json({
         message: 'Unauthorized - insufficient permissions',
         allowedRoles: allowedRoles,
         userRole: decoded.role
       });
     }
    
     req.user = decoded;
     next();
   } catch (error) {
     return res.status(401).json({ message: 'Invalid token' });
   }
 };
};


module.exports = roleAuthorization;