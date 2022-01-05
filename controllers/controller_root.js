const DB_Model_Users = require("../db/Model_Users");

const adminPanel = async (req, res) => {
  try {
    const users = await DB_Model_Users.find({});
    const user = users.find((x) => {
      return x.githubId === req.session.githubId;
    });

    if (user) {
      res.send("Admin Panel");
    } else {
      res.send("Not Authorized User");
    }
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
};

const logoutUser = (req, res) => {
  req.session = null;
  res.redirect("/");
};

const home = (req, res) => {
  res.send("HomePage");
};

module.exports = {
  adminPanel,
  logoutUser,
  home,
};
