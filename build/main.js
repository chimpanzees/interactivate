var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",Function(['require','module','exports','__dirname','__filename','process','global'],"function filter (xs, fn) {\n    var res = [];\n    for (var i = 0; i < xs.length; i++) {\n        if (fn(xs[i], i, xs)) res.push(xs[i]);\n    }\n    return res;\n}\n\n// resolves . and .. elements in a path array with directory names there\n// must be no slashes, empty elements, or device names (c:\\) in the array\n// (so also no leading and trailing slashes - it does not distinguish\n// relative and absolute paths)\nfunction normalizeArray(parts, allowAboveRoot) {\n  // if the path tries to go above the root, `up` ends up > 0\n  var up = 0;\n  for (var i = parts.length; i >= 0; i--) {\n    var last = parts[i];\n    if (last == '.') {\n      parts.splice(i, 1);\n    } else if (last === '..') {\n      parts.splice(i, 1);\n      up++;\n    } else if (up) {\n      parts.splice(i, 1);\n      up--;\n    }\n  }\n\n  // if the path is allowed to go above the root, restore leading ..s\n  if (allowAboveRoot) {\n    for (; up--; up) {\n      parts.unshift('..');\n    }\n  }\n\n  return parts;\n}\n\n// Regex to split a filename into [*, dir, basename, ext]\n// posix version\nvar splitPathRe = /^(.+\\/(?!$)|\\/)?((?:.+?)?(\\.[^.]*)?)$/;\n\n// path.resolve([from ...], to)\n// posix version\nexports.resolve = function() {\nvar resolvedPath = '',\n    resolvedAbsolute = false;\n\nfor (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {\n  var path = (i >= 0)\n      ? arguments[i]\n      : process.cwd();\n\n  // Skip empty and invalid entries\n  if (typeof path !== 'string' || !path) {\n    continue;\n  }\n\n  resolvedPath = path + '/' + resolvedPath;\n  resolvedAbsolute = path.charAt(0) === '/';\n}\n\n// At this point the path should be resolved to a full absolute path, but\n// handle relative paths to be safe (might happen when process.cwd() fails)\n\n// Normalize the path\nresolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {\n    return !!p;\n  }), !resolvedAbsolute).join('/');\n\n  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';\n};\n\n// path.normalize(path)\n// posix version\nexports.normalize = function(path) {\nvar isAbsolute = path.charAt(0) === '/',\n    trailingSlash = path.slice(-1) === '/';\n\n// Normalize the path\npath = normalizeArray(filter(path.split('/'), function(p) {\n    return !!p;\n  }), !isAbsolute).join('/');\n\n  if (!path && !isAbsolute) {\n    path = '.';\n  }\n  if (path && trailingSlash) {\n    path += '/';\n  }\n  \n  return (isAbsolute ? '/' : '') + path;\n};\n\n\n// posix version\nexports.join = function() {\n  var paths = Array.prototype.slice.call(arguments, 0);\n  return exports.normalize(filter(paths, function(p, index) {\n    return p && typeof p === 'string';\n  }).join('/'));\n};\n\n\nexports.dirname = function(path) {\n  var dir = splitPathRe.exec(path)[1] || '';\n  var isWindows = false;\n  if (!dir) {\n    // No dirname\n    return '.';\n  } else if (dir.length === 1 ||\n      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {\n    // It is just a slash or a drive letter with a slash\n    return dir;\n  } else {\n    // It is a full dirname, strip trailing slash\n    return dir.substring(0, dir.length - 1);\n  }\n};\n\n\nexports.basename = function(path, ext) {\n  var f = splitPathRe.exec(path)[2] || '';\n  // TODO: make this comparison case-insensitive on windows?\n  if (ext && f.substr(-1 * ext.length) === ext) {\n    f = f.substr(0, f.length - ext.length);\n  }\n  return f;\n};\n\n\nexports.extname = function(path) {\n  return splitPathRe.exec(path)[3] || '';\n};\n\n//@ sourceURL=path"
));

require.define("__browserify_process",Function(['require','module','exports','__dirname','__filename','process','global'],"var process = module.exports = {};\n\nprocess.nextTick = (function () {\n    var canSetImmediate = typeof window !== 'undefined'\n        && window.setImmediate;\n    var canPost = typeof window !== 'undefined'\n        && window.postMessage && window.addEventListener\n    ;\n\n    if (canSetImmediate) {\n        return window.setImmediate;\n    }\n\n    if (canPost) {\n        var queue = [];\n        window.addEventListener('message', function (ev) {\n            if (ev.source === window && ev.data === 'browserify-tick') {\n                ev.stopPropagation();\n                if (queue.length > 0) {\n                    var fn = queue.shift();\n                    fn();\n                }\n            }\n        }, true);\n\n        return function nextTick(fn) {\n            queue.push(fn);\n            window.postMessage('browserify-tick', '*');\n        };\n    }\n\n    return function nextTick(fn) {\n        setTimeout(fn, 0);\n    };\n})();\n\nprocess.title = 'browser';\nprocess.browser = true;\nprocess.env = {};\nprocess.argv = [];\n\nprocess.binding = function (name) {\n    if (name === 'evals') return (require)('vm')\n    else throw new Error('No such module. (Possibly not yet loaded)')\n};\n\n(function () {\n    var cwd = '/';\n    var path;\n    process.cwd = function () { return cwd };\n    process.chdir = function (dir) {\n        if (!path) path = require('path');\n        cwd = path.resolve(dir, cwd);\n    };\n})();\n\n//@ sourceURL=__browserify_process"
));

