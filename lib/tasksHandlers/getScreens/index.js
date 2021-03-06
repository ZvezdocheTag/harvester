const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');

const tasks = require('../../../tasks/');
const credits = require('../../../credits');

const showData = require('./showData');
const downloadData = require('./downloadData');

const {
  actBeforeStart,
  checkIsCollectedDataExist,
  clearUrlDomain,
  closeBanner,
  collectPageData,
  eventEmitter,
  fillTemplates,
  getFolderName,
  getFilesPromises,
  getNameFromUrl,
  loadTemplates,
  logs,
  makeLogin,
  sendData,
  writeFile,
  writeCodeFile
} = require('../../helpers');

let creditsEnv = 'dev';
let visitedUrls = {};

let isTaskStopped = false;

let isCompare = false;

const templatesNames = [
  'screensList',
  'savedIndex'
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

const taskStopper = () => {
  isTaskStopped = true;
};

const toggleCompare = (data) => {
  isCompare = data.isCompare;
};

eventEmitter.subscribe('stop-task', taskStopper);
eventEmitter.subscribe('check-collected-data', (data, ws) => {
  checkIsCollectedDataExist(data, ws, 'visited.json')
});
eventEmitter.subscribe('compareScreens', toggleCompare);
eventEmitter.subscribe('show-data', (data, ws) => {
  showData(data, ws, templates);
});

eventEmitter.subscribe('download-data', (data, ws) => {
  downloadData(data, ws, templates);
});

// ------------------------------

const createScreenPromise = params => {
  const {
    task,
    folderName,
    browser,
    logsEmit,
    url,
    sizes,
    screenFullPage,
    deviceData,
    screenSelector
  } = params;
  const device = deviceData && devices[deviceData.name];
  const width = sizes.width || device.viewport.width;
  const height = sizes.height || device.viewport.height;
  const urlKey = clearUrlDomain(url);
  let info = `${width}x${height}`;
  const env = task.creditsEnv || 'none';
  const selectors = credits.selectors[env];

  if(deviceData) {
    info = deviceData.name;
  }

  return new Promise((resolve, reject) => {
    if (isTaskStopped === true) {
      resolve();
    }

    browser.newPage()
      .then(async page => {
        await page.waitFor(Math.random() * 5000 + 2000);

        if(device) {
          await page.emulate(device);
        }
        else {
          await page.setViewport({
            width: width,
            height: height
          });
        }

        await page.goto(url, {waitUntil: 'domcontentloaded'})
          .then(result => {
            // console.log('result._status', result._status)
          })
          .catch(error => {
            console.log(`Error while opening page ${url}`);
          });

        // Wait for loading
        // await page.waitFor(5000);

        if (selectors && selectors.closeBanner) {
          await closeBanner({
            page,
            logsEmit,
            url,
            closeBannerSelector: selectors.closeBanner,
            isTaskStopped
          });

          await page.waitFor(5000);
        }

        if(task.jsOnPage) {
          await page.evaluate(task.jsOnPage);
        }

        if(device && device.viewport) {
          deviceData.viewport = device.viewport;
        }

        const pageData = await collectPageData({
          page,
          url,
          screenSizes: sizes,
          screenFullPage,
          deviceData,
          screenSelector,
          folderName,
          isCompare
        });

        if (visitedUrls[urlKey]) {
          visitedUrls[urlKey].screens.push(pageData.screens[0]);
        } else {
          visitedUrls[urlKey] = pageData;
        }

        const images = Object.values(visitedUrls);

        const renderedList = await fillTemplates({
          template: templates.screensList,
          data: {
            images
          }
        });
        writeFile(`public/${folderName}/data/visited.json`, visitedUrls);

        logsEmit({
          task: 'handle urls',
          status: 'success',
          message: `${url} (${info}) was processed`,
          data: renderedList
        });

        resolve();
      })
      .catch(err => {
        console.log('err\n',err);
        logsEmit({
          task: 'handle urls',
          status: 'error',
          message: `${url} (${info}) was not opened`
        });
      });
  });
};

// ------------------------------

const getScreens = async ({
  browser,
  logsEmit,
  tasksGroupData,
  task,
}) => {
  isTaskStopped = false;

  await templatesPromise;

  const urls = task.urls;
  visitedUrls = {};

  const screenSizes = task.screenSizes || tasksGroupData.baseScreenSizes;
  const screenFullPage = task.screenFullPage || tasksGroupData.screenFullPage;
  const devices = task.devices || '';
  const screenSelector = task.screenSelector || [];
  const folderName = `screens--${task.id}`;

  logsEmit({
    task: task.name,
    status: 'in-progress',
    message: 'Task started...'
  });

  const page = await browser.newPage();
  const fullPage = screenFullPage || false;

  for (let i = 0; i < urls.length; i++) {
    if (isTaskStopped === true) {
      return;
    }

    const promises = [];

    const url = urls[i];
    logsEmit({
      task: 'handle urls',
      status: 'in-progress',
      message: `${i}. URL: ${url}`
    });

    // Handle screen sizes
    for (let k = 0; k < screenSizes.length; k++) {
      promises.push(createScreenPromise({
        task,
        folderName,
        browser,
        logsEmit,
        url,
        sizes: screenSizes[k],
        screenFullPage,
        screenSelector
      }));
    }

    // Handle devices
    for (let k = 0; k < devices.length; k++) {
      promises.push(createScreenPromise({
        task,
        folderName,
        browser,
        logsEmit,
        url,
        sizes: {},
        deviceData: devices[k],
        screenFullPage,
        screenSelector
      }));
    }

    await Promise.all(promises)
      .then(result => {
        if (isTaskStopped === true) {
          return;
        }
        // do nothing
        logsEmit({
          task: 'handle urls',
          status: 'success',
          message: 'Go to next'
        });
      })
      .catch(error => {
        if (error.name === 'TimeoutError') {
          logsEmit({
            task: 'handle urls',
            status: 'error',
            message: `${error.name} while loading pages: ${error.message}`,
            data: error
          });
        } else {
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

module.exports = getScreens;
