'use strict';

const { TimeoutError } = require('../../exceptions');
const Client = require('castv2').Client;
const Sender = require('./Sender');
const GenericApplication = require('./GenericApplication');
const ConnectionController = require('../controllers/ConnectionController');
const HeartbeatController = require('../controllers/HeartbeatController');
const ReceiverController = require('../controllers/ReceiverController');

module.exports = class Platform extends Sender {

    constructor(logger) {
        super(new Client(), 'sender-0', 'receiver-0');
        this.logger = logger;
        this.connection = null;
        this.heartbeat = null;
        this.receiver = null;
    }

    connect(options) {
        this.client.on('error', err => this.emit('error', err));

        return new Promise((resolve, reject) => {
            this.client.connect(options, () => {

                this.connection = this.createController(ConnectionController);
                this.heartbeat = this.createController(HeartbeatController);
                this.receiver = this.createController(ReceiverController);

                this.onReceiverStatus = (status, broadcast) => this.emit('status', status, broadcast);
                this.receiver.on('status', this.onReceiverStatus);

                this.client.once('close', () => {
                    this.heartbeat.stop();
                    let onReceiverStatus = this.onReceiverStatus;
                    this.receiver.removeListener('status', onReceiverStatus);
                    this.receiver.close();
                    this.heartbeat.close();
                    this.connection.close();
                    this.receiver = null;
                    this.heartbeat = null;
                    this.connection = null;
                    super.close();
                });

                this.heartbeat.once('timeout', () => this.emit('error', new TimeoutError()));

                this.connection.connect();
                this.heartbeat.start();
                resolve();
            });
        });
    }

    close() {
        if (this.client) {
            this.client.close();
        }
    }

    getStatus() {
        return this.receiver.getStatus();
    }

    getAppAvailability(appId) {
        return this.receiver.getAppAvailability(appId);
    }

    createApplication(Application, session) {
        return new Application(this.client, session);
    }

    async launch(Application) {
        const sessions = await this.receiver.launch(Application.APP_ID);

        const filtered = sessions.filter(session => session.appId === Application.APP_ID);
        const session = filtered.shift();

        return new Application(this.client, session);
    }

    async genericPlayer(session) {
        return new GenericApplication(this.client, session);
    }

    async stop(application) {
        try {
            if (application) {
                const session = application.session;
                application.close();
                await this.receiver.stop(session.sessionId);
            } else {
                const allSessions = await this.getSessions();
                for (let session of allSessions) {
                    await this.receiver.stop(session.sessionId);
                }
            }
        } catch (err) {
            this.logger.error('Platform stop failed', err);
        }
    }

    setVolume(options) {
        return this.receiver.setVolume(options);
    }

    getVolume() {
        return this.receiver.getVolume();
    }

    getSessions() {
        return this.receiver.getSessions();
    }

    async isApplicationRunning(Application) {
        const sessions = await this.getSessions();
        return sessions.filter(session => session.appId === Application.APP_ID).length > 0;
    }

    async isCasting() {
        const sessions = await this.getSessions();
        return sessions.length > 0;
    }

};