require.define("/package.json",Function(['require','module','exports','__dirname','__filename','process','global'],"module.exports = {\"main\":\"./interactivate.js\"}\n//@ sourceURL=/package.json"
));

require.define("/interactivate.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nvar diff = require(\"diffpatcher/diff\")\nvar patch = require(\"diffpatcher/patch\")\nvar render = require(\"./render\")\nvar CodeMirror = require(\"./code-mirror\")\n\nCodeMirror.defaults.interactiveEnabled = true\nCodeMirror.defaults.interactiveKey = \"Cmd-Enter\"\nCodeMirror.defaults.interactiveSpeed = 300\nCodeMirror.defaults.interactiveSeparator = /^\\/\\/ \\=\\>[^\\n]*$/m\n\n\nvar makeView = (function() {\n  var uri = \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAYAAAAMCAYAAABBV8wuAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAGpJREFUeNpi/P//PwM2wMSAA7CACEYggLKZgfgvEP8BCYAwKxALAjEPEH8B4g9MUI5IWlqayevXr9eCaCBfGGSSVnJysu/Xr1+fAx3y/9u3by9BfIb29vZCmCAMgCQZ/+NwL07nUlECIMAAMr41sxvv6oEAAAAASUVORK5CYII=\"\n  var template = document.createElement(\"div\")\n\n  template.style.marginLeft = \"-10px\"\n  template.style.padding = \"0\"\n  template.style.position = \"relative\"\n  template.style.marginRight = \"-10px\"\n  template.style.whiteSpace = \"normal\"\n\n  template.innerHTML = [\n    \"  <div class='cm-live-output-border-top'> </div>\",\n    \"  <div class='cm-live-output-box'>\",\n    \"    <h1 class='cm-live-output-head'>Out[0]</h1>\",\n    \"    <pre class='cm-live-output-body'>Hello output</pre>\",\n    \"  </div>\",\n    \"  <div class='cm-live-output-border-bottom'></div>\",\n  ].join(\"\\n\")\n\n    template.querySelector(\".cm-live-output-border-top\").setAttribute(\"style\", [\n    \"position: relative\",\n    \"z-index: 2\",\n    \"height: 12px\",\n    \"background-clip: padding-box\",\n    \"background: url('\" + uri + \"') top right repeat-x\"\n  ].join(\";\"))\n\n  template.querySelector(\".cm-live-output-border-bottom\").setAttribute(\"style\", [\n    \"position: relative\",\n    \"z-index: 2\",\n    \"height: 12px\",\n    \"background-clip: padding-box\",\n    \"background: url('\" + uri + \"') top left repeat-x\",\n    \"-webkit-transform: rotate(180deg)\",\n    \"transform: rotate(180deg)\"\n  ].join(\";\"))\n\n  template.querySelector(\".cm-live-output-box\").setAttribute(\"style\", [\n    \"-moz-box-shadow: 0 0 30px -2px #000\",\n    \"-webkit-box-shadow: 0 0 30px -2px #000\",\n    \"box-shadow: 0 0 30px -2px #000\",\n    \"color: black\",\n    \"background: white\",\n    \"position: relative\",\n    \"padding: 10px\",\n    \"margin: 0px\",\n    \"display: -webkit-box\",\n    \"display: -moz-box\",\n    \"display: -moz-flex;\",\n    \"-webkit-box-flex: 2\",\n    \"-moz-box-flex: 2\",\n    \"box-flex: 2\",\n    \"width: 100%\"\n  ].join(\";\"))\n\n  template.querySelector(\".cm-live-output-head\").setAttribute(\"style\", [\n    \"-webkit-box-flex: 0\",\n    \"-moz-box-flex: 0\",\n    \"box-flex: 0\",\n    \"margin: 0 10px 0 0\",\n    \"whitespace: pre\",\n    \"color: white\",\n    \"text-shadow: 0px 1px 5px #000\"\n  ].join(\";\"))\n  template.querySelector(\".cm-live-output-body\").setAttribute(\"style\", [\n    \"-webkit-box-flex: 1\",\n    \"-moz-box-flex: 1\",\n    \"box-flex: 1\",\n    \"padding-right: 30px\"\n  ].join(\";\"))\n\n  return function makeView(editor, line) {\n    var view = template.cloneNode(true)\n\n    editor.markText({ line: line, ch: 0 },\n                    { line: line + 1, ch: 0 },\n                    { atomic: true, replacedWith: view })\n\n    return view\n  }\n})()\n\nmodule.exports = function interactive(editor) {\n  var state = {}\n  var View = {}\n  var Out = {}\n  var id = -1\n\n  window.Out = Out\n\n  function apply(delta) {\n    Object.keys(delta).forEach(function(id) {\n      var In = delta[id]\n      editor.operation(function() {\n        if (In === null) {\n          delete Out[id]\n          delete View[id]\n        } else {\n          var view = View[id] || (View[id] = makeView(editor, In.line))\n          try {\n            Out[id] = window.eval(In.source)\n          } catch (error) {\n            Out[id] = error\n          }\n          var label = view.querySelector(\".cm-live-output-head\")\n          var code = view.querySelector(\".cm-live-output-body\")\n          label.textContent = \"Out[\" + id + \"] = \"\n          code.innerHTML = \"<span></span>\"\n          var out = render(Out[id])\n          if (out instanceof Element)\n            code.replaceChild(out, code.children[0])\n          else\n            code.textContent = out\n        }\n      })\n    })\n    state = patch(state, delta)\n  }\n\n  function calculate() {\n    var source = editor.getValue()\n    var separator = editor.getOption(\"interactiveSeparator\")\n    var sections = source.split(separator)\n    sections.pop()\n    var update = Object.keys(sections).reduce(function(result, index) {\n      var source = sections[index]\n      var out = result.out + source.split(\"\\n\").length - 1\n      result.out = out\n      result.state[index] = {\n        source: source,\n        line: out\n      }\n\n      return result\n    }, { out: 0, state: {} })\n\n    var delta = diff(state, update.state)\n    apply(delta)\n  }\n\n  editor.on(\"change\", function(editor, change) {\n    clearTimeout(id)\n    id = setTimeout(calculate, editor.getOption(\"interactiveSpeed\"), change)\n  })\n\n  function print(editor) {\n    if (!editor.getOption(\"interactiveEnabled\")) throw CodeMirror.Pass\n    editor.operation(function() {\n      var cursor = editor.getCursor()\n      editor.replaceSelection(\"\\n// =>\\n\")\n      editor.setCursor({ line: cursor.line + 2, ch: 0 })\n    })\n  }\n\n  CodeMirror.keyMap.default[editor.getOption(\"interactiveKey\")] = print\n}\n\n//@ sourceURL=/interactivate.js"
));

