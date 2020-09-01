'use strict';

const EventEmitter = require('events');

module.exports = class Controller extends EventEmitter {

    constructor(client, sourceId, destinationId, namespace, encoding) {
        super();
        this.channel = client.createChannel(sourceId, destinationId, namespace, encoding);

        this.onMessageHandler = (data, broadcast) => {
            this.emit('message', data, broadcast);
        };

        this.channel.on('message', this.onMessageHandler);

        this.channel.once('close', () => {
            let onMessageHandler = this.onMessageHandler;
            this.channel.removeListener('message', onMessageHandler);
            this.emit('close');
        });
    }

    send(data) {
        console.log('Controller:send', data);
        this.channel.send(data);
    }

    close() {
        this.channel.close();
    }

};