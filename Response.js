'use strict';
/**
 * @fileOverview Response.
 */

var EventEmitter = require('EventEmitter');
var Event = EventEmitter.Event;
var push = Array.prototype.push;
var toString = Object.prototype.toString;
var on = EventEmitter.prototype.on;
var emit = EventEmitter.prototype.emit;

/**
 *
 * @param {Function} [wrapper]
 * @constructor
 * @requires EventEmitter
 * @extends EventEmitter
 */
function Response(wrapper) {
    EventEmitter.call(this);

    /**
     *
     * @type {*}
     * @default null
     */
    this.data = null;

    /**
     *
     * @readonly
     * @type {String}
     * @default 'pending'
     */
    this.state = 'pending';

    /**
     *
     * @readonly
     * @type {Array}
     * @default []
     */
    this.stateData = new Array(0);

    /**
     *
     * Fix: Did not inline (target contains unsupported syntax [early])
     * @type {Array}
     * @default []
     * @readonly
     */
    this.result = new Array(0);

    /**
     *
     * @type {Error}
     * @default null
     */
    this.reason = null;

    /**
     *
     * @type {Object}
     * @default null
     */
    this.context = null;

    /**
     *
     * @type {Function|null}
     * @default null
     */
    this.callback = null;

    if (typeof wrapper === 'function') {
        this.invoke(wrapper);
    }

    return this;
}

/**
 *
 * @param {Response|*} [response]
 * @static
 */
Response.isResponse = function (response) {
    return response instanceof Response;
};

/**
 *
 * @example
 * var Response = require('Response');
 *
 * module.exports = Response.create();
 * module.exports instanceof Response; // true
 * module.exports.hasOwnProperty('resolve'); // false
 *
 * @param {Function} [wrapper]
 * @returns {Object}
 */
Response.create = function (wrapper) {
    Constructor.prototype = new Response(wrapper);
    return new Constructor();
};

/**
 * @param {...*} [results]
 * @static
 * @returns {Response}
 */
Response.resolve = function (results) {
    var response = new Response();
    var result = response.result;
    var index = arguments.length;

    while (index--) {
        result[index] = arguments[index];
    }

    response.state = response.STATE_RESOLVED;

    return response;
};

/**
 *
 * @param {*} reason
 * @static
 * @returns {Response}
 */
Response.reject = function (reason) {
    var response = new Response();

    response.state = response.STATE_REJECTED;
    response.reason = toError(reason);

    return response;
};

/**
 *
 * @param {Error|*} [error]
 * @param {...*} [results]
 */
Response.callback = function responseCallback(error, results) {
    var index = arguments.length;
    var arg;

    if (error == null) {
        if (index && --index) {
            arg = new Array(index);

            while (index--) {
                arg[index] = arguments[index + 1];
            }

            this.resolve.apply(this, arg);
        } else {
            this.resolve();
        }
    } else {
        this.reject(error);
    }
};

/**
 * @param {...*} [args]
 * @static
 * @returns {Queue}
 */
Response.queue = function (args) {
    var index = arguments.length;
    var stack = new Array(index);

    while (index--) {
        stack[index] = arguments[index];
    }

    return new Queue(stack);
};

/**
 *
 * @param {...*} [args]
 * @static
 * @returns {Queue}
 */
Response.strictQueue = function (args) {
    var index = arguments.length;
    var stack = new Array(index);

    while (index--) {
        stack[index] = arguments[index];
    }

    return new Queue(stack).strict();
};

inherits(Response, new EventEmitter());

/**
 * @type {String}
 * @default 'pending'
 */
Response.prototype.STATE_PENDING = 'pending';

/**
 * @type {String}
 * @default 'resolve'
 */
Response.prototype.STATE_RESOLVED = 'resolve';

/**
 * @type {String}
 * @default 'error'
 */
Response.prototype.STATE_REJECTED = 'reject';

/**
 * @type {String}
 * @default 'changeState'
 */
Response.prototype.EVENT_CHANGE_STATE = 'changeState';

/**
 * @type {String}
 * @default 'ready'
 */
Response.prototype.EVENT_READY = 'ready';

/**
 * @type {String}
 * @default 'progress'
 */
Response.prototype.EVENT_PROGRESS = 'progress';

/**
 *
 * @param {*} [data=null]
 * @returns {Response}
 */