require.define("/node_modules/diffpatcher/package.json",Function(['require','module','exports','__dirname','__filename','process','global'],"module.exports = {\"main\":\"./index.js\"}\n//@ sourceURL=/node_modules/diffpatcher/package.json"
));

require.define("/node_modules/diffpatcher/diff.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nvar method = require(\"method\")\n\n// Method is designed to work with data structures representing application\n// state. Calling it with a state should return object representing `delta`\n// that has being applied to a previous state to get to a current state.\n//\n// Example\n//\n// diff(state) // => { \"item-id-1\": { title: \"some title\" } \"item-id-2\": null }\nvar diff = method(\"diff\")\n\n// diff between `null` / `undefined` to any hash is a hash itself.\ndiff.define(null, function(from, to) { return to })\ndiff.define(undefined, function(from, to) { return to })\ndiff.define(Object, function(from, to) {\n  return calculate(from, to || {}) || {}\n})\n\nfunction calculate(from, to) {\n  var diff = {}\n  var changes = 0\n  Object.keys(from).forEach(function(key) {\n    changes = changes + 1\n    if (!(key in to) && from[key] != null) diff[key] = null\n    else changes = changes - 1\n  })\n  Object.keys(to).forEach(function(key) {\n    changes = changes + 1\n    var previous = from[key]\n    var current = to[key]\n    if (previous === current) return (changes = changes - 1)\n    if (typeof(current) !== \"object\") return diff[key] = current\n    if (typeof(previous) !== \"object\") return diff[key] = current\n    var delta = calculate(previous, current)\n    if (delta) diff[key] = delta\n    else changes = changes - 1\n  })\n  return changes ? diff : null\n}\n\ndiff.calculate = calculate\n\nmodule.exports = diff\n\n//@ sourceURL=/node_modules/diffpatcher/diff.js"
));

require.define("/node_modules/method/package.json",Function(['require','module','exports','__dirname','__filename','process','global'],"module.exports = {\"main\":\"./core.js\"}\n//@ sourceURL=/node_modules/method/package.json"
));

