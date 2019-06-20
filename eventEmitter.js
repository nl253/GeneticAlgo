var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var EventEmitter = (function () {
        function EventEmitter() {
            this.events = new Map();
        }
        EventEmitter.prototype._ensureExists = function (e) {
            if (this.events.get(e) === undefined) {
                this.events.set(e, []);
            }
        };
        EventEmitter.prototype.emit = function (e) {
            var e_1, _a;
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            this._ensureExists(e);
            try {
                for (var _b = __values(this.events.get(e)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var f = _c.value;
                    f.apply(void 0, __spread(args));
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        EventEmitter.prototype.on = function (e, f) {
            this._ensureExists(e);
            this.events.get(e).push(f);
        };
        return EventEmitter;
    }());
    exports.EventEmitter = EventEmitter;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRFbWl0dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZXZlbnRFbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBS0E7UUFBQTtZQUNtQixXQUFNLEdBQWdELElBQUksR0FBRyxFQUFFLENBQUM7UUFtQm5GLENBQUM7UUFqQlMsb0NBQWEsR0FBckIsVUFBc0IsQ0FBUztZQUM3QixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLFNBQVMsRUFBRTtnQkFDcEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQ3hCO1FBQ0gsQ0FBQztRQUVNLDJCQUFJLEdBQVgsVUFBWSxDQUFTOztZQUFFLGNBQWM7aUJBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztnQkFBZCw2QkFBYzs7WUFDbkMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7Z0JBQ3RCLEtBQWdCLElBQUEsS0FBQSxTQUFpQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUUsQ0FBQSxnQkFBQSw0QkFBRTtvQkFBakUsSUFBTSxDQUFDLFdBQUE7b0JBQ1YsQ0FBQyx3QkFBSSxJQUFJLEdBQUU7aUJBQ1o7Ozs7Ozs7OztRQUNILENBQUM7UUFFTSx5QkFBRSxHQUFULFVBQVUsQ0FBUyxFQUFFLENBQTBCO1lBQzdDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDVyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUNILG1CQUFDO0lBQUQsQ0FBQyxBQXBCRCxJQW9CQztJQXBCWSxvQ0FBWSJ9