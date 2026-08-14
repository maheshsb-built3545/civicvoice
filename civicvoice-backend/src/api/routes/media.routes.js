const express = require('express');
const { getMedia } = require('../controllers/media.controller');
const router = express.Router();

router.get('/:filename', getMedia);

module.exports = router;
