'use strict';

const Sender = require('./Sender');
const ConnectionController = require('../controllers/ConnectionController');

module.exports = class Application extends Sender {

    constructor(client, session) {
        super(client, randomSenderId(), session.transportId);

        this.session = session;

        this.connection = this.createController(ConnectionController);
        this.connection.connect();

        this.onDisconnect = () => {
            this.emit('close');
        };

        this.onClose = () => {
            let onClose = this.onClose;
            this.removeListener('close', onClose);
            let onDisconnect = this.onDisconnect;
            this.connection.removeListener('disconnect', onDisconnect);
            this.connection.close();
            this.connection = null;
            this.session = null;
            super.close();
        };

        this.connection.on('disconnect', this.onDisconnect);
        this.on('close', this.onClose);
    }

    createController(cntrllr, namespace) {
        return new cntrllr(this.client, this.senderId, this.receiverId, namespace);
    }

    close() {
        if (this.connection) {
            this.connection.disconnect();
        }
        this.emit('close');
    }

};

function randomSenderId() {
    return 'client-' + Math.floor(Math.random() * 10e5);
}