require.define("/node_modules/method/core.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nvar defineProperty = Object.defineProperty || function(object, name, property) {\n  object[name] = property.value\n  return object\n}\n\n// Shortcut for `Object.prototype.toString` for faster access.\nvar typefy = Object.prototype.toString\n\n// Map to for jumping from typeof(value) to associated type prefix used\n// as a hash in the map of builtin implementations.\nvar types = { \"function\": \"Object\", \"object\": \"Object\" }\n\n// Array is used to save method implementations for the host objects in order\n// to avoid extending them with non-primitive values that could cause leaks.\nvar host = []\n// Hash map is used to save method implementations for builtin types in order\n// to avoid extending their prototypes. This also allows to share method\n// implementations for types across diff contexts / frames / compartments.\nvar builtin = {}\n\nfunction Primitive() {}\nfunction ObjectType() {}\nObjectType.prototype = new Primitive()\nfunction ErrorType() {}\nErrorType.prototype = new ObjectType()\n\nvar Default = builtin.Default = Primitive.prototype\nvar Null = builtin.Null = new Primitive()\nvar Void = builtin.Void = new Primitive()\nbuiltin.String = new Primitive()\nbuiltin.Number = new Primitive()\nbuiltin.Boolean = new Primitive()\n\nbuiltin.Object = ObjectType.prototype\nbuiltin.Error = ErrorType.prototype\n\nbuiltin.EvalError = new ErrorType()\nbuiltin.InternalError = new ErrorType()\nbuiltin.RangeError = new ErrorType()\nbuiltin.ReferenceError = new ErrorType()\nbuiltin.StopIteration = new ErrorType()\nbuiltin.SyntaxError = new ErrorType()\nbuiltin.TypeError = new ErrorType()\nbuiltin.URIError = new ErrorType()\n\n\nfunction Method(hint) {\n  /**\n  Private Method is a callable private name that dispatches on the first\n  arguments same named Method:\n\n      method(object, ...rest) => object[method](...rest)\n\n  Optionally hint string may be provided that will be used in generated names\n  to ease debugging.\n\n  ## Example\n\n      var foo = Method()\n\n      // Implementation for any types\n      foo.define(function(value, arg1, arg2) {\n        // ...\n      })\n\n      // Implementation for a specific type\n      foo.define(BarType, function(bar, arg1, arg2) {\n        // ...\n      })\n  **/\n\n  // Create an internal unique name if `hint` is provided it is used to\n  // prefix name to ease debugging.\n  var name = (hint || \"\") + \"#\" + Math.random().toString(32).substr(2)\n\n  function dispatch(value) {\n    // Method dispatches on type of the first argument.\n    // If first argument is `null` or `void` associated implementation is\n    // looked up in the `builtin` hash where implementations for built-ins\n    // are stored.\n    var type = null\n    var method = value === null ? Null[name] :\n                 value === void(0) ? Void[name] :\n                 // Otherwise attempt to use method with a generated private\n                 // `name` that is supposedly in the prototype chain of the\n                 // `target`.\n                 value[name] ||\n                 // Otherwise assume it's one of the built-in type instances,\n                 // in which case implementation is stored in a `builtin` hash.\n                 // Attempt to find a implementation for the given built-in\n                 // via constructor name and method name.\n                 ((type = builtin[(value.constructor || \"\").name]) &&\n                  type[name]) ||\n                 // Otherwise assume it's a host object. For host objects\n                 // actual method implementations are stored in the `host`\n                 // array and only index for the implementation is stored\n                 // in the host object's prototype chain. This avoids memory\n                 // leaks that otherwise could happen when saving JS objects\n                 // on host object.\n                 host[value[\"!\" + name]] ||\n                 // Otherwise attempt to lookup implementation for builtins by\n                 // a type of the value. This basically makes sure that all\n                 // non primitive values will delegate to an `Object`.\n                 ((type = builtin[types[typeof(value)]]) && type[name])\n\n\n    // If method implementation for the type is still not found then\n    // just fallback for default implementation.\n    method = method || Default[name]\n\n\n    // If implementation is still not found (which also means there is no\n    // default) just throw an error with a descriptive message.\n    if (!method) throw TypeError(\"Type does not implements method: \" + name)\n\n    // If implementation was found then just delegate.\n    return method.apply(method, arguments)\n  }\n\n  // Make `toString` of the dispatch return a private name, this enables\n  // method definition without sugar:\n  //\n  //    var method = Method()\n  //    object[method] = function() { /***/ }\n  dispatch.toString = function toString() { return name }\n\n  // Copy utility methods for convenient API.\n  dispatch.implement = implementMethod\n  dispatch.define = defineMethod\n\n  return dispatch\n}\n\n// Define `implement` and `define` polymorphic methods to allow definitions\n// and implementations through them.\nvar implement = Method(\"implement\")\nvar define = Method(\"define\")\n\n\nfunction _implement(method, object, lambda) {\n  /**\n  Implements `Method` for the given `object` with a provided `implementation`.\n  Calling `Method` with `object` as a first argument will dispatch on provided\n  implementation.\n  **/\n  return defineProperty(object, method.toString(), {\n    enumerable: false,\n    configurable: false,\n    writable: false,\n    value: lambda\n  })\n}\n\nfunction _define(method, Type, lambda) {\n  /**\n  Defines `Method` for the given `Type` with a provided `implementation`.\n  Calling `Method` with a first argument of this `Type` will dispatch on\n  provided `implementation`. If `Type` is a `Method` default implementation\n  is defined. If `Type` is a `null` or `undefined` `Method` is implemented\n  for that value type.\n  **/\n\n  // Attempt to guess a type via `Object.prototype.toString.call` hack.\n  var type = Type && typefy.call(Type.prototype)\n\n  // If only two arguments are passed then `Type` is actually an implementation\n  // for a default type.\n  if (!lambda) Default[method] = Type\n  // If `Type` is `null` or `void` store implementation accordingly.\n  else if (Type === null) Null[method] = lambda\n  else if (Type === void(0)) Void[method] = lambda\n  // If `type` hack indicates built-in type and type has a name us it to\n  // store a implementation into associated hash. If hash for this type does\n  // not exists yet create one.\n  else if (type !== \"[object Object]\" && Type.name) {\n    var Bulitin = builtin[Type.name] || (builtin[Type.name] = new ObjectType())\n    Bulitin[method] = lambda\n  }\n  // If `type` hack indicates an object, that may be either object or any\n  // JS defined \"Class\". If name of the constructor is `Object`, assume it's\n  // built-in `Object` and store implementation accordingly.\n  else if (Type.name === \"Object\")\n    builtin.Object[method] = lambda\n  // Host objects are pain!!! Every browser does some crazy stuff for them\n  // So far all browser seem to not implement `call` method for host object\n  // constructors. If that is a case here, assume it's a host object and\n  // store implementation in a `host` array and store `index` in the array\n  // in a `Type.prototype` itself. This avoids memory leaks that could be\n  // caused by storing JS objects on a host objects.\n  else if (Type.call === void(0)) {\n    var index = host.indexOf(lambda)\n    if (index < 0) index = host.push(lambda) - 1\n    // Prefix private name with `!` so it can be dispatched from the method\n    // without type checks.\n    implement(\"!\" + method, Type.prototype, index)\n  }\n  // If Got that far `Type` is user defined JS `Class`. Define private name\n  // as hidden property on it's prototype.\n  else\n    implement(method, Type.prototype, lambda)\n}\n\n// Create method shortcuts form functions.\nvar defineMethod = function defineMethod(Type, lambda) {\n  return _define(this, Type, lambda)\n}\nvar implementMethod = function implementMethod(object, lambda) {\n  return _implement(this, object, lambda)\n}\n\n// And provided implementations for a polymorphic equivalents.\n_define(define, _define)\n_define(implement, _implement)\n\n// Define exports on `Method` as it's only thing being exported.\nMethod.implement = implement\nMethod.define = define\nMethod.Method = Method\nMethod.builtin = builtin\nMethod.host = host\n\nmodule.exports = Method\n\n//@ sourceURL=/node_modules/method/core.js"
));

