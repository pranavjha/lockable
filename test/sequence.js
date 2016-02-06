'use strict';
var lockable = require('../' + (process.env.APP_DIR_FOR_CODE_COVERAGE || '') + 'lib/lockable');
var Promise = require('bluebird');
var sinon = require('sinon');
var chai = require('chai');
chai.use(require('sinon-chai'));
var expect = chai.expect;

describe('sequence', function() {

    it('should execute callbacks in sequence even if the promises don\'t get resolved in sequence', function() {
        var callbackSpy = sinon.spy();
        var sequence = lockable.sequence();
        sequence(Promise.delay(50)).then(callbackSpy.bind({}, 50));
        sequence(Promise.delay(20)).then(callbackSpy.bind({}, 20));
        sequence(Promise.delay(30)).then(callbackSpy.bind({}, 30));
        return sequence().then(function() {
            expect(callbackSpy).to.have.callCount(3);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);
            expect(callbackSpy.getCall(1)).to.be.calledWith(20);
            expect(callbackSpy.getCall(2)).to.be.calledWith(30);
        });
    });

    it('should execute start and end callbacks only when there is no unresolved promises in the sequence', function() {
        var callbackSpy = sinon.spy();
        var startCb = sinon.spy();
        var endCb = sinon.spy();
        var sequence = lockable.sequence('A', startCb, endCb);
        sequence(Promise.delay(50)).then(callbackSpy.bind({}, 50));
        sequence(Promise.delay(20)).then(callbackSpy.bind({}, 20));
        sequence(Promise.delay(30)).then(callbackSpy.bind({}, 30));

        return Promise.delay(100).then(function() {
            sequence(Promise.delay(50)).then(callbackSpy.bind({}, 50));
            sequence(Promise.delay(20)).then(callbackSpy.bind({}, 20));
            sequence(Promise.delay(30)).then(callbackSpy.bind({}, 30));
        }).then(function() {
            return sequence();
        }).then(function() {
            expect(callbackSpy).to.have.callCount(6);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);
            expect(callbackSpy.getCall(1)).to.be.calledWith(20);
            expect(callbackSpy.getCall(2)).to.be.calledWith(30);
            expect(callbackSpy.getCall(3)).to.be.calledWith(50);
            expect(callbackSpy.getCall(4)).to.be.calledWith(20);
            expect(callbackSpy.getCall(5)).to.be.calledWith(30);

            expect(startCb).to.have.callCount(2);
            expect(endCb).to.have.callCount(2);
            expect(startCb.getCall(0)).to.be.calledBefore(endCb.getCall(0));
            expect(endCb.getCall(0)).to.be.calledBefore(startCb.getCall(1));
            expect(startCb.getCall(1)).to.be.calledBefore(endCb.getCall(1));
        });
    });

    it('should not execute the next callback if the previous promise got rejected', function() {
        var callbackSpy = sinon.spy();
        var rejectionSpy = sinon.spy();
        var startCb = sinon.spy();
        var endCb = sinon.spy();
        var sequence = lockable.sequence('A', startCb, endCb);
        sequence(Promise.delay(50)).then(callbackSpy.bind({}, 50));
        sequence(Promise.delay(20)).then(callbackSpy.bind({}, 20));
        sequence(Promise.delay(30)).then(callbackSpy.bind({}, 30));

        return Promise.delay(100).then(function() {
            sequence(Promise.delay(50)).then(callbackSpy.bind({}, 50));
            sequence(Promise.reject(new Error('rejected'))).then(callbackSpy.bind({}, 20)).catch(
                rejectionSpy.bind({})
            );
            sequence(Promise.delay(30)).then(callbackSpy.bind({}, 30)).catch(
                rejectionSpy.bind({})
            );
        }).then(function() {
            return Promise.delay(100);
        }).then(function() {
            expect(callbackSpy).to.have.callCount(4);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);
            expect(callbackSpy.getCall(1)).to.be.calledWith(20);
            expect(callbackSpy.getCall(2)).to.be.calledWith(30);
            expect(callbackSpy.getCall(3)).to.be.calledWith(50);

            expect(rejectionSpy).to.have.callCount(2);
            expect(rejectionSpy.getCall(0)).to.be.calledWith(new Error('rejected'));
            expect(rejectionSpy.getCall(1)).to.be.calledWith(new Error('rejected'));

            expect(startCb).to.have.callCount(2);
            expect(endCb).to.have.callCount(2);
            expect(startCb.getCall(0)).to.be.calledBefore(endCb.getCall(0));
            expect(endCb.getCall(0)).to.be.calledBefore(startCb.getCall(1));
            expect(startCb.getCall(1)).to.be.calledBefore(endCb.getCall(1));
        });
    });

    it('should not execute the next callback if the sequence lock is re-acquired', function() {
        var callbackSpy = sinon.spy();
        var rejectionSpy = sinon.spy();
        var sequence = lockable.sequence('a.b.c');
        sequence(Promise.delay(50)).then(callbackSpy.bind({}, 50));
        Promise.delay(60).then(lockable.acquire.bind(lockable, 'a.b'));
        sequence(Promise.delay(100)).then(callbackSpy.bind({}, 20)).catch(rejectionSpy.bind({}));
        sequence(Promise.delay(90)).then(callbackSpy.bind({}, 30)).catch(rejectionSpy.bind({}));
        return Promise.delay(130).then(function() {
            expect(callbackSpy).to.have.callCount(1);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);
            expect(rejectionSpy).to.have.callCount(2);
            expect(rejectionSpy.getCall(0)).to.be.calledWith(new Error('concurrency failure'));
            expect(rejectionSpy.getCall(1)).to.be.calledWith(new Error('concurrency failure'));
        });
    });
});