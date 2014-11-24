var Q = require('q');
Q.longStackSupport = true;


var proxyquire = require('proxyquire');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

var expect = chai.expect;

var redisMock = require('redis-mock');
var dockerodeMock = require('../lib/mock-dockerode');

var Rotterdam = proxyquire('../../src/rotterdam', {
  fs: {
    statSync: function () {
      return {
        isSocket: function () {
          return true;
        }
      };
    }
  },
  redis: redisMock,
  dockerode: dockerodeMock,
  './logging': {
    get: function () {
      return {
        error: function () {},
        info: function () {}
      };
    }
  }
});


chai.use(chaiAsPromised);

chaiAsPromised.transferPromiseness = function ( assertion, promise ) {
  assertion.then = promise.then.bind(promise); // this is all you get by default
  assertion.finally = promise.finally.bind(promise);
  assertion.done = promise.done.bind(promise);
};

describe('Rotterdam', function () {

  var KEY_PREFIX = 'rotterdam:';
  var CONTAINER_KEY_PREFIX = KEY_PREFIX + 'containers:';
  var CHANGES_QUEUE_KEY = KEY_PREFIX + 'changesqueue';

  var keyConfig = {
    KEY_PREFIX: KEY_PREFIX,
    CONTAINER_KEY_PREFIX: CONTAINER_KEY_PREFIX,
    CHANGES_QUEUE_KEY: CHANGES_QUEUE_KEY,
  };

  var redisConfig = {};

  var SOCKET = '/var/run/docker.sock';

  var dockerConfig = {
    SOCKET: SOCKET,
  };

  describe('#new', function () {
    this.timeout(10000);

    var redisClientMock = redisMock.createClient(redisConfig);

    beforeEach(function ( done ) {
      var config = {
        "createOptions": {
          "Image": "repo/redis",
          "PortBindings": {
            "6379/tcp": []
          },
          "Volumes": {
            "/var/lib/redis": {}
          }
        },
        "name": "redis",
        "startOptions": {
          "Binds": [
            "/var/lib/redis:/var/lib/redis:rw"
          ],
          "Tty": false
        },
        "vhosts": {
          "3232": [
            "webapp.com"
          ]
        }
      };
      redisClientMock.set(CONTAINER_KEY_PREFIX + 'test-01', JSON.stringify(config), function() {
        done();
      });
    });

    it('should create without an error', function () {
      setTimeout(function () {
        var config = {
          "createOptions": {
            "Image": "repo/anotherone",
            "PortBindings": {
              "6379/tcp": []
            },
            "Volumes": {
              "/var/lib/redis": {}
            }
          },
          "name": "anotherone",
          "startOptions": {
            "Binds": [
              "/var/lib/redis:/var/lib/redis:rw"
            ],
            "Tty": false
          }
        };
        redisClientMock.set(CONTAINER_KEY_PREFIX + 'test-02', JSON.stringify(config), function() {});
      }, 0);
      return expect(new Rotterdam( keyConfig, redisConfig, dockerConfig ))
      .to.be.fulfilled;
    });
  });
});
