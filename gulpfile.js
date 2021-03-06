//General
var gulp = require('gulp');
var replace = require('gulp-replace');
var rename = require('gulp-rename');
var gutil = require('gulp-util');
var es = require('event-stream');
var prettydata = require('gulp-pretty-data');
var gulpif = require('gulp-if');
var lazypipe = require('lazypipe');
var ui5preload = require('gulp-ui5-preload');
var jsdoc = require('gulp-jsdoc3');
var plumber = require('gulp-plumber');

//Scripts and tests
var htmlhint = require('gulp-htmlhint');
var jshint = require('gulp-jshint');
var jsonlint = require("gulp-jsonlint");
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

//Styles
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var sourcemaps = require('gulp-sourcemaps');

//Tools
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var inquirer = require('inquirer');

//Runtime variables
var CONFIG = require('./config.json');
var onError = function (err) {  
  gutil.log(err.toString());
  this.emit('end');
};

var TYPES = [
    "Formatter",
    "Fragment",
    "I18n",
    "View & Controller"
];

var add = {
    formatter: function (name, f) {
        return gulp.src('templates/formatter.js')
            .pipe(plumber({
                errorHandler: onError
            }))
            .pipe(rename(f))
            .pipe(replace("{{formatter_name}}", name))
            .pipe(gulp.dest('app/model')).on('end', function () {
                return gutil.log("File " + name + " added to app/model");
            })
    },
    fragment: function (name) {
        return gulp.src('templates/fragment.xml')
            .pipe(plumber({
                errorHandler: onError
            }))
            .pipe(rename(name))
            .pipe(gulp.dest('app/view')).on('end', function () {
                return gutil.log("File " + name + " added to app/view");
            })
    },
    i18n: function (name) {
        return gulp.src('app/i18n/i18n.properties')
            .pipe(plumber({
                errorHandler: onError
            }))
            .pipe(rename(name))
            .pipe(gulp.dest('app/i18n')).on('end', function () {
                return gutil.log("File " + name + " added to app/i18n");
            })
    },
    view_controller: function (name, v, c) {
        return es.concat(
            gulp.src('templates/controller.js')
            .pipe(plumber({
                errorHandler: onError
            }))
            .pipe(replace("{{controller_name}}", name))
            .pipe(rename(c))
            .pipe(gulp.dest('app/controller')).on('end', function () {
                return gutil.log("File " + c + " added to app/controller");
            }),
            gulp.src('templates/view.xml')
            .pipe(plumber({
                errorHandler: onError
            }))
            .pipe(replace("{{controller_name}}", name))
            .pipe(rename(v))
            .pipe(gulp.dest('app/view')).on('end', function () {
                return gutil.log("File " + v + " added to app/view");
            })
        );
    }
}

gulp.task('add', function () {
    return inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: "Choose type of file: ",
        choices: TYPES
    }, {
        type: 'input',
        name: 'name',
        message: "File name (without extensions): "
    }]).then(function (answer) {
        if (answer.name) {
            switch (answer.type) {
                case TYPES[0]:
                    add.formatter(answer.name, answer.name + ".js");
                    break;
                case TYPES[1]:
                    add.fragment(answer.name + ".xml");
                    break;
                case TYPES[2]:
                    add.i18n("i18n-" + answer.name.toLowerCase() + ".properties");
                    break;
                case TYPES[3]:
                    add.view_controller(answer.name, answer.name + ".view.xml", answer.name + ".controller.js");
                    break;
            }
        } else {
            gutil.log('File name is required.');
        }
    });
})

gulp.task('html', function () {
    return gulp.src('app/*.html')
        .pipe(plumber({
            errorHandler: onError
        }))
        .pipe(replace("{{app_name}}", CONFIG.app_name))
        .pipe(replace("{{app_theme}}", CONFIG.app_theme))
        .pipe(replace("{{app_resource}}", CONFIG.app_resource))
        .pipe(replace("{{namespace}}", CONFIG.namespace))
        .pipe(htmlhint())
        .pipe(htmlhint.reporter("htmlhint-stylish"))
        .pipe(gulp.dest('dist'))
})

gulp.task('json', function () {
    return gulp.src('app/**/**.json')
        .pipe(plumber({
            errorHandler: onError
        }))
        .pipe(replace("{{namespace}}", CONFIG.namespace))
        .pipe(jsonlint())
        .pipe(jsonlint.reporter(function(file){
            gutil.log('File ' + file.path + ' is not a valid JSON file.');
        }))
        .pipe(gulp.dest('dist'))
})

gulp.task('sass', function () {
    return gulp.src('app/scss/*.scss')
        .pipe(plumber({
            errorHandler: onError
        }))
        .pipe(sourcemaps.init())
        .pipe(sass())
        .pipe(autoprefixer())
        .pipe(sourcemaps.write())
        .pipe(concat('style.css'))
        .pipe(gulp.dest('dist/css'))
        .pipe(browserSync.stream())
})

gulp.task('preload', function () {
    var jshintChannel = lazypipe()
        .pipe(jshint)
        .pipe(jshint.reporter, 'jshint-stylish')
        .pipe(uglify);
    var xmlChannel = lazypipe()
        .pipe(prettydata, {
            type: 'minify'
        });

    return gulp.src([
            'app/**/**.+(js|xml|properties)'
        ])
        .pipe(plumber({
            errorHandler: onError
        }))
        .pipe(replace("{{namespace}}", CONFIG.namespace))
        .pipe(gulpif('**/*.js', jshintChannel())) //only pass .js files
        .pipe(gulpif('**/*.xml', xmlChannel())) // only pass .xml files
        .pipe(ui5preload({
            base: 'app/',
            namespace: CONFIG.namespace
        }))
        .pipe(gulp.dest('dist'));
})


gulp.task('browserSync', function () {
    browserSync({
        server: {
            baseDir: 'dist'
        }
    });
})

gulp.task('watch', function () {
    gulp.watch('app/scss/*.scss', ['sass']);
    gulp.watch('app/*.html', ['html']).on('change', reload);
    gulp.watch('app/**/**.json', ['json']).on('change', reload);
    gulp.watch('app/**/**.+(js|xml|properties)', ['preload']).on('change', reload);
})

gulp.task('docs', function(cb){
    var config = require('./jsdoc.json');
    gulp.src(['app/README.md', './app/**/*.js'], {
        read: false
    })
    .pipe(plumber({
        errorHandler: onError
    }))
    .pipe(jsdoc(config, cb));
})

gulp.task('test', function(cb){
    return cb;
})

gulp.task('default', ['html', 'json', 'sass', 'preload', 'docs', 'browserSync', 'watch'])