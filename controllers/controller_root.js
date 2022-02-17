const loginSuccess = async (req, res) => {
  res.status(200).json({ msg: "Success" });
};

const logoutUser = (req, res) => {
  res.clearCookie("jwttoken");
  res.redirect("/");
};

// const its = require("wink-nlp/src/its.js");
// const model = require("wink-eng-lite-model");
// var nlpu = require("wink-nlp-utils");
// const { parse } = require("node-html-parser");
const home = (req, res) => {
  // console.log(req.query);
  // const a = `<a class="top-level" href="/en/products" onclick="ga('send', 'event', 'Mega Menu', 'Products', 'Products');">Products</a>`;
  // const dom = parse(a);
  // var natural = require("natural");
  // var TfIdf = natural.TfIdf;
  // var tfidf = new TfIdf();
  // const sub = dom.querySelector("a");
  // console.log(sub.toString());
  // const model = require("wink-eng-lite-model");
  // const its = require("wink-nlp/src/its.js");
  // const as = require("wink-nlp/src/as.js");
  // const nlp = require("wink-nlp")(model);
  // const BM25Vectorizer = require("wink-nlp/utilities/bm25-vectorizer");
  // const bm25 = BM25Vectorizer();
  // // const text = "Hello are World🌎! How are you?";
  // const corpus = ["Bach", "J Bach", "Johann S Bach", "Johann Sebastian Bach symphony"];
  // const its = nlp.its;
  // tfidf.addDocument("Bach");
  // tfidf.addDocument("J Bach");
  // tfidf.addDocument("Johann S Bach");
  // tfidf.addDocument("Johann Sebastian Bach symphony");
  // const doc = nlp.readDoc(text);
  // const doc2 = nlp.readDoc(text2.join(" "));
  // console.log(doc.tokens().out(its.type, as.freqTable));
  // console.log("empty", doc.tokens().out());
  // console.log("as.freqtable", doc.tokens().out(its.type, as.freqTable));
  // const tok = doc.tokens().out();
  // corpus.forEach((doc) => bm25.learn(nlp.readDoc(doc).tokens().out(its.normal)));
  // console.log(bm25.vectorOf(nlp.readDoc("Johann Bach symphony").tokens().out(its.normal)));
  // console.log(bm25.out());
  // console.log(nlp.readDoc("Johann Bach symphony").tokens().out(its.normal));
  // console.log(bm25.out(its.terms));
  // console.log(bm25.vectorOf(["j", "bach"]));
  // console.log(bm25.vectorOf(["johann"]));
  // console.log(bm25.vectorOf(["symphony"]));
  // console.log(bm25.out(its.modelJSON));
  // console.log("text", tok);
  // tfidf.tfidfs("bach symphony", function (i, measure) {
  //   console.log("document #" + i + " is " + measure);
  // });
  // console.log("text2", tok2);
  // console.log("bow", as.bow(tok));
  // console.log("freqtable", as.freqTable(tok));
  // console.log("type", its.value(tok));
  // res.json(JSON.parse(bm25.out(its.modelJSON)));
  res.send("HomePage");
};

module.exports = {
  loginSuccess,
  logoutUser,
  home,
};
