const { parentPort } = require("worker_threads");

// function cpuIntensiveTask(responseTime) {
//   console.log("cpuIntensiveTask started......");
//   let startTime = Date.now();
//   while (Date.now() - startTime < responseTime) {
//     const kk = 0;
//   }
//   console.log("cpuIntensiveTask completed in :" + (Date.now() - startTime) + " ms.");
//   return Date.now() - startTime;
// }
// parentPort.on("message", (message) => {
//   console.log(message);
//   if (message.command == "SLEEP") {
//     setTimeout(() => {
//       console.log(
//         "\nTest Child Event-Loop :cpuIntensiveTask in child thread blocks this event in child thread!"
//       );
//     }, 1000);
//     console.log("first");
//     const result = cpuIntensiveTask(message.responseTime);
//     console.log("second");
//     parentPort.postMessage("Completeed in :" + result + " ms.");
//     console.log("end");
//     process.exit();
//   }
// });

// -------------------

// function outfun() {
//   let k = 0;
//   console.log("starting cpu-heavy");
//   for (let i = 0; i < 50; i++) {
//     for (let j = 0; j < 99999999; j++) {
//       k++;
//     }
//   }
//   console.log("ended cpu-heavy");
//   return k;
// }

// parentPort.on("message", (message) => {
//   console.log(message);
//   if (message.command == "SLEEP") {
//     setTimeout(() => {
//       console.log(
//         "\nTest Child Event-Loop :cpuIntensiveTask in child thread blocks this event in child thread!"
//       );
//     }, 1000);
//     console.log("first");
//     const result = outfun();
//     console.log("second");
//     parentPort.postMessage("in worker found :" + result);
//     console.log("end");
//     // process.exit();
//   }
// });
