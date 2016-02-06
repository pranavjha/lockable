'use strict';
var lockable = require('../' + (process.env.APP_DIR_FOR_CODE_COVERAGE || '') + 'lib/lockable');

var expect = require('chai').expect;

describe('(acquire) acquired lock', function() {

    it('should be able to unlock', function() {
        var lock = lockable.acquire('a.b.c');
        expect(lock()).to.eql(true);
    });

    it('should become invalid if another lock is acquired', function() {
        var lock1 = lockable.acquire('a.b.c');
        var lock2 = lockable.acquire('a.b.c');
        expect(lock1()).to.eql(false);
        expect(lock2()).to.eql(true);
    });

    it('should become invalid if a parent lock is acquired', function() {
        var lock1 = lockable.acquire('a.b.c');
        var lock2 = lockable.acquire('a.b');
        expect(lock1()).to.eql(false);
        expect(lock2()).to.eql(true);
        var lock3 = lockable.acquire('b');
        expect(lock2()).to.eql(true);
        expect(lock3()).to.eql(true);
    });

    it('should not become invalid if a child lock is acquired', function() {
        var lock2 = lockable.acquire('a.b');
        var lock1 = lockable.acquire('a.b.c');
        expect(lock1()).to.eql(true);
        expect(lock2()).to.eql(true);
    });

    it('should honour the last acquired lock', function() {
        var lock1 = lockable.acquire('a.b.c');
        var lock2 = lockable.acquire('a.b');
        var lock3 = lockable.acquire('a');
        var lock4 = lockable.acquire('a');
        expect(lock1()).to.eql(false);
        expect(lock2()).to.eql(false);
        expect(lock3()).to.eql(false);
        expect(lock4()).to.eql(true);
    });
});