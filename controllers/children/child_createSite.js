const axios = require("axios");
const { parse } = require("node-html-parser");
const connectDB = require("../../db/connectDB");
const DB_Model_Sites = require("../../db/Model_Site");

// ----

process.on("message", (message) => {
  childCreateSite(message.url);
});

// ----

const childCreateSite = async (url) => {
  try {
    await connectDB(process.env.MONGO_DB_URI);

    // fetch and parse
    const html = await axios.get(url);
    // console.log(html.status);
    // console.log(html.data);

    const [subdirsName, subDirs] = await crawler(html.data, url);

    const site = await DB_Model_Sites.create({
      url: url,
      status: "Completed Ok",
      html: subDirs,
      subdirsname: subdirsName,
      creationDate: new Date(),
    });
    process.exit();
  } catch (error) {
    console.log("Error when scraping: " + error.message);
    process.exit();
  }
};

// ------

const crawler = async (htmlData, url) => {
  const dom = parse(htmlData);
  const subdirs = dom.querySelectorAll("a");
  let subdirHTMLArr = [htmlData];
  let subdirsName = ["/"];
  for (let node of subdirs) {
    try {
      // console.log(node.getAttribute("href"));
      // TODO also check if it is absolute and starts with the site url
      if (!node.getAttribute("href").startsWith("/")) {
        continue;
      }
      // makes the relative paths, absolute
      const subdirname = new URL(node.getAttribute("href"), url).href;
      // const subdirname = node.getAttribute("href").startsWith("/")
      //   ? url + node.getAttribute("href")
      //   : node.getAttribute("href");
      let html = await axios.get(subdirname);

      // let html = await axios.get(node.getAttribute("href"));
      subdirHTMLArr.push(html.data);
      subdirsName.push(subdirname);
      // keep only the relative path
      // subdirsName.push(
      //   url.endsWith("/") ? subdirname.slice(url.length - 1) : subdirname.slice(url.length)
      // );
    } catch (error) {
      if (error.message != "Cannot read property 'replace' of null" || !(error instanceof TypeError)) {
        // console.log("Print error that is not just invalid URL");
        // TODO to check more

        const site = await DB_Model_Sites.create({
          url: url,
          status: "Completed with error when scraping: " + error.message,
          html: subdirHTMLArr,
          subdirsname: subdirsName,
          creationDate: new Date(),
        });

        throw error;
      }
    }
    //
  }

  return [subdirsName, subdirHTMLArr];
};
