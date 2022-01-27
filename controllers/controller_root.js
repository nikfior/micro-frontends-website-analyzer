const loginSuccess = async (req, res) => {
  res.status(200).json({ msg: "Success" });
};

const logoutUser = (req, res) => {
  res.clearCookie("jwttoken");
  res.redirect("/");
};

// const winkNLP = require("wink-nlp");
// const its = require("wink-nlp/src/its.js");
// const model = require("wink-eng-lite-model");
// var nlpu = require("wink-nlp-utils");
// const as = require("wink-nlp/src/as.js");
const home = (req, res) => {
  // const nlp = winkNLP(model);
  // let a = [
  //   ["rain", "rain", "go", "away"],
  //   ["rain", "go"],
  // ];
  // console.log(as.bow(a.flat(10)).rain);
  // return res.json(as.bow(a.flat(10)));
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
