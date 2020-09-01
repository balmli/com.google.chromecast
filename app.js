'use strict';

const Homey = require('homey');

module.exports = class ChromecastApp extends Homey.App {

    async onInit() {
        Homey.on('unload', async () => this._onUninstall());
        await this.initFlows();
        this.log('ChromecastApp is running...');
    }

    async initFlows() {
        this.startedCastingTrigger = new Homey.FlowCardTriggerDevice('started_casting');
        await this.startedCastingTrigger.register();

        this.stoppedCastingTrigger = new Homey.FlowCardTriggerDevice('stopped_casting');
        await this.stoppedCastingTrigger.register();

        new Homey.FlowCardCondition('is_casting')
            .register()
            .registerRunListener((args, state) => args.device.isCasting());

        new Homey.FlowCardAction('stop_casting')
            .register()
            .registerRunListener(args => args.device.onStopCasting());

        new Homey.FlowCardAction('cast_website')
            .register()
            .registerRunListener(args => args.device.onCastWebsite(args.website));

        new Homey.FlowCardAction('cast_youtube')
            .register()
            .registerRunListener(args => args.device.onCastYouTube(args.videoId));
    }

    async _onUninstall() {
        try {
            await this._clearTimers();
        } catch (err) {
            this.log('_onUninstall error', err);
        }
    }

    async _clearTimers() {
        this.log('_clearTimers');
        const drivers = Homey.ManagerDrivers.getDrivers();
        if (drivers) {
            for (let key in drivers) {
                if (drivers.hasOwnProperty(key)) {
                    const driver = drivers[key];
                    const devices = driver.getDevices();
                    for (let device of devices) {
                        if (device.onDoDelete) {
                            this.log('_clearTimers', device.getData().id, device.getName());
                            await device.onDoDelete();
                        }
                    }
                }
            }
        }
    }

};
