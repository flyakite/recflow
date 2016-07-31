var gulp = require('gulp'),
    electron = require('gulp-electron'),
    info = require('./src/package.json');

gulp.task('electron', function() {
    gulp.src("")
    .pipe(electron({
        src: './src',
        packageJson: info,
        release: './dist',
        cache: './cache',
        version: 'v0.1.0',
        packaging: true,
        platforms: ['win32-ia32', 'darwin-x64'],
        platformResources: {
            darwin: {
                CFBundleDisplayName: info.name,
                CFBundleIdentifier: info.bundle,
                CFBundleName: info.name,
                CFBundleVersion: info.version
                // icon: '.icns'
            },
            win: {
                "version-string": info.version,
                "file-version": info.version,
                "product-version": info.version
                // "icon": '.ico'
            }
        }
    }))
    .pipe(gulp.dest(""));
});
