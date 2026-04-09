const crypto = require('crypto');
const fs = require('fs');

/**
 * Computes the SHA-256 hash of a file for duplicate detection (PRD §5.6).
 * @param {string} filePath — absolute path to the file
 * @returns {string} hex digest
 */
function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Computes the SHA-256 hash of an in-memory buffer.
 * @param {Buffer} buffer
 * @returns {string} hex digest
 */
function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = { hashFile, hashBuffer };
