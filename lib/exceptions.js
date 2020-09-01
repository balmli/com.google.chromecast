'use strict';

class ExtendableError extends Error {
    constructor({ message, stack }) {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        this.stack = stack || this.stack;
    }
}

class InvalidStateError extends ExtendableError {
    constructor(message = 'Invalid state') {
        super({ message });
    }
}

class SocketConnectError extends ExtendableError {
    constructor(message = 'Connect failed') {
        super({ message });
    }
}

class TimeoutError extends ExtendableError {
    constructor(message = 'Device timeout') {
        super({ message });
    }
}

class HostUnreachableError extends ExtendableError {
    constructor(message = 'Host unreachable') {
        super({ message });
    }
}

class NetworkUnreachableError extends ExtendableError {
    constructor(message = 'Network unreachable') {
        super({ message });
    }
}

class UnknownSocketError extends ExtendableError {
    constructor(message = 'Unknown socket error') {
        super({ message });
    }
}

class InvalidRequestError extends ExtendableError {
    constructor(reason) {
        super({ message: `Invalid request: ${reason}` });
    }
}

class LaunchFailedError extends ExtendableError {
    constructor(reason) {
        super({ message: `Launch failed: ${reason}` });
    }
}

class LoadFailedError extends ExtendableError {
    constructor() {
        super({ message: `Load failed` });
    }
}

class LoadCancelledError extends ExtendableError {
    constructor() {
        super({ message: `Load cancelled` });
    }
}

module.exports = {
    InvalidStateError: InvalidStateError,
    SocketConnectError: SocketConnectError,
    TimeoutError: TimeoutError,
    HostUnreachableError: HostUnreachableError,
    NetworkUnreachableError: NetworkUnreachableError,
    UnknownSocketError: UnknownSocketError,
    InvalidRequestError: InvalidRequestError,
    LaunchFailedError: LaunchFailedError,
    LoadFailedError: LoadFailedError,
    LoadCancelledError: LoadCancelledError
};