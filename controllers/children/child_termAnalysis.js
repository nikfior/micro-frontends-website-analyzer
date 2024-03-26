const DB_Model_Sites = require("../../db/Model_Site");
const DB_Model_Analysis = require("../../db/Model_TermAnalysis");
const connectDB = require("../../db/connectDB");
const { parse } = require("node-html-parser");
const model = require("wink-eng-lite-web-model");
const nlp = require("wink-nlp")(model);
const its = require("wink-nlp/src/its.js");
const as = require("wink-nlp/src/as.js");
// const BM25Vectorizer = require("wink-nlp/utilities/bm25-vectorizer");
// const bm25 = BM25Vectorizer();
var WordPOS = require("wordpos");
var wordpos = new WordPOS();
const similarity = require("wink-nlp/utilities/similarity.js");
const skmeans = require("skmeans");
const silhouetteCoefficient = require("../silhouette_coefficient");
const { breadth } = require("treeverse");
const { writeFileSync, unlinkSync } = require("fs");
const { spawnSync } = require("child_process");
const distinctColors = require("distinct-colors").default; // TODO make 20 nice distinct colors and make the global for each nodeLabel
var paletteKmeans, paletteSingleLink, paletteCompleteLink;
const max_old_space_size = require("v8").getHeapStatistics().total_available_size / 1024 / 1024;
var hierarchicalCluster = require("hierarchical-clustering");
// const clone = require("clone");

// ----

process.on("message", (message) => {
  childTermAnalysis(
    message.sanitizedId,
    message.sanitizedSavedAnalysisId,
    message.sanitizedUpperNodeLimit,
    message.sanitizedUpperSubdirNum,
    message.sanitizedPythonSupport,
    message.sanitizedLowerNodeLimit,
    message.sanitizedPythonUpperNodeLimit,
    message.sanitizedPythonLowerNodeLimit,
    message.sanitizedAggressiveTrimming,
    message.sanitizedUseEmbeddedFrequentTreeMining,
    message.sanitizedNoOfMicrofrontends
  );
});

// ----

