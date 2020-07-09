const _ = require('lodash');
const del = require('del');

/**
 * Provides a wrapper around process.env for testing
 * @param {string} key the environment variable key
 * @param {string} defaultValue the environment variable key
 * @returns {string} the environment variable value
 */
const getEnvVar = (key, defaultValue) => _.get(process.env, [key], defaultValue);

/**
 * Provides a wrapper around request file move for testing
 * @param {*} requestFile the file object from the request
 * @param {*} savePath the location to save the file
 */
const saveRequestFile = (requestFile, savePath) => new Promise((res, rej) => {
  requestFile.mv(savePath, (err) => {
    if (err) {
      rej(err);
    } else {
      res();
    }
  });
});

/**
 * Provides a wrapper around file / folder delete for testing
 * @param {*} fileOrPath the path to a file or folder
 * @param {*} options the delete options
 */
const deleteFileOrPath = (fileOrPath, options) => del(fileOrPath, options);

/**
 * Provides a wrapper around request file download for testing
 * @param {*} request the request to act upon
 * @param {*} filePath the path to the file to download
 * @param {*} filename the file name that the user will be provided
 * @param {*} callback the callback to indicate completion or failure
 */
const downloadFile = (request, filePath, filename, callback) => (
  request.download(filePath, filename, callback));

module.exports = {
  getEnvVar,
  saveRequestFile,
  deleteFileOrPath,
  downloadFile,
};
