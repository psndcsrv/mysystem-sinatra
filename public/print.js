/*  Prototype JavaScript framework, version 1.6.0.3
 *  (c) 2005-2008 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {
  Version: '1.6.0.3',

  Browser: {
    IE:     !!(window.attachEvent &&
      navigator.userAgent.indexOf('Opera') === -1),
    Opera:  navigator.userAgent.indexOf('Opera') > -1,
    WebKit: navigator.userAgent.indexOf('AppleWebKit/') > -1,
    Gecko:  navigator.userAgent.indexOf('Gecko') > -1 &&
      navigator.userAgent.indexOf('KHTML') === -1,
    MobileSafari: !!navigator.userAgent.match(/Apple.*Mobile.*Safari/)
  },

  BrowserFeatures: {
    XPath: !!document.evaluate,
    SelectorsAPI: !!document.querySelector,
    ElementExtensions: !!window.HTMLElement,
    SpecificElementExtensions:
      document.createElement('div')['__proto__'] &&
      document.createElement('div')['__proto__'] !==
        document.createElement('form')['__proto__']
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },
  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


/* Based on Alex Arnell's inheritance implementation. */
var Class = {
  create: function() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      var subclass = function() { };
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0; i < properties.length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;

    return klass;
  }
};

Class.Methods = {
  addMethods: function(source) {
    var ancestor   = this.superclass && this.superclass.prototype;
    var properties = Object.keys(source);

    if (!Object.keys({ toString: true }).length)
      properties.push("toString", "valueOf");

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames().first() == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments) };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }
};

var Abstract = { };

Object.extend = function(destination, source) {
  for (var property in source)
    destination[property] = source[property];
  return destination;
};

Object.extend(Object, {
  inspect: function(object) {
    try {
      if (Object.isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  },

  toJSON: function(object) {
    var type = typeof object;
    switch (type) {
      case 'undefined':
      case 'function':
      case 'unknown': return;
      case 'boolean': return object.toString();
    }

    if (object === null) return 'null';
    if (object.toJSON) return object.toJSON();
    if (Object.isElement(object)) return;

    var results = [];
    for (var property in object) {
      var value = Object.toJSON(object[property]);
      if (!Object.isUndefined(value))
        results.push(property.toJSON() + ': ' + value);
    }

    return '{' + results.join(', ') + '}';
  },

  toQueryString: function(object) {
    return $H(object).toQueryString();
  },

  toHTML: function(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  },

  keys: function(object) {
    var keys = [];
    for (var property in object)
      keys.push(property);
    return keys;
  },

  values: function(object) {
    var values = [];
    for (var property in object)
      values.push(object[property]);
    return values;
  },

  clone: function(object) {
    return Object.extend({ }, object);
  },

  isElement: function(object) {
    return !!(object && object.nodeType == 1);
  },

  isArray: function(object) {
    return object != null && typeof object == "object" &&
      'splice' in object && 'join' in object;
  },

  isHash: function(object) {
    return object instanceof Hash;
  },

  isFunction: function(object) {
    return typeof object == "function";
  },

  isString: function(object) {
    return typeof object == "string";
  },

  isNumber: function(object) {
    return typeof object == "number";
  },

  isUndefined: function(object) {
    return typeof object == "undefined";
  }
});

Object.extend(Function.prototype, {
  argumentNames: function() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^\)]*)\)/)[1]
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  },

  bind: function() {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = $A(arguments), object = args.shift();
    return function() {
      return __method.apply(object, args.concat($A(arguments)));
    }
  },

  bindAsEventListener: function() {
    var __method = this, args = $A(arguments), object = args.shift();
    return function(event) {
      return __method.apply(object, [event || window.event].concat(args));
    }
  },

  curry: function() {
    if (!arguments.length) return this;
    var __method = this, args = $A(arguments);
    return function() {
      return __method.apply(this, args.concat($A(arguments)));
    }
  },

  delay: function() {
    var __method = this, args = $A(arguments), timeout = args.shift() * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  },

  defer: function() {
    var args = [0.01].concat($A(arguments));
    return this.delay.apply(this, args);
  },

  wrap: function(wrapper) {
    var __method = this;
    return function() {
      return wrapper.apply(this, [__method.bind(this)].concat($A(arguments)));
    }
  },

  methodize: function() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      return __method.apply(null, [this].concat($A(arguments)));
    };
  }
});

Date.prototype.toJSON = function() {
  return '"' + this.getUTCFullYear() + '-' +
    (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
    this.getUTCDate().toPaddedString(2) + 'T' +
    this.getUTCHours().toPaddedString(2) + ':' +
    this.getUTCMinutes().toPaddedString(2) + ':' +
    this.getUTCSeconds().toPaddedString(2) + 'Z"';
};

var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};

/*--------------------------------------------------------------------------*/

var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
      } finally {
        this.currentlyExecuting = false;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, {
  gsub: function(pattern, replacement) {
    var result = '', source = this, match;
    replacement = arguments.callee.prepareReplacement(replacement);

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  },

  sub: function(pattern, replacement, count) {
    replacement = this.gsub.prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  },

  scan: function(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  },

  truncate: function(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  },

  strip: function() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  },

  stripTags: function() {
    return this.replace(/<\/?[^>]+>/gi, '');
  },

  stripScripts: function() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  },

  extractScripts: function() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img');
    var matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  },

  evalScripts: function() {
    return this.extractScripts().map(function(script) { return eval(script) });
  },

  escapeHTML: function() {
    var self = arguments.callee;
    self.text.data = this;
    return self.div.innerHTML;
  },

  unescapeHTML: function() {
    var div = new Element('div');
    div.innerHTML = this.stripTags();
    return div.childNodes[0] ? (div.childNodes.length > 1 ?
      $A(div.childNodes).inject('', function(memo, node) { return memo+node.nodeValue }) :
      div.childNodes[0].nodeValue) : '';
  },

  toQueryParams: function(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift());
        var value = pair.length > 1 ? pair.join('=') : pair[0];
        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  },

  toArray: function() {
    return this.split('');
  },

  succ: function() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  },

  times: function(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  },

  camelize: function() {
    var parts = this.split('-'), len = parts.length;
    if (len == 1) return parts[0];

    var camelized = this.charAt(0) == '-'
      ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1)
      : parts[0];

    for (var i = 1; i < len; i++)
      camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);

    return camelized;
  },

  capitalize: function() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  },

  underscore: function() {
    return this.gsub(/::/, '/').gsub(/([A-Z]+)([A-Z][a-z])/,'#{1}_#{2}').gsub(/([a-z\d])([A-Z])/,'#{1}_#{2}').gsub(/-/,'_').toLowerCase();
  },

  dasherize: function() {
    return this.gsub(/_/,'-');
  },

  inspect: function(useDoubleQuotes) {
    var escapedString = this.gsub(/[\x00-\x1f\\]/, function(match) {
      var character = String.specialChar[match[0]];
      return character ? character : '\\u00' + match[0].charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  },

  toJSON: function() {
    return this.inspect(true);
  },

  unfilterJSON: function(filter) {
    return this.sub(filter || Prototype.JSONFilter, '#{1}');
  },

  isJSON: function() {
    var str = this;
    if (str.blank()) return false;
    str = this.replace(/\\./g, '@').replace(/"[^"\\\n\r]*"/g, '');
    return (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/).test(str);
  },

  evalJSON: function(sanitize) {
    var json = this.unfilterJSON();
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  },

  include: function(pattern) {
    return this.indexOf(pattern) > -1;
  },

  startsWith: function(pattern) {
    return this.indexOf(pattern) === 0;
  },

  endsWith: function(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.lastIndexOf(pattern) === d;
  },

  empty: function() {
    return this == '';
  },

  blank: function() {
    return /^\s*$/.test(this);
  },

  interpolate: function(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }
});

if (Prototype.Browser.WebKit || Prototype.Browser.IE) Object.extend(String.prototype, {
  escapeHTML: function() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  unescapeHTML: function() {
    return this.stripTags().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  }
});

String.prototype.gsub.prepareReplacement = function(replacement) {
  if (Object.isFunction(replacement)) return replacement;
  var template = new Template(replacement);
  return function(match) { return template.evaluate(match) };
};

String.prototype.parseQuery = String.prototype.toQueryParams;

Object.extend(String.prototype.escapeHTML, {
  div:  document.createElement('div'),
  text: document.createTextNode('')
});

String.prototype.escapeHTML.div.appendChild(String.prototype.escapeHTML.text);

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return '';

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3];
      var pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;
      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].gsub('\\\\]', ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = {
  each: function(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  },

  eachSlice: function(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  },

  all: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  },

  any: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  },

  collect: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  },

  detect: function(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  },

  findAll: function(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  },

  grep: function(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(filter);

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  },

  include: function(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  },

  inGroupsOf: function(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  },

  inject: function(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  },

  invoke: function(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  },

  max: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  },

  min: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  },

  partition: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  },

  pluck: function(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  },

  reject: function(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  },

  sortBy: function(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  },

  toArray: function() {
    return this.map();
  },

  zip: function() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  },

  size: function() {
    return this.toArray().length;
  },

  inspect: function() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }
};

Object.extend(Enumerable, {
  map:     Enumerable.collect,
  find:    Enumerable.detect,
  select:  Enumerable.findAll,
  filter:  Enumerable.findAll,
  member:  Enumerable.include,
  entries: Enumerable.toArray,
  every:   Enumerable.all,
  some:    Enumerable.any
});
function $A(iterable) {
  if (!iterable) return [];
  if (iterable.toArray) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}

if (Prototype.Browser.WebKit) {
  $A = function(iterable) {
    if (!iterable) return [];
    if (!(typeof iterable === 'function' && typeof iterable.length ===
        'number' && typeof iterable.item === 'function') && iterable.toArray)
      return iterable.toArray();
    var length = iterable.length || 0, results = new Array(length);
    while (length--) results[length] = iterable[length];
    return results;
  };
}

Array.from = $A;

Object.extend(Array.prototype, Enumerable);

if (!Array.prototype._reverse) Array.prototype._reverse = Array.prototype.reverse;

Object.extend(Array.prototype, {
  _each: function(iterator) {
    for (var i = 0, length = this.length; i < length; i++)
      iterator(this[i]);
  },

  clear: function() {
    this.length = 0;
    return this;
  },

  first: function() {
    return this[0];
  },

  last: function() {
    return this[this.length - 1];
  },

  compact: function() {
    return this.select(function(value) {
      return value != null;
    });
  },

  flatten: function() {
    return this.inject([], function(array, value) {
      return array.concat(Object.isArray(value) ?
        value.flatten() : [value]);
    });
  },

  without: function() {
    var values = $A(arguments);
    return this.select(function(value) {
      return !values.include(value);
    });
  },

  reverse: function(inline) {
    return (inline !== false ? this : this.toArray())._reverse();
  },

  reduce: function() {
    return this.length > 1 ? this : this[0];
  },

  uniq: function(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  },

  intersect: function(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  },

  clone: function() {
    return [].concat(this);
  },

  size: function() {
    return this.length;
  },

  inspect: function() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  },

  toJSON: function() {
    var results = [];
    this.each(function(object) {
      var value = Object.toJSON(object);
      if (!Object.isUndefined(value)) results.push(value);
    });
    return '[' + results.join(', ') + ']';
  }
});

if (Object.isFunction(Array.prototype.forEach))
  Array.prototype._each = Array.prototype.forEach;

if (!Array.prototype.indexOf) Array.prototype.indexOf = function(item, i) {
  i || (i = 0);
  var length = this.length;
  if (i < 0) i = length + i;
  for (; i < length; i++)
    if (this[i] === item) return i;
  return -1;
};

if (!Array.prototype.lastIndexOf) Array.prototype.lastIndexOf = function(item, i) {
  i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
  var n = this.slice(0, i).reverse().indexOf(item);
  return (n < 0) ? n : i - n - 1;
};

Array.prototype.toArray = Array.prototype.clone;

function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

if (Prototype.Browser.Opera){
  Array.prototype.concat = function() {
    var array = [];
    for (var i = 0, length = this.length; i < length; i++) array.push(this[i]);
    for (var i = 0, length = arguments.length; i < length; i++) {
      if (Object.isArray(arguments[i])) {
        for (var j = 0, arrayLength = arguments[i].length; j < arrayLength; j++)
          array.push(arguments[i][j]);
      } else {
        array.push(arguments[i]);
      }
    }
    return array;
  };
}
Object.extend(Number.prototype, {
  toColorPart: function() {
    return this.toPaddedString(2, 16);
  },

  succ: function() {
    return this + 1;
  },

  times: function(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  },

  toPaddedString: function(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  },

  toJSON: function() {
    return isFinite(this) ? this.toString() : 'null';
  }
});

$w('abs round ceil floor').each(function(method){
  Number.prototype[method] = Math[method].methodize();
});
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  return {
    initialize: function(object) {
      this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
    },

    _each: function(iterator) {
      for (var key in this._object) {
        var value = this._object[key], pair = [key, value];
        pair.key = key;
        pair.value = value;
        iterator(pair);
      }
    },

    set: function(key, value) {
      return this._object[key] = value;
    },

    get: function(key) {
      if (this._object[key] !== Object.prototype[key])
        return this._object[key];
    },

    unset: function(key) {
      var value = this._object[key];
      delete this._object[key];
      return value;
    },

    toObject: function() {
      return Object.clone(this._object);
    },

    keys: function() {
      return this.pluck('key');
    },

    values: function() {
      return this.pluck('value');
    },

    index: function(value) {
      var match = this.detect(function(pair) {
        return pair.value === value;
      });
      return match && match.key;
    },

    merge: function(object) {
      return this.clone().update(object);
    },

    update: function(object) {
      return new Hash(object).inject(this, function(result, pair) {
        result.set(pair.key, pair.value);
        return result;
      });
    },

    toQueryString: function() {
      return this.inject([], function(results, pair) {
        var key = encodeURIComponent(pair.key), values = pair.value;

        if (values && typeof values == 'object') {
          if (Object.isArray(values))
            return results.concat(values.map(toQueryPair.curry(key)));
        } else results.push(toQueryPair(key, values));
        return results;
      }).join('&');
    },

    inspect: function() {
      return '#<Hash:{' + this.map(function(pair) {
        return pair.map(Object.inspect).join(': ');
      }).join(', ') + '}>';
    },

    toJSON: function() {
      return Object.toJSON(this.toObject());
    },

    clone: function() {
      return new Hash(this);
    }
  }
})());

Hash.prototype.toTemplateReplacements = Hash.prototype.toObject;
Hash.from = $H;
var ObjectRange = Class.create(Enumerable, {
  initialize: function(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  },

  _each: function(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  },

  include: function(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }
});

var $R = function(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
};

var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});

Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isString(this.options.parameters))
      this.options.parameters = this.options.parameters.toQueryParams();
    else if (Object.isHash(this.options.parameters))
      this.options.parameters = this.options.parameters.toObject();
  }
});

Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.clone(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      params['_method'] = this.method;
      this.method = 'post';
    }

    this.parameters = params;

    if (params = Object.toQueryString(params)) {
      if (this.method == 'get')
        this.url += (this.url.include('?') ? '&' : '?') + params;
      else if (/Konqueror|Safari|KHTML/.test(navigator.userAgent))
        params += '&_=';
    }

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300);
  },

  getStatus: function() {
    try {
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];

Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if(readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,
  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});
function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!window.Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}

(function() {
  var element = this.Element;
  this.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;
    if (Prototype.Browser.IE && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }
    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));
    return Element.writeAttribute(cache[tagName].cloneNode(false), attributes);
  };
  Object.extend(this.Element, element || { });
  if (element) this.Element.prototype = element.prototype;
}).call(window);

