'use strict';

const net = require("net");
const {
    SocketConnectError,
    TimeoutError,
    HostUnreachableError,
    NetworkUnreachableError,
    UnknownSocketError
} = require('./exceptions');

module.exports = class Network {

  constructor(options) {
    options = options || {};
    this.log = options.log || console.log;
  }

  scan(host, port, timeout) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      const cancelCheck = setTimeout(function () {
        client.destroy();
        reject(new TimeoutError("Host timeout"));
      }, timeout);

      const cleanup = function () {
        if (cancelCheck) {
          clearTimeout(cancelCheck);
        }
        client.destroy();
      };

      client.on('error', function (err) {
        if (err && err.errno && err.errno === "ECONNREFUSED") {
          cleanup();
          resolve();
        } else if (err && err.errno && err.errno === "EHOSTUNREACH") {
          cleanup();
          reject(new HostUnreachableError());
        } else if (err && err.errno && err.errno === "ENETUNREACH") {
          cleanup();
          reject(new NetworkUnreachableError());
        } else if (err && err.errno) {
          cleanup();
          reject(new UnknownSocketError("Unknown error: " + err.errno));
        } else {
          cleanup();
          reject(new UnknownSocketError("ICMP driver can't handle " + err));
        }
      });

      try {
        client.connect(port, host, function () {
          cleanup();
          resolve();
        });
      } catch (ex) {
        cleanup();
        reject(new SocketConnectError("Connect failed: " + ex.message));
      }
    });
  }

};
