const DB_Model_Users = require("../db/Model_Users");

const sessionCheck = async (req, res, next) => {
  const userIdCookie = req.session.id;
  if (!userIdCookie) {
    return res.status(401).json({ msg: "Unauthorized" }); // logged out. no cookie
  }
  try {
    const userDB = await DB_Model_Users.findById(userIdCookie);
    if (!userDB) {
      return res.status(401).json({ msg: "Unauthorized" }); // logged out. no cookie // no such user
    }
    next();
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
};

module.exports = { sessionCheck };
