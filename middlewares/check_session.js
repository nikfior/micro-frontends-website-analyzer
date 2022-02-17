const DB_Model_Users = require("../db/Model_Users");
const jwt = require("jsonwebtoken");

const sessionCheck = async (req, res, next) => {
  const jwttoken = req.get("Custom-Authorization") || req.signedCookies.jwttoken;

  if (!jwttoken) {
    return res.status(401).json({ msg: "Unauthorized" });
  }

  let userId;
  try {
    userId = jwt.verify(jwttoken, process.env.COOKIE_JWT_SECRET).id;
  } catch (error) {
    return res.status(401).json(error.message); // invalid jwt
  }

  if (!userId) {
    return res.status(401).json({ msg: "Unauthorized" }); // logged out. no cookie or jwt
  }

  try {
    const userDB = await DB_Model_Users.findById(userId);
    if (userDB && userDB._id.toString() === userId) {
      req.middlewareUserId = userDB._id;
      return next();
    }
    return res.status(401).json({ msg: "Unauthorized" }); // no such user
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = { sessionCheck };
