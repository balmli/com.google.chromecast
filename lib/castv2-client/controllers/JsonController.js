'use strict';

const Controller = require('./Controller');

module.exports = class JsonController extends Controller {

    constructor(client, sourceId, destinationId, namespace) {
        super(client, sourceId, destinationId, namespace, 'JSON');
    }

};