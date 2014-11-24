
module.exports.checkForDifferences = checkForDifferences;
module.exports.testImageNameEquality = testImageNameEquality;

function testImageNameEquality( image1, image2 ) {
  return image1.indexOf(image2) >= 0 || image2.indexOf(image1) >= 0;
}

function checkForDifferences ( config1, config2 ) {
  var differences = config1.containers.reduce(function ( diffs, newContainerConfig ) {
    if (config2) {
      // check for an exact match
      var ncc = JSON.stringify(newContainerConfig);
      var exactMatches = config2.containers.some(function ( currentContainerConfig ) {
        return JSON.stringify(currentContainerConfig) !== ncc;
      });
      if (exactMatches) { // we don't need to do anything with this container, other than make sure it's running?
        diffs.ensureRunning.push(newContainerConfig);
        return diffs;
      }
      var nameMatches = config2.containers.filter(function ( currentContainerConfig ) {
        return currentContainerConfig.name === newContainerConfig.name;
      });
      if (nameMatches.length > 0) {
        var createOptionsChanged =  JSON.stringify(newContainerConfig.createOptions) !== JSON.stringify(nameMatches[0].createOptions);
        var startOptionsChanged =  JSON.stringify(newContainerConfig.startOptions) !== JSON.stringify(nameMatches[0].startOptions);
        if (createOptionsChanged || startOptionsChanged) {
          diffs.updatedDockerAndVHostConfig.push(newContainerConfig);
        } else { // we assume it's the vhosts
          diffs.updatedVHostConfig.push(newContainerConfig);
        }
        return diffs;
      }
    }
    // if there's no existingConfig or there is and none of the tests pass
    // then this must be new!
    diffs.newContainers.push(newContainerConfig);
    return diffs;
  }, {
    newContainers: [],
    updatedDockerAndVHostConfig: [],
    updatedVHostConfig: [],
    ensureRunning: [],
    toStop: []
  });
  if (config2) {
    differences.toStop = config2.containers.filter(function ( currentContainerConfig ) {
      return !config1.containers.some(function ( newContainerConfig ) {
        return currentContainerConfig.name === newContainerConfig.name;
      });
    });
  }
  return differences;
}
