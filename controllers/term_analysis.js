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
const skmeans = require("skmeans");
const silhouetteCoefficient = require("./silhouette_coefficient");
const { breadth } = require("treeverse");
const { writeFileSync, unlinkSync } = require("fs");
const { spawnSync } = require("child_process");

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

    // if there is a forceReanalyze query then reanalyze it and don't get it from the database
    if (!req.query.forcereanalyze) {
      const dbAnalysis = await DB_Model_Analysis.findOne({ datasetSiteId: sanitizedId });
      if (dbAnalysis) {
        return res.json(dbAnalysis);
      }
    }

    let nodesDirArr = []; // each index is a site directory
    // each subdirectory of the site is passed in extractTerms to get back the terms. I am also passing the index of the subdirectory so that I can use it as part of the Id of each node
    let domFromAllSubdirs = [];
    let countId = 0;
    for (let i = 0; i < site.html.length; i++) {
      const dom = parse(site.html[i]);
      domFromAllSubdirs.push(dom);
      nodesDirArr.push(await extractTerms(dom, i, countId));
      countId += nodesDirArr[i].length;
    }

    // bm25
    // const termsPerSubd = nodesDirArr.map((subd) => {
    //   const subdTerms = subd.map((node) => node.terms);
    //   return subdTerms.flat(10).join(" ");
    // });
    // termsPerSubd.forEach((doc) => bm25.learn(nlp.readDoc(doc).tokens().out(its.normal)));
    // const bm25Matrix = termsPerSubd.map((subd) => {
    //   return bm25.vectorOf(nlp.readDoc(subd).tokens().out(its.normal));
    // });
    // const bm25Terms = bm25.out(its.terms);

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
    // const allDirsTerms = nodesDirArr.map((subd) => {
    //   return subd.map((node) => node.terms);
    // });
    // const allDirsBow = as.bow(allDirsTerms.flat(10));

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

    // [node(terms) x node(terms)] -> clusters
    // cos similarity between all nodes using their terms bows
    const { maxAllres, clusteredBow, nodexnode } = getKmeansNodexNode(nodesDirArr);
    //

    const gspanIn = convertToMiningTreeFormat(domFromAllSubdirs, sanitizedId, maxAllres, nodexnode);
    const gspanOut = pythonGspan(sanitizedId);
    const dotgraphs = gspanOut.graphs ? gspanOutToDotGraph(gspanOut) : null;

    const savedAnalysis = await DB_Model_Analysis.findOneAndUpdate(
      { datasetSiteId: sanitizedId },
      {
        analysis: {
          dotgraphs,
          gspanOut,
          gspanIn,
          nodexnode,
          clusteredBow,
          // testcluster: [...testcluster],
          maxAllres,
          subdirsname: site.subdirsname,
          nodes: nodesDirArr,
          // allDirsBow,
          // bm25Matrix,
          // bm25Terms,
          // tfidfNodesMatrix,
          cosineSimilarityPerSubd,
        },
      },
      { new: true, upsert: true }
    );

    return res.json(savedAnalysis);
  } catch (error) {
    // console.log(error);
    return res.status(500).json({ msg: error.message });
  }
};

//
//
//

const gspanOutToDotGraph = (gspanOut) => {
  const dotgraphs = [];

  for (let line of gspanOut.graphs) {
    if (line.startsWith("t")) {
      if (dotgraphs.length > 0) {
        dotgraphs[dotgraphs.length - 1].push("}");
      }
      dotgraphs.push([]);
      dotgraphs[dotgraphs.length - 1].push("digraph " + line.split(" ")[2] + " {");
    } else if (line.startsWith("e")) {
      dotgraphs[dotgraphs.length - 1].push(`${line.split(" ")[1]} -> ${line.split(" ")[2]};`);
    }
  }
  dotgraphs[dotgraphs.length - 1].push("}");

  return dotgraphs;
};

const pythonGspan = (sanitizedId) => {
  const pyArgs = ["-m", "gspan_mining", "-s", "2", "-d", "True", sanitizedId + "gspanIn.txt"];
  const pyProg = spawnSync("python", pyArgs);

  // remove file for gspan after finishing
  unlinkSync(sanitizedId + "gspanIn.txt");

  // console.log(pyProg.stdout.toString());
  if (pyProg.stderr.toString().length > 0) {
    console.log("stderr: ", pyProg.stderr.toString());
    return "Error Executing Tree mining";
  }
  if (pyProg.error) {
    console.log("python error: ", pyProg.error);
    return "Error Executing Tree mining";
  }

  const support = pyProg.stdout.toString().match(/^Support.+$/gm);
  const graphs = pyProg.stdout.toString().match(/^(t|v|e).+$/gm);
  return { graphs, support };
};

const convertToMiningTreeFormat = (domFromAllSubdirs, sanitizedId, maxAllres, nodexnode) => {
  let gspanFormat = [];
  let vertexCounter;
  let i;

  const getChildren = (node) => node.childNodes;

  const visit = (node) => {
    // console.log(
    //   node.nodeType,
    //   "and",
    //   node.tagName,
    //   "and",
    //   node.getAttribute && node.getAttribute("customId")
    // );

    // if text node is empty then remove it and not show it in gspan format array
    if (node.nodeType !== 1) {
      const hasText = /\S/g.test(node.text);
      if (!hasText) {
        node.parentNode.removeChild(node);
        return;
      }
    }

    let label = node.nodeType === 1 ? node.getAttribute("customId") || "-1" : "-1";
    // label = label ? label : "-1";
    gspanFormat[i].push(`v ${vertexCounter} ${label}`);
    if (node.nodeType !== 3) {
      node.setAttribute("vertexCounter", vertexCounter);
    }

    if (node.tagName !== "BODY") {
      gspanFormat[i].push(`e ${node.parentNode.getAttribute("vertexCounter")} ${vertexCounter} -1`);
    }

    vertexCounter++;
  };

  // loop for every subdir
  for (i = 0; i < domFromAllSubdirs.length; i++) {
    vertexCounter = 0;
    gspanFormat.push([]);
    gspanFormat[i].push("t # " + i);
    breadth({ tree: domFromAllSubdirs[i].getElementsByTagName("body")[0], visit, getChildren });
  }

  gspanFormat[i - 1].push("t # -1");
  writeFileSync(sanitizedId + "gspanIn.txt", gspanFormat.flat(10).join("\n"));
  return gspanFormat;
};