const childTermAnalysis = async (
  sanitizedId,
  sanitizedSavedAnalysisId,
  sanitizedUpperNodeLimit,
  sanitizedUpperSubdirNum,
  sanitizedPythonSupport,
  sanitizedLowerNodeLimit,
  sanitizedPythonUpperNodeLimit,
  sanitizedPythonLowerNodeLimit,
  useAggressiveTrimming,
  sanitizedUseEmbeddedFrequentTreeMining,
  sanitizedNoOfMicrofrontends
) => {
  try {
    await connectDB(process.env.MONGO_DB_URI);

    const site = await DB_Model_Sites.findById(sanitizedId);

    if (site.subdirsname.length === 0) {
      throw new Error(
        "Site has 0 subdirectories. At least 1 subdirectories are needed in order to analyze the site."
      );
    }

    // ---------------------------------------------------------------------------
    // Explanation of parameters
    // sanitizedUpperSubdirNum: specifies the max number of subdirectories that will be analyzed. Default is 15
    //
    // sanitizedPythonSupport: Max number of support used as parameter for the python gspan algorithm. Default is sanitizedUpperSubdirNum.
    //
    // sanitizedLowerNodeLimit: Only used to trim smaller trees in the keepLargestTreesCleanUp when I have enabled the sanitizedUseEmbeddedFrequentTreeMining and do my merging. Basically it sets a minimum node limit below which the trees are trimmed. Default is sanitizedPythonLowerNodeLimit.
    //
    // sanitizedPythonUpperNodeLimit: Parameter used for the python gspan algorithm that specifies the max number of vertices. Default is 9999 or sanitizedPythonLowerNodeLimit if sanitizedPythonUpperNodeLimit < sanitizedPythonLowerNodeLimit.
    //
    // sanitizedPythonLowerNodeLimit: Parameter used for the python gspan algorithm that specifies the min number of vertices. Default is 3.
    //
    // sanitizedAggressiveTrimming: It discards all trees found from gspan frequent tree mining and keeps only the ones with the largest number of nodes. (Use only if the site has many elements and the uses excessive ammount of memory for your computer).
    //
    // sanitizedUseEmbeddedFrequentTreeMining: use the embeded merging of smaller frequent trees.
    //
    // sanitizedNoOfMicrofrontends: Specifies the max number of microfrontends that we will search for. Basically specifies the max number of clusters that we will use for the clustering algorithms.
    // ---------------------------------------------------------------------------

    sanitizedUpperSubdirNum = parseInt(sanitizedUpperSubdirNum) || 15;
    sanitizedPythonLowerNodeLimit = parseInt(sanitizedPythonLowerNodeLimit) || 3;
    sanitizedPythonUpperNodeLimit = parseInt(sanitizedPythonUpperNodeLimit) || 9999;
    // if upper limit is lower than lower limit then set upper limit = lower limit
    sanitizedPythonUpperNodeLimit =
      sanitizedPythonUpperNodeLimit < sanitizedPythonLowerNodeLimit
        ? sanitizedPythonLowerNodeLimit
        : sanitizedPythonUpperNodeLimit;

    sanitizedLowerNodeLimit ??= sanitizedPythonLowerNodeLimit;
    // sanitizedUpperNodeLimit ??= sanitizedPythonUpperNodeLimit;

    // in case there are less subdirs than the upper limit
    sanitizedUpperSubdirNum =
      sanitizedUpperSubdirNum > site.subdirsname.length ? site.subdirsname.length : sanitizedUpperSubdirNum;

    sanitizedPythonSupport = parseInt(sanitizedPythonSupport) || sanitizedUpperSubdirNum;
    if (sanitizedPythonSupport < 1) {
      throw new Error("pythonsupport cannot be less than 1");
    }

    sanitizedNoOfMicrofrontends = parseInt(sanitizedNoOfMicrofrontends) || null;

    let nodesDirArr = []; // each index is a site directory
    // each subdirectory of the site is passed in extractTerms to get back the terms. I am also passing the index of the subdirectory so that I can use it as part of the Id of each node
    let domFromAllSubdirs = [];
    let countId = 0;
    for (let i = 0; i < sanitizedUpperSubdirNum; i++) {
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

    // cosine similarity between node and subdir
    // const cosineSimilarityPerSubd = getCosineSimilarityPerSubd(nodesDirArr);

    // [node(terms) x node(terms)] -> clusters
    // cos similarity between all nodes using their terms bows
    console.log("Before getKmeansNodexNode and getHierarchicalNodexNode");
    const { maxAllresKmeans, clusteredBowKmeans } = getKmeansNodexNode(
      nodesDirArr,
      sanitizedNoOfMicrofrontends
    );
    const { maxAllresSingleLink, clusteredBowSingleLink, maxAllresCompleteLink, clusteredBowCompleteLink } =
      getHierarchicalNodexNode(nodesDirArr, sanitizedNoOfMicrofrontends);
    //
    // if there is no sanitizedNoOfMicrofrontends parameter then assign the one that was chosen by the algorithm so that I can export the value later
    // //sanitizedNoOfMicrofrontends ??= maxAllres.k;
    //
    // I both modify the dom and make the gspan format for efficiency purposes so that I don't have to iterate the doms twice
    console.log("Before convertToGspanFormatAndModifyDom");
    const { gspanFormatKmeans, gspanFormatSingleLink, gspanFormatCompleteLink } =
      convertToGspanFormatAndModifyDom(
        domFromAllSubdirs,
        sanitizedSavedAnalysisId,
        maxAllresKmeans,
        maxAllresSingleLink,
        maxAllresCompleteLink,
        site.url
      );

    // adds stylization info (colored rectangles) to dom elements that belong in a cluster (doesn't actually stylize them)
    stylizeDomElementsByClusterLabel(
      domFromAllSubdirs,
      maxAllresKmeans,
      maxAllresSingleLink,
      maxAllresCompleteLink
    );

    console.log("Before pythonGspan kmeans");
    const gspanOutKmeans = pythonGspan(
      sanitizedSavedAnalysisId,
      sanitizedPythonUpperNodeLimit,
      sanitizedPythonLowerNodeLimit,
      sanitizedPythonSupport,
      "gspanInKmeans.txt"
    );
    console.log("Before pythonGspan singlelink");
    const gspanOutSingleLink = pythonGspan(
      sanitizedSavedAnalysisId,
      sanitizedPythonUpperNodeLimit,
      sanitizedPythonLowerNodeLimit,
      sanitizedPythonSupport,
      "gspanInSingleLink.txt"
    );
    console.log("Before pythonGspan completelink");
    const gspanOutCompleteLink = pythonGspan(
      sanitizedSavedAnalysisId,
      sanitizedPythonUpperNodeLimit,
      sanitizedPythonLowerNodeLimit,
      sanitizedPythonSupport,
      "gspanInCompleteLink.txt"
    );

    // const { readFileSync } = require("fs");
    // const gspanOut = JSON.parse(readFileSync("debugtest.txt"));

    console.log("Before gspanOutToDotGraph");
    const dotgraphTreesKmeans = gspanOutKmeans.graphs
      ? gspanOutToDotGraph(
          gspanOutKmeans,
          domFromAllSubdirs,
          clusteredBowKmeans,
          maxAllresKmeans,
          // sanitizedUpperNodeLimit,
          sanitizedLowerNodeLimit,
          useAggressiveTrimming,
          sanitizedUseEmbeddedFrequentTreeMining
        )
      : null;

    const dotgraphTreesSingleLink = gspanOutSingleLink.graphs
      ? gspanOutToDotGraph(
          gspanOutSingleLink,
          domFromAllSubdirs,
          clusteredBowSingleLink,
          maxAllresSingleLink,
          // sanitizedUpperNodeLimit,
          sanitizedLowerNodeLimit,
          useAggressiveTrimming,
          sanitizedUseEmbeddedFrequentTreeMining
        )
      : null;

    const dotgraphTreesCompleteLink = gspanOutCompleteLink.graphs
      ? gspanOutToDotGraph(
          gspanOutCompleteLink,
          domFromAllSubdirs,
          clusteredBowCompleteLink,
          maxAllresCompleteLink,
          // sanitizedUpperNodeLimit,
          sanitizedLowerNodeLimit,
          useAggressiveTrimming,
          sanitizedUseEmbeddedFrequentTreeMining
        )
      : null;

    // adds the stylizing info for the frequent dotGraphs trees' leaves and for the html elements that correspond to those dotgraph trees' leaves
    addStylesForDotGraphsInDoms(dotgraphTreesKmeans, domFromAllSubdirs, "Kmeans", paletteKmeans);
    addStylesForDotGraphsInDoms(dotgraphTreesSingleLink, domFromAllSubdirs, "SingleLink", paletteSingleLink);
    addStylesForDotGraphsInDoms(
      dotgraphTreesCompleteLink,
      domFromAllSubdirs,
      "CompleteLink",
      paletteCompleteLink
    );

    // make terms of nodesDirArr from array to bow
    convertNodesDirArrTermsToBow(nodesDirArr);

    // not saving dotOrigins due to its size
    delete dotgraphTreesKmeans?.dotOrigins;
    delete dotgraphTreesSingleLink?.dotOrigins;
    delete dotgraphTreesCompleteLink?.dotOrigins;

    const newAnalysis = await DB_Model_Analysis.findOneAndUpdate(
      { _id: sanitizedSavedAnalysisId },
      {
        status: `Completed analyzing Ok.`, // With minimum kmeans subdir support=${Math.min(...gspanOutKmeans.support)}. Also UpperSubdirNum=${sanitizedUpperSubdirNum}, noOfMicrofrontends=${sanitizedNoOfMicrofrontends}; PythonUpperNodeLimit=${sanitizedPythonUpperNodeLimit}, PythonLowerNodeLimit=${sanitizedPythonLowerNodeLimit} and PythonSupport=${sanitizedPythonSupport}`,
        parameters: {
          // sanitizedUpperNodeLimit,
          upperSubdirNum: sanitizedUpperSubdirNum,
          pythonSupport: sanitizedPythonSupport,
          lowerNodeLimit: sanitizedLowerNodeLimit,
          pythonUpperNodeLimit: sanitizedPythonUpperNodeLimit,
          pythonLowerNodeLimit: sanitizedPythonLowerNodeLimit,
          noOfMicrofrontends: sanitizedNoOfMicrofrontends,
          aggressiveTrimming: useAggressiveTrimming,
          useEmbeddedFrequentTreeMining: sanitizedUseEmbeddedFrequentTreeMining,
        },
        analysis: {
          dotgraphTreesKmeans,
          dotgraphTreesSingleLink,
          dotgraphTreesCompleteLink,
          // gspanOut: { graphs: gspanOut.graphs, support: gspanOut.support, where: gspanOut.where }, // removed gspanOut.origins
          // gspanIn,

          clusteredBowKmeans,
          clusteredBowSingleLink,
          clusteredBowCompleteLink,
          // testcluster: [...testcluster],
          maxAllresKmeans,
          maxAllresSingleLink,
          maxAllresCompleteLink,
          subdirsname: site.subdirsname,
          nodes: nodesDirArr,
          backRenderedDoms: domFromAllSubdirs.map((dom) => dom.toString()),
          // allDirsBow,
          // bm25Matrix,
          // bm25Terms,
          // tfidfNodesMatrix,
          // cosineSimilarityPerSubd,
        },
        analysisDate: new Date(),
      },
      { new: true } // , upsert: true }
    );
    console.log("Finito");
    process.exit();
  } catch (error) {
    try {
      const newAnalysis = await DB_Model_Analysis.findOneAndUpdate(
        { _id: sanitizedSavedAnalysisId },
        {
          status: "Error analyzing: " + error.message,
          analysis: null,
          analysisDate: new Date(),
        },
        { new: true } // , upsert: true }
      );
    } catch (error) {
      console.log("error saving the error in status: " + error.message);
      process.exit();
    }
    console.log(error.message);
    process.exit();
  }
};

// ----------------------------------------------------

const gspanOutToDotGraph = (
  gspanOut,
  domFromAllSubdirs,
  clusteredBow,
  maxAllres,
  // sanitizedUpperNodeLimit,
  sanitizedLowerNodeLimit,
  useAggressiveTrimming,
  sanitizedUseEmbeddedFrequentTreeMining
) => {
  const minSupport = Math.min(...gspanOut.support);

  const numOfDigraphsToKeep = 30;

  // let dotGraphsTemp = [];
  // let dotSupport = [];
  // let dotWhere = [];
  // let dotOrigins = [];
  // const tempList = [];

  // // sort based on support
  // for (let i = 0; i < gspanOut.support.length; i++) {
  //   tempList.push({
  //     graphs: gspanOut.graphs[i],
  //     support: gspanOut.support[i],
  //     where: gspanOut.where[i],
  //     origins: gspanOut.origins[i],
  //   });
  // }
  // // sort descending based on support. If support is the same then sort descending based on size of graph tree
  // tempList.sort((a, b) => {
  //   const sorter = b.support - a.support;
  //   if (sorter === 0) {
  //     return b.graphs.length - a.graphs.length;
  //   }
  //   return sorter;
  // });

  // for (let i = 0; i < gspanOut.support.length; i++) {
  //   dotGraphsTemp.push(tempList[i].graphs);
  //   dotSupport.push(tempList[i].support);
  //   dotWhere.push(tempList[i].where);
  //   dotOrigins.push(tempList[i].origins);
  // }

  // -----

  //
  // ------------------------------------------

  // sort the trees based on support, number of edges, number of numbered labels (non -1) on the vertices and number of origins
  const sortTreesBasedOnSupportEdgeLabelsOrigins = (graphs, support, where, origins) => {
    const tempList = [];

    const nodeLabels = [];
    for (let i = 0; i < graphs.length; i++) {
      nodeLabels.push(Array.from(graphs[i].join("\n").matchAll(/^v -?\d+ (\d+)$/gm), (x) => x[1]));
    }

    for (let i = 0; i < support.length; i++) {
      tempList.push({
        graphs: graphs[i],
        support: support[i],
        where: where[i],
        origins: origins[i],
        nodeLabel: nodeLabels[i],
      });
    }
    // sorting
    tempList.sort((a, b) => {
      const sorter = b.support - a.support;
      if (sorter === 0) {
        const sorter2 = b.nodeLabel.length - a.nodeLabel.length;
        if (sorter2 === 0) {
          const sorter3 = b.graphs.length - a.graphs.length;
          if (sorter3 === 0) {
            const boriglen = b.origins.reduce((len, x) => len + x.length, 0);
            const aoriglen = a.origins.reduce((len, x) => len + x.length, 0);
            return boriglen - aoriglen;
          }
          return sorter3;
        }
        return sorter2;
      }
      return sorter;
    });

    let dotGraphsTemp = [];
    let dotSupport = [];
    let dotWhere = [];
    let dotOrigins = [];

    for (let i = 0; i < support.length; i++) {
      dotGraphsTemp.push(tempList[i].graphs);
      dotSupport.push(tempList[i].support);
      dotWhere.push(tempList[i].where);
      dotOrigins.push(tempList[i].origins);
    }

    return { dotGraphsTemp, dotSupport, dotWhere, dotOrigins };
  };

  // -----------------

  const deleteTreesBasedOnNumberedLabels = (dotGraphsTemp, dotWhere, dotOrigins) => {
    // if the number of trees is small (less than 10), then do nothing
    if (dotOrigins.length < 10) {
      return;
    }

    // make a temporary nodeLabels array to clean up data
    const nodeLabels = [];
    for (let i = 0; i < dotGraphsTemp.length; i++) {
      nodeLabels.push(Array.from(dotGraphsTemp[i].join("\n").matchAll(/^v -?\d+ (\d+)$/gm), (x) => x[1]));
    }
    // remove graphs that have less than 1 numbered labels (when I say numbered I mean non -1). Basically remove trees with only -1
    for (let i = 0; i < nodeLabels.length; i++) {
      if (nodeLabels[i].length < 1) {
        dotGraphsTemp.splice(i, 1);
        dotWhere.splice(i, 1);
        // dotSupport.splice(i, 1);
        dotOrigins.splice(i, 1);
        nodeLabels.splice(i, 1);
        // nodeEdges.splice(i, 1);
        i--;
      }
    }
    // // sort and filter to be used for later analyzing and cleanup
    // for (let i = 0; i < nodeLabels.length; i++) {
    //   nodeLabels[i] = nodeLabels[i].filter((x) => x !== "-1");
    //   nodeLabels[i].sort();
    // }
  };

  // -----------------

  const calculateMergeRank = (graphi, graphj, dotWherei, dotWherej, commonWhere) => {
    let rankAll = [];
    let total = 0;
    let rank = 0;

    for (let s of commonWhere) {
      // si and sj are made to point at subdirectory s for each of the graphs
      // the subdirectory s might be at a different index between two graphs if eg. one graph doesn't appear in one subdirectory when their support is different
      // eg. if one has support at the subdirs [0,3,5] and the other at [3,4,5] and i an at subdir s=3 then it would be si=1 and sj=0 in order for the graph to point to the same subdir
      const si = dotWherei.indexOf(s);
      const sj = dotWherej.indexOf(s);

      for (let ssi = 0; ssi < graphi[si].length; ssi++) {
        for (let ssj = 0; ssj < graphj[sj].length; ssj++) {
          total++;
          // edges per graph
          loop1: for (let sssi = 0; sssi < graphi[si][ssi].length; sssi++) {
            for (let sssj = 0; sssj < graphj[sj][ssj].length; sssj++) {
              // if they have at least one common edge then I can merge that origin graph
              if (
                graphi[si][ssi][sssi][0] === graphj[sj][ssj][sssj][0] &&
                graphi[si][ssi][sssi][1] === graphj[sj][ssj][sssj][1]
              ) {
                rank++;
                break loop1;
              }
            }
          }
        }
      }
      rankAll.push(rank / total);
      rank = 0;
      total = 0;
    }
    return rankAll;
  };

  // -----------------

  const createMergeOrigin = (graphi, graphj, dotWherei, dotWherej, commonWhere, minSupport) => {
    const newMerged = [];
    const newWhere = [];

    // about the indices that come from index=tempCommonEdges.join(";"). indices that i have found are duplicate of others so i can omit them
    const indicesToOmit = [];
    // I use the below list to check the new tempEdges for duplicates in isItDuplicateInList. I would use the commonEdges but it's not in a convenient format that isItDuplicateInList wants. Also it's a bit better for speed
    const originsListToCheckAgainstNewIndexForDuplicate = {};

    // it saves the different kind of common edges that may exist between two graphs in each subdirectory and saves the new merged graph that comes from that. Each key of the object is a combination of the index of the common edges and the value is a number that indicates the subdirectory which in turn is a key for an object where the values is a list which lists all the different merged trees that come from this merge.
    // eg. if graph ssi=3 and graph ssj=6 at subdirectory s=1 have two common edges at sssi=2 and sssj=4 and another two at ssi=3 and ssj=5, then commonEdges would be commonEdges['2,4;3,5'][1]=[ [[xx1,x2], [xx3,xx4],[xx5,xx6]] , [...] ] where xx are the different edges that come as a result of the merge (basically add the edges from both graphs and remove doubles).
    const commonEdges = {};

    for (let s of commonWhere) {
      const si = dotWherei.indexOf(s);
      const sj = dotWherej.indexOf(s);

      // graphs per subdirectory
      for (let ssi = 0; ssi < graphi[si].length; ssi++) {
        for (let ssj = 0; ssj < graphj[sj].length; ssj++) {
          const tempEdges = [];
          const tempCommonEdges = [];
          // edges per graph
          for (let sssi = 0; sssi < graphi[si][ssi].length; sssi++) {
            for (let sssj = 0; sssj < graphj[sj][ssj].length; sssj++) {
              // if they have at least one common edge then I can merge that origin graph
              if (
                graphi[si][ssi][sssi][0] === graphj[sj][ssj][sssj][0] &&
                graphi[si][ssi][sssi][1] === graphj[sj][ssj][sssj][1]
              ) {
                //

                tempCommonEdges.push([sssi, sssj]);
                if (
                  !tempEdges.some((edge) => {
                    return edge[0] == graphi[si][ssi][sssi][0] && edge[1] == graphi[si][ssi][sssi][1];
                  })
                ) {
                  tempEdges.push([graphi[si][ssi][sssi][0], graphi[si][ssi][sssi][1]]);
                }
              }

              //
              else {
                if (
                  !tempEdges.some((edge) => {
                    return edge[0] == graphi[si][ssi][sssi][0] && edge[1] == graphi[si][ssi][sssi][1];
                  })
                ) {
                  tempEdges.push([graphi[si][ssi][sssi][0], graphi[si][ssi][sssi][1]]);
                }
                if (
                  !tempEdges.some((edge) => {
                    return edge[0] == graphj[sj][ssj][sssj][0] && edge[1] == graphj[sj][ssj][sssj][1];
                  })
                ) {
                  tempEdges.push([graphj[sj][ssj][sssj][0], graphj[sj][ssj][sssj][1]]);
                }
              }
            }
          }

          if (tempCommonEdges.length > 0) {
            const index = tempCommonEdges.join(";");

            if (indicesToOmit.includes(index)) {
              continue;
            }
            if (s === commonWhere[0]) {
              maxNumEdges = tempEdges.length > maxNumEdges ? tempEdges.length : maxNumEdges;
              if (
                (!originsListToCheckAgainstNewIndexForDuplicate[index] &&
                  isItDuplicateInList(
                    tempEdges,
                    Object.values(originsListToCheckAgainstNewIndexForDuplicate)
                  )) ||
                (useAggressiveTrimming && tempEdges.length < maxNumEdges)
              ) {
                indicesToOmit.push(index);
                continue;
              }
              if (!originsListToCheckAgainstNewIndexForDuplicate[index]) {
                originsListToCheckAgainstNewIndexForDuplicate[index] = [[tempEdges]];
              }
            }

            if (commonEdges[index] === undefined) {
              commonEdges[index] = {};
            }
            if (commonEdges[index][s] === undefined) {
              commonEdges[index][s] = [];
            }

            commonEdges[index][s].push(tempEdges);
          }

          //
        }
      }

      // AllSubdirsCommonEdges[s] = commonEdges;

      // // if nothing was added then remove the empty list
      // if (newMerged.at(-1).length === 0) {
      //   newMerged.pop();
      //   newWhere.pop();
      // }
      // //
    }

    for (let o of Object.values(commonEdges)) {
      if (
        Object.keys(o).length < minSupport ||
        isItDuplicateInList(o[0][0], newMerged) ||
        (useAggressiveTrimming && o[0][0].length < maxNumEdges)
      ) {
        continue;
      }

      newMerged.push([]);
      newWhere.push(Object.keys(o));
      for (let s of Object.values(o)) {
        newMerged.at(-1).push(s);
      }
    }
    // // ---
    // newMerged.at(-1).push([]);
    // for (let ki = 0; ki < graphi[si][ssi].length; ki++) {
    //   newMerged.at(-1).at(-1).push(graphi[si][ssi][ki]);
    // }
    // for (let kj = 0; kj < graphj[sj][ssj].length; kj++) {
    //   if (
    //     newMerged
    //       .at(-1)
    //       .at(-1)
    //       .some((edge) => {
    //         return edge[0] == graphj[sj][ssj][kj][0] && edge[1] == graphj[sj][ssj][kj][1];
    //       })
    //   ) {
    //     continue;
    //   }
    //   newMerged.at(-1).at(-1).push(graphj[sj][ssj][kj]);
    // }

    return { newMerged, newWhere };
  };

  // -----------------

  const createTempGraphFromOrigin = (origin, dom, maxAllresIdxs) => {
    let counter = 0;
    const edgesToAddAtTheEnd = [];
    const graph = ["t # 99"];
    const vertexToCheck = {};

    const origin2 = origin.slice().sort((a, b) => {
      return a[0] - b[0];
    });

    // const vertices = [...new Set(origin.flat(10))].forEach((o, i) => {
    //   const index = dom.querySelector(`[vertexCounter=${o}]`).getAttribute("customId")?.split(";")[1];
    //   const label = index !== undefined ? maxAllresIdxs[index] : "-1";
    //   graph.push(`v ${i} ${label}`);
    //   return label;
    // });

    for (let o of origin2) {
      if (vertexToCheck[o[0]] === undefined) {
        const index1 = dom.querySelector(`[vertexCounter=${o[0]}]`).getAttribute("customId")?.split(";")[1];
        const label1 = index1 !== undefined ? maxAllresIdxs[index1] : "-1";
        graph.push(`v ${counter} ${label1}`);
        vertexToCheck[o[0]] = counter;
        counter++;
      }
      if (vertexToCheck[o[1]] === undefined) {
        const index2 = dom.querySelector(`[vertexCounter=${o[1]}]`).getAttribute("customId")?.split(";")[1];
        const label2 = index2 !== undefined ? maxAllresIdxs[index2] : "-1";
        graph.push(`v ${counter} ${label2}`);
        vertexToCheck[o[1]] = counter;
        counter++;
      }
      edgesToAddAtTheEnd.push(`e ${vertexToCheck[o[0]]} ${vertexToCheck[o[1]]} -1`);
    }

    graph.push(...edgesToAddAtTheEnd);

    return graph;
    //
  };

  // -----------------

  const createDotGraphsFromDotGraphsTemp = (dotGraphsTemp, clusteredBow) => {
    let title = 0;
    const dotGraphs = [];

    for (let graph of dotGraphsTemp) {
      //
      // also change the title of dotGraphsTemp to match the title of its corresponding dotGraph
      graph[0] = "t # " + title;

      const dotg = [`digraph ${title} {`];

      for (let i = 1; i < graph.length; i++) {
        if (graph[i].startsWith("v")) {
          const num = graph[i].split(" ");
          const words =
            num[2] !== "-1"
              ? Object.entries(clusteredBow[num[2]])
                  .map((x) => `${x[0]}  ${x[1]}`)
                  .slice(0, 20)
                  .join("\n")
              : "";
          dotg.push(`${num[1]} [label="${num[2]}; (${num[1]})\n${words}"]`);
        } else if (graph[i].startsWith("e")) {
          const num = graph[i].split(" ");
          dotg.push(`${num[1]} -> ${num[2]}`);
        }
      }

      dotg.push("}");
      dotGraphs.push(dotg);
      title++;
    }
    return dotGraphs;
  };

  // TODOTODO make a isItDuplicateInList that searches an origin against all the origins of a subdir instead of only the first one. check their commonWhere and do that in the subdirectory with the least amount of origins

  // -----------------
  // checks if an origin already exists in a list of origins. The list must be in the form of dotOrigins. Warning: it does a shallow check. It checks only the first origin
  const isItDuplicateInList = (newMerged0, newMergedList) => {
    // TODO it would be better to find the common subdir first and compare the first origin there
    let j, i, k;
    for (j = 0; j < newMergedList.length; j++) {
      if (newMerged0.length !== newMergedList[j][0][0].length) {
        continue;
      }

      //
      for (i = 0; i < newMerged0.length; i++) {
        //

        for (k = 0; k < newMerged0.length; k++) {
          if (
            newMerged0[i][0] === newMergedList[j][0][0][k][0] &&
            newMerged0[i][1] === newMergedList[j][0][0][k][1]
          ) {
            break;
          }
        }

        if (k === newMerged0.length) {
          break;
        }

        //
      }
      if (i === newMerged0.length) {
        return true;
      }

      //
    }

    return false;
  };

  // -----------------
  // checks if a tempGraph already exists in a list of newTempGraphsList
  const isTempGraphDuplicateInList = (tempGraph, newTempGraphsList) => {
    let i, j, k;
    for (i = 0; i < newTempGraphsList.length; i++) {
      if (tempGraph.length !== newTempGraphsList[i].length) {
        continue;
      }

      //
      for (j = 1; j < tempGraph.length; j++) {
        //

        for (k = 1; k < newTempGraphsList[i].length; k++) {
          if (tempGraph[j] === newTempGraphsList[i][k]) {
            break;
          }
        }

        if (k === tempGraph.length) {
          break;
        }

        //
      }
      if (j === tempGraph.length) {
        return true;
      }

      //
    }

    return false;
  };

  // -----------------

  const createDotFreqTreeFromOrigin = (origin, dom, maxAllresIdxs, title) => {
    const freqTree = new Set();
    freqTree.add(`digraph ${title} {`);

    for (let g of origin) {
      const index1 = dom.querySelector(`[vertexCounter=${g[0]}]`).getAttribute("customId")?.split(";")[1];
      const index2 = dom.querySelector(`[vertexCounter=${g[1]}]`).getAttribute("customId")?.split(";")[1];
      const label1 = index1 !== undefined ? maxAllresIdxs[index1] : "-1";
      const label2 = index2 !== undefined ? maxAllresIdxs[index2] : "-1";
      freqTree.add(`${g[0]} [label="${label1}"]`);
      freqTree.add(`${g[1]} [label="${label2}"]`);
      freqTree.add(`${g[0]} -> ${g[1]}`);
    }
    freqTree.add("}");
    return [...freqTree];
  };

  // -------------------

  const mergeOrigin = (graphi, graphj) => {
    // const commonEdges = [];

    // I use the originalLengthi because the graphi.length increases as I add things to graphi and I only care to compare the original graphs
    const originalLengthi = graphi.length;
    loop1: for (let j = 0; j < graphj.length; j++) {
      for (let i = 0; i < originalLengthi; i++) {
        if (graphi[i][0] === graphj[j][0] && graphi[i][1] === graphj[j][1]) {
          // commonEdges.push(graphi[i]);
          continue loop1;
        }
      }
      graphi.push(graphj[j]);
    }
  };

  // ------------------

  // TODOTODO change hard coded values according to queries
  const cleanFrequentTrees = (dotgraphs, dotOrigins, dotWhere, dotSupport) => {
    for (let i = 0; i < dotOrigins.length; i++) {
      if (dotgraphs[i].length > 11) {
        continue;
      }
      let totalGraphs = 0;
      dotOrigins[i].forEach((graphs) => (totalGraphs += graphs.length));
      if (totalGraphs < 25) {
        dotOrigins.splice(i, 1);
        dotgraphs.splice(i, 1);
        dotWhere.splice(i, 1);
        dotSupport.splice(i, 1);
        i--;
      }
    }
  };

  // -------------------

  const areDotTreesSame = (graph1, graph2) => {
    const labels1 = [];
    const labels2 = [];
    const edges1 = [];
    const edges2 = [];
    const tree1 = {};
    const tree2 = {};
    for (let g of graph1) {
      if (g.startsWith("[label=")) {
        labels1.push(g.split('"')[1]);
      } else if (g.includes("->")) {
        const splitted = g.split(" -> ");
        edges1.push([splitted[0], splitted[1]]);
      }
    }
    for (let g of graph2) {
      if (g.startsWith("[label=")) {
        labels2.push(g.split('"')[1]);
      } else if (g.includes("->")) {
        const splitted = g.split(" -> ");
        edges2.push([splitted[0], splitted[1]]);
      }
    }

    //
  };

  // -------------------

  // remove subtrees that already exist in bigger trees
  const removeSameSubTrees = (dotGraphsTemp, dotWhere, dotOrigins) => {
    let i, j, k, m;
    for (i = 0; i < dotOrigins.length; i++) {
      for (j = i + 1; j < dotOrigins.length; j++) {
        // if they have the same length then there is no way for one to be a subgraph of the other
        if (dotOrigins[i][0][0].length === dotOrigins[j][0][0].length) {
          continue;
        }

        //
        const lesserIndex = dotOrigins[i][0][0].length < dotOrigins[j][0][0].length ? i : j;
        const greaterIndex = dotOrigins[i][0][0].length < dotOrigins[j][0][0].length ? j : i;
        for (m = 0; m < dotOrigins[lesserIndex][0][0].length; m++) {
          //

          for (k = 0; k < dotOrigins[greaterIndex][0][0].length; k++) {
            if (
              dotOrigins[lesserIndex][0][0][m][0] === dotOrigins[greaterIndex][0][0][k][0] &&
              dotOrigins[lesserIndex][0][0][m][1] === dotOrigins[greaterIndex][0][0][k][1]
            ) {
              break;
            }
          }

          if (k === dotOrigins[greaterIndex][0][0].length) {
            break;
          }

          //
        }
        if (m === dotOrigins[lesserIndex][0][0].length) {
          dotGraphsTemp.splice(lesserIndex, 1);
          dotWhere.splice(lesserIndex, 1);
          // dotSupport.splice(i,1);
          if (dotOrigins[i][0][0].length < dotOrigins[j][0][0].length) {
            dotOrigins.splice(lesserIndex, 1);
            i--;
            break;
          }
          dotOrigins.splice(lesserIndex, 1);
          j--;
          //
        }

        //
      }
    }

    //
  };
  // -----------------

  // delete smaller frequent trees in order to reduce memory usage during merging. Keeps the trees with the higher edges/vertices available
  const keepLargestTreesCleanUp = (dotGraphsTemp, dotWhere, dotOrigins) => {
    // if the number of trees is small (less than 10), then do nothing
    if (dotOrigins.length < 10) {
      return;
    }

    // if useAggressiveTrimming is true then it keeps only the trees with the largest number of nodes, otherwise it follows the sanitizedLowerNodeLimit input
    // the reason I multiply sanitizedLowerNodeLimit with 2 is because I measure the length of tree for convenience and speed during comparing. And the length of the tree is twice the number of nodes. (number of nodes)=(number of edges)-1+(title line)
    const largestLength = useAggressiveTrimming
      ? Math.max(...dotGraphsTemp.map((x) => x.length))
      : sanitizedLowerNodeLimit * 2;
    for (let i = 0; i < dotGraphsTemp.length; i++) {
      if (dotGraphsTemp[i].length < largestLength) {
        dotGraphsTemp.splice(i, 1);
        dotWhere.splice(i, 1);
        // dotSupport.splice(i,1);
        dotOrigins.splice(i, 1);
        i--;
      }
    }
  };

  //
  // ------------------------------------------------

  let { dotGraphsTemp, dotSupport, dotWhere, dotOrigins } = sortTreesBasedOnSupportEdgeLabelsOrigins(
    gspanOut.graphs,
    gspanOut.support,
    gspanOut.where,
    gspanOut.origins
  );

  if (useAggressiveTrimming) {
    keepLargestTreesCleanUp(dotGraphsTemp, dotWhere, dotOrigins);
    deleteTreesBasedOnNumberedLabels(dotGraphsTemp, dotWhere, dotOrigins);
  }

  // the max number of edges that the current biggest tree holds. It gets updated during the merging process
  let maxNumEdges = dotOrigins[0][0][0].length;

  let newMergedList;
  let newWhereList;
  let newTempGraphsList;

  doloop: do {
    //
    // TODO in the future also add to break if sanitizedUpperNodeLimit<=sanitizedPythonUpperNodeLimit because that means that I don't need to merge further. All merging that I want was achieved in gspan
    if (!sanitizedUseEmbeddedFrequentTreeMining) {
      break doloop;
    }

    newMergedList = [];
    newWhereList = [];
    newTempGraphsList = [];

    // merging process
    for (let i = 0; i < dotOrigins.length; i++) {
      for (let j = i + 1; j < dotOrigins.length; j++) {
        //

        // find common subdirectories to merge together later on
        const commonWhere = dotWhere[i].filter((x) => dotWhere[j].includes(x));

        // const rankAll = calculateMergeRank(dotOrigins[i], dotOrigins[j], dotWhere[i], dotWhere[j], commonWhere);
        // // if rank and support of merged tree is less that required then don't merge
        // if (rankAll.filter((rank) => rank > 0.4).length < minSupport) {
        //   continue;
        // }

        //
        const { newMerged, newWhere } = createMergeOrigin(
          dotOrigins[i],
          dotOrigins[j],
          dotWhere[i],
          dotWhere[j],
          commonWhere,
          minSupport
        );

        for (let o = 0; o < newMerged.length; o++) {
          // check if merge already exists from previous merge or in the dotOrigins
          if (
            isItDuplicateInList(newMerged[o][0][0], newMergedList) ||
            isItDuplicateInList(newMerged[o][0][0], dotOrigins)
          ) {
            continue;
          }

          const tempGraph = createTempGraphFromOrigin(
            newMerged[o][0][0],
            domFromAllSubdirs[newWhere[o][0]],
            maxAllres.idxs
          );

          // second check for duplicates based on the tempGraph as opposed to the first origin because sometimes the origins are not in the same order and the first origin that I check can be elsewhere. Maybe the previous check isItDuplicateInList has become obsolete now
          if (
            isTempGraphDuplicateInList(tempGraph, newTempGraphsList) ||
            isTempGraphDuplicateInList(tempGraph, dotGraphsTemp)
          ) {
            continue;
          }

          newMergedList.push(newMerged[o]);
          newWhereList.push(newWhere[o]);
          newTempGraphsList.push(tempGraph);
        }

        // regular checks if memory usage is too much
        if (process.memoryUsage().heapTotal / 1024 / 1024 + 1024 > max_old_space_size) {
          dotGraphsTemp.push(...newTempGraphsList);
          dotOrigins.push(...newMergedList);
          dotWhere.push(...newWhereList);
          // keepLargestTreesCleanUp(dotGraphsTemp, dotWhere, dotOrigins);
          break doloop;
        }

        // the below cleanup is probably not needed for the aggressive trimming as it is also done inside createMergeOrigin. But in case a bigger merged tree is found much later then it will be used. But I can usually find the maximum maxNumEdges from the first two origins merge
        if (useAggressiveTrimming) {
          keepLargestTreesCleanUp(newTempGraphsList, newWhereList, newMergedList);
          deleteTreesBasedOnNumberedLabels(newTempGraphsList, newWhereList, newMergedList);
        }

        // ----------------
      }
    }

    // remove trees below the sanitizedLowerNodeLimit from the original trees that created the current merges
    keepLargestTreesCleanUp(dotGraphsTemp, dotWhere, dotOrigins);

    dotGraphsTemp.push(...newTempGraphsList);
    dotOrigins.push(...newMergedList);
    dotWhere.push(...newWhereList);
    // the below cleanup is probably unnecessary
    if (useAggressiveTrimming) {
      deleteTreesBasedOnNumberedLabels(dotGraphsTemp, dotWhere, dotOrigins);
      keepLargestTreesCleanUp(dotGraphsTemp, dotWhere, dotOrigins);
    }

    // keep repeating merging as long as there are new merges (newMergedList.length !== 0) and the memory usage is less than 1gb than the max-old-space-size that I have chosen
  } while (
    newMergedList.length !== 0 &&
    process.memoryUsage().heapTotal / 1024 / 1024 + 1024 < max_old_space_size
  );

  deleteTreesBasedOnNumberedLabels(dotGraphsTemp, dotWhere, dotOrigins);
  keepLargestTreesCleanUp(dotGraphsTemp, dotWhere, dotOrigins);

  removeSameSubTrees(dotGraphsTemp, dotWhere, dotOrigins);
  //

  dotSupport = dotWhere.map((w) => {
    return w.length;
  });
  ({ dotGraphsTemp, dotSupport, dotWhere, dotOrigins } = sortTreesBasedOnSupportEdgeLabelsOrigins(
    dotGraphsTemp,
    dotSupport,
    dotWhere,
    dotOrigins
  ));

  // ----keep only a specific amount of frequent trees----
  dotGraphsTemp.splice(numOfDigraphsToKeep);
  dotWhere.splice(numOfDigraphsToKeep);
  dotOrigins.splice(numOfDigraphsToKeep);
  dotSupport.splice(numOfDigraphsToKeep);
  // ----

  // unite merged and first
  // dotGraphsTemp.push(...newTempGraphsList);
  // dotOrigins.push(...newMergedList);
  // dotWhere.push(...newWhereList);

  const dotGraphs = createDotGraphsFromDotGraphsTemp(dotGraphsTemp, clusteredBow);

  return { dotGraphs, dotWhere, dotSupport, dotGraphsTemp, dotOrigins };
};

// ----

const pythonGspan = (
  sanitizedSavedAnalysisId,
  sanitizedPythonUpperNodeLimit,
  sanitizedPythonLowerNodeLimit,
  sanitizedPythonSupport,
  fileNameEnding
) => {
  let pyProg;

  for (let i = sanitizedPythonSupport; i > 1; i--) {
    const pyArgs = [
      "-m",
      "python_lib.gspan_mining",
      "-s",
      i,
      "-l",
      sanitizedPythonLowerNodeLimit,
      "-u",
      sanitizedPythonUpperNodeLimit,
      "-w",
      "True",
      "-d",
      "True",
      sanitizedSavedAnalysisId + fileNameEnding,
    ];

    pyProg = spawnSync("pypy", pyArgs, { maxBuffer: Infinity });

    if (pyProg.stdout.toString().startsWith("t #")) {
      break;
    }
  }

  // remove file for gspan after finishing
  unlinkSync(sanitizedSavedAnalysisId + fileNameEnding);

  if (pyProg?.error) {
    console.log("python error: ", pyProg.error);
    return "Error Executing Tree mining";
  }

  if (pyProg?.stderr.toString()) {
    console.log("stderr: ", pyProg.stderr.toString());
    return "stderror executing tree mining";
  }

  // if it doesn't start with "t #" or the pyProg doesn't exist it means that it didn't find any graphs (or didn't run at all) so just return an empty object
  if (!pyProg?.stdout.toString().startsWith("t #")) {
    return {};
  }

  const allGraphs = pyProg.stdout.toString().match(/^(t|v|e).+$/gm);
  const where = Array.from(pyProg.stdout.toString().matchAll(/^where: \[(.+)\]$/gm), (x) => x[1].split(", "));
  const support = pyProg.stdout
    .toString()
    .match(/^Support.+$/gm)
    .map((x) => x.split(" ")[1]);
  const allOrigins = pyProg.stdout.toString().match(/^(((s:|o:).+)|-----------------)$/gm);
  allOrigins.pop(); // remove last dashes to make later analyzing easier

  // separate allGraphs into separate arrays of graphs. Different index in array for different graph
  const graphs = [];
  for (let line of allGraphs) {
    if (line.startsWith("v") || line.startsWith("e")) {
      graphs.at(-1).push(line);
    } else if (line.startsWith("t")) {
      if (!line.startsWith("t # -1")) {
        graphs.push([]);
        graphs.at(-1).push(line);
      } else {
        break;
      }
    }
  }

  // separate allOrigins into separate arrays. Each index holds all the origins of that subdirectory
  const origins = [[]];
  let oldSub;
  for (let line of allOrigins) {
    if (line.startsWith("o:")) {
      origins.at(-1).at(-1).at(-1).push(line.split(":")[1].split(" "));
    } else if (line.startsWith("s:")) {
      // new index for every new subdirectory in a graph. make new one for each subdirectory
      if (line.split(":")[1] !== oldSub) {
        origins.at(-1).push([]);
      }
      // new index for every group of every subdirectory of every graph. It's basically a new index for every origin of a frequent tree
      origins.at(-1).at(-1).push([]);
      oldSub = line.split(":")[1];
    } else if (line.startsWith("-----------------")) {
      // new index in the array for each graph
      origins.push([]);
      oldSub = null;
    } else {
      console.log("Unexpected condition. Check it");
    }
  }

  return { graphs, support, where, origins };
};

// ----

const convertToGspanFormatAndModifyDom = (
  domFromAllSubdirs,
  sanitizedSavedAnalysisId,
  maxAllresKmeans,
  maxAllresSingleLink,
  maxAllresCompleteLink,
  url
) => {
  let gspanFormatKmeans = [];
  let gspanFormatSingleLink = [];
  let gspanFormatCompleteLink = [];
  let vertexCounter;
  let i;

  // ----starting functions used to iterate the dom with the breadth package----
  // const getChildren = (node) => node.childNodes;
  const getChildren = (node) => {
    // TODO change if i also search for titles as well as texts
    if (!node.text) {
      return [];
    }
    return node.childNodes;
  };

  const visit = (node) => {
    //
    // if text node is empty then remove it and not show it in gspan format array
    if (node.nodeType !== 1) {
      const hasText = /\S/g.test(node.text);
      if (!hasText) {
        node.parentNode.removeChild(node);
        return;
      }
    }

    let label = node.nodeType === 1 ? node.getAttribute("customId") || "-1" : "-1";
    const kmeansClusterLabel = label === "-1" ? undefined : maxAllresKmeans.idxs[label.split(";")[1]];
    const singleLinkClusterLabel = label === "-1" ? undefined : maxAllresSingleLink.idxs[label.split(";")[1]];
    const completeLinkClusterLabel =
      label === "-1" ? undefined : maxAllresCompleteLink.idxs[label.split(";")[1]];

    // add vertices to gspanFormat array
    gspanFormatKmeans[i].push(
      `v ${vertexCounter} ${kmeansClusterLabel !== undefined ? kmeansClusterLabel : "-1"}`
    );
    gspanFormatSingleLink[i].push(
      `v ${vertexCounter} ${singleLinkClusterLabel !== undefined ? singleLinkClusterLabel : "-1"}`
    );
    gspanFormatCompleteLink[i].push(
      `v ${vertexCounter} ${completeLinkClusterLabel !== undefined ? completeLinkClusterLabel : "-1"}`
    );

    // add a vertex counter so I know that I have iterate it and added it to the gspanFormat array. Check nodeType because textNodes (type=3) don't have attributes
    if (node.nodeType !== 3) {
      node.setAttribute("vertexCounter", vertexCounter);
    }

    // add edges to gspanFormat array
    if (node.tagName !== "BODY") {
      gspanFormatKmeans[i].push(`e ${node.parentNode.getAttribute("vertexCounter")} ${vertexCounter} -1`);
      gspanFormatSingleLink[i].push(`e ${node.parentNode.getAttribute("vertexCounter")} ${vertexCounter} -1`);
      gspanFormatCompleteLink[i].push(
        `e ${node.parentNode.getAttribute("vertexCounter")} ${vertexCounter} -1`
      );
    }

    vertexCounter++;
  };
  // ----ending functions used to iterate the dom with the breadth package-----

  //
  // loop for every subdir
  for (i = 0; i < domFromAllSubdirs.length; i++) {
    vertexCounter = 0;
    gspanFormatKmeans.push([]);
    gspanFormatKmeans[i].push("t # " + i);
    gspanFormatSingleLink.push([]);
    gspanFormatSingleLink[i].push("t # " + i);
    gspanFormatCompleteLink.push([]);
    gspanFormatCompleteLink[i].push("t # " + i);
    const body = domFromAllSubdirs[i].getElementsByTagName("body")[0];

    // when html code is bad it may lead to non body tag. Deprecated check. It now does this check at the scraping stage.
    if (body) {
      breadth({ tree: body, visit, getChildren });
    } else {
      console.log("Unexpected condition");
    }

    // modify dom to make relative css and images, absolute
    cssAndImgToAbsoluteHref(domFromAllSubdirs[i], url);
    gspanFormatKmeans[i] = trimTree(gspanFormatKmeans[i]);
    gspanFormatSingleLink[i] = trimTree(gspanFormatSingleLink[i]);
    gspanFormatCompleteLink[i] = trimTree(gspanFormatCompleteLink[i]);
  }

  gspanFormatKmeans[i - 1].push("t # -1");
  gspanFormatSingleLink[i - 1].push("t # -1");
  gspanFormatCompleteLink[i - 1].push("t # -1");
  writeFileSync(sanitizedSavedAnalysisId + "gspanInKmeans.txt", gspanFormatKmeans.flat(10).join("\n"));
  writeFileSync(
    sanitizedSavedAnalysisId + "gspanInSingleLink.txt",
    gspanFormatSingleLink.flat(10).join("\n")
  );
  writeFileSync(
    sanitizedSavedAnalysisId + "gspanInCompleteLink.txt",
    gspanFormatCompleteLink.flat(10).join("\n")
  );
  return { gspanFormatKmeans, gspanFormatSingleLink, gspanFormatCompleteLink };
};

const trimTree = (tree) => {
  // copy tree title that is in the first line
  const newtree = [tree[0]];

  const edges = tree.filter((x) => /e \d+ \d+ -1/.test(x));
  // the index of edgesLabel is the number of the first vertex(the parent) and the value are the children
  const edgesLabeled = [];
  edges.forEach((edge) => {
    const splitted = edge.split(" ");
    if (!edgesLabeled[splitted[1]]) {
      edgesLabeled[splitted[1]] = [splitted[2]];
    } else {
      edgesLabeled[splitted[1]].push(splitted[2]);
    }
  });

  const vertices = tree.filter((x) => /v \d+ -?\d+/.test(x));
  // the index of verticesLabel is the number of the vertex and the value is its label
  const verticesLabeled = [];
  vertices.forEach((vertex) => {
    const splitted = vertex.split(" ");
    verticesLabeled[splitted[1]] = splitted[2];
  });

  // trimming
  for (let i = 1; i < verticesLabeled.length; i++) {
    // if parent is unlabeled(-1)
    if (verticesLabeled[i] === "-1") {
      // if all children are unlabeled then remove this connection
      if (edgesLabeled[i] && edgesLabeled[i].every((x) => verticesLabeled[x] === "-1")) {
        // find parent index
        const parentIndex = edgesLabeled.findIndex((x) => x && x.includes(i.toString()));
        edgesLabeled[parentIndex].push(edgesLabeled[i]);
        // push children of current to parent
        edgesLabeled[parentIndex] = edgesLabeled[parentIndex].flat(10);
        // remove current from parent and the edge and vertice arrays
        edgesLabeled[parentIndex].splice(edgesLabeled[parentIndex].indexOf(i.toString()), 1);
        edgesLabeled[i] = null;
        verticesLabeled[i] = null;
      } else if (!edgesLabeled[i]) {
        // when there are no children and label==-1 from first if
        verticesLabeled[i] = null;
        const parentIndex = edgesLabeled.findIndex((x) => x && x.includes(i.toString()));
        edgesLabeled[parentIndex].splice(edgesLabeled[parentIndex].indexOf(i.toString()), 1);
      }
    }
  }

  // // trim the first node (body) seperately to remove the second level unlabeled nodes
  // if (
  //   verticesLabeled[0] === "-1" &&
  //   edgesLabeled[0] &&
  //   edgesLabeled[0].every((x) => verticesLabeled[x] === "-1")
  // ) {
  //   let grandChildren = [];
  //   for (const childIndex of edgesLabeled[0]) {
  //     if (edgesLabeled[childIndex]) {
  //       grandChildren.push(edgesLabeled[childIndex]);
  //       edgesLabeled[childIndex] = null;
  //     }
  //     verticesLabeled[childIndex] = null;
  //   }
  //   grandChildren = grandChildren.flat(10);
  //   edgesLabeled[0] = grandChildren;
  // }

  // convert to python gspan format
  for (let i = 0; i < verticesLabeled.length; i++) {
    if (verticesLabeled[i] !== null) {
      newtree.push(`v ${i} ${verticesLabeled[i]}`);
    }
  }

  for (let i = 0; i < edgesLabeled.length; i++) {
    if (edgesLabeled[i] !== null && edgesLabeled[i] !== undefined) {
      for (let j = 0; j < edgesLabeled[i].length; j++) {
        newtree.push(`e ${i} ${edgesLabeled[i][j]} -1`);
      }
    }
  }

  return newtree;
  //
};

//
// -----
//

// cos similarity between all nodes using their terms bows and then kmeans clustering
const getKmeansNodexNode = (nodesDirArr, sanitizedNoOfMicrofrontends) => {
  //
  console.log("first");
  const allNodesFromAllSubds = nodesDirArr.flat(10); // allNodesFromAllSubds: all nodes from all subds in one array

  console.log("second with length " + allNodesFromAllSubds.length);
  //
  // better efficiency to calculate bows once. Maybe create it in the beginning instead of allNodesFromAllSubds
  // let allNodesFromAllSubdsTermsBow = [];
  // for (let i = 0; i < allNodesFromAllSubds.length; i++) {
  //   allNodesFromAllSubdsTermsBow.push(as.bow(allNodesFromAllSubds[i].terms));
  // }
  // console.log("in getKmeansNodexNode second with", allNodesFromAllSubds.length, "nodes");
  //

  let nodexnode = [];
  for (let i = 0; i < allNodesFromAllSubds.length; i++) {
    nodexnode.push([]);
    console.log("In " + i);
    for (let k = 0; k < i; k++) {
      nodexnode[i].push(nodexnode[k][i]);
    }

    for (let j = i; j < allNodesFromAllSubds.length; j++) {
      nodexnode[i].push(
        similarity.bow.cosine(as.bow(allNodesFromAllSubds[i].terms), as.bow(allNodesFromAllSubds[j].terms))
      );
    }
  }
  console.log("third");
  if (nodexnode.length === 0) {
    throw new Error("No word found. Check if site is rendered properly");
  }
  // ----
  let max = -2;
  let noOfClusters = -2; // number of clusters with max silhouette
  let maxAllresKmeans;
  let upperLimit =
    nodexnode[0].length > 6
      ? nodexnode[0].length / 3 > 20
        ? 20
        : nodexnode[0].length / 3
      : nodexnode[0].length; // TODO find better upper limit
  upperLimit = sanitizedNoOfMicrofrontends || upperLimit;

  for (let c = 2; c <= upperLimit; c++) {
    for (let i = 0; i < 60; i++) {
      console.log("in kmeans at c= " + c + " and repeat at i= " + i);
      // for the first 15 iterations use the kmpp initialization algorithm and for the rest use normal randomization
      let res = skmeans(nodexnode, c, i < 15 ? "kmpp" : null, null, costumDistanceFormula);
      // console.log(res);
      let coef = silhouetteCoefficient(nodexnode, res.idxs, costumDistanceFormula);
      // console.log("place", i, "number", coef);
      if (isNaN(coef)) {
        // console.log("NaN", i);
        continue;
      }
      if (coef > max) {
        // console.log("place", i, "number", coef);
        max = coef;
        maxAllresKmeans = res;
        noOfClusters = c;
      }
    }

    //
  } // end of choosing number of clusters
  //
  //
  //

  // ------
  console.log("before clusteredNodes and clustered Bow");

  const clusteredBowKmeans = makeClusteredBow(maxAllresKmeans, allNodesFromAllSubds);

  return { maxAllresKmeans, clusteredBowKmeans };
};

//
// this function is basically the getKmeansNodexNode but with a few differences to adjust it for hierarchical clustering instead of kmeans
// cos similarity between all nodes using their terms bows and then hierarchical (single link and complete link) clustering
const getHierarchicalNodexNode = (nodesDirArr, sanitizedNoOfMicrofrontends) => {
  //
  console.log("hierarchical first");
  const allNodesFromAllSubds = nodesDirArr.flat(10); // allNodesFromAllSubds: all nodes from all subds in one array

  console.log("hierarchical second with length " + allNodesFromAllSubds.length);
  //
  // better efficiency to calculate bows once. Maybe create it in the beginning instead of allNodesFromAllSubds
  // let allNodesFromAllSubdsTermsBow = [];
  // for (let i = 0; i < allNodesFromAllSubds.length; i++) {
  //   allNodesFromAllSubdsTermsBow.push(as.bow(allNodesFromAllSubds[i].terms));
  // }
  // console.log("in getKmeansNodexNode second with", allNodesFromAllSubds.length, "nodes");
  //

  let nodexnode = [];
  for (let i = 0; i < allNodesFromAllSubds.length; i++) {
    nodexnode.push([]);
    console.log("In " + i);
    for (let k = 0; k < i; k++) {
      nodexnode[i].push(nodexnode[k][i]);
    }

    for (let j = i; j < allNodesFromAllSubds.length; j++) {
      nodexnode[i].push(
        similarity.bow.cosine(as.bow(allNodesFromAllSubds[i].terms), as.bow(allNodesFromAllSubds[j].terms))
      );
    }
  }
  console.log("hierarchical third");
  if (nodexnode.length === 0) {
    throw new Error("No word found. Check if site is rendered properly");
  }
  // ----
  let singleLinkMaxCoef = -2;
  let completeLinkMaxCoef = -2;
  let singleLinkNoOfClusters = -2; // number of clusters with max silhouette for single link
  let completeLinkNoOfClusters = -2; // number of clusters with max silhouette for complete link
  let maxSingleLinkLabels;
  let maxCompleteLinkLabels;
  let upperLimit =
    nodexnode[0].length > 6
      ? nodexnode[0].length / 3 > 20
        ? 20
        : nodexnode[0].length / 3
      : nodexnode[0].length; // TODO find better upper limit
  upperLimit = sanitizedNoOfMicrofrontends || upperLimit;

  for (let c = 2; c <= upperLimit; c++) {
    console.log("in hierarchical at c= " + c);

    // hierarchical clustering-----
    const singleLinkLevels = hierarchicalCluster({
      input: nodexnode,
      distance: costumDistanceFormula,
      linkage: "single",
      minClusters: c,
    });
    const singleLinkClusters = singleLinkLevels[singleLinkLevels.length - 1].clusters;
    const singleLinkLabels = convertHierarchicalToLabel(singleLinkClusters);
    let singleLinkCoef = silhouetteCoefficient(nodexnode, singleLinkLabels, costumDistanceFormula);

    if (!isNaN(singleLinkCoef) && singleLinkCoef > singleLinkMaxCoef) {
      singleLinkMaxCoef = singleLinkCoef;
      maxSingleLinkLabels = singleLinkLabels;
      singleLinkNoOfClusters = c;
    }

    var completeLinkLevels = hierarchicalCluster({
      input: nodexnode,
      distance: costumDistanceFormula,
      linkage: "complete",
      minClusters: c,
    });
    const completeLinkClusters = completeLinkLevels[completeLinkLevels.length - 1].clusters;
    const completeLinkLabels = convertHierarchicalToLabel(completeLinkClusters);
    let completeLinkCoef = silhouetteCoefficient(nodexnode, completeLinkLabels, costumDistanceFormula);

    if (!isNaN(completeLinkCoef) && completeLinkCoef > completeLinkMaxCoef) {
      completeLinkMaxCoef = completeLinkCoef;
      maxCompleteLinkLabels = completeLinkLabels;
      completeLinkNoOfClusters = c;
    }
    // ------------- end of hierarchichal clustering
    //
  } // end of choosing number of clusters
  //
  //
  const maxAllresSingleLink = { k: singleLinkNoOfClusters, idxs: maxSingleLinkLabels };
  const maxAllresCompleteLink = { k: completeLinkNoOfClusters, idxs: maxCompleteLinkLabels };

  // ------
  console.log("hierarchical before clusteredNodes and clustered Bow");

  const clusteredBowSingleLink = makeClusteredBow(maxAllresSingleLink, allNodesFromAllSubds);
  const clusteredBowCompleteLink = makeClusteredBow(maxAllresCompleteLink, allNodesFromAllSubds);

  return { maxAllresSingleLink, clusteredBowSingleLink, maxAllresCompleteLink, clusteredBowCompleteLink };
};

const makeClusteredBow = (maxAllres, allNodesFromAllSubds) => {
  let clusteredNodes = [];
  const noOfClusters = maxAllres.k;

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

  return clusteredBow;
};

const costumDistanceFormula = (a, b) => {
  let aIndex = a.indexOf(1);
  let bIndex = b.indexOf(1);
  let index;

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

// ----

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
    // //
    // // TODOTODO Check if the below test is better to have or not
    // // the below check make sures to skip nodes that contain many text nodes. That way I get only the leaves of the dom tree
    // if (node.childNodes.length !== 1) {
    //   continue;
    // }

    let nodeTerms = [];

    // tokenize the textContent of each node and remove punctuations and stopwords. Also remove Particle pos that are somehow not removed with stopwords
    const tokens = nlp
      .readDoc(node.text)
      .tokens()
      .filter(
        (t) =>
          t.out(its.type) !== "punctuation" &&
          !t.out(its.stopWordFlag) &&
          t.out(its.pos) !== "PART" &&
          t.out(its.pos) !== "SYM"
      );

    for (let i = 0; i < tokens.length(); i++) {
      let result = await wordpos.lookup(tokens.itemAt(i).out(its.normal));
      let synonyms = result.map((item) => item.synonyms); // TODO maybe get the pos synonyms only and not for all adj,verb,noun,etc?
      let lexNames = result.map((item) => item.lexName.substring(item.lexName.indexOf(".") + 1));
      // // if the word is not found then try the lemma version
      // if (synonyms.length === 0) {
      //   result = await wordpos.lookup(tokens.itemAt(i).out(its.lemma));
      //   synonyms = result.map((item) => item.synonyms); // TODO maybe get the pos synonyms only and not for all adj,verb,noun,etc?
      // }

      nodeTerms = [...nodeTerms, ...synonyms, ...lexNames];

      // also use the lemma version of the word
      result = await wordpos.lookup(tokens.itemAt(i).out(its.lemma));
      synonyms = result.map((item) => item.synonyms); // TODO maybe get the pos synonyms only and not for all adj,verb,noun,etc?
      lexNames = result.map((item) => item.lexName.substring(item.lexName.indexOf(".") + 1));

      nodeTerms = [...nodeTerms, ...synonyms, ...lexNames];

      // if the word is not found then try the stem version
      if (synonyms.length === 0) {
        result = await wordpos.lookup(tokens.itemAt(i).out(its.stem));
        synonyms = result.map((item) => item.synonyms); // TODO maybe get the pos synonyms only and not for all adj,verb,noun,etc?
        lexNames = result.map((item) => item.lexName.substring(item.lexName.indexOf(".") + 1));

        nodeTerms = [...nodeTerms, ...synonyms, ...lexNames];
      }

      // // by using new Set(synonyms) I remove the duplicate synonyms of a single word of a text of a node. The node might have duplicate Terms if two words have the same synonym but a single word can't have the same word as a synonym
      // // the reason a single word can have duplicate words as a synonym is because a word can be a verb, noun, adjective and might have the same synonym in those forms
      // nodeTerms = [...nodeTerms, ...new Set(synonyms)];
    }

    // TODO is it better to remove the nodes that don't have text instead of the nodes that have text but don't have synonyms like I do below? and maybe use the text as the terms
    // TODO Should I add the tokenized text in the terms?
    // also use the text as terms, too
    nodeTerms = [...nodeTerms, ...tokens.out(its.normal)];

    nodeTerms = nodeTerms.flat(10);

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

// modify dom to make relative css and images, absolute
const cssAndImgToAbsoluteHref = (dom, url) => {
  const css = dom.getElementsByTagName("link"); // TODOTODO check if it works correctly for all relative and absolute hrefs.
  css.forEach((node) => {
    const href = node.getAttribute("href");
    if (href) {
      // && href.startsWith("/")) {
      node.setAttribute("href", new URL(href, url).href);
    }
  });
  const img = dom.getElementsByTagName("img"); // TODOTODO check if it works correctly for all relative and absolute srcs.
  img.forEach((node) => {
    const src = node.getAttribute("src");
    if (src) {
      // && src.startsWith("/")) {
      node.setAttribute("src", new URL(src, url).href);
    }
  });
  //
};

//
//
const stylizeDomElementsByClusterLabel = (
  domFromAllSubdirs,
  maxAllresKmeans,
  maxAllresSingleLink,
  maxAllresCompleteLink
) => {
  paletteKmeans = distinctColors({ count: maxAllresKmeans.k, quality: 200, samples: 2000 });
  paletteSingleLink = distinctColors({ count: maxAllresSingleLink.k, quality: 200, samples: 2000 });
  paletteCompleteLink = distinctColors({ count: maxAllresCompleteLink.k, quality: 200, samples: 2000 });

  for (let dom of domFromAllSubdirs) {
    const nodes = dom.querySelectorAll("[customId]");
    for (let node of nodes) {
      const kmeansClusterLabel = maxAllresKmeans.idxs[node.getAttribute("customId").split(";")[1]];
      const singleLinkClusterLabel = maxAllresSingleLink.idxs[node.getAttribute("customId").split(";")[1]];
      const completeLinkClusterLabel =
        maxAllresCompleteLink.idxs[node.getAttribute("customId").split(";")[1]];
      // node.setAttribute(
      //   "style",
      //   `border-style: solid;border-color: ${palette[kmeansClusterLabel].hex()};border-width: thick;`
      // );

      node.setAttribute(
        "nodeLabelAndColorStylizeKmeans",
        `${kmeansClusterLabel};${paletteKmeans[kmeansClusterLabel].hex()}`
      );
      node.setAttribute(
        "nodeLabelAndColorStylizeSingleLink",
        `${singleLinkClusterLabel};${paletteSingleLink[singleLinkClusterLabel].hex()}`
      );
      node.setAttribute(
        "nodeLabelAndColorStylizeCompleteLink",
        `${completeLinkClusterLabel};${paletteCompleteLink[completeLinkClusterLabel].hex()}`
      );
    }
  }
};

//
// merge the graphs and origins at indinces a and b
const mergeGraphsBasedOnDotOriginsOld = (dotGraphsTemp, dotOrigins, dotWhere, a, b) => {
  for (let i = 0; i < dotWhere[b].length; i++) {
    let whereExistsFlag = false;
    for (let j = 0; j < dotWhere[a].length; j++) {
      if (dotWhere[b][i] === dotWhere[a][j]) {
        for (let k = 0; k < dotOrigins[b][i].length; k++) {
          let originExistsFlag = false;
          for (let l = 0; l < dotOrigins[a][j].length; l++) {
            if (
              dotOrigins[b][i][k].flat(10).sort().toString() ===
              dotOrigins[a][j][l].flat(10).sort().toString()
            ) {
              originExistsFlag = true;
              break;
            }
          }
          if (originExistsFlag === false) {
            dotOrigins[a][j].push(dotOrigins[b][i][k]);
          }
        }
        whereExistsFlag = true;
        break;
      }
    }

    if (whereExistsFlag === false) {
      dotOrigins[a].push(dotOrigins[b][i]);
    }
  }
};

const convertNodesDirArrTermsToBow = (nodesDirArr) => {
  for (let s = 0; s < nodesDirArr.length; s++) {
    for (let node of nodesDirArr[s]) {
      node.terms = Object.fromEntries(
        Object.entries(as.bow(node.terms)).sort((a, b) => {
          return b[1] - a[1];
        })
      );
    }
  }
};

// converts the return array of the hierarchical-clustering package (which is a two level array where each level second level represents a cluster and the numbers inside it the index of the datapoint) to an array where each index represents a data point and its value the label of the cluster in which it belongs.
// eg. converts from [[0,4,2],[1,3]] to [0,1,0,1,0] for two clusters
const convertHierarchicalToLabel = (clusters) => {
  if (clusters.length < 1) {
    return -1;
  }

  const labels = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = 0; j < clusters[i].length; j++) {
      labels[clusters[i][j]] = i;
    }
  }
  return labels;
};

