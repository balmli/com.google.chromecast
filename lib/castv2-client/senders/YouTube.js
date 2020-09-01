'use strict';

const Application = require('./Application');
const MediaController = require('../controllers/MediaController');
const YouTubeController = require('../controllers/YouTubeController');

module.exports = class YouTube extends Application {

    constructor(client, session) {
        super(client, session);
        this.media = this.createController(MediaController);
        this.youtube = this.createController(YouTubeController)
        this.media.on('status', (status, broadcast) => this.emit('status', status, broadcast));
    }

    static get APP_ID() {
        return '233637DE';
    }

    getStatus() {
        return this.media.getStatus();
    }

    load(videoId) {
        return this.youtube.load(videoId);
    }

    playList(listId) {
        return this.youtube.playVideo('', listId);
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
