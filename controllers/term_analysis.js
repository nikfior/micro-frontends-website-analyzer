const DB_Model_Sites = require("../db/Model_Site");
const DB_Model_Analysis = require("../db/Model_TermAnalysis");
const { parse } = require("node-html-parser");
const model = require("wink-eng-lite-model");
const nlp = require("wink-nlp")(model);
const its = require("wink-nlp/src/its.js");
const as = require("wink-nlp/src/as.js");
const BM25Vectorizer = require("wink-nlp/utilities/bm25-vectorizer");
var WordPOS = require("wordpos");
var wordpos = new WordPOS();
const natural = require("natural");
const TfIdf = natural.TfIdf;
const bm25 = BM25Vectorizer();

const getTermAnalysis = async (req, res) => {
  const sanitizedId = req.query.id.toString().replace(/\$/g, "");
  // ---------------------------------------------TODO use Set to remove duplicates; check for title, not only text
  // save the analysis in the db and here at the beginning check if it exists in the db first and if it doesn't then execute it and save it in the db then
  // maybe even it analyzes for first time add loading animation and say it might take a while
  try {
    const site = await DB_Model_Sites.findById(sanitizedId);
    if (!site) {
      return res.status(404).json({ msg: "Site not found for analysis. Please add site first" });
    }

    const dbAnalysis = await DB_Model_Analysis.findById(sanitizedId);
    if (dbAnalysis) {
      return res.json(dbAnalysis);
    }

    let nodesDirArr = []; // each index is a site directory
    for (const html of site.html) {
      nodesDirArr.push(await extractTerms(html));
    }

    // bm25
    const termsPerSubd = nodesDirArr.map((subd) => {
      const subdTerms = subd.map((node) => node.terms);
      return subdTerms.flat(10).join(" ");
    });
    termsPerSubd.forEach((doc) => bm25.learn(nlp.readDoc(doc).tokens().out(its.normal)));
    const bm25Matrix = termsPerSubd.map((subd) => {
      return bm25.vectorOf(nlp.readDoc(subd).tokens().out(its.normal));
    });
    const bm25Terms = bm25.out(its.terms);

    // bm25 with nodes
    let tfidfFunMatrix = [];
    let tfidfNodesMatrix = [];
    nodesDirArr.forEach((subd) => {
      const tfidf = new TfIdf();
      subd.forEach((node) => tfidf.addDocument(node.terms.join(" ")));
      tfidfFunMatrix.push(tfidf);
      tfidfNodesMatrix.push([]);
    });
    nodesDirArr.forEach((subd, index) => {
      subd.forEach((node) => {
        let sum = 0;
        tfidfFunMatrix[index].tfidfs(node.terms.join(" "), function (i, measure) {
          // console.log('document #' + i + ' is ' + measure);
          // tfidfNodesMatrix[index].push(measure);
          sum = sum + measure;
        });
        tfidfNodesMatrix[index].push(sum);
      });
    });

    // Bow
    const allDirsTerms = nodesDirArr.map((subd) => {
      return subd.map((node) => node.terms);
    });
    const allDirsBow = as.bow(allDirsTerms.flat(10));

    const savedAnalysis = await DB_Model_Analysis.findByIdAndUpdate(
      sanitizedId,
      {
        analysis: {
          subdirsname: site.subdirsname,
          nodes: nodesDirArr,
          allDirsBow,
          bm25Matrix,
          bm25Terms,
          tfidfNodesMatrix,
        },
      },
      { new: true, upsert: true }
    );

    return res.json({
      subdirsname: site.subdirsname,
      nodes: nodesDirArr,
      allDirsBow,
      bm25Matrix,
      bm25Terms,
      tfidfNodesMatrix,
    });
  } catch (error) {
    // console.log(error);
    return res.status(500).json({ msg: error.message });
  }
};

// {nodes:[ [{node:...,id:...},{node:...},...], [{node:...},{node:...},...], ... ] }
//                                         ^                            ^         nodes of a subdir
//                                                                            ^     subdirs

const extractTerms = async (html) => {
  const dom = parse(html);
  const nodeList = dom.querySelectorAll("h1,h2,h3,p,button,a");

  let id = 0;
  let dirNode = [];
  for (const node of nodeList) {
    let nodeTerms = [];
    const nodeTxtArr = node.text.split(" ");
    for (const txt of nodeTxtArr) {
      let result = await wordpos.lookup(txt);
      let synonyms = result.map((item) => item.synonyms);
      synonyms = synonyms.flat(10);
      nodeTerms = [...nodeTerms, ...synonyms];
    }
    let uniqNodeTerms = [...new Set(nodeTerms)];
    dirNode.push({
      node: node.tagName,
      id: id,
      text: node.textContent,
      terms: uniqNodeTerms,
    }); // -------------------------change what to save from the node
    id = id + 1;
  }
  return dirNode;
  // const html = await axios.get("http://example.com");
  // const dom = parse(html.data);

  // console.log(dom.querySelectorAll("a,p")[0]); //[0].childNodes[0].textContent);
  // console.log(dom.querySelectorAll("*").length);
};

module.exports = { getTermAnalysis };
