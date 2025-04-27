const jwt = require("jsonwebtoken");
const ensureAuthenticated = (req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth) {
    return res
      .status(403)
      .json({ message: "Unauthorized , jwt token is missing" });
  }

  // Extract token from Bearer format
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Invalid token or expired" });
  }
};

module.exports = ensureAuthenticated;
