var Rotterdam = require('./src/rotterdam');
var logger = (require('./src/logging')).get('logger');

var KEY_PREFIX = process.env.KEY_PREFIX || 'rotterdam:';
var CONTAINER_KEY_PREFIX = process.env.CONTAINER_KEY_PREFIX || KEY_PREFIX + 'containers:';
var CHANGES_QUEUE_KEY = KEY_PREFIX + 'changesqueue:';

var keyConfig = {
  KEY_PREFIX: KEY_PREFIX,
  CONTAINER_KEY_PREFIX: CONTAINER_KEY_PREFIX,
  CHANGES_QUEUE_KEY: CHANGES_QUEUE_KEY,
};

var redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

var SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';

var dockerConfig = {
  SOCKET: SOCKET,
};

var rotterdam = new Rotterdam(keyConfig, redisConfig, dockerConfig);

rotterdam.start()
.fail(function ( err ) {
  logger.error(err.message);
  logger.error(err.stack);
});
