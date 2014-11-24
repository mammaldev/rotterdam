A standalone app that simplifies automation of your [`Continuous Integration` / `Quality Assurance` / `End to End Testing`] environments.

---

Rotterdam watches redis for changes to a set of docker container configurations. It then executes the running/ stopping/ updating of these containers seamlessly.

Rotterdam also has the ability to serve containers on virtualhosts with [hipache](https://github.com/hipache/hipache).

This means that you can deploy isolated builds of your application to public urls easily from git / jenkins/ whatever, and then share them with your QA team.

## Installation

Rotterdam is available via npm. Install it globally using the command:

`npm install -g rotterdam`

Rotterdam's only dependencies are [node](http://nodejs.org), [redis](http://redis.io/) and [docker](https://www.docker.com/). You should be able to install redis using your distro's package manager. On ubuntu installing everything you need to run rotterdam is as easy as:

```bash
apt-get -y install software-properties-common python-software-properties
add-apt-repository -y ppa:rwky/redis
apt-get -y update
apt-get install -y redis-server git nodejs npm docker.io
```

(You may need to run these using `sudo`)

## Redis conf

For watching for changes to redis keyspaces we require that redis has the following enabled:

`redis-cli CONFIG SET notify-keyspace-events KEA`

### Running Rotterdam

We ([mammal](http://mammal.io)) prefer to run rotterdam via [pm2](https://github.com/Unitech/pm2). But you're free to use something like [supervisor](http://supervisord.org/) or an upstart script.

Once you've got `pm2` installed you should be able to start rotterdam by running:

`pm2 start rotterdam`

Alternatively if you'd just like to test it out the `rotterdam` bin file should be in your `$PATH` so just calling `rotterdam` will have the same effect.


## Configuration

All rotterdam config is done via `env` variables. The defaults are:

```bash
KEY_PREFIX='rotterdam:'
CONTAINER_KEY_PREFIX=$KEY_PREFIX'containers:'
CHANGES_QUEUE_KEY=$KEY_PREFIX'changesqueue:'

REDIS_HOST='127.0.0.1'
REDIS_PORT=6379

DOCKER_SOCKET='/var/run/docker.sock'

```

## Container definitions

Containers to be run can be defined as follows:

```js
{
  "name": "{{ the display name }}",
  "createOptions": {
    // Anything from http://docs.docker.com/reference/api/docker_remote_api_v1.15/#create-a-container
  },
  "startOptions": {
    // Anything from http://docs.docker.com/reference/api/docker_remote_api_v1.15/#start-a-container
  },
  "vhosts": {
    "{{ the port on localhost to map the vhost to }}": [
      "{{ the vhost minus http:// }}"
    ]
  }
}
```

Some example containers:

#### rotterdam:containers:redis

```js
{
  "name": "redis",
  "createOptions": {
    "Image": "repo/redis",
    "PortBindings": {
      "6379/tcp": []
    },
    "Volumes": {
      "/var/lib/redis": {}
    }
  },
  "startOptions": {
    "Binds": [
      "/var/lib/redis:/var/lib/redis:rw"
    ],
    "Tty": false
  }
}
```

#### rotterdam:containers:webapp

```js
{
  "name": "webapp",
  "createOptions": {
    "Env": [
      "PORT=3232"
    ],
    "Image": "repo/webapp:tag",
    "PortBindings": {
      "3232/tcp": [
        {
          "HostIp": "0.0.0.0",
          "HostPort": "49153"
        }
      ]
    }
  },
  "startOptions": {
    "Links": [
      "redis:redis"
    ]
  },
  "vhosts": {
    "3232": [
      "webapp.com"
    ]
  }
}
```

## Practical Example

### With Jenkins

We pass new build groups to rotterdam from our jenkins tasks that are triggered on our `staging` branches.

Pushes to our `staging` branch run a jenkins task that does the following:

1. Builds the latest image for the web app
2. Runs the unit tests against the local image
3. Pushes the passing image to our private docker repo
4. Pushes the container configs for:
    - The docker app (including a vhost unique to this build)
    - A CouchDB process
    - A Redis process
    - A Worker process
5. It then polls the unique vhost until it returns a `200` response
6. It then runs the E2E tests via [Sauce Labs](saucelabs.com) pointing at the public vhost.
7. It then reports the results back to the developer who pushed the last commit.

The build is then accessible for the developer to explore and run manual tests against.

## Contributing

To help with contributing we've provided a `Vagrantfile` to automatically provision a box containing a shared volume of your local rotterdam clone.

First run `vagrant up`, then `vagrant ssh` into the box and run `node /opt/rotterdam/index.js`. 

This will have same same effect as running the `rotterdam` bin file above.

### Roadmap

1. Web interface
2. Make Hipache configurable
3. On startup calculate image dependecies and start the non-dependent ones first
4. Container Grouping

