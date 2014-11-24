var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');

var expect = chai.expect;

var DockerodeMock = require('../lib/mock-dockerode');
var DockerManager = require('../../src/docker-manager');


chai.use(chaiAsPromised);

chaiAsPromised.transferPromiseness = function ( assertion, promise ) {
  assertion.then = promise.then.bind(promise); // this is all you get by default
  assertion.finally = promise.finally.bind(promise);
  assertion.done = promise.done.bind(promise);
};

describe('DockerManager', function () {

  var docker = new DockerodeMock();

  var dockerManager = new DockerManager(docker);

  describe('#isContainerRunning', function () {

    it('should run without an error', function () {
      var config = {
        'createOptions': {
          'Image': 'image/name',
          'PortBindings': {},
          'Volumes': {}
        },
        'name': 'image',
        'startOptions': {
          'Binds': [],
          'Tty': false
        }
      };
      return expect(
        dockerManager.isContainerRunning(config)
      )
      .to.eventually.be.fulfilled;
    });

    it('should not get a matching config', function () {
      var config = {
        'createOptions': {
          'Image': 'image3/name',
          'PortBindings': {},
          'Volumes': {}
        },
        'name': 'image',
        'startOptions': {
          'Binds': [],
          'Tty': false
        }
      };
      return expect(
        dockerManager.isContainerRunning(config)
      )
      .to.eventually.equal(false);
    });

    it('should get a matching config', function () {
      var config = {
        'createOptions': {
          'Image': 'image/name',
          'PortBindings': {},
          'Volumes': {}
        },
        'name': 'image',
        'startOptions': {
          'Binds': [],
          'Tty': false
        }
      };
      return expect(
        dockerManager.isContainerRunning(config)
      )
      .to.eventually.equal(true);
    });

  });

  describe('#getContainer', function () {

    it('should run without an error', function () {
      return expect(
        dockerManager.getContainer()
      )
      .to.eventually.be.fulfilled;
    });

    it('should not get a container by id', function () {
      return expect(
        dockerManager.getContainer(Infinity)
      )
      .to.eventually.deep.equal(undefined);
    });

    it('should get a container by id', function () {
      return expect(
        dockerManager.getContainer(1)
      )
      .to.eventually.deep.equal(docker._containers[0]);
    });

  });

  describe('#listContainers', function () {

    it('should run without an error', function () {
      return expect(
        dockerManager.listContainers()
      )
      .to.eventually.be.fulfilled;
    });

    it('should not get a container by id', function () {
      return expect(
        dockerManager.listContainers()
      )
      .to.eventually.have.length(3);
    });

    it('should get a container by id', function () {
      return expect(
        dockerManager.getContainer(1)
      )
      .to.eventually.deep.equal(docker._containers[0]);
    });

  });

  describe('#listContainersForImage', function () {

    it('should run without an error', function () {
      return expect(
        dockerManager.listContainersForImage('image/name')
      )
      .to.eventually.be.fulfilled;
    });

    it('should only get running containers', function () {
      return expect(
        dockerManager.listContainersForImage('image/name')
      )
      .to.eventually.have.length(2);
    });

    it('should include non-running containers', function () {
      return expect(
        dockerManager.listContainersForImage('image/name', true)
      )
      .to.eventually.have.length(3);
    });

  });

  describe('#listContainersForName', function () {

    it('should run without an error', function () {
      return expect(
        dockerManager.listContainersForName('image1')
      )
      .to.eventually.be.fulfilled;
    });

    it('should only get running containers', function () {
      return expect(
        dockerManager.listContainersForName('image1')
      )
      .to.eventually.have.length(1);
    });

    it('shouldn\'t include non-matching containers', function () {
      return expect(
        dockerManager.listContainersForName('333', true)
      )
      .to.eventually.have.length(0);
    });

  });

  describe('#killContainer', function () {

    var callback = sinon.spy();
    var container = {
      kill: function (cb) {
        cb();
        callback();
      }
    };

    it('should call kill on the container', function () {
      return expect(
        dockerManager.killContainer(container)
        .then(function () {
          return callback.called;
        })
      )
      .to.eventually.equal(true);
    });

  });

  describe('#inspectContainer', function () {

    var callback = sinon.spy();
    var container = {
      inspect: function (cb) {
        cb();
        callback(null, {});
      }
    };

    it('should call inspect on the container', function () {
      return expect(
        dockerManager.inspectContainer(container)
        .then(function () {
          return callback.called;
        })
      )
      .to.eventually.equal(true);
    });

  });

  describe('#removeContainer', function () {

    var callback = sinon.spy();
    var container = {
      remove: function (args, cb) {
        cb();
        callback(null, {});
      }
    };

    it('should call remove on the container', function () {
      return expect(
        dockerManager.removeContainer(container)
        .then(function () {
          return callback.called;
        })
      )
      .to.eventually.equal(true);
    });

  });

  describe('#removeContainersForName', function () {

    var imageName = 'image/name' + Math.random();

    var callback = sinon.spy();
    var container = {
      'Id': imageName,
      'Image': imageName,
      'Names': [ '/' + imageName ],
      kill: function (cb) {
        cb();
      },
      remove: function (args, cb) {
        cb();
        callback(null, {});
      }
    };

    it('should call remove on the container', function () {
      docker._containers.push(container);
      return expect(
        dockerManager.removeContainersForName(imageName)
        .then(function () {
          return callback.called;
        })
      )
      .to.eventually.equal(true);
    });

  });

  describe('#removeContainersForImage', function () {

    var imageName = 'image33/name' + Math.random();

    var callback = sinon.spy();
    var container = {
      'Id': imageName,
      'Image': imageName,
      'Names': [ '/' + imageName ],
      kill: function (cb) {
        cb();
      },
      remove: function (args, cb) {
        cb();
        callback(null, {});
      }
    };

    it('should call remove on the container', function () {
      docker._containers.push(container);
      return expect(
        dockerManager.removeContainersForImage(imageName)
        .then(function () {
          return callback.called;
        })
      )
      .to.eventually.equal(true);
    });

  });

  describe('#pullDockerImage', function () {

    it('should resolve when the pull stream finishes', function () {
      return expect(
        dockerManager.pullDockerImage('image555/name')
      ).to.eventually.be.resolved;
    });

  });

  describe('#startContainer', function () {

    var config = {
      'createOptions': {
        'Image': 'image/name',
        'PortBindings': {},
        'Volumes': {}
      },
      'name': 'image',
      'startOptions': {
        'Binds': [],
        'Tty': false
      }
    };

    it('should resolve when the pull stream finishes', function () {
      return expect(
        dockerManager.startContainer(config)
      ).to.eventually.be.resolved;
    });

  });

  describe('#runDockerImage', function () {
  });
});
