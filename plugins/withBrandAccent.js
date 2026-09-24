const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

/**
 * GymBro is dark-only. Native dialogs (Alert, pickers) are drawn by Android from
 * the activity theme, so without this they render light with teal buttons even
 * though the JS UI is dark. This pins a dark AppCompat theme, brand accent and
 * dialog surface.
 */
module.exports = function withBrandAccent(config, { accent = '#FF9F0A', dialogSurface = '#1C1C1F' } = {}) {
  return withAndroidStyles(config, (mod) => {
    const appTheme = AndroidConfig.Styles.getAppThemeGroup();
    const styles = mod.modResults.resources.style ?? [];
    const themeNode = styles.find((style) => style.$.name === appTheme.name);
    if (themeNode) themeNode.$.parent = 'Theme.AppCompat.NoActionBar';

    const values = {
      colorAccent: accent,
      'android:colorAccent': accent,
      colorBackgroundFloating: dialogSurface,
      'android:colorBackgroundFloating': dialogSurface,
    };
    for (const [name, value] of Object.entries(values)) {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, { add: true, parent: appTheme, name, value });
    }
    return mod;
  });
};
