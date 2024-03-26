const axios = require("axios");
const { parse } = require("node-html-parser");
const connectDB = require("../../db/connectDB");
const DB_Model_Sites = require("../../db/Model_Site");
const puppeteer = require("puppeteer");

// ----

process.on("message", (message) => {
  childCreateSite(message.siteId, message.url, message.useHeadlessBrowser);
});

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
// ----

const childCreateSite = async (siteId, url, useHeadlessBrowser) => {
  try {
    await connectDB(process.env.MONGO_DB_URI);

    let html = {};
    let browser, page;
    if (!useHeadlessBrowser) {
      html = await axios.get(url);
      // console.log(html.status);
      // console.log(html.data);
    } else {
      browser = await puppeteer.launch();
      page = (await browser.pages())[0] || (await browser.newPage());
      await page.goto(url, { waitUntil: "networkidle0" });
      await page.setViewport({ width: 1080, height: 1024 });
      html.data = await page.content();
      html.url = page.url();
      // await page.goto("https://demo.microfrontends.com/", { waitUntil: "networkidle0" });
    }

    // html.request.res.responseUrl is the actual url after the redirects
    let [subdirsName, subDirs, problemsDuringScraping] = await crawler(
      html.data,
      html.request?.res.responseUrl || html.url,
      useHeadlessBrowser,
      browser,
      page
    );

    if (useHeadlessBrowser) {
      await browser.close();
    }

    // remove subdirectories with different languages if I have more than 5 subdirectories
    if (subDirs.length > 5) {
      let indexesToDelete = [];
      subdirsName.forEach((subdDirUrl, index) => {
        if (/[/=](el|gr|fr|de)([/&]|$)/i.test(subdDirUrl)) {
          indexesToDelete.push(index);
        }
      });

      subdirsName = subdirsName.filter((x, index) => !indexesToDelete.includes(index));
      subDirs = subDirs.filter((x, index) => !indexesToDelete.includes(index));
    }

    // if size of HTML array is too big then remove some subdirectories.
    if (JSON.stringify(subDirs).length > 17000000) {
      problemsDuringScraping.push("Some subdirectories where removed due to size limitations");
    }
    while (JSON.stringify(subDirs).length > 17000000) {
      if (subDirs.length > 1) {
        subdirsName.pop();
        subDirs.pop();
      } else {
        throw new Error("HTML code too large even in one subdirectory");
      }
    }

    if (subDirs.length === 0) {
      throw new Error(
        "Site has 0 subdirectories. At least 1 subdirectories are needed in order to analyze the site."
      );
    }

    if (subDirs.length === 1) {
      problemsDuringScraping.push("Site has only 1 subdirectory. Hierarchical analysis will not be possible");
    }

    // // remove duplicate errors
    // problemsDuringScraping = [...new Set(problemsDuringScraping)];

    const site = await DB_Model_Sites.findOneAndUpdate(
      { _id: siteId },
      {
        url: url,
        status:
          problemsDuringScraping.length === 0
            ? "Completed scraping Ok"
            : "Completed scraping with warning when scraping",
        html: subDirs,
        subdirsname: subdirsName,
        creationDate: new Date(),
        problemsDuringScraping: problemsDuringScraping.length === 0 ? undefined : problemsDuringScraping,
      },
      { new: true }
    );

    process.exit();
  } catch (error) {
    try {
      const site = await DB_Model_Sites.findOneAndUpdate(
        { _id: siteId },
        {
          url: url,
          status: "Error scraping: " + error.message,
          html: [],
          subdirsname: [],
          creationDate: new Date(),
        },
        { new: true }
      );
    } catch (error) {
      console.log("Error saving the error in status: " + error.message);
      process.exit();
    }
    console.log("Error when scraping: " + error.message);
    process.exit();
  }
};

// ------

const crawler = async (htmlData, url, useHeadlessBrowser, browser, page) => {
  let problemsDuringScraping = [];
  const dom = parse(htmlData);
  if (!dom.getElementsByTagName("body")[0]) {
    throw new Error("Possible malformed HTML. Cannot parse HTML code correctly.");
  }
  const subdirs = dom.querySelectorAll("a");
  let subdirHTMLArr = [htmlData];
  let subdirsName = [url];
  for (let node of subdirs) {
    try {
      // console.log(node.getAttribute("href"));
      // TODO also check if it is absolute and starts with the site url ALSO CHECK if it is the same url as before
      // is it correct to omit urls from other domains?
      if (
        !node.getAttribute("href") ||
        (!node.getAttribute("href").startsWith(new URL(url).origin) &&
          !node.getAttribute("href").startsWith("/"))
      ) {
        continue;
      }
      // makes the relative paths, absolute
      const subdirname = new URL(node.getAttribute("href"), url).href;

      let html = {};
      if (!useHeadlessBrowser) {
        html = await axios.get(subdirname);

        // maybe add the below wait because some site return an axios 429 error for too many requests
        // await wait(400);
      } else {
        await page.goto(subdirname, { waitUntil: "networkidle0" });
        // await page.setViewport({ width: 1080, height: 1024 });
        html.data = await page.content();
        html.url = page.url();
      }
      // if it already exists then skip it.
      // I don't use the subdirname for the url because some subdirectories redirect to other ones and the returned response shows the actual redirected url
      if (subdirsName.includes(html.request?.res.responseUrl || html.url)) {
        continue;
      }

      // check for malformed html code
      const checkDom = parse(html.data);
      if (!checkDom.getElementsByTagName("body")[0]) {
        continue;
      }

      subdirHTMLArr.push(html.data);
      subdirsName.push(html.request?.res.responseUrl || html.url);

      //
    } catch (error) {
      // if there is an error with the request/response then just continue on with the rest of the subdirectories
      // otherwise if it's an error with the program then return with what is already done
      // if (error.message != "Cannot read property 'replace' of null" || !(error instanceof TypeError)) {
      problemsDuringScraping.push(error.message);
      if (!error.request && !error.response) {
        // const site = await DB_Model_Sites.create({
        //   url: url,
        //   status: "Completed scraping with error when scraping: " + error.message,
        //   html: subdirHTMLArr,
        //   subdirsname: subdirsName,
        //   creationDate: new Date(),
        // });

        console.log(error.message);
        return [subdirsName, subdirHTMLArr, problemsDuringScraping];
        // throw error;
      }
    }
    //
  }

  return [subdirsName, subdirHTMLArr, problemsDuringScraping];
};
