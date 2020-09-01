'use strict';

const Application = require('./Application');
const MediaController = require('../controllers/MediaController');

module.exports = class DefaultMediaReceiver extends Application {

    constructor(client, session) {
        super(client, session);
        this.media = this.createController(MediaController);
        this.media.on('status', (status, broadcast) => this.emit('status', status, broadcast));
    }

    static get APP_ID() {
        return 'CC1AD845';
    }

    getStatus() {
        return this.media.getStatus();
    }

    load(media, options) {
        return this.media.load(media, options);
    }

    play() {
        return this.media.play();
    }

    pause() {
        return this.media.pause();
    }

    stop() {
        return this.media.stop();
    }

    seek(currentTime) {
        return this.media.seek(currentTime);
    }

};