// cos similarity between all nodes using their terms bows
const getKmeansNodexNode = (nodesDirArr) => {
  //

  let allNodesFromAllSubds = []; // allNodesFromAllSubds: all nodes from all subds
  nodesDirArr.forEach((subd) => {
    subd.forEach((node) => {
      allNodesFromAllSubds.push(node);
    });
  });

  //

  let nodexnode = [];
  for (let i = 0; i < allNodesFromAllSubds.length; i++) {
    nodexnode.push([]);
    for (let j = 0; j < allNodesFromAllSubds.length; j++) {
      nodexnode[i].push(
        similarity.bow.cosine(
          as.bow(allNodesFromAllSubds[i].terms),
          as.bow(allNodesFromAllSubds[j].terms)
        )
      );
    }
  }

  // ----
  let max = -2;
  let noOfClusters = -2; // number of clusters with max silhouette
  let maxAllres;
  let upperLimit = nodexnode[0].length > 6 ? nodexnode[0].length / 3 : nodexnode[0].length - 1; // TODO find better upper limit
  // let upperLimit = nodexnode[0].length > 10 ? nodexnode[0].length - 7 : nodexnode[0].length - 1; // TODO find better upper limit
  for (let c = 2; c < upperLimit; c++) {
    // let inmax = -2;
    for (let i = 0; i < 100; i++) {
      let res = skmeans(nodexnode, c, null, null, costumDistanceFormula);
      // console.log(res);
      let coef = silhouetteCoefficient(nodexnode, res.idxs, costumDistanceFormula);
      // console.log("place", i, "number", coef);
      if (isNaN(coef)) {
        // console.log("NaN", i);
        continue;
      }
      if (coef > max) {
        // console.log("place", i, "number", coef);
        // inmax = coef;
        max = coef;
        maxAllres = res;
        noOfClusters = c;
      }
    }
    // console.log("c", c, "inmax", inmax);//-----------
    // console.log(max);
  } // end of choosing number of clusters
  // console.log("noofcluster", noOfClusters, "max", max);//------------
  // console.log("res", maxAllres, "max", max, "clusters", noOfClusters);
  // console.log("max", max, "clusters", noOfClusters);

  // ------

  let clusteredNodes = [];
  for (let i = 0; i < noOfClusters; i++) {
    clusteredNodes.push([]);
  }
  for (let i = 0; i < maxAllres.idxs.length; i++) {
    clusteredNodes[maxAllres.idxs[i]].push(allNodesFromAllSubds[i].terms);
    clusteredNodes[maxAllres.idxs[i]] = clusteredNodes[maxAllres.idxs[i]].flat(10);
  }

  let clusteredBow = [];
  for (let i = 0; i < noOfClusters; i++) {
    clusteredBow[i] = Object.fromEntries(
      Object.entries(as.bow(clusteredNodes[i])).sort((a, b) => {
        return b[1] - a[1];
      })
    );
  }

  return { maxAllres, clusteredBow, nodexnode };
};

const costumDistanceFormula = (a, b) => {
  let aIndex = a.indexOf(1);
  let bIndex = b.indexOf(1);
  let index;
  // if (bIndex !== -1) {
  //   console.log("BOTH");
  //   console.log("a", a, "aIndex", aIndex);
  //   console.log("b", b, "bIndex", bIndex);
  // }
  index = aIndex !== -1 ? aIndex : bIndex;
  if (aIndex !== -1 && bIndex !== -1) {
    // console.log("out", -(a[bIndex] - 1));
    return -(a[bIndex] - 1); // I substract 1 and use minus in order to change the bias for the kmeans which has zero as best similarity, whereas cosineSimilarity has one for best similarity
  } else {
    // console.log("Inere");
    // console.log("a", a, "aIndex", aIndex);
    // console.log("b", b, "bIndex", bIndex);
    // console.log("out", aIndex !== -1 ? -(b[index] - 1) : -(a[index] - 1));
    return aIndex !== -1 ? -(b[index] - 1) : -(a[index] - 1);
    // return -((a[bIndex] + b[aIndex]) / 2 - 1);
  }
};
//
//

// subdIndex: index of the subdirectory I am analyzing
const extractTerms = async (dom, subdIndex, countId) => {
  // const dom = parse(html);
  const nodeList = dom.querySelectorAll("h1,h2,h3,p,button,a");
  // TODO get titles and not only textContent

  let id = 0;
  let dirNode = [];
  // const domBody = dom.getElementsByTagName("body")[0];

  // for (let node of domBody.childNodes) {}
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
        id: subdIndex + ":" + id + ";" + countId,
        text: node.textContent,
        terms: nodeTerms,
      }); // -------------------------change what to save from the node

      node.setAttribute("customId", subdIndex + ":" + id + ";" + countId);

      id = id + 1;
      countId = countId + 1;
    }

    //
  }
  return dirNode;

  //
};

module.exports = { getTermAnalysis };
