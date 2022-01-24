const loginSuccess = async (req, res) => {
  res.send("You are logged in");
};

const logoutUser = (req, res) => {
  res.clearCookie("jwttoken");
  res.redirect("/");
};

const home = (req, res) => {
  // res.cookie("name", "tobi", { signed: true, sameSite: "Strict" });
  // res.cookie("name2", "tobi2", { signed: true, maxAge: 700000 });
  // console.log("UNsigned", req.cookies);
  // console.log("signed", req.signedCookies);
  // console.log("specific", req.signedCookies.name);
  // res.set("HOHO", "DDDD");
  res.send("HomePage");
};

module.exports = {
  loginSuccess,
  logoutUser,
  home,
};
