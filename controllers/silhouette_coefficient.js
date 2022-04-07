const euclidianDistance = (a, b) => {
  let distance = 0;

  Object.keys(a).forEach((key) => {
    distance += Math.pow(a[key] - b[key], 2);
  });

  return Math.sqrt(distance);
};

const silhouetteCoefficient = (vectors, labels, distanceFormula) => {
  //
  // convert data and labels into clusters
  let clusters = [];
  for (let i = 0; i < Math.max(...labels) + 1; i++) {
    clusters.push([]);
  }

  for (let i = 0; i < vectors.length; i++) {
    clusters[labels[i]].push(vectors[i]);
  }
  // --------------------------

  if (clusters.length <= 1) {
    return 0;
  }

  // If a cluster is empty then return NaN
  for (let i = 0; i < clusters.length; i++) {
    if (!clusters[i].length) {
      return NaN;
    }
  }

  if (!distanceFormula) {
    distanceFormula = euclidianDistance;
  }

  let sTotal = 0;
  let datapointsCounter = 0;
  // calculate mean silhouette score across all clusters
  for (let i = 0; i < clusters.length; i++) {
    let cluster = clusters[i];
    datapointsCounter += cluster.length; // number of datapoints in this cluster. Needed to find the mean later

    // let s_c; // silhouette of the cluster
    if (cluster.length <= 1) {
      // s_c = 0; // if only one data point in cluster then the silhouette equals zero so it add nothing to the sum. so I continue with next cluster
      continue;
    }

    // iterate all data points in the cluster
    for (let j = 0; j < cluster.length; j++) {
      // cohesion--
      let totalInnerClusterDistance = 0;
      for (let k = 0; k < cluster.length; k++) {
        if (j === k) {
          // if it's the same data point then skip because I need its distance with the other data points in the same cluster, not with itself
          continue;
        }
        totalInnerClusterDistance += distanceFormula(cluster[j], cluster[k]); // measure distance between each data point in the cluster
      }
      let a_i = totalInnerClusterDistance / (cluster.length - 1);
      //   console.log("ai", a_i);
      // seperation--
      let b_iAll = [];
      for (let c = 0; c < clusters.length; c++) {
        if (c === i) {
          // if it's the same cluster then skip because I search for seperation here. I searched innercluster distance in cohesion
          continue;
        }
        let clusterB = clusters[c];
        let totalOuterClusterDistance = 0;
        for (let k = 0; k < clusterB.length; k++) {
          totalOuterClusterDistance += distanceFormula(cluster[j], clusterB[k]);
        }
        b_iAll.push(totalOuterClusterDistance / clusterB.length);
      }
      let b_i = Math.min(...b_iAll);
      //   console.log("biall", b_iAll, "bi", b_i);

      // let s_i = (b_i - a_i) / Math.max(a_i, b_i);
      // console.log("s_i", (b_i - a_i) / Math.max(a_i, b_i));
      sTotal += (b_i - a_i) / Math.max(a_i, b_i);

      //
    } // end iteration of all data points in the cluster
  } // end iteration of all clusters
  //   console.log("sTotal", sTotal, "datapointscounter", datapointsCounter);
  return sTotal / datapointsCounter;
};

module.exports = silhouetteCoefficient;