Element.cache = { };

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) return element.update().insert(content);
    content = Object.toHTML(content);
    element.innerHTML = content.stripScripts();
    content.evalScripts.bind(content).defer();
    return element;
  },

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(), attribute = pair.last();
      var value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property) {
    element = $(element);
    var elements = [];
    while (element = element[property])
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
    return elements;
  },

  ancestors: function(element) {
    return $(element).recursivelyCollect('parentNode');
  },

  descendants: function(element) {
    return $(element).select("*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    if (!(element = $(element).firstChild)) return [];
    while (element && element.nodeType != 1) element = element.nextSibling;
    if (element) return [element].concat($(element).nextSiblings());
    return [];
  },

  previousSiblings: function(element) {
    return $(element).recursivelyCollect('previousSibling');
  },

  nextSiblings: function(element) {
    return $(element).recursivelyCollect('nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return element.previousSiblings().reverse().concat(element.nextSiblings());
  },

  match: function(element, selector) {
    if (Object.isString(selector))
      selector = new Selector(selector);
    return selector.match($(element));
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = element.ancestors();
    return Object.isNumber(expression) ? ancestors[expression] :
      Selector.findElement(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return element.firstDescendant();
    return Object.isNumber(expression) ? element.descendants()[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(Selector.handlers.previousElementSibling(element));
    var previousSiblings = element.previousSiblings();
    return Object.isNumber(expression) ? previousSiblings[expression] :
      Selector.findElement(previousSiblings, expression, index);
  },

  next: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(Selector.handlers.nextElementSibling(element));
    var nextSiblings = element.nextSiblings();
    return Object.isNumber(expression) ? nextSiblings[expression] :
      Selector.findElement(nextSiblings, expression, index);
  },

  select: function() {
    var args = $A(arguments), element = $(args.shift());
    return Selector.findChildElements(element, args);
  },

  adjacent: function() {
    var args = $A(arguments), element = $(args.shift());
    return Selector.findChildElements(element.parentNode, args).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = element.readAttribute('id'), self = arguments.callee;
    if (id) return id;
    do { id = 'anonymous_element_' + self.counter++ } while ($(id));
    element.writeAttribute('id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return $(element).getDimensions().height;
  },

  getWidth: function(element) {
    return $(element).getDimensions().width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!element.hasClassName(className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return element[element.hasClassName(className) ?
      'removeClassName' : 'addClassName'](className);
  },

  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = element.cumulativeOffset();
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  getDimensions: function(element) {
    element = $(element);
    var display = element.getStyle('display');
    if (display != 'none' && display != null) // Safari bug
      return {width: element.offsetWidth, height: element.offsetHeight};

    var els = element.style;
    var originalVisibility = els.visibility;
    var originalPosition = els.position;
    var originalDisplay = els.display;
    els.visibility = 'hidden';
    els.position = 'absolute';
    els.display = 'block';
    var originalWidth = element.clientWidth;
    var originalHeight = element.clientHeight;
    els.display = originalDisplay;
    els.position = originalPosition;
    els.visibility = originalVisibility;
    return {width: originalWidth, height: originalHeight};
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  cumulativeOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  positionedOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (element.tagName.toUpperCase() == 'BODY') break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  absolutize: function(element) {
    element = $(element);
    if (element.getStyle('position') == 'absolute') return element;

    var offsets = element.positionedOffset();
    var top     = offsets[1];
    var left    = offsets[0];
    var width   = element.clientWidth;
    var height  = element.clientHeight;

    element._originalLeft   = left - parseFloat(element.style.left  || 0);
    element._originalTop    = top  - parseFloat(element.style.top || 0);
    element._originalWidth  = element.style.width;
    element._originalHeight = element.style.height;

    element.style.position = 'absolute';
    element.style.top    = top + 'px';
    element.style.left   = left + 'px';
    element.style.width  = width + 'px';
    element.style.height = height + 'px';
    return element;
  },

  relativize: function(element) {
    element = $(element);
    if (element.getStyle('position') == 'relative') return element;

    element.style.position = 'relative';
    var top  = parseFloat(element.style.top  || 0) - (element._originalTop || 0);
    var left = parseFloat(element.style.left || 0) - (element._originalLeft || 0);

    element.style.top    = top + 'px';
    element.style.left   = left + 'px';
    element.style.height = element._originalHeight;
    element.style.width  = element._originalWidth;
    return element;
  },

  cumulativeScrollOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  getOffsetParent: function(element) {
    if (element.offsetParent) return $(element.offsetParent);
    if (element == document.body) return $(element);

    while ((element = element.parentNode) && element != document.body)
      if (Element.getStyle(element, 'position') != 'static')
        return $(element);

    return $(document.body);
  },

  viewportOffset: function(forElement) {
    var valueT = 0, valueL = 0;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;

      if (element.offsetParent == document.body &&
        Element.getStyle(element, 'position') == 'absolute') break;

    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (!Prototype.Browser.Opera || (element.tagName && (element.tagName.toUpperCase() == 'BODY'))) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);

    return Element._returnOffset(valueL, valueT);
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    source = $(source);
    var p = source.viewportOffset();

    element = $(element);
    var delta = [0, 0];
    var parent = null;
    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = element.getOffsetParent();
      delta = parent.viewportOffset();
    }

    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Element.Methods.identify.counter = 1;

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,
  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'left': case 'top': case 'right': case 'bottom':
          if (proceed(element, 'position') === 'static') return null;
        case 'height': case 'width':
          if (!Element.visible(element)) return null;

          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  Element.Methods.getOffsetParent = Element.Methods.getOffsetParent.wrap(
    function(proceed, element) {
      element = $(element);
      try { element.offsetParent }
      catch(e) { return $(document.body) }
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);
      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    }
  );

  $w('positionedOffset viewportOffset').each(function(method) {
    Element.Methods[method] = Element.Methods[method].wrap(
      function(proceed, element) {
        element = $(element);
        try { element.offsetParent }
        catch(e) { return Element._returnOffset(0,0) }
        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);
        var offsetParent = element.getOffsetParent();
        if (offsetParent && offsetParent.getStyle('position') === 'fixed')
          offsetParent.setStyle({ zoom: 1 });
        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );
  });

  Element.Methods.cumulativeOffset = Element.Methods.cumulativeOffset.wrap(
    function(proceed, element) {
      try { element.offsetParent }
      catch(e) { return Element._returnOffset(0,0) }
      return proceed(element);
    }
  );

  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = {
    read: {
      names: {
        'class': 'className',
        'for':   'htmlFor'
      },
      values: {
        _getAttr: function(element, attribute) {
          return element.getAttribute(attribute, 2);
        },
        _getAttrNode: function(element, attribute) {
          var node = element.getAttributeNode(attribute);
          return node ? node.value : "";
        },
        _getEv: function(element, attribute) {
          attribute = element.getAttribute(attribute);
          return attribute ? attribute.toString().slice(23, -2) : null;
        },
        _flag: function(element, attribute) {
          return $(element).hasAttribute(attribute) ? attribute : null;
        },
        style: function(element) {
          return element.style.cssText.toLowerCase();
        },
        title: function(element) {
          return element.title;
        }
      }
    }
  };

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr,
      src:         v._getAttr,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);
}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if(element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };

  Element.Methods.cumulativeOffset = function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == document.body)
        if (Element.getStyle(element, 'position') == 'absolute') break;

      element = element.offsetParent;
    } while (element);

    return Element._returnOffset(valueL, valueT);
  };
}

if (Prototype.Browser.IE || Prototype.Browser.Opera) {
  Element.Methods.update = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) return element.update().insert(content);

    content = Object.toHTML(content);
    var tagName = element.tagName.toUpperCase();

    if (tagName in Element._insertionTranslations.tags) {
      $A(element.childNodes).each(function(node) { element.removeChild(node) });
      Element._getContentFromAnonymousElement(tagName, content.stripScripts())
        .each(function(node) { element.appendChild(node) });
    }
    else element.innerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

if ('outerHTML' in document.createElement('div')) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next();
      var fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html) {
  var div = new Element('div'), t = Element._insertionTranslations.tags[tagName];
  if (t) {
    div.innerHTML = t[0] + html + t[1];
    t[2].times(function() { div = div.firstChild });
  } else div.innerHTML = html;
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  Object.extend(this.tags, {
    THEAD: this.tags.TBODY,
    TFOOT: this.tags.TBODY,
    TH:    this.tags.TD
  });
}).call(Element._insertionTranslations);

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

if (!Prototype.BrowserFeatures.ElementExtensions &&
    document.createElement('div')['__proto__']) {
  window.HTMLElement = { };
  window.HTMLElement.prototype = document.createElement('div')['__proto__'];
  Prototype.BrowserFeatures.ElementExtensions = true;
}

Element.extend = (function() {
  if (Prototype.BrowserFeatures.SpecificElementExtensions)
    return Prototype.K;

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || element._extendedByPrototype ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
      tagName = element.tagName.toUpperCase(), property, value;

    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    for (property in methods) {
      value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

Element.hasAttribute = function(element, attribute) {
  if (element.hasAttribute) return element.hasAttribute(attribute);
  return Element.Methods.Simulated.hasAttribute(element, attribute);
};

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    window[klass] = { };
    window[klass].prototype = document.createElement(tagName)['__proto__'];
    return window[klass];
  }

  if (F.ElementExtensions) {
    copy(Element.Methods, HTMLElement.prototype);
    copy(Element.Methods.Simulated, HTMLElement.prototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};

document.viewport = {
  getDimensions: function() {
    var dimensions = { }, B = Prototype.Browser;
    $w('width height').each(function(d) {
      var D = d.capitalize();
      if (B.WebKit && !document.evaluate) {
        dimensions[d] = self['inner' + D];
      } else if (B.Opera && parseFloat(window.opera.version()) < 9.5) {
        dimensions[d] = document.body['client' + D]
      } else {
        dimensions[d] = document.documentElement['client' + D];
      }
    });
    return dimensions;
  },

  getWidth: function() {
    return this.getDimensions().width;
  },

  getHeight: function() {
    return this.getDimensions().height;
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop);
  }
};
/* Portions of the Selector class are derived from Jack Slocum's DomQuery,
 * part of YUI-Ext version 0.40, distributed under the terms of an MIT-style
 * license.  Please see http://www.yui-ext.com/ for more information. */

var Selector = Class.create({
  initialize: function(expression) {
    this.expression = expression.strip();

    if (this.shouldUseSelectorsAPI()) {
      this.mode = 'selectorsAPI';
    } else if (this.shouldUseXPath()) {
      this.mode = 'xpath';
      this.compileXPathMatcher();
    } else {
      this.mode = "normal";
      this.compileMatcher();
    }

  },

  shouldUseXPath: function() {
    if (!Prototype.BrowserFeatures.XPath) return false;

    var e = this.expression;

    if (Prototype.Browser.WebKit &&
     (e.include("-of-type") || e.include(":empty")))
      return false;

    if ((/(\[[\w-]*?:|:checked)/).test(e))
      return false;

    return true;
  },

  shouldUseSelectorsAPI: function() {
    if (!Prototype.BrowserFeatures.SelectorsAPI) return false;

    if (!Selector._div) Selector._div = new Element('div');

    try {
      Selector._div.querySelector(this.expression);
    } catch(e) {
      return false;
    }

    return true;
  },

  compileMatcher: function() {
    var e = this.expression, ps = Selector.patterns, h = Selector.handlers,
        c = Selector.criteria, le, p, m;

    if (Selector._cache[e]) {
      this.matcher = Selector._cache[e];
      return;
    }

    this.matcher = ["this.matcher = function(root) {",
                    "var r = root, h = Selector.handlers, c = false, n;"];

    while (e && le != e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        p = ps[i];
        if (m = e.match(p)) {
          this.matcher.push(Object.isFunction(c[i]) ? c[i](m) :
            new Template(c[i]).evaluate(m));
          e = e.replace(m[0], '');
          break;
        }
      }
    }

    this.matcher.push("return h.unique(n);\n}");
    eval(this.matcher.join('\n'));
    Selector._cache[this.expression] = this.matcher;
  },

  compileXPathMatcher: function() {
    var e = this.expression, ps = Selector.patterns,
        x = Selector.xpath, le, m;

    if (Selector._cache[e]) {
      this.xpath = Selector._cache[e]; return;
    }

    this.matcher = ['.//*'];
    while (e && le != e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        if (m = e.match(ps[i])) {
          this.matcher.push(Object.isFunction(x[i]) ? x[i](m) :
            new Template(x[i]).evaluate(m));
          e = e.replace(m[0], '');
          break;
        }
      }
    }

    this.xpath = this.matcher.join('');
    Selector._cache[this.expression] = this.xpath;
  },

  findElements: function(root) {
    root = root || document;
    var e = this.expression, results;

    switch (this.mode) {
      case 'selectorsAPI':
        if (root !== document) {
          var oldId = root.id, id = $(root).identify();
          e = "#" + id + " " + e;
        }

        results = $A(root.querySelectorAll(e)).map(Element.extend);
        root.id = oldId;

        return results;
      case 'xpath':
        return document._getElementsByXPath(this.xpath, root);
      default:
       return this.matcher(root);
    }
  },

  match: function(element) {
    this.tokens = [];

    var e = this.expression, ps = Selector.patterns, as = Selector.assertions;
    var le, p, m;

    while (e && le !== e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        p = ps[i];
        if (m = e.match(p)) {
          if (as[i]) {
            this.tokens.push([i, Object.clone(m)]);
            e = e.replace(m[0], '');
          } else {
            return this.findElements(document).include(element);
          }
        }
      }
    }

    var match = true, name, matches;
    for (var i = 0, token; token = this.tokens[i]; i++) {
      name = token[0], matches = token[1];
      if (!Selector.assertions[name](element, matches)) {
        match = false; break;
      }
    }

    return match;
  },

  toString: function() {
    return this.expression;
  },

  inspect: function() {
    return "#<Selector:" + this.expression.inspect() + ">";
  }
});

Object.extend(Selector, {
  _cache: { },

  xpath: {
    descendant:   "//*",
    child:        "/*",
    adjacent:     "/following-sibling::*[1]",
    laterSibling: '/following-sibling::*',
    tagName:      function(m) {
      if (m[1] == '*') return '';
      return "[local-name()='" + m[1].toLowerCase() +
             "' or local-name()='" + m[1].toUpperCase() + "']";
    },
    className:    "[contains(concat(' ', @class, ' '), ' #{1} ')]",
    id:           "[@id='#{1}']",
    attrPresence: function(m) {
      m[1] = m[1].toLowerCase();
      return new Template("[@#{1}]").evaluate(m);
    },
    attr: function(m) {
      m[1] = m[1].toLowerCase();
      m[3] = m[5] || m[6];
      return new Template(Selector.xpath.operators[m[2]]).evaluate(m);
    },
    pseudo: function(m) {
      var h = Selector.xpath.pseudos[m[1]];
      if (!h) return '';
      if (Object.isFunction(h)) return h(m);
      return new Template(Selector.xpath.pseudos[m[1]]).evaluate(m);
    },
    operators: {
      '=':  "[@#{1}='#{3}']",
      '!=': "[@#{1}!='#{3}']",
      '^=': "[starts-with(@#{1}, '#{3}')]",
      '$=': "[substring(@#{1}, (string-length(@#{1}) - string-length('#{3}') + 1))='#{3}']",
      '*=': "[contains(@#{1}, '#{3}')]",
      '~=': "[contains(concat(' ', @#{1}, ' '), ' #{3} ')]",
      '|=': "[contains(concat('-', @#{1}, '-'), '-#{3}-')]"
    },
    pseudos: {
      'first-child': '[not(preceding-sibling::*)]',
      'last-child':  '[not(following-sibling::*)]',
      'only-child':  '[not(preceding-sibling::* or following-sibling::*)]',
      'empty':       "[count(*) = 0 and (count(text()) = 0)]",
      'checked':     "[@checked]",
      'disabled':    "[(@disabled) and (@type!='hidden')]",
      'enabled':     "[not(@disabled) and (@type!='hidden')]",
      'not': function(m) {
        var e = m[6], p = Selector.patterns,
            x = Selector.xpath, le, v;

        var exclusion = [];
        while (e && le != e && (/\S/).test(e)) {
          le = e;
          for (var i in p) {
            if (m = e.match(p[i])) {
              v = Object.isFunction(x[i]) ? x[i](m) : new Template(x[i]).evaluate(m);
              exclusion.push("(" + v.substring(1, v.length - 1) + ")");
              e = e.replace(m[0], '');
              break;
            }
          }
        }
        return "[not(" + exclusion.join(" and ") + ")]";
      },
      'nth-child':      function(m) {
        return Selector.xpath.pseudos.nth("(count(./preceding-sibling::*) + 1) ", m);
      },
      'nth-last-child': function(m) {
        return Selector.xpath.pseudos.nth("(count(./following-sibling::*) + 1) ", m);
      },
      'nth-of-type':    function(m) {
        return Selector.xpath.pseudos.nth("position() ", m);
      },
      'nth-last-of-type': function(m) {
        return Selector.xpath.pseudos.nth("(last() + 1 - position()) ", m);
      },
      'first-of-type':  function(m) {
        m[6] = "1"; return Selector.xpath.pseudos['nth-of-type'](m);
      },
      'last-of-type':   function(m) {
        m[6] = "1"; return Selector.xpath.pseudos['nth-last-of-type'](m);
      },
      'only-of-type':   function(m) {
        var p = Selector.xpath.pseudos; return p['first-of-type'](m) + p['last-of-type'](m);
      },
      nth: function(fragment, m) {
        var mm, formula = m[6], predicate;
        if (formula == 'even') formula = '2n+0';
        if (formula == 'odd')  formula = '2n+1';
        if (mm = formula.match(/^(\d+)$/)) // digit only
          return '[' + fragment + "= " + mm[1] + ']';
        if (mm = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) { // an+b
          if (mm[1] == "-") mm[1] = -1;
          var a = mm[1] ? Number(mm[1]) : 1;
          var b = mm[2] ? Number(mm[2]) : 0;
          predicate = "[((#{fragment} - #{b}) mod #{a} = 0) and " +
          "((#{fragment} - #{b}) div #{a} >= 0)]";
          return new Template(predicate).evaluate({
            fragment: fragment, a: a, b: b });
        }
      }
    }
  },

  criteria: {
    tagName:      'n = h.tagName(n, r, "#{1}", c);      c = false;',
    className:    'n = h.className(n, r, "#{1}", c);    c = false;',
    id:           'n = h.id(n, r, "#{1}", c);           c = false;',
    attrPresence: 'n = h.attrPresence(n, r, "#{1}", c); c = false;',
    attr: function(m) {
      m[3] = (m[5] || m[6]);
      return new Template('n = h.attr(n, r, "#{1}", "#{3}", "#{2}", c); c = false;').evaluate(m);
    },
    pseudo: function(m) {
      if (m[6]) m[6] = m[6].replace(/"/g, '\\"');
      return new Template('n = h.pseudo(n, "#{1}", "#{6}", r, c); c = false;').evaluate(m);
    },
    descendant:   'c = "descendant";',
    child:        'c = "child";',
    adjacent:     'c = "adjacent";',
    laterSibling: 'c = "laterSibling";'
  },

  patterns: {
    laterSibling: /^\s*~\s*/,
    child:        /^\s*>\s*/,
    adjacent:     /^\s*\+\s*/,
    descendant:   /^\s/,

    tagName:      /^\s*(\*|[\w\-]+)(\b|$)?/,
    id:           /^#([\w\-\*]+)(\b|$)/,
    className:    /^\.([\w\-\*]+)(\b|$)/,
    pseudo:
/^:((first|last|nth|nth-last|only)(-child|-of-type)|empty|checked|(en|dis)abled|not)(\((.*?)\))?(\b|$|(?=\s|[:+~>]))/,
    attrPresence: /^\[((?:[\w]+:)?[\w]+)\]/,
    attr:         /\[((?:[\w-]*:)?[\w-]+)\s*(?:([!^$*~|]?=)\s*((['"])([^\4]*?)\4|([^'"][^\]]*?)))?\]/
  },

  assertions: {
    tagName: function(element, matches) {
      return matches[1].toUpperCase() == element.tagName.toUpperCase();
    },

    className: function(element, matches) {
      return Element.hasClassName(element, matches[1]);
    },

    id: function(element, matches) {
      return element.id === matches[1];
    },

    attrPresence: function(element, matches) {
      return Element.hasAttribute(element, matches[1]);
    },

    attr: function(element, matches) {
      var nodeValue = Element.readAttribute(element, matches[1]);
      return nodeValue && Selector.operators[matches[2]](nodeValue, matches[5] || matches[6]);
    }
  },

  handlers: {
    concat: function(a, b) {
      for (var i = 0, node; node = b[i]; i++)
        a.push(node);
      return a;
    },

    mark: function(nodes) {
      var _true = Prototype.emptyFunction;
      for (var i = 0, node; node = nodes[i]; i++)
        node._countedByPrototype = _true;
      return nodes;
    },

    unmark: function(nodes) {
      for (var i = 0, node; node = nodes[i]; i++)
        node._countedByPrototype = undefined;
      return nodes;
    },

    index: function(parentNode, reverse, ofType) {
      parentNode._countedByPrototype = Prototype.emptyFunction;
      if (reverse) {
        for (var nodes = parentNode.childNodes, i = nodes.length - 1, j = 1; i >= 0; i--) {
          var node = nodes[i];
          if (node.nodeType == 1 && (!ofType || node._countedByPrototype)) node.nodeIndex = j++;
        }
      } else {
        for (var i = 0, j = 1, nodes = parentNode.childNodes; node = nodes[i]; i++)
          if (node.nodeType == 1 && (!ofType || node._countedByPrototype)) node.nodeIndex = j++;
      }
    },

    unique: function(nodes) {
      if (nodes.length == 0) return nodes;
      var results = [], n;
      for (var i = 0, l = nodes.length; i < l; i++)
        if (!(n = nodes[i])._countedByPrototype) {
          n._countedByPrototype = Prototype.emptyFunction;
          results.push(Element.extend(n));
        }
      return Selector.handlers.unmark(results);
    },

    descendant: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        h.concat(results, node.getElementsByTagName('*'));
      return results;
    },

    child: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        for (var j = 0, child; child = node.childNodes[j]; j++)
          if (child.nodeType == 1 && child.tagName != '!') results.push(child);
      }
      return results;
    },

    adjacent: function(nodes) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        var next = this.nextElementSibling(node);
        if (next) results.push(next);
      }
      return results;
    },

    laterSibling: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        h.concat(results, Element.nextSiblings(node));
      return results;
    },

    nextElementSibling: function(node) {
      while (node = node.nextSibling)
        if (node.nodeType == 1) return node;
      return null;
    },

    previousElementSibling: function(node) {
      while (node = node.previousSibling)
        if (node.nodeType == 1) return node;
      return null;
    },

    tagName: function(nodes, root, tagName, combinator) {
      var uTagName = tagName.toUpperCase();
      var results = [], h = Selector.handlers;
      if (nodes) {
        if (combinator) {
          if (combinator == "descendant") {
            for (var i = 0, node; node = nodes[i]; i++)
              h.concat(results, node.getElementsByTagName(tagName));
            return results;
          } else nodes = this[combinator](nodes);
          if (tagName == "*") return nodes;
        }
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName.toUpperCase() === uTagName) results.push(node);
        return results;
      } else return root.getElementsByTagName(tagName);
    },

    id: function(nodes, root, id, combinator) {
      var targetNode = $(id), h = Selector.handlers;
      if (!targetNode) return [];
      if (!nodes && root == document) return [targetNode];
      if (nodes) {
        if (combinator) {
          if (combinator == 'child') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (targetNode.parentNode == node) return [targetNode];
          } else if (combinator == 'descendant') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (Element.descendantOf(targetNode, node)) return [targetNode];
          } else if (combinator == 'adjacent') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (Selector.handlers.previousElementSibling(targetNode) == node)
                return [targetNode];
          } else nodes = h[combinator](nodes);
        }
        for (var i = 0, node; node = nodes[i]; i++)
          if (node == targetNode) return [targetNode];
        return [];
      }
      return (targetNode && Element.descendantOf(targetNode, root)) ? [targetNode] : [];
    },

    className: function(nodes, root, className, combinator) {
      if (nodes && combinator) nodes = this[combinator](nodes);
      return Selector.handlers.byClassName(nodes, root, className);
    },

    byClassName: function(nodes, root, className) {
      if (!nodes) nodes = Selector.handlers.descendant([root]);
      var needle = ' ' + className + ' ';
      for (var i = 0, results = [], node, nodeClassName; node = nodes[i]; i++) {
        nodeClassName = node.className;
        if (nodeClassName.length == 0) continue;
        if (nodeClassName == className || (' ' + nodeClassName + ' ').include(needle))
          results.push(node);
      }
      return results;
    },

    attrPresence: function(nodes, root, attr, combinator) {
      if (!nodes) nodes = root.getElementsByTagName("*");
      if (nodes && combinator) nodes = this[combinator](nodes);
      var results = [];
      for (var i = 0, node; node = nodes[i]; i++)
        if (Element.hasAttribute(node, attr)) results.push(node);
      return results;
    },

    attr: function(nodes, root, attr, value, operator, combinator) {
      if (!nodes) nodes = root.getElementsByTagName("*");
      if (nodes && combinator) nodes = this[combinator](nodes);
      var handler = Selector.operators[operator], results = [];
      for (var i = 0, node; node = nodes[i]; i++) {
        var nodeValue = Element.readAttribute(node, attr);
        if (nodeValue === null) continue;
        if (handler(nodeValue, value)) results.push(node);
      }
      return results;
    },

    pseudo: function(nodes, name, value, root, combinator) {
      if (nodes && combinator) nodes = this[combinator](nodes);
      if (!nodes) nodes = root.getElementsByTagName("*");
      return Selector.pseudos[name](nodes, value, root);
    }
  },

  pseudos: {
    'first-child': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (Selector.handlers.previousElementSibling(node)) continue;
          results.push(node);
      }
      return results;
    },
    'last-child': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (Selector.handlers.nextElementSibling(node)) continue;
          results.push(node);
      }
      return results;
    },
    'only-child': function(nodes, value, root) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!h.previousElementSibling(node) && !h.nextElementSibling(node))
          results.push(node);
      return results;
    },
    'nth-child':        function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root);
    },
    'nth-last-child':   function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, true);
    },
    'nth-of-type':      function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, false, true);
    },
    'nth-last-of-type': function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, true, true);
    },
    'first-of-type':    function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, "1", root, false, true);
    },
    'last-of-type':     function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, "1", root, true, true);
    },
    'only-of-type':     function(nodes, formula, root) {
      var p = Selector.pseudos;
      return p['last-of-type'](p['first-of-type'](nodes, formula, root), formula, root);
    },

    getIndices: function(a, b, total) {
      if (a == 0) return b > 0 ? [b] : [];
      return $R(1, total).inject([], function(memo, i) {
        if (0 == (i - b) % a && (i - b) / a >= 0) memo.push(i);
        return memo;
      });
    },

    nth: function(nodes, formula, root, reverse, ofType) {
      if (nodes.length == 0) return [];
      if (formula == 'even') formula = '2n+0';
      if (formula == 'odd')  formula = '2n+1';
      var h = Selector.handlers, results = [], indexed = [], m;
      h.mark(nodes);
      for (var i = 0, node; node = nodes[i]; i++) {
        if (!node.parentNode._countedByPrototype) {
          h.index(node.parentNode, reverse, ofType);
          indexed.push(node.parentNode);
        }
      }
      if (formula.match(/^\d+$/)) { // just a number
        formula = Number(formula);
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.nodeIndex == formula) results.push(node);
      } else if (m = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) { // an+b
        if (m[1] == "-") m[1] = -1;
        var a = m[1] ? Number(m[1]) : 1;
        var b = m[2] ? Number(m[2]) : 0;
        var indices = Selector.pseudos.getIndices(a, b, nodes.length);
        for (var i = 0, node, l = indices.length; node = nodes[i]; i++) {
          for (var j = 0; j < l; j++)
            if (node.nodeIndex == indices[j]) results.push(node);
        }
      }
      h.unmark(nodes);
      h.unmark(indexed);
      return results;
    },

    'empty': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (node.tagName == '!' || node.firstChild) continue;
        results.push(node);
      }
      return results;
    },

    'not': function(nodes, selector, root) {
      var h = Selector.handlers, selectorType, m;
      var exclusions = new Selector(selector).findElements(root);
      h.mark(exclusions);
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!node._countedByPrototype) results.push(node);
      h.unmark(exclusions);
      return results;
    },

    'enabled': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!node.disabled && (!node.type || node.type !== 'hidden'))
          results.push(node);
      return results;
    },

    'disabled': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (node.disabled) results.push(node);
      return results;
    },

    'checked': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (node.checked) results.push(node);
      return results;
    }
  },

  operators: {
    '=':  function(nv, v) { return nv == v; },
    '!=': function(nv, v) { return nv != v; },
    '^=': function(nv, v) { return nv == v || nv && nv.startsWith(v); },
    '$=': function(nv, v) { return nv == v || nv && nv.endsWith(v); },
    '*=': function(nv, v) { return nv == v || nv && nv.include(v); },
    '$=': function(nv, v) { return nv.endsWith(v); },
    '*=': function(nv, v) { return nv.include(v); },
    '~=': function(nv, v) { return (' ' + nv + ' ').include(' ' + v + ' '); },
    '|=': function(nv, v) { return ('-' + (nv || "").toUpperCase() +
     '-').include('-' + (v || "").toUpperCase() + '-'); }
  },

  split: function(expression) {
    var expressions = [];
    expression.scan(/(([\w#:.~>+()\s-]+|\*|\[.*?\])+)\s*(,|$)/, function(m) {
      expressions.push(m[1].strip());
    });
    return expressions;
  },

  matchElements: function(elements, expression) {
    var matches = $$(expression), h = Selector.handlers;
    h.mark(matches);
    for (var i = 0, results = [], element; element = elements[i]; i++)
      if (element._countedByPrototype) results.push(element);
    h.unmark(matches);
    return results;
  },

  findElement: function(elements, expression, index) {
    if (Object.isNumber(expression)) {
      index = expression; expression = false;
    }
    return Selector.matchElements(elements, expression || '*')[index || 0];
  },

  findChildElements: function(element, expressions) {
    expressions = Selector.split(expressions.join(','));
    var results = [], h = Selector.handlers;
    for (var i = 0, l = expressions.length, selector; i < l; i++) {
      selector = new Selector(expressions[i].strip());
      h.concat(results, selector.findElements(element));
    }
    return (l > 1) ? h.unique(results) : results;
  }
});