require.define("/node_modules/diffpatcher/patch.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nvar method = require(\"method\")\nvar rebase = require(\"./rebase\")\n\n// Method is designed to work with data structures representing application\n// state. Calling it with a state and delta should return object representing\n// new state, with changes in `delta` being applied to previous.\n//\n// ## Example\n//\n// patch(state, {\n//   \"item-id-1\": { completed: false }, // update\n//   \"item-id-2\": null                  // delete\n// })\nvar patch = method(\"patch\")\npatch.define(Object, function patch(hash, delta) {\n  return rebase({}, hash, delta)\n})\n\nmodule.exports = patch\n\n//@ sourceURL=/node_modules/diffpatcher/patch.js"
));

require.define("/node_modules/diffpatcher/rebase.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nfunction rebase(result, parent, delta) {\n  Object.keys(parent).forEach(function(key) {\n    // If `parent[key]` is `null` it means attribute was deleted in previous\n    // update. We skip such properties as there is no use in keeping them\n    // around. If `delta[key]` is `null` we skip these properties too as\n    // the have being deleted.\n    if (!(parent[key] == null || (key in delta && delta[key] == null)))\n      result[key] = parent[key]\n  }, result)\n  Object.keys(delta).forEach(function(key) {\n    if (key in parent) {\n      var current = delta[key]\n      var previous = parent[key]\n      if (current === previous) current = current\n      // If `delta[key]` is `null` it's delete so we just skip property.\n      else if (current == null) current = current\n      // If value is of primitive type (function or regexps should not\n      // even be here) we just update in place.\n      else if (typeof(current) !== \"object\") result[key] = current\n      // If previous value associated with this key was primitive\n      // and it's mapped to non primitive\n      else if (typeof(previous) !== \"object\") result[key] = current\n      else result[key] = rebase({}, previous, current)\n    } else {\n      result[key] = delta[key]\n    }\n  })\n  return result\n}\n\nmodule.exports = rebase\n\n//@ sourceURL=/node_modules/diffpatcher/rebase.js"
));

require.define("/render.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nvar method = require(\"method\")\nvar util = require(\"util\")\n\n\n// Render function takes arbitrary data structure and returns something\n// that can visually represent it.\nvar render = method(\"render\")\n\nrender.define(function(value) {\n  return util.inspect(value)\n})\n\nrender.define(Error, function(error) {\n  return String(error)\n})\n\nrender.define(Element, function(element) {\n  return element\n})\n\nmodule.exports = render\n\n//@ sourceURL=/render.js"
));

