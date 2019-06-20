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
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            this._ensureExists(e);
            for (var _a = 0, _b = this.events.get(e); _a < _b.length; _a++) {
                var f = _b[_a];
                f.apply(void 0, args);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRFbWl0dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZXZlbnRFbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0lBS0E7UUFBQTtZQUNtQixXQUFNLEdBQWdELElBQUksR0FBRyxFQUFFLENBQUM7UUFtQm5GLENBQUM7UUFqQlMsb0NBQWEsR0FBckIsVUFBc0IsQ0FBUztZQUM3QixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLFNBQVMsRUFBRTtnQkFDcEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2FBQ3hCO1FBQ0gsQ0FBQztRQUVNLDJCQUFJLEdBQVgsVUFBWSxDQUFTO1lBQUUsY0FBYztpQkFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO2dCQUFkLDZCQUFjOztZQUNuQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RCLEtBQWdCLFVBQW9ELEVBQXBELEtBQWlDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRSxFQUFwRCxjQUFvRCxFQUFwRCxJQUFvRCxFQUFFO2dCQUFqRSxJQUFNLENBQUMsU0FBQTtnQkFDVixDQUFDLGVBQUksSUFBSSxFQUFFO2FBQ1o7UUFDSCxDQUFDO1FBRU0seUJBQUUsR0FBVCxVQUFVLENBQVMsRUFBRSxDQUEwQjtZQUM3QyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ1csSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFDSCxtQkFBQztJQUFELENBQUMsQUFwQkQsSUFvQkM7SUFwQlksb0NBQVkifQ==