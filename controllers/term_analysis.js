const DB_Model_Sites = require("../db/Model_Site");
const { parse } = require("node-html-parser");
const as = require("wink-nlp/src/as.js");
var WordPOS = require("wordpos");
var wordpos = new WordPOS();

const getTermAnalysis = async (req, res) => {
  const url = req.query.url;
  // ---------------------------------------------use Set to remove duplicates; check for title, not only text
  // chech for case when there is no such url to analyze
  // at the end save the analysis in the db and here at the beginning check if it exists in the db first and if it doesn't then execute it and save it in the db then
  try {
    const site = await DB_Model_Sites.findOne({ url: url });
    if (!site) {
      return null; // -----------------
    }

    let nodesDirArr = []; // each index is a site directory
    for (const html of site.html) {
      nodesDirArr.push(await extractTerms(html));
    }

    // Bow
    const allDirsTerms = nodesDirArr.map((subd) => {
      return subd.map((node) => node.terms);
    });
    const allDirsBow = as.bow(allDirsTerms.flat(10));

    res.json({ nodes: nodesDirArr, allDirsBow });
  } catch (error) {
    console.log(error);
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