require.define("util",Function(['require','module','exports','__dirname','__filename','process','global'],"var events = require('events');\n\nexports.print = function () {};\nexports.puts = function () {};\nexports.debug = function() {};\n\nexports.inspect = function(obj, showHidden, depth, colors) {\n  var seen = [];\n\n  var stylize = function(str, styleType) {\n    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics\n    var styles =\n        { 'bold' : [1, 22],\n          'italic' : [3, 23],\n          'underline' : [4, 24],\n          'inverse' : [7, 27],\n          'white' : [37, 39],\n          'grey' : [90, 39],\n          'black' : [30, 39],\n          'blue' : [34, 39],\n          'cyan' : [36, 39],\n          'green' : [32, 39],\n          'magenta' : [35, 39],\n          'red' : [31, 39],\n          'yellow' : [33, 39] };\n\n    var style =\n        { 'special': 'cyan',\n          'number': 'blue',\n          'boolean': 'yellow',\n          'undefined': 'grey',\n          'null': 'bold',\n          'string': 'green',\n          'date': 'magenta',\n          // \"name\": intentionally not styling\n          'regexp': 'red' }[styleType];\n\n    if (style) {\n      return '\\033[' + styles[style][0] + 'm' + str +\n             '\\033[' + styles[style][1] + 'm';\n    } else {\n      return str;\n    }\n  };\n  if (! colors) {\n    stylize = function(str, styleType) { return str; };\n  }\n\n  function format(value, recurseTimes) {\n    // Provide a hook for user-specified inspect functions.\n    // Check that value is an object with an inspect function on it\n    if (value && typeof value.inspect === 'function' &&\n        // Filter out the util module, it's inspect function is special\n        value !== exports &&\n        // Also filter out any prototype objects using the circular check.\n        !(value.constructor && value.constructor.prototype === value)) {\n      return value.inspect(recurseTimes);\n    }\n\n    // Primitive types cannot have properties\n    switch (typeof value) {\n      case 'undefined':\n        return stylize('undefined', 'undefined');\n\n      case 'string':\n        var simple = '\\'' + JSON.stringify(value).replace(/^\"|\"$/g, '')\n                                                 .replace(/'/g, \"\\\\'\")\n                                                 .replace(/\\\\\"/g, '\"') + '\\'';\n        return stylize(simple, 'string');\n\n      case 'number':\n        return stylize('' + value, 'number');\n\n      case 'boolean':\n        return stylize('' + value, 'boolean');\n    }\n    // For some reason typeof null is \"object\", so special case here.\n    if (value === null) {\n      return stylize('null', 'null');\n    }\n\n    // Look up the keys of the object.\n    var visible_keys = Object_keys(value);\n    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;\n\n    // Functions without properties can be shortcutted.\n    if (typeof value === 'function' && keys.length === 0) {\n      if (isRegExp(value)) {\n        return stylize('' + value, 'regexp');\n      } else {\n        var name = value.name ? ': ' + value.name : '';\n        return stylize('[Function' + name + ']', 'special');\n      }\n    }\n\n    // Dates without properties can be shortcutted\n    if (isDate(value) && keys.length === 0) {\n      return stylize(value.toUTCString(), 'date');\n    }\n\n    var base, type, braces;\n    // Determine the object type\n    if (isArray(value)) {\n      type = 'Array';\n      braces = ['[', ']'];\n    } else {\n      type = 'Object';\n      braces = ['{', '}'];\n    }\n\n    // Make functions say that they are functions\n    if (typeof value === 'function') {\n      var n = value.name ? ': ' + value.name : '';\n      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';\n    } else {\n      base = '';\n    }\n\n    // Make dates with properties first say the date\n    if (isDate(value)) {\n      base = ' ' + value.toUTCString();\n    }\n\n    if (keys.length === 0) {\n      return braces[0] + base + braces[1];\n    }\n\n    if (recurseTimes < 0) {\n      if (isRegExp(value)) {\n        return stylize('' + value, 'regexp');\n      } else {\n        return stylize('[Object]', 'special');\n      }\n    }\n\n    seen.push(value);\n\n    var output = keys.map(function(key) {\n      var name, str;\n      if (value.__lookupGetter__) {\n        if (value.__lookupGetter__(key)) {\n          if (value.__lookupSetter__(key)) {\n            str = stylize('[Getter/Setter]', 'special');\n          } else {\n            str = stylize('[Getter]', 'special');\n          }\n        } else {\n          if (value.__lookupSetter__(key)) {\n            str = stylize('[Setter]', 'special');\n          }\n        }\n      }\n      if (visible_keys.indexOf(key) < 0) {\n        name = '[' + key + ']';\n      }\n      if (!str) {\n        if (seen.indexOf(value[key]) < 0) {\n          if (recurseTimes === null) {\n            str = format(value[key]);\n          } else {\n            str = format(value[key], recurseTimes - 1);\n          }\n          if (str.indexOf('\\n') > -1) {\n            if (isArray(value)) {\n              str = str.split('\\n').map(function(line) {\n                return '  ' + line;\n              }).join('\\n').substr(2);\n            } else {\n              str = '\\n' + str.split('\\n').map(function(line) {\n                return '   ' + line;\n              }).join('\\n');\n            }\n          }\n        } else {\n          str = stylize('[Circular]', 'special');\n        }\n      }\n      if (typeof name === 'undefined') {\n        if (type === 'Array' && key.match(/^\\d+$/)) {\n          return str;\n        }\n        name = JSON.stringify('' + key);\n        if (name.match(/^\"([a-zA-Z_][a-zA-Z_0-9]*)\"$/)) {\n          name = name.substr(1, name.length - 2);\n          name = stylize(name, 'name');\n        } else {\n          name = name.replace(/'/g, \"\\\\'\")\n                     .replace(/\\\\\"/g, '\"')\n                     .replace(/(^\"|\"$)/g, \"'\");\n          name = stylize(name, 'string');\n        }\n      }\n\n      return name + ': ' + str;\n    });\n\n    seen.pop();\n\n    var numLinesEst = 0;\n    var length = output.reduce(function(prev, cur) {\n      numLinesEst++;\n      if (cur.indexOf('\\n') >= 0) numLinesEst++;\n      return prev + cur.length + 1;\n    }, 0);\n\n    if (length > 50) {\n      output = braces[0] +\n               (base === '' ? '' : base + '\\n ') +\n               ' ' +\n               output.join(',\\n  ') +\n               ' ' +\n               braces[1];\n\n    } else {\n      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];\n    }\n\n    return output;\n  }\n  return format(obj, (typeof depth === 'undefined' ? 2 : depth));\n};\n\n\nfunction isArray(ar) {\n  return ar instanceof Array ||\n         Array.isArray(ar) ||\n         (ar && ar !== Object.prototype && isArray(ar.__proto__));\n}\n\n\nfunction isRegExp(re) {\n  return re instanceof RegExp ||\n    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');\n}\n\n\nfunction isDate(d) {\n  if (d instanceof Date) return true;\n  if (typeof d !== 'object') return false;\n  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);\n  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);\n  return JSON.stringify(proto) === JSON.stringify(properties);\n}\n\nfunction pad(n) {\n  return n < 10 ? '0' + n.toString(10) : n.toString(10);\n}\n\nvar months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',\n              'Oct', 'Nov', 'Dec'];\n\n// 26 Feb 16:19:34\nfunction timestamp() {\n  var d = new Date();\n  var time = [pad(d.getHours()),\n              pad(d.getMinutes()),\n              pad(d.getSeconds())].join(':');\n  return [d.getDate(), months[d.getMonth()], time].join(' ');\n}\n\nexports.log = function (msg) {};\n\nexports.pump = null;\n\nvar Object_keys = Object.keys || function (obj) {\n    var res = [];\n    for (var key in obj) res.push(key);\n    return res;\n};\n\nvar Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {\n    var res = [];\n    for (var key in obj) {\n        if (Object.hasOwnProperty.call(obj, key)) res.push(key);\n    }\n    return res;\n};\n\nvar Object_create = Object.create || function (prototype, properties) {\n    // from es5-shim\n    var object;\n    if (prototype === null) {\n        object = { '__proto__' : null };\n    }\n    else {\n        if (typeof prototype !== 'object') {\n            throw new TypeError(\n                'typeof prototype[' + (typeof prototype) + '] != \\'object\\''\n            );\n        }\n        var Type = function () {};\n        Type.prototype = prototype;\n        object = new Type();\n        object.__proto__ = prototype;\n    }\n    if (typeof properties !== 'undefined' && Object.defineProperties) {\n        Object.defineProperties(object, properties);\n    }\n    return object;\n};\n\nexports.inherits = function(ctor, superCtor) {\n  ctor.super_ = superCtor;\n  ctor.prototype = Object_create(superCtor.prototype, {\n    constructor: {\n      value: ctor,\n      enumerable: false,\n      writable: true,\n      configurable: true\n    }\n  });\n};\n\nvar formatRegExp = /%[sdj%]/g;\nexports.format = function(f) {\n  if (typeof f !== 'string') {\n    var objects = [];\n    for (var i = 0; i < arguments.length; i++) {\n      objects.push(exports.inspect(arguments[i]));\n    }\n    return objects.join(' ');\n  }\n\n  var i = 1;\n  var args = arguments;\n  var len = args.length;\n  var str = String(f).replace(formatRegExp, function(x) {\n    if (x === '%%') return '%';\n    if (i >= len) return x;\n    switch (x) {\n      case '%s': return String(args[i++]);\n      case '%d': return Number(args[i++]);\n      case '%j': return JSON.stringify(args[i++]);\n      default:\n        return x;\n    }\n  });\n  for(var x = args[i]; i < len; x = args[++i]){\n    if (x === null || typeof x !== 'object') {\n      str += ' ' + x;\n    } else {\n      str += ' ' + exports.inspect(x);\n    }\n  }\n  return str;\n};\n\n//@ sourceURL=util"
));

