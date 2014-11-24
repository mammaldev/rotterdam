hosts = {
  "192.168.34.10" => [
    "rotterdam.local.mammal.io"
  ]
}

Vagrant.configure("2") do |config|
  hosts.each do |ip, hosts|
    name = hosts[0]
    hosts = hosts[1...hosts.length]

    config.ssh.forward_agent = true
    config.vm.define name do |machine|
      machine.vm.box = "ubuntu-14.04"
      machine.vm.box_url = "https://oss-binaries.phusionpassenger.com/vagrant/boxes/latest/ubuntu-14.04-amd64-vbox.box"
      machine.vm.hostname = name
      machine.hostsupdater.aliases = hosts
      machine.vm.network :private_network, ip: ip
      machine.vm.synced_folder "./", "/opt/rotterdam/"
      machine.vm.provider "virtualbox" do |v|
        v.name = name
        v.memory = 1024
        v.cpus = 2
      end
      config.vm.provision "shell",
        inline: "sudo apt-get -y install software-properties-common python-software-properties && sudo add-apt-repository -y ppa:rwky/redis && sudo apt-get -y update && sudo apt-get install -y redis-server git nodejs npm docker.io"
    end
  end
end
