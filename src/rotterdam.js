var Q = require('q');
var logger = (require('./logging')).get('logger');
var redis = require('redis');
var Docker = require('dockerode');
var DockerManager = require('./docker-manager');
var Hipache = require('./hipache');
var fs = require('fs');

module.exports = Rotterdam;

function Rotterdam ( keyConfig, redisConfig, dockerConfig ) {

  var self = this;

  this.keyConfig = keyConfig;
  this.redisConfig = redisConfig;
  this.dockerConfig = dockerConfig;

  if (process.env.NODE_ENV !== 'production') {
    Q.longStackSupport = true;
  }

  try {
    var stats = fs.statSync(dockerConfig.SOCKET);
    if (!stats.isSocket()) {
      throw new Error('Are you sure the docker is running?');
    }
  } catch (err) {
    logger.error(err.stack);
    process.exit(-1);
  }

  this.redisClient = redis.createClient(redisConfig);
  this.redisQueueClient = redis.createClient(redisConfig);
  this.redisSubscriberClient = redis.createClient(redisConfig);
  this.qedis = new (require('qedis'))(this.redisClient);
  this.qedisQueue = new (require('qedis'))(this.redisQueueClient);

  this.docker = new Docker({
    socketPath: dockerConfig.SOCKET
  });

  this.dockerManager = new DockerManager(this.docker);
  this.hipache = new Hipache(this.qedis);

  // handle changes to the rotterdam:containers keyspace
  this.redisSubscriberClient.on('pmessage', function ( pattern, channel, message ) {
    // TODO: we could do smart things here based on the command sent
    // through message
    logger.info('[GENERAL] change detected to ', channel + ':', message);
    self.triggerChange()
    .fail(self.handleError);
  });

  // start listening to changes in the rotterdam:containers keyspace
  this.redisSubscriberClient.psubscribe('__keyspace@0__:' + self.keyConfig.CONTAINER_KEY_PREFIX + '*');

}

Rotterdam.prototype.start = function () {
  var self = this;
  // Check for changes on startup
  return self.triggerChangesIfNecessary()
  .then(self.processQueue.bind(self));
};

Rotterdam.prototype.triggerChangesIfNecessary = function () {
  var self = this;
  logger.info('[GENERAL] ===================');
  logger.info('[GENERAL] looking for changes');
  logger.info('[GENERAL] ===================');
  return self.checkForChanges()
  .then(function ( changes ) {
    if ( changes.configsToStart.concat(changes.containersToAttachTo).concat(changes.containersToRemove).length > 0 ) {
      // trigger container changes
      return self.triggerChange();
    }
  });
};

Rotterdam.prototype.checkForChanges = function () {
  var self = this;
  return Q.all([
    self.getContainerConfigs(),
    self.dockerManager.listContainers(true)
  ])
  .spread(function ( containerConfigs, existingContainers ) {

    var configsToStart = [];
    var containersToAttachTo = [];
    var containersToRemove = [];

    // find which of the container configs are all ready running
    containerConfigs.forEach(function ( config ) {
      var matchedContainers = existingContainers.filter(function ( container ) {
        return !containerIsDead(container) && self.testConfigContainerEquality( config, container );
      });
      if ( matchedContainers.length > 0 ) {
        containersToAttachTo = containersToAttachTo.concat( matchedContainers );
      } else {
        configsToStart.push( config );
      }
    });

    logger.info('[GENERAL] existingContainers', existingContainers.length);

    // find which running containers we need to remove
    existingContainers.forEach(function ( container ) {
      var matchedConfigs = containerConfigs.filter(function ( config ) {
        return self.testConfigContainerEquality( config, container );
      });

      // if the container is dead, lets remove it
      if (matchedConfigs.length === 0 || containerIsDead(container)) {
        containersToRemove.push(container);
      }

    });

    logger.info('[GENERAL] configsToStart', configsToStart.length);
    logger.info('[GENERAL] containersToAttachTo', containersToAttachTo.length);
    logger.info('[GENERAL] containersToRemove', containersToRemove.length);

    return {
      configsToStart: configsToStart,
      containersToAttachTo: containersToAttachTo,
      containersToRemove: containersToRemove,
    };

  });
};

Rotterdam.prototype.processQueue = function () {
  var self = this;
  logger.info('[GENERAL] ===================');
  logger.info('[GENERAL] waiting for changes');
  logger.info('[GENERAL] ===================');
  return self.waitForChangesFromProcessingQueue()
  .then(self.checkForChanges.bind(self))
  .then(self.applyChanges.bind(self))
  .then(self.processQueue.bind(self))
  .fail(function ( err ) {
    self.handleError( err );
    return self.processQueue();
  });
};

Rotterdam.prototype.waitForChangesFromProcessingQueue = function () {
  return this.qedisQueue.sendCommand('blpop', [this.keyConfig.CHANGES_QUEUE_KEY, 0]);
};

