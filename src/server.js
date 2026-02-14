const { createApp } = require('./app');

async function startServer() {
    const app = createApp();
    await app.start();
    console.log(`Finance Tracker Web running: http://${app.host}:${app.port}`);
    return app;
}

if (require.main === module) {
    startServer().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = {
    createApp,
    startServer,
};
