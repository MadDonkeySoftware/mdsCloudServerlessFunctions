const bodyParser = require('body-parser');
const express = require('express');
const fileUpload = require('express-fileupload');

const globals = require('./globals');
const handlers = require('./handlers');
const appShutdown = require('./handlers/app_shutdown');

const buildApp = () => {
  const logger = globals.getLogger();
  const app = express();

  /* istanbul ignore next */
  const requestLogger = (req, res, next) => {
    logger.trace({ path: req.path, method: req.method, headers: req.headers }, 'Handling request');
    next();
  };

  const commonResponseSetup = (req, res, next) => {
    res.setHeader('content-type', 'application/json');
    next();
  };

  const configureRoutes = (expressApp) => {
    expressApp.get('/', (req, res) => {
      // TODO: Need to create help documentation and publish it here.
      res.send('{"msg":"Hello World!"}');
    });

    expressApp.use('/', handlers);
  };

  const fileUploadOptions = {
    safeFileNames: true,
    preserveExtension: true,
    useTempFiles: true,
    tempFileDir: '/tmp',
  };

  /* istanbul ignore if */
  if (process.env.LOG_ALL_REQUESTS) app.use(requestLogger);
  app.use(commonResponseSetup);
  app.use(bodyParser.json());
  app.use(bodyParser.text());
  app.use(fileUpload(fileUploadOptions));
  configureRoutes(app);
  appShutdown.wire();

  return app;
};

module.exports = {
  buildApp,
};