Rotterdam.prototype.triggerChange = function () {
  return this.qedis.sendCommand('rpush', [this.keyConfig.CHANGES_QUEUE_KEY, 1]);
};

Rotterdam.prototype.applyChanges = function ( changes ) {
  var self = this;
  logger.info('[GENERAL] ===================');
  logger.info('[GENERAL] applying changes in order:');
  logger.info('[GENERAL] ===================');

  var i = 0;
  changes.containersToRemove.forEach(function ( container ) {
    logger.info('[GENERAL]   ', i++, ') removing ' + getDefaultName(container));
  });
  changes.configsToStart.forEach(function ( containerConfig ) {
    logger.info('[GENERAL]   ', i++, ') starting ' + containerConfig.name );
  });

  // stop/ remove containersToRemove
  var removeContainerPromise = Q.all(
    changes.containersToRemove.map(function ( container ) {
      return self.dockerManager.getContainer( container.Id )
      .then(self.dockerManager.killContainer.bind( self.dockerManager ))
      .then(self.dockerManager.removeContainer.bind( self.dockerManager ));
    })
  );
  // attach to containersToAttachTo

  // start new containers
  var removeAndStartContainerPromise = changes.configsToStart.reduce(function ( soFar, containerConfig ) {
    return soFar
    .then(self.dockerManager.startContainer.bind(self.dockerManager, containerConfig))
    .then(function (container) {
      logger.info('[' + containerConfig.name + ']', 'started', containerConfig.name);
      if (containerConfig.vhosts) {
        logger.info('[' + containerConfig.name + ']', 'updatingVHosts');
        return self.updateVHosts(container, containerConfig)
        .thenResolve(container);
      }
      return container;
    });
  }, removeContainerPromise);

  return removeAndStartContainerPromise
  .then(this.cleanUpVHosts.bind(this))
  .then(function () {
    logger.info('[GENERAL] ===================');
    logger.info('[GENERAL] finished applying changes');
    logger.info('[GENERAL] ===================');
  });

};

Rotterdam.prototype.handleError = function ( err ) {
  logger.error(err.message);
  logger.error(err.stack);
};

Rotterdam.prototype.testConfigContainerEquality = function ( config, container ) {
  var nameMatch = container.Names.some(function ( name ) {
    return name === '/' + config.name;
  });
  return (
      container.Image.indexOf(config.createOptions.Image) >= 0 ||
      config.createOptions.Image.indexOf(container.Image) >= 0
    ) && nameMatch;
};

Rotterdam.prototype.getContainerConfigs = function () {
  var self = this;
  return self.qedis.sendCommand('keys', [ self.keyConfig.CONTAINER_KEY_PREFIX + '*' ])
  .then(function ( keys ) {
    return Q.all(
      keys.map(function ( key ) {
        return self.qedis.get(key);
      })
    );
  });
};

Rotterdam.prototype.getContainerConfigByName = function ( name ) {
  return this.getContainerConfigs()
  .then(function( configs ) {
    var matchedConfigs = configs.filter(function ( config ) {
      return config.name === name;
    });
    if ( matchedConfigs.length > 0 ) {
      return matchedConfigs[0];
    }
    return null;
  });
};

Rotterdam.prototype.updateVHosts = function ( container, containerConfig ) {
  var self = this;
  return Q.delay(5000) // let docker catch up
  .then(self.dockerManager.inspectContainer.bind(self.dockerManager, container))
  .then(function ( info ) {
    var newBackends = Object.keys(containerConfig.vhosts).map(function ( port ) {
      if (!info.NetworkSettings) {
        throw new Error('Inspecting the container didn\'t return the expected value');
      }
      return {
        url: 'http://' + info.NetworkSettings.IPAddress + ':' + port,
        vhosts: containerConfig.vhosts[port]
      };
    });
    logger.info('[' + containerConfig.name + ']', 'updatingVHosts', newBackends);
    return Q.all(
      newBackends.reduce(function ( arr, newBackend ) {
        return arr.concat(
          newBackend.vhosts.map(function ( vhost ) {
            return self.hipache.setBackends(vhost, containerConfig.name, newBackend.url);
          })
        );
      }, [])
    );
  });
};

Rotterdam.prototype.cleanUpVHosts = function ( ) {
  // get all running containers
  var self = this;
  return self.dockerManager.listContainers(true)
  .then(function ( existingContainers ) {
    Q.all(
        existingContainers.map(function ( container ) {
          return self.dockerManager.getContainer(container.Id)
          .then(self.dockerManager.inspectContainer.bind(self.dockerManager));
        })
    )
    .then(function( containerDetails ) {
      var ips = containerDetails.map(function ( details ) {
        return details.NetworkSettings.IPAddress;
      });
      return self.hipache.cleanUpBackends( ips );
    });
  });
};

function getDefaultName( container ) {
  return container.Names[0].replace(/^\//, '');
}

function containerIsDead( container ) {
  return container.Status === '' || /Exited/.test(container.Status);
}