//
//
// adds the stylizing info for the frequent dotGraphs trees' leaves and for the html elements that correspond to those dotgraph trees' leaves
const addStylesForDotGraphsInDoms = (dotgraphTrees, domFromAllSubdirs, clusteringMethod, palette) => {
  //
  // if there are no frequent trees found then just return
  if (!dotgraphTrees) {
    return;
  }

  const { dotOrigins, dotWhere, dotGraphs } = dotgraphTrees;
  const digraphLabelStylizeAttributeName = "digraphLabelStylize" + clusteringMethod;

  // // ----find height of origin tree----
  // let numCommonVertex = 0;
  // for (let i = 0; i < dotOrigins.length; i++) {
  //   for (let j = i + 1; j < dotOrigins.length; j++) {
  //     if (dotOrigins[i][0] === dotOrigins[j][0]) {
  //       numCommonVertex++;
  //     }
  //   }
  // }
  // const treeHeight = dotOrigins.length - numCommonVertex + 1;
  // // ---- end finding tree height----

  // const dotgraphBackRenderedDoms = [];
  for (let i = 0; i < dotOrigins.length; i++) {
    //
    // ----color the dotGraph as well to match with the html----
    for (let k = 0; k < dotGraphs[i].length; k++) {
      const match = dotGraphs[i][k].match(/\d+ \[label="(\d+)/);
      if (match) {
        dotGraphs[i][k] =
          dotGraphs[i][k].slice(0, -1) +
          ` fontcolor="${palette[match[1]].hex()}" color="${palette[match[1]].hex()}" penwidth="5"]`;
      }
    }
    // ----ending coloring dotGraph----

    // dotgraphBackRenderedDoms.push([]);
    for (let j = 0; j < dotWhere[i].length; j++) {
      // const dom = clone(domFromAllSubdirs[dotWhere[i][j]]);
      const dom = domFromAllSubdirs[dotWhere[i][j]];
      const digraphIndex = dotGraphs[i][0].split(" ")[1];

      // // mutates the dom itself for the display
      // dotOrigins[i][j].forEach((origin) => {
      //   origin.forEach((line) => {
      //     dom
      //       .querySelector(`[vertexCounter=${line[0]}]`)
      //       .setAttribute("style", `border-style: solid;border-color: red;border-width: thick;`);
      //     dom
      //       .querySelector(`[vertexCounter=${line[1]}]`)
      //       .setAttribute("style", `border-style: solid;border-color: red;border-width: thick;`);
      //   });
      // });

      for (const origin of dotOrigins[i][j]) {
        for (const line of origin) {
          const olddomone = dom.querySelector(`[vertexCounter=${line[0]}]`);
          // I don't want to make a border around body because it makes it messy and doesn't really help
          if (olddomone.tagName !== "BODY") {
            const oldone = olddomone.getAttribute(digraphLabelStylizeAttributeName);
            if ((oldone && !oldone.includes(`;${digraphIndex};`)) || !oldone) {
              olddomone.setAttribute(
                digraphLabelStylizeAttributeName,
                oldone ? oldone + `${digraphIndex};` : `;${digraphIndex};`
              );
            }
          }

          const olddomtwo = dom.querySelector(`[vertexCounter=${line[1]}]`);
          if (olddomtwo.tagName !== "BODY") {
            const oldtwo = olddomtwo.getAttribute(digraphLabelStylizeAttributeName);
            if ((oldtwo && !oldtwo.includes(`;${digraphIndex};`)) || !oldtwo) {
              olddomtwo.setAttribute(
                digraphLabelStylizeAttributeName,
                oldtwo ? oldtwo + `${digraphIndex};` : `;${digraphIndex};`
              );
            }
          }
          //
        }
      }

      // dotgraphBackRenderedDoms[i].push(dom.toString());
    }
  }
};

// ====================================================================

// ---

const getCosineSimilarityPerSubd = (nodesDirArr) => {
  let cosineSimilarityPerSubd = [];

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

  return cosineSimilarityPerSubd;
};