if (Prototype.Browser.IE) {
  Object.extend(Selector.handlers, {
    concat: function(a, b) {
      for (var i = 0, node; node = b[i]; i++)
        if (node.tagName !== "!") a.push(node);
      return a;
    },

    unmark: function(nodes) {
      for (var i = 0, node; node = nodes[i]; i++)
        node.removeAttribute('_countedByPrototype');
      return nodes;
    }
  });
}

function $$() {
  return Selector.findChildElements(document, $A(arguments));
}
var Form = {
  reset: function(form) {
    $(form).reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit;

    var data = elements.inject({ }, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          if (key in result) {
            if (!Object.isArray(result[key])) result[key] = [result[key]];
            result[key].push(value);
          }
          else result[key] = value;
        }
      }
      return result;
    });

    return options.hash ? data : Object.toQueryString(data);
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    return $A($(form).getElementsByTagName('*')).inject([],
      function(elements, child) {
        if (Form.Element.Serializers[child.tagName.toLowerCase()])
          elements.push(Element.extend(child));
        return elements;
      }
    );
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return ['input', 'select', 'textarea'].include(element.tagName.toLowerCase());
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    form.findFirstElement().activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/

Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {
  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !['button', 'reset', 'submit'].include(element.type)))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;
var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = {
  input: function(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return Form.Element.Serializers.inputSelector(element, value);
      default:
        return Form.Element.Serializers.textarea(element, value);
    }
  },

  inputSelector: function(element, value) {
    if (Object.isUndefined(value)) return element.checked ? element.value : null;
    else element.checked = !!value;
  },

  textarea: function(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  },

  select: function(element, value) {
    if (Object.isUndefined(value))
      return this[element.type == 'select-one' ?
        'selectOne' : 'selectMany'](element);
    else {
      var opt, currentValue, single = !Object.isArray(value);
      for (var i = 0, length = element.length; i < length; i++) {
        opt = element.options[i];
        currentValue = this.optionValue(opt);
        if (single) {
          if (currentValue == value) {
            opt.selected = true;
            return;
          }
        }
        else opt.selected = value.include(currentValue);
      }
    }
  },

  selectOne: function(element) {
    var index = element.selectedIndex;
    return index >= 0 ? this.optionValue(element.options[index]) : null;
  },

  selectMany: function(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(this.optionValue(opt));
    }
    return values;
  },

  optionValue: function(opt) {
    return Element.extend(opt).hasAttribute('value') ? opt.value : opt.text;
  }
};

/*--------------------------------------------------------------------------*/

Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
if (!window.Event) var Event = { };

Object.extend(Event, {
  KEY_BACKSPACE: 8,
  KEY_TAB:       9,
  KEY_RETURN:   13,
  KEY_ESC:      27,
  KEY_LEFT:     37,
  KEY_UP:       38,
  KEY_RIGHT:    39,
  KEY_DOWN:     40,
  KEY_DELETE:   46,
  KEY_HOME:     36,
  KEY_END:      35,
  KEY_PAGEUP:   33,
  KEY_PAGEDOWN: 34,
  KEY_INSERT:   45,

  cache: { },

  relatedTarget: function(event) {
    var element;
    switch(event.type) {
      case 'mouseover': element = event.fromElement; break;
      case 'mouseout':  element = event.toElement;   break;
      default: return null;
    }
    return Element.extend(element);
  }
});

Event.Methods = (function() {
  var isButton;

  if (Prototype.Browser.IE) {
    var buttonMap = { 0: 1, 1: 4, 2: 2 };
    isButton = function(event, code) {
      return event.button == buttonMap[code];
    };

  } else if (Prototype.Browser.WebKit) {
    isButton = function(event, code) {
      switch (code) {
        case 0: return event.which == 1 && !event.metaKey;
        case 1: return event.which == 1 && event.metaKey;
        default: return false;
      }
    };

  } else {
    isButton = function(event, code) {
      return event.which ? (event.which === code + 1) : (event.button === code);
    };
  }

  return {
    isLeftClick:   function(event) { return isButton(event, 0) },
    isMiddleClick: function(event) { return isButton(event, 1) },
    isRightClick:  function(event) { return isButton(event, 2) },

    element: function(event) {
      event = Event.extend(event);

      var node          = event.target,
          type          = event.type,
          currentTarget = event.currentTarget;

      if (currentTarget && currentTarget.tagName) {
        if (type === 'load' || type === 'error' ||
          (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
            && currentTarget.type === 'radio'))
              node = currentTarget;
      }
      if (node.nodeType == Node.TEXT_NODE) node = node.parentNode;
      return Element.extend(node);
    },

    findElement: function(event, expression) {
      var element = Event.element(event);
      if (!expression) return element;
      var elements = [element].concat(element.ancestors());
      return Selector.findElement(elements, expression, 0);
    },

    pointer: function(event) {
      var docElement = document.documentElement,
      body = document.body || { scrollLeft: 0, scrollTop: 0 };
      return {
        x: event.pageX || (event.clientX +
          (docElement.scrollLeft || body.scrollLeft) -
          (docElement.clientLeft || 0)),
        y: event.pageY || (event.clientY +
          (docElement.scrollTop || body.scrollTop) -
          (docElement.clientTop || 0))
      };
    },

    pointerX: function(event) { return Event.pointer(event).x },
    pointerY: function(event) { return Event.pointer(event).y },

    stop: function(event) {
      Event.extend(event);
      event.preventDefault();
      event.stopPropagation();
      event.stopped = true;
    }
  };
})();

Event.extend = (function() {
  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (Prototype.Browser.IE) {
    Object.extend(methods, {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return "[object Event]" }
    });

    return function(event) {
      if (!event) return false;
      if (event._extendedByPrototype) return event;

      event._extendedByPrototype = Prototype.emptyFunction;
      var pointer = Event.pointer(event);
      Object.extend(event, {
        target: event.srcElement,
        relatedTarget: Event.relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });
      return Object.extend(event, methods);
    };

  } else {
    Event.prototype = Event.prototype || document.createEvent("HTMLEvents")['__proto__'];
    Object.extend(Event.prototype, methods);
    return Prototype.K;
  }
})();

Object.extend(Event, (function() {
  var cache = Event.cache;

  function getEventID(element) {
    if (element._prototypeEventID) return element._prototypeEventID[0];
    arguments.callee.id = arguments.callee.id || 1;
    return element._prototypeEventID = [++arguments.callee.id];
  }

  function getDOMEventName(eventName) {
    if (eventName && eventName.include(':')) return "dataavailable";
    return eventName;
  }

  function getCacheForID(id) {
    return cache[id] = cache[id] || { };
  }

  function getWrappersForEventName(id, eventName) {
    var c = getCacheForID(id);
    return c[eventName] = c[eventName] || [];
  }

  function createWrapper(element, eventName, handler) {
    var id = getEventID(element);
    var c = getWrappersForEventName(id, eventName);
    if (c.pluck("handler").include(handler)) return false;

    var wrapper = function(event) {
      if (!Event || !Event.extend ||
        (event.eventName && event.eventName != eventName))
          return false;

      Event.extend(event);
      handler.call(element, event);
    };

    wrapper.handler = handler;
    c.push(wrapper);
    return wrapper;
  }

  function findWrapper(id, eventName, handler) {
    var c = getWrappersForEventName(id, eventName);
    return c.find(function(wrapper) { return wrapper.handler == handler });
  }

  function destroyWrapper(id, eventName, handler) {
    var c = getCacheForID(id);
    if (!c[eventName]) return false;
    c[eventName] = c[eventName].without(findWrapper(id, eventName, handler));
  }

  function destroyCache() {
    for (var id in cache)
      for (var eventName in cache[id])
        cache[id][eventName] = null;
  }


  if (window.attachEvent) {
    window.attachEvent("onunload", destroyCache);
  }

  if (Prototype.Browser.WebKit) {
    window.addEventListener('unload', Prototype.emptyFunction, false);
  }

  return {
    observe: function(element, eventName, handler) {
      element = $(element);
      var name = getDOMEventName(eventName);

      var wrapper = createWrapper(element, eventName, handler);
      if (!wrapper) return element;

      if (element.addEventListener) {
        element.addEventListener(name, wrapper, false);
      } else {
        element.attachEvent("on" + name, wrapper);
      }

      return element;
    },

    stopObserving: function(element, eventName, handler) {
      element = $(element);
      var id = getEventID(element), name = getDOMEventName(eventName);

      if (!handler && eventName) {
        getWrappersForEventName(id, eventName).each(function(wrapper) {
          element.stopObserving(eventName, wrapper.handler);
        });
        return element;

      } else if (!eventName) {
        Object.keys(getCacheForID(id)).each(function(eventName) {
          element.stopObserving(eventName);
        });
        return element;
      }

      var wrapper = findWrapper(id, eventName, handler);
      if (!wrapper) return element;

      if (element.removeEventListener) {
        element.removeEventListener(name, wrapper, false);
      } else {
        element.detachEvent("on" + name, wrapper);
      }

      destroyWrapper(id, eventName, handler);

      return element;
    },

    fire: function(element, eventName, memo) {
      element = $(element);
      if (element == document && document.createEvent && !element.dispatchEvent)
        element = document.documentElement;

      var event;
      if (document.createEvent) {
        event = document.createEvent("HTMLEvents");
        event.initEvent("dataavailable", true, true);
      } else {
        event = document.createEventObject();
        event.eventType = "ondataavailable";
      }

      event.eventName = eventName;
      event.memo = memo || { };

      if (document.createEvent) {
        element.dispatchEvent(event);
      } else {
        element.fireEvent(event.eventType, event);
      }

      return Event.extend(event);
    }
  };
})());

Object.extend(Event, Event.Methods);

Element.addMethods({
  fire:          Event.fire,
  observe:       Event.observe,
  stopObserving: Event.stopObserving
});

Object.extend(document, {
  fire:          Element.Methods.fire.methodize(),
  observe:       Element.Methods.observe.methodize(),
  stopObserving: Element.Methods.stopObserving.methodize(),
  loaded:        false
});

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards and John Resig. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearInterval(timer);
    document.fire("dom:loaded");
    document.loaded = true;
  }

  if (document.addEventListener) {
    if (Prototype.Browser.WebKit) {
      timer = window.setInterval(function() {
        if (/loaded|complete/.test(document.readyState))
          fireContentLoadedEvent();
      }, 0);

      Event.observe(window, "load", fireContentLoadedEvent);

    } else {
      document.addEventListener("DOMContentLoaded",
        fireContentLoadedEvent, false);
    }

  } else {
    document.write("<script id=__onDOMContentLoaded defer src=//:><\/script>");
    $("__onDOMContentLoaded").onreadystatechange = function() {
      if (this.readyState == "complete") {
        this.onreadystatechange = null;
        fireContentLoadedEvent();
      }
    };
  }
})();
/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

var Position = {
  includeScrollOffsets: false,

  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },


  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

Element.addMethods();
/*
 * Raphael 0.8.6 - JavaScript Vector Library
 *
 * Copyright (c) 2008 - 2009 Dmitry Baranovskiy (http://raphaeljs.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */


