module.exports = {
  apps: [
    {
      name: 'web-clipper-api',
      cwd: '/app/backend',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
