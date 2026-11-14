const { createServer } = require('./proxy.cjs');
const server = createServer();
server.listen(8080, '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.stopTools();
  server.close();
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 1000).unref();
});
