'use strict';
module.exports = {
  // CloudBase static hosting (published 2026-10-12). This is the parent URL of
  // the uploaded assets/ directory, so asset paths append as <baseUrl>/assets/...
  baseUrl: 'https://cloud1-d1gw3jjv3de5cd7b1-1493828096.tcloudbaseapp.com/game-assets/v1',
  // Local development only: extract assets/ to the project root (gitignored),
  // then set this to true to avoid network round trips while iterating.
  useLocalAssets: false
};
