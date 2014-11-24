var winston = require('winston');

// Define levels to be like log4j in java
var customLevels = {
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  },
  colors: {
    debug: 'blue',
    info: 'green',
    warn: 'yellow',
    error: 'red'
  }
};

// create the main logger
var logger = new(winston.Logger)({
  level: 'debug',
  levels: customLevels.levels,
  transports: [
    // setup console logging
    new (winston.transports.Console)({
      level: 'info', // Only write logs of info level or higher
      levels: customLevels.levels,
      colorize: true,
      timestamp: true,
    })
  ]
});

// make winston aware of your awesome colour choices
winston.addColors(customLevels.colors);

var Logging = function() {
  var loggers = {};

  // always return the singleton instance, if it has been initialised once already.
  if (Logging.prototype._singletonInstance) {
    return Logging.prototype._singletonInstance;
  }

  this.getLogger = function(name) {
    return loggers[name];
  };

  this.get = this.getLogger;

  loggers.logger = logger;

  Logging.prototype._singletonInstance = this;
};

module.exports = new Logging();
