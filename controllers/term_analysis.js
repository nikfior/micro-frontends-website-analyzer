const DB_Model_Sites = require("../db/Model_Site");
const { parse } = require("node-html-parser");
var WordPOS = require("wordpos");
var wordpos = new WordPOS();

const getTermAnalysis = async (req, res) => {
  const url = req.query.url;
  // ---------------------------------------------use Set to remove duplicates; check for title, not only text
  try {
    const site = await DB_Model_Sites.findOne({ url: url });
    if (!site) {
      return null;
    }

    let nodesDirArr = []; // each index is a site directory
    for (const html of site.html) {
      nodesDirArr.push(await extractTerms(html));
    }

    res.json({ nodes: nodesDirArr });
  } catch (error) {
    console.log(error);
  }
};

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
