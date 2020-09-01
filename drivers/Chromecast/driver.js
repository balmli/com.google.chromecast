'use strict';

const Homey = require('homey');
const Logger = require('../../lib/Logger');

module.exports = class ChromecastDriver extends Homey.Driver {

    constructor(...args) {
        super(...args);

        this.logger = new Logger({
            logLevel: 4,
            captureLevel: 5,
            logFunc: this.log,
            errorFunc: this.error,
        }, Homey.env);
    }

    onInit() {
        this.logger.silly('ChromecastDriver has been initialized');
    }

    async onPairListDevices(data, callback) {

        const discoveryStrategy = this.getDiscoveryStrategy();
        const discoveryResults = Object.values(discoveryStrategy.getDiscoveryResults());

        const devices = [];
        for (let dr in discoveryResults) {
            let discoveryResult = discoveryResults[dr];

            this.logger.info('Discovery', discoveryResult);

            devices.push({
                name: `${discoveryResult.txt.md} ${discoveryResult.txt.fn}`,
                data: {
                    id: discoveryResult.id
                },
                settings: {
                    ipaddress: discoveryResult.address,
                    modelName: discoveryResult.txt.md
                },
                store: {
                    ipaddress: discoveryResult.address,
                    port: discoveryResult.port
                }
            })
        }

        this.logger.info('Found devices', devices);
        callback(null, devices);
    }

};

