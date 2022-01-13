const adminPanel = async (req, res) => {
  res.send("Admin Panel");
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
