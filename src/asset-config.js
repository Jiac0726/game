'use strict';
module.exports = {
  // Upload the ZIP's assets/ directory unchanged, then set its parent HTTPS URL.
  // CloudBase www.gskj.cloud root route serves files from the gamecenter static application.
  baseUrl: 'https://www.gskj.cloud/game-assets/v1',
  // Local development only: extract assets/ to the project root (gitignored).
  useLocalAssets: false
};
