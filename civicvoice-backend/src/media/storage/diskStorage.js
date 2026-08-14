/**
 * diskStorage.js
 * -----------------------------------------------------------------------
 * Storage abstraction for saving media files locally on disk (MVP).
 * Ready to be swapped for S3/GCS implementation in production.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

class DiskStorage {
  async saveFile(filename, buffer) {
    const filePath = path.join(UPLOADS_DIR, filename);
    await fs.promises.writeFile(filePath, buffer);
    logger.info('Saved media file to disk', { filePath });
    return {
      filePath,
      url: `/api/media/${filename}`,
    };
  }

  async getFile(filename) {
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filename}`);
    }
    return fs.promises.readFile(filePath);
  }
}

module.exports = new DiskStorage();
