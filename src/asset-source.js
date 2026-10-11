'use strict';
const paths = require('./asset-files');

function createAssetFiles(config = {}) {
  if (config.useLocalAssets === true) return { ...paths };
  const base = String(config.baseUrl || '').trim().replace(/\/+$/, '');
  // No hosting address yet: the game keeps its built-in drawn components.
  if (!base) return {};
  if (!/^https:\/\/[^/?#\s:]+(?:\/[^?#\s]*)?$/.test(base) || /(?:^|\/)\.\.(?:\/|$)/.test(base)) {
    throw new Error('素材库 baseUrl 必须为不带查询参数的 HTTPS 目录地址');
  }
  const files = {};
  for (const id of Object.keys(paths)) {
    const path = paths[id];
    if (!/^assets\//.test(path) || path.split('/').includes('..')) {
      throw new Error('素材路径非法: ' + id);
    }
    files[id] = base + '/' + path.split('/').map(encodeURIComponent).join('/');
  }
  return files;
}
module.exports = { createAssetFiles };
