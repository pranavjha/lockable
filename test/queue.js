'use strict';
var lockable = require('../' + (process.env.APP_DIR_FOR_CODE_COVERAGE || '') + 'lib/lockable');
var Promise = require('bluebird');
var sinon = require('sinon');
var chai = require('chai');
chai.use(require('sinon-chai'));
var expect = chai.expect;

describe('queue', function() {

    it('should execute promises in queue', function() {
        var callbackSpy = sinon.spy();
        var resolutionSpy = sinon.spy();
        var queue = lockable.queue();
        queue(function() {
            return Promise.delay(50).then(resolutionSpy.bind({}, 50))
        }).then(callbackSpy.bind({}, 50));
        queue(function() {
            return Promise.delay(20).then(resolutionSpy.bind({}, 20))
        }).then(callbackSpy.bind({}, 20));
        queue(function() {
            return Promise.delay(30).then(resolutionSpy.bind({}, 30))
        }).then(callbackSpy.bind({}, 30));
        return queue().then(function() {
            expect(callbackSpy).to.have.callCount(3);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);
            expect(callbackSpy.getCall(1)).to.be.calledWith(20);
            expect(callbackSpy.getCall(2)).to.be.calledWith(30);
            expect(resolutionSpy).to.have.callCount(3);
            expect(resolutionSpy.getCall(0)).to.be.calledWith(50);
            expect(resolutionSpy.getCall(1)).to.be.calledWith(20);
            expect(resolutionSpy.getCall(2)).to.be.calledWith(30);
        });
    });

    it('should execute start callback and end callback only when the queue is cleared', function() {
        var callbackSpy = sinon.spy();
        var resolutionSpy = sinon.spy();
        var startCb = sinon.spy();
        var endCb = sinon.spy();
        var queue = lockable.queue('A', startCb, endCb);

        queue(function() {
            return Promise.delay(50).then(resolutionSpy.bind({}, 50))
        }).then(callbackSpy.bind({}, 50));
        queue(function() {
            return Promise.delay(20).then(resolutionSpy.bind({}, 20))
        }).then(callbackSpy.bind({}, 20));
        queue(function() {
            return Promise.delay(30).then(resolutionSpy.bind({}, 30))
        }).then(callbackSpy.bind({}, 30));

        return Promise.delay(150).then(function() {
            queue(function() {
                return Promise.delay(50).then(resolutionSpy.bind({}, 50))
            }).then(callbackSpy.bind({}, 50));
            queue(function() {
                return Promise.delay(20).then(resolutionSpy.bind({}, 20))
            }).then(callbackSpy.bind({}, 20));
            queue(function() {
                return Promise.delay(30).then(resolutionSpy.bind({}, 30))
            }).then(callbackSpy.bind({}, 30));
        }).then(function() {
            return queue();
        }).then(function() {
            expect(callbackSpy).to.have.callCount(6);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);
            expect(callbackSpy.getCall(1)).to.be.calledWith(20);
            expect(callbackSpy.getCall(2)).to.be.calledWith(30);
            expect(callbackSpy.getCall(3)).to.be.calledWith(50);
            expect(callbackSpy.getCall(4)).to.be.calledWith(20);
            expect(callbackSpy.getCall(5)).to.be.calledWith(30);

            expect(resolutionSpy).to.have.callCount(6);
            expect(resolutionSpy.getCall(0)).to.be.calledWith(50);
            expect(resolutionSpy.getCall(1)).to.be.calledWith(20);
            expect(resolutionSpy.getCall(2)).to.be.calledWith(30);
            expect(resolutionSpy.getCall(3)).to.be.calledWith(50);
            expect(resolutionSpy.getCall(4)).to.be.calledWith(20);
            expect(resolutionSpy.getCall(5)).to.be.calledWith(30);

            expect(startCb).to.have.callCount(2);
            expect(endCb).to.have.callCount(2);
            expect(startCb.getCall(0)).to.be.calledBefore(endCb.getCall(0));
            expect(endCb.getCall(0)).to.be.calledBefore(startCb.getCall(1));
            expect(startCb.getCall(1)).to.be.calledBefore(endCb.getCall(1));
        });
    });

    it('should not execute the next callback if the previous promise got rejected', function() {
        var callbackSpy = sinon.spy();
        var resolutionSpy = sinon.spy();
        var rejectionSpy = sinon.spy();
        var startCb = sinon.spy();
        var endCb = sinon.spy();
        var queue = lockable.queue('A', startCb, endCb);

        queue(function() {
            return Promise.delay(50).then(resolutionSpy.bind({}, 50))
        }).then(callbackSpy.bind({}, 50));
        queue(function() {
            return Promise.delay(20).then(resolutionSpy.bind({}, 20))
        }).then(callbackSpy.bind({}, 20));
        queue(function() {
            return Promise.delay(30).then(resolutionSpy.bind({}, 30))
        }).then(callbackSpy.bind({}, 30));

        return Promise.delay(130).then(function() {
            queue(function() {
                return Promise.delay(50).then(resolutionSpy.bind({}, 50))
            }).then(callbackSpy.bind({}, 50));
            queue(function() {
                return Promise.reject(new Error('rejected')).then(resolutionSpy.bind({}, 20))
            }).then(callbackSpy.bind({}, 20)).catch(
                rejectionSpy.bind({})
            );
            queue(function() {
                return Promise.delay(30).then(resolutionSpy.bind({}, 30))
            }).then(callbackSpy.bind({}, 30)).catch(
                rejectionSpy.bind({})
            );
        }).then(function() {
            return Promise.delay(300);
        }).then(function() {
            expect(callbackSpy).to.have.callCount(4);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);
            expect(callbackSpy.getCall(1)).to.be.calledWith(20);
            expect(callbackSpy.getCall(2)).to.be.calledWith(30);
            expect(callbackSpy.getCall(3)).to.be.calledWith(50);

            expect(resolutionSpy).to.have.callCount(4);
            expect(resolutionSpy.getCall(0)).to.be.calledWith(50);
            expect(resolutionSpy.getCall(1)).to.be.calledWith(20);
            expect(resolutionSpy.getCall(2)).to.be.calledWith(30);
            expect(resolutionSpy.getCall(3)).to.be.calledWith(50);

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

    it('should not execute the remaining promises if the lock is re-acquired', function() {
        var callbackSpy = sinon.spy();
        var resolutionSpy = sinon.spy();
        var rejectionSpy = sinon.spy();
        var queue = lockable.queue('a.b.c');
        queue(function() {
            return Promise.delay(50).then(resolutionSpy.bind({}, 50))
        }).then(callbackSpy.bind({}, 50)).catch(rejectionSpy);

        Promise.delay(60).then(function() {
            lockable.acquire('a.b');
        });

        queue(function() {
            return Promise.delay(20).then(resolutionSpy.bind({}, 20))
        }).then(callbackSpy.bind({}, 20)).catch(rejectionSpy);
        queue(function() {
            return Promise.delay(30).then(resolutionSpy.bind({}, 30))
        }).then(callbackSpy.bind({}, 30)).catch(rejectionSpy);
        return Promise.delay(130).then(function() {
            expect(resolutionSpy).to.have.callCount(2);
            expect(resolutionSpy.getCall(0)).to.be.calledWith(50);
            expect(resolutionSpy.getCall(1)).to.be.calledWith(20);

            expect(callbackSpy).to.have.callCount(1);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);

            expect(rejectionSpy).to.have.callCount(2);
            expect(rejectionSpy.getCall(0)).to.be.calledWith(new Error('concurrency failure'));
            expect(rejectionSpy.getCall(0)).to.be.calledWith(new Error('concurrency failure'));
        });
    });

    it('should not execute the promises added in the queue after the lock is re-acquired', function() {
        var callbackSpy = sinon.spy();
        var resolutionSpy = sinon.spy();
        var rejectionSpy = sinon.spy();
        var queue = lockable.queue('a.b.c');
        queue(function() {
            return Promise.delay(50).then(resolutionSpy.bind({}, 50))
        }).then(callbackSpy.bind({}, 50)).catch(rejectionSpy);

        Promise.delay(60).then(function() {
            lockable.acquire('a.b');
        });

        Promise.delay(70).then(function() {
            queue(function() {
                return Promise.delay(20).then(resolutionSpy.bind({}, 20))
            }).then(callbackSpy.bind({}, 20)).catch(rejectionSpy);
            queue(function() {
                return Promise.delay(30).then(resolutionSpy.bind({}, 30))
            }).then(callbackSpy.bind({}, 30)).catch(rejectionSpy);
        });

        return Promise.delay(150).then(function() {
            expect(resolutionSpy).to.have.callCount(1);
            expect(resolutionSpy.getCall(0)).to.be.calledWith(50);

            expect(callbackSpy).to.have.callCount(1);
            expect(callbackSpy.getCall(0)).to.be.calledWith(50);

            expect(rejectionSpy).to.have.callCount(2);
            expect(rejectionSpy.getCall(0)).to.be.calledWith(new Error('concurrency failure'));
            expect(rejectionSpy.getCall(0)).to.be.calledWith(new Error('concurrency failure'));
        });
    });
});