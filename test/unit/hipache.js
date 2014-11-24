var Q = require('q');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

var expect = chai.expect;

var Hipache = require('../../src/hipache');

chai.use(chaiAsPromised);

chaiAsPromised.transferPromiseness = function ( assertion, promise ) {
  assertion.then = promise.then.bind(promise); // this is all you get by default
  assertion.finally = promise.finally.bind(promise);
  assertion.done = promise.done.bind(promise);
};

describe('Hipache', function () {

  var qedis = {
    _redis: {},
    _sentCommands: {},
    multi: function ( commands ) {
      var self = this;
      return commands.reduce(function ( soFar, args ) {
        var action = commands.shift();
        return soFar
        .then(function () {
          return self.sendCommand(action, args);
        });
      }, Q.when());
    },
    sendCommand: function ( action, args ) {
      var self = this;
      return Q.fcall(function () {
        self._sentCommands[ action ] = self._sentCommands[ action ] || [];
        var keyLessArgs = args.slice(0);
        var key = keyLessArgs.shift();
        self._sentCommands[ action ].push(args);
        switch ( action ) {
          case 'exists':
            return self._redis.hasOwnProperty(key);
          case 'del':
            delete self._redis[ key ];
            break;
          case 'rpush':
            self._redis[ key ] = self._redis[ key ] || [];
            self._redis[ key ] = self._redis[ key ].concat( keyLessArgs );
            break;
          case 'ltrim':
            self._redis[ key ] = self._redis[ key ] || [];
            self._redis[ key ].shift();
            break;
        }
        return self._redis[ key ];
      });
    }
  };

  function resetQedis() {
    qedis._redis = {};
    qedis._sentCommands = {};
  }

  var hipache = new Hipache(qedis);

  describe('#setBackends', function () {
    var vhost = 'vhost';
    var identifier = 'identifier';
    var backends = [1, 2, 3];

    it('should create without an error', function () {
      resetQedis();
      return expect(hipache.setBackends(vhost, identifier, backends))
      .to.eventually.be.fulfilled;
    });

    it('should create the correct record', function () {
      resetQedis();
      return expect(
        hipache.setBackends(vhost, identifier, backends)
        .then(function () {
          return qedis._redis[ 'frontend:' + vhost ];
        })
      )
      .to.eventually.deep.equal([ identifier ].concat(backends));
    });

    var newBackends = [4, 5];

    it('should update without an error', function () {
      return expect(hipache.setBackends(vhost, identifier, newBackends))
      .to.eventually.be.fulfilled;
    });

    it('should update the correct record', function () {
      resetQedis();
      return expect(
        hipache.setBackends(vhost, identifier, newBackends)
        .then(function () {
          return qedis._redis[ 'frontend:' + vhost ];
        })
      )
      .to.eventually.deep.equal([ identifier ].concat(newBackends));
    });

  });
});
