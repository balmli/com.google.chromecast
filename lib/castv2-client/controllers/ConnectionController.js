'use strict';

const JsonController = require('./JsonController');

module.exports = class ConnectionController extends JsonController {

    constructor(client, sourceId, destinationId) {
        super(client, sourceId, destinationId, 'urn:x-cast:com.google.cast.tp.connection');

        this.onMessageHandler = (data, broadcast) => {
            if (data.type === 'CLOSE') {
                this.emit('disconnect');
            }
        };

        this.on('message', this.onMessageHandler);

        this.once('close', () => {
            let onMessageHandler = this.onMessageHandler;
            this.removeListener('message', onMessageHandler);
        });
    }

    connect() {
        this.send({ type: 'CONNECT' });
    }

    disconnect() {
        this.send({ type: 'CLOSE' });
    }

};