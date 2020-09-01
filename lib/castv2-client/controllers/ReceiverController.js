'use strict';

const { LaunchFailedError } = require('../../exceptions');
const RequestResponseController = require('./RequestResponseController');

module.exports = class ReceiverController extends RequestResponseController {

    constructor(client, sourceId, destinationId) {
        super(client, sourceId, destinationId, 'urn:x-cast:com.google.cast.receiver');

        this.onMessageHandler = (data, broadcast) => {
            //console.log('ReceiverController:onMessageHandler', data, broadcast);
            if (data.type === 'RECEIVER_STATUS' && data.status) {
                this.emit('status', data.status, broadcast);
            }
        };

        this.on('message', this.onMessageHandler);

        this.once('close', () => {
            let onMessageHandler = this.onMessageHandler;
            this.removeListener('message', onMessageHandler);
        });

    }

    async getStatus() {
        const response = await this.request({ type: 'GET_STATUS' });
        return response.status;
    }

    async getAppAvailability(appId) {
        const response = await this.request({
            type: 'GET_APP_AVAILABILITY',
            appId: Array.isArray(appId) ? appId : [appId]
        });
        return response.availability;
    }

    async launch(appId) {
        const response = await this.request({ type: 'LAUNCH', appId: appId });
        if (response.type === 'LAUNCH_ERROR') {
            throw new LaunchFailedError(response.reason);
        }
        return response.status.applications || [];
    }

    async stop(sessionId) {
        const response = await this.request({ type: 'STOP', sessionId: sessionId });
        return response.status.applications || [];
    }

    async setVolume(options) {
        const response = await this.request({
            type: 'SET_VOLUME',
            volume: options // either `{ level: 0.5 }` or `{ muted: true }`
        });
        return response.status.volume;
    }

    async getVolume() {
        const status = await this.getStatus();
        return status.volume;
    }

    async getSessions() {
        const status = await this.getStatus();
        return status.applications || [];
    }

};