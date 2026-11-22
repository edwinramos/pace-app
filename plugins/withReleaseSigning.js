const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Configura signingConfigs.release en android/app/build.gradle leyendo las
 * variables de entorno PACE_UPLOAD_* (si están presentes), o cayendo a debug.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    const releaseConfigBlock = `        release {
            def storeFilePath = System.getenv("PACE_UPLOAD_STORE_FILE")
            if (storeFilePath) {
                storeFile file(storeFilePath)
                storePassword System.getenv("PACE_UPLOAD_STORE_PASSWORD")
                keyAlias System.getenv("PACE_UPLOAD_KEY_ALIAS")
                keyPassword System.getenv("PACE_UPLOAD_KEY_PASSWORD")
            }
        }`;

    if (!contents.includes('PACE_UPLOAD_STORE_FILE')) {
      contents = contents.replace(
        /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n        \})/,
        `$1\n${releaseConfigBlock}`,
      );
      contents = contents.replace(
        /(release\s*\{\s*\/\/ Caution![\s\S]*?signingConfig\s+)signingConfigs\.debug/,
        '$1System.getenv("PACE_UPLOAD_STORE_FILE") ? signingConfigs.release : signingConfigs.debug',
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
