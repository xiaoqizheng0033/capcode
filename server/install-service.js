const path = require('path');

const command = process.argv[2];

if (!command || !['install', 'uninstall'].includes(command)) {
  console.log('Usage: node install-service.js <install|uninstall>');
  process.exit(1);
}

// node-windows requires admin privileges
try {
  const Service = require('node-windows').Service;

  const svc = new Service({
    name: 'RepoManager',
    description: 'Repo Manager - Local Git Repository Management Tool',
    script: path.join(__dirname, 'index.js'),
    nodeOptions: ['--harmony', '--max_old_space_size=4096'],
  });

  svc.on('install', () => {
    console.log('Service installed successfully. Repo Manager will start automatically on boot.');
    svc.start();
  });

  svc.on('uninstall', () => {
    console.log('Service uninstalled successfully.');
  });

  svc.on('error', (err) => {
    console.error('Service error:', err.message);
  });

  if (command === 'install') {
    svc.install();
  } else {
    svc.uninstall();
  }
} catch (err) {
  console.error('Failed to manage Windows service. Make sure to run as Administrator.');
  console.error(err.message);
}
