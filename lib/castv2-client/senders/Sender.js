'use strict';

const EventEmitter = require('events');

module.exports = class Sender extends EventEmitter {

    constructor(client, senderId, receiverId) {
        super();
        this.client = client;
        this.senderId = senderId;
        this.receiverId = receiverId;
    }

    createController(cntrllr) {
        return new cntrllr(this.client, this.senderId, this.receiverId);
    }

    close() {
        this.senderId = null;
        this.receiverId = null;
        this.client = null;
    }

    toString() {
        return `Sender ${this.senderId} - ${this.receiverId}`
    }
};
