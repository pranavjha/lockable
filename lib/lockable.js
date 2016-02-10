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

    // Acquire function is used to acquire a lock on a keychain
    //
    // A keychain is represents a lock and is a `.` separated string. A keychain string `'A.B.C'` will represent a
    // hierarchy with parents `'A'` and `'A.B''`.
    //
    // Acquiring a lock on any parent keychain will invalidate all the child keychain locks. This is detailed in the
    // below examples:
    //
    //     ```javascript
    // var lockable = require('lockable');
    //
    // var key1 = lockable.acquire('A.B');
    //
    // key1() //  returns true here
    //
    // var key2 = lockable.acquire('A.B');
    //
    // key1() //  returns false
    // key2() //  returns true
    //
    //
    // var key3 = lockable.acquire('A');
    //
    // key1() //  returns false
    // key2() //  returns false
    // key3() //  returns true
    //
    //
    // var key4 = lockable.acquire('A.B');
    //
    // key1() //  returns false
    // key2() //  returns false
    // key3() //  returns true
    // key4() //  returns true
    // ```
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

    // Sequence is used to _sequencify_ the resolution of promises. Promises added in a sequence will be resolved in the same
    // sequence in which they are added, irrespective of the execution time. Even though the actual promise will be executed
    // instantaneously, the callback will wait for the previous promises to resolve. This is illustrated in the below examples
    //
    //     ```javascript
    //
    // var sequence = lockable.sequence();
    // var promise1 = Promise.delay(50);
    // var promise2 = Promise.delay(60);
    // var promise3 = Promise.delay(30);
    //
    // sequence(promise1).then(function() {
    //     console.log(1);
    // });
    //
    // sequence(promise2).then(function() {
    //     console.log(2);
    // });
    //
    // sequence(promise3).then(function() {
    //     console.log(3);
    // });
    //
    // // Output:
    // // 1 (after 50 ms from start)
    // // 2 (after 60 ms form start)
    // // 3 (after 60 ms form start)
    //
    // ```
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

    // A queue delays the execution of functions till the return value of previous execution is resolved. This is different
    // from a sequence where, the actual promises are invoked immediately and only the resolution is delayed.
    //
    // A queue can be used when multiple executions have to happen only one after the other (eg, updating the same records or
    // autosave in a UI form)
    //
    // This is detailed in the below examples:
    //
    // ```javascript
    //
    // var queue = lockable.queue();
    // queue(function() {
    //     return Promise.delay(50);
    // }).then(function() {
    //     console.log(1);
    // });
    // queue(function() {
    //     return Promise.delay(20);
    // }).then(function() {
    //     console.log(1);
    // });
    // queue(function() {
    //     return Promise.delay(30);
    // }).then(function() {
    //     console.log(1);
    // });
    //
    // // Output:
    // // 1 (after 50 ms from start)
    // // 2 (after 70 ms form start)
    // // 3 (after 100 ms form start)
    //
    // ```
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
