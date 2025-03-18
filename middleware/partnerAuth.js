const jwt = require("jsonwebtoken");
const Partner = require("../models/Paartner");

exports.auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const partner = await Partner.findById(decoded.id);

    if (!partner || partner.status === "blocked") {
      return res.status(401).json({
        success: false,
        message: "Please authenticate",
      });
    }

    req.partner = partner;
    req.token = token;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({
      success: false,
      message: "Please authenticate",
    });
  }
};
