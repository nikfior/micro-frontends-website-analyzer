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
const similarity = require("wink-nlp/utilities/similarity.js");

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

    const dbAnalysis = await DB_Model_Analysis.findOne({ datasetSiteId: sanitizedId });
    if (dbAnalysis) {
      return res.json(dbAnalysis);
    }

    let nodesDirArr = []; // each index is a site directory
    // each subdirectory of the site is passed in extractTerms to get back the terms. I am also passing the index of the subdirectory so that I can use it as part of the Id of each node
    for (let i = 0; i < site.html.length; i++) {
      nodesDirArr.push(await extractTerms(site.html[i], i));
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
    // let tfidfFunMatrix = [];
    // let tfidfNodesMatrix = [];
    // nodesDirArr.forEach((subd) => {
    //   const tfidf = new TfIdf();
    //   subd.forEach((node) => tfidf.addDocument(node.terms.join(" ")));
    //   tfidfFunMatrix.push(tfidf);
    //   tfidfNodesMatrix.push([]);
    // });
    // nodesDirArr.forEach((subd, index) => {
    //   subd.forEach((node) => {
    //     let sum = 0;
    //     tfidfFunMatrix[index].tfidfs(node.terms.join(" "), function (i, measure) {
    //       // console.log('document #' + i + ' is ' + measure);
    //       // tfidfNodesMatrix[index].push(measure);
    //       sum = sum + measure;
    //     });
    //     tfidfNodesMatrix[index].push(sum);
    //   });
    // });

    // Bow
    const allDirsTerms = nodesDirArr.map((subd) => {
      return subd.map((node) => node.terms);
    });
    const allDirsBow = as.bow(allDirsTerms.flat(10));

    //
    // cosine similarity
    // allNodeTermsPerSubd: each index is a subdirectory which has all the terms of all the nodes of that subdirectory and the terms are flattened and not in groups of their node
    // nodeTermsPerSubd: each index is a subdirectory which has the terms of all the nodes of that subdirectory and the terms are in grouped based on their node
    let allNodeTermsPerSubd = [];
    let nodeTermsPerSubd = [];
    nodesDirArr.forEach((subd) => {
      const TermsInSubd = subd.map((node) => node.terms);
      allNodeTermsPerSubd.push(TermsInSubd.flat(10));
      nodeTermsPerSubd.push(TermsInSubd);
    });

    const allNodeTermsPerSubdBow = allNodeTermsPerSubd.map((subd) => as.bow(subd));
    const nodeTermsPerSubdBow = nodeTermsPerSubd.map((subd) => {
      return subd.map((nodeTerms) => as.bow(nodeTerms));
    });

    let cosineSimilarityPerSubd = [];
    for (let i = 0; i < allNodeTermsPerSubdBow.length; i++) {
      let subdCosineSimilarity = [];
      for (let k = 0; k < nodeTermsPerSubdBow.length; k++) {
        for (let j = 0; j < nodeTermsPerSubdBow[k].length; j++) {
          subdCosineSimilarity.push(
            similarity.bow.cosine(nodeTermsPerSubdBow[k][j], allNodeTermsPerSubdBow[i])
          );
        }
      }
      cosineSimilarityPerSubd.push(subdCosineSimilarity);
    }

    // [[{g,d},{s,d}],[{g,d},{s,d},{f,h}]]
    // [[{g,d,s,d}],[{g,d,s,d,f,h}]]
    //

    const savedAnalysis = await DB_Model_Analysis.findOneAndUpdate(
      { datasetSiteId: sanitizedId },
      {
        analysis: {
          subdirsname: site.subdirsname,
          nodes: nodesDirArr,
          allDirsBow,
          bm25Matrix,
          bm25Terms,
          // tfidfNodesMatrix,
          cosineSimilarityPerSubd,
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
      // tfidfNodesMatrix,
      cosineSimilarityPerSubd,
    });
  } catch (error) {
    // console.log(error);
    return res.status(500).json({ msg: error.message });
  }
};

// {nodes:[ [{node:...,id:...},{node:...},...], [{node:...},{node:...},...], ... ] }
//                                         ^                            ^         nodes of a subdir
//                                                                            ^     subdirs

const extractTerms = async (html, subdIndex) => {
  const dom = parse(html);
  const nodeList = dom.querySelectorAll("h1,h2,h3,p,button,a");
  // TODO get titles and not only textContent

  let id = 0;
  let dirNode = [];
  for (const node of nodeList) {
    let nodeTerms = [];

    // tokenize the textContent of each node and remove punctuations and stopwords
    const tokens = nlp
      .readDoc(node.text)
      .tokens()
      .filter((t) => t.out(its.type) !== "punctuation" && !t.out(its.stopWordFlag));

    for (let i = 0; i < tokens.length(); i++) {
      let result = await wordpos.lookup(tokens.itemAt(i).out(its.normal));
      let synonyms = result.map((item) => item.synonyms); // TODO maybe get the pos synonyms only and not for all adj,verb,noun,etc?

      // if the word is not found then try the lemma version
      if (synonyms.length === 0) {
        result = await wordpos.lookup(tokens.itemAt(i).out(its.lemma));
        synonyms = result.map((item) => item.synonyms); // TODO maybe get the pos synonyms only and not for all adj,verb,noun,etc?
      }

      // reducing all synonym groups if it's adj, verb, noun, etc
      synonyms = synonyms.flat(10);
      // by using new Set(synonyms) I remove the duplicate synonyms of a single word of a text of a node. The node might have duplicate Terms if two words have the same synonym but a single word can't have the same word as a synonym
      // the reason a single word can have duplicate words as a synonym is because a word can be a verb, noun, adjective and might have the same synonym in those forms
      nodeTerms = [...nodeTerms, ...new Set(synonyms)];
    }

    nodeTerms = nodeTerms.flat(10);

    // TODO it is better to remove the nodes that don't have text instead of the nodes that have text but don't have synonyms like I do here. and maybe use the text as the terms
    // TODO Should I add the tokenized text in the Terms. But make sure to remove the stopwords
    // save only if there are terms
    if (nodeTerms.length !== 0) {
      dirNode.push({
        node: node.tagName,
        id: subdIndex + ":" + id,
        text: node.textContent,
        terms: nodeTerms,
      }); // -------------------------change what to save from the node

      id = id + 1;
    }

    //
  }
  return dirNode;

  //
};

module.exports = { getTermAnalysis };