require.define("events",Function(['require','module','exports','__dirname','__filename','process','global'],"if (!process.EventEmitter) process.EventEmitter = function () {};\n\nvar EventEmitter = exports.EventEmitter = process.EventEmitter;\nvar isArray = typeof Array.isArray === 'function'\n    ? Array.isArray\n    : function (xs) {\n        return Object.prototype.toString.call(xs) === '[object Array]'\n    }\n;\n\n// By default EventEmitters will print a warning if more than\n// 10 listeners are added to it. This is a useful default which\n// helps finding memory leaks.\n//\n// Obviously not all Emitters should be limited to 10. This function allows\n// that to be increased. Set to zero for unlimited.\nvar defaultMaxListeners = 10;\nEventEmitter.prototype.setMaxListeners = function(n) {\n  if (!this._events) this._events = {};\n  this._events.maxListeners = n;\n};\n\n\nEventEmitter.prototype.emit = function(type) {\n  // If there is no 'error' event listener then throw.\n  if (type === 'error') {\n    if (!this._events || !this._events.error ||\n        (isArray(this._events.error) && !this._events.error.length))\n    {\n      if (arguments[1] instanceof Error) {\n        throw arguments[1]; // Unhandled 'error' event\n      } else {\n        throw new Error(\"Uncaught, unspecified 'error' event.\");\n      }\n      return false;\n    }\n  }\n\n  if (!this._events) return false;\n  var handler = this._events[type];\n  if (!handler) return false;\n\n  if (typeof handler == 'function') {\n    switch (arguments.length) {\n      // fast cases\n      case 1:\n        handler.call(this);\n        break;\n      case 2:\n        handler.call(this, arguments[1]);\n        break;\n      case 3:\n        handler.call(this, arguments[1], arguments[2]);\n        break;\n      // slower\n      default:\n        var args = Array.prototype.slice.call(arguments, 1);\n        handler.apply(this, args);\n    }\n    return true;\n\n  } else if (isArray(handler)) {\n    var args = Array.prototype.slice.call(arguments, 1);\n\n    var listeners = handler.slice();\n    for (var i = 0, l = listeners.length; i < l; i++) {\n      listeners[i].apply(this, args);\n    }\n    return true;\n\n  } else {\n    return false;\n  }\n};\n\n// EventEmitter is defined in src/node_events.cc\n// EventEmitter.prototype.emit() is also defined there.\nEventEmitter.prototype.addListener = function(type, listener) {\n  if ('function' !== typeof listener) {\n    throw new Error('addListener only takes instances of Function');\n  }\n\n  if (!this._events) this._events = {};\n\n  // To avoid recursion in the case that type == \"newListeners\"! Before\n  // adding it to the listeners, first emit \"newListeners\".\n  this.emit('newListener', type, listener);\n\n  if (!this._events[type]) {\n    // Optimize the case of one listener. Don't need the extra array object.\n    this._events[type] = listener;\n  } else if (isArray(this._events[type])) {\n\n    // Check for listener leak\n    if (!this._events[type].warned) {\n      var m;\n      if (this._events.maxListeners !== undefined) {\n        m = this._events.maxListeners;\n      } else {\n        m = defaultMaxListeners;\n      }\n\n      if (m && m > 0 && this._events[type].length > m) {\n        this._events[type].warned = true;\n        console.error('(node) warning: possible EventEmitter memory ' +\n                      'leak detected. %d listeners added. ' +\n                      'Use emitter.setMaxListeners() to increase limit.',\n                      this._events[type].length);\n        console.trace();\n      }\n    }\n\n    // If we've already got an array, just append.\n    this._events[type].push(listener);\n  } else {\n    // Adding the second element, need to change to array.\n    this._events[type] = [this._events[type], listener];\n  }\n\n  return this;\n};\n\nEventEmitter.prototype.on = EventEmitter.prototype.addListener;\n\nEventEmitter.prototype.once = function(type, listener) {\n  var self = this;\n  self.on(type, function g() {\n    self.removeListener(type, g);\n    listener.apply(this, arguments);\n  });\n\n  return this;\n};\n\nEventEmitter.prototype.removeListener = function(type, listener) {\n  if ('function' !== typeof listener) {\n    throw new Error('removeListener only takes instances of Function');\n  }\n\n  // does not use listeners(), so no side effect of creating _events[type]\n  if (!this._events || !this._events[type]) return this;\n\n  var list = this._events[type];\n\n  if (isArray(list)) {\n    var i = list.indexOf(listener);\n    if (i < 0) return this;\n    list.splice(i, 1);\n    if (list.length == 0)\n      delete this._events[type];\n  } else if (this._events[type] === listener) {\n    delete this._events[type];\n  }\n\n  return this;\n};\n\nEventEmitter.prototype.removeAllListeners = function(type) {\n  // does not use listeners(), so no side effect of creating _events[type]\n  if (type && this._events && this._events[type]) this._events[type] = null;\n  return this;\n};\n\nEventEmitter.prototype.listeners = function(type) {\n  if (!this._events) this._events = {};\n  if (!this._events[type]) this._events[type] = [];\n  if (!isArray(this._events[type])) {\n    this._events[type] = [this._events[type]];\n  }\n  return this._events[type];\n};\n\n//@ sourceURL=events"
));

