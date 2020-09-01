'use strict';

const { LoadFailedError, LoadCancelledError, InvalidStateError } = require('../../exceptions');
const RequestResponseController = require('./RequestResponseController');

module.exports = class MediaController extends RequestResponseController {

    constructor(client, sourceId, destinationId) {
        super(client, sourceId, destinationId, 'urn:x-cast:com.google.cast.media');

        this.currentSession = null;

        this.onMessageHandler = (data, broadcast) => {
            //console.log('MediaController:onMessageHandler', data, broadcast);
            if (data.type === 'MEDIA_STATUS' && data.status && data.status[0]) {
                const status = data.status[0];
                this.currentSession = status;
                this.emit('status', status, broadcast);
            }
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
        //console.log('MediaController:getStatus', response, JSON.stringify(response));
        const status = response.status[0];
        this.currentSession = status;
        return status;
    }

    async load(media, options) {
        if (typeof options === 'undefined') {
            options = {};
        }

        const data = { type: 'LOAD' };

        data.autoplay = (typeof options.autoplay !== 'undefined')
            ? options.autoplay
            : false;

        data.currentTime = (typeof options.currentTime !== 'undefined')
            ? options.currentTime
            : 0;

        data.activeTrackIds = (typeof options.activeTrackIds !== 'undefined')
            ? options.activeTrackIds
            : [];

        data.repeatMode = (typeof options.repeatMode === "string" &&
            typeof options.repeatMode !== 'undefined')
            ? options.repeatMode
            : "REPEAT_OFF";

        data.media = media;

        const response = await this.request(data);
        if (response.type === 'LOAD_FAILED') {
            throw new LoadFailedError();
        }
        if (response.type === 'LOAD_CANCELLED') {
            throw new LoadCancelledError();
        }

        const status = response.status[0];
        return status;
    }

    async sessionRequest(data) {
        if (!this.currentSession) {
            throw new InvalidStateError("No session");
        }
        data.mediaSessionId = this.currentSession.mediaSessionId;
        const response = await this.request(data);
        const status = response.status[0];
        return status;
    }

    play() {
        return this.sessionRequest({ type: 'PLAY' });
    }

    pause() {
        return this.sessionRequest({ type: 'PAUSE' });
    }

    stop() {
        return this.sessionRequest({ type: 'STOP' });
    }

    seek(currentTime) {
        return this.sessionRequest({
            type: 'SEEK',
            currentTime: currentTime
        });
    }

};