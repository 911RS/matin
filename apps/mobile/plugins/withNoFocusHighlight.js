const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

module.exports = function withNoFocusHighlight(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:defaultFocusHighlightEnabled',
      value: 'false',
    });
    return cfg;
  });
};
