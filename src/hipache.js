var Q = require('q');
var url = require('url');

module.exports = Hipache;

function Hipache ( qedis ) {
  this.qedis = qedis;
}

Hipache.prototype.setBackends = function ( vhost, identifier, backends ) {
  var self = this;
  var rotterdamKey = 'rotterdam:frontend:' + vhost;
  return this.qedis.sendCommand('exists', [ rotterdamKey ])
  .then(function ( exists ) {
    if ( exists ) {
      return self.qedis.multi([
        ['ltrim', rotterdamKey, 0, 0],
        ['rpush', rotterdamKey].concat(backends)
      ], 'exec');
    }
    return self.qedis.sendCommand('rpush', [ rotterdamKey, identifier ].concat(backends));
  });
};

Hipache.prototype.cleanUpBackends = function ( runningIps ) {
  var self = this;
  var rotterdamKey = 'rotterdam:frontend:';
  return self.qedis.sendCommand('keys', [ rotterdamKey + '*' ])
  .then(function ( keys ) {
    return Q.all(
      keys.map(function ( key ) {
        return self.qedis.sendCommand('lrange', [ key, 0, -1 ])
        .then(function ( values ) {
          var identifier = values.slice(0, 1)[ 0 ];
          var remainingIps = values.filter(function ( ip ) {
            return !!~runningIps.indexOf(url.parse(ip).hostname);
          });
          if ( remainingIps.length === 0 ) {
            return self.qedis.sendCommand('del', [ key ]);
          }
        });
      })
    );
  });
};
