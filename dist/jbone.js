/*!
 * jBone v0.0.17 - 2013-11-19 - Library for DOM manipulation
 *
 * https://github.com/kupriyanenko/jbone
 *
 * Copyright 2013 Alexey Kupriyanenko
 * Released under the MIT license.
 */

(function () {

var
// Match a standalone tag
rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,

// A simple way to check for HTML strings
// Prioritize #id over <tag> to avoid XSS via location.hash
rquickExpr = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,

// Alias for function
slice = [].slice,
keys = Object.keys,

// Alias for global variables
doc = document,
win = window,

isString = function(el) {
    return typeof el === "string";
},

isObject = function(el) {
    return el instanceof Object;
},

jBone = function(element, data) {
    if (this instanceof jBone) {
        return init.call(this, element, data);
    } else {
        return new jBone(element, data);
    }
},

init = function(element, data) {
    var elements;

    if (typeof element === "function") {
        element();
    } else if (element instanceof jBone) {
        return element;
    } else if (Array.isArray(element)) {
        elements = element.map(function(el) {
            return getElement(el, data);
        });
    } else if (element) {
        elements = getElement(element, data);
    }

    if (elements instanceof jBone) {
        return elements;
    }

    if (!elements) {
        return this;
    }

    elements = Array.isArray(elements) ? elements : [elements];
    jBone.merge(this, elements);

    if (isObject(data) && !jBone.isElement(data)) {
        this.attr(data);
    }

    return this;
},

getElement = function(element, context) {
    var tag, wraper, fragment = doc.createDocumentFragment();

    if (isString(element) && (tag = rsingleTag.exec(element))) {
        return doc.createElement(tag[1]);
    } else if (isString(element) && (tag = rquickExpr.exec(element)) && tag[1]) {
        wraper = doc.createElement("div");
        wraper.innerHTML = element;
        while(wraper.childNodes.length) {
            fragment.appendChild(wraper.firstChild);
        }
        return slice.call(fragment.childNodes);
    } else if (isString(element)) {
        if (jBone.isElement(context)) {
            return jBone(context).find(element);
        }

        try {
            return slice.call(doc.querySelectorAll(element));
        } catch (e) {
            return;
        }
    }

    return element;
};

jBone.setId = function(el) {
    var jid = el.jid;

    if (el === win) {
        jid = "window";
    } else if (el.jid === undefined) {
        el.jid = jid = ++jBone._cache.jid;
    }

    if (!jBone._cache.events[jid]) {
        jBone._cache.events[jid] = {};
    }
};

jBone.getData = function(el) {
    el = el instanceof jBone ? el[0] : el;

    var jid = el === win ? "window" : el.jid;

    return {
        jid: jid,
        events: jBone._cache.events[jid]
    };
};

jBone.isElement = function(el) {
    return el instanceof jBone || el instanceof HTMLElement || isString(el);
};

jBone._cache = {
    events: {},
    jid: 0
};

jBone.fn = jBone.prototype = [];

jBone.merge = function(first, second) {
    var l = second.length,
        i = first.length,
        j = 0;

    while (j < l) {
        first[i++] = second[j++];
    }

    first.length = i;

    return first;
};

jBone.contains = function(container, contained) {
    var result;

    container.some(function(el) {
        if (el.contains(contained)) {
            return result = el;
        }
    });

    return result;
};

jBone.extend = function(target) {
    [].splice.call(arguments, 1).forEach(function(object) {
      for (var prop in object) {
        target[prop] = object[prop];
      }
    });

    return target;
};

function Event(e, data) {
    var key, setter;

    this.originalEvent = e;

    setter = function(key, e) {
        if (key === "preventDefault") {
            this[key] = function() {
                this.defaultPrevented = true;
                return e[key]();
            };
        } else if (typeof e[key] === "function") {
            this[key] = function() {
                return e[key]();
            };
        } else {
            this[key] = e[key];
        }
    };

    for (key in e) {
        setter.call(this, key, e);
    }

    jBone.extend(this, data);
}

jBone.Event = function(event, data) {
    var namespace, eventType;

    if (event.type && !data) {
        data = event;
        event = event.type;
    }

    namespace = event.split(".").splice(1).join(".");
    eventType = event.split(".")[0];

    event = doc.createEvent("Event");
    event.initEvent(eventType, true, true);

    return jBone.extend(event, {
        namespace: namespace,
        isDefaultPrevented: function() {
            return event.defaultPrevented;
        }
    }, data);
};

jBone.fn.on = function(event) {
    var args = arguments,
        callback, target, namespace, fn, events, eventType, expectedTarget;

    if (args.length === 2) {
        callback = args[1];
    } else {
        target = args[1], callback = args[2];
    }

    this.forEach(function(el) {
        jBone.setId(el);
        events = jBone.getData(el).events;
        event.split(" ").forEach(function(event) {
            eventType = event.split(".")[0];
            namespace = event.split(".").splice(1).join(".");
            events[eventType] = events[eventType] || [];

            fn = function(e) {
                if (e.namespace && e.namespace !== namespace) {
                    return;
                }

                expectedTarget = null;
                if (!target) {
                    callback.call(el, e);
                } else if (~jBone(el).find(target).indexOf(e.target) || (expectedTarget = jBone.contains(jBone(el).find(target), e.target))) {
                    expectedTarget = expectedTarget || e.target;
                    e = new Event(e, {
                        currentTarget: expectedTarget
                    });

                    callback.call(expectedTarget, e);
                }
            };

            events[eventType].push({
                namespace: namespace,
                fn: fn,
                originfn: callback
            });

            el.addEventListener && el.addEventListener(eventType, fn, false);
        });
    });

    return this;
};

jBone.fn.one = function() {
    var event = arguments[0], args = arguments,
        callback, target;

    if (args.length === 2) {
        callback = args[1];
    } else {
        target = args[1], callback = args[2];
    }

    this.forEach(function(el) {
        event.split(" ").forEach(function(event) {
            var fn = function(e) {
                jBone(el).off(event, fn);
                callback.call(el, e);
            };

            if (!target) {
                jBone(el).on(event, fn);
            } else {
                jBone(el).on(event, target, fn);
            }
        });
    });

    return this;
};

jBone.fn.trigger = function(event) {
    var events = [];

    if (!event) {
        return this;
    }

    if (isString(event)) {
        events = event.split(" ").map(function(event) {
            return jBone.Event(event);
        });
    } else {
        event = event instanceof Event ? event : $.Event(event);
        events = [event];
    }

    this.forEach(function(el) {
        events.forEach(function(event) {
            if (!event.type) {
                return;
            }

            el.dispatchEvent && el.dispatchEvent(event);
        });
    });

    return this;
};

jBone.fn.off = function(event, fn) {
    var events, callback, namespace, eventType,
        getCallback = function(e) {
            if (fn && e.originfn === fn) {
                return e.fn;
            } else if (!fn) {
                return e.fn;
            }
        };

    this.forEach(function(el) {
        events = jBone.getData(el).events;

        if (!events) {
            return;
        }

        event.split(" ").forEach(function(event) {
            eventType = event.split(".")[0];
            namespace = event.split(".").splice(1).join(".");

            // remove named events
            if (events[eventType]) {
                events[eventType].forEach(function(e) {
                    callback = getCallback(e);
                    if (!namespace || (namespace && e.namespace === namespace)) {
                        el.removeEventListener(eventType, callback);
                    }
                });
            }
            // remove all namespaced events
            else if (namespace) {
                keys(events).forEach(function(key) {
                    events[key].forEach(function(e) {
                        callback = getCallback(e);
                        if (e.namespace.split(".")[0] === namespace.split(".")[0]) {
                            el.removeEventListener(key, callback);
                        }
                    });
                });
            }
        });
    });

    return this;
};

jBone.fn.find = function(selector) {
    var results = [];

    this.forEach(function(el) {
        try {
            [].forEach.call(el.querySelectorAll(selector), function(found) {
                results.push(found);
            });
        } catch(e) {
            // results not found
        }
    });

    return jBone(results);
};

jBone.fn.get = function(index) {
    return this[index];
};

jBone.fn.eq = function(index) {
    return jBone(this[index]);
};

jBone.fn.parent = function() {
    var results = [], parent;

    this.forEach(function(el) {
        if (!~results.indexOf(parent = el.parentElement) && parent) {
            results.push(parent);
        }
    });

    return jBone(results);
};

jBone.fn.toArray = function() {
    return slice.call(this);
};

jBone.fn.is = function() {
    var args = arguments;

    return this.some(function(el) {
        return el.tagName.toLowerCase() === args[0];
    });
};

jBone.fn.has = function() {
    var args = arguments;

    return this.some(function(el) {
        return el.querySelectorAll(args[0]).length;
    });
};

jBone.fn.attr = function(key, value) {
    var args = arguments, setter;

    if (isString(key) && args.length === 1) {
        return this[0].getAttribute(key);
    }

    if (args.length === 2) {
        setter = function(el) {
            el.setAttribute(key, value);
        };
    } else if (isObject(key)) {
        setter = function(el) {
            keys(key).forEach(function(name) {
                el.setAttribute(name, key[name]);
            });
        };
    }

    this.forEach(setter);

    return this;
};

jBone.fn.val = function(value) {
    if (arguments.length === 0) {
        return this[0].value;
    }

    this.forEach(function(el) {
        el.value = value;
    });

    return this;
};

jBone.fn.css = function(key, value) {
    var args = arguments, setter;

    if (isString(key) && args.length === 1) {
        return win.getComputedStyle(this[0])[key];
    }

    if (args.length === 2) {
        setter = function(el) {
            el.style[key] = value;
        };
    } else if (isObject(key)) {
        setter = function(el) {
            keys(key).forEach(function(name) {
                el.style[name] = key[name];
            });
        };
    }

    this.forEach(setter);

    return this;
};

jBone.fn.data = function(key, value) {
    var args = arguments, data = {}, setter,
        setValue = function(el, key, value) {
            if (isObject(value)) {
                el.jdata = el.jdata || {};
                el.jdata[key] = value;
            } else {
                el.dataset[key] = value;
            }
        },
        getValue = function(value) {
            if (value === "true") {
                return true;
            } else if (value === "false") {
                return false;
            } else {
                return value;
            }
        };

    // Get data
    if (args.length === 0) {
        this[0].jdata && (data = this[0].jdata);

        keys(this[0].dataset).forEach(function(key) {
            data[key] = getValue(this[0].dataset[key]);
        }, this);

        return data;
    } else if (args.length === 1 && isString(key)) {
        return getValue(this[0].dataset[key] || this[0].jdata && this[0].jdata[key]);
    }

    // Set data
    if (args.length === 1 && isObject(key)) {
        setter = function(el) {
            keys(key).forEach(function(name) {
                setValue(el, name, key[name]);
            });
        };
    } else if (args.length === 2) {
        setter = function(el) {
            setValue(el, key, value);
        };
    }

    this.forEach(setter);

    return this;
};

jBone.fn.html = function(value) {
    var result = [], el;

   // add HTML into elements
    if (value !== undefined) {
        this.empty().append(value);

        return this;
    }

    // get HTML from elements
	el = this[0] || {};
	if (el instanceof HTMLElement) {
        result=el.innerHTML;
    }
    
    return result;
};

jBone.fn.append = function(appended) {
    var setter;

    if (isString(appended) && rquickExpr.exec(appended)) {
        appended = jBone(appended);
    } else if (!isObject(appended)) {
        appended = document.createTextNode(appended);
    }

    if (appended instanceof jBone) {
        setter = function(el, i) {
            appended.forEach(function(node) {
                if (i) {
                    el.appendChild(node.cloneNode());
                } else {
                    el.appendChild(node);
                }
            });
        };
    } else if (appended instanceof Node) {
        setter = function(el) {
            el.appendChild(appended);
        };
    }

    this.forEach(setter);

    return this;
};

jBone.fn.appendTo = function(to) {
    jBone(to).append(this);

    return this;
};

jBone.fn.empty = function() {
    this.forEach(function(el) {
        while (el.hasChildNodes()) {
            el.removeChild(el.lastChild);
        }
    });

    return this;
};

jBone.fn.remove = function() {
    this.forEach(function(el) {
        el.jdata = {};

        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    });

    return this;
};

jBone.fn.each = function(fn) {
    var length = this.length >>> 0,
        i = -1;

    while (++i < length) {
        if (i in this) {
            fn.call(this[i], i, this[i]);
        }
    }

    return this;
};

jBone.fn.prop = function(name, value) {
    var result;

    if (arguments.length === 1) {
        this.some(function(el) {
            if (name === "checked") {
                return result = el.checked;
            }

            return result = el.getAttribute(name);
        });

        return result;
    } else if (arguments.length === 2) {
        this.forEach(function(el) {
            el.setAttribute(name, value);
        });
    }

    return this;
};

jBone.fn.hasClass = function(className) {
    return this.some(function(el) {
        return el.classList.contains(className);
    });
};

jBone.fn.removeClass = function(className) {
    this.forEach(function(el) {
        className.split(" ").forEach(function(className) {
            el.classList.remove(className);
        });
    });

    return this;
};

jBone.fn.addClass = function(className) {
    this.forEach(function(el) {
        className.split(" ").forEach(function(className) {
            el.classList.add(className);
        });
    });

    return this;
};

jBone.fn.toggleClass = function(className) {
    this.forEach(function(el) {
        el.classList.toggle(className);
    });

    return this;
};

jBone.fn.click = function() {
    return this.trigger("click");
};

jBone.fn.height = function(value) {
    if (value !== undefined) {
        this.forEach(function(el) {
            el.style.height = value;
        });

        return this;
    }

    return this[0].clientHeight;
};

jBone.fn.removeAttr = function(name) {
    this.forEach(function(el) {
        el.removeAttribute(name);
    });
};

jBone.fn.closest = function(selector) {
    var parents, target, result;

    parents = jBone(selector);
    target = this[0];

    parents.some(function(parent) {
        return result = jBone.contains(jBone(parent), target);
    });

    return jBone(result);
};

jBone.fn.parents = function(selector) {
    var result = [], parents, target;

    if (selector) {
        parents = jBone(selector);

        parents.forEach(function(parent) {
            this.forEach(function(el) {
                if ((target = jBone.contains(jBone(parent), el)) && target.nodeType !== 9 && !~result.indexOf(target)) {
                    result.push(target);
                }
            });
        }, this);
    } else {
        this.forEach(function(el) {
            target = el;

            while ((target = target.parentNode) && target.nodeType !== 9) {
                if (!~result.indexOf(target)) {
                    result.push(target);
                }
            }
        });
    }

    return jBone(result);
};

jBone.fn.children = function() {
    var result = [];

    this.forEach(function(el) {
        [].forEach.call(el.childNodes, function(el) {
            if (el.nodeType !== 3) {
                result.push(el);
            }
        });
    });

    return jBone(result);
};

jBone.fn.not = function(condition) {
    var result = [];

    result = this.filter(function(el) {
        return el !== condition;
    });

    return jBone(result);
};

jBone.fn.focus = function() {
    return this.trigger("focus");
};

jBone.fn.siblings = function(includeSelf) {
    var result = [], parent;

    this.forEach(function(el) {
        if (parent = el.parentNode) {
            [].forEach.call(el.parentNode.childNodes, function(node) {
                if (includeSelf === undefined && node !== el && node.nodeType !== 3) {
                    result.push(node);
                } else if (includeSelf === true && node.nodeType !== 3) {
                    result.push(node);
                }
            });
        }
    });

    return jBone(result);
};

jBone.fn.next = function() {
    var result = [], next;

    this.forEach(function(el) {
        if (!~result.indexOf(next = el.nextElementSibling) && next) {
            result.push(next);
        }
    });

    return jBone(result);
};


jBone.fn.prev = function() {
    var result = [], previous;

    this.forEach(function(el) {
        if (!~result.indexOf(previous = el.previousElementSibling) && previous) {
            result.push(previous);
        }
    });

    return jBone(result);
};

jBone.fn.first = function() {
    return this.eq(0);
};

jBone.fn.last = function() {
    return this.eq(this.length - 1);
};

jBone.fn.index = function(element) {
    if (element instanceof jBone) {
        element = element[0];
    }

    if (element instanceof HTMLElement) {
        return this.indexOf(element);
    }
};

jBone.fn.is = function(match) {
    match = match.split(", ");

    return this.some(function(el) {
        return match.some(function(match) {
            // check visible
            if (match === ":visible") {
                return el.offsetWidth > 0 || el.offsetHeight > 0;
            }
            // check attribute
            else if (match[0] === ":") {
                return el.getAttribute(match.split(":")[1]) !== null;
            }
            // check class
            else if (match[0] === ".") {
                return el.classList.contains(match.split(".")[1]);
            }
            // check tagName
            else if (el.tagName.toLowerCase() === match) {
                return true;
            }
        });
    });
};

function isHidden(el) {
    return win.getComputedStyle(el).display === "none";
}

function showHide(elements, show) {
    var display;

    elements.forEach(function(el) {
        if (!el.style) {
            return;
        }

        display = el.style.display;
        if (show) {
            if (display === "none") {
                el.style.display = "";
            }

            if (el.style.display === "" && isHidden(el)) {
                el.style.display = "block";
            }
        } else {
            el.style.display = "none";
        }
    });

    return elements;
}

jBone.fn.show = function() {
    return showHide(this, true);
};

jBone.fn.hide = function() {
    return showHide(this);
};

jBone.fn.bind = jBone.fn.on;

jBone.camelCase = function(string) {
    return string.replace(/-([\da-z])/gi, function(all, letter) {
        return letter.toUpperCase();
    });
};

jBone.proxy = function(fn, context) {
    return fn.bind(context);
};

jBone.fn.map = function() {
    return jBone([].map.apply(this, arguments));
};

jBone.fn.scrollTop = function() {
    return this[0].scrollTop || this[0].scrollY || 0;
};

jBone.fn.text = function() {
    var result = [];

    this.forEach(function(el) {
        result.push(el.textContent);
    });

    return result.join("");
};

jBone.fn.detach = function() {
    this.forEach(function(el) {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    });

    return this;
};

jBone.support = {};

if (typeof define === "function" && define.amd) {
    define(function() {
        return jBone;
    });
}

if (typeof win === "object" && typeof win.document === "object") {
    win.jBone = win.$ = jBone;
}

}());
