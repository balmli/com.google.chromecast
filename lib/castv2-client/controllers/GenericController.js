'use strict';

const { LoadFailedError, LoadCancelledError, InvalidStateError } = require('../../exceptions');
const RequestResponseController = require('./RequestResponseController');

module.exports = class GenericController extends RequestResponseController {

    constructor(client, sourceId, destinationId, namespace) {
        super(client, sourceId, destinationId, namespace);

        this._namespace = namespace;
        this.currentSession = null;

        this.onMessageHandler = (data, broadcast) => {
            console.log(`GenericController:onMessageHandler: ${this._namespace}`, data, broadcast);
            /*if (data.type === 'MEDIA_STATUS' && data.status && data.status[0]) {
                const status = data.status[0];
                this.currentSession = status;
                this.emit('status', status, broadcast);
            }*/
        };

        this.on('message', this.onMessageHandler);

        this.once('close', () => {
            let onMessageHandler = this.onMessageHandler;
            this.removeListener('message', onMessageHandler);
            this.stop();
        });
    }

    async getStatus() {
        const response = await this.request({ type: 'GET_STATUS' });
        console.log(`GenericController:getStatus: ${this._namespace}`, response, JSON.stringify(response));
        const status = response.status[0];
        this.currentSession = status;
        return status;
    }

    async load(media, options) {
    }

    async sessionRequest(data) {
    }

    play() {
    }

    pause() {
    }

    stop() {
    }

    seek(currentTime) {
    }

};