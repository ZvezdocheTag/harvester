'use strict';

const puppeteer = require('puppeteer');
const mustache = require('mustache');

const tasks = require('../../tasks/');
const credits = require('../../credits');

const {
  actBeforeStart,
  clearUrlDomain,
  closeBanner,
  collectPageData,
  getNameFromUrl,
  loadTemplates,
  logs,
  makeLogin,
  sendData,
} = require('../helpers');

let creditsEnv = 'dev';
let visitedUrls = {};

const templatesNames = [
  'screensList'
];

let templates = {};
const templatesPromise = loadTemplates(templatesNames)
  .then(result => {
    templates = result;
  })
  .catch(error => {
    console.log('Error while loading templates: ', error);
  });

// ------------------------------

const createScreenPromise = params => {
  const {
    browser,
    logsEmit,
    url,
    sizes,
    screenFullPage
  } = params;
  const width = sizes.width;
  const height = sizes.height;
  const urlKey = clearUrlDomain(url);

  return new Promise((resolve, reject) => {
    browser.newPage()
      .then(async page => {

        await page.setViewport({ width: width, height: height });
        await page.goto(url);

        // Wait for loading
        await page.waitFor(10000);

        logsEmit({
          task: 'handle screen',
          status: 'start',
          message: `Start process ${url} (${width}x${height})`
        });

        if(credits.selectors.closeBanner) {
          closeBanner({
            page,
            logsEmit,
            url,
            closeBannerSelector: credits.selectors.closeBanner
          });
        }

        const pageData = await collectPageData({
          page,
          url,
          screenSizes: sizes,
          screenFullPage
        });

        if(visitedUrls[urlKey]) {
          visitedUrls[urlKey].screenPath.push(pageData.screenPath);
        }
        else {
          visitedUrls[urlKey] = pageData;
        }

        const images = Object.values(visitedUrls);
        const renderedList = await fillTemplates({ images });

        logsEmit({
          task: 'handle urls',
          status: 'success',
          message: `${url} was processed`,
          data: renderedList
        });

        resolve();
      })
  })
};

// ------------------------------

const getScreens = async ({
    browser,
    logsEmit,
    tasksGroupData,
    task,
  }) => {
  await templatesPromise;

  const urls = task.urls;
  visitedUrls = {};

  const screenSizes = task.screenSizes || tasksGroupData.baseScreenSizes;
  const screenFullPage = task.screenFullPage || tasksGroupData.screenFullPage;

  logsEmit({
    task: task.name,
    status: 'in-progress',
    message: `Task started...`
  });

  const page = await browser.newPage();
  const fullPage = screenFullPage || false;

  for (let i = 0; i < urls.length; i++) {
    const promises = [];

    const url = urls[i];
    logsEmit({
        task: 'handle urls',
        status: 'in-progress',
        message: `${i}. URL: ${url}`
      });

    for (var k = 0; k < screenSizes.length; k++) {
      promises.push(createScreenPromise({
        browser,
        logsEmit,
        url,
        sizes: screenSizes[k],
        screenFullPage
      }))
    }

    await Promise.all(promises)
      .then(result => {
        //do nothing
        logsEmit({
          task: 'handle urls',
          status: 'success',
          message: 'Go to next'
        });
      })
      .catch(error => {
        if(error.name === 'TimeoutError') {
          logsEmit({
            task: 'handle urls',
            status: 'error',
            message: `${error.name} while loading pages: ${error.message}`,
            data: error
          });
        }
        else {
          logsEmit({
            task: 'handle urls',
            status: 'error',
            message: `Error while loading pages: ${error}`,
            data: error
          });
        }
      });
  }
};

// ------------------------------

const fillTemplates = (data) => {
  const renderedContent = mustache.render(templates.screensList, data);

  return renderedContent;
}

// ------------------------------

module.exports = getScreens;