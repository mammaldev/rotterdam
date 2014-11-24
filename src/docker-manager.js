var Q = require('q');
var EventEmitter = require('events').EventEmitter;
var logger = (require('./logging')).get('logger');
var testImageNameEquality = require('./utils').testImageNameEquality;

module.exports = DockerManager;

function DockerManager ( docker ) {
  this.docker = docker;
}

DockerManager.prototype.isContainerRunning = function ( containerConfig ) {
  var deferred = Q.defer();
  this.docker.listContainers(function ( err, containers ) {
    if ( err ) {
      deferred.reject(err);
    }
    var exists = containers.some(function ( container ) {
      return testImageNameEquality(containerConfig.createOptions.Image, container.Image);
    });
    deferred.resolve(exists);
  });
  return deferred.promise;
};

DockerManager.prototype.getContainer = function ( id ) {
  var deferred = Q.defer();
  deferred.resolve(this.docker.getContainer(id));
  return deferred.promise;
};

DockerManager.prototype.listContainers = function ( all ) {
  var deferred = Q.defer();
  this.docker.listContainers({
    all: all ? 1 : 0,
  }, function ( err, containers ) {
    if ( err ) {
      deferred.reject(err);
    }
    deferred.resolve(containers);
  });
  return deferred.promise;
};

DockerManager.prototype.listContainersForImage = function ( imageName, all ) {
  return this.listContainers(all)
  .then(function ( containers ) {
    return containers.filter(function ( container ) {
      return testImageNameEquality(container.Image, imageName);
    });
  });
};

DockerManager.prototype.listContainersForName = function ( name, all ) {
  if ( name.indexOf('/') !== 0 ) {
    name = '/' + name;
  }
  return this.listContainers(all)
  .then(function ( containers ) {
    return containers.filter(function ( container ) {
      if ( !container.Names ) {
        return false;
      }
      return container.Names.some(function ( testName ) {
        return testName.indexOf(name) === 0 || testName === name;
      });
    });
  });
};

DockerManager.prototype.killContainer = function ( container ) {
  var deferred = Q.defer();
  container.kill(function ( err ) {
    if ( err ) {
      deferred.reject(err);
    }
    deferred.resolve(container);
  });
  deferred.resolve(container);
  return deferred.promise;
};

DockerManager.prototype.inspectContainer = function ( container ) {
  var deferred = Q.defer();
  container.inspect(function ( err, info ) {
    if ( err ) {
      deferred.reject(err);
    }
    deferred.resolve(info);
  });
  return deferred.promise;
};

DockerManager.prototype.removeContainer = function ( container ) {
  var deferred = Q.defer();
  container.remove({
    force: true,
  }, function ( err ) {
    if ( err ) {
      deferred.reject(err);
    }
    deferred.resolve(container);
  });
  return deferred.promise;
};

DockerManager.prototype.removeContainersForName = function ( name ) {
  var self = this;
  return this.listContainersForName(name, true)
  .then(function ( containers ) {
    return Q.all(
      containers.map(function ( container ) {
        return self.killContainer(self.docker.getContainer(container.Id))
        .then(self.removeContainer.bind(self));
      })
    );
  });
};

DockerManager.prototype.removeContainersForImage = function ( imageName ) {
  var self = this;
  return this.listContainersForImage(imageName, true)
  .then(function ( containers ) {
    return Q.all(
      containers.map(function ( container ) {
        return self.killContainer(self.docker.getContainer(container.Id))
        .then(self.removeContainer.bind(self));
      })
    );
  });
};
DockerManager.prototype.pullDockerImage = function ( image ) {
  var deferred = Q.defer();
  this.docker.pull(image, function (err, stream) {

    if ( err ) {
      deferred.reject(err);
    }

    if ( !stream ) {
      deferred.reject(new Error('Stream cannot be null'));
    }

    try {

      // streaming output from pull...
      stream.on('error', function ( err ) {
        deferred.reject(err);
      });

      stream.on('data', function ( data ) {
        var status = JSON.parse(data.toString());
        var progress = status.progressDetail && status.progressDetail.current ? status.progressDetail.current + '/' + status.progressDetail.total : '';
        logger.info('[' + image + ']', status.status, status.progress || progress);
      });

      stream.on('end', function (  ) {
        deferred.resolve();
      });
    } catch (err) {
      deferred.reject(err);
    }

  });
  return deferred.promise;
};

DockerManager.prototype.runDockerImage = function ( createOptions, startOptions, streamo, cb ) {
  var hub = new EventEmitter();

  logger.info('[' + createOptions.name + ']', 'Creating container for ' + createOptions.name);

  this.docker.createContainer(createOptions, function ( err, container ) {
    if ( err ) {
      return cb(err, container);
    }

    logger.info('[' + createOptions.name + ']', 'Attaching to container for ' + createOptions.name);

    hub.emit('container', container);

    container.attach({
      stream: true,
      stdout: true,
      stderr: true
    }, function (err, stream) {
      if ( err ) {
        return cb(err);
      }


      hub.emit('stream', stream);

      if ( streamo ) {
        if ( streamo instanceof Array ) {
          container.modem.demuxStream(stream, streamo[0], streamo[1]);
        } else {
          stream.setEncoding('utf8');
          stream.pipe(streamo, {
            end: true
          });
        }
      }

      logger.info('[' + createOptions.name + ']', 'Starting container for ' + createOptions.name);

      container.start(startOptions, function ( err, data ) {
        if ( err ) {
          return cb(err, data, container);
        }

        logger.info('[' + createOptions.name + ']', 'Started container for ' + createOptions.name);

        container.wait(function ( err, data ) {
          hub.emit('data', data);
        });

        cb(err, data, container);

      });
    });
  });

  return hub;
};

DockerManager.prototype.startContainer = function ( containerConfig ) {
  var self = this;
  var deferred = Q.defer();
  logger.info('[' + containerConfig.name + ']', containerConfig.name + ' started pull');
  self.pullDockerImage(containerConfig.createOptions.Image)
  .then(function () {
    logger.info('[' + containerConfig.name + ']', containerConfig.name + ' finished pull');

    containerConfig.createOptions.name = containerConfig.createOptions.name || containerConfig.name;

    var runningContainer = self.runDockerImage(
      containerConfig.createOptions,
      containerConfig.startOptions,
      process.stdout,
      function onExit( err, data, container ) {
        if ( err ) {
          if ( err.statusCode === 409 ) {
            logger.info('[' + containerConfig.name + ']', 'Rescuing Error:', err);
            // this container name has been taken already, let's remove it and then try again
            return deferred.resolve(
              self.removeContainersForName(containerConfig.name)
              .then(self.startContainer.bind(self, containerConfig)));
          }
          if ( container ) {
            if ( data && data.StatusCode ) {
              logger.error('[' + containerConfig.name + ']', containerConfig.name, ' running in', container.id, 'exited with code', data.StatusCode);
            } else {
              logger.error('[' + containerConfig.name + ']', containerConfig.name, ' running in', container.id, 'exited.');
            }
          } else {
            logger.error('[' + containerConfig.name + ']', containerConfig.name, 'exited', data);
          }
          logger.error('[' + containerConfig.name + ']', err);
          return deferred.reject(err);
        }
        logger.info('[' + containerConfig.name + ']', 'is now running');
        return deferred.resolve(container);
      }
    );

    runningContainer.on('data', function ( data ) {
      logger.info('[' + containerConfig.name + ']', 'data', data);
    });

    runningContainer.on('container', function ( container ) {
      logger.info('[' + containerConfig.name + ']', containerConfig.name + ' is running in container ', container.id);
    });

  });
  return deferred.promise;
};
