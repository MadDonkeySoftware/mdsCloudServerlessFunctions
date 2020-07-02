const bodyParser = require('body-parser');
const express = require('express');

const globals = require('./globals');
const handlers = require('./handlers');
const appShutdown = require('./handlers/app_shutdown');

const buildApp = () => {
  const logger = globals.getLogger();
  const app = express();

  const requestLogger = (req, res, next) => {
    logger.trace({ path: req.path, method: req.method }, 'Handling request');
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

  app.use(requestLogger);
  app.use(commonResponseSetup);
  app.use(bodyParser.json());
  app.use(bodyParser.text());
  configureRoutes(app);
  appShutdown.wire();

  return app;
};

module.exports = {
  buildApp,
};
