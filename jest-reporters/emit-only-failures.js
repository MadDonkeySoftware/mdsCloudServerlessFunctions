/* eslint-disable no-param-reassign */
// eslint-disable-next-line import/no-extraneous-dependencies
// NOTE: Converting to typescript fails due to https://github.com/facebook/jest/issues/10281
const { DefaultReporter } = require('@jest/reporters');

class Reporter extends DefaultReporter {
  printTestFileHeader(_testPath, config, result) {
    const { console } = result;

    if (result.numFailingTests === 0 && !result.testExecError) {
      result.console = null;
    }

    // eslint-disable-next-line prefer-rest-params
    super.printTestFileHeader(...arguments);

    result.console = console;
  }
}

module.exports = Reporter;
