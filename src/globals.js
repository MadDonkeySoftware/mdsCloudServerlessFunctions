const bunyan = require('bunyan');
const crypto = require('crypto');
const bunyanLogstashHttp = require('./bunyan-logstash-http');

const buildLogStreams = () => {
  const loggerMetadata = { fromLocal: process.env.DEBUG };
  const logStreams = [];

  if (!/test/.test(process.env.NODE_ENV)) {
    logStreams.push({
      stream: process.stdout,
    });
  }

  if (process.env.MDS_LOG_URL) {
    logStreams.push(
      {
        stream: bunyanLogstashHttp.createLoggerStream({
          loggingEndpoint: process.env.MDS_LOG_URL,
          level: 'debug',
          metadata: loggerMetadata,
        }),
      },
    );
  }

  return logStreams;
};

const logger = bunyan.createLogger({
  name: 'mdsCloudServerlessFunctions',
  level: bunyan.TRACE,
  serializers: bunyan.stdSerializers,
  streams: buildLogStreams(),
});

/**
 * returns the current logger for the application
 */
const getLogger = () => logger;

const delay = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

const generateRandomString = (length) => {
  if (!length || length < 1) {
    return '';
  }

  // When converting bytes to hex you get two characters for every byte. So
  // we divide the requested length in half rounding up to save a bit of
  // memory / processing.
  const l = Math.floor((length / 2.0) + 0.5);
  const str = crypto.randomBytes(l).toString('hex');
  return str.substring(0, length);
};

module.exports = {
  buildLogStreams,
  getLogger,
  delay,
  generateRandomString,
};
