'use strict';

const { InvalidRequestError } = require('../../exceptions');
const JsonController = require('./JsonController');

module.exports = class RequestResponseController extends JsonController {

    constructor(client, sourceId, destinationId, namespace) {
        super(client, sourceId, destinationId, namespace);

        this.lastRequestId = 0;
    }

    request(data) {
        //console.log('RequestResponseController:request', data);
        return new Promise((resolve, reject) => {
            const requestId = ++this.lastRequestId;

            this.onMessageHandler = (response, broadcast) => {
                //console.log('RequestResponseController:onMessageHandler', response, broadcast);
                if (response.requestId === requestId) {

                    let onMessageHandler = this.onMessageHandler;
                    this.removeListener('message', onMessageHandler);

                    if (response.type === 'INVALID_REQUEST') {
                        reject(new InvalidRequestError(response.reason));
                    }

                    delete response.requestId;
                    resolve(response);
                }
            };

            this.on('message', this.onMessageHandler);

            data.requestId = requestId;
            this.send(data);
        });
    }

};