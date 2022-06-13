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

    // html.request.res.responseUrl is the actual url after the redirects
    const [subdirsName, subDirs] = await crawler(html.data, html.request.res.responseUrl);

    const site = await DB_Model_Sites.create({
      url: url,
      status: "Completed scraping Ok",
      html: subDirs,
      subdirsname: subdirsName,
      creationDate: new Date(),
    });

    process.exit();
  } catch (error) {
    console.log("Error when scraping: " + error.message);
    // TODO maybe inform the user via a database site creation with an error status
    process.exit();
  }
};

// ------

const crawler = async (htmlData, url) => {
  const dom = parse(htmlData);
  if (!dom.getElementsByTagName("body")) {
    throw new Error("Possible malformed HTML. Cannot parse HTML code correctly.");
  }
  const subdirs = dom.querySelectorAll("a");
  let subdirHTMLArr = [htmlData];
  let subdirsName = [url];
  for (let node of subdirs) {
    try {
      // console.log(node.getAttribute("href"));
      // TODO also check if it is absolute and starts with the site url ALSO CHECK if it is the same url as before
      if (
        !node.getAttribute("href") ||
        (!node.getAttribute("href").startsWith(new URL(url).origin) &&
          !node.getAttribute("href").startsWith("/"))
      ) {
        continue;
      }
      // makes the relative paths, absolute
      const subdirname = new URL(node.getAttribute("href"), url).href;

      let html = await axios.get(subdirname);

      // if it already exists then skip it
      if (subdirsName.includes(html.request.res.responseUrl)) {
        continue;
      }

      // check for malformed html code
      const checkDom = parse(html.data);
      if (!checkDom.getElementsByTagName("body")[0]) {
        continue;
      }

      subdirHTMLArr.push(html.data);
      subdirsName.push(html.request.res.responseUrl);

      //
    } catch (error) {
      if (error.message != "Cannot read property 'replace' of null" || !(error instanceof TypeError)) {
        // console.log("Print error that is not just invalid URL");
        // TODO to check more

        const site = await DB_Model_Sites.create({
          url: url,
          status: "Completed scraping with error when scraping: " + error.message,
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
