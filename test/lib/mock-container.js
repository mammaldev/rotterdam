var extend = require('xtend');

module.exports = MockContainer;

function MockContainer ( opts ) {
  return extend(opts, {
    start: function ( startOptions, cb ) {
      cb(null, {
        pipe: function () {}
      });
    },
    kill: function ( cb ) {
      this.running = false;
      cb(null);
    },
    remove: function ( opts, cb ) {
      cb(null);
    },
    wait: function ( cb ) {
      cb(null, this);
    },
    inspect: function ( cb ) {
      var info = {
        "Args": [],
        "Config": {
          "AttachStderr": false,
          "AttachStdin": false,
          "AttachStdout": false,
          "Cmd": null,
          "CpuShares": 0,
          "Cpuset": "",
          "Domainname": "",
          "Entrypoint": [],
          "Env": [],
          "ExposedPorts": {
            "6379/tcp": {}
          },
          "Hostname": "98c5cda821bf",
          "Image": this.Image,
          "Memory": 0,
          "MemorySwap": 0,
          "NetworkDisabled": false,
          "OnBuild": null,
          "OpenStdin": false,
          "PortSpecs": null,
          "StdinOnce": false,
          "Tty": false,
          "User": "",
          "Volumes": {
            "/data": {}
          },
          "WorkingDir": ""
        },
        "Created": "2014-09-29T12:23:51.628006009Z",
        "Driver": "aufs",
        "ExecDriver": "native-0.2",
        "HostConfig": {
          "Binds": [],
          "ContainerIDFile": "",
          "Dns": null,
          "DnsSearch": null,
          "Links": null,
          "LxcConf": null,
          "NetworkMode": "",
          "PortBindings": null,
          "Privileged": false,
          "PublishAllPorts": false,
          "VolumesFrom": null
        },
        "HostnamePath": "abc/hostname",
        "HostsPath": "abc/hosts",
        "Id": this.Id,
        "Image": this.Id,
        "MountLabel": "",
        "Name": this.Name,
        "NetworkSettings": {
          "Bridge": "docker0",
          "Gateway": "172.17.42.1",
          "IPAddress": "172.17.6.166",
          "IPPrefixLen": 16,
          "PortMapping": null,
          "Ports": {
            "6379/tcp": null
          }
        },
        "Path": "",
        "ProcessLabel": "",
        "ResolvConfPath": "",
        "State": {
          "ExitCode": 0,
          "FinishedAt": "0001-01-01T00:00:00Z",
          "Paused": false,
          "Pid": 14210,
          "Running": true,
          "StartedAt": "2014-09-29T12:23:51.840905269Z"
        },
        "Volumes": {
          "/data": ""
        },
        "VolumesRW": {
          "/data": true
        }
      };
      cb(null, info);
    },
    attach: function ( opt, cb ) {
      cb(null, {
        pipe: function ( stream, opt ) {},
        setEncoding: function () {},
      });
    },
    modem: {
      demuxStream: function () {

      }
    }
  });
}
