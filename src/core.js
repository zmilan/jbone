// Match a standalone tag
var rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>|)$/;

// A simple way to check for HTML strings
// Prioritize #id over <tag> to avoid XSS via location.hash
var rquickExpr = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/;

function jBone() {
    if (this instanceof jBone) {
        return init.apply(this, arguments[0]);
    } else {
        return new jBone(arguments);
    }
}

jBone.prototype = [];

jBone._cache = {
    events: {},
    jid: 0
};

jBone._data = function(el) {
    el = el instanceof jBone ? el[0] : el;

    if (el === window) {
        return {
            jid: "window"
        };
    } else {
        return {
            jid: el.jid
        };
    }
};

function init() {
    if (Array.isArray(arguments[0])) {
        arguments[0].forEach(function(el) {
            addElement.call(this, [el]);
        }, this);
    } else {
        addElement.call(this, arguments);
    }

    return this;
}

function addElement(args) {
    if (typeof args[0] === "string" && args[0].match(rsingleTag)) {
        createDOMElement.apply(this, args);
    } else if (typeof args[0] === "string" && args[0].match(rquickExpr) && args[0].match(rquickExpr)[1]) {
        createDOMFromString.apply(this, args);
    } else if (typeof args[0] === "string") {
        findDOMElements.apply(this, args);
    } else if (typeof args[0] !== "string") {
        pushElement.call(this, args[0]);
    }
}

function createDOMElement() {
    var tagName = arguments[0].match(rsingleTag)[1],
        el = document.createElement(tagName);

    jBone(el).attr(arguments[1]);
    pushElement.call(this, el);
}

function createDOMFromString(html) {
    var wraper = document.createElement("div");
    wraper.innerHTML = html;

    pushElement.call(this, wraper.firstChild);
}

function findDOMElements(selector) {
    var elems = document.querySelectorAll(selector);

    [].forEach.call(elems, function(el) {
        pushElement.call(this, el);
    }, this);
}

function pushElement(el) {
    var jid = el.jid || undefined;

    if (el === window) {
        jid = "window";
    } else if (!el.jid) {
        jid = ++jBone._cache.jid;
        el.jid = jid;
    }

    if (!jBone._cache.events[jid]) {
        jBone._cache.events[jid] = {};
    }

    this.push(el);
}

global.jBone = global.$ = jBone;