window.Raphael=(function(){var v=/[, ]+/,F=document,l=window,o={was:"Raphael" in window,is:window.Raphael},E=function(){return K.apply(E,arguments);},B={},T={cx:0,cy:0,fill:"#fff","fill-opacity":1,font:'10px "Arial"',"font-family":'"Arial"',"font-size":"10","font-style":"normal","font-weight":400,gradient:0,height:0,href:"http://raphaeljs.com/",opacity:1,path:"M0,0",r:0,rotation:0,rx:0,ry:0,scale:"1 1",src:"",stroke:"#000","stroke-dasharray":"","stroke-linecap":"butt","stroke-linejoin":"butt","stroke-miterlimit":0,"stroke-opacity":1,"stroke-width":1,target:"_blank","text-anchor":"middle",title:"Raphael",translation:"0 0",width:0,x:0,y:0},V={cx:"number",cy:"number",fill:"colour","fill-opacity":"number","font-size":"number",height:"number",opacity:"number",path:"path",r:"number",rotation:"csv",rx:"number",ry:"number",scale:"csv",stroke:"colour","stroke-opacity":"number","stroke-width":"number",translation:"csv",width:"number",x:"number",y:"number"},W=["click","dblclick","mousedown","mousemove","mouseout","mouseover","mouseup"];E.version="0.8.6";E.type=(window.SVGAngle||document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure","1.1")?"SVG":"VML");E.svg=!(E.vml=E.type=="VML");E.idGenerator=0;E.fn={};E.isArray=function(R){return Object.prototype.toString.call(R)=="[object Array]";};E.setWindow=function(R){l=R;F=l.document;};E.hsb2rgb=function(AC,AA,AG){if(typeof AC=="object"&&"h" in AC&&"s" in AC&&"b" in AC){AG=AC.b;AA=AC.s;AC=AC.h;}var x,y,AH;if(AG==0){return{r:0,g:0,b:0,hex:"#000"};}if(AC>1||AA>1||AG>1){AC/=255;AA/=255;AG/=255;}var z=Math.floor(AC*6),AD=(AC*6)-z,w=AG*(1-AA),e=AG*(1-(AA*AD)),AI=AG*(1-(AA*(1-AD)));x=[AG,e,w,w,AI,AG,AG][z];y=[AI,AG,AG,e,w,w,AI][z];AH=[w,w,AI,AG,AG,e,w][z];x*=255;y*=255;AH*=255;var AE={r:x,g:y,b:AH},R=Math.round(x).toString(16),AB=Math.round(y).toString(16),AF=Math.round(AH).toString(16);if(R.length==1){R="0"+R;}if(AB.length==1){AB="0"+AB;}if(AF.length==1){AF="0"+AF;}AE.hex="#"+R+AB+AF;return AE;};E.rgb2hsb=function(R,e,AA){if(typeof R=="object"&&"r" in R&&"g" in R&&"b" in R){AA=R.b;e=R.g;R=R.r;}if(typeof R=="string"){var AC=E.getRGB(R);R=AC.r;e=AC.g;AA=AC.b;}if(R>1||e>1||AA>1){R/=255;e/=255;AA/=255;}var z=Math.max(R,e,AA),i=Math.min(R,e,AA),x,w,y=z;if(i==z){return{h:0,s:0,b:z};}else{var AB=(z-i);w=AB/z;if(R==z){x=(e-AA)/AB;}else{if(e==z){x=2+((AA-R)/AB);}else{x=4+((R-e)/AB);}}x/=6;if(x<0){x+=1;}if(x>1){x-=1;}}return{h:x,s:w,b:y};};var O={},m=[];E.getRGB=function(R){if(R in O){return O[R];}var AC={aliceblue:"#f0f8ff",amethyst:"#96c",antiquewhite:"#faebd7",aqua:"#0ff",aquamarine:"#7fffd4",azure:"#f0ffff",beige:"#f5f5dc",bisque:"#ffe4c4",black:"#000",blanchedalmond:"#ffebcd",blue:"#00f",blueviolet:"#8a2be2",brown:"#a52a2a",burlywood:"#deb887",cadetblue:"#5f9ea0",chartreuse:"#7fff00",chocolate:"#d2691e",coral:"#ff7f50",cornflowerblue:"#6495ed",cornsilk:"#fff8dc",crimson:"#dc143c",cyan:"#0ff",darkblue:"#00008b",darkcyan:"#008b8b",darkgoldenrod:"#b8860b",darkgray:"#a9a9a9",darkgreen:"#006400",darkkhaki:"#bdb76b",darkmagenta:"#8b008b",darkolivegreen:"#556b2f",darkorange:"#ff8c00",darkorchid:"#9932cc",darkred:"#8b0000",darksalmon:"#e9967a",darkseagreen:"#8fbc8f",darkslateblue:"#483d8b",darkslategray:"#2f4f4f",darkturquoise:"#00ced1",darkviolet:"#9400d3",deeppink:"#ff1493",deepskyblue:"#00bfff",dimgray:"#696969",dodgerblue:"#1e90ff",firebrick:"#b22222",floralwhite:"#fffaf0",forestgreen:"#228b22",fuchsia:"#f0f",gainsboro:"#dcdcdc",ghostwhite:"#f8f8ff",gold:"#ffd700",goldenrod:"#daa520",gray:"#808080",green:"#008000",greenyellow:"#adff2f",honeydew:"#f0fff0",hotpink:"#ff69b4",indianred:"#cd5c5c",indigo:"#4b0082",ivory:"#fffff0",khaki:"#f0e68c",lavender:"#e6e6fa",lavenderblush:"#fff0f5",lawngreen:"#7cfc00",lemonchiffon:"#fffacd",lightblue:"#add8e6",lightcoral:"#f08080",lightcyan:"#e0ffff",lightgoldenrodyellow:"#fafad2",lightgreen:"#90ee90",lightgrey:"#d3d3d3",lightpink:"#ffb6c1",lightsalmon:"#ffa07a",lightsalmon:"#ffa07a",lightseagreen:"#20b2aa",lightskyblue:"#87cefa",lightslategray:"#789",lightsteelblue:"#b0c4de",lightyellow:"#ffffe0",lime:"#0f0",limegreen:"#32cd32",linen:"#faf0e6",magenta:"#f0f",maroon:"#800000",mediumaquamarine:"#66cdaa",mediumblue:"#0000cd",mediumorchid:"#ba55d3",mediumpurple:"#9370db",mediumseagreen:"#3cb371",mediumslateblue:"#7b68ee",mediumslateblue:"#7b68ee",mediumspringgreen:"#00fa9a",mediumturquoise:"#48d1cc",mediumvioletred:"#c71585",midnightblue:"#191970",mintcream:"#f5fffa",mistyrose:"#ffe4e1",moccasin:"#ffe4b5",navajowhite:"#ffdead",navy:"#000080",oldlace:"#fdf5e6",olive:"#808000",olivedrab:"#6b8e23",orange:"#ffa500",orangered:"#ff4500",orchid:"#da70d6",palegoldenrod:"#eee8aa",palegreen:"#98fb98",paleturquoise:"#afeeee",palevioletred:"#db7093",papayawhip:"#ffefd5",peachpuff:"#ffdab9",peru:"#cd853f",pink:"#ffc0cb",plum:"#dda0dd",powderblue:"#b0e0e6",purple:"#800080",red:"#f00",rosybrown:"#bc8f8f",royalblue:"#4169e1",saddlebrown:"#8b4513",salmon:"#fa8072",sandybrown:"#f4a460",seagreen:"#2e8b57",seashell:"#fff5ee",sienna:"#a0522d",silver:"#c0c0c0",skyblue:"#87ceeb",slateblue:"#6a5acd",slategray:"#708090",snow:"#fffafa",springgreen:"#00ff7f",steelblue:"#4682b4",tan:"#d2b48c",teal:"#008080",thistle:"#d8bfd8",tomato:"#ff6347",turquoise:"#40e0d0",violet:"#ee82ee",wheat:"#f5deb3",white:"#fff",whitesmoke:"#f5f5f5",yellow:"#ff0",yellowgreen:"#9acd32"},y;if((R+"").toLowerCase() in AC){R=AC[R.toString().toLowerCase()];}if(!R){return{r:0,g:0,b:0,hex:"#000"};}if(R=="none"){return{r:-1,g:-1,b:-1,hex:"none"};}var i,w,AB,z=(R+"").match(/^\s*((#[a-f\d]{6})|(#[a-f\d]{3})|rgb\(\s*([\d\.]+\s*,\s*[\d\.]+\s*,\s*[\d\.]+)\s*\)|rgb\(\s*([\d\.]+%\s*,\s*[\d\.]+%\s*,\s*[\d\.]+%)\s*\)|hsb\(\s*([\d\.]+\s*,\s*[\d\.]+\s*,\s*[\d\.]+)\s*\)|hsb\(\s*([\d\.]+%\s*,\s*[\d\.]+%\s*,\s*[\d\.]+%)\s*\))\s*$/i);if(z){if(z[2]){AB=parseInt(z[2].substring(5),16);w=parseInt(z[2].substring(3,5),16);i=parseInt(z[2].substring(1,3),16);}if(z[3]){AB=parseInt(z[3].substring(3)+z[3].substring(3),16);w=parseInt(z[3].substring(2,3)+z[3].substring(2,3),16);i=parseInt(z[3].substring(1,2)+z[3].substring(1,2),16);}if(z[4]){z=z[4].split(/\s*,\s*/);i=parseFloat(z[0]);w=parseFloat(z[1]);AB=parseFloat(z[2]);}if(z[5]){z=z[5].split(/\s*,\s*/);i=parseFloat(z[0])*2.55;w=parseFloat(z[1])*2.55;AB=parseFloat(z[2])*2.55;}if(z[6]){z=z[6].split(/\s*,\s*/);i=parseFloat(z[0]);w=parseFloat(z[1]);AB=parseFloat(z[2]);return E.hsb2rgb(i,w,AB);}if(z[7]){z=z[7].split(/\s*,\s*/);i=parseFloat(z[0])*2.55;w=parseFloat(z[1])*2.55;AB=parseFloat(z[2])*2.55;return E.hsb2rgb(i,w,AB);}var z={r:i,g:w,b:AB},e=Math.round(i).toString(16),x=Math.round(w).toString(16),AA=Math.round(AB).toString(16);(e.length==1)&&(e="0"+e);(x.length==1)&&(x="0"+x);(AA.length==1)&&(AA="0"+AA);z.hex="#"+e+x+AA;y=z;}else{y={r:-1,g:-1,b:-1,hex:"none"};}if(m.length>20){delete O[m.unshift()];}m.push(R);O[R]=y;return y;};E.getColor=function(e){var i=this.getColor.start=this.getColor.start||{h:0,s:1,b:e||0.75},R=this.hsb2rgb(i.h,i.s,i.b);i.h+=0.075;if(i.h>1){i.h=0;i.s-=0.2;if(i.s<=0){this.getColor.start={h:0,s:1,b:i.b};}}return R.hex;};E.getColor.reset=function(){delete this.start;};var Y={},D=[];E.parsePathString=function(R){if(R in Y){return Y[R];}var w={a:7,c:6,h:1,l:2,m:2,q:4,s:4,t:2,v:1,z:0},e=[],i=function(){var y="";for(var x=0,z=this.length;x<z;x++){y+=this[x][0]+this[x].join(",").substring(2);}return y;};if(R.toString.toString()==i.toString()){e=R;}if(!e.length){R.replace(/([achlmqstvz])[\s,]*((-?\d*\.?\d*(?:e[-+]?\d+)?\s*,?\s*)+)/ig,function(y,x,AB){var AA=[],z=x.toLowerCase();AB.replace(/(-?\d*\.?\d*(?:e[-+]?\d+)?)\s*,?\s*/ig,function(AD,AC){AC&&AA.push(+AC);});while(AA.length>=w[z]){e.push([x].concat(AA.splice(0,w[z])));if(!w[z]){break;}}});e.toString=i;}if(D.length>20){delete Y[D.unshift()];}D.push(R);Y[R]=e;return e;};var a=function(AH){var R=AH;if(typeof AH=="string"){R=E.parsePathString(AH);}R=X(R);var AC=[],AB=[],e=0;for(var z=0,AG=R.length;z<AG;z++){var AD=R[z];switch(AD[0]){case"Z":break;case"A":AC.push(AD[AD.length-2]);AB.push(AD[AD.length-1]);break;default:for(var w=1,AA=AD.length;w<AA;w++){(w%2?AC:AB).push(AD[w]);}}}var AF=Math.min.apply(Math,AC),AE=Math.min.apply(Math,AB);if(!AC.length){return{x:0,y:0,width:0,height:0,X:0,Y:0};}else{return{x:AF,y:AE,width:Math.max.apply(Math,AC)-AF,height:Math.max.apply(Math,AB)-AE,X:AC,Y:AB};}},S=function(x,i){var w=0.5522*x,e=this.isAbsolute,z=this;if(e){this.relatively();e=function(){z.absolutely();};}else{e=function(){};}var y={l:function(){return{u:function(){z.curveTo(-w,0,-x,-(x-w),-x,-x);},d:function(){z.curveTo(-w,0,-x,x-w,-x,x);}};},r:function(){return{u:function(){z.curveTo(w,0,x,-(x-w),x,-x);},d:function(){z.curveTo(w,0,x,x-w,x,x);}};},u:function(){return{r:function(){z.curveTo(0,-w,-(w-x),-x,x,-x);},l:function(){z.curveTo(0,-w,w-x,-x,-x,-x);}};},d:function(){return{r:function(){z.curveTo(0,w,-(w-x),x,x,x);},l:function(){z.curveTo(0,w,w-x,x,-x,x);}};}};y[i.charAt(0)]()[i.charAt(1)]();e();return z;},C=function(z){var AF=[],AH=0,AG=0,w=0;if(typeof z=="string"){z=E.parsePathString(z);}if(z[0][0]=="M"){AH=z[0][1];AG=z[0][2];w++;AF.push(["M",AH,AG]);}for(var AC=w,AJ=z.length;AC<AJ;AC++){var R=AF[AC]=[],AI=z[AC];if(AI[0]!=AI[0].toLowerCase()){R[0]=AI[0].toLowerCase();switch(R[0]){case"a":R[1]=AI[1];R[2]=AI[2];R[3]=AI[3];R[4]=AI[4];R[5]=AI[5];R[6]=+(AI[6]-AH).toFixed(3);R[7]=+(AI[7]-AG).toFixed(3);break;case"v":R[1]=+(AI[1]-AG).toFixed(3);break;default:for(var AB=1,AD=AI.length;AB<AD;AB++){R[AB]=+(AI[AB]-((AB%2)?AH:AG)).toFixed(3);}}}else{R=AF[AC]=[];for(var AA=0,e=AI.length;AA<e;AA++){AF[AC][AA]=AI[AA];}}var AE=AF[AC].length;switch(AF[AC][0]){case"z":break;case"h":AH+=+AF[AC][AE-1];break;case"v":AG+=+AF[AC][AE-1];break;default:AH+=+AF[AC][AE-2];AG+=+AF[AC][AE-1];}}AF.toString=z.toString;return AF;},X=function(z){var AE=[];if(typeof z=="string"){z=E.parsePathString(z);}var AG=0,AF=0,w=0;if(z[0][0]=="M"){AG=+z[0][1];AF=+z[0][2];w++;AE[0]=["M",AG,AF];}for(var AC=w,AI=z.length;AC<AI;AC++){var R=AE[AC]=[],AH=z[AC];if(AH[0]!=(AH[0]+"").toUpperCase()){R[0]=(AH[0]+"").toUpperCase();switch(R[0]){case"A":R[1]=AH[1];R[2]=AH[2];R[3]=0;R[4]=AH[4];R[5]=AH[5];R[6]=+(AH[6]+AG).toFixed(3);R[7]=+(AH[7]+AF).toFixed(3);break;case"V":R[1]=+AH[1]+AF;break;case"H":R[1]=+AH[1]+AG;break;default:for(var AB=1,AD=AH.length;AB<AD;AB++){R[AB]=+AH[AB]+((AB%2)?AG:AF);}}}else{R=AE[AC]=[];for(var AA=0,e=AH.length;AA<e;AA++){AE[AC][AA]=AH[AA];}}switch(R[0]){case"Z":break;case"H":AG=R[1];break;case"V":AF=R[1];break;default:AG=AE[AC][AE[AC].length-2];AF=AE[AC][AE[AC].length-1];}}AE.toString=z.toString;return AE;},Z={},L=[],d=function(z,y){if((z+y) in Z){return Z[z+y];}var x=[X(E.parsePathString(z)),X(E.parsePathString(y))],e=[{x:0,y:0,bx:0,by:0,X:0,Y:0},{x:0,y:0,bx:0,by:0,X:0,Y:0}],R=function(AB,AC){if(!AB){return["U"];}switch(AB[0]){case"M":AC.X=AB[1];AC.Y=AB[2];break;case"S":var i=AC.x+(AC.x-(AC.bx||AC.x)),AD=AC.y+(AC.y-(AC.by||AC.y));AB=["C",i,AD,AB[1],AB[2],AB[3],AB[4]];break;case"T":var i=AC.x+(AC.x-(AC.bx||AC.x)),AD=AC.y+(AC.y-(AC.by||AC.y));AB=["Q",i,AD,AB[1],AB[2]];break;case"H":AB=["L",AB[1],AC.y];break;case"V":AB=["L",AC.x,AB[1]];break;case"Z":AB=["L",AC.X,AC.Y];break;}return AB;},AA=function(AD,AC,AF){if(x[AD][AF][0]=="M"&&x[AC][AF][0]!="M"){x[AC].splice(AF,0,["M",e[AC].x,e[AC].y]);e[AD].bx=x[AD][AF][x[AD][AF].length-4]||0;e[AD].by=x[AD][AF][x[AD][AF].length-3]||0;e[AD].x=x[AD][AF][x[AD][AF].length-2];e[AD].y=x[AD][AF][x[AD][AF].length-1];return true;}else{if(x[AD][AF][0]=="L"&&x[AC][AF][0]=="C"){x[AD][AF]=["C",e[AD].x,e[AD].y,x[AD][AF][1],x[AD][AF][2],x[AD][AF][1],x[AD][AF][2]];}else{if(x[AD][AF][0]=="L"&&x[AC][AF][0]=="Q"){x[AD][AF]=["Q",x[AD][AF][1],x[AD][AF][2],x[AD][AF][1],x[AD][AF][2]];}else{if(x[AD][AF][0]=="Q"&&x[AC][AF][0]=="C"){var AB=x[AC][AF][x[AC][AF].length-2],AH=x[AC][AF][x[AC][AF].length-1];x[AC].splice(AF+1,0,["Q",AB,AH,AB,AH]);x[AD].splice(AF,0,["C",e[AD].x,e[AD].y,e[AD].x,e[AD].y,e[AD].x,e[AD].y]);AF++;e[AC].bx=x[AC][AF][x[AC][AF].length-4]||0;e[AC].by=x[AC][AF][x[AC][AF].length-3]||0;e[AC].x=x[AC][AF][x[AC][AF].length-2];e[AC].y=x[AC][AF][x[AC][AF].length-1];return true;}else{if(x[AD][AF][0]=="A"&&x[AC][AF][0]=="C"){var AB=x[AC][AF][x[AC][AF].length-2],AH=x[AC][AF][x[AC][AF].length-1];x[AC].splice(AF+1,0,["A",0,0,x[AD][AF][3],x[AD][AF][4],x[AD][AF][5],AB,AH]);x[AD].splice(AF,0,["C",e[AD].x,e[AD].y,e[AD].x,e[AD].y,e[AD].x,e[AD].y]);AF++;e[AC].bx=x[AC][AF][x[AC][AF].length-4]||0;e[AC].by=x[AC][AF][x[AC][AF].length-3]||0;e[AC].x=x[AC][AF][x[AC][AF].length-2];e[AC].y=x[AC][AF][x[AC][AF].length-1];return true;}else{if(x[AD][AF][0]=="U"){x[AD][AF][0]=x[AC][AF][0];for(var AE=1,AG=x[AC][AF].length;AE<AG;AE++){x[AD][AF][AE]=(AE%2)?e[AD].x:e[AD].y;}}}}}}}return false;};for(var w=0;w<Math.max(x[0].length,x[1].length);w++){x[0][w]=R(x[0][w],e[0]);x[1][w]=R(x[1][w],e[1]);if(x[0][w][0]!=x[1][w][0]&&(AA(0,1,w)||AA(1,0,w))){continue;}e[0].bx=x[0][w][x[0][w].length-4]||0;e[0].by=x[0][w][x[0][w].length-3]||0;e[0].x=x[0][w][x[0][w].length-2];e[0].y=x[0][w][x[0][w].length-1];e[1].bx=x[1][w][x[1][w].length-4]||0;e[1].by=x[1][w][x[1][w].length-3]||0;e[1].x=x[1][w][x[1][w].length-2];e[1].y=x[1][w][x[1][w].length-1];}if(L.length>20){delete Z[L.unshift()];}L.push(z+y);Z[z+y]=x;return x;},N=function(AE){if(typeof AE=="string"){AE=AE.split(/\s*\-\s*/);var w=AE.shift();if(w.toLowerCase()=="v"){w=90;}else{if(w.toLowerCase()=="h"){w=0;}else{w=parseFloat(w);}}w=-w;var AC={angle:w,type:"linear",dots:[],vector:[0,0,Math.cos(w*Math.PI/180).toFixed(3),Math.sin(w*Math.PI/180).toFixed(3)]},AD=1/(Math.max(Math.abs(AC.vector[2]),Math.abs(AC.vector[3]))||1);AC.vector[2]*=AD;AC.vector[3]*=AD;if(AC.vector[2]<0){AC.vector[0]=-AC.vector[2];AC.vector[2]=0;}if(AC.vector[3]<0){AC.vector[1]=-AC.vector[3];AC.vector[3]=0;}AC.vector[0]=AC.vector[0].toFixed(3);AC.vector[1]=AC.vector[1].toFixed(3);AC.vector[2]=AC.vector[2].toFixed(3);AC.vector[3]=AC.vector[3].toFixed(3);for(var z=0,AF=AE.length;z<AF;z++){var R={},AB=AE[z].match(/^([^:]*):?([\d\.]*)/);R.color=E.getRGB(AB[1]).hex;AB[2]&&(R.offset=AB[2]+"%");AC.dots.push(R);}for(var z=1,AF=AC.dots.length-1;z<AF;z++){if(!AC.dots[z].offset){var e=parseFloat(AC.dots[z-1].offset||0),x=false;for(var y=z+1;y<AF;y++){if(AC.dots[y].offset){x=AC.dots[y].offset;break;}}if(!x){x=100;y=AF;}x=parseFloat(x);var AA=(x-e)/(y-z+1);for(;z<y;z++){e+=AA;AC.dots[z].offset=e+"%";}}}return AC;}else{return AE;}},g=function(){var i,e,z,w,R;if(typeof arguments[0]=="string"||typeof arguments[0]=="object"){if(typeof arguments[0]=="string"){i=F.getElementById(arguments[0]);}else{i=arguments[0];}if(i.tagName){if(arguments[1]==null){return{container:i,width:i.style.pixelWidth||i.offsetWidth,height:i.style.pixelHeight||i.offsetHeight};}else{return{container:i,width:arguments[1],height:arguments[2]};}}}else{if(typeof arguments[0]=="number"&&arguments.length>3){return{container:1,x:arguments[0],y:arguments[1],width:arguments[2],height:arguments[3]};}}},A=function(R,i){var e=this;for(var w in i){if(i.hasOwnProperty(w)&&!(w in R)){switch(typeof i[w]){case"function":(function(x){R[w]=R===e?x:function(){return x.apply(e,arguments);};})(i[w]);break;case"object":R[w]=R[w]||{};A.call(this,R[w],i[w]);break;default:R[w]=i[w];break;}}}};if(E.svg){E.toString=function(){return"Your browser supports SVG.\nYou are running Rapha\u00ebl "+this.version;};var H={absolutely:function(){this.isAbsolute=true;return this;},relatively:function(){this.isAbsolute=false;return this;},moveTo:function(R,w){var i=this.isAbsolute?"M":"m";i+=parseFloat(R).toFixed(3)+" "+parseFloat(w).toFixed(3)+" ";var e=this[0].getAttribute("d")||"";(e=="M0,0")&&(e="");this[0].setAttribute("d",e+i);this.last.x=(this.isAbsolute?0:this.last.x)+parseFloat(R);this.last.y=(this.isAbsolute?0:this.last.y)+parseFloat(w);this.attrs.path=e+i;return this;},lineTo:function(R,w){this.last.x=(!this.isAbsolute*this.last.x)+parseFloat(R);this.last.y=(!this.isAbsolute*this.last.y)+parseFloat(w);var i=this.isAbsolute?"L":"l";i+=parseFloat(R).toFixed(3)+" "+parseFloat(w).toFixed(3)+" ";var e=this.node.getAttribute("d")||"";this.node.setAttribute("d",e+i);this.attrs.path=e+i;return this;},arcTo:function(AA,z,e,w,R,AC){var AB=this.isAbsolute?"A":"a";AB+=[parseFloat(AA).toFixed(3),parseFloat(z).toFixed(3),0,e,w,parseFloat(R).toFixed(3),parseFloat(AC).toFixed(3)].join(" ");var i=this[0].getAttribute("d")||"";this.node.setAttribute("d",i+AB);this.last.x=parseFloat(R);this.last.y=parseFloat(AC);this.attrs.path=i+AB;return this;},cplineTo:function(e,AF,AA){if(!AA){return this.lineTo(e,AF);}else{var R={},AG=parseFloat(e),AD=parseFloat(AF),AH=parseFloat(AA),AC=this.isAbsolute?"C":"c",AB=[+this.last.x+AH,+this.last.y,AG-AH,AD,AG,AD];for(var z=0,AI=AB.length;z<AI;z++){AC+=AB[z]+" ";}this.last.x=(this.isAbsolute?0:this.last.x)+AB[4];this.last.y=(this.isAbsolute?0:this.last.y)+AB[5];this.last.bx=AB[2];this.last.by=AB[3];var AE=this.node.getAttribute("d")||"";this.node.setAttribute("d",AE+AC);this.attrs.path=AE+AC;return this;}},curveTo:function(){var x={},y=[0,1,2,3,"s",5,"c"][arguments.length];if(this.isAbsolute){y=y.toUpperCase();}for(var e=0,w=arguments.length;e<w;e++){y+=parseFloat(arguments[e]).toFixed(3)+" ";}this.last.x=(this.isAbsolute?0:this.last.x)+parseFloat(arguments[arguments.length-2]);this.last.y=(this.isAbsolute?0:this.last.y)+parseFloat(arguments[arguments.length-1]);this.last.bx=parseFloat(arguments[arguments.length-4]);this.last.by=parseFloat(arguments[arguments.length-3]);var R=this.node.getAttribute("d")||"";this.node.setAttribute("d",R+y);this.attrs.path=R+y;return this;},qcurveTo:function(){var x={},y=[0,1,"t",3,"q"][arguments.length];if(this.isAbsolute){y=y.toUpperCase();}for(var e=0,w=arguments.length;e<w;e++){y+=parseFloat(arguments[e]).toFixed(3)+" ";}this.last.x=(this.isAbsolute?0:this.last.x)+parseFloat(arguments[arguments.length-2]);this.last.y=(this.isAbsolute?0:this.last.y)+parseFloat(arguments[arguments.length-1]);if(arguments.length!=2){this.last.qx=parseFloat(arguments[arguments.length-4]);this.last.qy=parseFloat(arguments[arguments.length-3]);}var R=this.node.getAttribute("d")||"";this.node.setAttribute("d",R+y);this.attrs.path=R+y;return this;},addRoundedCorner:S,andClose:function(){var R=this[0].getAttribute("d")||"";this[0].setAttribute("d",R+"Z ");this.attrs.path=R+"Z ";return this;}};var u=function(w,R,y){w=w||{};var e=F.createElementNS(y.svgns,"path");if(y.canvas){y.canvas.appendChild(e);}var i=new M(e,y);i.isAbsolute=true;for(var x in H){i[x]=H[x];}i.type="path";i.last={x:0,y:0,bx:0,by:0};if(R){i.attrs.path=""+R;i.absolutely();B.pathfinder(i,i.attrs.path);}if(w){!w.gradient&&(w.fill=w.fill||"none");w.stroke=w.stroke||"#000";}else{w={fill:"none",stroke:"#000"};}f(i,w);return i;};var n=function(AA,y,AB){y=N(y);var x=F.createElementNS(AB.svgns,(y.type||"linear")+"Gradient");x.id="raphael-gradient-"+E.idGenerator++;if(y.vector&&y.vector.length){x.setAttribute("x1",y.vector[0]);x.setAttribute("y1",y.vector[1]);x.setAttribute("x2",y.vector[2]);x.setAttribute("y2",y.vector[3]);}AB.defs.appendChild(x);var z=true;for(var e=0,w=y.dots.length;e<w;e++){var R=F.createElementNS(AB.svgns,"stop");if(y.dots[e].offset){z=false;}R.setAttribute("offset",y.dots[e].offset?y.dots[e].offset:(e==0)?"0%":"100%");R.setAttribute("stop-color",E.getRGB(y.dots[e].color).hex||"#fff");x.appendChild(R);}if(z&&typeof y.dots[w-1].opacity!="undefined"){R.setAttribute("stop-opacity",y.dots[w-1].opacity);}AA.setAttribute("fill","url(#"+x.id+")");AA.style.fill="";AA.style.opacity=1;AA.style.fillOpacity=1;AA.setAttribute("opacity",1);AA.setAttribute("fill-opacity",1);};var U=function(e){if(e.pattern){var R=e.getBBox();e.pattern.setAttribute("patternTransform","translate(".concat(R.x,",",R.y,")"));}};var f=function(AD,AK){var AG={"":[0],none:[0],"-":[3,1],".":[1,1],"-.":[3,1,1,1],"-..":[3,1,1,1,1,1],". ":[1,3],"- ":[4,3],"--":[8,3],"- .":[4,3,1,3],"--.":[8,3,1,3],"--..":[8,3,1,3,1,3]},AI=AD.node,AE=AD.attrs,AA=AE.rotation,x=function(AS,AR){AR=AG[AR.toString().toLowerCase()];if(AR){var AP=AS.attrs["stroke-width"]||"1",AM={round:AP,square:AP,butt:0}[AS.attrs["stroke-linecap"]||AK["stroke-linecap"]]||0,AQ=[];for(var AN=0,AO=AR.length;AN<AO;AN++){AQ.push(AR[AN]*AP+((AN%2)?1:-1)*AM);}AR=AQ.join(",");AI.setAttribute("stroke-dasharray",AR);}};AD.rotate(0,true);for(var AH in AK){if(!(AH in T)){continue;}var AF=AK[AH];AE[AH]=AF;switch(AH){case"href":case"title":case"target":var AJ=AI.parentNode;if(AJ.tagName.toLowerCase()!="a"){var i=F.createElementNS(AD.paper.svgns,"a");AJ.insertBefore(i,AI);i.appendChild(AI);AJ=i;}AJ.setAttributeNS(AD.paper.xlink,AH,AF);break;case"path":if(AD.type=="path"){AI.setAttribute("d","M0,0");B.pathfinder(AD,AF);}case"width":AI.setAttribute(AH,AF);if(AE.fx){AH="x";AF=AE.x;}else{break;}case"x":if(AE.fx){AF=-AE.x-(AE.width||0);}case"rx":case"cx":AI.setAttribute(AH,AF);U(AD);break;case"height":AI.setAttribute(AH,AF);if(AE.fy){AH="y";AF=AE.y;}else{break;}case"y":if(AE.fy){AF=-AE.y-(AE.height||0);}case"ry":case"cy":AI.setAttribute(AH,AF);U(AD);break;case"r":if(AD.type=="rect"){AI.setAttribute("rx",AF);AI.setAttribute("ry",AF);}else{AI.setAttribute(AH,AF);}break;case"src":if(AD.type=="image"){AI.setAttributeNS(AD.paper.xlink,"href",AF);}break;case"stroke-width":AI.style.strokeWidth=AF;AI.setAttribute(AH,AF);if(AE["stroke-dasharray"]){x(AD,AE["stroke-dasharray"]);}break;case"stroke-dasharray":x(AD,AF);break;case"rotation":AD.rotate(AF,true);break;case"translation":var y=(AF+"").split(v);AD.translate((+y[0]+1||2)-1,(+y[1]+1||2)-1);break;case"scale":var y=(AF+"").split(v);AD.scale(+y[0]||1,+y[1]||+y[0]||1,+y[2]||null,+y[3]||null);break;case"fill":var w=(AF+"").match(/^url\(([^\)]+)\)$/i);if(w){var e=F.createElementNS(AD.paper.svgns,"pattern"),AC=F.createElementNS(AD.paper.svgns,"image");e.id="raphael-pattern-"+E.idGenerator++;e.setAttribute("x",0);e.setAttribute("y",0);e.setAttribute("patternUnits","userSpaceOnUse");AC.setAttribute("x",0);AC.setAttribute("y",0);AC.setAttributeNS(AD.paper.xlink,"href",w[1]);e.appendChild(AC);var AL=F.createElement("img");AL.style.position="absolute";AL.style.top="-9999em";AL.style.left="-9999em";AL.onload=function(){e.setAttribute("width",this.offsetWidth);e.setAttribute("height",this.offsetHeight);AC.setAttribute("width",this.offsetWidth);AC.setAttribute("height",this.offsetHeight);F.body.removeChild(this);B.safari();};F.body.appendChild(AL);AL.src=w[1];AD.paper.defs.appendChild(e);AI.style.fill="url(#"+e.id+")";AI.setAttribute("fill","url(#"+e.id+")");AD.pattern=e;U(AD);break;}delete AK.gradient;delete AE.gradient;if(typeof AE.opacity!="undefined"&&typeof AK.opacity=="undefined"){AI.style.opacity=AE.opacity;AI.setAttribute("opacity",AE.opacity);}if(typeof AE["fill-opacity"]!="undefined"&&typeof AK["fill-opacity"]=="undefined"){AI.style.fillOpacity=AD.attrs["fill-opacity"];AI.setAttribute("fill-opacity",AE["fill-opacity"]);}case"stroke":AI.style[AH]=E.getRGB(AF).hex;AI.setAttribute(AH,E.getRGB(AF).hex);break;case"gradient":n(AI,AF,AD.paper);break;case"opacity":case"fill-opacity":if(AE.gradient){var R=F.getElementById(AI.getAttribute("fill").replace(/^url\(#|\)$/g,""));if(R){var z=R.getElementsByTagName("stop");z[z.length-1].setAttribute("stop-opacity",AF);}break;}default:var AB=AH.replace(/(\-.)/g,function(AM){return AM.substring(1).toUpperCase();});AI.style[AB]=AF;AI.setAttribute(AH,AF);break;}}r(AD,AK);AD.rotate(AE.rotation,true);};var k=1.2;var r=function(R,x){if(R.type!="text"||!("text" in x||"font" in x||"font-size" in x||"x" in x||"y" in x)){return ;}var AC=R.attrs,e=R.node,AE=e.firstChild?parseInt(F.defaultView.getComputedStyle(e.firstChild,"").getPropertyValue("font-size"),10):10;if("text" in x){while(e.firstChild){e.removeChild(e.firstChild);}var w=(x.text+"").split("\n");for(var y=0,AD=w.length;y<AD;y++){var AA=F.createElementNS(R.paper.svgns,"tspan");y&&AA.setAttribute("dy",AE*k);y&&AA.setAttribute("x",AC.x);AA.appendChild(F.createTextNode(w[y]));e.appendChild(AA);}}else{var w=e.getElementsByTagName("tspan");for(var y=0,AD=w.length;y<AD;y++){y&&w[y].setAttribute("dy",AE*k);y&&w[y].setAttribute("x",AC.x);}}e.setAttribute("y",AC.y);var z=R.getBBox(),AB=AC.y-(z.y+z.height/2);AB&&e.setAttribute("y",AC.y+AB);};var M=function(e,R){var w=0,i=0;this[0]=e;this.node=e;this.paper=R;this.attrs=this.attrs||{};this.transformations=[];this._={tx:0,ty:0,rt:{deg:0,x:0,y:0},sx:1,sy:1};};M.prototype.rotate=function(e,R,w){if(e==null){return this._.rt.deg;}var i=this.getBBox();e=e.toString().split(v);if(e.length-1){R=parseFloat(e[1]);w=parseFloat(e[2]);}e=parseFloat(e[0]);if(R!=null){this._.rt.deg=e;}else{this._.rt.deg+=e;}if(w==null){R=null;}R=R==null?i.x+i.width/2:R;w=w==null?i.y+i.height/2:w;if(this._.rt.deg){this.transformations[0]=("rotate("+this._.rt.deg+" "+R+" "+w+")");}else{this.transformations[0]="";}this.node.setAttribute("transform",this.transformations.join(" "));return this;};M.prototype.hide=function(){this.node.style.display="none";return this;};M.prototype.show=function(){this.node.style.display="block";return this;};M.prototype.remove=function(){this.node.parentNode.removeChild(this.node);};M.prototype.getBBox=function(){if(this.node.style.display=="none"){this.show();var w=true;}var AA={};try{AA=this.node.getBBox();}catch(y){}finally{AA=AA||{};}if(this.type=="text"){AA={x:AA.x,y:Infinity,width:AA.width,height:0};for(var R=0,x=this.node.getNumberOfChars();R<x;R++){var z=this.node.getExtentOfChar(R);(z.y<AA.y)&&(AA.y=z.y);(z.y+z.height-AA.y>AA.height)&&(AA.height=z.y+z.height-AA.y);}}w&&this.hide();return AA;};M.prototype.attr=function(){if(arguments.length==1&&typeof arguments[0]=="string"){if(arguments[0]=="translation"){return this.translate();}return this.attrs[arguments[0]];}if(arguments.length==1&&E.isArray(arguments[0])){var R={};for(var e in arguments[0]){R[arguments[0][e]]=this.attrs[arguments[0][e]];}return R;}if(arguments.length==2){var i={};i[arguments[0]]=arguments[1];f(this,i);}else{if(arguments.length==1&&typeof arguments[0]=="object"){f(this,arguments[0]);}}return this;};M.prototype.toFront=function(){this.node.parentNode.appendChild(this.node);return this;};M.prototype.toBack=function(){if(this.node.parentNode.firstChild!=this.node){this.node.parentNode.insertBefore(this.node,this.node.parentNode.firstChild);}return this;};M.prototype.insertAfter=function(R){if(R.node.nextSibling){R.node.parentNode.insertBefore(this.node,R.node.nextSibling);}else{R.node.parentNode.appendChild(this.node);}return this;};M.prototype.insertBefore=function(R){var e=R.node;e.parentNode.insertBefore(this.node,e);return this;};var b=function(e,R,AA,z){var w=F.createElementNS(e.svgns,"circle");w.setAttribute("cx",R);w.setAttribute("cy",AA);w.setAttribute("r",z);w.setAttribute("fill","none");w.setAttribute("stroke","#000");if(e.canvas){e.canvas.appendChild(w);}var i=new M(w,e);i.attrs=i.attrs||{};i.attrs.cx=R;i.attrs.cy=AA;i.attrs.r=z;i.attrs.stroke="#000";i.type="circle";return i;};var j=function(i,R,AD,e,AB,AC){var AA=F.createElementNS(i.svgns,"rect");AA.setAttribute("x",R);AA.setAttribute("y",AD);AA.setAttribute("width",e);AA.setAttribute("height",AB);if(AC){AA.setAttribute("rx",AC);AA.setAttribute("ry",AC);}AA.setAttribute("fill","none");AA.setAttribute("stroke","#000");if(i.canvas){i.canvas.appendChild(AA);}var z=new M(AA,i);z.attrs=z.attrs||{};z.attrs.x=R;z.attrs.y=AD;z.attrs.width=e;z.attrs.height=AB;z.attrs.stroke="#000";if(AC){z.attrs.rx=z.attrs.ry=AC;}z.type="rect";return z;};var G=function(e,R,AB,AA,z){var w=F.createElementNS(e.svgns,"ellipse");w.setAttribute("cx",R);w.setAttribute("cy",AB);w.setAttribute("rx",AA);w.setAttribute("ry",z);w.setAttribute("fill","none");w.setAttribute("stroke","#000");if(e.canvas){e.canvas.appendChild(w);}var i=new M(w,e);i.attrs=i.attrs||{};i.attrs.cx=R;i.attrs.cy=AB;i.attrs.rx=AA;i.attrs.ry=z;i.attrs.stroke="#000";i.type="ellipse";return i;};var Q=function(i,AC,R,AD,e,AB){var AA=F.createElementNS(i.svgns,"image");AA.setAttribute("x",R);AA.setAttribute("y",AD);AA.setAttribute("width",e);AA.setAttribute("height",AB);AA.setAttribute("preserveAspectRatio","none");AA.setAttributeNS(i.xlink,"href",AC);if(i.canvas){i.canvas.appendChild(AA);}var z=new M(AA,i);z.attrs=z.attrs||{};z.attrs.x=R;z.attrs.y=AD;z.attrs.width=e;z.attrs.height=AB;z.type="image";return z;};var h=function(e,R,AA,z){var w=F.createElementNS(e.svgns,"text");w.setAttribute("x",R);w.setAttribute("y",AA);w.setAttribute("text-anchor","middle");if(e.canvas){e.canvas.appendChild(w);}var i=new M(w,e);i.attrs=i.attrs||{};i.attrs.x=R;i.attrs.y=AA;i.type="text";f(i,{font:T.font,stroke:"none",fill:"#000",text:z});return i;};var c=function(e,R){this.width=e||this.width;this.height=R||this.height;this.canvas.setAttribute("width",this.width);this.canvas.setAttribute("height",this.height);return this;};var K=function(){var w=g.apply(null,arguments),i=w.container,e=w.x,AB=w.y,z=w.width,R=w.height;if(!i){throw new Error("SVG container not found.");}B.canvas=F.createElementNS(B.svgns,"svg");B.canvas.setAttribute("width",z||512);B.width=z||512;B.canvas.setAttribute("height",R||342);B.height=R||342;if(i==1){F.body.appendChild(B.canvas);B.canvas.style.position="absolute";B.canvas.style.left=e+"px";B.canvas.style.top=AB+"px";}else{if(i.firstChild){i.insertBefore(B.canvas,i.firstChild);}else{i.appendChild(B.canvas);}}i={canvas:B.canvas,clear:function(){while(this.canvas.firstChild){this.canvas.removeChild(this.canvas.firstChild);}this.defs=F.createElementNS(B.svgns,"defs");this.canvas.appendChild(this.defs);}};for(var AA in B){if(AA!="create"){i[AA]=B[AA];}}A.call(i,i,E.fn);i.clear();i.raphael=E;return i;};B.remove=function(){this.canvas.parentNode.removeChild(this.canvas);};B.svgns="http://www.w3.org/2000/svg";B.xlink="http://www.w3.org/1999/xlink";B.safari=function(){if({"Apple Computer, Inc.":1,"Google Inc.":1}[navigator.vendor]){var R=this.rect(-this.width,-this.height,this.width*3,this.height*3).attr({stroke:"none"});setTimeout(function(){R.remove();});}};}if(E.vml){E.toString=function(){return"Your browser doesn\u2019t support SVG. Assuming it is Internet Explorer and falling down to VML.\nYou are running Rapha\u00ebl "+this.version;};var H={absolutely:function(){this.isAbsolute=true;return this;},relatively:function(){this.isAbsolute=false;return this;},moveTo:function(R,z){var w=Math.round(parseFloat(R))-1,i=Math.round(parseFloat(z))-1,e=this.isAbsolute?"m":"t";e+=w+" "+i;this.node.path=this.Path+=e;this.last.x=(this.isAbsolute?0:this.last.x)+parseFloat(R);this.last.y=(this.isAbsolute?0:this.last.y)+parseFloat(z);this.last.isAbsolute=this.isAbsolute;this.attrs.path+=(this.isAbsolute?"M":"m")+[R,z];return this;},lineTo:function(R,z){var w=Math.round(parseFloat(R))-1,i=Math.round(parseFloat(z))-1,e=this.isAbsolute?"l":"r";e+=w+" "+i;this.node.path=this.Path+=e;this.last.x=(this.isAbsolute?0:this.last.x)+parseFloat(R);this.last.y=(this.isAbsolute?0:this.last.y)+parseFloat(z);this.last.isAbsolute=this.isAbsolute;this.attrs.path+=(this.isAbsolute?"L":"l")+[R,z];return this;},arcTo:function(AB,AA,AD,AK,AI,R){var AC=(this.isAbsolute?0:this.last.x)+parseFloat(AI)-1,AM=(this.isAbsolute?0:this.last.y)+parseFloat(R)-1,AJ=this.last.x-1,i=this.last.y-1,AF=(AJ-AC)/2,AE=(i-AM)/2,AH=(AD==AK?-1:1)*Math.sqrt(Math.abs(AB*AB*AA*AA-AB*AB*AE*AE-AA*AA*AF*AF)/(AB*AB*AE*AE+AA*AA*AF*AF)),w=AH*AB*AE/AA+(AJ+AC)/2,e=AH*-AA*AF/AB+(i+AM)/2,AL=AK?(this.isAbsolute?"wa":"wr"):(this.isAbsolute?"at":"ar"),z=Math.round(w-AB),AG=Math.round(e-AA);AL+=[z,AG,Math.round(z+AB*2),Math.round(AG+AA*2),Math.round(AJ),Math.round(i),Math.round(AC),Math.round(AM)].join(", ");this.node.path=this.Path+=AL;this.last.x=(this.isAbsolute?0:this.last.x)+AI;this.last.y=(this.isAbsolute?0:this.last.y)+R;this.last.isAbsolute=this.isAbsolute;this.attrs.path+=(this.isAbsolute?"A":"a")+[AB,AA,0,AD,AK,AI,R];return this;},cplineTo:function(R,AC,i){if(!i){return this.lineTo(R,AC);}else{var AD=Math.round(parseFloat(R))-1,AB=Math.round(parseFloat(AC))-1,AE=Math.round(parseFloat(i)),AA=this.isAbsolute?"c":"v",z=[Math.round(this.last.x)-1+AE,Math.round(this.last.y)-1,AD-AE,AB,AD,AB],e=[this.last.x+i,this.last.y,R-i,AC,R,AC];AA+=z.join(" ")+" ";this.last.x=(this.isAbsolute?0:this.last.x)+z[4];this.last.y=(this.isAbsolute?0:this.last.y)+z[5];this.last.bx=z[2];this.last.by=z[3];this.node.path=this.Path+=AA;this.attrs.path+=(this.isAbsolute?"C":"c")+e;return this;}},curveTo:function(){var i=this.isAbsolute?"c":"v";if(arguments.length==6){this.last.bx=(this.isAbsolute?0:this.last.x)+parseFloat(arguments[2]);this.last.by=(this.isAbsolute?0:this.last.y)+parseFloat(arguments[3]);this.last.x=(this.isAbsolute?0:this.last.x)+parseFloat(arguments[4]);this.last.y=(this.isAbsolute?0:this.last.y)+parseFloat(arguments[5]);i+=[Math.round(parseFloat(arguments[0]))-1,Math.round(parseFloat(arguments[1]))-1,Math.round(parseFloat(arguments[2]))-1,Math.round(parseFloat(arguments[3]))-1,Math.round(parseFloat(arguments[4]))-1,Math.round(parseFloat(arguments[5]))-1].join(" ")+" ";this.last.isAbsolute=this.isAbsolute;this.attrs.path+=(this.isAbsolute?"C":"c")+Array.prototype.splice.call(arguments,0,arguments.length);}if(arguments.length==4){var e=this.last.x*2-this.last.bx,R=this.last.y*2-this.last.by;this.last.bx=(this.isAbsolute?0:this.last.x)+parseFloat(arguments[0]);this.last.by=(this.isAbsolute?0:this.last.y)+parseFloat(arguments[1]);this.last.x=(this.isAbsolute?0:this.last.x)+parseFloat(arguments[2]);this.last.y=(this.isAbsolute?0:this.last.y)+parseFloat(arguments[3]);i+=[Math.round(e)-1,Math.round(R)-1,Math.round(parseFloat(arguments[0]))-1,Math.round(parseFloat(arguments[1]))-1,Math.round(parseFloat(arguments[2]))-1,Math.round(parseFloat(arguments[3]))-1].join(" ")+" ";this.attrs.path+=(this.isAbsolute?"S":"s")+Array.prototype.splice.call(arguments,0,arguments.length);}this.node.path=this.Path+=i;return this;},qcurveTo:function(){var i=Math.round(this.last.x)-1,e=Math.round(this.last.y)-1,R=[];if(arguments.length==4){this.last.qx=(!this.isAbsolute*this.last.x)+parseFloat(arguments[0]);this.last.qy=(!this.isAbsolute*this.last.y)+parseFloat(arguments[1]);this.last.x=(!this.isAbsolute*this.last.x)+parseFloat(arguments[2]);this.last.y=(!this.isAbsolute*this.last.y)+parseFloat(arguments[3]);R=[this.last.qx,this.last.qy,this.last.x,this.last.y];this.last.isAbsolute=this.isAbsolute;this.attrs.path+=(this.isAbsolute?"Q":"q")+Array.prototype.splice.call(arguments,0,arguments.length);}if(arguments.length==2){this.last.qx=this.last.x*2-this.last.qx;this.last.qy=this.last.y*2-this.last.qy;this.last.x=(!this.isAbsolute*this.last.x)+parseFloat(arguments[2]);this.last.y=(!this.isAbsolute*this.last.y)+parseFloat(arguments[3]);R=[this.last.qx,this.last.qy,this.last.x,this.last.y];this.attrs.path+=(this.isAbsolute?"T":"t")+Array.prototype.splice.call(arguments,0,arguments.length);}var w="c"+[Math.round(2/3*R[0]+1/3*i)-1,Math.round(2/3*R[1]+1/3*e)-1,Math.round(2/3*R[0]+1/3*R[2])-1,Math.round(2/3*R[1]+1/3*R[3])-1,Math.round(R[2])-1,Math.round(R[3])-1].join(" ")+" ";this.node.path=this.Path+=w;return this;},addRoundedCorner:S,andClose:function(){this.node.path=(this.Path+="x");this.attrs.path+="z";return this;}};var u=function(x,w,AA){x=x||{};var z=t("group"),y=z.style;y.position="absolute";y.left=0;y.top=0;y.width=AA.width+"px";y.height=AA.height+"px";z.coordsize=AA.coordsize;z.coordorigin=AA.coordorigin;var i=t("shape"),AB=i.style;AB.width=AA.width+"px";AB.height=AA.height+"px";i.path="";if(x["class"]){i.className="rvml "+x["class"];}i.coordsize=this.coordsize;i.coordorigin=this.coordorigin;z.appendChild(i);var e=new M(i,z,AA);e.isAbsolute=true;e.type="path";e.path=[];e.last={x:0,y:0,bx:0,by:0,isAbsolute:true};e.Path="";for(var R in H){e[R]=H[R];}if(w){e.absolutely();e.attrs.path="";B.pathfinder(e,""+w);}if(x){x.fill=x.fill||"none";x.stroke=x.stroke||"#000";}else{x={fill:"none",stroke:"#000"};}f(e,x);if(x.gradient){n(e,x.gradient);}e.setBox();AA.canvas.appendChild(z);return e;};var f=function(R,i){var e=R.node,AF=e.style,AE,z=R;R.attrs=R.attrs||{};for(var y in i){R.attrs[y]=i[y];}i.href&&(e.href=i.href);i.title&&(e.title=i.title);i.target&&(e.target=i.target);if(i.path&&R.type=="path"){R.Path="";R.path=[];R.attrs.path="";B.pathfinder(R,i.path);}if(i.rotation!=null){R.rotate(i.rotation,true);}if(i.translation){AE=(i.translation+"").split(v);R.translate(AE[0],AE[1]);}if(i.scale){AE=(i.scale+"").split(v);R.scale(+AE[0]||1,+AE[1]||+AE[0]||1,+AE[2]||null,+AE[3]||null);}if(R.type=="image"&&i.src){e.src=i.src;}if(R.type=="image"&&i.opacity){e.filterOpacity=" progid:DXImageTransform.Microsoft.Alpha(opacity="+(i.opacity*100)+")";e.style.filter=(e.filterMatrix||"")+(e.filterOpacity||"");}i.font&&(AF.font=i.font);i["font-family"]&&(AF.fontFamily='"'+i["font-family"].split(",")[0].replace(/^['"]+|['"]+$/g,"")+'"');i["font-size"]&&(AF.fontSize=i["font-size"]);i["font-weight"]&&(AF.fontWeight=i["font-weight"]);i["font-style"]&&(AF.fontStyle=i["font-style"]);if(typeof i.opacity!="undefined"||typeof i["stroke-width"]!="undefined"||typeof i.fill!="undefined"||typeof i.stroke!="undefined"||i["stroke-width"]||i["stroke-opacity"]||i["fill-opacity"]||i["stroke-dasharray"]||i["stroke-miterlimit"]||i["stroke-linejoin"]||i["stroke-linecap"]){R=R.shape||e;var AD=(R.getElementsByTagName("fill")&&R.getElementsByTagName("fill")[0])||t("fill");if("fill-opacity" in i||"opacity" in i){var x=((+i["fill-opacity"]+1||2)-1)*((+i.opacity+1||2)-1);x<0&&(x=0);x>1&&(x=1);AD.opacity=x;}i.fill&&(AD.on=true);if(typeof AD.on=="undefined"||i.fill=="none"){AD.on=false;}if(AD.on&&i.fill){var w=i.fill.match(/^url\(([^\)]+)\)$/i);if(w){AD.src=w[1];AD.type="tile";}else{AD.color=E.getRGB(i.fill).hex;AD.src="";AD.type="solid";}}R.appendChild(AD);var AC=(R.getElementsByTagName("stroke")&&R.getElementsByTagName("stroke")[0])||t("stroke");if((i.stroke&&i.stroke!="none")||i["stroke-width"]||typeof i["stroke-opacity"]!="undefined"||i["stroke-dasharray"]||i["stroke-miterlimit"]||i["stroke-linejoin"]||i["stroke-linecap"]){AC.on=true;}if(i.stroke=="none"||typeof AC.on=="undefined"||i.stroke==0){AC.on=false;}if(AC.on&&i.stroke){AC.color=E.getRGB(i.stroke).hex;}var x=((+i["stroke-opacity"]+1||2)-1)*((+i.opacity+1||2)-1);x<0&&(x=0);x>1&&(x=1);AC.opacity=x;i["stroke-linejoin"]&&(AC.joinstyle=i["stroke-linejoin"]||"miter");AC.miterlimit=i["stroke-miterlimit"]||8;i["stroke-linecap"]&&(AC.endcap={butt:"flat",square:"square",round:"round"}[i["stroke-linecap"]]||"miter");i["stroke-width"]&&(AC.weight=(parseFloat(i["stroke-width"])||1)*12/16);if(i["stroke-dasharray"]){var AA={"-":"shortdash",".":"shortdot","-.":"shortdashdot","-..":"shortdashdotdot",". ":"dot","- ":"dash","--":"longdash","- .":"dashdot","--.":"longdashdot","--..":"longdashdotdot"};AC.dashstyle=AA[i["stroke-dasharray"]]||"";}R.appendChild(AC);}if(z.type=="text"){var AF=B.span.style,AB=z.attrs;AB.font&&(AF.font=AB.font);AB["font-family"]&&(AF.fontFamily=AB["font-family"]);AB["font-size"]&&(AF.fontSize=AB["font-size"]);AB["font-weight"]&&(AF.fontWeight=AB["font-weight"]);AB["font-style"]&&(AF.fontStyle=AB["font-style"]);B.span.innerText=z.node.string;z.W=AB.w=B.span.offsetWidth;z.H=AB.h=B.span.offsetHeight;z.X=AB.x;z.Y=AB.y+Math.round(z.H/2);switch(AB["text-anchor"]){case"start":z.node.style["v-text-align"]="left";z.bbx=Math.round(z.W/2);break;case"end":z.node.style["v-text-align"]="right";z.bbx=-Math.round(z.W/2);break;default:z.node.style["v-text-align"]="center";break;}}};var P=function(e,R,x,w){var i=Math.round(Math.atan((parseFloat(x)-parseFloat(e))/(parseFloat(w)-parseFloat(R)))*57.29)||0;if(!i&&parseFloat(e)<parseFloat(R)){i=180;}i-=180;if(i<0){i+=360;}return i;};var n=function(AA,z){z=N(z);AA.attrs=AA.attrs||{};var e=AA.attrs,y=AA.node.getElementsByTagName("fill");AA.attrs.gradient=z;AA=AA.shape||AA.node;if(y.length){y=y[0];}else{y=t("fill");}if(z.dots.length){y.on=true;y.method="none";y.type=((z.type+"").toLowerCase()=="radial")?"gradientTitle":"gradient";if(typeof z.dots[0].color!="undefined"){y.color=E.getRGB(z.dots[0].color).hex;}if(typeof z.dots[z.dots.length-1].color!="undefined"){y.color2=E.getRGB(z.dots[z.dots.length-1].color).hex;}var AB=[];for(var w=0,x=z.dots.length;w<x;w++){if(z.dots[w].offset){AB.push(z.dots[w].offset+" "+E.getRGB(z.dots[w].color).hex);}}var R=typeof z.dots[z.dots.length-1].opacity=="undefined"?(typeof e.opacity=="undefined"?1:e.opacity):z.dots[z.dots.length-1].opacity;if(AB.length){y.colors.value=AB.join(",");R=typeof e.opacity=="undefined"?1:e.opacity;}else{y.colors&&(y.colors.value="0% "+y.color);}y.opacity=R;if(typeof z.angle!="undefined"){y.angle=(-z.angle+270)%360;}else{if(z.vector){y.angle=P.apply(null,z.vector);}}if((z.type+"").toLowerCase()=="radial"){y.focus="100%";y.focusposition="0.5 0.5";}}};var M=function(x,z,R){var y=0,i=0,e=0,w=1;this[0]=x;this.node=x;this.X=0;this.Y=0;this.attrs={};this.Group=z;this.paper=R;this._={tx:0,ty:0,rt:{deg:0},sx:1,sy:1};};M.prototype.rotate=function(e,R,i){if(e==null){return this._.rt.deg;}e=(e+"").split(v);if(e.length-1){R=parseFloat(e[1]);i=parseFloat(e[2]);}e=parseFloat(e[0]);if(R!=null){this._.rt.deg=e;}else{this._.rt.deg+=e;}if(i==null){R=null;}this._.rt.cx=R;this._.rt.cy=i;this.setBox(this.attrs,R,i);this.Group.style.rotation=this._.rt.deg;return this;};M.prototype.setBox=function(AB,AC,AA){var e=this.Group.style,AD=(this.shape&&this.shape.style)||this.node.style;AB=AB||{};for(var AE in AB){this.attrs[AE]=AB[AE];}AC=AC||this._.rt.cx;AA=AA||this._.rt.cy;var AH=this.attrs,AK,AJ,AL,AG;switch(this.type){case"circle":AK=AH.cx-AH.r;AJ=AH.cy-AH.r;AL=AG=AH.r*2;break;case"ellipse":AK=AH.cx-AH.rx;AJ=AH.cy-AH.ry;AL=AH.rx*2;AG=AH.ry*2;break;case"rect":case"image":AK=AH.x;AJ=AH.y;AL=AH.width||0;AG=AH.height||0;break;case"text":this.textpath.v=["m",Math.round(AH.x),", ",Math.round(AH.y-2),"l",Math.round(AH.x)+1,", ",Math.round(AH.y-2)].join("");AK=AH.x-Math.round(this.W/2);AJ=AH.y-this.H/2;AL=this.W;AG=this.H;break;case"path":if(!this.attrs.path){AK=0;AJ=0;AL=this.paper.width;AG=this.paper.height;}else{var AF=a(this.attrs.path),AK=AF.x;AJ=AF.y;AL=AF.width;AG=AF.height;}break;default:AK=0;AJ=0;AL=this.paper.width;AG=this.paper.height;break;}AC=(AC==null)?AK+AL/2:AC;AA=(AA==null)?AJ+AG/2:AA;var z=AC-this.paper.width/2,AI=AA-this.paper.height/2;if(this.type=="path"||this.type=="text"){(e.left!=z+"px")&&(e.left=z+"px");(e.top!=AI+"px")&&(e.top=AI+"px");this.X=this.type=="text"?AK:-z;this.Y=this.type=="text"?AJ:-AI;this.W=AL;this.H=AG;(AD.left!=-z+"px")&&(AD.left=-z+"px");(AD.top!=-AI+"px")&&(AD.top=-AI+"px");}else{(e.left!=z+"px")&&(e.left=z+"px");(e.top!=AI+"px")&&(e.top=AI+"px");this.X=AK;this.Y=AJ;this.W=AL;this.H=AG;(e.width!=this.paper.width+"px")&&(e.width=this.paper.width+"px");(e.height!=this.paper.height+"px")&&(e.height=this.paper.height+"px");(AD.left!=AK-z+"px")&&(AD.left=AK-z+"px");(AD.top!=AJ-AI+"px")&&(AD.top=AJ-AI+"px");(AD.width!=AL+"px")&&(AD.width=AL+"px");(AD.height!=AG+"px")&&(AD.height=AG+"px");var AM=(+AB.r||0)/(Math.min(AL,AG));if(this.type=="rect"&&this.arcsize!=AM&&(AM||this.arcsize)){var R=t(AM?"roundrect":"rect");R.arcsize=AM;this.Group.appendChild(R);this.node.parentNode.removeChild(this.node);this.node=R;this.arcsize=AM;f(this,this.attrs);this.setBox(this.attrs);}}};M.prototype.hide=function(){this.Group.style.display="none";return this;};M.prototype.show=function(){this.Group.style.display="block";return this;};M.prototype.getBBox=function(){if(this.type=="path"){return a(this.attr("path"));}return{x:this.X+(this.bbx||0),y:this.Y,width:this.W,height:this.H};};M.prototype.remove=function(){this[0].parentNode.removeChild(this[0]);this.Group.parentNode.removeChild(this.Group);this.shape&&this.shape.parentNode.removeChild(this.shape);};M.prototype.attr=function(){if(arguments.length==1&&typeof arguments[0]=="string"){if(arguments[0]=="translation"){return this.translate();}return this.attrs[arguments[0]];}if(this.attrs&&arguments.length==1&&E.isArray(arguments[0])){var R={};for(var e=0,w=arguments[0].length;e<w;e++){R[arguments[0][e]]=this.attrs[arguments[0][e]];}return R;}var x;if(arguments.length==2){x={};x[arguments[0]]=arguments[1];}if(arguments.length==1&&typeof arguments[0]=="object"){x=arguments[0];}if(x){if(x.gradient){n(this,x.gradient);}if(x.text&&this.type=="text"){this.node.string=x.text;}f(this,x);this.setBox(this.attrs);}return this;};M.prototype.toFront=function(){this.Group.parentNode.appendChild(this.Group);return this;};M.prototype.toBack=function(){if(this.Group.parentNode.firstChild!=this.Group){this.Group.parentNode.insertBefore(this.Group,this.Group.parentNode.firstChild);}return this;};M.prototype.insertAfter=function(R){if(R.Group.nextSibling){R.Group.parentNode.insertBefore(this.Group,R.Group.nextSibling);}else{R.Group.parentNode.appendChild(this.Group);}return this;};M.prototype.insertBefore=function(R){R.Group.parentNode.insertBefore(this.Group,R.Group);return this;};var b=function(e,AD,AC,R){var z=t("group"),w=z.style,i=t("oval"),AB=i.style;w.position="absolute";w.left=0;w.top=0;w.width=e.width+"px";w.height=e.height+"px";z.coordsize=e.coordsize;z.coordorigin=e.coordorigin;z.appendChild(i);var AA=new M(i,z,e);AA.type="circle";f(AA,{stroke:"#000",fill:"none"});AA.attrs.cx=AD;AA.attrs.cy=AC;AA.attrs.r=R;AA.setBox({x:AD-R,y:AC-R,width:R*2,height:R*2});e.canvas.appendChild(z);return AA;};var j=function(e,AE,AD,AF,AA,R){var AB=t("group"),z=AB.style,i=t(R?"roundrect":"rect"),AG=(+R||0)/(Math.min(AF,AA));i.arcsize=AG;z.position="absolute";z.left=0;z.top=0;z.width=e.width+"px";z.height=e.height+"px";AB.coordsize=e.coordsize;AB.coordorigin=e.coordorigin;AB.appendChild(i);var AC=new M(i,AB,e);AC.type="rect";f(AC,{stroke:"#000"});AC.arcsize=AG;AC.setBox({x:AE,y:AD,width:AF,height:AA,r:+R});e.canvas.appendChild(AB);return AC;};var G=function(R,AE,AD,i,e){var AA=t("group"),z=AA.style,w=t("oval"),AC=w.style;z.position="absolute";z.left=0;z.top=0;z.width=R.width+"px";z.height=R.height+"px";AA.coordsize=R.coordsize;AA.coordorigin=R.coordorigin;AA.appendChild(w);var AB=new M(w,AA,R);AB.type="ellipse";f(AB,{stroke:"#000"});AB.attrs.cx=AE;AB.attrs.cy=AD;AB.attrs.rx=i;AB.attrs.ry=e;AB.setBox({x:AE-i,y:AD-e,width:i*2,height:e*2});R.canvas.appendChild(AA);return AB;};var Q=function(e,R,AF,AE,AG,AA){var AB=t("group"),z=AB.style,i=t("image"),AD=i.style;z.position="absolute";z.left=0;z.top=0;z.width=e.width+"px";z.height=e.height+"px";AB.coordsize=e.coordsize;AB.coordorigin=e.coordorigin;i.src=R;AB.appendChild(i);var AC=new M(i,AB,e);AC.type="image";AC.attrs.x=AF;AC.attrs.y=AE;AC.attrs.w=AG;AC.attrs.h=AA;AC.setBox({x:AF,y:AE,width:AG,height:AA});e.canvas.appendChild(AB);return AC;};var h=function(e,AE,AD,AF){var AA=t("group"),z=AA.style,w=t("shape"),AC=w.style,AG=t("path"),R=AG.style,i=t("textpath");z.position="absolute";z.left=0;z.top=0;z.width=e.width+"px";z.height=e.height+"px";AA.coordsize=e.coordsize;AA.coordorigin=e.coordorigin;AG.v=["m",Math.round(AE),", ",Math.round(AD),"l",Math.round(AE)+1,", ",Math.round(AD)].join("");AG.textpathok=true;AC.width=e.width;AC.height=e.height;z.position="absolute";z.left=0;z.top=0;z.width=e.width;z.height=e.height;i.string=AF;i.on=true;w.appendChild(i);w.appendChild(AG);AA.appendChild(w);var AB=new M(i,AA,e);AB.shape=w;AB.textpath=AG;AB.type="text";AB.attrs.x=AE;AB.attrs.y=AD;AB.attrs.w=1;AB.attrs.h=1;f(AB,{font:T.font,stroke:"none",fill:"#000"});AB.setBox();e.canvas.appendChild(AA);return AB;};var c=function(i,R){var e=this.canvas.style;this.width=i||this.width;this.height=R||this.height;e.width=this.width+"px";e.height=this.height+"px";e.clip="rect(0 "+this.width+"px "+this.height+"px 0)";this.canvas.coordsize=this.width+" "+this.height;return this;};F.createStyleSheet().addRule(".rvml","behavior:url(#default#VML)");try{if(!F.namespaces.rvml){F.namespaces.add("rvml","urn:schemas-microsoft-com:vml");}var t=function(R){return F.createElement("<rvml:"+R+' class="rvml">');};}catch(s){var t=function(R){return F.createElement("<"+R+' xmlns="urn:schemas-microsoft.com:vml" class="rvml">');};}var K=function(){var w=g.apply(null,arguments),e=w.container,AC=w.x,AB=w.y,i=w.width,AE,AD=w.height;if(!e){throw new Error("VML container not found.");}var AA=B.canvas=F.createElement("div"),z=AA.style;i=parseFloat(i)||"512px";AD=parseFloat(AD)||"342px";B.width=i;B.height=AD;B.coordsize=i+" "+AD;B.coordorigin="0 0";B.span=F.createElement("span");AE=B.span.style;AA.appendChild(B.span);AE.position="absolute";AE.left="-99999px";AE.top="-99999px";AE.padding=0;AE.margin=0;AE.lineHeight=1;AE.display="inline";z.width=i+"px";z.height=AD+"px";z.position="absolute";z.clip="rect(0 "+i+"px "+AD+"px 0)";if(e==1){F.body.appendChild(AA);z.left=AC+"px";z.top=AB+"px";e={style:{width:i,height:AD}};}else{e.style.width=i;e.style.height=AD;if(e.firstChild){e.insertBefore(AA,e.firstChild);}else{e.appendChild(AA);}}for(var R in B){e[R]=B[R];}A.call(e,e,E.fn);e.clear=function(){while(AA.firstChild){AA.removeChild(AA.firstChild);}};e.raphael=E;return e;};B.remove=function(){this.canvas.parentNode.removeChild(this.canvas);};B.safari=function(){};}var I=(function(){if(F.addEventListener){return function(x,i,e,R){var w=function(y){return e.call(R,y);};x.addEventListener(i,w,false);return function(){x.removeEventListener(i,w,false);return true;};};}else{if(F.attachEvent){return function(y,w,i,e){var x=function(z){return i.call(e,z||l.event);};y.attachEvent("on"+w,x);var R=function(){y.detachEvent("on"+w,x);return true;};if(w=="mouseover"){y.attachEvent("onmouseenter",x);return function(){y.detachEvent("onmouseenter",x);return R();};}else{if(w=="mouseout"){y.attachEvent("onmouseleave",x);return function(){y.detachEvent("onmouseleave",x);return R();};}}return R;};}}})();for(var p=W.length;p--;){(function(R){M.prototype[R]=function(e){if(typeof e=="function"){this.events=this.events||{};this.events[R]=this.events[R]||{};this.events[R][e]=this.events[R][e]||[];this.events[R][e].push(I(this.shape||this.node,R,e,this));}return this;};M.prototype["un"+R]=function(e){this.events&&this.events[R]&&this.events[R][e]&&this.events[R][e].length&&this.events[R][e].shift()()&&!this.events[R][e].length&&delete this.events[R][e];};})(W[p]);}B.circle=function(R,i,e){return b(this,R,i,e);};B.rect=function(R,AA,e,i,z){return j(this,R,AA,e,i,z);};B.ellipse=function(R,w,i,e){return G(this,R,w,i,e);};B.path=function(e,R){return u(e,R,this);};B.image=function(z,R,AA,e,i){return Q(this,z,R,AA,e,i);};B.text=function(R,i,e){return h(this,R,i,e);};B.drawGrid=function(AF,AE,AG,AC,AB,AD,z){z=z||"#000";var AH=["M",AF,AE,"L",AF+AG,AE,AF+AG,AE+AC,AF,AE+AC,AF,AE],R=AC/AD,e=AG/AB;for(var AA=1;AA<AD;AA++){AH=AH.concat(["M",AF,AE+AA*R,"L",AF+AG,AE+AA*R]);}for(var AA=1;AA<AB;AA++){AH=AH.concat(["M",AF+AA*e,AE,"L",AF+AA*e,AE+AC]);}return this.path({stroke:z,"stroke-width":1},AH.join(","));};B.pathfinder=function(z,y){var e={M:function(i,AA){this.moveTo(i,AA);},C:function(AC,AE,AA,AD,i,AB){this.curveTo(AC,AE,AA,AD,i,AB);},Q:function(AA,AC,i,AB){this.qcurveTo(AA,AC,i,AB);},T:function(i,AA){this.qcurveTo(i,AA);},S:function(AA,AC,i,AB){z.curveTo(AA,AC,i,AB);},L:function(i,AA){z.lineTo(i,AA);},H:function(i){this.lineTo(i,this.last.y);},V:function(i){this.lineTo(this.last.x,i);},A:function(AD,AC,AA,AB,AE,i,AF){this.arcTo(AD,AC,AB,AE,i,AF);},Z:function(){this.andClose();}};y=X(y);for(var w=0,x=y.length;w<x;w++){var R=y[w].shift();e[R].apply(z,y[w]);y[w].unshift(R);}};B.set=function(R){return new J(R);};B.setSize=c;M.prototype.stop=function(){clearTimeout(this.animation_in_progress);};M.prototype.scale=function(AI,AH,w,e){if(AI==null&&AH==null){return{x:this._.sx,y:this._.sy,toString:function(){return this.x.toFixed(3)+" "+this.y.toFixed(3);}};}AH=AH||AI;!+AH&&(AH=AI);var AM,AK,AL,AJ,AY=this.attrs;if(AI!=0){var AG=this.type=="path"?a(AY.path):this.getBBox(),AD=AG.x+AG.width/2,AA=AG.y+AG.height/2,AX=AI/this._.sx,AW=AH/this._.sy;w=(+w||w==0)?w:AD;e=(+e||e==0)?e:AA;var AF=Math.round(AI/Math.abs(AI)),AC=Math.round(AH/Math.abs(AH)),AP=this.node.style,Aa=w+(AD-w)*AF*AX,AZ=e+(AA-e)*AC*AW;switch(this.type){case"rect":case"image":var AE=AY.width*AF*AX,AO=AY.height*AC*AW,AB=Aa-AE/2,z=AZ-AO/2;this.attr({width:AE,height:AO,x:AB,y:z});break;case"circle":case"ellipse":this.attr({rx:AY.rx*AX,ry:AY.ry*AW,r:AY.r*AX,cx:Aa,cy:AZ});break;case"path":var AR=C(AY.path),AS=true;for(var AU=0,AN=AR.length;AU<AN;AU++){var AQ=AR[AU];if(AQ[0].toUpperCase()=="M"&&AS){continue;}else{AS=false;}if(E.svg&&AQ[0].toUpperCase()=="A"){AQ[AR[AU].length-2]*=AX;AQ[AR[AU].length-1]*=AW;AQ[1]*=AX;AQ[2]*=AW;AQ[5]=+(AF+AC?!!+AQ[5]:!+AQ[5]);}else{for(var AT=1,AV=AQ.length;AT<AV;AT++){AQ[AT]*=(AT%2)?AX:AW;}}}var R=a(AR),AM=Aa-R.x-R.width/2,AK=AZ-R.y-R.height/2;AR=C(AR);AR[0][1]+=AM;AR[0][2]+=AK;this.attr({path:AR.join(" ")});break;}if(this.type in {text:1,image:1}&&(AF!=1||AC!=1)){if(this.transformations){this.transformations[2]="scale(".concat(AF,",",AC,")");this.node.setAttribute("transform",this.transformations.join(" "));AM=(AF==-1)?-AY.x-(AE||0):AY.x;AK=(AC==-1)?-AY.y-(AO||0):AY.y;this.attr({x:AM,y:AK});AY.fx=AF-1;AY.fy=AC-1;}else{this.node.filterMatrix=" progid:DXImageTransform.Microsoft.Matrix(M11=".concat(AF,", M12=0, M21=0, M22=",AC,", Dx=0, Dy=0, sizingmethod='auto expand', filtertype='bilinear')");AP.filter=(this.node.filterMatrix||"")+(this.node.filterOpacity||"");}}else{if(this.transformations){this.transformations[2]="";this.node.setAttribute("transform",this.transformations.join(" "));AY.fx=0;AY.fy=0;}else{this.node.filterMatrix="";AP.filter=(this.node.filterMatrix||"")+(this.node.filterOpacity||"");}}AY.scale=[AI,AH,w,e].join(" ");this._.sx=AI;this._.sy=AH;}return this;};E.easing_formulas={linear:function(R){return R;},"<":function(R){return Math.pow(R,3);},">":function(R){return Math.pow(R-1,3)+1;},"<>":function(R){R=R*2;if(R<1){return Math.pow(R,3)/2;}R-=2;return(Math.pow(R,3)+2)/2;},backIn:function(e){var R=1.70158;return Math.pow(e,2)*((R+1)*e-R);},backOut:function(e){e=e-1;var R=1.70158;return Math.pow(e,2)*((R+1)*e+R)+1;},elastic:function(i){if(i==0||i==1){return i;}var e=0.3,R=e/4;return Math.pow(2,-10*i)*Math.sin((i-R)*(2*Math.PI)/e)+1;},bounce:function(w){var e=7.5625,i=2.75,R;if(w<(1/i)){R=e*Math.pow(w,2);}else{if(w<(2/i)){w-=(1.5/i);R=e*Math.pow(w,2)+0.75;}else{if(w<(2.5/i)){w-=(2.25/i);R=e*Math.pow(w,2)+0.9375;}else{w-=(2.625/i);R=e*Math.pow(w,2)+0.984375;}}}return R;}};E.easing=function(e,R){return E.easing_formulas[e]?E.easing_formulas[e](R):R;};M.prototype.animate=function(AO,AG,AF,x){clearTimeout(this.animation_in_progress);if(typeof AF=="function"||!AF){x=AF||null;AF="linear";}var AJ={},e={},AD={},AC={x:0,y:0};for(var AH in AO){if(AH in V){AJ[AH]=this.attr(AH);(typeof AJ[AH]=="undefined")&&(AJ[AH]=T[AH]);e[AH]=AO[AH];switch(V[AH]){case"number":AD[AH]=(e[AH]-AJ[AH])/AG;break;case"colour":AJ[AH]=E.getRGB(AJ[AH]);var AI=E.getRGB(e[AH]);AD[AH]={r:(AI.r-AJ[AH].r)/AG,g:(AI.g-AJ[AH].g)/AG,b:(AI.b-AJ[AH].b)/AG};break;case"path":var y=d(AJ[AH],e[AH]);AJ[AH]=y[0];e[AH]=y[1];AD[AH]=[];for(var AL=0,AB=AJ[AH].length;AL<AB;AL++){AD[AH][AL]=[0];for(var AK=1,AN=AJ[AH][AL].length;AK<AN;AK++){AD[AH][AL][AK]=(e[AH][AL][AK]-AJ[AH][AL][AK])/AG;}}break;case"csv":var R=(AO[AH]+"").split(v),AA=(AJ[AH]+"").split(v);switch(AH){case"translation":AJ[AH]=[0,0];AD[AH]=[R[0]/AG,R[1]/AG];break;case"rotation":AJ[AH]=(AA[1]==R[1]&&AA[2]==R[2])?AA:[0,R[1],R[2]];AD[AH]=[(R[0]-AJ[AH][0])/AG,0,0];break;case"scale":AO[AH]=R;AJ[AH]=(AJ[AH]+"").split(v);AD[AH]=[(R[0]-AJ[AH][0])/AG,(R[1]-AJ[AH][1])/AG,0,0];}e[AH]=R;}}}var w=+new Date,AE=0,z=this;(function AM(){var AQ=new Date-w,AX={},AP;if(AQ<AG){pos=E.easing(AF,AQ/AG);for(var AU in AJ){switch(V[AU]){case"number":AP=+AJ[AU]+pos*AG*AD[AU];break;case"colour":AP="rgb("+[Math.round(AJ[AU].r+pos*AG*AD[AU].r),Math.round(AJ[AU].g+pos*AG*AD[AU].g),Math.round(AJ[AU].b+pos*AG*AD[AU].b)].join(",")+")";break;case"path":AP=[];for(var AS=0,AY=AJ[AU].length;AS<AY;AS++){AP[AS]=[AJ[AU][AS][0]];for(var AR=1,AT=AJ[AU][AS].length;AR<AT;AR++){AP[AS][AR]=AJ[AU][AS][AR]+pos*AG*AD[AU][AS][AR];}AP[AS]=AP[AS].join(" ");}AP=AP.join(" ");break;case"csv":switch(AU){case"translation":var AW=AD[AU][0]*(AQ-AE),AV=AD[AU][1]*(AQ-AE);AC.x+=AW;AC.y+=AV;AP=[AW,AV].join(" ");break;case"rotation":AP=+AJ[AU][0]+pos*AG*AD[AU][0];AJ[AU][1]&&(AP+=","+AJ[AU][1]+","+AJ[AU][2]);break;case"scale":AP=[+AJ[AU][0]+pos*AG*AD[AU][0],+AJ[AU][1]+pos*AG*AD[AU][1],(2 in AO[AU]?AO[AU][2]:""),(3 in AO[AU]?AO[AU][3]:"")].join(" ");}break;}if(AU=="font-size"){AX[AU]=AP+"px";}else{AX[AU]=AP;}}z.attr(AX);z.animation_in_progress=setTimeout(AM);E.svg&&B.safari();}else{(AC.x||AC.y)&&z.translate(-AC.x,-AC.y);z.attr(AO);clearTimeout(z.animation_in_progress);B.safari();(typeof x=="function")&&x.call(z);}AE=AQ;})();return this;};M.prototype.translate=function(R,i){if(R==null){return{x:this._.tx,y:this._.ty};}this._.tx+=+R;this._.ty+=+i;switch(this.type){case"circle":case"ellipse":this.attr({cx:+R+this.attrs.cx,cy:+i+this.attrs.cy});break;case"rect":case"image":case"text":this.attr({x:+R+this.attrs.x,y:+i+this.attrs.y});break;case"path":var e=C(this.attrs.path);e[0][1]+=+R;e[0][2]+=+i;this.attr({path:e.join(" ")});break;}return this;};var J=function(R){this.items=[];this.length=0;if(R){for(var e=0,w=R.length;e<w;e++){if(R[e]&&(R[e].constructor==M||R[e].constructor==J)){this[this.items.length]=this.items[this.items.length]=R[e];this.length++;}}}};J.prototype.push=function(){var x,R;for(var e=0,w=arguments.length;e<w;e++){x=arguments[e];if(x&&(x.constructor==M||x.constructor==J)){R=this.items.length;this[R]=this.items[R]=x;this.length++;}}return this;};J.prototype.pop=function(w){var e=this.items.splice(w,1)[0];for(var R=w,i=this.items.length;R<i;R++){this[R]=this[R+1];}delete this[i+1];this.length--;return e;};for(var q in M.prototype){J.prototype[q]=(function(R){return function(){for(var e=0,w=this.items.length;e<w;e++){this.items[e][R].apply(this.items[e],arguments);}return this;};})(q);}J.prototype.attr=function(e,z){if(e&&E.isArray(e)&&typeof e[0]=="object"){for(var R=0,y=e.length;R<y;R++){this.items[R].attr(e[R]);}}else{for(var w=0,x=this.items.length;w<x;w++){this.items[w].attr.apply(this.items[w],arguments);}}return this;};J.prototype.getBBox=function(){var R=[],AC=[],e=[],AA=[];for(var z=this.items.length;z--;){var AB=this.items[z].getBBox();R.push(AB.x);AC.push(AB.y);e.push(AB.x+AB.width);AA.push(AB.y+AB.height);}R=Math.min.apply(Math,R);AC=Math.min.apply(Math,AC);return{x:R,y:AC,width:Math.max.apply(Math,e)-R,height:Math.max.apply(Math,AA)-AC};};E.registerFont=function(e){if(!e.face){return e;}this.fonts=this.fonts||{};var w={w:e.w,face:{},glyphs:{}},i=e.face["font-family"];for(var z in e.face){w.face[z]=e.face[z];}if(this.fonts[i]){this.fonts[i].push(w);}else{this.fonts[i]=[w];}if(!e.svg){w.face["units-per-em"]=parseInt(e.face["units-per-em"],10);for(var x in e.glyphs){var y=e.glyphs[x];w.glyphs[x]={w:y.w,k:{},d:y.d&&"M"+y.d.replace(/[mlcxtrv]/g,function(AA){return{l:"L",c:"C",x:"z",t:"m",r:"l",v:"c"}[AA]||"M";})+"z"};if(y.k){for(var R in y.k){w.glyphs[x].k[R]=y.k[R];}}}}return e;};B.getFont=function(AB,AC,e,x){x=x||"normal";e=e||"normal";AC=+AC||{normal:400,bold:700,lighter:300,bolder:800}[AC]||400;var y=E.fonts[AB];if(!y){var w=new RegExp("(^|\\s)"+AB.replace(/[^\w\d\s+!~.:_-]/g,"")+"(\\s|$)","i");for(var R in E.fonts){if(w.test(R)){y=E.fonts[R];break;}}}var z;if(y){for(var AA=0,AD=y.length;AA<AD;AA++){z=y[AA];if(z.face["font-weight"]==AC&&(z.face["font-style"]==e||!z.face["font-style"])&&z.face["font-stretch"]==x){break;}}}return z;};B.print=function(AF,AE,AC,e,AJ){var AA=this.set(),AD=(AC+"").split(""),R=0,AI="",z;if(e){z=(AJ||16)/e.face["units-per-em"];for(var AB=0,AG=AD.length;AB<AG;AB++){var w=AB&&e.glyphs[AD[AB-1]]||{},AH=e.glyphs[AD[AB]];R+=AB?(w.w||e.w)+(w.k&&w.k[AD[AB]]||0):0;AH&&AH.d&&AA.push(this.path({fill:"#000",stroke:"none"},AH.d).translate(R,0));}AA.scale(z,z,0,AE).translate(AF,(AJ||16)/2);}return AA;};E.ninja=function(){var R=window.Raphael;if(o.was){window.Raphael=o.is;}else{try{delete window.Raphael;}catch(i){window.Raphael=void (0);}}return R;};E.el=M.prototype;return E;})();
(function() {


  /**
  *
  */
  debug = function(message) {
    window.console && console.log && console.log(message);
  };


  periodicallyCall = function(_fun,context,intervalms) {
      setTimeout(function() {
        _fun.call(context);
        periodicallyCall(_fun,context,args,intervalms);
      }, intervalms);


  };

  /**
  *
  */
  createCookie = function(name,value,days) {
    if (!days) {
      days = 14;
    }
    var date = new Date();
    date.setTime(date.getTime()+(days*24*60*60*1000));
    var expires = "; expires="+date.toGMTString();
    document.cookie = name+"="+value+expires+"; path=/";
  };


  /**
  *
  */
  readCookie = function (name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
  };


  /**
  *
  */
  eraseCookie = function (name) {
    createCookie(name,"",-1);
  };


  /**
  *
  */
  if (window.WireIt && window.WireIt.Layer) {
    WireIt.Layer.prototype.setOptions = function(options) {
      var defaults = {
        className: 'WireIt-Layer',
        parentEl: document.body,
        containers: [],
        wires: [],
        layerMap: false,
        enableMouseEvents: true
      };
      defaults = $H(defaults);
      this.options = defaults.merge($H(options)).toObject();
      debug("loaded defaults for wire-it layer");
      debug(this.options.parentEl);
    };
  };


})();
(function () {

  MySystem = typeof(MySystem) != 'undefined' ? MySystem : function() {};


  Raphael.fn.arrow = function(startx,starty,endx,endy,len,angle,color) {
    color = typeof(color) != 'undefined' ? color : "#888";

    var theta = Math.atan2((endy-starty),(endx-startx));
    var baseAngleA = theta + angle * Math.PI/180;
    var baseAngleB = theta - angle * Math.PI/180;
    var tipX = endx + len * Math.cos(theta);
    var tipY = endy + len * Math.sin(theta);
    var baseAX = endx - len * Math.cos(baseAngleA);
    var baseAY = endy - len * Math.sin(baseAngleA);
    var baseBX = endx - len * Math.cos(baseAngleB);
    var baseBY = endy - len * Math.sin(baseAngleB);
    var pathData = " M " + tipX      + " " + tipY +
                   " L " + baseAX  + " " + baseAY +
                   " L " + baseBX  + " " + baseBY +
                   " Z ";
    return {
      path: this.path({fill: color, stroke: "none"},pathData),
      type: 'arrow'
    };
  };

  Raphael.fn.connection = function (obj1, obj2, line, bg) {
      if (obj1.line && obj1.from && obj1.to) {
          line = obj1;
          obj1 = line.from;
          obj2 = line.to;
      }
      var bb1 = obj1.getBBox();
      var bb2 = obj2.getBBox();
      var p = [{x: bb1.x + bb1.width / 2, y: bb1.y - 1},
          {x: bb1.x + bb1.width / 2, y: bb1.y + bb1.height + 1},
          {x: bb1.x - 1, y: bb1.y + bb1.height / 2},
          {x: bb1.x + bb1.width + 1, y: bb1.y + bb1.height / 2},
          {x: bb2.x + bb2.width / 2, y: bb2.y - 1},
          {x: bb2.x + bb2.width / 2, y: bb2.y + bb2.height + 1},
          {x: bb2.x - 1, y: bb2.y + bb2.height / 2},
          {x: bb2.x + bb2.width + 1, y: bb2.y + bb2.height / 2}];
      var d = {}, dis = [];

      for (var i = 0; i < 4; i++) {
          var dx, dy;
          for (var j = 4; j < 8; j++) {
                  dx = Math.abs(p[i].x - p[j].x);
                  dy = Math.abs(p[i].y - p[j].y);
              if ((i == j - 4) || (((i != 3 && j != 6) || p[i].x < p[j].x) && ((i != 2 && j != 7) || p[i].x > p[j].x) && ((i != 0 && j != 5) || p[i].y > p[j].y) && ((i != 1 && j != 4) || p[i].y < p[j].y))) {
                  dis.push(dx + dy);
                  d[dis[dis.length - 1]] = [i, j];
              }
          }
      }
      var res;
      if (dis.length == 0) {
          res = [0, 4];
      } else {
          res = d[Math.min.apply(Math, dis)];
      }
      var x1 = p[res[0]].x,
          y1 = p[res[0]].y,
          x4 = p[res[1]].x,
          y4 = p[res[1]].y,
          dx = Math.max(Math.abs(x1 - x4) / 2, 10),
          dy = Math.max(Math.abs(y1 - y4) / 2, 10),
          x2 = [x1, x1, x1 - dx, x1 + dx][res[0]].toFixed(3),
          y2 = [y1 - dy, y1 + dy, y1, y1][res[0]].toFixed(3),
          x3 = [0, 0, 0, 0, x4, x4, x4 - dx, x4 + dx][res[1]].toFixed(3),
          y3 = [0, 0, 0, 0, y1 + dy, y1 - dy, y4, y4][res[1]].toFixed(3);
      var path = ["M", x1.toFixed(3), y1.toFixed(3), "C", x2, y2, x3, y3, x4.toFixed(3), y4.toFixed(3)].join(",");
      if (line && line.line) {
          line.bg && line.bg.attr({path: path});
          line.line.attr({path: path});
      } else {
          var color = typeof line == "string" ? line : "#000";
          var strokeWidth = bg.split("|")[1] || 3;
          var stroke = bg.split("|")[0];
          return {
              bg: bg && bg.split && this.path({stroke: stroke, fill: "none", "stroke-width": strokeWidth}, path),
              line: this.path({stroke: color, fill: "none"}, path),
              arrow: this.arrow(x3,y3,x4,y4,strokeWidth * 2.0,50,color),
              from: obj1,
              to: obj2
          };
      }
  };



  MySystem.Node = function() {
    this.terminals = [];
    this.icon = [];
    this.x = 0;
    this.y = 0;

  };

  MySystem.Node.prototype.terminal = function(name) {
    var returnVal = null;
    this.terminals.each(function(term){
      if (term.name == name) {
        returnVal = term;
      }
    });
    return returnVal;
  };

  MySystem.Node.importJson = function(jsonText,contentBaseUrl) {
    var objs = eval(jsonText);
    var nodes = [];
    var wires = [];
    if (objs) {
      objs[0].containers.each(function(container) {
        var node = new MySystem.Node();
        if (typeof(contentBaseUrl) != 'undefined') {
          node.icon = contentBaseUrl + "/" + container.icon;
        }
        else {
          node.icon = container.icon;
        }
        node.x = (container.position[0].replace("px","")) / 1;
        node.y = (container.position[1].replace("px","")) / 1;
        node.name = container.name;

        node.terminals = container.terminals;
        nodes.push(node);
      });
    }
    return nodes;
  };



  MySystem.Wire = function() {
    this.source = null;
    this.target = null;
    this.x = 0;
    this.y = 0;
  };

  MySystem.Wire.importJson = function(jsonText,nodes) {
    var objs = eval(jsonText);
    var wires = [];
    if (objs) {
      objs[0].wires.each(function(w) {
        var wire = new MySystem.Wire();
        wire.src = w.src;
        wire.sourceNode = nodes[w.src.moduleId];
        wire.sourceTerminal = wire.sourceNode.terminal(w.src.terminal);

        wire.tgt = w.tgt;
        wire.targetNode = nodes[w.tgt.moduleId];
        wire.targetTerminal = wire.targetNode.terminal(w.tgt.terminal);

        wire.options = w.options;
        wire.fields = w.options.fields;
        wire.width = wire.fields.width;
        wire.name = wire.fields.name;
        wire.color = w.options.color;
        wire.color.name = wire.fields.color;

        wires.push(wire);
      });
    }
    return wires;
  };


  MySystemPrint = function(_json,dom_id,contentBaseUrl,width,height,scale_factor) {
    this.data = _json;
    this.name = "my print";
    this.scale =typeof(scale_factor) != 'undefined' ? scale_factor : 0.6;
    this.graphics = Raphael(document.getElementById(dom_id),width,height);
    this.nodes = MySystem.Node.importJson(_json,contentBaseUrl);
    this.wires = MySystem.Wire.importJson(_json,this.nodes);
    this.visContent = this.graphics.set();
    var self = this;

    this.nodes.each(function(node) {
      self.drawNode(node);
      self.visContent.push(node.rep);
    });

    this.wires.each(function(wire) {
      self.drawWire(wire);
      self.visContent.push(wire.rep);
    });
    this.wrapper = this.graphics;
  };

  MySystemPrint.prototype.drawNode = function(node) {
    node.rep = this.graphics.set();
    var x = node.x * this.scale;
    var y = node.y * this.scale;
    var size = 50 * this.scale;
    node.rep.push(this.graphics.image(node.icon,x,y,size,size)); // TODO: Fixed size==BAD
    var txt = this.graphics.text(x-10,y,node.name);
    txt.rotate(-90,true);
    node.rep.push(txt);
  };

  MySystemPrint.prototype.drawWire = function(wire) {
    wire.rep = this.graphics.connection(wire.sourceNode.rep,wire.targetNode.rep,wire.color,wire.color + "|" + (wire.width * this.scale));

    var srcX = wire.sourceNode.x,
        srcY = wire.sourceNode.y,
        tgtX = wire.targetNode.x,
        tgtY = wire.targetNode.y;

    var xDist = ( tgtX - srcX ) / 2;
    var yDist = ( tgtY - srcY ) / 2;

    var realX = ( srcX + xDist ) * this.scale,
        realY = ( srcY + yDist ) * this.scale;

    var txt = this.graphics.text( realX, realY, wire.name );


  }


}());
