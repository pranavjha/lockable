// ## monitor
// utility for promises
'use strict';
var Promise = require('bluebird');
// holds data for concurrency checks
var locks = {
    concurrency: 1,
    children: {}
};
var idGen = 0;

module.exports = {

    // obtains lock for a specific action, This function takes a sequencial list of keys to obtain a lock on. If any of
    // the keys specified is locked again, this lock will get invalidated.
    //
    // The function returns a KeyChain Object with an unlock method. This method will return true if the lock is still
    // valid.
    acquire: function(lockId) {
        var thisLock = locks;
        var lockSequence = lockId.split('.');
        for (var i = 0, j = lockSequence.length; i < j; i = i + 1) {
            if (!thisLock.children[lockSequence[i]]) {
                thisLock.children[lockSequence[i]] = {
                    concurrency: 1,
                    children: {}
                };
            }
            thisLock = thisLock.children[lockSequence[i]];
        }
        thisLock.concurrency = thisLock.concurrency + 1;
        thisLock.children = {};
        var concurrency = thisLock.concurrency;
        return function() {
            var thisLock = locks;
            for (var i = 0, j = lockSequence.length; i < j; i = i + 1) {
                if (!thisLock.children[lockSequence[i]]) {
                    return false;
                }
                thisLock = thisLock.children[lockSequence[i]];
            }
            return (thisLock.concurrency === concurrency);
        };
    },

    sequence: function(sequenceId, startCb, endCb) {
        if (!sequenceId) {
            sequenceId = 'sequence_' + idGen;
            idGen = idGen + 1;
        }
        var promiseSequence = [];
        var keyChain = this.acquire(sequenceId);
        return function(promise) {
            promise = promise || true;
            if (!promiseSequence.length && startCb) {
                // when the sequence starts, we call the start callback
                startCb();
            }
            promiseSequence.unshift(promise);

            var lengthThen = promiseSequence.length;
            var endSequenceIfRequired = function() {
                if (lengthThen === promiseSequence.length) {
                    // when nothing new got added in the sequence, we end the sequence
                    if (endCb) {
                        endCb();
                    }
                    // clear off the queue
                    promiseSequence = [];
                }
            };
            return Promise.all(promiseSequence).spread(function(thisValue) {
                endSequenceIfRequired();
                if (!keyChain()) {
                    throw new Error('concurrency failure');
                } else {
                    return thisValue;
                }
            }).catch(function(err) {
                endSequenceIfRequired();
                throw err;
            });
        };
    },
    queue: function(sequenceId, startCb, endCb) {
        if (!sequenceId) {
            sequenceId = 'sequence_' + idGen;
            idGen = idGen + 1;
        }
        var promiseSequence = null;
        var keyChain = this.acquire(sequenceId);
        return function(callback) {
            callback = callback || function() {
                    return;
                };
            var thisPromise;
            if (!promiseSequence) {
                promiseSequence = Promise.resolve(true);
                // when the sequence starts, we call the start callback
                if (startCb) {
                    startCb();
                }
            }
            var endSequenceIfRequired = function(forceEnd) {
                if (forceEnd || promiseSequence === thisPromise) {
                    // when nothing new got added in the sequence, we end the sequence
                    if (endCb) {
                        endCb();
                    }
                    // clear off the queue
                    promiseSequence = null;
                }
            };

            thisPromise = promiseSequence.then(function() {
                if (!keyChain()) {
                    endSequenceIfRequired(true);
                    throw new Error('concurrency failure');
                }
                return Promise.resolve(callback.apply(this, arguments)).then(function(data) {
                    if (!keyChain()) {
                        endSequenceIfRequired(true);
                        throw new Error('concurrency failure');
                    }
                    endSequenceIfRequired();
                    return data;
                }).catch(function(err) {
                    endSequenceIfRequired(true);
                    throw err;
                });
            });
            promiseSequence = thisPromise;
            return thisPromise;
        };
    }
};
