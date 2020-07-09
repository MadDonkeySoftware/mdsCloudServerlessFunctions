/* eslint-disable no-unused-expressions */

const chai = require('chai');
const sinon = require('sinon');

const runtimeReducer = require('./runtimes');

describe('src/runtimes', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('reduce', () => {
    it('returns nothing when runtime doesn\'t match', () => {
      const result = runtimeReducer.reduce(['unknown']);
      chai.expect(result).to.deep.equal([]);
    });

    it('returns matching runtime list when only matching runtime list provided', () => {
      const result = runtimeReducer.reduce(['node']);
      chai.expect(result).to.deep.equal(['node']);
    });

    it('returns matching runtime list when only matching runtime list provided (case insensitive)', () => {
      const result = runtimeReducer.reduce(['NODE']);
      chai.expect(result).to.deep.equal(['node']);
    });

    it('returns matching runtime list when matching runtime in list provided', () => {
      const result = runtimeReducer.reduce(['unknown', 'node', 'unknown2']);
      chai.expect(result).to.deep.equal(['node']);
    });
  });
});
