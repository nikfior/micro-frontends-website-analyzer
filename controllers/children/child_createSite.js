const axios = require("axios");
const { parse } = require("node-html-parser");
const connectDB = require("../../db/connectDB");
const DB_Model_Sites = require("../../db/Model_Site");
const puppeteer = require("puppeteer");

// ----

process.on("message", (message) => {
  childCreateSite(message.url, message.useHeadlessBrowser);
});

// ----

const childCreateSite = async (url, useHeadlessBrowser) => {
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
    let [subdirsName, subDirs] = await crawler(
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
    while (JSON.stringify(subDirs).length > 17000000) {
      if (subDirs.length > 1) {
        subdirsName.pop();
        subDirs.pop();
      } else {
        throw new Error("HTML code too large even in one subdirectory");
      }
    }

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

const crawler = async (htmlData, url, useHeadlessBrowser, browser, page) => {
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

      let html = {};
      if (!useHeadlessBrowser) {
        html = await axios.get(subdirname);
      } else {
        await page.goto(subdirname, { waitUntil: "networkidle0" });
        // await page.setViewport({ width: 1080, height: 1024 });
        html.data = await page.content();
        html.url = page.url();
      }
      // if it already exists then skip it
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
      // otherwise if it's an error with the program then save what is already done and throw an error
      // if (error.message != "Cannot read property 'replace' of null" || !(error instanceof TypeError)) {
      if (!error.request && !error.response) {
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
