const config = require('./config');
App({ onLaunch() { if (config.envId && wx.cloud) wx.cloud.init({env:config.envId}); } });