Response.prototype.setData = function (data) {
    this.data = arguments.length ? data : null;

    return this;
};

/**
 *
 * @returns {Response}
 */
Response.prototype.clear = function () {
    return Response.call(this);
};

/**
 *
 * @param {Function} callback
 * @param {Object} [context=this]
 * @returns {Function}
 */
Response.prototype.bind = function (callback, context) {
    if (typeof callback !== 'function') {
        throw new Error('Callback is not a function');
    }

    var _context = context == null ? this : context;

    function responseCallback() {
        callback.apply(_context, arguments);
    }

    return responseCallback;
};

/**
 *
 * @returns {Response}
 */
Response.prototype.ready = function () {
    if (this.state === this.STATE_PENDING) {
        this.emit(this.EVENT_READY);
    }

    return this;
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.onReady = function (listener, context) {
    return this.on(this.EVENT_READY, listener, context);
};

/**
 *
 * @param {String|Number} state
 * @param {...*} [args]
 */
Response.prototype.setState = function (state, args) {
    var index = arguments.length;
    var hasListeners;

    if (index-- && this.state !== state) {
        this.state = state;
        this.stateData.length = index;

        hasListeners = this._events && this._events[state];

        if (index--) {
            while (index--) {
                this.stateData[index] = arguments[index + 1];
            }

            hasListeners && this.emit.apply(this, arguments);
        } else if (hasListeners) {
            this.emit(state);
        }

        this.emit(this.EVENT_CHANGE_STATE, state);
    }

    return this;
};

/**
 *
 * @param {String|Number|Event} state
 * @param {Function|EventEmitter} [listener]
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.onState = function (state, listener, context) {
    var event = (state instanceof Event) ? state : new Event(state, listener, context);
    var currentEvent = EventEmitter.event;

    if (this.state === event.type) {
        EventEmitter.event = event;

        event.listener.apply(event.context == null ? this : event.context, this.stateData);

        EventEmitter.event = currentEvent;

        if (event.isOnce) {
            return this;
        }
    }

    on.call(this, event);

    return this;
};

/**
 *
 * @param {String|Number|Event} state
 * @param {Function|EventEmitter} [listener]
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.onceState = function (state, listener, context) {
    var event;

    if (state instanceof Event) {
        state.isOnce = true;
        event = state;
    } else {
        event = new Event(state, listener, context, true);
    }

    return this.onState(event);
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.onChangeState = function (listener, context) {
    this.on(this.EVENT_CHANGE_STATE, listener, context);

    return this;
};

/**
 * @param {string} type Тип события.
 * @param {...*} [args] Аргументы, передаваемые в обработчик события.
 * @returns {Boolean}
 */
Response.prototype.emit = function (type, args) {
    var reason;
    var result = false;

    try {
        if (this._events[type]) {
            result = emit.apply(this, arguments);
        }
    } catch (error) {
        reason = error;
    }

    if (reason) {
        if (this.state === this.STATE_REJECTED) {
            this.reason = toError(reason);
        } else {
            this.reject(reason);
        }
    }

    return result;
};

/**
 *
 * @returns {Response}
 */
Response.prototype.pending = function () {
    this.result.length = 0;
    this.reason = null;
    this.final();
    this.setState(this.STATE_PENDING);

    return this;
};

/**
 * @param {...*} [results]
 * @returns {Response}
 */
Response.prototype.resolve = function (results) {
    var index = arguments.length;
    var result = this.result;

    this.reason = null;

    if (this.state !== this.STATE_RESOLVED) {
        EventEmitter.stop(this);
    }

    if (index) {
        result.length = index;

        while (index--) {
            result[index] = arguments[index];
        }

        this.setState.apply(this, [this.STATE_RESOLVED].concat(result));
    } else {
        this.setState(this.STATE_RESOLVED);
    }

    return this;
};

/**
 *
 * @param {*} reason
 * @returns {Response}
 */
Response.prototype.reject = function (reason) {
    this.result.length = 0;

    if (this.state !== this.STATE_REJECTED) {
        EventEmitter.stop(this);
    }

    if (arguments.length && reason != null) {
        this.reason = toError(reason);
    }

    this.setState(this.STATE_REJECTED, this.reason);

    return this;
};

/**
 *
 * @param {*} progress
 * @returns {Response}
 */
Response.prototype.progress = function (progress) {
    if (this.state === this.STATE_PENDING) {
        this.emit(this.EVENT_PROGRESS, progress);
    }

    return this;
};

/**
 *
 * @returns {Boolean}
 */
Response.prototype.isResolved = function () {
    return this.state === this.STATE_RESOLVED;
};

/**
 *
 * @returns {Boolean}
 */
Response.prototype.isRejected = function () {
    return this.state === this.STATE_REJECTED;
};

/**
 *
 * @param {Function|EventEmitter} [onResolve]
 * @param {Function|EventEmitter} [onReject]
 * @param {Function|EventEmitter} [onProgress]
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.then = function (onResolve, onReject, onProgress, context) {
    if (onResolve != null) {
        this.onceState(this.STATE_RESOLVED, onResolve, context);
    }

    if (onReject != null) {
        this.onceState(this.STATE_REJECTED, onReject, context);
    }

    if (onProgress != null) {
        this.on(this.EVENT_PROGRESS, onProgress, context);
    }

    return this;
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.always = function (listener, context) {
    this
        .onceState(this.STATE_RESOLVED, listener, context)
        .onceState(this.STATE_REJECTED, listener, context)
        .on(this.EVENT_PROGRESS, listener, context);

    return this;
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.onResolve = function (listener, context) {
    return this.onceState(this.STATE_RESOLVED, listener, context);
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.onReject = function (listener, context) {
    return this.onceState(this.STATE_REJECTED, listener, context);
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Response}
 */
Response.prototype.onProgress = function (listener, context) {
    return this.on(this.EVENT_PROGRESS, listener, context);
};

/**
 *
 * @param {Response} parent
 * @throws {Error} Бросает исключение, если parent равен this.
 * @returns {Response}
 * @this {Response}
 */
Response.prototype.notify = function (parent) {
    if (parent === this) {
        throw new Error('Can\'t notify itself');
    }

    if (parent && Response.isResponse(parent)) {
        this.then(parent.resolve, parent.reject, parent.progress, parent);
    }

    return this;
};

/**
 * @example
 * var Response = require('Response');
 * var Vow = require('Vow');
 *
 * new Response()
 *   .onResolve(function (result) {
 *     // result is "'success'" here
 *   })
 *   .listen(new Vow.Promise(function (resolve, reject, notify) {
 *     resolve('success');
 *   }));
 *
 * new Response()
 *   .then(function (result) {
 *     // result is 'foo' here
 *     this.isResolved(); // true
 *     this.listen(Response.resolve('bar'));
 *     this.isResolved(); // false
 *   })
 *   .then(function (result) {
 *     // result is 'bar' here
 *     this.isResolved(); // true
 *   })
 *   .resolve('foo');
 *
 * @param {Response|Object} response
 * @throws {Error} Бросает исключение, если response равен this.
 * @returns {Response}
 * @this {Response}
 */
Response.prototype.listen = function (response) {
    if (response === this) {
        throw new Error('Can\'t listen on itself');
    }

    if (this.state !== this.STATE_PENDING) {
        this.pending();
    }

    response.then(this.resolve, this.reject, this.progress, this);

    return this;
};

/**
 *
 * @returns {Response}
 */
Response.prototype.done = function () {
    this
        .onceState(this.STATE_RESOLVED, this.clear)
        .onceState(this.STATE_REJECTED, this.clear);

    return this;
};

/**
 *
 * @param {Object|null} [context]
 */
Response.prototype.setContext = function (context) {
    if (typeof context === 'object') {
        this.context = context;
    }
};

/**
 * @example
 * var Response = require('Response');
 * var r = new Response()
 *
 * function callback (data, textStatus, jqXHR) {
 *   if (data && !data.error) {
 *      this.resolve(data.result);
 *   } else {
 *      this.reject(data.error);
 *   }
 * }
 *
 * r.bind(callback);
 *
 * $.getJSON('ajax/test.json', r.callback);
 *
 * @param {Function} [callback=Response.callback]
 * @param {Object} [context=this]
 * @returns {Function}
 */
Response.prototype.makeCallback = function (callback, context) {
    return this.callback = this.bind(typeof callback === 'function' ? callback : Response.callback, context);
};

/**
 * @example
 * var r = new Response();
 * fs.open('/file.txt', 'r', r.getCallback());
 *
 * @returns {Function}
 */
Response.prototype.getCallback = function () {
    return typeof this.callback === 'function' ? this.callback : this.makeCallback();
};

/**
 *
 * @example
 * Response
 *   // Open file.txt;
 *   .fCall(fs.open, '/file.txt', 'r')
 *
 *   // File is opened, read first 10 bytes
 *   .then(function (fd) {
 *     this
 *       .setData(fd) // Save file descriptor
 *       .invoke(fs.read, fd, new Buffer(), 0, 10, null);
 *   })
 *
 *   // File is read
 *   .then(function (bytesRead, buffer) {
 *     this.invoke(fs.close, this.data);
 *   })
 *
 *   // File is closed
 *   .then(function (fd) {});
 *
 * @param {Function|String} method
 * @param {...*} [args]
 * @throws {Error} Бросает исключение, если методом является строка и response не привязан к объекту, либо метод не является функцией.
 * @returns {Response}
 */
Response.prototype.invoke = function (method, args) {
    var context = this.context == null ? this : this.context;
    var arg;
    var index;
    var _method = method;

    if ((typeof _method === 'string' || getType(_method) === 'String')) {
        if (context == null) {
            throw new Error('Context object is not defined. Use the Response#setContext method.');
        }

        _method = context[method];
    }

    if (typeof _method === 'function') {
        index = arguments.length - 1;
        arg = new Array(index);

        while (index--) {
            arg[index] = arguments[index + 1];
        }

        if (this.state !== this.STATE_PENDING) {
            this.pending();
        }

        try {
            _method.apply(context, arg);
        } catch (error) {
            this.reject(error);
        }
    } else {
        throw new Error('Method is not a function.');
    }

    return this;
};

/**
 *
 * @param {Function} callback
 * @param {Object} [context=this]
 */
Response.prototype.spread = function (callback, context) {
    callback.apply(context == null ? this : context, this.result);

    return this;
};

/**
 *
 * @example
 * new Response()
 *   .resolve(1, 2)
 *   .map(['foo', 'bar']); // {foo: 1, bar: 2}
 *
 * @param {Array} [keys=[]]
 * @returns {Object}
 */
Response.prototype.map = function (keys) {
    if (!isArray(keys)) {
        return {};
    }

    var result = this.result;
    var length = keys.length;
    var index = 0;
    var hash = {};

    while (index < length) {
        hash[keys[index]] = result[index++];
    }

    return hash;
};

/**
 *
 * @param {Array} [stack=[]]
 * @param {Boolean} [start=false]
 * @constructor
 * @returns {Queue}
 */
function Queue(stack, start) {
    Response.call(this);

    /**
     * @readonly
     * @type {Array}
     */
    this.stack = isArray(stack) ? stack : new Array(0);

    /**
     * @readonly
     * @default true
     * @type {Boolean}
     */
    this.stopped = typeof start === 'boolean' || getType(start) === 'Boolean' ? start.valueOf() : true;

    /**
     * @readonly
     * @default null
     * @type {*}
     */
    this.item = null;

    this
        .onState(this.STATE_RESOLVED, this.stop)
        .onState(this.STATE_REJECTED, this.stop);

    if (this.stopped === false) {
        this.start();
    }

    return this;
}

Queue.isQueue = function (object) {
    return object instanceof Queue;
};

inherits(Queue, new Response());

/**
 * @default 'start'
 * @type {String}
 */
Queue.prototype.EVENT_START = 'start';

/**
 * @default 'stop'
 * @type {String}
 */
Queue.prototype.EVENT_STOP = 'stop';

/**
 * @default 'resolveItem'
 * @type {String}
 */
Queue.prototype.EVENT_RESOLVE_ITEM = 'resolveItem';

/**
 * @default 'rejectItem'
 * @type {String}
 */
Queue.prototype.EVENT_REJECT_ITEM = 'rejectItem';

/**
 *
 * @returns {Queue}
 */
Queue.prototype.clear = function () {
    var result = this.result;
    var length = result.length;
    var index = 0;
    var response;

    while (index < length) {
        response = result[index++];

        if (Response.isResponse(response)) {
            response.clear();
        }
    }

    result.length = 0;

    Queue.call(this);

    return this;
};

/**
 *
 * @param {Array} [keys=[]]
 * @returns {Object}
 */
Queue.prototype.map = function (keys) {
    if (!isArray(keys)) {
        return {};
    }

    var result = this.result;
    var key;
    var length = keys.length;
    var index = 0;
    var hash = {};
    var item;

    while (index < length) {
        item = result[index++];
        key = keys[index];

        if (Response.isResponse(item)) {
            item = item.map(key);
        }

        hash[key] = item;
    }

    return hash;
};

/**
 *
 * @returns {Queue}
 */
Queue.prototype.start = function () {
    var stack = this.stack,
        item;

    if (stack.length === 0) {
        if (this.stopped === false) {
            this.resolve.apply(this, this.result);
        }

        return this;
    }

    this.stopped = false;

    item = stack.shift();

    if (this.state !== this.STATE_PENDING) {
        return this;
    }

    if (typeof item === 'function') {
        try {
            if (Response.isResponse(this.item) && this.item.result.length) {
                item = item.apply(this, this.item.result);
            } else {
                item = item.call(this);
            }
        } catch (error) {
            this.reject(error);
            return this;
        }

        if (this.stopped === true) {
            return this;
        }
    }

    if (item === this) {
        return this.start();
    }

    this.item = item;
    this.emit(this.EVENT_START, item);

    if (this.stopped === true) {
        return this;
    }

    if (Response.isResponse(item)) {
        item
            .ready()
            .onceState(this.STATE_RESOLVED, onResultItem, this)
            .onceState(this.STATE_REJECTED, onResultItem, this);
    } else {
        this.result.push(item);
        return this.start();
    }

    return this;
};

/**
 *
 * @returns {Queue}
 */
Queue.prototype.stop = function () {
    this.item = null;

    if (this.stopped === false) {
        this.stopped = true;
        this.emit(this.EVENT_STOP);
    }

    return this;
};

/**
 * @param {...*} [args]
 * @returns {Queue}
 */
Queue.prototype.push = function (args) {
    push.apply(this.stack, arguments);
    return this;
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Queue}
 */
Queue.prototype.onStart = function (listener, context) {
    this.on(this.EVENT_START, listener, context);
    return this;
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Queue}
 */
Queue.prototype.onStop = function (listener, context) {
    this.on(this.EVENT_STOP, listener, context);
    return this;
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Queue}
 */
Queue.prototype.onResolveItem = function (listener, context) {
    this.on(this.EVENT_RESOLVE_ITEM, listener, context);
    return this;
};

/**
 *
 * @param {Function|EventEmitter} listener
 * @param {Object} [context=this]
 * @returns {Queue}
 */
Queue.prototype.onRejectItem = function (listener, context) {
    this.on(this.EVENT_REJECT_ITEM, listener, context);
    return this;
};

/**
 *
 * @returns {Queue}
 */
Queue.prototype.strict = function () {
    this.on(this.EVENT_REJECT_ITEM, this.reject);
    return this;
};

/**
 * @type {Queue}
 */
Response.Queue = Queue;

/**
 * Exports: {@link Response}
 * @exports Response
 */
module.exports = Response;

function onResultItem(data) {
    var args;
    var index;
    var item = this.item;

    this.result.push(item);

    if (item.state === this.STATE_RESOLVED) {
        index = arguments.length;

        if (index) {
            args = new Array(index + 1);

            while (index) {
                args[index--] = arguments[index];
            }

            args[0] = this.EVENT_RESOLVE_ITEM;

            this.emit.apply(this, args);
        } else {
            this.emit(this.EVENT_RESOLVE_ITEM);
        }
    } else if (item.state === this.STATE_REJECTED) {
        this.emit(this.EVENT_REJECT_ITEM, data);
    }

    if (this.stopped === false) {
        if (this.stack.length) {
            this.start();
        } else {
            this.resolve.apply(this, this.result);
        }
    }

    return this;
}

function getType(object) {
    return toString.call(object).slice(8, -1);
}

function isArray(value) {
    return !(value == null || getType(value) !== 'Array');
}

function toError(value) {
    return value == null || getType(value) !== 'Error' ? new Error(value) : value;
}

function Constructor(constructor) {
    if (constructor) {
        this.constructor = constructor;
    }

    Constructor.prototype = null;
}

function inherits(constructor, prototype) {
    Constructor.prototype = prototype;
    constructor.prototype = new Constructor(constructor);
}
