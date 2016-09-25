/*jshint node:true */
/*jshint nomen: true */
"use strict";
// Requires
var TSLint = require("tslint");
// import * as vinyl from "vinyl";
var through = require("through");
var gutil = require("gulp-util");
var PluginError = gutil.PluginError;
var map = require("map-stream");
/**
 * Helper function to check if a value is a function
 * @param {any} value to check whether or not it is a function
 * @returns {boolean} Returns true if the value is a function
 */
function isFunction(value) {
    return Object.prototype.toString.call(value) === "[object Function]";
}
/**
 * Helper function to check if a value is a string
 * @param {any} value to check whether or not it is a string
 * @returns {boolean} Returns true if the value is a string
 */
function isString(value) {
    return Object.prototype.toString.call(value) === "[object String]";
}
/**
 * Returns the TSLint from the options, or if not set, the default TSLint.
 * @param {PluginOptions} options
 * @returns {any} TSLint module
 */
function getTslint(options) {
    if (options && options.tslint) {
        return options.tslint;
    }
    return TSLint;
}
/**
 * Log an event or error using gutil.log.
 * @param {string} message the log message.
 * @param {string} level can be "error". Optional.
 * Leave empty for the default logging type.
 */
function log(message, level) {
    var prefix = "[" + gutil.colors.cyan("gulp-tslint") + "]";
    if (level === "error") {
        gutil.log(prefix, gutil.colors.red("error"), message);
    }
    else {
        gutil.log(prefix, message);
    }
}
/*
 * Convert a failure to the prose error format.
 * @param {Lint.RuleFailure} failure
 * @returns {string} The failure in the prose error formar.
 */
var proseErrorFormat = function (failure) {
    var fileName = failure.getFileName();
    var failureString = failure.getFailure();
    var lineAndCharacter = failure.getStartPosition().getLineAndCharacter();
    var line = lineAndCharacter.line + 1;
    var character = lineAndCharacter.character + 1;
    return fileName + " [" + line + ", " + character + "]: " + failureString;
};
/**
 * Main plugin function
 * @param {PluginOptions} [pluginOptions] contains the options for gulp-tslint.
 * Optional.
 * @returns {any}
 */
var tslintPlugin = function (pluginOptions) {
    var loader;
    var tslint;
    // If user options are undefined, set an empty options object
    if (!pluginOptions) {
        pluginOptions = {};
    }
    return map(function (file, cb) {
        // Skip
        if (file.isNull()) {
            return cb(null, file);
        }
        // Stream is not supported
        if (file.isStream()) {
            return cb(new PluginError("gulp-tslint", "Streaming not supported"));
        }
        // TSLint default options
        var options = {
            configuration: pluginOptions.configuration,
            formatter: pluginOptions.formatter || "prose",
            formattersDirectory: pluginOptions.formattersDirectory || null,
            program: pluginOptions.program || null,
            rulesDirectory: pluginOptions.rulesDirectory || null
        };
        var linter = getTslint(pluginOptions);
        if (pluginOptions.configuration === null ||
            pluginOptions.configuration === undefined ||
            isString(pluginOptions.configuration)) {
            // configuration can be a file path or null, if it's unknown
            options.configuration = linter.findConfiguration(pluginOptions.configuration || null, file.path);
        }
        tslint = new linter(file.relative, file.contents.toString("utf8"), options, options.program);
        file.tslint = tslint.lint();
        // Pass file
        cb(null, file);
    });
};
tslintPlugin.report = function (options) {
    // Notify the user that the old interface is used, this can be removed at some point
    if (isString(options)) {
        throw new Error("Deprecated interface used! See 6.0.0 changelog " +
            "https://github.com/panuhorsmalahti/gulp-tslint/blob/master/CHANGELOG.md");
    }
    // Default options
    if (!options) {
        options = {};
    }
    if (options.emitError === undefined) {
        options.emitError = true;
    }
    if (options.reportLimit === undefined) {
        // 0 or less is unlimited
        options.reportLimit = 0;
    }
    if (options.summarizeFailureOutput === undefined) {
        options.summarizeFailureOutput = false;
    }
    // Collect all files with errors
    var errorFiles = [];
    // Collect all failures
    var allFailures = [];
    // Track how many errors have been reported
    var totalReported = 0;
    // Log formatted output for each file individually
    var reportFailures = function (file) {
        var failureCount = file.tslint.failureCount;
        if (failureCount > 0) {
            errorFiles.push(file);
            Array.prototype.push.apply(allFailures, file.tslint.failures);
            if (options.reportLimit <= 0 || (options.reportLimit && options.reportLimit > totalReported)) {
                if (file.tslint.output !== undefined) {
                    console.log(file.tslint.output);
                }
                totalReported += failureCount;
                if (options.reportLimit > 0 &&
                    options.reportLimit <= totalReported) {
                    log("More than " + options.reportLimit
                        + " failures reported. Turning off reporter.");
                }
            }
        }
        // Pass file
        this.emit("data", file);
    };
    /**
     * After reporting on all files, throw the error.
     */
    var throwErrors = function () {
        // Throw error
        if (options && errorFiles.length > 0) {
            var failuresToOutput = allFailures;
            var ignoreFailureCount = 0;
            // If error count is limited, calculate number of errors not shown and slice reportLimit
            // number of errors to be included in the error.
            if (options.reportLimit > 0) {
                ignoreFailureCount = allFailures.length - options.reportLimit;
                failuresToOutput = allFailures.slice(0, options.reportLimit);
            }
            // Always use the proseErrorFormat for the error.
            var failureOutput = failuresToOutput.map(function (failure) {
                return proseErrorFormat(failure);
            }).join(", ");
            var errorOutput = "Failed to lint: ";
            if (options.summarizeFailureOutput) {
                errorOutput += failuresToOutput.length + " errors.";
            }
            else {
                errorOutput += failureOutput + ".";
            }
            if (ignoreFailureCount > 0) {
                errorOutput += " (" + ignoreFailureCount
                    + " other errors not shown.)";
            }
            if (options.emitError === true) {
                return this.emit("error", new PluginError("gulp-tslint", errorOutput));
            }
            else if (options.summarizeFailureOutput) {
                log(errorOutput);
            }
        }
        // Notify through that we're done
        this.emit("end");
    };
    return through(reportFailures, throwErrors);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = tslintPlugin;
// ES5/ES6 fallbacks
module.exports = tslintPlugin;
module.exports.default = tslintPlugin;