require.define("/code-mirror/index.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nmodule.exports = CodeMirror\n\n//@ sourceURL=/code-mirror/index.js"
));

require.define("/code-mirror/active-line.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nmodule.exports = function activeLinePlugin(editor) {\n  /**\n  Takes code-mirror editor and enables active-line highlighting\n  **/\n\n  var activeLine = editor.addLineClass(0, \"background\", \"activeline\")\n  editor.on(\"cursorActivity\", function onCursorActivity() {\n    var line = editor.getLineHandle(editor.getCursor().line)\n    if (line != activeLine) {\n      editor.removeLineClass(activeLine, \"background\", \"activeline\")\n      activeLine = editor.addLineClass(line, \"background\", \"activeline\")\n    }\n  })\n}\n\n//@ sourceURL=/code-mirror/active-line.js"
));

require.define("/code-mirror/persist.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nvar address = window.location.href\n\nmodule.exports = function persist(editor) {\n  /**\n  Takes editor and enables persists changes to the buffer across the sessions.\n  **/\n\n  editor.setValue(localStorage[address] || \"\")\n  editor.on(\"change\", function() {\n    localStorage[address] = editor.getValue()\n  })\n}\n\n//@ sourceURL=/code-mirror/persist.js"
));

require.define("/main.js",Function(['require','module','exports','__dirname','__filename','process','global'],"\"use strict\";\n\nvar interactivate = require(\"./interactivate\")\n\nvar CodeMirror = require(\"./code-mirror\")\nvar activeLine = require(\"./code-mirror/active-line\")\nvar persist = require(\"./code-mirror/persist\")\n\nvar editor = CodeMirror(document.body, {\n  electricChars: true,\n  autofocus: true,\n  theme: \"solarized dark\",\n  mode: \"javascript\",\n})\n\n// Enable interactive mode for this editor.\ninteractivate(editor)\n// Enable active line highlighting.\nactiveLine(editor)\n// Enable persistence of the editor buffer.\npersist(editor)\n\n//@ sourceURL=/main.js"
));
require("/main.js");
