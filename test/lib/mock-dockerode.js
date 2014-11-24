var MockStream = require('../lib/mock-stream');
var MockContainer = require('../lib/mock-container');

module.exports = MockDockerode;

function MockDockerode () {
  return {
    _containers: [
      new MockContainer({
        'Id': 1,
        'Image': 'image/name',
        'Names': ['/image1'],
        running: true
      }),
      new MockContainer({
        'Id': 2,
        'Image': 'image/name',
        'Names': ['/weeee', '/image2'],
        running: true
      }),
      new MockContainer({
        'Id': 3,
        'Image': 'image/name',
        'Names': ['/image3'],
        running: false
      }),
      new MockContainer({
        'Id': 4,
        'Image': 'image2/name',
        'Names': ['/weeee2', '/image2'],
        running: true
      })
    ],
    listContainers: function ( args, cb ) {
      if ( !cb ) {
        cb = args;
        args = {};
      }
      var containers = this._containers.filter(function ( container ) {
        return args.all ? true : container.running;
      });
      return cb.call(null, null, containers);
    },
    createContainer: function ( createOptions, cb ) {
      cb(null, new MockContainer({
        'Id': 5,
        'Image': 'image2/name',
        running: true,
      }));
    },
    getContainer: function ( id ) {
      return this._containers.filter(function ( container ) {
        return container.Id === id;
      })[0];
    },
    inspectContainer: function ( container, cb ) {
      container.inspect(cb);
    },
    pull: function (image, cb) {
      var stream = new MockStream('{"status":"Pulling", "progress":"100 B/ 100 B", "progressDetail":{"current":100, "total":100}}');

      cb(null, stream);
    }
  };
}
