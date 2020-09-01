'use strict';

const Application = require('./Application');
const MediaController = require('../controllers/MediaController');
const GenericController = require('../controllers/GenericController');

module.exports = class GenericApplication extends Application {

    constructor(client, session) {
        super(client, session);
        this.appId = session.appId;
        this.media = this.createController(MediaController);
        this.media.on('status', (status, broadcast) => this.emit('status', status, broadcast));
        /*
        this.controllers = [];
        this.controllers.push(this.media);
        for (let ns of session.namespaces) {
            const namespace = ns.name;
            if (!namespace.startsWith('urn:x-cast:com.google.')) {
                console.log(`GenericApplication: ${namespace}`);
                const controller = this.createController(GenericController, namespace);
                controller.on('status', (status, broadcast) => this.emit('status', status, broadcast));
                this.controllers.push(controller);
            }
        }
        */
    }

    static get APP_ID() {
        return 'xxxx';
    }

    getStatus() {
        return this.media.getStatus();
    }

    load(media, options) {
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
