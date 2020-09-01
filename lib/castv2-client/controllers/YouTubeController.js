'use strict';

const { InvalidStateError, InvalidRequestError } = require('../../exceptions');
const RequestResponseController = require('./RequestResponseController');
const YoutubeRemote = require('../../youtube-remote');

module.exports = class YouTubeController extends RequestResponseController {

    constructor(client, sourceId, destinationId) {
        super(client, sourceId, destinationId, 'urn:x-cast:com.google.youtube.mdx');

        this.screenId = null
        this.remote = null

        this.once('close', () => {
            this.stop();
        });
    }

    load(videoId) {
        return this.playVideo(videoId);
    }

    async playVideo(videoId, listId) {
        const screenId = await this.getScreenId();
        this.remote = new YoutubeRemote(screenId);
        return new Promise((resolve, reject) => {
            this.remote.playVideo(videoId, listId, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    addToQueue(videoId) {
        return new Promise((resolve, reject) => {
            this.remote.addToQueue(videoId, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    playNext(videoId) {
        return new Promise((resolve, reject) => {
            this.remote.playNext(videoId, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    removeVideo(videoId) {
        return new Promise((resolve, reject) => {
            this.remote.removeVideo(videoId, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    clearPlaylist() {
        return new Promise((resolve, reject) => {
            this.remote.clearPlaylist((err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    async getScreenId() {
        const response = await this.controlRequest({ type: 'getMdxSessionStatus' });
        try {
            this.screenId = response.data.screenId;
        } catch (err) {
            throw new InvalidStateError('Missing screenId');
        }
        return this.screenId;
    }

    controlRequest(data) {
        //console.log('YouTubeController:controlRequest', data);
        return new Promise((resolve, reject) => {

            this.onMessageHandler = (response) => {
                //console.log('YouTubeController:onMessageHandler', response);

                let onMessageHandler = this.onMessageHandler;
                this.removeListener('message', onMessageHandler);

                if (response.type === 'INVALID_REQUEST') {
                    reject(new InvalidRequestError(response.reason));
                }

                resolve(response);
            };

            this.on('message', this.onMessageHandler);

            this.send(data);
        });
    }

};