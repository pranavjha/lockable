[![Build Status](https://img.shields.io/travis/pranavjha/lockable.svg?style=flat-square)](https://travis-ci.org/pranavjha/lockable)
[![Code Climate](https://img.shields.io/codeclimate/github/pranavjha/lockable.svg?style=flat-square)](https://codeclimate.com/github/pranavjha/lockable)
[![Coverage Status](http://img.shields.io/coveralls/pranavjha/lockable.svg?style=flat-square)](https://coveralls.io/r/pranavjha/lockable)
[![Documentation](https://img.shields.io/badge/documentation-plus-green.svg?style=flat-square)](http://pranavjha.github.io/lockable/)

[![Dependency Status](https://img.shields.io/david/pranavjha/lockable.svg?style=flat-square)](https://david-dm.org/pranavjha/lockable)
[![devDependency Status](https://img.shields.io/david/dev/pranavjha/lockable.svg?style=flat-square)](https://david-dm.org/pranavjha/lockable#info=devDependencies)
[![peerDependency Status](https://img.shields.io/david/peer/pranavjha/lockable.svg?style=flat-square)](https://david-dm.org/pranavjha/lockable#info=peerDependencies)


# lockable

> Lockable is a utility module for promises to control their execution and their resolution sequence. It exposes methods
 that can be used to control the execution order of promises

## Usage

```javascript
// load the lockable library

var lockable = require('lockable');

var keyChain = lockable.acquire('key1.key2');

```


## Public functions

Lockable exposes the below methods that can be used on promises.

## `acquire(keyChain)`

Acquire function is used to acquire a lock on a keychain

A keychain is represents a lock and is a `.` separated string. A keychain string `'A.B.C'` will represent a hierarchy
with parents `'A'` and `'A.B''`.

Acquiring a lock on any parent keychain will invalidate all the child keychain locks. This is detailed in the below
examples:

```javascript
var lockable = require('lockable');

var key1 = lockable.acquire('A.B');

key1() // returns true here

var key2 = lockable.acquire('A.B');

key1() // returns false
key2() // returns true


var key3 = lockable.acquire('A');

key1() // returns false
key2() // returns false
key3() // returns true


var key4 = lockable.acquire('A.B');

key1() // returns false
key2() // returns false
key3() // returns true
key4() // returns true
```

For more examples on `acquire` refer the [test cases](./test/acquire.js)


## `sequence(keyChain, startCb, endCb)`

Sequence is used to _sequencify_ the resolution of promises. Promises added in a sequence will be resolved in the same
sequence in which they are added, irrespective of the execution time. Even though the actual promise will be executed
instantaneously, the callback will wait for the previous promises to resolve. This is illustrated in the below examples

A sequence can be used if multiple calls update the same object/DOM and only the latest update is relevant.

This is detailed in the below examples:

```javascript

var sequence = lockable.sequence();
var promise1 = Promise.delay(50);
var promise2 = Promise.delay(60);
var promise3 = Promise.delay(30);

sequence(promise1).then(function() {
    console.log(1);
});

sequence(promise2).then(function() {
    console.log(2);
});

sequence(promise3).then(function() {
    console.log(3);
});

// Output:
// 1 (after 50 ms from start)
// 2 (after 60 ms form start)
// 3 (after 60 ms form start)

```

For more examples on `sequence` refer the [test cases](./test/sequence.js)

## `queue(keyChain, startCb, endCb)`

A queue delays the execution of functions till the return value of previous execution is resolved. This is different
from a sequence where, the actual promises are invoked immediately and only the resolution is delayed.

A queue can be used when multiple executions have to happen only one after the other (eg, updating the same records or
autosave in a UI form)

This is detailed in the below examples:

```javascript

var queue = lockable.queue();
queue(function() {
    return Promise.delay(50);
}).then(function() {
    console.log(1);
});
queue(function() {
    return Promise.delay(20);
}).then(function() {
    console.log(1);
});
queue(function() {
    return Promise.delay(30);
}).then(function() {
    console.log(1);
});

// Output:
// 1 (after 50 ms from start)
// 2 (after 70 ms form start)
// 3 (after 100 ms form start)

```

For more examples on `queue` refer the [test cases](./test/queue.js)

