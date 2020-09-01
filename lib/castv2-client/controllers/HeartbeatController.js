'use strict';

const JsonController = require('./JsonController');

var DEFAULT_INTERVAL = 5; // seconds
var TIMEOUT_FACTOR = 3; // timeouts after 3 intervals

module.exports = class HeartbeatController extends JsonController {

    constructor(client, sourceId, destinationId) {
        super(client, sourceId, destinationId, 'urn:x-cast:com.google.cast.tp.heartbeat');

        this.pingTimer = null;
        this.timeout = null;
        this.intervalValue = DEFAULT_INTERVAL;

        this.onMessageHandler = (data, broadcast) => {
            if (data.type === 'PONG') {
                this.emit('pong');
            }
        };

        this.on('message', this.onMessageHandler);
        this.once('close', () => {
            let onMessageHandler = this.onMessageHandler;
            this.removeListener('message', onMessageHandler);
            this.stop();
        });
    }

    send(data) {
        this.channel.send(data);
    }

    ping() {
        if (this.timeout) {
            return;
        }

        this.timeout = setTimeout(() => {
            this.emit('timeout');
        }, this.intervalValue * 1000 * TIMEOUT_FACTOR);

        this.once('pong', () => {
            clearTimeout(this.timeout);
            this.timeout = null;

            this.pingTimer = setTimeout(() => {
                this.pingTimer = null;
                this.ping();
            }, this.intervalValue * 1000);
        })

        this.send({ type: 'PING' });
    }

    start(intervalValue) {
        if (intervalValue) {
            this.intervalValue = intervalValue;
        }
        this.ping();
    }

    stop() {
        if (this.pingTimer) {
            clearTimeout(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.removeAllListeners('pong');
    }

};