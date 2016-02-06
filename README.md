# lockable


Lockable is a utility module for promises to control their execution and their resolution sequence


## API

```javascript

var lockable = require('lockable');


var acquired = lockable.acquire('lockSequence');

if(acquired()) {

} else {

}


var sequence = lockable.sequence('lockSequence', startcb, endcb)
sequence(function() {
}).then(...);

var queue = lockable.queue('lockSequence', startcb, endcb)
queue(function() {
}).then(...);

```