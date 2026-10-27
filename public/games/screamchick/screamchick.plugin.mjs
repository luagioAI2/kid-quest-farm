//#region engines/pixi.min.mjs
var e = Object.defineProperty, t = Object.getOwnPropertySymbols, n = Object.prototype.hasOwnProperty, r = Object.prototype.propertyIsEnumerable, i = (t, n, r) => n in t ? e(t, n, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: r
}) : t[n] = r, a = (e, a) => {
	for (var o in a ||= {}) n.call(a, o) && i(e, o, a[o]);
	if (t) for (var o of t(a)) r.call(a, o) && i(e, o, a[o]);
	return e;
}, o = Object.defineProperty, s = Object.defineProperties, c = Object.getOwnPropertyDescriptors, l = Object.getOwnPropertySymbols, u = Object.prototype.hasOwnProperty, d = Object.prototype.propertyIsEnumerable, f = (e, t, n) => t in e ? o(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, p = (e, t) => {
	for (var n in t ||= {}) u.call(t, n) && f(e, n, t[n]);
	if (l) for (var n of l(t)) d.call(t, n) && f(e, n, t[n]);
	return e;
}, m = (e, t) => s(e, c(t)), h = ((e) => (e.Application = "application", e.WebGLPipes = "webgl-pipes", e.WebGLPipesAdaptor = "webgl-pipes-adaptor", e.WebGLSystem = "webgl-system", e.WebGPUPipes = "webgpu-pipes", e.WebGPUPipesAdaptor = "webgpu-pipes-adaptor", e.WebGPUSystem = "webgpu-system", e.CanvasSystem = "canvas-system", e.CanvasPipesAdaptor = "canvas-pipes-adaptor", e.CanvasPipes = "canvas-pipes", e.Asset = "asset", e.LoadParser = "load-parser", e.ResolveParser = "resolve-parser", e.CacheParser = "cache-parser", e.DetectionParser = "detection-parser", e.MaskEffect = "mask-effect", e.BlendMode = "blend-mode", e.TextureSource = "texture-source", e.TextureUploaderWebGL = "texture-uploader-webgl", e.TextureUploaderWebGPU = "texture-uploader-webgpu", e.Environment = "environment", e.ShapeBuilder = "shape-builder", e.Batcher = "batcher", e))(h || {}), g = (e) => {
	if ((typeof e == "function" || typeof e == "object" && e.extension) && (e = m(p({}, typeof e.extension == "object" ? e.extension : { type: e.extension }), { ref: e })), typeof e == "object") e = p({}, e);
	else throw Error("Invalid extension type");
	return typeof e.type == "string" && (e.type = [e.type]), e;
}, _ = (e, t) => g(e).priority ?? t, v = {
	_addHandlers: {},
	_removeHandlers: {},
	_queue: {},
	remove(...e) {
		return e.map(g).forEach((e) => {
			e.type.forEach((t) => {
				var n;
				return (n = this._removeHandlers)[t]?.call(n, e);
			});
		}), this;
	},
	add(...e) {
		return e.map(g).forEach((e) => {
			e.type.forEach((t) => {
				var n, r;
				let i = this._addHandlers, a = this._queue;
				i[t] ? (r = i[t]) == null || r.call(i, e) : (a[t] = a[t] || [], (n = a[t]) == null || n.push(e));
			});
		}), this;
	},
	handle(e, t, n) {
		var r;
		let i = this._addHandlers, a = this._removeHandlers;
		i[e] = t, a[e] = n;
		let o = this._queue;
		return o[e] && ((r = o[e]) == null || r.forEach((e) => t(e)), delete o[e]), this;
	},
	handleByMap(e, t) {
		return this.handle(e, (e) => {
			e.name && (t[e.name] = e.ref);
		}, (e) => {
			e.name && delete t[e.name];
		});
	},
	handleByNamedList(e, t, n = -1) {
		return this.handle(e, (e) => {
			t.findIndex((t) => t.name === e.name) >= 0 || (t.push({
				name: e.name,
				value: e.ref
			}), t.sort((e, t) => _(t.value, n) - _(e.value, n)));
		}, (e) => {
			let n = t.findIndex((t) => t.name === e.name);
			n !== -1 && t.splice(n, 1);
		});
	},
	handleByList(e, t, n = -1) {
		return this.handle(e, (e) => {
			t.includes(e.ref) || (t.push(e.ref), t.sort((e, t) => _(t, n) - _(e, n)));
		}, (e) => {
			let n = t.indexOf(e.ref);
			n !== -1 && t.splice(n, 1);
		});
	},
	mixin(e, ...t) {
		for (let n of t) Object.defineProperties(e.prototype, Object.getOwnPropertyDescriptors(n));
	}
};
function y(e) {
	return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var b = { exports: {} };
b.exports;
var x;
function S() {
	return x || (x = 1, (function(e) {
		var t = Object.prototype.hasOwnProperty, n = "~";
		function r() {}
		Object.create && (r.prototype = Object.create(null), new r().__proto__ || (n = !1));
		function i(e, t, n) {
			this.fn = e, this.context = t, this.once = n || !1;
		}
		function a(e, t, r, a, o) {
			if (typeof r != "function") throw TypeError("The listener must be a function");
			var s = new i(r, a || e, o), c = n ? n + t : t;
			return e._events[c] ? e._events[c].fn ? e._events[c] = [e._events[c], s] : e._events[c].push(s) : (e._events[c] = s, e._eventsCount++), e;
		}
		function o(e, t) {
			--e._eventsCount === 0 ? e._events = new r() : delete e._events[t];
		}
		function s() {
			this._events = new r(), this._eventsCount = 0;
		}
		s.prototype.eventNames = function() {
			var e = [], r, i;
			if (this._eventsCount === 0) return e;
			for (i in r = this._events) t.call(r, i) && e.push(n ? i.slice(1) : i);
			return Object.getOwnPropertySymbols ? e.concat(Object.getOwnPropertySymbols(r)) : e;
		}, s.prototype.listeners = function(e) {
			var t = n ? n + e : e, r = this._events[t];
			if (!r) return [];
			if (r.fn) return [r.fn];
			for (var i = 0, a = r.length, o = Array(a); i < a; i++) o[i] = r[i].fn;
			return o;
		}, s.prototype.listenerCount = function(e) {
			var t = n ? n + e : e, r = this._events[t];
			return r ? r.fn ? 1 : r.length : 0;
		}, s.prototype.emit = function(e, t, r, i, a, o) {
			var s = n ? n + e : e;
			if (!this._events[s]) return !1;
			var c = this._events[s], l = arguments.length, u, d;
			if (c.fn) {
				switch (c.once && this.removeListener(e, c.fn, void 0, !0), l) {
					case 1: return c.fn.call(c.context), !0;
					case 2: return c.fn.call(c.context, t), !0;
					case 3: return c.fn.call(c.context, t, r), !0;
					case 4: return c.fn.call(c.context, t, r, i), !0;
					case 5: return c.fn.call(c.context, t, r, i, a), !0;
					case 6: return c.fn.call(c.context, t, r, i, a, o), !0;
				}
				for (d = 1, u = Array(l - 1); d < l; d++) u[d - 1] = arguments[d];
				c.fn.apply(c.context, u);
			} else {
				var f = c.length, p;
				for (d = 0; d < f; d++) switch (c[d].once && this.removeListener(e, c[d].fn, void 0, !0), l) {
					case 1:
						c[d].fn.call(c[d].context);
						break;
					case 2:
						c[d].fn.call(c[d].context, t);
						break;
					case 3:
						c[d].fn.call(c[d].context, t, r);
						break;
					case 4:
						c[d].fn.call(c[d].context, t, r, i);
						break;
					default:
						if (!u) for (p = 1, u = Array(l - 1); p < l; p++) u[p - 1] = arguments[p];
						c[d].fn.apply(c[d].context, u);
				}
			}
			return !0;
		}, s.prototype.on = function(e, t, n) {
			return a(this, e, t, n, !1);
		}, s.prototype.once = function(e, t, n) {
			return a(this, e, t, n, !0);
		}, s.prototype.removeListener = function(e, t, r, i) {
			var a = n ? n + e : e;
			if (!this._events[a]) return this;
			if (!t) return o(this, a), this;
			var s = this._events[a];
			if (s.fn) s.fn === t && (!i || s.once) && (!r || s.context === r) && o(this, a);
			else {
				for (var c = 0, l = [], u = s.length; c < u; c++) (s[c].fn !== t || i && !s[c].once || r && s[c].context !== r) && l.push(s[c]);
				l.length ? this._events[a] = l.length === 1 ? l[0] : l : o(this, a);
			}
			return this;
		}, s.prototype.removeAllListeners = function(e) {
			var t;
			return e ? (t = n ? n + e : e, this._events[t] && o(this, t)) : (this._events = new r(), this._eventsCount = 0), this;
		}, s.prototype.off = s.prototype.removeListener, s.prototype.addListener = s.prototype.on, s.prefixed = n, s.EventEmitter = s, e.exports = s;
	})(b)), b.exports;
}
var C = y(S()), w = {
	grad: .9,
	turn: 360,
	rad: 360 / (2 * Math.PI)
}, T = function(e) {
	return typeof e == "string" ? e.length > 0 : typeof e == "number";
}, E = function(e, t, n) {
	return t === void 0 && (t = 0), n === void 0 && (n = 10 ** t), Math.round(n * e) / n + 0;
}, D = function(e, t, n) {
	return t === void 0 && (t = 0), n === void 0 && (n = 1), e > n ? n : e > t ? e : t;
}, O = function(e) {
	return (e = isFinite(e) ? e % 360 : 0) > 0 ? e : e + 360;
}, k = function(e) {
	return {
		r: D(e.r, 0, 255),
		g: D(e.g, 0, 255),
		b: D(e.b, 0, 255),
		a: D(e.a)
	};
}, A = function(e) {
	return {
		r: E(e.r),
		g: E(e.g),
		b: E(e.b),
		a: E(e.a, 3)
	};
}, j = /^#([0-9a-f]{3,8})$/i, M = function(e) {
	var t = e.toString(16);
	return t.length < 2 ? "0" + t : t;
}, N = function(e) {
	var t = e.r, n = e.g, r = e.b, i = e.a, a = Math.max(t, n, r), o = a - Math.min(t, n, r), s = o ? a === t ? (n - r) / o : a === n ? 2 + (r - t) / o : 4 + (t - n) / o : 0;
	return {
		h: 60 * (s < 0 ? s + 6 : s),
		s: a ? o / a * 100 : 0,
		v: a / 255 * 100,
		a: i
	};
}, P = function(e) {
	var t = e.h, n = e.s, r = e.v, i = e.a;
	t = t / 360 * 6, n /= 100, r /= 100;
	var a = Math.floor(t), o = r * (1 - n), s = r * (1 - (t - a) * n), c = r * (1 - (1 - t + a) * n), l = a % 6;
	return {
		r: 255 * [
			r,
			s,
			o,
			o,
			c,
			r
		][l],
		g: 255 * [
			c,
			r,
			r,
			s,
			o,
			o
		][l],
		b: 255 * [
			o,
			o,
			c,
			r,
			r,
			s
		][l],
		a: i
	};
}, ee = function(e) {
	return {
		h: O(e.h),
		s: D(e.s, 0, 100),
		l: D(e.l, 0, 100),
		a: D(e.a)
	};
}, F = function(e) {
	return {
		h: E(e.h),
		s: E(e.s),
		l: E(e.l),
		a: E(e.a, 3)
	};
}, te = function(e) {
	return P((n = (t = e).s, {
		h: t.h,
		s: (n *= ((r = t.l) < 50 ? r : 100 - r) / 100) > 0 ? 2 * n / (r + n) * 100 : 0,
		v: r + n,
		a: t.a
	}));
	var t, n, r;
}, I = function(e) {
	return {
		h: (t = N(e)).h,
		s: (i = (200 - (n = t.s)) * (r = t.v) / 100) > 0 && i < 200 ? n * r / 100 / (i <= 100 ? i : 200 - i) * 100 : 0,
		l: i / 2,
		a: t.a
	};
	var t, n, r, i;
}, L = /^hsla?\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*,\s*([+-]?\d*\.?\d+)%\s*,\s*([+-]?\d*\.?\d+)%\s*(?:,\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i, ne = /^hsla?\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s+([+-]?\d*\.?\d+)%\s+([+-]?\d*\.?\d+)%\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i, re = /^rgba?\(\s*([+-]?\d*\.?\d+)(%)?\s*,\s*([+-]?\d*\.?\d+)(%)?\s*,\s*([+-]?\d*\.?\d+)(%)?\s*(?:,\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i, ie = /^rgba?\(\s*([+-]?\d*\.?\d+)(%)?\s+([+-]?\d*\.?\d+)(%)?\s+([+-]?\d*\.?\d+)(%)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i, ae = {
	string: [
		[function(e) {
			var t = j.exec(e);
			return t ? (e = t[1]).length <= 4 ? {
				r: parseInt(e[0] + e[0], 16),
				g: parseInt(e[1] + e[1], 16),
				b: parseInt(e[2] + e[2], 16),
				a: e.length === 4 ? E(parseInt(e[3] + e[3], 16) / 255, 2) : 1
			} : e.length === 6 || e.length === 8 ? {
				r: parseInt(e.substr(0, 2), 16),
				g: parseInt(e.substr(2, 2), 16),
				b: parseInt(e.substr(4, 2), 16),
				a: e.length === 8 ? E(parseInt(e.substr(6, 2), 16) / 255, 2) : 1
			} : null : null;
		}, "hex"],
		[function(e) {
			var t = re.exec(e) || ie.exec(e);
			return t ? t[2] !== t[4] || t[4] !== t[6] ? null : k({
				r: Number(t[1]) / (t[2] ? 100 / 255 : 1),
				g: Number(t[3]) / (t[4] ? 100 / 255 : 1),
				b: Number(t[5]) / (t[6] ? 100 / 255 : 1),
				a: t[7] === void 0 ? 1 : Number(t[7]) / (t[8] ? 100 : 1)
			}) : null;
		}, "rgb"],
		[function(e) {
			var t = L.exec(e) || ne.exec(e);
			if (!t) return null;
			var n, r;
			return te(ee({
				h: (n = t[1], r = t[2], r === void 0 && (r = "deg"), Number(n) * (w[r] || 1)),
				s: Number(t[3]),
				l: Number(t[4]),
				a: t[5] === void 0 ? 1 : Number(t[5]) / (t[6] ? 100 : 1)
			}));
		}, "hsl"]
	],
	object: [
		[function(e) {
			var t = e.r, n = e.g, r = e.b, i = e.a, a = i === void 0 ? 1 : i;
			return T(t) && T(n) && T(r) ? k({
				r: Number(t),
				g: Number(n),
				b: Number(r),
				a: Number(a)
			}) : null;
		}, "rgb"],
		[function(e) {
			var t = e.h, n = e.s, r = e.l, i = e.a, a = i === void 0 ? 1 : i;
			return !T(t) || !T(n) || !T(r) ? null : te(ee({
				h: Number(t),
				s: Number(n),
				l: Number(r),
				a: Number(a)
			}));
		}, "hsl"],
		[function(e) {
			var t = e.h, n = e.s, r = e.v, i = e.a, a = i === void 0 ? 1 : i;
			return !T(t) || !T(n) || !T(r) ? null : P((function(e) {
				return {
					h: O(e.h),
					s: D(e.s, 0, 100),
					v: D(e.v, 0, 100),
					a: D(e.a)
				};
			})({
				h: Number(t),
				s: Number(n),
				v: Number(r),
				a: Number(a)
			}));
		}, "hsv"]
	]
}, R = function(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n][0](e);
		if (r) return [r, t[n][1]];
	}
	return [null, void 0];
}, oe = function(e) {
	return typeof e == "string" ? R(e.trim(), ae.string) : typeof e == "object" && e ? R(e, ae.object) : [null, void 0];
}, se = function(e, t) {
	var n = I(e);
	return {
		h: n.h,
		s: D(n.s + 100 * t, 0, 100),
		l: n.l,
		a: n.a
	};
}, ce = function(e) {
	return (299 * e.r + 587 * e.g + 114 * e.b) / 1e3 / 255;
}, le = function(e, t) {
	var n = I(e);
	return {
		h: n.h,
		s: n.s,
		l: D(n.l + 100 * t, 0, 100),
		a: n.a
	};
}, ue = (function() {
	function e(e) {
		this.parsed = oe(e)[0], this.rgba = this.parsed || {
			r: 0,
			g: 0,
			b: 0,
			a: 1
		};
	}
	return e.prototype.isValid = function() {
		return this.parsed !== null;
	}, e.prototype.brightness = function() {
		return E(ce(this.rgba), 2);
	}, e.prototype.isDark = function() {
		return ce(this.rgba) < .5;
	}, e.prototype.isLight = function() {
		return ce(this.rgba) >= .5;
	}, e.prototype.toHex = function() {
		return e = A(this.rgba), t = e.r, n = e.g, r = e.b, a = (i = e.a) < 1 ? M(E(255 * i)) : "", "#" + M(t) + M(n) + M(r) + a;
		var e, t, n, r, i, a;
	}, e.prototype.toRgb = function() {
		return A(this.rgba);
	}, e.prototype.toRgbString = function() {
		return e = A(this.rgba), t = e.r, n = e.g, r = e.b, (i = e.a) < 1 ? "rgba(" + t + ", " + n + ", " + r + ", " + i + ")" : "rgb(" + t + ", " + n + ", " + r + ")";
		var e, t, n, r, i;
	}, e.prototype.toHsl = function() {
		return F(I(this.rgba));
	}, e.prototype.toHslString = function() {
		return e = F(I(this.rgba)), t = e.h, n = e.s, r = e.l, (i = e.a) < 1 ? "hsla(" + t + ", " + n + "%, " + r + "%, " + i + ")" : "hsl(" + t + ", " + n + "%, " + r + "%)";
		var e, t, n, r, i;
	}, e.prototype.toHsv = function() {
		return e = N(this.rgba), {
			h: E(e.h),
			s: E(e.s),
			v: E(e.v),
			a: E(e.a, 3)
		};
		var e;
	}, e.prototype.invert = function() {
		return de({
			r: 255 - (e = this.rgba).r,
			g: 255 - e.g,
			b: 255 - e.b,
			a: e.a
		});
		var e;
	}, e.prototype.saturate = function(e) {
		return e === void 0 && (e = .1), de(se(this.rgba, e));
	}, e.prototype.desaturate = function(e) {
		return e === void 0 && (e = .1), de(se(this.rgba, -e));
	}, e.prototype.grayscale = function() {
		return de(se(this.rgba, -1));
	}, e.prototype.lighten = function(e) {
		return e === void 0 && (e = .1), de(le(this.rgba, e));
	}, e.prototype.darken = function(e) {
		return e === void 0 && (e = .1), de(le(this.rgba, -e));
	}, e.prototype.rotate = function(e) {
		return e === void 0 && (e = 15), this.hue(this.hue() + e);
	}, e.prototype.alpha = function(e) {
		return typeof e == "number" ? de({
			r: (t = this.rgba).r,
			g: t.g,
			b: t.b,
			a: e
		}) : E(this.rgba.a, 3);
		var t;
	}, e.prototype.hue = function(e) {
		var t = I(this.rgba);
		return typeof e == "number" ? de({
			h: e,
			s: t.s,
			l: t.l,
			a: t.a
		}) : E(t.h);
	}, e.prototype.isEqual = function(e) {
		return this.toHex() === de(e).toHex();
	}, e;
})(), de = function(e) {
	return e instanceof ue ? e : new ue(e);
}, fe = [], pe = function(e) {
	e.forEach(function(e) {
		fe.indexOf(e) < 0 && (e(ue, ae), fe.push(e));
	});
};
function me(e, t) {
	var n = {
		white: "#ffffff",
		bisque: "#ffe4c4",
		blue: "#0000ff",
		cadetblue: "#5f9ea0",
		chartreuse: "#7fff00",
		chocolate: "#d2691e",
		coral: "#ff7f50",
		antiquewhite: "#faebd7",
		aqua: "#00ffff",
		azure: "#f0ffff",
		whitesmoke: "#f5f5f5",
		papayawhip: "#ffefd5",
		plum: "#dda0dd",
		blanchedalmond: "#ffebcd",
		black: "#000000",
		gold: "#ffd700",
		goldenrod: "#daa520",
		gainsboro: "#dcdcdc",
		cornsilk: "#fff8dc",
		cornflowerblue: "#6495ed",
		burlywood: "#deb887",
		aquamarine: "#7fffd4",
		beige: "#f5f5dc",
		crimson: "#dc143c",
		cyan: "#00ffff",
		darkblue: "#00008b",
		darkcyan: "#008b8b",
		darkgoldenrod: "#b8860b",
		darkkhaki: "#bdb76b",
		darkgray: "#a9a9a9",
		darkgreen: "#006400",
		darkgrey: "#a9a9a9",
		peachpuff: "#ffdab9",
		darkmagenta: "#8b008b",
		darkred: "#8b0000",
		darkorchid: "#9932cc",
		darkorange: "#ff8c00",
		darkslateblue: "#483d8b",
		gray: "#808080",
		darkslategray: "#2f4f4f",
		darkslategrey: "#2f4f4f",
		deeppink: "#ff1493",
		deepskyblue: "#00bfff",
		wheat: "#f5deb3",
		firebrick: "#b22222",
		floralwhite: "#fffaf0",
		ghostwhite: "#f8f8ff",
		darkviolet: "#9400d3",
		magenta: "#ff00ff",
		green: "#008000",
		dodgerblue: "#1e90ff",
		grey: "#808080",
		honeydew: "#f0fff0",
		hotpink: "#ff69b4",
		blueviolet: "#8a2be2",
		forestgreen: "#228b22",
		lawngreen: "#7cfc00",
		indianred: "#cd5c5c",
		indigo: "#4b0082",
		fuchsia: "#ff00ff",
		brown: "#a52a2a",
		maroon: "#800000",
		mediumblue: "#0000cd",
		lightcoral: "#f08080",
		darkturquoise: "#00ced1",
		lightcyan: "#e0ffff",
		ivory: "#fffff0",
		lightyellow: "#ffffe0",
		lightsalmon: "#ffa07a",
		lightseagreen: "#20b2aa",
		linen: "#faf0e6",
		mediumaquamarine: "#66cdaa",
		lemonchiffon: "#fffacd",
		lime: "#00ff00",
		khaki: "#f0e68c",
		mediumseagreen: "#3cb371",
		limegreen: "#32cd32",
		mediumspringgreen: "#00fa9a",
		lightskyblue: "#87cefa",
		lightblue: "#add8e6",
		midnightblue: "#191970",
		lightpink: "#ffb6c1",
		mistyrose: "#ffe4e1",
		moccasin: "#ffe4b5",
		mintcream: "#f5fffa",
		lightslategray: "#778899",
		lightslategrey: "#778899",
		navajowhite: "#ffdead",
		navy: "#000080",
		mediumvioletred: "#c71585",
		powderblue: "#b0e0e6",
		palegoldenrod: "#eee8aa",
		oldlace: "#fdf5e6",
		paleturquoise: "#afeeee",
		mediumturquoise: "#48d1cc",
		mediumorchid: "#ba55d3",
		rebeccapurple: "#663399",
		lightsteelblue: "#b0c4de",
		mediumslateblue: "#7b68ee",
		thistle: "#d8bfd8",
		tan: "#d2b48c",
		orchid: "#da70d6",
		mediumpurple: "#9370db",
		purple: "#800080",
		pink: "#ffc0cb",
		skyblue: "#87ceeb",
		springgreen: "#00ff7f",
		palegreen: "#98fb98",
		red: "#ff0000",
		yellow: "#ffff00",
		slateblue: "#6a5acd",
		lavenderblush: "#fff0f5",
		peru: "#cd853f",
		palevioletred: "#db7093",
		violet: "#ee82ee",
		teal: "#008080",
		slategray: "#708090",
		slategrey: "#708090",
		aliceblue: "#f0f8ff",
		darkseagreen: "#8fbc8f",
		darkolivegreen: "#556b2f",
		greenyellow: "#adff2f",
		seagreen: "#2e8b57",
		seashell: "#fff5ee",
		tomato: "#ff6347",
		silver: "#c0c0c0",
		sienna: "#a0522d",
		lavender: "#e6e6fa",
		lightgreen: "#90ee90",
		orange: "#ffa500",
		orangered: "#ff4500",
		steelblue: "#4682b4",
		royalblue: "#4169e1",
		turquoise: "#40e0d0",
		yellowgreen: "#9acd32",
		salmon: "#fa8072",
		saddlebrown: "#8b4513",
		sandybrown: "#f4a460",
		rosybrown: "#bc8f8f",
		darksalmon: "#e9967a",
		lightgoldenrodyellow: "#fafad2",
		snow: "#fffafa",
		lightgrey: "#d3d3d3",
		lightgray: "#d3d3d3",
		dimgray: "#696969",
		dimgrey: "#696969",
		olivedrab: "#6b8e23",
		olive: "#808000"
	}, r = {};
	for (var i in n) r[n[i]] = i;
	var a = {};
	e.prototype.toName = function(t) {
		if (!(this.rgba.a || this.rgba.r || this.rgba.g || this.rgba.b)) return "transparent";
		var i, o, s = r[this.toHex()];
		if (s) return s;
		if (t != null && t.closest) {
			var c = this.toRgb(), l = 1 / 0, u = "black";
			if (!a.length) for (var d in n) a[d] = new e(n[d]).toRgb();
			for (var f in n) {
				var p = (i = c, o = a[f], (i.r - o.r) ** 2 + (i.g - o.g) ** 2 + (i.b - o.b) ** 2);
				p < l && (l = p, u = f);
			}
			return u;
		}
	}, t.string.push([function(t) {
		var r = t.toLowerCase(), i = r === "transparent" ? "#0000" : n[r];
		return i ? new e(i).toRgb() : null;
	}, "name"]);
}
var he = Object.defineProperty, ge = Object.getOwnPropertySymbols, _e = Object.prototype.hasOwnProperty, ve = Object.prototype.propertyIsEnumerable, ye = (e, t, n) => t in e ? he(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, be = (e, t) => {
	for (var n in t ||= {}) _e.call(t, n) && ye(e, n, t[n]);
	if (ge) for (var n of ge(t)) ve.call(t, n) && ye(e, n, t[n]);
	return e;
};
pe([me]);
var xe = class e {
	constructor(e = 16777215) {
		this._value = null, this._components = /* @__PURE__ */ new Float32Array(4), this._components.fill(1), this._int = 16777215, this.value = e;
	}
	get red() {
		return this._components[0];
	}
	get green() {
		return this._components[1];
	}
	get blue() {
		return this._components[2];
	}
	get alpha() {
		return this._components[3];
	}
	setValue(e) {
		return this.value = e, this;
	}
	set value(t) {
		if (t instanceof e) this._value = this._cloneSource(t._value), this._int = t._int, this._components.set(t._components);
		else {
			if (t === null) throw Error("Cannot set Color#value to null");
			(this._value === null || !this._isSourceEqual(this._value, t)) && (this._value = this._cloneSource(t), this._normalize(this._value));
		}
	}
	get value() {
		return this._value;
	}
	_cloneSource(e) {
		return typeof e == "string" || typeof e == "number" || e instanceof Number || e === null ? e : Array.isArray(e) || ArrayBuffer.isView(e) ? e.slice(0) : typeof e == "object" && e ? be({}, e) : e;
	}
	_isSourceEqual(e, t) {
		let n = typeof e;
		if (n !== typeof t) return !1;
		if (n === "number" || n === "string" || e instanceof Number) return e === t;
		if (Array.isArray(e) && Array.isArray(t) || ArrayBuffer.isView(e) && ArrayBuffer.isView(t)) return e.length === t.length && e.every((e, n) => e === t[n]);
		if (e !== null && t !== null) {
			let n = Object.keys(e), r = Object.keys(t);
			return n.length === r.length && n.every((n) => e[n] === t[n]);
		}
		return e === t;
	}
	toRgba() {
		let [e, t, n, r] = this._components;
		return {
			r: e,
			g: t,
			b: n,
			a: r
		};
	}
	toRgb() {
		let [e, t, n] = this._components;
		return {
			r: e,
			g: t,
			b: n
		};
	}
	toRgbaString() {
		let [e, t, n] = this.toUint8RgbArray();
		return `rgba(${e},${t},${n},${this.alpha})`;
	}
	toUint8RgbArray(e) {
		let [t, n, r] = this._components;
		return this._arrayRgb ||= [], e ||= this._arrayRgb, e[0] = Math.round(t * 255), e[1] = Math.round(n * 255), e[2] = Math.round(r * 255), e;
	}
	toArray(e) {
		this._arrayRgba ||= [], e ||= this._arrayRgba;
		let [t, n, r, i] = this._components;
		return e[0] = t, e[1] = n, e[2] = r, e[3] = i, e;
	}
	toRgbArray(e) {
		this._arrayRgb ||= [], e ||= this._arrayRgb;
		let [t, n, r] = this._components;
		return e[0] = t, e[1] = n, e[2] = r, e;
	}
	toNumber() {
		return this._int;
	}
	toBgrNumber() {
		let [e, t, n] = this.toUint8RgbArray();
		return (n << 16) + (t << 8) + e;
	}
	toLittleEndianNumber() {
		let e = this._int;
		return (e >> 16) + (e & 65280) + ((e & 255) << 16);
	}
	multiply(t) {
		let [n, r, i, a] = e._temp.setValue(t)._components;
		return this._components[0] *= n, this._components[1] *= r, this._components[2] *= i, this._components[3] *= a, this._refreshInt(), this._value = null, this;
	}
	premultiply(e, t = !0) {
		return t && (this._components[0] *= e, this._components[1] *= e, this._components[2] *= e), this._components[3] = e, this._refreshInt(), this._value = null, this;
	}
	toPremultiplied(e, t = !0) {
		if (e === 1) return (255 << 24) + this._int;
		if (e === 0) return t ? 0 : this._int;
		let n = this._int >> 16 & 255, r = this._int >> 8 & 255, i = this._int & 255;
		return t && (n = n * e + .5 | 0, r = r * e + .5 | 0, i = i * e + .5 | 0), (e * 255 << 24) + (n << 16) + (r << 8) + i;
	}
	toHex() {
		let e = this._int.toString(16);
		return `#${"000000".substring(0, 6 - e.length) + e}`;
	}
	toHexa() {
		let e = Math.round(this._components[3] * 255).toString(16);
		return this.toHex() + "00".substring(0, 2 - e.length) + e;
	}
	setAlpha(e) {
		return this._components[3] = this._clamp(e), this._value = null, this;
	}
	_normalize(t) {
		let n, r, i, a;
		if ((typeof t == "number" || t instanceof Number) && t >= 0 && t <= 16777215) {
			let e = t;
			n = (e >> 16 & 255) / 255, r = (e >> 8 & 255) / 255, i = (e & 255) / 255, a = 1;
		} else if ((Array.isArray(t) || t instanceof Float32Array) && t.length >= 3 && t.length <= 4) t = this._clamp(t), [n, r, i, a = 1] = t;
		else if ((t instanceof Uint8Array || t instanceof Uint8ClampedArray) && t.length >= 3 && t.length <= 4) t = this._clamp(t, 0, 255), [n, r, i, a = 255] = t, n /= 255, r /= 255, i /= 255, a /= 255;
		else if (typeof t == "string" || typeof t == "object") {
			if (typeof t == "string") {
				let n = e.HEX_PATTERN.exec(t);
				n && (t = `#${n[2]}`);
			}
			let o = de(t);
			o.isValid() && ({r: n, g: r, b: i, a: a} = o.rgba, n /= 255, r /= 255, i /= 255);
		}
		if (n !== void 0) this._components[0] = n, this._components[1] = r, this._components[2] = i, this._components[3] = a, this._refreshInt();
		else throw Error(`Unable to convert color ${t}`);
	}
	_refreshInt() {
		this._clamp(this._components);
		let [e, t, n] = this._components;
		this._int = (e * 255 << 16) + (t * 255 << 8) + (n * 255 | 0);
	}
	_clamp(e, t = 0, n = 1) {
		return typeof e == "number" ? Math.min(Math.max(e, t), n) : (e.forEach((r, i) => {
			e[i] = Math.min(Math.max(r, t), n);
		}), e);
	}
	static isColorLike(t) {
		return typeof t == "number" || typeof t == "string" || t instanceof Number || t instanceof e || Array.isArray(t) || t instanceof Uint8Array || t instanceof Uint8ClampedArray || t instanceof Float32Array || t.r !== void 0 && t.g !== void 0 && t.b !== void 0 || t.r !== void 0 && t.g !== void 0 && t.b !== void 0 && t.a !== void 0 || t.h !== void 0 && t.s !== void 0 && t.l !== void 0 || t.h !== void 0 && t.s !== void 0 && t.l !== void 0 && t.a !== void 0 || t.h !== void 0 && t.s !== void 0 && t.v !== void 0 || t.h !== void 0 && t.s !== void 0 && t.v !== void 0 && t.a !== void 0;
	}
};
xe.shared = new xe(), xe._temp = new xe(), xe.HEX_PATTERN = /^(#|0x)?(([a-f0-9]{3}){1,2}([a-f0-9]{2})?)$/i;
var z = xe, Se = {
	cullArea: null,
	cullable: !1,
	cullableChildren: !0
}, Ce = Math.PI * 2, we = 180 / Math.PI, Te = Math.PI / 180, Ee = class e {
	constructor(e = 0, t = 0) {
		this.x = 0, this.y = 0, this.x = e, this.y = t;
	}
	clone() {
		return new e(this.x, this.y);
	}
	copyFrom(e) {
		return this.set(e.x, e.y), this;
	}
	copyTo(e) {
		return e.set(this.x, this.y), e;
	}
	equals(e) {
		return e.x === this.x && e.y === this.y;
	}
	set(e = 0, t = e) {
		return this.x = e, this.y = t, this;
	}
	static get shared() {
		return De.x = 0, De.y = 0, De;
	}
}, De = new Ee(), B = class e {
	constructor(e = 1, t = 0, n = 0, r = 1, i = 0, a = 0) {
		this.array = null, this.a = e, this.b = t, this.c = n, this.d = r, this.tx = i, this.ty = a;
	}
	fromArray(e) {
		this.a = e[0], this.b = e[1], this.c = e[3], this.d = e[4], this.tx = e[2], this.ty = e[5];
	}
	set(e, t, n, r, i, a) {
		return this.a = e, this.b = t, this.c = n, this.d = r, this.tx = i, this.ty = a, this;
	}
	toArray(e, t) {
		this.array ||= /* @__PURE__ */ new Float32Array(9);
		let n = t || this.array;
		return e ? (n[0] = this.a, n[1] = this.b, n[2] = 0, n[3] = this.c, n[4] = this.d, n[5] = 0, n[6] = this.tx, n[7] = this.ty, n[8] = 1) : (n[0] = this.a, n[1] = this.c, n[2] = this.tx, n[3] = this.b, n[4] = this.d, n[5] = this.ty, n[6] = 0, n[7] = 0, n[8] = 1), n;
	}
	apply(e, t) {
		t ||= new Ee();
		let n = e.x, r = e.y;
		return t.x = this.a * n + this.c * r + this.tx, t.y = this.b * n + this.d * r + this.ty, t;
	}
	applyInverse(e, t) {
		t ||= new Ee();
		let n = this.a, r = this.b, i = this.c, a = this.d, o = this.tx, s = this.ty, c = 1 / (n * a + i * -r), l = e.x, u = e.y;
		return t.x = a * c * l + -i * c * u + (s * i - o * a) * c, t.y = n * c * u + -r * c * l + (-s * n + o * r) * c, t;
	}
	translate(e, t) {
		return this.tx += e, this.ty += t, this;
	}
	scale(e, t) {
		return this.a *= e, this.d *= t, this.c *= e, this.b *= t, this.tx *= e, this.ty *= t, this;
	}
	rotate(e) {
		let t = Math.cos(e), n = Math.sin(e), r = this.a, i = this.c, a = this.tx;
		return this.a = r * t - this.b * n, this.b = r * n + this.b * t, this.c = i * t - this.d * n, this.d = i * n + this.d * t, this.tx = a * t - this.ty * n, this.ty = a * n + this.ty * t, this;
	}
	append(e) {
		let t = this.a, n = this.b, r = this.c, i = this.d;
		return this.a = e.a * t + e.b * r, this.b = e.a * n + e.b * i, this.c = e.c * t + e.d * r, this.d = e.c * n + e.d * i, this.tx = e.tx * t + e.ty * r + this.tx, this.ty = e.tx * n + e.ty * i + this.ty, this;
	}
	appendFrom(e, t) {
		let n = e.a, r = e.b, i = e.c, a = e.d, o = e.tx, s = e.ty, c = t.a, l = t.b, u = t.c, d = t.d;
		return this.a = n * c + r * u, this.b = n * l + r * d, this.c = i * c + a * u, this.d = i * l + a * d, this.tx = o * c + s * u + t.tx, this.ty = o * l + s * d + t.ty, this;
	}
	setTransform(e, t, n, r, i, a, o, s, c) {
		return this.a = Math.cos(o + c) * i, this.b = Math.sin(o + c) * i, this.c = -Math.sin(o - s) * a, this.d = Math.cos(o - s) * a, this.tx = e - (n * this.a + r * this.c), this.ty = t - (n * this.b + r * this.d), this;
	}
	prepend(e) {
		let t = this.tx;
		if (e.a !== 1 || e.b !== 0 || e.c !== 0 || e.d !== 1) {
			let t = this.a, n = this.c;
			this.a = t * e.a + this.b * e.c, this.b = t * e.b + this.b * e.d, this.c = n * e.a + this.d * e.c, this.d = n * e.b + this.d * e.d;
		}
		return this.tx = t * e.a + this.ty * e.c + e.tx, this.ty = t * e.b + this.ty * e.d + e.ty, this;
	}
	decompose(e) {
		let t = this.a, n = this.b, r = this.c, i = this.d, a = e.pivot, o = -Math.atan2(-r, i), s = Math.atan2(n, t), c = Math.abs(o + s);
		return c < 1e-5 || Math.abs(Ce - c) < 1e-5 ? (e.rotation = s, e.skew.x = e.skew.y = 0) : (e.rotation = 0, e.skew.x = o, e.skew.y = s), e.scale.x = Math.sqrt(t * t + n * n), e.scale.y = Math.sqrt(r * r + i * i), e.position.x = this.tx + (a.x * t + a.y * r), e.position.y = this.ty + (a.x * n + a.y * i), e;
	}
	invert() {
		let e = this.a, t = this.b, n = this.c, r = this.d, i = this.tx, a = e * r - t * n;
		return this.a = r / a, this.b = -t / a, this.c = -n / a, this.d = e / a, this.tx = (n * this.ty - r * i) / a, this.ty = -(e * this.ty - t * i) / a, this;
	}
	isIdentity() {
		return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.tx === 0 && this.ty === 0;
	}
	identity() {
		return this.a = 1, this.b = 0, this.c = 0, this.d = 1, this.tx = 0, this.ty = 0, this;
	}
	clone() {
		let t = new e();
		return t.a = this.a, t.b = this.b, t.c = this.c, t.d = this.d, t.tx = this.tx, t.ty = this.ty, t;
	}
	copyTo(e) {
		return e.a = this.a, e.b = this.b, e.c = this.c, e.d = this.d, e.tx = this.tx, e.ty = this.ty, e;
	}
	copyFrom(e) {
		return this.a = e.a, this.b = e.b, this.c = e.c, this.d = e.d, this.tx = e.tx, this.ty = e.ty, this;
	}
	equals(e) {
		return e.a === this.a && e.b === this.b && e.c === this.c && e.d === this.d && e.tx === this.tx && e.ty === this.ty;
	}
	static get IDENTITY() {
		return ke.identity();
	}
	static get shared() {
		return Oe.identity();
	}
}, Oe = new B(), ke = new B(), V = class e {
	constructor(e, t, n) {
		this._x = t || 0, this._y = n || 0, this._observer = e;
	}
	clone(t) {
		return new e(t ?? this._observer, this._x, this._y);
	}
	set(e = 0, t = e) {
		return (this._x !== e || this._y !== t) && (this._x = e, this._y = t, this._observer._onUpdate(this)), this;
	}
	copyFrom(e) {
		return (this._x !== e.x || this._y !== e.y) && (this._x = e.x, this._y = e.y, this._observer._onUpdate(this)), this;
	}
	copyTo(e) {
		return e.set(this._x, this._y), e;
	}
	equals(e) {
		return e.x === this._x && e.y === this._y;
	}
	get x() {
		return this._x;
	}
	set x(e) {
		this._x !== e && (this._x = e, this._observer._onUpdate(this));
	}
	get y() {
		return this._y;
	}
	set y(e) {
		this._y !== e && (this._y = e, this._observer._onUpdate(this));
	}
}, Ae = { default: -1 };
function H(e = "default") {
	return Ae[e] === void 0 && (Ae[e] = -1), ++Ae[e];
}
var je = {
	_registeredResources: /* @__PURE__ */ new Set(),
	register(e) {
		this._registeredResources.add(e);
	},
	unregister(e) {
		this._registeredResources.delete(e);
	},
	release() {
		this._registeredResources.forEach((e) => e.clear());
	},
	get registeredCount() {
		return this._registeredResources.size;
	},
	isRegistered(e) {
		return this._registeredResources.has(e);
	},
	reset() {
		this._registeredResources.clear();
	}
}, Me = class {
	constructor(e, t) {
		this._pool = [], this._count = 0, this._index = 0, this._classType = e, t && this.prepopulate(t);
	}
	prepopulate(e) {
		for (let t = 0; t < e; t++) this._pool[this._index++] = new this._classType();
		this._count += e;
	}
	get(e) {
		var t;
		let n;
		return this._index > 0 ? n = this._pool[--this._index] : (n = new this._classType(), this._count++), (t = n.init) == null || t.call(n, e), n;
	}
	return(e) {
		var t;
		(t = e.reset) == null || t.call(e), this._pool[this._index++] = e;
	}
	get totalSize() {
		return this._count;
	}
	get totalFree() {
		return this._index;
	}
	get totalUsed() {
		return this._count - this._index;
	}
	clear() {
		if (this._pool.length > 0 && this._pool[0].destroy) for (let e = 0; e < this._index; e++) this._pool[e].destroy();
		this._pool.length = 0, this._count = 0, this._index = 0;
	}
}, U = new class {
	constructor() {
		this._poolsByClass = /* @__PURE__ */ new Map();
	}
	prepopulate(e, t) {
		this.getPool(e).prepopulate(t);
	}
	get(e, t) {
		return this.getPool(e).get(t);
	}
	return(e) {
		this.getPool(e.constructor).return(e);
	}
	getPool(e) {
		return this._poolsByClass.has(e) || this._poolsByClass.set(e, new Me(e)), this._poolsByClass.get(e);
	}
	stats() {
		let e = {};
		return this._poolsByClass.forEach((t) => {
			let n = e[t._classType.name] ? t._classType.name + t._classType.ID : t._classType.name;
			e[n] = {
				free: t.totalFree,
				used: t.totalUsed,
				size: t.totalSize
			};
		}), e;
	}
	clear() {
		this._poolsByClass.forEach((e) => e.clear()), this._poolsByClass.clear();
	}
}();
je.register(U);
var Ne = {
	get isCachedAsTexture() {
		var e;
		return !!((e = this.renderGroup) != null && e.isCachedAsTexture);
	},
	cacheAsTexture(e) {
		typeof e == "boolean" && e === !1 ? this.disableRenderGroup() : (this.enableRenderGroup(), this.renderGroup.enableCacheAsTexture(e === !0 ? {} : e));
	},
	updateCacheTexture() {
		var e;
		(e = this.renderGroup) == null || e.updateCacheTexture();
	},
	get cacheAsBitmap() {
		return this.isCachedAsTexture;
	},
	set cacheAsBitmap(e) {
		this.cacheAsTexture(e);
	}
};
function W(e, t, n) {
	let r = e.length, i;
	if (t >= r || n === 0) return;
	n = t + n > r ? r - t : n;
	let a = r - n;
	for (i = t; i < a; ++i) e[i] = e[i + n];
	e.length = a;
}
var Pe = {
	allowChildren: !0,
	removeChildren(e = 0, t) {
		var n;
		let r = t ?? this.children.length, i = r - e, a = [];
		if (i > 0 && i <= r) {
			for (let t = r - 1; t >= e; t--) {
				let e = this.children[t];
				e && (a.push(e), e.parent = null);
			}
			W(this.children, e, r);
			let t = this.renderGroup || this.parentRenderGroup;
			t && t.removeChildren(a);
			for (let e = 0; e < a.length; ++e) {
				let t = a[e];
				(n = t.parentRenderLayer) == null || n.detach(t), this.emit("childRemoved", t, this, e), a[e].emit("removed", this);
			}
			return a.length > 0 && this._didViewChangeTick++, a;
		}
		if (i === 0 && this.children.length === 0) return a;
		throw RangeError("removeChildren: numeric values are outside the acceptable range.");
	},
	removeChildAt(e) {
		let t = this.getChildAt(e);
		return this.removeChild(t);
	},
	getChildAt(e) {
		if (e < 0 || e >= this.children.length) throw Error(`getChildAt: Index (${e}) does not exist.`);
		return this.children[e];
	},
	setChildIndex(e, t) {
		if (t < 0 || t >= this.children.length) throw Error(`The index ${t} supplied is out of bounds ${this.children.length}`);
		this.getChildIndex(e), this.addChildAt(e, t);
	},
	getChildIndex(e) {
		let t = this.children.indexOf(e);
		if (t === -1) throw Error("The supplied Container must be a child of the caller");
		return t;
	},
	addChildAt(e, t) {
		let { children: n } = this;
		if (t < 0 || t > n.length) throw Error(`${e}addChildAt: The index ${t} supplied is out of bounds ${n.length}`);
		let r = e.parent === this;
		if (e.parent) {
			let n = e.parent.children.indexOf(e);
			if (r) {
				if (n === t) return e;
				e.parent.children.splice(n, 1);
			} else e.removeFromParent();
		}
		t === n.length ? n.push(e) : n.splice(t, 0, e), e.parent = this, e.didChange = !0, e._updateFlags = 15;
		let i = this.renderGroup || this.parentRenderGroup;
		return i && i.addChild(e), this.sortableChildren && (this.sortDirty = !0), r || (this.emit("childAdded", e, this, t), e.emit("added", this)), e;
	},
	swapChildren(e, t) {
		if (e === t) return;
		let n = this.getChildIndex(e), r = this.getChildIndex(t);
		this.children[n] = t, this.children[r] = e;
		let i = this.renderGroup || this.parentRenderGroup;
		i && (i.structureDidChange = !0), this._didContainerChangeTick++;
	},
	removeFromParent() {
		var e;
		(e = this.parent) == null || e.removeChild(this);
	},
	reparentChild(...e) {
		return e.length === 1 ? this.reparentChildAt(e[0], this.children.length) : (e.forEach((e) => this.reparentChildAt(e, this.children.length)), e[0]);
	},
	reparentChildAt(e, t) {
		if (e.parent === this) return this.setChildIndex(e, t), e;
		let n = e.worldTransform.clone();
		e.removeFromParent(), this.addChildAt(e, t);
		let r = this.worldTransform.clone();
		return r.invert(), n.prepend(r), e.setFromMatrix(n), e;
	},
	replaceChild(e, t) {
		e.updateLocalTransform(), this.addChildAt(t, this.getChildIndex(e)), t.setFromMatrix(e.localTransform), t.updateLocalTransform(), this.removeChild(e);
	}
}, Fe = {
	collectRenderables(e, t, n) {
		this.parentRenderLayer && this.parentRenderLayer !== n || this.globalDisplayStatus < 7 || !this.includeInBuild || (this.sortableChildren && this.sortChildren(), this.isSimple ? this.collectRenderablesSimple(e, t, n) : this.renderGroup ? t.renderPipes.renderGroup.addRenderGroup(this.renderGroup, e) : this.collectRenderablesWithEffects(e, t, n));
	},
	collectRenderablesSimple(e, t, n) {
		let r = this.children, i = r.length;
		for (let a = 0; a < i; a++) r[a].collectRenderables(e, t, n);
	},
	collectRenderablesWithEffects(e, t, n) {
		let { renderPipes: r } = t;
		for (let t = 0; t < this.effects.length; t++) {
			let n = this.effects[t];
			r[n.pipe].push(n, this, e);
		}
		this.collectRenderablesSimple(e, t, n);
		for (let t = this.effects.length - 1; t >= 0; t--) {
			let n = this.effects[t];
			r[n.pipe].pop(n, this, e);
		}
	}
}, Ie = class {
	constructor() {
		this.pipe = "filter", this.priority = 1;
	}
	destroy() {
		for (let e = 0; e < this.filters.length; e++) this.filters[e].destroy();
		this.filters = null, this.filterArea = null;
	}
}, Le = new class {
	constructor() {
		this._effectClasses = [], this._tests = [], this._initialized = !1;
	}
	init() {
		this._initialized || (this._initialized = !0, this._effectClasses.forEach((e) => {
			this.add({
				test: e.test,
				maskClass: e
			});
		}));
	}
	add(e) {
		this._tests.push(e);
	}
	getMaskEffect(e) {
		this._initialized || this.init();
		for (let t = 0; t < this._tests.length; t++) {
			let n = this._tests[t];
			if (n.test(e)) return U.get(n.maskClass, e);
		}
		return e;
	}
	returnMaskEffect(e) {
		U.return(e);
	}
}();
v.handleByList(h.MaskEffect, Le._effectClasses);
var Re = Object.defineProperty, ze = Object.getOwnPropertySymbols, Be = Object.prototype.hasOwnProperty, Ve = Object.prototype.propertyIsEnumerable, He = (e, t, n) => t in e ? Re(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Ue = (e, t) => {
	for (var n in t ||= {}) Be.call(t, n) && He(e, n, t[n]);
	if (ze) for (var n of ze(t)) Ve.call(t, n) && He(e, n, t[n]);
	return e;
}, We = {
	_maskEffect: null,
	_maskOptions: {
		inverse: !1,
		channel: "red"
	},
	_filterEffect: null,
	effects: [],
	_markStructureAsChanged() {
		let e = this.renderGroup || this.parentRenderGroup;
		e && (e.structureDidChange = !0);
	},
	addEffect(e) {
		this.effects.indexOf(e) === -1 && (this.effects.push(e), this.effects.sort((e, t) => e.priority - t.priority), this._markStructureAsChanged(), this._updateIsSimple());
	},
	removeEffect(e) {
		let t = this.effects.indexOf(e);
		t !== -1 && (this.effects.splice(t, 1), this._markStructureAsChanged(), this._updateIsSimple());
	},
	set mask(e) {
		let t = this._maskEffect;
		t?.mask !== e && (t && (this.removeEffect(t), Le.returnMaskEffect(t), this._maskEffect = null), e != null && (this._maskEffect = Le.getMaskEffect(e), this.addEffect(this._maskEffect)));
	},
	get mask() {
		return this._maskEffect?.mask;
	},
	setMask(e) {
		this._maskOptions = Ue(Ue({}, this._maskOptions), e), e.mask && (this.mask = e.mask), this._markStructureAsChanged();
	},
	set filters(e) {
		!Array.isArray(e) && e && (e = [e]);
		let t = this._filterEffect ||= new Ie();
		e = e;
		let n = e?.length > 0, r = n !== t.filters?.length > 0;
		e = Array.isArray(e) ? e.slice(0) : e, t.filters = Object.freeze(e), r && (n ? this.addEffect(t) : (this.removeEffect(t), t.filters = e ?? null));
	},
	get filters() {
		return this._filterEffect?.filters;
	},
	set filterArea(e) {
		this._filterEffect ||= new Ie(), this._filterEffect.filterArea = e;
	},
	get filterArea() {
		return this._filterEffect?.filterArea;
	}
}, Ge = {
	label: null,
	get name() {
		return this.label;
	},
	set name(e) {
		this.label = e;
	},
	getChildByName(e, t = !1) {
		return this.getChildByLabel(e, t);
	},
	getChildByLabel(e, t = !1) {
		let n = this.children;
		for (let t = 0; t < n.length; t++) {
			let r = n[t];
			if (r.label === e || e instanceof RegExp && e.test(r.label)) return r;
		}
		if (t) for (let t = 0; t < n.length; t++) {
			let r = n[t].getChildByLabel(e, !0);
			if (r) return r;
		}
		return null;
	},
	getChildrenByLabel(e, t = !1, n = []) {
		let r = this.children;
		for (let t = 0; t < r.length; t++) {
			let i = r[t];
			(i.label === e || e instanceof RegExp && e.test(i.label)) && n.push(i);
		}
		if (t) for (let t = 0; t < r.length; t++) r[t].getChildrenByLabel(e, !0, n);
		return n;
	}
}, Ke = [
	new Ee(),
	new Ee(),
	new Ee(),
	new Ee()
], qe = class e {
	constructor(e = 0, t = 0, n = 0, r = 0) {
		this.type = "rectangle", this.x = Number(e), this.y = Number(t), this.width = Number(n), this.height = Number(r);
	}
	get left() {
		return this.x;
	}
	get right() {
		return this.x + this.width;
	}
	get top() {
		return this.y;
	}
	get bottom() {
		return this.y + this.height;
	}
	isEmpty() {
		return this.left === this.right || this.top === this.bottom;
	}
	static get EMPTY() {
		return new e(0, 0, 0, 0);
	}
	clone() {
		return new e(this.x, this.y, this.width, this.height);
	}
	copyFromBounds(e) {
		return this.x = e.minX, this.y = e.minY, this.width = e.maxX - e.minX, this.height = e.maxY - e.minY, this;
	}
	copyFrom(e) {
		return this.x = e.x, this.y = e.y, this.width = e.width, this.height = e.height, this;
	}
	copyTo(e) {
		return e.copyFrom(this), e;
	}
	contains(e, t) {
		return this.width <= 0 || this.height <= 0 ? !1 : e >= this.x && e < this.x + this.width && t >= this.y && t < this.y + this.height;
	}
	strokeContains(e, t, n, r = .5) {
		let { width: i, height: a } = this;
		if (i <= 0 || a <= 0) return !1;
		let o = this.x, s = this.y, c = n * (1 - r), l = n - c, u = o - c, d = o + i + c, f = s - c, p = s + a + c, m = o + l, h = o + i - l, g = s + l, _ = s + a - l;
		return e >= u && e <= d && t >= f && t <= p && !(e > m && e < h && t > g && t < _);
	}
	intersects(e, t) {
		if (!t) {
			let t = this.x < e.x ? e.x : this.x;
			if ((this.right > e.right ? e.right : this.right) <= t) return !1;
			let n = this.y < e.y ? e.y : this.y;
			return (this.bottom > e.bottom ? e.bottom : this.bottom) > n;
		}
		let n = this.left, r = this.right, i = this.top, a = this.bottom;
		if (r <= n || a <= i) return !1;
		let o = Ke[0].set(e.left, e.top), s = Ke[1].set(e.left, e.bottom), c = Ke[2].set(e.right, e.top), l = Ke[3].set(e.right, e.bottom);
		if (c.x <= o.x || s.y <= o.y) return !1;
		let u = Math.sign(t.a * t.d - t.b * t.c);
		if (u === 0 || (t.apply(o, o), t.apply(s, s), t.apply(c, c), t.apply(l, l), Math.max(o.x, s.x, c.x, l.x) <= n || Math.min(o.x, s.x, c.x, l.x) >= r || Math.max(o.y, s.y, c.y, l.y) <= i || Math.min(o.y, s.y, c.y, l.y) >= a)) return !1;
		let d = u * (s.y - o.y), f = u * (o.x - s.x), p = d * n + f * i, m = d * r + f * i, h = d * n + f * a, g = d * r + f * a;
		if (Math.max(p, m, h, g) <= d * o.x + f * o.y || Math.min(p, m, h, g) >= d * l.x + f * l.y) return !1;
		let _ = u * (o.y - c.y), v = u * (c.x - o.x), y = _ * n + v * i, b = _ * r + v * i, x = _ * n + v * a, S = _ * r + v * a;
		return !(Math.max(y, b, x, S) <= _ * o.x + v * o.y || Math.min(y, b, x, S) >= _ * l.x + v * l.y);
	}
	pad(e = 0, t = e) {
		return this.x -= e, this.y -= t, this.width += e * 2, this.height += t * 2, this;
	}
	fit(e) {
		let t = Math.max(this.x, e.x), n = Math.min(this.x + this.width, e.x + e.width), r = Math.max(this.y, e.y), i = Math.min(this.y + this.height, e.y + e.height);
		return this.x = t, this.width = Math.max(n - t, 0), this.y = r, this.height = Math.max(i - r, 0), this;
	}
	ceil(e = 1, t = .001) {
		let n = Math.ceil((this.x + this.width - t) * e) / e, r = Math.ceil((this.y + this.height - t) * e) / e;
		return this.x = Math.floor((this.x + t) * e) / e, this.y = Math.floor((this.y + t) * e) / e, this.width = n - this.x, this.height = r - this.y, this;
	}
	scale(e, t = e) {
		return this.x *= e, this.y *= t, this.width *= e, this.height *= t, this;
	}
	enlarge(e) {
		let t = Math.min(this.x, e.x), n = Math.max(this.x + this.width, e.x + e.width), r = Math.min(this.y, e.y), i = Math.max(this.y + this.height, e.y + e.height);
		return this.x = t, this.width = n - t, this.y = r, this.height = i - r, this;
	}
	getBounds(t) {
		return t ||= new e(), t.copyFrom(this), t;
	}
	containsRect(e) {
		if (this.width <= 0 || this.height <= 0) return !1;
		let t = e.x, n = e.y, r = e.x + e.width, i = e.y + e.height;
		return t >= this.x && t < this.x + this.width && n >= this.y && n < this.y + this.height && r >= this.x && r < this.x + this.width && i >= this.y && i < this.y + this.height;
	}
	set(e, t, n, r) {
		return this.x = e, this.y = t, this.width = n, this.height = r, this;
	}
}, Je = new B(), G = class e {
	constructor(e = 1 / 0, t = 1 / 0, n = -1 / 0, r = -1 / 0) {
		this.minX = 1 / 0, this.minY = 1 / 0, this.maxX = -1 / 0, this.maxY = -1 / 0, this.matrix = Je, this.minX = e, this.minY = t, this.maxX = n, this.maxY = r;
	}
	isEmpty() {
		return this.minX > this.maxX || this.minY > this.maxY;
	}
	get rectangle() {
		this._rectangle ||= new qe();
		let e = this._rectangle;
		return this.minX > this.maxX || this.minY > this.maxY ? (e.x = 0, e.y = 0, e.width = 0, e.height = 0) : e.copyFromBounds(this), e;
	}
	clear() {
		return this.minX = 1 / 0, this.minY = 1 / 0, this.maxX = -1 / 0, this.maxY = -1 / 0, this.matrix = Je, this;
	}
	set(e, t, n, r) {
		this.minX = e, this.minY = t, this.maxX = n, this.maxY = r;
	}
	addFrame(e, t, n, r, i) {
		i ||= this.matrix;
		let a = i.a, o = i.b, s = i.c, c = i.d, l = i.tx, u = i.ty, d = this.minX, f = this.minY, p = this.maxX, m = this.maxY, h = a * e + s * t + l, g = o * e + c * t + u;
		h < d && (d = h), g < f && (f = g), h > p && (p = h), g > m && (m = g), h = a * n + s * t + l, g = o * n + c * t + u, h < d && (d = h), g < f && (f = g), h > p && (p = h), g > m && (m = g), h = a * e + s * r + l, g = o * e + c * r + u, h < d && (d = h), g < f && (f = g), h > p && (p = h), g > m && (m = g), h = a * n + s * r + l, g = o * n + c * r + u, h < d && (d = h), g < f && (f = g), h > p && (p = h), g > m && (m = g), this.minX = d, this.minY = f, this.maxX = p, this.maxY = m;
	}
	addRect(e, t) {
		this.addFrame(e.x, e.y, e.x + e.width, e.y + e.height, t);
	}
	addBounds(e, t) {
		this.addFrame(e.minX, e.minY, e.maxX, e.maxY, t);
	}
	addBoundsMask(e) {
		this.minX = this.minX > e.minX ? this.minX : e.minX, this.minY = this.minY > e.minY ? this.minY : e.minY, this.maxX = this.maxX < e.maxX ? this.maxX : e.maxX, this.maxY = this.maxY < e.maxY ? this.maxY : e.maxY;
	}
	applyMatrix(e) {
		let t = this.minX, n = this.minY, r = this.maxX, i = this.maxY, { a, b: o, c: s, d: c, tx: l, ty: u } = e, d = a * t + s * n + l, f = o * t + c * n + u;
		this.minX = d, this.minY = f, this.maxX = d, this.maxY = f, d = a * r + s * n + l, f = o * r + c * n + u, this.minX = d < this.minX ? d : this.minX, this.minY = f < this.minY ? f : this.minY, this.maxX = d > this.maxX ? d : this.maxX, this.maxY = f > this.maxY ? f : this.maxY, d = a * t + s * i + l, f = o * t + c * i + u, this.minX = d < this.minX ? d : this.minX, this.minY = f < this.minY ? f : this.minY, this.maxX = d > this.maxX ? d : this.maxX, this.maxY = f > this.maxY ? f : this.maxY, d = a * r + s * i + l, f = o * r + c * i + u, this.minX = d < this.minX ? d : this.minX, this.minY = f < this.minY ? f : this.minY, this.maxX = d > this.maxX ? d : this.maxX, this.maxY = f > this.maxY ? f : this.maxY;
	}
	fit(e) {
		return this.minX < e.left && (this.minX = e.left), this.maxX > e.right && (this.maxX = e.right), this.minY < e.top && (this.minY = e.top), this.maxY > e.bottom && (this.maxY = e.bottom), this;
	}
	fitBounds(e, t, n, r) {
		return this.minX < e && (this.minX = e), this.maxX > t && (this.maxX = t), this.minY < n && (this.minY = n), this.maxY > r && (this.maxY = r), this;
	}
	pad(e, t = e) {
		return this.minX -= e, this.maxX += e, this.minY -= t, this.maxY += t, this;
	}
	ceil() {
		return this.minX = Math.floor(this.minX), this.minY = Math.floor(this.minY), this.maxX = Math.ceil(this.maxX), this.maxY = Math.ceil(this.maxY), this;
	}
	clone() {
		return new e(this.minX, this.minY, this.maxX, this.maxY);
	}
	scale(e, t = e) {
		return this.minX *= e, this.minY *= t, this.maxX *= e, this.maxY *= t, this;
	}
	get x() {
		return this.minX;
	}
	set x(e) {
		let t = this.maxX - this.minX;
		this.minX = e, this.maxX = e + t;
	}
	get y() {
		return this.minY;
	}
	set y(e) {
		let t = this.maxY - this.minY;
		this.minY = e, this.maxY = e + t;
	}
	get width() {
		return this.maxX - this.minX;
	}
	set width(e) {
		this.maxX = this.minX + e;
	}
	get height() {
		return this.maxY - this.minY;
	}
	set height(e) {
		this.maxY = this.minY + e;
	}
	get left() {
		return this.minX;
	}
	get right() {
		return this.maxX;
	}
	get top() {
		return this.minY;
	}
	get bottom() {
		return this.maxY;
	}
	get isPositive() {
		return this.maxX - this.minX > 0 && this.maxY - this.minY > 0;
	}
	get isValid() {
		return this.minX + this.minY !== 1 / 0;
	}
	addVertexData(e, t, n, r) {
		let i = this.minX, a = this.minY, o = this.maxX, s = this.maxY;
		r ||= this.matrix;
		let c = r.a, l = r.b, u = r.c, d = r.d, f = r.tx, p = r.ty;
		for (let r = t; r < n; r += 2) {
			let t = e[r], n = e[r + 1], m = c * t + u * n + f, h = l * t + d * n + p;
			i = m < i ? m : i, a = h < a ? h : a, o = m > o ? m : o, s = h > s ? h : s;
		}
		this.minX = i, this.minY = a, this.maxX = o, this.maxY = s;
	}
	containsPoint(e, t) {
		return this.minX <= e && this.minY <= t && this.maxX >= e && this.maxY >= t;
	}
	toString() {
		return `[pixi.js:Bounds minX=${this.minX} minY=${this.minY} maxX=${this.maxX} maxY=${this.maxY} width=${this.width} height=${this.height}]`;
	}
	copyFrom(e) {
		return this.minX = e.minX, this.minY = e.minY, this.maxX = e.maxX, this.maxY = e.maxY, this;
	}
}, Ye = U.getPool(B), Xe = U.getPool(G), Ze = new B(), Qe = {
	getFastGlobalBounds(e, t) {
		t ||= new G(), t.clear(), this._getGlobalBoundsRecursive(!!e, t, this.parentRenderLayer), t.isValid || t.set(0, 0, 0, 0);
		let n = this.renderGroup || this.parentRenderGroup;
		return t.applyMatrix(n.worldTransform), t;
	},
	_getGlobalBoundsRecursive(e, t, n) {
		let r = t;
		if (e && this.parentRenderLayer && this.parentRenderLayer !== n || this.localDisplayStatus !== 7 || !this.measurable) return;
		let i = !!this.effects.length;
		if ((this.renderGroup || i) && (r = Xe.get().clear()), this.boundsArea) t.addRect(this.boundsArea, this.worldTransform);
		else {
			if (this.renderPipeId) {
				let e = this.bounds;
				r.addFrame(e.minX, e.minY, e.maxX, e.maxY, this.groupTransform);
			}
			let t = this.children;
			for (let i = 0; i < t.length; i++) t[i]._getGlobalBoundsRecursive(e, r, n);
		}
		if (i) {
			let e = !1, n = this.renderGroup || this.parentRenderGroup;
			for (let t = 0; t < this.effects.length; t++) this.effects[t].addBounds && (e || (e = !0, r.applyMatrix(n.worldTransform)), this.effects[t].addBounds(r, !0));
			e && r.applyMatrix(n.worldTransform.copyTo(Ze).invert()), t.addBounds(r), Xe.return(r);
		} else this.renderGroup && (t.addBounds(r, this.relativeGroupTransform), Xe.return(r));
	}
};
function $e(e, t, n) {
	n.clear();
	let r, i;
	return e.parent ? t ? r = e.parent.worldTransform : (i = Ye.get().identity(), r = tt(e, i)) : r = B.IDENTITY, et(e, n, r, t), i && Ye.return(i), n.isValid || n.set(0, 0, 0, 0), n;
}
function et(e, t, n, r) {
	var i, a;
	if (!e.visible || !e.measurable) return;
	let o;
	r ? o = e.worldTransform : (e.updateLocalTransform(), o = Ye.get(), o.appendFrom(e.localTransform, n));
	let s = t, c = !!e.effects.length;
	if (c && (t = Xe.get().clear()), e.boundsArea) t.addRect(e.boundsArea, o);
	else {
		let n = e.bounds;
		n && !n.isEmpty() && (t.matrix = o, t.addBounds(n));
		for (let n = 0; n < e.children.length; n++) et(e.children[n], t, o, r);
	}
	if (c) {
		for (let n = 0; n < e.effects.length; n++) (a = (i = e.effects[n]).addBounds) == null || a.call(i, t);
		s.addBounds(t, B.IDENTITY), Xe.return(t);
	}
	r || Ye.return(o);
}
function tt(e, t) {
	let n = e.parent;
	return n && (tt(n, t), n.updateLocalTransform(), t.append(n.localTransform)), t;
}
function nt(e, t) {
	if (e === 16777215 || !t) return t;
	if (t === 16777215 || !e) return e;
	let n = e >> 16 & 255, r = e >> 8 & 255, i = e & 255, a = t >> 16 & 255, o = t >> 8 & 255, s = t & 255, c = n * a / 255 | 0, l = r * o / 255 | 0, u = i * s / 255 | 0;
	return (c << 16) + (l << 8) + u;
}
var rt = 16777215;
function it(e, t) {
	return e === rt ? t : t === rt ? e : nt(e, t);
}
function at(e) {
	return ((e & 255) << 16) + (e & 65280) + (e >> 16 & 255);
}
var ot = {
	getGlobalAlpha(e) {
		if (e) return this.renderGroup ? this.renderGroup.worldAlpha : this.parentRenderGroup ? this.parentRenderGroup.worldAlpha * this.alpha : this.alpha;
		let t = this.alpha, n = this.parent;
		for (; n;) t *= n.alpha, n = n.parent;
		return t;
	},
	getGlobalTransform(e = new B(), t) {
		if (t) return e.copyFrom(this.worldTransform);
		this.updateLocalTransform();
		let n = tt(this, Ye.get().identity());
		return e.appendFrom(this.localTransform, n), Ye.return(n), e;
	},
	getGlobalTint(e) {
		if (e) return this.renderGroup ? at(this.renderGroup.worldColor) : this.parentRenderGroup ? at(it(this.localColor, this.parentRenderGroup.worldColor)) : this.tint;
		let t = this.localColor, n = this.parent;
		for (; n;) t = it(t, n.localColor), n = n.parent;
		return at(t);
	}
};
function st(e, t, n) {
	return t.clear(), n ||= B.IDENTITY, ct(e, t, n, e, !0), t.isValid || t.set(0, 0, 0, 0), t;
}
function ct(e, t, n, r, i) {
	var a, o;
	let s;
	if (i) s = Ye.get(), s = n.copyTo(s);
	else {
		if (!e.visible || !e.measurable) return;
		e.updateLocalTransform();
		let t = e.localTransform;
		s = Ye.get(), s.appendFrom(t, n);
	}
	let c = t, l = !!e.effects.length;
	if (l && (t = Xe.get().clear()), e.boundsArea) t.addRect(e.boundsArea, s);
	else {
		e.renderPipeId && (t.matrix = s, t.addBounds(e.bounds));
		let n = e.children;
		for (let e = 0; e < n.length; e++) ct(n[e], t, s, r, !1);
	}
	if (l) {
		for (let n = 0; n < e.effects.length; n++) (o = (a = e.effects[n]).addLocalBounds) == null || o.call(a, t, r);
		c.addBounds(t, B.IDENTITY), Xe.return(t);
	}
	Ye.return(s);
}
function K(e, t) {
	let n = e.children;
	for (let e = 0; e < n.length; e++) {
		let r = n[e], i = r.uid, a = (r._didViewChangeTick & 65535) << 16 | r._didContainerChangeTick & 65535, o = t.index;
		(t.data[o] !== i || t.data[o + 1] !== a) && (t.data[t.index] = i, t.data[t.index + 1] = a, t.didChange = !0), t.index = o + 2, r.children.length && K(r, t);
	}
	return t.didChange;
}
var lt = new B(), ut = {
	_localBoundsCacheId: -1,
	_localBoundsCacheData: null,
	_setWidth(e, t) {
		let n = Math.sign(this.scale.x) || 1;
		t === 0 ? this.scale.x = n : this.scale.x = e / t * n;
	},
	_setHeight(e, t) {
		let n = Math.sign(this.scale.y) || 1;
		t === 0 ? this.scale.y = n : this.scale.y = e / t * n;
	},
	getLocalBounds() {
		this._localBoundsCacheData ||= {
			data: [],
			index: 1,
			didChange: !1,
			localBounds: new G()
		};
		let e = this._localBoundsCacheData;
		return e.index = 1, e.didChange = !1, e.data[0] !== this._didViewChangeTick && (e.didChange = !0, e.data[0] = this._didViewChangeTick), K(this, e), e.didChange && st(this, e.localBounds, lt), e.localBounds;
	},
	getBounds(e, t) {
		return $e(this, e, t || new G());
	}
}, dt = {
	_onRender: null,
	set onRender(e) {
		let t = this.renderGroup || this.parentRenderGroup;
		if (!e) {
			this._onRender && t?.removeOnRender(this), this._onRender = null;
			return;
		}
		this._onRender || t == null || t.addOnRender(this), this._onRender = e;
	},
	get onRender() {
		return this._onRender;
	}
}, ft = {
	_zIndex: 0,
	sortDirty: !1,
	sortableChildren: !1,
	get zIndex() {
		return this._zIndex;
	},
	set zIndex(e) {
		this._zIndex !== e && (this._zIndex = e, this.depthOfChildModified());
	},
	depthOfChildModified() {
		this.parent && (this.parent.sortableChildren = !0, this.parent.sortDirty = !0), this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0);
	},
	sortChildren() {
		this.sortDirty && (this.sortDirty = !1, this.children.sort(pt));
	}
};
function pt(e, t) {
	return e._zIndex - t._zIndex;
}
var mt = {
	getGlobalPosition(e = new Ee(), t = !1) {
		return this.parent ? this.parent.toGlobal(this._position, e, t) : (e.x = this._position.x, e.y = this._position.y), e;
	},
	toGlobal(e, t, n = !1) {
		let r = this.getGlobalTransform(Ye.get(), n);
		return t = r.apply(e, t), Ye.return(r), t;
	},
	toLocal(e, t, n, r) {
		t && (e = t.toGlobal(e, n, r));
		let i = this.getGlobalTransform(Ye.get(), r);
		return n = i.applyInverse(e, n), Ye.return(i), n;
	}
}, ht = class {
	constructor() {
		this.uid = H("instructionSet"), this.instructions = [], this.instructionSize = 0, this.renderables = [], this.gcTick = 0;
	}
	reset() {
		this.instructionSize = 0;
	}
	destroy() {
		this.instructions.length = 0, this.renderables.length = 0, this.renderPipes = null, this.gcTick = 0;
	}
	add(e) {
		this.instructions[this.instructionSize++] = e;
	}
	log() {
		this.instructions.length = this.instructionSize, console.table(this.instructions, ["type", "action"]);
	}
};
function gt(e) {
	return e += +(e === 0), --e, e |= e >>> 1, e |= e >>> 2, e |= e >>> 4, e |= e >>> 8, e |= e >>> 16, e + 1;
}
function _t(e) {
	return !(e & e - 1) && !!e;
}
function vt(e) {
	let t = {};
	for (let n in e) e[n] !== void 0 && (t[n] = e[n]);
	return t;
}
var yt = Object.defineProperty, bt = Object.getOwnPropertySymbols, xt = Object.prototype.hasOwnProperty, St = Object.prototype.propertyIsEnumerable, Ct = (e, t, n) => t in e ? yt(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, wt = (e, t) => {
	for (var n in t ||= {}) xt.call(t, n) && Ct(e, n, t[n]);
	if (bt) for (var n of bt(t)) St.call(t, n) && Ct(e, n, t[n]);
	return e;
}, Tt = Object.create(null);
function Et(e) {
	let t = Tt[e];
	return t === void 0 && (Tt[e] = H("resource")), t;
}
var Dt = class e extends C {
	constructor(t = {}) {
		super(), this._resourceType = "textureSampler", this._touched = 0, this._maxAnisotropy = 1, this.destroyed = !1, t = wt(wt({}, e.defaultOptions), t), this.addressMode = t.addressMode, this.addressModeU = t.addressModeU ?? this.addressModeU, this.addressModeV = t.addressModeV ?? this.addressModeV, this.addressModeW = t.addressModeW ?? this.addressModeW, this.scaleMode = t.scaleMode, this.magFilter = t.magFilter ?? this.magFilter, this.minFilter = t.minFilter ?? this.minFilter, this.mipmapFilter = t.mipmapFilter ?? this.mipmapFilter, this.lodMinClamp = t.lodMinClamp, this.lodMaxClamp = t.lodMaxClamp, this.compare = t.compare, this.maxAnisotropy = t.maxAnisotropy ?? 1;
	}
	set addressMode(e) {
		this.addressModeU = e, this.addressModeV = e, this.addressModeW = e;
	}
	get addressMode() {
		return this.addressModeU;
	}
	set wrapMode(e) {
		this.addressMode = e;
	}
	get wrapMode() {
		return this.addressMode;
	}
	set scaleMode(e) {
		this.magFilter = e, this.minFilter = e, this.mipmapFilter = e;
	}
	get scaleMode() {
		return this.magFilter;
	}
	set maxAnisotropy(e) {
		this._maxAnisotropy = Math.min(e, 16), this._maxAnisotropy > 1 && (this.scaleMode = "linear");
	}
	get maxAnisotropy() {
		return this._maxAnisotropy;
	}
	get _resourceId() {
		return this._sharedResourceId || this._generateResourceId();
	}
	update() {
		this._sharedResourceId = null, this.emit("change", this);
	}
	_generateResourceId() {
		let e = `${this.addressModeU}-${this.addressModeV}-${this.addressModeW}-${this.magFilter}-${this.minFilter}-${this.mipmapFilter}-${this.lodMinClamp}-${this.lodMaxClamp}-${this.compare}-${this._maxAnisotropy}`;
		return this._sharedResourceId = Et(e), this._resourceId;
	}
	destroy() {
		this.destroyed = !0, this.emit("destroy", this), this.emit("change", this), this.removeAllListeners();
	}
};
Dt.defaultOptions = {
	addressMode: "clamp-to-edge",
	scaleMode: "linear"
};
var Ot = Dt, kt = Object.defineProperty, At = Object.getOwnPropertySymbols, jt = Object.prototype.hasOwnProperty, Mt = Object.prototype.propertyIsEnumerable, Nt = (e, t, n) => t in e ? kt(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Pt = (e, t) => {
	for (var n in t ||= {}) jt.call(t, n) && Nt(e, n, t[n]);
	if (At) for (var n of At(t)) Mt.call(t, n) && Nt(e, n, t[n]);
	return e;
}, Ft = class e extends C {
	constructor(t = {}) {
		var n, r;
		super(), this.options = t, this._gpuData = Object.create(null), this._gcLastUsed = -1, this.uid = H("textureSource"), this._resourceType = "textureSource", this._resourceId = H("resource"), this.uploadMethodId = "unknown", this._resolution = 1, this.pixelWidth = 1, this.pixelHeight = 1, this.width = 1, this.height = 1, this.sampleCount = 1, this.mipLevelCount = 1, this.autoGenerateMipmaps = !1, this.format = "rgba8unorm", this.dimension = "2d", this.viewDimension = "2d", this.arrayLayerCount = 1, this.antialias = !1, this.transient = !1, this._touched = 0, this._batchTick = -1, this._textureBindLocation = -1, t = Pt(Pt({}, e.defaultOptions), t), this.label = t.label ?? "", this.resource = t.resource, this.autoGarbageCollect = t.autoGarbageCollect, this._resolution = t.resolution, this.pixelWidth = t.width ? t.width * this._resolution : this.resource && (n = this.resourceWidth) != null ? n : 1, this.pixelHeight = t.height ? t.height * this._resolution : this.resource && (r = this.resourceHeight) != null ? r : 1, this.width = this.pixelWidth / this._resolution, this.height = this.pixelHeight / this._resolution, this.format = t.format, this.dimension = t.dimensions, this.viewDimension = t.viewDimension ?? t.dimensions, this.arrayLayerCount = t.arrayLayerCount, this.mipLevelCount = t.mipLevelCount, this.autoGenerateMipmaps = t.autoGenerateMipmaps, this.sampleCount = t.sampleCount, this.antialias = t.antialias, this.transient = t.transient ?? !1, this.alphaMode = t.alphaMode, this.style = new Ot(vt(t)), this.destroyed = !1, this._refreshPOT();
	}
	get source() {
		return this;
	}
	get style() {
		return this._style;
	}
	set style(e) {
		var t, n;
		this.style !== e && ((t = this._style) == null || t.off("change", this._onStyleChange, this), this._style = e, (n = this._style) == null || n.on("change", this._onStyleChange, this), this._onStyleChange());
	}
	set maxAnisotropy(e) {
		this._style.maxAnisotropy = e;
	}
	get maxAnisotropy() {
		return this._style.maxAnisotropy;
	}
	get addressMode() {
		return this._style.addressMode;
	}
	set addressMode(e) {
		this._style.addressMode = e;
	}
	get repeatMode() {
		return this._style.addressMode;
	}
	set repeatMode(e) {
		this._style.addressMode = e;
	}
	get magFilter() {
		return this._style.magFilter;
	}
	set magFilter(e) {
		this._style.magFilter = e;
	}
	get minFilter() {
		return this._style.minFilter;
	}
	set minFilter(e) {
		this._style.minFilter = e;
	}
	get mipmapFilter() {
		return this._style.mipmapFilter;
	}
	set mipmapFilter(e) {
		this._style.mipmapFilter = e;
	}
	get lodMinClamp() {
		return this._style.lodMinClamp;
	}
	set lodMinClamp(e) {
		this._style.lodMinClamp = e;
	}
	get lodMaxClamp() {
		return this._style.lodMaxClamp;
	}
	set lodMaxClamp(e) {
		this._style.lodMaxClamp = e;
	}
	_onStyleChange() {
		this.emit("styleChange", this);
	}
	update() {
		if (this.resource) {
			let e = this._resolution;
			if (this.resize(this.resourceWidth / e, this.resourceHeight / e)) return;
		}
		this.emit("update", this);
	}
	destroy() {
		this.destroyed = !0, this.unload(), this.emit("destroy", this), this._style &&= (this._style.destroy(), null), this.uploadMethodId = null, this.resource = null, this.removeAllListeners();
	}
	unload() {
		var e, t;
		this._resourceId = H("resource"), this.emit("change", this), this.emit("unload", this);
		for (let n in this._gpuData) (t = (e = this._gpuData[n])?.destroy) == null || t.call(e);
		this._gpuData = Object.create(null);
	}
	get resourceWidth() {
		let { resource: e } = this;
		return e.naturalWidth || e.videoWidth || e.displayWidth || e.width;
	}
	get resourceHeight() {
		let { resource: e } = this;
		return e.naturalHeight || e.videoHeight || e.displayHeight || e.height;
	}
	get resolution() {
		return this._resolution;
	}
	set resolution(e) {
		this._resolution !== e && (this._resolution = e, this.width = this.pixelWidth / e, this.height = this.pixelHeight / e);
	}
	resize(e, t, n) {
		n ||= this._resolution, e ||= this.width, t ||= this.height;
		let r = Math.round(e * n), i = Math.round(t * n);
		return this.width = r / n, this.height = i / n, this._resolution = n, this.pixelWidth === r && this.pixelHeight === i ? !1 : (this._refreshPOT(), this.pixelWidth = r, this.pixelHeight = i, this.emit("resize", this), this._resourceId = H("resource"), this.emit("change", this), !0);
	}
	updateMipmaps() {
		this.autoGenerateMipmaps && this.mipLevelCount > 1 && this.emit("updateMipmaps", this);
	}
	set wrapMode(e) {
		this._style.wrapMode = e;
	}
	get wrapMode() {
		return this._style.wrapMode;
	}
	set scaleMode(e) {
		this._style.scaleMode = e;
	}
	get scaleMode() {
		return this._style.scaleMode;
	}
	_refreshPOT() {
		this.isPowerOfTwo = _t(this.pixelWidth) && _t(this.pixelHeight);
	}
	static test(e) {
		throw Error("Unimplemented");
	}
};
Ft.defaultOptions = {
	resolution: 1,
	format: "bgra8unorm",
	alphaMode: "premultiply-alpha-on-upload",
	dimensions: "2d",
	viewDimension: "2d",
	arrayLayerCount: 1,
	mipLevelCount: 1,
	autoGenerateMipmaps: !1,
	sampleCount: 1,
	antialias: !1,
	autoGarbageCollect: !1
};
var It = Ft, Lt = [
	1,
	1,
	0,
	-1,
	-1,
	-1,
	0,
	1,
	1,
	1,
	0,
	-1,
	-1,
	-1,
	0,
	1
], Rt = [
	0,
	1,
	1,
	1,
	0,
	-1,
	-1,
	-1,
	0,
	1,
	1,
	1,
	0,
	-1,
	-1,
	-1
], zt = [
	0,
	-1,
	-1,
	-1,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	-1,
	-1,
	-1
], Bt = [
	1,
	1,
	0,
	-1,
	-1,
	-1,
	0,
	1,
	-1,
	-1,
	0,
	1,
	1,
	1,
	0,
	-1
], Vt = [], Ht = [], Ut = Math.sign;
function Wt() {
	for (let e = 0; e < 16; e++) {
		let t = [];
		Vt.push(t);
		for (let n = 0; n < 16; n++) {
			let r = Ut(Lt[e] * Lt[n] + zt[e] * Rt[n]), i = Ut(Rt[e] * Lt[n] + Bt[e] * Rt[n]), a = Ut(Lt[e] * zt[n] + zt[e] * Bt[n]), o = Ut(Rt[e] * zt[n] + Bt[e] * Bt[n]);
			for (let e = 0; e < 16; e++) if (Lt[e] === r && Rt[e] === i && zt[e] === a && Bt[e] === o) {
				t.push(e);
				break;
			}
		}
	}
	for (let e = 0; e < 16; e++) {
		let t = new B();
		t.set(Lt[e], Rt[e], zt[e], Bt[e], 0, 0), Ht.push(t);
	}
}
Wt();
var q = {
	E: 0,
	SE: 1,
	S: 2,
	SW: 3,
	W: 4,
	NW: 5,
	N: 6,
	NE: 7,
	MIRROR_VERTICAL: 8,
	MAIN_DIAGONAL: 10,
	MIRROR_HORIZONTAL: 12,
	REVERSE_DIAGONAL: 14,
	uX: (e) => Lt[e],
	uY: (e) => Rt[e],
	vX: (e) => zt[e],
	vY: (e) => Bt[e],
	inv: (e) => e & 8 ? e & 15 : -e & 7,
	add: (e, t) => Vt[e][t],
	sub: (e, t) => Vt[e][q.inv(t)],
	rotate180: (e) => e ^ 4,
	isVertical: (e) => (e & 3) == 2,
	byDirection: (e, t) => Math.abs(e) * 2 <= Math.abs(t) ? t >= 0 ? q.S : q.N : Math.abs(t) * 2 <= Math.abs(e) ? e > 0 ? q.E : q.W : t > 0 ? e > 0 ? q.SE : q.SW : e > 0 ? q.NE : q.NW,
	matrixAppendRotationInv: (e, t, n = 0, r = 0, i = 0, a = 0) => {
		let o = Ht[q.inv(t)], s = o.a, c = o.b, l = o.c, u = o.d, d = n - Math.min(0, s * i, l * a, s * i + l * a), f = r - Math.min(0, c * i, u * a, c * i + u * a), p = e.a, m = e.b, h = e.c, g = e.d;
		e.a = s * p + c * h, e.b = s * m + c * g, e.c = l * p + u * h, e.d = l * m + u * g, e.tx = d * p + f * h + e.tx, e.ty = d * m + f * g + e.ty;
	},
	transformRectCoords: (e, t, n, r) => {
		let { x: i, y: a, width: o, height: s } = e, { x: c, y: l, width: u, height: d } = t;
		return n === q.E ? (r.set(i + c, a + l, o, s), r) : n === q.S ? r.set(u - a - s + c, i + l, s, o) : n === q.W ? r.set(u - i - o + c, d - a - s + l, o, s) : n === q.N ? r.set(a + c, d - i - o + l, s, o) : r.set(i + c, a + l, o, s);
	}
}, Gt = () => {}, Kt = Object.defineProperty, qt = Object.defineProperties, Jt = Object.getOwnPropertyDescriptors, Yt = Object.getOwnPropertySymbols, Xt = Object.prototype.hasOwnProperty, Zt = Object.prototype.propertyIsEnumerable, Qt = (e, t, n) => t in e ? Kt(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, $t = (e, t) => {
	for (var n in t ||= {}) Xt.call(t, n) && Qt(e, n, t[n]);
	if (Yt) for (var n of Yt(t)) Zt.call(t, n) && Qt(e, n, t[n]);
	return e;
}, en = (e, t) => qt(e, Jt(t)), tn = class extends It {
	constructor(e) {
		let t = e.resource || new Float32Array(e.width * e.height * 4), n = e.format;
		n || (t instanceof Float32Array ? n = "rgba32float" : t instanceof Int32Array || t instanceof Uint32Array ? n = "rgba32uint" : t instanceof Int16Array || t instanceof Uint16Array ? n = "rgba16uint" : (t instanceof Int8Array, n = "bgra8unorm")), super(en($t({}, e), {
			resource: t,
			format: n
		})), this.uploadMethodId = "buffer";
	}
	static test(e) {
		return e instanceof Int8Array || e instanceof Uint8Array || e instanceof Uint8ClampedArray || e instanceof Int16Array || e instanceof Uint16Array || e instanceof Int32Array || e instanceof Uint32Array || e instanceof Float32Array;
	}
};
tn.extension = h.TextureSource;
var nn = new B(), rn = class {
	constructor(e, t) {
		this.mapCoord = new B(), this.uClampFrame = /* @__PURE__ */ new Float32Array(4), this.uClampOffset = /* @__PURE__ */ new Float32Array(2), this._updateID = 0, this.clampOffset = 0, this.clampMargin = t === void 0 ? e.width < 10 ? 0 : .5 : t, this.isSimple = !1, this.texture = e;
	}
	get texture() {
		return this._texture;
	}
	set texture(e) {
		var t;
		this._texture !== e && ((t = this._texture) == null || t.removeListener("update", this.update, this), this._texture = e, this._texture.addListener("update", this.update, this)), this.update();
	}
	multiplyUvs(e, t) {
		t === void 0 && (t = e);
		let n = this.mapCoord;
		for (let r = 0; r < e.length; r += 2) {
			let i = e[r], a = e[r + 1];
			t[r] = i * n.a + a * n.c + n.tx, t[r + 1] = i * n.b + a * n.d + n.ty;
		}
		return t;
	}
	update() {
		let e = this._texture;
		this._updateID++;
		let t = e.uvs;
		this.mapCoord.set(t.x1 - t.x0, t.y1 - t.y0, t.x3 - t.x0, t.y3 - t.y0, t.x0, t.y0);
		let n = e.orig, r = e.trim;
		r && (nn.set(n.width / r.width, 0, 0, n.height / r.height, -r.x / r.width, -r.y / r.height), this.mapCoord.append(nn));
		let i = e.source, a = this.uClampFrame, o = this.clampMargin / i._resolution, s = this.clampOffset / i._resolution;
		return a[0] = (e.frame.x + o + s) / i.width, a[1] = (e.frame.y + o + s) / i.height, a[2] = (e.frame.x + e.frame.width - o + s) / i.width, a[3] = (e.frame.y + e.frame.height - o + s) / i.height, this.uClampOffset[0] = this.clampOffset / i.pixelWidth, this.uClampOffset[1] = this.clampOffset / i.pixelHeight, this.isSimple = e.frame.width === i.width && e.frame.height === i.height && e.rotate === 0, !0;
	}
}, J = class extends C {
	constructor({ source: e, label: t, frame: n, orig: r, trim: i, defaultAnchor: a, defaultBorders: o, rotate: s, dynamic: c } = {}) {
		if (super(), this.uid = H("texture"), this.uvs = {
			x0: 0,
			y0: 0,
			x1: 0,
			y1: 0,
			x2: 0,
			y2: 0,
			x3: 0,
			y3: 0
		}, this.frame = new qe(), this.noFrame = !1, this.dynamic = !1, this.isTexture = !0, this.label = t, this.source = e?.source ?? new It(), this.noFrame = !n, n) this.frame.copyFrom(n);
		else {
			let { width: e, height: t } = this._source;
			this.frame.width = e, this.frame.height = t;
		}
		this.orig = r || this.frame, this.trim = i, this.rotate = s ?? 0, this.defaultAnchor = a, this.defaultBorders = o, this.destroyed = !1, this.dynamic = c || !1, this.updateUvs();
	}
	set source(e) {
		this._source && this._source.off("resize", this.update, this), this._source = e, e.on("resize", this.update, this), this.emit("update", this);
	}
	get source() {
		return this._source;
	}
	get textureMatrix() {
		return this._textureMatrix ||= new rn(this), this._textureMatrix;
	}
	get width() {
		return this.orig.width;
	}
	get height() {
		return this.orig.height;
	}
	updateUvs() {
		let { uvs: e, frame: t } = this, { width: n, height: r } = this._source, i = t.x / n, a = t.y / r, o = t.width / n, s = t.height / r, c = this.rotate;
		if (c) {
			let t = o / 2, n = s / 2, r = i + t, l = a + n;
			c = q.add(c, q.NW), e.x0 = r + t * q.uX(c), e.y0 = l + n * q.uY(c), c = q.add(c, 2), e.x1 = r + t * q.uX(c), e.y1 = l + n * q.uY(c), c = q.add(c, 2), e.x2 = r + t * q.uX(c), e.y2 = l + n * q.uY(c), c = q.add(c, 2), e.x3 = r + t * q.uX(c), e.y3 = l + n * q.uY(c);
		} else e.x0 = i, e.y0 = a, e.x1 = i + o, e.y1 = a, e.x2 = i + o, e.y2 = a + s, e.x3 = i, e.y3 = a + s;
	}
	destroy(e = !1) {
		this._source && (this._source.off("resize", this.update, this), e && (this._source.destroy(), this._source = null)), this._textureMatrix = null, this.destroyed = !0, this.emit("destroy", this), this.removeAllListeners();
	}
	update() {
		this.noFrame && (this.frame.width = this._source.width, this.frame.height = this._source.height), this.updateUvs(), this.emit("update", this);
	}
	get baseTexture() {
		return this._source;
	}
};
J.EMPTY = new J({
	label: "EMPTY",
	source: new It({ label: "EMPTY" })
}), J.EMPTY.destroy = Gt, J.WHITE = new J({
	source: new tn({
		resource: new Uint8Array([
			255,
			255,
			255,
			255
		]),
		width: 1,
		height: 1,
		alphaMode: "premultiply-alpha-on-upload",
		label: "WHITE"
	}),
	label: "WHITE"
}), J.WHITE.destroy = Gt;
var an = Object.defineProperty, on = Object.defineProperties, sn = Object.getOwnPropertyDescriptors, cn = Object.getOwnPropertySymbols, ln = Object.prototype.hasOwnProperty, un = Object.prototype.propertyIsEnumerable, dn = (e, t, n) => t in e ? an(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, fn = (e, t) => {
	for (var n in t ||= {}) ln.call(t, n) && dn(e, n, t[n]);
	if (cn) for (var n of cn(t)) un.call(t, n) && dn(e, n, t[n]);
	return e;
}, pn = (e, t) => on(e, sn(t)), mn = 0, hn = new class {
	constructor(e) {
		this._poolKeyHash = Object.create(null), this._texturePool = {}, this.textureOptions = e || {}, this.enableFullScreen = !1, this.textureStyle = new Ot(this.textureOptions);
	}
	createTexture(e, t, n, r) {
		return new J({
			source: new It(pn(fn({}, this.textureOptions), {
				width: e,
				height: t,
				resolution: 1,
				antialias: n,
				autoGarbageCollect: !1,
				autoGenerateMipmaps: r
			})),
			label: `texturePool_${mn++}`
		});
	}
	getOptimalTexture(e, t, n = 1, r, i = !1) {
		let a = Math.ceil(e * n - 1e-6), o = Math.ceil(t * n - 1e-6);
		a = gt(a), o = gt(o);
		let s = +!!r, c = +!!i, l = (a << 17) + (o << 2) + (c << 1) + s;
		this._texturePool[l] || (this._texturePool[l] = []);
		let u = this._texturePool[l].pop();
		return u ||= this.createTexture(a, o, r, i), u.source._resolution = n, u.source.width = a / n, u.source.height = o / n, u.source.pixelWidth = a, u.source.pixelHeight = o, u.frame.x = 0, u.frame.y = 0, u.frame.width = e, u.frame.height = t, u.updateUvs(), this._poolKeyHash[u.uid] = l, u;
	}
	getSameSizeTexture(e, t = !1) {
		let n = e.source;
		return this.getOptimalTexture(e.width, e.height, n._resolution, t);
	}
	returnTexture(e, t = !1) {
		let n = this._poolKeyHash[e.uid];
		t && (e.source.style = this.textureStyle), this._texturePool[n].push(e);
	}
	clear(e) {
		if (e = e !== !1, e) for (let e in this._texturePool) {
			let t = this._texturePool[e];
			if (t) for (let e = 0; e < t.length; e++) t[e].destroy(!0);
		}
		this._texturePool = {};
	}
}();
je.register(hn);
var gn = class {
	constructor() {
		this.renderPipeId = "renderGroup", this.root = null, this.canBundle = !1, this.renderGroupParent = null, this.renderGroupChildren = [], this.worldTransform = new B(), this.worldColorAlpha = 4294967295, this.worldColor = 16777215, this.worldAlpha = 1, this.childrenToUpdate = Object.create(null), this.updateTick = 0, this.gcTick = 0, this.childrenRenderablesToUpdate = {
			list: [],
			index: 0
		}, this.structureDidChange = !0, this.instructionSet = new ht(), this._onRenderContainers = [], this.textureNeedsUpdate = !0, this.isCachedAsTexture = !1, this._matrixDirty = 7;
	}
	init(e) {
		this.root = e, e._onRender && this.addOnRender(e), e.didChange = !0;
		let t = e.children;
		for (let e = 0; e < t.length; e++) {
			let n = t[e];
			n._updateFlags = 15, this.addChild(n);
		}
	}
	enableCacheAsTexture(e = {}) {
		this.textureOptions = e, this.isCachedAsTexture = !0, this.textureNeedsUpdate = !0;
	}
	disableCacheAsTexture() {
		this.isCachedAsTexture = !1, this.texture &&= (hn.returnTexture(this.texture, !0), null);
	}
	updateCacheTexture() {
		this.textureNeedsUpdate = !0;
		let e = this._parentCacheAsTextureRenderGroup;
		e && !e.textureNeedsUpdate && e.updateCacheTexture();
	}
	reset() {
		this.renderGroupChildren.length = 0;
		for (let e in this.childrenToUpdate) {
			let t = this.childrenToUpdate[e];
			t.list.fill(null), t.index = 0;
		}
		this.childrenRenderablesToUpdate.index = 0, this.childrenRenderablesToUpdate.list.fill(null), this.root = null, this.updateTick = 0, this.structureDidChange = !0, this._onRenderContainers.length = 0, this.renderGroupParent = null, this.disableCacheAsTexture();
	}
	get localTransform() {
		return this.root.localTransform;
	}
	addRenderGroupChild(e) {
		e.renderGroupParent && e.renderGroupParent._removeRenderGroupChild(e), e.renderGroupParent = this, this.renderGroupChildren.push(e);
	}
	_removeRenderGroupChild(e) {
		let t = this.renderGroupChildren.indexOf(e);
		t > -1 && this.renderGroupChildren.splice(t, 1), e.renderGroupParent = null;
	}
	addChild(e) {
		if (this.structureDidChange = !0, e.parentRenderGroup = this, e.updateTick = -1, e.relativeRenderGroupDepth = e.parent === this.root ? 1 : e.parent.relativeRenderGroupDepth + 1, e.didChange = !0, this.onChildUpdate(e), e.renderGroup) {
			this.addRenderGroupChild(e.renderGroup);
			return;
		}
		e._onRender && this.addOnRender(e);
		let t = e.children;
		for (let e = 0; e < t.length; e++) this.addChild(t[e]);
	}
	removeChild(e) {
		if (this.structureDidChange = !0, e._onRender && (e.renderGroup || this.removeOnRender(e)), e.parentRenderGroup = null, e.renderGroup) {
			this._removeRenderGroupChild(e.renderGroup);
			return;
		}
		let t = e.children;
		for (let e = 0; e < t.length; e++) this.removeChild(t[e]);
	}
	removeChildren(e) {
		for (let t = 0; t < e.length; t++) this.removeChild(e[t]);
	}
	onChildUpdate(e) {
		let t = this.childrenToUpdate[e.relativeRenderGroupDepth];
		t ||= this.childrenToUpdate[e.relativeRenderGroupDepth] = {
			index: 0,
			list: []
		}, t.list[t.index++] = e;
	}
	updateRenderable(e) {
		e.globalDisplayStatus < 7 || (this.instructionSet.renderPipes[e.renderPipeId].updateRenderable(e), e.didViewUpdate = !1);
	}
	onChildViewUpdate(e) {
		this.childrenRenderablesToUpdate.list[this.childrenRenderablesToUpdate.index++] = e;
	}
	get isRenderable() {
		return this.root.localDisplayStatus === 7 && this.worldAlpha > 0;
	}
	addOnRender(e) {
		this._onRenderContainers.push(e);
	}
	removeOnRender(e) {
		this._onRenderContainers.splice(this._onRenderContainers.indexOf(e), 1);
	}
	runOnRender(e) {
		for (let t = 0; t < this._onRenderContainers.length; t++) this._onRenderContainers[t]._onRender(e);
	}
	destroy() {
		this.disableCacheAsTexture(), this.renderGroupParent = null, this.root = null, this.childrenRenderablesToUpdate = null, this.childrenToUpdate = null, this.renderGroupChildren = null, this._onRenderContainers = null, this.instructionSet = null;
	}
	getChildren(e = []) {
		let t = this.root.children;
		for (let n = 0; n < t.length; n++) this._getChildren(t[n], e);
		return e;
	}
	_getChildren(e, t = []) {
		if (t.push(e), e.renderGroup) return t;
		let n = e.children;
		for (let e = 0; e < n.length; e++) this._getChildren(n[e], t);
		return t;
	}
	invalidateMatrices() {
		this._matrixDirty = 7;
	}
	get inverseWorldTransform() {
		return this._matrixDirty & 1 ? (this._matrixDirty &= -2, this._inverseWorldTransform ||= new B(), this._inverseWorldTransform.copyFrom(this.worldTransform).invert()) : this._inverseWorldTransform;
	}
	get textureOffsetInverseTransform() {
		return this._matrixDirty & 2 ? (this._matrixDirty &= -3, this._textureOffsetInverseTransform ||= new B(), this._textureOffsetInverseTransform.copyFrom(this.inverseWorldTransform).translate(-this._textureBounds.x, -this._textureBounds.y)) : this._textureOffsetInverseTransform;
	}
	get inverseParentTextureTransform() {
		if (!(this._matrixDirty & 4)) return this._inverseParentTextureTransform;
		this._matrixDirty &= -5;
		let e = this._parentCacheAsTextureRenderGroup;
		return e ? (this._inverseParentTextureTransform ||= new B(), this._inverseParentTextureTransform.copyFrom(this.worldTransform).prepend(e.inverseWorldTransform).translate(-e._textureBounds.x, -e._textureBounds.y)) : this.worldTransform;
	}
	get cacheToLocalTransform() {
		return this.isCachedAsTexture ? this.textureOffsetInverseTransform : this._parentCacheAsTextureRenderGroup ? this._parentCacheAsTextureRenderGroup.textureOffsetInverseTransform : null;
	}
};
function _n(e, t, n = {}) {
	for (let r in t) !n[r] && t[r] !== void 0 && (e[r] = t[r]);
}
var vn = new V(null), yn = new V(null), bn = new V(null, 1, 1), xn = new V(null), Y = class e extends C {
	constructor(e = {}) {
		var t, n;
		super(), this.uid = H("renderable"), this._updateFlags = 15, this.renderGroup = null, this.parentRenderGroup = null, this.parentRenderGroupIndex = 0, this.didChange = !1, this.didViewUpdate = !1, this.relativeRenderGroupDepth = 0, this.children = [], this.parent = null, this.includeInBuild = !0, this.measurable = !0, this.isSimple = !0, this.parentRenderLayer = null, this.updateTick = -1, this.localTransform = new B(), this.relativeGroupTransform = new B(), this.groupTransform = this.relativeGroupTransform, this.destroyed = !1, this._position = new V(this, 0, 0), this._scale = bn, this._pivot = yn, this._origin = xn, this._skew = vn, this._cx = 1, this._sx = 0, this._cy = 0, this._sy = 1, this._rotation = 0, this.localColor = 16777215, this.localAlpha = 1, this.groupAlpha = 1, this.groupColor = 16777215, this.groupColorAlpha = 4294967295, this.localBlendMode = "inherit", this.groupBlendMode = "normal", this.localDisplayStatus = 7, this.globalDisplayStatus = 7, this._didContainerChangeTick = 0, this._didViewChangeTick = 0, this._didLocalTransformChangeId = -1, this.effects = [], _n(this, e, {
			children: !0,
			parent: !0,
			effects: !0
		}), (t = e.children) == null || t.forEach((e) => this.addChild(e)), (n = e.parent) == null || n.addChild(this);
	}
	static mixin(t) {
		v.mixin(e, t);
	}
	set _didChangeId(e) {
		this._didViewChangeTick = e >> 12 & 4095, this._didContainerChangeTick = e & 4095;
	}
	get _didChangeId() {
		return this._didContainerChangeTick & 4095 | (this._didViewChangeTick & 4095) << 12;
	}
	addChild(...e) {
		if (e.length > 1) {
			for (let t = 0; t < e.length; t++) this.addChild(e[t]);
			return e[0];
		}
		let t = e[0], n = this.renderGroup || this.parentRenderGroup;
		return t.parent === this ? (this.children.splice(this.children.indexOf(t), 1), this.children.push(t), n && (n.structureDidChange = !0), t) : (t.parent && t.parent.removeChild(t), this.children.push(t), this.sortableChildren && (this.sortDirty = !0), t.parent = this, t.didChange = !0, t._updateFlags = 15, n && n.addChild(t), this.emit("childAdded", t, this, this.children.length - 1), t.emit("added", this), this._didViewChangeTick++, t._zIndex !== 0 && t.depthOfChildModified(), t);
	}
	removeChild(...e) {
		if (e.length > 1) {
			for (let t = 0; t < e.length; t++) this.removeChild(e[t]);
			return e[0];
		}
		let t = e[0], n = this.children.indexOf(t);
		return n > -1 && (this._didViewChangeTick++, this.children.splice(n, 1), this.renderGroup ? this.renderGroup.removeChild(t) : this.parentRenderGroup && this.parentRenderGroup.removeChild(t), t.parentRenderLayer && t.parentRenderLayer.detach(t), t.parent = null, this.emit("childRemoved", t, this, n), t.emit("removed", this)), t;
	}
	_onUpdate(e) {
		e && e === this._skew && this._updateSkew(), this._didContainerChangeTick++, !this.didChange && (this.didChange = !0, this.parentRenderGroup && this.parentRenderGroup.onChildUpdate(this));
	}
	set isRenderGroup(e) {
		!!this.renderGroup !== e && (e ? this.enableRenderGroup() : this.disableRenderGroup());
	}
	get isRenderGroup() {
		return !!this.renderGroup;
	}
	enableRenderGroup() {
		if (this.renderGroup) return;
		let e = this.parentRenderGroup;
		e?.removeChild(this), this.renderGroup = U.get(gn, this), this.groupTransform = B.IDENTITY, e?.addChild(this), this._updateIsSimple();
	}
	disableRenderGroup() {
		if (!this.renderGroup) return;
		let e = this.parentRenderGroup;
		e?.removeChild(this), U.return(this.renderGroup), this.renderGroup = null, this.groupTransform = this.relativeGroupTransform, e?.addChild(this), this._updateIsSimple();
	}
	_updateIsSimple() {
		this.isSimple = !this.renderGroup && this.effects.length === 0;
	}
	get worldTransform() {
		return this._worldTransform ||= new B(), this.renderGroup ? this._worldTransform.copyFrom(this.renderGroup.worldTransform) : this.parentRenderGroup && this._worldTransform.appendFrom(this.relativeGroupTransform, this.parentRenderGroup.worldTransform), this._worldTransform;
	}
	get x() {
		return this._position.x;
	}
	set x(e) {
		this._position.x = e;
	}
	get y() {
		return this._position.y;
	}
	set y(e) {
		this._position.y = e;
	}
	get position() {
		return this._position;
	}
	set position(e) {
		this._position.copyFrom(e);
	}
	get rotation() {
		return this._rotation;
	}
	set rotation(e) {
		this._rotation !== e && (this._rotation = e, this._onUpdate(this._skew));
	}
	get angle() {
		return this.rotation * we;
	}
	set angle(e) {
		this.rotation = e * Te;
	}
	get pivot() {
		return this._pivot === yn && (this._pivot = new V(this, 0, 0)), this._pivot;
	}
	set pivot(e) {
		this._pivot === yn && (this._pivot = new V(this, 0, 0)), typeof e == "number" ? this._pivot.set(e) : this._pivot.copyFrom(e);
	}
	get skew() {
		return this._skew === vn && (this._skew = new V(this, 0, 0)), this._skew;
	}
	set skew(e) {
		this._skew === vn && (this._skew = new V(this, 0, 0)), this._skew.copyFrom(e);
	}
	get scale() {
		return this._scale === bn && (this._scale = new V(this, 1, 1)), this._scale;
	}
	set scale(e) {
		this._scale === bn && (this._scale = new V(this, 0, 0)), typeof e == "string" && (e = parseFloat(e)), typeof e == "number" ? this._scale.set(e) : this._scale.copyFrom(e);
	}
	get origin() {
		return this._origin === xn && (this._origin = new V(this, 0, 0)), this._origin;
	}
	set origin(e) {
		this._origin === xn && (this._origin = new V(this, 0, 0)), typeof e == "number" ? this._origin.set(e) : this._origin.copyFrom(e);
	}
	get width() {
		return Math.abs(this.scale.x * this.getLocalBounds().width);
	}
	set width(e) {
		let t = this.getLocalBounds().width;
		this._setWidth(e, t);
	}
	get height() {
		return Math.abs(this.scale.y * this.getLocalBounds().height);
	}
	set height(e) {
		let t = this.getLocalBounds().height;
		this._setHeight(e, t);
	}
	getSize(e) {
		e ||= {};
		let t = this.getLocalBounds();
		return e.width = Math.abs(this.scale.x * t.width), e.height = Math.abs(this.scale.y * t.height), e;
	}
	setSize(e, t) {
		let n = this.getLocalBounds();
		typeof e == "object" ? (t = e.height ?? e.width, e = e.width) : t ??= e, e !== void 0 && this._setWidth(e, n.width), t !== void 0 && this._setHeight(t, n.height);
	}
	_updateSkew() {
		let e = this._rotation, t = this._skew;
		this._cx = Math.cos(e + t._y), this._sx = Math.sin(e + t._y), this._cy = -Math.sin(e - t._x), this._sy = Math.cos(e - t._x);
	}
	updateTransform(e) {
		return this.position.set(typeof e.x == "number" ? e.x : this.position.x, typeof e.y == "number" ? e.y : this.position.y), this.scale.set(typeof e.scaleX == "number" ? e.scaleX : this.scale.x, typeof e.scaleY == "number" ? e.scaleY : this.scale.y), this.rotation = typeof e.rotation == "number" ? e.rotation : this.rotation, this.skew.set(typeof e.skewX == "number" ? e.skewX : this.skew.x, typeof e.skewY == "number" ? e.skewY : this.skew.y), this.pivot.set(typeof e.pivotX == "number" ? e.pivotX : this.pivot.x, typeof e.pivotY == "number" ? e.pivotY : this.pivot.y), this.origin.set(typeof e.originX == "number" ? e.originX : this.origin.x, typeof e.originY == "number" ? e.originY : this.origin.y), this;
	}
	setFromMatrix(e) {
		e.decompose(this);
	}
	updateLocalTransform() {
		let e = this._didContainerChangeTick;
		if (this._didLocalTransformChangeId === e) return;
		this._didLocalTransformChangeId = e;
		let t = this.localTransform, n = this._scale, r = this._pivot, i = this._origin, a = this._position, o = n._x, s = n._y, c = r._x, l = r._y, u = -i._x, d = -i._y;
		t.a = this._cx * o, t.b = this._sx * o, t.c = this._cy * s, t.d = this._sy * s, t.tx = a._x - (c * t.a + l * t.c) + (u * t.a + d * t.c) - u, t.ty = a._y - (c * t.b + l * t.d) + (u * t.b + d * t.d) - d;
	}
	set alpha(e) {
		e !== this.localAlpha && (this.localAlpha = e, this._updateFlags |= 1, this._onUpdate());
	}
	get alpha() {
		return this.localAlpha;
	}
	set tint(e) {
		let t = z.shared.setValue(e ?? 16777215).toBgrNumber();
		t !== this.localColor && (this.localColor = t, this._updateFlags |= 1, this._onUpdate());
	}
	get tint() {
		return at(this.localColor);
	}
	set blendMode(e) {
		this.localBlendMode !== e && (this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0), this._updateFlags |= 2, this.localBlendMode = e, this._onUpdate());
	}
	get blendMode() {
		return this.localBlendMode;
	}
	get visible() {
		return !!(this.localDisplayStatus & 2);
	}
	set visible(e) {
		let t = e ? 2 : 0;
		(this.localDisplayStatus & 2) !== t && (this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0), this._updateFlags |= 4, this.localDisplayStatus ^= 2, this._onUpdate(), this.emit("visibleChanged", e));
	}
	get culled() {
		return !(this.localDisplayStatus & 4);
	}
	set culled(e) {
		let t = e ? 0 : 4;
		(this.localDisplayStatus & 4) !== t && (this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0), this._updateFlags |= 4, this.localDisplayStatus ^= 4, this._onUpdate());
	}
	get renderable() {
		return !!(this.localDisplayStatus & 1);
	}
	set renderable(e) {
		let t = +!!e;
		(this.localDisplayStatus & 1) !== t && (this._updateFlags |= 4, this.localDisplayStatus ^= 1, this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0), this._onUpdate());
	}
	get isRenderable() {
		return this.localDisplayStatus === 7 && this.groupAlpha > 0;
	}
	destroy(e = !1) {
		var t;
		if (this.destroyed) return;
		this.destroyed = !0;
		let n;
		if (this.children.length && (n = this.removeChildren(0, this.children.length)), this.removeFromParent(), this.parent = null, this._maskEffect = null, this._filterEffect = null, this.effects = null, this._position = null, this._scale = null, this._pivot = null, this._origin = null, this._skew = null, this.emit("destroyed", this), this.removeAllListeners(), (typeof e == "boolean" ? e : e?.children) && n) for (let t = 0; t < n.length; ++t) n[t].destroy(e);
		(t = this.renderGroup) == null || t.destroy(), this.renderGroup = null;
	}
};
v.mixin(Y, Pe, Qe, mt, dt, ut, We, Ge, ft, Se, Ne, ot, Fe);
var Sn = ((e) => (e[e.INTERACTION = 50] = "INTERACTION", e[e.HIGH = 25] = "HIGH", e[e.NORMAL = 0] = "NORMAL", e[e.LOW = -25] = "LOW", e[e.UTILITY = -50] = "UTILITY", e))(Sn || {}), Cn = class {
	constructor(e, t = null, n = 0, r = !1) {
		this.next = null, this.previous = null, this._destroyed = !1, this._fn = e, this._context = t, this.priority = n, this._once = r;
	}
	match(e, t = null) {
		return this._fn === e && this._context === t;
	}
	emit(e) {
		this._fn && (this._context ? this._fn.call(this._context, e) : this._fn(e));
		let t = this.next;
		return this._once && this.destroy(!0), this._destroyed && (this.next = null), t;
	}
	connect(e) {
		this.previous = e, e.next && (e.next.previous = this), this.next = e.next, e.next = this;
	}
	destroy(e = !1) {
		this._destroyed = !0, this._fn = null, this._context = null, this.previous && (this.previous.next = this.next), this.next && (this.next.previous = this.previous);
		let t = this.next;
		return this.next = e ? null : t, this.previous = null, t;
	}
}, wn = class e {
	constructor() {
		this.autoStart = !1, this.deltaTime = 1, this.lastTime = -1, this.speed = 1, this.started = !1, this._requestId = null, this._maxElapsedMS = 100, this._minElapsedMS = 0, this._protected = !1, this._lastFrame = -1, this._head = new Cn(null, null, 1 / 0), this.deltaMS = 1 / e.targetFPMS, this.elapsedMS = 1 / e.targetFPMS, this._tick = (e) => {
			this._requestId = null, this.started && (this.update(e), this.started && this._requestId === null && this._head.next && (this._requestId = requestAnimationFrame(this._tick)));
		};
	}
	_requestIfNeeded() {
		this._requestId === null && this._head.next && (this.lastTime = performance.now(), this._lastFrame = this.lastTime, this._requestId = requestAnimationFrame(this._tick));
	}
	_cancelIfNeeded() {
		this._requestId !== null && (cancelAnimationFrame(this._requestId), this._requestId = null);
	}
	_startIfPossible() {
		this.started ? this._requestIfNeeded() : this.autoStart && this.start();
	}
	add(e, t, n = Sn.NORMAL) {
		return this._addListener(new Cn(e, t, n));
	}
	addOnce(e, t, n = Sn.NORMAL) {
		return this._addListener(new Cn(e, t, n, !0));
	}
	_addListener(e) {
		let t = this._head.next, n = this._head;
		if (!t) e.connect(n);
		else {
			for (; t;) {
				if (e.priority > t.priority) {
					e.connect(n);
					break;
				}
				n = t, t = t.next;
			}
			e.previous || e.connect(n);
		}
		return this._startIfPossible(), this;
	}
	remove(e, t) {
		let n = this._head.next;
		for (; n;) n = n.match(e, t) ? n.destroy() : n.next;
		return this._head.next || this._cancelIfNeeded(), this;
	}
	get count() {
		if (!this._head) return 0;
		let e = 0, t = this._head;
		for (; t = t.next;) e++;
		return e;
	}
	start() {
		this.started || (this.started = !0, this._requestIfNeeded());
	}
	stop() {
		this.started && (this.started = !1, this._cancelIfNeeded());
	}
	destroy() {
		if (!this._protected) {
			this.stop();
			let e = this._head.next;
			for (; e;) e = e.destroy(!0);
			this._head.destroy(), this._head = null;
		}
	}
	update(t = performance.now()) {
		let n;
		if (t > this.lastTime) {
			if (n = this.elapsedMS = t - this.lastTime, n > this._maxElapsedMS && (n = this._maxElapsedMS), n *= this.speed, this._minElapsedMS) {
				let e = t - this._lastFrame | 0;
				if (e < this._minElapsedMS) return;
				this._lastFrame = t - e % this._minElapsedMS;
			}
			this.deltaMS = n, this.deltaTime = this.deltaMS * e.targetFPMS;
			let r = this._head, i = r.next;
			for (; i;) i = i.emit(this);
			r.next || this._cancelIfNeeded();
		} else this.deltaTime = this.deltaMS = this.elapsedMS = 0;
		this.lastTime = t;
	}
	get FPS() {
		return 1e3 / this.elapsedMS;
	}
	get minFPS() {
		return 1e3 / this._maxElapsedMS;
	}
	set minFPS(t) {
		let n = Math.min(Math.max(0, t) / 1e3, e.targetFPMS);
		this._maxElapsedMS = 1 / n, this._minElapsedMS && t > this.maxFPS && (this.maxFPS = t);
	}
	get maxFPS() {
		return this._minElapsedMS ? Math.round(1e3 / this._minElapsedMS) : 0;
	}
	set maxFPS(e) {
		e === 0 ? this._minElapsedMS = 0 : (e < this.minFPS && (this.minFPS = e), this._minElapsedMS = 1 / (e / 1e3));
	}
	static get shared() {
		if (!e._shared) {
			let t = e._shared = new e();
			t.autoStart = !0, t._protected = !0;
		}
		return e._shared;
	}
	static get system() {
		if (!e._system) {
			let t = e._system = new e();
			t.autoStart = !0, t._protected = !0;
		}
		return e._system;
	}
};
wn.targetFPMS = .06;
var Tn = wn, En = class {
	constructor(e) {
		this._lastTransform = "", this._observer = null, this._tickerAttached = !1, this.updateTranslation = () => {
			if (!this._canvas) return;
			let e = this._canvas.getBoundingClientRect(), t = this._canvas.width, n = this._canvas.height, r = e.width / t * this._renderer.resolution, i = e.height / n * this._renderer.resolution, a = `translate(${e.left}px, ${e.top}px) scale(${r}, ${i})`;
			a !== this._lastTransform && (this._domElement.style.transform = a, this._lastTransform = a);
		}, this._domElement = e.domElement, this._renderer = e.renderer, !(globalThis.OffscreenCanvas && this._renderer.canvas instanceof OffscreenCanvas) && (this._canvas = this._renderer.canvas, this._attachObserver());
	}
	get canvas() {
		return this._canvas;
	}
	ensureAttached() {
		!this._domElement.parentNode && this._canvas.parentNode && (this._canvas.parentNode.appendChild(this._domElement), this.updateTranslation());
	}
	_attachObserver() {
		"ResizeObserver" in globalThis ? (this._observer &&= (this._observer.disconnect(), null), this._observer = new ResizeObserver((e) => {
			for (let t of e) {
				if (t.target !== this._canvas) continue;
				let e = this.canvas.width, n = this.canvas.height, r = t.contentRect.width / e * this._renderer.resolution, i = t.contentRect.height / n * this._renderer.resolution;
				(this._lastScaleX !== r || this._lastScaleY !== i) && (this.updateTranslation(), this._lastScaleX = r, this._lastScaleY = i);
			}
		}), this._observer.observe(this._canvas)) : this._tickerAttached || Tn.shared.add(this.updateTranslation, this, Sn.HIGH);
	}
	destroy() {
		this._observer ? (this._observer.disconnect(), this._observer = null) : this._tickerAttached && Tn.shared.remove(this.updateTranslation), this._domElement = null, this._renderer = null, this._canvas = null, this._tickerAttached = !1, this._lastTransform = "", this._lastScaleX = null, this._lastScaleY = null;
	}
}, Dn = class e {
	constructor(t) {
		this.bubbles = !0, this.cancelBubble = !0, this.cancelable = !1, this.composed = !1, this.defaultPrevented = !1, this.eventPhase = e.prototype.NONE, this.propagationStopped = !1, this.propagationImmediatelyStopped = !1, this.layer = new Ee(), this.page = new Ee(), this.NONE = 0, this.CAPTURING_PHASE = 1, this.AT_TARGET = 2, this.BUBBLING_PHASE = 3, this.manager = t;
	}
	get layerX() {
		return this.layer.x;
	}
	get layerY() {
		return this.layer.y;
	}
	get pageX() {
		return this.page.x;
	}
	get pageY() {
		return this.page.y;
	}
	get data() {
		return this;
	}
	composedPath() {
		return this.manager && (!this.path || this.path[this.path.length - 1] !== this.target) && (this.path = this.target ? this.manager.propagationPath(this.target) : []), this.path;
	}
	initEvent(e, t, n) {
		throw Error("initEvent() is a legacy DOM API. It is not implemented in the Federated Events API.");
	}
	initUIEvent(e, t, n, r, i) {
		throw Error("initUIEvent() is a legacy DOM API. It is not implemented in the Federated Events API.");
	}
	preventDefault() {
		this.nativeEvent instanceof Event && this.nativeEvent.cancelable && this.nativeEvent.preventDefault(), this.defaultPrevented = !0;
	}
	stopImmediatePropagation() {
		this.propagationImmediatelyStopped = !0;
	}
	stopPropagation() {
		this.propagationStopped = !0;
	}
}, On = /iPhone/i, kn = /iPod/i, An = /iPad/i, jn = /\biOS-universal(?:.+)Mac\b/i, Mn = /\bAndroid(?:.+)Mobile\b/i, Nn = /Android/i, Pn = /(?:SD4930UR|\bSilk(?:.+)Mobile\b)/i, Fn = /Silk/i, In = /Windows Phone/i, Ln = /\bWindows(?:.+)ARM\b/i, Rn = /BlackBerry/i, zn = /BB10/i, Bn = /Opera Mini/i, Vn = /\b(CriOS|Chrome)(?:.+)Mobile/i, Hn = /Mobile(?:.+)Firefox\b/i, Un = function(e) {
	return e !== void 0 && e.platform === "MacIntel" && typeof e.maxTouchPoints == "number" && e.maxTouchPoints > 1 && typeof MSStream > "u";
};
function Wn(e) {
	return function(t) {
		return t.test(e);
	};
}
function Gn(e) {
	var t = {
		userAgent: "",
		platform: "",
		maxTouchPoints: 0
	};
	!e && typeof navigator < "u" ? t = {
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		maxTouchPoints: navigator.maxTouchPoints || 0
	} : typeof e == "string" ? t.userAgent = e : e && e.userAgent && (t = {
		userAgent: e.userAgent,
		platform: e.platform,
		maxTouchPoints: e.maxTouchPoints || 0
	});
	var n = t.userAgent, r = n.split("[FBAN");
	r[1] !== void 0 && (n = r[0]), r = n.split("Twitter"), r[1] !== void 0 && (n = r[0]);
	var i = Wn(n), a = {
		apple: {
			phone: i(On) && !i(In),
			ipod: i(kn),
			tablet: !i(On) && (i(An) || Un(t)) && !i(In),
			universal: i(jn),
			device: (i(On) || i(kn) || i(An) || i(jn) || Un(t)) && !i(In)
		},
		amazon: {
			phone: i(Pn),
			tablet: !i(Pn) && i(Fn),
			device: i(Pn) || i(Fn)
		},
		android: {
			phone: !i(In) && i(Pn) || !i(In) && i(Mn),
			tablet: !i(In) && !i(Pn) && !i(Mn) && (i(Fn) || i(Nn)),
			device: !i(In) && (i(Pn) || i(Fn) || i(Mn) || i(Nn)) || i(/\bokhttp\b/i)
		},
		windows: {
			phone: i(In),
			tablet: i(Ln),
			device: i(In) || i(Ln)
		},
		other: {
			blackberry: i(Rn),
			blackberry10: i(zn),
			opera: i(Bn),
			firefox: i(Hn),
			chrome: i(Vn),
			device: i(Rn) || i(zn) || i(Bn) || i(Hn) || i(Vn)
		},
		any: !1,
		phone: !1,
		tablet: !1
	};
	return a.any = a.apple.device || a.android.device || a.windows.device || a.other.device, a.phone = a.apple.phone || a.android.phone || a.windows.phone, a.tablet = a.apple.tablet || a.android.tablet || a.windows.tablet, a;
}
var Kn = (Gn.default ?? Gn)(globalThis.navigator), qn = Object.defineProperty, Jn = Object.getOwnPropertySymbols, Yn = Object.prototype.hasOwnProperty, Xn = Object.prototype.propertyIsEnumerable, Zn = (e, t, n) => t in e ? qn(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Qn = (e, t) => {
	for (var n in t ||= {}) Yn.call(t, n) && Zn(e, n, t[n]);
	if (Jn) for (var n of Jn(t)) Xn.call(t, n) && Zn(e, n, t[n]);
	return e;
}, $n = 9, er = 100, tr = 0, nr = 0, rr = 2, ir = 1, ar = -1e3, or = -1e3, sr = 2, cr = class e {
	constructor(e, t = Kn) {
		this._mobileInfo = t, this.debug = !1, this._activateOnTab = !0, this._deactivateOnMouseMove = !0, this._isActive = !1, this._isMobileAccessibility = !1, this._div = null, this._pools = {}, this._renderId = 0, this._children = [], this._androidUpdateCount = 0, this._androidUpdateFrequency = 500, this._isRunningTests = !1, this._boundOnKeyDown = this._onKeyDown.bind(this), this._boundOnMouseMove = this._onMouseMove.bind(this), this._hookDiv = null, (t.tablet || t.phone) && this._createTouchHook(), this._renderer = e;
	}
	get isActive() {
		return this._isActive;
	}
	get isMobileAccessibility() {
		return this._isMobileAccessibility;
	}
	get hookDiv() {
		return this._hookDiv;
	}
	get div() {
		return this._div;
	}
	_createTouchHook() {
		let e = document.createElement("button");
		e.style.width = `${ir}px`, e.style.height = `${ir}px`, e.style.position = "absolute", e.style.top = `${ar}px`, e.style.left = `${or}px`, e.style.zIndex = sr.toString(), e.style.backgroundColor = "#FF0000", e.title = "select to enable accessibility for this content", e.addEventListener("focus", () => {
			this._isMobileAccessibility = !0, this._activate(), this._destroyTouchHook();
		}), document.body.appendChild(e), this._hookDiv = e;
	}
	_destroyTouchHook() {
		this._hookDiv &&= (document.body.removeChild(this._hookDiv), null);
	}
	_activate() {
		if (this._isActive) return;
		this._isActive = !0, this._div || (this._div = document.createElement("div"), this._div.style.position = "absolute", this._div.style.top = `${tr}px`, this._div.style.left = `${nr}px`, this._div.style.pointerEvents = "none", this._div.style.zIndex = rr.toString(), this._canvasObserver = new En({
			domElement: this._div,
			renderer: this._renderer
		})), this._activateOnTab && globalThis.addEventListener("keydown", this._boundOnKeyDown, !1), this._deactivateOnMouseMove && globalThis.document.addEventListener("mousemove", this._boundOnMouseMove, !0);
		let e = this._renderer.view.canvas;
		if (e.parentNode) this._canvasObserver.ensureAttached(), this._initAccessibilitySetup();
		else {
			let t = new MutationObserver(() => {
				e.parentNode && (t.disconnect(), this._canvasObserver.ensureAttached(), this._initAccessibilitySetup());
			});
			t.observe(document.body, {
				childList: !0,
				subtree: !0
			});
		}
	}
	_initAccessibilitySetup() {
		this._renderer.runners.postrender.add(this), this._renderer.lastObjectRendered && this._updateAccessibleObjects(this._renderer.lastObjectRendered);
	}
	_deactivate() {
		var e, t;
		if (this._isActive && !this._isMobileAccessibility) {
			this._isActive = !1, globalThis.document.removeEventListener("mousemove", this._boundOnMouseMove, !0), this._activateOnTab && globalThis.addEventListener("keydown", this._boundOnKeyDown, !1), this._renderer.runners.postrender.remove(this);
			for (let t of this._children) (e = t._accessibleDiv) != null && e.parentNode && (t._accessibleDiv.parentNode.removeChild(t._accessibleDiv), t._accessibleDiv = null), t._accessibleActive = !1;
			for (let e in this._pools) this._pools[e].forEach((e) => {
				e.parentNode && e.parentNode.removeChild(e);
			}), delete this._pools[e];
			(t = this._div) != null && t.parentNode && this._div.parentNode.removeChild(this._div), this._pools = {}, this._children = [];
		}
	}
	_updateAccessibleObjects(e) {
		if (!e.visible || !e.accessibleChildren) return;
		e.accessible && (e._accessibleActive || this._addChild(e), e._renderId = this._renderId);
		let t = e.children;
		if (t) for (let e = 0; e < t.length; e++) this._updateAccessibleObjects(t[e]);
	}
	init(t) {
		let n = e.defaultOptions, r = { accessibilityOptions: Qn(Qn({}, n), t?.accessibilityOptions || {}) };
		this.debug = r.accessibilityOptions.debug, this._activateOnTab = r.accessibilityOptions.activateOnTab, this._deactivateOnMouseMove = r.accessibilityOptions.deactivateOnMouseMove, r.accessibilityOptions.enabledByDefault && this._activate(), this._renderer.runners.postrender.remove(this);
	}
	postrender() {
		let e = performance.now();
		if (this._mobileInfo.android.device && e < this._androidUpdateCount || (this._androidUpdateCount = e + this._androidUpdateFrequency, (!this._renderer.renderingToScreen || !this._renderer.view.canvas) && !this._isRunningTests)) return;
		let t = /* @__PURE__ */ new Set();
		if (this._renderer.lastObjectRendered) {
			this._updateAccessibleObjects(this._renderer.lastObjectRendered);
			for (let e of this._children) e._renderId === this._renderId && t.add(this._children.indexOf(e));
		}
		for (let e = this._children.length - 1; e >= 0; e--) {
			let n = this._children[e];
			t.has(e) || (n._accessibleDiv && n._accessibleDiv.parentNode && (n._accessibleDiv.parentNode.removeChild(n._accessibleDiv), this._getPool(n.accessibleType).push(n._accessibleDiv), n._accessibleDiv = null), n._accessibleActive = !1, W(this._children, e, 1));
		}
		this._renderer.renderingToScreen && this._canvasObserver.ensureAttached();
		for (let e = 0; e < this._children.length; e++) {
			let t = this._children[e];
			if (!t._accessibleActive || !t._accessibleDiv) continue;
			let n = t._accessibleDiv, r = t.hitArea || t.getBounds().rectangle;
			if (t.hitArea) {
				let e = t.worldTransform;
				n.style.left = `${e.tx + r.x * e.a}px`, n.style.top = `${e.ty + r.y * e.d}px`, n.style.width = `${r.width * e.a}px`, n.style.height = `${r.height * e.d}px`;
			} else this._capHitArea(r), n.style.left = `${r.x}px`, n.style.top = `${r.y}px`, n.style.width = `${r.width}px`, n.style.height = `${r.height}px`;
		}
		this._renderId++;
	}
	_updateDebugHTML(e) {
		e.innerHTML = `type: ${e.type}</br> title : ${e.title}</br> tabIndex: ${e.tabIndex}`;
	}
	_capHitArea(e) {
		e.x < 0 && (e.width += e.x, e.x = 0), e.y < 0 && (e.height += e.y, e.y = 0);
		let { width: t, height: n } = this._renderer;
		e.x + e.width > t && (e.width = t - e.x), e.y + e.height > n && (e.height = n - e.y);
	}
	_addChild(e) {
		let t = this._getPool(e.accessibleType).pop();
		t ? (t.innerHTML = "", t.removeAttribute("title"), t.removeAttribute("aria-label"), t.tabIndex = 0) : (e.accessibleType === "button" ? t = document.createElement("button") : (t = document.createElement(e.accessibleType), t.style.cssText = "\n                        color: transparent;\n                        pointer-events: none;\n                        padding: 0;\n                        margin: 0;\n                        border: 0;\n                        outline: 0;\n                        background: transparent;\n                        box-sizing: border-box;\n                        user-select: none;\n                        -webkit-user-select: none;\n                        -moz-user-select: none;\n                        -ms-user-select: none;\n                    ", e.accessibleText && (t.innerText = e.accessibleText)), t.style.width = `${er}px`, t.style.height = `${er}px`, t.style.backgroundColor = this.debug ? "rgba(255,255,255,0.5)" : "transparent", t.style.position = "absolute", t.style.zIndex = rr.toString(), t.style.borderStyle = "none", navigator.userAgent.toLowerCase().includes("chrome") ? t.setAttribute("aria-live", "off") : t.setAttribute("aria-live", "polite"), navigator.userAgent.match(/rv:.*Gecko\//) ? t.setAttribute("aria-relevant", "additions") : t.setAttribute("aria-relevant", "text"), t.addEventListener("click", this._onClick.bind(this)), t.addEventListener("focus", this._onFocus.bind(this)), t.addEventListener("focusout", this._onFocusOut.bind(this))), t.style.pointerEvents = e.accessiblePointerEvents, t.type = e.accessibleType, e.accessibleTitle && e.accessibleTitle !== null ? t.title = e.accessibleTitle : (!e.accessibleHint || e.accessibleHint === null) && (t.title = `container ${e.tabIndex}`), e.accessibleHint && e.accessibleHint !== null && t.setAttribute("aria-label", e.accessibleHint), e.interactive ? t.tabIndex = e.tabIndex : t.tabIndex = 0, this.debug && this._updateDebugHTML(t), e._accessibleActive = !0, e._accessibleDiv = t, t.container = e, this._children.push(e), this._div.appendChild(e._accessibleDiv);
	}
	_dispatchEvent(e, t) {
		let { container: n } = e.target, r = this._renderer.events.rootBoundary, i = Object.assign(new Dn(r), { target: n });
		r.rootTarget = this._renderer.lastObjectRendered, t.forEach((e) => r.dispatchEvent(i, e));
	}
	_onClick(e) {
		this._dispatchEvent(e, [
			"click",
			"pointertap",
			"tap"
		]);
	}
	_onFocus(e) {
		e.target.getAttribute("aria-live") || e.target.setAttribute("aria-live", "assertive"), this._dispatchEvent(e, ["mouseover"]);
	}
	_onFocusOut(e) {
		e.target.getAttribute("aria-live") || e.target.setAttribute("aria-live", "polite"), this._dispatchEvent(e, ["mouseout"]);
	}
	_onKeyDown(e) {
		e.keyCode !== $n || !this._activateOnTab || this._activate();
	}
	_onMouseMove(e) {
		e.movementX === 0 && e.movementY === 0 || this._deactivate();
	}
	destroy() {
		var e;
		this._deactivate(), this._destroyTouchHook(), (e = this._canvasObserver) == null || e.destroy(), this._canvasObserver = null, this._div = null, this._pools = null, this._children = null, this._renderer = null, this._hookDiv = null, globalThis.removeEventListener("keydown", this._boundOnKeyDown), this._boundOnKeyDown = null, globalThis.document.removeEventListener("mousemove", this._boundOnMouseMove, !0), this._boundOnMouseMove = null;
	}
	setAccessibilityEnabled(e) {
		e ? this._activate() : this._deactivate();
	}
	_getPool(e) {
		return this._pools[e] || (this._pools[e] = []), this._pools[e];
	}
};
cr.extension = {
	type: [h.WebGLSystem, h.WebGPUSystem],
	name: "accessibility"
}, cr.defaultOptions = {
	enabledByDefault: !1,
	debug: !1,
	activateOnTab: !0,
	deactivateOnMouseMove: !0
};
var lr = cr;
v.add(lr), v.mixin(Y, {
	accessible: !1,
	accessibleTitle: null,
	accessibleHint: null,
	tabIndex: 0,
	accessibleType: "button",
	accessibleText: null,
	accessiblePointerEvents: "auto",
	accessibleChildren: !0,
	_accessibleActive: !1,
	_accessibleDiv: null,
	_renderId: -1
});
var ur = class {
	constructor(e) {
		this._attachedDomElements = [], this._renderer = e, this._renderer.runners.postrender.add(this), this._renderer.runners.init.add(this), this._domElement = document.createElement("div"), this._domElement.style.position = "absolute", this._domElement.style.top = "0", this._domElement.style.left = "0", this._domElement.style.pointerEvents = "none", this._domElement.style.zIndex = "1000";
	}
	init() {
		this._canvasObserver = new En({
			domElement: this._domElement,
			renderer: this._renderer
		});
	}
	addRenderable(e, t) {
		this._attachedDomElements.includes(e) || this._attachedDomElements.push(e);
	}
	updateRenderable(e) {}
	validateRenderable(e) {
		return !0;
	}
	postrender() {
		let e = this._attachedDomElements;
		if (e.length === 0) {
			this._domElement.remove();
			return;
		}
		this._canvasObserver.ensureAttached();
		for (let t = 0; t < e.length; t++) {
			let n = e[t], r = n.element;
			if (!n.parent || n.globalDisplayStatus < 7) r?.remove(), e.splice(t, 1), t--;
			else {
				this._domElement.contains(r) || (r.style.position = "absolute", r.style.pointerEvents = "auto", this._domElement.appendChild(r));
				let e = n.worldTransform, t = n._anchor, i = n.width * t.x, a = n.height * t.y;
				r.style.transformOrigin = `${i}px ${a}px`, r.style.transform = `matrix(${e.a}, ${e.b}, ${e.c}, ${e.d}, ${e.tx - i}, ${e.ty - a})`, r.style.opacity = n.groupAlpha.toString();
			}
		}
	}
	destroy() {
		var e;
		this._renderer.runners.postrender.remove(this);
		for (let t = 0; t < this._attachedDomElements.length; t++) (e = this._attachedDomElements[t].element) == null || e.remove();
		this._attachedDomElements.length = 0, this._domElement.remove(), this._canvasObserver.destroy(), this._renderer = null;
	}
};
ur.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "dom"
};
var dr = class extends Y {
	constructor(e) {
		super(e), this.canBundle = !0, this.allowChildren = !1, this._roundPixels = 0, this._lastUsed = -1, this._gpuData = Object.create(null), this.autoGarbageCollect = !0, this._gcLastUsed = -1, this._bounds = new G(0, 1, 0, 0), this._boundsDirty = !0, this.autoGarbageCollect = e.autoGarbageCollect ?? !0;
	}
	get bounds() {
		return this._boundsDirty ? (this.updateBounds(), this._boundsDirty = !1, this._bounds) : this._bounds;
	}
	get roundPixels() {
		return !!this._roundPixels;
	}
	set roundPixels(e) {
		this._roundPixels = +!!e;
	}
	containsPoint(e) {
		let t = this.bounds, { x: n, y: r } = e;
		return n >= t.minX && n <= t.maxX && r >= t.minY && r <= t.maxY;
	}
	onViewUpdate() {
		if (this._didViewChangeTick++, this._boundsDirty = !0, this.didViewUpdate) return;
		this.didViewUpdate = !0;
		let e = this.renderGroup || this.parentRenderGroup;
		e && e.onChildViewUpdate(this);
	}
	unload() {
		var e;
		this.emit("unload", this);
		for (let t in this._gpuData) (e = this._gpuData[t]) == null || e.destroy();
		this._gpuData = Object.create(null), this.onViewUpdate();
	}
	destroy(e) {
		this.unload(), super.destroy(e), this._bounds = null;
	}
	collectRenderablesSimple(e, t, n) {
		let { renderPipes: r } = t;
		r.blendMode.pushBlendMode(this, this.groupBlendMode, e);
		let i = r[this.renderPipeId];
		i != null && i.addRenderable && i.addRenderable(this, e), this.didViewUpdate = !1;
		let a = this.children, o = a.length;
		for (let r = 0; r < o; r++) a[r].collectRenderables(e, t, n);
		r.blendMode.popBlendMode(e);
	}
};
v.add(ur);
var fr = new class {
	constructor() {
		this.interactionFrequency = 10, this._deltaTime = 0, this._didMove = !1, this._tickerAdded = !1, this._pauseUpdate = !0;
	}
	init(e) {
		this.removeTickerListener(), this.events = e, this.interactionFrequency = 10, this._deltaTime = 0, this._didMove = !1, this._tickerAdded = !1, this._pauseUpdate = !0;
	}
	get pauseUpdate() {
		return this._pauseUpdate;
	}
	set pauseUpdate(e) {
		this._pauseUpdate = e;
	}
	addTickerListener() {
		this._tickerAdded || !this.domElement || (Tn.system.add(this._tickerUpdate, this, Sn.INTERACTION), this._tickerAdded = !0);
	}
	removeTickerListener() {
		this._tickerAdded &&= (Tn.system.remove(this._tickerUpdate, this), !1);
	}
	pointerMoved() {
		this._didMove = !0;
	}
	_update() {
		if (!this.domElement || this._pauseUpdate) return;
		if (this._didMove) {
			this._didMove = !1;
			return;
		}
		let e = this.events._rootPointerEvent;
		this.events.supportsTouchEvents && e.pointerType === "touch" || globalThis.document.dispatchEvent(this.events.supportsPointerEvents ? new PointerEvent("pointermove", {
			clientX: e.clientX,
			clientY: e.clientY,
			pointerType: e.pointerType,
			pointerId: e.pointerId
		}) : new MouseEvent("mousemove", {
			clientX: e.clientX,
			clientY: e.clientY
		}));
	}
	_tickerUpdate(e) {
		this._deltaTime += e.deltaTime, !(this._deltaTime < this.interactionFrequency) && (this._deltaTime = 0, this._update());
	}
	destroy() {
		this.removeTickerListener(), this.events = null, this.domElement = null, this._deltaTime = 0, this._didMove = !1, this._tickerAdded = !1, this._pauseUpdate = !0;
	}
}(), pr = class extends Dn {
	constructor() {
		super(...arguments), this.client = new Ee(), this.movement = new Ee(), this.offset = new Ee(), this.global = new Ee(), this.screen = new Ee();
	}
	get clientX() {
		return this.client.x;
	}
	get clientY() {
		return this.client.y;
	}
	get x() {
		return this.clientX;
	}
	get y() {
		return this.clientY;
	}
	get movementX() {
		return this.movement.x;
	}
	get movementY() {
		return this.movement.y;
	}
	get offsetX() {
		return this.offset.x;
	}
	get offsetY() {
		return this.offset.y;
	}
	get globalX() {
		return this.global.x;
	}
	get globalY() {
		return this.global.y;
	}
	get screenX() {
		return this.screen.x;
	}
	get screenY() {
		return this.screen.y;
	}
	getLocalPosition(e, t, n) {
		return e.worldTransform.applyInverse(n || this.global, t);
	}
	getModifierState(e) {
		return "getModifierState" in this.nativeEvent && this.nativeEvent.getModifierState(e);
	}
	initMouseEvent(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m) {
		throw Error("Method not implemented.");
	}
}, mr = class extends pr {
	constructor() {
		super(...arguments), this.width = 0, this.height = 0, this.isPrimary = !1;
	}
	getCoalescedEvents() {
		return this.type === "pointermove" || this.type === "mousemove" || this.type === "touchmove" ? [this] : [];
	}
	getPredictedEvents() {
		throw Error("getPredictedEvents is not supported!");
	}
}, hr = class extends pr {
	constructor() {
		super(...arguments), this.DOM_DELTA_PIXEL = 0, this.DOM_DELTA_LINE = 1, this.DOM_DELTA_PAGE = 2;
	}
};
hr.DOM_DELTA_PIXEL = 0, hr.DOM_DELTA_LINE = 1, hr.DOM_DELTA_PAGE = 2;
var gr = 2048, _r = new Ee(), vr = new Ee(), yr = class {
	constructor(e) {
		this.dispatch = new C(), this.moveOnAll = !1, this.enableGlobalMoveEvents = !0, this.mappingState = { trackingData: {} }, this.eventPool = /* @__PURE__ */ new Map(), this._allInteractiveElements = [], this._hitElements = [], this._isPointerMoveEvent = !1, this.rootTarget = e, this.hitPruneFn = this.hitPruneFn.bind(this), this.hitTestFn = this.hitTestFn.bind(this), this.mapPointerDown = this.mapPointerDown.bind(this), this.mapPointerMove = this.mapPointerMove.bind(this), this.mapPointerOut = this.mapPointerOut.bind(this), this.mapPointerOver = this.mapPointerOver.bind(this), this.mapPointerUp = this.mapPointerUp.bind(this), this.mapPointerUpOutside = this.mapPointerUpOutside.bind(this), this.mapWheel = this.mapWheel.bind(this), this.mappingTable = {}, this.addEventMapping("pointerdown", this.mapPointerDown), this.addEventMapping("pointermove", this.mapPointerMove), this.addEventMapping("pointerout", this.mapPointerOut), this.addEventMapping("pointerleave", this.mapPointerOut), this.addEventMapping("pointerover", this.mapPointerOver), this.addEventMapping("pointerup", this.mapPointerUp), this.addEventMapping("pointerupoutside", this.mapPointerUpOutside), this.addEventMapping("wheel", this.mapWheel);
	}
	addEventMapping(e, t) {
		this.mappingTable[e] || (this.mappingTable[e] = []), this.mappingTable[e].push({
			fn: t,
			priority: 0
		}), this.mappingTable[e].sort((e, t) => e.priority - t.priority);
	}
	dispatchEvent(e, t) {
		e.propagationStopped = !1, e.propagationImmediatelyStopped = !1, this.propagate(e, t), this.dispatch.emit(t || e.type, e);
	}
	mapEvent(e) {
		if (!this.rootTarget) return;
		let t = this.mappingTable[e.type];
		if (t) for (let n = 0, r = t.length; n < r; n++) t[n].fn(e);
	}
	hitTest(e, t) {
		fr.pauseUpdate = !0;
		let n = this._isPointerMoveEvent && this.enableGlobalMoveEvents ? "hitTestMoveRecursive" : "hitTestRecursive", r = this[n](this.rootTarget, this.rootTarget.eventMode, _r.set(e, t), this.hitTestFn, this.hitPruneFn);
		return r && r[0];
	}
	propagate(e, t) {
		if (!e.target) return;
		let n = e.composedPath();
		e.eventPhase = e.CAPTURING_PHASE;
		for (let r = 0, i = n.length - 1; r < i; r++) if (e.currentTarget = n[r], this.notifyTarget(e, t), e.propagationStopped || e.propagationImmediatelyStopped) return;
		if (e.eventPhase = e.AT_TARGET, e.currentTarget = e.target, this.notifyTarget(e, t), !(e.propagationStopped || e.propagationImmediatelyStopped)) {
			e.eventPhase = e.BUBBLING_PHASE;
			for (let r = n.length - 2; r >= 0; r--) if (e.currentTarget = n[r], this.notifyTarget(e, t), e.propagationStopped || e.propagationImmediatelyStopped) return;
		}
	}
	all(e, t, n = this._allInteractiveElements) {
		if (n.length === 0) return;
		e.eventPhase = e.BUBBLING_PHASE;
		let r = Array.isArray(t) ? t : [t];
		for (let t = n.length - 1; t >= 0; t--) r.forEach((r) => {
			e.currentTarget = n[t], this.notifyTarget(e, r);
		});
	}
	propagationPath(e) {
		let t = [e];
		for (let n = 0; n < gr && e !== this.rootTarget && e.parent; n++) {
			if (!e.parent) throw Error("Cannot find propagation path to disconnected target");
			t.push(e.parent), e = e.parent;
		}
		return t.reverse(), t;
	}
	hitTestMoveRecursive(e, t, n, r, i, a = !1) {
		let o = !1;
		if (this._interactivePrune(e)) return null;
		if ((e.eventMode === "dynamic" || t === "dynamic") && (fr.pauseUpdate = !1), e.interactiveChildren && e.children) {
			let s = e.children;
			for (let c = s.length - 1; c >= 0; c--) {
				let l = s[c], u = this.hitTestMoveRecursive(l, this._isInteractive(t) ? t : l.eventMode, n, r, i, a || i(e, n));
				if (u) {
					if (u.length > 0 && !u[u.length - 1].parent) continue;
					let t = e.isInteractive();
					(u.length > 0 || t) && (t && this._allInteractiveElements.push(e), u.push(e)), this._hitElements.length === 0 && (this._hitElements = u), o = !0;
				}
			}
		}
		let s = this._isInteractive(t), c = e.isInteractive();
		return c && c && this._allInteractiveElements.push(e), a || this._hitElements.length > 0 ? null : o ? this._hitElements : s && !i(e, n) && r(e, n) ? c ? [e] : [] : null;
	}
	hitTestRecursive(e, t, n, r, i) {
		if (this._interactivePrune(e) || i(e, n)) return null;
		if ((e.eventMode === "dynamic" || t === "dynamic") && (fr.pauseUpdate = !1), e.interactiveChildren && e.children) {
			let a = e.children, o = n;
			for (let n = a.length - 1; n >= 0; n--) {
				let s = a[n], c = this.hitTestRecursive(s, this._isInteractive(t) ? t : s.eventMode, o, r, i);
				if (c) {
					if (c.length > 0 && !c[c.length - 1].parent) continue;
					let t = e.isInteractive();
					return (c.length > 0 || t) && c.push(e), c;
				}
			}
		}
		let a = this._isInteractive(t), o = e.isInteractive();
		return a && r(e, n) ? o ? [e] : [] : null;
	}
	_isInteractive(e) {
		return e === "static" || e === "dynamic";
	}
	_interactivePrune(e) {
		return !e || !e.visible || !e.renderable || !e.measurable || e.eventMode === "none" || e.eventMode === "passive" && !e.interactiveChildren;
	}
	hitPruneFn(e, t) {
		if (e.hitArea && (e.worldTransform.applyInverse(t, vr), !e.hitArea.contains(vr.x, vr.y))) return !0;
		if (e.effects && e.effects.length) for (let n = 0; n < e.effects.length; n++) {
			let r = e.effects[n];
			if (r.containsPoint && !r.containsPoint(t, this.hitTestFn)) return !0;
		}
		return !1;
	}
	hitTestFn(e, t) {
		return e.hitArea ? !0 : e != null && e.containsPoint ? (e.worldTransform.applyInverse(t, vr), e.containsPoint(vr)) : !1;
	}
	notifyTarget(e, t) {
		var n, r;
		if (!e.currentTarget.isInteractive()) return;
		t ??= e.type;
		let i = `on${t}`;
		(r = (n = e.currentTarget)[i]) == null || r.call(n, e);
		let a = e.eventPhase === e.CAPTURING_PHASE || e.eventPhase === e.AT_TARGET ? `${t}capture` : t;
		this._notifyListeners(e, a), e.eventPhase === e.AT_TARGET && this._notifyListeners(e, t);
	}
	mapPointerDown(e) {
		if (!(e instanceof mr)) return;
		let t = this.createPointerEvent(e);
		if (this.dispatchEvent(t, "pointerdown"), t.pointerType === "touch") this.dispatchEvent(t, "touchstart");
		else if (t.pointerType === "mouse" || t.pointerType === "pen") {
			let e = t.button === 2;
			this.dispatchEvent(t, e ? "rightdown" : "mousedown");
		}
		let n = this.trackingData(e.pointerId);
		n.pressTargetsByButton[e.button] = t.composedPath(), this.freeEvent(t);
	}
	mapPointerMove(e) {
		if (!(e instanceof mr)) return;
		this._allInteractiveElements.length = 0, this._hitElements.length = 0, this._isPointerMoveEvent = !0;
		let t = this.createPointerEvent(e);
		this._isPointerMoveEvent = !1;
		let n = t.pointerType === "mouse" || t.pointerType === "pen", r = this.trackingData(e.pointerId), i = this.findMountedTarget(r.overTargets);
		if (r.overTargets?.length > 0 && i !== t.target) {
			let r = e.type === "mousemove" ? "mouseout" : "pointerout", a = this.createPointerEvent(e, r, i);
			if (this.dispatchEvent(a, "pointerout"), n && this.dispatchEvent(a, "mouseout"), !t.composedPath().includes(i)) {
				let r = this.createPointerEvent(e, "pointerleave", i);
				for (r.eventPhase = r.AT_TARGET; r.target && !t.composedPath().includes(r.target);) r.currentTarget = r.target, this.notifyTarget(r), n && this.notifyTarget(r, "mouseleave"), r.target = r.target.parent;
				this.freeEvent(r);
			}
			this.freeEvent(a);
		}
		if (i !== t.target) {
			let r = e.type === "mousemove" ? "mouseover" : "pointerover", a = this.clonePointerEvent(t, r);
			this.dispatchEvent(a, "pointerover"), n && this.dispatchEvent(a, "mouseover");
			let o = i?.parent;
			for (; o && o !== this.rootTarget.parent && o !== t.target;) o = o.parent;
			if (!o || o === this.rootTarget.parent) {
				let e = this.clonePointerEvent(t, "pointerenter");
				for (e.eventPhase = e.AT_TARGET; e.target && e.target !== i && e.target !== this.rootTarget.parent;) e.currentTarget = e.target, this.notifyTarget(e), n && this.notifyTarget(e, "mouseenter"), e.target = e.target.parent;
				this.freeEvent(e);
			}
			this.freeEvent(a);
		}
		let a = [], o = this.enableGlobalMoveEvents ?? !0;
		this.moveOnAll ? a.push("pointermove") : this.dispatchEvent(t, "pointermove"), o && a.push("globalpointermove"), t.pointerType === "touch" && (this.moveOnAll ? a.splice(1, 0, "touchmove") : this.dispatchEvent(t, "touchmove"), o && a.push("globaltouchmove")), n && (this.moveOnAll ? a.splice(1, 0, "mousemove") : this.dispatchEvent(t, "mousemove"), o && a.push("globalmousemove"), this.cursor = t.target?.cursor), a.length > 0 && this.all(t, a), this._allInteractiveElements.length = 0, this._hitElements.length = 0, r.overTargets = t.composedPath(), this.freeEvent(t);
	}
	mapPointerOver(e) {
		if (!(e instanceof mr)) return;
		let t = this.trackingData(e.pointerId), n = this.createPointerEvent(e), r = n.pointerType === "mouse" || n.pointerType === "pen";
		this.dispatchEvent(n, "pointerover"), r && this.dispatchEvent(n, "mouseover"), n.pointerType === "mouse" && (this.cursor = n.target?.cursor);
		let i = this.clonePointerEvent(n, "pointerenter");
		for (i.eventPhase = i.AT_TARGET; i.target && i.target !== this.rootTarget.parent;) i.currentTarget = i.target, this.notifyTarget(i), r && this.notifyTarget(i, "mouseenter"), i.target = i.target.parent;
		t.overTargets = n.composedPath(), this.freeEvent(n), this.freeEvent(i);
	}
	mapPointerOut(e) {
		if (!(e instanceof mr)) return;
		let t = this.trackingData(e.pointerId);
		if (t.overTargets) {
			let n = e.pointerType === "mouse" || e.pointerType === "pen", r = this.findMountedTarget(t.overTargets), i = this.createPointerEvent(e, "pointerout", r);
			this.dispatchEvent(i), n && this.dispatchEvent(i, "mouseout");
			let a = this.createPointerEvent(e, "pointerleave", r);
			for (a.eventPhase = a.AT_TARGET; a.target && a.target !== this.rootTarget.parent;) a.currentTarget = a.target, this.notifyTarget(a), n && this.notifyTarget(a, "mouseleave"), a.target = a.target.parent;
			t.overTargets = null, this.freeEvent(i), this.freeEvent(a);
		}
		this.cursor = null;
	}
	mapPointerUp(e) {
		if (!(e instanceof mr)) return;
		let t = performance.now(), n = this.createPointerEvent(e);
		if (this.dispatchEvent(n, "pointerup"), n.pointerType === "touch") this.dispatchEvent(n, "touchend");
		else if (n.pointerType === "mouse" || n.pointerType === "pen") {
			let e = n.button === 2;
			this.dispatchEvent(n, e ? "rightup" : "mouseup");
		}
		let r = this.trackingData(e.pointerId), i = this.findMountedTarget(r.pressTargetsByButton[e.button]), a = i;
		if (i && !n.composedPath().includes(i)) {
			let t = i;
			for (; t && !n.composedPath().includes(t);) {
				if (n.currentTarget = t, this.notifyTarget(n, "pointerupoutside"), n.pointerType === "touch") this.notifyTarget(n, "touchendoutside");
				else if (n.pointerType === "mouse" || n.pointerType === "pen") {
					let e = n.button === 2;
					this.notifyTarget(n, e ? "rightupoutside" : "mouseupoutside");
				}
				t = t.parent;
			}
			delete r.pressTargetsByButton[e.button], a = t;
		}
		if (a) {
			let i = this.clonePointerEvent(n, "click");
			i.target = a, i.path = null, r.clicksByButton[e.button] || (r.clicksByButton[e.button] = {
				clickCount: 0,
				target: i.target,
				timeStamp: t
			});
			let o = r.clicksByButton[e.button];
			if (o.target === i.target && t - o.timeStamp < 200 ? ++o.clickCount : o.clickCount = 1, o.target = i.target, o.timeStamp = t, i.detail = o.clickCount, i.pointerType === "mouse") {
				let e = i.button === 2;
				this.dispatchEvent(i, e ? "rightclick" : "click");
			} else i.pointerType === "touch" && this.dispatchEvent(i, "tap");
			this.dispatchEvent(i, "pointertap"), this.freeEvent(i);
		}
		this.freeEvent(n);
	}
	mapPointerUpOutside(e) {
		if (!(e instanceof mr)) return;
		let t = this.trackingData(e.pointerId), n = this.findMountedTarget(t.pressTargetsByButton[e.button]), r = this.createPointerEvent(e);
		if (n) {
			let i = n;
			for (; i;) r.currentTarget = i, this.notifyTarget(r, "pointerupoutside"), r.pointerType === "touch" ? this.notifyTarget(r, "touchendoutside") : (r.pointerType === "mouse" || r.pointerType === "pen") && this.notifyTarget(r, r.button === 2 ? "rightupoutside" : "mouseupoutside"), i = i.parent;
			delete t.pressTargetsByButton[e.button];
		}
		this.freeEvent(r);
	}
	mapWheel(e) {
		if (!(e instanceof hr)) return;
		let t = this.createWheelEvent(e);
		this.dispatchEvent(t), this.freeEvent(t);
	}
	findMountedTarget(e) {
		if (!e) return null;
		let t = e[0];
		for (let n = 1; n < e.length && e[n].parent === t; n++) t = e[n];
		return t;
	}
	createPointerEvent(e, t, n) {
		let r = this.allocateEvent(mr);
		return this.copyPointerData(e, r), this.copyMouseData(e, r), this.copyData(e, r), r.nativeEvent = e.nativeEvent, r.originalEvent = e, r.target = n ?? this.hitTest(r.global.x, r.global.y) ?? this._hitElements[0], typeof t == "string" && (r.type = t), r;
	}
	createWheelEvent(e) {
		let t = this.allocateEvent(hr);
		return this.copyWheelData(e, t), this.copyMouseData(e, t), this.copyData(e, t), t.nativeEvent = e.nativeEvent, t.originalEvent = e, t.target = this.hitTest(t.global.x, t.global.y), t;
	}
	clonePointerEvent(e, t) {
		let n = this.allocateEvent(mr);
		return n.nativeEvent = e.nativeEvent, n.originalEvent = e.originalEvent, this.copyPointerData(e, n), this.copyMouseData(e, n), this.copyData(e, n), n.target = e.target, n.path = e.composedPath().slice(), n.type = t ?? n.type, n;
	}
	copyWheelData(e, t) {
		t.deltaMode = e.deltaMode, t.deltaX = e.deltaX, t.deltaY = e.deltaY, t.deltaZ = e.deltaZ;
	}
	copyPointerData(e, t) {
		e instanceof mr && t instanceof mr && (t.pointerId = e.pointerId, t.width = e.width, t.height = e.height, t.isPrimary = e.isPrimary, t.pointerType = e.pointerType, t.pressure = e.pressure, t.tangentialPressure = e.tangentialPressure, t.tiltX = e.tiltX, t.tiltY = e.tiltY, t.twist = e.twist);
	}
	copyMouseData(e, t) {
		e instanceof pr && t instanceof pr && (t.altKey = e.altKey, t.button = e.button, t.buttons = e.buttons, t.client.copyFrom(e.client), t.ctrlKey = e.ctrlKey, t.metaKey = e.metaKey, t.movement.copyFrom(e.movement), t.screen.copyFrom(e.screen), t.shiftKey = e.shiftKey, t.global.copyFrom(e.global));
	}
	copyData(e, t) {
		t.isTrusted = e.isTrusted, t.srcElement = e.srcElement, t.timeStamp = performance.now(), t.type = e.type, t.detail = e.detail, t.view = e.view, t.which = e.which, t.layer.copyFrom(e.layer), t.page.copyFrom(e.page);
	}
	trackingData(e) {
		return this.mappingState.trackingData[e] || (this.mappingState.trackingData[e] = {
			pressTargetsByButton: {},
			clicksByButton: {},
			overTarget: null
		}), this.mappingState.trackingData[e];
	}
	allocateEvent(e) {
		this.eventPool.has(e) || this.eventPool.set(e, []);
		let t = this.eventPool.get(e).pop() || new e(this);
		return t.eventPhase = t.NONE, t.currentTarget = null, t.defaultPrevented = !1, t.path = null, t.target = null, t;
	}
	freeEvent(e) {
		if (e.manager !== this) throw Error("It is illegal to free an event not managed by this EventBoundary!");
		let t = e.constructor;
		this.eventPool.has(t) || this.eventPool.set(t, []), this.eventPool.get(t).push(e);
	}
	_notifyListeners(e, t) {
		let n = e.currentTarget._events[t];
		if (n) {
			if ("fn" in n) n.once && e.currentTarget.removeListener(t, n.fn, void 0, !0), n.fn.call(n.context, e);
			else for (let r = 0, i = n.length; r < i && !e.propagationImmediatelyStopped; r++) n[r].once && e.currentTarget.removeListener(t, n[r].fn, void 0, !0), n[r].fn.call(n[r].context, e);
		}
	}
}, br = Object.defineProperty, xr = Object.getOwnPropertySymbols, Sr = Object.prototype.hasOwnProperty, Cr = Object.prototype.propertyIsEnumerable, wr = (e, t, n) => t in e ? br(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Tr = (e, t) => {
	for (var n in t ||= {}) Sr.call(t, n) && wr(e, n, t[n]);
	if (xr) for (var n of xr(t)) Cr.call(t, n) && wr(e, n, t[n]);
	return e;
}, Er = 1, Dr = {
	touchstart: "pointerdown",
	touchend: "pointerup",
	touchendoutside: "pointerupoutside",
	touchmove: "pointermove",
	touchcancel: "pointercancel"
}, Or = class e {
	constructor(t) {
		this.supportsTouchEvents = "ontouchstart" in globalThis, this.supportsPointerEvents = !!globalThis.PointerEvent, this.domElement = null, this.resolution = 1, this.renderer = t, this.rootBoundary = new yr(null), fr.init(this), this.autoPreventDefault = !0, this._eventsAdded = !1, this._rootPointerEvent = new mr(null), this._rootWheelEvent = new hr(null), this.cursorStyles = {
			default: "inherit",
			pointer: "pointer"
		}, this.features = new Proxy(Tr({}, e.defaultEventFeatures), { set: (e, t, n) => (t === "globalMove" && (this.rootBoundary.enableGlobalMoveEvents = n), e[t] = n, !0) }), this._onPointerDown = this._onPointerDown.bind(this), this._onPointerMove = this._onPointerMove.bind(this), this._onPointerUp = this._onPointerUp.bind(this), this._onPointerOverOut = this._onPointerOverOut.bind(this), this.onWheel = this.onWheel.bind(this);
	}
	static get defaultEventMode() {
		return this._defaultEventMode;
	}
	init(t) {
		let { canvas: n, resolution: r } = this.renderer;
		this.setTargetElement(n), this.resolution = r, e._defaultEventMode = t.eventMode ?? "passive", Object.assign(this.features, t.eventFeatures ?? {}), this.rootBoundary.enableGlobalMoveEvents = this.features.globalMove;
	}
	resolutionChange(e) {
		this.resolution = e;
	}
	destroy() {
		fr.destroy(), this.setTargetElement(null), this.renderer = null, this._currentCursor = null;
	}
	setCursor(e) {
		e ||= "default";
		let t = !0;
		if (globalThis.OffscreenCanvas && this.domElement instanceof OffscreenCanvas && (t = !1), this._currentCursor === e) return;
		this._currentCursor = e;
		let n = this.cursorStyles[e];
		if (n) switch (typeof n) {
			case "string":
				t && (this.domElement.style.cursor = n);
				break;
			case "function":
				n(e);
				break;
			case "object": t && Object.assign(this.domElement.style, n);
		}
		else t && typeof e == "string" && !Object.prototype.hasOwnProperty.call(this.cursorStyles, e) && (this.domElement.style.cursor = e);
	}
	get pointer() {
		return this._rootPointerEvent;
	}
	_onPointerDown(e) {
		if (!this.features.click) return;
		this.rootBoundary.rootTarget = this.renderer.lastObjectRendered;
		let t = this._normalizeToPointerData(e);
		this.autoPreventDefault && t[0].isNormalized && (e.cancelable || !("cancelable" in e)) && e.preventDefault();
		for (let e = 0, n = t.length; e < n; e++) {
			let n = t[e], r = this._bootstrapEvent(this._rootPointerEvent, n);
			this.rootBoundary.mapEvent(r);
		}
		this.setCursor(this.rootBoundary.cursor);
	}
	_onPointerMove(e) {
		if (!this.features.move) return;
		this.rootBoundary.rootTarget = this.renderer.lastObjectRendered, fr.pointerMoved();
		let t = this._normalizeToPointerData(e);
		for (let e = 0, n = t.length; e < n; e++) {
			let n = this._bootstrapEvent(this._rootPointerEvent, t[e]);
			this.rootBoundary.mapEvent(n);
		}
		this.setCursor(this.rootBoundary.cursor);
	}
	_onPointerUp(e) {
		if (!this.features.click) return;
		this.rootBoundary.rootTarget = this.renderer.lastObjectRendered;
		let t = e.target;
		e.composedPath && e.composedPath().length > 0 && (t = e.composedPath()[0]);
		let n = t === this.domElement ? "" : "outside", r = this._normalizeToPointerData(e);
		for (let e = 0, t = r.length; e < t; e++) {
			let t = this._bootstrapEvent(this._rootPointerEvent, r[e]);
			t.type += n, this.rootBoundary.mapEvent(t);
		}
		this.setCursor(this.rootBoundary.cursor);
	}
	_onPointerOverOut(e) {
		if (!this.features.click) return;
		this.rootBoundary.rootTarget = this.renderer.lastObjectRendered;
		let t = this._normalizeToPointerData(e);
		for (let e = 0, n = t.length; e < n; e++) {
			let n = this._bootstrapEvent(this._rootPointerEvent, t[e]);
			this.rootBoundary.mapEvent(n);
		}
		this.setCursor(this.rootBoundary.cursor);
	}
	onWheel(e) {
		if (!this.features.wheel) return;
		let t = this.normalizeWheelEvent(e);
		this.rootBoundary.rootTarget = this.renderer.lastObjectRendered, this.rootBoundary.mapEvent(t);
	}
	setTargetElement(e) {
		this._removeEvents(), this.domElement = e, fr.domElement = e, this._addEvents();
	}
	_addEvents() {
		if (this._eventsAdded || !this.domElement) return;
		fr.addTickerListener();
		let e = this.domElement.style;
		e && (globalThis.navigator.msPointerEnabled ? (e.msContentZooming = "none", e.msTouchAction = "none") : this.supportsPointerEvents && (e.touchAction = "none")), this.supportsPointerEvents ? (globalThis.document.addEventListener("pointermove", this._onPointerMove, !0), this.domElement.addEventListener("pointerdown", this._onPointerDown, !0), this.domElement.addEventListener("pointerleave", this._onPointerOverOut, !0), this.domElement.addEventListener("pointerover", this._onPointerOverOut, !0), globalThis.addEventListener("pointerup", this._onPointerUp, !0)) : (globalThis.document.addEventListener("mousemove", this._onPointerMove, !0), this.domElement.addEventListener("mousedown", this._onPointerDown, !0), this.domElement.addEventListener("mouseout", this._onPointerOverOut, !0), this.domElement.addEventListener("mouseover", this._onPointerOverOut, !0), globalThis.addEventListener("mouseup", this._onPointerUp, !0), this.supportsTouchEvents && (this.domElement.addEventListener("touchstart", this._onPointerDown, !0), this.domElement.addEventListener("touchend", this._onPointerUp, !0), this.domElement.addEventListener("touchmove", this._onPointerMove, !0))), this.domElement.addEventListener("wheel", this.onWheel, {
			passive: !0,
			capture: !0
		}), this._eventsAdded = !0;
	}
	_removeEvents() {
		if (!this._eventsAdded || !this.domElement) return;
		fr.removeTickerListener();
		let e = this.domElement.style;
		e && (globalThis.navigator.msPointerEnabled ? (e.msContentZooming = "", e.msTouchAction = "") : this.supportsPointerEvents && (e.touchAction = "")), this.supportsPointerEvents ? (globalThis.document.removeEventListener("pointermove", this._onPointerMove, !0), this.domElement.removeEventListener("pointerdown", this._onPointerDown, !0), this.domElement.removeEventListener("pointerleave", this._onPointerOverOut, !0), this.domElement.removeEventListener("pointerover", this._onPointerOverOut, !0), globalThis.removeEventListener("pointerup", this._onPointerUp, !0)) : (globalThis.document.removeEventListener("mousemove", this._onPointerMove, !0), this.domElement.removeEventListener("mousedown", this._onPointerDown, !0), this.domElement.removeEventListener("mouseout", this._onPointerOverOut, !0), this.domElement.removeEventListener("mouseover", this._onPointerOverOut, !0), globalThis.removeEventListener("mouseup", this._onPointerUp, !0), this.supportsTouchEvents && (this.domElement.removeEventListener("touchstart", this._onPointerDown, !0), this.domElement.removeEventListener("touchend", this._onPointerUp, !0), this.domElement.removeEventListener("touchmove", this._onPointerMove, !0))), this.domElement.removeEventListener("wheel", this.onWheel, !0), this.domElement = null, this._eventsAdded = !1;
	}
	mapPositionToPoint(e, t, n) {
		let r = this.domElement.isConnected ? this.domElement.getBoundingClientRect() : {
			x: 0,
			y: 0,
			width: this.domElement.width,
			height: this.domElement.height,
			left: 0,
			top: 0
		}, i = 1 / this.resolution;
		e.x = (t - r.left) * (this.domElement.width / r.width) * i, e.y = (n - r.top) * (this.domElement.height / r.height) * i;
	}
	_normalizeToPointerData(e) {
		let t = [];
		if (this.supportsTouchEvents && e instanceof TouchEvent) for (let n = 0, r = e.changedTouches.length; n < r; n++) {
			let r = e.changedTouches[n];
			r.button === void 0 && (r.button = 0), r.buttons === void 0 && (r.buttons = 1), r.isPrimary === void 0 && (r.isPrimary = e.touches.length === 1 && e.type === "touchstart"), r.width === void 0 && (r.width = r.radiusX || 1), r.height === void 0 && (r.height = r.radiusY || 1), r.tiltX === void 0 && (r.tiltX = 0), r.tiltY === void 0 && (r.tiltY = 0), r.pointerType === void 0 && (r.pointerType = "touch"), r.pointerId === void 0 && (r.pointerId = r.identifier || 0), r.pressure === void 0 && (r.pressure = r.force || .5), r.twist === void 0 && (r.twist = 0), r.tangentialPressure === void 0 && (r.tangentialPressure = 0), r.layerX === void 0 && (r.layerX = r.offsetX = r.clientX), r.layerY === void 0 && (r.layerY = r.offsetY = r.clientY), r.isNormalized = !0, r.type = e.type, r.altKey ??= e.altKey, r.ctrlKey ??= e.ctrlKey, r.metaKey ??= e.metaKey, r.shiftKey ??= e.shiftKey, t.push(r);
		}
		else if (!globalThis.MouseEvent || e instanceof MouseEvent && (!this.supportsPointerEvents || !(e instanceof globalThis.PointerEvent))) {
			let n = e;
			n.isPrimary === void 0 && (n.isPrimary = !0), n.width === void 0 && (n.width = 1), n.height === void 0 && (n.height = 1), n.tiltX === void 0 && (n.tiltX = 0), n.tiltY === void 0 && (n.tiltY = 0), n.pointerType === void 0 && (n.pointerType = "mouse"), n.pointerId === void 0 && (n.pointerId = Er), n.pressure === void 0 && (n.pressure = .5), n.twist === void 0 && (n.twist = 0), n.tangentialPressure === void 0 && (n.tangentialPressure = 0), n.isNormalized = !0, t.push(n);
		} else t.push(e);
		return t;
	}
	normalizeWheelEvent(e) {
		let t = this._rootWheelEvent;
		return this._transferMouseData(t, e), t.deltaX = e.deltaX, t.deltaY = e.deltaY, t.deltaZ = e.deltaZ, t.deltaMode = e.deltaMode, this.mapPositionToPoint(t.screen, e.clientX, e.clientY), t.global.copyFrom(t.screen), t.offset.copyFrom(t.screen), t.nativeEvent = e, t.type = e.type, t;
	}
	_bootstrapEvent(e, t) {
		return e.originalEvent = null, e.nativeEvent = t, e.pointerId = t.pointerId, e.width = t.width, e.height = t.height, e.isPrimary = t.isPrimary, e.pointerType = t.pointerType, e.pressure = t.pressure, e.tangentialPressure = t.tangentialPressure, e.tiltX = t.tiltX, e.tiltY = t.tiltY, e.twist = t.twist, this._transferMouseData(e, t), this.mapPositionToPoint(e.screen, t.clientX, t.clientY), e.global.copyFrom(e.screen), e.offset.copyFrom(e.screen), e.isTrusted = t.isTrusted, e.type === "pointerleave" && (e.type = "pointerout"), e.type.startsWith("mouse") && (e.type = e.type.replace("mouse", "pointer")), e.type.startsWith("touch") && (e.type = Dr[e.type] || e.type), e;
	}
	_transferMouseData(e, t) {
		e.isTrusted = t.isTrusted, e.srcElement = t.srcElement, e.timeStamp = performance.now(), e.type = t.type, e.altKey = t.altKey, e.button = t.button, e.buttons = t.buttons, e.client.x = t.clientX, e.client.y = t.clientY, e.ctrlKey = t.ctrlKey, e.metaKey = t.metaKey, e.movement.x = t.movementX, e.movement.y = t.movementY, e.page.x = t.pageX, e.page.y = t.pageY, e.relatedTarget = null, e.shiftKey = t.shiftKey;
	}
};
Or.extension = {
	name: "events",
	type: [
		h.WebGLSystem,
		h.CanvasSystem,
		h.WebGPUSystem
	],
	priority: -1
}, Or.defaultEventFeatures = {
	move: !0,
	globalMove: !0,
	click: !0,
	wheel: !0
};
var kr = Or;
v.add(kr), v.mixin(Y, {
	onclick: null,
	onmousedown: null,
	onmouseenter: null,
	onmouseleave: null,
	onmousemove: null,
	onglobalmousemove: null,
	onmouseout: null,
	onmouseover: null,
	onmouseup: null,
	onmouseupoutside: null,
	onpointercancel: null,
	onpointerdown: null,
	onpointerenter: null,
	onpointerleave: null,
	onpointermove: null,
	onglobalpointermove: null,
	onpointerout: null,
	onpointerover: null,
	onpointertap: null,
	onpointerup: null,
	onpointerupoutside: null,
	onrightclick: null,
	onrightdown: null,
	onrightup: null,
	onrightupoutside: null,
	ontap: null,
	ontouchcancel: null,
	ontouchend: null,
	ontouchendoutside: null,
	ontouchmove: null,
	onglobaltouchmove: null,
	ontouchstart: null,
	onwheel: null,
	get interactive() {
		return this.eventMode === "dynamic" || this.eventMode === "static";
	},
	set interactive(e) {
		this.eventMode = e ? "static" : "passive";
	},
	_internalEventMode: void 0,
	get eventMode() {
		return this._internalEventMode ?? kr.defaultEventMode;
	},
	set eventMode(e) {
		this._internalEventMode = e;
	},
	isInteractive() {
		return this.eventMode === "static" || this.eventMode === "dynamic";
	},
	interactiveChildren: !0,
	hitArea: null,
	addEventListener(e, t, n) {
		let r = typeof n == "boolean" && n || typeof n == "object" && n.capture, i = typeof n == "object" ? n.signal : void 0, a = typeof n == "object" && n.once === !0, o = typeof t == "function" ? void 0 : t;
		e = r ? `${e}capture` : e;
		let s = typeof t == "function" ? t : t.handleEvent, c = this;
		i && i.addEventListener("abort", () => {
			c.off(e, s, o);
		}), a ? c.once(e, s, o) : c.on(e, s, o);
	},
	removeEventListener(e, t, n) {
		let r = typeof n == "boolean" && n || typeof n == "object" && n.capture, i = typeof t == "function" ? void 0 : t;
		e = r ? `${e}capture` : e, t = typeof t == "function" ? t : t.handleEvent, this.off(e, t, i);
	},
	dispatchEvent(e) {
		if (!(e instanceof Dn)) throw Error("Container cannot propagate events outside of the Federated Events API");
		return e.defaultPrevented = !1, e.path = null, e.target = this, e.manager.dispatchEvent(e), !e.defaultPrevented;
	}
});
var Ar = ((e) => (e[e.Low = 0] = "Low", e[e.Normal = 1] = "Normal", e[e.High = 2] = "High", e))(Ar || {}), jr = {
	createCanvas: (e, t) => {
		let n = document.createElement("canvas");
		return n.width = e, n.height = t, n;
	},
	createImage: () => new Image(),
	getCanvasRenderingContext2D: () => CanvasRenderingContext2D,
	getWebGLRenderingContext: () => WebGLRenderingContext,
	getNavigator: () => navigator,
	getBaseUrl: () => document.baseURI ?? window.location.href,
	getFontFaceSet: () => document.fonts,
	fetch: (e, t) => fetch(e, t),
	parseXML: (e) => new DOMParser().parseFromString(e, "text/xml")
}, X = {
	get() {
		return jr;
	},
	set(e) {
		jr = e;
	}
};
function Mr(e) {
	if (typeof e != "string") throw TypeError(`Path must be a string. Received ${JSON.stringify(e)}`);
}
function Nr(e) {
	return e.split("?")[0].split("#")[0];
}
function Pr(e) {
	return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function Fr(e, t, n) {
	return e.replace(new RegExp(Pr(t), "g"), n);
}
function Ir(e, t) {
	let n = "", r = 0, i = -1, a = 0, o = -1;
	for (let s = 0; s <= e.length; ++s) {
		if (s < e.length) o = e.charCodeAt(s);
		else {
			if (o === 47) break;
			o = 47;
		}
		if (o === 47) {
			if (i !== s - 1 && a !== 1) {
				if (i !== s - 1 && a === 2) {
					if (n.length < 2 || r !== 2 || n.charCodeAt(n.length - 1) !== 46 || n.charCodeAt(n.length - 2) !== 46) {
						if (n.length > 2) {
							let e = n.lastIndexOf("/");
							if (e !== n.length - 1) {
								e === -1 ? (n = "", r = 0) : (n = n.slice(0, e), r = n.length - 1 - n.lastIndexOf("/")), i = s, a = 0;
								continue;
							}
						} else if (n.length === 2 || n.length === 1) {
							n = "", r = 0, i = s, a = 0;
							continue;
						}
					}
					t && (n.length > 0 ? n += "/.." : n = "..", r = 2);
				} else n.length > 0 ? n += `/${e.slice(i + 1, s)}` : n = e.slice(i + 1, s), r = s - i - 1;
			}
			i = s, a = 0;
		} else o === 46 && a !== -1 ? ++a : a = -1;
	}
	return n;
}
var Lr = {
	toPosix(e) {
		return Fr(e, "\\", "/");
	},
	isUrl(e) {
		return /^https?:/.test(this.toPosix(e));
	},
	isDataUrl(e) {
		return /^data:([a-z]+\/[a-z0-9-+.]+(;[a-z0-9-.!#$%*+.{}|~`]+=[a-z0-9-.!#$%*+.{}()_|~`]+)*)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s<>]*?)$/i.test(e);
	},
	isBlobUrl(e) {
		return e.startsWith("blob:");
	},
	hasProtocol(e) {
		return /^[^/:]+:/.test(this.toPosix(e));
	},
	getProtocol(e) {
		Mr(e), e = this.toPosix(e);
		let t = /^file:\/\/\//.exec(e);
		if (t) return t[0];
		let n = /^[^/:]+:\/{0,2}/.exec(e);
		return n ? n[0] : "";
	},
	toAbsolute(e, t, n) {
		if (Mr(e), this.isDataUrl(e) || this.isBlobUrl(e)) return e;
		let r = Nr(this.toPosix(t ?? X.get().getBaseUrl())), i = Nr(this.toPosix(n ?? this.rootname(r)));
		return e = this.toPosix(e), e.startsWith("/") ? Lr.join(i, e.slice(1)) : this.isAbsolute(e) ? e : this.join(r, e);
	},
	normalize(e) {
		if (Mr(e), e.length === 0) return ".";
		if (this.isDataUrl(e) || this.isBlobUrl(e)) return e;
		e = this.toPosix(e);
		let t = "", n = e.startsWith("/");
		this.hasProtocol(e) && (t = this.rootname(e), e = e.slice(t.length));
		let r = e.endsWith("/");
		return e = Ir(e, !1), e.length > 0 && r && (e += "/"), n ? `/${e}` : t + e;
	},
	isAbsolute(e) {
		return Mr(e), e = this.toPosix(e), this.hasProtocol(e) ? !0 : e.startsWith("/");
	},
	join(...e) {
		if (e.length === 0) return ".";
		let t;
		for (let n = 0; n < e.length; ++n) {
			let r = e[n];
			if (Mr(r), r.length > 0) {
				if (t === void 0) t = r;
				else {
					let i = e[n - 1] ?? "";
					this.joinExtensions.includes(this.extname(i).toLowerCase()) ? t += `/../${r}` : t += `/${r}`;
				}
			}
		}
		return t === void 0 ? "." : this.normalize(t);
	},
	dirname(e) {
		if (Mr(e), e.length === 0) return ".";
		e = this.toPosix(e);
		let t = e.charCodeAt(0), n = t === 47, r = -1, i = !0, a = this.getProtocol(e), o = e;
		e = e.slice(a.length);
		for (let n = e.length - 1; n >= 1; --n) if (t = e.charCodeAt(n), t === 47) {
			if (!i) {
				r = n;
				break;
			}
		} else i = !1;
		return r === -1 ? n ? "/" : this.isUrl(o) ? a + e : a : n && r === 1 ? "//" : a + e.slice(0, r);
	},
	rootname(e) {
		Mr(e), e = this.toPosix(e);
		let t = "";
		if (t = e.startsWith("/") ? "/" : this.getProtocol(e), this.isUrl(e)) {
			let n = e.indexOf("/", t.length);
			t = n === -1 ? e : e.slice(0, n), t.endsWith("/") || (t += "/");
		}
		return t;
	},
	basename(e, t) {
		Mr(e), t && Mr(t), e = Nr(this.toPosix(e));
		let n = 0, r = -1, i = !0, a;
		if (t !== void 0 && t.length > 0 && t.length <= e.length) {
			if (t.length === e.length && t === e) return "";
			let o = t.length - 1, s = -1;
			for (a = e.length - 1; a >= 0; --a) {
				let c = e.charCodeAt(a);
				if (c === 47) {
					if (!i) {
						n = a + 1;
						break;
					}
				} else s === -1 && (i = !1, s = a + 1), o >= 0 && (c === t.charCodeAt(o) ? --o === -1 && (r = a) : (o = -1, r = s));
			}
			return n === r ? r = s : r === -1 && (r = e.length), e.slice(n, r);
		}
		for (a = e.length - 1; a >= 0; --a) if (e.charCodeAt(a) === 47) {
			if (!i) {
				n = a + 1;
				break;
			}
		} else r === -1 && (i = !1, r = a + 1);
		return r === -1 ? "" : e.slice(n, r);
	},
	extname(e) {
		Mr(e), e = Nr(this.toPosix(e));
		let t = -1, n = 0, r = -1, i = !0, a = 0;
		for (let o = e.length - 1; o >= 0; --o) {
			let s = e.charCodeAt(o);
			if (s === 47) {
				if (!i) {
					n = o + 1;
					break;
				}
				continue;
			}
			r === -1 && (i = !1, r = o + 1), s === 46 ? t === -1 ? t = o : a !== 1 && (a = 1) : t !== -1 && (a = -1);
		}
		return t === -1 || r === -1 || a === 0 || a === 1 && t === r - 1 && t === n + 1 ? "" : e.slice(t, r);
	},
	parse(e) {
		Mr(e);
		let t = {
			root: "",
			dir: "",
			base: "",
			ext: "",
			name: ""
		};
		if (e.length === 0) return t;
		e = Nr(this.toPosix(e));
		let n = e.charCodeAt(0), r = this.isAbsolute(e), i;
		t.root = this.rootname(e), i = r || this.hasProtocol(e) ? 1 : 0;
		let a = -1, o = 0, s = -1, c = !0, l = e.length - 1, u = 0;
		for (; l >= i; --l) {
			if (n = e.charCodeAt(l), n === 47) {
				if (!c) {
					o = l + 1;
					break;
				}
				continue;
			}
			s === -1 && (c = !1, s = l + 1), n === 46 ? a === -1 ? a = l : u !== 1 && (u = 1) : a !== -1 && (u = -1);
		}
		return a === -1 || s === -1 || u === 0 || u === 1 && a === s - 1 && a === o + 1 ? s !== -1 && (t.base = t.name = o === 0 && r ? e.slice(1, s) : e.slice(o, s)) : (o === 0 && r ? (t.name = e.slice(1, a), t.base = e.slice(1, s)) : (t.name = e.slice(o, a), t.base = e.slice(o, s)), t.ext = e.slice(a, s)), t.dir = this.dirname(e), t;
	},
	sep: "/",
	delimiter: ":",
	joinExtensions: [".html"]
}, Rr = (e, t, n = !1) => (Array.isArray(e) || (e = [e]), t ? e.map((e) => typeof e == "string" || n ? t(e) : e) : e);
function zr(e, t, n, r, i) {
	let a = t[n];
	for (let o = 0; o < a.length; o++) {
		let s = a[o];
		n < t.length - 1 ? zr(e.replace(r[n], s), t, n + 1, r, i) : i.push(e.replace(r[n], s));
	}
}
function Br(e) {
	let t = e.match(/\{(.*?)\}/g), n = [];
	if (t) {
		let r = [];
		t.forEach((e) => {
			let t = e.substring(1, e.length - 1).split(",");
			r.push(t);
		}), zr(e, r, 0, t, n);
	} else n.push(e);
	return n;
}
var Vr = (e) => !Array.isArray(e), Hr = Object.defineProperty, Ur = Object.defineProperties, Wr = Object.getOwnPropertyDescriptors, Gr = Object.getOwnPropertySymbols, Kr = Object.prototype.hasOwnProperty, qr = Object.prototype.propertyIsEnumerable, Jr = (e, t, n) => t in e ? Hr(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Yr = (e, t) => {
	for (var n in t ||= {}) Kr.call(t, n) && Jr(e, n, t[n]);
	if (Gr) for (var n of Gr(t)) qr.call(t, n) && Jr(e, n, t[n]);
	return e;
}, Xr = (e, t) => Ur(e, Wr(t)), Zr = class {
	constructor() {
		this._defaultBundleIdentifierOptions = {
			connector: "-",
			createBundleAssetId: (e, t) => `${e}${this._bundleIdConnector}${t}`,
			extractAssetIdFromBundle: (e, t) => t.replace(`${e}${this._bundleIdConnector}`, "")
		}, this._bundleIdConnector = this._defaultBundleIdentifierOptions.connector, this._createBundleAssetId = this._defaultBundleIdentifierOptions.createBundleAssetId, this._extractAssetIdFromBundle = this._defaultBundleIdentifierOptions.extractAssetIdFromBundle, this._assetMap = {}, this._preferredOrder = [], this._parsers = [], this._resolverHash = {}, this._bundles = {};
	}
	setBundleIdentifier(e) {
		if (this._bundleIdConnector = e.connector ?? this._bundleIdConnector, this._createBundleAssetId = e.createBundleAssetId ?? this._createBundleAssetId, this._extractAssetIdFromBundle = e.extractAssetIdFromBundle ?? this._extractAssetIdFromBundle, this._extractAssetIdFromBundle("foo", this._createBundleAssetId("foo", "bar")) !== "bar") throw Error("[Resolver] GenerateBundleAssetId are not working correctly");
	}
	prefer(...e) {
		e.forEach((e) => {
			this._preferredOrder.push(e), e.priority ||= Object.keys(e.params);
		}), this._resolverHash = {};
	}
	set basePath(e) {
		this._basePath = e;
	}
	get basePath() {
		return this._basePath;
	}
	set rootPath(e) {
		this._rootPath = e;
	}
	get rootPath() {
		return this._rootPath;
	}
	get parsers() {
		return this._parsers;
	}
	reset() {
		this.setBundleIdentifier(this._defaultBundleIdentifierOptions), this._assetMap = {}, this._preferredOrder = [], this._resolverHash = {}, this._rootPath = null, this._basePath = null, this._manifest = null, this._bundles = {}, this._defaultSearchParams = null;
	}
	setDefaultSearchParams(e) {
		if (typeof e == "string") this._defaultSearchParams = e;
		else {
			let t = e;
			this._defaultSearchParams = Object.keys(t).map((e) => `${encodeURIComponent(e)}=${encodeURIComponent(t[e])}`).join("&");
		}
	}
	getAlias(e) {
		let { alias: t, src: n } = e;
		return Rr(t || n, (e) => typeof e == "string" ? e : Array.isArray(e) ? e.map((e) => e?.src ?? e) : e != null && e.src ? e.src : e, !0);
	}
	removeAlias(e, t) {
		this._assetMap[e] && (t && t !== this._resolverHash[e] || (delete this._resolverHash[e], delete this._assetMap[e]));
	}
	addManifest(e) {
		this._manifest, this._manifest = e, e.bundles.forEach((e) => {
			this.addBundle(e.name, e.assets);
		});
	}
	addBundle(e, t) {
		let n = [], r = t;
		Array.isArray(t) || (r = Object.entries(t).map(([e, t]) => typeof t == "string" || Array.isArray(t) ? {
			alias: e,
			src: t
		} : Yr({ alias: e }, t))), r.forEach((t) => {
			let r = t.src, i = t.alias, a;
			if (typeof i == "string") {
				let t = this._createBundleAssetId(e, i);
				n.push(t), a = [i, t];
			} else {
				let t = i.map((t) => this._createBundleAssetId(e, t));
				n.push(...t), a = [...i, ...t];
			}
			this.add(Xr(Yr({}, t), {
				alias: a,
				src: r
			}));
		}), this._bundles[e] = n;
	}
	add(e) {
		let t = [];
		Array.isArray(e) ? t.push(...e) : t.push(e), Rr(t).forEach((e) => {
			let { src: t } = e, { data: n, format: r, loadParser: i, parser: a } = e, o = Rr(t).map((e) => typeof e == "string" ? Br(e) : Array.isArray(e) ? e : [e]), s = this.getAlias(e), c = [], l = (e) => {
				let t = this._parsers.find((t) => t.test(e));
				return Yr({ src: e }, t?.parse(e));
			};
			o.forEach((t) => {
				t.forEach((t) => {
					let o = {};
					if (typeof t == "object" ? (n = t.data ?? n, r = t.format ?? r, (t.loadParser || t.parser) && (i = t.loadParser ?? i, a = t.parser ?? a), o = Yr(Yr({}, l(t.src)), t)) : o = l(t), !s) throw Error(`[Resolver] alias is undefined for this asset: ${o.src}`);
					o = this._buildResolvedAsset(o, {
						aliases: s,
						data: n,
						format: r,
						loadParser: i,
						parser: a,
						progressSize: e.progressSize
					}), c.push(o);
				});
			}), s.forEach((e) => {
				this._assetMap[e] = c;
			});
		});
	}
	resolveBundle(e) {
		let t = Vr(e);
		e = Rr(e);
		let n = {};
		return e.forEach((e) => {
			let t = this._bundles[e];
			if (t) {
				let r = this.resolve(t), i = {};
				for (let t in r) {
					let n = r[t];
					i[this._extractAssetIdFromBundle(e, t)] = n;
				}
				n[e] = i;
			}
		}), t ? n[e[0]] : n;
	}
	resolveUrl(e) {
		let t = this.resolve(e);
		if (typeof e != "string") {
			let e = {};
			for (let n in t) e[n] = t[n].src;
			return e;
		}
		return t.src;
	}
	resolve(e) {
		let t = Vr(e);
		e = Rr(e);
		let n = {};
		return e.forEach((e) => {
			if (!this._resolverHash[e]) {
				if (this._assetMap[e]) {
					let t = this._assetMap[e], n = this._getPreferredOrder(t);
					n?.priority.forEach((e) => {
						n.params[e].forEach((n) => {
							let r = t.filter((t) => t[e] ? t[e] === n : !1);
							r.length && (t = r);
						});
					}), this._resolverHash[e] = t[0];
				} else this._resolverHash[e] = this._buildResolvedAsset({
					alias: [e],
					src: e
				}, {});
			}
			n[e] = this._resolverHash[e];
		}), t ? n[e[0]] : n;
	}
	hasKey(e) {
		return !!this._assetMap[e];
	}
	hasBundle(e) {
		return !!this._bundles[e];
	}
	_getPreferredOrder(e) {
		for (let t = 0; t < e.length; t++) {
			let n = e[t], r = this._preferredOrder.find((e) => e.params.format.includes(n.format));
			if (r) return r;
		}
		return this._preferredOrder[0];
	}
	_appendDefaultSearchParams(e) {
		return this._defaultSearchParams ? `${e}${/\?/.test(e) ? "&" : "?"}${this._defaultSearchParams}` : e;
	}
	_buildResolvedAsset(e, t) {
		let { aliases: n, data: r, loadParser: i, parser: a, format: o, progressSize: s } = t;
		return (this._basePath || this._rootPath) && (e.src = Lr.toAbsolute(e.src, this._basePath, this._rootPath)), e.alias = n ?? e.alias ?? [e.src], e.src = this._appendDefaultSearchParams(e.src), e.data = Yr(Yr({}, r || {}), e.data), e.loadParser = i ?? e.loadParser, e.parser = a ?? e.parser, e.format = o ?? e.format ?? Qr(e.src), s !== void 0 && (e.progressSize = s), e;
	}
};
Zr.RETINA_PREFIX = /@([0-9\.]+)x/;
function Qr(e) {
	return e.split(".").pop().split("?").shift().split("#").shift();
}
var $r = (e, t) => {
	let n = t.split("?")[1];
	return n && (e += `?${n}`), e;
}, ei = class e {
	constructor(e, t) {
		this.linkedSheets = [];
		let n = e;
		e?.source instanceof It && (n = {
			texture: e,
			data: t
		});
		let { texture: r, data: i, cachePrefix: a = "" } = n;
		this.cachePrefix = a, this._texture = r instanceof J ? r : null, this.textureSource = r.source, this.textures = {}, this.animations = {}, this.data = i;
		let o = parseFloat(i.meta.scale);
		o ? (this.resolution = o, r.source.resolution = this.resolution) : this.resolution = r.source._resolution, this._frames = this.data.frames, this._frameKeys = Object.keys(this._frames), this._batchIndex = 0, this._callback = null;
	}
	parse() {
		return new Promise((t) => {
			this._callback = t, this._batchIndex = 0, this._frameKeys.length <= e.BATCH_SIZE ? (this._processFrames(0), this._processAnimations(), this._parseComplete()) : this._nextBatch();
		});
	}
	parseSync() {
		return this._processFrames(0, !0), this._processAnimations(), this.textures;
	}
	_processFrames(t, n = !1) {
		let r = t, i = n ? 1 / 0 : e.BATCH_SIZE;
		for (; r - t < i && r < this._frameKeys.length;) {
			let e = this._frameKeys[r], t = this._frames[e], n = t.frame;
			if (n) {
				let r = null, i = null, a = t.trimmed !== !1 && t.sourceSize ? t.sourceSize : t.frame, o = new qe(0, 0, Math.floor(a.w) / this.resolution, Math.floor(a.h) / this.resolution);
				r = t.rotated ? new qe(Math.floor(n.x) / this.resolution, Math.floor(n.y) / this.resolution, Math.floor(n.h) / this.resolution, Math.floor(n.w) / this.resolution) : new qe(Math.floor(n.x) / this.resolution, Math.floor(n.y) / this.resolution, Math.floor(n.w) / this.resolution, Math.floor(n.h) / this.resolution), t.trimmed !== !1 && t.spriteSourceSize && (i = new qe(Math.floor(t.spriteSourceSize.x) / this.resolution, Math.floor(t.spriteSourceSize.y) / this.resolution, Math.floor(n.w) / this.resolution, Math.floor(n.h) / this.resolution)), this.textures[e] = new J({
					source: this.textureSource,
					frame: r,
					orig: o,
					trim: i,
					rotate: t.rotated ? 2 : 0,
					defaultAnchor: t.anchor,
					defaultBorders: t.borders,
					label: e.toString()
				});
			}
			r++;
		}
	}
	_processAnimations() {
		let e = this.data.animations || {};
		for (let t in e) {
			this.animations[t] = [];
			for (let n = 0; n < e[t].length; n++) {
				let r = e[t][n];
				this.animations[t].push(this.textures[r]);
			}
		}
	}
	_parseComplete() {
		let e = this._callback;
		this._callback = null, this._batchIndex = 0, e.call(this, this.textures);
	}
	_nextBatch() {
		this._processFrames(this._batchIndex * e.BATCH_SIZE), this._batchIndex++, setTimeout(() => {
			this._batchIndex * e.BATCH_SIZE < this._frameKeys.length ? this._nextBatch() : (this._processAnimations(), this._parseComplete());
		}, 0);
	}
	destroy(e = !1) {
		var t;
		for (let e in this.textures) this.textures[e].destroy();
		this._frames = null, this._frameKeys = null, this.data = null, this.textures = null, e && ((t = this._texture) == null || t.destroy(), this.textureSource.destroy()), this._texture = null, this.textureSource = null, this.linkedSheets = [];
	}
};
ei.BATCH_SIZE = 1e3;
var ti = ei, ni = [
	"jpg",
	"png",
	"jpeg",
	"avif",
	"webp",
	"basis",
	"etc2",
	"bc7",
	"bc6h",
	"bc5",
	"bc4",
	"bc3",
	"bc2",
	"bc1",
	"eac",
	"astc"
];
function ri(e, t, n) {
	let r = {};
	if (e.forEach((e) => {
		r[e] = t;
	}), Object.keys(t.textures).forEach((e) => {
		r[`${t.cachePrefix}${e}`] = t.textures[e];
	}), !n) {
		let n = Lr.dirname(e[0]);
		t.linkedSheets.forEach((e, i) => {
			let a = ri([`${n}/${t.data.meta.related_multi_packs[i]}`], e, !0);
			Object.assign(r, a);
		});
	}
	return r;
}
var ii = {
	extension: h.Asset,
	cache: {
		test: (e) => e instanceof ti,
		getCacheableAssets: (e, t) => ri(e, t, !1)
	},
	resolver: {
		extension: {
			type: h.ResolveParser,
			name: "resolveSpritesheet"
		},
		test: (e) => {
			let t = e.split("?")[0].split("."), n = t.pop(), r = t.pop();
			return n === "json" && ni.includes(r);
		},
		parse: (e) => {
			let t = e.split(".");
			return {
				resolution: parseFloat(Zr.RETINA_PREFIX.exec(e)?.[1] ?? "1"),
				format: t[t.length - 2],
				src: e
			};
		}
	},
	loader: {
		name: "spritesheetLoader",
		id: "spritesheet",
		extension: {
			type: h.LoadParser,
			priority: Ar.Normal,
			name: "spritesheetLoader"
		},
		async testParse(e, t) {
			return Lr.extname(t.src).toLowerCase() === ".json" && !!e.frames;
		},
		async parse(e, t, n) {
			var r;
			let { texture: i, imageFilename: a, textureOptions: o, cachePrefix: s } = t?.data ?? {}, c = Lr.dirname(t.src);
			c && c.lastIndexOf("/") !== c.length - 1 && (c += "/");
			let l;
			if (i instanceof J) l = i;
			else {
				let r = $r(c + (a ?? e.meta.image), t.src);
				l = (await n.load([{
					src: r,
					data: o
				}]))[r];
			}
			let u = new ti({
				texture: l.source,
				data: e,
				cachePrefix: s
			});
			await u.parse();
			let d = e?.meta?.related_multi_packs;
			if (Array.isArray(d)) {
				let e = [];
				for (let i of d) {
					if (typeof i != "string") continue;
					let a = c + i;
					(r = t.data) != null && r.ignoreMultiPack || (a = $r(a, t.src), e.push(n.load({
						src: a,
						data: {
							textureOptions: o,
							ignoreMultiPack: !0
						}
					})));
				}
				let i = await Promise.all(e);
				u.linkedSheets = i, i.forEach((e) => {
					e.linkedSheets = [u].concat(u.linkedSheets.filter((t) => t !== e));
				});
			}
			return u;
		},
		async unload(e, t, n) {
			await n.unload(e.textureSource._sourceOrigin), e.destroy(!1);
		}
	}
};
v.add(ii);
function ai(e, t, n) {
	let { width: r, height: i } = n.orig, a = n.trim;
	if (a) {
		let n = a.width, o = a.height;
		e.minX = a.x - t._x * r, e.maxX = e.minX + n, e.minY = a.y - t._y * i, e.maxY = e.minY + o;
	} else e.minX = -t._x * r, e.maxX = e.minX + r, e.minY = -t._y * i, e.maxY = e.minY + i;
}
var oi = Object.defineProperty, si = Object.getOwnPropertySymbols, ci = Object.prototype.hasOwnProperty, li = Object.prototype.propertyIsEnumerable, ui = (e, t, n) => t in e ? oi(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, di = (e, t) => {
	for (var n in t ||= {}) ci.call(t, n) && ui(e, n, t[n]);
	if (si) for (var n of si(t)) li.call(t, n) && ui(e, n, t[n]);
	return e;
}, fi = (e, t) => {
	var n = {};
	for (var r in e) ci.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && si) for (var r of si(e)) t.indexOf(r) < 0 && li.call(e, r) && (n[r] = e[r]);
	return n;
}, pi = class e extends dr {
	constructor(e = J.EMPTY) {
		e instanceof J && (e = { texture: e });
		let t = e, { texture: n = J.EMPTY, anchor: r, roundPixels: i, width: a, height: o } = t, s = fi(t, [
			"texture",
			"anchor",
			"roundPixels",
			"width",
			"height"
		]);
		super(di({ label: "Sprite" }, s)), this.renderPipeId = "sprite", this.batched = !0, this._visualBounds = {
			minX: 0,
			maxX: 1,
			minY: 0,
			maxY: 0
		}, this._anchor = new V({ _onUpdate: () => {
			this.onViewUpdate();
		} }), r ? this.anchor = r : n.defaultAnchor && (this.anchor = n.defaultAnchor), this.texture = n, this.allowChildren = !1, this.roundPixels = i ?? !1, a !== void 0 && (this.width = a), o !== void 0 && (this.height = o);
	}
	static from(t, n = !1) {
		return t instanceof J ? new e(t) : new e(J.from(t, n));
	}
	set texture(e) {
		e ||= J.EMPTY;
		let t = this._texture;
		t !== e && (t && t.dynamic && t.off("update", this.onViewUpdate, this), e.dynamic && e.on("update", this.onViewUpdate, this), this._texture = e, this._width && this._setWidth(this._width, this._texture.orig.width), this._height && this._setHeight(this._height, this._texture.orig.height), this.onViewUpdate());
	}
	get texture() {
		return this._texture;
	}
	get visualBounds() {
		return ai(this._visualBounds, this._anchor, this._texture), this._visualBounds;
	}
	get sourceBounds() {
		return this.visualBounds;
	}
	updateBounds() {
		let e = this._anchor, t = this._texture, n = this._bounds, { width: r, height: i } = t.orig;
		n.minX = -e._x * r, n.maxX = n.minX + r, n.minY = -e._y * i, n.maxY = n.minY + i;
	}
	destroy(e = !1) {
		if (super.destroy(e), typeof e == "boolean" ? e : e?.texture) {
			let t = typeof e == "boolean" ? e : e?.textureSource;
			this._texture.destroy(t);
		}
		this._texture = null, this._visualBounds = null, this._bounds = null, this._anchor = null;
	}
	get anchor() {
		return this._anchor;
	}
	set anchor(e) {
		typeof e == "number" ? this._anchor.set(e) : this._anchor.copyFrom(e);
	}
	get width() {
		return Math.abs(this.scale.x) * this._texture.orig.width;
	}
	set width(e) {
		this._setWidth(e, this._texture.orig.width), this._width = e;
	}
	get height() {
		return Math.abs(this.scale.y) * this._texture.orig.height;
	}
	set height(e) {
		this._setHeight(e, this._texture.orig.height), this._height = e;
	}
	getSize(e) {
		return e ||= {}, e.width = Math.abs(this.scale.x) * this._texture.orig.width, e.height = Math.abs(this.scale.y) * this._texture.orig.height, e;
	}
	setSize(e, t) {
		typeof e == "object" ? (t = e.height ?? e.width, e = e.width) : t ??= e, e !== void 0 && this._setWidth(e, this._texture.orig.width), t !== void 0 && this._setHeight(t, this._texture.orig.height);
	}
}, mi = new G();
function hi(e, t, n) {
	let r = mi;
	e.measurable = !0, $e(e, n, r), t.addBoundsMask(r), e.measurable = !1;
}
function gi(e, t, n) {
	let r = Xe.get();
	e.measurable = !0;
	let i = Ye.get().identity();
	st(e, r, _i(e, n, i)), e.measurable = !1, t.addBoundsMask(r), Ye.return(i), Xe.return(r);
}
function _i(e, t, n) {
	return e && e !== t && (_i(e.parent, t, n), e.updateLocalTransform(), n.append(e.localTransform)), n;
}
var vi = class {
	constructor(e) {
		this.priority = 0, this.inverse = !1, this.channel = "red", this.pipe = "alphaMask", e != null && e.mask && this.init(e.mask);
	}
	init(e) {
		this.mask = e, this.renderMaskToTexture = !(e instanceof pi), this.mask.renderable = this.renderMaskToTexture, this.mask.includeInBuild = !this.renderMaskToTexture, this.mask.measurable = !1;
	}
	reset() {
		this.mask !== null && (this.mask.measurable = !0, this.mask = null);
	}
	addBounds(e, t) {
		this.inverse || hi(this.mask, e, t);
	}
	addLocalBounds(e, t) {
		gi(this.mask, e, t);
	}
	containsPoint(e, t) {
		let n = this.mask;
		return t(n, e);
	}
	destroy() {
		this.reset();
	}
	static test(e) {
		return e instanceof pi;
	}
};
vi.extension = h.MaskEffect;
var yi = class {
	constructor(e) {
		this.priority = 0, this.pipe = "colorMask", e != null && e.mask && this.init(e.mask);
	}
	init(e) {
		this.mask = e;
	}
	destroy() {}
	static test(e) {
		return typeof e == "number";
	}
};
yi.extension = h.MaskEffect;
var bi = class {
	constructor(e) {
		this.priority = 0, this.pipe = "stencilMask", e != null && e.mask && this.init(e.mask);
	}
	init(e) {
		this.mask = e, this.mask.includeInBuild = !1, this.mask.measurable = !1;
	}
	reset() {
		this.mask !== null && (this.mask.measurable = !0, this.mask.includeInBuild = !0, this.mask = null);
	}
	addBounds(e, t) {
		hi(this.mask, e, t);
	}
	addLocalBounds(e, t) {
		gi(this.mask, e, t);
	}
	containsPoint(e, t) {
		let n = this.mask;
		return t(n, e);
	}
	destroy() {
		this.reset();
	}
	static test(e) {
		return e instanceof Y;
	}
};
bi.extension = h.MaskEffect;
var xi = class extends It {
	constructor(e) {
		e.resource ||= X.get().createCanvas(), e.width || (e.width = e.resource.width, e.autoDensity || (e.width /= e.resolution)), e.height || (e.height = e.resource.height, e.autoDensity || (e.height /= e.resolution)), super(e), this.uploadMethodId = "image", this.autoDensity = e.autoDensity, this.resizeCanvas(), this.transparent = !!e.transparent;
	}
	resizeCanvas() {
		this.autoDensity && "style" in this.resource && (this.resource.style.width = `${this.width}px`, this.resource.style.height = `${this.height}px`), (this.resource.width !== this.pixelWidth || this.resource.height !== this.pixelHeight) && (this.resource.width = this.pixelWidth, this.resource.height = this.pixelHeight);
	}
	resize(e = this.width, t = this.height, n = this._resolution) {
		let r = super.resize(e, t, n);
		return r && this.resizeCanvas(), r;
	}
	static test(e) {
		return globalThis.HTMLCanvasElement && e instanceof HTMLCanvasElement || globalThis.OffscreenCanvas && e instanceof OffscreenCanvas;
	}
	get context2D() {
		return this._context2D ||= this.resource.getContext("2d");
	}
};
xi.extension = h.TextureSource;
var Si = class extends It {
	constructor(e) {
		super(e), this.uploadMethodId = "image", this.autoGarbageCollect = !0;
	}
	static test(e) {
		return globalThis.HTMLImageElement && e instanceof HTMLImageElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap || globalThis.VideoFrame && e instanceof VideoFrame;
	}
};
Si.extension = h.TextureSource;
var Ci;
async function wi() {
	return Ci ??= (async () => {
		var e;
		let t = X.get().createCanvas(1, 1).getContext("webgl");
		if (!t) return "premultiply-alpha-on-upload";
		let n = await new Promise((e) => {
			let t = document.createElement("video");
			t.onloadeddata = () => e(t), t.onerror = () => e(null), t.autoplay = !1, t.crossOrigin = "anonymous", t.preload = "auto", t.src = "data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAHTEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHGTbuMU6uEElTDZ1OsggEXTbuMU6uEHFO7a1OsggG97AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmoCrXsYMPQkBNgIRMYXZmV0GETGF2ZkSJiEBEAAAAAAAAFlSua8yuAQAAAAAAAEPXgQFzxYgAAAAAAAAAAZyBACK1nIN1bmSIgQCGhVZfVlA5g4EBI+ODhAJiWgDglLCBArqBApqBAlPAgQFVsIRVuYEBElTDZ9Vzc9JjwItjxYgAAAAAAAAAAWfInEWjh0VOQ09ERVJEh49MYXZjIGxpYnZweC12cDlnyKJFo4hEVVJBVElPTkSHlDAwOjAwOjAwLjA0MDAwMDAwMAAAH0O2dcfngQCgwqGggQAAAIJJg0IAABAAFgA4JBwYSgAAICAAEb///4r+AAB1oZ2mm+6BAaWWgkmDQgAAEAAWADgkHBhKAAAgIABIQBxTu2uRu4+zgQC3iveBAfGCAXHwgQM=", t.load();
		});
		if (!n) return "premultiply-alpha-on-upload";
		let r = t.createTexture();
		t.bindTexture(t.TEXTURE_2D, r);
		let i = t.createFramebuffer();
		t.bindFramebuffer(t.FRAMEBUFFER, i), t.framebufferTexture2D(t.FRAMEBUFFER, t.COLOR_ATTACHMENT0, t.TEXTURE_2D, r, 0), t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), t.pixelStorei(t.UNPACK_COLORSPACE_CONVERSION_WEBGL, t.NONE), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, t.RGBA, t.UNSIGNED_BYTE, n);
		let a = /* @__PURE__ */ new Uint8Array(4);
		return t.readPixels(0, 0, 1, 1, t.RGBA, t.UNSIGNED_BYTE, a), t.deleteFramebuffer(i), t.deleteTexture(r), (e = t.getExtension("WEBGL_lose_context")) == null || e.loseContext(), a[0] <= a[3] ? "premultiplied-alpha" : "premultiply-alpha-on-upload";
	})(), Ci;
}
var Ti = Object.defineProperty, Ei = Object.defineProperties, Di = Object.getOwnPropertyDescriptors, Oi = Object.getOwnPropertySymbols, ki = Object.prototype.hasOwnProperty, Ai = Object.prototype.propertyIsEnumerable, ji = (e, t, n) => t in e ? Ti(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Mi = (e, t) => {
	for (var n in t ||= {}) ki.call(t, n) && ji(e, n, t[n]);
	if (Oi) for (var n of Oi(t)) Ai.call(t, n) && ji(e, n, t[n]);
	return e;
}, Ni = (e, t) => Ei(e, Di(t)), Pi = class e extends It {
	constructor(t) {
		super(t), this.isReady = !1, this.uploadMethodId = "video", t = Mi(Mi({}, e.defaultOptions), t), this._autoUpdate = !0, this._isConnectedToTicker = !1, this._updateFPS = t.updateFPS || 0, this._msToNextUpdate = 0, this.autoPlay = t.autoPlay !== !1, this.alphaMode = t.alphaMode ?? "premultiply-alpha-on-upload", this._videoFrameRequestCallback = this._videoFrameRequestCallback.bind(this), this._videoFrameRequestCallbackHandle = null, this._load = null, this._resolve = null, this._reject = null, this._onCanPlay = this._onCanPlay.bind(this), this._onCanPlayThrough = this._onCanPlayThrough.bind(this), this._onError = this._onError.bind(this), this._onPlayStart = this._onPlayStart.bind(this), this._onPlayStop = this._onPlayStop.bind(this), this._onSeeked = this._onSeeked.bind(this), this._onLoadedMetadata = this._onLoadedMetadata.bind(this), t.autoLoad !== !1 && this.load();
	}
	updateFrame() {
		if (!this.destroyed) {
			if (this._updateFPS) {
				let e = Tn.shared.elapsedMS * this.resource.playbackRate;
				this._msToNextUpdate = Math.floor(this._msToNextUpdate - e);
			}
			(!this._updateFPS || this._msToNextUpdate <= 0) && (this._msToNextUpdate = this._updateFPS ? Math.floor(1e3 / this._updateFPS) : 0), this.isValid && this.update();
		}
	}
	_videoFrameRequestCallback() {
		this.updateFrame(), this._videoFrameRequestCallbackHandle = this.destroyed ? null : this.resource.requestVideoFrameCallback(this._videoFrameRequestCallback);
	}
	get isValid() {
		return !!this.resource.videoWidth && !!this.resource.videoHeight;
	}
	async load() {
		if (this._load) return this._load;
		let e = this.resource, t = this.options;
		return (e.readyState === e.HAVE_ENOUGH_DATA || e.readyState === e.HAVE_FUTURE_DATA) && e.width && e.height && (e.complete = !0), e.addEventListener("play", this._onPlayStart), e.addEventListener("pause", this._onPlayStop), e.addEventListener("seeked", this._onSeeked), this._isSourceReady() ? this._mediaReady() : (t.preload || e.addEventListener("canplay", this._onCanPlay), e.addEventListener("canplaythrough", this._onCanPlayThrough), e.addEventListener("error", this._onError, !0)), this.isValid || e.addEventListener("loadedmetadata", this._onLoadedMetadata), this.alphaMode = await wi(), this._load = new Promise((n, r) => {
			this.isValid ? n(this) : (this._resolve = n, this._reject = r, t.preloadTimeoutMs !== void 0 && (this._preloadTimeout = setTimeout(() => {
				this._onError(new ErrorEvent(`Preload exceeded timeout of ${t.preloadTimeoutMs}ms`));
			})), e.load());
		}), this._load;
	}
	_onError(e) {
		this.resource.removeEventListener("error", this._onError, !0), this.emit("error", e), this._reject && (this._reject(e), this._reject = null, this._resolve = null);
	}
	_isSourcePlaying() {
		let e = this.resource;
		return !e.paused && !e.ended;
	}
	_isSourceReady() {
		return this.resource.readyState > 2;
	}
	_onPlayStart() {
		this._configureAutoUpdate();
	}
	_onPlayStop() {
		this._configureAutoUpdate();
	}
	_onSeeked() {
		this._autoUpdate && !this._isSourcePlaying() && (this._msToNextUpdate = 0, this.updateFrame(), this._msToNextUpdate = 0);
	}
	_onLoadedMetadata() {
		this.isValid && this._mediaReady();
	}
	_onCanPlay() {
		this.resource.removeEventListener("canplay", this._onCanPlay), this._mediaReady();
	}
	_onCanPlayThrough() {
		this.resource.removeEventListener("canplaythrough", this._onCanPlayThrough), this._preloadTimeout &&= (clearTimeout(this._preloadTimeout), void 0), this._mediaReady();
	}
	_mediaReady() {
		let e = this.resource;
		this.isValid && (this.isReady = !0, this.resize(e.videoWidth, e.videoHeight)), this._msToNextUpdate = 0, this.updateFrame(), this._msToNextUpdate = 0, this._resolve && this.isValid && (this._resolve(this), this._resolve = null, this._reject = null), this._isSourcePlaying() ? this._onPlayStart() : this.autoPlay && this.resource.play();
	}
	destroy() {
		this._configureAutoUpdate();
		let e = this.resource;
		e && (e.removeEventListener("play", this._onPlayStart), e.removeEventListener("pause", this._onPlayStop), e.removeEventListener("seeked", this._onSeeked), e.removeEventListener("canplay", this._onCanPlay), e.removeEventListener("canplaythrough", this._onCanPlayThrough), e.removeEventListener("loadedmetadata", this._onLoadedMetadata), e.removeEventListener("error", this._onError, !0), e.pause(), e.src = "", e.load()), super.destroy();
	}
	get autoUpdate() {
		return this._autoUpdate;
	}
	set autoUpdate(e) {
		e !== this._autoUpdate && (this._autoUpdate = e, this._configureAutoUpdate());
	}
	get updateFPS() {
		return this._updateFPS;
	}
	set updateFPS(e) {
		e !== this._updateFPS && (this._updateFPS = e, this._configureAutoUpdate());
	}
	_configureAutoUpdate() {
		this._autoUpdate && this._isSourcePlaying() ? !this._updateFPS && this.resource.requestVideoFrameCallback ? (this._isConnectedToTicker && (Tn.shared.remove(this.updateFrame, this), this._isConnectedToTicker = !1, this._msToNextUpdate = 0), this._videoFrameRequestCallbackHandle === null && (this._videoFrameRequestCallbackHandle = this.resource.requestVideoFrameCallback(this._videoFrameRequestCallback))) : (this._videoFrameRequestCallbackHandle !== null && (this.resource.cancelVideoFrameCallback(this._videoFrameRequestCallbackHandle), this._videoFrameRequestCallbackHandle = null), this._isConnectedToTicker || (Tn.shared.add(this.updateFrame, this), this._isConnectedToTicker = !0, this._msToNextUpdate = 0)) : (this._videoFrameRequestCallbackHandle !== null && (this.resource.cancelVideoFrameCallback(this._videoFrameRequestCallbackHandle), this._videoFrameRequestCallbackHandle = null), this._isConnectedToTicker && (Tn.shared.remove(this.updateFrame, this), this._isConnectedToTicker = !1, this._msToNextUpdate = 0));
	}
	static test(e) {
		return globalThis.HTMLVideoElement && e instanceof HTMLVideoElement;
	}
};
Pi.extension = h.TextureSource, Pi.defaultOptions = Ni(Mi({}, It.defaultOptions), {
	autoLoad: !0,
	autoPlay: !0,
	updateFPS: 0,
	crossorigin: !0,
	loop: !1,
	muted: !0,
	playsinline: !0,
	preload: !1
}), Pi.MIME_TYPES = {
	ogv: "video/ogg",
	mov: "video/quicktime",
	m4v: "video/mp4"
};
var Fi = Pi, Ii = new class {
	constructor() {
		this._parsers = [], this._cache = /* @__PURE__ */ new Map(), this._cacheMap = /* @__PURE__ */ new Map();
	}
	reset() {
		this._cacheMap.clear(), this._cache.clear();
	}
	has(e) {
		return this._cache.has(e);
	}
	get(e) {
		return this._cache.get(e);
	}
	set(e, t) {
		let n = Rr(e), r;
		for (let e = 0; e < this.parsers.length; e++) {
			let i = this.parsers[e];
			if (i.test(t)) {
				r = i.getCacheableAssets(n, t);
				break;
			}
		}
		let i = new Map(Object.entries(r || {}));
		r || n.forEach((e) => {
			i.set(e, t);
		});
		let a = [...i.keys()], o = {
			cacheKeys: a,
			keys: n
		};
		n.forEach((e) => {
			this._cacheMap.set(e, o);
		}), a.forEach((e) => {
			r && r[e], this._cache.has(e) && this._cache.get(e), this._cache.set(e, i.get(e));
		});
	}
	remove(e) {
		if (!this._cacheMap.has(e)) return;
		let t = this._cacheMap.get(e);
		t.cacheKeys.forEach((e) => {
			this._cache.delete(e);
		}), t.keys.forEach((e) => {
			this._cacheMap.delete(e);
		});
	}
	get parsers() {
		return this._parsers;
	}
}(), Li = [];
v.handleByList(h.TextureSource, Li);
function Ri(e = {}) {
	let t = e && e.resource, n = t ? e.resource : e, r = t ? e : { resource: e };
	for (let e = 0; e < Li.length; e++) {
		let t = Li[e];
		if (t.test(n)) return new t(r);
	}
	throw Error(`Could not find a source type for resource: ${r.resource}`);
}
function zi(e = {}, t = !1) {
	let n = e && e.resource, r = n ? e.resource : e, i = n ? e : { resource: e };
	if (!t && Ii.has(r)) return Ii.get(r);
	let a = new J({ source: Ri(i) });
	return a.on("destroy", () => {
		Ii.has(r) && Ii.remove(r);
	}), t || Ii.set(r, a), a;
}
function Bi(e, t = !1) {
	return typeof e == "string" ? Ii.get(e) : e instanceof It ? new J({ source: e }) : zi(e, t);
}
J.from = Bi, It.from = Ri, v.add(vi, yi, bi, Fi, Si, xi, tn);
var Vi;
function Hi(e) {
	let t = X.get().createCanvas(6, 1), n = t.getContext("2d");
	return n.fillStyle = e, n.fillRect(0, 0, 6, 1), t;
}
function Ui() {
	if (Vi !== void 0) return Vi;
	try {
		let e = Hi("#ff00ff"), t = Hi("#ffff00"), n = X.get().createCanvas(6, 1).getContext("2d");
		n.globalCompositeOperation = "multiply", n.drawImage(e, 0, 0), n.drawImage(t, 2, 0);
		let r = n.getImageData(2, 0, 1, 1);
		if (!r) Vi = !1;
		else {
			let e = r.data;
			Vi = e[0] === 255 && e[1] === 0 && e[2] === 0;
		}
	} catch {
		Vi = !1;
	}
	return Vi;
}
var Z = {
	canvas: null,
	convertTintToImage: !1,
	cacheStepsPerColorChannel: 8,
	canUseMultiply: Ui(),
	tintMethod: null,
	_canvasSourceCache: /* @__PURE__ */ new WeakMap(),
	_unpremultipliedCache: /* @__PURE__ */ new WeakMap(),
	getCanvasSource: (e) => {
		let t = e.source, n = t?.resource;
		if (!n) return null;
		let r = t.alphaMode === "premultiplied-alpha", i = t.resourceWidth ?? t.pixelWidth, a = t.resourceHeight ?? t.pixelHeight, o = i !== t.pixelWidth || a !== t.pixelHeight;
		if (r) {
			if ((n instanceof HTMLCanvasElement || typeof OffscreenCanvas < "u" && n instanceof OffscreenCanvas) && !o) return n;
			let e = Z._unpremultipliedCache.get(t);
			if (e?.resourceId === t._resourceId) return e.canvas;
		}
		if (n instanceof Uint8Array || n instanceof Uint8ClampedArray || n instanceof Int8Array || n instanceof Uint16Array || n instanceof Int16Array || n instanceof Uint32Array || n instanceof Int32Array || n instanceof Float32Array || n instanceof ArrayBuffer) {
			let e = Z._canvasSourceCache.get(t);
			if (e?.resourceId === t._resourceId) return e.canvas;
			let r = X.get().createCanvas(t.pixelWidth, t.pixelHeight), i = r.getContext("2d"), a = i.createImageData(t.pixelWidth, t.pixelHeight), o = a.data, s = n instanceof ArrayBuffer ? new Uint8Array(n) : new Uint8Array(n.buffer, n.byteOffset, n.byteLength);
			if (t.format === "bgra8unorm") for (let e = 0; e < o.length && e + 3 < s.length; e += 4) o[e] = s[e + 2], o[e + 1] = s[e + 1], o[e + 2] = s[e], o[e + 3] = s[e + 3];
			else o.set(s.subarray(0, o.length));
			return i.putImageData(a, 0, 0), Z._canvasSourceCache.set(t, {
				canvas: r,
				resourceId: t._resourceId
			}), r;
		}
		if (r) {
			let e = X.get().createCanvas(t.pixelWidth, t.pixelHeight), r = e.getContext("2d", { willReadFrequently: !0 });
			e.width = t.pixelWidth, e.height = t.pixelHeight, r.drawImage(n, 0, 0);
			let i = r.getImageData(0, 0, e.width, e.height), a = i.data;
			for (let e = 0; e < a.length; e += 4) {
				let t = a[e + 3];
				if (t > 0) {
					let n = 255 / t;
					a[e] = Math.min(255, a[e] * n + .5), a[e + 1] = Math.min(255, a[e + 1] * n + .5), a[e + 2] = Math.min(255, a[e + 2] * n + .5);
				}
			}
			return r.putImageData(i, 0, 0), Z._unpremultipliedCache.set(t, {
				canvas: e,
				resourceId: t._resourceId
			}), e;
		}
		if (o) {
			let e = Z._canvasSourceCache.get(t);
			if (e?.resourceId === t._resourceId) return e.canvas;
			let r = X.get().createCanvas(t.pixelWidth, t.pixelHeight), i = r.getContext("2d");
			return r.width = t.pixelWidth, r.height = t.pixelHeight, i.drawImage(n, 0, 0), Z._canvasSourceCache.set(t, {
				canvas: r,
				resourceId: t._resourceId
			}), r;
		}
		return n;
	},
	getTintedCanvas: (e, t) => {
		let n = e.texture, r = z.shared.setValue(t).toHex(), i = n.tintCache ||= {}, a = i[r], o = n.source._resourceId;
		if (a?.tintId === o) return a;
		let s = a && "getContext" in a ? a : X.get().createCanvas();
		if (Z.tintMethod(n, t, s), s.tintId = o, Z.convertTintToImage && s.toDataURL !== void 0) {
			let e = X.get().createImage();
			e.src = s.toDataURL(), e.tintId = o, i[r] = e;
		} else i[r] = s;
		return i[r];
	},
	getTintedPattern: (e, t) => {
		let n = z.shared.setValue(t).toHex(), r = e.patternCache ||= {}, i = e.source._resourceId, a = r[n];
		return a?.tintId === i || (Z.canvas ||= X.get().createCanvas(), Z.tintMethod(e, t, Z.canvas), a = Z.canvas.getContext("2d").createPattern(Z.canvas, "repeat"), a.tintId = i, r[n] = a), a;
	},
	applyPatternTransform: (e, t, n = !0) => {
		if (!t) return;
		let r = e;
		if (!r.setTransform) return;
		let i = globalThis.DOMMatrix;
		if (!i) return;
		let a = new i([
			t.a,
			t.b,
			t.c,
			t.d,
			t.tx,
			t.ty
		]);
		r.setTransform(n ? a.inverse() : a);
	},
	tintWithMultiply: (e, t, n) => {
		let r = n.getContext("2d"), i = e.frame.clone(), a = e.source._resolution ?? e.source.resolution ?? 1, o = e.rotate;
		i.x *= a, i.y *= a, i.width *= a, i.height *= a;
		let s = q.isVertical(o), c = s ? i.height : i.width, l = s ? i.width : i.height;
		n.width = Math.ceil(c), n.height = Math.ceil(l), r.save(), r.fillStyle = z.shared.setValue(t).toHex(), r.fillRect(0, 0, c, l), r.globalCompositeOperation = "multiply";
		let u = Z.getCanvasSource(e);
		if (!u) {
			r.restore();
			return;
		}
		o && Z._applyInverseRotation(r, o, i.width, i.height), r.drawImage(u, i.x, i.y, i.width, i.height, 0, 0, i.width, i.height), r.globalCompositeOperation = "destination-atop", r.drawImage(u, i.x, i.y, i.width, i.height, 0, 0, i.width, i.height), r.restore();
	},
	tintWithOverlay: (e, t, n) => {
		let r = n.getContext("2d"), i = e.frame.clone(), a = e.source._resolution ?? e.source.resolution ?? 1, o = e.rotate;
		i.x *= a, i.y *= a, i.width *= a, i.height *= a;
		let s = q.isVertical(o), c = s ? i.height : i.width, l = s ? i.width : i.height;
		n.width = Math.ceil(c), n.height = Math.ceil(l), r.save(), r.globalCompositeOperation = "copy", r.fillStyle = z.shared.setValue(t).toHex(), r.fillRect(0, 0, c, l), r.globalCompositeOperation = "destination-atop";
		let u = Z.getCanvasSource(e);
		if (!u) {
			r.restore();
			return;
		}
		o && Z._applyInverseRotation(r, o, i.width, i.height), r.drawImage(u, i.x, i.y, i.width, i.height, 0, 0, i.width, i.height), r.restore();
	},
	tintWithPerPixel: (e, t, n) => {
		let r = n.getContext("2d"), i = e.frame.clone(), a = e.source._resolution ?? e.source.resolution ?? 1, o = e.rotate;
		i.x *= a, i.y *= a, i.width *= a, i.height *= a;
		let s = q.isVertical(o), c = s ? i.height : i.width, l = s ? i.width : i.height;
		n.width = Math.ceil(c), n.height = Math.ceil(l), r.save(), r.globalCompositeOperation = "copy";
		let u = Z.getCanvasSource(e);
		if (!u) {
			r.restore();
			return;
		}
		o && Z._applyInverseRotation(r, o, i.width, i.height), r.drawImage(u, i.x, i.y, i.width, i.height, 0, 0, i.width, i.height), r.restore();
		let d = t >> 16 & 255, f = t >> 8 & 255, p = t & 255, m = r.getImageData(0, 0, c, l), h = m.data;
		for (let e = 0; e < h.length; e += 4) h[e] = h[e] * d / 255, h[e + 1] = h[e + 1] * f / 255, h[e + 2] = h[e + 2] * p / 255;
		r.putImageData(m, 0, 0);
	},
	_applyInverseRotation: (e, t, n, r) => {
		let i = q.inv(t), a = q.uX(i), o = q.uY(i), s = q.vX(i), c = q.vY(i), l = -Math.min(0, a * n, s * r, a * n + s * r), u = -Math.min(0, o * n, c * r, o * n + c * r);
		e.transform(a, o, s, c, l, u);
	}
};
Z.tintMethod = Z.canUseMultiply ? Z.tintWithMultiply : Z.tintWithPerPixel;
var Wi = new class {
	constructor(e) {
		this._canvasPool = Object.create(null), this.canvasOptions = e || {}, this.enableFullScreen = !1;
	}
	_createCanvasAndContext(e, t) {
		let n = X.get().createCanvas();
		return n.width = e, n.height = t, {
			canvas: n,
			context: n.getContext("2d")
		};
	}
	getOptimalCanvasAndContext(e, t, n = 1) {
		e = Math.ceil(e * n - 1e-6), t = Math.ceil(t * n - 1e-6), e = gt(e), t = gt(t);
		let r = (e << 17) + (t << 1);
		this._canvasPool[r] || (this._canvasPool[r] = []);
		let i = this._canvasPool[r].pop();
		return i ||= this._createCanvasAndContext(e, t), i;
	}
	returnCanvasAndContext(e) {
		let { width: t, height: n } = e.canvas, r = (t << 17) + (n << 1);
		e.context.resetTransform(), e.context.clearRect(0, 0, t, n), this._canvasPool[r].push(e);
	}
	clear() {
		this._canvasPool = {};
	}
}();
je.register(Wi);
function Gi(e, t, n, r, i, a) {
	let o = e - n, s = t - r, c = i - n, l = a - r, u = o * c + s * l, d = c * c + l * l, f = -1;
	d !== 0 && (f = u / d);
	let p, m;
	f < 0 ? (p = n, m = r) : f > 1 ? (p = i, m = a) : (p = n + f * c, m = r + f * l);
	let h = e - p, g = t - m;
	return h * h + g * g;
}
function Ki(e, t, n, r, i, a, o, s) {
	let c = o - n, l = s - r, u = i - n, d = a - r, f = e - n, p = t - r, m = c * c + l * l, h = c * u + l * d, g = c * f + l * p, _ = u * u + d * d, v = u * f + d * p, y = 1 / (m * _ - h * h), b = (_ * g - h * v) * y, x = (m * v - h * g) * y;
	return b >= 0 && x >= 0 && b + x < 1;
}
var qi = class e {
	constructor(e = 0, t = 0, n = 0) {
		this.type = "circle", this.x = e, this.y = t, this.radius = n;
	}
	clone() {
		return new e(this.x, this.y, this.radius);
	}
	contains(e, t) {
		if (this.radius <= 0) return !1;
		let n = this.radius * this.radius, r = this.x - e, i = this.y - t;
		return r *= r, i *= i, r + i <= n;
	}
	strokeContains(e, t, n, r = .5) {
		if (this.radius === 0) return !1;
		let i = this.x - e, a = this.y - t, o = this.radius, s = (1 - r) * n, c = Math.sqrt(i * i + a * a);
		return c <= o + s && c > o - (n - s);
	}
	getBounds(e) {
		return e ||= new qe(), e.x = this.x - this.radius, e.y = this.y - this.radius, e.width = this.radius * 2, e.height = this.radius * 2, e;
	}
	copyFrom(e) {
		return this.x = e.x, this.y = e.y, this.radius = e.radius, this;
	}
	copyTo(e) {
		return e.copyFrom(this), e;
	}
}, Ji = class e {
	constructor(e = 0, t = 0, n = 0, r = 0) {
		this.type = "ellipse", this.x = e, this.y = t, this.halfWidth = n, this.halfHeight = r;
	}
	clone() {
		return new e(this.x, this.y, this.halfWidth, this.halfHeight);
	}
	contains(e, t) {
		if (this.halfWidth <= 0 || this.halfHeight <= 0) return !1;
		let n = (e - this.x) / this.halfWidth, r = (t - this.y) / this.halfHeight;
		return n *= n, r *= r, n + r <= 1;
	}
	strokeContains(e, t, n, r = .5) {
		let { halfWidth: i, halfHeight: a } = this;
		if (i <= 0 || a <= 0) return !1;
		let o = n * (1 - r), s = n - o, c = i - s, l = a - s, u = i + o, d = a + o, f = e - this.x, p = t - this.y, m = f * f / (c * c) + p * p / (l * l), h = f * f / (u * u) + p * p / (d * d);
		return m > 1 && h <= 1;
	}
	getBounds(e) {
		return e ||= new qe(), e.x = this.x - this.halfWidth, e.y = this.y - this.halfHeight, e.width = this.halfWidth * 2, e.height = this.halfHeight * 2, e;
	}
	copyFrom(e) {
		return this.x = e.x, this.y = e.y, this.halfWidth = e.halfWidth, this.halfHeight = e.halfHeight, this;
	}
	copyTo(e) {
		return e.copyFrom(this), e;
	}
}, Yi, Xi, Zi = class e {
	constructor(...e) {
		this.type = "polygon";
		let t = Array.isArray(e[0]) ? e[0] : e;
		if (typeof t[0] != "number") {
			let e = [];
			for (let n = 0, r = t.length; n < r; n++) e.push(t[n].x, t[n].y);
			t = e;
		}
		this.points = t, this.closePath = !0;
	}
	isClockwise() {
		let e = 0, t = this.points, n = t.length;
		for (let r = 0; r < n; r += 2) {
			let i = t[r], a = t[r + 1], o = t[(r + 2) % n], s = t[(r + 3) % n];
			e += (o - i) * (s + a);
		}
		return e < 0;
	}
	containsPolygon(e) {
		let t = this.getBounds(Yi), n = e.getBounds(Xi);
		if (!t.containsRect(n)) return !1;
		let r = e.points;
		for (let e = 0; e < r.length; e += 2) {
			let t = r[e], n = r[e + 1];
			if (!this.contains(t, n)) return !1;
		}
		return !0;
	}
	clone() {
		let t = this.points.slice(), n = new e(t);
		return n.closePath = this.closePath, n;
	}
	contains(e, t) {
		let n = !1, r = this.points.length / 2;
		for (let i = 0, a = r - 1; i < r; a = i++) {
			let r = this.points[i * 2], o = this.points[i * 2 + 1], s = this.points[a * 2], c = this.points[a * 2 + 1];
			o > t != c > t && e < (s - r) * ((t - o) / (c - o)) + r && (n = !n);
		}
		return n;
	}
	strokeContains(e, t, n, r = .5) {
		let i = n * n, a = i * (1 - r), o = i - a, { points: s } = this, c = s.length - (this.closePath ? 0 : 2);
		for (let n = 0; n < c; n += 2) {
			let r = s[n], i = s[n + 1], c = s[(n + 2) % s.length], l = s[(n + 3) % s.length];
			if (Gi(e, t, r, i, c, l) <= (Math.sign((c - r) * (t - i) - (l - i) * (e - r)) < 0 ? o : a)) return !0;
		}
		return !1;
	}
	getBounds(e) {
		e ||= new qe();
		let t = this.points, n = 1 / 0, r = -1 / 0, i = 1 / 0, a = -1 / 0;
		for (let e = 0, o = t.length; e < o; e += 2) {
			let o = t[e], s = t[e + 1];
			n = o < n ? o : n, r = o > r ? o : r, i = s < i ? s : i, a = s > a ? s : a;
		}
		return e.x = n, e.width = r - n, e.y = i, e.height = a - i, e;
	}
	copyFrom(e) {
		return this.points = e.points.slice(), this.closePath = e.closePath, this;
	}
	copyTo(e) {
		return e.copyFrom(this), e;
	}
	get lastX() {
		return this.points[this.points.length - 2];
	}
	get lastY() {
		return this.points[this.points.length - 1];
	}
	get x() {
		return this.points[this.points.length - 2];
	}
	get y() {
		return this.points[this.points.length - 1];
	}
	get startX() {
		return this.points[0];
	}
	get startY() {
		return this.points[1];
	}
}, Qi = (e, t, n, r, i, a, o) => {
	let s = e - n, c = t - r, l = Math.sqrt(s * s + c * c);
	return l >= i - a && l <= i + o;
}, $i = class e {
	constructor(e = 0, t = 0, n = 0, r = 0, i = 20) {
		this.type = "roundedRectangle", this.x = e, this.y = t, this.width = n, this.height = r, this.radius = i;
	}
	getBounds(e) {
		return e ||= new qe(), e.x = this.x, e.y = this.y, e.width = this.width, e.height = this.height, e;
	}
	clone() {
		return new e(this.x, this.y, this.width, this.height, this.radius);
	}
	copyFrom(e) {
		return this.x = e.x, this.y = e.y, this.width = e.width, this.height = e.height, this;
	}
	copyTo(e) {
		return e.copyFrom(this), e;
	}
	contains(e, t) {
		if (this.width <= 0 || this.height <= 0) return !1;
		if (e >= this.x && e <= this.x + this.width && t >= this.y && t <= this.y + this.height) {
			let n = Math.max(0, Math.min(this.radius, Math.min(this.width, this.height) / 2));
			if (t >= this.y + n && t <= this.y + this.height - n || e >= this.x + n && e <= this.x + this.width - n) return !0;
			let r = e - (this.x + n), i = t - (this.y + n), a = n * n;
			if (r * r + i * i <= a || (r = e - (this.x + this.width - n), r * r + i * i <= a) || (i = t - (this.y + this.height - n), r * r + i * i <= a) || (r = e - (this.x + n), r * r + i * i <= a)) return !0;
		}
		return !1;
	}
	strokeContains(e, t, n, r = .5) {
		let { x: i, y: a, width: o, height: s, radius: c } = this, l = n * (1 - r), u = n - l, d = i + c, f = a + c, p = o - c * 2, m = s - c * 2, h = i + o, g = a + s;
		return (e >= i - l && e <= i + u || e >= h - u && e <= h + l) && t >= f && t <= f + m || (t >= a - l && t <= a + u || t >= g - u && t <= g + l) && e >= d && e <= d + p || e < d && t < f && Qi(e, t, d, f, c, u, l) || e > h - c && t < f && Qi(e, t, h - c, f, c, u, l) || e > h - c && t > g - c && Qi(e, t, h - c, g - c, c, u, l) || e < d && t > g - c && Qi(e, t, d, g - c, c, u, l);
	}
}, ea = new B();
function ta(e, t) {
	t.clear();
	let n = t.matrix;
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		if (r.globalDisplayStatus < 7) continue;
		let i = r.renderGroup ?? r.parentRenderGroup;
		t.matrix = i != null && i.isCachedAsTexture ? ea.copyFrom(i.textureOffsetInverseTransform).append(r.worldTransform) : i != null && i._parentCacheAsTextureRenderGroup ? ea.copyFrom(i._parentCacheAsTextureRenderGroup.inverseWorldTransform).append(r.groupTransform) : r.worldTransform, t.addBounds(r.bounds);
	}
	return t.matrix = n, t;
}
var na = new G();
function ra(e, t, n, r, i = !1) {
	let a = na;
	a.minX = 0, a.minY = 0, a.maxX = e.width / r | 0, a.maxY = e.height / r | 0;
	let o = hn.getOptimalTexture(a.width, a.height, r, !1, i);
	return o.source.uploadMethodId = "image", o.source.resource = e, o.source.alphaMode = "premultiply-alpha-on-upload", o.frame.width = t / r, o.frame.height = n / r, o.source.emit("update", o.source), o.updateUvs(), o;
}
function ia(e) {
	return typeof e.getCanvasFilterString == "function";
}
var aa = class {
	constructor() {
		this.skip = !1, this.useClip = !1, this.filters = null, this.container = null, this.bounds = new G(), this.cssFilterString = "";
	}
}, oa = class {
	constructor(e) {
		this._filterStack = [], this._filterStackIndex = 0, this._savedStates = [], this._alphaMultiplier = 1, this._warnedFilterTypes = /* @__PURE__ */ new Set(), this.renderer = e;
	}
	push(e) {
		let t = this._pushFilterFrame(), n = e.filterEffect.filters;
		if (t.skip = !1, t.useClip = !1, t.filters = n, t.container = e.container, t.cssFilterString = "", n.every((e) => !e.enabled)) {
			t.skip = !0;
			return;
		}
		let r = [];
		for (let e of n) {
			if (!e.enabled) continue;
			if (!ia(e)) {
				this._warnUnsupportedFilter(e);
				continue;
			}
			let t = e.getCanvasFilterString();
			if (t === null) {
				this._warnUnsupportedFilter(e);
				continue;
			}
			t && r.push(t);
		}
		if (r.length === 0) {
			t.skip = !0;
			return;
		}
		t.cssFilterString = r.join(" "), this._calculateFilterArea(e, t.bounds), t.useClip = !!e.filterEffect.filterArea;
		let i = this.renderer.canvasContext.activeContext, a = i.filter || "none";
		if (this._savedStates.push({
			filter: a,
			alphaMultiplier: this._alphaMultiplier
		}), t.useClip && Number.isFinite(t.bounds.width) && Number.isFinite(t.bounds.height) && t.bounds.width > 0 && t.bounds.height > 0) {
			let e = this.renderer.canvasContext.activeResolution || 1;
			i.save(), i.setTransform(1, 0, 0, 1, 0, 0), i.beginPath(), i.rect(t.bounds.x * e, t.bounds.y * e, t.bounds.width * e, t.bounds.height * e), i.clip();
		} else t.useClip = !1;
		t.cssFilterString && (i.filter = a === "none" ? t.cssFilterString : `${a} ${t.cssFilterString}`);
	}
	pop() {
		let e = this._popFilterFrame();
		if (e.skip) return;
		let t = this._savedStates.pop();
		if (!t) return;
		let n = this.renderer.canvasContext.activeContext;
		e.useClip ? n.restore() : n.filter = t.filter, this._alphaMultiplier = t.alphaMultiplier;
	}
	generateFilteredTexture({ texture: e, filters: t }) {
		if (!(t != null && t.length) || t.every((e) => !e.enabled)) return e;
		let n = [];
		for (let e of t) {
			if (!e.enabled) continue;
			if (!ia(e)) {
				this._warnUnsupportedFilter(e);
				continue;
			}
			let t = e.getCanvasFilterString();
			if (t === null) {
				this._warnUnsupportedFilter(e);
				continue;
			}
			t && n.push(t);
		}
		if (n.length === 0) return e;
		let r = Z.getCanvasSource(e);
		if (!r) return e;
		let i = e.frame, a = e.source._resolution ?? e.source.resolution ?? 1, o = i.width, s = i.height, { canvas: c, context: l } = Wi.getOptimalCanvasAndContext(o, s, a);
		l.setTransform(1, 0, 0, 1, 0, 0), l.clearRect(0, 0, c.width, c.height), n.length && (l.filter = n.join(" "));
		let u = i.x * a, d = i.y * a, f = o * a, p = s * a;
		return l.drawImage(r, u, d, f, p, 0, 0, f, p), l.filter = "none", l.globalAlpha = 1, ra(c, o, s, a);
	}
	_calculateFilterArea(e, t) {
		if (e.renderables ? ta(e.renderables, t) : e.filterEffect.filterArea ? (t.clear(), t.addRect(e.filterEffect.filterArea), t.applyMatrix(e.container.worldTransform)) : e.container.getFastGlobalBounds(!0, t), e.container) {
			let n = (e.container.renderGroup || e.container.parentRenderGroup)?.cacheToLocalTransform;
			n && t.applyMatrix(n);
		}
	}
	_warnUnsupportedFilter(e) {
		let t = e?.constructor?.name || "Filter";
		this._warnedFilterTypes.has(t) || (this._warnedFilterTypes.add(t), console.warn(`CanvasRenderer: filter "${t}" is not supported in Canvas2D and will be skipped.`));
	}
	get alphaMultiplier() {
		return this._alphaMultiplier;
	}
	_pushFilterFrame() {
		let e = this._filterStack[this._filterStackIndex];
		return e ||= this._filterStack[this._filterStackIndex] = new aa(), this._filterStackIndex++, e;
	}
	_popFilterFrame() {
		return this._filterStackIndex <= 0 ? this._filterStack[0] : (this._filterStackIndex--, this._filterStack[this._filterStackIndex]);
	}
	destroy() {
		this._filterStack = null, this._savedStates = null, this._warnedFilterTypes = null, this._alphaMultiplier = 1;
	}
};
oa.extension = {
	type: [h.CanvasSystem],
	name: "filter"
};
var sa = class {
	constructor(e) {
		this._renderer = e;
	}
	push(e, t, n) {
		this._renderer.renderPipes.batch.break(n), n.add({
			renderPipeId: "filter",
			canBundle: !1,
			action: "pushFilter",
			container: t,
			filterEffect: e
		});
	}
	pop(e, t, n) {
		this._renderer.renderPipes.batch.break(n), n.add({
			renderPipeId: "filter",
			action: "popFilter",
			canBundle: !1
		});
	}
	execute(e) {
		e.action === "pushFilter" ? this._renderer.filter.push(e) : e.action === "popFilter" && this._renderer.filter.pop();
	}
	destroy() {
		this._renderer = null;
	}
};
sa.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "filter"
};
var ca = Object.create(null), la = Object.create(null);
function ua(e, t) {
	let n = la[e];
	return n === void 0 && (ca[t] === void 0 && (ca[t] = 1), la[e] = n = ca[t]++), n;
}
var da;
function fa() {
	return (!da || da != null && da.isContextLost()) && (da = X.get().createCanvas().getContext("webgl", {})), da;
}
var pa;
function ma() {
	if (!pa) {
		pa = "mediump";
		let e = fa();
		e && e.getShaderPrecisionFormat && (pa = e.getShaderPrecisionFormat(e.FRAGMENT_SHADER, e.HIGH_FLOAT).precision ? "highp" : "mediump");
	}
	return pa;
}
function ha(e, t, n) {
	return t ? e : n ? (e = e.replace("out vec4 finalColor;", ""), `

        #ifdef GL_ES // This checks if it is WebGL1
        #define in varying
        #define finalColor gl_FragColor
        #define texture texture2D
        #endif
        ${e}
        `) : `

        #ifdef GL_ES // This checks if it is WebGL1
        #define in attribute
        #define out varying
        #endif
        ${e}
        `;
}
function ga(e, t, n) {
	let r = n ? t.maxSupportedFragmentPrecision : t.maxSupportedVertexPrecision;
	if (e.substring(0, 9) !== "precision") {
		let i = n ? t.requestedFragmentPrecision : t.requestedVertexPrecision;
		return i === "highp" && r !== "highp" && (i = "mediump"), `precision ${i} float;
${e}`;
	}
	return r !== "highp" && e.substring(0, 15) === "precision highp" ? e.replace("precision highp", "precision mediump") : e;
}
function _a(e, t) {
	return t ? `#version 300 es
${e}` : e;
}
var va = {}, ya = {};
function ba(e, { name: t = "pixi-program" }, n = !0) {
	t = t.replace(/\s+/g, "-"), t += n ? "-fragment" : "-vertex";
	let r = n ? va : ya;
	return r[t] ? (r[t]++, t += `-${r[t]}`) : r[t] = 1, e.indexOf("#define SHADER_NAME") === -1 ? `${`#define SHADER_NAME ${t}`}
${e}` : e;
}
function xa(e, t) {
	return t ? e.replace("#version 300 es", "") : e;
}
var Sa = Object.defineProperty, Ca = Object.getOwnPropertySymbols, wa = Object.prototype.hasOwnProperty, Ta = Object.prototype.propertyIsEnumerable, Ea = (e, t, n) => t in e ? Sa(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Da = (e, t) => {
	for (var n in t ||= {}) wa.call(t, n) && Ea(e, n, t[n]);
	if (Ca) for (var n of Ca(t)) Ta.call(t, n) && Ea(e, n, t[n]);
	return e;
}, Oa = {
	stripVersion: xa,
	ensurePrecision: ga,
	addProgramDefines: ha,
	setProgramName: ba,
	insertVersion: _a
}, ka = Object.create(null), Aa = class e {
	constructor(t) {
		t = Da(Da({}, e.defaultOptions), t);
		let n = t.fragment.indexOf("#version 300 es") !== -1, r = {
			stripVersion: n,
			ensurePrecision: {
				requestedFragmentPrecision: t.preferredFragmentPrecision,
				requestedVertexPrecision: t.preferredVertexPrecision,
				maxSupportedVertexPrecision: "highp",
				maxSupportedFragmentPrecision: ma()
			},
			setProgramName: { name: t.name },
			addProgramDefines: n,
			insertVersion: n
		}, i = t.fragment, a = t.vertex;
		Object.keys(Oa).forEach((e) => {
			let t = r[e];
			i = Oa[e](i, t, !0), a = Oa[e](a, t, !1);
		}), this.fragment = i, this.vertex = a, this.transformFeedbackVaryings = t.transformFeedbackVaryings, this._key = ua(`${this.vertex}:${this.fragment}`, "gl-program");
	}
	destroy() {
		this.fragment = null, this.vertex = null, this._attributeData = null, this._uniformData = null, this._uniformBlockData = null, this.transformFeedbackVaryings = null, ka[this._cacheKey] = null;
	}
	static from(t) {
		let n = `${t.vertex}:${t.fragment}`;
		return ka[n] || (ka[n] = new e(t), ka[n]._cacheKey = n), ka[n];
	}
};
Aa.defaultOptions = {
	preferredVertexPrecision: "highp",
	preferredFragmentPrecision: "mediump"
};
var ja = Aa, Ma = {
	uint8x2: {
		size: 2,
		stride: 2,
		normalised: !1
	},
	uint8x4: {
		size: 4,
		stride: 4,
		normalised: !1
	},
	sint8x2: {
		size: 2,
		stride: 2,
		normalised: !1
	},
	sint8x4: {
		size: 4,
		stride: 4,
		normalised: !1
	},
	unorm8x2: {
		size: 2,
		stride: 2,
		normalised: !0
	},
	unorm8x4: {
		size: 4,
		stride: 4,
		normalised: !0
	},
	snorm8x2: {
		size: 2,
		stride: 2,
		normalised: !0
	},
	snorm8x4: {
		size: 4,
		stride: 4,
		normalised: !0
	},
	uint16x2: {
		size: 2,
		stride: 4,
		normalised: !1
	},
	uint16x4: {
		size: 4,
		stride: 8,
		normalised: !1
	},
	sint16x2: {
		size: 2,
		stride: 4,
		normalised: !1
	},
	sint16x4: {
		size: 4,
		stride: 8,
		normalised: !1
	},
	unorm16x2: {
		size: 2,
		stride: 4,
		normalised: !0
	},
	unorm16x4: {
		size: 4,
		stride: 8,
		normalised: !0
	},
	snorm16x2: {
		size: 2,
		stride: 4,
		normalised: !0
	},
	snorm16x4: {
		size: 4,
		stride: 8,
		normalised: !0
	},
	float16x2: {
		size: 2,
		stride: 4,
		normalised: !1
	},
	float16x4: {
		size: 4,
		stride: 8,
		normalised: !1
	},
	float32: {
		size: 1,
		stride: 4,
		normalised: !1
	},
	float32x2: {
		size: 2,
		stride: 8,
		normalised: !1
	},
	float32x3: {
		size: 3,
		stride: 12,
		normalised: !1
	},
	float32x4: {
		size: 4,
		stride: 16,
		normalised: !1
	},
	uint32: {
		size: 1,
		stride: 4,
		normalised: !1
	},
	uint32x2: {
		size: 2,
		stride: 8,
		normalised: !1
	},
	uint32x3: {
		size: 3,
		stride: 12,
		normalised: !1
	},
	uint32x4: {
		size: 4,
		stride: 16,
		normalised: !1
	},
	sint32: {
		size: 1,
		stride: 4,
		normalised: !1
	},
	sint32x2: {
		size: 2,
		stride: 8,
		normalised: !1
	},
	sint32x3: {
		size: 3,
		stride: 12,
		normalised: !1
	},
	sint32x4: {
		size: 4,
		stride: 16,
		normalised: !1
	}
};
function Na(e) {
	return Ma[e] ?? Ma.float32;
}
var Pa = {
	f32: "float32",
	"vec2<f32>": "float32x2",
	"vec3<f32>": "float32x3",
	"vec4<f32>": "float32x4",
	vec2f: "float32x2",
	vec3f: "float32x3",
	vec4f: "float32x4",
	i32: "sint32",
	"vec2<i32>": "sint32x2",
	"vec3<i32>": "sint32x3",
	"vec4<i32>": "sint32x4",
	vec2i: "sint32x2",
	vec3i: "sint32x3",
	vec4i: "sint32x4",
	u32: "uint32",
	"vec2<u32>": "uint32x2",
	"vec3<u32>": "uint32x3",
	"vec4<u32>": "uint32x4",
	vec2u: "uint32x2",
	vec3u: "uint32x3",
	vec4u: "uint32x4",
	bool: "uint32",
	"vec2<bool>": "uint32x2",
	"vec3<bool>": "uint32x3",
	"vec4<bool>": "uint32x4"
}, Fa = /@location\((\d+)\)\s+([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_<>]+)(?:,|\s|\)|$)/g;
function Ia(e, t) {
	let n;
	for (; (n = Fa.exec(e)) !== null;) {
		let e = Pa[n[3]] ?? "float32";
		t[n[2]] = {
			location: parseInt(n[1], 10),
			format: e,
			stride: Na(e).stride,
			offset: 0,
			instance: !1,
			start: 0
		};
	}
	Fa.lastIndex = 0;
}
function La(e) {
	return e.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
function Ra({ source: e, entryPoint: t }) {
	let n = {}, r = La(e), i = r.indexOf(`fn ${t}(`);
	if (i === -1) return n;
	let a = r.indexOf("->", i);
	if (a === -1) return n;
	let o = r.substring(i, a);
	if (Ia(o, n), Object.keys(n).length === 0) {
		let e = o.match(/\(\s*\w+\s*:\s*(\w+)/);
		if (e) {
			let t = e[1], i = RegExp(`struct\\s+${t}\\s*\\{([^}]+)\\}`, "s"), a = r.match(i);
			a && Ia(a[1], n);
		}
	}
	return n;
}
function za(e) {
	let t = /(^|[^/])@(group|binding)\(\d+\)[^;]+;/g, n = /@group\((\d+)\)/, r = /@binding\((\d+)\)/, i = /var(<[^>]+>)? (\w+)/, a = /:\s*([\w<>]+)/, o = /struct\s+(\w+)\s*{([^}]+)}/g, s = /(\w+)\s*:\s*([\w\<\>]+)/g, c = /struct\s+(\w+)/, l = e.match(t)?.map((e) => ({
		group: parseInt(e.match(n)[1], 10),
		binding: parseInt(e.match(r)[1], 10),
		name: e.match(i)[2],
		isUniform: e.match(i)[1] === "<uniform>",
		type: e.match(a)[1]
	}));
	return l ? {
		groups: l,
		structs: e.match(o)?.map((e) => {
			let t = e.match(c)[1], n = e.match(s).reduce((e, t) => {
				let [n, r] = t.split(":");
				return e[n.trim()] = r.trim(), e;
			}, {});
			return n ? {
				name: t,
				members: n
			} : null;
		}).filter(({ name: e }) => l.some((t) => t.type === e || t.type.includes(`<${e}>`))) ?? []
	} : {
		groups: [],
		structs: []
	};
}
var Ba = ((e) => (e[e.VERTEX = 1] = "VERTEX", e[e.FRAGMENT = 2] = "FRAGMENT", e[e.COMPUTE = 4] = "COMPUTE", e))(Ba || {});
function Va({ groups: e }) {
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		t[r.group] || (t[r.group] = []), r.isUniform ? t[r.group].push({
			binding: r.binding,
			visibility: Ba.VERTEX | Ba.FRAGMENT,
			buffer: { type: "uniform" }
		}) : r.type === "sampler" ? t[r.group].push({
			binding: r.binding,
			visibility: Ba.FRAGMENT,
			sampler: { type: "filtering" }
		}) : r.type === "texture_2d" || r.type.startsWith("texture_2d<") ? t[r.group].push({
			binding: r.binding,
			visibility: Ba.FRAGMENT,
			texture: {
				sampleType: "float",
				viewDimension: "2d",
				multisampled: !1
			}
		}) : r.type === "texture_2d_array" || r.type.startsWith("texture_2d_array<") ? t[r.group].push({
			binding: r.binding,
			visibility: Ba.FRAGMENT,
			texture: {
				sampleType: "float",
				viewDimension: "2d-array",
				multisampled: !1
			}
		}) : (r.type === "texture_cube" || r.type.startsWith("texture_cube<")) && t[r.group].push({
			binding: r.binding,
			visibility: Ba.FRAGMENT,
			texture: {
				sampleType: "float",
				viewDimension: "cube",
				multisampled: !1
			}
		});
	}
	for (let e = 0; e < t.length; e++) t[e] || (t[e] = []);
	return t;
}
function Ha({ groups: e }) {
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		t[r.group] || (t[r.group] = {}), t[r.group][r.name] = r.binding;
	}
	return t;
}
function Ua(e, t) {
	let n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
	return {
		structs: [...e.structs, ...t.structs].filter((e) => !n.has(e.name) && (n.add(e.name), !0)),
		groups: [...e.groups, ...t.groups].filter((e) => {
			let t = `${e.name}-${e.binding}`;
			return !r.has(t) && (r.add(t), !0);
		})
	};
}
var Wa = Object.create(null), Ga = class e {
	constructor(e) {
		this._layoutKey = 0, this._attributeLocationsKey = 0;
		let { fragment: t, vertex: n, layout: r, gpuLayout: i, name: a } = e;
		if (this.name = a, this.fragment = t, this.vertex = n, t.source === n.source) {
			let e = za(t.source);
			this.structsAndGroups = e;
		} else {
			let e = za(n.source), r = za(t.source);
			this.structsAndGroups = Ua(e, r);
		}
		this.layout = r ?? Ha(this.structsAndGroups), this.gpuLayout = i ?? Va(this.structsAndGroups), this.autoAssignGlobalUniforms = this.layout[0]?.globalUniforms !== void 0, this.autoAssignLocalUniforms = this.layout[1]?.localUniforms !== void 0, this._generateProgramKey();
	}
	_generateProgramKey() {
		let { vertex: e, fragment: t } = this, n = e.source + t.source + e.entryPoint + t.entryPoint;
		this._layoutKey = ua(n, "program");
	}
	get attributeData() {
		return this._attributeData ??= Ra(this.vertex), this._attributeData;
	}
	destroy() {
		this.gpuLayout = null, this.layout = null, this.structsAndGroups = null, this.fragment = null, this.vertex = null, Wa[this._cacheKey] = null;
	}
	static from(t) {
		let n = `${t.vertex.source}:${t.fragment.source}:${t.fragment.entryPoint}:${t.vertex.entryPoint}`;
		return Wa[n] || (Wa[n] = new e(t), Wa[n]._cacheKey = n), Wa[n];
	}
}, Ka = class {
	constructor(e) {
		this.resources = Object.create(null), this._dirty = !0;
		let t = 0;
		for (let n in e) {
			let r = e[n];
			this.setResource(r, t++);
		}
		this._updateKey();
	}
	_updateKey() {
		if (!this._dirty) return;
		this._dirty = !1;
		let e = [], t = 0;
		for (let n in this.resources) e[t++] = this.resources[n]._resourceId;
		this._key = e.join("|");
	}
	setResource(e, t) {
		var n, r;
		let i = this.resources[t];
		e !== i && ((n = i?.off) == null || n.call(i, "change", this.onResourceChange, this), (r = e.on) == null || r.call(e, "change", this.onResourceChange, this), this.resources[t] = e, this._dirty = !0);
	}
	getResource(e) {
		return this.resources[e];
	}
	_touch(e, t) {
		let n = this.resources;
		for (let r in n) n[r]._gcLastUsed = e, n[r]._touched = t;
	}
	destroy() {
		var e;
		let t = this.resources;
		for (let n in t) {
			let r = t[n];
			(e = r?.off) == null || e.call(r, "change", this.onResourceChange, this);
		}
		this.resources = null;
	}
	onResourceChange(e) {
		this._dirty = !0, e.destroyed ? this.destroy() : this._updateKey();
	}
}, qa = ((e) => (e[e.WEBGL = 1] = "WEBGL", e[e.WEBGPU = 2] = "WEBGPU", e[e.CANVAS = 4] = "CANVAS", e[e.BOTH = 3] = "BOTH", e))(qa || {}), Ja = [
	"f32",
	"i32",
	"vec2<f32>",
	"vec3<f32>",
	"vec4<f32>",
	"mat2x2<f32>",
	"mat3x3<f32>",
	"mat4x4<f32>",
	"mat3x2<f32>",
	"mat4x2<f32>",
	"mat2x3<f32>",
	"mat4x3<f32>",
	"mat2x4<f32>",
	"mat3x4<f32>",
	"vec2<i32>",
	"vec3<i32>",
	"vec4<i32>"
], Ya = Ja.reduce((e, t) => (e[t] = !0, e), {});
function Xa(e, t) {
	switch (e) {
		case "f32": return 0;
		case "vec2<f32>": return new Float32Array(2 * t);
		case "vec3<f32>": return new Float32Array(3 * t);
		case "vec4<f32>": return new Float32Array(4 * t);
		case "mat2x2<f32>": return new Float32Array([
			1,
			0,
			0,
			1
		]);
		case "mat3x3<f32>": return new Float32Array([
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		]);
		case "mat4x4<f32>": return new Float32Array([
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1
		]);
	}
	return null;
}
var Za = Object.defineProperty, Qa = Object.getOwnPropertySymbols, $a = Object.prototype.hasOwnProperty, eo = Object.prototype.propertyIsEnumerable, to = (e, t, n) => t in e ? Za(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, no = (e, t) => {
	for (var n in t ||= {}) $a.call(t, n) && to(e, n, t[n]);
	if (Qa) for (var n of Qa(t)) eo.call(t, n) && to(e, n, t[n]);
	return e;
}, ro = class e {
	constructor(t, n) {
		this._touched = 0, this.uid = H("uniform"), this._resourceType = "uniformGroup", this._resourceId = H("resource"), this.isUniformGroup = !0, this._dirtyId = 0, this.destroyed = !1, n = no(no({}, e.defaultOptions), n), this.uniformStructures = t;
		let r = {};
		for (let e in t) {
			let n = t[e];
			if (n.name = e, n.size = n.size ?? 1, !Ya[n.type]) {
				let e = n.type.match(/^array<(\w+(?:<\w+>)?),\s*(\d+)>$/);
				if (e) {
					let [, t, r] = e;
					throw Error(`Uniform type ${n.type} is not supported. Use type: '${t}', size: ${r} instead.`);
				}
				throw Error(`Uniform type ${n.type} is not supported. Supported uniform types are: ${Ja.join(", ")}`);
			}
			n.value ??= Xa(n.type, n.size), r[e] = n.value;
		}
		this.uniforms = r, this._dirtyId = 1, this.ubo = n.ubo, this.isStatic = n.isStatic, this._signature = ua(Object.keys(r).map((e) => `${e}-${t[e].type}`).join("-"), "uniform-group");
	}
	update() {
		this._dirtyId++;
	}
};
ro.defaultOptions = {
	ubo: !1,
	isStatic: !1
};
var io = ro, ao = Object.defineProperty, oo = Object.getOwnPropertySymbols, so = Object.prototype.hasOwnProperty, co = Object.prototype.propertyIsEnumerable, lo = (e, t, n) => t in e ? ao(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, uo = (e, t) => {
	for (var n in t ||= {}) so.call(t, n) && lo(e, n, t[n]);
	if (oo) for (var n of oo(t)) co.call(t, n) && lo(e, n, t[n]);
	return e;
}, fo = (e, t) => {
	var n = {};
	for (var r in e) so.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && oo) for (var r of oo(e)) t.indexOf(r) < 0 && co.call(e, r) && (n[r] = e[r]);
	return n;
}, po = class e extends C {
	constructor(e) {
		super(), this.uid = H("shader"), this._uniformBindMap = Object.create(null), this._ownedBindGroups = [], this._destroyed = !1;
		let { gpuProgram: t, glProgram: n, groups: r, resources: i, compatibleRenderers: a, groupMap: o } = e;
		this.gpuProgram = t, this.glProgram = n, a === void 0 && (a = 0, t && (a |= qa.WEBGPU), n && (a |= qa.WEBGL)), this.compatibleRenderers = a;
		let s = {};
		if (!i && !r && (i = {}), i && r) throw Error("[Shader] Cannot have both resources and groups");
		if (!t && r && !o) throw Error("[Shader] No group map or WebGPU shader provided - consider using resources instead.");
		if (!t && r && o) for (let e in o) for (let t in o[e]) {
			let n = o[e][t];
			s[n] = {
				group: e,
				binding: t,
				name: n
			};
		}
		else if (t && r && !o) {
			let e = t.structsAndGroups.groups;
			o = {}, e.forEach((e) => {
				o[e.group] = o[e.group] || {}, o[e.group][e.binding] = e.name, s[e.name] = e;
			});
		} else if (i) {
			r = {}, o = {}, t && t.structsAndGroups.groups.forEach((e) => {
				o[e.group] = o[e.group] || {}, o[e.group][e.binding] = e.name, s[e.name] = e;
			});
			let e = 0;
			for (let t in i) s[t] || (r[99] || (r[99] = new Ka(), this._ownedBindGroups.push(r[99])), s[t] = {
				group: 99,
				binding: e,
				name: t
			}, o[99] = o[99] || {}, o[99][e] = t, e++);
			for (let e in i) {
				let t = e, n = i[e];
				!n.source && !n._resourceType && (n = new io(n));
				let a = s[t];
				a && (r[a.group] || (r[a.group] = new Ka(), this._ownedBindGroups.push(r[a.group])), r[a.group].setResource(n, a.binding));
			}
		}
		this.groups = r, this._uniformBindMap = o, this.resources = this._buildResourceAccessor(r, s);
	}
	addResource(e, t, n) {
		var r, i;
		(r = this._uniformBindMap)[t] || (r[t] = {}), (i = this._uniformBindMap[t])[n] || (i[n] = e), this.groups[t] || (this.groups[t] = new Ka(), this._ownedBindGroups.push(this.groups[t]));
	}
	_buildResourceAccessor(e, t) {
		let n = {};
		for (let r in t) {
			let i = t[r];
			Object.defineProperty(n, i.name, {
				get() {
					return e[i.group].getResource(i.binding);
				},
				set(t) {
					e[i.group].setResource(t, i.binding);
				}
			});
		}
		return n;
	}
	destroy(e = !1) {
		var t, n;
		this._destroyed || (this._destroyed = !0, this.emit("destroy", this), e && ((t = this.gpuProgram) == null || t.destroy(), (n = this.glProgram) == null || n.destroy()), this.gpuProgram = null, this.glProgram = null, this.removeAllListeners(), this._uniformBindMap = null, this._ownedBindGroups.forEach((e) => {
			e.destroy();
		}), this._ownedBindGroups = null, this.resources = null, this.groups = null);
	}
	static from(t) {
		let n = t, { gpu: r, gl: i } = n, a = fo(n, ["gpu", "gl"]), o, s;
		return r && (o = Ga.from(r)), i && (s = ja.from(i)), new e(uo({
			gpuProgram: o,
			glProgram: s
		}, a));
	}
}, mo = {
	normal: 0,
	add: 1,
	multiply: 2,
	screen: 3,
	overlay: 4,
	erase: 5,
	"normal-npm": 6,
	"add-npm": 7,
	"screen-npm": 8,
	min: 9,
	max: 10
}, ho = class e {
	constructor() {
		this.data = 0, this.blendMode = "normal", this.polygonOffset = 0, this.blend = !0, this.depthMask = !0;
	}
	get blend() {
		return !!(this.data & 1);
	}
	set blend(e) {
		!!(this.data & 1) !== e && (this.data ^= 1);
	}
	get offsets() {
		return !!(this.data & 2);
	}
	set offsets(e) {
		!!(this.data & 2) !== e && (this.data ^= 2);
	}
	set cullMode(e) {
		if (e === "none") {
			this.culling = !1;
			return;
		}
		this.culling = !0, this.clockwiseFrontFace = e === "front";
	}
	get cullMode() {
		return this.culling ? this.clockwiseFrontFace ? "front" : "back" : "none";
	}
	get culling() {
		return !!(this.data & 4);
	}
	set culling(e) {
		!!(this.data & 4) !== e && (this.data ^= 4);
	}
	get depthTest() {
		return !!(this.data & 8);
	}
	set depthTest(e) {
		!!(this.data & 8) !== e && (this.data ^= 8);
	}
	get depthMask() {
		return !!(this.data & 32);
	}
	set depthMask(e) {
		!!(this.data & 32) !== e && (this.data ^= 32);
	}
	get clockwiseFrontFace() {
		return !!(this.data & 16);
	}
	set clockwiseFrontFace(e) {
		!!(this.data & 16) !== e && (this.data ^= 16);
	}
	get blendMode() {
		return this._blendMode;
	}
	set blendMode(e) {
		this.blend = e !== "none", this._blendMode = e, this._blendModeId = mo[e] || 0;
	}
	get polygonOffset() {
		return this._polygonOffset;
	}
	set polygonOffset(e) {
		this.offsets = !!e, this._polygonOffset = e;
	}
	static for2d() {
		let t = new e();
		return t.depthTest = !1, t.blend = !0, t;
	}
};
ho.default2d = ho.for2d();
var go = ho, _o = Object.defineProperty, vo = Object.getOwnPropertySymbols, yo = Object.prototype.hasOwnProperty, bo = Object.prototype.propertyIsEnumerable, xo = (e, t, n) => t in e ? _o(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, So = (e, t) => {
	for (var n in t ||= {}) yo.call(t, n) && xo(e, n, t[n]);
	if (vo) for (var n of vo(t)) bo.call(t, n) && xo(e, n, t[n]);
	return e;
}, Co = (e, t) => {
	var n = {};
	for (var r in e) yo.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && vo) for (var r of vo(e)) t.indexOf(r) < 0 && bo.call(e, r) && (n[r] = e[r]);
	return n;
}, wo = class e extends po {
	constructor(t) {
		t = So(So({}, e.defaultOptions), t), super(t), this.enabled = !0, this._state = go.for2d(), this.blendMode = t.blendMode, this.padding = t.padding, this.antialias = typeof t.antialias == "boolean" ? t.antialias ? "on" : "off" : t.antialias, this.resolution = t.resolution, this.blendRequired = t.blendRequired, this.clipToViewport = t.clipToViewport, this.addResource("uTexture", 0, 1), t.blendRequired && this.addResource("uBackTexture", 0, 3);
	}
	apply(e, t, n, r) {
		e.applyFilter(this, t, n, r);
	}
	get blendMode() {
		return this._state.blendMode;
	}
	set blendMode(e) {
		this._state.blendMode = e;
	}
	static from(t) {
		let n = t, { gpu: r, gl: i } = n, a = Co(n, ["gpu", "gl"]), o, s;
		return r && (o = Ga.from(r)), i && (s = ja.from(i)), new e(So({
			gpuProgram: o,
			glProgram: s
		}, a));
	}
};
wo.defaultOptions = {
	blendMode: "normal",
	resolution: 1,
	padding: 0,
	antialias: "off",
	blendRequired: !1,
	clipToViewport: !0
};
var To = wo, Eo = "in vec2 aPosition;\nout vec2 vTextureCoord;\n\nuniform vec4 uInputSize;\nuniform vec4 uOutputFrame;\nuniform vec4 uOutputTexture;\n\nvec4 filterVertexPosition( void )\n{\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n    \n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nvec2 filterTextureCoord( void )\n{\n    return aPosition * (uOutputFrame.zw * uInputSize.zw);\n}\n\nvoid main(void)\n{\n    gl_Position = filterVertexPosition();\n    vTextureCoord = filterTextureCoord();\n}\n", Do = "in vec2 vTextureCoord;\nout vec4 finalColor;\nuniform sampler2D uTexture;\nvoid main() {\n    finalColor = texture(uTexture, vTextureCoord);\n}\n", Oo = "struct GlobalFilterUniforms {\n  uInputSize: vec4<f32>,\n  uInputPixel: vec4<f32>,\n  uInputClamp: vec4<f32>,\n  uOutputFrame: vec4<f32>,\n  uGlobalFrame: vec4<f32>,\n  uOutputTexture: vec4<f32>,\n};\n\n@group(0) @binding(0) var <uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler: sampler;\n\nstruct VSOutput {\n  @builtin(position) position: vec4<f32>,\n  @location(0) uv: vec2<f32>\n};\n\nfn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\n@vertex\nfn mainVertex(\n  @location(0) aPosition: vec2<f32>,\n) -> VSOutput {\n  return VSOutput(\n   filterVertexPosition(aPosition),\n   filterTextureCoord(aPosition)\n  );\n}\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n) -> @location(0) vec4<f32> {\n    return textureSample(uTexture, uSampler, uv);\n}\n", ko = class extends To {
	constructor() {
		let e = Ga.from({
			vertex: {
				source: Oo,
				entryPoint: "mainVertex"
			},
			fragment: {
				source: Oo,
				entryPoint: "mainFragment"
			},
			name: "passthrough-filter"
		}), t = ja.from({
			vertex: Eo,
			fragment: Do,
			name: "passthrough-filter"
		});
		super({
			gpuProgram: e,
			glProgram: t
		});
	}
}, Q = ((e) => (e[e.MAP_READ = 1] = "MAP_READ", e[e.MAP_WRITE = 2] = "MAP_WRITE", e[e.COPY_SRC = 4] = "COPY_SRC", e[e.COPY_DST = 8] = "COPY_DST", e[e.INDEX = 16] = "INDEX", e[e.VERTEX = 32] = "VERTEX", e[e.UNIFORM = 64] = "UNIFORM", e[e.STORAGE = 128] = "STORAGE", e[e.INDIRECT = 256] = "INDIRECT", e[e.QUERY_RESOLVE = 512] = "QUERY_RESOLVE", e[e.STATIC = 1024] = "STATIC", e))(Q || {}), Ao = class extends C {
	constructor(e) {
		let { data: t, size: n } = e, { usage: r, label: i, shrinkToFit: a } = e;
		super(), this._gpuData = Object.create(null), this._gcLastUsed = -1, this.autoGarbageCollect = !0, this.uid = H("buffer"), this._resourceType = "buffer", this._resourceId = H("resource"), this._touched = 0, this._updateID = 1, this._dataInt32 = null, this.shrinkToFit = !0, this.destroyed = !1, t instanceof Array && (t = new Float32Array(t)), this._data = t, n ??= t?.byteLength;
		let o = !!t;
		this.descriptor = {
			size: n,
			usage: r,
			mappedAtCreation: o,
			label: i
		}, this.shrinkToFit = a ?? !0;
	}
	get data() {
		return this._data;
	}
	set data(e) {
		this.setDataWithSize(e, e.length, !0);
	}
	get dataInt32() {
		return this._dataInt32 ||= new Int32Array(this.data.buffer), this._dataInt32;
	}
	get static() {
		return !!(this.descriptor.usage & Q.STATIC);
	}
	set static(e) {
		e ? this.descriptor.usage |= Q.STATIC : this.descriptor.usage &= ~Q.STATIC;
	}
	setDataWithSize(e, t, n) {
		if (this._updateID++, this._updateSize = t * e.BYTES_PER_ELEMENT, this._data === e) {
			n && this.emit("update", this);
			return;
		}
		let r = this._data;
		if (this._data = e, this._dataInt32 = null, !r || r.length !== e.length) {
			!this.shrinkToFit && r && e.byteLength < r.byteLength ? n && this.emit("update", this) : (this.descriptor.size = e.byteLength, this._resourceId = H("resource"), this.emit("change", this));
			return;
		}
		n && this.emit("update", this);
	}
	update(e) {
		this._updateSize = e ?? this._updateSize, this._updateID++, this.emit("update", this);
	}
	unload() {
		var e;
		this.emit("unload", this);
		for (let t in this._gpuData) (e = this._gpuData[t]) == null || e.destroy();
		this._gpuData = Object.create(null);
	}
	destroy() {
		this.destroyed = !0, this.unload(), this.emit("destroy", this), this.emit("change", this), this._data = null, this.descriptor = null, this.removeAllListeners();
	}
};
function jo(e, t) {
	if (!(e instanceof Ao)) {
		let n = t ? Q.INDEX : Q.VERTEX;
		e instanceof Array && (t ? (e = new Uint32Array(e), n = Q.INDEX | Q.COPY_DST) : (e = new Float32Array(e), n = Q.VERTEX | Q.COPY_DST)), e = new Ao({
			data: e,
			label: t ? "index-mesh-buffer" : "vertex-mesh-buffer",
			usage: n
		});
	}
	return e;
}
function Mo(e, t, n) {
	let r = e.getAttribute(t);
	if (!r) return n.minX = 0, n.minY = 0, n.maxX = 0, n.maxY = 0, n;
	let i = r.buffer.data, a = 1 / 0, o = 1 / 0, s = -1 / 0, c = -1 / 0, l = i.BYTES_PER_ELEMENT, u = (r.offset || 0) / l, d = (r.stride || 8) / l;
	for (let e = u; e < i.length; e += d) {
		let t = i[e], n = i[e + 1];
		t > s && (s = t), n > c && (c = n), t < a && (a = t), n < o && (o = n);
	}
	return n.minX = a, n.minY = o, n.maxX = s, n.maxY = c, n;
}
function No(e) {
	return (e instanceof Ao || Array.isArray(e) || e.BYTES_PER_ELEMENT) && (e = { buffer: e }), e.buffer = jo(e.buffer, !1), e;
}
var Po = class extends C {
	constructor(e = {}) {
		super(), this._gpuData = Object.create(null), this.autoGarbageCollect = !0, this._gcLastUsed = -1, this.uid = H("geometry"), this._layoutKey = 0, this.instanceCount = 1, this._bounds = new G(), this._boundsDirty = !0;
		let { attributes: t, indexBuffer: n, topology: r } = e;
		if (this.buffers = [], this.attributes = {}, t) for (let e in t) this.addAttribute(e, t[e]);
		this.instanceCount = e.instanceCount ?? 1, n && this.addIndex(n), this.topology = r || "triangle-list";
	}
	onBufferUpdate() {
		this._boundsDirty = !0, this.emit("update", this);
	}
	getAttribute(e) {
		return this.attributes[e];
	}
	getIndex() {
		return this.indexBuffer;
	}
	getBuffer(e) {
		return this.getAttribute(e).buffer;
	}
	getSize() {
		for (let e in this.attributes) {
			let t = this.attributes[e];
			return t.buffer.data.length / (t.stride / 4 || t.size);
		}
		return 0;
	}
	addAttribute(e, t) {
		let n = No(t);
		this.buffers.indexOf(n.buffer) === -1 && (this.buffers.push(n.buffer), n.buffer.on("update", this.onBufferUpdate, this), n.buffer.on("change", this.onBufferUpdate, this)), this.attributes[e] = n;
	}
	addIndex(e) {
		this.indexBuffer = jo(e, !0), this.buffers.push(this.indexBuffer);
	}
	get bounds() {
		return this._boundsDirty ? (this._boundsDirty = !1, Mo(this, "aPosition", this._bounds)) : this._bounds;
	}
	unload() {
		var e;
		this.emit("unload", this);
		for (let t in this._gpuData) (e = this._gpuData[t]) == null || e.destroy();
		this._gpuData = Object.create(null);
	}
	destroy(e = !1) {
		var t;
		this.emit("destroy", this), this.removeAllListeners(), e && this.buffers.forEach((e) => e.destroy()), this.unload(), (t = this.indexBuffer) == null || t.destroy(), this.attributes = null, this.buffers = null, this.indexBuffer = null, this._bounds = null;
	}
}, Fo = new Po({
	attributes: { aPosition: {
		buffer: new Float32Array([
			0,
			0,
			1,
			0,
			1,
			1,
			0,
			1
		]),
		format: "float32x2",
		stride: 8,
		offset: 0
	} },
	indexBuffer: new Uint32Array([
		0,
		1,
		2,
		0,
		2,
		3
	])
}), Io = class {
	constructor() {
		this.skip = !1, this.inputTexture = null, this.backTexture = null, this.filters = null, this.bounds = new G(), this.container = null, this.blendRequired = !1, this.outputRenderSurface = null, this.globalFrame = {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		}, this.firstEnabledIndex = -1, this.lastEnabledIndex = -1;
	}
}, Lo = class {
	constructor(e) {
		this._filterStackIndex = 0, this._filterStack = [], this._filterGlobalUniforms = new io({
			uInputSize: {
				value: /* @__PURE__ */ new Float32Array(4),
				type: "vec4<f32>"
			},
			uInputPixel: {
				value: /* @__PURE__ */ new Float32Array(4),
				type: "vec4<f32>"
			},
			uInputClamp: {
				value: /* @__PURE__ */ new Float32Array(4),
				type: "vec4<f32>"
			},
			uOutputFrame: {
				value: /* @__PURE__ */ new Float32Array(4),
				type: "vec4<f32>"
			},
			uGlobalFrame: {
				value: /* @__PURE__ */ new Float32Array(4),
				type: "vec4<f32>"
			},
			uOutputTexture: {
				value: /* @__PURE__ */ new Float32Array(4),
				type: "vec4<f32>"
			}
		}), this._globalFilterBindGroup = new Ka({}), this.renderer = e;
	}
	get activeBackTexture() {
		return this._activeFilterData?.backTexture;
	}
	push(e) {
		let t = this.renderer, n = e.filterEffect.filters, r = this._pushFilterData();
		r.skip = !1, r.filters = n, r.container = e.container, r.outputRenderSurface = t.renderTarget.renderSurface;
		let i = t.renderTarget.renderTarget.colorTexture.source, a = i.resolution, o = i.antialias;
		if (n.every((e) => !e.enabled)) {
			r.skip = !0;
			return;
		}
		let s = r.bounds;
		if (this._calculateFilterArea(e, s), this._calculateFilterBounds(r, t.renderTarget.rootViewPort, o, a, 1), r.skip) return;
		let c = this._getPreviousFilterData(), l = this._findFilterResolution(a), u = 0, d = 0;
		c && (u = c.bounds.minX, d = c.bounds.minY), this._calculateGlobalFrame(r, u, d, l, i.width, i.height), this._setupFilterTextures(r, s, t, c);
	}
	generateFilteredTexture({ texture: e, filters: t }) {
		let n = this._pushFilterData();
		this._activeFilterData = n, n.skip = !1, n.filters = t;
		let r = e.source, i = r.resolution, a = r.antialias;
		if (t.every((e) => !e.enabled)) return n.skip = !0, e;
		let o = n.bounds;
		if (o.addRect(e.frame), this._calculateFilterBounds(n, o.rectangle, a, i, 0), n.skip) return e;
		let s = i;
		this._calculateGlobalFrame(n, 0, 0, s, r.width, r.height), n.outputRenderSurface = hn.getOptimalTexture(o.width, o.height, n.resolution, n.antialias), n.backTexture = J.EMPTY, n.inputTexture = e, this.renderer.renderTarget.finishRenderPass(), this._applyFiltersToTexture(n, !0);
		let c = n.outputRenderSurface;
		return c.source.alphaMode = "premultiplied-alpha", c;
	}
	pop() {
		let e = this.renderer, t = this._popFilterData();
		t.skip || (e.globalUniforms.pop(), e.renderTarget.finishRenderPass(), this._activeFilterData = t, this._applyFiltersToTexture(t, !1), t.blendRequired && hn.returnTexture(t.backTexture), hn.returnTexture(t.inputTexture));
	}
	getBackTexture(e, t, n) {
		let r = e.colorTexture.source._resolution, i = hn.getOptimalTexture(t.width, t.height, r, !1), a = t.minX, o = t.minY;
		n && (a -= n.minX, o -= n.minY), a = Math.floor(a * r), o = Math.floor(o * r);
		let s = Math.ceil(t.width * r), c = Math.ceil(t.height * r);
		return this.renderer.renderTarget.copyToTexture(e, i, {
			x: a,
			y: o
		}, {
			width: s,
			height: c
		}, {
			x: 0,
			y: 0
		}), i;
	}
	applyFilter(e, t, n, r) {
		let i = this.renderer, a = this._activeFilterData, o = a.outputRenderSurface === n, s = i.renderTarget.rootRenderTarget.colorTexture.source._resolution, c = this._findFilterResolution(s), l = 0, u = 0;
		if (o) {
			let e = this._findPreviousFilterOffset();
			l = e.x, u = e.y;
		}
		this._updateFilterUniforms(t, n, a, l, u, c, o, r);
		let d = e.enabled ? e : this._getPassthroughFilter();
		this._setupBindGroupsAndRender(d, t, i);
	}
	calculateSpriteMatrix(e, t) {
		let n = this._activeFilterData, r = e.set(n.inputTexture._source.width, 0, 0, n.inputTexture._source.height, n.bounds.minX, n.bounds.minY), i = t.worldTransform.copyTo(B.shared), a = t.renderGroup || t.parentRenderGroup;
		return a && a.cacheToLocalTransform && i.prepend(a.cacheToLocalTransform), i.invert(), r.prepend(i), r.scale(1 / t.texture.orig.width, 1 / t.texture.orig.height), r.translate(t.anchor.x, t.anchor.y), r;
	}
	destroy() {
		var e;
		(e = this._passthroughFilter) == null || e.destroy(!0), this._passthroughFilter = null;
	}
	_getPassthroughFilter() {
		return this._passthroughFilter ??= new ko(), this._passthroughFilter;
	}
	_setupBindGroupsAndRender(e, t, n) {
		if (n.renderPipes.uniformBatch) {
			let e = n.renderPipes.uniformBatch.getUboResource(this._filterGlobalUniforms);
			this._globalFilterBindGroup.setResource(e, 0);
		} else this._globalFilterBindGroup.setResource(this._filterGlobalUniforms, 0);
		this._globalFilterBindGroup.setResource(t.source, 1), this._globalFilterBindGroup.setResource(t.source.style, 2), e.groups[0] = this._globalFilterBindGroup, n.encoder.draw({
			geometry: Fo,
			shader: e,
			state: e._state,
			topology: "triangle-list"
		}), n.type === qa.WEBGL && n.renderTarget.finishRenderPass();
	}
	_setupFilterTextures(e, t, n, r) {
		if (e.backTexture = J.EMPTY, e.inputTexture = hn.getOptimalTexture(t.width, t.height, e.resolution, e.antialias), e.blendRequired) {
			n.renderTarget.finishRenderPass();
			let i = n.renderTarget.getRenderTarget(e.outputRenderSurface);
			e.backTexture = this.getBackTexture(i, t, r?.bounds);
		}
		n.renderTarget.bind(e.inputTexture, !0), n.globalUniforms.push({ offset: t });
	}
	_calculateGlobalFrame(e, t, n, r, i, a) {
		let o = e.globalFrame;
		o.x = t * r, o.y = n * r, o.width = i * r, o.height = a * r;
	}
	_updateFilterUniforms(e, t, n, r, i, a, o, s) {
		let c = this._filterGlobalUniforms.uniforms, l = c.uOutputFrame, u = c.uInputSize, d = c.uInputPixel, f = c.uInputClamp, p = c.uGlobalFrame, m = c.uOutputTexture;
		o ? (l[0] = n.bounds.minX - r, l[1] = n.bounds.minY - i) : (l[0] = 0, l[1] = 0), l[2] = e.frame.width, l[3] = e.frame.height, u[0] = e.source.width, u[1] = e.source.height, u[2] = 1 / u[0], u[3] = 1 / u[1], d[0] = e.source.pixelWidth, d[1] = e.source.pixelHeight, d[2] = 1 / d[0], d[3] = 1 / d[1], f[0] = .5 * d[2], f[1] = .5 * d[3], f[2] = e.frame.width * u[2] - .5 * d[2], f[3] = e.frame.height * u[3] - .5 * d[3];
		let h = this.renderer.renderTarget.rootRenderTarget.colorTexture;
		p[0] = r * a, p[1] = i * a, p[2] = h.source.width * a, p[3] = h.source.height * a, t instanceof J && (t.source.resource = null);
		let g = this.renderer.renderTarget.getRenderTarget(t);
		this.renderer.renderTarget.bind(t, !!s), t instanceof J ? (m[0] = t.frame.width, m[1] = t.frame.height) : (m[0] = g.width, m[1] = g.height), m[2] = g.isRoot ? -1 : 1, this._filterGlobalUniforms.update();
	}
	_findFilterResolution(e) {
		let t = this._filterStackIndex - 1;
		for (; t > 0 && this._filterStack[t].skip;) --t;
		return t > 0 && this._filterStack[t].inputTexture ? this._filterStack[t].inputTexture.source._resolution : e;
	}
	_findPreviousFilterOffset() {
		let e = 0, t = 0, n = this._filterStackIndex;
		for (; n > 0;) {
			n--;
			let r = this._filterStack[n];
			if (!r.skip) {
				e = r.bounds.minX, t = r.bounds.minY;
				break;
			}
		}
		return {
			x: e,
			y: t
		};
	}
	_calculateFilterArea(e, t) {
		if (e.renderables ? ta(e.renderables, t) : e.filterEffect.filterArea ? (t.clear(), t.addRect(e.filterEffect.filterArea), t.applyMatrix(e.container.worldTransform)) : e.container.getFastGlobalBounds(!0, t), e.container) {
			let n = (e.container.renderGroup || e.container.parentRenderGroup).cacheToLocalTransform;
			n && t.applyMatrix(n);
		}
	}
	_applyFiltersToTexture(e, t) {
		let n = e.inputTexture, r = e.bounds, i = e.filters, a = e.firstEnabledIndex, o = e.lastEnabledIndex;
		if (this._globalFilterBindGroup.setResource(n.source.style, 2), this._globalFilterBindGroup.setResource(e.backTexture.source, 3), a === o) i[a].apply(this, n, e.outputRenderSurface, t);
		else {
			let n = e.inputTexture, s = hn.getOptimalTexture(r.width, r.height, n.source._resolution, !1), c = s;
			for (let e = a; e < o; e++) {
				let t = i[e];
				if (!t.enabled) continue;
				t.apply(this, n, c, !0);
				let r = n;
				n = c, c = r;
			}
			i[o].apply(this, n, e.outputRenderSurface, t), hn.returnTexture(s);
		}
	}
	_calculateFilterBounds(e, t, n, r, i) {
		var a;
		let o = this.renderer, s = e.bounds, c = e.filters, l = 1 / 0, u = 0, d = !0, f = !1, p = !1, m = !0, h = -1, g = -1;
		for (let e = 0; e < c.length; e++) {
			let t = c[e];
			if (t.enabled) {
				if (h === -1 && (h = e), g = e, l = Math.min(l, t.resolution === "inherit" ? r : t.resolution), u += t.padding, t.antialias === "off" ? d = !1 : t.antialias === "inherit" && d && (d = n), t.clipToViewport || (m = !1), !(t.compatibleRenderers & o.type)) {
					p = !1;
					break;
				}
				if (t.blendRequired && !((a = o.backBuffer?.useBackBuffer) == null || a)) {
					p = !1;
					break;
				}
				p = !0, f ||= t.blendRequired;
			}
		}
		if (!p) {
			e.skip = !0;
			return;
		}
		if (m && s.fitBounds(0, t.width / r, 0, t.height / r), s.scale(l).ceil().scale(1 / l).pad((u | 0) * i), !s.isPositive) {
			e.skip = !0;
			return;
		}
		e.antialias = d, e.resolution = l, e.blendRequired = f, e.firstEnabledIndex = h, e.lastEnabledIndex = g;
	}
	_popFilterData() {
		return this._filterStackIndex--, this._filterStack[this._filterStackIndex];
	}
	_getPreviousFilterData() {
		let e, t = this._filterStackIndex - 1;
		for (; t > 0 && (t--, e = this._filterStack[t], e.skip););
		return e;
	}
	_pushFilterData() {
		let e = this._filterStack[this._filterStackIndex];
		return e ||= this._filterStack[this._filterStackIndex] = new Io(), this._filterStackIndex++, e;
	}
};
Lo.extension = {
	type: [h.WebGLSystem, h.WebGPUSystem],
	name: "filter"
}, v.add(Lo, oa), v.add(sa);
var Ro = [];
v.handleByNamedList(h.Environment, Ro);
async function zo(e) {
	if (!e) for (let e = 0; e < Ro.length; e++) {
		let t = Ro[e];
		if (t.value.test()) {
			await t.value.load();
			return;
		}
	}
}
var Bo;
function Vo() {
	if (typeof Bo == "boolean") return Bo;
	try {
		Bo = Function("param1", "param2", "param3", "return param1[param2] === param3;")({ a: "b" }, "a", "b") === !0;
	} catch {
		Bo = !1;
	}
	return Bo;
}
function Ho(e, t, n = 2) {
	let r = t && t.length, i = r ? t[0] * n : e.length, a = Uo(e, 0, i, n, !0), o = [];
	if (!a || a.next === a.prev) return o;
	let s, c, l;
	if (r && (a = Xo(e, t, a, n)), e.length > 80 * n) {
		s = e[0], c = e[1];
		let t = s, r = c;
		for (let a = n; a < i; a += n) {
			let n = e[a], i = e[a + 1];
			n < s && (s = n), i < c && (c = i), n > t && (t = n), i > r && (r = i);
		}
		l = Math.max(t - s, r - c), l = l === 0 ? 0 : 32767 / l;
	}
	return Go(a, o, n, s, c, l, 0), o;
}
function Uo(e, t, n, r, i) {
	let a;
	if (i === bs(e, t, n, r) > 0) for (let i = t; i < n; i += r) a = _s(i / r | 0, e[i], e[i + 1], a);
	else for (let i = n - r; i >= t; i -= r) a = _s(i / r | 0, e[i], e[i + 1], a);
	return a && ls(a, a.next) && (vs(a), a = a.next), a;
}
function Wo(e, t) {
	if (!e) return e;
	t ||= e;
	let n = e, r;
	do
		if (r = !1, !n.steiner && (ls(n, n.next) || cs(n.prev, n, n.next) === 0)) {
			if (vs(n), n = t = n.prev, n === n.next) break;
			r = !0;
		} else n = n.next;
	while (r || n !== t);
	return t;
}
function Go(e, t, n, r, i, a, o) {
	if (!e) return;
	!o && a && ts(e, r, i, a);
	let s = e;
	for (; e.prev !== e.next;) {
		let c = e.prev, l = e.next;
		if (a ? qo(e, r, i, a) : Ko(e)) {
			t.push(c.i, e.i, l.i), vs(e), e = l.next, s = l.next;
			continue;
		}
		if (e = l, e === s) {
			o ? o === 1 ? (e = Jo(Wo(e), t), Go(e, t, n, r, i, a, 2)) : o === 2 && Yo(e, t, n, r, i, a) : Go(Wo(e), t, n, r, i, a, 1);
			break;
		}
	}
}
function Ko(e) {
	let t = e.prev, n = e, r = e.next;
	if (cs(t, n, r) >= 0) return !1;
	let i = t.x, a = n.x, o = r.x, s = t.y, c = n.y, l = r.y, u = Math.min(i, a, o), d = Math.min(s, c, l), f = Math.max(i, a, o), p = Math.max(s, c, l), m = r.next;
	for (; m !== t;) {
		if (m.x >= u && m.x <= f && m.y >= d && m.y <= p && os(i, s, a, c, o, l, m.x, m.y) && cs(m.prev, m, m.next) >= 0) return !1;
		m = m.next;
	}
	return !0;
}
function qo(e, t, n, r) {
	let i = e.prev, a = e, o = e.next;
	if (cs(i, a, o) >= 0) return !1;
	let s = i.x, c = a.x, l = o.x, u = i.y, d = a.y, f = o.y, p = Math.min(s, c, l), m = Math.min(u, d, f), h = Math.max(s, c, l), g = Math.max(u, d, f), _ = rs(p, m, t, n, r), v = rs(h, g, t, n, r), y = e.prevZ, b = e.nextZ;
	for (; y && y.z >= _ && b && b.z <= v;) {
		if (y.x >= p && y.x <= h && y.y >= m && y.y <= g && y !== i && y !== o && os(s, u, c, d, l, f, y.x, y.y) && cs(y.prev, y, y.next) >= 0 || (y = y.prevZ, b.x >= p && b.x <= h && b.y >= m && b.y <= g && b !== i && b !== o && os(s, u, c, d, l, f, b.x, b.y) && cs(b.prev, b, b.next) >= 0)) return !1;
		b = b.nextZ;
	}
	for (; y && y.z >= _;) {
		if (y.x >= p && y.x <= h && y.y >= m && y.y <= g && y !== i && y !== o && os(s, u, c, d, l, f, y.x, y.y) && cs(y.prev, y, y.next) >= 0) return !1;
		y = y.prevZ;
	}
	for (; b && b.z <= v;) {
		if (b.x >= p && b.x <= h && b.y >= m && b.y <= g && b !== i && b !== o && os(s, u, c, d, l, f, b.x, b.y) && cs(b.prev, b, b.next) >= 0) return !1;
		b = b.nextZ;
	}
	return !0;
}
function Jo(e, t) {
	let n = e;
	do {
		let r = n.prev, i = n.next.next;
		!ls(r, i) && us(r, n, n.next, i) && ms(r, i) && ms(i, r) && (t.push(r.i, n.i, i.i), vs(n), vs(n.next), n = e = i), n = n.next;
	} while (n !== e);
	return Wo(n);
}
function Yo(e, t, n, r, i, a) {
	let o = e;
	do {
		let e = o.next.next;
		for (; e !== o.prev;) {
			if (o.i !== e.i && ss(o, e)) {
				let s = gs(o, e);
				o = Wo(o, o.next), s = Wo(s, s.next), Go(o, t, n, r, i, a, 0), Go(s, t, n, r, i, a, 0);
				return;
			}
			e = e.next;
		}
		o = o.next;
	} while (o !== e);
}
function Xo(e, t, n, r) {
	let i = [];
	for (let n = 0, a = t.length; n < a; n++) {
		let o = Uo(e, t[n] * r, n < a - 1 ? t[n + 1] * r : e.length, r, !1);
		o === o.next && (o.steiner = !0), i.push(is(o));
	}
	i.sort(Zo);
	for (let e = 0; e < i.length; e++) n = Qo(i[e], n);
	return n;
}
function Zo(e, t) {
	let n = e.x - t.x;
	return n === 0 && (n = e.y - t.y, n === 0) && (n = (e.next.y - e.y) / (e.next.x - e.x) - (t.next.y - t.y) / (t.next.x - t.x)), n;
}
function Qo(e, t) {
	let n = $o(e, t);
	if (!n) return t;
	let r = gs(n, e);
	return Wo(r, r.next), Wo(n, n.next);
}
function $o(e, t) {
	let n = t, r = e.x, i = e.y, a = -1 / 0, o;
	if (ls(e, n)) return n;
	do {
		if (ls(e, n.next)) return n.next;
		if (i <= n.y && i >= n.next.y && n.next.y !== n.y) {
			let e = n.x + (i - n.y) * (n.next.x - n.x) / (n.next.y - n.y);
			if (e <= r && e > a && (a = e, o = n.x < n.next.x ? n : n.next, e === r)) return o;
		}
		n = n.next;
	} while (n !== t);
	if (!o) return null;
	let s = o, c = o.x, l = o.y, u = 1 / 0;
	n = o;
	do {
		if (r >= n.x && n.x >= c && r !== n.x && as(i < l ? r : a, i, c, l, i < l ? a : r, i, n.x, n.y)) {
			let t = Math.abs(i - n.y) / (r - n.x);
			ms(n, e) && (t < u || t === u && (n.x > o.x || n.x === o.x && es(o, n))) && (o = n, u = t);
		}
		n = n.next;
	} while (n !== s);
	return o;
}
function es(e, t) {
	return cs(e.prev, e, t.prev) < 0 && cs(t.next, e, e.next) < 0;
}
function ts(e, t, n, r) {
	let i = e;
	do
		i.z === 0 && (i.z = rs(i.x, i.y, t, n, r)), i.prevZ = i.prev, i.nextZ = i.next, i = i.next;
	while (i !== e);
	i.prevZ.nextZ = null, i.prevZ = null, ns(i);
}
function ns(e) {
	let t, n = 1;
	do {
		let r = e, i;
		e = null;
		let a = null;
		for (t = 0; r;) {
			t++;
			let o = r, s = 0;
			for (let e = 0; e < n && (s++, o = o.nextZ, o); e++);
			let c = n;
			for (; s > 0 || c > 0 && o;) s !== 0 && (c === 0 || !o || r.z <= o.z) ? (i = r, r = r.nextZ, s--) : (i = o, o = o.nextZ, c--), a ? a.nextZ = i : e = i, i.prevZ = a, a = i;
			r = o;
		}
		a.nextZ = null, n *= 2;
	} while (t > 1);
	return e;
}
function rs(e, t, n, r, i) {
	return e = (e - n) * i | 0, t = (t - r) * i | 0, e = (e | e << 8) & 16711935, e = (e | e << 4) & 252645135, e = (e | e << 2) & 858993459, e = (e | e << 1) & 1431655765, t = (t | t << 8) & 16711935, t = (t | t << 4) & 252645135, t = (t | t << 2) & 858993459, t = (t | t << 1) & 1431655765, e | t << 1;
}
function is(e) {
	let t = e, n = e;
	do
		(t.x < n.x || t.x === n.x && t.y < n.y) && (n = t), t = t.next;
	while (t !== e);
	return n;
}
function as(e, t, n, r, i, a, o, s) {
	return (i - o) * (t - s) >= (e - o) * (a - s) && (e - o) * (r - s) >= (n - o) * (t - s) && (n - o) * (a - s) >= (i - o) * (r - s);
}
function os(e, t, n, r, i, a, o, s) {
	return (e !== o || t !== s) && as(e, t, n, r, i, a, o, s);
}
function ss(e, t) {
	return e.next.i !== t.i && e.prev.i !== t.i && !ps(e, t) && (ms(e, t) && ms(t, e) && hs(e, t) && (cs(e.prev, e, t.prev) || cs(e, t.prev, t)) || ls(e, t) && cs(e.prev, e, e.next) > 0 && cs(t.prev, t, t.next) > 0);
}
function cs(e, t, n) {
	return (t.y - e.y) * (n.x - t.x) - (t.x - e.x) * (n.y - t.y);
}
function ls(e, t) {
	return e.x === t.x && e.y === t.y;
}
function us(e, t, n, r) {
	let i = fs(cs(e, t, n)), a = fs(cs(e, t, r)), o = fs(cs(n, r, e)), s = fs(cs(n, r, t));
	return !!(i !== a && o !== s || i === 0 && ds(e, n, t) || a === 0 && ds(e, r, t) || o === 0 && ds(n, e, r) || s === 0 && ds(n, t, r));
}
function ds(e, t, n) {
	return t.x <= Math.max(e.x, n.x) && t.x >= Math.min(e.x, n.x) && t.y <= Math.max(e.y, n.y) && t.y >= Math.min(e.y, n.y);
}
function fs(e) {
	return e > 0 ? 1 : e < 0 ? -1 : 0;
}
function ps(e, t) {
	let n = e;
	do {
		if (n.i !== e.i && n.next.i !== e.i && n.i !== t.i && n.next.i !== t.i && us(n, n.next, e, t)) return !0;
		n = n.next;
	} while (n !== e);
	return !1;
}
function ms(e, t) {
	return cs(e.prev, e, e.next) < 0 ? cs(e, t, e.next) >= 0 && cs(e, e.prev, t) >= 0 : cs(e, t, e.prev) < 0 || cs(e, e.next, t) < 0;
}
function hs(e, t) {
	let n = e, r = !1, i = (e.x + t.x) / 2, a = (e.y + t.y) / 2;
	do
		n.y > a != n.next.y > a && n.next.y !== n.y && i < (n.next.x - n.x) * (a - n.y) / (n.next.y - n.y) + n.x && (r = !r), n = n.next;
	while (n !== e);
	return r;
}
function gs(e, t) {
	let n = ys(e.i, e.x, e.y), r = ys(t.i, t.x, t.y), i = e.next, a = t.prev;
	return e.next = t, t.prev = e, n.next = i, i.prev = n, r.next = n, n.prev = r, a.next = r, r.prev = a, r;
}
function _s(e, t, n, r) {
	let i = ys(e, t, n);
	return r ? (i.next = r.next, i.prev = r, r.next.prev = i, r.next = i) : (i.prev = i, i.next = i), i;
}
function vs(e) {
	e.next.prev = e.prev, e.prev.next = e.next, e.prevZ && (e.prevZ.nextZ = e.nextZ), e.nextZ && (e.nextZ.prevZ = e.prevZ);
}
function ys(e, t, n) {
	return {
		i: e,
		x: t,
		y: n,
		prev: null,
		next: null,
		z: 0,
		prevZ: null,
		nextZ: null,
		steiner: !1
	};
}
function bs(e, t, n, r) {
	let i = 0;
	for (let a = t, o = n - r; a < n; a += r) i += (e[o] - e[a]) * (e[a + 1] + e[o + 1]), o = a;
	return i;
}
var xs = Ho.default || Ho, Ss = ((e) => (e[e.NONE = 0] = "NONE", e[e.COLOR = 16384] = "COLOR", e[e.STENCIL = 1024] = "STENCIL", e[e.DEPTH = 256] = "DEPTH", e[e.COLOR_DEPTH = 16640] = "COLOR_DEPTH", e[e.COLOR_STENCIL = 17408] = "COLOR_STENCIL", e[e.DEPTH_STENCIL = 1280] = "DEPTH_STENCIL", e[e.ALL = 17664] = "ALL", e))(Ss || {}), Cs = class {
	constructor(e) {
		this.items = [], this._name = e;
	}
	emit(e, t, n, r, i, a, o, s) {
		let { name: c, items: l } = this;
		for (let u = 0, d = l.length; u < d; u++) l[u][c](e, t, n, r, i, a, o, s);
		return this;
	}
	add(e) {
		return e[this._name] && (this.remove(e), this.items.push(e)), this;
	}
	remove(e) {
		let t = this.items.indexOf(e);
		return t !== -1 && this.items.splice(t, 1), this;
	}
	contains(e) {
		return this.items.indexOf(e) !== -1;
	}
	removeAll() {
		return this.items.length = 0, this;
	}
	destroy() {
		this.removeAll(), this.items = null, this._name = null;
	}
	get empty() {
		return this.items.length === 0;
	}
	get name() {
		return this._name;
	}
}, ws = Object.defineProperty, Ts = Object.getOwnPropertySymbols, Es = Object.prototype.hasOwnProperty, Ds = Object.prototype.propertyIsEnumerable, Os = (e, t, n) => t in e ? ws(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, ks = (e, t) => {
	for (var n in t ||= {}) Es.call(t, n) && Os(e, n, t[n]);
	if (Ts) for (var n of Ts(t)) Ds.call(t, n) && Os(e, n, t[n]);
	return e;
}, As = [
	"init",
	"destroy",
	"contextChange",
	"resolutionChange",
	"resetState",
	"renderEnd",
	"renderStart",
	"render",
	"update",
	"postrender",
	"prerender"
], js = class e extends C {
	constructor(e) {
		super(), this.tick = 0, this.uid = H("renderer"), this.runners = Object.create(null), this.renderPipes = Object.create(null), this._initOptions = {}, this._systemsHash = Object.create(null), this.type = e.type, this.name = e.name, this.config = e;
		let t = [...As, ...this.config.runners ?? []];
		this._addRunners(...t), this._unsafeEvalCheck();
	}
	async init(t = {}) {
		await zo(t.skipExtensionImports === !0 || t.manageImports === !1), this._addSystems(this.config.systems), this._addPipes(this.config.renderPipes, this.config.renderPipeAdaptors);
		for (let e in this._systemsHash) {
			let n = this._systemsHash[e].constructor.defaultOptions;
			t = ks(ks({}, n), t);
		}
		t = ks(ks({}, e.defaultOptions), t), this._roundPixels = +!!t.roundPixels;
		for (let e = 0; e < this.runners.init.items.length; e++) await this.runners.init.items[e].init(t);
		this._initOptions = t;
	}
	render(e, t) {
		this.tick++;
		let n = e;
		if (n instanceof Y && (n = { container: n }, t && (n.target = t.renderTexture)), n.target || (n.target = this.view.renderTarget), n.target === this.view.renderTarget && (this._lastObjectRendered = n.container, n.clearColor ?? (n.clearColor = this.background.colorRgba), n.clear ?? (n.clear = this.background.clearBeforeRender)), n.clearColor) {
			let e = Array.isArray(n.clearColor) && n.clearColor.length === 4;
			n.clearColor = e ? n.clearColor : z.shared.setValue(n.clearColor).toArray();
		}
		n.transform || (n.container.updateLocalTransform(), n.transform = n.container.localTransform), n.container.visible && (n.container.enableRenderGroup(), this.runners.prerender.emit(n), this.runners.renderStart.emit(n), this.runners.render.emit(n), this.runners.renderEnd.emit(n), this.runners.postrender.emit(n));
	}
	resize(e, t, n) {
		let r = this.view.resolution;
		this.view.resize(e, t, n), this.emit("resize", this.view.screen.width, this.view.screen.height, this.view.resolution), n !== void 0 && n !== r && this.runners.resolutionChange.emit(n);
	}
	clear(e = {}) {
		let t = this;
		e.target ||= t.renderTarget.renderTarget, e.clearColor ||= this.background.colorRgba, e.clear ??= Ss.ALL;
		let { clear: n, clearColor: r, target: i, mipLevel: a, layer: o } = e;
		z.shared.setValue(r ?? this.background.colorRgba), t.renderTarget.clear(i, n, z.shared.toArray(), a ?? 0, o ?? 0);
	}
	get resolution() {
		return this.view.resolution;
	}
	set resolution(e) {
		this.view.resolution = e, this.runners.resolutionChange.emit(e);
	}
	get width() {
		return this.view.texture.frame.width;
	}
	get height() {
		return this.view.texture.frame.height;
	}
	get canvas() {
		return this.view.canvas;
	}
	get lastObjectRendered() {
		return this._lastObjectRendered;
	}
	get renderingToScreen() {
		return this.renderTarget.renderingToScreen;
	}
	get screen() {
		return this.view.screen;
	}
	_addRunners(...e) {
		e.forEach((e) => {
			this.runners[e] = new Cs(e);
		});
	}
	_addSystems(e) {
		let t;
		for (t in e) {
			let n = e[t];
			this._addSystem(n.value, n.name);
		}
	}
	_addSystem(e, t) {
		let n = new e(this);
		if (this[t]) throw Error(`Whoops! The name "${t}" is already in use`);
		this[t] = n, this._systemsHash[t] = n;
		for (let e in this.runners) this.runners[e].add(n);
		return this;
	}
	_addPipes(e, t) {
		let n = t.reduce((e, t) => (e[t.name] = t.value, e), {});
		e.forEach((e) => {
			let t = e.value, r = e.name, i = n[r];
			this.renderPipes[r] = new t(this, i ? new i() : null), this.runners.destroy.add(this.renderPipes[r]);
		});
	}
	destroy(e = !1) {
		this.runners.destroy.items.reverse(), this.runners.destroy.emit(e), (e === !0 || typeof e == "object" && e.releaseGlobalResources) && je.release(), Object.values(this.runners).forEach((e) => {
			e.destroy();
		}), this._systemsHash = null, this.renderPipes = null, this.removeAllListeners();
	}
	generateTexture(e) {
		return this.textureGenerator.generateTexture(e);
	}
	get roundPixels() {
		return !!this._roundPixels;
	}
	_unsafeEvalCheck() {
		if (!Vo()) throw Error("Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.");
	}
	resetState() {
		this.runners.resetState.emit();
	}
};
js.defaultOptions = {
	resolution: 1,
	failIfMajorPerformanceCaveat: !1,
	roundPixels: !1
};
var Ms = js, Ns;
function Ps(e) {
	return Ns !== void 0 || (Ns = (() => {
		var t;
		let n = {
			stencil: !0,
			failIfMajorPerformanceCaveat: e ?? Ms.defaultOptions.failIfMajorPerformanceCaveat
		};
		try {
			if (!X.get().getWebGLRenderingContext()) return !1;
			let e = X.get().createCanvas().getContext("webgl", n), r = !!((t = e?.getContextAttributes()) != null && t.stencil);
			if (e) {
				let t = e.getExtension("WEBGL_lose_context");
				t && t.loseContext();
			}
			return e = null, r;
		} catch {
			return !1;
		}
	})()), Ns;
}
var Fs;
async function Is(e = {}) {
	return Fs !== void 0 || (Fs = await (async () => {
		let t = X.get().getNavigator().gpu;
		if (!t) return !1;
		try {
			return await (await t.requestAdapter(e)).requestDevice(), !0;
		} catch {
			return !1;
		}
	})()), Fs;
}
var Ls = Object.defineProperty, Rs = Object.getOwnPropertySymbols, zs = Object.prototype.hasOwnProperty, Bs = Object.prototype.propertyIsEnumerable, Vs = (e, t, n) => t in e ? Ls(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Hs = (e, t) => {
	for (var n in t ||= {}) zs.call(t, n) && Vs(e, n, t[n]);
	if (Rs) for (var n of Rs(t)) Bs.call(t, n) && Vs(e, n, t[n]);
	return e;
}, Us = [
	"webgl",
	"webgpu",
	"canvas"
];
async function Ws(e) {
	let t = [];
	e.preference ? Array.isArray(e.preference) ? t = e.preference.slice() : (t.push(e.preference), Us.forEach((n) => {
		n !== e.preference && t.push(n);
	})) : t = Us.slice();
	let n, r = {};
	for (let i = 0; i < t.length; i++) {
		let a = t[i];
		if (a === "webgpu" && await Is()) {
			let { WebGPURenderer: t } = await Promise.resolve().then(function() {
				return iD;
			});
			n = t, r = Hs(Hs({}, e), e.webgpu);
			break;
		}
		if (a === "webgl" && Ps(e.failIfMajorPerformanceCaveat ?? Ms.defaultOptions.failIfMajorPerformanceCaveat)) {
			let { WebGLRenderer: t } = await Promise.resolve().then(function() {
				return VT;
			});
			n = t, r = Hs(Hs({}, e), e.webgl);
			break;
		}
		if (a === "canvas") {
			let { CanvasRenderer: t } = await Promise.resolve().then(function() {
				return aC;
			});
			n = t, r = Hs(Hs({}, e), e.canvasOptions);
			break;
		}
	}
	if (delete r.webgpu, delete r.webgl, delete r.canvasOptions, !n) throw Error("No available renderer for the current environment");
	let i = new n();
	return await i.init(r), i;
}
var Gs = "8.19.0", Ks = class {
	static init() {
		var e;
		(e = globalThis.__PIXI_APP_INIT__) == null || e.call(globalThis, this, "8.19.0");
	}
	static destroy() {}
};
Ks.extension = h.Application;
var qs = class {
	constructor(e) {
		this._renderer = e;
	}
	init() {
		var e;
		(e = globalThis.__PIXI_RENDERER_INIT__) == null || e.call(globalThis, this._renderer, "8.19.0");
	}
	destroy() {
		this._renderer = null;
	}
};
qs.extension = {
	type: [h.WebGLSystem, h.WebGPUSystem],
	name: "initHook",
	priority: -10
};
var Js = class {
	static init(e) {
		Object.defineProperty(this, "resizeTo", {
			configurable: !0,
			set(e) {
				globalThis.removeEventListener("resize", this.queueResize), this._resizeTo = e, e && (globalThis.addEventListener("resize", this.queueResize), this.resize());
			},
			get() {
				return this._resizeTo;
			}
		}), this.queueResize = () => {
			this._resizeTo && (this._cancelResize(), this._resizeId = requestAnimationFrame(() => this.resize()));
		}, this._cancelResize = () => {
			this._resizeId &&= (cancelAnimationFrame(this._resizeId), null);
		}, this.resize = () => {
			if (!this._resizeTo) return;
			this._cancelResize();
			let e, t;
			if (this._resizeTo === globalThis.window) e = globalThis.innerWidth, t = globalThis.innerHeight;
			else {
				let { clientWidth: n, clientHeight: r } = this._resizeTo;
				e = n, t = r;
			}
			this.renderer.resize(e, t), this.render();
		}, this._resizeId = null, this._resizeTo = null, this.resizeTo = e.resizeTo || null;
	}
	static destroy() {
		globalThis.removeEventListener("resize", this.queueResize), this._cancelResize(), this._cancelResize = null, this.queueResize = null, this.resizeTo = null, this.resize = null;
	}
};
Js.extension = h.Application;
var Ys = class {
	static init(e) {
		e = Object.assign({
			autoStart: !0,
			sharedTicker: !1
		}, e), Object.defineProperty(this, "ticker", {
			configurable: !0,
			set(e) {
				this._ticker && this._ticker.remove(this.render, this), this._ticker = e, e && e.add(this.render, this, Sn.LOW);
			},
			get() {
				return this._ticker;
			}
		}), this.stop = () => {
			this._ticker.stop();
		}, this.start = () => {
			this._ticker.start();
		}, this._ticker = null, this.ticker = e.sharedTicker ? Tn.shared : new Tn(), e.autoStart && this.start();
	}
	static destroy() {
		if (this._ticker) {
			let e = this._ticker;
			this.ticker = null, e.destroy();
		}
	}
};
Ys.extension = h.Application, v.add(Js), v.add(Ys);
var Xs = Object.defineProperty, Zs = Object.getOwnPropertySymbols, Qs = Object.prototype.hasOwnProperty, $s = Object.prototype.propertyIsEnumerable, ec = (e, t, n) => t in e ? Xs(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, tc = (e, t) => {
	for (var n in t ||= {}) Qs.call(t, n) && ec(e, n, t[n]);
	if (Zs) for (var n of Zs(t)) $s.call(t, n) && ec(e, n, t[n]);
	return e;
}, nc = class e {
	constructor(...e) {
		this.stage = new Y();
	}
	async init(t) {
		t = tc({}, t), this.stage ||= new Y(), this.renderer = await Ws(t), e._plugins.forEach((e) => {
			e.init.call(this, t);
		});
	}
	render() {
		this.renderer.render({ container: this.stage });
	}
	get canvas() {
		return this.renderer.canvas;
	}
	get view() {
		return this.renderer.canvas;
	}
	get screen() {
		return this.renderer.screen;
	}
	get domContainerRoot() {
		return this.renderer.renderPipes.dom?._domElement;
	}
	destroy(t = !1, n = !1) {
		let r = e._plugins.slice(0);
		r.reverse(), r.forEach((e) => {
			e.destroy.call(this);
		}), this.stage.destroy(n), this.stage = null, this.renderer.destroy(t), this.renderer = null;
	}
};
nc._plugins = [];
var rc = nc;
v.handleByList(h.Application, rc._plugins), v.add(Ks);
var ic = {
	test(e) {
		return typeof e == "string" && e.startsWith("info face=");
	},
	parse(e) {
		let t = e.match(/^[a-z]+\s+.+$/gm), n = {
			info: [],
			common: [],
			page: [],
			char: [],
			chars: [],
			kerning: [],
			kernings: [],
			distanceField: []
		};
		for (let e in t) {
			let r = t[e].match(/^[a-z]+/gm)[0], i = t[e].match(/[a-zA-Z]+=([^\s"']+|"([^"]*)")/gm), a = {};
			for (let e in i) {
				let t = i[e].split("="), n = t[0], r = t[1].replace(/"/gm, ""), o = parseFloat(r);
				a[n] = isNaN(o) ? r : o;
			}
			n[r].push(a);
		}
		let r = {
			chars: {},
			pages: [],
			lineHeight: 0,
			fontSize: 0,
			fontFamily: "",
			distanceField: null,
			baseLineOffset: 0
		}, [i] = n.info, [a] = n.common, [o] = n.distanceField ?? [];
		o && (r.distanceField = {
			range: parseInt(o.distanceRange, 10),
			type: o.fieldType
		}), r.fontSize = parseInt(i.size, 10), r.fontFamily = i.face, r.lineHeight = parseInt(a.lineHeight, 10);
		let s = n.page;
		for (let e = 0; e < s.length; e++) r.pages.push({
			id: parseInt(s[e].id, 10) || 0,
			file: s[e].file
		});
		let c = {};
		r.baseLineOffset = r.lineHeight - parseInt(a.base, 10);
		let l = n.char;
		for (let e = 0; e < l.length; e++) {
			let t = l[e], n = parseInt(t.id, 10), i = t.letter ?? t.char ?? String.fromCharCode(n);
			i === "space" && (i = " "), c[n] = i, r.chars[i] = {
				id: n,
				page: parseInt(t.page, 10) || 0,
				x: parseInt(t.x, 10),
				y: parseInt(t.y, 10),
				width: parseInt(t.width, 10),
				height: parseInt(t.height, 10),
				xOffset: parseInt(t.xoffset, 10),
				yOffset: parseInt(t.yoffset, 10),
				xAdvance: parseInt(t.xadvance, 10),
				kerning: {}
			};
		}
		let u = n.kerning || [];
		for (let e = 0; e < u.length; e++) {
			let t = parseInt(u[e].first, 10), n = parseInt(u[e].second, 10), i = parseInt(u[e].amount, 10);
			r.chars[c[n]] && (r.chars[c[n]].kerning[c[t]] = i);
		}
		return r;
	}
}, ac = {
	test(e) {
		let t = e;
		return typeof t != "string" && "getElementsByTagName" in t && t.getElementsByTagName("page").length && t.getElementsByTagName("info")[0].getAttribute("face") !== null;
	},
	parse(e) {
		let t = {
			chars: {},
			pages: [],
			lineHeight: 0,
			fontSize: 0,
			fontFamily: "",
			distanceField: null,
			baseLineOffset: 0
		}, n = e.getElementsByTagName("info")[0], r = e.getElementsByTagName("common")[0], i = e.getElementsByTagName("distanceField")[0];
		i && (t.distanceField = {
			type: i.getAttribute("fieldType"),
			range: parseInt(i.getAttribute("distanceRange"), 10)
		});
		let a = e.getElementsByTagName("page"), o = e.getElementsByTagName("char"), s = e.getElementsByTagName("kerning");
		t.fontSize = parseInt(n.getAttribute("size"), 10), t.fontFamily = n.getAttribute("face"), t.lineHeight = parseInt(r.getAttribute("lineHeight"), 10);
		for (let e = 0; e < a.length; e++) t.pages.push({
			id: parseInt(a[e].getAttribute("id"), 10) || 0,
			file: a[e].getAttribute("file")
		});
		let c = {};
		t.baseLineOffset = t.lineHeight - parseInt(r.getAttribute("base"), 10);
		for (let e = 0; e < o.length; e++) {
			let n = o[e], r = parseInt(n.getAttribute("id"), 10), i = n.getAttribute("letter") ?? n.getAttribute("char") ?? String.fromCharCode(r);
			i === "space" && (i = " "), c[r] = i, t.chars[i] = {
				id: r,
				page: parseInt(n.getAttribute("page"), 10) || 0,
				x: parseInt(n.getAttribute("x"), 10),
				y: parseInt(n.getAttribute("y"), 10),
				width: parseInt(n.getAttribute("width"), 10),
				height: parseInt(n.getAttribute("height"), 10),
				xOffset: parseInt(n.getAttribute("xoffset"), 10),
				yOffset: parseInt(n.getAttribute("yoffset"), 10),
				xAdvance: parseInt(n.getAttribute("xadvance"), 10),
				kerning: {}
			};
		}
		for (let e = 0; e < s.length; e++) {
			let n = parseInt(s[e].getAttribute("first"), 10), r = parseInt(s[e].getAttribute("second"), 10), i = parseInt(s[e].getAttribute("amount"), 10);
			t.chars[c[r]] && (t.chars[c[r]].kerning[c[n]] = i);
		}
		return t;
	}
}, oc = {
	test(e) {
		return typeof e == "string" && e.match(/<font(\s|>)/) ? ac.test(X.get().parseXML(e)) : !1;
	},
	parse(e) {
		return ac.parse(X.get().parseXML(e));
	}
}, sc = [".xml", ".fnt"], cc = {
	extension: {
		type: h.CacheParser,
		name: "cacheBitmapFont"
	},
	test: (e) => !!(e != null && e.pages) && !!(e != null && e.chars) && typeof e?.fontFamily == "string" && e.fontFamily !== "",
	getCacheableAssets(e, t) {
		let n = {};
		return e.forEach((e) => {
			n[e] = t, n[`${e}-bitmap`] = t;
		}), n[`${t.fontFamily}-bitmap`] = t, n;
	}
}, lc = {
	extension: {
		type: h.LoadParser,
		priority: Ar.Normal
	},
	name: "loadBitmapFont",
	id: "bitmap-font",
	test(e) {
		return sc.includes(Lr.extname(e).toLowerCase());
	},
	async testParse(e) {
		return ic.test(e) || oc.test(e);
	},
	async parse(e, t, n) {
		let r = ic.test(e) ? ic.parse(e) : oc.parse(e), { src: i } = t, { pages: a } = r, o = [], s = r.distanceField ? {
			scaleMode: "linear",
			alphaMode: "premultiply-alpha-on-upload",
			autoGenerateMipmaps: !1,
			resolution: 1
		} : {};
		for (let e = 0; e < a.length; ++e) {
			let t = a[e].file, n = Lr.join(Lr.dirname(i), t);
			n = $r(n, i), o.push({
				src: n,
				data: s
			});
		}
		let [c, { BitmapFont: l }] = await Promise.all([n.load(o), Promise.resolve().then(function() {
			return ik;
		})]);
		return new l({
			data: r,
			textures: o.map((e) => c[e.src])
		}, i);
	},
	async load(e, t) {
		return await (await X.get().fetch(e)).text();
	},
	async unload(e, t, n) {
		await Promise.all(e.pages.map((e) => n.unload(e.texture.source._sourceOrigin))), e.destroy();
	}
}, uc = class {
	constructor(e, t = !1) {
		this._loader = e, this._assetList = [], this._isLoading = !1, this._maxConcurrent = 1, this.verbose = t;
	}
	add(e) {
		e.forEach((e) => {
			this._assetList.push(e);
		}), this.verbose && console.log("[BackgroundLoader] assets: ", this._assetList), this._isActive && !this._isLoading && this._next();
	}
	async _next() {
		if (this._assetList.length && this._isActive) {
			this._isLoading = !0;
			let e = [], t = Math.min(this._assetList.length, this._maxConcurrent);
			for (let n = 0; n < t; n++) e.push(this._assetList.pop());
			await this._loader.load(e), this._isLoading = !1, this._next();
		}
	}
	get active() {
		return this._isActive;
	}
	set active(e) {
		this._isActive !== e && (this._isActive = e, e && !this._isLoading && this._next());
	}
}, dc = {
	extension: {
		type: h.CacheParser,
		name: "cacheTextureArray"
	},
	test: (e) => Array.isArray(e) && e.every((e) => e instanceof J),
	getCacheableAssets: (e, t) => {
		let n = {};
		return e.forEach((e) => {
			t.forEach((t, r) => {
				n[e + (r === 0 ? "" : r + 1)] = t;
			});
		}), n;
	}
};
async function fc(e) {
	if ("Image" in globalThis) return new Promise((t) => {
		let n = new Image();
		n.onload = () => {
			t(!0);
		}, n.onerror = () => {
			t(!1);
		}, n.src = e;
	});
	if ("createImageBitmap" in globalThis && "fetch" in globalThis) {
		try {
			let t = await (await fetch(e)).blob();
			await createImageBitmap(t);
		} catch {
			return !1;
		}
		return !0;
	}
	return !1;
}
var pc = {
	extension: {
		type: h.DetectionParser,
		priority: 1
	},
	test: async () => fc("data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A="),
	add: async (e) => [...e, "avif"],
	remove: async (e) => e.filter((e) => e !== "avif")
}, mc = [
	"png",
	"jpg",
	"jpeg"
], hc = {
	extension: {
		type: h.DetectionParser,
		priority: -1
	},
	test: () => Promise.resolve(!0),
	add: async (e) => [...e, ...mc],
	remove: async (e) => e.filter((e) => !mc.includes(e))
}, gc = "WorkerGlobalScope" in globalThis && globalThis instanceof globalThis.WorkerGlobalScope;
function _c(e) {
	return !gc && document.createElement("video").canPlayType(e) !== "";
}
var vc = {
	extension: {
		type: h.DetectionParser,
		priority: 0
	},
	test: async () => _c("video/mp4"),
	add: async (e) => [
		...e,
		"mp4",
		"m4v"
	],
	remove: async (e) => e.filter((e) => e !== "mp4" && e !== "m4v")
}, yc = {
	extension: {
		type: h.DetectionParser,
		priority: 0
	},
	test: async () => _c("video/ogg"),
	add: async (e) => [...e, "ogv"],
	remove: async (e) => e.filter((e) => e !== "ogv")
}, bc = {
	extension: {
		type: h.DetectionParser,
		priority: 0
	},
	test: async () => _c("video/webm"),
	add: async (e) => [...e, "webm"],
	remove: async (e) => e.filter((e) => e !== "webm")
}, xc = {
	extension: {
		type: h.DetectionParser,
		priority: 0
	},
	test: async () => fc("data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA="),
	add: async (e) => [...e, "webp"],
	remove: async (e) => e.filter((e) => e !== "webp")
}, Sc = Object.defineProperty, Cc = Object.defineProperties, wc = Object.getOwnPropertyDescriptors, Tc = Object.getOwnPropertySymbols, Ec = Object.prototype.hasOwnProperty, Dc = Object.prototype.propertyIsEnumerable, Oc = (e, t, n) => t in e ? Sc(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, kc = (e, t) => {
	for (var n in t ||= {}) Ec.call(t, n) && Oc(e, n, t[n]);
	if (Tc) for (var n of Tc(t)) Dc.call(t, n) && Oc(e, n, t[n]);
	return e;
}, Ac = (e, t) => Cc(e, wc(t)), jc = class e {
	constructor() {
		this.loadOptions = kc({}, e.defaultOptions), this._parsers = [], this._parsersValidated = !1, this.parsers = new Proxy(this._parsers, { set: (e, t, n) => (this._parsersValidated = !1, e[t] = n, !0) }), this.promiseCache = {};
	}
	reset() {
		this._parsersValidated = !1, this.promiseCache = {};
	}
	_getLoadPromiseAndParser(e, t) {
		let n = {
			promise: null,
			parser: null
		};
		return n.promise = (async () => {
			var r;
			let i = null, a = null;
			if ((t.parser || t.loadParser) && (a = this._parserHash[t.parser || t.loadParser]), !a) {
				for (let n = 0; n < this.parsers.length; n++) {
					let i = this.parsers[n];
					if (i.load && (r = i.test) != null && r.call(i, e, t, this)) {
						a = i;
						break;
					}
				}
				if (!a) return null;
			}
			i = await a.load(e, t, this), n.parser = a;
			for (let e = 0; e < this.parsers.length; e++) {
				let r = this.parsers[e];
				r.parse && r.parse && await r.testParse?.call(r, i, t, this) && (i = await r.parse(i, t, this) || i, n.parser = r);
			}
			return i;
		})(), n;
	}
	async load(t, n) {
		this._parsersValidated || this._validateParsers();
		let { onProgress: r, onError: i, strategy: a, retryCount: o, retryDelay: s } = typeof n == "function" ? Ac(kc(kc({}, e.defaultOptions), this.loadOptions), { onProgress: n }) : kc(kc(kc({}, e.defaultOptions), this.loadOptions), n || {}), c = 0, l = {}, u = Vr(t), d = Rr(t, (e) => ({
			alias: [e],
			src: e,
			data: {}
		})), f = d.reduce((e, t) => e + (t.progressSize || 1), 0), p = d.map(async (e) => {
			let t = Lr.toAbsolute(e.src);
			l[e.src] || (await this._loadAssetWithRetry(t, e, {
				onProgress: r,
				onError: i,
				strategy: a,
				retryCount: o,
				retryDelay: s
			}, l), c += e.progressSize || 1, r && r(c / f));
		});
		return await Promise.all(p), u ? l[d[0].src] : l;
	}
	async unload(e) {
		let t = Rr(e, (e) => ({
			alias: [e],
			src: e
		})).map(async (e) => {
			var t;
			let n = Lr.toAbsolute(e.src), r = this.promiseCache[n];
			if (r) {
				let i = await r.promise;
				delete this.promiseCache[n], await ((t = r.parser)?.unload)?.call(t, i, e, this);
			}
		});
		await Promise.all(t);
	}
	_validateParsers() {
		this._parsersValidated = !0, this._parserHash = this._parsers.filter((e) => e.name || e.id).reduce((e, t) => (!t.name && !t.id || e[t.name] || e[t.id], e[t.name] = t, t.id && (e[t.id] = t), e), {});
	}
	async _loadAssetWithRetry(e, t, n, r) {
		let i = 0, { onError: a, strategy: o, retryCount: s, retryDelay: c } = n, l = (e) => new Promise((t) => setTimeout(t, e));
		for (;;) try {
			this.promiseCache[e] || (this.promiseCache[e] = this._getLoadPromiseAndParser(e, t)), r[t.src] = await this.promiseCache[e].promise;
			return;
		} catch (n) {
			if (delete this.promiseCache[e], delete r[t.src], i++, o === "retry" && !(o !== "retry" || i > s)) {
				a && a(n, t), await l(c);
				continue;
			}
			if (o === "skip") {
				a && a(n, t);
				return;
			}
			a && a(n, t);
			let u = /* @__PURE__ */ Error(`[Loader.load] Failed to load ${e}.
${n}`);
			throw n instanceof Error && n.stack && (u.stack = n.stack), u;
		}
	}
};
jc.defaultOptions = {
	onProgress: void 0,
	onError: void 0,
	strategy: "throw",
	retryCount: 3,
	retryDelay: 250
};
var Mc = jc;
function Nc(e, t) {
	if (Array.isArray(t)) {
		for (let n of t) if (e.startsWith(`data:${n}`)) return !0;
		return !1;
	}
	return e.startsWith(`data:${t}`);
}
function Pc(e, t) {
	let n = e.split("?")[0], r = Lr.extname(n).toLowerCase();
	return Array.isArray(t) ? t.includes(r) : r === t;
}
var Fc = ".json", Ic = "application/json", Lc = {
	extension: {
		type: h.LoadParser,
		priority: Ar.Low
	},
	name: "loadJson",
	id: "json",
	test(e) {
		return Nc(e, Ic) || Pc(e, Fc);
	},
	async load(e) {
		return await (await X.get().fetch(e)).json();
	}
}, Rc = ".txt", zc = "text/plain", Bc = {
	name: "loadTxt",
	id: "text",
	extension: {
		type: h.LoadParser,
		priority: Ar.Low,
		name: "loadTxt"
	},
	test(e) {
		return Nc(e, zc) || Pc(e, Rc);
	},
	async load(e) {
		return await (await X.get().fetch(e)).text();
	}
}, Vc = Object.defineProperty, Hc = Object.defineProperties, Uc = Object.getOwnPropertyDescriptors, Wc = Object.getOwnPropertySymbols, Gc = Object.prototype.hasOwnProperty, Kc = Object.prototype.propertyIsEnumerable, qc = (e, t, n) => t in e ? Vc(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Jc = (e, t) => {
	for (var n in t ||= {}) Gc.call(t, n) && qc(e, n, t[n]);
	if (Wc) for (var n of Wc(t)) Kc.call(t, n) && qc(e, n, t[n]);
	return e;
}, Yc = (e, t) => Hc(e, Uc(t)), Xc = [
	"normal",
	"bold",
	"100",
	"200",
	"300",
	"400",
	"500",
	"600",
	"700",
	"800",
	"900"
], Zc = [
	".ttf",
	".otf",
	".woff",
	".woff2"
], Qc = [
	"font/ttf",
	"font/otf",
	"font/woff",
	"font/woff2"
], $c = /^(--|-?[A-Z_])[0-9A-Z_-]*$/i;
function el(e) {
	let t = Lr.extname(e), n = Lr.basename(e, t).replace(/(-|_)/g, " ").toLowerCase().split(" ").map((e) => e.charAt(0).toUpperCase() + e.slice(1)), r = n.length > 0;
	for (let e of n) if (!e.match($c)) {
		r = !1;
		break;
	}
	let i = n.join(" ");
	return r || (i = `"${i.replace(/[\\"]/g, "\\$&")}"`), i;
}
var tl = /^[0-9A-Za-z%:/?#\[\]@!\$&'()\*\+,;=\-._~]*$/;
function nl(e) {
	return tl.test(e) ? e : encodeURI(e);
}
var rl = {
	extension: {
		type: h.LoadParser,
		priority: Ar.Low
	},
	name: "loadWebFont",
	id: "web-font",
	test(e) {
		return Nc(e, Qc) || Pc(e, Zc);
	},
	async load(e, t) {
		let n = X.get().getFontFaceSet();
		if (n) {
			let r = [], i = t.data?.family ?? el(e), a = (t.data?.weights)?.filter((e) => Xc.includes(e)) ?? ["normal"], o = t.data ?? {};
			for (let t = 0; t < a.length; t++) {
				let s = a[t], c = new FontFace(i, `url('${nl(e)}')`, Yc(Jc({}, o), { weight: s }));
				await c.load(), n.add(c), r.push(c);
			}
			return Ii.has(`${i}-and-url`) ? Ii.get(`${i}-and-url`).entries.push({
				url: e,
				faces: r
			}) : Ii.set(`${i}-and-url`, { entries: [{
				url: e,
				faces: r
			}] }), r.length === 1 ? r[0] : r;
		}
		return null;
	},
	unload(e) {
		let t = Array.isArray(e) ? e : [e], n = t[0].family, r = Ii.get(`${n}-and-url`), i = r.entries.find((e) => e.faces.some((e) => t.indexOf(e) !== -1));
		i.faces = i.faces.filter((e) => t.indexOf(e) === -1), i.faces.length === 0 && (r.entries = r.entries.filter((e) => e !== i)), t.forEach((e) => {
			X.get().getFontFaceSet().delete(e);
		}), r.entries.length === 0 && Ii.remove(`${n}-and-url`);
	}
}, il = {
	a: 7,
	c: 6,
	h: 1,
	l: 2,
	m: 2,
	q: 4,
	s: 4,
	t: 2,
	v: 1,
	z: 0
}, al = /([astvzqmhlc])([^astvzqmhlc]*)/gi, ol = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi;
function sl(e) {
	let t = [];
	return e.replace(al, (e, n, r) => {
		let i = n.toLowerCase(), a = n, o = cl(r);
		for (i === "m" && o.length > 2 && (t.push([a, ...o.splice(0, 2)]), i = "l", a = a === "m" ? "l" : "L");;) {
			if (o.length === il[i]) return t.push([a, ...o]), "";
			if (o.length < il[i]) throw Error("malformed path data");
			t.push([a, ...o.splice(0, il[i])]);
		}
	}), t;
}
function cl(e) {
	let t = e.match(ol);
	return t ? t.map(Number) : [];
}
function ll(e, t) {
	let n = sl(e), r = [], i = null, a = 0, o = 0;
	for (let e = 0; e < n.length; e++) {
		let s = n[e], c = s[0], l = s;
		switch (c) {
			case "M":
				a = l[1], o = l[2], t.moveTo(a, o);
				break;
			case "m":
				a += l[1], o += l[2], t.moveTo(a, o);
				break;
			case "H":
				a = l[1], t.lineTo(a, o);
				break;
			case "h":
				a += l[1], t.lineTo(a, o);
				break;
			case "V":
				o = l[1], t.lineTo(a, o);
				break;
			case "v":
				o += l[1], t.lineTo(a, o);
				break;
			case "L":
				a = l[1], o = l[2], t.lineTo(a, o);
				break;
			case "l":
				a += l[1], o += l[2], t.lineTo(a, o);
				break;
			case "C":
				a = l[5], o = l[6], t.bezierCurveTo(l[1], l[2], l[3], l[4], a, o);
				break;
			case "c":
				t.bezierCurveTo(a + l[1], o + l[2], a + l[3], o + l[4], a + l[5], o + l[6]), a += l[5], o += l[6];
				break;
			case "S":
				a = l[3], o = l[4], t.bezierCurveToShort(l[1], l[2], a, o);
				break;
			case "s":
				t.bezierCurveToShort(a + l[1], o + l[2], a + l[3], o + l[4]), a += l[3], o += l[4];
				break;
			case "Q":
				a = l[3], o = l[4], t.quadraticCurveTo(l[1], l[2], a, o);
				break;
			case "q":
				t.quadraticCurveTo(a + l[1], o + l[2], a + l[3], o + l[4]), a += l[3], o += l[4];
				break;
			case "T":
				a = l[1], o = l[2], t.quadraticCurveToShort(a, o);
				break;
			case "t":
				a += l[1], o += l[2], t.quadraticCurveToShort(a, o);
				break;
			case "A":
				a = l[6], o = l[7], t.arcToSvg(l[1], l[2], l[3], l[4], l[5], a, o);
				break;
			case "a":
				a += l[6], o += l[7], t.arcToSvg(l[1], l[2], l[3], l[4], l[5], a, o);
				break;
			case "Z":
			case "z": t.closePath(), r.length > 0 && (i = r.pop(), i ? (a = i.startX, o = i.startY) : (a = 0, o = 0)), i = null;
		}
		c !== "Z" && c !== "z" && i === null && (i = {
			startX: a,
			startY: o
		}, r.push(i));
	}
	return t;
}
var ul = {};
function dl(e, t, n) {
	let r = 2166136261;
	for (let n = 0; n < t; n++) r ^= e[n].uid, r = Math.imul(r, 16777619), r >>>= 0;
	return ul[r] || fl(e, t, r, n);
}
function fl(e, t, n, r) {
	let i = {}, a = 0;
	for (let n = 0; n < r; n++) {
		let r = n < t ? e[n] : J.EMPTY.source;
		i[a++] = r.source, i[a++] = r.style;
	}
	let o = new Ka(i);
	return ul[n] = o, o;
}
var pl = class {
	constructor(e) {
		this.rawBinaryData = typeof e == "number" ? new ArrayBuffer(e) : e instanceof Uint8Array ? e.buffer : e, this.uint32View = new Uint32Array(this.rawBinaryData), this.float32View = new Float32Array(this.rawBinaryData), this.size = this.rawBinaryData.byteLength;
	}
	get int8View() {
		return this._int8View ||= new Int8Array(this.rawBinaryData), this._int8View;
	}
	get uint8View() {
		return this._uint8View ||= new Uint8Array(this.rawBinaryData), this._uint8View;
	}
	get int16View() {
		return this._int16View ||= new Int16Array(this.rawBinaryData), this._int16View;
	}
	get int32View() {
		return this._int32View ||= new Int32Array(this.rawBinaryData), this._int32View;
	}
	get float64View() {
		return this._float64Array ||= new Float64Array(this.rawBinaryData), this._float64Array;
	}
	get bigUint64View() {
		return this._bigUint64Array ||= new BigUint64Array(this.rawBinaryData), this._bigUint64Array;
	}
	view(e) {
		return this[`${e}View`];
	}
	destroy() {
		this.rawBinaryData = null, this.uint32View = null, this.float32View = null, this.uint16View = null, this._int8View = null, this._uint8View = null, this._int16View = null, this._int32View = null, this._float64Array = null, this._bigUint64Array = null;
	}
	static sizeOf(e) {
		switch (e) {
			case "int8":
			case "uint8": return 1;
			case "int16":
			case "uint16": return 2;
			case "int32":
			case "uint32":
			case "float32": return 4;
			default: throw Error(`${e} isn't a valid view type`);
		}
	}
}, ml = /* @__PURE__ */ new Set(), hl = "8.0.0", gl = {
	quiet: !1,
	noColor: !1
}, _l = ((e, t, n = 3) => {
	if (gl.quiet || ml.has(t)) return;
	let r = (/* @__PURE__ */ Error()).stack, i = `${t}
Deprecated since v${e}`, a = typeof console.groupCollapsed == "function" && !gl.noColor;
	r === void 0 ? console.warn("PixiJS Deprecation Warning: ", i) : (r = r.split("\n").splice(n).join("\n"), a ? (console.groupCollapsed("%cPixiJS Deprecation Warning: %c%s", "color:#614108;background:#fffbe6", "font-weight:normal;color:#614108;background:#fffbe6", i), console.warn(r), console.groupEnd()) : (console.warn("PixiJS Deprecation Warning: ", i), console.warn(r))), ml.add(t);
});
Object.defineProperties(_l, {
	quiet: {
		get: () => gl.quiet,
		set: (e) => {
			gl.quiet = e;
		},
		enumerable: !0,
		configurable: !1
	},
	noColor: {
		get: () => gl.noColor,
		set: (e) => {
			gl.noColor = e;
		},
		enumerable: !0,
		configurable: !1
	}
});
function vl(e, t, n, r) {
	if (n ??= 0, r ??= Math.min(e.byteLength - n, t.byteLength), !(n & 7) && !(r & 7)) {
		let i = r / 8;
		new Float64Array(t, 0, i).set(new Float64Array(e, n, i));
	} else if (!(n & 3) && !(r & 3)) {
		let i = r / 4;
		new Float32Array(t, 0, i).set(new Float32Array(e, n, i));
	} else new Uint8Array(t).set(new Uint8Array(e, n, r));
}
var yl = {
	normal: "normal-npm",
	add: "add-npm",
	screen: "screen-npm"
}, bl = ((e) => (e[e.DISABLED = 0] = "DISABLED", e[e.RENDERING_MASK_ADD = 1] = "RENDERING_MASK_ADD", e[e.MASK_ACTIVE = 2] = "MASK_ACTIVE", e[e.INVERSE_MASK_ACTIVE = 3] = "INVERSE_MASK_ACTIVE", e[e.RENDERING_MASK_REMOVE = 4] = "RENDERING_MASK_REMOVE", e[e.NONE = 5] = "NONE", e))(bl || {});
function xl(e, t) {
	return t.alphaMode === "no-premultiply-alpha" && yl[e] || e;
}
var Sl = [
	"precision mediump float;",
	"void main(void){",
	"float test = 0.1;",
	"%forloop%",
	"gl_FragColor = vec4(0.0);",
	"}"
].join("\n");
function Cl(e) {
	let t = "";
	for (let n = 0; n < e; ++n) n > 0 && (t += "\nelse "), n < e - 1 && (t += `if(test == ${n}.0){}`);
	return t;
}
function wl(e, t) {
	if (e === 0) throw Error("Invalid value of `0` passed to `checkMaxIfStatementsInShader`");
	let n = t.createShader(t.FRAGMENT_SHADER);
	try {
		for (;;) {
			let r = Sl.replace(/%forloop%/gi, Cl(e));
			if (t.shaderSource(n, r), t.compileShader(n), !t.getShaderParameter(n, t.COMPILE_STATUS)) e = e / 2 | 0;
			else break;
		}
	} finally {
		t.deleteShader(n);
	}
	return e;
}
var Tl = null;
function El() {
	var e;
	if (Tl) return Tl;
	let t = fa();
	return Tl = t.getParameter(t.MAX_TEXTURE_IMAGE_UNITS), Tl = wl(Tl, t), (e = t.getExtension("WEBGL_lose_context")) == null || e.loseContext(), Tl;
}
var Dl = class {
	constructor() {
		this.ids = Object.create(null), this.textures = [], this.count = 0;
	}
	clear() {
		for (let e = 0; e < this.count; e++) {
			let t = this.textures[e];
			this.textures[e] = null, this.ids[t.uid] = null;
		}
		this.count = 0;
	}
}, Ol = Object.defineProperty, kl = Object.getOwnPropertySymbols, Al = Object.prototype.hasOwnProperty, jl = Object.prototype.propertyIsEnumerable, Ml = (e, t, n) => t in e ? Ol(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Nl = (e, t) => {
	for (var n in t ||= {}) Al.call(t, n) && Ml(e, n, t[n]);
	if (kl) for (var n of kl(t)) jl.call(t, n) && Ml(e, n, t[n]);
	return e;
}, Pl = class {
	constructor() {
		this.renderPipeId = "batch", this.action = "startBatch", this.start = 0, this.size = 0, this.textures = new Dl(), this.blendMode = "normal", this.topology = "triangle-strip", this.canBundle = !0;
	}
	destroy() {
		this.textures = null, this.gpuBindGroup = null, this.bindGroup = null, this.batcher = null, this.elements = null;
	}
}, Fl = [], Il = 0;
je.register({ clear: () => {
	if (Fl.length > 0) for (let e of Fl) e && e.destroy();
	Fl.length = 0, Il = 0;
} });
function Ll() {
	return Il > 0 ? Fl[--Il] : new Pl();
}
function Rl(e) {
	e.elements = null, Fl[Il++] = e;
}
var zl = 0, Bl = class e {
	constructor(t) {
		this.uid = H("batcher"), this.dirty = !0, this.batchIndex = 0, this.batches = [], this._elements = [], t = Nl(Nl({}, e.defaultOptions), t), t.maxTextures || (_l("v8.8.0", "maxTextures is a required option for Batcher now, please pass it in the options"), t.maxTextures = El());
		let { maxTextures: n, attributesInitialSize: r, indicesInitialSize: i } = t;
		this.attributeBuffer = new pl(r * 4), this.indexBuffer = new Uint16Array(i), this.maxTextures = n;
	}
	begin() {
		this.elementSize = 0, this.elementStart = 0, this.indexSize = 0, this.attributeSize = 0;
		for (let e = 0; e < this.batchIndex; e++) Rl(this.batches[e]);
		this.batchIndex = 0, this._batchIndexStart = 0, this._batchIndexSize = 0, this.dirty = !0;
	}
	add(e) {
		this._elements[this.elementSize++] = e, e._indexStart = this.indexSize, e._attributeStart = this.attributeSize, e._batcher = this, this.indexSize += e.indexSize, this.attributeSize += e.attributeSize * this.vertexSize;
	}
	checkAndUpdateTexture(e, t) {
		let n = e._batch.textures.ids[t._source.uid];
		return !n && n !== 0 ? !1 : (e._textureId = n, e.texture = t, !0);
	}
	updateElement(e) {
		this.dirty = !0;
		let t = this.attributeBuffer;
		e.packAsQuad ? this.packQuadAttributes(e, t.float32View, t.uint32View, e._attributeStart, e._textureId) : this.packAttributes(e, t.float32View, t.uint32View, e._attributeStart, e._textureId);
	}
	break(e) {
		let t = this._elements;
		if (!t[this.elementStart]) return;
		let n = Ll(), r = n.textures;
		r.clear();
		let i = t[this.elementStart], a = xl(i.blendMode, i.texture._source), o = i.topology;
		this.attributeSize * 4 > this.attributeBuffer.size && this._resizeAttributeBuffer(this.attributeSize * 4), this.indexSize > this.indexBuffer.length && this._resizeIndexBuffer(this.indexSize);
		let s = this.attributeBuffer.float32View, c = this.attributeBuffer.uint32View, l = this.indexBuffer, u = this._batchIndexSize, d = this._batchIndexStart, f = "startBatch", p = [], m = this.maxTextures;
		for (let i = this.elementStart; i < this.elementSize; ++i) {
			let h = t[i];
			t[i] = null;
			let g = h.texture._source, _ = xl(h.blendMode, g), v = a !== _ || o !== h.topology;
			if (g._batchTick === zl && !v) {
				h._textureId = g._textureBindLocation, u += h.indexSize, h.packAsQuad ? (this.packQuadAttributes(h, s, c, h._attributeStart, h._textureId), this.packQuadIndex(l, h._indexStart, h._attributeStart / this.vertexSize)) : (this.packAttributes(h, s, c, h._attributeStart, h._textureId), this.packIndex(h, l, h._indexStart, h._attributeStart / this.vertexSize)), h._batch = n, p.push(h);
				continue;
			}
			g._batchTick = zl, (r.count >= m || v) && (this._finishBatch(n, d, u - d, r, a, o, e, f, p), f = "renderBatch", d = u, a = _, o = h.topology, n = Ll(), r = n.textures, r.clear(), p = [], ++zl), h._textureId = g._textureBindLocation = r.count, r.ids[g.uid] = r.count, r.textures[r.count++] = g, h._batch = n, p.push(h), u += h.indexSize, h.packAsQuad ? (this.packQuadAttributes(h, s, c, h._attributeStart, h._textureId), this.packQuadIndex(l, h._indexStart, h._attributeStart / this.vertexSize)) : (this.packAttributes(h, s, c, h._attributeStart, h._textureId), this.packIndex(h, l, h._indexStart, h._attributeStart / this.vertexSize));
		}
		r.count > 0 && (this._finishBatch(n, d, u - d, r, a, o, e, f, p), d = u, ++zl), this.elementStart = this.elementSize, this._batchIndexStart = d, this._batchIndexSize = u;
	}
	_finishBatch(e, t, n, r, i, a, o, s, c) {
		e.gpuBindGroup = null, e.bindGroup = null, e.action = s, e.batcher = this, e.textures = r, e.blendMode = i, e.topology = a, e.start = t, e.size = n, e.elements = c, ++zl, this.batches[this.batchIndex++] = e, o.add(e);
	}
	finish(e) {
		this.break(e);
	}
	ensureAttributeBuffer(e) {
		e * 4 <= this.attributeBuffer.size || this._resizeAttributeBuffer(e * 4);
	}
	ensureIndexBuffer(e) {
		e <= this.indexBuffer.length || this._resizeIndexBuffer(e);
	}
	_resizeAttributeBuffer(e) {
		let t = new pl(Math.max(e, this.attributeBuffer.size * 2));
		vl(this.attributeBuffer.rawBinaryData, t.rawBinaryData), this.attributeBuffer = t;
	}
	_resizeIndexBuffer(e) {
		let t = this.indexBuffer, n = Math.max(e, t.length * 1.5);
		n += n % 2;
		let r = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
		if (r.BYTES_PER_ELEMENT !== t.BYTES_PER_ELEMENT) for (let e = 0; e < t.length; e++) r[e] = t[e];
		else vl(t.buffer, r.buffer);
		this.indexBuffer = r;
	}
	packQuadIndex(e, t, n) {
		e[t] = n + 0, e[t + 1] = n + 1, e[t + 2] = n + 2, e[t + 3] = n + 0, e[t + 4] = n + 2, e[t + 5] = n + 3;
	}
	packIndex(e, t, n, r) {
		let i = e.indices, a = e.indexSize, o = e.indexOffset, s = e.attributeOffset;
		for (let e = 0; e < a; e++) t[n++] = r + i[e + o] - s;
	}
	destroy(e = {}) {
		var t;
		if (this.batches !== null) {
			for (let e = 0; e < this.batchIndex; e++) Rl(this.batches[e]);
			this.batches = null, this.geometry.destroy(!0), this.geometry = null, e.shader && ((t = this.shader) == null || t.destroy(), this.shader = null);
			for (let e = 0; e < this._elements.length; e++) this._elements[e] && (this._elements[e]._batch = null);
			this._elements = null, this.indexBuffer = null, this.attributeBuffer.destroy(), this.attributeBuffer = null;
		}
	}
};
Bl.defaultOptions = {
	maxTextures: null,
	attributesInitialSize: 4,
	indicesInitialSize: 6
};
var Vl = Bl, Hl = /* @__PURE__ */ new Float32Array(1), Ul = /* @__PURE__ */ new Uint32Array(1), Wl = class extends Po {
	constructor() {
		let e = new Ao({
			data: Hl,
			label: "attribute-batch-buffer",
			usage: Q.VERTEX | Q.COPY_DST,
			shrinkToFit: !1
		}), t = new Ao({
			data: Ul,
			label: "index-batch-buffer",
			usage: Q.INDEX | Q.COPY_DST,
			shrinkToFit: !1
		});
		super({
			attributes: {
				aPosition: {
					buffer: e,
					format: "float32x2",
					stride: 24,
					offset: 0
				},
				aUV: {
					buffer: e,
					format: "float32x2",
					stride: 24,
					offset: 8
				},
				aColor: {
					buffer: e,
					format: "unorm8x4",
					stride: 24,
					offset: 16
				},
				aTextureIdAndRound: {
					buffer: e,
					format: "uint16x2",
					stride: 24,
					offset: 20
				}
			},
			indexBuffer: t
		});
	}
};
function Gl(e, t, n) {
	if (e) for (let r in e) {
		let i = t[r.toLocaleLowerCase()];
		if (i) {
			let t = e[r];
			r === "header" && (t = t.replace(/@in\s+[^;]+;\s*/g, "").replace(/@out\s+[^;]+;\s*/g, "")), n && i.push(`//----${n}----//`), i.push(t);
		}
	}
}
var Kl = /\{\{(.*?)\}\}/g;
function ql(e) {
	let t = {};
	return (e.match(Kl)?.map((e) => e.replace(/[{()}]/g, "")) ?? []).forEach((e) => {
		t[e] = [];
	}), t;
}
function Jl(e, t) {
	let n, r = /@in\s+([^;]+);/g;
	for (; (n = r.exec(e)) !== null;) t.push(n[1]);
}
function Yl(e, t, n = !1) {
	let r = [];
	Jl(t, r), e.forEach((e) => {
		e.header && Jl(e.header, r);
	});
	let i = r;
	n && i.sort();
	let a = i.map((e, t) => `       @location(${t}) ${e},`).join("\n"), o = t.replace(/@in\s+[^;]+;\s*/g, "");
	return o = o.replace("{{in}}", `
${a}
`), o;
}
function Xl(e, t) {
	let n, r = /@out\s+([^;]+);/g;
	for (; (n = r.exec(e)) !== null;) t.push(n[1]);
}
function Zl(e) {
	let t = /\b(\w+)\s*:/g.exec(e);
	return t ? t[1] : "";
}
function Ql(e) {
	return e.replace(/@.*?\s+/g, "");
}
function $l(e, t) {
	let n = [];
	Xl(t, n), e.forEach((e) => {
		e.header && Xl(e.header, n);
	});
	let r = 0, i = n.sort().map((e) => e.indexOf("builtin") > -1 ? e : `@location(${r++}) ${e}`).join(",\n"), a = n.sort().map((e) => `       var ${Ql(e)};`).join("\n"), o = `return VSOutput(
            ${n.sort().map((e) => ` ${Zl(e)}`).join(",\n")});`, s = t.replace(/@out\s+[^;]+;\s*/g, "");
	return s = s.replace("{{struct}}", `
${i}
`), s = s.replace("{{start}}", `
${a}
`), s = s.replace("{{return}}", `
${o}
`), s;
}
function eu(e, t) {
	let n = e;
	for (let e in t) {
		let r = t[e];
		n = r.join("\n").length ? n.replace(`{{${e}}}`, `//-----${e} START-----//
${r.join("\n")}
//----${e} FINISH----//`) : n.replace(`{{${e}}}`, "");
	}
	return n;
}
var tu = Object.create(null), nu = /* @__PURE__ */ new Map(), ru = 0;
function iu({ template: e, bits: t }) {
	let n = su(e, t);
	if (tu[n]) return tu[n];
	let { vertex: r, fragment: i } = ou(e, t);
	return tu[n] = cu(r, i, t), tu[n];
}
function au({ template: e, bits: t }) {
	let n = su(e, t);
	return tu[n] || (tu[n] = cu(e.vertex, e.fragment, t)), tu[n];
}
function ou(e, t) {
	let n = t.map((e) => e.vertex).filter((e) => !!e), r = t.map((e) => e.fragment).filter((e) => !!e), i = Yl(n, e.vertex, !0);
	i = $l(n, i);
	let a = Yl(r, e.fragment, !0);
	return {
		vertex: i,
		fragment: a
	};
}
function su(e, t) {
	return t.map((e) => (nu.has(e) || nu.set(e, ru++), nu.get(e))).sort((e, t) => e - t).join("-") + e.vertex + e.fragment;
}
function cu(e, t, n) {
	let r = ql(e), i = ql(t);
	return n.forEach((e) => {
		Gl(e.vertex, r, e.name), Gl(e.fragment, i, e.name);
	}), {
		vertex: eu(e, r),
		fragment: eu(t, i)
	};
}
var lu = "\n    @in aPosition: vec2<f32>;\n    @in aUV: vec2<f32>;\n\n    @out @builtin(position) vPosition: vec4<f32>;\n    @out vUV : vec2<f32>;\n    @out vColor : vec4<f32>;\n\n    {{header}}\n\n    struct VSOutput {\n        {{struct}}\n    };\n\n    @vertex\n    fn main( {{in}} ) -> VSOutput {\n\n        var worldTransformMatrix = globalUniforms.uWorldTransformMatrix;\n        var modelMatrix = mat3x3<f32>(\n            1.0, 0.0, 0.0,\n            0.0, 1.0, 0.0,\n            0.0, 0.0, 1.0\n          );\n        var position = aPosition;\n        var uv = aUV;\n\n        {{start}}\n\n        vColor = vec4<f32>(1., 1., 1., 1.);\n\n        {{main}}\n\n        vUV = uv;\n\n        var modelViewProjectionMatrix = globalUniforms.uProjectionMatrix * worldTransformMatrix * modelMatrix;\n\n        vPosition =  vec4<f32>((modelViewProjectionMatrix *  vec3<f32>(position, 1.0)).xy, 0.0, 1.0);\n\n        vColor *= globalUniforms.uWorldColorAlpha;\n\n        {{end}}\n\n        {{return}}\n    };\n", uu = "\n    @in vUV : vec2<f32>;\n    @in vColor : vec4<f32>;\n\n    {{header}}\n\n    @fragment\n    fn main(\n        {{in}}\n      ) -> @location(0) vec4<f32> {\n\n        {{start}}\n\n        var outColor:vec4<f32>;\n\n        {{main}}\n\n        var finalColor:vec4<f32> = outColor * vColor;\n\n        {{end}}\n\n        return finalColor;\n      };\n", du = "\n    in vec2 aPosition;\n    in vec2 aUV;\n\n    out vec4 vColor;\n    out vec2 vUV;\n\n    {{header}}\n\n    void main(void){\n\n        mat3 worldTransformMatrix = uWorldTransformMatrix;\n        mat3 modelMatrix = mat3(\n            1.0, 0.0, 0.0,\n            0.0, 1.0, 0.0,\n            0.0, 0.0, 1.0\n          );\n        vec2 position = aPosition;\n        vec2 uv = aUV;\n\n        {{start}}\n\n        vColor = vec4(1.);\n\n        {{main}}\n\n        vUV = uv;\n\n        mat3 modelViewProjectionMatrix = uProjectionMatrix * worldTransformMatrix * modelMatrix;\n\n        gl_Position = vec4((modelViewProjectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);\n\n        vColor *= uWorldColorAlpha;\n\n        {{end}}\n    }\n", fu = "\n\n    in vec4 vColor;\n    in vec2 vUV;\n\n    out vec4 finalColor;\n\n    {{header}}\n\n    void main(void) {\n\n        {{start}}\n\n        vec4 outColor;\n\n        {{main}}\n\n        finalColor = outColor * vColor;\n\n        {{end}}\n    }\n", pu = {
	name: "global-uniforms-bit",
	vertex: { header: "\n        struct GlobalUniforms {\n            uProjectionMatrix:mat3x3<f32>,\n            uWorldTransformMatrix:mat3x3<f32>,\n            uWorldColorAlpha: vec4<f32>,\n            uResolution: vec2<f32>,\n        }\n\n        @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;\n        " }
}, mu = {
	name: "global-uniforms-bit",
	vertex: { header: "\n          uniform mat3 uProjectionMatrix;\n          uniform mat3 uWorldTransformMatrix;\n          uniform vec4 uWorldColorAlpha;\n          uniform vec2 uResolution;\n        " }
}, hu = Object.defineProperty, gu = Object.getOwnPropertySymbols, _u = Object.prototype.hasOwnProperty, vu = Object.prototype.propertyIsEnumerable, yu = (e, t, n) => t in e ? hu(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, bu = (e, t) => {
	for (var n in t ||= {}) _u.call(t, n) && yu(e, n, t[n]);
	if (gu) for (var n of gu(t)) vu.call(t, n) && yu(e, n, t[n]);
	return e;
};
function xu({ bits: e, name: t }) {
	let n = iu({
		template: {
			fragment: uu,
			vertex: lu
		},
		bits: [pu, ...e]
	});
	return Ga.from({
		name: t,
		vertex: {
			source: n.vertex,
			entryPoint: "main"
		},
		fragment: {
			source: n.fragment,
			entryPoint: "main"
		}
	});
}
function Su({ bits: e, name: t }) {
	return new ja(bu({ name: t }, au({
		template: {
			vertex: du,
			fragment: fu
		},
		bits: [mu, ...e]
	})));
}
var Cu = {
	name: "color-bit",
	vertex: {
		header: "\n            @in aColor: vec4<f32>;\n        ",
		main: "\n            vColor *= vec4<f32>(aColor.rgb * aColor.a, aColor.a);\n        "
	}
}, wu = {
	name: "color-bit",
	vertex: {
		header: "\n            in vec4 aColor;\n        ",
		main: "\n            vColor *= vec4(aColor.rgb * aColor.a, aColor.a);\n        "
	}
}, Tu = {};
function Eu(e) {
	let t = [];
	if (e === 1) t.push("@group(1) @binding(0) var textureSource1: texture_2d<f32>;"), t.push("@group(1) @binding(1) var textureSampler1: sampler;");
	else {
		let n = 0;
		for (let r = 0; r < e; r++) t.push(`@group(1) @binding(${n++}) var textureSource${r + 1}: texture_2d<f32>;`), t.push(`@group(1) @binding(${n++}) var textureSampler${r + 1}: sampler;`);
	}
	return t.join("\n");
}
function Du(e) {
	let t = [];
	if (e === 1) t.push("outColor = textureSampleGrad(textureSource1, textureSampler1, vUV, uvDx, uvDy);");
	else {
		t.push("switch vTextureId {");
		for (let n = 0; n < e; n++) n === e - 1 ? t.push("  default:{") : t.push(`  case ${n}:{`), t.push(`      outColor = textureSampleGrad(textureSource${n + 1}, textureSampler${n + 1}, vUV, uvDx, uvDy);`), t.push("      break;}");
		t.push("}");
	}
	return t.join("\n");
}
function Ou(e) {
	return Tu[e] || (Tu[e] = {
		name: "texture-batch-bit",
		vertex: {
			header: "\n                @in aTextureIdAndRound: vec2<u32>;\n                @out @interpolate(flat) vTextureId : u32;\n            ",
			main: "\n                vTextureId = aTextureIdAndRound.y;\n            ",
			end: "\n                if(aTextureIdAndRound.x == 1)\n                {\n                    vPosition = vec4<f32>(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);\n                }\n            "
		},
		fragment: {
			header: `
                @in @interpolate(flat) vTextureId: u32;

                ${Eu(e)}
            `,
			main: `
                var uvDx = dpdx(vUV);
                var uvDy = dpdy(vUV);

                ${Du(e)}
            `
		}
	}), Tu[e];
}
var ku = {};
function Au(e) {
	let t = [];
	for (let n = 0; n < e; n++) n > 0 && t.push("else"), n < e - 1 && t.push(`if(vTextureId < ${n}.5)`), t.push("{"), t.push(`	outColor = texture(uTextures[${n}], vUV);`), t.push("}");
	return t.join("\n");
}
function ju(e) {
	return ku[e] || (ku[e] = {
		name: "texture-batch-bit",
		vertex: {
			header: "\n                in vec2 aTextureIdAndRound;\n                out float vTextureId;\n\n            ",
			main: "\n                vTextureId = aTextureIdAndRound.y;\n            ",
			end: "\n                if(aTextureIdAndRound.x == 1.)\n                {\n                    gl_Position.xy = roundPixels(gl_Position.xy, uResolution);\n                }\n            "
		},
		fragment: {
			header: `
                in float vTextureId;

                uniform sampler2D uTextures[${e}];

            `,
			main: `

                ${Au(e)}
            `
		}
	}), ku[e];
}
var Mu = {
	name: "round-pixels-bit",
	vertex: { header: "\n            fn roundPixels(position: vec2<f32>, targetSize: vec2<f32>) -> vec2<f32>\n            {\n                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;\n            }\n        " }
}, Nu = {
	name: "round-pixels-bit",
	vertex: { header: "\n            vec2 roundPixels(vec2 position, vec2 targetSize)\n            {\n                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;\n            }\n        " }
}, Pu = {};
function Fu(e) {
	let t = Pu[e];
	if (t) return t;
	let n = new Int32Array(e);
	for (let t = 0; t < e; t++) n[t] = t;
	return t = Pu[e] = new io({ uTextures: {
		value: n,
		type: "i32",
		size: e
	} }, { isStatic: !0 }), t;
}
var Iu = class extends po {
	constructor(e) {
		let t = Su({
			name: "batch",
			bits: [
				wu,
				ju(e),
				Nu
			]
		}), n = xu({
			name: "batch",
			bits: [
				Cu,
				Ou(e),
				Mu
			]
		});
		super({
			glProgram: t,
			gpuProgram: n,
			resources: { batchSamplers: Fu(e) }
		}), this.maxTextures = e;
	}
}, Lu = null, Ru = class e extends Vl {
	constructor(t) {
		super(t), this.geometry = new Wl(), this.name = e.extension.name, this.vertexSize = 6, Lu ??= new Iu(t.maxTextures), this.shader = Lu;
	}
	packAttributes(e, t, n, r, i) {
		let a = i << 16 | e.roundPixels & 65535, o = e.transform, s = o.a, c = o.b, l = o.c, u = o.d, d = o.tx, f = o.ty, { positions: p, uvs: m } = e, h = e.color, g = e.attributeOffset, _ = g + e.attributeSize;
		for (let e = g; e < _; e++) {
			let i = e * 2, o = p[i], g = p[i + 1];
			t[r++] = s * o + l * g + d, t[r++] = u * g + c * o + f, t[r++] = m[i], t[r++] = m[i + 1], n[r++] = h, n[r++] = a;
		}
	}
	packQuadAttributes(e, t, n, r, i) {
		let a = e.texture, o = e.transform, s = o.a, c = o.b, l = o.c, u = o.d, d = o.tx, f = o.ty, p = e.bounds, m = p.maxX, h = p.minX, g = p.maxY, _ = p.minY, v = a.uvs, y = e.color, b = i << 16 | e.roundPixels & 65535;
		t[r + 0] = s * h + l * _ + d, t[r + 1] = u * _ + c * h + f, t[r + 2] = v.x0, t[r + 3] = v.y0, n[r + 4] = y, n[r + 5] = b, t[r + 6] = s * m + l * _ + d, t[r + 7] = u * _ + c * m + f, t[r + 8] = v.x1, t[r + 9] = v.y1, n[r + 10] = y, n[r + 11] = b, t[r + 12] = s * m + l * g + d, t[r + 13] = u * g + c * m + f, t[r + 14] = v.x2, t[r + 15] = v.y2, n[r + 16] = y, n[r + 17] = b, t[r + 18] = s * h + l * g + d, t[r + 19] = u * g + c * h + f, t[r + 20] = v.x3, t[r + 21] = v.y3, n[r + 22] = y, n[r + 23] = b;
	}
	_updateMaxTextures(e) {
		this.shader.maxTextures !== e && (Lu = new Iu(e), this.shader = Lu);
	}
	destroy() {
		this.shader = null, super.destroy();
	}
};
Ru.extension = {
	type: [h.Batcher],
	name: "default"
};
var zu = Ru, Bu = class {
	constructor(e) {
		this.items = Object.create(null);
		let { renderer: t, type: n, onUnload: r, priority: i, name: a } = e;
		this._renderer = t, t.gc.addResourceHash(this, "items", n, i ?? 0), this._onUnload = r, this.name = a;
	}
	add(e) {
		return !this.items[e.uid] && (this.items[e.uid] = e, e.once("unload", this.remove, this), e._gcLastUsed = this._renderer.gc.now, !0);
	}
	remove(e, ...t) {
		var n;
		if (!this.items[e.uid]) return;
		let r = e._gpuData[this._renderer.uid];
		r && ((n = this._onUnload) == null || n.call(this, e, ...t), r.destroy(), e._gpuData[this._renderer.uid] = null, this.items[e.uid] = null);
	}
	removeAll(...e) {
		Object.values(this.items).forEach((t) => t && this.remove(t, ...e));
	}
	destroy(...e) {
		this.removeAll(...e), this.items = Object.create(null), this._renderer = null, this._onUnload = null;
	}
};
function Vu(e, t, n, r, i, a, o, s = null) {
	let c = 0;
	n *= t, i *= a;
	let l = s.a, u = s.b, d = s.c, f = s.d, p = s.tx, m = s.ty;
	for (; c < o;) {
		let o = e[n], s = e[n + 1];
		r[i] = l * o + d * s + p, r[i + 1] = u * o + f * s + m, i += a, n += t, c++;
	}
}
function Hu(e, t, n, r) {
	let i = 0;
	for (t *= n; i < r;) e[t] = 0, e[t + 1] = 0, t += n, i++;
}
function Uu(e, t, n, r, i) {
	let a = t.a, o = t.b, s = t.c, c = t.d, l = t.tx, u = t.ty;
	n ||= 0, r ||= 2, i ||= e.length / r - n;
	let d = n * r;
	for (let t = 0; t < i; t++) {
		let t = e[d], n = e[d + 1];
		e[d] = a * t + s * n + l, e[d + 1] = o * t + c * n + u, d += r;
	}
}
var Wu = new B(), Gu = class {
	constructor() {
		this.packAsQuad = !1, this.batcherName = "default", this.topology = "triangle-list", this.applyTransform = !0, this.roundPixels = 0, this._batcher = null, this._batch = null;
	}
	get uvs() {
		return this.geometryData.uvs;
	}
	get positions() {
		return this.geometryData.vertices;
	}
	get indices() {
		return this.geometryData.indices;
	}
	get blendMode() {
		return this.renderable && this.applyTransform ? this.renderable.groupBlendMode : "normal";
	}
	get color() {
		let e = this.baseColor, t = e >> 16 | e & 65280 | (e & 255) << 16, n = this.renderable;
		return n ? nt(t, n.groupColor) + (this.alpha * n.groupAlpha * 255 << 24) : t + (this.alpha * 255 << 24);
	}
	get transform() {
		return this.renderable?.groupTransform || Wu;
	}
	copyTo(e) {
		e.indexOffset = this.indexOffset, e.indexSize = this.indexSize, e.attributeOffset = this.attributeOffset, e.attributeSize = this.attributeSize, e.baseColor = this.baseColor, e.alpha = this.alpha, e.texture = this.texture, e.geometryData = this.geometryData, e.topology = this.topology;
	}
	reset() {
		this.applyTransform = !0, this.renderable = null, this.topology = "triangle-list";
	}
	destroy() {
		this.renderable = null, this.texture = null, this.geometryData = null, this._batcher = null, this._batch = null;
	}
}, Ku = Object.defineProperty, qu = Object.defineProperties, Ju = Object.getOwnPropertyDescriptors, Yu = Object.getOwnPropertySymbols, Xu = Object.prototype.hasOwnProperty, Zu = Object.prototype.propertyIsEnumerable, Qu = (e, t, n) => t in e ? Ku(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, $u = (e, t) => {
	for (var n in t ||= {}) Xu.call(t, n) && Qu(e, n, t[n]);
	if (Yu) for (var n of Yu(t)) Zu.call(t, n) && Qu(e, n, t[n]);
	return e;
}, ed = (e, t) => qu(e, Ju(t)), td = {
	extension: {
		type: h.ShapeBuilder,
		name: "circle"
	},
	build(e, t) {
		let n, r, i, a, o, s;
		if (e.type === "circle") {
			let t = e;
			if (o = s = t.radius, o <= 0) return !1;
			n = t.x, r = t.y, i = a = 0;
		} else if (e.type === "ellipse") {
			let t = e;
			if (o = t.halfWidth, s = t.halfHeight, o <= 0 || s <= 0) return !1;
			n = t.x, r = t.y, i = a = 0;
		} else {
			let t = e, c = t.width / 2, l = t.height / 2;
			n = t.x + c, r = t.y + l, o = s = Math.max(0, Math.min(t.radius, Math.min(c, l))), i = c - o, a = l - s;
		}
		if (i < 0 || a < 0) return !1;
		let c = Math.ceil(2.3 * Math.sqrt(o + s)), l = c * 8 + (i ? 4 : 0) + (a ? 4 : 0);
		if (l === 0) return !1;
		if (c === 0) return t[0] = t[6] = n + i, t[1] = t[3] = r + a, t[2] = t[4] = n - i, t[5] = t[7] = r - a, !0;
		let u = 0, d = c * 4 + (i ? 2 : 0) + 2, f = d, p = l, m = i + o, h = a, g = n + m, _ = n - m, v = r + h;
		if (t[u++] = g, t[u++] = v, t[--d] = v, t[--d] = _, a) {
			let e = r - h;
			t[f++] = _, t[f++] = e, t[--p] = e, t[--p] = g;
		}
		for (let e = 1; e < c; e++) {
			let l = Math.PI / 2 * (e / c), m = i + Math.cos(l) * o, h = a + Math.sin(l) * s, g = n + m, _ = n - m, v = r + h, y = r - h;
			t[u++] = g, t[u++] = v, t[--d] = v, t[--d] = _, t[f++] = _, t[f++] = y, t[--p] = y, t[--p] = g;
		}
		m = i, h = a + s, g = n + m, _ = n - m, v = r + h;
		let y = r - h;
		return t[u++] = g, t[u++] = v, t[--p] = y, t[--p] = g, i && (t[u++] = _, t[u++] = v, t[--p] = y, t[--p] = _), !0;
	},
	triangulate(e, t, n, r, i, a) {
		if (e.length === 0) return;
		let o = 0, s = 0;
		for (let t = 0; t < e.length; t += 2) o += e[t], s += e[t + 1];
		o /= e.length / 2, s /= e.length / 2;
		let c = r;
		t[c * n] = o, t[c * n + 1] = s;
		let l = c++;
		for (let r = 0; r < e.length; r += 2) t[c * n] = e[r], t[c * n + 1] = e[r + 1], r > 0 && (i[a++] = c, i[a++] = l, i[a++] = c - 1), c++;
		i[a++] = l + 1, i[a++] = l, i[a++] = c - 1;
	}
}, nd = ed($u({}, td), { extension: ed($u({}, td.extension), { name: "ellipse" }) }), rd = ed($u({}, td), { extension: ed($u({}, td.extension), { name: "roundedRectangle" }) }), id = 1e-4, ad = 1e-4;
function od(e) {
	let t = e.length;
	if (t < 6) return 1;
	let n = 0;
	for (let r = 0, i = e[t - 2], a = e[t - 1]; r < t; r += 2) {
		let t = e[r], o = e[r + 1];
		n += (t - i) * (o + a), i = t, a = o;
	}
	return n < 0 ? -1 : 1;
}
function sd(e, t, n, r, i, a, o, s) {
	let c = e - n * i, l = t - r * i, u = e + n * a, d = t + r * a, f, p;
	o ? (f = r, p = -n) : (f = -r, p = n);
	let m = c + f, h = l + p, g = u + f, _ = d + p;
	return s.push(m, h), s.push(g, _), 2;
}
function cd(e, t, n, r, i, a, o, s) {
	let c = n - e, l = r - t, u = Math.atan2(c, l), d = Math.atan2(i - e, a - t);
	s && u < d ? u += Math.PI * 2 : !s && u > d && (d += Math.PI * 2);
	let f = u, p = d - u, m = Math.abs(p), h = Math.sqrt(c * c + l * l), g = (15 * m * Math.sqrt(h) / Math.PI >> 0) + 1, _ = p / g;
	if (f += _, s) {
		o.push(e, t), o.push(n, r);
		for (let n = 1, r = f; n < g; n++, r += _) o.push(e, t), o.push(e + Math.sin(r) * h, t + Math.cos(r) * h);
		o.push(e, t), o.push(i, a);
	} else {
		o.push(n, r), o.push(e, t);
		for (let n = 1, r = f; n < g; n++, r += _) o.push(e + Math.sin(r) * h, t + Math.cos(r) * h), o.push(e, t);
		o.push(i, a), o.push(e, t);
	}
	return g * 2;
}
function ld(e, t, n, r, i, a) {
	let o = id;
	if (e.length === 0) return;
	let s = t, c = s.alignment;
	if (t.alignment !== .5) {
		let t = od(e);
		n && (t *= -1), c = (c - .5) * t + .5;
	}
	let l = new Ee(e[0], e[1]), u = new Ee(e[e.length - 2], e[e.length - 1]), d = r, f = Math.abs(l.x - u.x) < o && Math.abs(l.y - u.y) < o;
	if (d) {
		e = e.slice(), f && (e.pop(), e.pop(), u.set(e[e.length - 2], e[e.length - 1]));
		let t = (l.x + u.x) * .5, n = (u.y + l.y) * .5;
		e.unshift(t, n), e.push(t, n);
	}
	let p = i, m = e.length / 2, h = e.length, g = p.length / 2, _ = s.width / 2, v = _ * _, y = s.miterLimit * s.miterLimit, b = e[0], x = e[1], S = e[2], C = e[3], w = 0, T = 0, E = -(x - C), D = b - S, O = 0, k = 0, A = Math.sqrt(E * E + D * D);
	E /= A, D /= A, E *= _, D *= _;
	let j = c, M = (1 - j) * 2, N = j * 2;
	d || (s.cap === "round" ? h += cd(b - E * (M - N) * .5, x - D * (M - N) * .5, b - E * M, x - D * M, b + E * N, x + D * N, p, !0) + 2 : s.cap === "square" && (h += sd(b, x, E, D, M, N, !0, p))), p.push(b - E * M, x - D * M), p.push(b + E * N, x + D * N);
	for (let t = 1; t < m - 1; ++t) {
		b = e[(t - 1) * 2], x = e[(t - 1) * 2 + 1], S = e[t * 2], C = e[t * 2 + 1], w = e[(t + 1) * 2], T = e[(t + 1) * 2 + 1], E = -(x - C), D = b - S, A = Math.sqrt(E * E + D * D), E /= A, D /= A, E *= _, D *= _, O = -(C - T), k = S - w, A = Math.sqrt(O * O + k * k), O /= A, k /= A, O *= _, k *= _;
		let n = S - b, r = x - C, i = S - w, a = T - C, o = n * i + r * a, c = r * i - a * n, l = c < 0;
		if (Math.abs(c) < .001 * Math.abs(o)) {
			p.push(S - E * M, C - D * M), p.push(S + E * N, C + D * N), o >= 0 && (s.join === "round" ? h += cd(S, C, S - E * M, C - D * M, S - O * M, C - k * M, p, !1) + 4 : h += 2, p.push(S - O * N, C - k * N), p.push(S + O * M, C + k * M));
			continue;
		}
		let u = (-E + b) * (-D + C) - (-E + S) * (-D + x), d = (-O + w) * (-k + C) - (-O + S) * (-k + T), f = (n * d - i * u) / c, m = (a * u - r * d) / c, g = (f - S) * (f - S) + (m - C) * (m - C), j = S + (f - S) * M, P = C + (m - C) * M, ee = S - (f - S) * N, F = C - (m - C) * N, te = Math.min(n * n + r * r, i * i + a * a), I = l ? M : N;
		g <= te + I * I * v ? s.join === "bevel" || g / v > y ? (l ? (p.push(j, P), p.push(S + E * N, C + D * N), p.push(j, P), p.push(S + O * N, C + k * N)) : (p.push(S - E * M, C - D * M), p.push(ee, F), p.push(S - O * M, C - k * M), p.push(ee, F)), h += 2) : s.join === "round" ? l ? (p.push(j, P), p.push(S + E * N, C + D * N), h += cd(S, C, S + E * N, C + D * N, S + O * N, C + k * N, p, !0) + 4, p.push(j, P), p.push(S + O * N, C + k * N)) : (p.push(S - E * M, C - D * M), p.push(ee, F), h += cd(S, C, S - E * M, C - D * M, S - O * M, C - k * M, p, !1) + 4, p.push(S - O * M, C - k * M), p.push(ee, F)) : (p.push(j, P), p.push(ee, F)) : (p.push(S - E * M, C - D * M), p.push(S + E * N, C + D * N), s.join === "round" ? h += l ? cd(S, C, S + E * N, C + D * N, S + O * N, C + k * N, p, !0) + 2 : cd(S, C, S - E * M, C - D * M, S - O * M, C - k * M, p, !1) + 2 : s.join === "miter" && g / v <= y && (l ? (p.push(ee, F), p.push(ee, F)) : (p.push(j, P), p.push(j, P)), h += 2), p.push(S - O * M, C - k * M), p.push(S + O * N, C + k * N), h += 2);
	}
	b = e[(m - 2) * 2], x = e[(m - 2) * 2 + 1], S = e[(m - 1) * 2], C = e[(m - 1) * 2 + 1], E = -(x - C), D = b - S, A = Math.sqrt(E * E + D * D), E /= A, D /= A, E *= _, D *= _, p.push(S - E * M, C - D * M), p.push(S + E * N, C + D * N), d || (s.cap === "round" ? h += cd(S - E * (M - N) * .5, C - D * (M - N) * .5, S - E * M, C - D * M, S + E * N, C + D * N, p, !1) + 2 : s.cap === "square" && (h += sd(S, C, E, D, M, N, !1, p)));
	let P = ad * ad;
	for (let e = g; e < h + g - 2; ++e) b = p[e * 2], x = p[e * 2 + 1], S = p[(e + 1) * 2], C = p[(e + 1) * 2 + 1], w = p[(e + 2) * 2], T = p[(e + 2) * 2 + 1], !(Math.abs(b * (C - T) + S * (T - x) + w * (x - C)) < P) && a.push(e, e + 1, e + 2);
}
function ud(e, t, n, r) {
	let i = id;
	if (e.length === 0) return;
	let a = e[0], o = e[1], s = e[e.length - 2], c = e[e.length - 1], l = t || Math.abs(a - s) < i && Math.abs(o - c) < i, u = n, d = e.length / 2, f = u.length / 2;
	for (let t = 0; t < d; t++) u.push(e[t * 2]), u.push(e[t * 2 + 1]);
	for (let e = 0; e < d - 1; e++) r.push(f + e, f + e + 1);
	l && r.push(f + d - 1, f);
}
function dd(e, t, n, r, i, a, o) {
	let s = xs(e, t, 2);
	if (!s) return;
	for (let e = 0; e < s.length; e += 3) a[o++] = s[e] + i, a[o++] = s[e + 1] + i, a[o++] = s[e + 2] + i;
	let c = i * r;
	for (let t = 0; t < e.length; t += 2) n[c] = e[t], n[c + 1] = e[t + 1], c += r;
}
var fd = [], pd = {
	extension: {
		type: h.ShapeBuilder,
		name: "polygon"
	},
	build(e, t) {
		for (let n = 0; n < e.points.length; n++) t[n] = e.points[n];
		return !0;
	},
	triangulate(e, t, n, r, i, a) {
		dd(e, fd, t, n, r, i, a);
	}
}, md = {
	extension: {
		type: h.ShapeBuilder,
		name: "rectangle"
	},
	build(e, t) {
		let n = e, r = n.x, i = n.y, a = n.width, o = n.height;
		return a > 0 && o > 0 && (t[0] = r, t[1] = i, t[2] = r + a, t[3] = i, t[4] = r + a, t[5] = i + o, t[6] = r, t[7] = i + o, !0);
	},
	triangulate(e, t, n, r, i, a) {
		let o = 0;
		r *= n, t[r + o] = e[0], t[r + o + 1] = e[1], o += n, t[r + o] = e[2], t[r + o + 1] = e[3], o += n, t[r + o] = e[6], t[r + o + 1] = e[7], o += n, t[r + o] = e[4], t[r + o + 1] = e[5], o += n;
		let s = r / n;
		i[a++] = s, i[a++] = s + 1, i[a++] = s + 2, i[a++] = s + 1, i[a++] = s + 3, i[a++] = s + 2;
	}
}, hd = {
	extension: {
		type: h.ShapeBuilder,
		name: "triangle"
	},
	build(e, t) {
		return t[0] = e.x, t[1] = e.y, t[2] = e.x2, t[3] = e.y2, t[4] = e.x3, t[5] = e.y3, !0;
	},
	triangulate(e, t, n, r, i, a) {
		let o = 0;
		r *= n, t[r + o] = e[0], t[r + o + 1] = e[1], o += n, t[r + o] = e[2], t[r + o + 1] = e[3], o += n, t[r + o] = e[4], t[r + o + 1] = e[5];
		let s = r / n;
		i[a++] = s, i[a++] = s + 1, i[a++] = s + 2;
	}
}, gd = Object.defineProperty, _d = Object.getOwnPropertySymbols, vd = Object.prototype.hasOwnProperty, yd = Object.prototype.propertyIsEnumerable, bd = (e, t, n) => t in e ? gd(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, xd = (e, t) => {
	for (var n in t ||= {}) vd.call(t, n) && bd(e, n, t[n]);
	if (_d) for (var n of _d(t)) yd.call(t, n) && bd(e, n, t[n]);
	return e;
}, Sd = [{
	offset: 0,
	color: "white"
}, {
	offset: 1,
	color: "black"
}], Cd = class e {
	constructor(...t) {
		this.uid = H("fillGradient"), this._tick = 0, this.type = "linear", this.colorStops = [];
		let n = Dd(t);
		n = xd(xd({}, n.type === "radial" ? e.defaultRadialOptions : e.defaultLinearOptions), vt(n)), this._textureSize = n.textureSize, this._wrapMode = n.wrapMode, n.type === "radial" ? (this.center = n.center, this.outerCenter = n.outerCenter ?? this.center, this.innerRadius = n.innerRadius, this.outerRadius = n.outerRadius, this.scale = n.scale, this.rotation = n.rotation) : (this.start = n.start, this.end = n.end), this.textureSpace = n.textureSpace, this.type = n.type, n.colorStops.forEach((e) => {
			this.addColorStop(e.offset, e.color);
		});
	}
	addColorStop(e, t) {
		return this.colorStops.push({
			offset: e,
			color: z.shared.setValue(t).toHexa()
		}), this;
	}
	buildLinearGradient() {
		if (this.texture) return;
		let { x: e, y: t } = this.start, { x: n, y: r } = this.end, i = n - e, a = r - t, o = i < 0 || a < 0;
		if (this._wrapMode === "clamp-to-edge") {
			if (i < 0) {
				let t = e;
				e = n, n = t, i *= -1;
			}
			if (a < 0) {
				let e = t;
				t = r, r = e, a *= -1;
			}
		}
		let s = this.colorStops.length ? this.colorStops : Sd, c = this._textureSize, { canvas: l, context: u } = Ed(c, 1), d = o ? u.createLinearGradient(this._textureSize, 0, 0, 0) : u.createLinearGradient(0, 0, this._textureSize, 0);
		Td(d, s), u.fillStyle = d, u.fillRect(0, 0, c, 1), this.texture = new J({ source: new Si({
			resource: l,
			addressMode: this._wrapMode
		}) });
		let f = Math.sqrt(i * i + a * a), p = Math.atan2(a, i), m = new B();
		m.scale(f / c, 1), m.rotate(p), m.translate(e, t), this.textureSpace === "local" && m.scale(c, c), this.transform = m;
	}
	buildGradient() {
		this.texture || this._tick++, this.type === "linear" ? this.buildLinearGradient() : this.buildRadialGradient();
	}
	buildRadialGradient() {
		if (this.texture) return;
		let e = this.colorStops.length ? this.colorStops : Sd, t = this._textureSize, { canvas: n, context: r } = Ed(t, t), { x: i, y: a } = this.center, { x: o, y: s } = this.outerCenter, c = this.innerRadius, l = this.outerRadius, u = o - l, d = s - l, f = t / (l * 2), p = (i - u) * f, m = (a - d) * f, h = r.createRadialGradient(p, m, c * f, (o - u) * f, (s - d) * f, l * f);
		Td(h, e), r.fillStyle = e[e.length - 1].color, r.fillRect(0, 0, t, t), r.fillStyle = h, r.translate(p, m), r.rotate(this.rotation), r.scale(1, this.scale), r.translate(-p, -m), r.fillRect(0, 0, t, t), this.texture = new J({ source: new Si({
			resource: n,
			addressMode: this._wrapMode
		}) });
		let g = new B();
		this.textureSpace === "local" ? g.scale(2 * l, 2 * l) : g.scale(1 / f, 1 / f), g.translate(u, d), this.transform = g;
	}
	destroy() {
		var e;
		(e = this.texture) == null || e.destroy(!0), this.texture = null, this.transform = null, this.colorStops = [], this.start = null, this.end = null, this.center = null, this.outerCenter = null;
	}
	get styleKey() {
		return `fill-gradient-${this.uid}-${this._tick}`;
	}
};
Cd.defaultLinearOptions = {
	start: {
		x: 0,
		y: 0
	},
	end: {
		x: 0,
		y: 1
	},
	colorStops: [],
	textureSpace: "local",
	type: "linear",
	textureSize: 256,
	wrapMode: "clamp-to-edge"
}, Cd.defaultRadialOptions = {
	center: {
		x: .5,
		y: .5
	},
	innerRadius: 0,
	outerRadius: .5,
	colorStops: [],
	scale: 1,
	rotation: 0,
	textureSpace: "local",
	type: "radial",
	textureSize: 256,
	wrapMode: "clamp-to-edge"
};
var wd = Cd;
function Td(e, t) {
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		e.addColorStop(r.offset, r.color);
	}
}
function Ed(e, t) {
	let n = X.get().createCanvas(e, t);
	return {
		canvas: n,
		context: n.getContext("2d")
	};
}
function Dd(e) {
	let t = e[0] ?? {};
	return (typeof t == "number" || e[1]) && (t = {
		type: "linear",
		start: {
			x: e[0],
			y: e[1]
		},
		end: {
			x: e[2],
			y: e[3]
		},
		textureSpace: e[4],
		textureSize: e[5] ?? wd.defaultLinearOptions.textureSize
	}), t;
}
var Od = new B(), kd = new qe();
function Ad(e, t, n, r) {
	let i = t.matrix ? e.copyFrom(t.matrix).invert() : e.identity();
	if (t.textureSpace === "local") {
		let e = n.getBounds(kd);
		t.width && e.pad(t.width);
		let { x: r, y: a } = e, o = 1 / e.width, s = 1 / e.height, c = -r * o, l = -a * s, u = i.a, d = i.b, f = i.c, p = i.d;
		i.a *= o, i.b *= o, i.c *= s, i.d *= s, i.tx = c * u + l * f + i.tx, i.ty = c * d + l * p + i.ty;
	} else i.translate(t.texture.frame.x, t.texture.frame.y), i.scale(1 / t.texture.source.width, 1 / t.texture.source.height);
	let a = t.texture.source.style;
	return !(t.fill instanceof wd) && a.addressMode === "clamp-to-edge" && (a.addressMode = "repeat", a.update()), r && i.append(Od.copyFrom(r).invert()), i;
}
var jd = {};
v.handleByMap(h.ShapeBuilder, jd), v.add(md, pd, hd, td, nd, rd);
var Md = new qe(), Nd = new B();
function Pd(e, t) {
	let { geometryData: n, batches: r } = t;
	r.length = 0, n.indices.length = 0, n.vertices.length = 0, n.uvs.length = 0;
	for (let t = 0; t < e.instructions.length; t++) {
		let i = e.instructions[t];
		if (i.action === "texture") Fd(i.data, r, n);
		else if (i.action === "fill" || i.action === "stroke") {
			let e = i.action === "stroke", t = i.data.path.shapePath, a = i.data.style, o = i.data.hole;
			e && o && Id(o.shapePath, a, !0, r, n), o && (t.shapePrimitives[t.shapePrimitives.length - 1].holes = o.shapePath.shapePrimitives), Id(t, a, e, r, n);
		}
	}
}
function Fd(e, t, n) {
	let r = [], i = jd.rectangle, a = Md;
	a.x = e.dx, a.y = e.dy, a.width = e.dw, a.height = e.dh;
	let o = e.transform;
	if (!i.build(a, r)) return;
	let { vertices: s, uvs: c, indices: l } = n, u = l.length, d = s.length / 2;
	o && Uu(r, o), i.triangulate(r, s, 2, d, l, u);
	let f = e.image, p = f.uvs;
	c.push(p.x0, p.y0, p.x1, p.y1, p.x3, p.y3, p.x2, p.y2);
	let m = U.get(Gu);
	m.indexOffset = u, m.indexSize = l.length - u, m.attributeOffset = d, m.attributeSize = s.length / 2 - d, m.baseColor = e.style, m.alpha = e.alpha, m.texture = f, m.geometryData = n, t.push(m);
}
function Id(e, t, n, r, i) {
	let { vertices: a, uvs: o, indices: s } = i;
	e.shapePrimitives.forEach(({ shape: e, transform: c, holes: l }) => {
		let u = [], d = jd[e.type];
		if (!d.build(e, u)) return;
		let f = s.length, p = a.length / 2, m = "triangle-list";
		if (c && Uu(u, c), n) {
			let n = e.closePath ?? !0, r = t;
			r.pixelLine ? (ud(u, n, a, s), m = "line-list") : ld(u, r, !1, n, a, s);
		} else if (l) {
			let e = [], t = u.slice();
			Ld(l).forEach((n) => {
				e.push(t.length / 2), t.push(...n);
			}), dd(t, e, a, 2, p, s, f);
		} else d.triangulate(u, a, 2, p, s, f);
		let h = o.length / 2, g = t.texture;
		if (g !== J.WHITE) {
			let n = Ad(Nd, t, e, c);
			Vu(a, 2, p, o, h, 2, a.length / 2 - p, n);
		} else Hu(o, h, 2, a.length / 2 - p);
		let _ = U.get(Gu);
		_.indexOffset = f, _.indexSize = s.length - f, _.attributeOffset = p, _.attributeSize = a.length / 2 - p, _.baseColor = t.color, _.alpha = t.alpha, _.texture = g, _.geometryData = i, _.topology = m, r.push(_);
	});
}
function Ld(e) {
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let r = e[n].shape, i = [];
		jd[r.type].build(r, i) && t.push(i);
	}
	return t;
}
var Rd = class {
	constructor() {
		this.batches = [], this.geometryData = {
			vertices: [],
			uvs: [],
			indices: []
		};
	}
	reset() {
		this.batches && this.batches.forEach((e) => {
			U.return(e);
		}), this.graphicsData && U.return(this.graphicsData), this.isBatchable = !1, this.context = null, this.batches.length = 0, this.geometryData.indices.length = 0, this.geometryData.vertices.length = 0, this.geometryData.uvs.length = 0, this.graphicsData = null;
	}
	destroy() {
		this.reset(), this.batches = null, this.geometryData = null;
	}
}, zd = class {
	constructor() {
		this.instructions = new ht();
	}
	init(e) {
		let t = e.maxTextures;
		this.batcher ? this.batcher._updateMaxTextures(t) : this.batcher = new zu({ maxTextures: t }), this.instructions.reset();
	}
	get geometry() {
		return this.batcher.geometry;
	}
	destroy() {
		this.batcher.destroy(), this.instructions.destroy(), this.batcher = null, this.instructions = null;
	}
}, Bd = class e {
	constructor(e) {
		this._renderer = e, this._managedContexts = new Bu({
			renderer: e,
			type: "resource",
			name: "graphicsContext"
		});
	}
	init(t) {
		e.defaultOptions.bezierSmoothness = t?.bezierSmoothness ?? e.defaultOptions.bezierSmoothness;
	}
	getContextRenderData(e) {
		return e._gpuData[this._renderer.uid].graphicsData || this._initContextRenderData(e);
	}
	updateGpuContext(e) {
		let t = !!e._gpuData[this._renderer.uid], n = e._gpuData[this._renderer.uid] || this._initContext(e);
		if (e.dirty || !t) {
			t && n.reset(), Pd(e, n);
			let r = e.batchMode;
			n.isBatchable = e.customShader || r === "no-batch" ? !1 : r !== "auto" || n.geometryData.vertices.length < 400, e.dirty = !1;
		}
		return n;
	}
	getGpuContext(e) {
		return e._gpuData[this._renderer.uid] || this._initContext(e);
	}
	_initContextRenderData(e) {
		let t = U.get(zd, { maxTextures: this._renderer.limits.maxBatchableTextures }), n = e._gpuData[this._renderer.uid], { batches: r, geometryData: i } = n;
		n.graphicsData = t;
		let a = i.vertices.length, o = i.indices.length;
		for (let e = 0; e < r.length; e++) r[e].applyTransform = !1;
		let s = t.batcher;
		s.ensureAttributeBuffer(a), s.ensureIndexBuffer(o), s.begin();
		for (let e = 0; e < r.length; e++) {
			let t = r[e];
			s.add(t);
		}
		s.finish(t.instructions);
		let c = s.geometry;
		c.indexBuffer.setDataWithSize(s.indexBuffer, s.indexSize, !0), c.buffers[0].setDataWithSize(s.attributeBuffer.float32View, s.attributeSize, !0);
		let l = s.batches;
		for (let e = 0; e < l.length; e++) {
			let t = l[e];
			t.bindGroup = dl(t.textures.textures, t.textures.count, this._renderer.limits.maxBatchableTextures);
		}
		return t;
	}
	_initContext(e) {
		let t = new Rd();
		return t.context = e, e._gpuData[this._renderer.uid] = t, this._managedContexts.add(e), t;
	}
	destroy() {
		this._managedContexts.destroy(), this._renderer = null;
	}
};
Bd.extension = {
	type: [h.WebGLSystem, h.WebGPUSystem],
	name: "graphicsContext"
}, Bd.defaultOptions = { bezierSmoothness: .5 };
var Vd = Bd, Hd = 8, Ud = 1.1920929e-7, Wd = 1;
function Gd(e, t, n, r, i, a, o, s, c, l) {
	let u = (Wd - Math.min(.99, Math.max(0, l ?? Vd.defaultOptions.bezierSmoothness))) / 1;
	return u *= u, Kd(t, n, r, i, a, o, s, c, e, u), e;
}
function Kd(e, t, n, r, i, a, o, s, c, l) {
	qd(e, t, n, r, i, a, o, s, c, l, 0), c.push(o, s);
}
function qd(e, t, n, r, i, a, o, s, c, l, u) {
	if (u > Hd) return;
	let d = (e + n) / 2, f = (t + r) / 2, p = (n + i) / 2, m = (r + a) / 2, h = (i + o) / 2, g = (a + s) / 2, _ = (d + p) / 2, v = (f + m) / 2, y = (p + h) / 2, b = (m + g) / 2, x = (_ + y) / 2, S = (v + b) / 2;
	if (u > 0) {
		let u = o - e, d = s - t, f = Math.abs((n - o) * d - (r - s) * u), p = Math.abs((i - o) * d - (a - s) * u);
		if (f > Ud && p > Ud) {
			if ((f + p) * (f + p) <= l * (u * u + d * d)) {
				c.push(x, S);
				return;
			}
		} else if (f > Ud) {
			if (f * f <= l * (u * u + d * d)) {
				c.push(x, S);
				return;
			}
		} else if (p > Ud) {
			if (p * p <= l * (u * u + d * d)) {
				c.push(x, S);
				return;
			}
		} else if (u = x - (e + o) / 2, d = S - (t + s) / 2, u * u + d * d <= l) {
			c.push(x, S);
			return;
		}
	}
	qd(e, t, d, f, _, v, x, S, c, l, u + 1), qd(x, S, y, b, h, g, o, s, c, l, u + 1);
}
var Jd = 8, Yd = 1.1920929e-7, Xd = 1;
function Zd(e, t, n, r, i, a, o, s) {
	let c = (Xd - Math.min(.99, Math.max(0, s ?? Vd.defaultOptions.bezierSmoothness))) / 1;
	return c *= c, Qd(t, n, r, i, a, o, e, c), e;
}
function Qd(e, t, n, r, i, a, o, s) {
	$d(o, e, t, n, r, i, a, s, 0), o.push(i, a);
}
function $d(e, t, n, r, i, a, o, s, c) {
	if (c > Jd) return;
	let l = (t + r) / 2, u = (n + i) / 2, d = (r + a) / 2, f = (i + o) / 2, p = (l + d) / 2, m = (u + f) / 2, h = a - t, g = o - n, _ = Math.abs((r - a) * g - (i - o) * h);
	if (_ > Yd) {
		if (_ * _ <= s * (h * h + g * g)) {
			e.push(p, m);
			return;
		}
	} else if (h = p - (t + a) / 2, g = m - (n + o) / 2, h * h + g * g <= s) {
		e.push(p, m);
		return;
	}
	$d(e, t, n, l, u, p, m, s, c + 1), $d(e, p, m, d, f, a, o, s, c + 1);
}
function ef(e, t, n, r, i, a, o, s) {
	let c = Math.abs(i - a);
	(!o && i > a || o && a > i) && (c = 2 * Math.PI - c), s ||= Math.max(6, Math.floor(6 * r ** (1 / 3) * (c / Math.PI))), s = Math.max(s, 3);
	let l = c / s, u = i;
	l *= o ? -1 : 1;
	for (let i = 0; i < s + 1; i++) {
		let i = Math.cos(u), a = Math.sin(u), o = t + i * r, s = n + a * r;
		e.push(o, s), u += l;
	}
}
function tf(e, t, n, r, i, a) {
	let o = e[e.length - 2], s = e[e.length - 1] - n, c = o - t, l = i - n, u = r - t, d = Math.abs(s * u - c * l);
	if (d < 1e-8 || a === 0) {
		(e[e.length - 2] !== t || e[e.length - 1] !== n) && e.push(t, n);
		return;
	}
	let f = s * s + c * c, p = l * l + u * u, m = s * l + c * u, h = a * Math.sqrt(f) / d, g = a * Math.sqrt(p) / d, _ = h * m / f, v = g * m / p, y = h * u + g * c, b = h * l + g * s, x = c * (g + _), S = s * (g + _), C = u * (h + v), w = l * (h + v), T = Math.atan2(S - b, x - y), E = Math.atan2(w - b, C - y);
	ef(e, y + t, b + n, a, T, E, c * l > u * s);
}
var nf = Math.PI * 2, rf = {
	centerX: 0,
	centerY: 0,
	ang1: 0,
	ang2: 0
}, af = ({ x: e, y: t }, n, r, i, a, o, s, c) => {
	e *= n, t *= r;
	let l = i * e - a * t, u = a * e + i * t;
	return c.x = l + o, c.y = u + s, c;
};
function of(e, t) {
	let n = t === -1.5707963267948966 ? -.551915024494 : 1.3333333333333333 * Math.tan(t / 4), r = t === 1.5707963267948966 ? .551915024494 : n, i = Math.cos(e), a = Math.sin(e), o = Math.cos(e + t), s = Math.sin(e + t);
	return [
		{
			x: i - a * r,
			y: a + i * r
		},
		{
			x: o + s * r,
			y: s - o * r
		},
		{
			x: o,
			y: s
		}
	];
}
var sf = (e, t, n, r) => {
	let i = e * r - t * n < 0 ? -1 : 1, a = e * n + t * r;
	return a > 1 && (a = 1), a < -1 && (a = -1), i * Math.acos(a);
}, cf = (e, t, n, r, i, a, o, s, c, l, u, d, f) => {
	let p = i ** 2, m = a ** 2, h = u ** 2, g = d ** 2, _ = p * m - p * g - m * h;
	_ < 0 && (_ = 0), _ /= p * g + m * h, _ = Math.sqrt(_) * (o === s ? -1 : 1);
	let v = _ * i / a * d, y = _ * -a / i * u, b = l * v - c * y + (e + n) / 2, x = c * v + l * y + (t + r) / 2, S = (u - v) / i, C = (d - y) / a, w = (-u - v) / i, T = (-d - y) / a, E = sf(1, 0, S, C), D = sf(S, C, w, T);
	s === 0 && D > 0 && (D -= nf), s === 1 && D < 0 && (D += nf), f.centerX = b, f.centerY = x, f.ang1 = E, f.ang2 = D;
};
function lf(e, t, n, r, i, a, o, s = 0, c = 0, l = 0) {
	if (a === 0 || o === 0) return;
	let u = Math.sin(s * nf / 360), d = Math.cos(s * nf / 360), f = d * (t - r) / 2 + u * (n - i) / 2, p = -u * (t - r) / 2 + d * (n - i) / 2;
	if (f === 0 && p === 0) return;
	a = Math.abs(a), o = Math.abs(o);
	let m = f ** 2 / a ** 2 + p ** 2 / o ** 2;
	m > 1 && (a *= Math.sqrt(m), o *= Math.sqrt(m)), cf(t, n, r, i, a, o, c, l, u, d, f, p, rf);
	let { ang1: h, ang2: g } = rf, { centerX: _, centerY: v } = rf, y = Math.abs(g) / (nf / 4);
	Math.abs(1 - y) < 1e-7 && (y = 1);
	let b = Math.max(Math.ceil(y), 1);
	g /= b;
	let x = e[e.length - 2], S = e[e.length - 1], C = {
		x: 0,
		y: 0
	};
	for (let t = 0; t < b; t++) {
		let t = of(h, g), { x: n, y: r } = af(t[0], a, o, d, u, _, v, C), { x: i, y: s } = af(t[1], a, o, d, u, _, v, C), { x: c, y: l } = af(t[2], a, o, d, u, _, v, C);
		Gd(e, x, S, n, r, i, s, c, l), x = c, S = l, h += g;
	}
}
function uf(e, t, n) {
	let r = (e, t) => {
		let n = t.x - e.x, r = t.y - e.y, i = Math.sqrt(n * n + r * r);
		return {
			len: i,
			nx: n / i,
			ny: r / i
		};
	}, i = (t, n) => {
		t === 0 ? e.moveTo(n.x, n.y) : e.lineTo(n.x, n.y);
	}, a = t[t.length - 1];
	for (let o = 0; o < t.length; o++) {
		let s = t[o % t.length], c = s.radius ?? n;
		if (c <= 0) {
			i(o, s), a = s;
			continue;
		}
		let l = t[(o + 1) % t.length], u = r(s, a), d = r(s, l);
		if (u.len < 1e-4 || d.len < 1e-4) {
			i(o, s), a = s;
			continue;
		}
		let f = Math.asin(u.nx * d.ny - u.ny * d.nx), p = 1, m = !1;
		u.nx * d.nx - u.ny * -d.ny < 0 ? f < 0 ? f = Math.PI + f : (f = Math.PI - f, p = -1, m = !0) : f > 0 && (p = -1, m = !0);
		let h = f / 2, g, _ = Math.abs(Math.cos(h) * c / Math.sin(h));
		_ > Math.min(u.len / 2, d.len / 2) ? (_ = Math.min(u.len / 2, d.len / 2), g = Math.abs(_ * Math.sin(h) / Math.cos(h))) : g = c;
		let v = s.x + d.nx * _ + -d.ny * g * p, y = s.y + d.ny * _ + d.nx * g * p, b = Math.atan2(u.ny, u.nx) + Math.PI / 2 * p, x = Math.atan2(d.ny, d.nx) - Math.PI / 2 * p;
		o === 0 && e.moveTo(v + Math.cos(b) * g, y + Math.sin(b) * g), e.arc(v, y, g, b, x, m), a = s;
	}
}
function df(e, t, n, r) {
	let i = (e, t) => Math.sqrt((e.x - t.x) ** 2 + (e.y - t.y) ** 2), a = (e, t, n) => ({
		x: e.x + (t.x - e.x) * n,
		y: e.y + (t.y - e.y) * n
	}), o = t.length;
	for (let s = 0; s < o; s++) {
		let c = t[(s + 1) % o], l = c.radius ?? n;
		if (l <= 0) {
			s === 0 ? e.moveTo(c.x, c.y) : e.lineTo(c.x, c.y);
			continue;
		}
		let u = t[s], d = t[(s + 2) % o], f = i(u, c), p;
		p = f < 1e-4 ? c : a(c, u, Math.min(f / 2, l) / f);
		let m = i(d, c), h;
		h = m < 1e-4 ? c : a(c, d, Math.min(m / 2, l) / m), s === 0 ? e.moveTo(p.x, p.y) : e.lineTo(p.x, p.y), e.quadraticCurveTo(c.x, c.y, h.x, h.y, r);
	}
}
var ff = new qe(), pf = class {
	constructor(e) {
		this.shapePrimitives = [], this._currentPoly = null, this._bounds = new G(), this._graphicsPath2D = e, this.signed = e.checkForHoles;
	}
	moveTo(e, t) {
		return this.startPoly(e, t), this;
	}
	lineTo(e, t) {
		this._ensurePoly();
		let n = this._currentPoly.points, r = n[n.length - 2], i = n[n.length - 1];
		return (r !== e || i !== t) && n.push(e, t), this;
	}
	arc(e, t, n, r, i, a) {
		this._ensurePoly(!1);
		let o = this._currentPoly.points;
		return ef(o, e, t, n, r, i, a), this;
	}
	arcTo(e, t, n, r, i) {
		this._ensurePoly();
		let a = this._currentPoly.points;
		return tf(a, e, t, n, r, i), this;
	}
	arcToSvg(e, t, n, r, i, a, o) {
		let s = this._currentPoly.points;
		return lf(s, this._currentPoly.lastX, this._currentPoly.lastY, a, o, e, t, n, r, i), this;
	}
	bezierCurveTo(e, t, n, r, i, a, o) {
		this._ensurePoly();
		let s = this._currentPoly;
		return Gd(this._currentPoly.points, s.lastX, s.lastY, e, t, n, r, i, a, o), this;
	}
	quadraticCurveTo(e, t, n, r, i) {
		this._ensurePoly();
		let a = this._currentPoly;
		return Zd(this._currentPoly.points, a.lastX, a.lastY, e, t, n, r, i), this;
	}
	closePath() {
		return this.endPoly(!0), this;
	}
	addPath(e, t) {
		this.endPoly(), t && !t.isIdentity() && (e = e.clone(!0), e.transform(t));
		let n = this.shapePrimitives, r = n.length;
		for (let t = 0; t < e.instructions.length; t++) {
			let n = e.instructions[t];
			this[n.action](...n.data);
		}
		if (e.checkForHoles && n.length - r > 1) {
			let e = null;
			for (let t = r; t < n.length; t++) {
				let r = n[t];
				if (r.shape.type === "polygon") {
					let i = r.shape, a = e?.shape;
					a && a.containsPolygon(i) ? (e.holes || (e.holes = []), e.holes.push(r), n.copyWithin(t, t + 1), n.length--, t--) : e = r;
				}
			}
		}
		return this;
	}
	finish(e = !1) {
		this.endPoly(e);
	}
	rect(e, t, n, r, i) {
		return this.drawShape(new qe(e, t, n, r), i), this;
	}
	circle(e, t, n, r) {
		return this.drawShape(new qi(e, t, n), r), this;
	}
	poly(e, t, n) {
		let r = new Zi(e);
		return r.closePath = t, this.drawShape(r, n), this;
	}
	regularPoly(e, t, n, r, i = 0, a) {
		r = Math.max(r | 0, 3);
		let o = -1 * Math.PI / 2 + i, s = Math.PI * 2 / r, c = [];
		for (let i = 0; i < r; i++) {
			let r = o - i * s;
			c.push(e + n * Math.cos(r), t + n * Math.sin(r));
		}
		return this.poly(c, !0, a), this;
	}
	roundPoly(e, t, n, r, i, a = 0, o) {
		if (r = Math.max(r | 0, 3), i <= 0) return this.regularPoly(e, t, n, r, a);
		let s = n * Math.sin(Math.PI / r) - .001;
		i = Math.min(i, s);
		let c = -1 * Math.PI / 2 + a, l = Math.PI * 2 / r, u = (r - 2) * Math.PI / r / 2;
		for (let a = 0; a < r; a++) {
			let r = a * l + c, s = e + n * Math.cos(r), d = t + n * Math.sin(r), f = r + Math.PI + u, p = r - Math.PI - u, m = s + i * Math.cos(f), h = d + i * Math.sin(f), g = s + i * Math.cos(p), _ = d + i * Math.sin(p);
			a === 0 ? this.moveTo(m, h) : this.lineTo(m, h), this.quadraticCurveTo(s, d, g, _, o);
		}
		return this.closePath();
	}
	roundShape(e, t, n = !1, r) {
		return e.length < 3 ? this : (n ? df(this, e, t, r) : uf(this, e, t), this.closePath());
	}
	filletRect(e, t, n, r, i) {
		if (i === 0) return this.rect(e, t, n, r);
		let a = Math.min(n, r) / 2, o = Math.min(a, Math.max(-a, i)), s = e + n, c = t + r, l = o < 0 ? -o : 0, u = Math.abs(o);
		return this.moveTo(e, t + u).arcTo(e + l, t + l, e + u, t, u).lineTo(s - u, t).arcTo(s - l, t + l, s, t + u, u).lineTo(s, c - u).arcTo(s - l, c - l, e + n - u, c, u).lineTo(e + u, c).arcTo(e + l, c - l, e, c - u, u).closePath();
	}
	chamferRect(e, t, n, r, i, a) {
		if (i <= 0) return this.rect(e, t, n, r);
		let o = Math.min(i, Math.min(n, r) / 2), s = e + n, c = t + r, l = [
			e + o,
			t,
			s - o,
			t,
			s,
			t + o,
			s,
			c - o,
			s - o,
			c,
			e + o,
			c,
			e,
			c - o,
			e,
			t + o
		];
		for (let e = l.length - 1; e >= 2; e -= 2) l[e] === l[e - 2] && l[e - 1] === l[e - 3] && l.splice(e - 1, 2);
		return this.poly(l, !0, a);
	}
	ellipse(e, t, n, r, i) {
		return this.drawShape(new Ji(e, t, n, r), i), this;
	}
	roundRect(e, t, n, r, i, a) {
		return this.drawShape(new $i(e, t, n, r, i), a), this;
	}
	drawShape(e, t) {
		return this.endPoly(), this.shapePrimitives.push({
			shape: e,
			transform: t
		}), this;
	}
	startPoly(e, t) {
		let n = this._currentPoly;
		return n && this.endPoly(), n = new Zi(), n.points.push(e, t), this._currentPoly = n, this;
	}
	endPoly(e = !1) {
		let t = this._currentPoly;
		return t && t.points.length > 2 && (t.closePath = e, this.shapePrimitives.push({ shape: t })), this._currentPoly = null, this;
	}
	_ensurePoly(e = !0) {
		if (!this._currentPoly && (this._currentPoly = new Zi(), e)) {
			let e = this.shapePrimitives[this.shapePrimitives.length - 1];
			if (e) {
				let t = e.shape.x, n = e.shape.y;
				if (e.transform && !e.transform.isIdentity()) {
					let r = e.transform, i = t;
					t = r.a * t + r.c * n + r.tx, n = r.b * i + r.d * n + r.ty;
				}
				this._currentPoly.points.push(t, n);
			} else this._currentPoly.points.push(0, 0);
		}
	}
	buildPath() {
		let e = this._graphicsPath2D;
		this.shapePrimitives.length = 0, this._currentPoly = null;
		for (let t = 0; t < e.instructions.length; t++) {
			let n = e.instructions[t];
			this[n.action](...n.data);
		}
		this.finish();
	}
	get bounds() {
		let e = this._bounds;
		e.clear();
		let t = this.shapePrimitives;
		for (let n = 0; n < t.length; n++) {
			let r = t[n], i = r.shape.getBounds(ff);
			r.transform ? e.addRect(i, r.transform) : e.addRect(i);
		}
		return e;
	}
}, mf = class e {
	constructor(e, t = !1) {
		this.instructions = [], this.uid = H("graphicsPath"), this._dirty = !0, this.checkForHoles = t, typeof e == "string" ? ll(e, this) : this.instructions = e?.slice() ?? [];
	}
	get shapePath() {
		return this._shapePath ||= new pf(this), this._dirty && (this._dirty = !1, this._shapePath.buildPath()), this._shapePath;
	}
	addPath(e, t) {
		return e = e.clone(), this.instructions.push({
			action: "addPath",
			data: [e, t]
		}), this._dirty = !0, this;
	}
	arc(...e) {
		return this.instructions.push({
			action: "arc",
			data: e
		}), this._dirty = !0, this;
	}
	arcTo(...e) {
		return this.instructions.push({
			action: "arcTo",
			data: e
		}), this._dirty = !0, this;
	}
	arcToSvg(...e) {
		return this.instructions.push({
			action: "arcToSvg",
			data: e
		}), this._dirty = !0, this;
	}
	bezierCurveTo(...e) {
		return this.instructions.push({
			action: "bezierCurveTo",
			data: e
		}), this._dirty = !0, this;
	}
	bezierCurveToShort(e, t, n, r, i) {
		let a = this.instructions[this.instructions.length - 1], o = this.getLastPoint(Ee.shared), s = 0, c = 0;
		if (!a || a.action !== "bezierCurveTo") s = o.x, c = o.y;
		else {
			s = a.data[2], c = a.data[3];
			let e = o.x, t = o.y;
			s = e + (e - s), c = t + (t - c);
		}
		return this.instructions.push({
			action: "bezierCurveTo",
			data: [
				s,
				c,
				e,
				t,
				n,
				r,
				i
			]
		}), this._dirty = !0, this;
	}
	closePath() {
		return this.instructions.push({
			action: "closePath",
			data: []
		}), this._dirty = !0, this;
	}
	ellipse(...e) {
		return this.instructions.push({
			action: "ellipse",
			data: e
		}), this._dirty = !0, this;
	}
	lineTo(...e) {
		return this.instructions.push({
			action: "lineTo",
			data: e
		}), this._dirty = !0, this;
	}
	moveTo(...e) {
		return this.instructions.push({
			action: "moveTo",
			data: e
		}), this;
	}
	quadraticCurveTo(...e) {
		return this.instructions.push({
			action: "quadraticCurveTo",
			data: e
		}), this._dirty = !0, this;
	}
	quadraticCurveToShort(e, t, n) {
		let r = this.instructions[this.instructions.length - 1], i = this.getLastPoint(Ee.shared), a = 0, o = 0;
		if (!r || r.action !== "quadraticCurveTo") a = i.x, o = i.y;
		else {
			a = r.data[0], o = r.data[1];
			let e = i.x, t = i.y;
			a = e + (e - a), o = t + (t - o);
		}
		return this.instructions.push({
			action: "quadraticCurveTo",
			data: [
				a,
				o,
				e,
				t,
				n
			]
		}), this._dirty = !0, this;
	}
	rect(e, t, n, r, i) {
		return this.instructions.push({
			action: "rect",
			data: [
				e,
				t,
				n,
				r,
				i
			]
		}), this._dirty = !0, this;
	}
	circle(e, t, n, r) {
		return this.instructions.push({
			action: "circle",
			data: [
				e,
				t,
				n,
				r
			]
		}), this._dirty = !0, this;
	}
	roundRect(...e) {
		return this.instructions.push({
			action: "roundRect",
			data: e
		}), this._dirty = !0, this;
	}
	poly(...e) {
		return this.instructions.push({
			action: "poly",
			data: e
		}), this._dirty = !0, this;
	}
	regularPoly(...e) {
		return this.instructions.push({
			action: "regularPoly",
			data: e
		}), this._dirty = !0, this;
	}
	roundPoly(...e) {
		return this.instructions.push({
			action: "roundPoly",
			data: e
		}), this._dirty = !0, this;
	}
	roundShape(...e) {
		return this.instructions.push({
			action: "roundShape",
			data: e
		}), this._dirty = !0, this;
	}
	filletRect(...e) {
		return this.instructions.push({
			action: "filletRect",
			data: e
		}), this._dirty = !0, this;
	}
	chamferRect(...e) {
		return this.instructions.push({
			action: "chamferRect",
			data: e
		}), this._dirty = !0, this;
	}
	star(e, t, n, r, i, a, o) {
		i ||= r / 2;
		let s = -1 * Math.PI / 2 + a, c = n * 2, l = Math.PI * 2 / c, u = [];
		for (let n = 0; n < c; n++) {
			let a = n % 2 ? i : r, o = n * l + s;
			u.push(e + a * Math.cos(o), t + a * Math.sin(o));
		}
		return this.poly(u, !0, o), this;
	}
	clone(t = !1) {
		let n = new e();
		if (n.checkForHoles = this.checkForHoles, !t) n.instructions = this.instructions.slice();
		else for (let e = 0; e < this.instructions.length; e++) {
			let t = this.instructions[e];
			n.instructions.push({
				action: t.action,
				data: t.data.slice()
			});
		}
		return n;
	}
	clear() {
		return this.instructions.length = 0, this._dirty = !0, this;
	}
	transform(e) {
		if (e.isIdentity()) return this;
		let t = e.a, n = e.b, r = e.c, i = e.d, a = e.tx, o = e.ty, s = 0, c = 0, l = 0, u = 0, d = 0, f = 0, p = 0, m = 0;
		for (let h = 0; h < this.instructions.length; h++) {
			let g = this.instructions[h], _ = g.data;
			switch (g.action) {
				case "moveTo":
				case "lineTo":
					s = _[0], c = _[1], _[0] = t * s + r * c + a, _[1] = n * s + i * c + o;
					break;
				case "bezierCurveTo":
					l = _[0], u = _[1], d = _[2], f = _[3], s = _[4], c = _[5], _[0] = t * l + r * u + a, _[1] = n * l + i * u + o, _[2] = t * d + r * f + a, _[3] = n * d + i * f + o, _[4] = t * s + r * c + a, _[5] = n * s + i * c + o;
					break;
				case "quadraticCurveTo":
					l = _[0], u = _[1], s = _[2], c = _[3], _[0] = t * l + r * u + a, _[1] = n * l + i * u + o, _[2] = t * s + r * c + a, _[3] = n * s + i * c + o;
					break;
				case "arcToSvg":
					s = _[5], c = _[6], p = _[0], m = _[1], _[0] = t * p + r * m, _[1] = n * p + i * m, _[5] = t * s + r * c + a, _[6] = n * s + i * c + o;
					break;
				case "circle":
					_[4] = hf(_[3], e);
					break;
				case "rect":
					_[4] = hf(_[4], e);
					break;
				case "ellipse":
					_[8] = hf(_[8], e);
					break;
				case "roundRect":
					_[5] = hf(_[5], e);
					break;
				case "addPath":
					_[0].transform(e);
					break;
				case "poly":
					_[2] = hf(_[2], e);
					break;
				case "regularPoly":
				case "chamferRect": _[5] = hf(_[5], e);
			}
		}
		return this._dirty = !0, this;
	}
	get bounds() {
		return this.shapePath.bounds;
	}
	getLastPoint(e) {
		let t = this.instructions.length - 1, n = this.instructions[t];
		if (!n) return e.x = 0, e.y = 0, e;
		for (; n.action === "closePath";) {
			if (t--, t < 0) return e.x = 0, e.y = 0, e;
			n = this.instructions[t];
		}
		switch (n.action) {
			case "moveTo":
			case "lineTo":
				e.x = n.data[0], e.y = n.data[1];
				break;
			case "quadraticCurveTo":
				e.x = n.data[2], e.y = n.data[3];
				break;
			case "bezierCurveTo":
				e.x = n.data[4], e.y = n.data[5];
				break;
			case "arc":
			case "arcToSvg":
				e.x = n.data[5], e.y = n.data[6];
				break;
			case "addPath": n.data[0].getLastPoint(e);
		}
		return e;
	}
};
function hf(e, t) {
	return e ? e.prepend(t) : t.clone();
}
var gf = 0, _f = 500;
function vf(...e) {
	gf !== _f && (gf++, gf === _f ? console.warn("PixiJS Warning: too many warnings, no more warnings will be reported to the console by PixiJS.") : console.warn("PixiJS Warning: ", ...e));
}
function yf(e, t, n) {
	let r = e.getAttribute(t);
	return r ? Number(r) : n;
}
function bf(e, t) {
	let n = e.querySelectorAll("defs");
	for (let e = 0; e < n.length; e++) {
		let r = n[e];
		for (let e = 0; e < r.children.length; e++) {
			let n = r.children[e];
			switch (n.nodeName.toLowerCase()) {
				case "lineargradient":
					t.defs[n.id] = xf(n);
					break;
				case "radialgradient": t.defs[n.id] = Sf(n);
			}
		}
	}
}
function xf(e) {
	let t = new wd(yf(e, "x1", 0), yf(e, "y1", 0), yf(e, "x2", 1), yf(e, "y2", 0), (e.getAttribute("gradientUnits") || "objectBoundingBox") === "objectBoundingBox" ? "local" : "global");
	for (let n = 0; n < e.children.length; n++) {
		let r = e.children[n], i = yf(r, "offset", 0), a = z.shared.setValue(r.getAttribute("stop-color")).toNumber();
		t.addColorStop(i, a);
	}
	return t;
}
function Sf(e) {
	return new wd(0, 0, 1, 0);
}
function Cf(e) {
	let t = e.match(/url\s*\(\s*['"]?\s*#([^'"\s)]+)\s*['"]?\s*\)/i);
	return t ? t[1] : "";
}
var wf = {
	fill: {
		type: "paint",
		default: 0
	},
	"fill-opacity": {
		type: "number",
		default: 1
	},
	stroke: {
		type: "paint",
		default: 0
	},
	"stroke-width": {
		type: "number",
		default: 1
	},
	"stroke-opacity": {
		type: "number",
		default: 1
	},
	"stroke-linecap": {
		type: "string",
		default: "butt"
	},
	"stroke-linejoin": {
		type: "string",
		default: "miter"
	},
	"stroke-miterlimit": {
		type: "number",
		default: 10
	},
	"stroke-dasharray": {
		type: "string",
		default: "none"
	},
	"stroke-dashoffset": {
		type: "number",
		default: 0
	},
	opacity: {
		type: "number",
		default: 1
	}
};
function Tf(e, t) {
	let n = e.getAttribute("style"), r = {}, i = {}, a = {
		strokeStyle: r,
		fillStyle: i,
		useFill: !1,
		useStroke: !1
	};
	for (let n in wf) {
		let r = e.getAttribute(n);
		r && Ef(t, a, n, r.trim());
	}
	if (n) {
		let e = n.split(";");
		for (let n = 0; n < e.length; n++) {
			let [r, i] = e[n].trim().split(":");
			wf[r] && Ef(t, a, r, i.trim());
		}
	}
	return {
		strokeStyle: a.useStroke ? r : null,
		fillStyle: a.useFill ? i : null,
		useFill: a.useFill,
		useStroke: a.useStroke
	};
}
function Ef(e, t, n, r) {
	switch (n) {
		case "stroke":
			if (r !== "none") {
				if (r.startsWith("url(")) {
					let n = Cf(r);
					t.strokeStyle.fill = e.defs[n];
				} else t.strokeStyle.color = z.shared.setValue(r).toNumber();
				t.useStroke = !0;
			}
			break;
		case "stroke-width":
			t.strokeStyle.width = Number(r);
			break;
		case "fill":
			if (r !== "none") {
				if (r.startsWith("url(")) {
					let n = Cf(r);
					t.fillStyle.fill = e.defs[n];
				} else t.fillStyle.color = z.shared.setValue(r).toNumber();
				t.useFill = !0;
			}
			break;
		case "fill-opacity":
			t.fillStyle.alpha = Number(r);
			break;
		case "stroke-opacity":
			t.strokeStyle.alpha = Number(r);
			break;
		case "opacity": t.fillStyle.alpha = Number(r), t.strokeStyle.alpha = Number(r);
	}
}
function Df(e) {
	if (e.length <= 2) return !0;
	let t = e.map((e) => e.area).sort((e, t) => t - e), [n, r] = t, i = t[t.length - 1], a = n / r, o = r / i;
	return !(a > 3 && o < 2);
}
function Of(e) {
	return e.split(/(?=[Mm])/).filter((e) => e.trim().length > 0);
}
function kf(e) {
	let t = e.match(/[-+]?[0-9]*\.?[0-9]+/g);
	if (!t || t.length < 4) return 0;
	let n = t.map(Number), r = [], i = [];
	for (let e = 0; e < n.length; e += 2) e + 1 < n.length && (r.push(n[e]), i.push(n[e + 1]));
	if (r.length === 0 || i.length === 0) return 0;
	let a = Math.min(...r), o = Math.max(...r), s = Math.min(...i), c = Math.max(...i);
	return (o - a) * (c - s);
}
function Af(e, t) {
	let n = new mf(e, !1);
	for (let e of n.instructions) t.instructions.push(e);
}
var jf = Object.defineProperty, Mf = Object.getOwnPropertySymbols, Nf = Object.prototype.hasOwnProperty, Pf = Object.prototype.propertyIsEnumerable, Ff = (e, t, n) => t in e ? jf(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, If = (e, t) => {
	for (var n in t ||= {}) Nf.call(t, n) && Ff(e, n, t[n]);
	if (Mf) for (var n of Mf(t)) Pf.call(t, n) && Ff(e, n, t[n]);
	return e;
};
function Lf(e, t) {
	if (typeof e == "string") {
		let t = document.createElement("div");
		t.innerHTML = e.trim(), e = t.querySelector("svg");
	}
	let n = {
		context: t,
		defs: {},
		path: new mf()
	};
	bf(e, n);
	let r = e.children, { fillStyle: i, strokeStyle: a } = Tf(e, n);
	for (let e = 0; e < r.length; e++) {
		let t = r[e];
		t.nodeName.toLowerCase() !== "defs" && Rf(t, n, i, a);
	}
	return t;
}
function Rf(e, t, n, r) {
	let i = e.children, { fillStyle: a, strokeStyle: o } = Tf(e, t);
	a && n ? n = If(If({}, n), a) : a && (n = a), o && r ? r = If(If({}, r), o) : o && (r = o);
	let s = !n && !r;
	s && (n = { color: 0 });
	let c, l, u, d, f, p, m, h, g, _, v, y, b, x, S, C, w;
	switch (e.nodeName.toLowerCase()) {
		case "path": {
			x = e.getAttribute("d");
			let i = e.getAttribute("fill-rule"), a = Of(x), o = i === "evenodd", s = a.length > 1;
			if (o && s) {
				let e = a.map((e) => ({
					path: e,
					area: kf(e)
				}));
				if (e.sort((e, t) => t.area - e.area), a.length > 3 || !Df(e)) for (let i = 0; i < e.length; i++) {
					let a = e[i], o = i === 0;
					t.context.beginPath();
					let s = new mf(void 0, !0);
					Af(a.path, s), t.context.path(s), o ? (n && t.context.fill(n), r && t.context.stroke(r)) : t.context.cut();
				}
				else for (let i = 0; i < e.length; i++) {
					let a = e[i], o = i % 2 == 1;
					t.context.beginPath();
					let s = new mf(void 0, !0);
					Af(a.path, s), t.context.path(s), o ? t.context.cut() : (n && t.context.fill(n), r && t.context.stroke(r));
				}
			} else S = new mf(x, !i || i === "evenodd"), t.context.path(S), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		}
		case "circle":
			m = yf(e, "cx", 0), h = yf(e, "cy", 0), g = yf(e, "r", 0), t.context.ellipse(m, h, g, g), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		case "rect":
			c = yf(e, "x", 0), l = yf(e, "y", 0), C = yf(e, "width", 0), w = yf(e, "height", 0), _ = yf(e, "rx", 0), v = yf(e, "ry", 0), _ || v ? t.context.roundRect(c, l, C, w, _ || v) : t.context.rect(c, l, C, w), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		case "ellipse":
			m = yf(e, "cx", 0), h = yf(e, "cy", 0), _ = yf(e, "rx", 0), v = yf(e, "ry", 0), t.context.beginPath(), t.context.ellipse(m, h, _, v), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		case "line":
			u = yf(e, "x1", 0), d = yf(e, "y1", 0), f = yf(e, "x2", 0), p = yf(e, "y2", 0), t.context.beginPath(), t.context.moveTo(u, d), t.context.lineTo(f, p), r && t.context.stroke(r);
			break;
		case "polygon":
			b = e.getAttribute("points"), y = b.match(/-?\d+/g).map((e) => parseInt(e, 10)), t.context.poly(y, !0), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		case "polyline":
			b = e.getAttribute("points"), y = b.match(/-?\d+/g).map((e) => parseInt(e, 10)), t.context.poly(y, !1), r && t.context.stroke(r);
			break;
		case "g":
		case "svg": break;
		default: vf(`[SVG parser] <${e.nodeName}> elements unsupported`);
	}
	s && (n = null);
	for (let e = 0; e < i.length; e++) Rf(i[e], t, n, r);
}
function zf(e) {
	return e.texture !== void 0;
}
var Bf = {
	repeat: {
		addressModeU: "repeat",
		addressModeV: "repeat"
	},
	"repeat-x": {
		addressModeU: "repeat",
		addressModeV: "clamp-to-edge"
	},
	"repeat-y": {
		addressModeU: "clamp-to-edge",
		addressModeV: "repeat"
	},
	"no-repeat": {
		addressModeU: "clamp-to-edge",
		addressModeV: "clamp-to-edge"
	}
}, Vf = class {
	constructor(e, t) {
		this.uid = H("fillPattern"), this._tick = 0, this.transform = new B();
		let n = zf(e) ? e : {
			texture: e,
			repetition: t
		};
		this.texture = n.texture, this.textureSpace = n.textureSpace ?? "global";
		let r = n.repetition;
		r && (this.texture.source.style.addressModeU = Bf[r].addressModeU, this.texture.source.style.addressModeV = Bf[r].addressModeV);
	}
	setTransform(e) {
		if (e) {
			if (this.transform.equals(e)) return;
			this.transform.copyFrom(e);
		} else {
			if (this.transform.isIdentity()) return;
			this.transform.identity();
		}
		this._tick++;
	}
	get texture() {
		return this._texture;
	}
	set texture(e) {
		this._texture !== e && (this._texture = e, this._tick++);
	}
	get styleKey() {
		return `fill-pattern-${this.uid}-${this._tick}`;
	}
	destroy() {
		this.texture.destroy(!0), this.texture = null;
	}
}, Hf = Object.defineProperty, Uf = Object.getOwnPropertySymbols, Wf = Object.prototype.hasOwnProperty, Gf = Object.prototype.propertyIsEnumerable, Kf = (e, t, n) => t in e ? Hf(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, qf = (e, t) => {
	for (var n in t ||= {}) Wf.call(t, n) && Kf(e, n, t[n]);
	if (Uf) for (var n of Uf(t)) Gf.call(t, n) && Kf(e, n, t[n]);
	return e;
}, Jf = (e, t) => {
	var n = {};
	for (var r in e) Wf.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && Uf) for (var r of Uf(e)) t.indexOf(r) < 0 && Gf.call(e, r) && (n[r] = e[r]);
	return n;
};
function Yf(e) {
	return z.isColorLike(e);
}
function Xf(e) {
	return e instanceof Vf;
}
function Zf(e) {
	return e instanceof wd;
}
function Qf(e) {
	return e instanceof J;
}
function $f(e, t, n) {
	let r = z.shared.setValue(t ?? 0);
	return e.color = r.toNumber(), e.alpha = r.alpha === 1 ? n.alpha : r.alpha, e.texture = J.WHITE, qf(qf({}, n), e);
}
function ep(e, t, n) {
	return e.texture = t, qf(qf({}, n), e);
}
function tp(e, t, n) {
	return e.fill = t, e.color = 16777215, e.texture = t.texture, e.matrix = t.transform, e.textureSpace = t.textureSpace, qf(qf({}, n), e);
}
function np(e, t, n) {
	return t.buildGradient(), e.fill = t, e.color = 16777215, e.texture = t.texture, e.matrix = t.transform, e.textureSpace = t.textureSpace, qf(qf({}, n), e);
}
function rp(e, t) {
	let n = qf(qf({}, t), e), r = z.shared.setValue(n.color);
	return n.alpha *= r.alpha, n.color = r.toNumber(), n;
}
function ip(e, t) {
	if (e == null) return null;
	let n = {}, r = e;
	return Yf(e) ? $f(n, e, t) : Qf(e) ? ep(n, e, t) : Xf(e) ? tp(n, e, t) : Zf(e) ? np(n, e, t) : r.fill && Xf(r.fill) ? tp(r, r.fill, t) : r.fill && Zf(r.fill) ? np(r, r.fill, t) : rp(r, t);
}
function ap(e, t) {
	let n = t, { width: r, alignment: i, miterLimit: a, cap: o, join: s, pixelLine: c } = n, l = ip(e, Jf(n, [
		"width",
		"alignment",
		"miterLimit",
		"cap",
		"join",
		"pixelLine"
	]));
	return l ? qf({
		width: r,
		alignment: i,
		miterLimit: a,
		cap: o,
		join: s,
		pixelLine: c
	}, l) : null;
}
function op(e, t) {
	let n = 1, r = e.shapePath.shapePrimitives;
	for (let e = 0; e < r.length; e++) {
		let i = r[e].shape;
		if (i.type !== "polygon") continue;
		let a = i.points, o = a.length;
		if (o < 6) continue;
		let s = i.closePath;
		for (let e = 0; e < o; e += 2) {
			if (!s && (e === 0 || e === o - 2)) continue;
			let r = (e - 2 + o) % o, i = (e + 2) % o, c = a[r], l = a[r + 1], u = a[e], d = a[e + 1], f = a[i], p = a[i + 1], m = c - u, h = l - d, g = f - u, _ = p - d, v = m * m + h * h, y = g * g + _ * _;
			if (v < 1e-12 || y < 1e-12) continue;
			let b = (m * g + h * _) / Math.sqrt(v * y);
			b < -1 ? b = -1 : b > 1 && (b = 1);
			let x = Math.sqrt((1 - b) * .5);
			if (x < 1e-6) continue;
			let S = Math.min(1 / x, t);
			S > n && (n = S);
		}
	}
	return n;
}
var sp = Object.defineProperty, cp = Object.getOwnPropertySymbols, lp = Object.prototype.hasOwnProperty, up = Object.prototype.propertyIsEnumerable, dp = (e, t, n) => t in e ? sp(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, fp = (e, t) => {
	for (var n in t ||= {}) lp.call(t, n) && dp(e, n, t[n]);
	if (cp) for (var n of cp(t)) up.call(t, n) && dp(e, n, t[n]);
	return e;
}, pp = new Ee(), mp = new B(), hp = class e extends C {
	constructor() {
		super(...arguments), this._gpuData = Object.create(null), this.autoGarbageCollect = !0, this._gcLastUsed = -1, this.uid = H("graphicsContext"), this.dirty = !0, this.batchMode = "auto", this.instructions = [], this.destroyed = !1, this._activePath = new mf(), this._transform = new B(), this._fillStyle = fp({}, e.defaultFillStyle), this._strokeStyle = fp({}, e.defaultStrokeStyle), this._stateStack = [], this._tick = 0, this._bounds = new G(), this._boundsDirty = !0;
	}
	clone() {
		let t = new e();
		return t.batchMode = this.batchMode, t.instructions = this.instructions.slice(), t._activePath = this._activePath.clone(), t._transform = this._transform.clone(), t._fillStyle = fp({}, this._fillStyle), t._strokeStyle = fp({}, this._strokeStyle), t._stateStack = this._stateStack.slice(), t._bounds = this._bounds.clone(), t._boundsDirty = !0, t;
	}
	get fillStyle() {
		return this._fillStyle;
	}
	set fillStyle(t) {
		this._fillStyle = ip(t, e.defaultFillStyle);
	}
	get strokeStyle() {
		return this._strokeStyle;
	}
	set strokeStyle(t) {
		this._strokeStyle = ap(t, e.defaultStrokeStyle);
	}
	setFillStyle(t) {
		return this._fillStyle = ip(t, e.defaultFillStyle), this;
	}
	setStrokeStyle(t) {
		return this._strokeStyle = ip(t, e.defaultStrokeStyle), this;
	}
	texture(e, t, n, r, i, a) {
		return this.instructions.push({
			action: "texture",
			data: {
				image: e,
				dx: n || 0,
				dy: r || 0,
				dw: i || e.frame.width,
				dh: a || e.frame.height,
				transform: this._transform.clone(),
				alpha: this._fillStyle.alpha,
				style: t || t === 0 ? z.shared.setValue(t).toNumber() : 16777215
			}
		}), this.onUpdate(), this;
	}
	beginPath() {
		return this._activePath = new mf(), this;
	}
	fill(t, n) {
		let r, i = this.instructions[this.instructions.length - 1];
		return r = this._tick === 0 && i?.action === "stroke" ? i.data.path : this._activePath.clone(), r ? (t != null && (n !== void 0 && typeof t == "number" && (t = {
			color: t,
			alpha: n
		}), this._fillStyle = ip(t, e.defaultFillStyle)), this.instructions.push({
			action: "fill",
			data: {
				style: this.fillStyle,
				path: r
			}
		}), this.onUpdate(), this._initNextPathLocation(), this._tick = 0, this) : this;
	}
	_initNextPathLocation() {
		let { x: e, y: t } = this._activePath.getLastPoint(Ee.shared);
		this._activePath.clear(), this._activePath.moveTo(e, t);
	}
	stroke(t) {
		let n, r = this.instructions[this.instructions.length - 1];
		return n = this._tick === 0 && r?.action === "fill" ? r.data.path : this._activePath.clone(), n ? (t != null && (this._strokeStyle = ap(t, e.defaultStrokeStyle)), this.instructions.push({
			action: "stroke",
			data: {
				style: this.strokeStyle,
				path: n
			}
		}), this.onUpdate(), this._initNextPathLocation(), this._tick = 0, this) : this;
	}
	cut() {
		for (let e = 0; e < 2; e++) {
			let t = this.instructions[this.instructions.length - 1 - e], n = this._activePath.clone();
			if (t && (t.action === "stroke" || t.action === "fill")) {
				if (t.data.hole) t.data.hole.addPath(n);
				else {
					t.data.hole = n;
					break;
				}
			}
		}
		return this._initNextPathLocation(), this;
	}
	arc(e, t, n, r, i, a) {
		this._tick++;
		let o = this._transform;
		return this._activePath.arc(o.a * e + o.c * t + o.tx, o.b * e + o.d * t + o.ty, n, r, i, a), this;
	}
	arcTo(e, t, n, r, i) {
		this._tick++;
		let a = this._transform;
		return this._activePath.arcTo(a.a * e + a.c * t + a.tx, a.b * e + a.d * t + a.ty, a.a * n + a.c * r + a.tx, a.b * n + a.d * r + a.ty, i), this;
	}
	arcToSvg(e, t, n, r, i, a, o) {
		this._tick++;
		let s = this._transform;
		return this._activePath.arcToSvg(e, t, n, r, i, s.a * a + s.c * o + s.tx, s.b * a + s.d * o + s.ty), this;
	}
	bezierCurveTo(e, t, n, r, i, a, o) {
		this._tick++;
		let s = this._transform;
		return this._activePath.bezierCurveTo(s.a * e + s.c * t + s.tx, s.b * e + s.d * t + s.ty, s.a * n + s.c * r + s.tx, s.b * n + s.d * r + s.ty, s.a * i + s.c * a + s.tx, s.b * i + s.d * a + s.ty, o), this;
	}
	closePath() {
		var e;
		return this._tick++, (e = this._activePath) == null || e.closePath(), this;
	}
	ellipse(e, t, n, r) {
		return this._tick++, this._activePath.ellipse(e, t, n, r, this._transform.clone()), this;
	}
	circle(e, t, n) {
		return this._tick++, this._activePath.circle(e, t, n, this._transform.clone()), this;
	}
	path(e) {
		return this._tick++, this._activePath.addPath(e, this._transform.clone()), this;
	}
	lineTo(e, t) {
		this._tick++;
		let n = this._transform;
		return this._activePath.lineTo(n.a * e + n.c * t + n.tx, n.b * e + n.d * t + n.ty), this;
	}
	moveTo(e, t) {
		this._tick++;
		let n = this._transform, r = this._activePath.instructions, i = n.a * e + n.c * t + n.tx, a = n.b * e + n.d * t + n.ty;
		return r.length === 1 && r[0].action === "moveTo" ? (r[0].data[0] = i, r[0].data[1] = a, this) : (this._activePath.moveTo(i, a), this);
	}
	quadraticCurveTo(e, t, n, r, i) {
		this._tick++;
		let a = this._transform;
		return this._activePath.quadraticCurveTo(a.a * e + a.c * t + a.tx, a.b * e + a.d * t + a.ty, a.a * n + a.c * r + a.tx, a.b * n + a.d * r + a.ty, i), this;
	}
	rect(e, t, n, r) {
		return this._tick++, this._activePath.rect(e, t, n, r, this._transform.clone()), this;
	}
	roundRect(e, t, n, r, i) {
		return this._tick++, this._activePath.roundRect(e, t, n, r, i, this._transform.clone()), this;
	}
	poly(e, t) {
		return this._tick++, this._activePath.poly(e, t, this._transform.clone()), this;
	}
	regularPoly(e, t, n, r, i = 0, a) {
		return this._tick++, this._activePath.regularPoly(e, t, n, r, i, a), this;
	}
	roundPoly(e, t, n, r, i, a) {
		return this._tick++, this._activePath.roundPoly(e, t, n, r, i, a), this;
	}
	roundShape(e, t, n, r) {
		return this._tick++, this._activePath.roundShape(e, t, n, r), this;
	}
	filletRect(e, t, n, r, i) {
		return this._tick++, this._activePath.filletRect(e, t, n, r, i), this;
	}
	chamferRect(e, t, n, r, i, a) {
		return this._tick++, this._activePath.chamferRect(e, t, n, r, i, a), this;
	}
	star(e, t, n, r, i = 0, a = 0) {
		return this._tick++, this._activePath.star(e, t, n, r, i, a, this._transform.clone()), this;
	}
	svg(e) {
		return this._tick++, Lf(e, this), this;
	}
	restore() {
		let e = this._stateStack.pop();
		return e && (this._transform = e.transform, this._fillStyle = e.fillStyle, this._strokeStyle = e.strokeStyle), this;
	}
	save() {
		return this._stateStack.push({
			transform: this._transform.clone(),
			fillStyle: fp({}, this._fillStyle),
			strokeStyle: fp({}, this._strokeStyle)
		}), this;
	}
	getTransform() {
		return this._transform;
	}
	resetTransform() {
		return this._transform.identity(), this;
	}
	rotate(e) {
		return this._transform.rotate(e), this;
	}
	scale(e, t = e) {
		return this._transform.scale(e, t), this;
	}
	setTransform(e, t, n, r, i, a) {
		return e instanceof B ? (this._transform.set(e.a, e.b, e.c, e.d, e.tx, e.ty), this) : (this._transform.set(e, t, n, r, i, a), this);
	}
	transform(e, t, n, r, i, a) {
		return e instanceof B ? (this._transform.append(e), this) : (mp.set(e, t, n, r, i, a), this._transform.append(mp), this);
	}
	translate(e, t = e) {
		return this._transform.translate(e, t), this;
	}
	clear() {
		return this._activePath.clear(), this.instructions.length = 0, this.resetTransform(), this.onUpdate(), this;
	}
	onUpdate() {
		this._boundsDirty = !0, this.dirty = !0, this.emit("update", this, 16);
	}
	get bounds() {
		if (!this._boundsDirty) return this._bounds;
		this._boundsDirty = !1;
		let e = this._bounds;
		e.clear();
		for (let t = 0; t < this.instructions.length; t++) {
			let n = this.instructions[t], r = n.action;
			if (r === "fill") {
				let t = n.data;
				e.addBounds(t.path.bounds);
			} else if (r === "texture") {
				let t = n.data;
				e.addFrame(t.dx, t.dy, t.dx + t.dw, t.dy + t.dh, t.transform);
			}
			if (r === "stroke") {
				let t = n.data, r = t.style.alignment, i = t.style.width * (1 - r);
				t.style.join === "miter" && (i *= op(t.path, t.style.miterLimit));
				let a = t.path.bounds;
				e.addFrame(a.minX - i, a.minY - i, a.maxX + i, a.maxY + i);
			}
		}
		return e.isValid || e.set(0, 0, 0, 0), e;
	}
	containsPoint(e) {
		if (!this.bounds.containsPoint(e.x, e.y)) return !1;
		let t = this.instructions, n = !1;
		for (let r = 0; r < t.length; r++) {
			let i = t[r], a = i.data, o = a.path;
			if (!i.action || !o) continue;
			let s = a.style, c = o.shapePath.shapePrimitives;
			for (let t = 0; t < c.length; t++) {
				let r = c[t].shape;
				if (!s || !r) continue;
				let o = c[t].transform, l = o ? o.applyInverse(e, pp) : e;
				if (i.action === "fill") n = r.contains(l.x, l.y);
				else {
					let e = s;
					n = r.strokeContains(l.x, l.y, e.width, e.alignment);
				}
				let u = a.hole;
				if (u) {
					let e = u.shapePath?.shapePrimitives;
					if (e) for (let t = 0; t < e.length; t++) e[t].shape.contains(l.x, l.y) && (n = !1);
				}
				if (n) return !0;
			}
		}
		return n;
	}
	unload() {
		var e;
		this.emit("unload", this);
		for (let t in this._gpuData) (e = this._gpuData[t]) == null || e.destroy();
		this._gpuData = Object.create(null);
	}
	destroy(e = !1) {
		if (!this.destroyed) {
			if (this.destroyed = !0, this._stateStack.length = 0, this._transform = null, this.unload(), this.emit("destroy", this), this.removeAllListeners(), typeof e == "boolean" ? e : e?.texture) {
				let t = typeof e == "boolean" ? e : e?.textureSource;
				this._fillStyle.texture && (this._fillStyle.fill && "uid" in this._fillStyle.fill ? this._fillStyle.fill.destroy() : this._fillStyle.texture.destroy(t)), this._strokeStyle.texture && (this._strokeStyle.fill && "uid" in this._strokeStyle.fill ? this._strokeStyle.fill.destroy() : this._strokeStyle.texture.destroy(t));
			}
			this._fillStyle = null, this._strokeStyle = null, this.instructions = null, this._activePath = null, this._bounds = null, this._stateStack = null, this.customShader = null, this._transform = null;
		}
	}
};
hp.defaultFillStyle = {
	color: 16777215,
	alpha: 1,
	texture: J.WHITE,
	matrix: null,
	fill: null,
	textureSpace: "local"
}, hp.defaultStrokeStyle = {
	width: 1,
	color: 16777215,
	alpha: 1,
	alignment: .5,
	miterLimit: 10,
	cap: "butt",
	join: "miter",
	texture: J.WHITE,
	matrix: null,
	fill: null,
	textureSpace: "local",
	pixelLine: !1
};
var gp = hp;
function _p(e, t = 1) {
	let n = Zr.RETINA_PREFIX?.exec(e);
	return n ? parseFloat(n[1]) : t;
}
function vp(e, t, n) {
	e.label = n, e._sourceOrigin = n;
	let r = new J({
		source: e,
		label: n
	}), i = () => {
		delete t.promiseCache[n], Ii.has(n) && Ii.remove(n);
	};
	return r.source.once("destroy", () => {
		t.promiseCache[n] && i();
	}), r.once("destroy", () => {
		e.destroyed || i();
	}), r;
}
var yp = Object.defineProperty, bp = Object.getOwnPropertySymbols, xp = Object.prototype.hasOwnProperty, Sp = Object.prototype.propertyIsEnumerable, Cp = (e, t, n) => t in e ? yp(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, wp = (e, t) => {
	for (var n in t ||= {}) xp.call(t, n) && Cp(e, n, t[n]);
	if (bp) for (var n of bp(t)) Sp.call(t, n) && Cp(e, n, t[n]);
	return e;
}, Tp = (e, t) => {
	var n = {};
	for (var r in e) xp.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && bp) for (var r of bp(e)) t.indexOf(r) < 0 && Sp.call(e, r) && (n[r] = e[r]);
	return n;
}, Ep = ".svg", Dp = "image/svg+xml", Op = {
	extension: {
		type: h.LoadParser,
		priority: Ar.Low,
		name: "loadSVG"
	},
	name: "loadSVG",
	id: "svg",
	config: {
		crossOrigin: "anonymous",
		parseAsGraphicsContext: !1
	},
	test(e) {
		return Nc(e, Dp) || Pc(e, Ep);
	},
	async load(e, t, n) {
		return t.data?.parseAsGraphicsContext ?? this.config.parseAsGraphicsContext ? Ap(e) : kp(e, t, n, this.config.crossOrigin);
	},
	unload(e) {
		e.destroy(!0);
	}
};
async function kp(e, t, n, r) {
	let i = await X.get().fetch(e), a = X.get().createImage();
	a.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await i.text())}`, a.crossOrigin = r, await a.decode();
	let o = t.data?.width ?? a.width, s = t.data?.height ?? a.height, c = t.data?.resolution || _p(e), l = Math.ceil(o * c), u = Math.ceil(s * c), d = X.get().createCanvas(l, u), f = d.getContext("2d");
	f.imageSmoothingEnabled = !0, f.imageSmoothingQuality = "high", f.drawImage(a, 0, 0, o * c, s * c);
	let p = t.data ?? {}, { parseAsGraphicsContext: m } = p, h = Tp(p, ["parseAsGraphicsContext"]);
	return vp(new Si(wp({
		resource: d,
		alphaMode: "premultiply-alpha-on-upload",
		resolution: c
	}, h)), n, e);
}
async function Ap(e) {
	let t = await (await X.get().fetch(e)).text(), n = new gp();
	return n.svg(t), n;
}
var jp = "(function(){\"use strict\";const e=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=\";async function a(){try{if(typeof createImageBitmap!=\"function\")return!1;const A=await(await fetch(e)).blob(),t=await createImageBitmap(A);return t.width===1&&t.height===1}catch(A){return!1}}a().then(A=>{self.postMessage(A)})})();\n", Mp = null, Np = class {
	constructor() {
		Mp ||= URL.createObjectURL(new Blob([jp], { type: "application/javascript" })), this.worker = new Worker(Mp);
	}
};
Np.revokeObjectURL = function() {
	Mp &&= (URL.revokeObjectURL(Mp), null);
};
var Pp = "(function(){\"use strict\";async function s(a,t){const e=await fetch(a);if(!e.ok)throw new Error(`[WorkerManager.loadImageBitmap] Failed to fetch ${a}: ${e.status} ${e.statusText}`);const i=await e.blob();return t===\"premultiplied-alpha\"?createImageBitmap(i,{premultiplyAlpha:\"none\"}):createImageBitmap(i)}self.onmessage=async a=>{try{const t=await s(a.data.data[0],a.data.data[1]);self.postMessage({data:t,uuid:a.data.uuid,id:a.data.id},[t])}catch(t){self.postMessage({error:t,uuid:a.data.uuid,id:a.data.id})}}})();\n", Fp = null, Ip = class {
	constructor() {
		Fp ||= URL.createObjectURL(new Blob([Pp], { type: "application/javascript" })), this.worker = new Worker(Fp);
	}
};
Ip.revokeObjectURL = function() {
	Fp &&= (URL.revokeObjectURL(Fp), null);
};
var Lp = 0, Rp, zp = new class {
	constructor() {
		this._initialized = !1, this._createdWorkers = 0, this._workerPool = [], this._queue = [], this._resolveHash = {};
	}
	isImageBitmapSupported() {
		return this._isImageBitmapSupported === void 0 && (this._isImageBitmapSupported = new Promise((e) => {
			let { worker: t } = new Np();
			t.addEventListener("message", (n) => {
				t.terminate(), Np.revokeObjectURL(), e(n.data);
			});
		})), this._isImageBitmapSupported;
	}
	loadImageBitmap(e, t) {
		return this._run("loadImageBitmap", [e, t?.data?.alphaMode]);
	}
	async _initWorkers() {
		this._initialized ||= !0;
	}
	_getWorker() {
		Rp === void 0 && (Rp = navigator.hardwareConcurrency || 4);
		let e = this._workerPool.pop();
		return !e && this._createdWorkers < Rp && (this._createdWorkers++, e = new Ip().worker, e.addEventListener("message", (e) => {
			this._complete(e.data), this._returnWorker(e.target), this._next();
		})), e;
	}
	_returnWorker(e) {
		this._workerPool.push(e);
	}
	_complete(e) {
		this._resolveHash[e.uuid] && (e.error === void 0 ? this._resolveHash[e.uuid].resolve(e.data) : this._resolveHash[e.uuid].reject(e.error), delete this._resolveHash[e.uuid]);
	}
	async _run(e, t) {
		await this._initWorkers();
		let n = new Promise((n, r) => {
			this._queue.push({
				id: e,
				arguments: t,
				resolve: n,
				reject: r
			});
		});
		return this._next(), n;
	}
	_next() {
		if (!this._queue.length) return;
		let e = this._getWorker();
		if (!e) return;
		let t = this._queue.pop(), n = t.id;
		this._resolveHash[Lp] = {
			resolve: t.resolve,
			reject: t.reject
		}, e.postMessage({
			data: t.arguments,
			uuid: Lp++,
			id: n
		});
	}
	reset() {
		this._workerPool.forEach((e) => e.terminate()), this._workerPool.length = 0, Object.values(this._resolveHash).forEach(({ reject: e }) => {
			e?.(/* @__PURE__ */ Error("WorkerManager has been reset before completion"));
		}), this._resolveHash = {}, this._queue.length = 0, this._initialized = !1, this._createdWorkers = 0;
	}
}(), Bp = Object.defineProperty, Vp = Object.getOwnPropertySymbols, Hp = Object.prototype.hasOwnProperty, Up = Object.prototype.propertyIsEnumerable, Wp = (e, t, n) => t in e ? Bp(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Gp = (e, t) => {
	for (var n in t ||= {}) Hp.call(t, n) && Wp(e, n, t[n]);
	if (Vp) for (var n of Vp(t)) Up.call(t, n) && Wp(e, n, t[n]);
	return e;
}, Kp = [
	".jpeg",
	".jpg",
	".png",
	".webp",
	".avif"
], qp = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif"
];
async function Jp(e, t) {
	let n = await X.get().fetch(e);
	if (!n.ok) throw Error(`[loadImageBitmap] Failed to fetch ${e}: ${n.status} ${n.statusText}`);
	let r = await n.blob();
	return t?.data?.alphaMode === "premultiplied-alpha" ? createImageBitmap(r, { premultiplyAlpha: "none" }) : createImageBitmap(r);
}
var Yp = {
	name: "loadTextures",
	id: "texture",
	extension: {
		type: h.LoadParser,
		priority: Ar.High,
		name: "loadTextures"
	},
	config: {
		preferWorkers: !0,
		preferCreateImageBitmap: !0,
		crossOrigin: "anonymous"
	},
	test(e) {
		return Nc(e, qp) || Pc(e, Kp);
	},
	async load(e, t, n) {
		let r = null;
		return r = globalThis.createImageBitmap && this.config.preferCreateImageBitmap ? this.config.preferWorkers && await zp.isImageBitmapSupported() ? await zp.loadImageBitmap(e, t) : await Jp(e, t) : await new Promise((t, n) => {
			r = X.get().createImage(), r.crossOrigin = this.config.crossOrigin, r.src = e, r.complete ? t(r) : (r.onload = () => {
				t(r);
			}, r.onerror = n);
		}), vp(new Si(Gp({
			resource: r,
			alphaMode: "premultiply-alpha-on-upload",
			resolution: t.data?.resolution || _p(e)
		}, t.data)), n, e);
	},
	unload(e) {
		e.destroy(!0);
	}
}, Xp = Object.defineProperty, Zp = Object.defineProperties, Qp = Object.getOwnPropertyDescriptors, $p = Object.getOwnPropertySymbols, em = Object.prototype.hasOwnProperty, tm = Object.prototype.propertyIsEnumerable, nm = (e, t, n) => t in e ? Xp(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, rm = (e, t) => {
	for (var n in t ||= {}) em.call(t, n) && nm(e, n, t[n]);
	if ($p) for (var n of $p(t)) tm.call(t, n) && nm(e, n, t[n]);
	return e;
}, im = (e, t) => Zp(e, Qp(t)), am = [
	".mp4",
	".m4v",
	".webm",
	".ogg",
	".ogv",
	".h264",
	".avi",
	".mov"
], om, sm;
function cm(e, t, n) {
	n === void 0 && !t.startsWith("data:") ? e.crossOrigin = um(t) : n !== !1 && (e.crossOrigin = typeof n == "string" ? n : "anonymous");
}
function lm(e) {
	return new Promise((t, n) => {
		e.addEventListener("canplaythrough", r), e.addEventListener("error", i), e.load();
		function r() {
			a(), t();
		}
		function i(e) {
			a(), n(e);
		}
		function a() {
			e.removeEventListener("canplaythrough", r), e.removeEventListener("error", i);
		}
	});
}
function um(e, t = globalThis.location) {
	if (e.startsWith("data:")) return "";
	t ||= globalThis.location;
	let n = new URL(e, document.baseURI);
	return n.hostname !== t.hostname || n.port !== t.port || n.protocol !== t.protocol ? "anonymous" : "";
}
function dm() {
	let e = [], t = [];
	for (let n of am) {
		let r = Fi.MIME_TYPES[n.substring(1)] || `video/${n.substring(1)}`;
		_c(r) && (e.push(n), t.includes(r) || t.push(r));
	}
	return {
		validVideoExtensions: e,
		validVideoMime: t
	};
}
var fm = {
	name: "loadVideo",
	id: "video",
	extension: {
		type: h.LoadParser,
		name: "loadVideo"
	},
	test(e) {
		if (!om || !sm) {
			let { validVideoExtensions: e, validVideoMime: t } = dm();
			om = e, sm = t;
		}
		let t = Nc(e, sm), n = Pc(e, om);
		return t || n;
	},
	async load(e, t, n) {
		let r = rm(im(rm({}, Fi.defaultOptions), {
			resolution: t.data?.resolution || _p(e),
			alphaMode: t.data?.alphaMode || await wi()
		}), t.data), i = document.createElement("video"), a = {
			preload: r.autoLoad === !1 ? void 0 : "auto",
			"webkit-playsinline": r.playsinline === !1 ? void 0 : "",
			playsinline: r.playsinline === !1 ? void 0 : "",
			muted: r.muted === !0 ? "" : void 0,
			loop: r.loop === !0 ? "" : void 0,
			autoplay: r.autoPlay === !1 ? void 0 : ""
		};
		Object.keys(a).forEach((e) => {
			let t = a[e];
			t !== void 0 && i.setAttribute(e, t);
		}), r.muted === !0 && (i.muted = !0), cm(i, e, r.crossorigin);
		let o = document.createElement("source"), s;
		if (r.mime) s = r.mime;
		else if (e.startsWith("data:")) s = e.slice(5, e.indexOf(";"));
		else if (!e.startsWith("blob:")) {
			let t = e.split("?")[0].slice(e.lastIndexOf(".") + 1).toLowerCase();
			s = Fi.MIME_TYPES[t] || `video/${t}`;
		}
		return o.src = e, s && (o.type = s), new Promise((a, s) => {
			r.preload && !r.autoPlay && i.load(), i.addEventListener("canplay", c), i.addEventListener("error", l), o.addEventListener("error", l), i.appendChild(o);
			async function c() {
				let o = new Fi(im(rm({}, r), { resource: i }));
				u(), t.data.preload && await lm(i), a(vp(o, n, e));
			}
			function l(e) {
				u(), s(e);
			}
			function u() {
				i.removeEventListener("canplay", c), i.removeEventListener("error", l), o.removeEventListener("error", l);
			}
		});
	},
	unload(e) {
		e.destroy(!0);
	}
}, pm = {
	extension: {
		type: h.ResolveParser,
		name: "resolveTexture"
	},
	test: Yp.test,
	parse: (e) => ({
		resolution: parseFloat(Zr.RETINA_PREFIX.exec(e)?.[1] ?? "1"),
		format: e.split(".").pop(),
		src: e
	})
}, mm = {
	extension: {
		type: h.ResolveParser,
		priority: -2,
		name: "resolveJson"
	},
	test: (e) => Zr.RETINA_PREFIX.test(e) && e.endsWith(".json"),
	parse: pm.parse
}, hm = Object.defineProperty, gm = Object.getOwnPropertySymbols, _m = Object.prototype.hasOwnProperty, vm = Object.prototype.propertyIsEnumerable, ym = (e, t, n) => t in e ? hm(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, bm = (e, t) => {
	for (var n in t ||= {}) _m.call(t, n) && ym(e, n, t[n]);
	if (gm) for (var n of gm(t)) vm.call(t, n) && ym(e, n, t[n]);
	return e;
}, xm = new class {
	constructor() {
		this._detections = [], this._initialized = !1, this.resolver = new Zr(), this.loader = new Mc(), this.cache = Ii, this._backgroundLoader = new uc(this.loader), this._backgroundLoader.active = !0, this.reset();
	}
	async init(e = {}) {
		if (this._initialized) return;
		if (this._initialized = !0, e.defaultSearchParams && this.resolver.setDefaultSearchParams(e.defaultSearchParams), e.basePath && (this.resolver.basePath = e.basePath), e.bundleIdentifier && this.resolver.setBundleIdentifier(e.bundleIdentifier), e.manifest) {
			let t = e.manifest;
			typeof t == "string" && (t = await this.load(t)), this.resolver.addManifest(t);
		}
		let t = e.texturePreference?.resolution ?? 1, n = typeof t == "number" ? [t] : t, r = await this._detectFormats({
			preferredFormats: e.texturePreference?.format,
			skipDetections: e.skipDetections,
			detections: this._detections
		});
		this.resolver.prefer({ params: {
			format: r,
			resolution: n
		} }), e.preferences && this.setPreferences(e.preferences), e.loadOptions && (this.loader.loadOptions = bm(bm({}, this.loader.loadOptions), e.loadOptions));
	}
	add(e) {
		this.resolver.add(e);
	}
	async load(e, t) {
		this._initialized || await this.init();
		let n = Vr(e), r = Rr(e).map((e) => {
			if (typeof e != "string") {
				let t = this.resolver.getAlias(e);
				return t.some((e) => !this.resolver.hasKey(e)) && this.add(e), Array.isArray(t) ? t[0] : t;
			}
			return this.resolver.hasKey(e) || this.add({
				alias: e,
				src: e
			}), e;
		}), i = this.resolver.resolve(r), a = await this._mapLoadToResolve(i, t);
		return n ? a[r[0]] : a;
	}
	addBundle(e, t) {
		this.resolver.addBundle(e, t);
	}
	async loadBundle(e, t) {
		this._initialized || await this.init();
		let n = !1;
		typeof e == "string" && (n = !0, e = [e]);
		let r = this.resolver.resolveBundle(e), i = {}, a = Object.keys(r), o = 0, s = [], c = () => {
			t?.(s.reduce((e, t) => e + t, 0) / o);
		}, l = a.map((e, t) => {
			let n = r[e], a = Object.values(n), l = [...new Set(a.flat())].reduce((e, t) => e + (t.progressSize || 1), 0);
			return s.push(0), o += l, this._mapLoadToResolve(n, (e) => {
				s[t] = e * l, c();
			}).then((t) => {
				i[e] = t;
			});
		});
		return await Promise.all(l), n ? i[e[0]] : i;
	}
	async backgroundLoad(e) {
		this._initialized || await this.init(), typeof e == "string" && (e = [e]);
		let t = this.resolver.resolve(e);
		this._backgroundLoader.add(Object.values(t));
	}
	async backgroundLoadBundle(e) {
		this._initialized || await this.init(), typeof e == "string" && (e = [e]);
		let t = this.resolver.resolveBundle(e);
		Object.values(t).forEach((e) => {
			this._backgroundLoader.add(Object.values(e));
		});
	}
	reset() {
		this.resolver.reset(), this.loader.reset(), this.cache.reset(), this._initialized = !1;
	}
	get(e) {
		if (typeof e == "string") return Ii.get(e);
		let t = {};
		for (let n = 0; n < e.length; n++) t[n] = Ii.get(e[n]);
		return t;
	}
	async _mapLoadToResolve(e, t) {
		let n = [...new Set(Object.values(e))];
		this._backgroundLoader.active = !1;
		let r = await this.loader.load(n, t);
		this._backgroundLoader.active = !0;
		let i = {};
		return n.forEach((e) => {
			let t = r[e.src], n = [e.src];
			e.alias && n.push(...e.alias), n.forEach((e) => {
				i[e] = t;
			}), Ii.set(n, t);
		}), i;
	}
	async unload(e) {
		this._initialized || await this.init();
		let t = Rr(e).map((e) => typeof e == "string" ? e : e.src), n = this.resolver.resolve(t);
		await this._unloadFromResolved(n);
	}
	async unloadBundle(e) {
		this._initialized || await this.init(), e = Rr(e);
		let t = this.resolver.resolveBundle(e), n = Object.keys(t).map((e) => this._unloadFromResolved(t[e]));
		await Promise.all(n);
	}
	async _unloadFromResolved(e) {
		let t = Object.values(e);
		t.forEach((e) => {
			Ii.remove(e.src);
		}), await this.loader.unload(t);
	}
	async _detectFormats(e) {
		let t = [];
		e.preferredFormats && (t = Array.isArray(e.preferredFormats) ? e.preferredFormats : [e.preferredFormats]);
		for (let n of e.detections) e.skipDetections || await n.test() ? t = await n.add(t) : e.skipDetections || (t = await n.remove(t));
		return t = t.filter((e, n) => t.indexOf(e) === n), t;
	}
	get detections() {
		return this._detections;
	}
	setPreferences(e) {
		this.loader.parsers.forEach((t) => {
			t.config && Object.keys(t.config).filter((t) => t in e).forEach((n) => {
				t.config[n] = e[n];
			});
		});
	}
}();
v.handleByList(h.LoadParser, xm.loader.parsers).handleByList(h.ResolveParser, xm.resolver.parsers).handleByList(h.CacheParser, xm.cache.parsers).handleByList(h.DetectionParser, xm.detections), v.add(dc, hc, pc, xc, vc, yc, bc, Lc, Bc, rl, Op, Yp, fm, lc, cc, pm, mm);
var Sm = {
	loader: h.LoadParser,
	resolver: h.ResolveParser,
	cache: h.CacheParser,
	detection: h.DetectionParser
};
v.handle(h.Asset, (e) => {
	let t = e.ref;
	Object.entries(Sm).filter(([e]) => !!t[e]).forEach(([e, n]) => v.add(Object.assign(t[e], { extension: t[e].extension ?? n })));
}, (e) => {
	let t = e.ref;
	Object.keys(Sm).filter((e) => !!t[e]).forEach((e) => v.remove(t[e]));
}), h.DetectionParser, h.LoadParser, Ar.High;
var Cm = ((e) => (e[e.DXGI_FORMAT_UNKNOWN = 0] = "DXGI_FORMAT_UNKNOWN", e[e.DXGI_FORMAT_R32G32B32A32_TYPELESS = 1] = "DXGI_FORMAT_R32G32B32A32_TYPELESS", e[e.DXGI_FORMAT_R32G32B32A32_FLOAT = 2] = "DXGI_FORMAT_R32G32B32A32_FLOAT", e[e.DXGI_FORMAT_R32G32B32A32_UINT = 3] = "DXGI_FORMAT_R32G32B32A32_UINT", e[e.DXGI_FORMAT_R32G32B32A32_SINT = 4] = "DXGI_FORMAT_R32G32B32A32_SINT", e[e.DXGI_FORMAT_R32G32B32_TYPELESS = 5] = "DXGI_FORMAT_R32G32B32_TYPELESS", e[e.DXGI_FORMAT_R32G32B32_FLOAT = 6] = "DXGI_FORMAT_R32G32B32_FLOAT", e[e.DXGI_FORMAT_R32G32B32_UINT = 7] = "DXGI_FORMAT_R32G32B32_UINT", e[e.DXGI_FORMAT_R32G32B32_SINT = 8] = "DXGI_FORMAT_R32G32B32_SINT", e[e.DXGI_FORMAT_R16G16B16A16_TYPELESS = 9] = "DXGI_FORMAT_R16G16B16A16_TYPELESS", e[e.DXGI_FORMAT_R16G16B16A16_FLOAT = 10] = "DXGI_FORMAT_R16G16B16A16_FLOAT", e[e.DXGI_FORMAT_R16G16B16A16_UNORM = 11] = "DXGI_FORMAT_R16G16B16A16_UNORM", e[e.DXGI_FORMAT_R16G16B16A16_UINT = 12] = "DXGI_FORMAT_R16G16B16A16_UINT", e[e.DXGI_FORMAT_R16G16B16A16_SNORM = 13] = "DXGI_FORMAT_R16G16B16A16_SNORM", e[e.DXGI_FORMAT_R16G16B16A16_SINT = 14] = "DXGI_FORMAT_R16G16B16A16_SINT", e[e.DXGI_FORMAT_R32G32_TYPELESS = 15] = "DXGI_FORMAT_R32G32_TYPELESS", e[e.DXGI_FORMAT_R32G32_FLOAT = 16] = "DXGI_FORMAT_R32G32_FLOAT", e[e.DXGI_FORMAT_R32G32_UINT = 17] = "DXGI_FORMAT_R32G32_UINT", e[e.DXGI_FORMAT_R32G32_SINT = 18] = "DXGI_FORMAT_R32G32_SINT", e[e.DXGI_FORMAT_R32G8X24_TYPELESS = 19] = "DXGI_FORMAT_R32G8X24_TYPELESS", e[e.DXGI_FORMAT_D32_FLOAT_S8X24_UINT = 20] = "DXGI_FORMAT_D32_FLOAT_S8X24_UINT", e[e.DXGI_FORMAT_R32_FLOAT_X8X24_TYPELESS = 21] = "DXGI_FORMAT_R32_FLOAT_X8X24_TYPELESS", e[e.DXGI_FORMAT_X32_TYPELESS_G8X24_UINT = 22] = "DXGI_FORMAT_X32_TYPELESS_G8X24_UINT", e[e.DXGI_FORMAT_R10G10B10A2_TYPELESS = 23] = "DXGI_FORMAT_R10G10B10A2_TYPELESS", e[e.DXGI_FORMAT_R10G10B10A2_UNORM = 24] = "DXGI_FORMAT_R10G10B10A2_UNORM", e[e.DXGI_FORMAT_R10G10B10A2_UINT = 25] = "DXGI_FORMAT_R10G10B10A2_UINT", e[e.DXGI_FORMAT_R11G11B10_FLOAT = 26] = "DXGI_FORMAT_R11G11B10_FLOAT", e[e.DXGI_FORMAT_R8G8B8A8_TYPELESS = 27] = "DXGI_FORMAT_R8G8B8A8_TYPELESS", e[e.DXGI_FORMAT_R8G8B8A8_UNORM = 28] = "DXGI_FORMAT_R8G8B8A8_UNORM", e[e.DXGI_FORMAT_R8G8B8A8_UNORM_SRGB = 29] = "DXGI_FORMAT_R8G8B8A8_UNORM_SRGB", e[e.DXGI_FORMAT_R8G8B8A8_UINT = 30] = "DXGI_FORMAT_R8G8B8A8_UINT", e[e.DXGI_FORMAT_R8G8B8A8_SNORM = 31] = "DXGI_FORMAT_R8G8B8A8_SNORM", e[e.DXGI_FORMAT_R8G8B8A8_SINT = 32] = "DXGI_FORMAT_R8G8B8A8_SINT", e[e.DXGI_FORMAT_R16G16_TYPELESS = 33] = "DXGI_FORMAT_R16G16_TYPELESS", e[e.DXGI_FORMAT_R16G16_FLOAT = 34] = "DXGI_FORMAT_R16G16_FLOAT", e[e.DXGI_FORMAT_R16G16_UNORM = 35] = "DXGI_FORMAT_R16G16_UNORM", e[e.DXGI_FORMAT_R16G16_UINT = 36] = "DXGI_FORMAT_R16G16_UINT", e[e.DXGI_FORMAT_R16G16_SNORM = 37] = "DXGI_FORMAT_R16G16_SNORM", e[e.DXGI_FORMAT_R16G16_SINT = 38] = "DXGI_FORMAT_R16G16_SINT", e[e.DXGI_FORMAT_R32_TYPELESS = 39] = "DXGI_FORMAT_R32_TYPELESS", e[e.DXGI_FORMAT_D32_FLOAT = 40] = "DXGI_FORMAT_D32_FLOAT", e[e.DXGI_FORMAT_R32_FLOAT = 41] = "DXGI_FORMAT_R32_FLOAT", e[e.DXGI_FORMAT_R32_UINT = 42] = "DXGI_FORMAT_R32_UINT", e[e.DXGI_FORMAT_R32_SINT = 43] = "DXGI_FORMAT_R32_SINT", e[e.DXGI_FORMAT_R24G8_TYPELESS = 44] = "DXGI_FORMAT_R24G8_TYPELESS", e[e.DXGI_FORMAT_D24_UNORM_S8_UINT = 45] = "DXGI_FORMAT_D24_UNORM_S8_UINT", e[e.DXGI_FORMAT_R24_UNORM_X8_TYPELESS = 46] = "DXGI_FORMAT_R24_UNORM_X8_TYPELESS", e[e.DXGI_FORMAT_X24_TYPELESS_G8_UINT = 47] = "DXGI_FORMAT_X24_TYPELESS_G8_UINT", e[e.DXGI_FORMAT_R8G8_TYPELESS = 48] = "DXGI_FORMAT_R8G8_TYPELESS", e[e.DXGI_FORMAT_R8G8_UNORM = 49] = "DXGI_FORMAT_R8G8_UNORM", e[e.DXGI_FORMAT_R8G8_UINT = 50] = "DXGI_FORMAT_R8G8_UINT", e[e.DXGI_FORMAT_R8G8_SNORM = 51] = "DXGI_FORMAT_R8G8_SNORM", e[e.DXGI_FORMAT_R8G8_SINT = 52] = "DXGI_FORMAT_R8G8_SINT", e[e.DXGI_FORMAT_R16_TYPELESS = 53] = "DXGI_FORMAT_R16_TYPELESS", e[e.DXGI_FORMAT_R16_FLOAT = 54] = "DXGI_FORMAT_R16_FLOAT", e[e.DXGI_FORMAT_D16_UNORM = 55] = "DXGI_FORMAT_D16_UNORM", e[e.DXGI_FORMAT_R16_UNORM = 56] = "DXGI_FORMAT_R16_UNORM", e[e.DXGI_FORMAT_R16_UINT = 57] = "DXGI_FORMAT_R16_UINT", e[e.DXGI_FORMAT_R16_SNORM = 58] = "DXGI_FORMAT_R16_SNORM", e[e.DXGI_FORMAT_R16_SINT = 59] = "DXGI_FORMAT_R16_SINT", e[e.DXGI_FORMAT_R8_TYPELESS = 60] = "DXGI_FORMAT_R8_TYPELESS", e[e.DXGI_FORMAT_R8_UNORM = 61] = "DXGI_FORMAT_R8_UNORM", e[e.DXGI_FORMAT_R8_UINT = 62] = "DXGI_FORMAT_R8_UINT", e[e.DXGI_FORMAT_R8_SNORM = 63] = "DXGI_FORMAT_R8_SNORM", e[e.DXGI_FORMAT_R8_SINT = 64] = "DXGI_FORMAT_R8_SINT", e[e.DXGI_FORMAT_A8_UNORM = 65] = "DXGI_FORMAT_A8_UNORM", e[e.DXGI_FORMAT_R1_UNORM = 66] = "DXGI_FORMAT_R1_UNORM", e[e.DXGI_FORMAT_R9G9B9E5_SHAREDEXP = 67] = "DXGI_FORMAT_R9G9B9E5_SHAREDEXP", e[e.DXGI_FORMAT_R8G8_B8G8_UNORM = 68] = "DXGI_FORMAT_R8G8_B8G8_UNORM", e[e.DXGI_FORMAT_G8R8_G8B8_UNORM = 69] = "DXGI_FORMAT_G8R8_G8B8_UNORM", e[e.DXGI_FORMAT_BC1_TYPELESS = 70] = "DXGI_FORMAT_BC1_TYPELESS", e[e.DXGI_FORMAT_BC1_UNORM = 71] = "DXGI_FORMAT_BC1_UNORM", e[e.DXGI_FORMAT_BC1_UNORM_SRGB = 72] = "DXGI_FORMAT_BC1_UNORM_SRGB", e[e.DXGI_FORMAT_BC2_TYPELESS = 73] = "DXGI_FORMAT_BC2_TYPELESS", e[e.DXGI_FORMAT_BC2_UNORM = 74] = "DXGI_FORMAT_BC2_UNORM", e[e.DXGI_FORMAT_BC2_UNORM_SRGB = 75] = "DXGI_FORMAT_BC2_UNORM_SRGB", e[e.DXGI_FORMAT_BC3_TYPELESS = 76] = "DXGI_FORMAT_BC3_TYPELESS", e[e.DXGI_FORMAT_BC3_UNORM = 77] = "DXGI_FORMAT_BC3_UNORM", e[e.DXGI_FORMAT_BC3_UNORM_SRGB = 78] = "DXGI_FORMAT_BC3_UNORM_SRGB", e[e.DXGI_FORMAT_BC4_TYPELESS = 79] = "DXGI_FORMAT_BC4_TYPELESS", e[e.DXGI_FORMAT_BC4_UNORM = 80] = "DXGI_FORMAT_BC4_UNORM", e[e.DXGI_FORMAT_BC4_SNORM = 81] = "DXGI_FORMAT_BC4_SNORM", e[e.DXGI_FORMAT_BC5_TYPELESS = 82] = "DXGI_FORMAT_BC5_TYPELESS", e[e.DXGI_FORMAT_BC5_UNORM = 83] = "DXGI_FORMAT_BC5_UNORM", e[e.DXGI_FORMAT_BC5_SNORM = 84] = "DXGI_FORMAT_BC5_SNORM", e[e.DXGI_FORMAT_B5G6R5_UNORM = 85] = "DXGI_FORMAT_B5G6R5_UNORM", e[e.DXGI_FORMAT_B5G5R5A1_UNORM = 86] = "DXGI_FORMAT_B5G5R5A1_UNORM", e[e.DXGI_FORMAT_B8G8R8A8_UNORM = 87] = "DXGI_FORMAT_B8G8R8A8_UNORM", e[e.DXGI_FORMAT_B8G8R8X8_UNORM = 88] = "DXGI_FORMAT_B8G8R8X8_UNORM", e[e.DXGI_FORMAT_R10G10B10_XR_BIAS_A2_UNORM = 89] = "DXGI_FORMAT_R10G10B10_XR_BIAS_A2_UNORM", e[e.DXGI_FORMAT_B8G8R8A8_TYPELESS = 90] = "DXGI_FORMAT_B8G8R8A8_TYPELESS", e[e.DXGI_FORMAT_B8G8R8A8_UNORM_SRGB = 91] = "DXGI_FORMAT_B8G8R8A8_UNORM_SRGB", e[e.DXGI_FORMAT_B8G8R8X8_TYPELESS = 92] = "DXGI_FORMAT_B8G8R8X8_TYPELESS", e[e.DXGI_FORMAT_B8G8R8X8_UNORM_SRGB = 93] = "DXGI_FORMAT_B8G8R8X8_UNORM_SRGB", e[e.DXGI_FORMAT_BC6H_TYPELESS = 94] = "DXGI_FORMAT_BC6H_TYPELESS", e[e.DXGI_FORMAT_BC6H_UF16 = 95] = "DXGI_FORMAT_BC6H_UF16", e[e.DXGI_FORMAT_BC6H_SF16 = 96] = "DXGI_FORMAT_BC6H_SF16", e[e.DXGI_FORMAT_BC7_TYPELESS = 97] = "DXGI_FORMAT_BC7_TYPELESS", e[e.DXGI_FORMAT_BC7_UNORM = 98] = "DXGI_FORMAT_BC7_UNORM", e[e.DXGI_FORMAT_BC7_UNORM_SRGB = 99] = "DXGI_FORMAT_BC7_UNORM_SRGB", e[e.DXGI_FORMAT_AYUV = 100] = "DXGI_FORMAT_AYUV", e[e.DXGI_FORMAT_Y410 = 101] = "DXGI_FORMAT_Y410", e[e.DXGI_FORMAT_Y416 = 102] = "DXGI_FORMAT_Y416", e[e.DXGI_FORMAT_NV12 = 103] = "DXGI_FORMAT_NV12", e[e.DXGI_FORMAT_P010 = 104] = "DXGI_FORMAT_P010", e[e.DXGI_FORMAT_P016 = 105] = "DXGI_FORMAT_P016", e[e.DXGI_FORMAT_420_OPAQUE = 106] = "DXGI_FORMAT_420_OPAQUE", e[e.DXGI_FORMAT_YUY2 = 107] = "DXGI_FORMAT_YUY2", e[e.DXGI_FORMAT_Y210 = 108] = "DXGI_FORMAT_Y210", e[e.DXGI_FORMAT_Y216 = 109] = "DXGI_FORMAT_Y216", e[e.DXGI_FORMAT_NV11 = 110] = "DXGI_FORMAT_NV11", e[e.DXGI_FORMAT_AI44 = 111] = "DXGI_FORMAT_AI44", e[e.DXGI_FORMAT_IA44 = 112] = "DXGI_FORMAT_IA44", e[e.DXGI_FORMAT_P8 = 113] = "DXGI_FORMAT_P8", e[e.DXGI_FORMAT_A8P8 = 114] = "DXGI_FORMAT_A8P8", e[e.DXGI_FORMAT_B4G4R4A4_UNORM = 115] = "DXGI_FORMAT_B4G4R4A4_UNORM", e[e.DXGI_FORMAT_P208 = 116] = "DXGI_FORMAT_P208", e[e.DXGI_FORMAT_V208 = 117] = "DXGI_FORMAT_V208", e[e.DXGI_FORMAT_V408 = 118] = "DXGI_FORMAT_V408", e[e.DXGI_FORMAT_SAMPLER_FEEDBACK_MIN_MIP_OPAQUE = 119] = "DXGI_FORMAT_SAMPLER_FEEDBACK_MIN_MIP_OPAQUE", e[e.DXGI_FORMAT_SAMPLER_FEEDBACK_MIP_REGION_USED_OPAQUE = 120] = "DXGI_FORMAT_SAMPLER_FEEDBACK_MIP_REGION_USED_OPAQUE", e[e.DXGI_FORMAT_FORCE_UINT = 121] = "DXGI_FORMAT_FORCE_UINT", e))(Cm || {}), wm = ((e) => (e[e.DDS_DIMENSION_TEXTURE1D = 2] = "DDS_DIMENSION_TEXTURE1D", e[e.DDS_DIMENSION_TEXTURE2D = 3] = "DDS_DIMENSION_TEXTURE2D", e[e.DDS_DIMENSION_TEXTURE3D = 6] = "DDS_DIMENSION_TEXTURE3D", e))(wm || {});
function Tm(e) {
	return e.charCodeAt(0) + (e.charCodeAt(1) << 8) + (e.charCodeAt(2) << 16) + (e.charCodeAt(3) << 24);
}
var Em = ((e) => (e[e.UNKNOWN = 0] = "UNKNOWN", e[e.R8G8B8 = 20] = "R8G8B8", e[e.A8R8G8B8 = 21] = "A8R8G8B8", e[e.X8R8G8B8 = 22] = "X8R8G8B8", e[e.R5G6B5 = 23] = "R5G6B5", e[e.X1R5G5B5 = 24] = "X1R5G5B5", e[e.A1R5G5B5 = 25] = "A1R5G5B5", e[e.A4R4G4B4 = 26] = "A4R4G4B4", e[e.R3G3B2 = 27] = "R3G3B2", e[e.A8 = 28] = "A8", e[e.A8R3G3B2 = 29] = "A8R3G3B2", e[e.X4R4G4B4 = 30] = "X4R4G4B4", e[e.A2B10G10R10 = 31] = "A2B10G10R10", e[e.A8B8G8R8 = 32] = "A8B8G8R8", e[e.X8B8G8R8 = 33] = "X8B8G8R8", e[e.G16R16 = 34] = "G16R16", e[e.A2R10G10B10 = 35] = "A2R10G10B10", e[e.A16B16G16R16 = 36] = "A16B16G16R16", e[e.A8P8 = 40] = "A8P8", e[e.P8 = 41] = "P8", e[e.L8 = 50] = "L8", e[e.A8L8 = 51] = "A8L8", e[e.A4L4 = 52] = "A4L4", e[e.V8U8 = 60] = "V8U8", e[e.L6V5U5 = 61] = "L6V5U5", e[e.X8L8V8U8 = 62] = "X8L8V8U8", e[e.Q8W8V8U8 = 63] = "Q8W8V8U8", e[e.V16U16 = 64] = "V16U16", e[e.A2W10V10U10 = 67] = "A2W10V10U10", e[e.Q16W16V16U16 = 110] = "Q16W16V16U16", e[e.R16F = 111] = "R16F", e[e.G16R16F = 112] = "G16R16F", e[e.A16B16G16R16F = 113] = "A16B16G16R16F", e[e.R32F = 114] = "R32F", e[e.G32R32F = 115] = "G32R32F", e[e.A32B32G32R32F = 116] = "A32B32G32R32F", e[e.UYVY = Tm("UYVY")] = "UYVY", e[e.R8G8_B8G8 = Tm("RGBG")] = "R8G8_B8G8", e[e.YUY2 = Tm("YUY2")] = "YUY2", e[e.D3DFMT_G8R8_G8B8 = Tm("GRGB")] = "D3DFMT_G8R8_G8B8", e[e.DXT1 = Tm("DXT1")] = "DXT1", e[e.DXT2 = Tm("DXT2")] = "DXT2", e[e.DXT3 = Tm("DXT3")] = "DXT3", e[e.DXT4 = Tm("DXT4")] = "DXT4", e[e.DXT5 = Tm("DXT5")] = "DXT5", e[e.ATI1 = Tm("ATI1")] = "ATI1", e[e.AT1N = Tm("AT1N")] = "AT1N", e[e.ATI2 = Tm("ATI2")] = "ATI2", e[e.AT2N = Tm("AT2N")] = "AT2N", e[e.BC4U = Tm("BC4U")] = "BC4U", e[e.BC4S = Tm("BC4S")] = "BC4S", e[e.BC5U = Tm("BC5U")] = "BC5U", e[e.BC5S = Tm("BC5S")] = "BC5S", e[e.DX10 = Tm("DX10")] = "DX10", e))(Em || {});
Em.DXT1, Em.DXT2, Em.DXT3, Em.DXT4, Em.DXT5, Em.ATI1, Em.BC4U, Em.BC4S, Em.ATI2, Em.BC5U, Em.BC5S, h.LoadParser, Ar.High;
var Dm = ((e) => (e[e.RGBA8_SNORM = 36759] = "RGBA8_SNORM", e[e.RGBA = 6408] = "RGBA", e[e.RGBA8UI = 36220] = "RGBA8UI", e[e.SRGB8_ALPHA8 = 35907] = "SRGB8_ALPHA8", e[e.RGBA8I = 36238] = "RGBA8I", e[e.RGBA8 = 32856] = "RGBA8", e[e.COMPRESSED_RGB_S3TC_DXT1_EXT = 33776] = "COMPRESSED_RGB_S3TC_DXT1_EXT", e[e.COMPRESSED_RGBA_S3TC_DXT1_EXT = 33777] = "COMPRESSED_RGBA_S3TC_DXT1_EXT", e[e.COMPRESSED_RGBA_S3TC_DXT3_EXT = 33778] = "COMPRESSED_RGBA_S3TC_DXT3_EXT", e[e.COMPRESSED_RGBA_S3TC_DXT5_EXT = 33779] = "COMPRESSED_RGBA_S3TC_DXT5_EXT", e[e.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT = 35917] = "COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT", e[e.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT = 35918] = "COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT", e[e.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT = 35919] = "COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT", e[e.COMPRESSED_SRGB_S3TC_DXT1_EXT = 35916] = "COMPRESSED_SRGB_S3TC_DXT1_EXT", e[e.COMPRESSED_RED_RGTC1_EXT = 36283] = "COMPRESSED_RED_RGTC1_EXT", e[e.COMPRESSED_SIGNED_RED_RGTC1_EXT = 36284] = "COMPRESSED_SIGNED_RED_RGTC1_EXT", e[e.COMPRESSED_RED_GREEN_RGTC2_EXT = 36285] = "COMPRESSED_RED_GREEN_RGTC2_EXT", e[e.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT = 36286] = "COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT", e[e.COMPRESSED_R11_EAC = 37488] = "COMPRESSED_R11_EAC", e[e.COMPRESSED_SIGNED_R11_EAC = 37489] = "COMPRESSED_SIGNED_R11_EAC", e[e.COMPRESSED_RG11_EAC = 37490] = "COMPRESSED_RG11_EAC", e[e.COMPRESSED_SIGNED_RG11_EAC = 37491] = "COMPRESSED_SIGNED_RG11_EAC", e[e.COMPRESSED_RGB8_ETC2 = 37492] = "COMPRESSED_RGB8_ETC2", e[e.COMPRESSED_RGBA8_ETC2_EAC = 37496] = "COMPRESSED_RGBA8_ETC2_EAC", e[e.COMPRESSED_SRGB8_ETC2 = 37493] = "COMPRESSED_SRGB8_ETC2", e[e.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC = 37497] = "COMPRESSED_SRGB8_ALPHA8_ETC2_EAC", e[e.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 37494] = "COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2", e[e.COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 37495] = "COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2", e[e.COMPRESSED_RGBA_ASTC_4x4_KHR = 37808] = "COMPRESSED_RGBA_ASTC_4x4_KHR", e[e.COMPRESSED_RGBA_ASTC_5x4_KHR = 37809] = "COMPRESSED_RGBA_ASTC_5x4_KHR", e[e.COMPRESSED_RGBA_ASTC_5x5_KHR = 37810] = "COMPRESSED_RGBA_ASTC_5x5_KHR", e[e.COMPRESSED_RGBA_ASTC_6x5_KHR = 37811] = "COMPRESSED_RGBA_ASTC_6x5_KHR", e[e.COMPRESSED_RGBA_ASTC_6x6_KHR = 37812] = "COMPRESSED_RGBA_ASTC_6x6_KHR", e[e.COMPRESSED_RGBA_ASTC_8x5_KHR = 37813] = "COMPRESSED_RGBA_ASTC_8x5_KHR", e[e.COMPRESSED_RGBA_ASTC_8x6_KHR = 37814] = "COMPRESSED_RGBA_ASTC_8x6_KHR", e[e.COMPRESSED_RGBA_ASTC_8x8_KHR = 37815] = "COMPRESSED_RGBA_ASTC_8x8_KHR", e[e.COMPRESSED_RGBA_ASTC_10x5_KHR = 37816] = "COMPRESSED_RGBA_ASTC_10x5_KHR", e[e.COMPRESSED_RGBA_ASTC_10x6_KHR = 37817] = "COMPRESSED_RGBA_ASTC_10x6_KHR", e[e.COMPRESSED_RGBA_ASTC_10x8_KHR = 37818] = "COMPRESSED_RGBA_ASTC_10x8_KHR", e[e.COMPRESSED_RGBA_ASTC_10x10_KHR = 37819] = "COMPRESSED_RGBA_ASTC_10x10_KHR", e[e.COMPRESSED_RGBA_ASTC_12x10_KHR = 37820] = "COMPRESSED_RGBA_ASTC_12x10_KHR", e[e.COMPRESSED_RGBA_ASTC_12x12_KHR = 37821] = "COMPRESSED_RGBA_ASTC_12x12_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR = 37840] = "COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR = 37841] = "COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR = 37842] = "COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR = 37843] = "COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR = 37844] = "COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR = 37845] = "COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR = 37846] = "COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR = 37847] = "COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR = 37848] = "COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR = 37849] = "COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR = 37850] = "COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR = 37851] = "COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR = 37852] = "COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR", e[e.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR = 37853] = "COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR", e[e.COMPRESSED_RGBA_BPTC_UNORM_EXT = 36492] = "COMPRESSED_RGBA_BPTC_UNORM_EXT", e[e.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT = 36493] = "COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT", e[e.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT = 36494] = "COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT", e[e.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT = 36495] = "COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT", e))(Dm || {}), Om = ((e) => (e[e.RGBA = 6408] = "RGBA", e[e.RGB = 6407] = "RGB", e[e.RG = 33319] = "RG", e[e.RED = 6403] = "RED", e[e.RGBA_INTEGER = 36249] = "RGBA_INTEGER", e[e.RGB_INTEGER = 36248] = "RGB_INTEGER", e[e.RG_INTEGER = 33320] = "RG_INTEGER", e[e.RED_INTEGER = 36244] = "RED_INTEGER", e[e.ALPHA = 6406] = "ALPHA", e[e.LUMINANCE = 6409] = "LUMINANCE", e[e.LUMINANCE_ALPHA = 6410] = "LUMINANCE_ALPHA", e[e.DEPTH_COMPONENT = 6402] = "DEPTH_COMPONENT", e[e.DEPTH_STENCIL = 34041] = "DEPTH_STENCIL", e))(Om || {}), km = ((e) => (e[e.UNSIGNED_BYTE = 5121] = "UNSIGNED_BYTE", e[e.UNSIGNED_SHORT = 5123] = "UNSIGNED_SHORT", e[e.UNSIGNED_SHORT_5_6_5 = 33635] = "UNSIGNED_SHORT_5_6_5", e[e.UNSIGNED_SHORT_4_4_4_4 = 32819] = "UNSIGNED_SHORT_4_4_4_4", e[e.UNSIGNED_SHORT_5_5_5_1 = 32820] = "UNSIGNED_SHORT_5_5_5_1", e[e.UNSIGNED_INT = 5125] = "UNSIGNED_INT", e[e.UNSIGNED_INT_10F_11F_11F_REV = 35899] = "UNSIGNED_INT_10F_11F_11F_REV", e[e.UNSIGNED_INT_2_10_10_10_REV = 33640] = "UNSIGNED_INT_2_10_10_10_REV", e[e.UNSIGNED_INT_24_8 = 34042] = "UNSIGNED_INT_24_8", e[e.UNSIGNED_INT_5_9_9_9_REV = 35902] = "UNSIGNED_INT_5_9_9_9_REV", e[e.BYTE = 5120] = "BYTE", e[e.SHORT = 5122] = "SHORT", e[e.INT = 5124] = "INT", e[e.FLOAT = 5126] = "FLOAT", e[e.FLOAT_32_UNSIGNED_INT_24_8_REV = 36269] = "FLOAT_32_UNSIGNED_INT_24_8_REV", e[e.HALF_FLOAT = 36193] = "HALF_FLOAT", e))(km || {});
h.LoadParser, Ar.High, h.LoadParser, Ar.High, h.ResolveParser, h.DetectionParser;
var Am = new G(), jm = new B(), Mm = new qe(), Nm = class {
	cull(e, t, n = !0) {
		this._cullRecursive(e, t, n);
	}
	_cullRecursive(e, t, n = !0) {
		if (e.cullable && e.measurable && e.includeInBuild) {
			if (e.cullArea) {
				Mm.x = t.x, Mm.y = t.y, Mm.width = t.width, Mm.height = t.height;
				let r = n ? e.worldTransform : e.getGlobalTransform(jm, n);
				e.culled = !Mm.intersects(e.cullArea, r);
			} else {
				let r = $e(e, n, Am);
				e.culled = r.x >= t.x + t.width || r.y >= t.y + t.height || r.x + r.width <= t.x || r.y + r.height <= t.y;
			}
		} else e.culled = !1;
		if (e.cullableChildren && !e.culled && e.renderable && e.measurable && e.includeInBuild) for (let r = 0; r < e.children.length; r++) this._cullRecursive(e.children[r], t, n);
	}
};
Nm.shared = new Nm(), h.Application, h.Environment;
var Pm = "\nin vec2 vTextureCoord;\n\nout vec4 finalColor;\n\nuniform float uAlpha;\nuniform sampler2D uTexture;\n\nvoid main()\n{\n    finalColor =  texture(uTexture, vTextureCoord) * uAlpha;\n}\n", Fm = "struct GlobalFilterUniforms {\n  uInputSize:vec4<f32>,\n  uInputPixel:vec4<f32>,\n  uInputClamp:vec4<f32>,\n  uOutputFrame:vec4<f32>,\n  uGlobalFrame:vec4<f32>,\n  uOutputTexture:vec4<f32>,\n};\n\nstruct AlphaUniforms {\n  uAlpha:f32,\n};\n\n@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler : sampler;\n\n@group(1) @binding(0) var<uniform> alphaUniforms : AlphaUniforms;\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    @location(0) uv : vec2<f32>\n  };\n\nfn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\nfn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);  \n}\n\nfn getSize() -> vec2<f32>\n{\n  return gfu.uGlobalFrame.zw;\n}\n  \n@vertex\nfn mainVertex(\n  @location(0) aPosition : vec2<f32>, \n) -> VSOutput {\n  return VSOutput(\n   filterVertexPosition(aPosition),\n   filterTextureCoord(aPosition)\n  );\n}\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n  @builtin(position) position: vec4<f32>\n) -> @location(0) vec4<f32> {\n \n    var sample = textureSample(uTexture, uSampler, uv);\n    \n    return sample * alphaUniforms.uAlpha;\n}", Im = Object.defineProperty, Lm = Object.defineProperties, Rm = Object.getOwnPropertyDescriptors, zm = Object.getOwnPropertySymbols, Bm = Object.prototype.hasOwnProperty, Vm = Object.prototype.propertyIsEnumerable, Hm = (e, t, n) => t in e ? Im(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Um = (e, t) => {
	for (var n in t ||= {}) Bm.call(t, n) && Hm(e, n, t[n]);
	if (zm) for (var n of zm(t)) Vm.call(t, n) && Hm(e, n, t[n]);
	return e;
}, Wm = (e, t) => Lm(e, Rm(t)), Gm = (e, t) => {
	var n = {};
	for (var r in e) Bm.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && zm) for (var r of zm(e)) t.indexOf(r) < 0 && Vm.call(e, r) && (n[r] = e[r]);
	return n;
}, Km = class e extends To {
	constructor(t) {
		t = Um(Um({}, e.defaultOptions), t);
		let n = Ga.from({
			vertex: {
				source: Fm,
				entryPoint: "mainVertex"
			},
			fragment: {
				source: Fm,
				entryPoint: "mainFragment"
			}
		}), r = ja.from({
			vertex: Eo,
			fragment: Pm,
			name: "alpha-filter"
		}), i = t, { alpha: a } = i, o = Gm(i, ["alpha"]), s = new io({ uAlpha: {
			value: a,
			type: "f32"
		} });
		super(Wm(Um({}, o), {
			gpuProgram: n,
			glProgram: r,
			resources: { alphaUniforms: s }
		}));
	}
	get alpha() {
		return this.resources.alphaUniforms.uniforms.uAlpha;
	}
	set alpha(e) {
		this.resources.alphaUniforms.uniforms.uAlpha = e;
	}
};
Km.defaultOptions = { alpha: 1 };
var qm = {
	5: [
		.153388,
		.221461,
		.250301
	],
	7: [
		.071303,
		.131514,
		.189879,
		.214607
	],
	9: [
		.028532,
		.067234,
		.124009,
		.179044,
		.20236
	],
	11: [
		.0093,
		.028002,
		.065984,
		.121703,
		.175713,
		.198596
	],
	13: [
		.002406,
		.009255,
		.027867,
		.065666,
		.121117,
		.174868,
		.197641
	],
	15: [
		489e-6,
		.002403,
		.009246,
		.02784,
		.065602,
		.120999,
		.174697,
		.197448
	]
}, Jm = [
	"in vec2 vBlurTexCoords[%size%];",
	"uniform sampler2D uTexture;",
	"out vec4 finalColor;",
	"void main(void)",
	"{",
	"    %blur%",
	"}"
].join("\n");
function Ym(e) {
	let t = qm[e], n = t.length, r = "";
	for (let i = 0; i < e; i++) {
		let a = i === 0 ? "finalColor = " : "    + ", o = i < n ? i : e - i - 1, s = "texture(uTexture, vBlurTexCoords[%index%]) * %value%".replace("%index%", i.toString()).replace("%value%", t[o].toString());
		r += `${a}${s}
`;
	}
	return Jm.replace("%blur%", `${r};`).replace("%size%", e.toString());
}
var Xm = "\n    in vec2 aPosition;\n\n    uniform float uStrength;\n\n    out vec2 vBlurTexCoords[%size%];\n\n    uniform vec4 uInputSize;\n    uniform vec4 uOutputFrame;\n    uniform vec4 uOutputTexture;\n\n    vec4 filterVertexPosition( void )\n{\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\n    vec2 filterTextureCoord( void )\n    {\n        return aPosition * (uOutputFrame.zw * uInputSize.zw);\n    }\n\n    void main(void)\n    {\n        gl_Position = filterVertexPosition();\n\n        float pixelStrength = uInputSize.%dimension% * uStrength;\n\n        vec2 textureCoord = filterTextureCoord();\n        %blur%\n    }";
function Zm(e, t) {
	let n = Math.ceil(e / 2), r = Xm, i = "", a;
	a = t ? "vBlurTexCoords[%index%] =  textureCoord + vec2(%sampleIndex% * pixelStrength, 0.0);" : "vBlurTexCoords[%index%] =  textureCoord + vec2(0.0, %sampleIndex% * pixelStrength);";
	for (let t = 0; t < e; t++) {
		let e = a.replace("%index%", t.toString());
		e = e.replace("%sampleIndex%", `${t - (n - 1)}.0`), i += e, i += "\n";
	}
	return r = r.replace("%blur%", i), r = r.replace("%size%", e.toString()), r = r.replace("%dimension%", t ? "z" : "w"), r;
}
function Qm(e, t) {
	let n = Zm(t, e), r = Ym(t);
	return ja.from({
		vertex: n,
		fragment: r,
		name: `blur-${e ? "horizontal" : "vertical"}-pass-filter`
	});
}
var $m = "\n\nstruct GlobalFilterUniforms {\n  uInputSize:vec4<f32>,\n  uInputPixel:vec4<f32>,\n  uInputClamp:vec4<f32>,\n  uOutputFrame:vec4<f32>,\n  uGlobalFrame:vec4<f32>,\n  uOutputTexture:vec4<f32>,\n};\n\nstruct BlurUniforms {\n  uStrength:f32,\n};\n\n@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler : sampler;\n\n@group(1) @binding(0) var<uniform> blurUniforms : BlurUniforms;\n\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    %blur-struct%\n  };\n\nfn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\nfn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);\n}\n\nfn getSize() -> vec2<f32>\n{\n  return gfu.uGlobalFrame.zw;\n}\n\n\n@vertex\nfn mainVertex(\n  @location(0) aPosition : vec2<f32>,\n) -> VSOutput {\n\n  let filteredCord = filterTextureCoord(aPosition);\n\n  let pixelStrength = gfu.uInputSize.%dimension% * blurUniforms.uStrength;\n\n  return VSOutput(\n   filterVertexPosition(aPosition),\n    %blur-vertex-out%\n  );\n}\n\n@fragment\nfn mainFragment(\n  @builtin(position) position: vec4<f32>,\n  %blur-fragment-in%\n) -> @location(0) vec4<f32> {\n\n    var   finalColor = vec4(0.0);\n\n    %blur-sampling%\n\n    return finalColor;\n}\n";
function eh(e, t) {
	let n = qm[t], r = n.length, i = [], a = [], o = [];
	for (let s = 0; s < t; s++) {
		i[s] = `@location(${s}) offset${s}: vec2<f32>,`, e ? a[s] = `filteredCord + vec2(${s - r + 1} * pixelStrength, 0.0),` : a[s] = `filteredCord + vec2(0.0, ${s - r + 1} * pixelStrength),`;
		let c = n[s < r ? s : t - s - 1].toString();
		o[s] = `finalColor += textureSample(uTexture, uSampler, offset${s}) * ${c};`;
	}
	let s = i.join("\n"), c = a.join("\n"), l = o.join("\n"), u = $m.replace("%blur-struct%", s).replace("%blur-vertex-out%", c).replace("%blur-fragment-in%", s).replace("%blur-sampling%", l).replace("%dimension%", e ? "z" : "w");
	return Ga.from({
		vertex: {
			source: u,
			entryPoint: "mainVertex"
		},
		fragment: {
			source: u,
			entryPoint: "mainFragment"
		}
	});
}
var th = Object.defineProperty, nh = Object.getOwnPropertySymbols, rh = Object.prototype.hasOwnProperty, ih = Object.prototype.propertyIsEnumerable, ah = (e, t, n) => t in e ? th(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, oh = (e, t) => {
	for (var n in t ||= {}) rh.call(t, n) && ah(e, n, t[n]);
	if (nh) for (var n of nh(t)) ih.call(t, n) && ah(e, n, t[n]);
	return e;
}, sh = class e extends To {
	constructor(t) {
		t = oh(oh({}, e.defaultOptions), t);
		let n = Qm(t.horizontal, t.kernelSize), r = eh(t.horizontal, t.kernelSize);
		super(oh({
			glProgram: n,
			gpuProgram: r,
			resources: { blurUniforms: { uStrength: {
				value: 0,
				type: "f32"
			} } }
		}, t)), this.horizontal = t.horizontal, this.legacy = t.legacy ?? !1, this._quality = 0, this.quality = t.quality, this.blur = t.strength, this._blurUniforms = this.resources.blurUniforms, this._uniforms = this._blurUniforms.uniforms;
	}
	apply(e, t, n, r) {
		this.legacy ? this._applyLegacy(e, t, n, r) : this._applyOptimized(e, t, n, r);
	}
	_applyLegacy(e, t, n, r) {
		if (this._uniforms.uStrength = this.strength / this.passes, this.passes === 1) e.applyFilter(this, t, n, r);
		else {
			let i = hn.getSameSizeTexture(t), a = t, o = i;
			this._state.blend = !1;
			let s = e.renderer.type === qa.WEBGPU;
			for (let t = 0; t < this.passes - 1; t++) {
				e.applyFilter(this, a, o, t === 0 || s);
				let n = o;
				o = a, a = n;
			}
			this._state.blend = !0, e.applyFilter(this, a, n, r), hn.returnTexture(i);
		}
	}
	_applyOptimized(e, t, n, r) {
		if (this._uniforms.uStrength = this._calculateInitialStrength(), this.passes === 1) e.applyFilter(this, t, n, r);
		else {
			let i = hn.getSameSizeTexture(t), a = t, o = i;
			this._state.blend = !1;
			let s = e.renderer, c = s.type === qa.WEBGPU, l = c ? s.renderPipes.uniformBatch : null;
			for (let t = 0; t < this.passes - 1; t++) {
				l && this.groups[1].setResource(l.getUboResource(this._blurUniforms), 0), e.applyFilter(this, a, o, c);
				let t = o;
				o = a, a = t, this._uniforms.uStrength *= .5;
			}
			l && this.groups[1].setResource(l.getUboResource(this._blurUniforms), 0), this._state.blend = !0, e.applyFilter(this, a, n, r), hn.returnTexture(i);
		}
	}
	_calculateInitialStrength() {
		let e = 1, t = .5;
		for (let n = 1; n < this.passes; n++) e += t * t, t *= .5;
		return this.strength / Math.sqrt(e);
	}
	get blur() {
		return this.strength;
	}
	set blur(e) {
		this.padding = 1 + Math.abs(e) * 2, this.strength = e;
	}
	get quality() {
		return this._quality;
	}
	set quality(e) {
		this._quality = e, this.passes = e;
	}
};
sh.defaultOptions = {
	strength: 8,
	quality: 4,
	kernelSize: 5,
	legacy: !1
};
var ch = sh, lh = Object.defineProperty, uh = Object.defineProperties, dh = Object.getOwnPropertyDescriptors, fh = Object.getOwnPropertySymbols, ph = Object.prototype.hasOwnProperty, mh = Object.prototype.propertyIsEnumerable, hh = (e, t, n) => t in e ? lh(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, gh = (e, t) => {
	for (var n in t ||= {}) ph.call(t, n) && hh(e, n, t[n]);
	if (fh) for (var n of fh(t)) mh.call(t, n) && hh(e, n, t[n]);
	return e;
}, _h = (e, t) => uh(e, dh(t)), vh = (e, t) => {
	var n = {};
	for (var r in e) ph.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && fh) for (var r of fh(e)) t.indexOf(r) < 0 && mh.call(e, r) && (n[r] = e[r]);
	return n;
}, yh = class extends To {
	constructor(...e) {
		let t = e[0] ?? {};
		typeof t == "number" && (t = { strength: t }, e[1] !== void 0 && (t.quality = e[1]), e[2] !== void 0 && (t.resolution = e[2] || "inherit"), e[3] !== void 0 && (t.kernelSize = e[3])), t = gh(gh({}, ch.defaultOptions), t);
		let n = t, { strength: r, strengthX: i, strengthY: a, quality: o } = n, s = vh(n, [
			"strength",
			"strengthX",
			"strengthY",
			"quality"
		]);
		super(_h(gh({}, s), {
			compatibleRenderers: qa.BOTH,
			resources: {}
		})), this._repeatEdgePixels = !1, this.blurXFilter = new ch(gh({ horizontal: !0 }, t)), this.blurYFilter = new ch(gh({ horizontal: !1 }, t)), this.quality = o, this.strengthX = i ?? r, this.strengthY = a ?? r, this.repeatEdgePixels = !1;
	}
	apply(e, t, n, r) {
		let i = Math.abs(this.blurXFilter.strength), a = Math.abs(this.blurYFilter.strength);
		if (i && a) {
			let i = hn.getSameSizeTexture(t);
			this.blurXFilter.blendMode = "normal", this.blurXFilter.apply(e, t, i, !0), this.blurYFilter.blendMode = this.blendMode, this.blurYFilter.apply(e, i, n, r), hn.returnTexture(i);
		} else a ? (this.blurYFilter.blendMode = this.blendMode, this.blurYFilter.apply(e, t, n, r)) : (this.blurXFilter.blendMode = this.blendMode, this.blurXFilter.apply(e, t, n, r));
	}
	updatePadding() {
		this.padding = this._repeatEdgePixels ? 0 : Math.max(Math.abs(this.blurXFilter.blur), Math.abs(this.blurYFilter.blur)) * 2;
	}
	get strength() {
		if (this.strengthX !== this.strengthY) throw Error("BlurFilter's strengthX and strengthY are different");
		return this.strengthX;
	}
	set strength(e) {
		this.blurXFilter.blur = this.blurYFilter.blur = e, this.updatePadding();
	}
	get quality() {
		return this.blurXFilter.quality;
	}
	set quality(e) {
		this.blurXFilter.quality = this.blurYFilter.quality = e;
	}
	get strengthX() {
		return this.blurXFilter.blur;
	}
	set strengthX(e) {
		this.blurXFilter.blur = e, this.updatePadding();
	}
	get strengthY() {
		return this.blurYFilter.blur;
	}
	set strengthY(e) {
		this.blurYFilter.blur = e, this.updatePadding();
	}
	get blur() {
		return this.strength;
	}
	set blur(e) {
		this.strength = e;
	}
	get blurX() {
		return this.strengthX;
	}
	set blurX(e) {
		this.strengthX = e;
	}
	get blurY() {
		return this.strengthY;
	}
	set blurY(e) {
		this.strengthY = e;
	}
	get repeatEdgePixels() {
		return this._repeatEdgePixels;
	}
	set repeatEdgePixels(e) {
		this._repeatEdgePixels = e, this.updatePadding();
	}
};
yh.defaultOptions = {
	strength: 8,
	quality: 4,
	kernelSize: 5,
	legacy: !1
};
var bh = "\nin vec2 vTextureCoord;\nin vec4 vColor;\n\nout vec4 finalColor;\n\nuniform float uNoise;\nuniform float uSeed;\nuniform sampler2D uTexture;\n\nfloat rand(vec2 co)\n{\n    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);\n}\n\nvoid main()\n{\n    vec4 color = texture(uTexture, vTextureCoord);\n    float randomValue = rand(gl_FragCoord.xy * uSeed);\n    float diff = (randomValue - 0.5) *  uNoise;\n\n    // Un-premultiply alpha before applying the color matrix. See issue #3539.\n    if (color.a > 0.0) {\n        color.rgb /= color.a;\n    }\n\n    color.r += diff;\n    color.g += diff;\n    color.b += diff;\n\n    // Premultiply alpha again.\n    color.rgb *= color.a;\n\n    finalColor = color;\n}\n", xh = "\n\nstruct GlobalFilterUniforms {\n  uInputSize:vec4<f32>,\n  uInputPixel:vec4<f32>,\n  uInputClamp:vec4<f32>,\n  uOutputFrame:vec4<f32>,\n  uGlobalFrame:vec4<f32>,\n  uOutputTexture:vec4<f32>,\n};\n\nstruct NoiseUniforms {\n  uNoise:f32,\n  uSeed:f32,\n};\n\n@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler : sampler;\n\n@group(1) @binding(0) var<uniform> noiseUniforms : NoiseUniforms;\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    @location(0) uv : vec2<f32>\n  };\n\nfn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\nfn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);  \n}\n\nfn getSize() -> vec2<f32>\n{\n  return gfu.uGlobalFrame.zw;\n}\n  \n@vertex\nfn mainVertex(\n  @location(0) aPosition : vec2<f32>, \n) -> VSOutput {\n  return VSOutput(\n   filterVertexPosition(aPosition),\n   filterTextureCoord(aPosition)\n  );\n}\n\nfn rand(co:vec2<f32>) -> f32\n{\n  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);\n}\n\n\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n  @builtin(position) position: vec4<f32>\n) -> @location(0) vec4<f32> {\n\n    var pixelPosition =  globalTextureCoord(position.xy);// / (getSize());//-  gfu.uOutputFrame.xy);\n  \n    \n    var sample = textureSample(uTexture, uSampler, uv);\n    var randomValue =  rand(pixelPosition.xy * noiseUniforms.uSeed);\n    var diff = (randomValue - 0.5) * noiseUniforms.uNoise;\n  \n    // Un-premultiply alpha before applying the color matrix. See issue #3539.\n    if (sample.a > 0.0) {\n      sample.r /= sample.a;\n      sample.g /= sample.a;\n      sample.b /= sample.a;\n    }\n\n    sample.r += diff;\n    sample.g += diff;\n    sample.b += diff;\n\n    // Premultiply alpha again.\n    sample.r *= sample.a;\n    sample.g *= sample.a;\n    sample.b *= sample.a;\n    \n    return sample;\n}", Sh = Object.defineProperty, Ch = Object.defineProperties, wh = Object.getOwnPropertyDescriptors, Th = Object.getOwnPropertySymbols, Eh = Object.prototype.hasOwnProperty, Dh = Object.prototype.propertyIsEnumerable, Oh = (e, t, n) => t in e ? Sh(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, kh = (e, t) => {
	for (var n in t ||= {}) Eh.call(t, n) && Oh(e, n, t[n]);
	if (Th) for (var n of Th(t)) Dh.call(t, n) && Oh(e, n, t[n]);
	return e;
}, Ah = (e, t) => Ch(e, wh(t)), jh = (e, t) => {
	var n = {};
	for (var r in e) Eh.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && Th) for (var r of Th(e)) t.indexOf(r) < 0 && Dh.call(e, r) && (n[r] = e[r]);
	return n;
}, Mh = class e extends To {
	constructor(t = {}) {
		t = kh(kh({}, e.defaultOptions), t);
		let n = Ga.from({
			vertex: {
				source: xh,
				entryPoint: "mainVertex"
			},
			fragment: {
				source: xh,
				entryPoint: "mainFragment"
			}
		}), r = ja.from({
			vertex: Eo,
			fragment: bh,
			name: "noise-filter"
		}), i = t, { noise: a, seed: o } = i, s = jh(i, ["noise", "seed"]);
		super(Ah(kh({}, s), {
			gpuProgram: n,
			glProgram: r,
			resources: { noiseUniforms: new io({
				uNoise: {
					value: 1,
					type: "f32"
				},
				uSeed: {
					value: 1,
					type: "f32"
				}
			}) }
		})), this.noise = a, this.seed = o ?? Math.random();
	}
	get noise() {
		return this.resources.noiseUniforms.uniforms.uNoise;
	}
	set noise(e) {
		this.resources.noiseUniforms.uniforms.uNoise = e;
	}
	get seed() {
		return this.resources.noiseUniforms.uniforms.uSeed;
	}
	set seed(e) {
		this.resources.noiseUniforms.uniforms.uSeed = e;
	}
};
Mh.defaultOptions = { noise: .5 };
var Nh = "in vec2 vMaskCoord;\nin vec2 vTextureCoord;\n\nuniform sampler2D uTexture;\nuniform sampler2D uMaskTexture;\n\nuniform float uAlpha;\nuniform vec4 uMaskClamp;\nuniform float uInverse;\nuniform float uChannel;\n\nout vec4 finalColor;\n\nvoid main(void)\n{\n    float clip = step(3.5,\n        step(uMaskClamp.x, vMaskCoord.x) +\n        step(uMaskClamp.y, vMaskCoord.y) +\n        step(vMaskCoord.x, uMaskClamp.z) +\n        step(vMaskCoord.y, uMaskClamp.w));\n\n    // TODO look into why this is needed\n    float npmAlpha = uAlpha;\n    vec4 original = texture(uTexture, vTextureCoord);\n    vec4 masky = texture(uMaskTexture, vMaskCoord);\n\n    float a;\n    if (uChannel == 1.0) {\n        a = masky.a * npmAlpha * clip;\n    } else {\n        float alphaMul = 1.0 - npmAlpha * (1.0 - masky.a);\n        a = alphaMul * masky.r * npmAlpha * clip;\n    }\n\n    if (uInverse == 1.0) {\n        a = 1.0 - a;\n    }\n\n    finalColor = original * a;\n}\n", Ph = "in vec2 aPosition;\n\nout vec2 vTextureCoord;\nout vec2 vMaskCoord;\n\n\nuniform vec4 uInputSize;\nuniform vec4 uOutputFrame;\nuniform vec4 uOutputTexture;\nuniform mat3 uFilterMatrix;\n\nvec4 filterVertexPosition(  vec2 aPosition )\n{\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n       \n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nvec2 filterTextureCoord(  vec2 aPosition )\n{\n    return aPosition * (uOutputFrame.zw * uInputSize.zw);\n}\n\nvec2 getFilterCoord( vec2 aPosition )\n{\n    return  ( uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;\n}   \n\nvoid main(void)\n{\n    gl_Position = filterVertexPosition(aPosition);\n    vTextureCoord = filterTextureCoord(aPosition);\n    vMaskCoord = getFilterCoord(aPosition);\n}\n", Fh = "struct GlobalFilterUniforms {\n  uInputSize:vec4<f32>,\n  uInputPixel:vec4<f32>,\n  uInputClamp:vec4<f32>,\n  uOutputFrame:vec4<f32>,\n  uGlobalFrame:vec4<f32>,\n  uOutputTexture:vec4<f32>,\n};\n\nstruct MaskUniforms {\n  uFilterMatrix:mat3x3<f32>,\n  uMaskClamp:vec4<f32>,\n  uAlpha:f32,\n  uInverse:f32,\n  uChannel:f32,\n};\n\n@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler : sampler;\n\n@group(1) @binding(0) var<uniform> filterUniforms : MaskUniforms;\n@group(1) @binding(1) var uMaskTexture: texture_2d<f32>;\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    @location(0) uv : vec2<f32>,\n    @location(1) filterUv : vec2<f32>,\n};\n\nfn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\nfn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);\n}\n\nfn getFilterCoord(aPosition:vec2<f32> ) -> vec2<f32>\n{\n  return ( filterUniforms.uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;\n}\n\nfn getSize() -> vec2<f32>\n{\n  return gfu.uGlobalFrame.zw;\n}\n\n@vertex\nfn mainVertex(\n  @location(0) aPosition : vec2<f32>,\n) -> VSOutput {\n  return VSOutput(\n   filterVertexPosition(aPosition),\n   filterTextureCoord(aPosition),\n   getFilterCoord(aPosition)\n  );\n}\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n  @location(1) filterUv: vec2<f32>,\n  @builtin(position) position: vec4<f32>\n) -> @location(0) vec4<f32> {\n\n    var maskClamp = filterUniforms.uMaskClamp;\n    var uAlpha = filterUniforms.uAlpha;\n\n    var clip = step(3.5,\n      step(maskClamp.x, filterUv.x) +\n      step(maskClamp.y, filterUv.y) +\n      step(filterUv.x, maskClamp.z) +\n      step(filterUv.y, maskClamp.w));\n\n    var mask = textureSample(uMaskTexture, uSampler, filterUv);\n    var source = textureSample(uTexture, uSampler, uv);\n\n    var a: f32;\n    if (filterUniforms.uChannel == 1.0) {\n        a = mask.a * uAlpha * clip;\n    } else {\n        var alphaMul = 1.0 - uAlpha * (1.0 - mask.a);\n        a = alphaMul * mask.r * uAlpha * clip;\n    }\n\n    if (filterUniforms.uInverse == 1.0) {\n        a = 1.0 - a;\n    }\n\n    return source * a;\n}\n", Ih = Object.defineProperty, Lh = Object.defineProperties, Rh = Object.getOwnPropertyDescriptors, zh = Object.getOwnPropertySymbols, Bh = Object.prototype.hasOwnProperty, Vh = Object.prototype.propertyIsEnumerable, Hh = (e, t, n) => t in e ? Ih(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Uh = (e, t) => {
	for (var n in t ||= {}) Bh.call(t, n) && Hh(e, n, t[n]);
	if (zh) for (var n of zh(t)) Vh.call(t, n) && Hh(e, n, t[n]);
	return e;
}, Wh = (e, t) => Lh(e, Rh(t)), Gh = (e, t) => {
	var n = {};
	for (var r in e) Bh.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && zh) for (var r of zh(e)) t.indexOf(r) < 0 && Vh.call(e, r) && (n[r] = e[r]);
	return n;
}, Kh = class extends To {
	constructor(e) {
		let t = e, { sprite: n } = t, r = Gh(t, ["sprite"]), i = new rn(n.texture), a = new io({
			uFilterMatrix: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uMaskClamp: {
				value: i.uClampFrame,
				type: "vec4<f32>"
			},
			uAlpha: {
				value: 1,
				type: "f32"
			},
			uInverse: {
				value: +!!e.inverse,
				type: "f32"
			},
			uChannel: {
				value: +(e.channel === "alpha"),
				type: "f32"
			}
		}), o = Ga.from({
			vertex: {
				source: Fh,
				entryPoint: "mainVertex"
			},
			fragment: {
				source: Fh,
				entryPoint: "mainFragment"
			}
		}), s = ja.from({
			vertex: Ph,
			fragment: Nh,
			name: "mask-filter"
		});
		super(Wh(Uh({}, r), {
			gpuProgram: o,
			glProgram: s,
			clipToViewport: !1,
			resources: {
				filterUniforms: a,
				uMaskTexture: n.texture.source
			}
		})), this.sprite = n, this._textureMatrix = i;
	}
	set inverse(e) {
		this.resources.filterUniforms.uniforms.uInverse = +!!e;
	}
	get inverse() {
		return this.resources.filterUniforms.uniforms.uInverse === 1;
	}
	set channel(e) {
		this.resources.filterUniforms.uniforms.uChannel = +(e === "alpha");
	}
	get channel() {
		return this.resources.filterUniforms.uniforms.uChannel === 1 ? "alpha" : "red";
	}
	apply(e, t, n, r) {
		this._textureMatrix.texture = this.sprite.texture, e.calculateSpriteMatrix(this.resources.filterUniforms.uniforms.uFilterMatrix, this.sprite).prepend(this._textureMatrix.mapCoord), this.resources.uMaskTexture = this.sprite.texture.source, e.applyFilter(this, t, n, r);
	}
}, qh = class e {
	constructor(t) {
		this._tick = () => {
			this._destroyed || (this.timeout = setTimeout(this._processQueue, 0));
		}, this._processQueue = () => {
			if (this._destroyed) return;
			let { queue: t } = this, n = 0;
			for (; t.length && n < e.uploadsPerFrame;) {
				let e = t.shift();
				this.uploadQueueItem(e), n++;
			}
			t.length ? Tn.system.addOnce(this._tick, this, Sn.UTILITY) : this._resolve();
		}, this.renderer = t, this.queue = [], this.resolves = [];
	}
	getQueue() {
		return [...this.queue];
	}
	add(e) {
		let t = Array.isArray(e) ? e : [e];
		for (let e of t) e instanceof Y ? this._addContainer(e) : this.resolveQueueItem(e, this.queue);
		return this;
	}
	_addContainer(e) {
		this.resolveQueueItem(e, this.queue);
		for (let t of e.children) this._addContainer(t);
	}
	upload(e) {
		return e && this.add(e), new Promise((e) => {
			this.queue.length ? (this.resolves.push(e), this.dedupeQueue(), Tn.system.addOnce(this._tick, this, Sn.UTILITY)) : e();
		});
	}
	dedupeQueue() {
		let e = Object.create(null), t = 0;
		for (let n = 0; n < this.queue.length; n++) {
			let r = this.queue[n];
			e[r.uid] || (e[r.uid] = !0, this.queue[t++] = r);
		}
		this.queue.length = t;
	}
	destroy() {
		this._destroyed = !0, clearTimeout(this.timeout);
	}
	_resolve() {
		let { resolves: e } = this, t = e.slice(0);
		e.length = 0;
		for (let e of t) e();
	}
};
qh.uploadsPerFrame = 4;
var Jh = qh, Yh = class {
	constructor() {
		this.isBatchable = !1;
	}
	reset() {
		this.isBatchable = !1, this.context = null, this.graphicsData &&= (this.graphicsData.destroy(), null);
	}
	destroy() {
		this.reset();
	}
}, Xh = class {
	constructor() {
		this.instructions = new ht();
	}
	init() {
		this.instructions.reset();
	}
	destroy() {
		this.instructions.destroy(), this.instructions = null;
	}
}, Zh = class e {
	constructor(e) {
		this._renderer = e, this._managedContexts = new Bu({
			renderer: e,
			type: "resource",
			name: "graphicsContext"
		});
	}
	init(t) {
		e.defaultOptions.bezierSmoothness = t?.bezierSmoothness ?? e.defaultOptions.bezierSmoothness;
	}
	getContextRenderData(e) {
		return this.getGpuContext(e).graphicsData || this._initContextRenderData(e);
	}
	updateGpuContext(e) {
		let t = e._gpuData, n = !!t[this._renderer.uid], r = t[this._renderer.uid] || this._initContext(e);
		return (e.dirty || !n) && (n && r.reset(), r.isBatchable = !1, e.dirty = !1), r;
	}
	getGpuContext(e) {
		return e._gpuData[this._renderer.uid] || this._initContext(e);
	}
	_initContextRenderData(e) {
		let t = new Xh(), n = this.getGpuContext(e);
		return n.graphicsData = t, t.init(), t;
	}
	_initContext(e) {
		let t = new Yh();
		return t.context = e, e._gpuData[this._renderer.uid] = t, this._managedContexts.add(e), t;
	}
	destroy() {
		this._managedContexts.destroy(), this._renderer = null;
	}
};
Zh.extension = {
	type: [h.CanvasSystem],
	name: "graphicsContext"
}, Zh.defaultOptions = { bezierSmoothness: .5 };
var Qh = Zh, $h = class {
	constructor(e, t) {
		this.state = go.for2d(), this.renderer = e, this._adaptor = t, this.renderer.runners.contextChange.add(this), this._managedGraphics = new Bu({
			renderer: e,
			type: "renderable",
			priority: -1,
			name: "graphics"
		});
	}
	contextChange() {
		this._adaptor.contextChange(this.renderer);
	}
	validateRenderable(e) {
		return !1;
	}
	addRenderable(e, t) {
		this._managedGraphics.add(e), this.renderer.renderPipes.batch.break(t), t.add(e);
	}
	updateRenderable(e) {}
	execute(e) {
		e.isRenderable && this._adaptor.execute(this, e);
	}
	destroy() {
		this._managedGraphics.destroy(), this.renderer = null, this._adaptor.destroy(), this._adaptor = null;
	}
};
$h.extension = {
	type: [h.CanvasPipes],
	name: "graphics"
};
function eg(e, t, n) {
	let r = (e >> 24 & 255) / 255;
	t[n++] = (e & 255) / 255 * r, t[n++] = (e >> 8 & 255) / 255 * r, t[n++] = (e >> 16 & 255) / 255 * r, t[n++] = r;
}
var tg = class {
	constructor() {
		this.batches = [], this.batched = !1;
	}
	destroy() {
		this.batches.forEach((e) => {
			U.return(e);
		}), this.batches.length = 0;
	}
}, ng = class {
	constructor(e, t) {
		this.state = go.for2d(), this.renderer = e, this._adaptor = t, this.renderer.runners.contextChange.add(this), this._managedGraphics = new Bu({
			renderer: e,
			type: "renderable",
			priority: -1,
			name: "graphics"
		});
	}
	contextChange() {
		this._adaptor.contextChange(this.renderer);
	}
	validateRenderable(e) {
		let t = e.context, n = !!e._gpuData, r = this.renderer.graphicsContext.updateGpuContext(t);
		return !!(r.isBatchable || n !== r.isBatchable);
	}
	addRenderable(e, t) {
		let n = this.renderer.graphicsContext.updateGpuContext(e.context);
		e.didViewUpdate && this._rebuild(e), n.isBatchable ? this._addToBatcher(e, t) : (this.renderer.renderPipes.batch.break(t), t.add(e));
	}
	updateRenderable(e) {
		let t = this._getGpuDataForRenderable(e).batches;
		for (let e = 0; e < t.length; e++) {
			let n = t[e];
			n._batcher.updateElement(n);
		}
	}
	execute(e) {
		if (!e.isRenderable) return;
		let t = this.renderer, n = e.context;
		if (!t.graphicsContext.getGpuContext(n).batches.length) return;
		let r = n.customShader || this._adaptor.shader;
		this.state.blendMode = e.groupBlendMode;
		let i = r.resources.localUniforms.uniforms;
		i.uTransformMatrix = e.groupTransform, i.uRound = t._roundPixels | e._roundPixels, eg(e.groupColorAlpha, i.uColor, 0), this._adaptor.execute(this, e);
	}
	_rebuild(e) {
		let t = this._getGpuDataForRenderable(e), n = this.renderer.graphicsContext.updateGpuContext(e.context);
		t.destroy(), n.isBatchable && this._updateBatchesForRenderable(e, t);
	}
	_addToBatcher(e, t) {
		let n = this.renderer.renderPipes.batch, r = this._getGpuDataForRenderable(e).batches;
		for (let e = 0; e < r.length; e++) {
			let i = r[e];
			n.addToBatch(i, t);
		}
	}
	_getGpuDataForRenderable(e) {
		return e._gpuData[this.renderer.uid] || this._initGpuDataForRenderable(e);
	}
	_initGpuDataForRenderable(e) {
		let t = new tg();
		return e._gpuData[this.renderer.uid] = t, this._managedGraphics.add(e), t;
	}
	_updateBatchesForRenderable(e, t) {
		let n = e.context, r = this.renderer.graphicsContext.getGpuContext(n), i = this.renderer._roundPixels | e._roundPixels;
		t.batches = r.batches.map((t) => {
			let n = U.get(Gu);
			return t.copyTo(n), n.renderable = e, n.roundPixels = i, n;
		});
	}
	destroy() {
		this._managedGraphics.destroy(), this.renderer = null, this._adaptor.destroy(), this._adaptor = null, this.state = null;
	}
};
ng.extension = {
	type: [h.WebGLPipes, h.WebGPUPipes],
	name: "graphics"
}, v.add($h), v.add(ng), v.add(Qh), v.add(Vd);
var rg = Object.defineProperty, ig = Object.getOwnPropertySymbols, ag = Object.prototype.hasOwnProperty, og = Object.prototype.propertyIsEnumerable, sg = (e, t, n) => t in e ? rg(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, cg = (e, t) => {
	for (var n in t ||= {}) ag.call(t, n) && sg(e, n, t[n]);
	if (ig) for (var n of ig(t)) og.call(t, n) && sg(e, n, t[n]);
	return e;
}, lg = (e, t) => {
	var n = {};
	for (var r in e) ag.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && ig) for (var r of ig(e)) t.indexOf(r) < 0 && og.call(e, r) && (n[r] = e[r]);
	return n;
}, $ = class e extends dr {
	constructor(e) {
		e instanceof gp && (e = { context: e });
		let t = e || {}, { context: n, roundPixels: r } = t, i = lg(t, ["context", "roundPixels"]);
		super(cg({ label: "Graphics" }, i)), this.renderPipeId = "graphics", n ? this.context = n : (this.context = this._ownedContext = new gp(), this.context.autoGarbageCollect = this.autoGarbageCollect), this.didViewUpdate = !0, this.allowChildren = !1, this.roundPixels = r ?? !1;
	}
	set context(e) {
		e !== this._context && (this._context && (this._context.off("update", this.onViewUpdate, this), this._context.off("unload", this.unload, this)), this._context = e, this._context.on("update", this.onViewUpdate, this), this._context.on("unload", this.unload, this), this.onViewUpdate());
	}
	get context() {
		return this._context;
	}
	get bounds() {
		return this._context.bounds;
	}
	updateBounds() {}
	containsPoint(e) {
		return this._context.containsPoint(e);
	}
	destroy(e) {
		this._ownedContext && !e ? this._ownedContext.destroy(e) : (e === !0 || e?.context === !0) && this._context.destroy(e), this._ownedContext = null, this._context = null, super.destroy(e);
	}
	_onTouch(e) {
		this._gcLastUsed = e, this._context._gcLastUsed = e;
	}
	_callContextMethod(e, t) {
		return this.context[e](...t), this;
	}
	setFillStyle(...e) {
		return this._callContextMethod("setFillStyle", e);
	}
	setStrokeStyle(...e) {
		return this._callContextMethod("setStrokeStyle", e);
	}
	fill(...e) {
		return this._callContextMethod("fill", e);
	}
	stroke(...e) {
		return this._callContextMethod("stroke", e);
	}
	texture(...e) {
		return this._callContextMethod("texture", e);
	}
	beginPath() {
		return this._callContextMethod("beginPath", []);
	}
	cut() {
		return this._callContextMethod("cut", []);
	}
	arc(...e) {
		return this._callContextMethod("arc", e);
	}
	arcTo(...e) {
		return this._callContextMethod("arcTo", e);
	}
	arcToSvg(...e) {
		return this._callContextMethod("arcToSvg", e);
	}
	bezierCurveTo(...e) {
		return this._callContextMethod("bezierCurveTo", e);
	}
	closePath() {
		return this._callContextMethod("closePath", []);
	}
	ellipse(...e) {
		return this._callContextMethod("ellipse", e);
	}
	circle(...e) {
		return this._callContextMethod("circle", e);
	}
	path(...e) {
		return this._callContextMethod("path", e);
	}
	lineTo(...e) {
		return this._callContextMethod("lineTo", e);
	}
	moveTo(...e) {
		return this._callContextMethod("moveTo", e);
	}
	quadraticCurveTo(...e) {
		return this._callContextMethod("quadraticCurveTo", e);
	}
	rect(...e) {
		return this._callContextMethod("rect", e);
	}
	roundRect(...e) {
		return this._callContextMethod("roundRect", e);
	}
	poly(...e) {
		return this._callContextMethod("poly", e);
	}
	regularPoly(...e) {
		return this._callContextMethod("regularPoly", e);
	}
	roundPoly(...e) {
		return this._callContextMethod("roundPoly", e);
	}
	roundShape(...e) {
		return this._callContextMethod("roundShape", e);
	}
	filletRect(...e) {
		return this._callContextMethod("filletRect", e);
	}
	chamferRect(...e) {
		return this._callContextMethod("chamferRect", e);
	}
	star(...e) {
		return this._callContextMethod("star", e);
	}
	svg(...e) {
		return this._callContextMethod("svg", e);
	}
	restore(...e) {
		return this._callContextMethod("restore", e);
	}
	save() {
		return this._callContextMethod("save", []);
	}
	getTransform() {
		return this.context.getTransform();
	}
	resetTransform() {
		return this._callContextMethod("resetTransform", []);
	}
	rotateTransform(...e) {
		return this._callContextMethod("rotate", e);
	}
	scaleTransform(...e) {
		return this._callContextMethod("scale", e);
	}
	setTransform(...e) {
		return this._callContextMethod("setTransform", e);
	}
	transform(...e) {
		return this._callContextMethod("transform", e);
	}
	translateTransform(...e) {
		return this._callContextMethod("translate", e);
	}
	clear() {
		return this._callContextMethod("clear", []);
	}
	get fillStyle() {
		return this._context.fillStyle;
	}
	set fillStyle(e) {
		this._context.fillStyle = e;
	}
	get strokeStyle() {
		return this._context.strokeStyle;
	}
	set strokeStyle(e) {
		this._context.strokeStyle = e;
	}
	clone(t = !1) {
		return t ? new e(this._context.clone()) : (this._ownedContext = null, new e(this._context));
	}
	lineStyle(e, t, n) {
		let r = {};
		return e && (r.width = e), t && (r.color = t), n && (r.alpha = n), this.context.strokeStyle = r, this;
	}
	beginFill(e, t) {
		let n = {};
		return e !== void 0 && (n.color = e), t !== void 0 && (n.alpha = t), this.context.fillStyle = n, this;
	}
	endFill() {
		this.context.fill();
		let e = this.context.strokeStyle;
		return (e.width !== gp.defaultStrokeStyle.width || e.color !== gp.defaultStrokeStyle.color || e.alpha !== gp.defaultStrokeStyle.alpha) && this.context.stroke(), this;
	}
	drawCircle(...e) {
		return this._callContextMethod("circle", e);
	}
	drawEllipse(...e) {
		return this._callContextMethod("ellipse", e);
	}
	drawPolygon(...e) {
		return this._callContextMethod("poly", e);
	}
	drawRect(...e) {
		return this._callContextMethod("rect", e);
	}
	drawRoundedRect(...e) {
		return this._callContextMethod("roundRect", e);
	}
	drawStar(...e) {
		return this._callContextMethod("star", e);
	}
}, ug = Object.defineProperty, dg = Object.getOwnPropertySymbols, fg = Object.prototype.hasOwnProperty, pg = Object.prototype.propertyIsEnumerable, mg = (e, t, n) => t in e ? ug(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, hg = (e, t) => {
	for (var n in t ||= {}) fg.call(t, n) && mg(e, n, t[n]);
	if (dg) for (var n of dg(t)) pg.call(t, n) && mg(e, n, t[n]);
	return e;
}, gg = class e extends Po {
	constructor(...t) {
		let n = t[0] ?? {};
		n instanceof Float32Array && (n = {
			positions: n,
			uvs: t[1],
			indices: t[2]
		}), n = hg(hg({}, e.defaultOptions), n);
		let r = n.positions || new Float32Array([
			0,
			0,
			1,
			0,
			1,
			1,
			0,
			1
		]), i = n.uvs;
		i ||= n.positions ? new Float32Array(r.length) : new Float32Array([
			0,
			0,
			1,
			0,
			1,
			1,
			0,
			1
		]);
		let a = n.indices || new Uint32Array([
			0,
			1,
			2,
			0,
			2,
			3
		]), o = n.shrinkBuffersToFit, s = new Ao({
			data: r,
			label: "attribute-mesh-positions",
			shrinkToFit: o,
			usage: Q.VERTEX | Q.COPY_DST
		}), c = new Ao({
			data: i,
			label: "attribute-mesh-uvs",
			shrinkToFit: o,
			usage: Q.VERTEX | Q.COPY_DST
		}), l = new Ao({
			data: a,
			label: "index-mesh-buffer",
			shrinkToFit: o,
			usage: Q.INDEX | Q.COPY_DST
		});
		super({
			attributes: {
				aPosition: {
					buffer: s,
					format: "float32x2",
					stride: 8,
					offset: 0
				},
				aUV: {
					buffer: c,
					format: "float32x2",
					stride: 8,
					offset: 0
				}
			},
			indexBuffer: l,
			topology: n.topology
		}), this.batchMode = "auto";
	}
	get positions() {
		return this.attributes.aPosition.buffer.data;
	}
	set positions(e) {
		this.attributes.aPosition.buffer.data = e;
	}
	get uvs() {
		return this.attributes.aUV.buffer.data;
	}
	set uvs(e) {
		this.attributes.aUV.buffer.data = e;
	}
	get indices() {
		return this.indexBuffer.data;
	}
	set indices(e) {
		this.indexBuffer.data = e;
	}
};
gg.defaultOptions = {
	topology: "triangle-list",
	shrinkBuffersToFit: !1
};
var _g = gg, vg = class {
	constructor() {
		this.batcherName = "default", this.packAsQuad = !1, this.indexOffset = 0, this.attributeOffset = 0, this.roundPixels = 0, this._batcher = null, this._batch = null, this._textureMatrixUpdateId = -1, this._uvUpdateId = -1;
	}
	get blendMode() {
		return this.renderable.groupBlendMode;
	}
	get topology() {
		return this._topology || this.geometry.topology;
	}
	set topology(e) {
		this._topology = e;
	}
	reset() {
		this.renderable = null, this.texture = null, this._batcher = null, this._batch = null, this.geometry = null, this._uvUpdateId = -1, this._textureMatrixUpdateId = -1;
	}
	setTexture(e) {
		this.texture !== e && (this.texture = e, this._textureMatrixUpdateId = -1);
	}
	get uvs() {
		let e = this.geometry.getBuffer("aUV"), t = e.data, n = t, r = this.texture.textureMatrix;
		return r.isSimple || (n = this._transformedUvs, (this._textureMatrixUpdateId !== r._updateID || this._uvUpdateId !== e._updateID) && ((!n || n.length < t.length) && (n = this._transformedUvs = new Float32Array(t.length)), this._textureMatrixUpdateId = r._updateID, this._uvUpdateId = e._updateID, r.multiplyUvs(t, n))), n;
	}
	get positions() {
		return this.geometry.positions;
	}
	get indices() {
		return this.geometry.indices;
	}
	get color() {
		return this.renderable.groupColorAlpha;
	}
	get groupTransform() {
		return this.renderable.groupTransform;
	}
	get attributeSize() {
		return this.geometry.positions.length / 2;
	}
	get indexSize() {
		return this.geometry.indices.length;
	}
}, yg = class {
	destroy() {}
}, bg = class {
	constructor(e, t) {
		this.localUniforms = new io({
			uTransformMatrix: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uColor: {
				value: new Float32Array([
					1,
					1,
					1,
					1
				]),
				type: "vec4<f32>"
			},
			uRound: {
				value: 0,
				type: "f32"
			}
		}), this.localUniformsBindGroup = new Ka({ 0: this.localUniforms }), this.renderer = e, this._adaptor = t, this._adaptor.init();
	}
	validateRenderable(e) {
		let t = this._getMeshData(e), n = t.batched, r = e.batched;
		if (t.batched = r, n !== r) return !0;
		if (r) {
			let n = e._geometry;
			if (n.indices.length !== t.indexSize || n.positions.length !== t.vertexSize) return t.indexSize = n.indices.length, t.vertexSize = n.positions.length, !0;
			let r = this._getBatchableMesh(e);
			return r.texture.uid !== e._texture.uid && (r._textureMatrixUpdateId = -1), !r._batcher.checkAndUpdateTexture(r, e._texture);
		}
		return !1;
	}
	addRenderable(e, t) {
		let n = this.renderer.renderPipes.batch, r = this._getMeshData(e);
		if (e.didViewUpdate && (r.indexSize = e._geometry.indices?.length, r.vertexSize = e._geometry.positions?.length), r.batched) {
			let r = this._getBatchableMesh(e);
			r.setTexture(e._texture), r.geometry = e._geometry, n.addToBatch(r, t);
		} else n.break(t), t.add(e);
	}
	updateRenderable(e) {
		if (e.batched) {
			let t = this._getBatchableMesh(e);
			t.setTexture(e._texture), t.geometry = e._geometry, t._batcher.updateElement(t);
		}
	}
	execute(e) {
		if (!e.isRenderable) return;
		e.state.blendMode = xl(e.groupBlendMode, e.texture._source);
		let t = this.localUniforms;
		t.uniforms.uTransformMatrix = e.groupTransform, t.uniforms.uRound = this.renderer._roundPixels | e._roundPixels, t.update(), eg(e.groupColorAlpha, t.uniforms.uColor, 0), this._adaptor.execute(this, e);
	}
	_getMeshData(e) {
		var t, n;
		return (t = e._gpuData)[n = this.renderer.uid] || (t[n] = new yg()), e._gpuData[this.renderer.uid].meshData || this._initMeshData(e);
	}
	_initMeshData(e) {
		return e._gpuData[this.renderer.uid].meshData = {
			batched: e.batched,
			indexSize: 0,
			vertexSize: 0
		}, e._gpuData[this.renderer.uid].meshData;
	}
	_getBatchableMesh(e) {
		var t, n;
		return (t = e._gpuData)[n = this.renderer.uid] || (t[n] = new yg()), e._gpuData[this.renderer.uid].batchableMesh || this._initBatchableMesh(e);
	}
	_initBatchableMesh(e) {
		let t = new vg();
		return t.renderable = e, t.setTexture(e._texture), t.transform = e.groupTransform, t.roundPixels = this.renderer._roundPixels | e._roundPixels, e._gpuData[this.renderer.uid].batchableMesh = t, t;
	}
	destroy() {
		this.localUniforms = null, this.localUniformsBindGroup = null, this._adaptor.destroy(), this._adaptor = null, this.renderer = null;
	}
};
bg.extension = {
	type: [h.WebGLPipes, h.WebGPUPipes],
	name: "mesh"
}, v.add(bg);
var xg = Object.defineProperty, Sg = Object.getOwnPropertySymbols, Cg = Object.prototype.hasOwnProperty, wg = Object.prototype.propertyIsEnumerable, Tg = (e, t, n) => t in e ? xg(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Eg = (e, t) => {
	for (var n in t ||= {}) Cg.call(t, n) && Tg(e, n, t[n]);
	if (Sg) for (var n of Sg(t)) wg.call(t, n) && Tg(e, n, t[n]);
	return e;
}, Dg = (e, t) => {
	var n = {};
	for (var r in e) Cg.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && Sg) for (var r of Sg(e)) t.indexOf(r) < 0 && wg.call(e, r) && (n[r] = e[r]);
	return n;
}, Og = class extends dr {
	constructor(...e) {
		let t = e[0];
		t instanceof Po && (t = {
			geometry: t,
			shader: e[1]
		}, e[3] && (t.geometry.topology = e[3]));
		let n = t, { geometry: r, shader: i, texture: a, roundPixels: o, state: s } = n, c = Dg(n, [
			"geometry",
			"shader",
			"texture",
			"roundPixels",
			"state"
		]);
		super(Eg({ label: "Mesh" }, c)), this.renderPipeId = "mesh", this._shader = null, this.allowChildren = !1, this.shader = i ?? null, this.texture = a ?? i?.texture ?? J.WHITE, this.state = s ?? go.for2d(), this._geometry = r, this._geometry.on("update", this.onViewUpdate, this), this.roundPixels = o ?? !1;
	}
	get material() {
		return this._shader;
	}
	set shader(e) {
		this._shader !== e && (this._shader = e, this.onViewUpdate());
	}
	get shader() {
		return this._shader;
	}
	set geometry(e) {
		var t;
		this._geometry !== e && ((t = this._geometry) == null || t.off("update", this.onViewUpdate, this), e.on("update", this.onViewUpdate, this), this._geometry = e, this.onViewUpdate());
	}
	get geometry() {
		return this._geometry;
	}
	set texture(e) {
		e ||= J.EMPTY;
		let t = this._texture;
		t !== e && (t && t.dynamic && t.off("update", this.onViewUpdate, this), e.dynamic && e.on("update", this.onViewUpdate, this), this.shader && (this.shader.texture = e), this._texture = e, this.onViewUpdate());
	}
	get texture() {
		return this._texture;
	}
	get batched() {
		return this._shader || this.state.data & 12 ? !1 : this._geometry instanceof _g ? this._geometry.batchMode === "auto" ? this._geometry.positions.length / 2 <= 100 : this._geometry.batchMode === "batch" : !1;
	}
	get bounds() {
		return this._geometry.bounds;
	}
	updateBounds() {
		this._bounds = this._geometry.bounds;
	}
	containsPoint(e) {
		let { x: t, y: n } = e;
		if (!this.bounds.containsPoint(t, n)) return !1;
		let r = this.geometry.getBuffer("aPosition").data, i = this.geometry.topology === "triangle-strip" ? 3 : 1;
		if (this.geometry.getIndex()) {
			let e = this.geometry.getIndex().data, a = e.length;
			for (let o = 0; o + 2 < a; o += i) {
				let i = e[o] * 2, a = e[o + 1] * 2, s = e[o + 2] * 2;
				if (Ki(t, n, r[i], r[i + 1], r[a], r[a + 1], r[s], r[s + 1])) return !0;
			}
		} else {
			let e = r.length / 2;
			for (let a = 0; a + 2 < e; a += i) {
				let e = a * 2, i = (a + 1) * 2, o = (a + 2) * 2;
				if (Ki(t, n, r[e], r[e + 1], r[i], r[i + 1], r[o], r[o + 1])) return !0;
			}
		}
		return !1;
	}
	destroy(e) {
		var t;
		if (super.destroy(e), typeof e == "boolean" ? e : e?.texture) {
			let t = typeof e == "boolean" ? e : e?.textureSource;
			this._texture.destroy(t);
		}
		(t = this._geometry) == null || t.off("update", this.onViewUpdate, this), this._texture = null, this._geometry = null, this._shader = null;
	}
}, kg = Object.defineProperty, Ag = Object.defineProperties, jg = Object.getOwnPropertyDescriptors, Mg = Object.getOwnPropertySymbols, Ng = Object.prototype.hasOwnProperty, Pg = Object.prototype.propertyIsEnumerable, Fg = (e, t, n) => t in e ? kg(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Ig = (e, t) => {
	for (var n in t ||= {}) Ng.call(t, n) && Fg(e, n, t[n]);
	if (Mg) for (var n of Mg(t)) Pg.call(t, n) && Fg(e, n, t[n]);
	return e;
}, Lg = (e, t) => Ag(e, jg(t)), Rg = (e, t) => {
	var n = {};
	for (var r in e) Ng.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && Mg) for (var r of Mg(e)) t.indexOf(r) < 0 && Pg.call(e, r) && (n[r] = e[r]);
	return n;
}, zg = class e extends pi {
	constructor(...e) {
		let t = e[0];
		Array.isArray(e[0]) && (t = {
			textures: e[0],
			autoUpdate: e[1]
		});
		let n = t, { animationSpeed: r = 1, autoPlay: i = !1, autoUpdate: a = !0, loop: o = !0, onComplete: s = null, onFrameChange: c = null, onLoop: l = null, textures: u, updateAnchor: d = !1 } = n, f = Rg(n, [
			"animationSpeed",
			"autoPlay",
			"autoUpdate",
			"loop",
			"onComplete",
			"onFrameChange",
			"onLoop",
			"textures",
			"updateAnchor"
		]), [p] = u;
		super(Lg(Ig({}, f), { texture: p instanceof J ? p : p.texture })), this._textures = null, this._durations = null, this._autoUpdate = a, this._isConnectedToTicker = !1, this.animationSpeed = r, this.loop = o, this.updateAnchor = d, this.onComplete = s, this.onFrameChange = c, this.onLoop = l, this._currentTime = 0, this._playing = !1, this._previousFrame = null, this.textures = u, i && this.play();
	}
	stop() {
		this._playing && (this._playing = !1, this._autoUpdate && this._isConnectedToTicker && (Tn.shared.remove(this.update, this), this._isConnectedToTicker = !1));
	}
	play() {
		this._playing || (this._playing = !0, this._autoUpdate && !this._isConnectedToTicker && (Tn.shared.add(this.update, this, Sn.HIGH), this._isConnectedToTicker = !0));
	}
	gotoAndStop(e) {
		this.stop(), this.currentFrame = e;
	}
	gotoAndPlay(e) {
		this.currentFrame = e, this.play();
	}
	update(e) {
		if (!this._playing) return;
		let t = e.deltaTime, n = this.animationSpeed * t, r = this.currentFrame;
		if (this._durations !== null) {
			let e = this._currentTime % 1 * this._durations[this.currentFrame];
			for (e += n / 60 * 1e3; e < 0;) this._currentTime--, e += this._durations[this.currentFrame];
			let r = Math.sign(this.animationSpeed * t);
			for (this._currentTime = Math.floor(this._currentTime); e >= this._durations[this.currentFrame];) e -= this._durations[this.currentFrame] * r, this._currentTime += r;
			this._currentTime += e / this._durations[this.currentFrame];
		} else this._currentTime += n;
		this._currentTime < 0 && !this.loop ? (this.gotoAndStop(0), this.onComplete && this.onComplete()) : this._currentTime >= this._textures.length && !this.loop ? (this.gotoAndStop(this._textures.length - 1), this.onComplete && this.onComplete()) : r !== this.currentFrame && (this.loop && this.onLoop && (this.animationSpeed > 0 && this.currentFrame < r || this.animationSpeed < 0 && this.currentFrame > r) && this.onLoop(), this._updateTexture());
	}
	_updateTexture() {
		let e = this.currentFrame;
		this._previousFrame !== e && (this._previousFrame = e, this.texture = this._textures[e], this.updateAnchor && this.texture.defaultAnchor && this.anchor.copyFrom(this.texture.defaultAnchor), this.onFrameChange && this.onFrameChange(this.currentFrame));
	}
	destroy(e = !1) {
		if (typeof e == "boolean" ? e : e != null && e.texture) {
			let t = typeof e == "boolean" ? e : e?.textureSource;
			this._textures.forEach((e) => {
				this.texture !== e && e.destroy(t);
			});
		}
		this._textures = [], this._durations = null, this.stop(), super.destroy(e), this.onComplete = null, this.onFrameChange = null, this.onLoop = null;
	}
	static fromFrames(t) {
		let n = [];
		for (let e = 0; e < t.length; ++e) n.push(J.from(t[e]));
		return new e(n);
	}
	static fromImages(t) {
		let n = [];
		for (let e = 0; e < t.length; ++e) n.push(J.from(t[e]));
		return new e(n);
	}
	get totalFrames() {
		return this._textures.length;
	}
	get textures() {
		return this._textures;
	}
	set textures(e) {
		if (e[0] instanceof J) this._textures = e, this._durations = null;
		else {
			this._textures = [], this._durations = [];
			for (let t = 0; t < e.length; t++) this._textures.push(e[t].texture), this._durations.push(e[t].time);
		}
		this._previousFrame = null, this.gotoAndStop(0), this._updateTexture();
	}
	get currentFrame() {
		let e = Math.floor(this._currentTime) % this._textures.length;
		return e < 0 && (e += this._textures.length), e;
	}
	set currentFrame(e) {
		if (e < 0 || e > this.totalFrames - 1) throw Error(`[AnimatedSprite]: Invalid frame index value ${e}, expected to be between 0 and totalFrames ${this.totalFrames}.`);
		let t = this.currentFrame;
		this._currentTime = e, t !== this.currentFrame && this._updateTexture();
	}
	get playing() {
		return this._playing;
	}
	get autoUpdate() {
		return this._autoUpdate;
	}
	set autoUpdate(e) {
		e !== this._autoUpdate && (this._autoUpdate = e, !this._autoUpdate && this._isConnectedToTicker ? (Tn.shared.remove(this.update, this), this._isConnectedToTicker = !1) : this._autoUpdate && !this._isConnectedToTicker && this._playing && (Tn.shared.add(this.update, this), this._isConnectedToTicker = !0));
	}
}, Bg = class {
	constructor({ matrix: e, observer: t } = {}) {
		this.dirty = !0, this._matrix = e ?? new B(), this.observer = t, this.position = new V(this, 0, 0), this.scale = new V(this, 1, 1), this.pivot = new V(this, 0, 0), this.skew = new V(this, 0, 0), this._rotation = 0, this._cx = 1, this._sx = 0, this._cy = 0, this._sy = 1;
	}
	get matrix() {
		let e = this._matrix;
		return this.dirty &&= (e.a = this._cx * this.scale.x, e.b = this._sx * this.scale.x, e.c = this._cy * this.scale.y, e.d = this._sy * this.scale.y, e.tx = this.position.x - (this.pivot.x * e.a + this.pivot.y * e.c), e.ty = this.position.y - (this.pivot.x * e.b + this.pivot.y * e.d), !1), e;
	}
	_onUpdate(e) {
		var t;
		this.dirty = !0, e === this.skew && this.updateSkew(), (t = this.observer) == null || t._onUpdate(this);
	}
	updateSkew() {
		this._cx = Math.cos(this._rotation + this.skew.y), this._sx = Math.sin(this._rotation + this.skew.y), this._cy = -Math.sin(this._rotation - this.skew.x), this._sy = Math.cos(this._rotation - this.skew.x), this.dirty = !0;
	}
	setFromMatrix(e) {
		e.decompose(this), this.dirty = !0;
	}
	get rotation() {
		return this._rotation;
	}
	set rotation(e) {
		this._rotation !== e && (this._rotation = e, this._onUpdate(this.skew));
	}
}, Vg = new B(), Hg = new B(), Ug = [
	new Ee(),
	new Ee(),
	new Ee(),
	new Ee()
], Wg = class {
	constructor(e) {
		this._renderer = e;
	}
	validateRenderable(e) {
		return !1;
	}
	addRenderable(e, t) {
		this._renderer.renderPipes.batch.break(t), t.add(e);
	}
	updateRenderable(e) {}
	execute(e) {
		let t = this._renderer, n = t.canvasContext, r = n.activeContext;
		r.save(), n.setBlendMode(e.groupBlendMode);
		let i = t.globalUniforms.globalUniformData?.worldColor ?? 4294967295, a = e.groupColorAlpha, o = (i >>> 24 & 255) / 255, s = (a >>> 24 & 255) / 255, c = t.filter?.alphaMultiplier ?? 1, l = o * s * c;
		if (l <= 0) {
			r.restore();
			return;
		}
		r.globalAlpha = l;
		let u = i & 16777215, d = at(nt(a & 16777215, u)), f = e.texture, p = Z.getTintedPattern(f, d), m = e.width, h = e.height, g = e.groupTransform, _ = f.source._resolution ?? f.source.resolution ?? 1;
		Hg.copyFrom(e._tileTransform.matrix), e.applyAnchorToTexture || Hg.translate(-e.anchor.x * m, -e.anchor.y * h);
		let v = Hg.tx, y = Hg.ty;
		Hg.scale(1 / _, 1 / _), Hg.tx = v, Hg.ty = y, Vg.identity(), Vg.prepend(Hg), Vg.prepend(g);
		let b = t._roundPixels | e._roundPixels;
		n.setContextTransform(Vg, b === 1), r.fillStyle = p;
		let x = e.anchor.x * -m, S = e.anchor.y * -h;
		Ug[0].set(x, S), Ug[1].set(x + m, S), Ug[2].set(x + m, S + h), Ug[3].set(x, S + h);
		for (let e = 0; e < 4; e++) Hg.applyInverse(Ug[e], Ug[e]);
		r.beginPath(), r.moveTo(Ug[0].x, Ug[0].y);
		for (let e = 1; e < 4; e++) r.lineTo(Ug[e].x, Ug[e].y);
		r.closePath(), r.fill(), r.restore();
	}
	destroy() {
		this._renderer = null;
	}
};
Wg.extension = {
	type: [h.CanvasPipes],
	name: "tilingSprite"
};
var Gg = Object.defineProperty, Kg = Object.defineProperties, qg = Object.getOwnPropertyDescriptors, Jg = Object.getOwnPropertySymbols, Yg = Object.prototype.hasOwnProperty, Xg = Object.prototype.propertyIsEnumerable, Zg = (e, t, n) => t in e ? Gg(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Qg = (e, t) => {
	for (var n in t ||= {}) Yg.call(t, n) && Zg(e, n, t[n]);
	if (Jg) for (var n of Jg(t)) Xg.call(t, n) && Zg(e, n, t[n]);
	return e;
}, $g = (e, t) => Kg(e, qg(t)), e_ = {
	name: "local-uniform-bit",
	vertex: {
		header: "\n\n            struct LocalUniforms {\n                uTransformMatrix:mat3x3<f32>,\n                uColor:vec4<f32>,\n                uRound:f32,\n            }\n\n            @group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;\n        ",
		main: "\n            vColor *= localUniforms.uColor;\n            modelMatrix *= localUniforms.uTransformMatrix;\n        ",
		end: "\n            if(localUniforms.uRound == 1)\n            {\n                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);\n            }\n        "
	}
}, t_ = $g(Qg({}, e_), { vertex: $g(Qg({}, e_.vertex), { header: e_.vertex.header.replace("group(1)", "group(2)") }) }), n_ = {
	name: "local-uniform-bit",
	vertex: {
		header: "\n\n            uniform mat3 uTransformMatrix;\n            uniform vec4 uColor;\n            uniform float uRound;\n        ",
		main: "\n            vColor *= uColor;\n            modelMatrix = uTransformMatrix;\n        ",
		end: "\n            if(uRound == 1.)\n            {\n                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);\n            }\n        "
	}
}, r_ = {
	name: "tiling-bit",
	vertex: {
		header: "\n            struct TilingUniforms {\n                uMapCoord:mat3x3<f32>,\n                uClampFrame:vec4<f32>,\n                uClampOffset:vec2<f32>,\n                uTextureTransform:mat3x3<f32>,\n                uSizeAnchor:vec4<f32>\n            };\n\n            @group(2) @binding(0) var<uniform> tilingUniforms: TilingUniforms;\n            @group(2) @binding(1) var uTexture: texture_2d<f32>;\n            @group(2) @binding(2) var uSampler: sampler;\n        ",
		main: "\n            uv = (tilingUniforms.uTextureTransform * vec3(uv, 1.0)).xy;\n\n            position = (position - tilingUniforms.uSizeAnchor.zw) * tilingUniforms.uSizeAnchor.xy;\n        "
	},
	fragment: {
		header: "\n            struct TilingUniforms {\n                uMapCoord:mat3x3<f32>,\n                uClampFrame:vec4<f32>,\n                uClampOffset:vec2<f32>,\n                uTextureTransform:mat3x3<f32>,\n                uSizeAnchor:vec4<f32>\n            };\n\n            @group(2) @binding(0) var<uniform> tilingUniforms: TilingUniforms;\n            @group(2) @binding(1) var uTexture: texture_2d<f32>;\n            @group(2) @binding(2) var uSampler: sampler;\n        ",
		main: "\n\n            var coord = vUV + ceil(tilingUniforms.uClampOffset - vUV);\n            coord = (tilingUniforms.uMapCoord * vec3(coord, 1.0)).xy;\n            var unclamped = coord;\n            coord = clamp(coord, tilingUniforms.uClampFrame.xy, tilingUniforms.uClampFrame.zw);\n\n            var bias = 0.;\n\n            if(unclamped.x == coord.x && unclamped.y == coord.y)\n            {\n                bias = -32.;\n            }\n\n            outColor = textureSampleBias(uTexture, uSampler, coord, bias);\n        "
	}
}, i_ = {
	name: "tiling-bit",
	vertex: {
		header: "\n            uniform mat3 uTextureTransform;\n            uniform vec4 uSizeAnchor;\n\n        ",
		main: "\n            uv = (uTextureTransform * vec3(aUV, 1.0)).xy;\n\n            position = (position - uSizeAnchor.zw) * uSizeAnchor.xy;\n        "
	},
	fragment: {
		header: "\n            uniform sampler2D uTexture;\n            uniform mat3 uMapCoord;\n            uniform vec4 uClampFrame;\n            uniform vec2 uClampOffset;\n        ",
		main: "\n\n        vec2 coord = vUV + ceil(uClampOffset - vUV);\n        coord = (uMapCoord * vec3(coord, 1.0)).xy;\n        vec2 unclamped = coord;\n        coord = clamp(coord, uClampFrame.xy, uClampFrame.zw);\n\n        outColor = texture(uTexture, coord, unclamped == coord ? 0.0 : -32.0);// lod-bias very negative to force lod 0\n\n        "
	}
}, a_, o_, s_ = class extends po {
	constructor() {
		a_ ??= xu({
			name: "tiling-sprite-shader",
			bits: [
				e_,
				r_,
				Mu
			]
		}), o_ ??= Su({
			name: "tiling-sprite-shader",
			bits: [
				n_,
				i_,
				Nu
			]
		});
		let e = new io({
			uMapCoord: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uClampFrame: {
				value: new Float32Array([
					0,
					0,
					1,
					1
				]),
				type: "vec4<f32>"
			},
			uClampOffset: {
				value: new Float32Array([0, 0]),
				type: "vec2<f32>"
			},
			uTextureTransform: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uSizeAnchor: {
				value: new Float32Array([
					100,
					100,
					.5,
					.5
				]),
				type: "vec4<f32>"
			}
		});
		super({
			glProgram: o_,
			gpuProgram: a_,
			resources: {
				localUniforms: new io({
					uTransformMatrix: {
						value: new B(),
						type: "mat3x3<f32>"
					},
					uColor: {
						value: new Float32Array([
							1,
							1,
							1,
							1
						]),
						type: "vec4<f32>"
					},
					uRound: {
						value: 0,
						type: "f32"
					}
				}),
				tilingUniforms: e,
				uTexture: J.EMPTY.source,
				uSampler: J.EMPTY.source.style
			}
		});
	}
	updateUniforms(e, t, n, r, i, a) {
		let o = this.resources.tilingUniforms, s = a.width, c = a.height, l = a.textureMatrix, u = o.uniforms.uTextureTransform;
		u.set(n.a * s / e, n.b * s / t, n.c * c / e, n.d * c / t, n.tx / e, n.ty / t), u.invert(), o.uniforms.uMapCoord = l.mapCoord, o.uniforms.uClampFrame = l.uClampFrame, o.uniforms.uClampOffset = l.uClampOffset, o.uniforms.uTextureTransform = u, o.uniforms.uSizeAnchor[0] = e, o.uniforms.uSizeAnchor[1] = t, o.uniforms.uSizeAnchor[2] = r, o.uniforms.uSizeAnchor[3] = i, a && (this.resources.uTexture = a.source, this.resources.uSampler = a.source.style);
	}
}, c_ = class extends _g {
	constructor() {
		super({
			positions: new Float32Array([
				0,
				0,
				1,
				0,
				1,
				1,
				0,
				1
			]),
			uvs: new Float32Array([
				0,
				0,
				1,
				0,
				1,
				1,
				0,
				1
			]),
			indices: new Uint32Array([
				0,
				1,
				2,
				0,
				2,
				3
			])
		});
	}
};
function l_(e, t) {
	let n = e.anchor.x, r = e.anchor.y;
	t[0] = -n * e.width, t[1] = -r * e.height, t[2] = (1 - n) * e.width, t[3] = -r * e.height, t[4] = (1 - n) * e.width, t[5] = (1 - r) * e.height, t[6] = -n * e.width, t[7] = (1 - r) * e.height;
}
function u_(e, t, n, r) {
	let i = 0, a = e.length / (t || 2), o = r.a, s = r.b, c = r.c, l = r.d, u = r.tx, d = r.ty;
	for (n *= t; i < a;) {
		let r = e[n], a = e[n + 1];
		e[n] = o * r + c * a + u, e[n + 1] = s * r + l * a + d, n += t, i++;
	}
}
function d_(e, t) {
	let n = e.texture, r = n.frame.width, i = n.frame.height, a = 0, o = 0;
	e.applyAnchorToTexture && (a = e.anchor.x, o = e.anchor.y), t[0] = t[6] = -a, t[2] = t[4] = 1 - a, t[1] = t[3] = -o, t[5] = t[7] = 1 - o;
	let s = e._tileTransform.matrix, c = B.shared;
	c.set(s.a * r / e.width, s.b * r / e.height, s.c * i / e.width, s.d * i / e.height, s.tx / e.width, s.ty / e.height), c.invert(), u_(t, 2, 0, c);
}
var f_ = new c_(), p_ = class {
	constructor() {
		this.canBatch = !0, this.geometry = new _g({
			indices: f_.indices.slice(),
			positions: f_.positions.slice(),
			uvs: f_.uvs.slice()
		});
	}
	destroy() {
		var e;
		this.geometry.destroy(), (e = this.shader) == null || e.destroy();
	}
}, m_ = class {
	constructor(e) {
		this._state = go.default2d, this._renderer = e, this._managedTilingSprites = new Bu({
			renderer: e,
			type: "renderable",
			name: "tilingSprite"
		});
	}
	validateRenderable(e) {
		let t = this._getTilingSpriteData(e), n = t.canBatch;
		this._updateCanBatch(e);
		let r = t.canBatch;
		if (r && r === n) {
			let { batchableMesh: n } = t;
			return !n._batcher.checkAndUpdateTexture(n, e.texture);
		}
		return n !== r;
	}
	addRenderable(e, t) {
		let n = this._renderer.renderPipes.batch;
		this._updateCanBatch(e);
		let r = this._getTilingSpriteData(e), { geometry: i, canBatch: a } = r;
		if (a) {
			r.batchableMesh ||= new vg();
			let a = r.batchableMesh;
			e.didViewUpdate && (this._updateBatchableMesh(e), a.geometry = i, a.renderable = e, a.transform = e.groupTransform, a.setTexture(e._texture)), a.roundPixels = this._renderer._roundPixels | e._roundPixels, n.addToBatch(a, t);
		} else n.break(t), r.shader ||= new s_(), this.updateRenderable(e), t.add(e);
	}
	execute(e) {
		let t = this._renderer, { shader: n } = this._getTilingSpriteData(e);
		n.groups[0] = t.globalUniforms.bindGroup;
		let r = n.resources.localUniforms.uniforms;
		r.uTransformMatrix = e.groupTransform, r.uRound = t._roundPixels | e._roundPixels, eg(e.groupColorAlpha, r.uColor, 0), this._state.blendMode = xl(e.groupBlendMode, e.texture._source), t.encoder.draw({
			geometry: f_,
			shader: n,
			state: this._state
		});
	}
	updateRenderable(e) {
		let t = this._getTilingSpriteData(e), { canBatch: n } = t;
		if (n) {
			let { batchableMesh: n } = t;
			e.didViewUpdate && this._updateBatchableMesh(e), n._batcher.updateElement(n);
		} else if (e.didViewUpdate) {
			let { shader: n } = t;
			n.updateUniforms(e.width, e.height, e._tileTransform.matrix, e.anchor.x, e.anchor.y, e.texture);
		}
	}
	_getTilingSpriteData(e) {
		return e._gpuData[this._renderer.uid] || this._initTilingSpriteData(e);
	}
	_initTilingSpriteData(e) {
		let t = new p_();
		return t.renderable = e, e._gpuData[this._renderer.uid] = t, this._managedTilingSprites.add(e), t;
	}
	_updateBatchableMesh(e) {
		let { geometry: t } = this._getTilingSpriteData(e), n = e.texture.source.style;
		n.addressMode !== "repeat" && (n.addressMode = "repeat", n.update()), d_(e, t.uvs), l_(e, t.positions);
	}
	destroy() {
		this._managedTilingSprites.destroy(), this._renderer = null;
	}
	_updateCanBatch(e) {
		let t = this._getTilingSpriteData(e), n = e.texture, r = !0;
		return this._renderer.type === qa.WEBGL && (r = this._renderer.context.supports.nonPowOf2wrapping), t.canBatch = n.textureMatrix.isSimple && (r || n.source.isPowerOfTwo), t.canBatch;
	}
};
m_.extension = {
	type: [h.WebGLPipes, h.WebGPUPipes],
	name: "tilingSprite"
}, v.add(Wg), v.add(m_);
var h_ = Object.defineProperty, g_ = Object.getOwnPropertySymbols, __ = Object.prototype.hasOwnProperty, v_ = Object.prototype.propertyIsEnumerable, y_ = (e, t, n) => t in e ? h_(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, b_ = (e, t) => {
	for (var n in t ||= {}) __.call(t, n) && y_(e, n, t[n]);
	if (g_) for (var n of g_(t)) v_.call(t, n) && y_(e, n, t[n]);
	return e;
}, x_ = (e, t) => {
	var n = {};
	for (var r in e) __.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && g_) for (var r of g_(e)) t.indexOf(r) < 0 && v_.call(e, r) && (n[r] = e[r]);
	return n;
}, S_ = class e extends dr {
	constructor(...t) {
		let n = t[0] || {};
		n instanceof J && (n = { texture: n }), t.length > 1 && (n.width = t[1], n.height = t[2]), n = b_(b_({}, e.defaultOptions), n);
		let r = n ?? {}, { texture: i, anchor: a, tilePosition: o, tileScale: s, tileRotation: c, width: l, height: u, applyAnchorToTexture: d, roundPixels: f } = r, p = x_(r, [
			"texture",
			"anchor",
			"tilePosition",
			"tileScale",
			"tileRotation",
			"width",
			"height",
			"applyAnchorToTexture",
			"roundPixels"
		]);
		super(b_({ label: "TilingSprite" }, p)), this.renderPipeId = "tilingSprite", this.batched = !0, this.allowChildren = !1, this._anchor = new V({ _onUpdate: () => {
			this.onViewUpdate();
		} }), this.applyAnchorToTexture = d, this.texture = i, this._width = l ?? i.width, this._height = u ?? i.height, this._tileTransform = new Bg({ observer: { _onUpdate: () => this.onViewUpdate() } }), a && (this.anchor = a), this.tilePosition = o, this.tileScale = s, this.tileRotation = c, this.roundPixels = f ?? !1;
	}
	static from(t, n = {}) {
		return typeof t == "string" ? new e(b_({ texture: Ii.get(t) }, n)) : new e(b_({ texture: t }, n));
	}
	get uvRespectAnchor() {
		return _l(hl, "uvRespectAnchor is deprecated, please use applyAnchorToTexture instead"), this.applyAnchorToTexture;
	}
	set uvRespectAnchor(e) {
		_l(hl, "uvRespectAnchor is deprecated, please use applyAnchorToTexture instead"), this.applyAnchorToTexture = e;
	}
	get clampMargin() {
		return this._texture.textureMatrix.clampMargin;
	}
	set clampMargin(e) {
		this._texture.textureMatrix.clampMargin = e;
	}
	get anchor() {
		return this._anchor;
	}
	set anchor(e) {
		typeof e == "number" ? this._anchor.set(e) : this._anchor.copyFrom(e);
	}
	get tilePosition() {
		return this._tileTransform.position;
	}
	set tilePosition(e) {
		this._tileTransform.position.copyFrom(e);
	}
	get tileScale() {
		return this._tileTransform.scale;
	}
	set tileScale(e) {
		typeof e == "number" ? this._tileTransform.scale.set(e) : this._tileTransform.scale.copyFrom(e);
	}
	set tileRotation(e) {
		this._tileTransform.rotation = e;
	}
	get tileRotation() {
		return this._tileTransform.rotation;
	}
	get tileTransform() {
		return this._tileTransform;
	}
	set texture(e) {
		e ||= J.EMPTY;
		let t = this._texture;
		t !== e && (t && t.dynamic && t.off("update", this.onViewUpdate, this), e.dynamic && e.on("update", this.onViewUpdate, this), this._texture = e, this.onViewUpdate());
	}
	get texture() {
		return this._texture;
	}
	set width(e) {
		this._width = e, this.onViewUpdate();
	}
	get width() {
		return this._width;
	}
	set height(e) {
		this._height = e, this.onViewUpdate();
	}
	get height() {
		return this._height;
	}
	setSize(e, t) {
		typeof e == "object" && (t = e.height ?? e.width, e = e.width), this._width = e, this._height = t ?? e, this.onViewUpdate();
	}
	getSize(e) {
		return e ||= {}, e.width = this._width, e.height = this._height, e;
	}
	updateBounds() {
		let e = this._bounds, t = this._anchor, n = this._width, r = this._height;
		e.minX = -t._x * n, e.maxX = e.minX + n, e.minY = -t._y * r, e.maxY = e.minY + r;
	}
	containsPoint(e) {
		let t = this._width, n = this._height, r = -t * this._anchor._x, i = 0;
		return e.x >= r && e.x <= r + t && (i = -n * this._anchor._y, e.y >= i && e.y <= i + n);
	}
	destroy(e = !1) {
		if (super.destroy(e), this._anchor = null, this._tileTransform = null, this._bounds = null, typeof e == "boolean" ? e : e?.texture) {
			let t = typeof e == "boolean" ? e : e?.textureSource;
			this._texture.destroy(t);
		}
		this._texture = null;
	}
};
S_.defaultOptions = {
	texture: J.EMPTY,
	anchor: {
		x: 0,
		y: 0
	},
	tilePosition: {
		x: 0,
		y: 0
	},
	tileScale: {
		x: 1,
		y: 1
	},
	tileRotation: 0,
	applyAnchorToTexture: !1
};
var C_ = S_, w_ = Object.defineProperty, T_ = Object.getOwnPropertySymbols, E_ = Object.prototype.hasOwnProperty, D_ = Object.prototype.propertyIsEnumerable, O_ = (e, t, n) => t in e ? w_(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, k_ = (e, t) => {
	for (var n in t ||= {}) E_.call(t, n) && O_(e, n, t[n]);
	if (T_) for (var n of T_(t)) D_.call(t, n) && O_(e, n, t[n]);
	return e;
}, A_ = (e, t) => {
	var n = {};
	for (var r in e) E_.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && T_) for (var r of T_(e)) t.indexOf(r) < 0 && D_.call(e, r) && (n[r] = e[r]);
	return n;
}, j_ = class extends dr {
	constructor(e, t) {
		let n = e, { text: r, resolution: i, style: a, anchor: o, width: s, height: c, roundPixels: l } = n, u = A_(n, [
			"text",
			"resolution",
			"style",
			"anchor",
			"width",
			"height",
			"roundPixels"
		]);
		super(k_({}, u)), this.batched = !0, this._resolution = null, this._autoResolution = !0, this._didTextUpdate = !0, this._styleClass = t, this.text = r ?? "", this.style = a, this.resolution = i ?? null, this.allowChildren = !1, this._anchor = new V({ _onUpdate: () => {
			this.onViewUpdate();
		} }), o && (this.anchor = o), this.roundPixels = l ?? !1, s !== void 0 && (this.width = s), c !== void 0 && (this.height = c);
	}
	get anchor() {
		return this._anchor;
	}
	set anchor(e) {
		typeof e == "number" ? this._anchor.set(e) : this._anchor.copyFrom(e);
	}
	set text(e) {
		e = e.toString(), this._text !== e && (this._text = e, this.onViewUpdate());
	}
	get text() {
		return this._text;
	}
	set resolution(e) {
		this._autoResolution = e === null, this._resolution = e, this.onViewUpdate();
	}
	get resolution() {
		return this._resolution;
	}
	get style() {
		return this._style;
	}
	set style(e) {
		var t;
		e ||= {}, (t = this._style) == null || t.off("update", this.onViewUpdate, this), this._style = e instanceof this._styleClass ? e : new this._styleClass(e), this._style.on("update", this.onViewUpdate, this), this.onViewUpdate();
	}
	get width() {
		return Math.abs(this.scale.x) * this.bounds.width;
	}
	set width(e) {
		this._setWidth(e, this.bounds.width);
	}
	get height() {
		return Math.abs(this.scale.y) * this.bounds.height;
	}
	set height(e) {
		this._setHeight(e, this.bounds.height);
	}
	getSize(e) {
		return e ||= {}, e.width = Math.abs(this.scale.x) * this.bounds.width, e.height = Math.abs(this.scale.y) * this.bounds.height, e;
	}
	setSize(e, t) {
		typeof e == "object" ? (t = e.height ?? e.width, e = e.width) : t ??= e, e !== void 0 && this._setWidth(e, this.bounds.width), t !== void 0 && this._setHeight(t, this.bounds.height);
	}
	containsPoint(e) {
		let t = this.bounds.width, n = this.bounds.height, r = -t * this.anchor.x, i = 0;
		return e.x >= r && e.x <= r + t && (i = -n * this.anchor.y, e.y >= i && e.y <= i + n);
	}
	onViewUpdate() {
		this.didViewUpdate || (this._didTextUpdate = !0), super.onViewUpdate();
	}
	destroy(e = !1) {
		super.destroy(e), this.owner = null, this._bounds = null, this._anchor = null, (typeof e == "boolean" ? e : e != null && e.style) && this._style.destroy(e), this._style = null, this._text = null;
	}
	get styleKey() {
		return `${this._text}:${this._style.styleKey}:${this._resolution}`;
	}
};
function M_(e, t) {
	let n = e[0] ?? {};
	return (typeof n == "string" || e[1]) && (n = {
		text: n,
		style: e[1]
	}), n;
}
var N_ = null, P_ = null;
function F_(e, t) {
	N_ || (N_ = X.get().createCanvas(256, 128), P_ = N_.getContext("2d", { willReadFrequently: !0 }), P_.globalCompositeOperation = "copy", P_.globalAlpha = 1), (N_.width < e || N_.height < t) && (N_.width = gt(e), N_.height = gt(t));
}
function I_(e, t, n) {
	for (let r = 0, i = 4 * n * t; r < t; ++r, i += 4) if (e[i + 3] !== 0) return !1;
	return !0;
}
function L_(e, t, n, r, i) {
	let a = 4 * t;
	for (let t = r, o = r * a + 4 * n; t <= i; ++t, o += a) if (e[o + 3] !== 0) return !1;
	return !0;
}
function R_(...e) {
	let t = e[0];
	t.canvas || (t = {
		canvas: e[0],
		resolution: e[1]
	});
	let { canvas: n } = t, r = Math.min(t.resolution ?? 1, 1), i = t.width ?? n.width, a = t.height ?? n.height, o = t.output;
	if (F_(i, a), !P_) throw TypeError("Failed to get canvas 2D context");
	P_.drawImage(n, 0, 0, i, a, 0, 0, i * r, a * r);
	let s = P_.getImageData(0, 0, i, a).data, c = 0, l = 0, u = i - 1, d = a - 1;
	for (; l < a && I_(s, i, l);) ++l;
	if (l === a) return qe.EMPTY;
	for (; I_(s, i, d);) --d;
	for (; L_(s, i, c, l, d);) ++c;
	for (; L_(s, i, u, l, d);) --u;
	return ++u, ++d, P_.globalCompositeOperation = "source-over", P_.strokeRect(c, l, u - c, d - l), P_.globalCompositeOperation = "copy", o ??= new qe(), o.set(c / r, l / r, (u - c) / r, (d - l) / r), o;
}
var z_ = class {
	constructor(e = 0, t = 0, n = !1) {
		this.first = null, this.items = Object.create(null), this.last = null, this.max = e, this.resetTtl = n, this.size = 0, this.ttl = t;
	}
	clear() {
		return this.first = null, this.items = Object.create(null), this.last = null, this.size = 0, this;
	}
	delete(e) {
		if (this.has(e)) {
			let t = this.items[e];
			delete this.items[e], this.size--, t.prev !== null && (t.prev.next = t.next), t.next !== null && (t.next.prev = t.prev), this.first === t && (this.first = t.next), this.last === t && (this.last = t.prev);
		}
		return this;
	}
	entries(e = this.keys()) {
		let t = Array(e.length);
		for (let n = 0; n < e.length; n++) {
			let r = e[n];
			t[n] = [r, this.get(r)];
		}
		return t;
	}
	evict(e = !1) {
		if (e || this.size > 0) {
			let e = this.first;
			delete this.items[e.key], --this.size === 0 ? (this.first = null, this.last = null) : (this.first = e.next, this.first.prev = null);
		}
		return this;
	}
	expiresAt(e) {
		let t;
		return this.has(e) && (t = this.items[e].expiry), t;
	}
	get(e) {
		let t = this.items[e];
		if (t !== void 0) {
			if (this.ttl > 0 && t.expiry <= Date.now()) {
				this.delete(e);
				return;
			}
			return this.moveToEnd(t), t.value;
		}
	}
	has(e) {
		return e in this.items;
	}
	moveToEnd(e) {
		this.last !== e && (e.prev !== null && (e.prev.next = e.next), e.next !== null && (e.next.prev = e.prev), this.first === e && (this.first = e.next), e.prev = this.last, e.next = null, this.last !== null && (this.last.next = e), this.last = e, this.first === null && (this.first = e));
	}
	keys() {
		let e = Array(this.size), t = this.first, n = 0;
		for (; t !== null;) e[n++] = t.key, t = t.next;
		return e;
	}
	setWithEvicted(e, t, n = this.resetTtl) {
		let r = null;
		if (this.has(e)) this.set(e, t, !0, n);
		else {
			this.max > 0 && this.size === this.max && (r = a({}, this.first), this.evict(!0));
			let n = this.items[e] = {
				expiry: this.ttl > 0 ? Date.now() + this.ttl : this.ttl,
				key: e,
				prev: this.last,
				next: null,
				value: t
			};
			++this.size === 1 ? this.first = n : this.last.next = n, this.last = n;
		}
		return r;
	}
	set(e, t, n = !1, r = this.resetTtl) {
		let i = this.items[e];
		return n || i !== void 0 ? (i.value = t, n === !1 && r && (i.expiry = this.ttl > 0 ? Date.now() + this.ttl : this.ttl), this.moveToEnd(i)) : (this.max > 0 && this.size === this.max && this.evict(!0), i = this.items[e] = {
			expiry: this.ttl > 0 ? Date.now() + this.ttl : this.ttl,
			key: e,
			prev: this.last,
			next: null,
			value: t
		}, ++this.size === 1 ? this.first = i : this.last.next = i, this.last = i), this;
	}
	values(e = this.keys()) {
		let t = Array(e.length);
		for (let n = 0; n < e.length; n++) t[n] = this.get(e[n]);
		return t;
	}
};
function B_(e = 1e3, t = 0, n = !1) {
	if (isNaN(e) || e < 0) throw TypeError("Invalid max value");
	if (isNaN(t) || t < 0) throw TypeError("Invalid ttl value");
	if (typeof n != "boolean") throw TypeError("Invalid resetTtl value");
	return new z_(e, t, n);
}
function V_(e) {
	return !!e.tagStyles && Object.keys(e.tagStyles).length > 0;
}
function H_(e) {
	return e.includes("<");
}
function U_(e, t) {
	return e.clone().assign(t);
}
function W_(e, t) {
	let n = [], r = t.tagStyles;
	if (!V_(t) || !H_(e)) return n.push({
		text: e,
		style: t
	}), n;
	let i = [t], a = [], o = "", s = 0;
	for (; s < e.length;) {
		let t = e[s];
		if (t === "<") {
			let c = e.indexOf(">", s);
			if (c === -1) {
				o += t, s++;
				continue;
			}
			let l = e.indexOf("<", s + 1);
			if (l !== -1 && l < c) {
				o += t, s++;
				continue;
			}
			let u = e.slice(s + 1, c);
			if (u.startsWith("/")) {
				let t = u.slice(1).trim();
				if (a.length > 0 && a[a.length - 1] === t) {
					o.length > 0 && (n.push({
						text: o,
						style: i[i.length - 1]
					}), o = ""), i.pop(), a.pop(), s = c + 1;
					continue;
				}
				o += e.slice(s, c + 1), s = c + 1;
				continue;
			}
			{
				let t = u.trim();
				if (r[t]) {
					o.length > 0 && (n.push({
						text: o,
						style: i[i.length - 1]
					}), o = "");
					let e = i[i.length - 1], l = U_(e, r[t]);
					i.push(l), a.push(t), s = c + 1;
					continue;
				}
				o += e.slice(s, c + 1), s = c + 1;
				continue;
			}
		}
		o += t, s++;
	}
	return o.length > 0 && n.push({
		text: o,
		style: i[i.length - 1]
	}), n;
}
var G_ = /* @__PURE__ */ new Set([10, 13]), K_ = /* @__PURE__ */ new Set([
	9,
	32,
	8192,
	8193,
	8194,
	8195,
	8196,
	8197,
	8198,
	8200,
	8201,
	8202,
	8287,
	12288
]), q_ = /* @__PURE__ */ new Set([9, 32]), J_ = /* @__PURE__ */ new Set([
	45,
	8208,
	8211,
	8212,
	173
]), Y_ = /(\r\n|\r|\n)/, X_ = /(?:\r\n|\r|\n)/;
function Z_(e) {
	return typeof e == "string" && G_.has(e.charCodeAt(0));
}
function Q_(e, t) {
	return typeof e == "string" && K_.has(e.charCodeAt(0));
}
function $_(e) {
	return typeof e == "string" && q_.has(e.charCodeAt(0));
}
function ev(e) {
	return typeof e == "string" && J_.has(e.charCodeAt(0));
}
function tv(e) {
	return e === "normal" || e === "pre-line";
}
function nv(e) {
	return e === "normal";
}
function rv(e) {
	if (typeof e != "string") return "";
	let t = e.length - 1;
	for (; t >= 0 && Q_(e[t]);) t--;
	return t < e.length - 1 ? e.slice(0, t + 1) : e;
}
function iv(e) {
	let t = [], n = [];
	if (typeof e != "string") return t;
	for (let r = 0; r < e.length; r++) {
		let i = e[r], a = e[r + 1];
		if (Q_(i, a) || Z_(i)) {
			n.length > 0 && (t.push(n.join("")), n.length = 0), i === "\r" && a === "\n" ? (t.push("\r\n"), r++) : t.push(i);
			continue;
		}
		n.push(i), ev(i) && a && !Q_(a) && !Z_(a) && (t.push(n.join("")), n.length = 0);
	}
	return n.length > 0 && t.push(n.join("")), t;
}
function av(e, t, n, r) {
	let i = n(e), a = [];
	for (let n = 0; n < i.length; n++) {
		let o = i[n], s = o, c = 1;
		for (; i[n + c];) {
			let a = i[n + c];
			if (!r(s, a, e, n, t)) o += a, s = a, c++;
			else break;
		}
		n += c - 1, a.push(o);
	}
	return a;
}
var ov = /\r\n|\r|\n/g;
function sv(e, t, n, r, i, a, o, s, c) {
	let l = W_(e, t);
	if (nv(t.whiteSpace)) for (let e = 0; e < l.length; e++) {
		let t = l[e];
		l[e] = {
			text: t.text.replace(ov, " "),
			style: t.style
		};
	}
	let u = [], d = [];
	for (let e of l) {
		let t = e.text.split(Y_);
		for (let n = 0; n < t.length; n++) {
			let r = t[n];
			r === "\r\n" || r === "\r" || r === "\n" ? (u.push(d), d = []) : r.length > 0 && d.push({
				text: r,
				style: e.style
			});
		}
	}
	(d.length > 0 || u.length === 0) && u.push(d);
	let f = n ? cv(u, t, r, a, s, c) : u, p = [], m = [], h = [], g = [], _ = [], v = 0, y = t._fontString, b = o(y);
	b.fontSize === 0 && (b.fontSize = t.fontSize, b.ascent = t.fontSize);
	let x = "", S = !!t.dropShadow, C = t._stroke?.width || 0;
	for (let e of f) {
		let n = 0, a = b.ascent, s = b.descent, c = "";
		for (let t of e) {
			let e = t.style._fontString, l = o(e);
			e !== x && (r.font = e, x = e);
			let u = i(t.text, t.style.letterSpacing, r);
			n += u, a = Math.max(a, l.ascent), s = Math.max(s, l.descent), c += t.text;
			let d = t.style._stroke?.width || 0;
			d > C && (C = d), !S && t.style.dropShadow && (S = !0);
		}
		e.length === 0 && (a = b.ascent, s = b.descent), p.push(n), m.push(a), h.push(s), _.push(c);
		let l = t.lineHeight || a + s;
		g.push(l + t.leading), v = Math.max(v, n);
	}
	let w = C, T = v + w + (t.dropShadow ? t.dropShadow.distance : 0), E = 0;
	for (let e = 0; e < g.length; e++) E += g[e];
	return E = Math.max(E, g[0] + w), {
		width: T,
		height: E + (t.dropShadow ? t.dropShadow.distance : 0),
		lines: _,
		lineWidths: p,
		lineHeight: (t.lineHeight || b.fontSize) + t.leading,
		maxLineWidth: v,
		fontProperties: b,
		runsByLine: f,
		lineAscents: m,
		lineDescents: h,
		lineHeights: g,
		hasDropShadow: S
	};
}
function cv(e, t, n, r, i, a) {
	let { letterSpacing: o, whiteSpace: s, wordWrapWidth: c, breakWords: l } = t, u = tv(s), d = c + o, f = {}, p = "", m = (e, t) => {
		let i = `${e}|${t.styleKey}`, a = f[i];
		if (a === void 0) {
			let o = t._fontString;
			o !== p && (n.font = o, p = o), a = r(e, t.letterSpacing, n) + t.letterSpacing, f[i] = a;
		}
		return a;
	}, h = [];
	for (let t of e) {
		let e = lv(t), n = h.length, r = (t) => {
			let n = 0, r = t;
			do {
				let { token: t, style: i } = e[r];
				n += m(t, i), r++;
			} while (r < e.length && e[r].continuesFromPrevious);
			return n;
		}, o = (t) => {
			let n = [], r = t;
			do
				n.push({
					token: e[r].token,
					style: e[r].style
				}), r++;
			while (r < e.length && e[r].continuesFromPrevious);
			return n;
		}, s = [], c = 0, f = !u, p = null, g = () => {
			p && p.text.length > 0 && s.push(p), p = null;
		}, _ = () => {
			if (g(), s.length > 0) {
				let e = s[s.length - 1];
				e.text = rv(e.text), e.text.length === 0 && s.pop();
			}
			h.push(s), s = [], c = 0, f = !1;
		};
		for (let t = 0; t < e.length; t++) {
			let { token: n, style: v, continuesFromPrevious: y } = e[t], b = m(n, v);
			if (u) {
				let e = Q_(n), t = p?.text[p.text.length - 1] ?? s[s.length - 1]?.text.slice(-1) ?? "", r = t ? Q_(t) : !1;
				if (e && r) continue;
			}
			let x = !y, S = x ? r(t) : b;
			if (S > d && x) {
				if (c > 0 && _(), l) {
					let e = o(t);
					for (let t = 0; t < e.length; t++) {
						let n = e[t].token, r = e[t].style, o = av(n, l, a, i);
						for (let e of o) {
							let t = m(e, r);
							t + c > d && _(), !p || p.style !== r ? (g(), p = {
								text: e,
								style: r
							}) : p.text += e, c += t;
						}
					}
					t += e.length - 1;
				} else {
					let e = o(t);
					g(), h.push(e.map((e) => ({
						text: e.token,
						style: e.style
					}))), f = !1, t += e.length - 1;
				}
			} else if (S + c > d && x) {
				if (Q_(n)) {
					f = !1;
					continue;
				}
				_(), p = {
					text: n,
					style: v
				}, c = b;
			} else if (y && !l) !p || p.style !== v ? (g(), p = {
				text: n,
				style: v
			}) : p.text += n, c += b;
			else {
				let e = Q_(n);
				if (c === 0 && e && !f) continue;
				!p || p.style !== v ? (g(), p = {
					text: n,
					style: v
				}) : p.text += n, c += b;
			}
		}
		if (g(), s.length > 0) {
			let e = s[s.length - 1];
			e.text = rv(e.text), e.text.length === 0 && s.pop();
		}
		(s.length > 0 || h.length === n) && h.push(s);
	}
	return h;
}
function lv(e) {
	let t = [], n = !1;
	for (let r of e) {
		let e = iv(r.text), i = !0;
		for (let a of e) {
			let e = Q_(a) || Z_(a), o = i && n && !e;
			t.push({
				token: a,
				style: r.style,
				continuesFromPrevious: o
			}), n = !e, i = !1;
		}
	}
	return t;
}
var uv = { willReadFrequently: !0 };
function dv(e, t, n, r, i) {
	let a = n[e];
	return typeof a != "number" && (a = i(e, t, r) + t, n[e] = a), a;
}
function fv(e, t, n, r, i, a, o) {
	let s = n.getContext("2d", uv);
	s.font = t._fontString;
	let c = 0, l = "", u = [], d = Object.create(null), { letterSpacing: f, whiteSpace: p } = t, m = tv(p), h = nv(p), g = !m, _ = t.wordWrapWidth + f, v = iv(e);
	for (let e = 0; e < v.length; e++) {
		let n = v[e];
		if (Z_(n)) {
			if (!h) {
				u.push(rv(l)), g = !m, l = "", c = 0;
				continue;
			}
			n = " ";
		}
		if (m) {
			let e = Q_(n), t = Q_(l[l.length - 1]);
			if (e && t) continue;
		}
		let p = dv(n, f, d, s, r);
		if (p > _) {
			if (l !== "" && (u.push(rv(l)), l = "", c = 0), i(n, t.breakWords)) {
				let e = av(n, t.breakWords, o, a);
				for (let t of e) {
					let e = dv(t, f, d, s, r);
					e + c > _ && (u.push(rv(l)), g = !1, l = "", c = 0), l += t, c += e;
				}
			} else l.length > 0 && (u.push(rv(l)), l = "", c = 0), u.push(rv(n)), g = !1, l = "", c = 0;
		} else p + c > _ && (g = !1, u.push(rv(l)), l = "", c = 0), (l.length > 0 || !Q_(n) || g) && (l += n, c += p);
	}
	let y = rv(l);
	return y.length > 0 && u.push(y), u.join("\n");
}
var pv = { willReadFrequently: !0 }, mv = class e {
	static get experimentalLetterSpacingSupported() {
		let t = e._experimentalLetterSpacingSupported;
		if (t === void 0) {
			let n = X.get().getCanvasRenderingContext2D().prototype;
			t = e._experimentalLetterSpacingSupported = "letterSpacing" in n || "textLetterSpacing" in n;
		}
		return t;
	}
	constructor(e, t, n, r, i, a, o, s, c, l) {
		this.text = e, this.style = t, this.width = n, this.height = r, this.lines = i, this.lineWidths = a, this.lineHeight = o, this.maxLineWidth = s, this.fontProperties = c, l && (this.runsByLine = l.runsByLine, this.lineAscents = l.lineAscents, this.lineDescents = l.lineDescents, this.lineHeights = l.lineHeights, this.hasDropShadow = l.hasDropShadow);
	}
	static measureText(t = " ", n, r = e._canvas, i = n.wordWrap) {
		let a = `${t}-${n.styleKey}-wordWrap-${i}`;
		if (e._measurementCache.has(a)) return e._measurementCache.get(a);
		if (V_(n) && H_(t)) {
			let r = sv(t, n, i, e._context, e._measureText, e._measureTextAdvance, e.measureFont, e.canBreakChars, e.wordWrapSplit), o = new e(t, n, r.width, r.height, r.lines, r.lineWidths, r.lineHeight, r.maxLineWidth, r.fontProperties, {
				runsByLine: r.runsByLine,
				lineAscents: r.lineAscents,
				lineDescents: r.lineDescents,
				lineHeights: r.lineHeights,
				hasDropShadow: r.hasDropShadow
			});
			return e._measurementCache.set(a, o), o;
		}
		let o = n._fontString, s = e.measureFont(o);
		s.fontSize === 0 && (s.fontSize = n.fontSize, s.ascent = n.fontSize, s.descent = 0);
		let c = e._context;
		c.font = o;
		let l = (i ? e._wordWrap(t, n, r) : t).split(X_), u = Array(l.length), d = 0;
		for (let t = 0; t < l.length; t++) {
			let r = e._measureText(l[t], n.letterSpacing, c);
			u[t] = r, d = Math.max(d, r);
		}
		let f = n._stroke?.width ?? 0, p = n.lineHeight || s.fontSize, m = e._adjustWidthForStyle(d, n), h = Math.max(p, s.fontSize + f) + (l.length - 1) * (p + n.leading), g = e._adjustHeightForStyle(h, n), _ = new e(t, n, m, g, l, u, p + n.leading, d, s);
		return e._measurementCache.set(a, _), _;
	}
	static _adjustWidthForStyle(e, t) {
		let n = e + (t._stroke?.width || 0);
		return t.dropShadow && (n += t.dropShadow.distance), n;
	}
	static _adjustHeightForStyle(e, t) {
		let n = e;
		return t.dropShadow && (n += t.dropShadow.distance), n;
	}
	static _measureText(t, n, r) {
		let { metricWidth: i, metrics: a, letterSpacingVal: o } = e._measureTextCore(t, n, r), s = -(a.actualBoundingBoxLeft ?? 0), c = (a.actualBoundingBoxRight ?? 0) - s;
		return a.width > 0 && (c += o), Math.max(i, c);
	}
	static _measureTextAdvance(t, n, r) {
		return e._measureTextCore(t, n, r).metricWidth;
	}
	static _measureTextCore(t, n, r) {
		let i = !1;
		e.experimentalLetterSpacingSupported && (e.experimentalLetterSpacing ? (r.letterSpacing = `${n}px`, r.textLetterSpacing = `${n}px`, i = !0) : (r.letterSpacing = "0px", r.textLetterSpacing = "0px"));
		let a = r.measureText(t), o = a.width, s = 0;
		return o > 0 && (s = i ? -n : (e.graphemeSegmenter(t).length - 1) * n, o += s), {
			metricWidth: o,
			metrics: a,
			letterSpacingVal: s
		};
	}
	static _wordWrap(t, n, r = e._canvas) {
		return fv(t, n, r, e._measureTextAdvance, e.canBreakWords, e.canBreakChars, e.wordWrapSplit);
	}
	static isBreakingSpace(e, t) {
		return Q_(e, t);
	}
	static canBreakWords(e, t) {
		return t;
	}
	static canBreakChars(e, t, n, r, i) {
		return !0;
	}
	static wordWrapSplit(t) {
		return e.graphemeSegmenter(t);
	}
	static measureFont(t) {
		if (e._fonts[t]) return e._fonts[t];
		let n = e._context;
		n.font = t;
		let r = n.measureText(e.METRICS_STRING + e.BASELINE_SYMBOL), i = r.actualBoundingBoxAscent ?? 0, a = r.actualBoundingBoxDescent ?? 0, o = {
			ascent: i,
			descent: a,
			fontSize: i + a
		};
		return e._fonts[t] = o, o;
	}
	static clearMetrics(t = "") {
		t ? delete e._fonts[t] : e._fonts = {};
	}
	static get _canvas() {
		if (!e.__canvas) {
			let t;
			try {
				let n = new OffscreenCanvas(0, 0), r = n.getContext("2d", pv);
				if (r != null && r.measureText) return e.__canvas = n, n;
				t = X.get().createCanvas();
			} catch {
				t = X.get().createCanvas();
			}
			t.width = t.height = 10, e.__canvas = t;
		}
		return e.__canvas;
	}
	static get _context() {
		return e.__context ||= e._canvas.getContext("2d", pv), e.__context;
	}
};
mv.METRICS_STRING = "|ÉqÅ", mv.BASELINE_SYMBOL = "M", mv.BASELINE_MULTIPLIER = 1.4, mv.HEIGHT_MULTIPLIER = 2, mv.graphemeSegmenter = (() => {
	if (typeof (Intl == null ? void 0 : Intl.Segmenter) == "function") {
		let e = new Intl.Segmenter();
		return (t) => {
			let n = e.segment(t), r = [], i = 0;
			for (let e of n) r[i++] = e.segment;
			return r;
		};
	}
	return (e) => [...e];
})(), mv.experimentalLetterSpacing = !1, mv._fonts = {}, mv._measurementCache = B_(1e3);
var hv = mv, gv = [
	"serif",
	"sans-serif",
	"monospace",
	"cursive",
	"fantasy",
	"system-ui"
];
function _v(e) {
	let t = typeof e.fontSize == "number" ? `${e.fontSize}px` : e.fontSize, n = e.fontFamily;
	Array.isArray(e.fontFamily) || (n = e.fontFamily.split(","));
	for (let e = n.length - 1; e >= 0; e--) {
		let t = n[e].trim();
		!/([\"\'])[^\'\"]+\1/.test(t) && !gv.includes(t) && (t = `"${t}"`), n[e] = t;
	}
	return `${e.fontStyle} ${e.fontVariant} ${e.fontWeight} ${t} ${n.join(",")}`;
}
var vv = 1e5;
function yv(e, t, n, r = 0, i = 0, a = 0) {
	if (e.texture === J.WHITE && !e.fill) return z.shared.setValue(e.color).setAlpha(e.alpha ?? 1).toHexa();
	if (e.fill) {
		if (e.fill instanceof Vf) {
			let n = e.fill, r = t.createPattern(n.texture.source.resource, "repeat");
			return Z.applyPatternTransform(r, n.transform, !1), r;
		}
		if (e.fill instanceof wd) {
			let o = e.fill, s = o.type === "linear", c = o.textureSpace === "local", l = 1, u = 1;
			c && n && (l = n.width + r, u = n.height + r);
			let d, f = !1;
			if (s) {
				let { start: e, end: n } = o;
				d = t.createLinearGradient(e.x * l + i, e.y * u + a, n.x * l + i, n.y * u + a), f = Math.abs(n.x - e.x) < Math.abs((n.y - e.y) * .1);
			} else {
				let { center: e, innerRadius: n, outerCenter: r, outerRadius: s } = o;
				d = t.createRadialGradient(e.x * l + i, e.y * u + a, n * l, r.x * l + i, r.y * u + a, s * l);
			}
			if (f && c && n) {
				let e = n.lineHeight / u;
				for (let t = 0; t < n.lines.length; t++) {
					let i = (t * n.lineHeight + r / 2) / u;
					o.colorStops.forEach((t) => {
						let n = i + t.offset * e;
						n = Math.max(0, Math.min(1, n)), d.addColorStop(Math.floor(n * vv) / vv, z.shared.setValue(t.color).toHex());
					});
				}
			} else o.colorStops.forEach((e) => {
				d.addColorStop(e.offset, z.shared.setValue(e.color).toHex());
			});
			return d;
		}
	} else {
		let n = t.createPattern(e.texture.source.resource, "repeat"), r = e.matrix.copyTo(B.shared);
		return r.scale(e.texture.source.pixelWidth, e.texture.source.pixelHeight), n.setTransform(r), n;
	}
	return "red";
}
var bv = new qe();
function xv(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) e.charCodeAt(n) === 32 && t++;
	return t;
}
var Sv = new class {
	getCanvasAndContext(e) {
		let { text: t, style: n, resolution: r = 1 } = e, i = n._getFinalPadding(), a = hv.measureText(t || " ", n), o = Math.ceil(Math.ceil(Math.max(1, a.width) + i * 2) * r), s = Math.ceil(Math.ceil(Math.max(1, a.height) + i * 2) * r), c = Wi.getOptimalCanvasAndContext(o, s);
		return this._renderTextToCanvas(n, i, r, c, a), {
			canvasAndContext: c,
			frame: n.trim ? R_({
				canvas: c.canvas,
				width: o,
				height: s,
				resolution: 1,
				output: bv
			}) : bv.set(0, 0, o, s)
		};
	}
	returnCanvasAndContext(e) {
		Wi.returnCanvasAndContext(e);
	}
	_renderTextToCanvas(e, t, n, r, i) {
		var a, o;
		if (i.runsByLine && i.runsByLine.length > 0) {
			this._renderTaggedTextToCanvas(i, e, t, n, r);
			return;
		}
		let { canvas: s, context: c } = r, l = _v(e), u = i.lines, d = i.lineHeight, f = i.lineWidths, p = i.maxLineWidth, m = i.fontProperties, h = s.height;
		if (c.resetTransform(), c.scale(n, n), c.textBaseline = e.textBaseline, (a = e._stroke) != null && a.width) {
			let t = e._stroke;
			c.lineWidth = t.width, c.miterLimit = t.miterLimit, c.lineJoin = t.join, c.lineCap = t.cap;
		}
		c.font = l;
		let g, _, v = e.dropShadow ? 2 : 1, y = (e._stroke?.width ?? 0) / 2, b = (d - m.fontSize) / 2;
		d - m.fontSize < 0 && (b = 0);
		for (let a = 0; a < v; ++a) {
			let s = e.dropShadow && a === 0, l = s ? Math.ceil(Math.max(1, h) + t * 2) : 0, v = l * n;
			if (s) this._setupDropShadow(c, e, n, v);
			else {
				let n = e._gradientBounds, r = e._gradientOffset;
				if (n) {
					let a = {
						width: n.width,
						height: n.height,
						lineHeight: n.height,
						lines: i.lines
					};
					this._setFillAndStrokeStyles(c, e, a, t, y, r?.x ?? 0, r?.y ?? 0);
				} else r ? this._setFillAndStrokeStyles(c, e, i, t, y, r.x, r.y) : this._setFillAndStrokeStyles(c, e, i, t, y);
				c.shadowColor = "rgba(0,0,0,0)";
			}
			for (let n = 0; n < u.length; n++) {
				g = y, _ = y + n * d + m.ascent + b, g += this._getAlignmentOffset(f[n], p, e.align);
				let i = 0;
				if (e.align === "justify" && e.wordWrap && n < u.length - 1) {
					let e = xv(u[n]);
					e > 0 && (i = (p - f[n]) / e);
				}
				(o = e._stroke) != null && o.width && this._drawLetterSpacing(u[n], e, r, g + t, _ + t - l, !0, i), e._fill !== void 0 && this._drawLetterSpacing(u[n], e, r, g + t, _ + t - l, !1, i);
			}
		}
	}
	_renderTaggedTextToCanvas(e, t, n, r, i) {
		var a;
		let { canvas: o, context: s } = i, { runsByLine: c, lineWidths: l, maxLineWidth: u, lineAscents: d, lineHeights: f, hasDropShadow: p } = e, m = o.height;
		s.resetTransform(), s.scale(r, r), s.textBaseline = t.textBaseline;
		let h = p ? 2 : 1, g = t._stroke?.width ?? 0;
		for (let e of c) for (let t of e) {
			let e = t.style._stroke?.width ?? 0;
			e > g && (g = e);
		}
		let _ = g / 2, v = [];
		for (let e = 0; e < c.length; e++) {
			let t = c[e], n = [];
			for (let e of t) {
				let t = _v(e.style);
				s.font = t, n.push({
					width: hv._measureText(e.text, e.style.letterSpacing, s),
					font: t
				});
			}
			v.push(n);
		}
		for (let e = 0; e < h; ++e) {
			let o = p && e === 0, h = o ? Math.ceil(Math.max(1, m) + n * 2) : 0, g = h * r;
			o || (s.shadowColor = "rgba(0,0,0,0)");
			let y = _;
			for (let e = 0; e < c.length; e++) {
				let p = c[e], m = l[e], b = d[e], x = f[e], S = v[e], C = _;
				C += this._getAlignmentOffset(m, u, t.align);
				let w = 0;
				if (t.align === "justify" && t.wordWrap && e < c.length - 1) {
					let e = 0;
					for (let t of p) e += xv(t.text);
					e > 0 && (w = (u - m) / e);
				}
				let T = y + b, E = C + n;
				for (let e = 0; e < p.length; e++) {
					let t = p[e], { width: c, font: l } = S[e];
					if (s.font = l, s.textBaseline = t.style.textBaseline, (a = t.style._stroke) != null && a.width) {
						let e = t.style._stroke;
						if (s.lineWidth = e.width, s.miterLimit = e.miterLimit, s.lineJoin = e.join, s.lineCap = e.cap, o) {
							if (t.style.dropShadow) this._setupDropShadow(s, t.style, r, g);
							else {
								let e = xv(t.text);
								E += c + e * w;
								continue;
							}
						} else {
							let r = hv.measureFont(l), i = t.style.lineHeight || r.fontSize;
							s.strokeStyle = yv(e, s, {
								width: c,
								height: i,
								lineHeight: i,
								lines: [t.text]
							}, n * 2, E - n, y);
						}
						this._drawLetterSpacing(t.text, t.style, i, E, T + n - h, !0, w);
					}
					let u = xv(t.text);
					E += c + u * w;
				}
				E = C + n;
				for (let e = 0; e < p.length; e++) {
					let t = p[e], { width: a, font: c } = S[e];
					if (s.font = c, s.textBaseline = t.style.textBaseline, t.style._fill !== void 0) {
						if (o) {
							if (t.style.dropShadow) this._setupDropShadow(s, t.style, r, g);
							else {
								let e = xv(t.text);
								E += a + e * w;
								continue;
							}
						} else {
							let e = hv.measureFont(c), r = t.style.lineHeight || e.fontSize, i = {
								width: a,
								height: r,
								lineHeight: r,
								lines: [t.text]
							};
							s.fillStyle = yv(t.style._fill, s, i, n * 2, E - n, y);
						}
						this._drawLetterSpacing(t.text, t.style, i, E, T + n - h, !1, w);
					}
					let l = xv(t.text);
					E += a + l * w;
				}
				y += x;
			}
		}
	}
	_setFillAndStrokeStyles(e, t, n, r, i, a = 0, o = 0) {
		var s;
		if (e.fillStyle = t._fill ? yv(t._fill, e, n, r * 2, a, o) : null, (s = t._stroke) != null && s.width) {
			let s = i + r * 2;
			e.strokeStyle = yv(t._stroke, e, n, s, a, o);
		}
	}
	_setupDropShadow(e, t, n, r) {
		e.fillStyle = "black", e.strokeStyle = "black";
		let i = t.dropShadow, a = i.color, o = i.alpha;
		e.shadowColor = z.shared.setValue(a).setAlpha(o).toRgbaString();
		let s = i.blur * n, c = i.distance * n;
		e.shadowBlur = s, e.shadowOffsetX = Math.cos(i.angle) * c, e.shadowOffsetY = Math.sin(i.angle) * c + r;
	}
	_getAlignmentOffset(e, t, n) {
		return n === "right" ? t - e : n === "center" ? (t - e) / 2 : 0;
	}
	_drawLetterSpacing(e, t, n, r, i, a = !1, o = 0) {
		let { context: s } = n, c = t.letterSpacing, l = !1;
		if (hv.experimentalLetterSpacingSupported && (hv.experimentalLetterSpacing ? (s.letterSpacing = `${c}px`, s.textLetterSpacing = `${c}px`, l = !0) : (s.letterSpacing = "0px", s.textLetterSpacing = "0px")), (c === 0 || l) && o === 0) {
			a ? s.strokeText(e, r, i) : s.fillText(e, r, i);
			return;
		}
		if (o !== 0 && (c === 0 || l)) {
			let t = e.split(" "), n = r, c = s.measureText(" ").width;
			for (let e = 0; e < t.length; e++) a ? s.strokeText(t[e], n, i) : s.fillText(t[e], n, i), n += s.measureText(t[e]).width + c + o;
			return;
		}
		let u = r, d = hv.graphemeSegmenter(e), f = s.measureText(e).width, p = 0;
		for (let e = 0; e < d.length; ++e) {
			let t = d[e];
			a ? s.strokeText(t, u, i) : s.fillText(t, u, i);
			let n = "";
			for (let t = e + 1; t < d.length; ++t) n += d[t];
			p = s.measureText(n).width, u += f - p + c, t === " " && (u += o), f = p;
		}
	}
}(), Cv = Object.defineProperty, wv = Object.defineProperties, Tv = Object.getOwnPropertyDescriptors, Ev = Object.getOwnPropertySymbols, Dv = Object.prototype.hasOwnProperty, Ov = Object.prototype.propertyIsEnumerable, kv = (e, t, n) => t in e ? Cv(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Av = (e, t) => {
	for (var n in t ||= {}) Dv.call(t, n) && kv(e, n, t[n]);
	if (Ev) for (var n of Ev(t)) Ov.call(t, n) && kv(e, n, t[n]);
	return e;
}, jv = (e, t) => wv(e, Tv(t)), Mv = class e extends C {
	constructor(t = {}) {
		super(), this.uid = H("textStyle"), this._tick = 0, this._cachedFontString = null, Pv(t), t instanceof e && (t = t._toObject());
		let n = Av(Av({}, e.defaultTextStyle), t);
		for (let e in n) {
			let t = e;
			this[t] = n[e];
		}
		this._tagStyles = t.tagStyles ?? void 0, this.update(), this._tick = 0;
	}
	get align() {
		return this._align;
	}
	set align(e) {
		this._align !== e && (this._align = e, this.update());
	}
	get breakWords() {
		return this._breakWords;
	}
	set breakWords(e) {
		this._breakWords !== e && (this._breakWords = e, this.update());
	}
	get dropShadow() {
		return this._dropShadow;
	}
	set dropShadow(t) {
		this._dropShadow !== t && (this._dropShadow = typeof t == "object" && t ? this._createProxy(Av(Av({}, e.defaultDropShadow), t)) : t ? this._createProxy(Av({}, e.defaultDropShadow)) : null, this.update());
	}
	get fontFamily() {
		return this._fontFamily;
	}
	set fontFamily(e) {
		this._fontFamily !== e && (this._fontFamily = e, this.update());
	}
	get fontSize() {
		return this._fontSize;
	}
	set fontSize(e) {
		this._fontSize !== e && (this._fontSize = typeof e == "string" ? parseInt(e, 10) : e, this.update());
	}
	get fontStyle() {
		return this._fontStyle;
	}
	set fontStyle(e) {
		this._fontStyle !== e && (this._fontStyle = e.toLowerCase(), this.update());
	}
	get fontVariant() {
		return this._fontVariant;
	}
	set fontVariant(e) {
		this._fontVariant !== e && (this._fontVariant = e, this.update());
	}
	get fontWeight() {
		return this._fontWeight;
	}
	set fontWeight(e) {
		this._fontWeight !== e && (this._fontWeight = e, this.update());
	}
	get leading() {
		return this._leading;
	}
	set leading(e) {
		this._leading !== e && (this._leading = e, this.update());
	}
	get letterSpacing() {
		return this._letterSpacing;
	}
	set letterSpacing(e) {
		this._letterSpacing !== e && (this._letterSpacing = e, this.update());
	}
	get lineHeight() {
		return this._lineHeight;
	}
	set lineHeight(e) {
		this._lineHeight !== e && (this._lineHeight = e, this.update());
	}
	get padding() {
		return this._padding;
	}
	set padding(e) {
		this._padding !== e && (this._padding = e, this.update());
	}
	get filters() {
		return this._filters;
	}
	set filters(e) {
		this._filters !== e && (this._filters = Object.freeze(e), this.update());
	}
	get trim() {
		return this._trim;
	}
	set trim(e) {
		this._trim !== e && (this._trim = e, this.update());
	}
	get textBaseline() {
		return this._textBaseline;
	}
	set textBaseline(e) {
		this._textBaseline !== e && (this._textBaseline = e, this.update());
	}
	get whiteSpace() {
		return this._whiteSpace;
	}
	set whiteSpace(e) {
		this._whiteSpace !== e && (this._whiteSpace = e, this.update());
	}
	get wordWrap() {
		return this._wordWrap;
	}
	set wordWrap(e) {
		this._wordWrap !== e && (this._wordWrap = e, this.update());
	}
	get wordWrapWidth() {
		return this._wordWrapWidth;
	}
	set wordWrapWidth(e) {
		this._wordWrapWidth !== e && (this._wordWrapWidth = e, this.update());
	}
	get fill() {
		return this._originalFill;
	}
	set fill(e) {
		e !== this._originalFill && (this._originalFill = e, this._isFillStyle(e) && (this._originalFill = this._createProxy(Av(Av({}, gp.defaultFillStyle), e), () => {
			this._fill = ip(Av({}, this._originalFill), gp.defaultFillStyle);
		})), this._fill = ip(e === 0 ? "black" : e, gp.defaultFillStyle), this.update());
	}
	get stroke() {
		return this._originalStroke;
	}
	set stroke(e) {
		e !== this._originalStroke && (this._originalStroke = e, this._isFillStyle(e) && (this._originalStroke = this._createProxy(Av(Av({}, gp.defaultStrokeStyle), e), () => {
			this._stroke = ap(Av({}, this._originalStroke), gp.defaultStrokeStyle);
		})), this._stroke = ap(e, gp.defaultStrokeStyle), this.update());
	}
	get tagStyles() {
		return this._tagStyles;
	}
	set tagStyles(e) {
		this._tagStyles !== e && (this._tagStyles = e ?? void 0, this.update());
	}
	update() {
		this._tick++, this._cachedFontString = null, this.emit("update", this);
	}
	reset() {
		let t = e.defaultTextStyle;
		for (let e in t) this[e] = t[e];
	}
	assign(e) {
		for (let t in e) {
			let n = t;
			this[n] = e[t];
		}
		return this;
	}
	get styleKey() {
		return `${this.uid}-${this._tick}`;
	}
	get _fontString() {
		return this._cachedFontString === null && (this._cachedFontString = _v(this)), this._cachedFontString;
	}
	_toObject() {
		return {
			align: this.align,
			breakWords: this.breakWords,
			dropShadow: this._dropShadow ? Av({}, this._dropShadow) : null,
			fill: this._fill ? Av({}, this._fill) : void 0,
			fontFamily: this.fontFamily,
			fontSize: this.fontSize,
			fontStyle: this.fontStyle,
			fontVariant: this.fontVariant,
			fontWeight: this.fontWeight,
			leading: this.leading,
			letterSpacing: this.letterSpacing,
			lineHeight: this.lineHeight,
			padding: this.padding,
			stroke: this._stroke ? Av({}, this._stroke) : void 0,
			textBaseline: this.textBaseline,
			trim: this.trim,
			whiteSpace: this.whiteSpace,
			wordWrap: this.wordWrap,
			wordWrapWidth: this.wordWrapWidth,
			filters: this._filters ? [...this._filters] : void 0,
			tagStyles: this._tagStyles ? Av({}, this._tagStyles) : void 0
		};
	}
	clone() {
		return new e(this._toObject());
	}
	_getFinalPadding() {
		let e = 0;
		if (this._filters) for (let t = 0; t < this._filters.length; t++) e += this._filters[t].padding;
		return Math.max(this._padding, e);
	}
	destroy(e = !1) {
		var t, n, r, i;
		if (this.removeAllListeners(), typeof e == "boolean" ? e : e?.texture) {
			let a = typeof e == "boolean" ? e : e?.textureSource;
			(t = this._fill) != null && t.texture && this._fill.texture.destroy(a), (n = this._originalFill) != null && n.texture && this._originalFill.texture.destroy(a), (r = this._stroke) != null && r.texture && this._stroke.texture.destroy(a), (i = this._originalStroke) != null && i.texture && this._originalStroke.texture.destroy(a);
		}
		this._fill = null, this._stroke = null, this.dropShadow = null, this._originalStroke = null, this._originalFill = null;
	}
	_createProxy(e, t) {
		return new Proxy(e, { set: (e, n, r) => (e[n] === r || (e[n] = r, t?.(n, r), this.update()), !0) });
	}
	_isFillStyle(e) {
		return (e ?? null) !== null && !(z.isColorLike(e) || e instanceof wd || e instanceof Vf);
	}
};
Mv.defaultDropShadow = {
	alpha: 1,
	angle: Math.PI / 6,
	blur: 0,
	color: "black",
	distance: 5
}, Mv.defaultTextStyle = {
	align: "left",
	breakWords: !1,
	dropShadow: null,
	fill: "black",
	fontFamily: "Arial",
	fontSize: 26,
	fontStyle: "normal",
	fontVariant: "normal",
	fontWeight: "normal",
	leading: 0,
	letterSpacing: 0,
	lineHeight: 0,
	padding: 0,
	stroke: null,
	textBaseline: "alphabetic",
	trim: !1,
	whiteSpace: "pre",
	wordWrap: !1,
	wordWrapWidth: 100
};
var Nv = Mv;
function Pv(e) {
	let t = e;
	if (typeof t.dropShadow == "boolean" && t.dropShadow) {
		let n = Nv.defaultDropShadow;
		e.dropShadow = {
			alpha: t.dropShadowAlpha ?? n.alpha,
			angle: t.dropShadowAngle ?? n.angle,
			blur: t.dropShadowBlur ?? n.blur,
			color: t.dropShadowColor ?? n.color,
			distance: t.dropShadowDistance ?? n.distance
		};
	}
	if (t.strokeThickness !== void 0) {
		let n = t.stroke, r = {};
		if (z.isColorLike(n)) r.color = n;
		else if (n instanceof wd || n instanceof Vf) r.fill = n;
		else if (Object.hasOwnProperty.call(n, "color") || Object.hasOwnProperty.call(n, "fill")) r = n;
		else throw Error("Invalid stroke value.");
		e.stroke = jv(Av({}, r), { width: t.strokeThickness });
	}
	if (Array.isArray(t.fillGradientStops)) {
		if (!Array.isArray(t.fill) || t.fill.length === 0) throw Error("Invalid fill value. Expected an array of colors for gradient fill.");
		t.fill.length, t.fillGradientStops.length;
		let n = new wd({
			start: {
				x: 0,
				y: 0
			},
			end: {
				x: 0,
				y: 1
			},
			textureSpace: "local"
		}), r = t.fillGradientStops.slice(), i = t.fill.map((e) => z.shared.setValue(e).toNumber());
		r.forEach((e, t) => {
			n.addColorStop(e, i[t]);
		}), e.fill = { fill: n };
	}
}
function Fv(e, t) {
	let { texture: n, bounds: r } = e, i = t._style._getFinalPadding();
	ai(r, t._anchor, n);
	let a = t._anchor._x * i * 2, o = t._anchor._y * i * 2;
	r.minX -= i - a, r.minY -= i - o, r.maxX -= i - a, r.maxY -= i - o;
}
var Iv = class {
	constructor() {
		this.batcherName = "default", this.topology = "triangle-list", this.attributeSize = 4, this.indexSize = 6, this.packAsQuad = !0, this.roundPixels = 0, this._attributeStart = 0, this._batcher = null, this._batch = null;
	}
	get blendMode() {
		return this.renderable.groupBlendMode;
	}
	get color() {
		return this.renderable.groupColorAlpha;
	}
	reset() {
		this.renderable = null, this.texture = null, this._batcher = null, this._batch = null, this.bounds = null;
	}
	destroy() {
		this.reset();
	}
}, Lv = class extends Iv {}, Rv = class {
	constructor(e) {
		this._renderer = e, e.runners.resolutionChange.add(this), this._managedTexts = new Bu({
			renderer: e,
			type: "renderable",
			onUnload: this.onTextUnload.bind(this),
			name: "canvasText"
		});
	}
	resolutionChange() {
		for (let e in this._managedTexts.items) {
			let t = this._managedTexts.items[e];
			t != null && t._autoResolution && t.onViewUpdate();
		}
	}
	validateRenderable(e) {
		let t = this._getGpuText(e), n = e.styleKey;
		return t.currentKey !== n || e._didTextUpdate;
	}
	addRenderable(e, t) {
		let n = this._getGpuText(e);
		if (e._didTextUpdate) {
			let t = e._autoResolution ? this._renderer.resolution : e.resolution;
			(n.currentKey !== e.styleKey || e._resolution !== t) && this._updateGpuText(e), e._didTextUpdate = !1, Fv(n, e);
		}
		this._renderer.renderPipes.batch.addToBatch(n, t);
	}
	updateRenderable(e) {
		let t = this._getGpuText(e);
		t._batcher.updateElement(t);
	}
	_updateGpuText(e) {
		let t = this._getGpuText(e);
		t.texture && this._renderer.canvasText.decreaseReferenceCount(t.currentKey), e._resolution = e._autoResolution ? this._renderer.resolution : e.resolution, t.texture = this._renderer.canvasText.getManagedTexture(e), t.currentKey = e.styleKey;
	}
	_getGpuText(e) {
		return e._gpuData[this._renderer.uid] || this.initGpuText(e);
	}
	initGpuText(e) {
		let t = new Lv();
		return t.currentKey = "--", t.renderable = e, t.transform = e.groupTransform, t.bounds = {
			minX: 0,
			maxX: 1,
			minY: 0,
			maxY: 0
		}, t.roundPixels = this._renderer._roundPixels | e._roundPixels, e._gpuData[this._renderer.uid] = t, this._managedTexts.add(e), t;
	}
	onTextUnload(e) {
		let t = e._gpuData[this._renderer.uid];
		if (!t) return;
		let { canvasText: n } = this._renderer;
		n.getReferenceCount(t.currentKey) > 0 ? n.decreaseReferenceCount(t.currentKey) : t.texture && n.returnTexture(t.texture);
	}
	destroy() {
		this._managedTexts.destroy(), this._renderer = null;
	}
};
Rv.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "text"
};
var zv = class {
	constructor(e, t) {
		this._activeTextures = {}, this._renderer = e, this._retainCanvasContext = t;
	}
	getTexture(e, t, n, r) {
		typeof e == "string" && (e = {
			text: e,
			style: n,
			resolution: t
		}), e.style instanceof Nv || (e.style = new Nv(e.style)), e.textureStyle instanceof Ot || (e.textureStyle = new Ot(e.textureStyle)), typeof e.text != "string" && (e.text = e.text.toString());
		let { text: i, style: a, textureStyle: o, autoGenerateMipmaps: s } = e, c = e.resolution ?? this._renderer.resolution, { frame: l, canvasAndContext: u } = Sv.getCanvasAndContext({
			text: i,
			style: a,
			resolution: c
		}), d = ra(u.canvas, l.width, l.height, c, s);
		if (o && (d.source.style = o), a.trim && (l.pad(a.padding), d.frame.copyFrom(l), d.frame.scale(1 / c), d.updateUvs()), a.filters) {
			let e = this._applyFilters(d, a.filters);
			return this.returnTexture(d), Sv.returnCanvasAndContext(u), e;
		}
		return this._renderer.texture.initSource(d._source), this._retainCanvasContext || Sv.returnCanvasAndContext(u), d;
	}
	returnTexture(e) {
		let t = e.source, n = t.resource;
		if (this._retainCanvasContext && n != null && n.getContext) {
			let e = n.getContext("2d");
			e && Sv.returnCanvasAndContext({
				canvas: n,
				context: e
			});
		}
		t.resource = null, t.uploadMethodId = "unknown", t.alphaMode = "no-premultiply-alpha", hn.returnTexture(e, !0);
	}
	renderTextToCanvas() {}
	getManagedTexture(e) {
		e._resolution = e._autoResolution ? this._renderer.resolution : e.resolution;
		let t = e.styleKey;
		if (this._activeTextures[t]) return this._increaseReferenceCount(t), this._activeTextures[t].texture;
		let n = this.getTexture({
			text: e.text,
			style: e.style,
			resolution: e._resolution,
			textureStyle: e.textureStyle,
			autoGenerateMipmaps: e.autoGenerateMipmaps
		});
		return this._activeTextures[t] = {
			texture: n,
			usageCount: 1
		}, n;
	}
	decreaseReferenceCount(e) {
		let t = this._activeTextures[e];
		t && (t.usageCount--, t.usageCount === 0 && (this.returnTexture(t.texture), this._activeTextures[e] = null));
	}
	getReferenceCount(e) {
		return this._activeTextures[e]?.usageCount ?? 0;
	}
	_increaseReferenceCount(e) {
		this._activeTextures[e].usageCount++;
	}
	_applyFilters(e, t) {
		let n = this._renderer.renderTarget.renderTarget, r = this._renderer.filter.generateFilteredTexture({
			texture: e,
			filters: t
		});
		return this._renderer.renderTarget.bind(n, !1), r;
	}
	destroy() {
		this._renderer = null;
		for (let e in this._activeTextures) this._activeTextures[e] && this.returnTexture(this._activeTextures[e].texture);
		this._activeTextures = null;
	}
}, Bv = class extends zv {
	constructor(e) {
		super(e, !0);
	}
};
Bv.extension = {
	type: [h.CanvasSystem],
	name: "canvasText"
};
var Vv = class extends zv {
	constructor(e) {
		super(e, !1);
	}
};
Vv.extension = {
	type: [h.WebGLSystem, h.WebGPUSystem],
	name: "canvasText"
}, v.add(Bv), v.add(Vv), v.add(Rv);
var Hv = class extends j_ {
	constructor(...e) {
		let t = M_(e, "Text");
		super(t, Nv), this.renderPipeId = "text", t.textureStyle && (this.textureStyle = t.textureStyle instanceof Ot ? t.textureStyle : new Ot(t.textureStyle)), this.autoGenerateMipmaps = t.autoGenerateMipmaps ?? It.defaultOptions.autoGenerateMipmaps;
	}
	updateBounds() {
		let e = this._bounds, t = this._anchor, n = 0, r = 0;
		if (this._style.trim) {
			let { frame: e, canvasAndContext: t } = Sv.getCanvasAndContext({
				text: this.text,
				style: this._style,
				resolution: 1
			});
			Sv.returnCanvasAndContext(t), n = e.width, r = e.height;
		} else {
			let e = hv.measureText(this._text, this._style);
			n = e.width, r = e.height;
		}
		e.minX = -t._x * n, e.maxX = e.minX + n, e.minY = -t._y * r, e.maxY = e.minY + r;
	}
}, Uv = class extends Jh {
	resolveQueueItem(e, t) {
		return e instanceof Y ? this.resolveContainerQueueItem(e, t) : e instanceof It || e instanceof J ? t.push(e.source) : e instanceof gp && t.push(e), null;
	}
	resolveContainerQueueItem(e, t) {
		e instanceof pi || e instanceof C_ || e instanceof Og ? t.push(e.texture.source) : e instanceof Hv ? t.push(e) : e instanceof $ ? t.push(e.context) : e instanceof zg && e.textures.forEach((e) => {
			e.source ? t.push(e.source) : t.push(e.texture.source);
		});
	}
	resolveGraphicsContextQueueItem(e) {
		this.renderer.graphicsContext.getGpuContext(e);
		let { instructions: t } = e;
		for (let e of t) if (e.action === "texture") {
			let { image: t } = e.data;
			return t.source;
		} else if (e.action === "fill") {
			let { texture: t } = e.data.style;
			return t.source;
		}
		return null;
	}
}, Wv = class extends C {
	constructor() {
		super(...arguments), this.chars = Object.create(null), this.lineHeight = 0, this.fontFamily = "", this.fontMetrics = {
			fontSize: 0,
			ascent: 0,
			descent: 0
		}, this.baseLineOffset = 0, this.distanceField = {
			type: "none",
			range: 0
		}, this.pages = [], this.applyFillAsTint = !0, this.baseMeasurementFontSize = 100, this.baseRenderedFontSize = 100;
	}
	get font() {
		return this.fontFamily;
	}
	get pageTextures() {
		return this.pages;
	}
	get size() {
		return this.fontMetrics.fontSize;
	}
	get distanceFieldRange() {
		return this.distanceField.range;
	}
	get distanceFieldType() {
		return this.distanceField.type;
	}
	destroy(e = !1) {
		var t;
		this.emit("destroy", this), this.removeAllListeners();
		for (let e in this.chars) (t = this.chars[e].texture) == null || t.destroy();
		this.chars = null, e && (this.pages.forEach((e) => e.texture.destroy(!0)), this.pages = null);
	}
}, Gv = Object.defineProperty, Kv = Object.getOwnPropertySymbols, qv = Object.prototype.hasOwnProperty, Jv = Object.prototype.propertyIsEnumerable, Yv = (e, t, n) => t in e ? Gv(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Xv = (e, t) => {
	for (var n in t ||= {}) qv.call(t, n) && Yv(e, n, t[n]);
	if (Kv) for (var n of Kv(t)) Jv.call(t, n) && Yv(e, n, t[n]);
	return e;
}, Zv = class e extends Wv {
	constructor(t) {
		super(), this.resolution = 1, this.pages = [], this._padding = 0, this._measureCache = Object.create(null), this._currentChars = [], this._currentX = 0, this._currentY = 0, this._currentMaxCharHeight = 0, this._currentPageIndex = -1, this._skipKerning = !1;
		let n = Xv(Xv({}, e.defaultOptions), t);
		this._textureSize = n.textureSize, this._mipmap = n.mipmap;
		let r = n.style.clone();
		n.overrideFill && (r._fill.color = 16777215, r._fill.alpha = 1, r._fill.texture = J.WHITE, r._fill.fill = null), this.applyFillAsTint = n.overrideFill;
		let i = r.fontSize;
		r.fontSize = this.baseMeasurementFontSize;
		let a = _v(r);
		n.overrideSize ? (r._stroke && (r._stroke.width *= this.baseRenderedFontSize / i), r.dropShadow && (r.dropShadow.blur *= this.baseRenderedFontSize / i, r.dropShadow.distance *= this.baseRenderedFontSize / i)) : r.fontSize = this.baseRenderedFontSize = i, this._style = r, this._skipKerning = n.skipKerning ?? !1, this.resolution = n.resolution ?? 1, this._padding = n.padding ?? 4, n.textureStyle && (this._textureStyle = n.textureStyle instanceof Ot ? n.textureStyle : new Ot(n.textureStyle)), this.fontMetrics = hv.measureFont(a), this.lineHeight = r.lineHeight || this.fontMetrics.fontSize || r.fontSize;
	}
	ensureCharacters(e) {
		let t = hv.graphemeSegmenter(e).filter((e) => !this._currentChars.includes(e)).filter((e, t, n) => n.indexOf(e) === t);
		if (!t.length) return;
		this._currentChars = [...this._currentChars, ...t];
		let n;
		n = this._currentPageIndex === -1 ? this._nextPage() : this.pages[this._currentPageIndex];
		let { canvas: r, context: i } = n.canvasAndContext, a = n.texture.source, o = this._style, s = this._currentX, c = this._currentY, l = this._currentMaxCharHeight, u = this.baseRenderedFontSize / this.baseMeasurementFontSize, d = (o.dropShadow?.distance ?? 0) + (o._stroke?.width ?? 0), f = this._padding + d, p = !1, m = r.width / this.resolution, h = r.height / this.resolution;
		for (let e = 0; e < t.length; e++) {
			let n = t[e], d = hv.measureText(n, o, r, !1);
			d.lineHeight = d.height;
			let g = d.width * u, _ = Math.ceil((o.fontStyle === "italic" ? 2 : 1) * g), v = d.height * u, y = _ + f * 2, b = v + f * 2;
			if (p = !1, n !== "\n" && n !== "\r" && n !== "	" && n !== " " && (p = !0, l = Math.ceil(Math.max(b, l))), s + y > m && (c += l, l = b, s = 0, c + l > h)) {
				a.update();
				let e = this._nextPage();
				r = e.canvasAndContext.canvas, i = e.canvasAndContext.context, a = e.texture.source, s = 0, c = 0, l = 0;
			}
			let x = i.measureText(n).width / u;
			if (this.chars[n] = {
				id: n.codePointAt(0),
				xOffset: -(f / u),
				yOffset: -(f / u),
				xAdvance: x,
				kerning: {}
			}, p) {
				this._drawGlyph(i, d, s + f, c + f, u, o);
				let e = a.width * u, t = a.height * u, r = new qe(s / e * a.width, c / t * a.height, y / e * a.width, b / t * a.height);
				this.chars[n].texture = new J({
					source: a,
					frame: r
				}), s += Math.ceil(y);
			}
		}
		a.update(), this._currentX = s, this._currentY = c, this._currentMaxCharHeight = l, this._skipKerning || this._applyKerning(t, i, u);
	}
	get pageTextures() {
		return this.pages;
	}
	_applyKerning(e, t, n) {
		let r = this._measureCache;
		for (let i = 0; i < e.length; i++) {
			let a = e[i];
			for (let e = 0; e < this._currentChars.length; e++) {
				let i = this._currentChars[e], o = r[a];
				o ||= r[a] = t.measureText(a).width;
				let s = r[i];
				s ||= r[i] = t.measureText(i).width;
				let c = t.measureText(a + i).width, l = c - (o + s);
				l && this.chars[a] && (this.chars[a].kerning[i] = l / n), c = t.measureText(a + i).width, l = c - (o + s), l && this.chars[i] && (this.chars[i].kerning[a] = l / n);
			}
		}
	}
	_nextPage() {
		this._currentPageIndex++;
		let e = this.resolution, t = Wi.getOptimalCanvasAndContext(this._textureSize, this._textureSize, e);
		this._setupContext(t.context, this._style, e);
		let n = e * (this.baseRenderedFontSize / this.baseMeasurementFontSize), r = new J({ source: new Si({
			resource: t.canvas,
			resolution: n,
			alphaMode: "premultiply-alpha-on-upload",
			autoGenerateMipmaps: this._mipmap
		}) });
		this._textureStyle && (r.source.style = this._textureStyle);
		let i = {
			canvasAndContext: t,
			texture: r
		};
		return this.pages[this._currentPageIndex] = i, i;
	}
	_setupContext(e, t, n) {
		t.fontSize = this.baseRenderedFontSize, e.scale(n, n), e.font = _v(t), t.fontSize = this.baseMeasurementFontSize, e.textBaseline = t.textBaseline;
		let r = t._stroke, i = r?.width ?? 0;
		if (r && (e.lineWidth = i, e.lineJoin = r.join, e.miterLimit = r.miterLimit, e.strokeStyle = yv(r, e)), t._fill && (e.fillStyle = yv(t._fill, e)), t.dropShadow) {
			let r = t.dropShadow, i = z.shared.setValue(r.color).toArray(), a = r.blur * n, o = r.distance * n;
			e.shadowColor = `rgba(${i[0] * 255},${i[1] * 255},${i[2] * 255},${r.alpha})`, e.shadowBlur = a, e.shadowOffsetX = Math.cos(r.angle) * o, e.shadowOffsetY = Math.sin(r.angle) * o;
		} else e.shadowColor = "black", e.shadowBlur = 0, e.shadowOffsetX = 0, e.shadowOffsetY = 0;
	}
	_drawGlyph(e, t, n, r, i, a) {
		let o = t.text, s = t.fontProperties, c = (a._stroke?.width ?? 0) * i, l = n + c / 2, u = r - c / 2, d = s.descent * i, f = t.lineHeight * i, p = !1;
		a.stroke && c && (p = !0, e.strokeText(o, l, u + f - d));
		let { shadowBlur: m, shadowOffsetX: h, shadowOffsetY: g } = e;
		a._fill && (p && (e.shadowBlur = 0, e.shadowOffsetX = 0, e.shadowOffsetY = 0), e.fillText(o, l, u + f - d)), p && (e.shadowBlur = m, e.shadowOffsetX = h, e.shadowOffsetY = g);
	}
	destroy() {
		super.destroy();
		for (let e = 0; e < this.pages.length; e++) {
			let { canvasAndContext: t, texture: n } = this.pages[e];
			Wi.returnCanvasAndContext(t), n.destroy(!0);
		}
		this.pages = null;
	}
};
Zv.defaultOptions = {
	textureSize: 512,
	style: new Nv(),
	mipmap: !0
};
var Qv = Zv;
function $v(e, t, n, r) {
	let i = {
		width: 0,
		height: 0,
		offsetY: 0,
		scale: t.fontSize / n.baseMeasurementFontSize,
		lines: [{
			width: 0,
			charPositions: [],
			spaceWidth: 0,
			spacesIndex: [],
			chars: []
		}]
	};
	i.offsetY = n.baseLineOffset;
	let a = i.lines[0], o = null, s = !0, c = {
		spaceWord: !1,
		width: 0,
		start: 0,
		index: 0,
		positions: [],
		chars: []
	}, l = n.baseMeasurementFontSize / t.fontSize, u = t.letterSpacing * l, d = t.wordWrapWidth * l, f = t.lineHeight ? t.lineHeight * l : n.lineHeight, p = t.wordWrap && t.breakWords, m = tv(t.whiteSpace), h = nv(t.whiteSpace);
	if (m || h) {
		let t = [], n = m;
		for (let r = 0; r < e.length; r++) {
			let i = e[r];
			if (i === "\r" || i === "\n") {
				if (h) i === "\r" && e[r + 1] === "\n" && r++, i = " ";
				else {
					m && (n = !0), t.push(i);
					continue;
				}
			}
			if (Q_(i)) {
				if (m && $_(i)) {
					if (n) continue;
					n = !0, t.push(" ");
				} else n = !1, t.push(i);
			} else n = !1, t.push(i);
		}
		e = t;
	}
	let g = (e) => {
		let t = a.width;
		for (let n = 0; n < c.index; n++) {
			let r = e.positions[n];
			a.chars.push(e.chars[n]), a.charPositions.push(r + t);
		}
		a.width += e.width, (c.index > 0 || !m) && (s = !1), c.width = 0, c.index = 0, c.chars.length = 0;
	}, _ = () => {
		let e = a.chars.length - 1;
		if (r) {
			let t = a.chars[e];
			for (; $_(t);) a.width -= n.chars[t].xAdvance, a.spacesIndex.pop(), t = a.chars[--e];
		}
		i.width = Math.max(i.width, a.width), a = {
			width: 0,
			charPositions: [],
			chars: [],
			spaceWidth: 0,
			spacesIndex: []
		}, s = !0, i.lines.push(a), i.height += f;
	}, v = (e) => e - u > d;
	for (let r = 0; r < e.length + 1; r++) {
		let i, l = r === e.length;
		l || (i = e[r]);
		let d = n.chars[i];
		if (/(?:\s)/.test(i) || i === "\r" || i === "\n" || l) {
			if (!s && t.wordWrap && v(a.width + c.width) ? (_(), g(c), !l && d && a.charPositions.push(0)) : (c.start = a.width, g(c), !l && d && a.charPositions.push(0)), i === "\r" || i === "\n") _();
			else if (!l && d) {
				let e = d.xAdvance + (d.kerning?.[o] || 0) + u;
				a.width += e, a.spaceWidth = e, a.spacesIndex.push(a.charPositions.length), a.chars.push(i);
			}
		} else if (d) {
			let e = d.kerning?.[o] || 0, n = d.xAdvance + e + u;
			p && v(c.width + n) && (s || _(), g(c), _()), c.positions[c.index++] = c.width + e, c.chars.push(i), c.width += n, ev(i) && (!s && t.wordWrap && v(a.width + c.width) && _(), g(c));
		}
		o = i;
	}
	return _(), t.align === "center" ? ey(i) : t.align === "right" ? ty(i) : t.align === "justify" && ny(i), i;
}
function ey(e) {
	for (let t = 0; t < e.lines.length; t++) {
		let n = e.lines[t], r = e.width / 2 - n.width / 2;
		for (let e = 0; e < n.charPositions.length; e++) n.charPositions[e] += r;
	}
}
function ty(e) {
	for (let t = 0; t < e.lines.length; t++) {
		let n = e.lines[t], r = e.width - n.width;
		for (let e = 0; e < n.charPositions.length; e++) n.charPositions[e] += r;
	}
}
function ny(e) {
	let t = e.width;
	for (let n = 0; n < e.lines.length - 2; n++) {
		let r = e.lines[n], i = 0, a = r.spacesIndex[i++], o = 0, s = r.spacesIndex.length, c = (t - r.width) / s;
		for (let e = 0; e < r.charPositions.length; e++) e === a && (a = r.spacesIndex[i++], o += c), r.charPositions[e] += o;
	}
}
function ry(e) {
	if (e === "") return [];
	typeof e == "string" && (e = [e]);
	let t = [];
	for (let n = 0, r = e.length; n < r; n++) {
		let r = e[n];
		if (Array.isArray(r)) {
			if (r.length !== 2) throw Error(`[BitmapFont]: Invalid character range length, expecting 2 got ${r.length}.`);
			if (r[0].length === 0 || r[1].length === 0) throw Error("[BitmapFont]: Invalid character delimiter.");
			let e = r[0].charCodeAt(0), n = r[1].charCodeAt(0);
			if (n < e) throw Error("[BitmapFont]: Invalid character range.");
			for (let r = e, i = n; r <= i; r++) t.push(String.fromCharCode(r));
		} else t.push(...Array.from(r));
	}
	if (t.length === 0) throw Error("[BitmapFont]: Empty set when resolving characters.");
	return t;
}
var iy = Object.defineProperty, ay = Object.getOwnPropertySymbols, oy = Object.prototype.hasOwnProperty, sy = Object.prototype.propertyIsEnumerable, cy = (e, t, n) => t in e ? iy(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, ly = (e, t) => {
	for (var n in t ||= {}) oy.call(t, n) && cy(e, n, t[n]);
	if (ay) for (var n of ay(t)) sy.call(t, n) && cy(e, n, t[n]);
	return e;
}, uy = 0, dy = new class {
	constructor() {
		this.ALPHA = [
			["a", "z"],
			["A", "Z"],
			" "
		], this.NUMERIC = [["0", "9"]], this.ALPHANUMERIC = [
			["a", "z"],
			["A", "Z"],
			["0", "9"],
			" "
		], this.ASCII = [[" ", "~"]], this.defaultOptions = {
			chars: this.ALPHANUMERIC,
			resolution: 1,
			padding: 4,
			skipKerning: !1,
			textureStyle: null
		}, this.measureCache = B_(1e3);
	}
	getFont(e, t) {
		var n, r;
		let i = `${t.fontFamily}-bitmap`, a = !0;
		if (Ii.has(i)) {
			let t = Ii.get(i);
			return (n = t.ensureCharacters) == null || n.call(t, e), t;
		}
		if (t._fill.fill && !t._stroke ? (i += t._fill.fill.styleKey, a = !1) : (t._stroke || t.dropShadow) && (i = `${t.styleKey}-bitmap`, a = !1), i += `-${t.fontStyle}`, i += `-${t.fontVariant}`, i += `-${t.fontWeight}`, !Ii.has(i)) {
			let e = Object.create(t);
			e._lineHeight = 0;
			let n = new Qv(ly({
				style: e,
				overrideFill: a,
				overrideSize: !0
			}, this.defaultOptions));
			uy++, uy > 50 && vf("BitmapText", `You have dynamically created ${uy} bitmap fonts, this can be inefficient. Try pre installing your font styles using \`BitmapFont.install({name:"style1", style})\``), n.once("destroy", () => {
				uy--, Ii.remove(i);
			}), Ii.set(i, n);
		}
		let o = Ii.get(i);
		return (r = o.ensureCharacters) == null || r.call(o, e), o;
	}
	getLayout(e, t, n = !0) {
		let r = this.getFont(e, t), i = `${e}-${t.styleKey}-${n}`;
		if (this.measureCache.has(i)) return this.measureCache.get(i);
		let a = $v(hv.graphemeSegmenter(e), t, r, n);
		return this.measureCache.set(i, a), a;
	}
	measureText(e, t, n = !0) {
		return this.getLayout(e, t, n);
	}
	install(...e) {
		let t = e[0];
		typeof t == "string" && (t = {
			name: t,
			style: e[1],
			chars: e[2]?.chars,
			resolution: e[2]?.resolution,
			padding: e[2]?.padding,
			skipKerning: e[2]?.skipKerning
		});
		let n = t?.name;
		if (!n) throw Error("[BitmapFontManager] Property `name` is required.");
		t = ly(ly({}, this.defaultOptions), t);
		let r = t.style, i = r instanceof Nv ? r : new Nv(r), a = new Qv({
			style: i,
			overrideFill: t.dynamicFill ?? this._canUseTintForStyle(i),
			skipKerning: t.skipKerning,
			padding: t.padding,
			resolution: t.resolution,
			overrideSize: !1,
			textureStyle: t.textureStyle
		}), o = ry(t.chars);
		return a.ensureCharacters(o.join("")), Ii.set(`${n}-bitmap`, a), a.once("destroy", () => Ii.remove(`${n}-bitmap`)), a;
	}
	uninstall(e) {
		let t = `${e}-bitmap`, n = Ii.get(t);
		n && n.destroy();
	}
	_canUseTintForStyle(e) {
		return !e._stroke && (!e.dropShadow || e.dropShadow.color === 0) && !e._fill.fill && e._fill.color === 16777215;
	}
}(), fy = class extends $ {
	destroy() {
		this.context.customShader && this.context.customShader.destroy(), super.destroy();
	}
}, py = class {
	constructor(e) {
		this._renderer = e, this._managedBitmapTexts = new Bu({
			renderer: e,
			type: "renderable",
			priority: -2,
			name: "bitmapText"
		});
	}
	validateRenderable(e) {
		let t = this._getGpuBitmapText(e);
		return this._renderer.renderPipes.graphics.validateRenderable(t);
	}
	addRenderable(e, t) {
		let n = this._getGpuBitmapText(e);
		my(e, n), e._didTextUpdate && (e._didTextUpdate = !1, this._updateContext(e, n)), this._renderer.renderPipes.graphics.addRenderable(n, t), n.context.customShader && this._updateDistanceField(e);
	}
	updateRenderable(e) {
		let t = this._getGpuBitmapText(e);
		my(e, t), this._renderer.renderPipes.graphics.updateRenderable(t), t.context.customShader && this._updateDistanceField(e);
	}
	_updateContext(e, t) {
		let { context: n } = t, r = dy.getFont(e.text, e._style);
		if (n.clear(), r.distanceField.type !== "none") {
			let e = this.getSdfShader();
			e && (n.customShader ||= e);
		}
		let i = hv.graphemeSegmenter(e.text), a = e._style, o = r.baseLineOffset, s = $v(i, a, r, !0), c = a.padding, l = s.scale, u = s.width, d = s.height + s.offsetY;
		a._stroke && (u += a._stroke.width / l, d += a._stroke.width / l), n.translate(-e._anchor._x * u - c, -e._anchor._y * d - c).scale(l, l);
		let f = r.applyFillAsTint ? a._fill.color : 16777215, p = r.fontMetrics.fontSize, m = r.lineHeight;
		a.lineHeight && (p = a.fontSize / l, m = a.lineHeight / l);
		let h = (m - p) / 2;
		h - r.baseLineOffset < 0 && (h = 0);
		for (let e = 0; e < s.lines.length; e++) {
			let t = s.lines[e];
			for (let e = 0; e < t.charPositions.length; e++) {
				let i = t.chars[e], a = r.chars[i];
				if (a != null && a.texture) {
					let r = a.texture;
					n.texture(r, f, Math.round(t.charPositions[e] + a.xOffset), Math.round(o + a.yOffset + h), r.orig.width, r.orig.height);
				}
			}
			o += m;
		}
	}
	_getGpuBitmapText(e) {
		return e._gpuData[this._renderer.uid] || this.initGpuText(e);
	}
	initGpuText(e) {
		let t = new fy();
		return e._gpuData[this._renderer.uid] = t, this._updateContext(e, t), this._managedBitmapTexts.add(e), t;
	}
	_updateDistanceField(e) {
		let t = this._getGpuBitmapText(e).context, n = e._style.fontFamily, r = Ii.get(`${n}-bitmap`), { a: i, b: a, c: o, d: s } = e.groupTransform, c = Math.sqrt(i * i + a * a), l = Math.sqrt(o * o + s * s), u = (Math.abs(c) + Math.abs(l)) / 2, d = r.baseRenderedFontSize / e._style.fontSize, f = u * r.distanceField.range * (1 / d);
		t.customShader.resources.localUniforms.uniforms.uDistance = f;
	}
	destroy() {
		this._managedBitmapTexts.destroy(), this._renderer = null, this._managedBitmapTexts = null;
	}
};
function my(e, t) {
	t.groupTransform = e.groupTransform, t.groupColorAlpha = e.groupColorAlpha, t.groupColor = e.groupColor, t.groupBlendMode = e.groupBlendMode, t.globalDisplayStatus = e.globalDisplayStatus, t.groupTransform = e.groupTransform, t.localDisplayStatus = e.localDisplayStatus, t.groupAlpha = e.groupAlpha, t._roundPixels = e._roundPixels;
}
var hy = class extends py {
	getSdfShader() {
		return null;
	}
};
hy.extension = {
	type: [h.CanvasPipes],
	name: "bitmapText"
};
var gy = {
	name: "local-uniform-msdf-bit",
	vertex: {
		header: "\n            struct LocalUniforms {\n                uColor:vec4<f32>,\n                uTransformMatrix:mat3x3<f32>,\n                uDistance: f32,\n                uRound:f32,\n            }\n\n            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;\n        ",
		main: "\n            vColor *= localUniforms.uColor;\n            modelMatrix *= localUniforms.uTransformMatrix;\n        ",
		end: "\n            if(localUniforms.uRound == 1)\n            {\n                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);\n            }\n        "
	},
	fragment: {
		header: "\n            struct LocalUniforms {\n                uColor:vec4<f32>,\n                uTransformMatrix:mat3x3<f32>,\n                uDistance: f32\n            }\n\n            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;\n         ",
		main: "\n            outColor = vec4<f32>(calculateMSDFAlpha(outColor, vColor, localUniforms.uDistance));\n        "
	}
}, _y = {
	name: "local-uniform-msdf-bit",
	vertex: {
		header: "\n            uniform mat3 uTransformMatrix;\n            uniform vec4 uColor;\n            uniform float uRound;\n        ",
		main: "\n            vColor *= uColor;\n            modelMatrix *= uTransformMatrix;\n        ",
		end: "\n            if(uRound == 1.)\n            {\n                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);\n            }\n        "
	},
	fragment: {
		header: "\n            uniform float uDistance;\n         ",
		main: "\n            outColor = vec4(calculateMSDFAlpha(outColor, vColor, uDistance));\n        "
	}
}, vy = {
	name: "msdf-bit",
	fragment: { header: "\n            fn calculateMSDFAlpha(msdfColor:vec4<f32>, shapeColor:vec4<f32>, distance:f32) -> f32 {\n\n                // MSDF\n                var median = msdfColor.r + msdfColor.g + msdfColor.b -\n                    min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -\n                    max(msdfColor.r, max(msdfColor.g, msdfColor.b));\n\n                // SDF\n                median = min(median, msdfColor.a);\n\n                var screenPxDistance = distance * (median - 0.5);\n                var alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);\n                if (median < 0.01) {\n                    alpha = 0.0;\n                } else if (median > 0.99) {\n                    alpha = 1.0;\n                }\n\n                // Gamma correction for coverage-like alpha\n                var luma: f32 = dot(shapeColor.rgb, vec3<f32>(0.299, 0.587, 0.114));\n                var gamma: f32 = mix(1.0, 1.0 / 2.2, luma);\n                var coverage: f32 = pow(shapeColor.a * alpha, gamma);\n\n                return coverage;\n\n            }\n        " }
}, yy = {
	name: "msdf-bit",
	fragment: { header: "\n            float calculateMSDFAlpha(vec4 msdfColor, vec4 shapeColor, float distance) {\n\n                // MSDF\n                float median = msdfColor.r + msdfColor.g + msdfColor.b -\n                                min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -\n                                max(msdfColor.r, max(msdfColor.g, msdfColor.b));\n\n                // SDF\n                median = min(median, msdfColor.a);\n\n                float screenPxDistance = distance * (median - 0.5);\n                float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);\n\n                if (median < 0.01) {\n                    alpha = 0.0;\n                } else if (median > 0.99) {\n                    alpha = 1.0;\n                }\n\n                // Gamma correction for coverage-like alpha\n                float luma = dot(shapeColor.rgb, vec3(0.299, 0.587, 0.114));\n                float gamma = mix(1.0, 1.0 / 2.2, luma);\n                float coverage = pow(shapeColor.a * alpha, gamma);\n\n                return coverage;\n            }\n        " }
}, by, xy, Sy = class extends po {
	constructor(e) {
		let t = new io({
			uColor: {
				value: new Float32Array([
					1,
					1,
					1,
					1
				]),
				type: "vec4<f32>"
			},
			uTransformMatrix: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uDistance: {
				value: 4,
				type: "f32"
			},
			uRound: {
				value: 0,
				type: "f32"
			}
		});
		by ??= xu({
			name: "sdf-shader",
			bits: [
				Cu,
				Ou(e),
				gy,
				vy,
				Mu
			]
		}), xy ??= Su({
			name: "sdf-shader",
			bits: [
				wu,
				ju(e),
				_y,
				yy,
				Nu
			]
		}), super({
			glProgram: xy,
			gpuProgram: by,
			resources: {
				localUniforms: t,
				batchSamplers: Fu(e)
			}
		});
	}
}, Cy = class extends py {
	getSdfShader() {
		return new Sy(this._renderer.limits.maxBatchableTextures);
	}
};
Cy.extension = {
	type: [h.WebGLPipes, h.WebGPUPipes],
	name: "bitmapText"
}, v.add(hy), v.add(Cy);
var wy = class extends j_ {
	constructor(...e) {
		var t;
		let n = M_(e, "BitmapText");
		n.style ??= n.style || {}, (t = n.style).fill ?? (t.fill = 16777215), super(n, Nv), this.renderPipeId = "bitmapText";
	}
	_onTouch(e) {
		var t;
		this._gcLastUsed = e;
		for (let n in this._gpuData) (t = this._gpuData[n]) == null || t._onTouch(e);
	}
	updateBounds() {
		let e = this._bounds, t = this._anchor, n = dy.measureText(this.text, this._style), r = n.scale, i = n.offsetY * r, a = n.width * r, o = n.height * r, s = this._style._stroke;
		s && (a += s.width, o += s.width), e.minX = -t._x * a, e.maxX = e.minX + a, e.minY = -t._y * (o + i), e.maxY = e.minY + o;
	}
	set resolution(e) {}
	get resolution() {
		return this._resolution;
	}
}, Ty = Object.defineProperty, Ey = Object.getOwnPropertySymbols, Dy = Object.prototype.hasOwnProperty, Oy = Object.prototype.propertyIsEnumerable, ky = (e, t, n) => t in e ? Ty(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Ay = (e, t) => {
	for (var n in t ||= {}) Dy.call(t, n) && ky(e, n, t[n]);
	if (Ey) for (var n of Ey(t)) Oy.call(t, n) && ky(e, n, t[n]);
	return e;
};
function jy(e) {
	let t = e._stroke, n = e._fill, r = [`div { ${[
		`color: ${z.shared.setValue(n.color).setAlpha(n.alpha ?? 1).toHexa()}`,
		`font-size: ${e.fontSize}px`,
		`font-family: ${e.fontFamily}`,
		`font-weight: ${e.fontWeight}`,
		`font-style: ${e.fontStyle}`,
		`font-variant: ${e.fontVariant}`,
		`letter-spacing: ${e.letterSpacing}px`,
		`text-align: ${e.align}`,
		`padding: ${e.padding}px`,
		`white-space: ${e.whiteSpace === "pre" && e.wordWrap ? "pre-wrap" : e.whiteSpace}`,
		...e.lineHeight ? [`line-height: ${e.lineHeight}px`] : [],
		...e.wordWrap ? [`word-break: ${e.breakWords ? "break-word" : "normal"}`, `max-width: ${e.wordWrapWidth}px`] : [],
		...t ? [Ny(t)] : [],
		...e.dropShadow ? [My(e.dropShadow)] : [],
		...e.cssOverrides
	].join(";")} }`];
	return Iy(e.tagStyles, r), r.join(" ");
}
function My(e) {
	let t = Ay({}, e), n = z.shared.setValue(t.color).setAlpha(t.alpha ?? 1).toHexa(), r = `${Math.round(Math.cos(t.angle) * t.distance)}px ${Math.round(Math.sin(t.angle) * t.distance)}px`;
	return t.blur > 0 ? `text-shadow: ${r} ${t.blur}px ${n}` : `text-shadow: ${r} ${n}`;
}
function Ny(e) {
	let t = z.shared.setValue(e.color).setAlpha(e.alpha ?? 1).toHexa();
	return [
		`-webkit-text-stroke-width: ${e.width}px`,
		`-webkit-text-stroke-color: ${t}`,
		`text-stroke-width: ${e.width}px`,
		`text-stroke-color: ${t}`,
		"paint-order: stroke"
	].join(";");
}
var Py = {
	fontSize: "font-size: {{VALUE}}px",
	fontFamily: "font-family: {{VALUE}}",
	fontWeight: "font-weight: {{VALUE}}",
	fontStyle: "font-style: {{VALUE}}",
	fontVariant: "font-variant: {{VALUE}}",
	letterSpacing: "letter-spacing: {{VALUE}}px",
	align: "text-align: {{VALUE}}",
	padding: "padding: {{VALUE}}px",
	whiteSpace: "white-space: {{VALUE}}",
	lineHeight: "line-height: {{VALUE}}px",
	wordWrapWidth: "max-width: {{VALUE}}px"
}, Fy = {
	fill: (e) => `color: ${z.shared.setValue(e).toHexa()}`,
	breakWords: (e) => `word-break: ${e ? "break-all" : "normal"}`,
	stroke: Ny,
	dropShadow: (e) => e === !0 ? My(Nv.defaultDropShadow) : e && typeof e == "object" ? My(Ay(Ay({}, Nv.defaultDropShadow), e)) : ""
};
function Iy(e, t) {
	for (let n in e) {
		let r = e[n], i = [];
		for (let e in r) Fy[e] ? i.push(Fy[e](r[e])) : Py[e] && i.push(Py[e].replace("{{VALUE}}", r[e]));
		t.push(`${n} { ${i.join(";")} }`);
	}
}
var Ly = Object.defineProperty, Ry = Object.getOwnPropertySymbols, zy = Object.prototype.hasOwnProperty, By = Object.prototype.propertyIsEnumerable, Vy = (e, t, n) => t in e ? Ly(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Hy = (e, t) => {
	for (var n in t ||= {}) zy.call(t, n) && Vy(e, n, t[n]);
	if (Ry) for (var n of Ry(t)) By.call(t, n) && Vy(e, n, t[n]);
	return e;
}, Uy = class e extends Nv {
	constructor(e = {}) {
		super(e), this._cssOverrides = [], this.cssOverrides = e.cssOverrides ?? [], this.tagStyles = e.tagStyles ?? {};
	}
	get tagStyles() {
		return this._tagStyles;
	}
	set tagStyles(e) {
		this._tagStyles !== e && (this._tagStyles = e ?? {}, this.update());
	}
	set cssOverrides(e) {
		this._cssOverrides = e instanceof Array ? e : [e], this.update();
	}
	get cssOverrides() {
		return this._cssOverrides;
	}
	update() {
		this._cssStyle = null, super.update();
	}
	clone() {
		return new e({
			align: this.align,
			breakWords: this.breakWords,
			dropShadow: this.dropShadow ? Hy({}, this.dropShadow) : null,
			fill: this._fill,
			fontFamily: this.fontFamily,
			fontSize: this.fontSize,
			fontStyle: this.fontStyle,
			fontVariant: this.fontVariant,
			fontWeight: this.fontWeight,
			letterSpacing: this.letterSpacing,
			lineHeight: this.lineHeight,
			padding: this.padding,
			stroke: this._stroke,
			whiteSpace: this.whiteSpace,
			wordWrap: this.wordWrap,
			wordWrapWidth: this.wordWrapWidth,
			cssOverrides: this.cssOverrides,
			tagStyles: Hy({}, this.tagStyles)
		});
	}
	get cssStyle() {
		return this._cssStyle ||= jy(this), this._cssStyle;
	}
	addOverride(...e) {
		let t = e.filter((e) => !this.cssOverrides.includes(e));
		t.length > 0 && (this.cssOverrides.push(...t), this.update());
	}
	removeOverride(...e) {
		let t = e.filter((e) => this.cssOverrides.includes(e));
		t.length > 0 && (this.cssOverrides = this.cssOverrides.filter((e) => !t.includes(e)), this.update());
	}
	set fill(e) {
		super.fill = e;
	}
	set stroke(e) {
		super.stroke = e;
	}
}, Wy = "http://www.w3.org/2000/svg", Gy = "http://www.w3.org/1999/xhtml", Ky = class {
	constructor() {
		this.svgRoot = document.createElementNS(Wy, "svg"), this.foreignObject = document.createElementNS(Wy, "foreignObject"), this.domElement = document.createElementNS(Gy, "div"), this.styleElement = document.createElementNS(Gy, "style");
		let { foreignObject: e, svgRoot: t, styleElement: n, domElement: r } = this;
		e.setAttribute("width", "10000"), e.setAttribute("height", "10000"), e.style.overflow = "hidden", t.appendChild(e), e.appendChild(n), e.appendChild(r), this.image = X.get().createImage();
	}
	destroy() {
		this.svgRoot.remove(), this.foreignObject.remove(), this.styleElement.remove(), this.domElement.remove(), this.image.src = "", this.image.remove(), this.svgRoot = null, this.foreignObject = null, this.styleElement = null, this.domElement = null, this.image = null, this.canvasAndContext = null;
	}
}, qy;
function Jy(e, t, n, r) {
	r ||= qy ||= new Ky();
	let { domElement: i, styleElement: a, svgRoot: o } = r;
	i.innerHTML = `<style>${t.cssStyle};</style><div style='padding:0'>${e}</div>`, i.setAttribute("style", "transform-origin: top left; display: inline-block"), n && (a.textContent = n), document.body.appendChild(o);
	let s = i.scrollWidth, c = i.scrollHeight;
	if (o.remove(), t.dropShadow) {
		let { distance: e, angle: n, blur: r } = t.dropShadow, i = Math.abs(Math.round(Math.cos(n) * e)), a = Math.abs(Math.round(Math.sin(n) * e));
		s += i + r, c += a + r;
	}
	let l = t.padding * 2;
	return {
		width: s - l,
		height: c - l
	};
}
var Yy = class extends Iv {
	constructor() {
		super(...arguments), this.generatingTexture = !1, this.currentKey = "--";
	}
	destroy() {
		this.texturePromise = null, this.generatingTexture = !1, this.currentKey = "--", super.destroy();
	}
}, Xy = class {
	constructor(e) {
		this._renderer = e, e.runners.resolutionChange.add(this), this._managedTexts = new Bu({
			renderer: e,
			type: "renderable",
			onUnload: this.onTextUnload.bind(this),
			name: "htmlText"
		});
	}
	resolutionChange() {
		for (let e in this._managedTexts.items) {
			let t = this._managedTexts.items[e];
			t != null && t._autoResolution && t.onViewUpdate();
		}
	}
	validateRenderable(e) {
		let t = this._getGpuText(e), n = e.styleKey;
		return t.currentKey !== n;
	}
	addRenderable(e, t) {
		let n = this._getGpuText(e);
		if (e._didTextUpdate) {
			let t = e._autoResolution ? this._renderer.resolution : e.resolution;
			(n.currentKey !== e.styleKey || e.resolution !== t) && this._updateGpuText(e).catch((e) => {
				console.error(e);
			}), e._didTextUpdate = !1, Fv(n, e);
		}
		this._renderer.renderPipes.batch.addToBatch(n, t);
	}
	updateRenderable(e) {
		let t = this._getGpuText(e);
		t._batcher.updateElement(t);
	}
	async _updateGpuText(e) {
		e._didTextUpdate = !1;
		let t = this._getGpuText(e);
		if (t.generatingTexture) return;
		let n = t.texturePromise;
		t.texturePromise = null, t.generatingTexture = !0, e._resolution = e._autoResolution ? this._renderer.resolution : e.resolution;
		let r = this._renderer.htmlText.getTexturePromise(e);
		n && (r = r.finally(() => {
			this._renderer.htmlText.decreaseReferenceCount(t.currentKey), this._renderer.htmlText.returnTexturePromise(n);
		})), t.texturePromise = r, t.currentKey = e.styleKey, t.texture = await r;
		let i = e.renderGroup || e.parentRenderGroup;
		i && (i.structureDidChange = !0), t.generatingTexture = !1, Fv(t, e);
	}
	_getGpuText(e) {
		return e._gpuData[this._renderer.uid] || this.initGpuText(e);
	}
	initGpuText(e) {
		let t = new Yy();
		return t.renderable = e, t.transform = e.groupTransform, t.texture = J.EMPTY, t.bounds = {
			minX: 0,
			maxX: 1,
			minY: 0,
			maxY: 0
		}, t.roundPixels = this._renderer._roundPixels | e._roundPixels, e._resolution = e._autoResolution ? this._renderer.resolution : e.resolution, e._gpuData[this._renderer.uid] = t, this._managedTexts.add(e), t;
	}
	onTextUnload(e) {
		let t = e._gpuData[this._renderer.uid];
		if (!t) return;
		let { htmlText: n } = this._renderer;
		n.getReferenceCount(t.currentKey) === null ? n.returnTexturePromise(t.texturePromise) : n.decreaseReferenceCount(t.currentKey);
	}
	destroy() {
		this._managedTexts.destroy(), this._renderer = null;
	}
};
Xy.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "htmlText"
};
function Zy() {
	let { userAgent: e } = X.get().getNavigator();
	return /^((?!chrome|android).)*safari/i.test(e);
}
function Qy(e, t) {
	let n = t.fontFamily, r = [], i = {}, a = e.match(/font-family:([^;"\s]+)/g);
	function o(e) {
		i[e] || (r.push(e), i[e] = !0);
	}
	if (Array.isArray(n)) for (let e = 0; e < n.length; e++) o(n[e]);
	else o(n);
	a && a.forEach((e) => {
		o(e.split(":")[1].trim());
	});
	for (let e in t.tagStyles) {
		let n = t.tagStyles[e].fontFamily;
		o(n);
	}
	return r;
}
async function $y(e) {
	let t = await (await X.get().fetch(e)).blob(), n = new FileReader();
	return await new Promise((e, r) => {
		n.onloadend = () => e(n.result), n.onerror = r, n.readAsDataURL(t);
	});
}
async function eb(e, t) {
	let n = await $y(t);
	return `@font-face {
        font-family: "${e.fontFamily}";
        font-weight: ${e.fontWeight};
        font-style: ${e.fontStyle};
        src: url('${n}');
    }`;
}
var tb = /* @__PURE__ */ new Map();
async function nb(e) {
	let t = e.filter((e) => Ii.has(`${e}-and-url`)).map((e) => {
		if (!tb.has(e)) {
			let { entries: t } = Ii.get(`${e}-and-url`), n = [];
			t.forEach((t) => {
				let r = t.url, i = t.faces.map((e) => ({
					weight: e.weight,
					style: e.style
				}));
				n.push(...i.map((t) => eb({
					fontWeight: t.weight,
					fontStyle: t.style,
					fontFamily: e
				}, r)));
			}), tb.set(e, Promise.all(n).then((e) => e.join("\n")));
		}
		return tb.get(e);
	});
	return (await Promise.all(t)).join("\n");
}
function rb(e, t, n, r, i) {
	let { domElement: a, styleElement: o, svgRoot: s } = i;
	a.innerHTML = `<style>${t.cssStyle}</style><div style='padding:0;'>${e}</div>`, a.setAttribute("style", `transform: scale(${n});transform-origin: top left; display: inline-block`), o.textContent = r;
	let { width: c, height: l } = i.image;
	return s.setAttribute("width", c.toString()), s.setAttribute("height", l.toString()), new XMLSerializer().serializeToString(s);
}
function ib(e, t) {
	let n = Wi.getOptimalCanvasAndContext(e.width, e.height, t), { context: r } = n;
	return r.clearRect(0, 0, e.width, e.height), r.drawImage(e, 0, 0), n;
}
function ab(e, t, n) {
	return new Promise(async (r) => {
		n && await new Promise((e) => setTimeout(e, 100)), e.onload = () => {
			r();
		}, e.src = `data:image/svg+xml;charset=utf8,${encodeURIComponent(t)}`, e.crossOrigin = "anonymous";
	});
}
var ob = class {
	constructor(e) {
		this._activeTextures = {}, this._renderer = e, this._createCanvas = e.type === qa.WEBGPU;
	}
	getTexture(e) {
		return this.getTexturePromise(e);
	}
	getManagedTexture(e) {
		let t = e.styleKey;
		if (this._activeTextures[t]) return this._increaseReferenceCount(t), this._activeTextures[t].promise;
		let n = this._buildTexturePromise(e).then((e) => (this._activeTextures[t].texture = e, e));
		return this._activeTextures[t] = {
			texture: null,
			promise: n,
			usageCount: 1
		}, n;
	}
	getReferenceCount(e) {
		return this._activeTextures[e]?.usageCount ?? null;
	}
	_increaseReferenceCount(e) {
		this._activeTextures[e].usageCount++;
	}
	decreaseReferenceCount(e) {
		let t = this._activeTextures[e];
		t && (t.usageCount--, t.usageCount === 0 && (t.texture ? this._cleanUp(t.texture) : t.promise.then((e) => {
			t.texture = e, this._cleanUp(t.texture);
		}).catch(() => {}), this._activeTextures[e] = null));
	}
	getTexturePromise(e) {
		return this._buildTexturePromise(e);
	}
	async _buildTexturePromise(e) {
		let { text: t, style: n, resolution: r, textureStyle: i, autoGenerateMipmaps: a } = e, o = U.get(Ky), s = Qy(t, n), c = await nb(s), l = Jy(t, n, c, o), u = Math.ceil(Math.ceil(Math.max(1, l.width) + n.padding * 2) * r), d = Math.ceil(Math.ceil(Math.max(1, l.height) + n.padding * 2) * r), f = o.image;
		f.width = (u | 0) + 2, f.height = (d | 0) + 2, await ab(f, rb(t, n, r, c, o), Zy() && s.length > 0);
		let p = f, m;
		this._createCanvas && (m = ib(f, r));
		let h = ra(m ? m.canvas : p, f.width - 2, f.height - 2, r, a);
		return i && (h.source.style = i), this._createCanvas && (this._renderer.texture.initSource(h.source), Wi.returnCanvasAndContext(m)), U.return(o), h;
	}
	returnTexturePromise(e) {
		e.then((e) => {
			this._cleanUp(e);
		}).catch(() => {});
	}
	_cleanUp(e) {
		hn.returnTexture(e, !0), e.source.resource = null, e.source.uploadMethodId = "unknown";
	}
	destroy() {
		this._renderer = null;
		for (let e in this._activeTextures) this._activeTextures[e] && this.returnTexturePromise(this._activeTextures[e].promise);
		this._activeTextures = null;
	}
};
ob.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "htmlText"
}, v.add(ob), v.add(Xy);
var sb = class extends j_ {
	constructor(...e) {
		let t = M_(e, "HtmlText");
		super(t, Uy), this.renderPipeId = "htmlText", t.textureStyle && (this.textureStyle = t.textureStyle instanceof Ot ? t.textureStyle : new Ot(t.textureStyle)), this.autoGenerateMipmaps = t.autoGenerateMipmaps ?? It.defaultOptions.autoGenerateMipmaps;
	}
	updateBounds() {
		let e = this._bounds, t = this._anchor, { width: n, height: r } = Jy(this.text, this._style);
		e.minX = -t._x * n, e.maxX = e.minX + n, e.minY = -t._y * r, e.maxY = e.minY + r;
	}
	get text() {
		return this._text;
	}
	set text(e) {
		let t = this._sanitiseText(e.toString());
		super.text = t;
	}
	_sanitiseText(e) {
		return this._removeInvalidHtmlTags(e.replace(/<br>/gi, "<br/>").replace(/<hr>/gi, "<hr/>").replace(/&nbsp;/gi, "&#160;"));
	}
	_removeInvalidHtmlTags(e) {
		return e.replace(/<[^>]*?(?=<|$)/g, "");
	}
}, cb = class extends Uv {
	uploadQueueItem(e) {
		e instanceof It ? this.uploadTextureSource(e) : e instanceof Hv ? this.uploadText(e) : e instanceof sb ? this.uploadHTMLText(e) : e instanceof wy ? this.uploadBitmapText(e) : e instanceof gp && this.uploadGraphicsContext(e);
	}
	uploadTextureSource(e) {
		this.renderer.texture.initSource(e);
	}
	uploadText(e) {
		this.renderer.renderPipes.text.initGpuText(e);
	}
	uploadBitmapText(e) {
		this.renderer.renderPipes.bitmapText.initGpuText(e);
	}
	uploadHTMLText(e) {
		this.renderer.renderPipes.htmlText.initGpuText(e);
	}
	uploadGraphicsContext(e) {
		this.renderer.graphicsContext.getGpuContext(e);
		let { instructions: t } = e;
		for (let e of t) if (e.action === "texture") {
			let { image: t } = e.data;
			this.uploadTextureSource(t.source);
		} else if (e.action === "fill") {
			let { texture: t } = e.data.style;
			this.uploadTextureSource(t.source);
		}
		return null;
	}
}, lb = class extends cb {
	destroy() {
		super.destroy(), clearTimeout(this.timeout), this.renderer = null, this.queue = null, this.resolves = null;
	}
};
lb.extension = {
	type: [h.WebGLSystem, h.WebGPUSystem],
	name: "prepare"
};
var ub = class e {
	static _getPatternRepeat(e, t) {
		let n = e && e !== "clamp-to-edge", r = t && t !== "clamp-to-edge";
		return n && r ? "repeat" : n ? "repeat-x" : r ? "repeat-y" : "no-repeat";
	}
	start(e, t, n) {}
	execute(t, n) {
		let r = n.elements;
		if (!r || !r.length) return;
		let i = t.renderer, a = i.canvasContext, o = a.activeContext;
		for (let t = 0; t < r.length; t++) {
			let s = r[t];
			if (!s.packAsQuad) continue;
			let c = s, l = c.texture, u = l ? Z.getCanvasSource(l) : null;
			if (!u) continue;
			let d = l.source.style, f = a.smoothProperty, p = d.scaleMode !== "nearest";
			o[f] !== p && (o[f] = p), a.setBlendMode(n.blendMode);
			let m = i.globalUniforms.globalUniformData?.worldColor ?? 4294967295, h = c.color, g = (m >>> 24 & 255) / 255, _ = (h >>> 24 & 255) / 255, v = i.filter?.alphaMultiplier ?? 1, y = g * _ * v;
			if (y <= 0) continue;
			o.globalAlpha = y;
			let b = m & 16777215, x = at(nt(h & 16777215, b)), S = l.frame, C = d.addressModeU ?? d.addressMode, w = d.addressModeV ?? d.addressMode, T = e._getPatternRepeat(C, w), E = l.source._resolution ?? l.source.resolution ?? 1, D = c.renderable?.renderGroup?.isCachedAsTexture, O = S.x * E, k = S.y * E, A = S.width * E, j = S.height * E, M = c.bounds, N = i.renderTarget.renderTarget.isRoot, P = M.minX, ee = M.minY, F = M.maxX - M.minX, te = M.maxY - M.minY, I = l.rotate, L = l.uvs, ne = Math.min(L.x0, L.x1, L.x2, L.x3, L.y0, L.y1, L.y2, L.y3), re = Math.max(L.x0, L.x1, L.x2, L.x3, L.y0, L.y1, L.y2, L.y3), ie = T !== "no-repeat" && (ne < 0 || re > 1), ae = I && (!!ie || x === 16777215 && !I);
			ae ? (e._tempPatternMatrix.copyFrom(c.transform), q.matrixAppendRotationInv(e._tempPatternMatrix, I, P, ee, F, te), a.setContextTransform(e._tempPatternMatrix, c.roundPixels === 1, void 0, D && N)) : a.setContextTransform(c.transform, c.roundPixels === 1, void 0, D && N);
			let R = F, oe = te, se = ae ? 0 : P, ce = ae ? 0 : ee;
			if (!ae && c.roundPixels === 1 && (se |= 0, ce |= 0), ie) {
				let t = u, n = x !== 16777215 && !I, r = S.width <= l.source.width && S.height <= l.source.height;
				n && r && (t = Z.getTintedCanvas({ texture: l }, x));
				let i = o.createPattern(t, T);
				if (!i) continue;
				let a = R, s = oe;
				if (a === 0 || s === 0) continue;
				let c = 1 / a, d = 1 / s, f = (L.x1 - L.x0) * c, p = (L.y1 - L.y0) * c, m = (L.x3 - L.x0) * d, h = (L.y3 - L.y0) * d, g = L.x0 - f * se - m * ce, _ = L.y0 - p * se - h * ce, v = l.source.pixelWidth, y = l.source.pixelHeight;
				e._tempPatternMatrix.set(f * v, p * y, m * v, h * y, g * v, _ * y), Z.applyPatternTransform(i, e._tempPatternMatrix), o.fillStyle = i, o.fillRect(se, ce, R, oe);
			} else {
				let e = x !== 16777215 || I ? Z.getTintedCanvas({ texture: l }, x) : u, t = e !== u;
				o.drawImage(e, t ? 0 : O, t ? 0 : k, t ? e.width : A, t ? e.height : j, se, ce, R, oe);
			}
		}
	}
};
ub._tempPatternMatrix = new B(), ub.extension = {
	type: [h.CanvasPipesAdaptor],
	name: "batch"
};
var db = ub, fb = class {
	constructor() {
		this._tempState = go.for2d(), this._didUploadHash = {};
	}
	init(e) {
		e.renderer.runners.contextChange.add(this);
	}
	contextChange() {
		this._didUploadHash = {};
	}
	start(e, t, n) {
		let r = e.renderer, i = this._didUploadHash[n.uid];
		r.shader.bind(n, i), i || (this._didUploadHash[n.uid] = !0), r.shader.updateUniformGroup(r.globalUniforms.uniformGroup), r.geometry.bind(t, n.glProgram);
	}
	execute(e, t) {
		let n = e.renderer;
		this._tempState.blendMode = t.blendMode, n.state.set(this._tempState);
		let r = t.textures.textures;
		for (let e = 0; e < t.textures.count; e++) n.texture.bind(r[e], e);
		n.geometry.draw(t.topology, t.size, t.start);
	}
};
fb.extension = {
	type: [h.WebGLPipesAdaptor],
	name: "batch"
};
var pb = go.for2d(), mb = class {
	start(e, t, n) {
		let r = e.renderer, i = r.encoder, a = n.gpuProgram;
		this._shader = n, this._geometry = t, i.setGeometry(t, a), pb.blendMode = "normal", r.pipeline.getPipeline(t, a, pb);
		let o = r.globalUniforms.bindGroup;
		i.resetBindGroup(1), i.setBindGroup(0, o, a);
	}
	execute(e, t) {
		let n = this._shader.gpuProgram, r = e.renderer, i = r.encoder;
		if (!t.bindGroup) {
			let e = t.textures;
			t.bindGroup = dl(e.textures, e.count, r.limits.maxBatchableTextures);
		}
		pb.blendMode = t.blendMode;
		let a = r.bindGroup.getBindGroup(t.bindGroup, n, 1), o = r.pipeline.getPipeline(this._geometry, n, pb, t.topology);
		t.bindGroup._touch(r.gc.now, r.tick), i.setPipeline(o), i.renderPassEncoder.setBindGroup(1, a), i.renderPassEncoder.drawIndexed(t.size, 1, t.start);
	}
};
mb.extension = {
	type: [h.WebGPUPipesAdaptor],
	name: "batch"
};
var hb = class e {
	constructor(e, t) {
		this.state = go.for2d(), this._batchersByInstructionSet = Object.create(null), this._activeBatches = Object.create(null);
		var n, r;
		this.renderer = e, this._adaptor = t, (r = (n = this._adaptor).init) == null || r.call(n, this);
	}
	static getBatcher(e, t) {
		return new this._availableBatchers[e]({ maxTextures: t });
	}
	buildStart(e) {
		let t = this._batchersByInstructionSet[e.uid];
		t || (t = this._batchersByInstructionSet[e.uid] = Object.create(null), t.default || (t.default = new zu({ maxTextures: this.renderer.limits.maxBatchableTextures }))), this._activeBatches = t, this._activeBatch = this._activeBatches.default;
		for (let e in this._activeBatches) this._activeBatches[e].begin();
	}
	addToBatch(t, n) {
		if (this._activeBatch.name !== t.batcherName) {
			this._activeBatch.break(n);
			let r = this._activeBatches[t.batcherName];
			r || (r = this._activeBatches[t.batcherName] = e.getBatcher(t.batcherName, this.renderer.limits.maxBatchableTextures), r.begin()), this._activeBatch = r;
		}
		this._activeBatch.add(t);
	}
	break(e) {
		this._activeBatch.break(e);
	}
	buildEnd(e) {
		this._activeBatch.break(e);
		let t = this._activeBatches;
		for (let e in t) {
			let n = t[e], r = n.geometry;
			r.indexBuffer.setDataWithSize(n.indexBuffer, n.indexSize, !0), r.buffers[0].setDataWithSize(n.attributeBuffer.float32View, n.attributeSize, !1);
		}
	}
	upload(e) {
		let t = this._batchersByInstructionSet[e.uid];
		for (let e in t) {
			let n = t[e], r = n.geometry;
			n.dirty && (n.dirty = !1, r.buffers[0].update(n.attributeSize * 4));
		}
	}
	execute(e) {
		if (e.action === "startBatch") {
			let t = e.batcher, n = t.geometry, r = t.shader;
			this._adaptor.start(this, n, r);
		}
		this._adaptor.execute(this, e);
	}
	destroy() {
		this.state = null, this.renderer = null, this._adaptor = null;
		for (let e in this._activeBatches) this._activeBatches[e].destroy();
		this._activeBatches = null;
	}
};
hb.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "batch"
}, hb._availableBatchers = Object.create(null);
var gb = hb;
v.handleByMap(h.Batcher, gb._availableBatchers), v.add(zu);
var _b = {
	name: "texture-bit",
	vertex: {
		header: "\n\n        struct TextureUniforms {\n            uTextureMatrix:mat3x3<f32>,\n        }\n\n        @group(2) @binding(2) var<uniform> textureUniforms : TextureUniforms;\n        ",
		main: "\n            uv = (textureUniforms.uTextureMatrix * vec3(uv, 1.0)).xy;\n        "
	},
	fragment: {
		header: "\n            @group(2) @binding(0) var uTexture: texture_2d<f32>;\n            @group(2) @binding(1) var uSampler: sampler;\n\n\n        ",
		main: "\n            outColor = textureSample(uTexture, uSampler, vUV);\n        "
	}
}, vb = {
	name: "texture-bit",
	vertex: {
		header: "\n            uniform mat3 uTextureMatrix;\n        ",
		main: "\n            uv = (uTextureMatrix * vec3(uv, 1.0)).xy;\n        "
	},
	fragment: {
		header: "\n        uniform sampler2D uTexture;\n\n\n        ",
		main: "\n            outColor = texture(uTexture, vUV);\n        "
	}
}, yb = new G(), bb = class extends Ie {
	constructor() {
		super(), this.filters = [new Kh({
			sprite: new pi(J.EMPTY),
			inverse: !1,
			resolution: "inherit",
			antialias: "inherit"
		})];
	}
	get sprite() {
		return this.filters[0].sprite;
	}
	set sprite(e) {
		this.filters[0].sprite = e;
	}
	get inverse() {
		return this.filters[0].inverse;
	}
	set inverse(e) {
		this.filters[0].inverse = e;
	}
	get channel() {
		return this.filters[0].channel;
	}
	set channel(e) {
		this.filters[0].channel = e;
	}
}, xb = class {
	constructor(e) {
		this._activeMaskStage = [], this._renderer = e;
	}
	push(e, t, n) {
		let r = this._renderer;
		if (r.renderPipes.batch.break(n), n.add({
			renderPipeId: "alphaMask",
			action: "pushMaskBegin",
			mask: e,
			inverse: t._maskOptions.inverse,
			canBundle: !1,
			maskedContainer: t
		}), e.inverse = t._maskOptions.inverse, e.channel = t._maskOptions.channel ?? "red", e.renderMaskToTexture) {
			let t = e.mask;
			t.includeInBuild = !0, t.collectRenderables(n, r, null), t.includeInBuild = !1;
		}
		r.renderPipes.batch.break(n), n.add({
			renderPipeId: "alphaMask",
			action: "pushMaskEnd",
			mask: e,
			maskedContainer: t,
			inverse: t._maskOptions.inverse,
			canBundle: !1
		});
	}
	pop(e, t, n) {
		this._renderer.renderPipes.batch.break(n), n.add({
			renderPipeId: "alphaMask",
			action: "popMaskEnd",
			mask: e,
			inverse: t._maskOptions.inverse,
			canBundle: !1
		});
	}
	execute(e) {
		let t = this._renderer, n = e.mask.renderMaskToTexture;
		if (e.action === "pushMaskBegin") {
			let r = U.get(bb);
			if (r.inverse = e.inverse, r.channel = e.mask.channel, n) {
				e.mask.mask.measurable = !0;
				let n = $e(e.mask.mask, !0, yb);
				e.mask.mask.measurable = !1, n.ceil();
				let i = t.renderTarget.renderTarget.colorTexture.source, a = hn.getOptimalTexture(n.width, n.height, i._resolution, i.antialias);
				t.renderTarget.push(a, !0), t.globalUniforms.push({
					offset: n,
					worldColor: 4294967295
				});
				let o = r.sprite;
				o.texture = a, o.worldTransform.tx = n.minX, o.worldTransform.ty = n.minY, this._activeMaskStage.push({
					filterEffect: r,
					maskedContainer: e.maskedContainer,
					filterTexture: a
				});
			} else r.sprite = e.mask.mask, this._activeMaskStage.push({
				filterEffect: r,
				maskedContainer: e.maskedContainer
			});
		} else if (e.action === "pushMaskEnd") {
			let e = this._activeMaskStage[this._activeMaskStage.length - 1];
			n && (t.type === qa.WEBGL && t.renderTarget.finishRenderPass(), t.renderTarget.pop(), t.globalUniforms.pop()), t.filter.push({
				renderPipeId: "filter",
				action: "pushFilter",
				container: e.maskedContainer,
				filterEffect: e.filterEffect,
				canBundle: !1
			});
		} else if (e.action === "popMaskEnd") {
			t.filter.pop();
			let e = this._activeMaskStage.pop();
			n && hn.returnTexture(e.filterTexture), U.return(e.filterEffect);
		}
	}
	destroy() {
		this._renderer = null, this._activeMaskStage = null;
	}
};
xb.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "alphaMask"
};
var Sb = class {
	constructor(e) {
		this._colorStack = [], this._colorStackIndex = 0, this._currentColor = 0, this._renderer = e;
	}
	buildStart() {
		this._colorStack[0] = 15, this._colorStackIndex = 1, this._currentColor = 15;
	}
	push(e, t, n) {
		this._renderer.renderPipes.batch.break(n);
		let r = this._colorStack;
		r[this._colorStackIndex] = r[this._colorStackIndex - 1] & e.mask;
		let i = this._colorStack[this._colorStackIndex];
		i !== this._currentColor && (this._currentColor = i, n.add({
			renderPipeId: "colorMask",
			colorMask: i,
			canBundle: !1
		})), this._colorStackIndex++;
	}
	pop(e, t, n) {
		this._renderer.renderPipes.batch.break(n);
		let r = this._colorStack;
		this._colorStackIndex--;
		let i = r[this._colorStackIndex - 1];
		i !== this._currentColor && (this._currentColor = i, n.add({
			renderPipeId: "colorMask",
			colorMask: i,
			canBundle: !1
		}));
	}
	execute(e) {}
	destroy() {
		this._renderer = null, this._colorStack = null;
	}
};
Sb.extension = {
	type: [h.CanvasPipes],
	name: "colorMask"
};
var Cb = class {
	constructor(e) {
		this._colorStack = [], this._colorStackIndex = 0, this._currentColor = 0, this._renderer = e;
	}
	buildStart() {
		this._colorStack[0] = 15, this._colorStackIndex = 1, this._currentColor = 15;
	}
	push(e, t, n) {
		this._renderer.renderPipes.batch.break(n);
		let r = this._colorStack;
		r[this._colorStackIndex] = r[this._colorStackIndex - 1] & e.mask;
		let i = this._colorStack[this._colorStackIndex];
		i !== this._currentColor && (this._currentColor = i, n.add({
			renderPipeId: "colorMask",
			colorMask: i,
			canBundle: !1
		})), this._colorStackIndex++;
	}
	pop(e, t, n) {
		this._renderer.renderPipes.batch.break(n);
		let r = this._colorStack;
		this._colorStackIndex--;
		let i = r[this._colorStackIndex - 1];
		i !== this._currentColor && (this._currentColor = i, n.add({
			renderPipeId: "colorMask",
			colorMask: i,
			canBundle: !1
		}));
	}
	execute(e) {
		this._renderer.colorMask.setMask(e.colorMask);
	}
	destroy() {
		this._renderer = null, this._colorStack = null;
	}
};
Cb.extension = {
	type: [h.WebGLPipes, h.WebGPUPipes],
	name: "colorMask"
};
function wb(e, t, n, r, i, a) {
	a = Math.max(0, Math.min(a, Math.min(r, i) / 2)), e.moveTo(t + a, n), e.lineTo(t + r - a, n), e.quadraticCurveTo(t + r, n, t + r, n + a), e.lineTo(t + r, n + i - a), e.quadraticCurveTo(t + r, n + i, t + r - a, n + i), e.lineTo(t + a, n + i), e.quadraticCurveTo(t, n + i, t, n + i - a), e.lineTo(t, n + a), e.quadraticCurveTo(t, n, t + a, n);
}
function Tb(e, t) {
	switch (t.type) {
		case "rectangle": {
			let n = t;
			e.rect(n.x, n.y, n.width, n.height);
			break;
		}
		case "roundedRectangle": {
			let n = t;
			wb(e, n.x, n.y, n.width, n.height, n.radius);
			break;
		}
		case "circle": {
			let n = t;
			e.moveTo(n.x + n.radius, n.y), e.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
			break;
		}
		case "ellipse": {
			let n = t;
			e.ellipse ? (e.moveTo(n.x + n.halfWidth, n.y), e.ellipse(n.x, n.y, n.halfWidth, n.halfHeight, 0, 0, Math.PI * 2)) : (e.save(), e.translate(n.x, n.y), e.scale(n.halfWidth, n.halfHeight), e.moveTo(1, 0), e.arc(0, 0, 1, 0, Math.PI * 2), e.restore());
			break;
		}
		case "triangle": {
			let n = t;
			e.moveTo(n.x, n.y), e.lineTo(n.x2, n.y2), e.lineTo(n.x3, n.y3), e.closePath();
			break;
		}
		default: {
			let n = t, r = n.points;
			if (!(r != null && r.length)) break;
			e.moveTo(r[0], r[1]);
			for (let t = 2; t < r.length; t += 2) e.lineTo(r[t], r[t + 1]);
			n.closePath && e.closePath();
			break;
		}
	}
}
function Eb(e, t, n) {
	let r = [], i = [], a = [], o = jd[t.type];
	if (!(o != null && o.build(t, r))) return !1;
	ld(r, n, !1, t.closePath ?? !0, i, a);
	for (let t = 0; t < a.length; t += 3) {
		let n = a[t] * 2, r = a[t + 1] * 2, o = a[t + 2] * 2;
		e.moveTo(i[n], i[n + 1]), e.lineTo(i[r], i[r + 1]), e.lineTo(i[o], i[o + 1]), e.closePath();
	}
	return !0;
}
function Db(e, t) {
	if (!(t != null && t.length)) return !1;
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (!(r != null && r.shape)) continue;
		let i = r.transform, a = i && !i.isIdentity();
		a && (e.save(), e.transform(i.a, i.b, i.c, i.d, i.tx, i.ty)), Tb(e, r.shape), a && e.restore();
	}
	return !0;
}
var Ob = class {
	constructor(e) {
		this._warnedMaskTypes = /* @__PURE__ */ new Set(), this._canvasMaskStack = [], this._renderer = e;
	}
	push(e, t, n) {
		this._renderer.renderPipes.batch.break(n), n.add({
			renderPipeId: "stencilMask",
			action: "pushMaskBegin",
			mask: e,
			inverse: t._maskOptions.inverse,
			canBundle: !1
		});
	}
	pop(e, t, n) {
		this._renderer.renderPipes.batch.break(n), n.add({
			renderPipeId: "stencilMask",
			action: "popMaskEnd",
			mask: e,
			inverse: t._maskOptions.inverse,
			canBundle: !1
		});
	}
	execute(e) {
		var t;
		if (e.action !== "pushMaskBegin" && e.action !== "popMaskEnd") return;
		let n = this._renderer, r = n.canvasContext, i = r?.activeContext;
		if (!i) return;
		if (e.action === "popMaskEnd") {
			this._canvasMaskStack.pop() && i.restore();
			return;
		}
		e.inverse && this._warnOnce("inverse", "CanvasRenderer: inverse masks are not supported on Canvas2D; ignoring inverse flag.");
		let a = e.mask.mask;
		if (!(a instanceof $)) {
			this._warnOnce("nonGraphics", "CanvasRenderer: only Graphics masks are supported in Canvas2D; skipping mask."), this._canvasMaskStack.push(!1);
			return;
		}
		let o = a, s = o.context?.instructions;
		if (!(s != null && s.length)) {
			this._canvasMaskStack.push(!1);
			return;
		}
		i.save(), r.setContextTransform(o.groupTransform, (n._roundPixels | o._roundPixels) === 1), i.beginPath();
		let c = !1, l = !1;
		for (let e = 0; e < s.length; e++) {
			let n = s[e], r = n.action;
			if (r !== "fill" && r !== "stroke") continue;
			let a = n.data, o = a?.path?.shapePath;
			if (!((t = o?.shapePrimitives) != null && t.length)) continue;
			let u = r === "stroke", d = o.shapePrimitives;
			for (let e = 0; e < d.length; e++) {
				let t = d[e];
				if (!(t != null && t.shape)) continue;
				let n = t.transform, r = n && !n.isIdentity();
				r && (i.save(), i.transform(n.a, n.b, n.c, n.d, n.tx, n.ty)), u && a.style ? c = Eb(i, t.shape, a.style) || c : (Tb(i, t.shape), l = Db(i, t.holes) || l, c = !0), r && i.restore();
			}
		}
		if (!c) {
			i.restore(), this._canvasMaskStack.push(!1);
			return;
		}
		l ? i.clip("evenodd") : i.clip(), this._canvasMaskStack.push(!0);
	}
	destroy() {
		this._renderer = null, this._warnedMaskTypes = null, this._canvasMaskStack = null;
	}
	_warnOnce(e, t) {
		this._warnedMaskTypes.has(e) || (this._warnedMaskTypes.add(e), vf(t));
	}
};
Ob.extension = {
	type: [h.CanvasPipes],
	name: "stencilMask"
};
var kb = class {
	constructor(e) {
		this._maskStackHash = {}, this._maskHash = /* @__PURE__ */ new WeakMap(), this._renderer = e;
	}
	push(e, t, n) {
		var r;
		let i = e, a = this._renderer;
		a.renderPipes.batch.break(n), a.renderPipes.blendMode.setBlendMode(i.mask, "none", n), n.add({
			renderPipeId: "stencilMask",
			action: "pushMaskBegin",
			mask: e,
			inverse: t._maskOptions.inverse,
			canBundle: !1
		});
		let o = i.mask;
		o.includeInBuild = !0, this._maskHash.has(i) || this._maskHash.set(i, {
			instructionsStart: 0,
			instructionsLength: 0
		});
		let s = this._maskHash.get(i);
		s.instructionsStart = n.instructionSize, o.collectRenderables(n, a, null), o.includeInBuild = !1, a.renderPipes.batch.break(n), n.add({
			renderPipeId: "stencilMask",
			action: "pushMaskEnd",
			mask: e,
			inverse: t._maskOptions.inverse,
			canBundle: !1
		}), s.instructionsLength = n.instructionSize - s.instructionsStart - 1;
		let c = a.renderTarget.renderTarget.uid;
		(r = this._maskStackHash)[c] ?? (r[c] = 0);
	}
	pop(e, t, n) {
		let r = e, i = this._renderer;
		i.renderPipes.batch.break(n), i.renderPipes.blendMode.setBlendMode(r.mask, "none", n), n.add({
			renderPipeId: "stencilMask",
			action: "popMaskBegin",
			inverse: t._maskOptions.inverse,
			canBundle: !1
		});
		let a = this._maskHash.get(e);
		for (let e = 0; e < a.instructionsLength; e++) n.instructions[n.instructionSize++] = n.instructions[a.instructionsStart++];
		n.add({
			renderPipeId: "stencilMask",
			action: "popMaskEnd",
			canBundle: !1
		});
	}
	execute(e) {
		var t;
		let n = this._renderer, r = n, i = n.renderTarget.renderTarget.uid, a = (t = this._maskStackHash)[i] ?? (t[i] = 0);
		e.action === "pushMaskBegin" ? (r.renderTarget.ensureDepthStencil(), r.stencil.setStencilMode(bl.RENDERING_MASK_ADD, a), a++, r.colorMask.setMask(0)) : e.action === "pushMaskEnd" ? (e.inverse ? r.stencil.setStencilMode(bl.INVERSE_MASK_ACTIVE, a) : r.stencil.setStencilMode(bl.MASK_ACTIVE, a), r.colorMask.setMask(15)) : e.action === "popMaskBegin" ? (r.colorMask.setMask(0), a === 0 ? (r.renderTarget.clear(null, Ss.STENCIL), r.stencil.setStencilMode(bl.DISABLED, a)) : r.stencil.setStencilMode(bl.RENDERING_MASK_REMOVE, a), a--) : e.action === "popMaskEnd" && (e.inverse ? r.stencil.setStencilMode(bl.INVERSE_MASK_ACTIVE, a) : r.stencil.setStencilMode(bl.MASK_ACTIVE, a), r.colorMask.setMask(15)), this._maskStackHash[i] = a;
	}
	destroy() {
		this._renderer = null, this._maskStackHash = null, this._maskHash = null;
	}
};
kb.extension = {
	type: [h.WebGLPipes, h.WebGPUPipes],
	name: "stencilMask"
};
var Ab = "source-over";
function jb() {
	let e = Ui(), t = Object.create(null);
	return t.inherit = Ab, t.none = Ab, t.normal = "source-over", t.add = "lighter", t.multiply = e ? "multiply" : Ab, t.screen = e ? "screen" : Ab, t.overlay = e ? "overlay" : Ab, t.darken = e ? "darken" : Ab, t.lighten = e ? "lighten" : Ab, t["color-dodge"] = e ? "color-dodge" : Ab, t["color-burn"] = e ? "color-burn" : Ab, t["hard-light"] = e ? "hard-light" : Ab, t["soft-light"] = e ? "soft-light" : Ab, t.difference = e ? "difference" : Ab, t.exclusion = e ? "exclusion" : Ab, t.saturation = e ? "saturation" : Ab, t.color = e ? "color" : Ab, t.luminosity = e ? "luminosity" : Ab, t["linear-burn"] = e ? "color-burn" : Ab, t["linear-dodge"] = e ? "color-dodge" : Ab, t["linear-light"] = e ? "hard-light" : Ab, t["pin-light"] = e ? "hard-light" : Ab, t["vivid-light"] = e ? "hard-light" : Ab, t["hard-mix"] = Ab, t.negation = e ? "difference" : Ab, t["normal-npm"] = t.normal, t["add-npm"] = t.add, t["screen-npm"] = t.screen, t.erase = "destination-out", t.subtract = Ab, t.divide = Ab, t.min = Ab, t.max = Ab, t;
}
var Mb = new B(), Nb = class {
	constructor(e) {
		this.activeResolution = 1, this.smoothProperty = "imageSmoothingEnabled", this.blendModes = jb(), this._activeBlendMode = "normal", this._projTransform = null, this._outerBlend = !1, this._warnedBlendModes = /* @__PURE__ */ new Set(), this._renderer = e;
	}
	resolutionChange(e) {
		this.activeResolution = e;
	}
	init() {
		let e = this._renderer.background.alpha < 1;
		if (this.rootContext = this._renderer.canvas.getContext("2d", { alpha: e }), this.activeContext = this.rootContext, this.activeResolution = this._renderer.resolution, !this.rootContext.imageSmoothingEnabled) {
			let e = this.rootContext;
			e.webkitImageSmoothingEnabled ? this.smoothProperty = "webkitImageSmoothingEnabled" : e.mozImageSmoothingEnabled ? this.smoothProperty = "mozImageSmoothingEnabled" : e.oImageSmoothingEnabled ? this.smoothProperty = "oImageSmoothingEnabled" : e.msImageSmoothingEnabled && (this.smoothProperty = "msImageSmoothingEnabled");
		}
	}
	setContextTransform(e, t, n, r) {
		let i = r ? B.IDENTITY : this._renderer.globalUniforms.globalUniformData?.worldTransformMatrix || B.IDENTITY, a = Mb;
		a.copyFrom(i), a.append(e);
		let o = this._projTransform, s = this.activeResolution;
		if (n ||= s, o) {
			let e = B.shared;
			e.copyFrom(a), e.prepend(o), a = e;
		}
		t ? this.activeContext.setTransform(a.a * n, a.b * n, a.c * n, a.d * n, a.tx * s | 0, a.ty * s | 0) : this.activeContext.setTransform(a.a * n, a.b * n, a.c * n, a.d * n, a.tx * s, a.ty * s);
	}
	clear(e, t) {
		let n = this.activeContext, r = this._renderer;
		if (n.clearRect(0, 0, r.width, r.height), e) {
			let i = z.shared.setValue(e);
			n.globalAlpha = t ?? i.alpha, n.fillStyle = i.toHex(), n.fillRect(0, 0, r.width, r.height), n.globalAlpha = 1;
		}
	}
	setBlendMode(e) {
		if (this._activeBlendMode === e) return;
		this._activeBlendMode = e, this._outerBlend = !1;
		let t = this.blendModes[e];
		if (!t) {
			this._warnedBlendModes.has(e) || (console.warn(`CanvasRenderer: blend mode "${e}" is not supported in Canvas2D; falling back to "source-over".`), this._warnedBlendModes.add(e)), this.activeContext.globalCompositeOperation = "source-over";
			return;
		}
		this.activeContext.globalCompositeOperation = t;
	}
	destroy() {
		this.rootContext = null, this.activeContext = null, this._warnedBlendModes.clear();
	}
};
Nb.extension = {
	type: [h.CanvasSystem],
	name: "canvasContext"
};
var Pb = class {
	constructor() {
		this.maxTextures = 16, this.maxBatchableTextures = 16, this.maxUniformBindings = 0;
	}
	init() {}
};
Pb.extension = {
	type: [h.CanvasSystem],
	name: "limits"
};
var Fb = class {
	constructor(e) {
		this._renderer = e;
	}
	updateRenderable() {}
	destroyRenderable() {}
	validateRenderable() {
		return !1;
	}
	addRenderable(e, t) {
		this._renderer.renderPipes.batch.break(t), t.add(e);
	}
	execute(e) {
		e.isRenderable && e.render(this._renderer);
	}
	destroy() {
		this._renderer = null;
	}
};
Fb.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "customRender"
};
function Ib(e, t) {
	let n = e.instructionSet, r = n.instructions;
	for (let e = 0; e < n.instructionSize; e++) {
		let n = r[e];
		t[n.renderPipeId].execute(n);
	}
}
var Lb = class {
	constructor(e) {
		this._renderer = e;
	}
	addRenderGroup(e, t) {
		e.isCachedAsTexture ? this._addRenderableCacheAsTexture(e, t) : this._addRenderableDirect(e, t);
	}
	execute(e) {
		e.isRenderable && (e.isCachedAsTexture ? this._executeCacheAsTexture(e) : this._executeDirect(e));
	}
	destroy() {
		this._renderer = null;
	}
	_addRenderableDirect(e, t) {
		this._renderer.renderPipes.batch.break(t), e._batchableRenderGroup &&= (U.return(e._batchableRenderGroup), null), t.add(e);
	}
	_addRenderableCacheAsTexture(e, t) {
		let n = e._batchableRenderGroup ??= U.get(Iv);
		n.renderable = e.root, n.transform = e.root.relativeGroupTransform, n.texture = e.texture, n.bounds = e._textureBounds, t.add(e), this._renderer.renderPipes.blendMode.pushBlendMode(e, e.root.groupBlendMode, t), this._renderer.renderPipes.batch.addToBatch(n, t), this._renderer.renderPipes.blendMode.popBlendMode(t);
	}
	_executeCacheAsTexture(e) {
		if (e.textureNeedsUpdate) {
			e.textureNeedsUpdate = !1;
			let t = new B().translate(-e._textureBounds.x, -e._textureBounds.y);
			this._renderer.renderTarget.push(e.texture, !0, null, e.texture.frame), this._renderer.globalUniforms.push({
				worldTransformMatrix: t,
				worldColor: 4294967295,
				offset: {
					x: 0,
					y: 0
				}
			}), Ib(e, this._renderer.renderPipes), this._renderer.renderTarget.finishRenderPass(), this._renderer.renderTarget.pop(), this._renderer.globalUniforms.pop();
		}
		e._batchableRenderGroup._batcher.updateElement(e._batchableRenderGroup), e._batchableRenderGroup._batcher.geometry.buffers[0].update();
	}
	_executeDirect(e) {
		this._renderer.globalUniforms.push({
			worldTransformMatrix: e.inverseParentTextureTransform,
			worldColor: e.worldColorAlpha
		}), Ib(e, this._renderer.renderPipes), this._renderer.globalUniforms.pop();
	}
};
Lb.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "renderGroup"
};
var Rb = "#808080", zb = new B(), Bb = new B(), Vb = new B(), Hb = new B();
function Ub(e, t, n) {
	e.beginPath();
	for (let r = 0; r < n.length; r += 3) {
		let i = n[r] * 2, a = n[r + 1] * 2, o = n[r + 2] * 2;
		e.moveTo(t[i], t[i + 1]), e.lineTo(t[a], t[a + 1]), e.lineTo(t[o], t[o + 1]), e.closePath();
	}
	e.fill();
}
function Wb(e) {
	return `#${(e & 16777215).toString(16).padStart(6, "0")}`;
}
function Gb(e, t, n, r, i, a) {
	a = Math.max(0, Math.min(a, Math.min(r, i) / 2)), e.moveTo(t + a, n), e.lineTo(t + r - a, n), e.quadraticCurveTo(t + r, n, t + r, n + a), e.lineTo(t + r, n + i - a), e.quadraticCurveTo(t + r, n + i, t + r - a, n + i), e.lineTo(t + a, n + i), e.quadraticCurveTo(t, n + i, t, n + i - a), e.lineTo(t, n + a), e.quadraticCurveTo(t, n, t + a, n);
}
function Kb(e, t) {
	switch (t.type) {
		case "rectangle": {
			let n = t;
			e.rect(n.x, n.y, n.width, n.height);
			break;
		}
		case "roundedRectangle": {
			let n = t;
			Gb(e, n.x, n.y, n.width, n.height, n.radius);
			break;
		}
		case "circle": {
			let n = t;
			e.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
			break;
		}
		case "ellipse": {
			let n = t;
			e.ellipse ? e.ellipse(n.x, n.y, n.halfWidth, n.halfHeight, 0, 0, Math.PI * 2) : (e.save(), e.translate(n.x, n.y), e.scale(n.halfWidth, n.halfHeight), e.arc(0, 0, 1, 0, Math.PI * 2), e.restore());
			break;
		}
		case "triangle": {
			let n = t;
			e.moveTo(n.x, n.y), e.lineTo(n.x2, n.y2), e.lineTo(n.x3, n.y3), e.closePath();
			break;
		}
		default: {
			let n = t, r = n.points;
			if (!(r != null && r.length)) break;
			e.moveTo(r[0], r[1]);
			for (let t = 2; t < r.length; t += 2) e.lineTo(r[t], r[t + 1]);
			n.closePath && e.closePath();
			break;
		}
	}
}
function qb(e, t) {
	if (!(t != null && t.length)) return !1;
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (!(r != null && r.shape)) continue;
		let i = r.transform, a = i && !i.isIdentity();
		a && (e.save(), e.transform(i.a, i.b, i.c, i.d, i.tx, i.ty)), Kb(e, r.shape), a && e.restore();
	}
	return !0;
}
function Jb(e, t, n, r) {
	let i = e.fill;
	if (i instanceof wd) {
		i.buildGradient();
		let a = i.texture;
		if (a) {
			let o = Z.getTintedPattern(a, t), s = n ? Hb.copyFrom(n).scale(a.source.pixelWidth, a.source.pixelHeight) : Hb.copyFrom(i.transform);
			return r && !e.textureSpace && s.append(r), Z.applyPatternTransform(o, s), o;
		}
	}
	if (i instanceof Vf) {
		let e = Z.getTintedPattern(i.texture, t);
		return Z.applyPatternTransform(e, i.transform, !1), e;
	}
	let a = e.texture;
	if (a && a !== J.WHITE) {
		if (!a.source.resource) return Rb;
		let r = Z.getTintedPattern(a, t), i = n ? Hb.copyFrom(n).scale(a.source.pixelWidth, a.source.pixelHeight) : e.matrix;
		return Z.applyPatternTransform(r, i), r;
	}
	return Wb(t);
}
var Yb = class {
	constructor() {
		this.shader = null;
	}
	contextChange(e) {}
	execute(e, t) {
		var n, r;
		let i = e.renderer, a = i.canvasContext, o = a.activeContext, s = t.groupTransform, c = i.globalUniforms.globalUniformData?.worldColor ?? 4294967295, l = t.groupColorAlpha, u = (c >>> 24 & 255) / 255, d = (l >>> 24 & 255) / 255, f = i.filter?.alphaMultiplier ?? 1, p = u * d * f;
		if (p <= 0) return;
		let m = c & 16777215, h = at(nt(l & 16777215, m)), g = i._roundPixels | t._roundPixels;
		o.save(), a.setContextTransform(s, g === 1), a.setBlendMode(t.groupBlendMode);
		let _ = t.context.instructions;
		for (let e = 0; e < _.length; e++) {
			let t = _[e];
			if (t.action === "texture") {
				let e = t.data, n = e.image, r = n ? Z.getCanvasSource(n) : null;
				if (!r) continue;
				let i = e.alpha * p;
				if (i <= 0) continue;
				let c = nt(e.style, h);
				o.globalAlpha = i;
				let l = r;
				c !== 16777215 && (l = Z.getTintedCanvas({ texture: n }, c));
				let u = n.frame, d = n.source._resolution ?? n.source.resolution ?? 1, f = u.x * d, m = u.y * d, _ = u.width * d, v = u.height * d;
				l !== r && (f = 0, m = 0);
				let y = e.transform, b = y && !y.isIdentity(), x = n.rotate;
				b || x ? (zb.copyFrom(s), b && zb.append(y), x && q.matrixAppendRotationInv(zb, x, e.dx, e.dy, e.dw, e.dh), a.setContextTransform(zb, g === 1)) : a.setContextTransform(s, g === 1), o.drawImage(l, f, m, l === r ? _ : l.width, l === r ? v : l.height, x ? 0 : e.dx, x ? 0 : e.dy, e.dw, e.dh), (b || x) && a.setContextTransform(s, g === 1);
				continue;
			}
			let i = t.data, c = i?.path?.shapePath;
			if (!((n = c?.shapePrimitives) != null && n.length)) continue;
			let l = i.style, u = nt(l.color, h), d = l.alpha * p;
			if (d <= 0) continue;
			let f = t.action === "stroke";
			if (o.globalAlpha = d, f) {
				let e = l;
				o.lineWidth = e.width, o.lineCap = e.cap, o.lineJoin = e.join, o.miterLimit = e.miterLimit;
			}
			let m = c.shapePrimitives;
			if (!f && (r = i.hole?.shapePath?.shapePrimitives) != null && r.length) {
				let e = m[m.length - 1];
				e.holes = i.hole.shapePath.shapePrimitives;
			}
			for (let e = 0; e < m.length; e++) {
				let t = m[e];
				if (!(t != null && t.shape)) continue;
				let n = t.transform, r = n && !n.isIdentity(), i = l.texture && l.texture !== J.WHITE, a = l.textureSpace === "global" ? n : null, c = Jb(l, u, i ? Ad(Bb, l, t.shape, a) : null, r ? Vb.copyFrom(s).append(n) : s);
				if (r && (o.save(), o.transform(n.a, n.b, n.c, n.d, n.tx, n.ty)), f) {
					let e = l;
					if (e.alignment !== .5 && !e.pixelLine) {
						let n = [], r = [], i = [], a = jd[t.shape.type];
						a != null && a.build(t.shape, n) ? (ld(n, e, !1, t.shape.closePath ?? !0, r, i), o.fillStyle = c, Ub(o, r, i)) : (o.strokeStyle = c, o.beginPath(), Kb(o, t.shape), o.stroke());
					} else o.strokeStyle = c, o.beginPath(), Kb(o, t.shape), o.stroke();
				} else o.fillStyle = c, o.beginPath(), Kb(o, t.shape), qb(o, t.holes) ? o.fill("evenodd") : o.fill();
				r && o.restore();
			}
		}
		o.restore();
	}
	destroy() {
		this.shader = null;
	}
};
Yb.extension = {
	type: [h.CanvasPipesAdaptor],
	name: "graphics"
};
var Xb = class {
	constructor(e) {
		this._renderer = e;
	}
	addRenderable(e, t) {
		let n = this._getGpuSprite(e);
		e.didViewUpdate && this._updateBatchableSprite(e, n), this._renderer.renderPipes.batch.addToBatch(n, t);
	}
	updateRenderable(e) {
		let t = this._getGpuSprite(e);
		e.didViewUpdate && this._updateBatchableSprite(e, t), t._batcher.updateElement(t);
	}
	validateRenderable(e) {
		let t = this._getGpuSprite(e);
		return !t._batcher.checkAndUpdateTexture(t, e._texture);
	}
	_updateBatchableSprite(e, t) {
		t.bounds = e.visualBounds, t.texture = e._texture;
	}
	_getGpuSprite(e) {
		return e._gpuData[this._renderer.uid] || this._initGPUSprite(e);
	}
	_initGPUSprite(e) {
		let t = new Iv();
		return t.renderable = e, t.transform = e.groupTransform, t.texture = e._texture, t.bounds = e.visualBounds, t.roundPixels = this._renderer._roundPixels | e._roundPixels, e._gpuData[this._renderer.uid] = t, t;
	}
	destroy() {
		this._renderer = null;
	}
};
Xb.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "sprite"
};
var Zb = {};
v.handle(h.BlendMode, (e) => {
	if (!e.name) throw Error("BlendMode extension must have a name property");
	Zb[e.name] = e.ref;
}, (e) => {
	delete Zb[e.name];
});
var Qb = class {
	constructor(e) {
		this._blendModeStack = [], this._isAdvanced = !1, this._filterHash = Object.create(null), this._renderer = e, this._renderer.runners.prerender.add(this);
	}
	prerender() {
		this._activeBlendMode = "normal", this._isAdvanced = !1;
	}
	pushBlendMode(e, t, n) {
		this._blendModeStack.push(t), this.setBlendMode(e, t, n);
	}
	popBlendMode(e) {
		this._blendModeStack.pop();
		let t = this._blendModeStack[this._activeBlendMode.length - 1] ?? "normal";
		this.setBlendMode(null, t, e);
	}
	setBlendMode(e, t, n) {
		var r;
		let i = e instanceof gn;
		if (this._activeBlendMode === t) {
			this._isAdvanced && e && !i && ((r = this._renderableList) == null || r.push(e));
			return;
		}
		this._isAdvanced && this._endAdvancedBlendMode(n), this._activeBlendMode = t, e && (this._isAdvanced = !!Zb[t], this._isAdvanced && this._beginAdvancedBlendMode(e, n));
	}
	_beginAdvancedBlendMode(e, t) {
		this._renderer.renderPipes.batch.break(t);
		let n = this._activeBlendMode;
		if (!Zb[n]) return;
		let r = this._ensureFilterEffect(n), i = e instanceof gn, a = {
			renderPipeId: "filter",
			action: "pushFilter",
			filterEffect: r,
			renderables: i ? null : [e],
			container: i ? e.root : null,
			canBundle: !1
		};
		this._renderableList = a.renderables, t.add(a);
	}
	_ensureFilterEffect(e) {
		let t = this._filterHash[e];
		return t || (t = this._filterHash[e] = new Ie(), t.filters = [new Zb[e]()]), t;
	}
	_endAdvancedBlendMode(e) {
		this._isAdvanced = !1, this._renderableList = null, this._renderer.renderPipes.batch.break(e), e.add({
			renderPipeId: "filter",
			action: "popFilter",
			canBundle: !1
		});
	}
	buildStart() {
		this._isAdvanced = !1;
	}
	buildEnd(e) {
		this._isAdvanced && this._endAdvancedBlendMode(e);
	}
	destroy() {
		this._renderer = null, this._renderableList = null;
		for (let e in this._filterHash) this._filterHash[e].destroy();
		this._filterHash = null;
	}
};
Qb.extension = {
	type: [
		h.WebGLPipes,
		h.WebGPUPipes,
		h.CanvasPipes
	],
	name: "blendMode"
};
function $b(e, t) {
	t ||= 0;
	for (let n = t; n < e.length && e[n]; n++) e[n] = null;
}
var ex = new Y(), tx = 7;
function nx(e, t = !1) {
	rx(e);
	let n = e.childrenToUpdate, r = e.updateTick++;
	for (let t in n) {
		let i = Number(t), a = n[t], o = a.list, s = a.index;
		for (let t = 0; t < s; t++) {
			let n = o[t];
			n.parentRenderGroup === e && n.relativeRenderGroupDepth === i && ix(n, r, 0);
		}
		$b(o, s), a.index = 0;
	}
	if (t) for (let n = 0; n < e.renderGroupChildren.length; n++) nx(e.renderGroupChildren[n], t);
}
function rx(e) {
	let t = e.root, n;
	if (e.renderGroupParent) {
		let r = e.renderGroupParent;
		e.worldTransform.appendFrom(t.relativeGroupTransform, r.worldTransform), e.worldColor = it(t.groupColor, r.worldColor), n = t.groupAlpha * r.worldAlpha;
	} else e.worldTransform.copyFrom(t.localTransform), e.worldColor = t.localColor, n = t.localAlpha;
	n = n < 0 ? 0 : n > 1 ? 1 : n, e.worldAlpha = n, e.worldColorAlpha = e.worldColor + ((n * 255 | 0) << 24);
}
function ix(e, t, n) {
	if (t === e.updateTick) return;
	e.updateTick = t, e.didChange = !1;
	let r = e.localTransform;
	e.updateLocalTransform();
	let i = e.parent;
	if (i && !i.renderGroup ? (n |= e._updateFlags, e.relativeGroupTransform.appendFrom(r, i.relativeGroupTransform), n & tx && ax(e, i, n)) : (n = e._updateFlags, e.relativeGroupTransform.copyFrom(r), n & tx && ax(e, ex, n)), !e.renderGroup) {
		let r = e.children, i = r.length;
		for (let e = 0; e < i; e++) ix(r[e], t, n);
		let a = e.parentRenderGroup, o = e;
		o.renderPipeId && !a.structureDidChange && a.updateRenderable(o);
	}
}
function ax(e, t, n) {
	if (n & 1) {
		e.groupColor = it(e.localColor, t.groupColor);
		let n = e.localAlpha * t.groupAlpha;
		n = n < 0 ? 0 : n > 1 ? 1 : n, e.groupAlpha = n, e.groupColorAlpha = e.groupColor + ((n * 255 | 0) << 24);
	}
	n & 2 && (e.groupBlendMode = e.localBlendMode === "inherit" ? t.groupBlendMode : e.localBlendMode), n & 4 && (e.globalDisplayStatus = e.localDisplayStatus & t.globalDisplayStatus), e._updateFlags = 0;
}
function ox(e, t) {
	let { list: n } = e.childrenRenderablesToUpdate, r = !1;
	for (let i = 0; i < e.childrenRenderablesToUpdate.index; i++) {
		let e = n[i];
		if (r = t[e.renderPipeId].validateRenderable(e), r) break;
	}
	return e.structureDidChange = r, r;
}
var sx = new B(), cx = class {
	constructor(e) {
		this._renderer = e;
	}
	render({ container: e, transform: t }) {
		let n = e.parent, r = e.renderGroup.renderGroupParent;
		e.parent = null, e.renderGroup.renderGroupParent = null;
		let i = this._renderer, a = sx;
		t && (a.copyFrom(e.renderGroup.localTransform), e.renderGroup.localTransform.copyFrom(t));
		let o = i.renderPipes;
		this._updateCachedRenderGroups(e.renderGroup, null), this._updateRenderGroups(e.renderGroup), i.globalUniforms.start({
			worldTransformMatrix: t ? e.renderGroup.localTransform : e.renderGroup.worldTransform,
			worldColor: e.renderGroup.worldColorAlpha
		}), Ib(e.renderGroup, o), o.uniformBatch && o.uniformBatch.renderEnd(), t && e.renderGroup.localTransform.copyFrom(a), e.parent = n, e.renderGroup.renderGroupParent = r;
	}
	destroy() {
		this._renderer = null;
	}
	_updateCachedRenderGroups(e, t) {
		if (e._parentCacheAsTextureRenderGroup = t, e.isCachedAsTexture) {
			if (!e.textureNeedsUpdate) return;
			t = e;
		}
		for (let n = e.renderGroupChildren.length - 1; n >= 0; n--) this._updateCachedRenderGroups(e.renderGroupChildren[n], t);
		if (e.invalidateMatrices(), e.isCachedAsTexture) {
			if (e.textureNeedsUpdate) {
				let t = e.root.getLocalBounds(), n = this._renderer, r = e.textureOptions.resolution || n.view.resolution, i = e.textureOptions.antialias ?? n.view.antialias, a = e.textureOptions.scaleMode ?? "linear", o = e.texture;
				t.ceil(), e.texture && hn.returnTexture(e.texture, !0);
				let s = hn.getOptimalTexture(t.width, t.height, r, i);
				s._source.style = new Ot({ scaleMode: a }), e.texture = s, e._textureBounds ||= new G(), e._textureBounds.copyFrom(t), o !== e.texture && e.renderGroupParent && (e.renderGroupParent.structureDidChange = !0);
			}
		} else e.texture &&= (hn.returnTexture(e.texture, !0), null);
	}
	_updateRenderGroups(e) {
		let t = this._renderer, n = t.renderPipes;
		if (e.runOnRender(t), e.instructionSet.renderPipes = n, e.structureDidChange ? $b(e.childrenRenderablesToUpdate.list, 0) : ox(e, n), nx(e), e.structureDidChange ? (e.structureDidChange = !1, this._buildInstructions(e, t)) : this._updateRenderables(e), e.childrenRenderablesToUpdate.index = 0, t.renderPipes.batch.upload(e.instructionSet), !e.isCachedAsTexture || e.textureNeedsUpdate) for (let t = 0; t < e.renderGroupChildren.length; t++) this._updateRenderGroups(e.renderGroupChildren[t]);
	}
	_updateRenderables(e) {
		let { list: t, index: n } = e.childrenRenderablesToUpdate;
		for (let r = 0; r < n; r++) {
			let n = t[r];
			n.didViewUpdate && e.updateRenderable(n);
		}
		$b(t, n);
	}
	_buildInstructions(e, t) {
		let n = e.root, r = e.instructionSet;
		r.reset();
		let i = t.renderPipes ? t : t.batch.renderer, a = i.renderPipes;
		a.batch.buildStart(r), a.blendMode.buildStart(), a.colorMask.buildStart(), n.sortableChildren && n.sortChildren(), n.collectRenderablesWithEffects(r, i, null), a.batch.buildEnd(r), a.blendMode.buildEnd(r);
	}
};
cx.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "renderGroup"
};
var lx = Object.defineProperty, ux = Object.getOwnPropertySymbols, dx = Object.prototype.hasOwnProperty, fx = Object.prototype.propertyIsEnumerable, px = (e, t, n) => t in e ? lx(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, mx = (e, t) => {
	for (var n in t ||= {}) dx.call(t, n) && px(e, n, t[n]);
	if (ux) for (var n of ux(t)) fx.call(t, n) && px(e, n, t[n]);
	return e;
}, hx = class e {
	constructor() {
		this.clearBeforeRender = !0, this._backgroundColor = new z(0), this.color = this._backgroundColor, this.alpha = 1;
	}
	init(t) {
		t = mx(mx({}, e.defaultOptions), t), this.clearBeforeRender = t.clearBeforeRender, this.color = t.background || t.backgroundColor || this._backgroundColor, this.alpha = t.backgroundAlpha, this._backgroundColor.setAlpha(t.backgroundAlpha);
	}
	get color() {
		return this._backgroundColor;
	}
	set color(e) {
		this._backgroundColor.setValue(e);
	}
	get alpha() {
		return this._backgroundColor.alpha;
	}
	set alpha(e) {
		this._backgroundColor.setAlpha(e);
	}
	get colorRgba() {
		return this._backgroundColor.toArray();
	}
	destroy() {}
};
hx.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "background",
	priority: 0
}, hx.defaultOptions = {
	backgroundAlpha: 1,
	backgroundColor: 0,
	clearBeforeRender: !0
};
var gx = hx, _x = Object.defineProperty, vx = Object.getOwnPropertySymbols, yx = Object.prototype.hasOwnProperty, bx = Object.prototype.propertyIsEnumerable, xx = (e, t, n) => t in e ? _x(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Sx = (e, t) => {
	for (var n in t ||= {}) yx.call(t, n) && xx(e, n, t[n]);
	if (vx) for (var n of vx(t)) bx.call(t, n) && xx(e, n, t[n]);
	return e;
}, Cx = {
	png: "image/png",
	jpg: "image/jpeg",
	webp: "image/webp"
}, wx = class e {
	constructor(e) {
		this._renderer = e;
	}
	_normalizeOptions(e, t = {}) {
		return e instanceof Y || e instanceof J ? Sx({ target: e }, t) : Sx(Sx({}, t), e);
	}
	async image(e) {
		let t = X.get().createImage();
		return t.src = await this.base64(e), t;
	}
	async base64(t) {
		t = this._normalizeOptions(t, e.defaultImageOptions);
		let { format: n, quality: r } = t, i = this.canvas(t);
		if (i.toBlob !== void 0) return new Promise((e, t) => {
			i.toBlob((n) => {
				if (!n) {
					t(/* @__PURE__ */ Error("ICanvas.toBlob failed!"));
					return;
				}
				let r = new FileReader();
				r.onload = () => e(r.result), r.onerror = t, r.readAsDataURL(n);
			}, Cx[n], r);
		});
		if (i.toDataURL !== void 0) return i.toDataURL(Cx[n], r);
		if (i.convertToBlob !== void 0) {
			let e = await i.convertToBlob({
				type: Cx[n],
				quality: r
			});
			return new Promise((t, n) => {
				let r = new FileReader();
				r.onload = () => t(r.result), r.onerror = n, r.readAsDataURL(e);
			});
		}
		throw Error("Extract.base64() requires ICanvas.toDataURL, ICanvas.toBlob, or ICanvas.convertToBlob to be implemented");
	}
	canvas(e) {
		e = this._normalizeOptions(e);
		let t = e.target, n = this._renderer;
		if (t instanceof J) return n.texture.generateCanvas(t);
		let r = n.textureGenerator.generateTexture(e), i = n.texture.generateCanvas(r);
		return r.destroy(!0), i;
	}
	pixels(e) {
		e = this._normalizeOptions(e);
		let t = e.target, n = this._renderer, r = t instanceof J ? t : n.textureGenerator.generateTexture(e), i = n.texture.getPixels(r);
		return t instanceof Y && r.destroy(!0), i;
	}
	texture(e) {
		return e = this._normalizeOptions(e), e.target instanceof J ? e.target : this._renderer.textureGenerator.generateTexture(e);
	}
	download(e) {
		e = this._normalizeOptions(e);
		let t = this.canvas(e), n = document.createElement("a");
		n.download = e.filename ?? "image.png", n.href = t.toDataURL("image/png"), document.body.appendChild(n), n.click(), document.body.removeChild(n);
	}
	log(e) {
		let t = e.width ?? 200;
		e = this._normalizeOptions(e);
		let n = this.canvas(e), r = n.toDataURL();
		console.log(`[Pixi Texture] ${n.width}px ${n.height}px`);
		let i = [
			"font-size: 1px;",
			`padding: ${t}px 300px;`,
			`background: url(${r}) no-repeat;`,
			"background-size: contain;"
		].join(" ");
		console.log("%c ", i);
	}
	destroy() {
		this._renderer = null;
	}
};
wx.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "extract"
}, wx.defaultImageOptions = {
	format: "png",
	quality: 1
};
var Tx = wx, Ex = Object.defineProperty, Dx = Object.defineProperties, Ox = Object.getOwnPropertyDescriptors, kx = Object.getOwnPropertySymbols, Ax = Object.prototype.hasOwnProperty, jx = Object.prototype.propertyIsEnumerable, Mx = (e, t, n) => t in e ? Ex(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Nx = (e, t) => {
	for (var n in t ||= {}) Ax.call(t, n) && Mx(e, n, t[n]);
	if (kx) for (var n of kx(t)) jx.call(t, n) && Mx(e, n, t[n]);
	return e;
}, Px = (e, t) => Dx(e, Ox(t)), Fx = (e, t) => {
	var n = {};
	for (var r in e) Ax.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && kx) for (var r of kx(e)) t.indexOf(r) < 0 && jx.call(e, r) && (n[r] = e[r]);
	return n;
}, Ix = class e extends J {
	static create(t) {
		let n = t, { dynamic: r, textureOptions: i } = n, a = Fx(n, ["dynamic", "textureOptions"]);
		return new e(Px(Nx({}, i), {
			source: new It(a),
			dynamic: r ?? !1
		}));
	}
	resize(e, t, n) {
		return this.source.resize(e, t, n), this;
	}
}, Lx = Object.defineProperty, Rx = Object.defineProperties, zx = Object.getOwnPropertyDescriptors, Bx = Object.getOwnPropertySymbols, Vx = Object.prototype.hasOwnProperty, Hx = Object.prototype.propertyIsEnumerable, Ux = (e, t, n) => t in e ? Lx(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Wx = (e, t) => {
	for (var n in t ||= {}) Vx.call(t, n) && Ux(e, n, t[n]);
	if (Bx) for (var n of Bx(t)) Hx.call(t, n) && Ux(e, n, t[n]);
	return e;
}, Gx = (e, t) => Rx(e, zx(t)), Kx = new qe(), qx = new G(), Jx = [
	0,
	0,
	0,
	0
], Yx = class {
	constructor(e) {
		this._renderer = e;
	}
	generateTexture(e) {
		e instanceof Y && (e = {
			target: e,
			frame: void 0,
			textureSourceOptions: {},
			resolution: void 0
		});
		let t = e.resolution || this._renderer.resolution, n = e.antialias || this._renderer.view.antialias, r = e.target, i = e.clearColor;
		i = i ? Array.isArray(i) && i.length === 4 ? i : z.shared.setValue(i).toArray() : Jx;
		let a = e.frame?.copyTo(Kx) || st(r, qx).rectangle, o = e.defaultAnchor && { defaultAnchor: e.defaultAnchor };
		a.width = Math.max(a.width, 1 / t) | 0, a.height = Math.max(a.height, 1 / t) | 0;
		let s = Ix.create(Gx(Wx({}, e.textureSourceOptions), {
			width: a.width,
			height: a.height,
			resolution: t,
			antialias: n,
			textureOptions: o
		})), c = B.shared.translate(-a.x, -a.y);
		return this._renderer.render({
			container: r,
			transform: c,
			target: s,
			clearColor: i
		}), s.source.updateMipmaps(), s;
	}
	destroy() {
		this._renderer = null;
	}
};
Yx.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "textureGenerator"
};
function Xx(e) {
	let t = !1;
	for (let n in e) if (e[n] == null) {
		t = !0;
		break;
	}
	if (!t) return e;
	let n = Object.create(null);
	for (let t in e) {
		let r = e[t];
		r && (n[t] = r);
	}
	return n;
}
function Zx(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) e[n] == null ? t++ : e[n - t] = e[n];
	return e.length -= t, e;
}
var Qx = Object.defineProperty, $x = Object.getOwnPropertySymbols, eS = Object.prototype.hasOwnProperty, tS = Object.prototype.propertyIsEnumerable, nS = (e, t, n) => t in e ? Qx(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, rS = (e, t) => {
	for (var n in t ||= {}) eS.call(t, n) && nS(e, n, t[n]);
	if ($x) for (var n of $x(t)) tS.call(t, n) && nS(e, n, t[n]);
	return e;
}, iS = class e {
	constructor(e) {
		this._managedResources = [], this._managedResourceHashes = [], this._managedCollections = [], this._ready = !1, this._renderer = e;
	}
	init(t) {
		t = rS(rS({}, e.defaultOptions), t), this.maxUnusedTime = t.gcMaxUnusedTime, this._frequency = t.gcFrequency, this.enabled = t.gcActive, this.now = performance.now();
	}
	get enabled() {
		return !!this._handler;
	}
	set enabled(e) {
		this.enabled !== e && (e ? (this._handler = this._renderer.scheduler.repeat(() => {
			this._ready = !0;
		}, this._frequency, !1), this._collectionsHandler = this._renderer.scheduler.repeat(() => {
			for (let e of this._managedCollections) {
				let { context: t, collection: n, type: r } = e;
				t[n] = r === "hash" ? Xx(t[n]) : Zx(t[n]);
			}
		}, this._frequency)) : (this._renderer.scheduler.cancel(this._handler), this._renderer.scheduler.cancel(this._collectionsHandler), this._handler = 0, this._collectionsHandler = 0));
	}
	prerender({ container: e }) {
		this.now = performance.now(), e.renderGroup.gcTick = this._renderer.tick++, this._updateInstructionGCTick(e.renderGroup, e.renderGroup.gcTick);
	}
	postrender() {
		!this._ready || !this.enabled || (this.run(), this._ready = !1);
	}
	_updateInstructionGCTick(e, t) {
		e.instructionSet.gcTick = t, e.gcTick = t;
		for (let n of e.renderGroupChildren) this._updateInstructionGCTick(n, t);
	}
	addCollection(e, t, n) {
		this._managedCollections.push({
			context: e,
			collection: t,
			type: n
		});
	}
	addResource(e, t) {
		var n, r;
		if (e._gcLastUsed !== -1) {
			e._gcLastUsed = this.now, (n = e._onTouch) == null || n.call(e, this.now);
			return;
		}
		e._gcData = {
			index: this._managedResources.length,
			type: t
		}, e._gcLastUsed = this.now, (r = e._onTouch) == null || r.call(e, this.now), e.once("unload", this.removeResource, this), this._managedResources.push(e);
	}
	removeResource(e) {
		let t = e._gcData;
		if (!t) return;
		let n = t.index, r = this._managedResources.length - 1;
		if (n !== r) {
			let e = this._managedResources[r];
			this._managedResources[n] = e, e._gcData.index = n;
		}
		this._managedResources.length--, e._gcData = null, e._gcLastUsed = -1;
	}
	addResourceHash(e, t, n, r = 0) {
		this._managedResourceHashes.push({
			context: e,
			hash: t,
			type: n,
			priority: r
		}), this._managedResourceHashes.sort((e, t) => e.priority - t.priority);
	}
	run() {
		let e = performance.now(), t = this._managedResourceHashes;
		for (let n of t) this.runOnHash(n, e);
		let n = 0;
		for (let t = 0; t < this._managedResources.length; t++) {
			let r = this._managedResources[t];
			n = this.runOnResource(r, e, n);
		}
		this._managedResources.length = n;
	}
	updateRenderableGCTick(e, t) {
		var n;
		let r = e.renderGroup ?? e.parentRenderGroup, i = r?.instructionSet?.gcTick ?? -1;
		(r?.gcTick ?? 0) === i && (e._gcLastUsed = t, (n = e._onTouch) == null || n.call(e, t));
	}
	runOnResource(e, t, n) {
		let r = e._gcData;
		return r.type === "renderable" && this.updateRenderableGCTick(e, t), t - e._gcLastUsed < this.maxUnusedTime || !e.autoGarbageCollect ? (this._managedResources[n] = e, r.index = n, n++) : (e.unload(), e._gcData = null, e._gcLastUsed = -1, e.off("unload", this.removeResource, this)), n;
	}
	_createHashClone(e, t) {
		let n = Object.create(null);
		for (let r in e) {
			if (r === t) break;
			e[r] !== null && (n[r] = e[r]);
		}
		return n;
	}
	runOnHash(e, t) {
		var n;
		let { context: r, hash: i, type: a } = e, o = r[i], s = null, c = 0;
		for (let e in o) {
			let r = o[e];
			if (r === null) {
				c++, c === 1e4 && !s && (s = this._createHashClone(o, e));
				continue;
			}
			if (r._gcLastUsed === -1) {
				r._gcLastUsed = t, (n = r._onTouch) == null || n.call(r, t), s && (s[e] = r);
				continue;
			}
			if (a === "renderable" && this.updateRenderableGCTick(r, t), !(t - r._gcLastUsed < this.maxUnusedTime) && r.autoGarbageCollect) {
				if (a === "renderable") {
					let e = r, t = e.renderGroup ?? e.parentRenderGroup;
					t && (t.structureDidChange = !0);
				}
				r.unload(), r._gcData = null, r._gcLastUsed = -1, s || (c + 1 === 1e4 ? s = this._createHashClone(o, e) : (o[e] = null, c++));
			} else s && (s[e] = r);
		}
		s && (r[i] = s);
	}
	destroy() {
		this.enabled = !1, this._managedResources.forEach((e) => {
			e.off("unload", this.removeResource, this);
		}), this._managedResources.length = 0, this._managedResourceHashes.length = 0, this._managedCollections.length = 0, this._renderer = null;
	}
};
iS.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "gc",
	priority: 0
}, iS.defaultOptions = {
	gcActive: !0,
	gcMaxUnusedTime: 6e4,
	gcFrequency: 3e4
};
var aS = iS, oS = class {
	constructor(e) {
		this._stackIndex = 0, this._globalUniformDataStack = [], this._uniformsPool = [], this._activeUniforms = [], this._bindGroupPool = [], this._activeBindGroups = [], this._renderer = e;
	}
	reset() {
		this._stackIndex = 0;
		for (let e = 0; e < this._activeUniforms.length; e++) this._uniformsPool.push(this._activeUniforms[e]);
		for (let e = 0; e < this._activeBindGroups.length; e++) this._bindGroupPool.push(this._activeBindGroups[e]);
		this._activeUniforms.length = 0, this._activeBindGroups.length = 0;
	}
	start(e) {
		this.reset(), this.push(e);
	}
	bind({ size: e, projectionMatrix: t, worldTransformMatrix: n, worldColor: r, offset: i }) {
		let a = this._renderer.renderTarget.renderTarget, o = this._stackIndex ? this._globalUniformDataStack[this._stackIndex - 1] : {
			projectionData: a,
			worldTransformMatrix: new B(),
			worldColor: 4294967295,
			offset: new Ee()
		}, s = {
			projectionMatrix: t || this._renderer.renderTarget.projectionMatrix,
			resolution: e || a.size,
			worldTransformMatrix: n || o.worldTransformMatrix,
			worldColor: r || o.worldColor,
			offset: i || o.offset,
			bindGroup: null
		}, c = this._uniformsPool.pop() || this._createUniforms();
		this._activeUniforms.push(c);
		let l = c.uniforms;
		l.uProjectionMatrix = s.projectionMatrix, l.uResolution = s.resolution, l.uWorldTransformMatrix.copyFrom(s.worldTransformMatrix), l.uWorldTransformMatrix.tx -= s.offset.x, l.uWorldTransformMatrix.ty -= s.offset.y, eg(s.worldColor, l.uWorldColorAlpha, 0), c.update();
		let u;
		this._renderer.renderPipes.uniformBatch ? u = this._renderer.renderPipes.uniformBatch.getUniformBindGroup(c, !1) : (u = this._bindGroupPool.pop() || new Ka(), this._activeBindGroups.push(u), u.setResource(c, 0)), s.bindGroup = u, this._currentGlobalUniformData = s;
	}
	push(e) {
		this.bind(e), this._globalUniformDataStack[this._stackIndex++] = this._currentGlobalUniformData;
	}
	pop() {
		this._currentGlobalUniformData = this._globalUniformDataStack[--this._stackIndex - 1], this._renderer.type === qa.WEBGL && this._currentGlobalUniformData.bindGroup.resources[0].update();
	}
	get bindGroup() {
		return this._currentGlobalUniformData.bindGroup;
	}
	get globalUniformData() {
		return this._currentGlobalUniformData;
	}
	get uniformGroup() {
		return this._currentGlobalUniformData.bindGroup.resources[0];
	}
	_createUniforms() {
		return new io({
			uProjectionMatrix: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uWorldTransformMatrix: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uWorldColorAlpha: {
				value: /* @__PURE__ */ new Float32Array(4),
				type: "vec4<f32>"
			},
			uResolution: {
				value: [0, 0],
				type: "vec2<f32>"
			}
		}, { isStatic: !0 });
	}
	destroy() {
		this._renderer = null, this._globalUniformDataStack.length = 0, this._uniformsPool.length = 0, this._activeUniforms.length = 0, this._bindGroupPool.length = 0, this._activeBindGroups.length = 0, this._currentGlobalUniformData = null;
	}
};
oS.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "globalUniforms"
};
var sS = 1, cS = class {
	constructor() {
		this._tasks = [], this._offset = 0;
	}
	init() {
		Tn.system.add(this._update, this);
	}
	repeat(e, t, n = !0) {
		let r = sS++, i = 0;
		return n && (this._offset += 1e3, i = this._offset), this._tasks.push({
			func: e,
			duration: t,
			start: performance.now(),
			offset: i,
			last: performance.now(),
			repeat: !0,
			id: r
		}), r;
	}
	cancel(e) {
		for (let t = 0; t < this._tasks.length; t++) if (this._tasks[t].id === e) {
			this._tasks.splice(t, 1);
			return;
		}
	}
	_update() {
		let e = performance.now();
		for (let t = 0; t < this._tasks.length; t++) {
			let n = this._tasks[t];
			if (e - n.offset - n.last >= n.duration) {
				let t = e - n.start;
				n.func(t), n.last = e;
			}
		}
	}
	destroy() {
		Tn.system.remove(this._update, this), this._tasks.length = 0;
	}
};
cS.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "scheduler",
	priority: 0
};
var lS = !1;
function uS(e) {
	if (!lS) {
		if (X.get().getNavigator().userAgent.toLowerCase().indexOf("chrome") > -1) {
			let t = [
				`%c  %c  %c  %c  %c PixiJS %c v${Gs} (${e}) http://www.pixijs.com/

`,
				"background: #E72264; padding:5px 0;",
				"background: #6CA2EA; padding:5px 0;",
				"background: #B5D33D; padding:5px 0;",
				"background: #FED23F; padding:5px 0;",
				"color: #FFFFFF; background: #E72264; padding:5px 0;",
				"color: #E72264; background: #FFFFFF; padding:5px 0;"
			];
			globalThis.console.log(...t);
		} else globalThis.console && globalThis.console.log(`PixiJS 8.19.0 - ${e} - http://www.pixijs.com/`);
		lS = !0;
	}
}
var dS = class {
	constructor(e) {
		this._renderer = e;
	}
	init(e) {
		if (e.hello) {
			let e = this._renderer.name;
			this._renderer.type === qa.WEBGL && (e += ` ${this._renderer.context.webGLVersion}`), uS(e);
		}
	}
};
dS.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "hello",
	priority: -2
}, dS.defaultOptions = { hello: !1 };
var fS = Object.defineProperty, pS = Object.getOwnPropertySymbols, mS = Object.prototype.hasOwnProperty, hS = Object.prototype.propertyIsEnumerable, gS = (e, t, n) => t in e ? fS(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, _S = (e, t) => {
	for (var n in t ||= {}) mS.call(t, n) && gS(e, n, t[n]);
	if (pS) for (var n of pS(t)) hS.call(t, n) && gS(e, n, t[n]);
	return e;
}, vS = class e {
	constructor(e) {
		this._renderer = e;
	}
	init(t) {
		t = _S(_S({}, e.defaultOptions), t), this.maxUnusedTime = t.renderableGCMaxUnusedTime;
	}
	get enabled() {
		return this._renderer.gc.enabled;
	}
	set enabled(e) {
		this._renderer.gc.enabled = e;
	}
	addManagedHash(e, t) {
		this._renderer.gc.addCollection(e, t, "hash");
	}
	addManagedArray(e, t) {
		this._renderer.gc.addCollection(e, t, "array");
	}
	addRenderable(e) {
		this._renderer.gc.addResource(e, "renderable");
	}
	run() {
		this._renderer.gc.run();
	}
	destroy() {
		this._renderer = null;
	}
};
vS.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "renderableGC",
	priority: 0
}, vS.defaultOptions = {
	renderableGCActive: !0,
	renderableGCMaxUnusedTime: 6e4,
	renderableGCFrequency: 3e4
};
var yS = vS, bS = class e {
	get count() {
		return this._renderer.tick;
	}
	get checkCount() {
		return this._checkCount;
	}
	set checkCount(e) {
		this._checkCount = e;
	}
	get maxIdle() {
		return this._renderer.gc.maxUnusedTime / 1e3 * 60;
	}
	set maxIdle(e) {
		this._renderer.gc.maxUnusedTime = e / 60 * 1e3;
	}
	get checkCountMax() {
		return Math.floor(this._renderer.gc._frequency / 1e3);
	}
	set checkCountMax(e) {}
	get active() {
		return this._renderer.gc.enabled;
	}
	set active(e) {
		this._renderer.gc.enabled = e;
	}
	constructor(e) {
		this._renderer = e, this._checkCount = 0;
	}
	init(t) {
		t.textureGCActive !== e.defaultOptions.textureGCActive && (this.active = t.textureGCActive), t.textureGCMaxIdle !== e.defaultOptions.textureGCMaxIdle && (this.maxIdle = t.textureGCMaxIdle), t.textureGCCheckCountMax !== e.defaultOptions.textureGCCheckCountMax && (this.checkCountMax = t.textureGCCheckCountMax);
	}
	run() {
		this._renderer.gc.run();
	}
	destroy() {
		this._renderer = null;
	}
};
bS.extension = {
	type: [h.WebGLSystem, h.WebGPUSystem],
	name: "textureGC"
}, bS.defaultOptions = {
	textureGCActive: !0,
	textureGCAMaxIdle: null,
	textureGCMaxIdle: 3600,
	textureGCCheckCountMax: 600
};
var xS = bS, SS = Object.defineProperty, CS = Object.getOwnPropertySymbols, wS = Object.prototype.hasOwnProperty, TS = Object.prototype.propertyIsEnumerable, ES = (e, t, n) => t in e ? SS(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, DS = (e, t) => {
	for (var n in t ||= {}) wS.call(t, n) && ES(e, n, t[n]);
	if (CS) for (var n of CS(t)) TS.call(t, n) && ES(e, n, t[n]);
	return e;
}, OS = class e {
	constructor(t = {}) {
		if (this.uid = H("renderTarget"), this.colorTextures = [], this.dirtyId = 0, this.isRoot = !1, this._size = /* @__PURE__ */ new Float32Array(2), this._managedColorTextures = !1, t = DS(DS({}, e.defaultOptions), t), this.stencil = t.stencil, this.depth = t.depth, this.isRoot = t.isRoot, typeof t.colorTextures == "number") {
			this._managedColorTextures = !0;
			for (let e = 0; e < t.colorTextures; e++) this.colorTextures.push(new It({
				width: t.width,
				height: t.height,
				resolution: t.resolution,
				antialias: t.antialias
			}));
		} else {
			this.colorTextures = [...t.colorTextures.map((e) => e.source)];
			let e = this.colorTexture.source;
			this.resize(e.width, e.height, e._resolution);
		}
		this.colorTexture.source.on("resize", this.onSourceResize, this), (t.depthStencilTexture || this.stencil) && (t.depthStencilTexture instanceof J || t.depthStencilTexture instanceof It ? this.depthStencilTexture = t.depthStencilTexture.source : this.ensureDepthStencilTexture());
	}
	get size() {
		let e = this._size;
		return e[0] = this.pixelWidth, e[1] = this.pixelHeight, e;
	}
	get width() {
		return this.colorTexture.source.width;
	}
	get height() {
		return this.colorTexture.source.height;
	}
	get pixelWidth() {
		return this.colorTexture.source.pixelWidth;
	}
	get pixelHeight() {
		return this.colorTexture.source.pixelHeight;
	}
	get resolution() {
		return this.colorTexture.source._resolution;
	}
	get colorTexture() {
		return this.colorTextures[0];
	}
	onSourceResize(e) {
		this.resize(e.width, e.height, e._resolution, !0);
	}
	ensureDepthStencilTexture() {
		this.depthStencilTexture ||= new It({
			width: this.width,
			height: this.height,
			resolution: this.resolution,
			format: "depth24plus-stencil8",
			autoGenerateMipmaps: !1,
			antialias: !1,
			mipLevelCount: 1
		});
	}
	resize(e, t, n = this.resolution, r = !1) {
		this.dirtyId++, this.colorTextures.forEach((i, a) => {
			r && a === 0 || i.source.resize(e, t, n);
		}), this.depthStencilTexture && this.depthStencilTexture.source.resize(e, t, n);
	}
	destroy() {
		this.colorTexture.source.off("resize", this.onSourceResize, this), this._managedColorTextures && this.colorTextures.forEach((e) => {
			e.destroy();
		}), this.depthStencilTexture && (this.depthStencilTexture.destroy(), delete this.depthStencilTexture);
	}
};
OS.defaultOptions = {
	width: 0,
	height: 0,
	resolution: 1,
	colorTextures: 1,
	stencil: !1,
	depth: !1,
	antialias: !1,
	isRoot: !1
};
var kS = OS, AS = Object.defineProperty, jS = Object.getOwnPropertySymbols, MS = Object.prototype.hasOwnProperty, NS = Object.prototype.propertyIsEnumerable, PS = (e, t, n) => t in e ? AS(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, FS = (e, t) => {
	for (var n in t ||= {}) MS.call(t, n) && PS(e, n, t[n]);
	if (jS) for (var n of jS(t)) NS.call(t, n) && PS(e, n, t[n]);
	return e;
}, IS = /* @__PURE__ */ new Map();
je.register(IS);
function LS(e, t) {
	if (!IS.has(e)) {
		let n = new J({ source: new xi(FS({ resource: e }, t)) }), r = () => {
			IS.get(e) === n && IS.delete(e);
		};
		n.once("destroy", r), n.source.once("destroy", r), IS.set(e, n);
	}
	return IS.get(e);
}
var RS = Object.defineProperty, zS = Object.getOwnPropertySymbols, BS = Object.prototype.hasOwnProperty, VS = Object.prototype.propertyIsEnumerable, HS = (e, t, n) => t in e ? RS(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, US = (e, t) => {
	for (var n in t ||= {}) BS.call(t, n) && HS(e, n, t[n]);
	if (zS) for (var n of zS(t)) VS.call(t, n) && HS(e, n, t[n]);
	return e;
}, WS = class e {
	get autoDensity() {
		return this.texture.source.autoDensity;
	}
	set autoDensity(e) {
		this.texture.source.autoDensity = e;
	}
	get resolution() {
		return this.texture.source._resolution;
	}
	set resolution(e) {
		this.texture.source.resize(this.texture.source.width, this.texture.source.height, e);
	}
	init(t) {
		t = US(US({}, e.defaultOptions), t), t.view && (t.canvas = t.view), this.screen = new qe(0, 0, t.width, t.height), this.canvas = t.canvas || X.get().createCanvas(), this.antialias = !!t.antialias, this.texture = LS(this.canvas, t), this.renderTarget = new kS({
			colorTextures: [this.texture],
			depth: !!t.depth,
			isRoot: !0
		}), this.texture.source.transparent = t.backgroundAlpha < 1, this.resolution = t.resolution;
	}
	resize(e, t, n) {
		this.texture.source.resize(e, t, n), this.screen.width = this.texture.frame.width, this.screen.height = this.texture.frame.height;
	}
	destroy(e = !1) {
		(typeof e == "boolean" ? e : e != null && e.removeView) && this.canvas.parentNode && this.canvas.parentNode.removeChild(this.canvas), this.texture.destroy();
	}
};
WS.extension = {
	type: [
		h.WebGLSystem,
		h.WebGPUSystem,
		h.CanvasSystem
	],
	name: "view",
	priority: 0
}, WS.defaultOptions = {
	width: 800,
	height: 600,
	autoDensity: !1,
	antialias: !1
};
var GS = [
	gx,
	oS,
	dS,
	WS,
	cx,
	aS,
	xS,
	Yx,
	Tx,
	qs,
	yS,
	cS
], KS = [
	Qb,
	gb,
	Xb,
	Lb,
	xb,
	kb,
	Cb,
	Fb
];
function qS(e, t, n, r, i, a) {
	let o = a ? 1 : -1;
	return e.identity(), e.a = 1 / r * 2, e.d = o * (1 / i * 2), e.tx = -1 - t * e.a, e.ty = -o - n * e.d, e;
}
function JS(e) {
	let t = e.colorTexture.source.resource;
	return globalThis.HTMLCanvasElement && t instanceof HTMLCanvasElement && document.body.contains(t);
}
var YS = class {
	constructor(e) {
		this.rootViewPort = new qe(), this.viewport = new qe(), this.mipLevel = 0, this.layer = 0, this.onRenderTargetChange = new Cs("onRenderTargetChange"), this.projectionMatrix = new B(), this.defaultClearColor = [
			0,
			0,
			0,
			0
		], this._renderSurfaceToRenderTargetHash = /* @__PURE__ */ new Map(), this._gpuRenderTargetHash = Object.create(null), this._renderTargetStack = [], this._renderer = e, e.gc.addCollection(this, "_gpuRenderTargetHash", "hash");
	}
	finishRenderPass() {
		this.adaptor.finishRenderPass(this.renderTarget);
	}
	renderStart({ target: e, clear: t, clearColor: n, frame: r, mipLevel: i, layer: a }) {
		var o, s;
		this._renderTargetStack.length = 0, this.push(e, t, n, r, i ?? 0, a ?? 0), this.rootViewPort.copyFrom(this.viewport), this.rootRenderTarget = this.renderTarget, this.renderingToScreen = JS(this.rootRenderTarget), (s = (o = this.adaptor).prerender) == null || s.call(o, this.rootRenderTarget);
	}
	postrender() {
		var e, t;
		(t = (e = this.adaptor).postrender) == null || t.call(e, this.rootRenderTarget);
	}
	bind(e, t = !0, n, r, i = 0, a = 0) {
		let o = this.getRenderTarget(e), s = this.renderTarget !== o;
		this.renderTarget = o, this.renderSurface = e;
		let c = this.getGpuRenderTarget(o);
		(o.pixelWidth !== c.width || o.pixelHeight !== c.height) && (this.adaptor.resizeGpuRenderTarget(o), c.width = o.pixelWidth, c.height = o.pixelHeight);
		let l = o.colorTexture, u = this.viewport, d = l.arrayLayerCount || 1;
		if ((a | 0) !== a && (a |= 0), a < 0 || a >= d) throw Error(`[RenderTargetSystem] layer ${a} is out of bounds (arrayLayerCount=${d}).`);
		this.mipLevel = i | 0, this.layer = a | 0;
		let f = Math.max(l.pixelWidth >> i, 1), p = Math.max(l.pixelHeight >> i, 1);
		if (!r && e instanceof J && (r = e.frame), r) {
			let e = l._resolution, t = 1 << Math.max(i | 0, 0), n = r.x * e + .5 | 0, a = r.y * e + .5 | 0, o = r.width * e + .5 | 0, s = r.height * e + .5 | 0, c = Math.floor(n / t), d = Math.floor(a / t), m = Math.ceil(o / t), h = Math.ceil(s / t);
			c = Math.min(Math.max(c, 0), f - 1), d = Math.min(Math.max(d, 0), p - 1), m = Math.min(Math.max(m, 1), f - c), h = Math.min(Math.max(h, 1), p - d), u.x = c, u.y = d, u.width = m, u.height = h;
		} else u.x = 0, u.y = 0, u.width = f, u.height = p;
		return qS(this.projectionMatrix, 0, 0, u.width / l.resolution, u.height / l.resolution, !o.isRoot), this.adaptor.startRenderPass(o, t, n, u, i, a), s && this.onRenderTargetChange.emit(o), o;
	}
	clear(e, t = Ss.ALL, n, r = this.mipLevel, i = this.layer) {
		t && (e &&= this.getRenderTarget(e), this.adaptor.clear(e || this.renderTarget, t, n, this.viewport, r, i));
	}
	contextChange() {
		this._gpuRenderTargetHash = Object.create(null);
	}
	push(e, t = Ss.ALL, n, r, i = 0, a = 0) {
		let o = this.bind(e, t, n, r, i, a);
		return this._renderTargetStack.push({
			renderTarget: o,
			frame: r,
			mipLevel: i,
			layer: a
		}), o;
	}
	pop() {
		this._renderTargetStack.pop();
		let e = this._renderTargetStack[this._renderTargetStack.length - 1];
		this.bind(e.renderTarget, !1, null, e.frame, e.mipLevel, e.layer);
	}
	getRenderTarget(e) {
		return e.isTexture && (e = e.source), this._renderSurfaceToRenderTargetHash.get(e) ?? this._initRenderTarget(e);
	}
	copyToTexture(e, t, n, r, i) {
		n.x < 0 && (r.width += n.x, i.x -= n.x, n.x = 0), n.y < 0 && (r.height += n.y, i.y -= n.y, n.y = 0);
		let { pixelWidth: a, pixelHeight: o } = e;
		return r.width = Math.min(r.width, a - n.x), r.height = Math.min(r.height, o - n.y), this.adaptor.copyToTexture(e, t, n, r, i);
	}
	ensureDepthStencil() {
		this.renderTarget.stencil || (this.renderTarget.stencil = !0, this.adaptor.startRenderPass(this.renderTarget, !1, null, this.viewport, 0, this.layer));
	}
	destroy() {
		this._renderer = null, this._renderSurfaceToRenderTargetHash.forEach((e, t) => {
			e !== t && e.destroy();
		}), this._renderSurfaceToRenderTargetHash.clear(), this._gpuRenderTargetHash = Object.create(null);
	}
	_initRenderTarget(e) {
		let t = null;
		return xi.test(e) && (e = LS(e).source), e instanceof kS ? t = e : e instanceof It && (t = new kS({ colorTextures: [e] }), e.source instanceof xi && (t.isRoot = !0), e.once("destroy", () => {
			t.destroy(), this._renderSurfaceToRenderTargetHash.delete(e);
			let n = this._gpuRenderTargetHash[t.uid];
			n && (this._gpuRenderTargetHash[t.uid] = null, this.adaptor.destroyGpuRenderTarget(n));
		})), this._renderSurfaceToRenderTargetHash.set(e, t), t;
	}
	getGpuRenderTarget(e) {
		return this._gpuRenderTargetHash[e.uid] || (this._gpuRenderTargetHash[e.uid] = this.adaptor.initGpuRenderTarget(e));
	}
	resetState() {
		this.renderTarget = null, this.renderSurface = null;
	}
}, XS = class {
	init(e, t) {
		this._renderer = e, this._renderTargetSystem = t;
	}
	initGpuRenderTarget(e) {
		let t = e.colorTexture, { canvas: n, context: r } = this._ensureCanvas(t);
		return {
			canvas: n,
			context: r,
			width: n.width,
			height: n.height
		};
	}
	resizeGpuRenderTarget(e) {
		let t = e.colorTexture, { canvas: n } = this._ensureCanvas(t);
		n.width = e.pixelWidth, n.height = e.pixelHeight;
	}
	startRenderPass(e, t, n, r) {
		let i = this._renderTargetSystem.getGpuRenderTarget(e);
		this._renderer.canvasContext.activeContext = i.context, this._renderer.canvasContext.activeResolution = e.resolution, t && this.clear(e, t, n, r);
	}
	clear(e, t, n, r) {
		let i = this._renderTargetSystem.getGpuRenderTarget(e).context, a = r || {
			x: 0,
			y: 0,
			width: e.pixelWidth,
			height: e.pixelHeight
		};
		if (i.setTransform(1, 0, 0, 1, 0, 0), i.clearRect(a.x, a.y, a.width, a.height), n) {
			let e = z.shared.setValue(n);
			e.alpha > 0 && (i.globalAlpha = e.alpha, i.fillStyle = e.toHex(), i.fillRect(a.x, a.y, a.width, a.height), i.globalAlpha = 1);
		}
	}
	finishRenderPass() {}
	copyToTexture(e, t, n, r, i) {
		let a = this._renderTargetSystem.getGpuRenderTarget(e).canvas, o = t.source, { context: s } = this._ensureCanvas(o), c = i?.x ?? 0, l = i?.y ?? 0;
		return s.drawImage(a, n.x, n.y, r.width, r.height, c, l, r.width, r.height), o.update(), t;
	}
	destroyGpuRenderTarget(e) {}
	_ensureCanvas(e) {
		let t = e.resource;
		(!t || !xi.test(t)) && (t = X.get().createCanvas(e.pixelWidth, e.pixelHeight), e.resource = t), (t.width !== e.pixelWidth || t.height !== e.pixelHeight) && (t.width = e.pixelWidth, t.height = e.pixelHeight);
		let n = t.getContext("2d");
		return {
			canvas: t,
			context: n
		};
	}
}, ZS = class extends YS {
	constructor(e) {
		super(e), this.adaptor = new XS(), this.adaptor.init(e, this);
	}
};
ZS.extension = {
	type: [h.CanvasSystem],
	name: "renderTarget"
};
var QS = class {
	constructor(e) {}
	init() {}
	initSource(e) {}
	generateCanvas(e) {
		let t = X.get().createCanvas(), n = t.getContext("2d"), r = Z.getCanvasSource(e);
		if (!r) return t;
		let i = e.frame, a = e.source._resolution ?? e.source.resolution ?? 1, o = i.x * a, s = i.y * a, c = i.width * a, l = i.height * a;
		return t.width = Math.ceil(c), t.height = Math.ceil(l), n.drawImage(r, o, s, c, l, 0, 0, c, l), t;
	}
	getPixels(e) {
		let t = this.generateCanvas(e);
		return {
			pixels: t.getContext("2d", { willReadFrequently: !0 }).getImageData(0, 0, t.width, t.height).data,
			width: t.width,
			height: t.height
		};
	}
	destroy() {}
};
QS.extension = {
	type: [h.CanvasSystem],
	name: "texture"
};
var $S = [
	...GS,
	Nb,
	Pb,
	QS,
	ZS
], eC = [
	Qb,
	gb,
	Xb,
	Lb,
	xb,
	Ob,
	Sb,
	Fb
], tC = [db, Yb], nC = [], rC = [], iC = [];
v.handleByNamedList(h.CanvasSystem, nC), v.handleByNamedList(h.CanvasPipes, rC), v.handleByNamedList(h.CanvasPipesAdaptor, iC), v.add(...$S, ...eC, ...tC);
var aC = {
	__proto__: null,
	CanvasRenderer: class extends Ms {
		constructor() {
			let e = {
				name: "canvas",
				type: qa.CANVAS,
				systems: nC,
				renderPipes: rC,
				renderPipeAdaptors: iC
			};
			super(e);
		}
	}
}, oC = ((e) => (e[e.ELEMENT_ARRAY_BUFFER = 34963] = "ELEMENT_ARRAY_BUFFER", e[e.ARRAY_BUFFER = 34962] = "ARRAY_BUFFER", e[e.UNIFORM_BUFFER = 35345] = "UNIFORM_BUFFER", e))(oC || {}), sC = class {
	constructor(e, t) {
		this._lastBindBaseLocation = -1, this._lastBindCallId = -1, this.buffer = e || null, this.updateID = -1, this.byteLength = -1, this.type = t;
	}
	destroy() {
		this.buffer = null, this.updateID = -1, this.byteLength = -1, this.type = -1, this._lastBindBaseLocation = -1, this._lastBindCallId = -1;
	}
}, cC = class {
	constructor(e) {
		this._boundBufferBases = Object.create(null), this._minBaseLocation = 0, this._nextBindBaseIndex = this._minBaseLocation, this._bindCallId = 0, this._renderer = e, this._managedBuffers = new Bu({
			renderer: e,
			type: "resource",
			onUnload: this.onBufferUnload.bind(this),
			name: "glBuffer"
		});
	}
	destroy() {
		this._managedBuffers.destroy(), this._renderer = null, this._gl = null, this._boundBufferBases = {};
	}
	contextChange() {
		this._gl = this._renderer.gl, this.destroyAll(!0), this._maxBindings = this._renderer.limits.maxUniformBindings;
	}
	getGlBuffer(e) {
		return e._gcLastUsed = this._renderer.gc.now, e._gpuData[this._renderer.uid] || this.createGLBuffer(e);
	}
	bind(e) {
		let { _gl: t } = this, n = this.getGlBuffer(e);
		t.bindBuffer(n.type, n.buffer);
	}
	bindBufferBase(e, t) {
		let { _gl: n } = this;
		this._boundBufferBases[t] !== e && (this._boundBufferBases[t] = e, e._lastBindBaseLocation = t, n.bindBufferBase(n.UNIFORM_BUFFER, t, e.buffer));
	}
	nextBindBase(e) {
		this._bindCallId++, this._minBaseLocation = 0, e && (this._boundBufferBases[0] = null, this._minBaseLocation = 1, this._nextBindBaseIndex < 1 && (this._nextBindBaseIndex = 1));
	}
	freeLocationForBufferBase(e) {
		let t = this.getLastBindBaseLocation(e);
		if (t >= this._minBaseLocation) return e._lastBindCallId = this._bindCallId, t;
		let n = 0, r = this._nextBindBaseIndex;
		for (; n < 2;) {
			r >= this._maxBindings && (r = this._minBaseLocation, n++);
			let e = this._boundBufferBases[r];
			if (e && e._lastBindCallId === this._bindCallId) {
				r++;
				continue;
			}
			break;
		}
		return t = r, this._nextBindBaseIndex = r + 1, n >= 2 ? -1 : (e._lastBindCallId = this._bindCallId, this._boundBufferBases[t] = null, t);
	}
	getLastBindBaseLocation(e) {
		let t = e._lastBindBaseLocation;
		return this._boundBufferBases[t] === e ? t : -1;
	}
	bindBufferRange(e, t, n, r) {
		let { _gl: i } = this;
		n ||= 0, t ||= 0, this._boundBufferBases[t] = null, i.bindBufferRange(i.UNIFORM_BUFFER, t || 0, e.buffer, n * 256, r || 256);
	}
	updateBuffer(e) {
		let { _gl: t } = this, n = this.getGlBuffer(e);
		if (e._updateID === n.updateID) return n;
		n.updateID = e._updateID, t.bindBuffer(n.type, n.buffer);
		let r = e.data, i = e.descriptor.usage & Q.STATIC ? t.STATIC_DRAW : t.DYNAMIC_DRAW;
		return r ? n.byteLength >= r.byteLength ? t.bufferSubData(n.type, 0, r, 0, e._updateSize / r.BYTES_PER_ELEMENT) : (n.byteLength = r.byteLength, t.bufferData(n.type, r, i)) : (n.byteLength = e.descriptor.size, t.bufferData(n.type, n.byteLength, i)), n;
	}
	destroyAll(e = !1) {
		this._managedBuffers.removeAll(e);
	}
	onBufferUnload(e, t = !1) {
		let n = e._gpuData[this._renderer.uid];
		n && (t || this._gl.deleteBuffer(n.buffer));
	}
	createGLBuffer(e) {
		let { _gl: t } = this, n = oC.ARRAY_BUFFER;
		e.descriptor.usage & Q.INDEX ? n = oC.ELEMENT_ARRAY_BUFFER : e.descriptor.usage & Q.UNIFORM && (n = oC.UNIFORM_BUFFER);
		let r = new sC(t.createBuffer(), n);
		return e._gpuData[this._renderer.uid] = r, this._managedBuffers.add(e), r;
	}
	resetState() {
		this._boundBufferBases = Object.create(null);
	}
};
cC.extension = {
	type: [h.WebGLSystem],
	name: "buffer"
};
var lC = Object.defineProperty, uC = Object.defineProperties, dC = Object.getOwnPropertyDescriptors, fC = Object.getOwnPropertySymbols, pC = Object.prototype.hasOwnProperty, mC = Object.prototype.propertyIsEnumerable, hC = (e, t, n) => t in e ? lC(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, gC = (e, t) => {
	for (var n in t ||= {}) pC.call(t, n) && hC(e, n, t[n]);
	if (fC) for (var n of fC(t)) mC.call(t, n) && hC(e, n, t[n]);
	return e;
}, _C = (e, t) => uC(e, dC(t)), vC = class e {
	constructor(e) {
		this.supports = {
			uint32Indices: !0,
			uniformBufferObject: !0,
			vertexArrayObject: !0,
			srgbTextures: !0,
			nonPowOf2wrapping: !0,
			msaa: !0,
			nonPowOf2mipmaps: !0
		}, this._renderer = e, this.extensions = Object.create(null), this.handleContextLost = this.handleContextLost.bind(this), this.handleContextRestored = this.handleContextRestored.bind(this);
	}
	get isLost() {
		return !this.gl || this.gl.isContextLost();
	}
	contextChange(e) {
		this.gl = e, this._renderer.gl = e;
	}
	init(t) {
		t = gC(gC({}, e.defaultOptions), t);
		let n = this.multiView = t.multiView;
		if (t.context && n && (vf("Renderer created with both a context and multiview enabled. Disabling multiView as both cannot work together."), n = !1), this.canvas = n ? X.get().createCanvas(this._renderer.canvas.width, this._renderer.canvas.height) : this._renderer.view.canvas, t.context) this.initFromContext(t.context);
		else {
			let e = this._renderer.background.alpha < 1, n = t.premultipliedAlpha ?? !0, r = t.antialias && !this._renderer.backBuffer.useBackBuffer;
			this.createContext(t.preferWebGLVersion, {
				alpha: e,
				premultipliedAlpha: n,
				antialias: r,
				stencil: !0,
				preserveDrawingBuffer: t.preserveDrawingBuffer,
				powerPreference: t.powerPreference ?? "default"
			});
		}
	}
	ensureCanvasSize(e) {
		if (!this.multiView) {
			e !== this.canvas && vf("multiView is disabled, but targetCanvas is not the main canvas");
			return;
		}
		let { canvas: t } = this;
		(t.width < e.width || t.height < e.height) && (t.width = Math.max(e.width, e.width), t.height = Math.max(e.height, e.height));
	}
	initFromContext(e) {
		this.gl = e, this.webGLVersion = e instanceof X.get().getWebGLRenderingContext() ? 1 : 2, this.getExtensions(), this.validateContext(e), this._renderer.runners.contextChange.emit(e);
		let t = this._renderer.view.canvas;
		t.addEventListener("webglcontextlost", this.handleContextLost, !1), t.addEventListener("webglcontextrestored", this.handleContextRestored, !1);
	}
	createContext(e, t) {
		let n, r = this.canvas;
		if (e === 2 && (n = r.getContext("webgl2", t)), !n && (n = r.getContext("webgl", t), !n)) throw Error("This browser does not support WebGL. Try using the canvas renderer");
		this.gl = n, this.initFromContext(this.gl);
	}
	getExtensions() {
		let { gl: e } = this, t = {
			anisotropicFiltering: e.getExtension("EXT_texture_filter_anisotropic"),
			floatTextureLinear: e.getExtension("OES_texture_float_linear"),
			s3tc: e.getExtension("WEBGL_compressed_texture_s3tc"),
			s3tc_sRGB: e.getExtension("WEBGL_compressed_texture_s3tc_srgb"),
			etc: e.getExtension("WEBGL_compressed_texture_etc"),
			etc1: e.getExtension("WEBGL_compressed_texture_etc1"),
			pvrtc: e.getExtension("WEBGL_compressed_texture_pvrtc") || e.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc"),
			atc: e.getExtension("WEBGL_compressed_texture_atc"),
			astc: e.getExtension("WEBGL_compressed_texture_astc"),
			bptc: e.getExtension("EXT_texture_compression_bptc"),
			rgtc: e.getExtension("EXT_texture_compression_rgtc"),
			loseContext: e.getExtension("WEBGL_lose_context")
		};
		if (this.webGLVersion === 1) this.extensions = _C(gC({}, t), {
			drawBuffers: e.getExtension("WEBGL_draw_buffers"),
			depthTexture: e.getExtension("WEBGL_depth_texture"),
			vertexArrayObject: e.getExtension("OES_vertex_array_object") || e.getExtension("MOZ_OES_vertex_array_object") || e.getExtension("WEBKIT_OES_vertex_array_object"),
			uint32ElementIndex: e.getExtension("OES_element_index_uint"),
			floatTexture: e.getExtension("OES_texture_float"),
			floatTextureLinear: e.getExtension("OES_texture_float_linear"),
			textureHalfFloat: e.getExtension("OES_texture_half_float"),
			textureHalfFloatLinear: e.getExtension("OES_texture_half_float_linear"),
			vertexAttribDivisorANGLE: e.getExtension("ANGLE_instanced_arrays"),
			srgb: e.getExtension("EXT_sRGB")
		});
		else {
			this.extensions = _C(gC({}, t), { colorBufferFloat: e.getExtension("EXT_color_buffer_float") });
			let n = e.getExtension("WEBGL_provoking_vertex");
			n && n.provokingVertexWEBGL(n.FIRST_VERTEX_CONVENTION_WEBGL);
		}
	}
	handleContextLost(e) {
		e.preventDefault(), this._contextLossForced && (this._contextLossForced = !1, setTimeout(() => {
			var e;
			this.gl.isContextLost() && ((e = this.extensions.loseContext) == null || e.restoreContext());
		}, 0));
	}
	handleContextRestored() {
		this.getExtensions(), this._renderer.runners.contextChange.emit(this.gl);
	}
	destroy() {
		var e;
		let t = this._renderer.view.canvas;
		this._renderer = null, t.removeEventListener("webglcontextlost", this.handleContextLost), t.removeEventListener("webglcontextrestored", this.handleContextRestored), this.gl.useProgram(null), (e = this.extensions.loseContext) == null || e.loseContext();
	}
	forceContextLoss() {
		var e;
		(e = this.extensions.loseContext) == null || e.loseContext(), this._contextLossForced = !0;
	}
	validateContext(e) {
		let t = e.getContextAttributes();
		t && t.stencil;
		let n = this.supports, r = this.webGLVersion === 2, i = this.extensions;
		n.uint32Indices = r || !!i.uint32ElementIndex, n.uniformBufferObject = r, n.vertexArrayObject = r || !!i.vertexArrayObject, n.srgbTextures = r || !!i.srgb, n.nonPowOf2wrapping = r, n.nonPowOf2mipmaps = r, n.msaa = r, n.uint32Indices;
	}
};
vC.extension = {
	type: [h.WebGLSystem],
	name: "context"
}, vC.defaultOptions = {
	context: null,
	premultipliedAlpha: !0,
	preserveDrawingBuffer: !1,
	powerPreference: void 0,
	preferWebGLVersion: 2,
	multiView: !1
};
var yC = vC;
function bC(e, t) {
	for (let n in e.attributes) {
		let r = e.attributes[n], i = t[n];
		i ? (r.format ??= i.format, r.offset ??= i.offset, r.instance ??= i.instance) : vf(`Attribute ${n} is not present in the shader, but is present in the geometry. Unable to infer attribute details.`);
	}
	xC(e);
}
function xC(e) {
	let { buffers: t, attributes: n } = e, r = {}, i = {};
	for (let e in t) {
		let n = t[e];
		r[n.uid] = 0, i[n.uid] = 0;
	}
	for (let e in n) {
		let t = n[e];
		r[t.buffer.uid] += Na(t.format).stride;
	}
	for (let e in n) {
		let t = n[e];
		t.stride ??= r[t.buffer.uid], t.start ??= i[t.buffer.uid], i[t.buffer.uid] += Na(t.format).stride;
	}
}
var SC = ((e) => (e[e.RGBA = 6408] = "RGBA", e[e.RGB = 6407] = "RGB", e[e.RG = 33319] = "RG", e[e.RED = 6403] = "RED", e[e.RGBA_INTEGER = 36249] = "RGBA_INTEGER", e[e.RGB_INTEGER = 36248] = "RGB_INTEGER", e[e.RG_INTEGER = 33320] = "RG_INTEGER", e[e.RED_INTEGER = 36244] = "RED_INTEGER", e[e.ALPHA = 6406] = "ALPHA", e[e.LUMINANCE = 6409] = "LUMINANCE", e[e.LUMINANCE_ALPHA = 6410] = "LUMINANCE_ALPHA", e[e.DEPTH_COMPONENT = 6402] = "DEPTH_COMPONENT", e[e.DEPTH_STENCIL = 34041] = "DEPTH_STENCIL", e))(SC || {}), CC = ((e) => (e[e.TEXTURE_2D = 3553] = "TEXTURE_2D", e[e.TEXTURE_CUBE_MAP = 34067] = "TEXTURE_CUBE_MAP", e[e.TEXTURE_2D_ARRAY = 35866] = "TEXTURE_2D_ARRAY", e[e.TEXTURE_CUBE_MAP_POSITIVE_X = 34069] = "TEXTURE_CUBE_MAP_POSITIVE_X", e[e.TEXTURE_CUBE_MAP_NEGATIVE_X = 34070] = "TEXTURE_CUBE_MAP_NEGATIVE_X", e[e.TEXTURE_CUBE_MAP_POSITIVE_Y = 34071] = "TEXTURE_CUBE_MAP_POSITIVE_Y", e[e.TEXTURE_CUBE_MAP_NEGATIVE_Y = 34072] = "TEXTURE_CUBE_MAP_NEGATIVE_Y", e[e.TEXTURE_CUBE_MAP_POSITIVE_Z = 34073] = "TEXTURE_CUBE_MAP_POSITIVE_Z", e[e.TEXTURE_CUBE_MAP_NEGATIVE_Z = 34074] = "TEXTURE_CUBE_MAP_NEGATIVE_Z", e))(CC || {}), wC = ((e) => (e[e.CLAMP = 33071] = "CLAMP", e[e.REPEAT = 10497] = "REPEAT", e[e.MIRRORED_REPEAT = 33648] = "MIRRORED_REPEAT", e))(wC || {}), TC = ((e) => (e[e.UNSIGNED_BYTE = 5121] = "UNSIGNED_BYTE", e[e.UNSIGNED_SHORT = 5123] = "UNSIGNED_SHORT", e[e.UNSIGNED_SHORT_5_6_5 = 33635] = "UNSIGNED_SHORT_5_6_5", e[e.UNSIGNED_SHORT_4_4_4_4 = 32819] = "UNSIGNED_SHORT_4_4_4_4", e[e.UNSIGNED_SHORT_5_5_5_1 = 32820] = "UNSIGNED_SHORT_5_5_5_1", e[e.UNSIGNED_INT = 5125] = "UNSIGNED_INT", e[e.UNSIGNED_INT_10F_11F_11F_REV = 35899] = "UNSIGNED_INT_10F_11F_11F_REV", e[e.UNSIGNED_INT_2_10_10_10_REV = 33640] = "UNSIGNED_INT_2_10_10_10_REV", e[e.UNSIGNED_INT_24_8 = 34042] = "UNSIGNED_INT_24_8", e[e.UNSIGNED_INT_5_9_9_9_REV = 35902] = "UNSIGNED_INT_5_9_9_9_REV", e[e.BYTE = 5120] = "BYTE", e[e.SHORT = 5122] = "SHORT", e[e.INT = 5124] = "INT", e[e.FLOAT = 5126] = "FLOAT", e[e.FLOAT_32_UNSIGNED_INT_24_8_REV = 36269] = "FLOAT_32_UNSIGNED_INT_24_8_REV", e[e.HALF_FLOAT = 36193] = "HALF_FLOAT", e))(TC || {}), EC = {
	uint8x2: TC.UNSIGNED_BYTE,
	uint8x4: TC.UNSIGNED_BYTE,
	sint8x2: TC.BYTE,
	sint8x4: TC.BYTE,
	unorm8x2: TC.UNSIGNED_BYTE,
	unorm8x4: TC.UNSIGNED_BYTE,
	snorm8x2: TC.BYTE,
	snorm8x4: TC.BYTE,
	uint16x2: TC.UNSIGNED_SHORT,
	uint16x4: TC.UNSIGNED_SHORT,
	sint16x2: TC.SHORT,
	sint16x4: TC.SHORT,
	unorm16x2: TC.UNSIGNED_SHORT,
	unorm16x4: TC.UNSIGNED_SHORT,
	snorm16x2: TC.SHORT,
	snorm16x4: TC.SHORT,
	float16x2: TC.HALF_FLOAT,
	float16x4: TC.HALF_FLOAT,
	float32: TC.FLOAT,
	float32x2: TC.FLOAT,
	float32x3: TC.FLOAT,
	float32x4: TC.FLOAT,
	uint32: TC.UNSIGNED_INT,
	uint32x2: TC.UNSIGNED_INT,
	uint32x3: TC.UNSIGNED_INT,
	uint32x4: TC.UNSIGNED_INT,
	sint32: TC.INT,
	sint32x2: TC.INT,
	sint32x3: TC.INT,
	sint32x4: TC.INT
};
function DC(e) {
	return EC[e] ?? EC.float32;
}
var OC = {
	"point-list": 0,
	"line-list": 1,
	"line-strip": 3,
	"triangle-list": 4,
	"triangle-strip": 5
}, kC = class {
	constructor() {
		this.vaoCache = Object.create(null);
	}
	destroy() {
		this.vaoCache = Object.create(null);
	}
}, AC = class {
	constructor(e) {
		this._renderer = e, this._activeGeometry = null, this._activeVao = null, this.hasVao = !0, this.hasInstance = !0, this._managedGeometries = new Bu({
			renderer: e,
			type: "resource",
			onUnload: this.onGeometryUnload.bind(this),
			name: "glGeometry"
		});
	}
	contextChange() {
		let e = this.gl = this._renderer.gl;
		if (!this._renderer.context.supports.vertexArrayObject) throw Error("[PixiJS] Vertex Array Objects are not supported on this device");
		this.destroyAll(!0);
		let t = this._renderer.context.extensions.vertexArrayObject;
		t && (e.createVertexArray = () => t.createVertexArrayOES(), e.bindVertexArray = (e) => t.bindVertexArrayOES(e), e.deleteVertexArray = (e) => t.deleteVertexArrayOES(e));
		let n = this._renderer.context.extensions.vertexAttribDivisorANGLE;
		n && (e.drawArraysInstanced = (e, t, r, i) => {
			n.drawArraysInstancedANGLE(e, t, r, i);
		}, e.drawElementsInstanced = (e, t, r, i, a) => {
			n.drawElementsInstancedANGLE(e, t, r, i, a);
		}, e.vertexAttribDivisor = (e, t) => n.vertexAttribDivisorANGLE(e, t)), this._activeGeometry = null, this._activeVao = null;
	}
	bind(e, t) {
		let n = this.gl;
		this._activeGeometry = e;
		let r = this.getVao(e, t);
		this._activeVao !== r && (this._activeVao = r, n.bindVertexArray(r)), this.updateBuffers();
	}
	resetState() {
		this.unbind();
	}
	updateBuffers() {
		let e = this._activeGeometry, t = this._renderer.buffer;
		for (let n = 0; n < e.buffers.length; n++) {
			let r = e.buffers[n];
			t.updateBuffer(r);
		}
		e._gcLastUsed = this._renderer.gc.now;
	}
	checkCompatibility(e, t) {
		let n = e.attributes, r = t._attributeData;
		for (let e in r) if (!n[e]) throw Error(`shader and geometry incompatible, geometry missing the "${e}" attribute`);
	}
	getSignature(e, t) {
		let n = e.attributes, r = t._attributeData, i = ["g", e.uid];
		for (let e in n) r[e] && i.push(e, r[e].location);
		return i.join("-");
	}
	getVao(e, t) {
		return e._gpuData[this._renderer.uid]?.vaoCache[t._key] || this.initGeometryVao(e, t);
	}
	initGeometryVao(e, t, n = !0) {
		let r = this._renderer.gl, i = this._renderer.buffer;
		this._renderer.shader._getProgramData(t), this.checkCompatibility(e, t);
		let a = this.getSignature(e, t), o = e._gpuData[this._renderer.uid];
		o || (o = new kC(), e._gpuData[this._renderer.uid] = o, this._managedGeometries.add(e));
		let s = o.vaoCache, c = s[a];
		if (c) return s[t._key] = c, c;
		bC(e, t._attributeData);
		let l = e.buffers;
		c = r.createVertexArray(), r.bindVertexArray(c);
		for (let e = 0; e < l.length; e++) {
			let t = l[e];
			i.bind(t);
		}
		return this.activateVao(e, t), s[t._key] = c, s[a] = c, r.bindVertexArray(null), c;
	}
	onGeometryUnload(e, t = !1) {
		let n = e._gpuData[this._renderer.uid];
		if (!n) return;
		let r = n.vaoCache;
		if (!t) for (let e in r) this._activeVao !== r[e] && this.resetState(), this.gl.deleteVertexArray(r[e]);
	}
	destroyAll(e = !1) {
		this._managedGeometries.removeAll(e);
	}
	activateVao(e, t) {
		let n = this._renderer.gl, r = this._renderer.buffer, i = e.attributes;
		e.indexBuffer && r.bind(e.indexBuffer);
		let a = null;
		for (let e in i) {
			let o = i[e], s = o.buffer, c = r.getGlBuffer(s), l = t._attributeData[e];
			if (l) {
				a !== c && (r.bind(s), a = c);
				let e = l.location;
				n.enableVertexAttribArray(e);
				let t = Na(o.format), i = DC(o.format);
				if (l.format?.substring(1, 4) === "int" ? n.vertexAttribIPointer(e, t.size, i, o.stride, o.offset) : n.vertexAttribPointer(e, t.size, i, t.normalised, o.stride, o.offset), o.instance) {
					if (this.hasInstance) {
						let t = o.divisor ?? 1;
						n.vertexAttribDivisor(e, t);
					} else throw Error("geometry error, GPU Instancing is not supported on this device");
				}
			}
		}
	}
	draw(e, t, n, r) {
		let { gl: i } = this._renderer, a = this._activeGeometry, o = OC[e || a.topology];
		if (r ??= a.instanceCount, a.indexBuffer) {
			let e = a.indexBuffer.data.BYTES_PER_ELEMENT, s = e === 2 ? i.UNSIGNED_SHORT : i.UNSIGNED_INT;
			r === 1 ? i.drawElements(o, t || a.indexBuffer.data.length, s, (n || 0) * e) : i.drawElementsInstanced(o, t || a.indexBuffer.data.length, s, (n || 0) * e, r);
		} else r === 1 ? i.drawArrays(o, n || 0, t || a.getSize()) : i.drawArraysInstanced(o, n || 0, t || a.getSize(), r);
		return this;
	}
	unbind() {
		this.gl.bindVertexArray(null), this._activeVao = null, this._activeGeometry = null;
	}
	destroy() {
		this._managedGeometries.destroy(), this._renderer = null, this.gl = null, this._activeVao = null, this._activeGeometry = null;
	}
};
AC.extension = {
	type: [h.WebGLSystem],
	name: "geometry"
};
var jC = Object.defineProperty, MC = Object.getOwnPropertySymbols, NC = Object.prototype.hasOwnProperty, PC = Object.prototype.propertyIsEnumerable, FC = (e, t, n) => t in e ? jC(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, IC = (e, t) => {
	for (var n in t ||= {}) NC.call(t, n) && FC(e, n, t[n]);
	if (MC) for (var n of MC(t)) PC.call(t, n) && FC(e, n, t[n]);
	return e;
}, LC = new Po({ attributes: { aPosition: [
	-1,
	-1,
	3,
	-1,
	-1,
	3
] } }), RC = class e {
	constructor(e) {
		this.useBackBuffer = !1, this._useBackBufferThisRender = !1, this._renderer = e;
	}
	init(t = {}) {
		let { useBackBuffer: n, antialias: r } = IC(IC({}, e.defaultOptions), t);
		this.useBackBuffer = n, this._antialias = r, this._renderer.context.supports.msaa || (vf("antialiasing, is not supported on when using the back buffer"), this._antialias = !1), this._state = go.for2d();
		let i = new ja({
			vertex: "\n                attribute vec2 aPosition;\n                out vec2 vUv;\n\n                void main() {\n                    gl_Position = vec4(aPosition, 0.0, 1.0);\n\n                    vUv = (aPosition + 1.0) / 2.0;\n\n                    // flip dem UVs\n                    vUv.y = 1.0 - vUv.y;\n                }",
			fragment: "\n                in vec2 vUv;\n                out vec4 finalColor;\n\n                uniform sampler2D uTexture;\n\n                void main() {\n                    finalColor = texture(uTexture, vUv);\n                }",
			name: "big-triangle"
		});
		this._bigTriangleShader = new po({
			glProgram: i,
			resources: { uTexture: J.WHITE.source }
		});
	}
	renderStart(e) {
		let t = this._renderer.renderTarget.getRenderTarget(e.target);
		if (this._useBackBufferThisRender = this.useBackBuffer && !!t.isRoot, this._useBackBufferThisRender) {
			let t = this._renderer.renderTarget.getRenderTarget(e.target);
			this._targetTexture = t.colorTexture, e.target = this._getBackBufferTexture(t.colorTexture);
		}
	}
	renderEnd() {
		this._presentBackBuffer();
	}
	_presentBackBuffer() {
		let e = this._renderer;
		e.renderTarget.finishRenderPass(), this._useBackBufferThisRender && (e.renderTarget.bind(this._targetTexture, !1), this._bigTriangleShader.resources.uTexture = this._backBufferTexture.source, e.encoder.draw({
			geometry: LC,
			shader: this._bigTriangleShader,
			state: this._state
		}));
	}
	_getBackBufferTexture(e) {
		return this._backBufferTexture = this._backBufferTexture || new J({ source: new It({
			width: e.width,
			height: e.height,
			resolution: e._resolution,
			antialias: this._antialias
		}) }), this._backBufferTexture.source.resize(e.width, e.height, e._resolution), this._backBufferTexture;
	}
	destroy() {
		this._backBufferTexture &&= (this._backBufferTexture.destroy(), null);
	}
};
RC.extension = {
	type: [h.WebGLSystem],
	name: "backBuffer",
	priority: 1
}, RC.defaultOptions = { useBackBuffer: !1 };
var zC = RC, BC = class {
	constructor(e) {
		this._colorMaskCache = 15, this._renderer = e;
	}
	setMask(e) {
		this._colorMaskCache !== e && (this._colorMaskCache = e, this._renderer.gl.colorMask(!!(e & 8), !!(e & 4), !!(e & 2), !!(e & 1)));
	}
};
BC.extension = {
	type: [h.WebGLSystem],
	name: "colorMask"
};
var VC = class {
	constructor(e) {
		this.commandFinished = Promise.resolve(), this._renderer = e;
	}
	setGeometry(e, t) {
		this._renderer.geometry.bind(e, t.glProgram);
	}
	finishRenderPass() {}
	draw(e) {
		let t = this._renderer, { geometry: n, shader: r, state: i, skipSync: a, topology: o, size: s, start: c, instanceCount: l } = e;
		t.shader.bind(r, a), t.geometry.bind(n, t.shader._activeProgram), i && t.state.set(i), t.geometry.draw(o, s, c, l ?? n.instanceCount);
	}
	destroy() {
		this._renderer = null;
	}
};
VC.extension = {
	type: [h.WebGLSystem],
	name: "encoder"
};
var HC = class {
	constructor(e) {
		this._renderer = e;
	}
	contextChange() {
		let e = this._renderer.gl;
		this.maxTextures = e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS), this.maxBatchableTextures = wl(this.maxTextures, e);
		let t = this._renderer.context.webGLVersion === 2;
		this.maxUniformBindings = t ? e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS) : 0;
	}
	destroy() {}
};
HC.extension = {
	type: [h.WebGLSystem],
	name: "limits"
};
var UC = class {
	constructor() {
		this.width = -1, this.height = -1, this.msaa = !1, this._attachedMipLevel = 0, this._attachedLayer = 0, this.msaaRenderBuffer = [];
	}
}, WC = [];
WC[bl.NONE] = void 0, WC[bl.DISABLED] = {
	stencilWriteMask: 0,
	stencilReadMask: 0
}, WC[bl.RENDERING_MASK_ADD] = {
	stencilFront: {
		compare: "equal",
		passOp: "increment-clamp"
	},
	stencilBack: {
		compare: "equal",
		passOp: "increment-clamp"
	}
}, WC[bl.RENDERING_MASK_REMOVE] = {
	stencilFront: {
		compare: "equal",
		passOp: "decrement-clamp"
	},
	stencilBack: {
		compare: "equal",
		passOp: "decrement-clamp"
	}
}, WC[bl.MASK_ACTIVE] = {
	stencilWriteMask: 0,
	stencilFront: {
		compare: "equal",
		passOp: "keep"
	},
	stencilBack: {
		compare: "equal",
		passOp: "keep"
	}
}, WC[bl.INVERSE_MASK_ACTIVE] = {
	stencilWriteMask: 0,
	stencilFront: {
		compare: "not-equal",
		passOp: "keep"
	},
	stencilBack: {
		compare: "not-equal",
		passOp: "keep"
	}
};
var GC = class {
	constructor(e) {
		this._stencilCache = {
			enabled: !1,
			stencilReference: 0,
			stencilMode: bl.NONE
		}, this._renderTargetStencilState = Object.create(null), e.renderTarget.onRenderTargetChange.add(this);
	}
	contextChange(e) {
		this._gl = e, this._comparisonFuncMapping = {
			always: e.ALWAYS,
			never: e.NEVER,
			equal: e.EQUAL,
			"not-equal": e.NOTEQUAL,
			less: e.LESS,
			"less-equal": e.LEQUAL,
			greater: e.GREATER,
			"greater-equal": e.GEQUAL
		}, this._stencilOpsMapping = {
			keep: e.KEEP,
			zero: e.ZERO,
			replace: e.REPLACE,
			invert: e.INVERT,
			"increment-clamp": e.INCR,
			"decrement-clamp": e.DECR,
			"increment-wrap": e.INCR_WRAP,
			"decrement-wrap": e.DECR_WRAP
		}, this.resetState();
	}
	onRenderTargetChange(e) {
		if (this._activeRenderTarget === e) return;
		this._activeRenderTarget = e;
		let t = this._renderTargetStencilState[e.uid];
		t ||= this._renderTargetStencilState[e.uid] = {
			stencilMode: bl.DISABLED,
			stencilReference: 0
		}, this.setStencilMode(t.stencilMode, t.stencilReference);
	}
	resetState() {
		this._stencilCache.enabled = !1, this._stencilCache.stencilMode = bl.NONE, this._stencilCache.stencilReference = 0;
	}
	setStencilMode(e, t) {
		let n = this._renderTargetStencilState[this._activeRenderTarget.uid], r = this._gl, i = WC[e], a = this._stencilCache;
		if (n.stencilMode = e, n.stencilReference = t, e === bl.DISABLED) {
			this._stencilCache.enabled && (this._stencilCache.enabled = !1, r.disable(r.STENCIL_TEST));
			return;
		}
		this._stencilCache.enabled || (this._stencilCache.enabled = !0, r.enable(r.STENCIL_TEST)), (e !== a.stencilMode || a.stencilReference !== t) && (a.stencilMode = e, a.stencilReference = t, r.stencilFunc(this._comparisonFuncMapping[i.stencilBack.compare], t, 255), r.stencilOp(r.KEEP, r.KEEP, this._stencilOpsMapping[i.stencilBack.passOp]));
	}
};
GC.extension = {
	type: [h.WebGLSystem],
	name: "stencil"
};
var KC = class {
	constructor(e) {
		this._syncFunctionHash = Object.create(null), this._adaptor = e, this._systemCheck();
	}
	_systemCheck() {
		if (!Vo()) throw Error("Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.");
	}
	ensureUniformGroup(e) {
		let t = this.getUniformGroupData(e);
		e.buffer ||= new Ao({
			data: new Float32Array(t.layout.size / 4),
			usage: Q.UNIFORM | Q.COPY_DST
		});
	}
	getUniformGroupData(e) {
		return this._syncFunctionHash[e._signature] || this._initUniformGroup(e);
	}
	_initUniformGroup(e) {
		let t = e._signature, n = this._syncFunctionHash[t];
		if (!n) {
			let r = Object.keys(e.uniformStructures).map((t) => e.uniformStructures[t]), i = this._adaptor.createUboElements(r), a = this._generateUboSync(i.uboElements);
			n = this._syncFunctionHash[t] = {
				layout: i,
				syncFunction: a
			};
		}
		return this._syncFunctionHash[t];
	}
	_generateUboSync(e) {
		return this._adaptor.generateUboSync(e);
	}
	syncUniformGroup(e, t, n) {
		let r = this.getUniformGroupData(e);
		e.buffer ||= new Ao({
			data: new Float32Array(r.layout.size / 4),
			usage: Q.UNIFORM | Q.COPY_DST
		});
		let i = null;
		return t || (t = e.buffer.data, i = e.buffer.dataInt32), n ||= 0, r.syncFunction(e.uniforms, t, i, n), !0;
	}
	updateUniformGroup(e) {
		if (e.isStatic && !e._dirtyId) return !1;
		e._dirtyId = 0;
		let t = this.syncUniformGroup(e);
		return e.buffer.update(), t;
	}
	destroy() {
		this._syncFunctionHash = null;
	}
}, qC = {
	f32: 4,
	i32: 4,
	"vec2<f32>": 8,
	"vec3<f32>": 12,
	"vec4<f32>": 16,
	"vec2<i32>": 8,
	"vec3<i32>": 12,
	"vec4<i32>": 16,
	"mat2x2<f32>": 32,
	"mat3x3<f32>": 48,
	"mat4x4<f32>": 64
};
function JC(e) {
	let t = e.map((e) => ({
		data: e,
		offset: 0,
		size: 0
	})), n = 0, r = 0;
	for (let e = 0; e < t.length; e++) {
		let i = t[e];
		if (n = qC[i.data.type], !n) throw Error(`Unknown type ${i.data.type}`);
		i.data.size > 1 && (n = Math.max(n, 16) * i.data.size);
		let a = n === 12 ? 16 : n;
		i.size = n;
		let o = r % 16;
		o > 0 && 16 - o < a ? r += (16 - o) % 16 : r += (n - o % n) % n, i.offset = r, r += n;
	}
	return r = Math.ceil(r / 16) * 16, {
		uboElements: t,
		size: r
	};
}
var YC = [
	{
		type: "mat3x3<f32>",
		test: (e) => e.value.a !== void 0,
		ubo: "\n            var matrix = uv[name].toArray(true);\n            data[offset] = matrix[0];\n            data[offset + 1] = matrix[1];\n            data[offset + 2] = matrix[2];\n            data[offset + 4] = matrix[3];\n            data[offset + 5] = matrix[4];\n            data[offset + 6] = matrix[5];\n            data[offset + 8] = matrix[6];\n            data[offset + 9] = matrix[7];\n            data[offset + 10] = matrix[8];\n        ",
		uniform: "\n            gl.uniformMatrix3fv(ud[name].location, false, uv[name].toArray(true));\n        "
	},
	{
		type: "vec4<f32>",
		test: (e) => e.type === "vec4<f32>" && e.size === 1 && e.value.width !== void 0,
		ubo: "\n            v = uv[name];\n            data[offset] = v.x;\n            data[offset + 1] = v.y;\n            data[offset + 2] = v.width;\n            data[offset + 3] = v.height;\n        ",
		uniform: "\n            cv = ud[name].value;\n            v = uv[name];\n            if (cv[0] !== v.x || cv[1] !== v.y || cv[2] !== v.width || cv[3] !== v.height) {\n                cv[0] = v.x;\n                cv[1] = v.y;\n                cv[2] = v.width;\n                cv[3] = v.height;\n                gl.uniform4f(ud[name].location, v.x, v.y, v.width, v.height);\n            }\n        "
	},
	{
		type: "vec2<f32>",
		test: (e) => e.type === "vec2<f32>" && e.size === 1 && e.value.x !== void 0,
		ubo: "\n            v = uv[name];\n            data[offset] = v.x;\n            data[offset + 1] = v.y;\n        ",
		uniform: "\n            cv = ud[name].value;\n            v = uv[name];\n            if (cv[0] !== v.x || cv[1] !== v.y) {\n                cv[0] = v.x;\n                cv[1] = v.y;\n                gl.uniform2f(ud[name].location, v.x, v.y);\n            }\n        "
	},
	{
		type: "vec4<f32>",
		test: (e) => e.type === "vec4<f32>" && e.size === 1 && e.value.red !== void 0,
		ubo: "\n            v = uv[name];\n            data[offset] = v.red;\n            data[offset + 1] = v.green;\n            data[offset + 2] = v.blue;\n            data[offset + 3] = v.alpha;\n        ",
		uniform: "\n            cv = ud[name].value;\n            v = uv[name];\n            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue || cv[3] !== v.alpha) {\n                cv[0] = v.red;\n                cv[1] = v.green;\n                cv[2] = v.blue;\n                cv[3] = v.alpha;\n                gl.uniform4f(ud[name].location, v.red, v.green, v.blue, v.alpha);\n            }\n        "
	},
	{
		type: "vec3<f32>",
		test: (e) => e.type === "vec3<f32>" && e.size === 1 && e.value.red !== void 0,
		ubo: "\n            v = uv[name];\n            data[offset] = v.red;\n            data[offset + 1] = v.green;\n            data[offset + 2] = v.blue;\n        ",
		uniform: "\n            cv = ud[name].value;\n            v = uv[name];\n            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue) {\n                cv[0] = v.red;\n                cv[1] = v.green;\n                cv[2] = v.blue;\n                gl.uniform3f(ud[name].location, v.red, v.green, v.blue);\n            }\n        "
	}
];
function XC(e, t, n, r) {
	let i = ["\n        var v = null;\n        var v2 = null;\n        var t = 0;\n        var index = 0;\n        var name = null;\n        var arrayOffset = null;\n    "], a = 0;
	for (let o = 0; o < e.length; o++) {
		let s = e[o], c = s.data.name, l = !1, u = 0;
		for (let e = 0; e < YC.length; e++) if (YC[e].test(s.data)) {
			u = s.offset / 4, i.push(`name = "${c}";`, `offset += ${u - a};`, YC[e][t] || YC[e].ubo), l = !0;
			break;
		}
		if (!l) {
			if (s.data.size > 1) u = s.offset / 4, i.push(n(s, u - a));
			else {
				let e = r[s.data.type];
				u = s.offset / 4, i.push(`
                    v = uv.${c};
                    offset += ${u - a};
                    ${e};
                `);
			}
		}
		a = u;
	}
	let o = i.join("\n");
	return Function("uv", "data", "dataInt32", "offset", o);
}
var ZC = Object.defineProperty, QC = Object.defineProperties, $C = Object.getOwnPropertyDescriptors, ew = Object.getOwnPropertySymbols, tw = Object.prototype.hasOwnProperty, nw = Object.prototype.propertyIsEnumerable, rw = (e, t, n) => t in e ? ZC(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, iw = (e, t) => {
	for (var n in t ||= {}) tw.call(t, n) && rw(e, n, t[n]);
	if (ew) for (var n of ew(t)) nw.call(t, n) && rw(e, n, t[n]);
	return e;
}, aw = (e, t) => QC(e, $C(t));
function ow(e, t) {
	return `
        for (let i = 0; i < ${e * t}; i++) {
            data[offset + (((i / ${e})|0) * 4) + (i % ${e})] = v[i];
        }
    `;
}
var sw = {
	f32: "\n        data[offset] = v;",
	i32: "\n        dataInt32[offset] = v;",
	"vec2<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];",
	"vec3<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 2] = v[2];",
	"vec4<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 2] = v[2];\n        data[offset + 3] = v[3];",
	"vec2<i32>": "\n        dataInt32[offset] = v[0];\n        dataInt32[offset + 1] = v[1];",
	"vec3<i32>": "\n        dataInt32[offset] = v[0];\n        dataInt32[offset + 1] = v[1];\n        dataInt32[offset + 2] = v[2];",
	"vec4<i32>": "\n        dataInt32[offset] = v[0];\n        dataInt32[offset + 1] = v[1];\n        dataInt32[offset + 2] = v[2];\n        dataInt32[offset + 3] = v[3];",
	"mat2x2<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 4] = v[2];\n        data[offset + 5] = v[3];",
	"mat3x3<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 2] = v[2];\n        data[offset + 4] = v[3];\n        data[offset + 5] = v[4];\n        data[offset + 6] = v[5];\n        data[offset + 8] = v[6];\n        data[offset + 9] = v[7];\n        data[offset + 10] = v[8];",
	"mat4x4<f32>": "\n        for (let i = 0; i < 16; i++) {\n            data[offset + i] = v[i];\n        }",
	"mat3x2<f32>": ow(3, 2),
	"mat4x2<f32>": ow(4, 2),
	"mat2x3<f32>": ow(2, 3),
	"mat4x3<f32>": ow(4, 3),
	"mat2x4<f32>": ow(2, 4),
	"mat3x4<f32>": ow(3, 4)
}, cw = aw(iw({}, sw), { "mat2x2<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 2] = v[2];\n        data[offset + 3] = v[3];\n    " });
function lw(e, t) {
	let n = Math.max(qC[e.data.type] / 16, 1), r = e.data.value.length / e.data.size, i = (4 - r % 4) % 4, a = e.data.type.indexOf("i32") >= 0 ? "dataInt32" : "data";
	return `
        v = uv.${e.data.name};
        offset += ${t};

        arrayOffset = offset;

        t = 0;

        for(var i=0; i < ${e.data.size * n}; i++)
        {
            for(var j = 0; j < ${r}; j++)
            {
                ${a}[arrayOffset++] = v[t++];
            }
            ${i === 0 ? "" : `arrayOffset += ${i};`}
        }
    `;
}
function uw(e) {
	return XC(e, "uboStd40", lw, sw);
}
var dw = class extends KC {
	constructor() {
		super({
			createUboElements: JC,
			generateUboSync: uw
		});
	}
};
dw.extension = {
	type: [h.WebGLSystem],
	name: "ubo"
};
var fw = class {
	constructor() {
		this._clearColorCache = [
			0,
			0,
			0,
			0
		], this._viewPortCache = new qe();
	}
	init(e, t) {
		this._renderer = e, this._renderTargetSystem = t, e.runners.contextChange.add(this);
	}
	contextChange() {
		this._clearColorCache = [
			0,
			0,
			0,
			0
		], this._viewPortCache = new qe();
		let e = this._renderer.gl;
		this._drawBuffersCache = [];
		for (let t = 1; t <= 16; t++) this._drawBuffersCache[t] = Array.from({ length: t }, (t, n) => e.COLOR_ATTACHMENT0 + n);
	}
	copyToTexture(e, t, n, r, i) {
		let a = this._renderTargetSystem, o = this._renderer, s = a.getGpuRenderTarget(e), c = o.gl;
		return this.finishRenderPass(e), c.bindFramebuffer(c.FRAMEBUFFER, s.resolveTargetFramebuffer), o.texture.bind(t, 0), c.copyTexSubImage2D(c.TEXTURE_2D, 0, i.x, i.y, n.x, n.y, r.width, r.height), t;
	}
	startRenderPass(e, t = !0, n, r, i = 0, a = 0) {
		let o = this._renderTargetSystem, s = e.colorTexture, c = o.getGpuRenderTarget(e);
		if (a !== 0 && this._renderer.context.webGLVersion < 2) throw Error("[RenderTargetSystem] Rendering to array layers requires WebGL2.");
		if (i > 0) {
			if (c.msaa) throw Error("[RenderTargetSystem] Rendering to mip levels is not supported with MSAA render targets.");
			if (this._renderer.context.webGLVersion < 2) throw Error("[RenderTargetSystem] Rendering to mip levels requires WebGL2.");
		}
		let l = r.y;
		e.isRoot && (l = s.pixelHeight - r.height - r.y), e.colorTextures.forEach((e) => {
			this._renderer.texture.unbind(e);
		});
		let u = this._renderer.gl;
		u.bindFramebuffer(u.FRAMEBUFFER, c.framebuffer), !e.isRoot && (c._attachedMipLevel !== i || c._attachedLayer !== a) && (e.colorTextures.forEach((e, t) => {
			let n = this._renderer.texture.getGlSource(e);
			if (n.target === u.TEXTURE_2D) {
				if (a !== 0) throw Error("[RenderTargetSystem] layer must be 0 when rendering to 2D textures in WebGL.");
				u.framebufferTexture2D(u.FRAMEBUFFER, u.COLOR_ATTACHMENT0 + t, u.TEXTURE_2D, n.texture, i);
			} else if (n.target === u.TEXTURE_2D_ARRAY) {
				if (this._renderer.context.webGLVersion < 2) throw Error("[RenderTargetSystem] Rendering to 2D array textures requires WebGL2.");
				u.framebufferTextureLayer(u.FRAMEBUFFER, u.COLOR_ATTACHMENT0 + t, n.texture, i, a);
			} else if (n.target === u.TEXTURE_CUBE_MAP) {
				if (a < 0 || a > 5) throw Error("[RenderTargetSystem] Cube map layer must be between 0 and 5.");
				u.framebufferTexture2D(u.FRAMEBUFFER, u.COLOR_ATTACHMENT0 + t, u.TEXTURE_CUBE_MAP_POSITIVE_X + a, n.texture, i);
			} else throw Error("[RenderTargetSystem] Unsupported texture target for render-to-layer in WebGL.");
		}), c._attachedMipLevel = i, c._attachedLayer = a), e.colorTextures.length > 1 && this._setDrawBuffers(e, u);
		let d = this._viewPortCache;
		(d.x !== r.x || d.y !== l || d.width !== r.width || d.height !== r.height) && (d.x = r.x, d.y = l, d.width = r.width, d.height = r.height, u.viewport(r.x, l, r.width, r.height)), !c.depthStencilRenderBuffer && (e.stencil || e.depth) && this._initStencil(c), this.clear(e, t, n);
	}
	finishRenderPass(e) {
		let t = this._renderTargetSystem.getGpuRenderTarget(e);
		if (!t.msaa) return;
		let n = this._renderer.gl;
		n.bindFramebuffer(n.FRAMEBUFFER, t.resolveTargetFramebuffer), n.bindFramebuffer(n.READ_FRAMEBUFFER, t.framebuffer), n.blitFramebuffer(0, 0, t.width, t.height, 0, 0, t.width, t.height, n.COLOR_BUFFER_BIT, n.NEAREST), n.bindFramebuffer(n.FRAMEBUFFER, t.framebuffer);
	}
	initGpuRenderTarget(e) {
		let t = this._renderer.gl, n = new UC();
		return n._attachedMipLevel = 0, n._attachedLayer = 0, e.colorTexture instanceof xi ? (this._renderer.context.ensureCanvasSize(e.colorTexture.resource), n.framebuffer = null, n) : (this._initColor(e, n), t.bindFramebuffer(t.FRAMEBUFFER, null), n);
	}
	destroyGpuRenderTarget(e) {
		let t = this._renderer.gl;
		e.framebuffer &&= (t.deleteFramebuffer(e.framebuffer), null), e.resolveTargetFramebuffer &&= (t.deleteFramebuffer(e.resolveTargetFramebuffer), null), e.depthStencilRenderBuffer &&= (t.deleteRenderbuffer(e.depthStencilRenderBuffer), null), e.msaaRenderBuffer.forEach((e) => {
			t.deleteRenderbuffer(e);
		}), e.msaaRenderBuffer = null;
	}
	clear(e, t, n, r, i = 0, a = 0) {
		if (!t) return;
		if (a !== 0) throw Error("[RenderTargetSystem] Clearing array layers is not supported in WebGL renderer.");
		let o = this._renderTargetSystem;
		typeof t == "boolean" && (t = t ? Ss.ALL : Ss.NONE);
		let s = this._renderer.gl;
		if (t & Ss.COLOR) {
			n ??= o.defaultClearColor;
			let e = this._clearColorCache, t = n;
			(e[0] !== t[0] || e[1] !== t[1] || e[2] !== t[2] || e[3] !== t[3]) && (e[0] = t[0], e[1] = t[1], e[2] = t[2], e[3] = t[3], s.clearColor(t[0], t[1], t[2], t[3]));
		}
		s.clear(t);
	}
	resizeGpuRenderTarget(e) {
		if (e.isRoot) return;
		let t = this._renderTargetSystem.getGpuRenderTarget(e);
		this._resizeColor(e, t), (e.stencil || e.depth) && this._resizeStencil(t);
	}
	_initColor(e, t) {
		let n = this._renderer, r = n.gl, i = r.createFramebuffer();
		if (t.resolveTargetFramebuffer = i, r.bindFramebuffer(r.FRAMEBUFFER, i), t.width = e.colorTexture.source.pixelWidth, t.height = e.colorTexture.source.pixelHeight, e.colorTextures.forEach((e, i) => {
			let a = e.source;
			a.antialias && (n.context.supports.msaa ? t.msaa = !0 : vf("[RenderTexture] Antialiasing on textures is not supported in WebGL1")), n.texture.bindSource(a, 0);
			let o = n.texture.getGlSource(a), s = o.texture;
			if (o.target === r.TEXTURE_2D) r.framebufferTexture2D(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0 + i, r.TEXTURE_2D, s, 0);
			else if (o.target === r.TEXTURE_2D_ARRAY) {
				if (n.context.webGLVersion < 2) throw Error("[RenderTargetSystem] TEXTURE_2D_ARRAY requires WebGL2.");
				r.framebufferTextureLayer(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0 + i, s, 0, 0);
			} else if (o.target === r.TEXTURE_CUBE_MAP) r.framebufferTexture2D(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0 + i, r.TEXTURE_CUBE_MAP_POSITIVE_X, s, 0);
			else throw Error("[RenderTargetSystem] Unsupported texture target for framebuffer attachment.");
		}), t.msaa) {
			let n = r.createFramebuffer();
			t.framebuffer = n, r.bindFramebuffer(r.FRAMEBUFFER, n), e.colorTextures.forEach((e, n) => {
				let i = r.createRenderbuffer();
				t.msaaRenderBuffer[n] = i;
			});
		} else t.framebuffer = i;
		this._resizeColor(e, t);
	}
	_resizeColor(e, t) {
		let n = e.colorTexture.source;
		if (t.width = n.pixelWidth, t.height = n.pixelHeight, t._attachedMipLevel = 0, t._attachedLayer = 0, e.colorTextures.forEach((e, t) => {
			t !== 0 && e.source.resize(n.width, n.height, n._resolution);
		}), t.msaa) {
			let n = this._renderer, r = n.gl, i = t.framebuffer;
			r.bindFramebuffer(r.FRAMEBUFFER, i), e.colorTextures.forEach((e, i) => {
				let a = e.source;
				n.texture.bindSource(a, 0);
				let o = n.texture.getGlSource(a).internalFormat, s = t.msaaRenderBuffer[i];
				r.bindRenderbuffer(r.RENDERBUFFER, s), r.renderbufferStorageMultisample(r.RENDERBUFFER, 4, o, a.pixelWidth, a.pixelHeight), r.framebufferRenderbuffer(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0 + i, r.RENDERBUFFER, s);
			});
		}
	}
	_initStencil(e) {
		if (e.framebuffer === null) return;
		let t = this._renderer.gl, n = t.createRenderbuffer();
		e.depthStencilRenderBuffer = n, t.bindRenderbuffer(t.RENDERBUFFER, n), t.framebufferRenderbuffer(t.FRAMEBUFFER, t.DEPTH_STENCIL_ATTACHMENT, t.RENDERBUFFER, n), this._resizeStencil(e);
	}
	_resizeStencil(e) {
		let t = this._renderer.gl;
		t.bindRenderbuffer(t.RENDERBUFFER, e.depthStencilRenderBuffer), e.msaa ? t.renderbufferStorageMultisample(t.RENDERBUFFER, 4, t.DEPTH24_STENCIL8, e.width, e.height) : t.renderbufferStorage(t.RENDERBUFFER, this._renderer.context.webGLVersion === 2 ? t.DEPTH24_STENCIL8 : t.DEPTH_STENCIL, e.width, e.height);
	}
	prerender(e) {
		let t = e.colorTexture.resource;
		this._renderer.context.multiView && xi.test(t) && this._renderer.context.ensureCanvasSize(t);
	}
	postrender(e) {
		if (this._renderer.context.multiView && xi.test(e.colorTexture.resource)) {
			let t = this._renderer.context.canvas, n = e.colorTexture;
			n.context2D.drawImage(t, 0, n.pixelHeight - t.height);
		}
	}
	_setDrawBuffers(e, t) {
		let n = e.colorTextures.length, r = this._drawBuffersCache[n];
		if (this._renderer.context.webGLVersion === 1) {
			let e = this._renderer.context.extensions.drawBuffers;
			e ? e.drawBuffersWEBGL(r) : vf("[RenderTexture] This WebGL1 context does not support rendering to multiple targets");
		} else t.drawBuffers(r);
	}
}, pw = class extends YS {
	constructor(e) {
		super(e), this.adaptor = new fw(), this.adaptor.init(e, this);
	}
};
pw.extension = {
	type: [h.WebGLSystem],
	name: "renderTarget"
};
var mw = class extends C {
	constructor({ buffer: e, offset: t, size: n }) {
		super(), this.uid = H("buffer"), this._resourceType = "bufferResource", this._touched = 0, this._resourceId = H("resource"), this._bufferResource = !0, this.destroyed = !1, this.buffer = e, this.offset = t | 0, this.size = n, this.buffer.on("change", this.onBufferChange, this);
	}
	onBufferChange() {
		this._resourceId = H("resource"), this.emit("change", this);
	}
	destroy(e = !1) {
		this.destroyed = !0, e && this.buffer.destroy(), this.emit("change", this), this.buffer = null, this.removeAllListeners();
	}
};
function hw(e, t) {
	let n = [], r = ["\n        var g = s.groups;\n        var sS = r.shader;\n        var p = s.glProgram;\n        var ugS = r.uniformGroup;\n        var resources;\n    "], i = !1, a = 0, o = t._getProgramData(e.glProgram);
	for (let s in e.groups) {
		let c = e.groups[s];
		n.push(`
            resources = g[${s}].resources;
        `);
		for (let l in c.resources) {
			let u = c.resources[l];
			if (u instanceof io) {
				if (u.ubo) {
					let t = e._uniformBindMap[s][Number(l)];
					n.push(`
                        sS.bindUniformBlock(
                            resources[${l}],
                            '${t}',
                            ${e.glProgram._uniformBlockData[t].index}
                        );
                    `);
				} else n.push(`
                        ugS.updateUniformGroup(resources[${l}], p, sD);
                    `);
			} else if (u instanceof mw) {
				let t = e._uniformBindMap[s][Number(l)];
				n.push(`
                    sS.bindUniformBlock(
                        resources[${l}],
                        '${t}',
                        ${e.glProgram._uniformBlockData[t].index}
                    );
                `);
			} else if (u instanceof It) {
				let c = e._uniformBindMap[s][l], u = o.uniformData[c];
				u && (i || (i = !0, r.push("\n                        var tS = r.texture;\n                        ")), t._gl.uniform1i(u.location, a), n.push(`
                        tS.bind(resources[${l}], ${a});
                    `), a++);
			}
		}
	}
	let s = [...r, ...n].join("\n");
	return Function("r", "s", "sD", s);
}
var gw = class {
	constructor(e, t) {
		this.program = e, this.uniformData = t, this.uniformGroups = {}, this.uniformDirtyGroups = {}, this.uniformBlockBindings = {};
	}
	destroy() {
		this.uniformData = null, this.uniformGroups = null, this.uniformDirtyGroups = null, this.uniformBlockBindings = null, this.program = null;
	}
};
function _w(e, t, n) {
	let r = e.createShader(t);
	return e.shaderSource(r, n), e.compileShader(r), r;
}
function vw(e) {
	let t = Array(e);
	for (let e = 0; e < t.length; e++) t[e] = !1;
	return t;
}
function yw(e, t) {
	switch (e) {
		case "float": return 0;
		case "vec2": return new Float32Array(2 * t);
		case "vec3": return new Float32Array(3 * t);
		case "vec4": return new Float32Array(4 * t);
		case "int":
		case "uint":
		case "sampler2D":
		case "sampler2DArray": return 0;
		case "ivec2": return new Int32Array(2 * t);
		case "ivec3": return new Int32Array(3 * t);
		case "ivec4": return new Int32Array(4 * t);
		case "uvec2": return new Uint32Array(2 * t);
		case "uvec3": return new Uint32Array(3 * t);
		case "uvec4": return new Uint32Array(4 * t);
		case "bool": return !1;
		case "bvec2": return vw(2 * t);
		case "bvec3": return vw(3 * t);
		case "bvec4": return vw(4 * t);
		case "mat2": return new Float32Array([
			1,
			0,
			0,
			1
		]);
		case "mat3": return new Float32Array([
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		]);
		case "mat4": return new Float32Array([
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1
		]);
	}
	return null;
}
var bw = null, xw = {
	FLOAT: "float",
	FLOAT_VEC2: "vec2",
	FLOAT_VEC3: "vec3",
	FLOAT_VEC4: "vec4",
	INT: "int",
	INT_VEC2: "ivec2",
	INT_VEC3: "ivec3",
	INT_VEC4: "ivec4",
	UNSIGNED_INT: "uint",
	UNSIGNED_INT_VEC2: "uvec2",
	UNSIGNED_INT_VEC3: "uvec3",
	UNSIGNED_INT_VEC4: "uvec4",
	BOOL: "bool",
	BOOL_VEC2: "bvec2",
	BOOL_VEC3: "bvec3",
	BOOL_VEC4: "bvec4",
	FLOAT_MAT2: "mat2",
	FLOAT_MAT3: "mat3",
	FLOAT_MAT4: "mat4",
	SAMPLER_2D: "sampler2D",
	INT_SAMPLER_2D: "sampler2D",
	UNSIGNED_INT_SAMPLER_2D: "sampler2D",
	SAMPLER_CUBE: "samplerCube",
	INT_SAMPLER_CUBE: "samplerCube",
	UNSIGNED_INT_SAMPLER_CUBE: "samplerCube",
	SAMPLER_2D_ARRAY: "sampler2DArray",
	INT_SAMPLER_2D_ARRAY: "sampler2DArray",
	UNSIGNED_INT_SAMPLER_2D_ARRAY: "sampler2DArray"
}, Sw = {
	float: "float32",
	vec2: "float32x2",
	vec3: "float32x3",
	vec4: "float32x4",
	int: "sint32",
	ivec2: "sint32x2",
	ivec3: "sint32x3",
	ivec4: "sint32x4",
	uint: "uint32",
	uvec2: "uint32x2",
	uvec3: "uint32x3",
	uvec4: "uint32x4",
	bool: "uint32",
	bvec2: "uint32x2",
	bvec3: "uint32x3",
	bvec4: "uint32x4"
};
function Cw(e, t) {
	if (!bw) {
		let t = Object.keys(xw);
		bw = {};
		for (let n = 0; n < t.length; ++n) {
			let r = t[n];
			bw[e[r]] = xw[r];
		}
	}
	return bw[t];
}
function ww(e, t) {
	return Sw[Cw(e, t)] || "float32";
}
function Tw(e, t, n = !1) {
	let r = {}, i = t.getProgramParameter(e, t.ACTIVE_ATTRIBUTES);
	for (let n = 0; n < i; n++) {
		let i = t.getActiveAttrib(e, n);
		if (i.name.startsWith("gl_")) continue;
		let a = ww(t, i.type);
		r[i.name] = {
			location: 0,
			format: a,
			stride: Na(a).stride,
			offset: 0,
			instance: !1,
			start: 0
		};
	}
	let a = Object.keys(r);
	if (n) {
		a.sort((e, t) => e > t ? 1 : -1);
		for (let n = 0; n < a.length; n++) r[a[n]].location = n, t.bindAttribLocation(e, n, a[n]);
		t.linkProgram(e);
	} else for (let n = 0; n < a.length; n++) r[a[n]].location = t.getAttribLocation(e, a[n]);
	return r;
}
function Ew(e, t) {
	if (!t.ACTIVE_UNIFORM_BLOCKS) return {};
	let n = {}, r = t.getProgramParameter(e, t.ACTIVE_UNIFORM_BLOCKS);
	for (let i = 0; i < r; i++) {
		let r = t.getActiveUniformBlockName(e, i);
		n[r] = {
			name: r,
			index: t.getUniformBlockIndex(e, r),
			size: t.getActiveUniformBlockParameter(e, i, t.UNIFORM_BLOCK_DATA_SIZE)
		};
	}
	return n;
}
function Dw(e, t) {
	let n = {}, r = t.getProgramParameter(e, t.ACTIVE_UNIFORMS);
	for (let i = 0; i < r; i++) {
		let r = t.getActiveUniform(e, i), a = r.name.replace(/\[.*?\]$/, ""), o = !!r.name.match(/\[.*?\]$/), s = Cw(t, r.type);
		n[a] = {
			name: a,
			index: i,
			type: s,
			size: r.size,
			isArray: o,
			value: yw(s, r.size)
		};
	}
	return n;
}
function Ow(e, t) {
	let n = e.getShaderSource(t);
	if (n === null) {
		console.error("PixiJS Error: Could not retrieve shader source (WebGL context may be lost).");
		return;
	}
	let r = n.split("\n").map((e, t) => `${t}: ${e}`), i = e.getShaderInfoLog(t) ?? "", a = i.split("\n"), o = {}, s = a.map((e) => parseFloat(e.replace(/^ERROR\: 0\:([\d]+)\:.*$/, "$1"))).filter((e) => e && !o[e] ? (o[e] = !0, !0) : !1), c = [""];
	s.forEach((e) => {
		r[e - 1] = `%c${r[e - 1]}%c`, c.push("background: #FF0000; color:#FFFFFF; font-size: 10px", "font-size: 10px");
	}), c[0] = r.join("\n"), console.error(i), console.groupCollapsed("click to view full shader code"), console.warn(...c), console.groupEnd();
}
function kw(e, t, n, r) {
	e.getProgramParameter(t, e.LINK_STATUS) || (e.getShaderParameter(n, e.COMPILE_STATUS) || Ow(e, n), e.getShaderParameter(r, e.COMPILE_STATUS) || Ow(e, r), console.error("PixiJS Error: Could not initialize shader."), e.getProgramInfoLog(t) !== "" && console.warn("PixiJS Warning: gl.getProgramInfoLog()", e.getProgramInfoLog(t)));
}
function Aw(e, t) {
	let n = _w(e, e.VERTEX_SHADER, t.vertex), r = _w(e, e.FRAGMENT_SHADER, t.fragment), i = e.createProgram();
	e.attachShader(i, n), e.attachShader(i, r);
	let a = t.transformFeedbackVaryings;
	a && (typeof e.transformFeedbackVaryings != "function" || e.transformFeedbackVaryings(i, a.names, a.bufferMode === "separate" ? e.SEPARATE_ATTRIBS : e.INTERLEAVED_ATTRIBS)), e.linkProgram(i), e.getProgramParameter(i, e.LINK_STATUS) || kw(e, i, n, r), t._attributeData = Tw(i, e, !/^[ \t]*#[ \t]*version[ \t]+300[ \t]+es[ \t]*$/m.test(t.vertex)), t._uniformData = Dw(i, e), t._uniformBlockData = Ew(i, e), e.deleteShader(n), e.deleteShader(r);
	let o = {};
	for (let n in t._uniformData) {
		let r = t._uniformData[n];
		o[n] = {
			location: e.getUniformLocation(i, n),
			value: yw(r.type, r.size)
		};
	}
	return new gw(i, o);
}
var jw = {
	textureCount: 0,
	blockIndex: 0
}, Mw = class {
	constructor(e) {
		this._activeProgram = null, this._programDataHash = Object.create(null), this._shaderSyncFunctions = Object.create(null), this._renderer = e;
	}
	contextChange(e) {
		this._gl = e, this._programDataHash = Object.create(null), this._shaderSyncFunctions = Object.create(null), this._activeProgram = null;
	}
	bind(e, t) {
		if (this._setProgram(e.glProgram), t) return;
		jw.textureCount = 0, jw.blockIndex = 0;
		let n = this._shaderSyncFunctions[e.glProgram._key];
		n ||= this._shaderSyncFunctions[e.glProgram._key] = this._generateShaderSync(e, this), this._renderer.buffer.nextBindBase(!!e.glProgram.transformFeedbackVaryings), n(this._renderer, e, jw);
	}
	updateUniformGroup(e) {
		this._renderer.uniformGroup.updateUniformGroup(e, this._activeProgram, jw);
	}
	bindUniformBlock(e, t, n = 0) {
		let r = this._renderer.buffer, i = this._getProgramData(this._activeProgram), a = e._bufferResource;
		a || this._renderer.ubo.updateUniformGroup(e);
		let o = e.buffer, s = r.updateBuffer(o), c = r.freeLocationForBufferBase(s);
		if (a) {
			let { offset: t, size: n } = e;
			t === 0 && n === o.data.byteLength ? r.bindBufferBase(s, c) : r.bindBufferRange(s, c, t);
		} else r.getLastBindBaseLocation(s) !== c && r.bindBufferBase(s, c);
		let l = this._activeProgram._uniformBlockData[t].index;
		i.uniformBlockBindings[n] !== c && (i.uniformBlockBindings[n] = c, this._renderer.gl.uniformBlockBinding(i.program, l, c));
	}
	_setProgram(e) {
		if (this._activeProgram === e) return;
		this._activeProgram = e;
		let t = this._getProgramData(e);
		this._gl.useProgram(t.program);
	}
	_getProgramData(e) {
		return this._programDataHash[e._key] || this._createProgramData(e);
	}
	_createProgramData(e) {
		let t = e._key;
		return this._programDataHash[t] = Aw(this._gl, e), this._programDataHash[t];
	}
	destroy() {
		for (let e of Object.keys(this._programDataHash)) this._programDataHash[e].destroy();
		this._programDataHash = null, this._shaderSyncFunctions = null, this._activeProgram = null, this._renderer = null, this._gl = null;
	}
	_generateShaderSync(e, t) {
		return hw(e, t);
	}
	resetState() {
		this._activeProgram = null;
	}
};
Mw.extension = {
	type: [h.WebGLSystem],
	name: "shader"
};
var Nw = {
	f32: "if (cv !== v) {\n            cu.value = v;\n            gl.uniform1f(location, v);\n        }",
	"vec2<f32>": "if (cv[0] !== v[0] || cv[1] !== v[1]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            gl.uniform2f(location, v[0], v[1]);\n        }",
	"vec3<f32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            gl.uniform3f(location, v[0], v[1], v[2]);\n        }",
	"vec4<f32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            cv[3] = v[3];\n            gl.uniform4f(location, v[0], v[1], v[2], v[3]);\n        }",
	i32: "if (cv !== v) {\n            cu.value = v;\n            gl.uniform1i(location, v);\n        }",
	"vec2<i32>": "if (cv[0] !== v[0] || cv[1] !== v[1]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            gl.uniform2i(location, v[0], v[1]);\n        }",
	"vec3<i32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            gl.uniform3i(location, v[0], v[1], v[2]);\n        }",
	"vec4<i32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            cv[3] = v[3];\n            gl.uniform4i(location, v[0], v[1], v[2], v[3]);\n        }",
	u32: "if (cv !== v) {\n            cu.value = v;\n            gl.uniform1ui(location, v);\n        }",
	"vec2<u32>": "if (cv[0] !== v[0] || cv[1] !== v[1]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            gl.uniform2ui(location, v[0], v[1]);\n        }",
	"vec3<u32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            gl.uniform3ui(location, v[0], v[1], v[2]);\n        }",
	"vec4<u32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            cv[3] = v[3];\n            gl.uniform4ui(location, v[0], v[1], v[2], v[3]);\n        }",
	bool: "if (cv !== v) {\n            cu.value = v;\n            gl.uniform1i(location, v);\n        }",
	"vec2<bool>": "if (cv[0] !== v[0] || cv[1] !== v[1]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            gl.uniform2i(location, v[0], v[1]);\n        }",
	"vec3<bool>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            gl.uniform3i(location, v[0], v[1], v[2]);\n        }",
	"vec4<bool>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            cv[3] = v[3];\n            gl.uniform4i(location, v[0], v[1], v[2], v[3]);\n        }",
	"mat2x2<f32>": "gl.uniformMatrix2fv(location, false, v);",
	"mat3x3<f32>": "gl.uniformMatrix3fv(location, false, v);",
	"mat4x4<f32>": "gl.uniformMatrix4fv(location, false, v);"
}, Pw = {
	f32: "gl.uniform1fv(location, v);",
	"vec2<f32>": "gl.uniform2fv(location, v);",
	"vec3<f32>": "gl.uniform3fv(location, v);",
	"vec4<f32>": "gl.uniform4fv(location, v);",
	"mat2x2<f32>": "gl.uniformMatrix2fv(location, false, v);",
	"mat3x3<f32>": "gl.uniformMatrix3fv(location, false, v);",
	"mat4x4<f32>": "gl.uniformMatrix4fv(location, false, v);",
	i32: "gl.uniform1iv(location, v);",
	"vec2<i32>": "gl.uniform2iv(location, v);",
	"vec3<i32>": "gl.uniform3iv(location, v);",
	"vec4<i32>": "gl.uniform4iv(location, v);",
	u32: "gl.uniform1iv(location, v);",
	"vec2<u32>": "gl.uniform2iv(location, v);",
	"vec3<u32>": "gl.uniform3iv(location, v);",
	"vec4<u32>": "gl.uniform4iv(location, v);",
	bool: "gl.uniform1iv(location, v);",
	"vec2<bool>": "gl.uniform2iv(location, v);",
	"vec3<bool>": "gl.uniform3iv(location, v);",
	"vec4<bool>": "gl.uniform4iv(location, v);"
};
function Fw(e, t) {
	let n = ["\n        var v = null;\n        var cv = null;\n        var cu = null;\n        var t = 0;\n        var gl = renderer.gl;\n        var name = null;\n    "];
	for (let r in e.uniforms) {
		if (!t[r]) {
			e.uniforms[r] instanceof io ? e.uniforms[r].ubo ? n.push(`
                        renderer.shader.bindUniformBlock(uv.${r}, "${r}");
                    `) : n.push(`
                        renderer.shader.updateUniformGroup(uv.${r});
                    `) : e.uniforms[r] instanceof mw && n.push(`
                        renderer.shader.bindBufferResource(uv.${r}, "${r}");
                    `);
			continue;
		}
		let i = e.uniformStructures[r], a = !1;
		for (let e = 0; e < YC.length; e++) {
			let t = YC[e];
			if (i.type === t.type && t.test(i)) {
				n.push(`name = "${r}";`, YC[e].uniform), a = !0;
				break;
			}
		}
		if (!a) {
			let e = (i.size === 1 ? Nw : Pw)[i.type].replace("location", `ud["${r}"].location`);
			n.push(`
            cu = ud["${r}"];
            cv = cu.value;
            v = uv["${r}"];
            ${e};`);
		}
	}
	return Function("ud", "uv", "renderer", "syncData", n.join("\n"));
}
var Iw = class {
	constructor(e) {
		this._cache = {}, this._uniformGroupSyncHash = {}, this._renderer = e, this.gl = null, this._cache = {};
	}
	contextChange(e) {
		this.gl = e;
	}
	updateUniformGroup(e, t, n) {
		let r = this._renderer.shader._getProgramData(t);
		(!e.isStatic || e._dirtyId !== r.uniformDirtyGroups[e.uid]) && (r.uniformDirtyGroups[e.uid] = e._dirtyId, this._getUniformSyncFunction(e, t)(r.uniformData, e.uniforms, this._renderer, n));
	}
	_getUniformSyncFunction(e, t) {
		return this._uniformGroupSyncHash[e._signature]?.[t._key] || this._createUniformSyncFunction(e, t);
	}
	_createUniformSyncFunction(e, t) {
		let n = this._uniformGroupSyncHash[e._signature] || (this._uniformGroupSyncHash[e._signature] = {}), r = this._getSignature(e, t._uniformData, "u");
		return this._cache[r] || (this._cache[r] = this._generateUniformsSync(e, t._uniformData)), n[t._key] = this._cache[r], n[t._key];
	}
	_generateUniformsSync(e, t) {
		return Fw(e, t);
	}
	_getSignature(e, t, n) {
		let r = e.uniforms, i = [`${n}-`];
		for (let e in r) i.push(e), t[e] && i.push(t[e].type);
		return i.join("-");
	}
	destroy() {
		this._renderer = null, this._cache = null;
	}
};
Iw.extension = {
	type: [h.WebGLSystem],
	name: "uniformGroup"
};
function Lw(e) {
	let t = {};
	if (t.normal = [e.ONE, e.ONE_MINUS_SRC_ALPHA], t.add = [e.ONE, e.ONE], t.multiply = [
		e.DST_COLOR,
		e.ONE_MINUS_SRC_ALPHA,
		e.ONE,
		e.ONE_MINUS_SRC_ALPHA
	], t.screen = [
		e.ONE,
		e.ONE_MINUS_SRC_COLOR,
		e.ONE,
		e.ONE_MINUS_SRC_ALPHA
	], t.none = [0, 0], t["normal-npm"] = [
		e.SRC_ALPHA,
		e.ONE_MINUS_SRC_ALPHA,
		e.ONE,
		e.ONE_MINUS_SRC_ALPHA
	], t["add-npm"] = [
		e.SRC_ALPHA,
		e.ONE,
		e.ONE,
		e.ONE
	], t["screen-npm"] = [
		e.SRC_ALPHA,
		e.ONE_MINUS_SRC_COLOR,
		e.ONE,
		e.ONE_MINUS_SRC_ALPHA
	], t.erase = [e.ZERO, e.ONE_MINUS_SRC_ALPHA], !(e instanceof X.get().getWebGLRenderingContext())) t.min = [
		e.ONE,
		e.ONE,
		e.ONE,
		e.ONE,
		e.MIN,
		e.MIN
	], t.max = [
		e.ONE,
		e.ONE,
		e.ONE,
		e.ONE,
		e.MAX,
		e.MAX
	];
	else {
		let n = e.getExtension("EXT_blend_minmax");
		n && (t.min = [
			e.ONE,
			e.ONE,
			e.ONE,
			e.ONE,
			n.MIN_EXT,
			n.MIN_EXT
		], t.max = [
			e.ONE,
			e.ONE,
			e.ONE,
			e.ONE,
			n.MAX_EXT,
			n.MAX_EXT
		]);
	}
	return t;
}
var Rw = 0, zw = 1, Bw = 2, Vw = 3, Hw = 4, Uw = 5, Ww = class e {
	constructor(e) {
		this._invertFrontFace = !1, this.gl = null, this.stateId = 0, this.polygonOffset = 0, this.blendMode = "none", this._blendEq = !1, this.map = [], this.map[Rw] = this.setBlend, this.map[zw] = this.setOffset, this.map[Bw] = this.setCullFace, this.map[Vw] = this.setDepthTest, this.map[Hw] = this.setFrontFace, this.map[Uw] = this.setDepthMask, this.checks = [], this.defaultState = go.for2d(), e.renderTarget.onRenderTargetChange.add(this);
	}
	onRenderTargetChange(e) {
		this._invertFrontFace = !e.isRoot, this._cullFace ? this.setFrontFace(this._frontFace) : this._frontFaceDirty = !0;
	}
	contextChange(e) {
		this.gl = e, this.blendModesMap = Lw(e), this.resetState();
	}
	set(e) {
		if (e ||= this.defaultState, this.stateId !== e.data) {
			let t = this.stateId ^ e.data, n = 0;
			for (; t;) t & 1 && this.map[n].call(this, !!(e.data & 1 << n)), t >>= 1, n++;
			this.stateId = e.data;
		}
		for (let t = 0; t < this.checks.length; t++) this.checks[t](this, e);
	}
	forceState(e) {
		e ||= this.defaultState;
		for (let t = 0; t < this.map.length; t++) this.map[t].call(this, !!(e.data & 1 << t));
		for (let t = 0; t < this.checks.length; t++) this.checks[t](this, e);
		this.stateId = e.data;
	}
	setBlend(t) {
		this._updateCheck(e._checkBlendMode, t), this.gl[t ? "enable" : "disable"](this.gl.BLEND);
	}
	setOffset(t) {
		this._updateCheck(e._checkPolygonOffset, t), this.gl[t ? "enable" : "disable"](this.gl.POLYGON_OFFSET_FILL);
	}
	setDepthTest(e) {
		this.gl[e ? "enable" : "disable"](this.gl.DEPTH_TEST);
	}
	setDepthMask(e) {
		this.gl.depthMask(e);
	}
	setCullFace(e) {
		this._cullFace = e, this.gl[e ? "enable" : "disable"](this.gl.CULL_FACE), this._cullFace && this._frontFaceDirty && this.setFrontFace(this._frontFace);
	}
	setFrontFace(e) {
		this._frontFace = e, this._frontFaceDirty = !1;
		let t = this._invertFrontFace ? !e : e;
		this._glFrontFace !== t && (this._glFrontFace = t, this.gl.frontFace(this.gl[t ? "CW" : "CCW"]));
	}
	setBlendMode(e) {
		if (this.blendModesMap[e] || (e = "normal"), e === this.blendMode) return;
		this.blendMode = e;
		let t = this.blendModesMap[e], n = this.gl;
		t.length === 2 ? n.blendFunc(t[0], t[1]) : n.blendFuncSeparate(t[0], t[1], t[2], t[3]), t.length === 6 ? (this._blendEq = !0, n.blendEquationSeparate(t[4], t[5])) : this._blendEq && (this._blendEq = !1, n.blendEquationSeparate(n.FUNC_ADD, n.FUNC_ADD));
	}
	setPolygonOffset(e, t) {
		this.gl.polygonOffset(e, t);
	}
	resetState() {
		this._glFrontFace = !1, this._frontFace = !1, this._cullFace = !1, this._frontFaceDirty = !1, this._invertFrontFace = !1, this.gl.frontFace(this.gl.CCW), this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, !1), this.forceState(this.defaultState), this._blendEq = !0, this.blendMode = "", this.setBlendMode("normal");
	}
	_updateCheck(e, t) {
		let n = this.checks.indexOf(e);
		t && n === -1 ? this.checks.push(e) : !t && n !== -1 && this.checks.splice(n, 1);
	}
	static _checkBlendMode(e, t) {
		e.setBlendMode(t.blendMode);
	}
	static _checkPolygonOffset(e, t) {
		e.setPolygonOffset(1, t.polygonOffset);
	}
	destroy() {
		this.gl = null, this.checks.length = 0;
	}
};
Ww.extension = {
	type: [h.WebGLSystem],
	name: "state"
};
var Gw = Ww, Kw = class {
	constructor(e) {
		this.target = CC.TEXTURE_2D, this._layerInitMask = 0, this.texture = e, this.width = -1, this.height = -1, this.type = TC.UNSIGNED_BYTE, this.internalFormat = SC.RGBA, this.format = SC.RGBA, this.samplerType = 0;
	}
	destroy() {}
}, qw = {
	id: "buffer",
	upload(e, t, n, r, i, a = !1) {
		let o = i || t.target;
		!a && t.width === e.width && t.height === e.height ? n.texSubImage2D(o, 0, 0, 0, e.width, e.height, t.format, t.type, e.resource) : n.texImage2D(o, 0, t.internalFormat, e.width, e.height, 0, t.format, t.type, e.resource), t.width = e.width, t.height = e.height;
	}
}, Jw = {
	"bc1-rgba-unorm": !0,
	"bc1-rgba-unorm-srgb": !0,
	"bc2-rgba-unorm": !0,
	"bc2-rgba-unorm-srgb": !0,
	"bc3-rgba-unorm": !0,
	"bc3-rgba-unorm-srgb": !0,
	"bc4-r-unorm": !0,
	"bc4-r-snorm": !0,
	"bc5-rg-unorm": !0,
	"bc5-rg-snorm": !0,
	"bc6h-rgb-ufloat": !0,
	"bc6h-rgb-float": !0,
	"bc7-rgba-unorm": !0,
	"bc7-rgba-unorm-srgb": !0,
	"etc2-rgb8unorm": !0,
	"etc2-rgb8unorm-srgb": !0,
	"etc2-rgb8a1unorm": !0,
	"etc2-rgb8a1unorm-srgb": !0,
	"etc2-rgba8unorm": !0,
	"etc2-rgba8unorm-srgb": !0,
	"eac-r11unorm": !0,
	"eac-r11snorm": !0,
	"eac-rg11unorm": !0,
	"eac-rg11snorm": !0,
	"astc-4x4-unorm": !0,
	"astc-4x4-unorm-srgb": !0,
	"astc-5x4-unorm": !0,
	"astc-5x4-unorm-srgb": !0,
	"astc-5x5-unorm": !0,
	"astc-5x5-unorm-srgb": !0,
	"astc-6x5-unorm": !0,
	"astc-6x5-unorm-srgb": !0,
	"astc-6x6-unorm": !0,
	"astc-6x6-unorm-srgb": !0,
	"astc-8x5-unorm": !0,
	"astc-8x5-unorm-srgb": !0,
	"astc-8x6-unorm": !0,
	"astc-8x6-unorm-srgb": !0,
	"astc-8x8-unorm": !0,
	"astc-8x8-unorm-srgb": !0,
	"astc-10x5-unorm": !0,
	"astc-10x5-unorm-srgb": !0,
	"astc-10x6-unorm": !0,
	"astc-10x6-unorm-srgb": !0,
	"astc-10x8-unorm": !0,
	"astc-10x8-unorm-srgb": !0,
	"astc-10x10-unorm": !0,
	"astc-10x10-unorm-srgb": !0,
	"astc-12x10-unorm": !0,
	"astc-12x10-unorm-srgb": !0,
	"astc-12x12-unorm": !0,
	"astc-12x12-unorm-srgb": !0
}, Yw = {
	id: "compressed",
	upload(e, t, n, r, i, a) {
		let o = i ?? t.target;
		n.pixelStorei(n.UNPACK_ALIGNMENT, 4);
		let s = e.pixelWidth, c = e.pixelHeight, l = !!Jw[e.format];
		for (let r = 0; r < e.resource.length; r++) {
			let i = e.resource[r];
			l ? n.compressedTexImage2D(o, r, t.internalFormat, s, c, 0, i) : n.texImage2D(o, r, t.internalFormat, s, c, 0, t.format, t.type, i), s = Math.max(s >> 1, 1), c = Math.max(c >> 1, 1);
		}
	}
}, Xw = [
	"right",
	"left",
	"top",
	"bottom",
	"front",
	"back"
];
function Zw(e) {
	return {
		id: "cube",
		upload(t, n, r, i) {
			let a = t.faces;
			for (let t = 0; t < Xw.length; t++) {
				let o = a[Xw[t]];
				(e[o.uploadMethodId] || e.image).upload(o, n, r, i, CC.TEXTURE_CUBE_MAP_POSITIVE_X + t, !(n._layerInitMask & 1 << t)), n._layerInitMask |= 1 << t;
			}
			n.width = t.pixelWidth, n.height = t.pixelHeight;
		}
	};
}
var Qw = {
	id: "image",
	upload(e, t, n, r, i, a = !1) {
		let o = i || t.target, s = e.pixelWidth, c = e.pixelHeight, l = e.resourceWidth, u = e.resourceHeight, d = r === 2, f = a || t.width !== s || t.height !== c, p = l >= s && u >= c, m = e.resource;
		(d ? $w : eT)(n, o, t, s, c, l, u, m, f, p), t.width = s, t.height = c;
	}
};
function $w(e, t, n, r, i, a, o, s, c, l) {
	if (!l) {
		c && e.texImage2D(t, 0, n.internalFormat, r, i, 0, n.format, n.type, null), e.texSubImage2D(t, 0, 0, 0, a, o, n.format, n.type, s);
		return;
	}
	if (!c) {
		e.texSubImage2D(t, 0, 0, 0, n.format, n.type, s);
		return;
	}
	e.texImage2D(t, 0, n.internalFormat, r, i, 0, n.format, n.type, s);
}
function eT(e, t, n, r, i, a, o, s, c, l) {
	if (!l) {
		c && e.texImage2D(t, 0, n.internalFormat, r, i, 0, n.format, n.type, null), e.texSubImage2D(t, 0, 0, 0, n.format, n.type, s);
		return;
	}
	if (!c) {
		e.texSubImage2D(t, 0, 0, 0, n.format, n.type, s);
		return;
	}
	e.texImage2D(t, 0, n.internalFormat, n.format, n.type, s);
}
var tT = Zy(), nT = {
	id: "video",
	upload(e, t, n, r, i, a = tT) {
		if (!e.isValid) {
			let e = i ?? t.target;
			n.texImage2D(e, 0, t.internalFormat, 1, 1, 0, t.format, t.type, null);
			return;
		}
		Qw.upload(e, t, n, r, i, a);
	}
}, rT = {
	linear: 9729,
	nearest: 9728
}, iT = {
	linear: {
		linear: 9987,
		nearest: 9985
	},
	nearest: {
		linear: 9986,
		nearest: 9984
	}
}, aT = {
	"clamp-to-edge": 33071,
	repeat: 10497,
	"mirror-repeat": 33648
}, oT = {
	never: 512,
	less: 513,
	equal: 514,
	"less-equal": 515,
	greater: 516,
	"not-equal": 517,
	"greater-equal": 518,
	always: 519
};
function sT(e, t, n, r, i, a, o, s) {
	let c = a;
	if (!s || e.addressModeU !== "repeat" || e.addressModeV !== "repeat" || e.addressModeW !== "repeat") {
		let n = aT[o ? "clamp-to-edge" : e.addressModeU], r = aT[o ? "clamp-to-edge" : e.addressModeV], a = aT[o ? "clamp-to-edge" : e.addressModeW];
		t[i](c, t.TEXTURE_WRAP_S, n), t[i](c, t.TEXTURE_WRAP_T, r), t.TEXTURE_WRAP_R && t[i](c, t.TEXTURE_WRAP_R, a);
	}
	if ((!s || e.magFilter !== "linear") && t[i](c, t.TEXTURE_MAG_FILTER, rT[e.magFilter]), n) {
		if (!s || e.mipmapFilter !== "linear") {
			let n = iT[e.minFilter][e.mipmapFilter];
			t[i](c, t.TEXTURE_MIN_FILTER, n);
		}
	} else t[i](c, t.TEXTURE_MIN_FILTER, rT[e.minFilter]);
	if (r && e.maxAnisotropy > 1) {
		let n = Math.min(e.maxAnisotropy, t.getParameter(r.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
		t[i](c, r.TEXTURE_MAX_ANISOTROPY_EXT, n);
	}
	e.compare && t[i](c, t.TEXTURE_COMPARE_FUNC, oT[e.compare]);
}
function cT(e) {
	return {
		r8unorm: e.RED,
		r8snorm: e.RED,
		r8uint: e.RED,
		r8sint: e.RED,
		r16uint: e.RED,
		r16sint: e.RED,
		r16float: e.RED,
		rg8unorm: e.RG,
		rg8snorm: e.RG,
		rg8uint: e.RG,
		rg8sint: e.RG,
		r32uint: e.RED,
		r32sint: e.RED,
		r32float: e.RED,
		rg16uint: e.RG,
		rg16sint: e.RG,
		rg16float: e.RG,
		rgba8unorm: e.RGBA,
		"rgba8unorm-srgb": e.RGBA,
		rgba8snorm: e.RGBA,
		rgba8uint: e.RGBA,
		rgba8sint: e.RGBA,
		bgra8unorm: e.RGBA,
		"bgra8unorm-srgb": e.RGBA,
		rgb9e5ufloat: e.RGB,
		rgb10a2unorm: e.RGBA,
		rg11b10ufloat: e.RGB,
		rg32uint: e.RG,
		rg32sint: e.RG,
		rg32float: e.RG,
		rgba16uint: e.RGBA,
		rgba16sint: e.RGBA,
		rgba16float: e.RGBA,
		rgba32uint: e.RGBA,
		rgba32sint: e.RGBA,
		rgba32float: e.RGBA,
		stencil8: e.STENCIL_INDEX8,
		depth16unorm: e.DEPTH_COMPONENT,
		depth24plus: e.DEPTH_COMPONENT,
		"depth24plus-stencil8": e.DEPTH_STENCIL,
		depth32float: e.DEPTH_COMPONENT,
		"depth32float-stencil8": e.DEPTH_STENCIL
	};
}
var lT = Object.defineProperty, uT = Object.defineProperties, dT = Object.getOwnPropertyDescriptors, fT = Object.getOwnPropertySymbols, pT = Object.prototype.hasOwnProperty, mT = Object.prototype.propertyIsEnumerable, hT = (e, t, n) => t in e ? lT(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, gT = (e, t) => {
	for (var n in t ||= {}) pT.call(t, n) && hT(e, n, t[n]);
	if (fT) for (var n of fT(t)) mT.call(t, n) && hT(e, n, t[n]);
	return e;
}, _T = (e, t) => uT(e, dT(t));
function vT(e, t) {
	let n = {}, r = e.RGBA;
	return e instanceof X.get().getWebGLRenderingContext() ? t.srgb && (n = {
		"rgba8unorm-srgb": t.srgb.SRGB8_ALPHA8_EXT,
		"bgra8unorm-srgb": t.srgb.SRGB8_ALPHA8_EXT
	}) : (n = {
		"rgba8unorm-srgb": e.SRGB8_ALPHA8,
		"bgra8unorm-srgb": e.SRGB8_ALPHA8
	}, r = e.RGBA8), gT(gT(gT(gT(gT(gT(_T(gT({
		r8unorm: e.R8,
		r8snorm: e.R8_SNORM,
		r8uint: e.R8UI,
		r8sint: e.R8I,
		r16uint: e.R16UI,
		r16sint: e.R16I,
		r16float: e.R16F,
		rg8unorm: e.RG8,
		rg8snorm: e.RG8_SNORM,
		rg8uint: e.RG8UI,
		rg8sint: e.RG8I,
		r32uint: e.R32UI,
		r32sint: e.R32I,
		r32float: e.R32F,
		rg16uint: e.RG16UI,
		rg16sint: e.RG16I,
		rg16float: e.RG16F,
		rgba8unorm: e.RGBA
	}, n), {
		rgba8snorm: e.RGBA8_SNORM,
		rgba8uint: e.RGBA8UI,
		rgba8sint: e.RGBA8I,
		bgra8unorm: r,
		rgb9e5ufloat: e.RGB9_E5,
		rgb10a2unorm: e.RGB10_A2,
		rg11b10ufloat: e.R11F_G11F_B10F,
		rg32uint: e.RG32UI,
		rg32sint: e.RG32I,
		rg32float: e.RG32F,
		rgba16uint: e.RGBA16UI,
		rgba16sint: e.RGBA16I,
		rgba16float: e.RGBA16F,
		rgba32uint: e.RGBA32UI,
		rgba32sint: e.RGBA32I,
		rgba32float: e.RGBA32F,
		stencil8: e.STENCIL_INDEX8,
		depth16unorm: e.DEPTH_COMPONENT16,
		depth24plus: e.DEPTH_COMPONENT24,
		"depth24plus-stencil8": e.DEPTH24_STENCIL8,
		depth32float: e.DEPTH_COMPONENT32F,
		"depth32float-stencil8": e.DEPTH32F_STENCIL8
	}), t.s3tc ? {
		"bc1-rgba-unorm": t.s3tc.COMPRESSED_RGBA_S3TC_DXT1_EXT,
		"bc2-rgba-unorm": t.s3tc.COMPRESSED_RGBA_S3TC_DXT3_EXT,
		"bc3-rgba-unorm": t.s3tc.COMPRESSED_RGBA_S3TC_DXT5_EXT
	} : {}), t.s3tc_sRGB ? {
		"bc1-rgba-unorm-srgb": t.s3tc_sRGB.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT,
		"bc2-rgba-unorm-srgb": t.s3tc_sRGB.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT,
		"bc3-rgba-unorm-srgb": t.s3tc_sRGB.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT
	} : {}), t.rgtc ? {
		"bc4-r-unorm": t.rgtc.COMPRESSED_RED_RGTC1_EXT,
		"bc4-r-snorm": t.rgtc.COMPRESSED_SIGNED_RED_RGTC1_EXT,
		"bc5-rg-unorm": t.rgtc.COMPRESSED_RED_GREEN_RGTC2_EXT,
		"bc5-rg-snorm": t.rgtc.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT
	} : {}), t.bptc ? {
		"bc6h-rgb-float": t.bptc.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT,
		"bc6h-rgb-ufloat": t.bptc.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT,
		"bc7-rgba-unorm": t.bptc.COMPRESSED_RGBA_BPTC_UNORM_EXT,
		"bc7-rgba-unorm-srgb": t.bptc.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT
	} : {}), t.etc ? {
		"etc2-rgb8unorm": t.etc.COMPRESSED_RGB8_ETC2,
		"etc2-rgb8unorm-srgb": t.etc.COMPRESSED_SRGB8_ETC2,
		"etc2-rgb8a1unorm": t.etc.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2,
		"etc2-rgb8a1unorm-srgb": t.etc.COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2,
		"etc2-rgba8unorm": t.etc.COMPRESSED_RGBA8_ETC2_EAC,
		"etc2-rgba8unorm-srgb": t.etc.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC,
		"eac-r11unorm": t.etc.COMPRESSED_R11_EAC,
		"eac-rg11unorm": t.etc.COMPRESSED_SIGNED_RG11_EAC
	} : {}), t.astc ? {
		"astc-4x4-unorm": t.astc.COMPRESSED_RGBA_ASTC_4x4_KHR,
		"astc-4x4-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR,
		"astc-5x4-unorm": t.astc.COMPRESSED_RGBA_ASTC_5x4_KHR,
		"astc-5x4-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR,
		"astc-5x5-unorm": t.astc.COMPRESSED_RGBA_ASTC_5x5_KHR,
		"astc-5x5-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR,
		"astc-6x5-unorm": t.astc.COMPRESSED_RGBA_ASTC_6x5_KHR,
		"astc-6x5-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR,
		"astc-6x6-unorm": t.astc.COMPRESSED_RGBA_ASTC_6x6_KHR,
		"astc-6x6-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR,
		"astc-8x5-unorm": t.astc.COMPRESSED_RGBA_ASTC_8x5_KHR,
		"astc-8x5-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR,
		"astc-8x6-unorm": t.astc.COMPRESSED_RGBA_ASTC_8x6_KHR,
		"astc-8x6-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR,
		"astc-8x8-unorm": t.astc.COMPRESSED_RGBA_ASTC_8x8_KHR,
		"astc-8x8-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR,
		"astc-10x5-unorm": t.astc.COMPRESSED_RGBA_ASTC_10x5_KHR,
		"astc-10x5-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR,
		"astc-10x6-unorm": t.astc.COMPRESSED_RGBA_ASTC_10x6_KHR,
		"astc-10x6-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR,
		"astc-10x8-unorm": t.astc.COMPRESSED_RGBA_ASTC_10x8_KHR,
		"astc-10x8-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR,
		"astc-10x10-unorm": t.astc.COMPRESSED_RGBA_ASTC_10x10_KHR,
		"astc-10x10-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR,
		"astc-12x10-unorm": t.astc.COMPRESSED_RGBA_ASTC_12x10_KHR,
		"astc-12x10-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR,
		"astc-12x12-unorm": t.astc.COMPRESSED_RGBA_ASTC_12x12_KHR,
		"astc-12x12-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR
	} : {});
}
function yT(e) {
	return {
		r8unorm: e.UNSIGNED_BYTE,
		r8snorm: e.BYTE,
		r8uint: e.UNSIGNED_BYTE,
		r8sint: e.BYTE,
		r16uint: e.UNSIGNED_SHORT,
		r16sint: e.SHORT,
		r16float: e.HALF_FLOAT,
		rg8unorm: e.UNSIGNED_BYTE,
		rg8snorm: e.BYTE,
		rg8uint: e.UNSIGNED_BYTE,
		rg8sint: e.BYTE,
		r32uint: e.UNSIGNED_INT,
		r32sint: e.INT,
		r32float: e.FLOAT,
		rg16uint: e.UNSIGNED_SHORT,
		rg16sint: e.SHORT,
		rg16float: e.HALF_FLOAT,
		rgba8unorm: e.UNSIGNED_BYTE,
		"rgba8unorm-srgb": e.UNSIGNED_BYTE,
		rgba8snorm: e.BYTE,
		rgba8uint: e.UNSIGNED_BYTE,
		rgba8sint: e.BYTE,
		bgra8unorm: e.UNSIGNED_BYTE,
		"bgra8unorm-srgb": e.UNSIGNED_BYTE,
		rgb9e5ufloat: e.UNSIGNED_INT_5_9_9_9_REV,
		rgb10a2unorm: e.UNSIGNED_INT_2_10_10_10_REV,
		rg11b10ufloat: e.UNSIGNED_INT_10F_11F_11F_REV,
		rg32uint: e.UNSIGNED_INT,
		rg32sint: e.INT,
		rg32float: e.FLOAT,
		rgba16uint: e.UNSIGNED_SHORT,
		rgba16sint: e.SHORT,
		rgba16float: e.HALF_FLOAT,
		rgba32uint: e.UNSIGNED_INT,
		rgba32sint: e.INT,
		rgba32float: e.FLOAT,
		stencil8: e.UNSIGNED_BYTE,
		depth16unorm: e.UNSIGNED_SHORT,
		depth24plus: e.UNSIGNED_INT,
		"depth24plus-stencil8": e.UNSIGNED_INT_24_8,
		depth32float: e.FLOAT,
		"depth32float-stencil8": e.FLOAT_32_UNSIGNED_INT_24_8_REV
	};
}
function bT(e) {
	return {
		"2d": e.TEXTURE_2D,
		cube: e.TEXTURE_CUBE_MAP,
		"1d": null,
		"3d": e?.TEXTURE_3D || null,
		"2d-array": e?.TEXTURE_2D_ARRAY || null,
		"cube-array": e?.TEXTURE_CUBE_MAP_ARRAY || null
	};
}
var xT = Object.defineProperty, ST = Object.defineProperties, CT = Object.getOwnPropertyDescriptors, wT = Object.getOwnPropertySymbols, TT = Object.prototype.hasOwnProperty, ET = Object.prototype.propertyIsEnumerable, DT = (e, t, n) => t in e ? xT(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, OT = (e, t) => {
	for (var n in t ||= {}) TT.call(t, n) && DT(e, n, t[n]);
	if (wT) for (var n of wT(t)) ET.call(t, n) && DT(e, n, t[n]);
	return e;
}, kT = (e, t) => ST(e, CT(t)), AT = 4, jT = class e {
	constructor(t) {
		this._glSamplers = Object.create(null), this._boundTextures = [], this._activeTextureLocation = -1, this._boundSamplers = Object.create(null), this._premultiplyAlpha = !1, this._useSeparateSamplers = !1, this._renderer = t, this._managedTextures = new Bu({
			renderer: t,
			type: "resource",
			onUnload: this.onSourceUnload.bind(this),
			name: "glTexture"
		});
		let n = OT({
			image: Qw,
			buffer: qw,
			video: nT,
			compressed: Yw
		}, e.uploadExtensions);
		this._uploads = kT(OT({}, n), { cube: Zw(n) });
	}
	get managedTextures() {
		return Object.values(this._managedTextures.items);
	}
	contextChange(e) {
		this._gl = e, this._mapFormatToInternalFormat || (this._mapFormatToInternalFormat = vT(e, this._renderer.context.extensions), this._mapFormatToType = yT(e), this._mapFormatToFormat = cT(e), this._mapViewDimensionToGlTarget = bT(e)), this._managedTextures.removeAll(!0), this._glSamplers = Object.create(null), this._boundSamplers = Object.create(null), this._premultiplyAlpha = !1;
		for (let e = 0; e < 16; e++) this.bind(J.EMPTY, e);
	}
	initSource(e) {
		this.bind(e);
	}
	bind(e, t = 0) {
		let n = e.source;
		e ? (this.bindSource(n, t), this._useSeparateSamplers && this._bindSampler(n.style, t)) : (this.bindSource(null, t), this._useSeparateSamplers && this._bindSampler(null, t));
	}
	bindSource(e, t = 0) {
		let n = this._gl;
		if (e._gcLastUsed = this._renderer.gc.now, this._boundTextures[t] !== e) {
			this._boundTextures[t] = e, this._activateLocation(t), e ||= J.EMPTY.source;
			let r = this.getGlSource(e);
			n.bindTexture(r.target, r.texture);
		}
	}
	_bindSampler(e, t = 0) {
		let n = this._gl;
		if (!e) {
			this._boundSamplers[t] = null, n.bindSampler(t, null);
			return;
		}
		let r = this._getGlSampler(e);
		this._boundSamplers[t] !== r && (this._boundSamplers[t] = r, n.bindSampler(t, r));
	}
	unbind(e) {
		let t = e.source, n = this._boundTextures, r = this._gl;
		for (let e = 0; e < n.length; e++) if (n[e] === t) {
			this._activateLocation(e);
			let i = this.getGlSource(t);
			r.bindTexture(i.target, null), n[e] = null;
		}
	}
	_activateLocation(e) {
		this._activeTextureLocation !== e && (this._activeTextureLocation = e, this._gl.activeTexture(this._gl.TEXTURE0 + e));
	}
	_initSource(e) {
		let t = this._gl, n = new Kw(t.createTexture());
		if (n.type = this._mapFormatToType[e.format], n.internalFormat = this._mapFormatToInternalFormat[e.format], n.format = this._mapFormatToFormat[e.format], n.target = this._mapViewDimensionToGlTarget[e.viewDimension], n.target === null) throw Error(`Unsupported view dimension: ${e.viewDimension} with this webgl version: ${this._renderer.context.webGLVersion}`);
		if (e.uploadMethodId === "cube" && (n.target = t.TEXTURE_CUBE_MAP), e.autoGenerateMipmaps && (this._renderer.context.supports.nonPowOf2mipmaps || e.isPowerOfTwo)) {
			let t = Math.max(e.width, e.height);
			e.mipLevelCount = Math.floor(Math.log2(t)) + 1;
		}
		return e._gpuData[this._renderer.uid] = n, this._managedTextures.add(e) && (e.on("update", this.onSourceUpdate, this), e.on("resize", this.onSourceUpdate, this), e.on("styleChange", this.onStyleChange, this), e.on("updateMipmaps", this.onUpdateMipmaps, this)), this.onSourceUpdate(e), this.updateStyle(e, !1), n;
	}
	onStyleChange(e) {
		this.updateStyle(e, !1);
	}
	updateStyle(e, t) {
		let n = this._gl, r = this.getGlSource(e);
		n.bindTexture(r.target, r.texture), this._boundTextures[this._activeTextureLocation] = e, sT(e.style, n, e.mipLevelCount > 1, this._renderer.context.extensions.anisotropicFiltering, "texParameteri", r.target, !this._renderer.context.supports.nonPowOf2wrapping && !e.isPowerOfTwo, t);
	}
	onSourceUnload(e, t = !1) {
		let n = e._gpuData[this._renderer.uid];
		n && (t || (this.unbind(e), this._gl.deleteTexture(n.texture)), e.off("update", this.onSourceUpdate, this), e.off("resize", this.onSourceUpdate, this), e.off("styleChange", this.onStyleChange, this), e.off("updateMipmaps", this.onUpdateMipmaps, this));
	}
	onSourceUpdate(e) {
		let t = this._gl, n = this.getGlSource(e);
		t.bindTexture(n.target, n.texture), this._boundTextures[this._activeTextureLocation] = e;
		let r = e.alphaMode === "premultiply-alpha-on-upload";
		if (this._premultiplyAlpha !== r && (this._premultiplyAlpha = r, t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL, r)), this._uploads[e.uploadMethodId]) this._uploads[e.uploadMethodId].upload(e, n, t, this._renderer.context.webGLVersion);
		else if (n.target === t.TEXTURE_2D) this._initEmptyTexture2D(n, e);
		else if (n.target === t.TEXTURE_2D_ARRAY) this._initEmptyTexture2DArray(n, e);
		else if (n.target === t.TEXTURE_CUBE_MAP) this._initEmptyTextureCube(n, e);
		else throw Error("[GlTextureSystem] Unsupported texture target for empty allocation.");
		this._applyMipRange(n, e), e.autoGenerateMipmaps && e.mipLevelCount > 1 && this.onUpdateMipmaps(e, !1);
	}
	onUpdateMipmaps(e, t = !0) {
		t && this.bindSource(e, 0);
		let n = this.getGlSource(e);
		this._gl.generateMipmap(n.target);
	}
	_initEmptyTexture2D(e, t) {
		let n = this._gl;
		n.texImage2D(n.TEXTURE_2D, 0, e.internalFormat, t.pixelWidth, t.pixelHeight, 0, e.format, e.type, null);
		let r = Math.max(t.pixelWidth >> 1, 1), i = Math.max(t.pixelHeight >> 1, 1);
		for (let a = 1; a < t.mipLevelCount; a++) n.texImage2D(n.TEXTURE_2D, a, e.internalFormat, r, i, 0, e.format, e.type, null), r = Math.max(r >> 1, 1), i = Math.max(i >> 1, 1);
	}
	_initEmptyTexture2DArray(e, t) {
		if (this._renderer.context.webGLVersion !== 2) throw Error("[GlTextureSystem] TEXTURE_2D_ARRAY requires WebGL2.");
		let n = this._gl, r = Math.max(t.arrayLayerCount | 0, 1);
		n.texImage3D(n.TEXTURE_2D_ARRAY, 0, e.internalFormat, t.pixelWidth, t.pixelHeight, r, 0, e.format, e.type, null);
		let i = Math.max(t.pixelWidth >> 1, 1), a = Math.max(t.pixelHeight >> 1, 1);
		for (let o = 1; o < t.mipLevelCount; o++) n.texImage3D(n.TEXTURE_2D_ARRAY, o, e.internalFormat, i, a, r, 0, e.format, e.type, null), i = Math.max(i >> 1, 1), a = Math.max(a >> 1, 1);
	}
	_initEmptyTextureCube(e, t) {
		let n = this._gl;
		for (let r = 0; r < 6; r++) n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X + r, 0, e.internalFormat, t.pixelWidth, t.pixelHeight, 0, e.format, e.type, null);
		let r = Math.max(t.pixelWidth >> 1, 1), i = Math.max(t.pixelHeight >> 1, 1);
		for (let a = 1; a < t.mipLevelCount; a++) {
			for (let t = 0; t < 6; t++) n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X + t, a, e.internalFormat, r, i, 0, e.format, e.type, null);
			r = Math.max(r >> 1, 1), i = Math.max(i >> 1, 1);
		}
	}
	_applyMipRange(e, t) {
		if (this._renderer.context.webGLVersion !== 2 || t.mipLevelCount <= 1) return;
		let n = this._gl, r = Math.max((t.mipLevelCount | 0) - 1, 0);
		n.texParameteri(e.target, n.TEXTURE_BASE_LEVEL, 0), n.texParameteri(e.target, n.TEXTURE_MAX_LEVEL, r);
	}
	_initSampler(e) {
		let t = this._gl, n = this._gl.createSampler();
		return this._glSamplers[e._resourceId] = n, sT(e, t, this._boundTextures[this._activeTextureLocation].mipLevelCount > 1, this._renderer.context.extensions.anisotropicFiltering, "samplerParameteri", n, !1, !0), this._glSamplers[e._resourceId];
	}
	_getGlSampler(e) {
		return this._glSamplers[e._resourceId] || this._initSampler(e);
	}
	getGlSource(e) {
		return e._gcLastUsed = this._renderer.gc.now, e._gpuData[this._renderer.uid] || this._initSource(e);
	}
	generateCanvas(e) {
		let { pixels: t, width: n, height: r } = this.getPixels(e), i = X.get().createCanvas();
		i.width = n, i.height = r;
		let a = i.getContext("2d");
		if (a) {
			let e = a.createImageData(n, r);
			e.data.set(t), a.putImageData(e, 0, 0);
		}
		return i;
	}
	getPixels(e) {
		let t = e.source.resolution, n = e.frame, r = Math.max(Math.round(n.width * t), 1), i = Math.max(Math.round(n.height * t), 1), a = new Uint8Array(AT * r * i), o = this._renderer, s = o.renderTarget.getRenderTarget(e), c = o.renderTarget.getGpuRenderTarget(s), l = o.gl;
		return l.bindFramebuffer(l.FRAMEBUFFER, c.resolveTargetFramebuffer), l.readPixels(Math.round(n.x * t), Math.round(n.y * t), r, i, l.RGBA, l.UNSIGNED_BYTE, a), {
			pixels: new Uint8ClampedArray(a.buffer),
			width: r,
			height: i
		};
	}
	destroy() {
		this._managedTextures.destroy(), this._glSamplers = null, this._boundTextures = null, this._boundSamplers = null, this._mapFormatToInternalFormat = null, this._mapFormatToType = null, this._mapFormatToFormat = null, this._uploads = null, this._renderer = null;
	}
	resetState() {
		this._activeTextureLocation = -1, this._boundTextures.fill(J.EMPTY.source), this._boundSamplers = Object.create(null);
		let e = this._gl;
		this._premultiplyAlpha = !1, e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this._premultiplyAlpha);
	}
};
jT.extension = {
	type: [h.WebGLSystem],
	name: "texture"
}, jT.uploadExtensions = Object.create(null);
var MT = jT;
v.handleByMap(h.TextureUploaderWebGL, MT.uploadExtensions);
var NT = class {
	contextChange(e) {
		let t = new io({
			uColor: {
				value: new Float32Array([
					1,
					1,
					1,
					1
				]),
				type: "vec4<f32>"
			},
			uTransformMatrix: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uRound: {
				value: 0,
				type: "f32"
			}
		}), n = e.limits.maxBatchableTextures, r = Su({
			name: "graphics",
			bits: [
				wu,
				ju(n),
				n_,
				Nu
			]
		});
		this.shader = new po({
			glProgram: r,
			resources: {
				localUniforms: t,
				batchSamplers: Fu(n)
			}
		});
	}
	execute(e, t) {
		let n = t.context, r = n.customShader || this.shader, i = e.renderer, { batcher: a, instructions: o } = i.graphicsContext.getContextRenderData(n);
		r.groups[0] = i.globalUniforms.bindGroup, i.state.set(e.state), i.shader.bind(r), i.geometry.bind(a.geometry, r.glProgram);
		let s = o.instructions;
		for (let e = 0; e < o.instructionSize; e++) {
			let t = s[e];
			if (t.size) {
				for (let e = 0; e < t.textures.count; e++) i.texture.bind(t.textures.textures[e], e);
				i.geometry.draw(t.topology, t.size, t.start);
			}
		}
	}
	destroy() {
		this.shader.destroy(!0), this.shader = null;
	}
};
NT.extension = {
	type: [h.WebGLPipesAdaptor],
	name: "graphics"
};
var PT = class {
	init() {
		let e = Su({
			name: "mesh",
			bits: [
				n_,
				vb,
				Nu
			]
		});
		this._shader = new po({
			glProgram: e,
			resources: {
				uTexture: J.EMPTY.source,
				textureUniforms: { uTextureMatrix: {
					type: "mat3x3<f32>",
					value: new B()
				} }
			}
		});
	}
	execute(e, t) {
		let n = e.renderer, r = t._shader;
		if (r) {
			if (!r.glProgram) return;
		} else {
			r = this._shader;
			let e = t.texture, n = e.source;
			r.resources.uTexture = n, r.resources.uSampler = n.style, r.resources.textureUniforms.uniforms.uTextureMatrix = e.textureMatrix.mapCoord;
		}
		r.groups[100] = n.globalUniforms.bindGroup, r.groups[101] = e.localUniformsBindGroup, n.encoder.draw({
			geometry: t._geometry,
			shader: r,
			state: t.state
		});
	}
	destroy() {
		this._shader.destroy(!0), this._shader = null;
	}
};
PT.extension = {
	type: [h.WebGLPipesAdaptor],
	name: "mesh"
};
var FT = [
	...GS,
	dw,
	zC,
	yC,
	HC,
	cC,
	MT,
	pw,
	AC,
	Iw,
	Mw,
	VC,
	Gw,
	GC,
	BC
], IT = [...KS], LT = [
	fb,
	PT,
	NT
], RT = [], zT = [], BT = [];
v.handleByNamedList(h.WebGLSystem, RT), v.handleByNamedList(h.WebGLPipes, zT), v.handleByNamedList(h.WebGLPipesAdaptor, BT), v.add(...FT, ...IT, ...LT);
var VT = {
	__proto__: null,
	WebGLRenderer: class extends Ms {
		constructor() {
			let e = {
				name: "webgl",
				type: qa.WEBGL,
				systems: RT,
				renderPipes: zT,
				renderPipeAdaptors: BT
			};
			super(e);
		}
	}
}, HT = class {
	constructor(e) {
		this._hash = Object.create(null), this._renderer = e;
	}
	contextChange(e) {
		this._gpu = e;
	}
	getBindGroup(e, t, n) {
		return e._updateKey(), this._hash[e._key] || this._createBindGroup(e, t, n);
	}
	_createBindGroup(e, t, n) {
		let r = this._gpu.device, i = t.layout[n], a = [], o = this._renderer;
		for (let t in i) {
			let n = e.resources[t] ?? e.resources[i[t]], r;
			if (n._resourceType === "uniformGroup") {
				let e = n;
				o.ubo.updateUniformGroup(e);
				let t = e.buffer;
				r = {
					buffer: o.buffer.getGPUBuffer(t),
					offset: 0,
					size: t.descriptor.size
				};
			} else if (n._resourceType === "buffer") {
				let e = n;
				r = {
					buffer: o.buffer.getGPUBuffer(e),
					offset: 0,
					size: e.descriptor.size
				};
			} else if (n._resourceType === "bufferResource") {
				let e = n;
				r = {
					buffer: o.buffer.getGPUBuffer(e.buffer),
					offset: e.offset,
					size: e.size
				};
			} else if (n._resourceType === "textureSampler") {
				let e = n;
				r = o.texture.getGpuSampler(e);
			} else if (n._resourceType === "textureSource") {
				let e = n;
				r = o.texture.getTextureView(e);
			}
			a.push({
				binding: i[t],
				resource: r
			});
		}
		let s = o.shader.getProgramData(t).bindGroups[n], c = r.createBindGroup({
			layout: s,
			entries: a
		});
		return this._hash[e._key] = c, c;
	}
	destroy() {
		this._hash = null, this._renderer = null;
	}
};
HT.extension = {
	type: [h.WebGPUSystem],
	name: "bindGroup"
};
var UT = class {
	constructor(e) {
		this.gpuBuffer = e;
	}
	destroy() {
		this.gpuBuffer.destroy(), this.gpuBuffer = null;
	}
}, WT = class {
	constructor(e) {
		this._renderer = e, this._managedBuffers = new Bu({
			renderer: e,
			type: "resource",
			onUnload: this.onBufferUnload.bind(this),
			name: "gpuBuffer"
		});
	}
	contextChange(e) {
		this._gpu = e;
	}
	getGPUBuffer(e) {
		return e._gcLastUsed = this._renderer.gc.now, e._gpuData[this._renderer.uid]?.gpuBuffer || this.createGPUBuffer(e);
	}
	updateBuffer(e) {
		let t = this.getGPUBuffer(e), n = e.data;
		return e._updateID && n && (e._updateID = 0, this._gpu.device.queue.writeBuffer(t, 0, n.buffer, 0, (e._updateSize || n.byteLength) + 3 & -4)), t;
	}
	destroyAll() {
		this._managedBuffers.removeAll();
	}
	onBufferUnload(e) {
		e.off("update", this.updateBuffer, this), e.off("change", this.onBufferChange, this);
	}
	createGPUBuffer(e) {
		let t = this._gpu.device.createBuffer(e.descriptor);
		return e._updateID = 0, e._resourceId = H("resource"), e.data && (vl(e.data.buffer, t.getMappedRange(), e.data.byteOffset, e.data.byteLength), t.unmap()), e._gpuData[this._renderer.uid] = new UT(t), this._managedBuffers.add(e) && (e.on("update", this.updateBuffer, this), e.on("change", this.onBufferChange, this)), t;
	}
	onBufferChange(e) {
		this._managedBuffers.remove(e), e._updateID = 0, this.createGPUBuffer(e);
	}
	destroy() {
		this._managedBuffers.destroy(), this._renderer = null, this._gpu = null;
	}
};
WT.extension = {
	type: [h.WebGPUSystem],
	name: "buffer"
};
var GT = class {
	constructor({ minUniformOffsetAlignment: e }) {
		this._minUniformOffsetAlignment = 256, this.byteIndex = 0, this._minUniformOffsetAlignment = e, this.data = /* @__PURE__ */ new Float32Array(65535);
	}
	clear() {
		this.byteIndex = 0;
	}
	addEmptyGroup(e) {
		if (e > this._minUniformOffsetAlignment / 4) throw Error(`UniformBufferBatch: array is too large: ${e * 4}`);
		let t = this.byteIndex, n = t + e * 4;
		if (n = Math.ceil(n / this._minUniformOffsetAlignment) * this._minUniformOffsetAlignment, n > this.data.length * 4) throw Error("UniformBufferBatch: ubo batch got too big");
		return this.byteIndex = n, t;
	}
	addGroup(e) {
		let t = this.addEmptyGroup(e.length);
		for (let n = 0; n < e.length; n++) this.data[t / 4 + n] = e[n];
		return t;
	}
	destroy() {
		this.data = null;
	}
}, KT = class {
	constructor(e) {
		this._colorMaskCache = 15, this._renderer = e;
	}
	setMask(e) {
		this._colorMaskCache !== e && (this._colorMaskCache = e, this._renderer.pipeline.setColorMask(e));
	}
	destroy() {
		this._renderer = null, this._colorMaskCache = null;
	}
};
KT.extension = {
	type: [h.WebGPUSystem],
	name: "colorMask"
};
var qT = class {
	constructor(e) {
		this._renderer = e;
	}
	async init(e) {
		return this._initPromise ||= (e.gpu ? Promise.resolve(e.gpu) : this._createDeviceAndAdaptor(e)).then((e) => {
			this.gpu = e, this.extensions = { transientAttachment: typeof GPUTextureUsage.TRANSIENT_ATTACHMENT == "number" }, this._renderer.runners.contextChange.emit(this.gpu);
		}), this._initPromise;
	}
	contextChange(e) {
		this._renderer.gpu = e;
	}
	async _createDeviceAndAdaptor(e) {
		let t = await X.get().getNavigator().gpu.requestAdapter({
			powerPreference: e.powerPreference,
			forceFallbackAdapter: e.forceFallbackAdapter
		}), n = [
			"texture-compression-bc",
			"texture-compression-astc",
			"texture-compression-etc2"
		].filter((e) => t.features.has(e));
		return {
			adapter: t,
			device: await t.requestDevice({ requiredFeatures: n })
		};
	}
	destroy() {
		this.gpu = null, this.extensions = null, this._renderer = null;
	}
};
qT.extension = {
	type: [h.WebGPUSystem],
	name: "device"
}, qT.defaultOptions = {
	powerPreference: void 0,
	forceFallbackAdapter: !1
};
var JT = Object.defineProperty, YT = Object.getOwnPropertySymbols, XT = Object.prototype.hasOwnProperty, ZT = Object.prototype.propertyIsEnumerable, QT = (e, t, n) => t in e ? JT(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, $T = (e, t) => {
	for (var n in t ||= {}) XT.call(t, n) && QT(e, n, t[n]);
	if (YT) for (var n of YT(t)) ZT.call(t, n) && QT(e, n, t[n]);
	return e;
}, eE = class {
	constructor(e) {
		this._boundBindGroup = Object.create(null), this._boundVertexBuffer = Object.create(null), this._renderer = e;
	}
	renderStart() {
		this.commandFinished = new Promise((e) => {
			this._resolveCommandFinished = e;
		}), this.commandEncoder = this._renderer.gpu.device.createCommandEncoder();
	}
	beginRenderPass(e) {
		this.endRenderPass(), this._clearCache(), this.renderPassEncoder = this.commandEncoder.beginRenderPass(e.descriptor);
	}
	endRenderPass() {
		this.renderPassEncoder && this.renderPassEncoder.end(), this.renderPassEncoder = null;
	}
	setViewport(e) {
		this.renderPassEncoder.setViewport(e.x, e.y, e.width, e.height, 0, 1);
	}
	setPipelineFromGeometryProgramAndState(e, t, n, r) {
		let i = this._renderer.pipeline.getPipeline(e, t, n, r);
		this.setPipeline(i);
	}
	setPipeline(e) {
		this._boundPipeline !== e && (this._boundPipeline = e, this.renderPassEncoder.setPipeline(e));
	}
	_setVertexBuffer(e, t) {
		this._boundVertexBuffer[e] !== t && (this._boundVertexBuffer[e] = t, this.renderPassEncoder.setVertexBuffer(e, this._renderer.buffer.updateBuffer(t)));
	}
	_setIndexBuffer(e) {
		if (this._boundIndexBuffer === e) return;
		this._boundIndexBuffer = e;
		let t = e.data.BYTES_PER_ELEMENT === 2 ? "uint16" : "uint32";
		this.renderPassEncoder.setIndexBuffer(this._renderer.buffer.updateBuffer(e), t);
	}
	resetBindGroup(e) {
		this._boundBindGroup[e] = null;
	}
	setBindGroup(e, t, n) {
		if (this._boundBindGroup[e] === t) return;
		this._boundBindGroup[e] = t, t._touch(this._renderer.gc.now, this._renderer.tick);
		let r = this._renderer.bindGroup.getBindGroup(t, n, e);
		this.renderPassEncoder.setBindGroup(e, r);
	}
	setGeometry(e, t) {
		let n = this._renderer.pipeline.getBufferNamesToBind(e, t);
		for (let t in n) this._setVertexBuffer(parseInt(t, 10), e.attributes[n[t]].buffer);
		e.indexBuffer && this._setIndexBuffer(e.indexBuffer);
	}
	_setShaderBindGroups(e, t) {
		for (let n in e.groups) {
			let r = e.groups[n];
			t || this._syncBindGroup(r), this.setBindGroup(n, r, e.gpuProgram);
		}
	}
	_syncBindGroup(e) {
		for (let t in e.resources) {
			let n = e.resources[t];
			n.isUniformGroup && this._renderer.ubo.updateUniformGroup(n);
		}
	}
	draw(e) {
		let { geometry: t, shader: n, state: r, topology: i, size: a, start: o, instanceCount: s, skipSync: c } = e;
		this.setPipelineFromGeometryProgramAndState(t, n.gpuProgram, r, i), this.setGeometry(t, n.gpuProgram), this._setShaderBindGroups(n, c), t.indexBuffer ? this.renderPassEncoder.drawIndexed(a || t.indexBuffer.data.length, s ?? t.instanceCount, o || 0) : this.renderPassEncoder.draw(a || t.getSize(), s ?? t.instanceCount, o || 0);
	}
	finishRenderPass() {
		this.renderPassEncoder &&= (this.renderPassEncoder.end(), null);
	}
	postrender() {
		this.finishRenderPass(), this._gpu.device.queue.submit([this.commandEncoder.finish()]), this._resolveCommandFinished(), this.commandEncoder = null;
	}
	restoreRenderPass() {
		let e = this._renderer.renderTarget.adaptor.getDescriptor(this._renderer.renderTarget.renderTarget, !1, [
			0,
			0,
			0,
			1
		], this._renderer.renderTarget.mipLevel, this._renderer.renderTarget.layer);
		this.renderPassEncoder = this.commandEncoder.beginRenderPass(e);
		let t = this._boundPipeline, n = $T({}, this._boundVertexBuffer), r = this._boundIndexBuffer, i = $T({}, this._boundBindGroup);
		this._clearCache();
		let a = this._renderer.renderTarget.viewport;
		this.renderPassEncoder.setViewport(a.x, a.y, a.width, a.height, 0, 1), this.setPipeline(t);
		for (let e in n) this._setVertexBuffer(e, n[e]);
		for (let e in i) this.setBindGroup(e, i[e], null);
		this._setIndexBuffer(r);
	}
	_clearCache() {
		for (let e = 0; e < 16; e++) this._boundBindGroup[e] = null, this._boundVertexBuffer[e] = null;
		this._boundIndexBuffer = null, this._boundPipeline = null;
	}
	destroy() {
		this._renderer = null, this._gpu = null, this._boundBindGroup = null, this._boundVertexBuffer = null, this._boundIndexBuffer = null, this._boundPipeline = null;
	}
	contextChange(e) {
		this._gpu = e;
	}
};
eE.extension = {
	type: [h.WebGPUSystem],
	name: "encoder",
	priority: 1
};
var tE = class {
	constructor(e) {
		this._renderer = e;
	}
	contextChange() {
		this.maxTextures = this._renderer.device.gpu.device.limits.maxSampledTexturesPerShaderStage, this.maxBatchableTextures = this.maxTextures;
	}
	destroy() {}
};
tE.extension = {
	type: [h.WebGPUSystem],
	name: "limits"
};
var nE = class {
	constructor(e) {
		this._renderTargetStencilState = Object.create(null), this._renderer = e, e.renderTarget.onRenderTargetChange.add(this);
	}
	onRenderTargetChange(e) {
		let t = this._renderTargetStencilState[e.uid];
		t ||= this._renderTargetStencilState[e.uid] = {
			stencilMode: bl.DISABLED,
			stencilReference: 0
		}, this._activeRenderTarget = e, this.setStencilMode(t.stencilMode, t.stencilReference);
	}
	setStencilMode(e, t) {
		let n = this._renderTargetStencilState[this._activeRenderTarget.uid];
		n.stencilMode = e, n.stencilReference = t;
		let r = this._renderer;
		r.pipeline.setStencilMode(e), r.encoder.renderPassEncoder.setStencilReference(t);
	}
	destroy() {
		this._renderer.renderTarget.onRenderTargetChange.remove(this), this._renderer = null, this._activeRenderTarget = null, this._renderTargetStencilState = null;
	}
};
nE.extension = {
	type: [h.WebGPUSystem],
	name: "stencil"
};
var rE = {
	i32: {
		align: 4,
		size: 4
	},
	u32: {
		align: 4,
		size: 4
	},
	f32: {
		align: 4,
		size: 4
	},
	f16: {
		align: 2,
		size: 2
	},
	"vec2<i32>": {
		align: 8,
		size: 8
	},
	"vec2<u32>": {
		align: 8,
		size: 8
	},
	"vec2<f32>": {
		align: 8,
		size: 8
	},
	"vec2<f16>": {
		align: 4,
		size: 4
	},
	"vec3<i32>": {
		align: 16,
		size: 12
	},
	"vec3<u32>": {
		align: 16,
		size: 12
	},
	"vec3<f32>": {
		align: 16,
		size: 12
	},
	"vec3<f16>": {
		align: 8,
		size: 6
	},
	"vec4<i32>": {
		align: 16,
		size: 16
	},
	"vec4<u32>": {
		align: 16,
		size: 16
	},
	"vec4<f32>": {
		align: 16,
		size: 16
	},
	"vec4<f16>": {
		align: 8,
		size: 8
	},
	"mat2x2<f32>": {
		align: 8,
		size: 16
	},
	"mat2x2<f16>": {
		align: 4,
		size: 8
	},
	"mat3x2<f32>": {
		align: 8,
		size: 24
	},
	"mat3x2<f16>": {
		align: 4,
		size: 12
	},
	"mat4x2<f32>": {
		align: 8,
		size: 32
	},
	"mat4x2<f16>": {
		align: 4,
		size: 16
	},
	"mat2x3<f32>": {
		align: 16,
		size: 32
	},
	"mat2x3<f16>": {
		align: 8,
		size: 16
	},
	"mat3x3<f32>": {
		align: 16,
		size: 48
	},
	"mat3x3<f16>": {
		align: 8,
		size: 24
	},
	"mat4x3<f32>": {
		align: 16,
		size: 64
	},
	"mat4x3<f16>": {
		align: 8,
		size: 32
	},
	"mat2x4<f32>": {
		align: 16,
		size: 32
	},
	"mat2x4<f16>": {
		align: 8,
		size: 16
	},
	"mat3x4<f32>": {
		align: 16,
		size: 48
	},
	"mat3x4<f16>": {
		align: 8,
		size: 24
	},
	"mat4x4<f32>": {
		align: 16,
		size: 64
	},
	"mat4x4<f16>": {
		align: 8,
		size: 32
	}
};
function iE(e) {
	let t = e.map((e) => ({
		data: e,
		offset: 0,
		size: 0
	})), n = 0;
	for (let e = 0; e < t.length; e++) {
		let r = t[e], i = rE[r.data.type].size, a = rE[r.data.type].align;
		if (!rE[r.data.type]) throw Error(`[Pixi.js] WebGPU UniformBuffer: Unknown type ${r.data.type}`);
		r.data.size > 1 && (i = Math.max(i, a) * r.data.size), n = Math.ceil(n / a) * a, r.size = i, r.offset = n, n += i;
	}
	return n = Math.ceil(n / 16) * 16, {
		uboElements: t,
		size: n
	};
}
function aE(e, t) {
	let { size: n, align: r } = rE[e.data.type], i = (r - n) / 4, a = e.data.type.indexOf("i32") >= 0 ? "dataInt32" : "data";
	return `
         v = uv.${e.data.name};
         ${t === 0 ? "" : `offset += ${t};`}

         arrayOffset = offset;

         t = 0;

         for(var i=0; i < ${e.data.size * (n / 4)}; i++)
         {
             for(var j = 0; j < ${n / 4}; j++)
             {
                 ${a}[arrayOffset++] = v[t++];
             }
             ${i === 0 ? "" : `arrayOffset += ${i};`}
         }
     `;
}
function oE(e) {
	return XC(e, "uboWgsl", aE, cw);
}
var sE = class extends KC {
	constructor() {
		super({
			createUboElements: iE,
			generateUboSync: oE
		});
	}
};
sE.extension = {
	type: [h.WebGPUSystem],
	name: "ubo"
};
var cE = 128, lE = class {
	constructor(e) {
		this._bindGroupHash = Object.create(null), this._buffers = [], this._bindGroups = [], this._bufferResources = [], this._renderer = e, this._batchBuffer = new GT({ minUniformOffsetAlignment: cE });
		let t = 256 / cE;
		for (let e = 0; e < t; e++) {
			let t = Q.UNIFORM | Q.COPY_DST;
			e === 0 && (t |= Q.COPY_SRC), this._buffers.push(new Ao({
				data: this._batchBuffer.data,
				usage: t
			}));
		}
	}
	renderEnd() {
		this._uploadBindGroups(), this._resetBindGroups();
	}
	_resetBindGroups() {
		this._bindGroupHash = Object.create(null), this._batchBuffer.clear();
	}
	getUniformBindGroup(e, t) {
		if (!t && this._bindGroupHash[e.uid]) return this._bindGroupHash[e.uid];
		this._renderer.ubo.ensureUniformGroup(e);
		let n = e.buffer.data, r = this._batchBuffer.addEmptyGroup(n.length);
		return this._renderer.ubo.syncUniformGroup(e, this._batchBuffer.data, r / 4), this._bindGroupHash[e.uid] = this._getBindGroup(r / cE), this._bindGroupHash[e.uid];
	}
	getUboResource(e) {
		this._renderer.ubo.updateUniformGroup(e);
		let t = e.buffer.data, n = this._batchBuffer.addGroup(t);
		return this._getBufferResource(n / cE);
	}
	getArrayBindGroup(e) {
		let t = this._batchBuffer.addGroup(e);
		return this._getBindGroup(t / cE);
	}
	getArrayBufferResource(e) {
		let t = this._batchBuffer.addGroup(e) / cE;
		return this._getBufferResource(t);
	}
	_getBufferResource(e) {
		if (!this._bufferResources[e]) {
			let t = this._buffers[e % 2];
			this._bufferResources[e] = new mw({
				buffer: t,
				offset: (e / 2 | 0) * 256,
				size: cE
			});
		}
		return this._bufferResources[e];
	}
	_getBindGroup(e) {
		if (!this._bindGroups[e]) {
			let t = new Ka({ 0: this._getBufferResource(e) });
			this._bindGroups[e] = t;
		}
		return this._bindGroups[e];
	}
	_uploadBindGroups() {
		let e = this._renderer.buffer, t = this._buffers[0];
		t.update(this._batchBuffer.byteIndex), e.updateBuffer(t);
		let n = this._renderer.gpu.device.createCommandEncoder();
		for (let r = 1; r < this._buffers.length; r++) {
			let i = this._buffers[r];
			n.copyBufferToBuffer(e.getGPUBuffer(t), cE, e.getGPUBuffer(i), 0, this._batchBuffer.byteIndex);
		}
		this._renderer.gpu.device.queue.submit([n.finish()]);
	}
	destroy() {
		var e;
		for (let t = 0; t < this._bindGroups.length; t++) (e = this._bindGroups[t]) == null || e.destroy();
		this._bindGroups = null, this._bindGroupHash = null;
		for (let e = 0; e < this._buffers.length; e++) this._buffers[e].destroy();
		this._buffers = null;
		for (let e = 0; e < this._bufferResources.length; e++) this._bufferResources[e].destroy();
		this._bufferResources = null, this._batchBuffer.destroy(), this._renderer = null;
	}
};
lE.extension = {
	type: [h.WebGPUPipes],
	name: "uniformBatch"
};
var uE = Object.defineProperty, dE = Object.defineProperties, fE = Object.getOwnPropertyDescriptors, pE = Object.getOwnPropertySymbols, mE = Object.prototype.hasOwnProperty, hE = Object.prototype.propertyIsEnumerable, gE = (e, t, n) => t in e ? uE(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, _E = (e, t) => {
	for (var n in t ||= {}) mE.call(t, n) && gE(e, n, t[n]);
	if (pE) for (var n of pE(t)) hE.call(t, n) && gE(e, n, t[n]);
	return e;
}, vE = (e, t) => dE(e, fE(t)), yE = {
	"point-list": 0,
	"line-list": 1,
	"line-strip": 2,
	"triangle-list": 3,
	"triangle-strip": 4
};
function bE(e, t, n, r, i) {
	return e << 24 | t << 16 | n << 10 | r << 5 | i;
}
function xE(e, t, n, r, i) {
	return n << 8 | e << 5 | r << 3 | i << 1 | t;
}
var SE = class {
	constructor(e) {
		this._moduleCache = Object.create(null), this._bufferLayoutsCache = Object.create(null), this._bindingNamesCache = Object.create(null), this._pipeCache = Object.create(null), this._pipeStateCaches = Object.create(null), this._colorMask = 15, this._multisampleCount = 1, this._colorTargetCount = 1, this._renderer = e;
	}
	contextChange(e) {
		this._gpu = e, this.setStencilMode(bl.DISABLED), this._updatePipeHash();
	}
	setMultisampleCount(e) {
		this._multisampleCount !== e && (this._multisampleCount = e, this._updatePipeHash());
	}
	setRenderTarget(e) {
		this._multisampleCount = e.msaaSamples, this._depthStencilAttachment = +!!e.descriptor.depthStencilAttachment, this._colorTargetCount = e.colorTargetCount, this._updatePipeHash();
	}
	setColorMask(e) {
		this._colorMask !== e && (this._colorMask = e, this._updatePipeHash());
	}
	setStencilMode(e) {
		this._stencilMode !== e && (this._stencilMode = e, this._stencilState = WC[e], this._updatePipeHash());
	}
	setPipeline(e, t, n, r) {
		let i = this.getPipeline(e, t, n);
		r.setPipeline(i);
	}
	getPipeline(e, t, n, r) {
		e._layoutKey || (bC(e, t.attributeData), this._generateBufferKey(e)), r ||= e.topology;
		let i = bE(e._layoutKey, t._layoutKey, n.data, n._blendModeId, yE[r]);
		return this._pipeCache[i] || (this._pipeCache[i] = this._createPipeline(e, t, n, r)), this._pipeCache[i];
	}
	_createPipeline(e, t, n, r) {
		let i = this._gpu.device, a = this._createVertexBufferLayouts(e, t), o = this._renderer.state.getColorTargets(n, this._colorTargetCount), s = this._stencilMode === bl.RENDERING_MASK_ADD ? 0 : this._colorMask;
		for (let e = 0; e < o.length; e++) o[e].writeMask = s;
		let c = this._renderer.shader.getProgramData(t).pipeline, l = {
			vertex: {
				module: this._getModule(t.vertex.source),
				entryPoint: t.vertex.entryPoint,
				buffers: a
			},
			fragment: {
				module: this._getModule(t.fragment.source),
				entryPoint: t.fragment.entryPoint,
				targets: o
			},
			primitive: {
				topology: r,
				cullMode: n.cullMode
			},
			layout: c,
			multisample: { count: this._multisampleCount },
			label: "PIXI Pipeline"
		};
		return this._depthStencilAttachment && (l.depthStencil = vE(_E({}, this._stencilState), {
			format: "depth24plus-stencil8",
			depthWriteEnabled: n.depthTest,
			depthCompare: n.depthTest ? "less" : "always"
		})), i.createRenderPipeline(l);
	}
	_getModule(e) {
		return this._moduleCache[e] || this._createModule(e);
	}
	_createModule(e) {
		let t = this._gpu.device;
		return this._moduleCache[e] = t.createShaderModule({ code: e }), this._moduleCache[e];
	}
	_generateBufferKey(e) {
		let t = [], n = 0, r = Object.keys(e.attributes).sort();
		for (let i = 0; i < r.length; i++) {
			let a = e.attributes[r[i]];
			t[n++] = a.offset, t[n++] = a.format, t[n++] = a.stride, t[n++] = a.instance;
		}
		return e._layoutKey = ua(t.join("|"), "geometry"), e._layoutKey;
	}
	_generateAttributeLocationsKey(e) {
		let t = [], n = 0, r = Object.keys(e.attributeData).sort();
		for (let i = 0; i < r.length; i++) {
			let a = e.attributeData[r[i]];
			t[n++] = a.location;
		}
		return e._attributeLocationsKey = ua(t.join("|"), "programAttributes"), e._attributeLocationsKey;
	}
	getBufferNamesToBind(e, t) {
		let n = e._layoutKey << 16 | t._attributeLocationsKey;
		if (this._bindingNamesCache[n]) return this._bindingNamesCache[n];
		let r = this._createVertexBufferLayouts(e, t), i = Object.create(null), a = t.attributeData;
		for (let e = 0; e < r.length; e++) {
			let t = Object.values(r[e].attributes)[0].shaderLocation;
			for (let n in a) if (a[n].location === t) {
				i[e] = n;
				break;
			}
		}
		return this._bindingNamesCache[n] = i, i;
	}
	_createVertexBufferLayouts(e, t) {
		t._attributeLocationsKey || this._generateAttributeLocationsKey(t);
		let n = e._layoutKey << 16 | t._attributeLocationsKey;
		if (this._bufferLayoutsCache[n]) return this._bufferLayoutsCache[n];
		let r = [];
		return e.buffers.forEach((n) => {
			let i = {
				arrayStride: 0,
				stepMode: "vertex",
				attributes: []
			}, a = i.attributes;
			for (let r in t.attributeData) {
				let o = e.attributes[r];
				(o.divisor ?? 1) !== 1 && vf(`Attribute ${r} has an invalid divisor value of '${o.divisor}'. WebGPU only supports a divisor value of 1`), o.buffer === n && (i.arrayStride = o.stride, i.stepMode = o.instance ? "instance" : "vertex", a.push({
					shaderLocation: t.attributeData[r].location,
					offset: o.offset,
					format: o.format
				}));
			}
			a.length && r.push(i);
		}), this._bufferLayoutsCache[n] = r, r;
	}
	_updatePipeHash() {
		let e = xE(this._stencilMode, this._multisampleCount, this._colorMask, this._depthStencilAttachment, this._colorTargetCount);
		this._pipeStateCaches[e] || (this._pipeStateCaches[e] = Object.create(null)), this._pipeCache = this._pipeStateCaches[e];
	}
	destroy() {
		this._renderer = null, this._bufferLayoutsCache = null;
	}
};
SE.extension = {
	type: [h.WebGPUSystem],
	name: "pipeline"
};
var CE = class {
	constructor() {
		this.contexts = [], this.msaaTextures = [], this.msaaSamples = 1;
	}
}, wE = class {
	init(e, t) {
		this._renderer = e, this._renderTargetSystem = t;
	}
	copyToTexture(e, t, n, r, i) {
		let a = this._renderer, o = this._getGpuColorTexture(e), s = a.texture.getGpuSource(t.source);
		return a.encoder.commandEncoder.copyTextureToTexture({
			texture: o,
			origin: n
		}, {
			texture: s,
			origin: i
		}, r), t;
	}
	startRenderPass(e, t = !0, n, r, i = 0, a = 0) {
		var o, s;
		let c = this._renderTargetSystem.getGpuRenderTarget(e);
		if (a !== 0 && (o = c.msaaTextures) != null && o.length) throw Error("[RenderTargetSystem] Rendering to array layers is not supported with MSAA render targets.");
		if (i > 0 && (s = c.msaaTextures) != null && s.length) throw Error("[RenderTargetSystem] Rendering to mip levels is not supported with MSAA render targets.");
		c.descriptor = this.getDescriptor(e, t, n, i, a), this._renderer.pipeline.setRenderTarget(c), this._renderer.encoder.beginRenderPass(c), this._renderer.encoder.setViewport(r);
	}
	finishRenderPass() {
		this._renderer.encoder.endRenderPass();
	}
	_getGpuColorTexture(e) {
		let t = this._renderTargetSystem.getGpuRenderTarget(e);
		return t.contexts[0] ? t.contexts[0].getCurrentTexture() : this._renderer.texture.getGpuSource(e.colorTextures[0].source);
	}
	getDescriptor(e, t, n, r = 0, i = 0) {
		var a;
		typeof t == "boolean" && (t = t ? Ss.ALL : Ss.NONE);
		let o = this._renderTargetSystem, s = o.getGpuRenderTarget(e), c = e.colorTextures.map((e, a) => {
			let c = s.contexts[a], l, u;
			if (c) {
				if (i !== 0) throw Error("[RenderTargetSystem] Rendering to array layers is not supported for canvas targets.");
				l = c.getCurrentTexture().createView();
			} else l = this._renderer.texture.getGpuSource(e).createView({
				dimension: "2d",
				baseMipLevel: r,
				mipLevelCount: 1,
				baseArrayLayer: i,
				arrayLayerCount: 1
			});
			let d = !1;
			s.msaaTextures[a] && (u = l, l = this._renderer.texture.getTextureView(s.msaaTextures[a]), d = s.msaaTextures[a].transient);
			let f = t & Ss.COLOR ? "clear" : "load";
			return n ??= o.defaultClearColor, {
				view: l,
				resolveTarget: u,
				clearValue: n,
				storeOp: d ? "discard" : "store",
				loadOp: f
			};
		}), l;
		if ((e.stencil || e.depth) && !e.depthStencilTexture && (e.ensureDepthStencilTexture(), e.depthStencilTexture.source.sampleCount = s.msaa ? 4 : 1, e.depthStencilTexture.source.transient = !!((a = s.msaaTextures[0]) != null && a.transient)), e.depthStencilTexture) {
			let n = t & Ss.STENCIL ? "clear" : "load", a = t & Ss.DEPTH ? "clear" : "load", o = e.depthStencilTexture.source.transient ? "discard" : "store";
			l = {
				view: this._renderer.texture.getGpuSource(e.depthStencilTexture.source).createView({
					dimension: "2d",
					baseMipLevel: r,
					mipLevelCount: 1,
					baseArrayLayer: i,
					arrayLayerCount: 1
				}),
				stencilStoreOp: o,
				stencilLoadOp: n,
				depthClearValue: 1,
				depthLoadOp: a,
				depthStoreOp: o
			};
		}
		return {
			colorAttachments: c,
			depthStencilAttachment: l
		};
	}
	clear(e, t = !0, n, r, i = 0, a = 0) {
		if (!t) return;
		let { gpu: o, encoder: s } = this._renderer, c = o.device;
		if (s.commandEncoder === null) {
			let o = c.createCommandEncoder(), s = this.getDescriptor(e, t, n, i, a), l = o.beginRenderPass(s);
			l.setViewport(r.x, r.y, r.width, r.height, 0, 1), l.end();
			let u = o.finish();
			c.queue.submit([u]);
		} else this.startRenderPass(e, t, n, r, i, a);
	}
	initGpuRenderTarget(e) {
		var t;
		e.isRoot = !0;
		let n = new CE();
		return n.colorTargetCount = e.colorTextures.length, e.colorTextures.forEach((e, t) => {
			if (e instanceof xi) {
				let r = e.resource.getContext("webgpu"), i = e.transparent ? "premultiplied" : "opaque";
				try {
					r.configure({
						device: this._renderer.gpu.device,
						usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
						format: "bgra8unorm",
						alphaMode: i
					});
				} catch (e) {
					console.error(e);
				}
				n.contexts[t] = r;
			}
			if (n.msaa = e.source.antialias, e.source.antialias) {
				let r = new It({
					width: 0,
					height: 0,
					sampleCount: 4,
					transient: e.source.transient,
					arrayLayerCount: e.source.arrayLayerCount
				});
				n.msaaTextures[t] = r;
			}
		}), n.msaa && (n.msaaSamples = 4, e.depthStencilTexture && (e.depthStencilTexture.source.sampleCount = 4, e.depthStencilTexture.source.transient = !!((t = n.msaaTextures[0]) != null && t.transient))), n;
	}
	destroyGpuRenderTarget(e) {
		e.contexts.forEach((e) => {
			e.unconfigure();
		}), e.msaaTextures.forEach((e) => {
			e.destroy();
		}), e.msaaTextures.length = 0, e.contexts.length = 0;
	}
	ensureDepthStencilTexture(e) {
		let t = this._renderTargetSystem.getGpuRenderTarget(e);
		e.depthStencilTexture && t.msaa && (e.depthStencilTexture.source.sampleCount = 4);
	}
	resizeGpuRenderTarget(e) {
		let t = this._renderTargetSystem.getGpuRenderTarget(e);
		t.width = e.width, t.height = e.height, t.msaa && e.colorTextures.forEach((e, n) => {
			t.msaaTextures[n]?.resize(e.source.width, e.source.height, e.source._resolution);
		});
	}
}, TE = class extends YS {
	constructor(e) {
		super(e), this.adaptor = new wE(), this.adaptor.init(e, this);
	}
};
TE.extension = {
	type: [h.WebGPUSystem],
	name: "renderTarget"
};
var EE = class {
	constructor() {
		this._gpuProgramData = Object.create(null);
	}
	contextChange(e) {
		this._gpu = e;
	}
	getProgramData(e) {
		return this._gpuProgramData[e._layoutKey] || this._createGPUProgramData(e);
	}
	_createGPUProgramData(e) {
		let t = this._gpu.device, n = e.gpuLayout.map((e) => t.createBindGroupLayout({ entries: e })), r = { bindGroupLayouts: n };
		return this._gpuProgramData[e._layoutKey] = {
			bindGroups: n,
			pipeline: t.createPipelineLayout(r)
		}, this._gpuProgramData[e._layoutKey];
	}
	destroy() {
		this._gpu = null, this._gpuProgramData = null;
	}
};
EE.extension = {
	type: [h.WebGPUSystem],
	name: "shader"
};
var DE = {};
DE.normal = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "one",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	}
}, DE.add = {
	alpha: {
		srcFactor: "src-alpha",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "one",
		dstFactor: "one",
		operation: "add"
	}
}, DE.multiply = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "dst",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	}
}, DE.screen = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "one",
		dstFactor: "one-minus-src",
		operation: "add"
	}
}, DE.overlay = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "one",
		dstFactor: "one-minus-src",
		operation: "add"
	}
}, DE.none = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "zero",
		dstFactor: "zero",
		operation: "add"
	}
}, DE["normal-npm"] = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "src-alpha",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	}
}, DE["add-npm"] = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one",
		operation: "add"
	},
	color: {
		srcFactor: "src-alpha",
		dstFactor: "one",
		operation: "add"
	}
}, DE["screen-npm"] = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "src-alpha",
		dstFactor: "one-minus-src",
		operation: "add"
	}
}, DE.erase = {
	alpha: {
		srcFactor: "zero",
		dstFactor: "one-minus-src-alpha",
		operation: "add"
	},
	color: {
		srcFactor: "zero",
		dstFactor: "one-minus-src",
		operation: "add"
	}
}, DE.min = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one",
		operation: "min"
	},
	color: {
		srcFactor: "one",
		dstFactor: "one",
		operation: "min"
	}
}, DE.max = {
	alpha: {
		srcFactor: "one",
		dstFactor: "one",
		operation: "max"
	},
	color: {
		srcFactor: "one",
		dstFactor: "one",
		operation: "max"
	}
};
var OE = class {
	constructor() {
		this.defaultState = new go(), this.defaultState.blend = !0;
	}
	contextChange(e) {
		this.gpu = e;
	}
	getColorTargets(e, t) {
		let n = DE[e.blendMode] || DE.normal, r = [], i = {
			format: "bgra8unorm",
			writeMask: 0,
			blend: n
		};
		for (let e = 0; e < t; e++) r[e] = i;
		return r;
	}
	destroy() {
		this.gpu = null;
	}
};
OE.extension = {
	type: [h.WebGPUSystem],
	name: "state"
};
var kE = {
	type: "image",
	upload(e, t, n, r = 0) {
		let i = e.resource, a = (e.pixelWidth | 0) * (e.pixelHeight | 0), o = i.byteLength / a;
		n.device.queue.writeTexture({
			texture: t,
			origin: {
				x: 0,
				y: 0,
				z: r
			}
		}, i, {
			offset: 0,
			rowsPerImage: e.pixelHeight,
			bytesPerRow: e.pixelWidth * o
		}, {
			width: e.pixelWidth,
			height: e.pixelHeight,
			depthOrArrayLayers: 1
		});
	}
}, AE = {
	"bc1-rgba-unorm": {
		blockBytes: 8,
		blockWidth: 4,
		blockHeight: 4
	},
	"bc2-rgba-unorm": {
		blockBytes: 16,
		blockWidth: 4,
		blockHeight: 4
	},
	"bc3-rgba-unorm": {
		blockBytes: 16,
		blockWidth: 4,
		blockHeight: 4
	},
	"bc7-rgba-unorm": {
		blockBytes: 16,
		blockWidth: 4,
		blockHeight: 4
	},
	"etc1-rgb-unorm": {
		blockBytes: 8,
		blockWidth: 4,
		blockHeight: 4
	},
	"etc2-rgba8unorm": {
		blockBytes: 16,
		blockWidth: 4,
		blockHeight: 4
	},
	"astc-4x4-unorm": {
		blockBytes: 16,
		blockWidth: 4,
		blockHeight: 4
	}
}, jE = {
	blockBytes: 4,
	blockWidth: 1,
	blockHeight: 1
}, ME = {
	type: "compressed",
	upload(e, t, n, r = 0) {
		let i = e.pixelWidth, a = e.pixelHeight, o = AE[e.format] || jE;
		for (let s = 0; s < e.resource.length; s++) {
			let c = e.resource[s], l = Math.ceil(i / o.blockWidth) * o.blockBytes;
			n.device.queue.writeTexture({
				texture: t,
				mipLevel: s,
				origin: {
					x: 0,
					y: 0,
					z: r
				}
			}, c, {
				offset: 0,
				bytesPerRow: l
			}, {
				width: Math.ceil(i / o.blockWidth) * o.blockWidth,
				height: Math.ceil(a / o.blockHeight) * o.blockHeight,
				depthOrArrayLayers: 1
			}), i = Math.max(i >> 1, 1), a = Math.max(a >> 1, 1);
		}
	}
}, NE = [
	"right",
	"left",
	"top",
	"bottom",
	"front",
	"back"
];
function PE(e) {
	return {
		type: "cube",
		upload(t, n, r) {
			let i = t.faces;
			for (let t = 0; t < NE.length; t++) {
				let a = i[NE[t]];
				(e[a.uploadMethodId] || e.image).upload(a, n, r, t);
			}
		}
	};
}
var FE = {
	type: "image",
	upload(e, t, n, r = 0) {
		let i = e.resource;
		if (!i) return;
		if (globalThis.HTMLImageElement && i instanceof HTMLImageElement) {
			let t = X.get().createCanvas(i.width, i.height);
			t.getContext("2d").drawImage(i, 0, 0, i.width, i.height), e.resource = t;
		}
		let a = Math.min(t.width, e.resourceWidth || e.pixelWidth), o = Math.min(t.height, e.resourceHeight || e.pixelHeight), s = e.alphaMode === "premultiply-alpha-on-upload";
		n.device.queue.copyExternalImageToTexture({ source: i }, {
			texture: t,
			origin: {
				x: 0,
				y: 0,
				z: r
			},
			premultipliedAlpha: s
		}, {
			width: a,
			height: o
		});
	}
}, IE = {
	type: "video",
	upload(e, t, n, r) {
		FE.upload(e, t, n, r);
	}
}, LE = class {
	constructor(e) {
		this.device = e, this.sampler = e.createSampler({ minFilter: "linear" }), this.pipelines = {};
	}
	_getMipmapPipeline(e) {
		let t = this.pipelines[e];
		return t || (this.mipmapShaderModule ||= this.device.createShaderModule({ code: "\n                        var<private> pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(\n                        vec2<f32>(-1.0, -1.0), vec2<f32>(-1.0, 3.0), vec2<f32>(3.0, -1.0));\n\n                        struct VertexOutput {\n                        @builtin(position) position : vec4<f32>,\n                        @location(0) texCoord : vec2<f32>,\n                        };\n\n                        @vertex\n                        fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {\n                        var output : VertexOutput;\n                        output.texCoord = pos[vertexIndex] * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5);\n                        output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);\n                        return output;\n                        }\n\n                        @group(0) @binding(0) var imgSampler : sampler;\n                        @group(0) @binding(1) var img : texture_2d<f32>;\n\n                        @fragment\n                        fn fragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {\n                        return textureSample(img, imgSampler, texCoord);\n                        }\n                    " }), t = this.device.createRenderPipeline({
			layout: "auto",
			vertex: {
				module: this.mipmapShaderModule,
				entryPoint: "vertexMain"
			},
			fragment: {
				module: this.mipmapShaderModule,
				entryPoint: "fragmentMain",
				targets: [{ format: e }]
			}
		}), this.pipelines[e] = t), t;
	}
	generateMipmap(e) {
		let t = this._getMipmapPipeline(e.format);
		if (e.dimension === "3d" || e.dimension === "1d") throw Error("Generating mipmaps for non-2d textures is currently unsupported!");
		let n = e, r = e.depthOrArrayLayers || 1, i = e.usage & GPUTextureUsage.RENDER_ATTACHMENT;
		if (!i) {
			let t = {
				size: {
					width: Math.ceil(e.width / 2),
					height: Math.ceil(e.height / 2),
					depthOrArrayLayers: r
				},
				format: e.format,
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
				mipLevelCount: e.mipLevelCount - 1
			};
			n = this.device.createTexture(t);
		}
		let a = this.device.createCommandEncoder({}), o = t.getBindGroupLayout(0);
		for (let s = 0; s < r; ++s) {
			let r = e.createView({
				baseMipLevel: 0,
				mipLevelCount: 1,
				dimension: "2d",
				baseArrayLayer: s,
				arrayLayerCount: 1
			}), c = +!!i;
			for (let i = 1; i < e.mipLevelCount; ++i) {
				let e = n.createView({
					baseMipLevel: c++,
					mipLevelCount: 1,
					dimension: "2d",
					baseArrayLayer: s,
					arrayLayerCount: 1
				}), i = a.beginRenderPass({ colorAttachments: [{
					view: e,
					storeOp: "store",
					loadOp: "clear",
					clearValue: {
						r: 0,
						g: 0,
						b: 0,
						a: 0
					}
				}] }), l = this.device.createBindGroup({
					layout: o,
					entries: [{
						binding: 0,
						resource: this.sampler
					}, {
						binding: 1,
						resource: r
					}]
				});
				i.setPipeline(t), i.setBindGroup(0, l), i.draw(3, 1, 0, 0), i.end(), r = e;
			}
		}
		if (!i) {
			let t = {
				width: Math.ceil(e.width / 2),
				height: Math.ceil(e.height / 2),
				depthOrArrayLayers: r
			};
			for (let r = 1; r < e.mipLevelCount; ++r) a.copyTextureToTexture({
				texture: n,
				mipLevel: r - 1
			}, {
				texture: e,
				mipLevel: r
			}, t), t.width = Math.ceil(t.width / 2), t.height = Math.ceil(t.height / 2);
		}
		return this.device.queue.submit([a.finish()]), i || n.destroy(), e;
	}
}, RE = Object.defineProperty, zE = Object.defineProperties, BE = Object.getOwnPropertyDescriptors, VE = Object.getOwnPropertySymbols, HE = Object.prototype.hasOwnProperty, UE = Object.prototype.propertyIsEnumerable, WE = (e, t, n) => t in e ? RE(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, GE = (e, t) => {
	for (var n in t ||= {}) HE.call(t, n) && WE(e, n, t[n]);
	if (VE) for (var n of VE(t)) UE.call(t, n) && WE(e, n, t[n]);
	return e;
}, KE = (e, t) => zE(e, BE(t)), qE = class {
	constructor(e) {
		this.textureView = null, this.gpuTexture = e;
	}
	destroy() {
		this.gpuTexture.destroy(), this.textureView = null, this.gpuTexture = null;
	}
}, JE = class e {
	constructor(t) {
		this._gpuSamplers = Object.create(null), this._bindGroupHash = Object.create(null), this._renderer = t, t.gc.addCollection(this, "_bindGroupHash", "hash"), this._managedTextures = new Bu({
			renderer: t,
			type: "resource",
			onUnload: this.onSourceUnload.bind(this),
			name: "gpuTextureSource"
		});
		let n = GE({
			image: FE,
			buffer: kE,
			video: IE,
			compressed: ME
		}, e.uploadExtensions);
		this._uploads = KE(GE({}, n), { cube: PE(n) });
	}
	get managedTextures() {
		return Object.values(this._managedTextures.items);
	}
	contextChange(e) {
		this._gpu = e;
	}
	initSource(e) {
		return e._gpuData[this._renderer.uid]?.gpuTexture || this._initSource(e);
	}
	_initSource(e) {
		if (e.autoGenerateMipmaps) {
			let t = Math.max(e.pixelWidth, e.pixelHeight);
			e.mipLevelCount = Math.floor(Math.log2(t)) + 1;
		}
		let t;
		e.sampleCount > 1 ? (t = GPUTextureUsage.RENDER_ATTACHMENT, e.transient && this._renderer.device.extensions.transientAttachment && (t |= GPUTextureUsage.TRANSIENT_ATTACHMENT)) : (t = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST, e.uploadMethodId !== "compressed" && (t |= GPUTextureUsage.RENDER_ATTACHMENT, t |= GPUTextureUsage.COPY_SRC));
		let n = AE[e.format] || {
			blockBytes: 4,
			blockWidth: 1,
			blockHeight: 1
		}, r = Math.ceil(e.pixelWidth / n.blockWidth) * n.blockWidth, i = Math.ceil(e.pixelHeight / n.blockHeight) * n.blockHeight, a = {
			label: e.label,
			size: {
				width: r,
				height: i,
				depthOrArrayLayers: e.arrayLayerCount
			},
			format: e.format,
			sampleCount: e.sampleCount,
			mipLevelCount: e.mipLevelCount,
			dimension: e.dimension,
			usage: t
		}, o = this._gpu.device.createTexture(a);
		return e._gpuData[this._renderer.uid] = new qE(o), this._managedTextures.add(e) && (e.on("update", this.onSourceUpdate, this), e.on("resize", this.onSourceResize, this), e.on("updateMipmaps", this.onUpdateMipmaps, this)), this.onSourceUpdate(e), o;
	}
	onSourceUpdate(e) {
		let t = this.getGpuSource(e);
		t && (this._uploads[e.uploadMethodId] && this._uploads[e.uploadMethodId].upload(e, t, this._gpu), e.autoGenerateMipmaps && e.mipLevelCount > 1 && this.onUpdateMipmaps(e));
	}
	onUpdateMipmaps(e) {
		this._mipmapGenerator ||= new LE(this._gpu.device);
		let t = this.getGpuSource(e);
		this._mipmapGenerator.generateMipmap(t);
	}
	onSourceUnload(e) {
		e.off("update", this.onSourceUpdate, this), e.off("resize", this.onSourceResize, this), e.off("updateMipmaps", this.onUpdateMipmaps, this);
	}
	onSourceResize(e) {
		e._gcLastUsed = this._renderer.gc.now;
		let t = e._gpuData[this._renderer.uid], n = t?.gpuTexture;
		n ? (n.width !== e.pixelWidth || n.height !== e.pixelHeight) && (t.destroy(), this._bindGroupHash[e.uid] = null, e._gpuData[this._renderer.uid] = null, this.initSource(e)) : this.initSource(e);
	}
	_initSampler(e) {
		return this._gpuSamplers[e._resourceId] = this._gpu.device.createSampler(e), this._gpuSamplers[e._resourceId];
	}
	getGpuSampler(e) {
		return this._gpuSamplers[e._resourceId] || this._initSampler(e);
	}
	getGpuSource(e) {
		return e._gcLastUsed = this._renderer.gc.now, e._gpuData[this._renderer.uid]?.gpuTexture || this.initSource(e);
	}
	getTextureBindGroup(e) {
		return this._bindGroupHash[e.uid] || this._createTextureBindGroup(e);
	}
	_createTextureBindGroup(e) {
		let t = e.source;
		return this._bindGroupHash[e.uid] = new Ka({
			0: t,
			1: t.style,
			2: new io({ uTextureMatrix: {
				type: "mat3x3<f32>",
				value: e.textureMatrix.mapCoord
			} })
		}), this._bindGroupHash[e.uid];
	}
	getTextureView(e) {
		let t = e.source;
		t._gcLastUsed = this._renderer.gc.now;
		let n = t._gpuData[this._renderer.uid];
		return n ||= (this.initSource(t), t._gpuData[this._renderer.uid]), n.textureView || (n.textureView = n.gpuTexture.createView({ dimension: t.viewDimension })), n.textureView;
	}
	generateCanvas(e) {
		let t = this._renderer, n = t.gpu.device.createCommandEncoder(), r = X.get().createCanvas();
		r.width = e.source.pixelWidth, r.height = e.source.pixelHeight;
		let i = r.getContext("webgpu");
		return i.configure({
			device: t.gpu.device,
			usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
			format: X.get().getNavigator().gpu.getPreferredCanvasFormat(),
			alphaMode: "premultiplied"
		}), n.copyTextureToTexture({
			texture: t.texture.getGpuSource(e.source),
			origin: {
				x: 0,
				y: 0
			}
		}, { texture: i.getCurrentTexture() }, {
			width: r.width,
			height: r.height
		}), t.gpu.device.queue.submit([n.finish()]), r;
	}
	getPixels(e) {
		let t = this.generateCanvas(e), n = Wi.getOptimalCanvasAndContext(t.width, t.height), r = n.context;
		r.drawImage(t, 0, 0);
		let { width: i, height: a } = t, o = r.getImageData(0, 0, i, a), s = new Uint8ClampedArray(o.data.buffer);
		return Wi.returnCanvasAndContext(n), {
			pixels: s,
			width: i,
			height: a
		};
	}
	destroy() {
		this._managedTextures.destroy();
		for (let e of Object.keys(this._bindGroupHash)) {
			let t = Number(e);
			this._bindGroupHash[t]?.destroy();
		}
		this._renderer = null, this._gpu = null, this._mipmapGenerator = null, this._gpuSamplers = null, this._bindGroupHash = null;
	}
};
JE.extension = {
	type: [h.WebGPUSystem],
	name: "texture"
}, JE.uploadExtensions = Object.create(null);
var YE = JE;
v.handleByMap(h.TextureUploaderWebGPU, YE.uploadExtensions);
var XE = class {
	constructor() {
		this._maxTextures = 0;
	}
	contextChange(e) {
		let t = new io({
			uTransformMatrix: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uColor: {
				value: new Float32Array([
					1,
					1,
					1,
					1
				]),
				type: "vec4<f32>"
			},
			uRound: {
				value: 0,
				type: "f32"
			}
		});
		this._maxTextures = e.limits.maxBatchableTextures;
		let n = xu({
			name: "graphics",
			bits: [
				Cu,
				Ou(this._maxTextures),
				t_,
				Mu
			]
		});
		this.shader = new po({
			gpuProgram: n,
			resources: { localUniforms: t }
		});
	}
	execute(e, t) {
		let n = t.context, r = n.customShader || this.shader, i = e.renderer, { batcher: a, instructions: o } = i.graphicsContext.getContextRenderData(n), s = i.encoder;
		s.setGeometry(a.geometry, r.gpuProgram);
		let c = i.globalUniforms.bindGroup;
		s.setBindGroup(0, c, r.gpuProgram);
		let l = i.renderPipes.uniformBatch.getUniformBindGroup(r.resources.localUniforms, !0);
		s.setBindGroup(2, l, r.gpuProgram);
		let u = o.instructions, d = null;
		for (let t = 0; t < o.instructionSize; t++) {
			let n = u[t];
			if (n.topology !== d && (d = n.topology, s.setPipelineFromGeometryProgramAndState(a.geometry, r.gpuProgram, e.state, n.topology)), r.groups[1] = n.bindGroup, !n.gpuBindGroup) {
				let e = n.textures;
				n.bindGroup = dl(e.textures, e.count, this._maxTextures), n.gpuBindGroup = i.bindGroup.getBindGroup(n.bindGroup, r.gpuProgram, 1);
			}
			s.setBindGroup(1, n.bindGroup, r.gpuProgram), s.renderPassEncoder.drawIndexed(n.size, 1, n.start);
		}
	}
	destroy() {
		this.shader.destroy(!0), this.shader = null;
	}
};
XE.extension = {
	type: [h.WebGPUPipesAdaptor],
	name: "graphics"
};
var ZE = class {
	init() {
		let e = xu({
			name: "mesh",
			bits: [
				e_,
				_b,
				Mu
			]
		});
		this._shader = new po({
			gpuProgram: e,
			resources: {
				uTexture: J.EMPTY._source,
				uSampler: J.EMPTY._source.style,
				textureUniforms: { uTextureMatrix: {
					type: "mat3x3<f32>",
					value: new B()
				} }
			}
		});
	}
	execute(e, t) {
		let n = e.renderer, r = t._shader;
		if (!r) r = this._shader, r.groups[2] = n.texture.getTextureBindGroup(t.texture);
		else if (!r.gpuProgram) return;
		let i = r.gpuProgram;
		if (i.autoAssignGlobalUniforms && (r.groups[0] = n.globalUniforms.bindGroup), i.autoAssignLocalUniforms) {
			let t = e.localUniforms;
			r.groups[1] = n.renderPipes.uniformBatch.getUniformBindGroup(t, !0);
		}
		n.encoder.draw({
			geometry: t._geometry,
			shader: r,
			state: t.state
		});
	}
	destroy() {
		this._shader.destroy(!0), this._shader = null;
	}
};
ZE.extension = {
	type: [h.WebGPUPipesAdaptor],
	name: "mesh"
};
var QE = [
	...GS,
	sE,
	eE,
	qT,
	tE,
	WT,
	YE,
	TE,
	EE,
	OE,
	SE,
	KT,
	nE,
	HT
], $E = [...KS, lE], eD = [
	mb,
	ZE,
	XE
], tD = [], nD = [], rD = [];
v.handleByNamedList(h.WebGPUSystem, tD), v.handleByNamedList(h.WebGPUPipes, nD), v.handleByNamedList(h.WebGPUPipesAdaptor, rD), v.add(...QE, ...$E, ...eD);
var iD = {
	__proto__: null,
	WebGPURenderer: class extends Ms {
		constructor() {
			let e = {
				name: "webgpu",
				type: qa.WEBGPU,
				systems: tD,
				renderPipes: nD,
				renderPipeAdaptors: rD
			};
			super(e);
		}
	}
};
new Proxy({
	POINTS: "point-list",
	LINES: "line-list",
	LINE_STRIP: "line-strip",
	TRIANGLES: "triangle-list",
	TRIANGLE_STRIP: "triangle-strip"
}, { get(e, t) {
	return e[t];
} });
var aD = ((e) => (e.CLAMP = "clamp-to-edge", e.REPEAT = "repeat", e.MIRRORED_REPEAT = "mirror-repeat", e))(aD || {});
new Proxy(aD, { get(e, t) {
	return e[t];
} });
var oD = ((e) => (e.NEAREST = "nearest", e.LINEAR = "linear", e))(oD || {});
new Proxy(oD, { get(e, t) {
	return e[t];
} }), Math.PI * 2;
var sD = Object.defineProperty, cD = Object.getOwnPropertySymbols, lD = Object.prototype.hasOwnProperty, uD = Object.prototype.propertyIsEnumerable, dD = (e, t, n) => t in e ? sD(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, fD = (e, t) => {
	for (var n in t ||= {}) lD.call(t, n) && dD(e, n, t[n]);
	if (cD) for (var n of cD(t)) uD.call(t, n) && dD(e, n, t[n]);
	return e;
}, pD = class e extends Y {
	constructor(t = {}) {
		t = fD(fD({}, e.defaultOptions), t), super(), this.renderLayerChildren = [], this.sortableChildren = t.sortableChildren, this.sortFunction = t.sortFunction;
	}
	attach(...e) {
		for (let t = 0; t < e.length; t++) {
			let n = e[t];
			if (n.parentRenderLayer) {
				if (n.parentRenderLayer === this) continue;
				n.parentRenderLayer.detach(n);
			}
			this.renderLayerChildren.push(n), n.parentRenderLayer = this;
			let r = this.renderGroup || this.parentRenderGroup;
			r && (r.structureDidChange = !0);
		}
		return e[0];
	}
	detach(...e) {
		for (let t = 0; t < e.length; t++) {
			let n = e[t], r = this.renderLayerChildren.indexOf(n);
			r !== -1 && this.renderLayerChildren.splice(r, 1), n.parentRenderLayer = null;
			let i = this.renderGroup || this.parentRenderGroup;
			i && (i.structureDidChange = !0);
		}
		return e[0];
	}
	detachAll() {
		let e = this.renderLayerChildren;
		for (let t = 0; t < e.length; t++) e[t].parentRenderLayer = null;
		this.renderLayerChildren.length = 0;
	}
	collectRenderables(e, t, n) {
		let r = this.renderLayerChildren, i = r.length;
		this.sortableChildren && this.sortRenderLayerChildren();
		for (let n = 0; n < i; n++) r[n].parent || vf("Container must be added to both layer and scene graph. Layers only handle render order - the scene graph is required for transforms (addChild)", r[n]), r[n].collectRenderables(e, t, this);
	}
	sortRenderLayerChildren() {
		this.renderLayerChildren.sort(this.sortFunction);
	}
	_getGlobalBoundsRecursive(e, t, n) {
		if (!e) return;
		let r = this.renderLayerChildren;
		for (let e = 0; e < r.length; e++) r[e]._getGlobalBoundsRecursive(!0, t, this);
	}
	getFastGlobalBounds(e, t) {
		return super.getFastGlobalBounds(e, t);
	}
	addChild(...e) {
		throw Error("RenderLayer.addChild() is not available. Please use RenderLayer.attach()");
	}
	removeChild(...e) {
		throw Error("RenderLayer.removeChild() is not available. Please use RenderLayer.detach()");
	}
	removeChildren(e, t) {
		throw Error("RenderLayer.removeChildren() is not available. Please use RenderLayer.detach()");
	}
	removeChildAt(e) {
		throw Error("RenderLayer.removeChildAt() is not available");
	}
	getChildAt(e) {
		throw Error("RenderLayer.getChildAt() is not available");
	}
	setChildIndex(e, t) {
		throw Error("RenderLayer.setChildIndex() is not available");
	}
	getChildIndex(e) {
		throw Error("RenderLayer.getChildIndex() is not available");
	}
	addChildAt(e, t) {
		throw Error("RenderLayer.addChildAt() is not available");
	}
	swapChildren(e, t) {
		throw Error("RenderLayer.swapChildren() is not available");
	}
	reparentChild(...e) {
		throw Error("RenderLayer.reparentChild() is not available with the render layer");
	}
	reparentChildAt(e, t) {
		throw Error("RenderLayer.reparentChildAt() is not available with the render layer");
	}
};
pD.defaultOptions = {
	sortableChildren: !1,
	sortFunction: (e, t) => e.zIndex - t.zIndex
};
var mD = Object.defineProperty, hD = Object.getOwnPropertySymbols, gD = Object.prototype.hasOwnProperty, _D = Object.prototype.propertyIsEnumerable, vD = (e, t, n) => t in e ? mD(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, yD = (e, t) => {
	for (var n in t ||= {}) gD.call(t, n) && vD(e, n, t[n]);
	if (hD) for (var n of hD(t)) _D.call(t, n) && vD(e, n, t[n]);
	return e;
}, bD = class e extends _g {
	constructor(...e) {
		super({});
		let t = e[0] ?? {};
		typeof t == "number" && (t = {
			width: t,
			height: e[1],
			verticesX: e[2],
			verticesY: e[3]
		}), this.build(t);
	}
	build(t) {
		t = yD(yD({}, e.defaultOptions), t), this.verticesX = this.verticesX ?? t.verticesX, this.verticesY = this.verticesY ?? t.verticesY, this.width = this.width ?? t.width, this.height = this.height ?? t.height;
		let n = this.verticesX * this.verticesY, r = [], i = [], a = [], o = this.verticesX - 1, s = this.verticesY - 1, c = this.width / o, l = this.height / s;
		for (let e = 0; e < n; e++) {
			let t = e % this.verticesX, n = e / this.verticesX | 0;
			r.push(t * c, n * l), i.push(t / o, n / s);
		}
		let u = o * s;
		for (let e = 0; e < u; e++) {
			let t = e % o, n = e / o | 0, r = n * this.verticesX + t, i = n * this.verticesX + t + 1, s = (n + 1) * this.verticesX + t, c = (n + 1) * this.verticesX + t + 1;
			a.push(r, i, s, i, c, s);
		}
		this.buffers[0].data = new Float32Array(r), this.buffers[1].data = new Float32Array(i), this.indexBuffer.data = new Uint32Array(a), this.buffers[0].update(), this.buffers[1].update(), this.indexBuffer.update();
	}
};
bD.defaultOptions = {
	width: 100,
	height: 100,
	verticesX: 10,
	verticesY: 10
};
var xD = bD;
function SD(e, t, n, r) {
	let i = n.buffers[0], a = i.data, { verticesX: o, verticesY: s } = n, c = e / (o - 1), l = t / (s - 1), u = 0, d = r[0], f = r[1], p = r[2], m = r[3], h = r[4], g = r[5], _ = r[6], v = r[7], y = r[8];
	for (let e = 0; e < a.length; e += 2) {
		let t = u % o * c, n = (u / o | 0) * l, r = d * t + f * n + p, i = m * t + h * n + g, s = _ * t + v * n + y;
		a[e] = r / s, a[e + 1] = i / s, u++;
	}
	i.update();
}
function CD(e, t) {
	let n = t[0], r = t[1], i = t[2], a = t[3], o = t[4], s = t[5], c = t[6], l = t[7], u = t[8];
	return e[0] = o * u - s * l, e[1] = i * l - r * u, e[2] = r * s - i * o, e[3] = s * c - a * u, e[4] = n * u - i * c, e[5] = i * a - n * s, e[6] = a * l - o * c, e[7] = r * c - n * l, e[8] = n * o - r * a, e;
}
function wD(e, t, n) {
	let r = t[0], i = t[1], a = t[2], o = t[3], s = t[4], c = t[5], l = t[6], u = t[7], d = t[8], f = n[0], p = n[1], m = n[2], h = n[3], g = n[4], _ = n[5], v = n[6], y = n[7], b = n[8];
	return e[0] = f * r + p * o + m * l, e[1] = f * i + p * s + m * u, e[2] = f * a + p * c + m * d, e[3] = h * r + g * o + _ * l, e[4] = h * i + g * s + _ * u, e[5] = h * a + g * c + _ * d, e[6] = v * r + y * o + b * l, e[7] = v * i + y * s + b * u, e[8] = v * a + y * c + b * d, e;
}
function TD(e, t, n) {
	let r = n[0], i = n[1], a = n[2];
	return e[0] = t[0] * r + t[1] * i + t[2] * a, e[1] = t[3] * r + t[4] * i + t[5] * a, e[2] = t[6] * r + t[7] * i + t[8] * a, e;
}
var ED = [
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0
], DD = [
	0,
	0,
	0
], OD = [
	0,
	0,
	0
];
function kD(e, t, n, r, i, a, o, s, c) {
	let l = ED;
	l[0] = t, l[1] = r, l[2] = a, l[3] = n, l[4] = i, l[5] = o, l[6] = 1, l[7] = 1, l[8] = 1;
	let u = CD(e, l);
	OD[0] = s, OD[1] = c, OD[2] = 1;
	let d = TD(DD, u, OD), f = e;
	return e[0] = d[0], e[1] = 0, e[2] = 0, e[3] = 0, e[4] = d[1], e[5] = 0, e[6] = 0, e[7] = 0, e[8] = d[2], wD(e, f, l);
}
var AD = [
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0
], jD = [
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0
];
function MD(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h, g) {
	let _ = kD(AD, t, n, a, o, l, u, p, m), v = kD(jD, r, i, s, c, d, f, h, g);
	return wD(e, CD(_, _), v);
}
var ND = class extends xD {
	constructor(e) {
		super(e), this._projectionMatrix = [
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0
		];
		let { width: t, height: n } = e;
		this.corners = [
			0,
			0,
			t,
			0,
			t,
			n,
			0,
			n
		];
	}
	setCorners(e, t, n, r, i, a, o, s) {
		let c = this.corners;
		c[0] = e, c[1] = t, c[2] = n, c[3] = r, c[4] = i, c[5] = a, c[6] = o, c[7] = s, this.updateProjection();
	}
	updateProjection() {
		let { width: e, height: t } = this, n = this.corners, r = MD(this._projectionMatrix, 0, 0, n[0], n[1], e, 0, n[2], n[3], e, t, n[4], n[5], 0, t, n[6], n[7]);
		SD(e, t, this, r);
	}
}, PD = Object.defineProperty, FD = Object.defineProperties, ID = Object.getOwnPropertyDescriptors, LD = Object.getOwnPropertySymbols, RD = Object.prototype.hasOwnProperty, zD = Object.prototype.propertyIsEnumerable, BD = (e, t, n) => t in e ? PD(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, VD = (e, t) => {
	for (var n in t ||= {}) RD.call(t, n) && BD(e, n, t[n]);
	if (LD) for (var n of LD(t)) zD.call(t, n) && BD(e, n, t[n]);
	return e;
}, HD = (e, t) => FD(e, ID(t)), UD = (e, t) => {
	var n = {};
	for (var r in e) RD.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && LD) for (var r of LD(e)) t.indexOf(r) < 0 && zD.call(e, r) && (n[r] = e[r]);
	return n;
}, WD = class e extends Og {
	constructor(t) {
		t = VD(VD({}, e.defaultOptions), t);
		let n = t, { texture: r, verticesX: i, verticesY: a } = n, o = UD(n, [
			"texture",
			"verticesX",
			"verticesY"
		]), s = new ND(vt({
			width: r.width,
			height: r.height,
			verticesX: i,
			verticesY: a
		}));
		super(vt(HD(VD({}, o), { geometry: s }))), this._texture = r, this.geometry.setCorners(t.x0, t.y0, t.x1, t.y1, t.x2, t.y2, t.x3, t.y3);
	}
	textureUpdated() {
		let e = this.geometry;
		if (!e) return;
		let { width: t, height: n } = this.texture;
		(e.width !== t || e.height !== n) && (e.width = t, e.height = n, e.updateProjection());
	}
	set texture(e) {
		this._texture !== e && (super.texture = e, this.textureUpdated());
	}
	get texture() {
		return this._texture;
	}
	setCorners(e, t, n, r, i, a, o, s) {
		this.geometry.setCorners(e, t, n, r, i, a, o, s);
	}
};
WD.defaultOptions = {
	texture: J.WHITE,
	verticesX: 10,
	verticesY: 10,
	x0: 0,
	y0: 0,
	x1: 100,
	y1: 0,
	x2: 100,
	y2: 100,
	x3: 0,
	y3: 100
};
var GD = Object.defineProperty, KD = Object.getOwnPropertySymbols, qD = Object.prototype.hasOwnProperty, JD = Object.prototype.propertyIsEnumerable, YD = (e, t, n) => t in e ? GD(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, XD = (e, t) => {
	for (var n in t ||= {}) qD.call(t, n) && YD(e, n, t[n]);
	if (KD) for (var n of KD(t)) JD.call(t, n) && YD(e, n, t[n]);
	return e;
}, ZD = class e extends _g {
	constructor(t) {
		let { width: n, points: r, textureScale: i } = XD(XD({}, e.defaultOptions), t);
		super({
			positions: new Float32Array(r.length * 4),
			uvs: new Float32Array(r.length * 4),
			indices: new Uint32Array((r.length - 1) * 6)
		}), this.points = r, this._width = n, this.textureScale = i, this._build();
	}
	get width() {
		return this._width;
	}
	_build() {
		let e = this.points;
		if (!e) return;
		let t = this.getBuffer("aPosition"), n = this.getBuffer("aUV"), r = this.getIndex();
		if (e.length < 1) return;
		t.data.length / 4 !== e.length && (t.data = new Float32Array(e.length * 4), n.data = new Float32Array(e.length * 4), r.data = new Uint16Array((e.length - 1) * 6));
		let i = n.data, a = r.data;
		i[0] = 0, i[1] = 0, i[2] = 0, i[3] = 1;
		let o = 0, s = e[0], c = this._width * this.textureScale, l = e.length;
		for (let t = 0; t < l; t++) {
			let n = t * 4;
			if (this.textureScale > 0) {
				let n = s.x - e[t].x, r = s.y - e[t].y, i = Math.sqrt(n * n + r * r);
				s = e[t], o += i / c;
			} else o = t / (l - 1);
			i[n] = o, i[n + 1] = 0, i[n + 2] = o, i[n + 3] = 1;
		}
		let u = 0;
		for (let e = 0; e < l - 1; e++) {
			let t = e * 2;
			a[u++] = t, a[u++] = t + 1, a[u++] = t + 2, a[u++] = t + 2, a[u++] = t + 1, a[u++] = t + 3;
		}
		n.update(), r.update(), this.updateVertices();
	}
	updateVertices() {
		let e = this.points;
		if (e.length < 1) return;
		let t = e[0], n, r = 0, i = 0, a = this.buffers[0].data, o = e.length, s = this.textureScale > 0 ? this.textureScale * this._width / 2 : this._width / 2;
		for (let c = 0; c < o; c++) {
			let l = e[c], u = c * 4;
			n = c < e.length - 1 ? e[c + 1] : l, i = -(n.x - t.x), r = n.y - t.y;
			let d = (1 - c / (o - 1)) * 10;
			d > 1 && (d = 1);
			let f = Math.sqrt(r * r + i * i);
			f < 1e-6 ? (r = 0, i = 0) : (r /= f, i /= f, r *= s, i *= s), a[u] = l.x + r, a[u + 1] = l.y + i, a[u + 2] = l.x - r, a[u + 3] = l.y - i, t = l;
		}
		this.buffers[0].update();
	}
	update() {
		this.textureScale > 0 ? this._build() : this.updateVertices();
	}
};
ZD.defaultOptions = {
	width: 200,
	points: [],
	textureScale: 0
};
var QD = ZD, $D = Object.defineProperty, eO = Object.defineProperties, tO = Object.getOwnPropertyDescriptors, nO = Object.getOwnPropertySymbols, rO = Object.prototype.hasOwnProperty, iO = Object.prototype.propertyIsEnumerable, aO = (e, t, n) => t in e ? $D(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, oO = (e, t) => {
	for (var n in t ||= {}) rO.call(t, n) && aO(e, n, t[n]);
	if (nO) for (var n of nO(t)) iO.call(t, n) && aO(e, n, t[n]);
	return e;
}, sO = (e, t) => eO(e, tO(t)), cO = (e, t) => {
	var n = {};
	for (var r in e) rO.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && nO) for (var r of nO(e)) t.indexOf(r) < 0 && iO.call(e, r) && (n[r] = e[r]);
	return n;
}, lO = class e extends Og {
	constructor(t) {
		let n = oO(oO({}, e.defaultOptions), t), { width: r, texture: i, points: a, textureScale: o } = n, s = cO(n, [
			"width",
			"texture",
			"points",
			"textureScale"
		]), c = new QD(vt({
			width: r ?? i.height,
			points: a,
			textureScale: o
		}));
		o > 0 && (i.source.style.addressMode = "repeat"), super(vt(sO(oO({}, s), {
			texture: i,
			geometry: c
		}))), this.autoUpdate = !0, this.onRender = this._render;
	}
	_render() {
		let e = this.geometry;
		(this.autoUpdate || e._width !== this.texture.height) && (e._width = this.texture.height, e.update());
	}
};
lO.defaultOptions = { textureScale: 0 };
var uO = class {
	execute(e, t) {
		var n;
		let r = e.renderer, i = r.canvasContext.activeContext, a = t.particleChildren, o = t.texture;
		i.save(), r.canvasContext.setContextTransform(t.worldTransform, t.roundPixels), r.canvasContext.setBlendMode(t.groupBlendMode);
		let s = t.groupColorAlpha, c = r.filter?.alphaMultiplier ?? 1, l = (s >>> 24 & 255) / 255 * c;
		for (let e = 0; e < a.length; e++) {
			let t = a[e], r = t.texture || o;
			if (!((n = r?.source) != null && n.resource)) continue;
			let s = t.color, c = (s >>> 24 & 255) / 255 * l;
			if (c <= 0) continue;
			let u = s & 16777215, d = ((u & 255) << 16) + (u & 65280) + (u >> 16 & 255), f = r.source.resource;
			d !== 16777215 && (f = Z.getTintedCanvas({ texture: r }, d));
			let p = r.frame, m = r.source.resolution, h = p.x * m, g = p.y * m, _ = p.width * m, v = p.height * m;
			i.globalAlpha = c;
			let y = -t.anchorX * p.width, b = -t.anchorY * p.height;
			t.rotation !== 0 || t.scaleX !== 1 || t.scaleY !== 1 ? (i.save(), i.translate(t.x, t.y), i.rotate(t.rotation), i.scale(t.scaleX, t.scaleY), i.drawImage(f, h, g, _, v, y, b, p.width, p.height), i.restore()) : i.drawImage(f, h, g, _, v, t.x + y, t.y + b, p.width, p.height);
		}
		i.restore();
	}
};
function dO(e, t = null) {
	let n = e * 6;
	if (t ||= n > 65535 ? new Uint32Array(n) : new Uint16Array(n), t.length !== n) throw Error(`Out buffer length is incorrect, got ${t.length} and expected ${n}`);
	for (let e = 0, r = 0; e < n; e += 6, r += 4) t[e + 0] = r + 0, t[e + 1] = r + 1, t[e + 2] = r + 2, t[e + 3] = r + 0, t[e + 4] = r + 2, t[e + 5] = r + 3;
	return t;
}
function fO(e) {
	return {
		dynamicUpdate: pO(e, !0),
		staticUpdate: pO(e, !1)
	};
}
function pO(e, t) {
	let n = [];
	n.push("\n\n        var index = 0;\n\n        for (let i = 0; i < ps.length; ++i)\n        {\n            const p = ps[i];\n\n            ");
	let r = 0;
	for (let i in e) {
		let a = e[i];
		if (t !== a.dynamic) continue;
		n.push(`offset = index + ${r}`), n.push(a.code);
		let o = Na(a.format);
		r += o.stride / 4;
	}
	n.push("\n            index += stride * 4;\n        }\n    "), n.unshift(`
        var stride = ${r};
    `);
	let i = n.join("\n");
	return Function("ps", "f32v", "u32v", i);
}
var mO = class {
	constructor(e) {
		this._size = 0, this._generateParticleUpdateCache = {};
		let t = this._size = e.size ?? 1e3, n = e.properties, r = 0, i = 0;
		for (let e in n) {
			let t = n[e], a = Na(t.format);
			t.dynamic ? i += a.stride : r += a.stride;
		}
		this._dynamicStride = i / 4, this._staticStride = r / 4, this.staticAttributeBuffer = new pl(t * 4 * r), this.dynamicAttributeBuffer = new pl(t * 4 * i), this.indexBuffer = dO(t);
		let a = new Po(), o = 0, s = 0;
		this._staticBuffer = new Ao({
			data: /* @__PURE__ */ new Float32Array(1),
			label: "static-particle-buffer",
			shrinkToFit: !1,
			usage: Q.VERTEX | Q.COPY_DST
		}), this._dynamicBuffer = new Ao({
			data: /* @__PURE__ */ new Float32Array(1),
			label: "dynamic-particle-buffer",
			shrinkToFit: !1,
			usage: Q.VERTEX | Q.COPY_DST
		});
		for (let e in n) {
			let t = n[e], r = Na(t.format);
			t.dynamic ? (a.addAttribute(t.attributeName, {
				buffer: this._dynamicBuffer,
				stride: this._dynamicStride * 4,
				offset: o * 4,
				format: t.format
			}), o += r.size) : (a.addAttribute(t.attributeName, {
				buffer: this._staticBuffer,
				stride: this._staticStride * 4,
				offset: s * 4,
				format: t.format
			}), s += r.size);
		}
		a.addIndex(this.indexBuffer);
		let c = this.getParticleUpdate(n);
		this._dynamicUpload = c.dynamicUpdate, this._staticUpload = c.staticUpdate, this.geometry = a;
	}
	getParticleUpdate(e) {
		let t = hO(e);
		return this._generateParticleUpdateCache[t] || (this._generateParticleUpdateCache[t] = this.generateParticleUpdate(e)), this._generateParticleUpdateCache[t];
	}
	generateParticleUpdate(e) {
		return fO(e);
	}
	update(e, t) {
		e.length > this._size && (t = !0, this._size = Math.max(e.length, this._size * 1.5 | 0), this.staticAttributeBuffer = new pl(this._size * this._staticStride * 4 * 4), this.dynamicAttributeBuffer = new pl(this._size * this._dynamicStride * 4 * 4), this.indexBuffer = dO(this._size), this.geometry.indexBuffer.setDataWithSize(this.indexBuffer, this.indexBuffer.byteLength, !0));
		let n = this.dynamicAttributeBuffer;
		if (this._dynamicUpload(e, n.float32View, n.uint32View), this._dynamicBuffer.setDataWithSize(this.dynamicAttributeBuffer.float32View, e.length * this._dynamicStride * 4, !0), t) {
			let t = this.staticAttributeBuffer;
			this._staticUpload(e, t.float32View, t.uint32View), this._staticBuffer.setDataWithSize(t.float32View, e.length * this._staticStride * 4, !0);
		}
	}
	destroy() {
		this._staticBuffer.destroy(), this._dynamicBuffer.destroy(), this.geometry.destroy();
	}
};
function hO(e) {
	let t = [];
	for (let n in e) {
		let r = e[n];
		t.push(n, r.code, r.dynamic ? "d" : "s");
	}
	return t.join("_");
}
var gO = "varying vec2 vUV;\nvarying vec4 vColor;\n\nuniform sampler2D uTexture;\n\nvoid main(void){\n    vec4 color = texture2D(uTexture, vUV) * vColor;\n    gl_FragColor = color;\n}", _O = "attribute vec2 aVertex;\nattribute vec2 aUV;\nattribute vec4 aColor;\n\nattribute vec2 aPosition;\nattribute float aRotation;\n\nuniform mat3 uTranslationMatrix;\nuniform float uRound;\nuniform vec2 uResolution;\nuniform vec4 uColor;\n\nvarying vec2 vUV;\nvarying vec4 vColor;\n\nvec2 roundPixels(vec2 position, vec2 targetSize)\n{       \n    return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;\n}\n\nvoid main(void){\n    float cosRotation = cos(aRotation);\n    float sinRotation = sin(aRotation);\n    float x = aVertex.x * cosRotation - aVertex.y * sinRotation;\n    float y = aVertex.x * sinRotation + aVertex.y * cosRotation;\n\n    vec2 v = vec2(x, y);\n    v = v + aPosition;\n\n    gl_Position = vec4((uTranslationMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);\n\n    if(uRound == 1.0)\n    {\n        gl_Position.xy = roundPixels(gl_Position.xy, uResolution);\n    }\n\n    vUV = aUV;\n    vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uColor;\n}\n", vO = "\nstruct ParticleUniforms {\n  uTranslationMatrix:mat3x3<f32>,\n  uColor:vec4<f32>,\n  uRound:f32,\n  uResolution:vec2<f32>,\n};\n\nfn roundPixels(position: vec2<f32>, targetSize: vec2<f32>) -> vec2<f32>\n{\n  return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;\n}\n\n@group(0) @binding(0) var<uniform> uniforms: ParticleUniforms;\n\n@group(1) @binding(0) var uTexture: texture_2d<f32>;\n@group(1) @binding(1) var uSampler : sampler;\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    @location(0) uv : vec2<f32>,\n    @location(1) color : vec4<f32>,\n  };\n@vertex\nfn mainVertex(\n  @location(0) aVertex: vec2<f32>,\n  @location(1) aPosition: vec2<f32>,\n  @location(2) aUV: vec2<f32>,\n  @location(3) aColor: vec4<f32>,\n  @location(4) aRotation: f32,\n) -> VSOutput {\n  \n   let v = vec2(\n       aVertex.x * cos(aRotation) - aVertex.y * sin(aRotation),\n       aVertex.x * sin(aRotation) + aVertex.y * cos(aRotation)\n   ) + aPosition;\n\n   var position = vec4((uniforms.uTranslationMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);\n\n   if(uniforms.uRound == 1.0) {\n       position = vec4(roundPixels(position.xy, uniforms.uResolution), position.zw);\n   }\n\n    let vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uniforms.uColor;\n\n  return VSOutput(\n   position,\n   aUV,\n   vColor,\n  );\n}\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n  @location(1) color: vec4<f32>,\n  @builtin(position) position: vec4<f32>,\n) -> @location(0) vec4<f32> {\n\n    var sample = textureSample(uTexture, uSampler, uv) * color;\n   \n    return sample;\n}", yO = class extends po {
	constructor() {
		let e = ja.from({
			vertex: _O,
			fragment: gO
		}), t = Ga.from({
			fragment: {
				source: vO,
				entryPoint: "mainFragment"
			},
			vertex: {
				source: vO,
				entryPoint: "mainVertex"
			}
		});
		super({
			glProgram: e,
			gpuProgram: t,
			resources: {
				uTexture: J.WHITE.source,
				uSampler: new Ot({}),
				uniforms: {
					uTranslationMatrix: {
						value: new B(),
						type: "mat3x3<f32>"
					},
					uColor: {
						value: new z(16777215),
						type: "vec4<f32>"
					},
					uRound: {
						value: 1,
						type: "f32"
					},
					uResolution: {
						value: [0, 0],
						type: "vec2<f32>"
					}
				}
			}
		});
	}
}, bO = class {
	constructor(e, t) {
		this.state = go.for2d(), this.localUniforms = new io({
			uTranslationMatrix: {
				value: new B(),
				type: "mat3x3<f32>"
			},
			uColor: {
				value: /* @__PURE__ */ new Float32Array(4),
				type: "vec4<f32>"
			},
			uRound: {
				value: 1,
				type: "f32"
			},
			uResolution: {
				value: [0, 0],
				type: "vec2<f32>"
			}
		}), this.renderer = e, this.adaptor = t, this.defaultShader = new yO(), this.state = go.for2d(), this._managedContainers = new Bu({
			renderer: e,
			type: "renderable",
			name: "particleContainer"
		});
	}
	validateRenderable(e) {
		return !1;
	}
	addRenderable(e, t) {
		this.renderer.renderPipes.batch.break(t), t.add(e);
	}
	getBuffers(e) {
		return e._gpuData[this.renderer.uid] || this._initBuffer(e);
	}
	_initBuffer(e) {
		return e._gpuData[this.renderer.uid] = new mO({
			size: e.particleChildren.length,
			properties: e._properties
		}), this._managedContainers.add(e), e._gpuData[this.renderer.uid];
	}
	updateRenderable(e) {}
	execute(e) {
		let t = e.particleChildren;
		if (t.length === 0) return;
		let n = this.renderer, r = this.getBuffers(e);
		e.texture ||= t[0].texture;
		let i = this.state;
		r.update(t, e._childrenDirty), e._childrenDirty = !1, i.blendMode = xl(e.groupBlendMode, e.texture._source);
		let a = this.localUniforms.uniforms, o = a.uTranslationMatrix;
		e.worldTransform.copyTo(o);
		let s = n.globalUniforms.globalUniformData;
		o.tx -= s.offset.x, o.ty -= s.offset.y, o.prepend(s.projectionMatrix), a.uResolution = s.resolution, a.uRound = n._roundPixels | e._roundPixels, eg(e.groupColorAlpha, a.uColor, 0), this.adaptor.execute(this, e);
	}
	destroy() {
		this._managedContainers.destroy(), this.renderer = null, this.defaultShader &&= (this.defaultShader.destroy(), null);
	}
};
bO.extension = {
	type: [h.CanvasPipes],
	name: "particle"
};
var xO = class extends bO {
	constructor(e) {
		super(e, new uO());
	}
};
xO.extension = {
	type: [h.CanvasPipes],
	name: "particle"
};
var SO = class {
	execute(e, t) {
		let n = e.state, r = e.renderer, i = t.shader || e.defaultShader;
		i.resources.uTexture = t.texture._source, i.resources.uniforms = e.localUniforms;
		let a = r.gl, o = e.getBuffers(t);
		r.shader.bind(i), r.state.set(n), r.geometry.bind(o.geometry, i.glProgram);
		let s = o.geometry.indexBuffer.data.BYTES_PER_ELEMENT === 2 ? a.UNSIGNED_SHORT : a.UNSIGNED_INT;
		a.drawElements(a.TRIANGLES, t.particleChildren.length * 6, s, 0);
	}
}, CO = class extends bO {
	constructor(e) {
		super(e, new SO());
	}
};
CO.extension = {
	type: [h.WebGLPipes],
	name: "particle"
};
var wO = class {
	execute(e, t) {
		let n = e.renderer, r = t.shader || e.defaultShader;
		r.groups[0] = n.renderPipes.uniformBatch.getUniformBindGroup(e.localUniforms, !0), r.groups[1] = n.texture.getTextureBindGroup(t.texture);
		let i = e.state, a = e.getBuffers(t);
		n.encoder.draw({
			geometry: a.geometry,
			shader: t.shader || e.defaultShader,
			state: i,
			size: t.particleChildren.length * 6
		});
	}
}, TO = class extends bO {
	constructor(e) {
		super(e, new wO());
	}
};
TO.extension = {
	type: [h.WebGPUPipes],
	name: "particle"
};
var EO = {
	vertex: {
		attributeName: "aVertex",
		format: "float32x2",
		code: "\n            const texture = p.texture;\n            const sx = p.scaleX;\n            const sy = p.scaleY;\n            const ax = p.anchorX;\n            const ay = p.anchorY;\n            const trim = texture.trim;\n            const orig = texture.orig;\n\n            if (trim)\n            {\n                w1 = trim.x - (ax * orig.width);\n                w0 = w1 + trim.width;\n\n                h1 = trim.y - (ay * orig.height);\n                h0 = h1 + trim.height;\n            }\n            else\n            {\n                w1 = -ax * (orig.width);\n                w0 = w1 + orig.width;\n\n                h1 = -ay * (orig.height);\n                h0 = h1 + orig.height;\n            }\n\n            f32v[offset] = w1 * sx;\n            f32v[offset + 1] = h1 * sy;\n\n            f32v[offset + stride] = w0 * sx;\n            f32v[offset + stride + 1] = h1 * sy;\n\n            f32v[offset + (stride * 2)] = w0 * sx;\n            f32v[offset + (stride * 2) + 1] = h0 * sy;\n\n            f32v[offset + (stride * 3)] = w1 * sx;\n            f32v[offset + (stride * 3) + 1] = h0 * sy;\n        ",
		dynamic: !1
	},
	position: {
		attributeName: "aPosition",
		format: "float32x2",
		code: "\n            var x = p.x;\n            var y = p.y;\n\n            f32v[offset] = x;\n            f32v[offset + 1] = y;\n\n            f32v[offset + stride] = x;\n            f32v[offset + stride + 1] = y;\n\n            f32v[offset + (stride * 2)] = x;\n            f32v[offset + (stride * 2) + 1] = y;\n\n            f32v[offset + (stride * 3)] = x;\n            f32v[offset + (stride * 3) + 1] = y;\n        ",
		dynamic: !0
	},
	rotation: {
		attributeName: "aRotation",
		format: "float32",
		code: "\n            var rotation = p.rotation;\n\n            f32v[offset] = rotation;\n            f32v[offset + stride] = rotation;\n            f32v[offset + (stride * 2)] = rotation;\n            f32v[offset + (stride * 3)] = rotation;\n        ",
		dynamic: !1
	},
	uvs: {
		attributeName: "aUV",
		format: "float32x2",
		code: "\n            var uvs = p.texture.uvs;\n\n            f32v[offset] = uvs.x0;\n            f32v[offset + 1] = uvs.y0;\n\n            f32v[offset + stride] = uvs.x1;\n            f32v[offset + stride + 1] = uvs.y1;\n\n            f32v[offset + (stride * 2)] = uvs.x2;\n            f32v[offset + (stride * 2) + 1] = uvs.y2;\n\n            f32v[offset + (stride * 3)] = uvs.x3;\n            f32v[offset + (stride * 3) + 1] = uvs.y3;\n        ",
		dynamic: !1
	},
	color: {
		attributeName: "aColor",
		format: "unorm8x4",
		code: "\n            const c = p.color;\n\n            u32v[offset] = c;\n            u32v[offset + stride] = c;\n            u32v[offset + (stride * 2)] = c;\n            u32v[offset + (stride * 3)] = c;\n        ",
		dynamic: !1
	}
};
v.add(CO), v.add(TO), v.add(xO);
var DO = Object.defineProperty, OO = Object.defineProperties, kO = Object.getOwnPropertyDescriptors, AO = Object.getOwnPropertySymbols, jO = Object.prototype.hasOwnProperty, MO = Object.prototype.propertyIsEnumerable, NO = (e, t, n) => t in e ? DO(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, PO = (e, t) => {
	for (var n in t ||= {}) jO.call(t, n) && NO(e, n, t[n]);
	if (AO) for (var n of AO(t)) MO.call(t, n) && NO(e, n, t[n]);
	return e;
}, FO = (e, t) => OO(e, kO(t)), IO = (e, t) => {
	var n = {};
	for (var r in e) jO.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && AO) for (var r of AO(e)) t.indexOf(r) < 0 && MO.call(e, r) && (n[r] = e[r]);
	return n;
}, LO = new G(0, 0, 0, 0), RO = class e extends dr {
	constructor(t = {}) {
		t = FO(PO(PO({}, e.defaultOptions), t), { dynamicProperties: PO(PO({}, e.defaultOptions.dynamicProperties), t?.dynamicProperties) });
		let n = t, { dynamicProperties: r, shader: i, roundPixels: a, texture: o, particles: s } = n, c = IO(n, [
			"dynamicProperties",
			"shader",
			"roundPixels",
			"texture",
			"particles"
		]);
		super(PO({ label: "ParticleContainer" }, c)), this.renderPipeId = "particle", this.batched = !1, this._childrenDirty = !1, this.texture = o || null, this.shader = i, this._properties = {};
		for (let e in EO) {
			let t = EO[e], n = r[e];
			this._properties[e] = FO(PO({}, t), { dynamic: n });
		}
		this.allowChildren = !0, this.roundPixels = a ?? !1, this.particleChildren = s ?? [];
	}
	addParticle(...e) {
		for (let t = 0; t < e.length; t++) this.particleChildren.push(e[t]);
		return this.onViewUpdate(), e[0];
	}
	removeParticle(...e) {
		let t = !1;
		for (let n = 0; n < e.length; n++) {
			let r = this.particleChildren.indexOf(e[n]);
			r > -1 && (this.particleChildren.splice(r, 1), t = !0);
		}
		return t && this.onViewUpdate(), e[0];
	}
	update() {
		this._childrenDirty = !0;
	}
	onViewUpdate() {
		this._childrenDirty = !0, super.onViewUpdate();
	}
	get bounds() {
		return LO;
	}
	updateBounds() {}
	destroy(e = !1) {
		var t;
		if (super.destroy(e), typeof e == "boolean" ? e : e?.texture) {
			let t = typeof e == "boolean" ? e : e?.textureSource, n = this.texture ?? this.particleChildren[0]?.texture;
			n && n.destroy(t);
		}
		this.texture = null, (t = this.shader) == null || t.destroy();
	}
	removeParticles(e, t) {
		e ??= 0, t ??= this.particleChildren.length;
		let n = this.particleChildren.splice(e, t - e);
		return this.onViewUpdate(), n;
	}
	removeParticleAt(e) {
		let t = this.particleChildren.splice(e, 1);
		return this.onViewUpdate(), t[0];
	}
	addParticleAt(e, t) {
		return this.particleChildren.splice(t, 0, e), this.onViewUpdate(), e;
	}
	addChild(...e) {
		throw Error("ParticleContainer.addChild() is not available. Please use ParticleContainer.addParticle()");
	}
	removeChild(...e) {
		throw Error("ParticleContainer.removeChild() is not available. Please use ParticleContainer.removeParticle()");
	}
	removeChildren(e, t) {
		throw Error("ParticleContainer.removeChildren() is not available. Please use ParticleContainer.removeParticles()");
	}
	removeChildAt(e) {
		throw Error("ParticleContainer.removeChildAt() is not available. Please use ParticleContainer.removeParticleAt()");
	}
	getChildAt(e) {
		throw Error("ParticleContainer.getChildAt() is not available. Please use ParticleContainer.getParticleAt()");
	}
	setChildIndex(e, t) {
		throw Error("ParticleContainer.setChildIndex() is not available. Please use ParticleContainer.setParticleIndex()");
	}
	getChildIndex(e) {
		throw Error("ParticleContainer.getChildIndex() is not available. Please use ParticleContainer.getParticleIndex()");
	}
	addChildAt(e, t) {
		throw Error("ParticleContainer.addChildAt() is not available. Please use ParticleContainer.addParticleAt()");
	}
	swapChildren(e, t) {
		throw Error("ParticleContainer.swapChildren() is not available. Please use ParticleContainer.swapParticles()");
	}
	reparentChild(...e) {
		throw Error("ParticleContainer.reparentChild() is not available with the particle container");
	}
	reparentChildAt(e, t) {
		throw Error("ParticleContainer.reparentChildAt() is not available with the particle container");
	}
};
RO.defaultOptions = {
	dynamicProperties: {
		vertex: !1,
		position: !0,
		rotation: !1,
		uvs: !1,
		color: !1
	},
	roundPixels: !1
};
var zO = class {
	constructor(e) {
		this._renderer = e;
	}
	validateRenderable(e) {
		return !1;
	}
	addRenderable(e, t) {
		this._renderer.renderPipes.batch.break(t), t.add(e);
	}
	updateRenderable(e) {}
	execute(e) {
		let t = this._renderer, n = t.canvasContext, r = n.activeContext;
		r.save();
		let i = e.groupTransform, a = t._roundPixels | e._roundPixels;
		n.setContextTransform(i, a === 1), n.setBlendMode(e.groupBlendMode);
		let o = t.globalUniforms.globalUniformData?.worldColor ?? 4294967295, s = e.groupColorAlpha, c = (o >>> 24 & 255) / 255, l = (s >>> 24 & 255) / 255, u = t.filter?.alphaMultiplier ?? 1, d = c * l * u;
		if (d <= 0) {
			r.restore();
			return;
		}
		r.globalAlpha = d;
		let f = o & 16777215, p = at(nt(s & 16777215, f)), m = e.texture, h = Z.getCanvasSource(m);
		if (!h) {
			r.restore();
			return;
		}
		let g = n.smoothProperty, _ = m.source.style.scaleMode !== "nearest";
		r[g] !== _ && (r[g] = _);
		let v = p !== 16777215 || m.rotate !== 0, y = v ? Z.getTintedCanvas({ texture: m }, p) : h, { leftWidth: b, topHeight: x, rightWidth: S, bottomHeight: C, width: w, height: T } = e, E = b + S, D = x + C, O = Math.min(E > w ? w / E : 1, D > T ? T / D : 1, 1), k = b * O, A = S * O, j = x * O, M = C * O, N = Math.max(0, w - k - A), P = Math.max(0, T - j - M), ee = e.anchor, F = m.source._resolution ?? m.source.resolution ?? 1, te = m.frame.x * F, I = m.frame.y * F, L = -ee.x * w, ne = -ee.y * T, re = b * F, ie = x * F, ae = S * F, R = C * F, oe = m.frame.width * F, se = m.frame.height * F;
		v && (te = 0, I = 0, oe = y.width, se = y.height), r.drawImage(y, te, I, re, ie, L, ne, k, j), r.drawImage(y, te + re, I, oe - re - ae, ie, L + k, ne, N, j), r.drawImage(y, te + oe - ae, I, ae, ie, L + w - A, ne, A, j), r.drawImage(y, te, I + ie, re, se - ie - R, L, ne + j, k, P), r.drawImage(y, te + re, I + ie, oe - re - ae, se - ie - R, L + k, ne + j, N, P), r.drawImage(y, te + oe - ae, I + ie, ae, se - ie - R, L + w - A, ne + j, A, P), r.drawImage(y, te, I + se - R, re, R, L, ne + T - M, k, M), r.drawImage(y, te + re, I + se - R, oe - re - ae, R, L + k, ne + T - M, N, M), r.drawImage(y, te + oe - ae, I + se - R, ae, R, L + w - A, ne + T - M, A, M), r.restore();
	}
	destroy() {
		this._renderer = null;
	}
};
zO.extension = {
	type: [h.CanvasPipes],
	name: "nineSliceSprite"
};
var BO = Object.defineProperty, VO = Object.getOwnPropertySymbols, HO = Object.prototype.hasOwnProperty, UO = Object.prototype.propertyIsEnumerable, WO = (e, t, n) => t in e ? BO(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, GO = (e, t) => {
	for (var n in t ||= {}) HO.call(t, n) && WO(e, n, t[n]);
	if (VO) for (var n of VO(t)) UO.call(t, n) && WO(e, n, t[n]);
	return e;
}, KO = class e extends xD {
	constructor(t = {}) {
		t = GO(GO({}, e.defaultOptions), t), super({
			width: t.width,
			height: t.height,
			verticesX: 4,
			verticesY: 4
		}), this._trimX = 0, this._trimY = 0, this._trimWidth = t.originalWidth ?? e.defaultOptions.originalWidth, this._trimHeight = t.originalHeight ?? e.defaultOptions.originalHeight, this.update(t);
	}
	update(e) {
		this.width = e.width ?? this.width, this.height = e.height ?? this.height, this._originalWidth = e.originalWidth ?? this._originalWidth, this._originalHeight = e.originalHeight ?? this._originalHeight, this._leftWidth = e.leftWidth ?? this._leftWidth, this._rightWidth = e.rightWidth ?? this._rightWidth, this._topHeight = e.topHeight ?? this._topHeight, this._bottomHeight = e.bottomHeight ?? this._bottomHeight, this._anchorX = e.anchor?.x, this._anchorY = e.anchor?.y, e.trim === void 0 ? (this._trimWidth = this._originalWidth, this._trimHeight = this._originalHeight) : (this._trimX = e.trim?.x ?? 0, this._trimY = e.trim?.y ?? 0, this._trimWidth = e.trim?.width ?? this._originalWidth, this._trimHeight = e.trim?.height ?? this._originalHeight), this.updateUvs(), this.updatePositions();
	}
	updatePositions() {
		let e = this.positions, { width: t, height: n, _leftWidth: r, _rightWidth: i, _topHeight: a, _bottomHeight: o, _anchorX: s, _anchorY: c } = this, l = r + i, u = t > l ? 1 : t / l, d = a + o, f = n > d ? 1 : n / d, p = Math.min(u, f), m = s * t, h = c * n;
		e[0] = e[8] = e[16] = e[24] = -m, e[2] = e[10] = e[18] = e[26] = r * p - m, e[4] = e[12] = e[20] = e[28] = t - i * p - m, e[6] = e[14] = e[22] = e[30] = t - m, e[1] = e[3] = e[5] = e[7] = -h, e[9] = e[11] = e[13] = e[15] = a * p - h, e[17] = e[19] = e[21] = e[23] = n - o * p - h, e[25] = e[27] = e[29] = e[31] = n - h, this.getBuffer("aPosition").update();
	}
	updateUvs() {
		let e = this.uvs, t = this._originalWidth, n = this._originalHeight, r = this._trimX / t, i = this._trimY / n, a = (this._trimX + this._trimWidth) / t, o = (this._trimY + this._trimHeight) / n;
		e[0] = e[8] = e[16] = e[24] = r, e[1] = e[3] = e[5] = e[7] = i, e[6] = e[14] = e[22] = e[30] = a, e[25] = e[27] = e[29] = e[31] = o;
		let s = 1 / t, c = 1 / n;
		e[2] = e[10] = e[18] = e[26] = r + s * this._leftWidth, e[9] = e[11] = e[13] = e[15] = i + c * this._topHeight, e[4] = e[12] = e[20] = e[28] = a - s * this._rightWidth, e[17] = e[19] = e[21] = e[23] = o - c * this._bottomHeight, this.getBuffer("aUV").update();
	}
};
KO.defaultOptions = {
	width: 100,
	height: 100,
	leftWidth: 10,
	topHeight: 10,
	rightWidth: 10,
	bottomHeight: 10,
	originalWidth: 100,
	originalHeight: 100
};
var qO = KO, JO = class extends vg {
	constructor() {
		super(), this.geometry = new qO();
	}
	destroy() {
		this.geometry.destroy();
	}
}, YO = class {
	constructor(e) {
		this._renderer = e, this._managedSprites = new Bu({
			renderer: e,
			type: "renderable",
			name: "nineSliceSprite"
		});
	}
	addRenderable(e, t) {
		let n = this._getGpuSprite(e);
		e.didViewUpdate && this._updateBatchableSprite(e, n), this._renderer.renderPipes.batch.addToBatch(n, t);
	}
	updateRenderable(e) {
		let t = this._getGpuSprite(e);
		e.didViewUpdate && this._updateBatchableSprite(e, t), t._batcher.updateElement(t);
	}
	validateRenderable(e) {
		let t = this._getGpuSprite(e);
		return !t._batcher.checkAndUpdateTexture(t, e._texture);
	}
	_updateBatchableSprite(e, t) {
		t.geometry.update(e), t.setTexture(e._texture);
	}
	_getGpuSprite(e) {
		return e._gpuData[this._renderer.uid] || this._initGPUSprite(e);
	}
	_initGPUSprite(e) {
		let t = e._gpuData[this._renderer.uid] = new JO(), n = t;
		return n.renderable = e, n.transform = e.groupTransform, n.texture = e._texture, n.roundPixels = this._renderer._roundPixels | e._roundPixels, this._managedSprites.add(e), e.didViewUpdate || this._updateBatchableSprite(e, n), t;
	}
	destroy() {
		this._managedSprites.destroy(), this._renderer = null;
	}
};
YO.extension = {
	type: [h.WebGLPipes, h.WebGPUPipes],
	name: "nineSliceSprite"
}, v.add(zO), v.add(YO);
var XO = Object.defineProperty, ZO = Object.getOwnPropertySymbols, QO = Object.prototype.hasOwnProperty, $O = Object.prototype.propertyIsEnumerable, ek = (e, t, n) => t in e ? XO(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, tk = (e, t) => {
	for (var n in t ||= {}) QO.call(t, n) && ek(e, n, t[n]);
	if (ZO) for (var n of ZO(t)) $O.call(t, n) && ek(e, n, t[n]);
	return e;
}, nk = (e, t) => {
	var n = {};
	for (var r in e) QO.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && ZO) for (var r of ZO(e)) t.indexOf(r) < 0 && $O.call(e, r) && (n[r] = e[r]);
	return n;
}, rk = class e extends dr {
	constructor(t) {
		t instanceof J && (t = { texture: t });
		let n = t, { width: r, height: i, anchor: a, leftWidth: o, rightWidth: s, topHeight: c, bottomHeight: l, texture: u, roundPixels: d } = n, f = nk(n, [
			"width",
			"height",
			"anchor",
			"leftWidth",
			"rightWidth",
			"topHeight",
			"bottomHeight",
			"texture",
			"roundPixels"
		]);
		super(tk({ label: "NineSliceSprite" }, f)), this.renderPipeId = "nineSliceSprite", this.batched = !0, this._leftWidth = o ?? u?.defaultBorders?.left ?? qO.defaultOptions.leftWidth, this._topHeight = c ?? u?.defaultBorders?.top ?? qO.defaultOptions.topHeight, this._rightWidth = s ?? u?.defaultBorders?.right ?? qO.defaultOptions.rightWidth, this._bottomHeight = l ?? u?.defaultBorders?.bottom ?? qO.defaultOptions.bottomHeight, this._width = r ?? u.width ?? qO.defaultOptions.width, this._height = i ?? u.height ?? qO.defaultOptions.height, this.allowChildren = !1, this.texture = u ?? e.defaultOptions.texture, this.roundPixels = d ?? !1, this._anchor = new V({ _onUpdate: () => {
			this.onViewUpdate();
		} }), a ? this.anchor = a : this.texture.defaultAnchor && (this.anchor = this.texture.defaultAnchor);
	}
	get anchor() {
		return this._anchor;
	}
	set anchor(e) {
		typeof e == "number" ? this._anchor.set(e) : this._anchor.copyFrom(e);
	}
	get width() {
		return this._width;
	}
	set width(e) {
		this._width = e, this.onViewUpdate();
	}
	get height() {
		return this._height;
	}
	set height(e) {
		this._height = e, this.onViewUpdate();
	}
	setSize(e, t) {
		typeof e == "object" && (t = e.height ?? e.width, e = e.width), this._width = e, this._height = t ?? e, this.onViewUpdate();
	}
	getSize(e) {
		return e ||= {}, e.width = this._width, e.height = this._height, e;
	}
	get leftWidth() {
		return this._leftWidth;
	}
	set leftWidth(e) {
		this._leftWidth = e, this.onViewUpdate();
	}
	get topHeight() {
		return this._topHeight;
	}
	set topHeight(e) {
		this._topHeight = e, this.onViewUpdate();
	}
	get rightWidth() {
		return this._rightWidth;
	}
	set rightWidth(e) {
		this._rightWidth = e, this.onViewUpdate();
	}
	get bottomHeight() {
		return this._bottomHeight;
	}
	set bottomHeight(e) {
		this._bottomHeight = e, this.onViewUpdate();
	}
	get texture() {
		return this._texture;
	}
	set texture(e) {
		e ||= J.EMPTY;
		let t = this._texture;
		t !== e && (t && t.dynamic && t.off("update", this.onViewUpdate, this), e.dynamic && e.on("update", this.onViewUpdate, this), this._texture = e, this.onViewUpdate());
	}
	get originalWidth() {
		return this._texture.width;
	}
	get originalHeight() {
		return this._texture.height;
	}
	get trim() {
		return this._texture.trim ?? null;
	}
	destroy(e) {
		if (super.destroy(e), typeof e == "boolean" ? e : e?.texture) {
			let t = typeof e == "boolean" ? e : e?.textureSource;
			this._texture.destroy(t);
		}
		this._texture = null;
	}
	updateBounds() {
		let e = this._bounds, t = this._anchor, n = this._width, r = this._height;
		e.minX = -t._x * n, e.maxX = e.minX + n, e.minY = -t._y * r, e.maxY = e.minY + r;
	}
};
rk.defaultOptions = { texture: J.EMPTY };
var ik = {
	__proto__: null,
	BitmapFont: class extends Wv {
		constructor(e, t) {
			super();
			let { textures: n, data: r } = e;
			Object.keys(r.pages).forEach((e) => {
				let t = r.pages[parseInt(e, 10)], i = n[t.id];
				this.pages.push({ texture: i });
			}), Object.keys(r.chars).forEach((e) => {
				let t = r.chars[e], { frame: i, source: a, rotate: o } = n[t.page], s = new J({
					frame: q.transformRectCoords(t, i, o, new qe()),
					orig: new qe(0, 0, t.width, t.height),
					source: a,
					rotate: o
				});
				this.chars[e] = {
					id: e.codePointAt(0),
					xOffset: t.xOffset,
					yOffset: t.yOffset,
					xAdvance: t.xAdvance,
					kerning: t.kerning ?? {},
					texture: s
				};
			}), this.baseRenderedFontSize = r.fontSize, this.baseMeasurementFontSize = r.fontSize, this.fontMetrics = {
				ascent: 0,
				descent: 0,
				fontSize: r.fontSize
			}, this.baseLineOffset = r.baseLineOffset, this.lineHeight = r.lineHeight, this.fontFamily = r.fontFamily, this.distanceField = r.distanceField ?? {
				type: "none",
				range: 0
			}, this.url = t;
		}
		destroy() {
			super.destroy();
			for (let e = 0; e < this.pages.length; e++) {
				let { texture: t } = this.pages[e];
				t.destroy(!0);
			}
			this.pages = null;
		}
		static install(e) {
			dy.install(e);
		}
		static uninstall(e) {
			dy.uninstall(e);
		}
	}
};
function ak(e) {
	let { text: t, style: n, chars: r } = e, i = n, a = dy.getFont(t, i), o = $v(hv.graphemeSegmenter(t), i, a, !0), s = o.scale, c = [], l = [], u = [], d = n.lineHeight ? n.lineHeight : a.lineHeight * s, f = 0;
	for (let e of o.lines) {
		if (e.chars.length === 0) continue;
		let t = new Y({ label: "line" });
		t.y = f, u.push(t);
		let n = new Y({ label: "word" }), o = 0;
		for (let u = 0; u < e.chars.length; u++) {
			let d = e.chars[u];
			if (!d || !a.chars[d]) continue;
			let f = d === " ", p = u === e.chars.length - 1, m;
			r.length > 0 ? (m = r.shift(), m.text = d, m.style = i, m.label = `char-${d}`, m.x = e.charPositions[u] * s - e.charPositions[o] * s) : m = new wy({
				text: d,
				style: i,
				label: `char-${d}`,
				x: e.charPositions[u] * s - e.charPositions[o] * s
			}), f || (c.push(m), n.addChild(m)), (f || p) && n.children.length > 0 && (n.x = e.charPositions[o] * s, l.push(n), t.addChild(n), n = new Y({ label: "word" }), o = u + 1);
		}
		f += d;
	}
	return {
		chars: c,
		lines: u,
		words: l
	};
}
var ok = Object.getOwnPropertySymbols, sk = Object.prototype.hasOwnProperty, ck = Object.prototype.propertyIsEnumerable, lk = (e, t) => {
	var n = {};
	for (var r in e) sk.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && ok) for (var r of ok(e)) t.indexOf(r) < 0 && ck.call(e, r) && (n[r] = e[r]);
	return n;
}, uk = class extends Y {
	constructor(e) {
		let t = e, { text: n, style: r, autoSplit: i, lineAnchor: a, wordAnchor: o, charAnchor: s } = t, c = lk(t, [
			"text",
			"style",
			"autoSplit",
			"lineAnchor",
			"wordAnchor",
			"charAnchor"
		]);
		super(c), this._dirty = !1, this._canReuseChars = !1, this.chars = [], this.words = [], this.lines = [], this._originalText = n, this._autoSplit = i, this._lineAnchor = a, this._wordAnchor = o, this._charAnchor = s, this.style = r;
	}
	split() {
		let e = this.splitFn();
		this.chars = e.chars, this.words = e.words, this.lines = e.lines, this.addChild(...this.lines), this.charAnchor = this._charAnchor, this.wordAnchor = this._wordAnchor, this.lineAnchor = this._lineAnchor, this._dirty = !1, this._canReuseChars = !0;
	}
	get text() {
		return this._originalText;
	}
	set text(e) {
		this._originalText = e, this.lines.forEach((e) => e.destroy({ children: !0 })), this.lines.length = 0, this.words.length = 0, this.chars.length = 0, this._canReuseChars = !1, this.onTextUpdate();
	}
	_setOrigin(e, t, n) {
		let r;
		r = typeof e == "number" ? {
			x: e,
			y: e
		} : {
			x: e.x,
			y: e.y
		}, t.forEach((e) => {
			let t = e.getLocalBounds(), n = t.minX + t.width * r.x, i = t.minY + t.height * r.y;
			e.origin.set(n, i);
		}), this[n] = e;
	}
	get lineAnchor() {
		return this._lineAnchor;
	}
	set lineAnchor(e) {
		this._setOrigin(e, this.lines, "_lineAnchor");
	}
	get wordAnchor() {
		return this._wordAnchor;
	}
	set wordAnchor(e) {
		this._setOrigin(e, this.words, "_wordAnchor");
	}
	get charAnchor() {
		return this._charAnchor;
	}
	set charAnchor(e) {
		this._setOrigin(e, this.chars, "_charAnchor");
	}
	get style() {
		return this._style;
	}
	set style(e) {
		e ||= {}, this._style = new Nv(e), this.styleChanged();
	}
	styleChanged() {
		this.words.forEach((e) => e.destroy()), this.words.length = 0, this.lines.forEach((e) => e.destroy()), this.lines.length = 0, this._canReuseChars = !0, this.onTextUpdate();
	}
	onTextUpdate() {
		this._dirty = !0, this._autoSplit && this.split();
	}
	destroy(e) {
		super.destroy(e), this.chars = [], this.words = [], this.lines = [], (typeof e == "boolean" ? e : e != null && e.style) && this._style.destroy(e), this._style = null, this._originalText = "";
	}
}, dk = Object.defineProperty, fk = Object.defineProperties, pk = Object.getOwnPropertyDescriptors, mk = Object.getOwnPropertySymbols, hk = Object.prototype.hasOwnProperty, gk = Object.prototype.propertyIsEnumerable, _k = (e, t, n) => t in e ? dk(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, vk = (e, t) => {
	for (var n in t ||= {}) hk.call(t, n) && _k(e, n, t[n]);
	if (mk) for (var n of mk(t)) gk.call(t, n) && _k(e, n, t[n]);
	return e;
}, yk = (e, t) => fk(e, pk(t)), bk = class e extends uk {
	constructor(t) {
		var n;
		let r = vk(vk({}, e.defaultOptions), t);
		r.style ??= {}, (n = r.style).fill ?? (n.fill = 16777215), super(r);
	}
	static from(t, n) {
		let r = yk(vk(vk({}, e.defaultOptions), n), {
			text: t.text,
			style: new Nv(t.style)
		});
		t.style.tagStyles && (t.style._tagStyles = void 0);
		let i = new e(vk({}, r)), a = t.anchor;
		return (a.x !== 0 || a.y !== 0) && i.pivot.set(i.width * a.x, i.height * a.y), i;
	}
	splitFn() {
		return ak({
			text: this._originalText,
			style: this._style,
			chars: this._canReuseChars ? this.chars : []
		});
	}
};
bk.defaultOptions = {
	autoSplit: !0,
	lineAnchor: 0,
	wordAnchor: 0,
	charAnchor: 0
};
function xk(e, t, n) {
	switch (e) {
		case "center": return (n - t) / 2;
		case "right": return n - t;
		default: return 0;
	}
}
function Sk(e) {
	return e === "\r" || e === "\n" || e === "\r\n";
}
var Ck = /^\s*$/;
function wk(e, t) {
	let n = [], r = t.lines[0], i = "", a = [], o = 0;
	return e.forEach((e) => {
		let s = Ck.test(e), c = Sk(e), l = i.length === 0 && s;
		s && !c && l && (!r || !r.startsWith(e)) || (c || (i += e), a.push(e), i.length >= r.length && (n.push({
			line: i,
			chars: a
		}), a = [], i = "", o++, r = t.lines[o]));
	}), n;
}
function Tk(e) {
	let { text: t, style: n, chars: r } = e, i = n, a = hv.measureText(t, i);
	if (a.runsByLine && a.runsByLine.length > 0) return Ek(a, i, r, t);
	let o = wk(hv.graphemeSegmenter(t), a), s = i.align, c = a.lineWidths.reduce((e, t) => Math.max(e, t), 0), l = i._fill?.fill, u = i._stroke?.fill, d = l instanceof wd, f = u instanceof wd, p = d || f, m = d && l.textureSpace === "local" || f && u.textureSpace === "local", h = a.width, g = a.height, _ = i.clone();
	_.align = "left";
	let v = 0, y = 0;
	if (_.trim) {
		let { frame: e, canvasAndContext: n } = Sv.getCanvasAndContext({
			text: t,
			style: i,
			resolution: 1
		});
		Sv.returnCanvasAndContext(n), v = -e.x, y = -e.y, _.trim = !1;
	}
	let b = [], x = [], S = [], C = 0, w = 0, T = m ? {
		width: h,
		height: g
	} : null;
	return o.forEach((e, t) => {
		let n = new Y({ label: `line-${t}` });
		n.y = C + y, x.push(n);
		let l = a.lineWidths[t], u = xk(s, l, c), d = new Y({ label: "word" });
		d.x = u + v;
		let f = hv._context;
		f.font = _._fontString, hv.experimentalLetterSpacingSupported && (f.letterSpacing = "0px", f.textLetterSpacing = "0px");
		let m = e.line, h = f.measureText(m).width;
		if (e.chars.forEach((e) => {
			if (Sk(e)) return;
			m = m.slice(e.length);
			let t = m.length > 0 ? f.measureText(m).width : 0, a = h - t;
			if (h = t, a !== 0) {
				if (e === " ") d.children.length > 0 && (S.push(d), n.addChild(d)), u += a + i.letterSpacing, d = new Y({ label: "word" }), d.x = u + v;
				else {
					let t = _;
					p && (t = _.clone(), t._gradientOffset = {
						x: -u,
						y: -C
					}, T && (t._gradientBounds = T));
					let n;
					w < r.length ? (n = r[w++], n.text = e, n.style = t, n.setFromMatrix(B.IDENTITY), n.x = u - d.x + v) : n = new Hv({
						text: e,
						style: t,
						x: u - d.x + v
					}), b.push(n), d.addChild(n), u += a + i.letterSpacing;
				}
			}
		}), d.children.length > 0 && (S.push(d), n.addChild(d)), s === "justify" && i.wordWrap && t < o.length - 1) {
			let e = n.children, t = e.length - 1;
			if (t > 0) {
				let n = (c - l) / t;
				for (let t = 1; t < e.length; t++) e[t].x += t * n;
			}
		}
		C += a.lineHeight;
	}), {
		chars: b,
		lines: x,
		words: S
	};
}
function Ek(e, t, n, r) {
	let { runsByLine: i } = e, a = t.align, o = e.lineWidths.reduce((e, t) => Math.max(e, t), 0), s = 0, c = 0;
	if (t.trim) {
		let { frame: e, canvasAndContext: n } = Sv.getCanvasAndContext({
			text: r,
			style: t,
			resolution: 1
		});
		Sv.returnCanvasAndContext(n), s = -e.x, c = -e.y;
	}
	let l = [], u = [], d = [], f = 0, p = 0;
	return i.forEach((r, m) => {
		let h = new Y({ label: `line-${m}` });
		h.y = f + c, u.push(h);
		let g = e.lineWidths[m], _ = xk(a, g, o), v = new Y({ label: "word" });
		v.x = _ + s;
		for (let e of r) {
			let t = e.style, r = t._fill?.fill, i = t._stroke?.fill, a = r instanceof wd, o = i instanceof wd, c = a || o, u = a && r.textureSpace === "local" || o && i.textureSpace === "local", f = hv.graphemeSegmenter(e.text), m = t.clone();
			m.align = "left", m.wordWrap = !1, m.trim &&= !1, m.tagStyles = void 0, m._lineHeight = 0;
			let g = hv._context;
			g.font = m._fontString, hv.experimentalLetterSpacingSupported && (g.letterSpacing = "0px", g.textLetterSpacing = "0px");
			let y = e.text, b = g.measureText(y).width, x = _, S = b, C = hv.measureFont(m._fontString), w = t.lineHeight || C.fontSize, T = u ? {
				width: S,
				height: w
			} : null;
			for (let e of f) {
				y = y.slice(e.length);
				let r = y.length > 0 ? g.measureText(y).width : 0, i = b - r;
				if (b = r, !Sk(e) && i !== 0) {
					if (e === " ") v.children.length > 0 && (d.push(v), h.addChild(v)), _ += i + t.letterSpacing, v = new Y({ label: "word" }), v.x = _ + s;
					else {
						let r = m;
						c && (r = m.clone(), u ? (r._gradientOffset = {
							x: -(_ - x),
							y: 0
						}, r._gradientBounds = T) : r._gradientOffset = {
							x: -(_ - x),
							y: 0
						});
						let a;
						p < n.length ? (a = n[p++], a.text = e, a.style = r, a.setFromMatrix(B.IDENTITY), a.x = _ - v.x + s) : a = new Hv({
							text: e,
							style: r,
							x: _ - v.x + s
						}), l.push(a), v.addChild(a), _ += i + t.letterSpacing;
					}
				}
			}
		}
		if (v.children.length > 0 && (d.push(v), h.addChild(v)), a === "justify" && t.wordWrap && m < i.length - 1) {
			let e = h.children, t = e.length - 1;
			if (t > 0) {
				let n = (o - g) / t;
				for (let t = 1; t < e.length; t++) e[t].x += t * n;
			}
		}
		let y = e.lineHeights?.[m] ?? e.lineHeight;
		f += y;
	}), {
		chars: l,
		lines: u,
		words: d
	};
}
var Dk = Object.defineProperty, Ok = Object.defineProperties, kk = Object.getOwnPropertyDescriptors, Ak = Object.getOwnPropertySymbols, jk = Object.prototype.hasOwnProperty, Mk = Object.prototype.propertyIsEnumerable, Nk = (e, t, n) => t in e ? Dk(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Pk = (e, t) => {
	for (var n in t ||= {}) jk.call(t, n) && Nk(e, n, t[n]);
	if (Ak) for (var n of Ak(t)) Mk.call(t, n) && Nk(e, n, t[n]);
	return e;
}, Fk = (e, t) => Ok(e, kk(t)), Ik = class e extends uk {
	constructor(t) {
		let n = Pk(Pk({}, e.defaultOptions), t);
		super(n);
	}
	static from(t, n) {
		let r = Fk(Pk(Pk({}, e.defaultOptions), n), {
			text: t.text,
			style: new Nv(t.style)
		}), i = new e(Pk({}, r)), a = t.anchor;
		return (a.x !== 0 || a.y !== 0) && i.pivot.set(i.width * a.x, i.height * a.y), i;
	}
	splitFn() {
		return Tk({
			text: this._originalText,
			style: this._style,
			chars: this._canReuseChars ? this.chars : []
		});
	}
};
Ik.defaultOptions = {
	autoSplit: !0,
	lineAnchor: 0,
	wordAnchor: 0,
	charAnchor: 0
};
//#endregion
//#region runtime/display-1.js
var Lk = Object.freeze({
	zh: {
		title: "请旋转屏幕继续",
		sub: "或把窗口拉宽"
	},
	en: {
		title: "Rotate the screen to continue",
		sub: "or widen the window"
	},
	ja: {
		title: "画面を回転して続けてください",
		sub: "またはウィンドウを広げてください"
	}
}), Rk = [
	"landscape",
	"portrait",
	"both"
];
function zk(e, t) {
	return e >= t ? "landscape" : "portrait";
}
function Bk(e, t) {
	return e === "landscape" && t === "portrait";
}
function Vk(e) {
	let t = Math.max(1, e.width | 0), n = Math.max(1, e.height | 0), r = e.dpr > 0 ? e.dpr : 1, i = e.maxPixelRatio > 0 ? e.maxPixelRatio : 2, a = e.minPixelRatio > 0 ? e.minPixelRatio : 1, o = Math.min(r, i);
	return e.maxPixels > 0 && t * n * o * o > e.maxPixels && (o = Math.sqrt(e.maxPixels / (t * n))), o = Math.max(a, Math.min(o, i)), Math.round(o * 100) / 100;
}
function Hk(e) {
	let t = String(e || typeof document < "u" && document.documentElement.lang || typeof navigator < "u" && navigator.language || "en").toLowerCase();
	return t.startsWith("zh") ? "zh" : t.startsWith("ja") ? "ja" : "en";
}
function Uk(e) {
	let t = Lk[e] || Lk.en, n = document.createElement("div");
	n.setAttribute("data-mp-rotate", "1"), n.setAttribute("role", "status"), n.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(6,3,13,.95);color:#f4f1fa;font:600 20px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Noto Sans,sans-serif;text-align:center;padding:24px;box-sizing:border-box;touch-action:none;user-select:none;-webkit-user-select:none";
	let r = document.createElement("style");
	r.textContent = "@keyframes mpRotateHint{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(90deg)}}";
	let i = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	i.setAttribute("width", "64"), i.setAttribute("height", "64"), i.setAttribute("viewBox", "0 0 64 64"), i.setAttribute("aria-hidden", "true"), i.style.animation = "mpRotateHint 1.8s ease-in-out infinite alternate";
	let a = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	for (let [e, t] of [
		["x", "18"],
		["y", "6"],
		["width", "28"],
		["height", "52"],
		["rx", "5"],
		["fill", "none"],
		["stroke", "#f4f1fa"],
		["stroke-width", "3"]
	]) a.setAttribute(e, t);
	let o = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	for (let [e, t] of [
		["cx", "32"],
		["cy", "51"],
		["r", "2.5"],
		["fill", "#f4f1fa"]
	]) o.setAttribute(e, t);
	i.appendChild(a), i.appendChild(o);
	let s = document.createElement("div");
	s.textContent = t.title;
	let c = document.createElement("div");
	return c.style.cssText = "font-size:14px;font-weight:400;opacity:.75", c.textContent = t.sub, n.appendChild(r), n.appendChild(i), n.appendChild(s), n.appendChild(c), n;
}
var Wk = 1.5, Gk;
function Kk() {
	if (Gk !== void 0) return Gk;
	try {
		let e = navigator.userAgentData;
		return Gk = e && typeof e.mobile == "boolean" ? e.mobile : matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) <= 500;
	} catch {
		return Gk = !1;
	}
}
function qk(e, t, n) {
	let r = e > 0 ? e : 2;
	if (!t) return r;
	let i = typeof window < "u" ? window.__mpPhoneMaxRatio : void 0;
	if (typeof i == "number" && isFinite(i)) return i <= 0 ? r : Math.min(r, i);
	let a = Math.min(r, Wk);
	return n ? Math.max(1, Math.floor(a)) : a;
}
function Jk(e) {
	let t = e || {}, n = Rk.includes(t.orientation) ? t.orientation : "both", r = t.host || typeof document < "u" && (document.getElementById("app") || document.body) || null, i = Hk(t.lang), a = t.pixelated === !0, o = [], s = null, c = 0, l = !1, u = null, d = null, f = {
		width: 0,
		height: 0,
		resolution: 1,
		dpr: 1,
		orientation: "landscape",
		blocked: !1,
		bufferWidth: 0,
		bufferHeight: 0
	}, p = "";
	function m() {
		let e = r ? r.clientWidth : 0, t = r ? r.clientHeight : 0;
		if (!(e > 0 && t > 0)) {
			let n = document.documentElement;
			e = n && n.clientWidth || window.innerWidth, t = n && n.clientHeight || window.innerHeight;
		}
		return {
			w: Math.max(1, Math.round(e)),
			h: Math.max(1, Math.round(t))
		};
	}
	function h(e) {
		e && !s ? (s = Uk(i), document.body.appendChild(s)) : !e && s && (s.remove(), s = null);
	}
	function g(e) {
		if (typeof matchMedia == "function") {
			u && u.removeEventListener("change", y);
			try {
				u = matchMedia("(resolution: " + e + "dppx)"), u.addEventListener("change", y);
			} catch {
				u = null;
			}
		}
	}
	function _() {
		if (l) return;
		let e = m(), r = window.devicePixelRatio || 1, i = qk(t.maxPixelRatio, Kk(), a), s = Vk({
			width: e.w,
			height: e.h,
			dpr: r,
			maxPixelRatio: i,
			minPixelRatio: t.minPixelRatio,
			maxPixels: t.maxPixels === void 0 ? 4e6 : t.maxPixels
		}), c = zk(e.w, e.h), u = Bk(n, c), d = e.w + "x" + e.h + "@" + s + "/" + r + "/" + c, _ = u !== f.blocked;
		if (d !== p || _) {
			p = d, f.width = e.w, f.height = e.h, f.resolution = s, f.dpr = r, f.orientation = c, f.blocked = u, f.bufferWidth = Math.round(e.w * s), f.bufferHeight = Math.round(e.h * s);
			for (let e of o) try {
				e(f);
			} catch (e) {
				console.warn("[display] attach target failed", e);
			}
			h(u), S || (typeof t.onResize == "function" && t.onResize(f), _ && typeof t.onBlocked == "function" && t.onBlocked(u)), g(r);
		}
	}
	let v = !1;
	function y() {
		l || v || (v = !0, c = requestAnimationFrame(() => {
			v = !1, _();
		}));
	}
	function b(e) {
		e && e.style && a && (e.style.imageRendering = "pixelated", e.setAttribute("data-mp-pixelated", "1"));
	}
	let x = {
		info: f,
		get declaredOrientation() {
			return n;
		},
		refresh() {
			return _(), f;
		},
		attachPixi(e) {
			let t = (t) => {
				let n = e && e.renderer;
				n && (n.resolution !== t.resolution && (n.resolution = t.resolution), n.resize(t.width, t.height), b(e.canvas || n.canvas));
			};
			return o.push(t), f.width && t(f), x;
		},
		attachThree(e, t) {
			let n = (n) => {
				e && (e.setPixelRatio(n.resolution), e.setSize(n.width, n.height, !0), t && typeof t.updateProjectionMatrix == "function" && "aspect" in t && (t.aspect = n.width / n.height, t.updateProjectionMatrix()), b(e.domElement));
			};
			return o.push(n), f.width && n(f), x;
		},
		attachCanvas(e) {
			let t = (t) => {
				e && (e.width = t.bufferWidth, e.height = t.bufferHeight, e.style.width = t.width + "px", e.style.height = t.height + "px", b(e));
			};
			return o.push(t), f.width && t(f), x;
		},
		applyTransform(e) {
			return e.setTransform(f.resolution, 0, 0, f.resolution, 0, 0), f;
		},
		dispose() {
			l = !0, c && cancelAnimationFrame(c), window.removeEventListener("resize", y), window.removeEventListener("orientationchange", y), window.visualViewport && window.visualViewport.removeEventListener("resize", y), d && d.disconnect(), u && u.removeEventListener("change", y), h(!1), o.length = 0;
		}
	};
	if (window.addEventListener("resize", y), window.addEventListener("orientationchange", y), window.visualViewport && window.visualViewport.addEventListener("resize", y), typeof ResizeObserver == "function" && r) try {
		d = new ResizeObserver(y), d.observe(r);
	} catch {
		d = null;
	}
	let S = !0;
	return _(), S = !1, queueMicrotask(() => {
		l || (typeof t.onResize == "function" && t.onResize(f), f.blocked && typeof t.onBlocked == "function" && t.onBlocked(!0));
	}), x;
}
//#endregion
//#region runtime/sound-1.js
var Yk = 1e-6, Xk = Object.freeze({
	panningModel: "equalpower",
	distanceModel: "inverse",
	refDistance: 133,
	maxDistance: 3200,
	rolloffFactor: .5,
	speedOfSound: 9150,
	dopplerFactor: 1,
	levelTrimDb: 3
}), Zk = Object.freeze({
	three: Object.freeze({
		id: "three",
		panningModel: "HRTF",
		distanceModel: "inverse",
		refDistance: 5,
		maxDistance: 120,
		rolloffFactor: .5,
		speedOfSound: 343,
		dopplerFactor: 1,
		levelTrimDb: 0
	}),
	pixi: Object.freeze({
		id: "pixi",
		...Xk
	}),
	phaser: Object.freeze({
		id: "phaser",
		...Xk
	})
});
function Qk(e) {
	let t = Number(e?.levelTrimDb);
	return Number.isFinite(t) ? 10 ** (t / 20) : 1;
}
var $k = .5, eA = 2, tA = .02, nA = .05;
function rA(e, t = 0) {
	let n = Number(e);
	return Number.isFinite(n) ? n : t;
}
function iA(e) {
	return typeof e == "object" && !!e && (Array.isArray(e) || "x" in e || "y" in e || "z" in e);
}
function aA(e, t = null) {
	if (!iA(e)) return t;
	let n = Array.isArray(e) ? [
		e[0],
		e[1],
		e[2]
	] : [
		e.x,
		e.y,
		e.z
	], r = [];
	for (let e of n) {
		if (e == null) {
			r.push(0);
			continue;
		}
		let n = Number(e);
		if (!Number.isFinite(n)) return t;
		r.push(n);
	}
	return {
		x: r[0],
		y: r[1],
		z: r[2]
	};
}
function oA(e, t) {
	return {
		x: e.x - t.x,
		y: e.y - t.y,
		z: e.z - t.z
	};
}
function sA(e, t) {
	return e.x * t.x + e.y * t.y + e.z * t.z;
}
function cA(e, t) {
	return e != null && t != null && e.x === t.x && e.y === t.y && e.z === t.z;
}
function lA(e) {
	let t = Math.sqrt(sA(e, e));
	return t < Yk ? null : {
		x: e.x / t,
		y: e.y / t,
		z: e.z / t
	};
}
function uA({ listenerPosition: e, listenerVelocity: t, sourcePosition: n, sourceVelocity: r, speedOfSound: i, dopplerFactor: a = 1 }) {
	if (!(a > 0)) return 1;
	let o = rA(i, 0);
	if (!(o > 0)) return 1;
	let s = lA(oA(e, n));
	if (!s) return 1;
	let c = sA(t, s) * a, l = sA(r, s) * a, u = o - c, d = o - l;
	if (d <= Yk) return eA;
	if (u <= 0) return $k;
	let f = u / d;
	return Number.isFinite(f) ? Math.min(eA, Math.max($k, f)) : 1;
}
function dA(e, t, n, r = tA) {
	e.setTargetAtTime(t, n, r);
}
function fA() {
	return {
		position: null,
		velocity: {
			x: 0,
			y: 0,
			z: 0
		},
		explicitVelocity: null,
		skipNext: !0,
		reset() {
			this.velocity = {
				x: 0,
				y: 0,
				z: 0
			}, this.skipNext = !0;
		},
		integrate(e, t) {
			if (this.explicitVelocity) this.velocity = this.explicitVelocity;
			else if (this.skipNext) this.velocity = {
				x: 0,
				y: 0,
				z: 0
			};
			else if (t > 0) {
				let n = oA(e, this.position);
				this.velocity = {
					x: n.x / t,
					y: n.y / t,
					z: n.z / t
				};
			}
			return this.skipNext = !1, this.position = e, this.velocity;
		}
	};
}
function pA({ profile: e = Zk.three } = {}) {
	let t = { ...e }, n = null, r = null, i = fA(), a = /* @__PURE__ */ new Set();
	function o(...e) {
		let n = t;
		for (let t of e) t && typeof t == "object" && (n = {
			...n,
			...t
		});
		return n;
	}
	function s(e) {
		return t = {
			...t,
			...e ?? {}
		}, { ...t };
	}
	function c() {
		return { ...t };
	}
	function l() {
		return n != null;
	}
	function u(e) {
		let t = iA(e) ? aA(e) : aA(e?.position);
		if (!t) throw TypeError("setListener requires a position: { position: {x,y,z} } or a bare vector");
		let r = aA(e?.forward) ?? {
			x: 0,
			y: 0,
			z: -1
		}, a = aA(e?.up) ?? {
			x: 0,
			y: 1,
			z: 0
		};
		return i.explicitVelocity = aA(e?.velocity), n = {
			position: t,
			forward: r,
			up: a
		}, n;
	}
	function d() {
		i.reset();
	}
	function f(e) {
		let t = e?.listener;
		if (!n || !t?.positionX) return;
		let { position: i, forward: a, up: o } = n, s = e.currentTime;
		cA(r?.position, i) || (dA(t.positionX, i.x, s), dA(t.positionY, i.y, s), dA(t.positionZ, i.z, s)), (!cA(r?.forward, a) || !cA(r?.up, o)) && (dA(t.forwardX, a.x, s), dA(t.forwardY, a.y, s), dA(t.forwardZ, a.z, s), dA(t.upX, o.x, s), dA(t.upY, o.y, s), dA(t.upZ, o.z, s)), r = {
			position: i,
			forward: a,
			up: o
		};
	}
	function p(e, t, n) {
		if (typeof e?.createPanner != "function") return null;
		let r = e.createPanner();
		r.panningModel = n.panningModel, r.distanceModel = n.distanceModel, r.refDistance = n.refDistance, r.maxDistance = n.maxDistance, r.rolloffFactor = n.rolloffFactor;
		let i = e.currentTime;
		return r.positionX.setValueAtTime(t.x, i), r.positionY.setValueAtTime(t.y, i), r.positionZ.setValueAtTime(t.z, i), r;
	}
	function m(e, t, n) {
		if (!e.panner || cA(e.pushedPosition, n)) return;
		let r = t.currentTime;
		dA(e.panner.positionX, n.x, r), dA(e.panner.positionY, n.y, r), dA(e.panner.positionZ, n.z, r), e.pushedPosition = n;
	}
	function h({ position: e = {
		x: 0,
		y: 0,
		z: 0
	}, spatial: t = null, id: n = null } = {}) {
		let r = fA(), i = {
			id: n,
			disposed: !1,
			position: aA(e) ?? {
				x: 0,
				y: 0,
				z: 0
			},
			overrides: t && typeof t == "object" ? { ...t } : null,
			voices: /* @__PURE__ */ new Set(),
			stopEpoch: 0,
			pitchScale: 1,
			get velocity() {
				return r.velocity;
			},
			setPosition(e) {
				let t = aA(e);
				if (!t) throw TypeError("emitter position must be a vector");
				return i.position = t, i;
			},
			setVelocity(e) {
				return r.explicitVelocity = aA(e), i;
			},
			setPitch(e) {
				let t = Number(e);
				if (!Number.isFinite(t) || t <= 0) throw RangeError("pitch scale must be a positive number");
				return i.pitchScale = Math.min(4, Math.max(.25, t)), i;
			},
			resetMotion() {
				return r.reset(), i;
			},
			_integrate(e) {
				return r.integrate(i.position, e);
			}
		};
		return a.add(i), i;
	}
	function g(e) {
		e && (e.disposed = !0, a.delete(e));
	}
	function _(e, t, { listenerVelocity: r, sourceVelocity: i }) {
		if (!e.source?.playbackRate) return;
		let a = 1;
		e.doppler && (a = uA({
			listenerPosition: n.position,
			listenerVelocity: r,
			sourcePosition: e.emitter.position,
			sourceVelocity: i,
			speedOfSound: e.params.speedOfSound,
			dopplerFactor: e.params.dopplerFactor
		})), e.dopplerRatio = a;
		let o = e.playbackRate * e.emitter.pitchScale * a;
		o !== e.appliedRate && (e.appliedRate = o, dA(e.source.playbackRate, o, t.currentTime, nA));
	}
	function v(e, t) {
		if (!n || !t) return {
			emitters: a.size,
			voices: 0
		};
		let r = i.integrate(n.position, e);
		f(t);
		let o = 0;
		for (let n of a) {
			if (n.disposed) continue;
			let i = n._integrate(e);
			for (let e of n.voices) e.finalized || (o += 1, m(e, t, n.position), _(e, t, {
				listenerVelocity: r,
				sourceVelocity: i
			}));
		}
		return {
			emitters: a.size,
			voices: o
		};
	}
	function y() {
		return {
			profile: c(),
			listener: n ? {
				position: { ...n.position },
				forward: { ...n.forward },
				up: { ...n.up },
				velocity: { ...i.velocity }
			} : null,
			emitters: [...a].map((e) => ({
				id: e.id,
				position: { ...e.position },
				velocity: { ...e.velocity },
				pitchScale: e.pitchScale,
				voices: [...e.voices].filter((e) => !e.finalized).map((e) => ({
					instanceId: e.instanceId,
					cueId: e.cueId,
					doppler: !!e.doppler,
					dopplerRatio: e.dopplerRatio ?? 1,
					appliedRate: e.appliedRate ?? e.playbackRate
				}))
			}))
		};
	}
	function b() {
		for (let e of a) e.disposed = !0;
		a.clear(), n = null, r = null, i.reset();
	}
	return {
		setProfile: s,
		getProfile: c,
		resolveParams: o,
		setListener: u,
		resetListenerMotion: d,
		hasListener: l,
		createEmitter: h,
		removeEmitter: g,
		createPanner: p,
		update: v,
		snapshot: y,
		clear: b
	};
}
function mA(e, { engine: t, readListener: n, readPosition: r, isGone: i }) {
	e.configureSpatial(t);
	let a = /* @__PURE__ */ new Map(), o = !1;
	function s() {
		e.setListener(n());
	}
	return s(), Object.freeze({
		engine: t,
		syncListener() {
			return s(), this;
		},
		resetMotion() {
			e.resetListenerMotion();
			for (let e of a.keys()) e.resetMotion();
			return this;
		},
		createEmitter({ object: n, ...i } = {}) {
			if (!n) throw TypeError(`${t} adapter: createEmitter requires an object`);
			let o = e.createEmitter({
				...i,
				position: r(n)
			});
			return a.set(o, n), o;
		},
		update(t) {
			if (o) return null;
			s();
			for (let [e, t] of a) {
				if (e.disposed) {
					a.delete(e);
					continue;
				}
				if (i(t)) {
					a.delete(e), e.dispose();
					continue;
				}
				e.setPosition(r(t));
			}
			return e.updateSpatial(t);
		},
		dispose() {
			o = !0;
			for (let e of [...a.keys()]) e.dispose();
			a.clear();
		}
	});
}
function hA(e) {
	return {
		x: e[12],
		y: e[13],
		z: e[14]
	};
}
function gA(e, t, n) {
	let r = Math.hypot(e, t, n);
	return r > 1e-6 ? {
		x: e / r + 0,
		y: t / r + 0,
		z: n / r + 0
	} : null;
}
function _A(e) {
	return gA(-e[8], -e[9], -e[10]) ?? {
		x: 0,
		y: 0,
		z: -1
	};
}
function vA(e) {
	return gA(e[4], e[5], e[6]) ?? {
		x: 0,
		y: 1,
		z: 0
	};
}
function yA(e) {
	let t = e?.matrixWorld?.elements;
	if (!t || t.length < 16) throw TypeError("three adapter needs an Object3D with a matrixWorld");
	return t;
}
function bA(e) {
	return e == null || e.parent === null && e.isScene !== !0;
}
function xA(e, { camera: t, listenerObject: n, autoUpdateMatrices: r = !1 } = {}) {
	let i = n ?? t;
	if (!i) throw TypeError("attachThree requires a camera (or listenerObject)");
	function a(e) {
		r && typeof e?.updateMatrixWorld == "function" && e.updateMatrixWorld();
	}
	let o = mA(e, {
		engine: "three",
		readListener() {
			a(i);
			let e = yA(i);
			return {
				position: hA(e),
				forward: _A(e),
				up: vA(e)
			};
		},
		readPosition(e) {
			return a(e), hA(yA(e));
		},
		isGone: bA
	});
	return Object.freeze({
		...o,
		setListenerTarget(e) {
			if (!e) throw TypeError("setListenerTarget requires an Object3D");
			return i = e, o.syncListener().resetMotion(), this;
		}
	});
}
function SA(e, t) {
	let n = e?.worldTransform;
	if (!n || typeof n.tx != "number") throw TypeError(`pixi adapter needs ${t} to have a worldTransform`);
	return n;
}
function CA(e, t, n) {
	let { a: r, b: i, c: a, d: o, tx: s, ty: c } = e, l = r * o - i * a;
	if (Math.abs(l) < 1e-12) return {
		x: 0,
		y: 0
	};
	let u = t - s, d = n - c;
	return {
		x: (u * o - d * a) / l,
		y: (d * r - u * i) / l
	};
}
function wA(e) {
	return {
		x: e.x,
		y: 0,
		z: e.y
	};
}
function TA(e) {
	return e == null || e.destroyed === !0 || e.parent === null;
}
function EA(e, t) {
	if (!e || !(e.width > 0) || !(e.height > 0)) throw TypeError(`${t} requires a logical screen size`);
}
function DA(e, { world: t, screen: n } = {}) {
	if (!t) throw TypeError("attachPixi requires the game world container");
	EA(n, "attachPixi");
	let r = n, i = mA(e, {
		engine: "pixi",
		readListener() {
			return { position: wA(CA(SA(t, "the world container"), r.width / 2, r.height / 2)) };
		},
		readPosition(e) {
			let n = SA(e, "the emitter object");
			return wA(CA(SA(t, "the world container"), n.tx, n.ty));
		},
		isGone: TA
	});
	return Object.freeze({
		...i,
		setScreen(e) {
			return EA(e, "setScreen"), r = e, i.syncListener(), this;
		}
	});
}
function OA(e, t) {
	let n = (e) => typeof e == "number" && Number.isFinite(e);
	if (!e || !n(e.scrollX) || !n(e.scrollY) || !n(e.width) || !n(e.height)) throw TypeError(`${t} requires a Phaser camera with numeric scrollX/scrollY/width/height`);
}
function kA(e) {
	return OA(e, "phaser adapter"), jA({
		x: e.scrollX + e.width / 2,
		y: e.scrollY + e.height / 2
	});
}
function AA(e) {
	if (!e.parentContainer) {
		if (typeof e.x != "number" || typeof e.y != "number") throw TypeError("phaser adapter needs the emitter object to have numeric x/y");
		return {
			x: e.x,
			y: e.y
		};
	}
	if (typeof e.getWorldTransformMatrix != "function") throw TypeError("phaser adapter needs a container child to have getWorldTransformMatrix()");
	let t = e.getWorldTransformMatrix();
	if (typeof t?.tx != "number" || typeof t?.ty != "number") throw TypeError("phaser adapter needs getWorldTransformMatrix() to return numeric tx/ty");
	return {
		x: t.tx,
		y: t.ty
	};
}
function jA(e) {
	return {
		x: e.x,
		y: 0,
		z: e.y
	};
}
function MA(e) {
	return e == null || e.scene == null;
}
function NA(e, { scene: t, camera: n = t?.cameras?.main, autoUpdate: r = !0 } = {}) {
	let i = t?.events;
	if (!i || typeof i.on != "function" || typeof i.once != "function" || typeof i.off != "function") throw TypeError("attachPhaser requires a Phaser scene");
	OA(n, "attachPhaser");
	let a = n, o = mA(e, {
		engine: "phaser",
		readListener() {
			return { position: kA(a) };
		},
		readPosition(e) {
			return jA(AA(e));
		},
		isGone: MA
	});
	function s(e, t) {
		o.update(t / 1e3);
	}
	function c() {
		i.off("postupdate", s), i.off("shutdown", c), i.off("destroy", c), o.dispose();
	}
	return r && i.on("postupdate", s), i.once("shutdown", c), i.once("destroy", c), Object.freeze({
		...o,
		dispose: c,
		setCamera(e) {
			return OA(e, "setCamera"), a = e, o.syncListener().resetMotion(), this;
		}
	});
}
var PA = Object.freeze([
	"master",
	"music",
	"sfx",
	"voice"
]), FA = Object.freeze({
	master: 1,
	music: 1,
	sfx: 1,
	voice: 1
}), IA = 200, LA = "0.8.1", RA = /* @__PURE__ */ new WeakMap();
function zA(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function BA(e, t) {
	if (Array.isArray(e)) {
		let n = e.map((e, n) => {
			if (!zA(e) || typeof e.id != "string" || e.id.length === 0) throw TypeError(`${t}[${n}] must have a non-empty id`);
			return [e.id, { ...e }];
		});
		return new Map(n);
	}
	if (zA(e)) return new Map(Object.entries(e).map(([e, n]) => {
		if (!zA(n)) throw TypeError(`${t}.${e} must be an object`);
		return [e, {
			id: e,
			...n
		}];
	}));
	throw TypeError(`manifest.${t} must be an object or array`);
}
function VA(e, t) {
	return e == null ? /* @__PURE__ */ new Map() : BA(e, t);
}
function HA(e) {
	return e === -Infinity ? 0 : 10 ** (Number(e || 0) / 20);
}
function UA(e) {
	return e === 0 ? 0 : e * e;
}
function WA(e, t, n) {
	e && Number.isFinite(t) && (typeof e.setValueAtTime == "function" && Number.isFinite(n) ? e.setValueAtTime(t, n) : e.value = t);
}
function GA(e, t, n) {
	e && (typeof e.linearRampToValueAtTime == "function" && Number.isFinite(n) ? e.linearRampToValueAtTime(t, n) : e.value = t);
}
function KA(e, t, n) {
	if (!e) return;
	let r = Number.isFinite(e.value) ? e.value : 1;
	if (typeof e.exponentialRampToValueAtTime == "function" && Number.isFinite(n) && r > 0 && t > 0) {
		e.exponentialRampToValueAtTime(t, n);
		return;
	}
	GA(e, t, n);
}
function qA(e, t) {
	e && typeof e.cancelScheduledValues == "function" && e.cancelScheduledValues(Number.isFinite(t) ? t : 0);
}
function JA(e) {
	let t = String(e), n = 2166136261;
	for (let e = 0; e < t.length; e += 1) n ^= t.charCodeAt(e), n = Math.imul(n, 16777619);
	return n >>> 0;
}
function YA(e, t, n) {
	let r = e.assetIds ?? e.assets ?? e.assetId, i = (Array.isArray(r) ? r : [r]).filter((e) => e != null).map((e) => typeof e == "string" ? {
		assetId: e,
		weight: 1
	} : {
		assetId: e.assetId ?? e.id,
		weight: Number.isFinite(e.weight) && e.weight > 0 ? e.weight : 1
	}).filter((e) => typeof e.assetId == "string" && e.assetId.length > 0);
	if (i.length === 0) throw Error(`cue ${t} has no assets`);
	let a = i.reduce((e, t) => e + t.weight, 0), o = JA(`${t}:${n}`) / 4294967296 * a;
	for (let e of i) if (o -= e.weight, o < 0) return e.assetId;
	return i.at(-1).assetId;
}
function XA(e, t) {
	let n = e.variants, r;
	r = Array.isArray(n) ? n.map((e, n) => ({
		id: e.id ?? e.format ?? e.codec ?? `${t}-${n}`,
		...e
	})) : zA(n) ? Object.entries(n).map(([e, t]) => typeof t == "string" ? {
		id: e,
		format: e,
		url: t
	} : {
		id: e,
		format: t.format ?? e,
		...t
	}) : e.url || e.path || e.file || e.src ? [{
		id: e.format ?? e.codec ?? t,
		format: e.format ?? e.codec,
		mimeType: e.mimeType,
		url: e.url ?? e.path ?? e.file ?? e.src
	}] : [];
	let i = /* @__PURE__ */ new Map([
		["opus", 0],
		["ogg", 1],
		["vorbis", 1],
		["aac", 2],
		["m4a", 2],
		["mp3", 3],
		["mpeg", 3],
		["wav", 4]
	]);
	return r.filter((e) => e.pack || e.url || e.path || e.file || e.src).map((e, t) => ({
		variant: e,
		index: t
	})).sort((e, t) => {
		let n = gj(e.variant.priority, e.variant.preference), r = gj(t.variant.priority, t.variant.preference);
		if (n != null || r != null) {
			let e = (n ?? Infinity) - (r ?? Infinity);
			if (e !== 0) return e;
		}
		let a = String(e.variant.codec ?? e.variant.format ?? e.variant.id).toLowerCase(), o = String(t.variant.codec ?? t.variant.format ?? t.variant.id).toLowerCase();
		return (i.get(a) ?? 99) - (i.get(o) ?? 99) || e.index - t.index;
	}).map(({ variant: e }) => e);
}
var ZA = "MPSND1", QA = 1, $A = 4096, ej = 14;
function tj(e) {
	return new TextEncoder().encode(e);
}
function nj(e) {
	let t = e.reduce((e, t) => e + t.length, 0), n = new Uint8Array(t), r = 0;
	for (let t of e) n.set(t, r), r += t.length;
	return n;
}
var rj = new Uint32Array([
	1116352408,
	1899447441,
	3049323471,
	3921009573,
	961987163,
	1508970993,
	2453635748,
	2870763221,
	3624381080,
	310598401,
	607225278,
	1426881987,
	1925078388,
	2162078206,
	2614888103,
	3248222580,
	3835390401,
	4022224774,
	264347078,
	604807628,
	770255983,
	1249150122,
	1555081692,
	1996064986,
	2554220882,
	2821834349,
	2952996808,
	3210313671,
	3336571891,
	3584528711,
	113926993,
	338241895,
	666307205,
	773529912,
	1294757372,
	1396182291,
	1695183700,
	1986661051,
	2177026350,
	2456956037,
	2730485921,
	2820302411,
	3259730800,
	3345764771,
	3516065817,
	3600352804,
	4094571909,
	275423344,
	430227734,
	506948616,
	659060556,
	883997877,
	958139571,
	1322822218,
	1537002063,
	1747873779,
	1955562222,
	2024104815,
	2227730452,
	2361852424,
	2428436474,
	2756734187,
	3204031479,
	3329325298
]);
function ij(e) {
	let t = nj(e), n = t.length * 8, r = (t.length + 9 >> 6) + 1 << 6, i = new Uint8Array(r);
	i.set(t), i[t.length] = 128;
	let a = new DataView(i.buffer);
	a.setUint32(r - 4, n >>> 0, !1), a.setUint32(r - 8, Math.floor(n / 4294967296), !1);
	let o = 1779033703, s = 3144134277, c = 1013904242, l = 2773480762, u = 1359893119, d = 2600822924, f = 528734635, p = 1541459225, m = /* @__PURE__ */ new Uint32Array(64);
	for (let e = 0; e < r; e += 64) {
		for (let t = 0; t < 16; t += 1) m[t] = a.getUint32(e + t * 4, !1);
		for (let e = 16; e < 64; e += 1) {
			let t = m[e - 15], n = m[e - 2], r = (t >>> 7 | t << 25) ^ (t >>> 18 | t << 14) ^ t >>> 3, i = (n >>> 17 | n << 15) ^ (n >>> 19 | n << 13) ^ n >>> 10;
			m[e] = m[e - 16] + r + m[e - 7] + i >>> 0;
		}
		let t = o, n = s, r = c, i = l, h = u, g = d, _ = f, v = p;
		for (let e = 0; e < 64; e += 1) {
			let a = (h >>> 6 | h << 26) ^ (h >>> 11 | h << 21) ^ (h >>> 25 | h << 7), o = h & g ^ ~h & _, s = v + a + o + rj[e] + m[e] >>> 0, c = ((t >>> 2 | t << 30) ^ (t >>> 13 | t << 19) ^ (t >>> 22 | t << 10)) + (t & n ^ t & r ^ n & r) >>> 0;
			v = _, _ = g, g = h, h = i + s >>> 0, i = r, r = n, n = t, t = s + c >>> 0;
		}
		o = o + t >>> 0, s = s + n >>> 0, c = c + r >>> 0, l = l + i >>> 0, u = u + h >>> 0, d = d + g >>> 0, f = f + _ >>> 0, p = p + v >>> 0;
	}
	let h = /* @__PURE__ */ new Uint8Array(32), g = new DataView(h.buffer);
	return [
		o,
		s,
		c,
		l,
		u,
		d,
		f,
		p
	].forEach((e, t) => g.setUint32(t * 4, e, !1)), h;
}
function aj(e, t, n) {
	let r = ij([
		e,
		tj(String(t)),
		tj(n)
	]), i = [];
	for (let e = 0; e * 32 < $A; e += 1) {
		let t = /* @__PURE__ */ new Uint8Array(4);
		new DataView(t.buffer).setUint32(0, e, !0), i.push(ij([r, t]));
	}
	return nj(i).subarray(0, $A);
}
function oj(e, t) {
	let n = new Uint8Array(e.length);
	for (let r = 0; r < e.length; r += 1) n[r] = e[r] ^ t[r % t.length];
	return n;
}
function sj(e, t) {
	let n = new Uint8Array(e), r = new DataView(n.buffer, n.byteOffset, n.byteLength);
	if (new TextDecoder().decode(n.subarray(0, 6)) !== ZA) throw Error("not a sound pack");
	let i = r.getUint16(6, !0);
	if (i !== QA) throw Error(`unsupported pack version ${i}`);
	let a = r.getUint16(8, !0), o = r.getUint32(10, !0), s = n.subarray(ej, ej + a), c = ej + a, l = c + o, u = aj(s, t, "index"), d = aj(s, t, "payload"), f = oj(n.subarray(c, l), u);
	return {
		index: JSON.parse(new TextDecoder().decode(f)),
		payload: oj(n.subarray(l), d)
	};
}
function cj(e) {
	return e.url ?? e.path ?? e.file ?? e.src;
}
function lj(e, t) {
	if (!e || /^(?:data:|blob:|https?:|file:)/i.test(t)) return t;
	try {
		let n = e.endsWith("/") ? e : `${e}/`;
		return new URL(t, n).toString();
	} catch {
		return `${e}${e.endsWith("/") || e.endsWith("\\") ? "" : "/"}${t}`;
	}
}
function uj(e, t) {
	let n = t || e, r = globalThis.document?.baseURI ?? globalThis.location?.href;
	try {
		let e = r ? new URL(n, r) : new URL(n);
		return new URL(".", e).toString();
	} catch {
		let e = String(n).split(/[?#]/, 1)[0].replaceAll("\\\\", "/"), t = e.lastIndexOf("/");
		return t >= 0 ? e.slice(0, t + 1) : "";
	}
}
function dj(e, t, n) {
	let r = e.resolvedLoadPolicy ?? e.loadPolicy ?? t.resolvedLoadPlan?.[n] ?? t.loadPlan?.[n] ?? "buffer";
	if (typeof r == "string") return { mode: r };
	if (zA(r)) return {
		...r,
		mode: r.mode ?? r.type ?? r.strategy ?? "buffer"
	};
	throw TypeError(`asset ${n} has an invalid load policy`);
}
function fj(e, t) {
	if (e == null) return t;
	if (typeof e == "string") {
		let t = Zk[e];
		if (!t) throw TypeError(`unknown spatial profile ${e}`);
		return t;
	}
	if (zA(e)) {
		let n = t;
		if (e.id != null && (n = Zk[e.id], !n)) throw TypeError(`unknown spatial profile ${e.id}`);
		return {
			...n,
			...e
		};
	}
	throw TypeError("spatial profile must be a profile id or a partial profile object");
}
function pj(e) {
	let t = e?.spatial;
	if (!zA(t)) return null;
	let n = {};
	for (let e of [
		"panningModel",
		"distanceModel",
		"refDistance",
		"maxDistance",
		"rolloffFactor",
		"speedOfSound",
		"dopplerFactor",
		"levelTrimDb"
	]) t[e] != null && (n[e] = t[e]);
	return Object.keys(n).length > 0 ? n : null;
}
function mj(e) {
	return zA(e?.spatial) && e.spatial.doppler === !0;
}
function hj(e) {
	try {
		e?.disconnect?.();
	} catch {}
}
function gj(...e) {
	for (let t of e) if (Number.isFinite(Number(t))) return Number(t);
}
function _j(e) {
	return e ? {
		x: Number(e.x ?? e[0] ?? 0),
		y: Number(e.y ?? e[1] ?? 0),
		z: Number(e.z ?? e[2] ?? 0)
	} : null;
}
function vj(e, t, n = {}) {
	let r = Error(t);
	return r.name = "SoundRuntimeError", r.code = e, r.details = Object.freeze({ ...n }), r;
}
function yj(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function bj(e, t, n) {
	if (Number.isFinite(e.playbackRate) && e.playbackRate > 0) return Number(e.playbackRate);
	let r = e.playbackRateRange;
	if (Array.isArray(r) && r.length === 2) {
		let e = Number(r[0]), i = Number(r[1]);
		if (Number.isFinite(e) && Number.isFinite(i) && e > 0 && i >= e) {
			let r = JA(`${t}:${n}:playback-rate`) / 4294967296;
			return e + (i - e) * r;
		}
	}
	let i = e.pitchSemitoneRange ?? e.pitchSemitones;
	if (Array.isArray(i) && i.length === 2) {
		let e = Number(i[0]), r = Number(i[1]);
		if (Number.isFinite(e) && Number.isFinite(r) && r >= e) {
			let i = JA(`${t}:${n}:pitch-semitones`) / 4294967296;
			return 2 ** ((e + (r - e) * i) / 12);
		}
	}
	return 1;
}
function xj({ manifest: e, baseUrl: t = "", audioContextFactory: n, fetchImpl: r, mediaElementFactory: i, telemetrySink: a, now: o = () => Date.now(), spatialProfile: s } = {}) {
	if (!zA(e)) throw TypeError("manifest is required");
	let c = BA(e.assets, "assets"), l = BA(e.cues, "cues"), u = BA(e.buses, "buses"), d = VA(e.mixStates, "mixStates"), f = VA(e.musicStates, "musicStates"), p = VA(e.duckRules, "duckRules"), m = zA(e.voicePolicy) ? e.voicePolicy : {}, h = null, g = null, _ = /* @__PURE__ */ new Set(), v = !1, y = !1, b = /* @__PURE__ */ new Set(), x = null, S = [], C = null, w = !1, T = !1, E = !1, D = 0, O = null, k = null, A = null, j = pA({ profile: fj(s, Zk.three) }), M = { ...FA }, N = /* @__PURE__ */ new Map(), P = /* @__PURE__ */ new Map(), ee = /* @__PURE__ */ new Map(), F = /* @__PURE__ */ new Map(), te = [], I = /* @__PURE__ */ new Map(), L = /* @__PURE__ */ new Map(), ne = /* @__PURE__ */ new Map(), re = [], ie = Math.max(1, Math.floor(gj(e.loadPolicy?.maxConcurrentDecodes, e.runtimePolicy?.maxConcurrentDecodes, 3))), ae = 0, R = {
		assetLoads: 0,
		decodeFallbacks: 0,
		streamFallbacks: 0,
		steals: 0,
		cooldownSuppressions: 0,
		budgetSuppressions: 0,
		playErrors: 0,
		telemetryErrors: 0,
		spatialDegradations: 0
	};
	function oe() {
		if (w) throw Error("sound runtime is disposed");
	}
	function se() {
		if (!w) {
			if (v || _.size > 0) {
				for (let e of F.values()) e.kind === "stream" && e.element && e.element.paused === !1 && (e.element.pause?.(), b.add(e));
				h && h.state === "running" && typeof h.suspend == "function" && Promise.resolve(h.suspend()).catch(() => {}), y || (y = !0, pe("sound_runtime_held", {
					pageHidden: v,
					holds: [..._].sort()
				}));
			} else if (y) {
				y = !1, T && h && h.state === "suspended" && typeof h.resume == "function" && Promise.resolve(h.resume()).catch(() => {});
				for (let e of b) e.finalized || Promise.resolve(e.element?.play?.()).catch(() => Oe(e, "stream-play-error"));
				b.clear(), pe("sound_runtime_resumed", {});
			}
		}
	}
	let ce = typeof document == "object" && document ? document : null;
	function le() {
		v = ce.visibilityState === "hidden" || ce.hidden === !0, se();
	}
	ce?.addEventListener && (ce.addEventListener("visibilitychange", le), v = ce.visibilityState === "hidden" || ce.hidden === !0);
	function ue(e, t) {
		if (oe(), typeof e != "string" || !e) throw TypeError("setHold requires a non-empty string id");
		return t === !0 ? _.add(e) : _.delete(e), se(), Object.freeze({
			type: "hold",
			status: y ? "held" : "released",
			holds: Object.freeze([..._].sort())
		});
	}
	function de() {
		if (!w) for (; ae < ie && re.length > 0;) {
			let e = re.shift();
			ae += 1, Promise.resolve().then(e.task).then(e.resolve, e.reject).finally(() => {
				--ae, de();
			});
		}
	}
	function fe(e) {
		return oe(), new Promise((t, n) => {
			re.push({
				task: e,
				resolve: t,
				reject: n
			}), de();
		});
	}
	function pe(t, n = {}) {
		if (!a) return;
		let r = Object.freeze({
			...n,
			type: t,
			timestampMs: o(),
			manifestHash: e.contentHash ?? null
		});
		try {
			typeof a == "function" ? a(r) : typeof a.emit == "function" && a.emit(r);
		} catch {
			R.telemetryErrors += 1;
		}
	}
	function me(e) {
		return te.push(e), te.length > IA && te.shift(), e;
	}
	function he() {
		return JA(JSON.stringify({
			muted: E,
			userVolumes: PA.map((e) => [e, M[e]]),
			mixStates: [...I.keys()].sort(),
			musicStateId: O
		})).toString(16).padStart(8, "0");
	}
	function ge() {
		for (let [e, t] of u) {
			let n = t.parent ?? t.parentId ?? t.output ?? null;
			if (n != null && !u.has(n)) throw Error(`bus ${e} references missing parent ${n}`);
		}
		let e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Set();
		function n(r) {
			if (e.has(r)) throw Error(`bus graph contains a cycle at ${r}`);
			if (t.has(r)) return;
			e.add(r);
			let i = u.get(r), a = i.parent ?? i.parentId ?? i.output ?? null;
			a != null && n(a), e.delete(r), t.add(r);
		}
		for (let e of u.keys()) n(e);
	}
	ge();
	function _e() {
		if (typeof n == "function") return n;
		let e = globalThis.AudioContext ?? globalThis.webkitAudioContext;
		if (!e) throw Error("audioContextFactory is required in this environment");
		return () => new e();
	}
	function ve(t) {
		let n = e.masterSafety;
		if (!zA(n) || typeof t.createDynamicsCompressor != "function") return null;
		let r = t.createDynamicsCompressor(), i = t.currentTime;
		return WA(r.threshold, gj(n.thresholdDb, n.threshold), i), WA(r.knee, gj(n.kneeDb, n.knee), i), WA(r.ratio, gj(n.ratio), i), WA(r.attack, gj(n.attackSeconds, n.attack), i), WA(r.release, gj(n.releaseSeconds, n.release), i), r.connect(t.destination), r;
	}
	function ye(e) {
		let t = e, n = /* @__PURE__ */ new Set();
		for (; t && !n.has(t);) {
			n.add(t);
			let e = u.get(t), r = e.userVolume ?? e.userCategory ?? e.category;
			if (PA.includes(r)) return r;
			if (PA.includes(t)) return t;
			t = e.parent ?? e.parentId ?? e.output ?? null;
		}
		return null;
	}
	function be(e) {
		let t = /* @__PURE__ */ new Map();
		for (let [n, r] of u) {
			let i = e.createGain(), a = e.createGain(), o = e.createGain(), s = e.createGain(), c = e.createGain();
			i.connect(a), a.connect(o), o.connect(s), s.connect(c), WA(a.gain, HA(r.gainDb ?? 0), e.currentTime), WA(o.gain, 1, e.currentTime), WA(s.gain, 1, e.currentTime), WA(c.gain, 1, e.currentTime), t.set(n, {
				id: n,
				definition: r,
				parentId: r.parent ?? r.parentId ?? r.output ?? null,
				userCategory: ye(n),
				input: i,
				canonical: a,
				mix: o,
				duck: s,
				user: c,
				mixDb: 0,
				duckDb: 0
			});
		}
		x = ve(e);
		let n = [];
		for (let r of t.values()) r.parentId ? r.user.connect(t.get(r.parentId).input) : (r.user.connect(x ?? e.destination), n.push(r.user));
		return S = x ? [x] : n, t;
	}
	function xe() {
		oe();
		let e = z();
		if (!C) {
			if (typeof e.createMediaStreamDestination != "function") throw vj("SOUND_RECORDING_UNSUPPORTED", "this AudioContext cannot create a MediaStreamDestination");
			C = e.createMediaStreamDestination();
			for (let e of S) e.connect(C);
		}
		return C.stream;
	}
	function z() {
		if (oe(), !h) {
			if (h = _e()(), !h || typeof h.createGain != "function") throw TypeError("audioContextFactory returned an invalid AudioContext");
			g = be(h), we();
		}
		return h;
	}
	function Se(e) {
		z();
		let t = g.get(e);
		if (!t) throw Error(`unknown bus ${e}`);
		return t;
	}
	function Ce(e) {
		let t = e.userCategory ? UA(M[e.userCategory]) : 1;
		return e.id === "master" && E && (t = 0), t;
	}
	function we() {
		if (g && h) for (let e of g.values()) WA(e.user.gain, Ce(e), h.currentTime);
	}
	function Te(e, t) {
		let n = e, r = /* @__PURE__ */ new Set();
		for (; n && !r.has(n);) {
			if (n === t) return !0;
			r.add(n);
			let e = u.get(n);
			n = e?.parent ?? e?.parentId ?? e?.output ?? null;
		}
		return !1;
	}
	function Ee() {
		return gj(m.globalMax, m.maxVoices, m.globalMaxVoices) ?? Infinity;
	}
	function De(e) {
		return gj((m.busMax ?? m.busMaxVoices ?? {})[e], u.get(e)?.maxVoices);
	}
	function B(e) {
		return [...e].sort((e, t) => {
			let n = e.priority - t.priority;
			if (n !== 0) return n;
			let r = e.startedAt - t.startedAt;
			return r === 0 ? e.sequence - t.sequence : r;
		})[0];
	}
	function Oe(e, t, { emitReceipt: n = !0 } = {}) {
		if (!e || e.finalized) return null;
		e.finalized = !0, F.delete(e.instanceId), e.emitter?.voices?.delete(e), k === e.instanceId && (k = null), e.startTimer && clearTimeout(e.startTimer), e.stopTimer && clearTimeout(e.stopTimer);
		try {
			e.kind === "stream" ? (e.element?.pause?.(), e.element && "src" in e.element && t === "dispose" && (e.element.removeAttribute?.("src"), e.element.load?.())) : t !== "ended" && e.source?.stop?.(h?.currentTime ?? 0);
		} catch {}
		for (let t of e.nodes ?? []) hj(t);
		if (Pe(e), e.status = t === "ended" ? "ended" : "stopped", e.endedAt = h?.currentTime ?? null, e.stopReason = t, !n) return null;
		let r = me(Object.freeze({
			type: "stop",
			status: e.status,
			instanceId: e.instanceId,
			cueId: e.cueId,
			eventId: e.eventId,
			reason: t,
			endedAt: e.endedAt
		}));
		return pe("sound_voice_stopped", r), r;
	}
	function ke(e, t, n) {
		let r = B(e);
		return !r || r.priority > t ? !1 : (R.steals += 1, Oe(r, `stolen:${n}`), pe("sound_voice_stolen", {
			instanceId: r.instanceId,
			cueId: r.cueId,
			scope: n,
			replacementPriority: t
		}), !0);
	}
	function V(e, t, n, r) {
		let i = Math.max(0, Ee());
		for (; F.size >= i;) if (!ke(F.values(), r, "global")) return "global";
		let a = gj(t.polyphony, t.maxVoices, t.voiceLimit, m.defaultCueMax) ?? Infinity, o = [...F.values()].filter((t) => t.cueId === e);
		for (; o.length >= a;) {
			if (!ke(o, r, `cue:${e}`)) return `cue:${e}`;
			o = [...F.values()].filter((t) => t.cueId === e);
		}
		for (let e of u.keys()) {
			let t = De(e);
			if (t == null || !Te(n, e)) continue;
			let i = [...F.values()].filter((t) => Te(t.busId, e));
			for (; i.length >= Math.max(0, t);) {
				if (!ke(i, r, `bus:${e}`)) return `bus:${e}`;
				i = [...F.values()].filter((t) => Te(t.busId, e));
			}
		}
		return null;
	}
	function Ae(e, t) {
		let n = (e.busGainsDb ?? e.buses ?? e.gainsDb ?? {})[t];
		return Number.isFinite(n) ? Number(n) : zA(n) ? gj(n.gainDb, n.db) ?? 0 : 0;
	}
	function H() {
		if (g && h) for (let e of g.values()) {
			let t = 0;
			for (let n of I.keys()) t += Ae(d.get(n), e.id);
			e.mixDb = t, WA(e.mix.gain, HA(t), h.currentTime);
		}
	}
	function je(e) {
		return e.targetBus ?? e.targetBusId ?? e.bus;
	}
	function Me(e) {
		let t = gj(e.reductionDb, e.maxReductionDb);
		return t == null ? Math.min(0, gj(e.gainDb, e.db) ?? 0) : -Math.abs(t);
	}
	function U(e) {
		let t = 0;
		for (let n of L.values()) n.phase !== "idle" && je(n.rule) === e && (t += Me(n.rule));
		return t;
	}
	function Ne(e, { attackMs: t = 0, releaseMs: n = 0, holdMs: r = 0, releasing: i = !1 } = {}) {
		if (!g || !h) return;
		let a = g.get(e);
		if (!a) throw Error(`duck rule references unknown bus ${e}`);
		let o = h.currentTime, s = U(e);
		a.duckDb = s, qA(a.duck.gain, o);
		let c = Number.isFinite(a.duck.gain.value) ? a.duck.gain.value : 1;
		if (WA(a.duck.gain, c, o), i) {
			let e = o + r / 1e3;
			r > 0 && WA(a.duck.gain, c, e), KA(a.duck.gain, HA(s), e + n / 1e3);
		} else KA(a.duck.gain, HA(s), o + t / 1e3);
	}
	function W(e, t, n) {
		if (!t) return;
		let r = p.get(t);
		if (!r) throw Error(`cue ${e.cueId} references unknown duck rule ${t}`);
		let i = je(r);
		if (!i) throw Error(`duck rule ${t} has no target bus`);
		let a = L.get(t);
		a || (a = {
			id: t,
			rule: r,
			voices: /* @__PURE__ */ new Set(),
			phase: "active",
			releaseTimer: null
		}, L.set(t, a)), a.releaseTimer && clearTimeout(a.releaseTimer), a.releaseTimer = null, a.phase = "active", a.voices.add(e.instanceId), e.duckRuleId = t;
		let o = Math.max(0, gj(r.attackMs) ?? 0), s = Se(i), c = Math.max(h.currentTime, n ?? h.currentTime);
		qA(s.duck.gain, c), WA(s.duck.gain, s.duck.gain.value, c), s.duckDb = U(i), KA(s.duck.gain, HA(s.duckDb), c + o / 1e3), pe("sound_duck_started", {
			ruleId: t,
			targetBusId: i,
			instanceId: e.instanceId
		});
	}
	function Pe(e) {
		let t = e.duckRuleId;
		if (!t) return;
		let n = L.get(t);
		if (!n || (n.voices.delete(e.instanceId), n.voices.size > 0)) return;
		n.phase = "releasing";
		let r = je(n.rule), i = Math.max(0, gj(n.rule.holdMs) ?? 0), a = Math.max(0, gj(n.rule.releaseMs) ?? 0);
		L.delete(t), Ne(r, {
			holdMs: i,
			releaseMs: a,
			releasing: !0
		}), L.set(t, n), n.releaseTimer = setTimeout(() => {
			n.voices.size === 0 && (L.delete(t), Ne(r), pe("sound_duck_ended", {
				ruleId: t,
				targetBusId: r
			}));
		}, i + a);
	}
	async function Fe(n) {
		if (P.has(n)) return P.get(n);
		let i = e.packs?.[n];
		if (!i) throw Error(`unknown pack ${n}`);
		if (typeof r != "function") throw Error("fetchImpl is required to load sound packs");
		let a = (async () => {
			let n = await r(lj(t, i.url));
			if (!n || n.ok === !1 || typeof n.arrayBuffer != "function") throw Error(`pack fetch failed${n?.status ? ` (${n.status})` : ""}`);
			return sj(await n.arrayBuffer(), e.contentHash);
		})();
		P.set(n, a);
		try {
			return await a;
		} catch (e) {
			throw P.delete(n), e;
		}
	}
	async function Ie(e) {
		if (!e.pack) return null;
		let { payload: t } = await Fe(e.pack.id), n = e.pack.offset, r = n + e.pack.length;
		if (r > t.length) throw Error(`pack slice out of range for ${e.id}`);
		return t.slice(n, r).buffer;
	}
	async function Le(e, t) {
		let n = `${e}:${t.id}`, r = ee.get(n);
		if (r) return r;
		let i = await Ie(t);
		if (!i) return null;
		if (typeof URL?.createObjectURL != "function" || typeof Blob != "function") throw Error("Blob/createObjectURL are required to stream packed audio");
		let a = URL.createObjectURL(new Blob([i], { type: t.mimeType ?? "application/octet-stream" }));
		return ee.set(n, a), a;
	}
	function Re() {
		for (let e of ee.values()) try {
			URL.revokeObjectURL?.(e);
		} catch {}
		ee.clear();
	}
	async function ze(e, t) {
		let n = t.slice ? t.slice(0) : t;
		return new Promise((t, r) => {
			let i;
			try {
				i = e.decodeAudioData(n, t, r);
			} catch (e) {
				r(e);
				return;
			}
			i && typeof i.then == "function" && i.then(t, r);
		});
	}
	async function Be(e) {
		if (N.has(e)) return N.get(e);
		if (typeof r != "function") throw Error("fetchImpl is required to load buffer assets");
		let n = c.get(e);
		if (!n) throw Error(`unknown asset ${e}`);
		let i = XA(n, e);
		if (i.length === 0) throw Error(`asset ${e} has no variants`);
		let a = z(), o = fe(async () => {
			let o = [];
			for (let s = 0; s < i.length; s += 1) {
				let c = i[s], l = c.pack ? `pack:${c.pack.id}` : lj(t, cj(c));
				try {
					let t = await Ie(c);
					if (t === null) {
						let e = await r(l, { signal: void 0 });
						if (!e || e.ok === !1 || typeof e.arrayBuffer != "function") throw Error(`fetch failed${e?.status ? ` (${e.status})` : ""}`);
						t = await e.arrayBuffer();
					}
					let i = await ze(a, t);
					return R.assetLoads += 1, s > 0 && (R.decodeFallbacks += 1), pe("sound_asset_loaded", {
						assetId: e,
						variantId: c.id,
						mode: "buffer"
					}), {
						assetId: e,
						asset: n,
						variant: c,
						url: l,
						buffer: i
					};
				} catch (t) {
					o.push(`${c.id}: ${t.message}`), pe("sound_variant_failed", {
						assetId: e,
						variantId: c.id,
						mode: "buffer"
					});
				}
			}
			throw Error(`all variants failed for ${e}: ${o.join("; ")}`);
		});
		N.set(e, o);
		try {
			return await o;
		} catch (t) {
			throw N.delete(e), t;
		}
	}
	function Ve(e, t, n, r, i) {
		let a = r ? j.createPanner(h, r.position, r.params) : null;
		return i.panner = a, a && (i.pushedPosition = r.position), a ? (e.connect(a), a.connect(t)) : e.connect(t), t.connect(n.input), a ? [
			e,
			a,
			t
		] : [e, t];
	}
	function He({ voice: e, at: t, position: n, loadPolicy: r, cue: i }) {
		let a = gj(i.transientAnchorMs) ?? 0;
		return {
			type: "play",
			status: t > h.currentTime + .001 ? "scheduled" : "playing",
			instanceId: e.instanceId,
			cueId: e.cueId,
			assetId: e.assetId,
			assetVariantHash: e.assetVariantHash ?? null,
			codec: e.codec ?? null,
			busId: e.busId,
			eventId: e.eventId,
			seed: e.seed,
			requestedAt: e.requestedAt,
			scheduledAt: t,
			audioScheduledAt: t,
			startedAt: h.currentTime,
			audioStartedAt: h.currentTime,
			audioTransientAt: t + a / 1e3,
			position: _j(n),
			priority: e.priority,
			loadPolicy: r,
			syncRole: i.syncRole ?? null,
			transientAnchorMs: a,
			duckRuleId: i.duckRule ?? i.duckRuleId ?? null,
			gainDb: gj(i.gainDb) ?? 0,
			playbackRate: e.playbackRate,
			stateHash: he(),
			guard: "admitted"
		};
	}
	function Ue({ cueId: e, eventId: t, seed: n, reason: r, at: i = null }) {
		let a = Object.freeze({
			type: "play",
			status: "suppressed",
			instanceId: null,
			cueId: e,
			eventId: t ?? null,
			seed: n,
			scheduledAt: i,
			reason: r
		});
		return me(a), pe("sound_cue_suppressed", a), a;
	}
	async function We({ voice: e, cue: t, assetId: n, spatialPlan: r, at: i, loadPolicy: a }) {
		let o = await Be(n), s = V(e.cueId, t, e.busId, e.priority);
		if (s) return R.budgetSuppressions += 1, Ue({
			cueId: e.cueId,
			eventId: e.eventId,
			seed: e.seed,
			reason: `voice-budget:${s}`,
			at: i
		});
		let c = Se(e.busId), l = h.createBufferSource(), u = h.createGain();
		return l.buffer = o.buffer, l.loop = !!(t.loop ?? o.asset.loop ?? a.loop), l.playbackRate && WA(l.playbackRate, e.playbackRate, h.currentTime), e.baseGain = HA(t.gainDb ?? 0) * (r?.levelGain ?? 1), e.gainNode = u, e.fadeInMs > 0 ? (WA(u.gain, 0, i), GA(u.gain, e.baseGain, i + e.fadeInMs / 1e3)) : WA(u.gain, e.baseGain, h.currentTime), e.kind = "buffer", e.source = l, e.nodes = Ve(l, u, c, r, e), e.variantId = o.variant.id, e.variantUrl = o.url, e.assetVariantHash = o.variant.sha256 ?? o.variant.hash ?? null, e.codec = o.variant.codec ?? o.variant.format ?? o.variant.id, e.status = i > h.currentTime + .001 ? "scheduled" : "playing", F.set(e.instanceId, e), l.onended = () => Oe(e, "ended"), W(e, t.duckRule ?? t.duckRuleId, i), l.start(i, Math.max(0, Number(a.offsetSeconds ?? 0))), null;
	}
	async function Ge({ voice: e, cue: n, assetId: r, spatialPlan: a, at: o, loadPolicy: s }) {
		let l = c.get(r), u = XA(l, r);
		if (u.length === 0) throw Error(`asset ${r} has no variants`);
		let d = V(e.cueId, n, e.busId, e.priority);
		if (d) return R.budgetSuppressions += 1, Ue({
			cueId: e.cueId,
			eventId: e.eventId,
			seed: e.seed,
			reason: `voice-budget:${d}`,
			at: o
		});
		if (typeof i != "function") throw vj("SOUND_MEDIA_FACTORY_REQUIRED", "mediaElementFactory is required to stream assets", {
			assetId: r,
			cueId: e.cueId
		});
		let f = i, p = Se(e.busId), m = [];
		for (let i = 0; i < u.length; i += 1) {
			let c = u[i], d = await Le(r, c) ?? lj(t, cj(c)), g, _, v, x;
			try {
				if (g = f(d, {
					assetId: r,
					variant: c,
					cueId: e.cueId
				}), !g) throw Error("mediaElementFactory returned no element");
				g.crossOrigin ?? (g.crossOrigin = "anonymous");
				let t = c.mimeType ?? c.mime;
				if (t && typeof g.canPlayType == "function" && g.canPlayType(t) === "") throw Error(`unsupported MIME type ${t}`);
				"src" in g && !g.src && (g.src = d), g.preload = s.preload ?? "auto", g.loop = !!(n.loop ?? l.loop ?? s.loop), _ = h.createMediaElementSource(g), v = h.createGain(), e.baseGain = HA(n.gainDb ?? 0) * (a?.levelGain ?? 1), e.gainNode = v, e.fadeInMs > 0 ? (WA(v.gain, 0, o), GA(v.gain, e.baseGain, o + e.fadeInMs / 1e3)) : WA(v.gain, e.baseGain, h.currentTime), x = Ve(_, v, p, a, e), e.kind = "stream", e.element = g, e.source = _, e.nodes = x, e.variantId = c.id, e.variantUrl = d, e.assetVariantHash = c.sha256 ?? c.hash ?? null, e.codec = c.codec ?? c.format ?? c.id, "playbackRate" in g && (g.playbackRate = e.playbackRate), e.status = o > h.currentTime + .001 ? "scheduled" : "playing", g.addEventListener?.("ended", () => Oe(e, "ended"), { once: !0 }), F.set(e.instanceId, e), W(e, n.duckRule ?? n.duckRuleId, o);
				let u = async () => {
					if (e.finalized) return;
					if (y) {
						b.add(e), e.status = "playing";
						return;
					}
					let t = g.play?.();
					t && typeof t.then == "function" && await t, e.status = "playing";
				}, m = Math.max(0, (o - h.currentTime) * 1e3);
				return m > 1 ? e.startTimer = setTimeout(() => {
					u().catch(() => Oe(e, "stream-play-error"));
				}, m) : await u(), i > 0 && (R.streamFallbacks += 1), R.assetLoads += 1, pe("sound_asset_loaded", {
					assetId: r,
					variantId: c.id,
					mode: "stream"
				}), null;
			} catch (t) {
				m.push(`${c.id}: ${t.message}`), F.get(e.instanceId) === e && F.delete(e.instanceId), Pe(e), e.duckRuleId = null;
				try {
					g?.pause?.();
				} catch {}
				for (let e of x ?? [_, v]) hj(e);
				pe("sound_variant_failed", {
					assetId: r,
					variantId: c.id,
					mode: "stream"
				});
			}
		}
		throw Error(`all stream variants failed for ${r}: ${m.join("; ")}`);
	}
	async function Ke() {
		oe();
		let e = z();
		e.state === "suspended" && typeof e.resume == "function" && await e.resume(), T = e.state === "running" || e.state == null, se();
		let t = Object.freeze({
			type: "unlock",
			status: T ? "running" : e.state
		});
		return me(t), pe("sound_runtime_unlocked", { status: t.status }), t;
	}
	async function qe(t) {
		oe(), z();
		let n = [];
		for (let [r, i] of c) {
			let a = dj(i, e, r);
			if (a.mode !== "buffer") continue;
			let o = a.group ?? a.preloadGroup ?? i.group ?? i.preloadGroup;
			(t == null || o === t) && n.push(r);
		}
		let r = await Promise.allSettled(n.map((e) => Be(e))), i = Object.freeze({
			group: t ?? null,
			requested: n.length,
			loaded: r.filter((e) => e.status === "fulfilled").length,
			failed: r.filter((e) => e.status === "rejected").length,
			assets: n.map((e, t) => ({
				assetId: e,
				status: r[t].status
			}))
		});
		return pe("sound_preload_completed", i), i;
	}
	function Je({ cueId: e, cue: t, eventId: n, emitter: r, position: i, loadPolicy: a }) {
		if (!(r || i)) return null;
		if (!j.hasListener()) {
			if (r) throw vj("SOUND_LISTENER_MISSING", `spatial playback of ${e} requires setListener() to be called first`, {
				cueId: e,
				hint: "attachThree/attachPixi/attachPhaser 会每帧代劳；裸用 core 时自己喂听者"
			});
			return R.spatialDegradations += 1, pe("sound_spatial_degraded", {
				cueId: e,
				eventId: n ?? null,
				reason: "listener-missing"
			}), { degraded: {
				status: "degraded",
				reason: "listener-missing"
			} };
		}
		let o = r ? r.position : aA(i);
		if (!o) throw vj("SOUND_POSITION_INVALID", `position for ${e} must be a vector`, { cueId: e });
		let s = j.resolveParams(pj(t), r?.overrides), c = !1;
		if (mj(t)) {
			if (a.mode !== "buffer") throw vj("SOUND_DOPPLER_REQUIRES_BUFFER", `cue ${e} enables doppler but resolves to a ${a.mode} asset`, {
				cueId: e,
				loadPolicy: a.mode
			});
			c = !!r;
		}
		return {
			position: o,
			params: s,
			emitter: r ?? null,
			doppler: c,
			levelGain: Qk(s)
		};
	}
	async function G(t, { eventId: n, seed: r, at: i, position: a, pitchSemitones: s, playbackRate: d, emitter: f, __emitter: p, __fadeInMs: m = 0 } = {}) {
		oe();
		let h = l.get(t);
		if (!h) throw vj("SOUND_CUE_UNKNOWN", `unknown cue ${t}`, { cueId: t });
		if (f !== void 0) throw vj("SOUND_EMITTER_HANDLE_MISUSE", `playCue(${t}, { emitter }) is not supported; call emitter.play(cueId) instead`, { cueId: t });
		if (p?.disposed) throw vj("SOUND_EMITTER_DISPOSED", `emitter for ${t} is disposed`, { cueId: t });
		let g = z(), _ = String(r ?? n ?? `${t}:default`), v = Number.isFinite(i) ? Math.max(g.currentTime, Number(i)) : g.currentTime;
		if (!T) {
			let r = e.runtimePolicy?.lockedPlayback ?? e.lockedPolicy ?? "reject";
			if (r === "drop") return Ue({
				cueId: t,
				eventId: n,
				seed: _,
				reason: "locked",
				at: v
			});
			throw vj("SOUND_CONTEXT_LOCKED", "sound runtime must be unlocked from a user gesture before playback", {
				cueId: t,
				eventId: n ?? null,
				lockedPolicy: r
			});
		}
		let y = Math.max(0, gj(h.cooldownMs, h.cooldown) ?? 0), b = o(), x = ne.get(t);
		if (x != null && b - x < y) return R.cooldownSuppressions += 1, Ue({
			cueId: t,
			eventId: n,
			seed: _,
			reason: "cooldown",
			at: v
		});
		let S = YA(h, t, _), C = c.get(S);
		if (!C) throw Error(`cue ${t} references unknown asset ${S}`);
		let w = h.bus ?? h.busId;
		if (!w || !u.has(w)) throw Error(`cue ${t} references unknown bus ${w}`);
		let E = dj(C, e, S);
		if (!["buffer", "stream"].includes(E.mode)) throw Error(`asset ${S} has unsupported load policy ${E.mode}`);
		let O = Je({
			cueId: t,
			cue: h,
			eventId: n,
			emitter: p,
			position: a,
			loadPolicy: E
		});
		ne.set(t, b);
		let k = O?.degraded ?? null, A = k ? null : O, j = p ? p.stopEpoch : 0, M = `sound-${++D}`, N = gj(h.priority) ?? 0, P = {
			sequence: D,
			instanceId: M,
			cueId: t,
			assetId: S,
			busId: w,
			eventId: n ?? null,
			seed: _,
			priority: N,
			requestedAt: g.currentTime,
			startedAt: g.currentTime,
			scheduledAt: v,
			playbackRate: yj(bj(h, t, _) * (Number.isFinite(d) && d > 0 ? Number(d) : 1) * (Number.isFinite(s) ? 2 ** (yj(Number(s), -24, 24) / 12) : 1), .25, 4),
			fadeInMs: Math.max(0, gj(m) ?? 0),
			status: "loading",
			position: _j(A?.position ?? a),
			finalized: !1,
			panner: null,
			pushedPosition: null,
			emitter: A?.emitter ?? null,
			doppler: A?.doppler ?? !1,
			params: A?.params ?? null,
			dopplerRatio: 1,
			appliedRate: void 0
		};
		try {
			let e = E.mode === "stream" ? await Ge({
				voice: P,
				cue: h,
				assetId: S,
				spatialPlan: A,
				at: v,
				loadPolicy: E
			}) : await We({
				voice: P,
				cue: h,
				assetId: S,
				spatialPlan: A,
				at: v,
				loadPolicy: E
			});
			if (e) return e;
			if (P.emitter) {
				if (P.emitter.disposed || P.emitter.stopEpoch !== j) return Oe(P, "emitter-cancelled", { emitReceipt: !1 }), Ue({
					cueId: t,
					eventId: n,
					seed: _,
					reason: "emitter-cancelled",
					at: v
				});
				P.emitter.voices.add(P);
			}
			let r = Object.freeze({
				...He({
					voice: P,
					at: v,
					position: A?.position ?? a,
					loadPolicy: E.mode,
					cue: h
				}),
				variantId: P.variantId,
				spatial: A ? {
					status: "spatial",
					emitterId: A.emitter?.id ?? null,
					doppler: A.doppler
				} : k
			});
			return me(r), pe("sound_cue_played", r), r;
		} catch (e) {
			throw R.playErrors += 1, F.get(M) === P && Oe(P, "play-error", { emitReceipt: !1 }), pe("sound_cue_failed", {
				cueId: t,
				assetId: S,
				eventId: n ?? null,
				message: e.message
			}), e;
		}
	}
	function Ye(e, t, n = "music-crossfade") {
		let r = F.get(e);
		if (!r) return null;
		let i = Math.max(0, gj(t) ?? 0);
		if (i === 0 || !r.gainNode?.gain || !h) return Oe(r, n);
		let a = h.currentTime, o = r.gainNode.gain;
		return qA(o, a), WA(o, Number.isFinite(o.value) ? o.value : r.baseGain, a), GA(o, 0, a + i / 1e3), r.status = "fading-out", r.stopTimer = setTimeout(() => Oe(r, n), i), Object.freeze({
			type: "fade-out",
			status: "scheduled",
			instanceId: e,
			cueId: r.cueId,
			durationMs: i,
			reason: n
		});
	}
	function Xe() {
		return A ? A.cueId : (k && F.get(k)?.cueId) ?? null;
	}
	function Ze(e, t) {
		return Object.freeze({
			...e,
			type: "music",
			eventId: t.eventId ?? null,
			previousInstanceId: null,
			crossfadeMs: 0,
			unchanged: !0
		});
	}
	async function Qe(e, t = {}) {
		oe();
		let n = Math.max(0, gj(t.crossfadeMs, t.fadeMs) ?? 0);
		if (A?.cueId === e) return Ze(await A.promise, t);
		let r = k ? F.get(k) : null;
		if (r?.cueId === e) return A = null, Ze({
			status: r.status === "scheduled" ? "scheduled" : "playing",
			instanceId: r.instanceId,
			cueId: r.cueId,
			seed: r.seed,
			busId: r.busId
		}, t);
		let i = {
			cueId: e,
			promise: null
		};
		return A = i, i.promise = $e(i, t, n), i.promise;
	}
	async function $e(e, t, n) {
		let r;
		try {
			r = await G(e.cueId, {
				...t,
				__fadeInMs: n
			});
		} catch (t) {
			throw A === e && (A = null), t;
		}
		if (A !== e) {
			let i = r.instanceId ? F.get(r.instanceId) : null;
			i && Oe(i, "music-superseded", { emitReceipt: !1 });
			let a = r.status === "suppressed" ? r : Ue({
				cueId: e.cueId,
				eventId: t.eventId,
				seed: r.seed,
				reason: "music-superseded"
			});
			return Object.freeze({
				...a,
				type: "music",
				previousInstanceId: null,
				crossfadeMs: n
			});
		}
		A = null;
		let i = k;
		return (r.status === "playing" || r.status === "scheduled") && (k = r.instanceId, i && i !== r.instanceId && Ye(i, n)), Object.freeze({
			...r,
			type: "music",
			previousInstanceId: i,
			crossfadeMs: n
		});
	}
	async function et(e, t = {}) {
		oe();
		let n = f.get(e) ?? d.get(e);
		if (!n) throw Error(`unknown music state ${e}`);
		let r = n.mixStateId ?? (d.has(e) ? e : null), i = Object.hasOwn(n, "cueId") || Object.hasOwn(n, "musicCueId"), a = Object.hasOwn(n, "cueId") ? n.cueId : n.musicCueId, o = !i || (a == null ? k == null && A == null : Xe() === a);
		if (e === O && o && (r == null || I.has(r))) {
			let n = a ? await Qe(a, t) : null;
			return Object.freeze({
				type: "music-state",
				status: "unchanged",
				stateId: e,
				previousStateId: e,
				eventId: t.eventId ?? null,
				instanceId: n?.instanceId ?? k
			});
		}
		let s = O;
		O = e;
		let c = (s ? f.get(s) : null)?.mixStateId ?? (s && d.has(s) ? s : null);
		c && tt(c, {
			active: !1,
			eventId: t.eventId
		}), r && tt(r, {
			active: !0,
			eventId: t.eventId
		});
		let l = Math.max(0, gj(t.crossfadeMs, n.crossfadeMs) ?? 0), u = null;
		if (i && a == null) {
			let e = k;
			k = null, A = null, e && Ye(e, l, "music-silent-state");
		} else a && (u = await Qe(a, {
			...t,
			crossfadeMs: l
		}));
		let p = Object.freeze({
			type: "music-state",
			status: "active",
			stateId: e,
			previousStateId: s,
			eventId: t.eventId ?? null,
			instanceId: u?.instanceId ?? k
		});
		return me(p), pe("sound_music_state_changed", p), p;
	}
	function tt(e, { active: t = !0, eventId: n } = {}) {
		if (oe(), !d.has(e)) throw Error(`unknown mix state ${e}`);
		z(), t ? I.set(e, { eventId: n ?? null }) : I.delete(e), H();
		let r = Object.freeze({
			type: "mix-state",
			status: t ? "active" : "inactive",
			stateId: e,
			eventId: n ?? null
		});
		return me(r), pe("sound_mix_state_changed", r), r;
	}
	function nt(e) {
		if (oe(), !zA(e)) throw TypeError("volume settings must be an object");
		for (let t of Object.keys(e)) {
			if (!PA.includes(t)) throw TypeError(`unknown user volume ${t}`);
			let n = e[t];
			if (!Number.isFinite(n) || n < 0 || n > 1) throw RangeError(`${t} volume must be between 0 and 1`);
		}
		Object.assign(M, e), z(), we();
		let t = Object.freeze({
			type: "user-volumes",
			status: "applied",
			volumes: { ...M }
		});
		return me(t), pe("sound_user_volumes_changed", { volumes: { ...M } }), t;
	}
	function rt(e) {
		if (oe(), typeof e != "boolean") throw TypeError("muted must be boolean");
		E = e, z(), we();
		let t = Object.freeze({
			type: "mute",
			status: E ? "muted" : "unmuted"
		});
		return me(t), pe("sound_mute_changed", { muted: E }), t;
	}
	function it(e) {
		oe();
		let t = F.get(e);
		return t ? Oe(t, "requested") : null;
	}
	function at() {
		for (let e of L.values()) e.releaseTimer && clearTimeout(e.releaseTimer);
		if (L.clear(), g && h) for (let e of g.values()) e.duckDb = 0, qA(e.duck.gain, h.currentTime), WA(e.duck.gain, 1, h.currentTime);
	}
	function ot(e = "voices") {
		oe();
		let t = typeof e == "string" ? { type: e } : { ...e }, n = t.type ?? t.scope ?? "voices", r = [...F.values()];
		if (n === "music") r = r.filter((e) => Te(e.busId, "music"));
		else if (n === "sfx") r = r.filter((e) => Te(e.busId, "sfx"));
		else if (n === "bus") r = r.filter((e) => Te(e.busId, t.busId));
		else if (n === "cue") r = r.filter((e) => e.cueId === t.cueId);
		else if (["cache", "receipts"].includes(n)) r = [];
		else if (!["voices", "all"].includes(n)) throw Error(`unknown clear scope ${n}`);
		for (let e of r) Oe(e, "clear");
		(n === "cache" || n === "all") && N.clear(), (n === "receipts" || n === "all") && (te.length = 0), n === "all" && (Re(), at(), I.clear(), H(), ne.clear(), O = null);
		let i = Object.freeze({
			type: "clear",
			status: "cleared",
			scope: n,
			stopped: r.length
		});
		return me(i), pe("sound_runtime_cleared", i), i;
	}
	function st() {
		let t = g;
		return Object.freeze({
			disposed: w,
			unlocked: T,
			context: h ? {
				state: h.state ?? "unknown",
				currentTime: h.currentTime
			} : {
				state: "not-created",
				currentTime: null
			},
			manifest: {
				schemaVersion: e.schemaVersion ?? null,
				contentHash: e.contentHash ?? null
			},
			muted: E,
			suspension: {
				held: y,
				pageHidden: v,
				holds: [..._].sort()
			},
			userVolumes: { ...M },
			activeMixStates: [...I.keys()],
			music: {
				stateId: O,
				instanceId: k
			},
			buses: t ? [...t.values()].map((e) => ({
				id: e.id,
				parentId: e.parentId,
				userCategory: e.userCategory,
				canonicalGainDb: gj(e.definition.gainDb) ?? 0,
				mixGainDb: e.mixDb,
				duckGainDb: e.duckDb,
				userGain: Ce(e),
				currentUserGain: e.user.gain?.value ?? null,
				voiceCount: [...F.values()].filter((t) => Te(t.busId, e.id)).length
			})) : [...u.entries()].map(([e, t]) => ({
				id: e,
				parentId: t.parent ?? t.parentId ?? t.output ?? null,
				userCategory: ye(e),
				canonicalGainDb: gj(t.gainDb) ?? 0,
				mixGainDb: 0,
				duckGainDb: 0,
				userGain: null,
				voiceCount: 0
			})),
			voices: [...F.values()].map((e) => ({
				instanceId: e.instanceId,
				cueId: e.cueId,
				assetId: e.assetId,
				variantId: e.variantId ?? null,
				assetVariantHash: e.assetVariantHash ?? null,
				codec: e.codec ?? null,
				busId: e.busId,
				eventId: e.eventId,
				seed: e.seed,
				priority: e.priority,
				status: e.status,
				kind: e.kind ?? null,
				startedAt: e.startedAt,
				scheduledAt: e.scheduledAt,
				playbackRate: e.playbackRate,
				position: e.position,
				duckRuleId: e.duckRuleId ?? null
			})),
			ducks: [...L.values()].map((e) => ({
				id: e.id,
				targetBusId: je(e.rule),
				reductionDb: Me(e.rule),
				phase: e.phase,
				triggerCount: e.voices.size
			})),
			cache: [...N.keys()],
			diagnostics: {
				...R,
				decodedBufferBytes: [...N.keys()].reduce((e, t) => e + (gj(c.get(t)?.decodedBytes) ?? 0), 0),
				clipDiagnostics: {
					available: !1,
					reason: "no-runtime-meter"
				},
				masterSafety: {
					available: !!x,
					reductionDb: Number.isFinite(x?.reduction) ? x.reduction : null
				},
				bufferLoadQueue: {
					active: ae,
					queued: re.length,
					maxConcurrent: ie
				}
			},
			receipts: te.map((e) => ({ ...e })),
			spatial: j.snapshot()
		});
	}
	async function ct() {
		if (w) return;
		for (let e of [...F.values()]) Oe(e, "dispose", { emitReceipt: !1 });
		for (at(), j.clear(), N.clear(), I.clear(), ne.clear(); re.length > 0;) re.shift().reject(vj("SOUND_RUNTIME_DISPOSED", "sound runtime disposed"));
		if (ce?.removeEventListener?.("visibilitychange", le), _.clear(), b.clear(), g) for (let e of g.values()) hj(e.input), hj(e.canonical), hj(e.mix), hj(e.duck), hj(e.user);
		if (hj(x), C) {
			for (let e of C.stream?.getTracks?.() ?? []) e.stop?.();
			C = null;
		}
		let e = h;
		w = !0, RA.get(gt)?.(), pe("sound_runtime_disposed"), e && e.state !== "closed" && typeof e.close == "function" && await e.close();
	}
	function K(e) {
		oe();
		let t = j.setListener(e);
		return Object.freeze({
			type: "listener",
			status: "applied",
			position: { ...t.position },
			forward: { ...t.forward },
			up: { ...t.up }
		});
	}
	function lt() {
		return oe(), j.resetListenerMotion(), Object.freeze({
			type: "listener-motion",
			status: "reset"
		});
	}
	function ut(e, t) {
		let n = 0;
		for (let r of [...e.voices]) Oe(r, t), n += 1;
		return e.voices.clear(), n;
	}
	function dt(e = {}) {
		oe();
		let t = j.createEmitter(e), n = Object.freeze({
			id: t.id,
			get position() {
				return { ...t.position };
			},
			get velocity() {
				return { ...t.velocity };
			},
			get disposed() {
				return t.disposed;
			},
			get voiceCount() {
				return t.voices.size;
			},
			setPosition(e) {
				return t.setPosition(e), n;
			},
			setVelocity(e) {
				return t.setVelocity(e), n;
			},
			resetMotion() {
				return t.resetMotion(), n;
			},
			setPitch(e) {
				return t.setPitch(e), n;
			},
			get pitchScale() {
				return t.pitchScale;
			},
			play(e, n = {}) {
				return t.disposed ? Promise.reject(vj("SOUND_EMITTER_DISPOSED", `emitter ${t.id ?? ""} is disposed`, { cueId: e })) : G(e, {
					...n,
					__emitter: t
				});
			},
			stop() {
				t.stopEpoch += 1;
				let e = ut(t, "emitter-stop");
				return Object.freeze({
					type: "emitter-stop",
					status: "stopped",
					stopped: e
				});
			},
			dispose() {
				t.stopEpoch += 1;
				let e = ut(t, "emitter-dispose");
				return j.removeEmitter(t), Object.freeze({
					type: "emitter-dispose",
					status: "disposed",
					stopped: e
				});
			}
		});
		return n;
	}
	function ft(e) {
		if (oe(), !h) return Object.freeze({
			type: "spatial-update",
			status: "no-context"
		});
		let t = j.update(Number(e) || 0, h);
		return Object.freeze({
			type: "spatial-update",
			status: "applied",
			...t
		});
	}
	function pt(e) {
		return oe(), Object.freeze({
			type: "spatial-profile",
			status: "applied",
			profile: j.setProfile(fj(e, j.getProfile()))
		});
	}
	let mt = Object.freeze({
		configureSpatial: pt,
		setListener: K,
		resetListenerMotion: lt,
		createEmitter: dt,
		updateSpatial: ft
	}), ht = Object.freeze({
		get() {
			return oe(), Object.freeze({
				volumes: { ...M },
				muted: E
			});
		},
		setVolumes: nt,
		setMuted: rt
	}), gt = Object.freeze({
		unlock: Ke,
		unlocked: () => T,
		recordingStream: xe,
		preload: qe,
		playCue: G,
		startMusic: Qe,
		setMusicState: et,
		setMixState: tt,
		setUserVolumes: nt,
		setMuted: rt,
		setHold: ue,
		settings: ht,
		setListener: K,
		resetListenerMotion: lt,
		createEmitter: dt,
		updateSpatial: ft,
		configureSpatial: pt,
		attachThree: (e) => xA(mt, e),
		attachPixi: (e) => DA(mt, e),
		attachPhaser: (e) => NA(mt, e),
		stop: it,
		clear: ot,
		inspect: st,
		dispose: ct
	});
	return gt;
}
function Sj(e) {
	let t = globalThis.window;
	if (!t || typeof t != "object") return;
	let n = Object.freeze({
		recordingStream: () => e.recordingStream(),
		unlocked: () => e.unlocked(),
		unlock: () => e.unlock(),
		version: LA
	});
	try {
		Object.defineProperty(t, "__mpSound", {
			configurable: !0,
			enumerable: !1,
			writable: !1,
			value: n
		});
	} catch {
		return;
	}
	if (RA.set(e, () => {
		if (t.__mpSound === n) try {
			delete t.__mpSound;
		} catch {}
	}), typeof t.dispatchEvent == "function" && typeof globalThis.CustomEvent == "function") try {
		t.dispatchEvent(new globalThis.CustomEvent("mp:sound-ready"));
	} catch {}
}
async function Cj({ manifestUrl: e = "./sound.manifest.json", baseUrl: t, audioContextFactory: n, fetchImpl: r, mediaElementFactory: i, telemetrySink: a, now: o } = {}) {
	let s = r ?? globalThis.fetch?.bind(globalThis);
	if (typeof s != "function") throw vj("SOUND_MANIFEST_FETCH_REQUIRED", "fetch is required to load the sound manifest", { manifestUrl: e });
	let c;
	try {
		c = await s(e);
	} catch (t) {
		throw vj("SOUND_MANIFEST_LOAD_FAILED", `failed to load sound manifest ${e}`, {
			manifestUrl: e,
			cause: t
		});
	}
	if (!c || c.ok === !1 || typeof c.json != "function") throw vj("SOUND_MANIFEST_LOAD_FAILED", `failed to load sound manifest ${e}`, {
		manifestUrl: e,
		status: c?.status ?? null
	});
	let l;
	try {
		l = await c.json();
	} catch (t) {
		throw vj("SOUND_MANIFEST_INVALID", `sound manifest ${e} is not valid JSON`, {
			manifestUrl: e,
			cause: t
		});
	}
	let u = globalThis.document?.createElement ? () => globalThis.document.createElement("audio") : void 0, d = xj({
		manifest: l,
		baseUrl: t ?? uj(e, c.url),
		audioContextFactory: n,
		fetchImpl: s,
		mediaElementFactory: i ?? u,
		telemetrySink: a,
		now: o
	});
	return Sj(d), d;
}
//#endregion
//#region levels.js
var wj = [
	{
		map: [
			"#..",
			"##.",
			"..."
		],
		start: [0, 2],
		snacks: [],
		par: 3,
		arrows: [],
		portals: []
	},
	{
		map: [
			"...",
			".#.",
			".##",
			"..#"
		],
		start: [2, 1],
		snacks: [],
		par: 4,
		arrows: [],
		portals: []
	},
	{
		map: [
			"...#",
			".#.#",
			".#.#",
			".#.."
		],
		start: [3, 3],
		snacks: [[
			2,
			0,
			2
		]],
		par: 4,
		arrows: [],
		portals: []
	},
	{
		map: [
			"#...",
			"#.#.",
			"....",
			"..##"
		],
		start: [0, 2],
		snacks: [[
			1,
			0,
			3
		]],
		par: 6,
		arrows: [],
		portals: []
	},
	{
		map: [
			"....",
			".#..",
			".#..",
			"....",
			"#..."
		],
		start: [3, 0],
		snacks: [[
			2,
			3,
			4
		]],
		par: 7,
		arrows: [],
		portals: []
	},
	{
		map: [
			".....",
			".....",
			"###.#",
			"###..",
			"###.."
		],
		start: [4, 1],
		snacks: [[
			3,
			0,
			2
		]],
		par: 7,
		arrows: [],
		portals: []
	},
	{
		map: [
			"##...",
			"#..#.",
			"...#.",
			".....",
			"..###"
		],
		start: [2, 2],
		snacks: [[
			0,
			3,
			2
		], [
			1,
			4,
			3
		]],
		par: 9,
		arrows: [],
		portals: []
	},
	{
		map: [
			"#....",
			"..##.",
			"..##.",
			"...#.",
			".#...",
			"....."
		],
		start: [0, 1],
		snacks: [[
			1,
			3,
			5
		], [
			3,
			4,
			8
		]],
		par: 8,
		arrows: [],
		portals: []
	},
	{
		map: [
			".....",
			"..##.",
			"...#.",
			".#...",
			".....",
			"###.."
		],
		start: [2, 4],
		snacks: [[
			3,
			4,
			6
		], [
			0,
			1,
			2
		]],
		par: 10,
		arrows: [],
		portals: []
	},
	{
		map: [
			"###..#",
			".....#",
			".#...#",
			"#..#..",
			"#..##.",
			"#..##.",
			"##...."
		],
		start: [1, 5],
		snacks: [[
			3,
			1,
			9
		], [
			4,
			6,
			4
		]],
		par: 13,
		arrows: [],
		portals: []
	},
	{
		map: [
			"....##",
			"....##",
			"....##",
			"#.....",
			"...##.",
			"....#.",
			"###..."
		],
		start: [2, 4],
		snacks: [[
			0,
			2,
			13
		], [
			3,
			3,
			3
		]],
		par: 13,
		arrows: [],
		portals: []
	},
	{
		map: [
			"......",
			"....#.",
			"..#...",
			"......",
			"......",
			"####..",
			"#.....",
			"#....."
		],
		start: [1, 3],
		snacks: [[
			1,
			4,
			7
		], [
			4,
			0,
			9
		]],
		par: 14,
		arrows: [],
		portals: []
	},
	{
		map: [
			"###...",
			"....#.",
			"......",
			"####..",
			"####..",
			"......",
			"......",
			"......"
		],
		start: [4, 6],
		snacks: [
			[
				3,
				1,
				4
			],
			[
				5,
				5,
				7
			],
			[
				2,
				5,
				10
			]
		],
		par: 12,
		arrows: [],
		portals: []
	},
	{
		map: [
			"##.....",
			".......",
			".##....",
			"...#...",
			".......",
			".......",
			".#####.",
			"......."
		],
		start: [4, 1],
		snacks: [
			[
				6,
				2,
				7
			],
			[
				2,
				1,
				3
			],
			[
				0,
				6,
				5
			]
		],
		par: 17,
		arrows: [],
		portals: []
	},
	{
		map: [
			"##...#",
			"##.#..",
			"#.....",
			"..###.",
			".####.",
			"......",
			"####.."
		],
		start: [3, 2],
		snacks: [[
			2,
			0,
			9
		], [
			5,
			6,
			2
		]],
		par: 12,
		arrows: [[
			1,
			2,
			0
		]],
		portals: []
	},
	{
		map: [
			"......",
			"......",
			".###..",
			"......",
			"......",
			".####.",
			"......",
			"####.."
		],
		start: [4, 4],
		snacks: [[
			3,
			0,
			8
		], [
			0,
			4,
			7
		]],
		par: 12,
		arrows: [[
			1,
			4,
			3
		]],
		portals: []
	},
	{
		map: [
			"..####",
			".....#",
			"...#.#",
			"#..#.#",
			"#....#",
			"#.....",
			"....#.",
			"......"
		],
		start: [2, 2],
		snacks: [[
			5,
			5,
			11
		], [
			1,
			1,
			8
		]],
		par: 13,
		arrows: [[
			1,
			2,
			1
		], [
			5,
			7,
			1
		]],
		portals: []
	},
	{
		map: [
			"....###",
			"....###",
			".......",
			".....#.",
			".......",
			"...##..",
			".#..#..",
			"....#.."
		],
		start: [4, 3],
		snacks: [
			[
				1,
				5,
				15
			],
			[
				2,
				1,
				3
			],
			[
				5,
				7,
				7
			]
		],
		par: 15,
		arrows: [[
			0,
			3,
			3
		], [
			3,
			1,
			1
		]],
		portals: []
	},
	{
		map: [
			"####...",
			".......",
			".####..",
			".......",
			"#......",
			"#....#.",
			"#..#...",
			"#..#..#",
			"#..####"
		],
		start: [5, 2],
		snacks: [
			[
				1,
				7,
				5
			],
			[
				1,
				3,
				3
			],
			[
				6,
				4,
				13
			]
		],
		par: 14,
		arrows: [[
			5,
			1,
			1
		], [
			5,
			3,
			2
		]],
		portals: []
	},
	{
		map: [
			"...####",
			".#.####",
			".......",
			"..####.",
			".....#.",
			".......",
			".##...#",
			"....###",
			"..#####"
		],
		start: [1, 2],
		snacks: [
			[
				0,
				4,
				8
			],
			[
				2,
				2,
				6
			],
			[
				0,
				1,
				8
			]
		],
		par: 13,
		arrows: [
			[
				1,
				4,
				0
			],
			[
				5,
				5,
				0
			],
			[
				0,
				0,
				2
			]
		],
		portals: []
	},
	{
		map: [
			"..#...#",
			"#...#.#",
			"##....#",
			"...#..#",
			"......#",
			"..#...#",
			"..#...#",
			"..#....",
			"..#...."
		],
		start: [4, 7],
		snacks: [
			[
				3,
				0,
				11
			],
			[
				5,
				5,
				10
			],
			[
				1,
				7,
				4
			]
		],
		par: 15,
		arrows: [
			[
				4,
				2,
				1
			],
			[
				2,
				3,
				1
			],
			[
				0,
				8,
				0
			]
		],
		portals: []
	},
	{
		map: [
			"..#.##",
			"..#...",
			"#.#...",
			"#.#...",
			"#.#...",
			"#.#...",
			"#....."
		],
		start: [3, 4],
		snacks: [[
			5,
			2,
			5
		], [
			1,
			0,
			2
		]],
		par: 8,
		arrows: [],
		portals: [[
			3,
			0,
			0,
			1
		]]
	},
	{
		map: [
			"##....",
			"......",
			".....#",
			"...#..",
			"...##.",
			".#.##.",
			".#....",
			"..####"
		],
		start: [3, 1],
		snacks: [[
			5,
			4,
			5
		], [
			2,
			0,
			7
		]],
		par: 13,
		arrows: [],
		portals: [[
			4,
			1,
			1,
			7
		]]
	},
	{
		map: [
			".......",
			".....#.",
			".....#.",
			".....#.",
			".....#.",
			".....#.",
			".......",
			"....###"
		],
		start: [3, 1],
		snacks: [
			[
				3,
				0,
				4
			],
			[
				6,
				5,
				3
			],
			[
				1,
				4,
				9
			]
		],
		par: 11,
		arrows: [],
		portals: [[
			3,
			5,
			4,
			1
		]]
	},
	{
		map: [
			"......#",
			".###...",
			"..##.#.",
			"...#.#.",
			"...#.#.",
			".##..#.",
			".##.##.",
			".....#.",
			".#....."
		],
		start: [1, 4],
		snacks: [
			[
				3,
				0,
				15
			],
			[
				2,
				8,
				11
			],
			[
				5,
				8,
				5
			]
		],
		par: 15,
		arrows: [],
		portals: [[
			0,
			8,
			4,
			7
		], [
			1,
			7,
			1,
			2
		]]
	},
	{
		map: [
			"...####",
			".#.....",
			".....#.",
			".....#.",
			"......#",
			"....#.#",
			"..#....",
			".....#.",
			"......."
		],
		start: [0, 3],
		snacks: [
			[
				2,
				2,
				2
			],
			[
				1,
				0,
				4
			],
			[
				5,
				8,
				8
			]
		],
		par: 18,
		arrows: [[
			4,
			2,
			1
		]],
		portals: [[
			6,
			3,
			4,
			6
		]]
	},
	{
		map: [
			".......",
			".##....",
			".##..##",
			"..#....",
			"....##.",
			"...###.",
			"##..##.",
			"..#..#.",
			"..##..."
		],
		start: [3, 1],
		snacks: [
			[
				6,
				7,
				10
			],
			[
				0,
				0,
				13
			],
			[
				4,
				3,
				11
			]
		],
		par: 19,
		arrows: [[
			6,
			8,
			3
		]],
		portals: [[
			1,
			3,
			5,
			0
		], [
			5,
			1,
			1,
			7
		]]
	},
	{
		map: [
			"...#..#",
			"......#",
			"..#...#",
			"......#",
			".#.#..#",
			".#....#",
			".#..#..",
			".##.##.",
			".##....",
			"......#"
		],
		start: [1, 3],
		snacks: [
			[
				0,
				2,
				2
			],
			[
				3,
				5,
				10
			],
			[
				0,
				7,
				2
			]
		],
		par: 16,
		arrows: [[
			1,
			1,
			1
		], [
			3,
			8,
			0
		]],
		portals: [[
			5,
			9,
			2,
			6
		]]
	},
	{
		map: [
			"##.....",
			"...###.",
			"...##..",
			"......#",
			"......#",
			".###..#",
			".###..#",
			"......#",
			"......#"
		],
		start: [2, 3],
		snacks: [
			[
				0,
				3,
				13
			],
			[
				4,
				6,
				5
			],
			[
				5,
				3,
				5
			]
		],
		par: 16,
		arrows: [[
			5,
			6,
			1
		]],
		portals: [[
			1,
			7,
			1,
			3
		]]
	},
	{
		map: [
			"..##...",
			".......",
			".......",
			".#..#..",
			".#..#..",
			".#.....",
			".#.#...",
			"...#...",
			"######."
		],
		start: [5, 3],
		snacks: [
			[
				3,
				5,
				3
			],
			[
				6,
				3,
				11
			],
			[
				1,
				2,
				8
			]
		],
		par: 18,
		arrows: [[
			4,
			5,
			1
		], [
			2,
			2,
			3
		]],
		portals: [[
			3,
			1,
			5,
			2
		], [
			6,
			8,
			2,
			3
		]]
	},
	{
		map: [
			".......",
			".#...#.",
			"...#...",
			".......",
			"....#..",
			".......",
			".......",
			"..#....",
			"......."
		],
		start: [2, 8],
		snacks: [
			[
				5,
				2,
				16
			],
			[
				1,
				0,
				14
			],
			[
				6,
				5,
				8
			]
		],
		par: 18,
		arrows: [
			[
				4,
				8,
				3
			],
			[
				1,
				5,
				3
			],
			[
				1,
				6,
				2
			]
		],
		portals: [[
			5,
			4,
			3,
			7
		]]
	},
	{
		map: [
			".......",
			"..###..",
			"#.....#",
			"#......",
			"#....#.",
			"..##.#.",
			"..##...",
			"..#..##",
			"###...#"
		],
		start: [1, 3],
		snacks: [
			[
				5,
				2,
				13
			],
			[
				4,
				8,
				10
			],
			[
				3,
				0,
				11
			]
		],
		par: 16,
		arrows: [[
			6,
			1,
			1
		]],
		portals: [[
			0,
			5,
			3,
			8
		], [
			5,
			8,
			0,
			0
		]]
	},
	{
		map: [
			"....#..",
			".......",
			"...#...",
			".......",
			"####...",
			"####.#.",
			"..##...",
			"#.##...",
			"#......",
			"#####.."
		],
		start: [5, 6],
		snacks: [
			[
				1,
				7,
				5
			],
			[
				1,
				0,
				16
			],
			[
				3,
				3,
				8
			]
		],
		par: 16,
		arrows: [[
			5,
			9,
			0
		], [
			6,
			4,
			1
		]],
		portals: [[
			0,
			6,
			2,
			2
		]]
	},
	{
		map: [
			"..#....",
			"..#....",
			".#.....",
			".#.....",
			".......",
			"..#....",
			".......",
			"##.#...",
			"...#...",
			".....##"
		],
		start: [3, 3],
		snacks: [
			[
				0,
				9,
				11
			],
			[
				6,
				1,
				3
			],
			[
				2,
				3,
				7
			]
		],
		par: 17,
		arrows: [
			[
				6,
				0,
				1
			],
			[
				3,
				1,
				0
			],
			[
				0,
				4,
				3
			]
		],
		portals: [[
			3,
			6,
			5,
			3
		], [
			1,
			1,
			4,
			3
		]]
	},
	{
		map: [
			"..#....",
			"....##.",
			"....#..",
			"#......",
			"#.###..",
			"#.....#",
			"#.....#",
			"#..#..#",
			"#....##",
			"#....##"
		],
		start: [5, 2],
		snacks: [
			[
				2,
				9,
				3
			],
			[
				4,
				0,
				13
			],
			[
				1,
				6,
				2
			]
		],
		par: 19,
		arrows: [[
			5,
			3,
			1
		]],
		portals: [[
			4,
			9,
			3,
			6
		]]
	},
	{
		map: [
			".#######",
			".......#",
			"..##...#",
			".......#",
			"..#..#.#",
			"....##..",
			"....##..",
			"#.......",
			"#.......",
			"#..#####"
		],
		start: [1, 5],
		snacks: [
			[
				5,
				2,
				4
			],
			[
				4,
				8,
				12
			],
			[
				1,
				8,
				9
			]
		],
		par: 19,
		arrows: [[
			6,
			8,
			0
		], [
			3,
			4,
			3
		]],
		portals: [[
			7,
			5,
			5,
			3
		], [
			2,
			3,
			2,
			7
		]]
	},
	{
		map: [
			"#......#",
			"#....#.#",
			"####....",
			"...#....",
			".#...#..",
			".......#",
			".....#.#",
			"...#.#.#",
			"...#...#",
			".......#"
		],
		start: [1, 6],
		snacks: [
			[
				2,
				0,
				7
			],
			[
				6,
				5,
				2
			],
			[
				5,
				3,
				3
			]
		],
		par: 22,
		arrows: [
			[
				6,
				3,
				2
			],
			[
				7,
				4,
				3
			],
			[
				6,
				2,
				3
			]
		],
		portals: [[
			6,
			9,
			5,
			2
		]]
	},
	{
		map: [
			"#....###",
			"...#...#",
			".#.#....",
			".#.#..#.",
			".....##.",
			"###.....",
			"###.....",
			"###.#...",
			"###...#.",
			"........"
		],
		start: [5, 8],
		snacks: [
			[
				5,
				1,
				11
			],
			[
				1,
				0,
				7
			],
			[
				5,
				6,
				17
			]
		],
		par: 19,
		arrows: [[
			3,
			4,
			0
		]],
		portals: [[
			4,
			6,
			2,
			1
		], [
			0,
			9,
			6,
			7
		]]
	},
	{
		map: [
			"....##..",
			"....##..",
			"........",
			".....###",
			"...#....",
			".####...",
			".####...",
			".####...",
			".#####..",
			".......#"
		],
		start: [6, 6],
		snacks: [
			[
				5,
				4,
				9
			],
			[
				2,
				2,
				5
			],
			[
				3,
				9,
				17
			]
		],
		par: 21,
		arrows: [[
			1,
			2,
			2
		], [
			2,
			4,
			3
		]],
		portals: [[
			7,
			4,
			6,
			1
		]]
	},
	{
		map: [
			"#...#...",
			"..#.....",
			"..#.....",
			"......#.",
			"...#....",
			".#...###",
			"........",
			".##...#.",
			".##.#.#.",
			".##.....",
			"........"
		],
		start: [0, 1],
		snacks: [
			[
				5,
				3,
				6
			],
			[
				1,
				0,
				14
			],
			[
				7,
				1,
				19
			]
		],
		par: 21,
		arrows: [
			[
				0,
				10,
				0
			],
			[
				5,
				7,
				2
			],
			[
				5,
				2,
				0
			]
		],
		portals: [[
			1,
			6,
			4,
			9
		], [
			6,
			9,
			2,
			3
		]]
	},
	{
		map: [
			"###....#",
			"....##.#",
			".#..##.#",
			".......#",
			".#######",
			".#######",
			"........",
			"..###...",
			".......#",
			"........",
			"..#....."
		],
		start: [4, 9],
		snacks: [
			[
				4,
				0,
				3
			],
			[
				6,
				9,
				20
			],
			[
				4,
				10,
				18
			]
		],
		par: 21,
		arrows: [[
			3,
			0,
			2
		]],
		portals: [[
			5,
			9,
			1,
			3
		]]
	},
	{
		map: [
			"........",
			"....###.",
			".....#..",
			".....#.#",
			".....#..",
			"..##....",
			"...##...",
			"......#.",
			"........",
			"......##",
			"#####.##"
		],
		start: [1, 3],
		snacks: [
			[
				4,
				0,
				5
			],
			[
				0,
				8,
				6
			],
			[
				4,
				9,
				7
			]
		],
		par: 21,
		arrows: [[
			7,
			4,
			1
		], [
			6,
			2,
			0
		]],
		portals: [[
			3,
			3,
			4,
			5
		], [
			5,
			10,
			1,
			7
		]]
	},
	{
		map: [
			"........",
			".#...#..",
			"...#....",
			"........",
			"...#...#",
			".....#..",
			"......#.",
			"......#.",
			"......#.",
			"......#.",
			"........"
		],
		start: [2, 8],
		snacks: [
			[
				4,
				7,
				12
			],
			[
				7,
				1,
				3
			],
			[
				7,
				6,
				21
			]
		],
		par: 26,
		arrows: [
			[
				7,
				0,
				2
			],
			[
				2,
				2,
				3
			],
			[
				4,
				2,
				0
			]
		],
		portals: [[
			6,
			1,
			2,
			6
		]]
	},
	{
		map: [
			"#.......",
			"....#...",
			"##..#...",
			"........",
			".##.....",
			".#....#.",
			".#.##...",
			".#.#....",
			".#.#.#..",
			".#......",
			"....#..."
		],
		start: [2, 3],
		snacks: [
			[
				2,
				6,
				5
			],
			[
				5,
				3,
				7
			],
			[
				1,
				10,
				3
			]
		],
		par: 25,
		arrows: [[
			2,
			9,
			3
		]],
		portals: [[
			0,
			1,
			3,
			1
		], [
			4,
			3,
			6,
			9
		]]
	},
	{
		map: [
			".....###",
			"..##.###",
			"..##...#",
			"...#...#",
			"...#....",
			"...#....",
			"........",
			".......#",
			".....#.#",
			".#.....#",
			"...##..#"
		],
		start: [1, 4],
		snacks: [
			[
				2,
				6,
				21
			],
			[
				4,
				5,
				3
			],
			[
				2,
				10,
				15
			]
		],
		par: 23,
		arrows: [[
			5,
			2,
			0
		], [
			7,
			4,
			2
		]],
		portals: [[
			0,
			0,
			6,
			5
		]]
	},
	{
		map: [
			"##.#....",
			"##......",
			"#.......",
			"#.#.....",
			"#.......",
			"##......",
			"........",
			"..#.....",
			"....#...",
			".#......",
			"...#####"
		],
		start: [6, 3],
		snacks: [
			[
				7,
				0,
				2
			],
			[
				4,
				5,
				11
			],
			[
				7,
				7,
				10
			]
		],
		par: 24,
		arrows: [
			[
				7,
				4,
				1
			],
			[
				3,
				2,
				2
			],
			[
				5,
				2,
				1
			]
		],
		portals: [[
			5,
			3,
			4,
			0
		], [
			2,
			0,
			7,
			9
		]]
	},
	{
		map: [
			".....#..",
			"........",
			"##......",
			"...##...",
			"........",
			"..#.....",
			"....#...",
			".#......",
			"...#..##",
			"..#...##",
			"....#.##",
			"......##"
		],
		start: [5, 3],
		snacks: [
			[
				0,
				10,
				19
			],
			[
				2,
				6,
				23
			],
			[
				4,
				11,
				2
			]
		],
		par: 26,
		arrows: [[
			6,
			1,
			3
		]],
		portals: [[
			0,
			11,
			4,
			0
		]]
	},
	{
		map: [
			".....#..",
			"..##.#..",
			"..##....",
			"........",
			"......##",
			"......##",
			"...#..##",
			"......##",
			"....#...",
			".#...##.",
			"........",
			"#...####"
		],
		start: [2, 7],
		snacks: [
			[
				4,
				1,
				7
			],
			[
				0,
				6,
				9
			],
			[
				1,
				1,
				23
			]
		],
		par: 25,
		arrows: [[
			1,
			11,
			0
		], [
			7,
			8,
			1
		]],
		portals: [[
			2,
			0,
			4,
			9
		], [
			2,
			10,
			0,
			5
		]]
	},
	{
		map: [
			"###....#",
			"##...#.#",
			"...#....",
			".....#..",
			".##.##..",
			".##.....",
			".#....#.",
			".#.#....",
			".#...#.#",
			".##....#",
			".##.....",
			"........"
		],
		start: [6, 3],
		snacks: [
			[
				6,
				9,
				23
			],
			[
				2,
				2,
				8
			],
			[
				0,
				10,
				11
			]
		],
		par: 26,
		arrows: [
			[
				6,
				2,
				1
			],
			[
				1,
				3,
				3
			],
			[
				3,
				11,
				3
			]
		],
		portals: [[
			4,
			3,
			3,
			0
		]]
	},
	{
		map: [
			"........",
			".######.",
			"....###.",
			"........",
			"..#####.",
			"..#.....",
			"#...#...",
			"##......",
			"...#...#",
			".......#",
			".......#",
			"..#....#"
		],
		start: [1, 9],
		snacks: [
			[
				5,
				11,
				26
			],
			[
				3,
				6,
				10
			],
			[
				0,
				9,
				21
			]
		],
		par: 26,
		arrows: [[
			6,
			7,
			0
		]],
		portals: [[
			0,
			5,
			3,
			2
		], [
			6,
			3,
			1,
			2
		]]
	}
], Tj = {
	zh: "尖叫鸡",
	en: "Screaming Chicken",
	ja: "叫ぶチキン"
};
function Ej() {
	return Tj[Aj] ?? "尖叫鸡";
}
var Dj = {
	zh: {
		play: "开始",
		tagline: "滑一下，铺满整块地！",
		levels: "选择关卡",
		level: "第 {n} 关",
		swipeHint: "滑动屏幕，让鸡脖子伸到底",
		fillHint: "铺满所有蓝色格子就过关",
		snackHint: "零食数字到 0 前吃到才算",
		clear: "过关啦！",
		next: "下一关",
		retry: "重玩",
		menu: "关卡",
		resume: "继续",
		paused: "暂停",
		settings: "设置",
		home: "主界面",
		sound: "音效",
		music: "音乐",
		on: "开",
		off: "关",
		language: "语言",
		starClear: "铺满全场",
		starSnack: "吃光零食",
		starPerfect: "一次通过",
		allDone: "全部通关！你是最长的鸡",
		stuck: "撞进死胡同了！",
		loading: "加载中",
		arrowHint: "踩到箭头会被强行拐弯",
		portalHint: "钻进传送门，从另一个门钻出来",
		shop: "商店",
		passName: "3星直通券",
		passPrice: "1 金币 / 关",
		passDesc: "直接三星过关，并解锁下一关",
		shopPick: "点选一个未满星的关卡购买",
		shopEmpty: "已解锁的关卡都满星啦",
		ticketsHave: "已有直通券 ×{n}，点关卡免费使用",
		passTitle: "第 {n} 关 · 3星直通",
		passDialogDesc: "立即以三星通过这一关，并解锁下一关",
		passDone: "第 {n} 关已三星直通！",
		ticketBanked: "直通券已到账，可在商店免费使用",
		payPending: "支付确认中，到账后会自动发放",
		paySelf: "作者不能购买自己游戏里的商品",
		payFail: "暂时无法购买，请稍后再试"
	},
	en: {
		play: "Play",
		tagline: "Swipe. Stretch. Fill it all!",
		levels: "Levels",
		level: "Level {n}",
		swipeHint: "Swipe to stretch the chicken until it hits a wall",
		fillHint: "Cover every blue square to win",
		snackHint: "Eat snacks before their number hits 0",
		clear: "Cleared!",
		next: "Next",
		retry: "Retry",
		menu: "Levels",
		resume: "Resume",
		paused: "Paused",
		settings: "Settings",
		home: "Home",
		sound: "Sound",
		music: "Music",
		on: "On",
		off: "Off",
		language: "Language",
		starClear: "Fill the board",
		starSnack: "Eat every snack",
		starPerfect: "First try",
		allDone: "All clear! Longest chicken ever",
		stuck: "Dead end! Bonk.",
		loading: "Loading",
		arrowHint: "Arrows force you to turn",
		portalHint: "Enter a portal, pop out of its twin",
		shop: "Shop",
		passName: "3-Star Pass",
		passPrice: "1 coin per level",
		passDesc: "3 stars right away, next level unlocked",
		shopPick: "Tap a level without 3 stars to buy",
		shopEmpty: "Every unlocked level already has 3 stars",
		ticketsHave: "Passes owned ×{n} — tap a level to use one free",
		passTitle: "Level {n} · 3-Star Pass",
		passDialogDesc: "Clear this level with 3 stars now and unlock the next one",
		passDone: "Level {n} cleared with 3 stars!",
		ticketBanked: "Pass delivered — use it free in the shop",
		payPending: "Payment pending — it will be delivered automatically",
		paySelf: "Creators can't buy items in their own game",
		payFail: "Purchases are unavailable right now"
	},
	ja: {
		play: "スタート",
		tagline: "スワイプして全部うめよう！",
		levels: "ステージ",
		level: "ステージ {n}",
		swipeHint: "スワイプでニワトリが壁までのびる",
		fillHint: "青いマスを全部うめたらクリア",
		snackHint: "数字が0になる前におやつを食べよう",
		clear: "クリア！",
		next: "次へ",
		retry: "もう一度",
		menu: "ステージ",
		resume: "つづける",
		paused: "ポーズ",
		settings: "設定",
		home: "ホーム",
		sound: "効果音",
		music: "音楽",
		on: "オン",
		off: "オフ",
		language: "言語",
		starClear: "全部うめる",
		starSnack: "おやつ完食",
		starPerfect: "一発クリア",
		allDone: "全クリア！最長のニワトリ",
		stuck: "行き止まり！",
		loading: "読み込み中",
		arrowHint: "矢印をふむと強制的に曲がる",
		portalHint: "ポータルに入ると相方から出る",
		shop: "ショップ",
		passName: "★3パス",
		passPrice: "1コイン／ステージ",
		passDesc: "★3で即クリア、次のステージも解放",
		shopPick: "★3でないステージをタップして購入",
		shopEmpty: "解放済みのステージはすべて★3です",
		ticketsHave: "所持パス ×{n}：ステージをタップで無料使用",
		passTitle: "ステージ {n}・★3パス",
		passDialogDesc: "このステージを★3で即クリアし、次を解放します",
		passDone: "ステージ {n} を★3でクリア！",
		ticketBanked: "パスが届きました。ショップで無料で使えます",
		payPending: "決済確認中。完了後に自動で付与されます",
		paySelf: "作者は自分のゲーム内で購入できません",
		payFail: "現在は購入できません"
	}
}, Oj = {
	zh: "中文",
	en: "English",
	ja: "日本語"
}, kj = [
	"zh",
	"en",
	"ja"
], Aj = "zh";
function jj(e) {
	let t = (e || "").toLowerCase();
	return t.startsWith("zh") ? "zh" : t.startsWith("ja") ? "ja" : t.startsWith("en") ? "en" : "zh";
}
var Mj = !0;
function Nj(e) {
	Mj = !!e;
}
function Pj(e) {
	Aj = e, Mj && (document.documentElement.lang = e === "zh" ? "zh-CN" : e, document.title = Tj[e] ?? "尖叫鸡");
}
function Fj() {
	return Aj;
}
function Ij(e, t) {
	let n = Dj[Aj][e] ?? Dj.en[e] ?? e;
	if (t) for (let e in t) n = n.replace("{" + e + "}", String(t[e]));
	return n;
}
//#endregion
//#region src/host.js
function Lj(e) {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set(), r = Symbol("deleted"), i = /* @__PURE__ */ new Map();
	return {
		async preload() {
			let n = await e.list();
			for (let [e, r] of Object.entries(n)) t.set(e, typeof r == "string" ? r : JSON.stringify(r));
		},
		getItem(e) {
			return t.has(e) ? t.get(e) : null;
		},
		setItem(e, r) {
			let a = String(r);
			t.set(e, a), i.set(e, a), n.add(e);
		},
		removeItem(e) {
			t.delete(e), i.set(e, r), n.add(e);
		},
		async flush() {
			let t = [...n];
			n.clear(), await Promise.all(t.map(async (t) => {
				let n = i.get(t);
				i.delete(t);
				try {
					await e.set(t, n === r ? null : n);
				} catch (e) {
					console.warn("[screamchick] 存档落盘失败", t, e);
				}
			}));
		}
	};
}
function Rj(e = "screamchick:") {
	let t = /* @__PURE__ */ new Map(), n = (() => {
		try {
			let e = "__sc_probe__";
			return window.localStorage.setItem(e, "1"), window.localStorage.removeItem(e), window.localStorage;
		} catch {
			return null;
		}
	})();
	return {
		async preload() {},
		getItem(r) {
			if (n) try {
				return n.getItem(e + r);
			} catch {}
			return t.has(r) ? t.get(r) : null;
		},
		setItem(r, i) {
			let a = String(i);
			if (t.set(r, a), n) try {
				n.setItem(e + r, a);
			} catch {}
		},
		removeItem(r) {
			if (t.delete(r), n) try {
				n.removeItem(e + r);
			} catch {}
		},
		async flush() {}
	};
}
//#endregion
//#region game.js
async function zj(e = {}) {
	let t = e.mountTo || document.getElementById("app") || document.body, n = !!e.mountTo, r = typeof e.asset == "function" ? e.asset : (e) => e, i = typeof e.assetBase == "string" ? e.assetBase : "", a = e.store || Rj(), o = typeof e.chargePlay == "function" ? e.chargePlay : async () => !0;
	Nj(!n);
	let s = !0, c = !1, l = [], u = (e, t, n) => {
		e.addEventListener(t, n), l.push([
			e,
			t,
			n
		]);
	}, d = /* @__PURE__ */ new Set(), f = (e, t) => {
		let n = setTimeout(() => {
			d.delete(n), s && e();
		}, t);
		return d.add(n), n;
	}, p = document.documentElement.lang, m = document.title;
	if (!n) try {
		document.title = Ej();
	} catch {}
	let h = {
		ground: 15522186,
		pit: 4157340,
		pitDark: 2838649,
		card: 13213022,
		cardDark: 10253376,
		cardLight: 14728581,
		yellow: 16176698,
		yellowLight: 16639863,
		yellowDark: 14264604,
		yellowDeep: 12159506,
		cream: 16314847,
		creamDark: 14273706,
		ink: 2966886,
		red: 14698298,
		green: 6265420
	}, g = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	], _ = "save", v = {
		v: 2,
		unlocked: 1,
		stars: Array(wj.length).fill(0),
		music: !0,
		sfx: !0,
		last: 0
	};
	try {
		let e = a.getItem(_), t = e ? JSON.parse(e) : null;
		if (t && typeof t == "object") {
			if (typeof t.unlocked == "number" && (v.unlocked = Math.max(1, Math.min(wj.length, t.unlocked))), Array.isArray(t.stars)) for (let e = 0; e < wj.length; e++) v.stars[e] = +t.stars[e] || 0;
			if ((t.v ?? 1) < 2) for (let e = 9; e < wj.length; e++) v.stars[e] = 0;
			typeof t.music == "boolean" && (v.music = t.music), typeof t.sfx == "boolean" && (v.sfx = t.sfx), (t.lang === "zh" || t.lang === "en" || t.lang === "ja") && (v.lang = t.lang), typeof t.last == "number" && (v.last = t.last);
		}
	} catch {}
	function y() {
		try {
			a.setItem(_, JSON.stringify(v));
		} catch {}
	}
	Pj(v.lang ?? jj(e.locale || (typeof navigator < "u" ? navigator.language : "")));
	let b = null, x = !1;
	function S() {
		if (b) try {
			b.settings.setVolumes({
				music: +!!v.music,
				sfx: +!!v.sfx
			});
		} catch {}
	}
	let C = 0, w = -1, T = [
		"move.bump.0",
		"move.bump.1",
		"move.bump.2",
		"move.bump.3",
		"move.bump.4",
		"move.bump.5",
		"move.bump.6",
		"move.bump.7",
		"move.bump.8",
		"move.bump.9"
	];
	function E(e, t = 0) {
		if (!b || !x) return;
		let n = e + ":" + C++;
		try {
			if (e === "move.slide") b.playCue("move.slide", {
				eventId: n,
				pitchSemitones: t
			});
			else if (e === "move.bump") {
				let e = Math.floor(Math.random() * 10);
				e === w && (e = (e + 1 + Math.floor(Math.random() * 9)) % 10), w = e, b.playCue(T[e], {
					eventId: n,
					pitchSemitones: t * .3
				});
			} else e === "chicken.squawk" ? b.playCue("chicken.squawk", {
				eventId: n,
				pitchSemitones: t
			}) : e === "snack.eat" ? b.playCue("snack.eat", {
				eventId: n,
				pitchSemitones: t
			}) : e === "level.win" ? b.playCue("level.win", { eventId: n }) : e === "ui.click" ? b.playCue("ui.click", { eventId: n }) : e === "move.undo" && b.playCue("move.undo", { eventId: n });
		} catch {}
	}
	function D() {
		b && !x && (x = !0, b.unlock().then(() => {
			S(), b.setMusicState("main", { eventId: "session" });
		}).catch(() => {
			x = !1;
		}));
	}
	u(window, "pointerdown", D), u(window, "keydown", D);
	let O = t, k = O.clientWidth || window.innerWidth, A = O.clientHeight || window.innerHeight, j = new rc();
	await j.init({
		resizeTo: O,
		autoDensity: !0,
		antialias: !0,
		background: h.ground
	}), O.appendChild(j.canvas);
	let M = !1, N = Jk({
		host: O,
		orientation: "portrait",
		onResize: ({ width: e, height: t }) => {
			k = e, A = t, M && sr();
		}
	});
	N.attachPixi(j), k = j.screen.width, A = j.screen.height;
	let P = "\"OpenHuninn\", \"PingFang SC\", \"Hiragino Sans\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif", ee = new Y();
	j.stage.addChild(ee);
	let F = new $(), te = new $(), I = new $();
	ee.addChild(F, te, I);
	let L = 0;
	function ne() {
		F.clear().rect(0, 0, k, A).fill(h.ground), te.clear(), te.roundRect(-26, -26, 52, 52, 8).fill(h.yellow).stroke({
			width: 3,
			color: h.yellowDeep
		}), te.circle(-9, -6, 7).fill(16777215), te.circle(9, -6, 7).fill(16777215), te.circle(-8, -5, 3).fill(2236962), te.circle(10, -5, 3).fill(2236962), te.ellipse(0, 12, 6, 8).fill(15305258), te.position.set(k / 2, A / 2 - 30);
		let e = Math.min(260, k - 80);
		I.clear(), I.roundRect(k / 2 - e / 2, A / 2 + 40, e, 16, 8).fill(h.creamDark), I.roundRect(k / 2 - e / 2 + 2, A / 2 + 42, Math.max(12, (e - 4) * L), 12, 6).fill(h.ink);
	}
	ne();
	let re = (e) => {
		te.rotation += .004 * e.deltaMS, te.scale.set(1 + .06 * Math.sin(performance.now() / 180));
	};
	j.ticker.add(re);
	try {
		let e = new FontFace("OpenHuninn", "url(\"" + r("assets/fonts/OpenHuninn.woff2") + "\")");
		e.load().then(() => {
			s && (document.fonts.add(e), M && sr());
		}).catch(() => {});
	} catch {}
	Cj({
		manifestUrl: r("sound.manifest.json"),
		...i ? { baseUrl: i } : {}
	}).then((e) => {
		if (!s) {
			try {
				e.dispose();
			} catch {}
			return;
		}
		b = e, S();
	}).catch(() => {});
	let ie = {
		head: r("assets/sprites/head.webp"),
		headHappy: r("assets/sprites/head-happy.webp"),
		popcorn: r("assets/sprites/popcorn.webp"),
		pretzel: r("assets/sprites/pretzel.webp"),
		donut: r("assets/sprites/donut.webp"),
		flower: r("assets/sprites/flower.webp"),
		flagRed: r("assets/sprites/flag-red.webp"),
		flagBlue: r("assets/sprites/flag-blue.webp"),
		bush: r("assets/sprites/bush.webp"),
		grass: r("assets/sprites/grass.webp"),
		star: r("assets/sprites/star.webp"),
		ground: r("assets/tiles/ground.webp"),
		pit: r("assets/tiles/pit.webp"),
		painDizzy: r("assets/sprites/pain-dizzy.webp"),
		painSquish: r("assets/sprites/pain-squish.webp"),
		painShock: r("assets/sprites/pain-shock.webp"),
		painFlat: r("assets/sprites/pain-flat.webp")
	}, ae = [
		"painDizzy",
		"painSquish",
		"painShock",
		"painFlat"
	], R = {};
	{
		let e = Object.keys(ie), t = await xm.load(e.map((e) => ie[e]), (e) => {
			L = e, ne();
		});
		for (let n of e) R[n] = t[ie[n]];
		R.ground.source.addressMode = "repeat", R.pit.source.addressMode = "repeat";
	}
	let oe = /* @__PURE__ */ new Map(), se = ae.map((e) => R[e]), ce = [R.headHappy];
	function le(e) {
		return oe.get(e) ?? {
			ay: .88,
			h: e.height
		};
	}
	function ue(e, t) {
		let n = e[0];
		for (let r = 0; r < 12 && (n = e[Math.floor(Math.random() * e.length)], t.includes(n)); r++);
		return t.push(n), t.length > Math.min(8, e.length - 1) && t.shift(), n;
	}
	let de = [], fe = [];
	function pe() {
		let e = [
			[r("assets/sheets/pain-a.webp"), se],
			[r("assets/sheets/pain-b.webp"), se],
			[r("assets/sheets/pain-c.webp"), se],
			[r("assets/sheets/joy-a.webp"), ce],
			[r("assets/sheets/joy-b.webp"), ce]
		];
		for (let [t, n] of e) xm.load(t).then((e) => {
			let t = e.width / 4, r = e.height / 4;
			for (let i = 0; i < 4; i++) for (let a = 0; a < 4; a++) {
				let o = new J({
					source: e.source,
					frame: new qe(a * t, i * r, t, r)
				});
				oe.set(o, {
					ay: .93,
					h: r * .86
				}), n.push(o);
			}
		}).catch(() => {});
	}
	let me = R.headHappy;
	j.ticker.remove(re), ee.destroy({ children: !0 });
	let he = new Y();
	j.stage.addChild(he);
	let ge = new Y();
	he.addChild(ge);
	let _e = new C_({
		texture: R.ground,
		width: 100,
		height: 100
	});
	_e.tileScale.set(.7), ge.addChild(_e);
	let ve = new Y();
	ge.addChild(ve);
	let ye = new Y();
	ge.addChild(ye);
	let be = new C_({
		texture: R.pit,
		width: 100,
		height: 100
	});
	be.tileScale.set(.5);
	let xe = new $(), z = new $(), Se = new Y(), Ce = new Y(), we = new $(), Te = new pi(R.head);
	Te.anchor.set(.5, .88);
	let De = new Y();
	ye.addChild(be, xe, z, Se, Ce, we, Te, De), be.mask = xe;
	let B = new Y();
	ge.addChild(B);
	let Oe = new Y();
	ge.addChild(Oe);
	let ke = new Y();
	he.addChild(ke);
	let V = new Y();
	he.addChild(V);
	let Ae = new Y();
	he.addChild(Ae);
	let H = [];
	function je(e, t, n, r = 0) {
		let i = {
			t: 0,
			dur: e,
			fn: t,
			done: n,
			delay: r
		};
		return H.push(i), i;
	}
	let Me = (e) => 1 + 2.70158 * (e - 1) ** 3 + 1.70158 * (e - 1) ** 2, U = "title", Ne = 0, W = 0, Pe = 0, Fe = [], Ie = 0, Le = [], Re = /* @__PURE__ */ new Uint8Array(), ze = 0, Be = 0, Ve = null, He = 0, Ue = new $();
	ye.addChild(Ue);
	let We = !1, Ge = 0, Ke = [], Je = [], G = null, Ye = /* @__PURE__ */ new Int8Array(), Xe = /* @__PURE__ */ new Int32Array(), Ze = [], Qe = wj.findIndex((e) => e.arrows.length > 0), $e = wj.findIndex((e) => e.portals.length > 0);
	function et(e) {
		Pe = e.map.length, W = e.map[0].length, Fe = [], Ie = 0;
		for (let t = 0; t < Pe; t++) for (let n = 0; n < W; n++) {
			let r = e.map[t][n] === ".";
			Fe.push(r), r && Ie++;
		}
		Ye = new Int8Array(W * Pe).fill(-1), Xe = new Int32Array(W * Pe).fill(-1);
		for (let [t, n, r] of e.arrows) Ye[n * W + t] = r;
		for (let [t, n, r, i] of e.portals) Xe[n * W + t] = i * W + r, Xe[i * W + r] = n * W + t;
	}
	let tt = -1, nt = 1, rt = 0, it = -1, at = 0, ot = 0, st = !1, ct = !1, K = 60, lt = 0, ut = 0, dt = 12;
	function ft(e) {
		return [e % W, Math.floor(e / W)];
	}
	async function pt(e) {
		if (c) return;
		c = !0;
		let t = !1;
		try {
			t = await o();
		} catch (e) {
			console.error("[screamchick] 进关扣分失败", e), t = !1;
		}
		c = !1, s && t && mt(e);
	}
	function mt(e) {
		(e !== Ne || U !== "game" || We) && (Be = 0), Ne = e, v.last = e, y(), He = 0, et(wj[e]), ht(), U = "game", gt(), Mn(), Hn(), ye.alpha = 0, ye.scale.set(.92), je(.4, (e) => {
			ye.alpha = e;
			let t = .92 + .08 * Me(e);
			ye.scale.set(t);
		}), e === 0 ? Fn(Ij("swipeHint"), 3.2) : e === 1 ? Fn(Ij("fillHint"), 3.2) : e === 2 ? Fn(Ij("snackHint"), 3.6) : e === Qe ? Fn(Ij("arrowHint"), 3.6) : e === $e && Fn(Ij("portalHint"), 3.6);
	}
	function ht() {
		for (let e of H.splice(0)) e.delay <= 0 && (e.fn(1), e.done?.());
		let e = wj[Ne];
		Re = new Uint8Array(W * Pe);
		let t = e.start[1] * W + e.start[0];
		Le = [t], Re[t] = 1, Ln(), ze = 0, We = !1, G = null, tt = -1, Je = [], st = !1, nt = 1;
		for (let e of Ke) e.sprite.destroy({ children: !0 });
		Ke = [], e.snacks.forEach((e, t) => {
			let n = new Y(), r = [
				R.popcorn,
				R.pretzel,
				R.donut
			][(t + Ne) % 3], i = new pi(r);
			i.anchor.set(.5, .75), n.addChild(i);
			let a = new Y(), o = new $();
			o.circle(0, 0, 13).fill(h.cream).stroke({
				width: 2.5,
				color: h.ink
			});
			let s = new Hv({
				text: "",
				style: {
					fontFamily: P,
					fontSize: 16,
					fontWeight: "700",
					fill: h.ink
				}
			});
			s.anchor.set(.5), a.addChild(o, s), n.addChild(a), Ce.addChild(n), Ke.push({
				x: e[0],
				y: e[1],
				deadline: e[2],
				state: "fresh",
				sprite: n,
				tag: a,
				tagText: s,
				kind: t,
				spriteTex: r
			});
		}), St(), Pn();
	}
	function gt() {
		let e = jn + 58 + 58, t = k - 36, n = A - e - 40;
		K = Math.floor(Math.min(t / W, n / (Pe + .3), 86)), K = Math.max(K, 22), dt = K * .2;
		let r = W * K, i = Pe * K;
		lt = Math.round((k - r) / 2), ut = Math.round(e + (n - i) / 2 + K * .15), ye.pivot.set(r / 2, i / 2), ye.position.set(lt + r / 2, ut + i / 2), xt(), St(), Ct();
	}
	function _t(e, t) {
		return e >= 0 && t >= 0 && e < W && t < Pe && Fe[t * W + e];
	}
	let vt = 1;
	function yt(e) {
		vt = e >>> 0 || 1;
	}
	function bt() {
		return vt = vt * 1664525 + 1013904223 >>> 0, vt / 4294967296;
	}
	function xt() {
		xe.clear(), z.clear(), Se.removeChildren().forEach((e) => e.destroy()), be.width = W * K, be.height = Pe * K;
		for (let e = 0; e < Pe; e++) for (let t = 0; t < W; t++) _t(t, e) && xe.rect(t * K - .5, e * K - .5, K + 1, K + 1);
		xe.fill(16777215), yt(Ne * 977 + 31);
		let e = K * .3;
		for (let e = 0; e < Pe; e++) for (let t = 0; t < W; t++) {
			if (!_t(t, e)) continue;
			let n = t * K, r = e * K, i = bt();
			z.rect(n, r, K, K).fill({
				color: i < .5 ? 0 : 16777215,
				alpha: .03 + .04 * Math.abs(i - .5)
			}), z.rect(n + 2, r + 2, K - 4, K - 4).stroke({
				width: 1.5,
				color: h.pitDark,
				alpha: .35
			});
		}
		for (let e = 0; e < W * Pe; e++) {
			let t = e % W * K + K / 2, n = Math.floor(e / W) * K + K / 2;
			if (Ye[e] >= 0) {
				let [r, i] = g[Ye[e]], a = -i, o = r, s = K * .28, c = (e, c) => [
					t + r * s + e,
					n + i * s + c,
					t - r * s * .7 + a * s + e,
					n - i * s * .7 + o * s + c,
					t - r * s * .15 + e,
					n - i * s * .15 + c,
					t - r * s * .7 - a * s + e,
					n - i * s * .7 - o * s + c
				];
				z.poly(c(1.5, 3)).fill({
					color: 860992,
					alpha: .35
				}), z.poly(c(0, 0)).fill(h.cream).stroke({
					width: 2,
					color: h.creamDark
				});
			}
			if (Xe[e] >= 0) {
				let r = wj[Ne].portals.findIndex((t) => t[1] * W + t[0] === e || t[3] * W + t[2] === e) === 0 ? 11691990 : 15764028;
				z.circle(t + 1.5, n + 3, K * .36).fill({
					color: 860992,
					alpha: .3
				}), z.circle(t, n, K * .36).fill(r), z.circle(t, n, K * .26).fill(1847117), z.circle(t, n, K * .15).fill({
					color: r,
					alpha: .75
				}), z.circle(t, n, K * .06).fill(1847117);
			}
		}
		for (let t = 0; t < Pe; t++) for (let n = 0; n < W; n++) {
			if (!_t(n, t)) continue;
			let r = n * K, i = t * K;
			if (!_t(n - 1, t)) for (let e = 0; e < 4; e++) z.rect(r, i, K * .05 * (e + 1), K).fill({
				color: 860992,
				alpha: .07
			});
			if (!_t(n + 1, t)) for (let e = 0; e < 3; e++) z.rect(r + K - K * .035 * (e + 1), i, K * .035 * (e + 1), K).fill({
				color: 860992,
				alpha: .06
			});
			if (!_t(n, t - 1)) {
				for (let t = 0; t < 4; t++) z.rect(r, i + e, K, K * .06 * (t + 1)).fill({
					color: 860992,
					alpha: .08
				});
				z.rect(r, i, K, e).fill(h.card), z.rect(r, i, K, e * .22).fill({
					color: h.cardDark,
					alpha: .55
				}), z.rect(r, i + e - 2, K, 2).fill({
					color: h.cardDark,
					alpha: .6
				});
				for (let t = 0; t < 5; t++) {
					let n = r + (t + .5) * K / 5;
					z.moveTo(n, i + e * .25).lineTo(n, i + e - 2).stroke({
						width: 1,
						color: h.cardDark,
						alpha: .35
					});
				}
				_t(n - 1, t) || z.poly([
					r,
					i,
					r + K * .06,
					i + e * .2,
					r + K * .06,
					i + e,
					r,
					i + e
				]).fill({
					color: h.cardDark,
					alpha: .45
				}), _t(n + 1, t) || z.poly([
					r + K,
					i,
					r + K - K * .06,
					i + e * .2,
					r + K - K * .06,
					i + e,
					r + K,
					i + e
				]).fill({
					color: h.cardDark,
					alpha: .35
				});
			}
		}
		for (let e = 0; e < Pe; e++) for (let t = 0; t < W; t++) {
			if (!_t(t, e)) continue;
			let n = t * K, r = e * K, i = Math.max(2, K * .045);
			_t(t, e - 1) || z.rect(n - 1, r - i, K + 2, i).fill({ color: h.cardLight }), _t(t, e + 1) || (z.rect(n - 1, r + K - 1, K + 2, i).fill({ color: 16774082 }), z.rect(n, r + K - 3, K, 3).fill({
				color: 860992,
				alpha: .25
			})), _t(t - 1, e) || z.rect(n - i, r, i, K).fill({
				color: 16774082,
				alpha: .9
			}), _t(t + 1, e) || z.rect(n + K, r, i, K).fill({
				color: h.cardLight,
				alpha: .9
			});
		}
		for (let e = 0; e < Pe; e++) for (let t = 0; t < W; t++) {
			if (_t(t, e)) continue;
			let n = 0;
			for (let [r, i] of g) _t(t + r, e + i) && n++;
			if (n >= 3 && bt() < .5) {
				let n = new pi(R.grass);
				n.anchor.set(.5, .85), n.width = K * .45, n.scale.y = n.scale.x, n.position.set(t * K + K * (.35 + bt() * .3), e * K + K * .6), Se.addChild(n);
			}
		}
	}
	function St() {
		for (let e of Ke) {
			e.sprite.position.set(e.x * K + K / 2, e.y * K + K * .72);
			let t = e.sprite.children[0], n = K * .66, r = t.texture.width, i = t.texture.height;
			t.scale.set(n / Math.max(r, i)), e.tag.position.set(K * .3, -K * .5), e.tag.scale.set(Math.max(.65, Math.min(1, K / 64))), e.tagText.style.fontFamily = P, e.tagText.text = String(Math.max(0, e.deadline - ze)), e.tag.visible = e.state === "fresh";
		}
	}
	function Ct() {
		ve.removeChildren().forEach((e) => e.destroy()), B.removeChildren().forEach((e) => e.destroy()), yt(Ne * 131 + 7);
		let e = lt - 16, t = ut - 24, n = lt + W * K + 16, r = ut + Pe * K + 16, i = (e, t, n, r, i = !1, a = !1) => {
			let o = new pi(e);
			o.anchor.set(.5, .9);
			let s = t / e.height;
			o.scale.set(a ? -s : s, s), o.position.set(n, r), (i ? B : ve).addChild(o);
			let c = e === R.bush ? "bush" : e === R.grass ? "grass" : e === R.flagRed || e === R.flagBlue ? "flag" : "flower";
			return wt.push({
				s: o,
				kind: c,
				sx: o.scale.x,
				sy: s,
				phase: bt() * 6.28,
				ang: 0,
				vel: 0,
				pop: 0,
				h: t
			}), o;
		};
		wt = [];
		let a = Math.min(150, Math.max(70, k * .22));
		i(R.bush, a, a * .55, A + a * .35, !0), i(R.bush, a * .85, k - a * .2, a * .55, !0, !0);
		let o = [
			R.flower,
			R.grass,
			R.flower,
			R.grass,
			R.flagRed,
			R.flagBlue,
			R.grass,
			R.flower
		], s = [], c = 0, l = 0, u = Math.round(Math.max(8, k * A / 26e3));
		for (; l < u && c < 400;) {
			c++;
			let a = 20 + bt() * (k - 40), u = 120 + bt() * (A - 150);
			if (a > e - 10 && a < n + 10 && u > t && u < r + 40 || u > A - 120 && Math.abs(a - k / 2) < 140 || s.some(([e, t]) => Math.hypot(e - a, t - u) < 70)) continue;
			s.push([a, u]);
			let d = o[l % o.length];
			i(d, (d === R.grass ? 26 : d === R.flower ? 48 : 64) * (.85 + bt() * .3), a, u, !1, bt() < .3 && d !== R.flagRed && d !== R.flagBlue), l++;
		}
		let d = Math.min(10, W + Pe);
		for (let a = 0; a < d; a++) {
			let o = a % 4, s = bt(), c = 0, l = 0;
			o === 0 ? (c = e + s * (n - e), l = t + 6) : o === 1 ? (c = e + s * (n - e), l = r + 18) : o === 2 ? (c = e - 4, l = t + 30 + s * (r - t - 30)) : (c = n + 4, l = t + 30 + s * (r - t - 30)), !(l < 110 || l > A - 10) && i(R.grass, 22 * (.8 + bt() * .4), c, l, o === 1, bt() < .5);
		}
		Pt();
	}
	let wt = [], Tt = [], Et = 0, Dt = 0, Ot = 2, kt = [], At = [], jt = 0, Mt = [], Nt = new Y();
	function Pt() {
		for (let e of kt) e.g.destroy({ children: !0 });
		for (let e of At) e.g.destroy();
		for (let e of Mt) e.g.destroy();
		kt = [], At = [], Mt = [], Nt.parent !== Oe && Oe.addChild(Nt);
		for (let e = 0; e < 2; e++) {
			let t = new $(), n = Math.max(k, 360) * (.55 + e * .2);
			t.ellipse(0, 0, n * .5, n * .16).fill({
				color: 4864528,
				alpha: .05
			}), t.ellipse(n * .18, -n * .05, n * .3, n * .12).fill({
				color: 4864528,
				alpha: .04
			}), t.ellipse(-n * .22, n * .03, n * .26, n * .1).fill({
				color: 4864528,
				alpha: .04
			}), Nt.addChild(t), Mt.push({
				g: t,
				x: bt() * k,
				y: A * (.25 + e * .45),
				sp: 9 + e * 5,
				w: n
			});
		}
		let e = [
			[15895218, 14177407],
			[8308976, 4165590],
			[16765530, 14721322]
		], t = k * A > 5e5 ? 3 : 2;
		for (let n = 0; n < t; n++) {
			let [t, r] = e[n % e.length], i = new Y(), a = (e) => {
				let n = new $();
				return n.ellipse(e * 11 * .55, -2.75, 6.6, 11 * .48).fill(t).stroke({
					width: 1.2,
					color: r
				}), n.ellipse(e * 11 * .42, 4.18, 4.4, 3.52).fill(r), n.circle(e * 11 * .6, -3.3, 1.54).fill({
					color: 16777215,
					alpha: .8
				}), n;
			}, o = a(-1), s = a(1), c = new $();
			c.roundRect(-1.6, -11 * .55, 3.2, 11 * 1.15, 1.6).fill(3811866), c.moveTo(0, -5.5).lineTo(-3, -10.45).moveTo(0, -5.5).lineTo(3, -10.45).stroke({
				width: 1,
				color: 3811866
			}), i.addChild(o, s, c);
			let l = new $();
			l.ellipse(0, 26, 7, 2.5).fill({
				color: 0,
				alpha: .12
			}), i.addChildAt(l, 0), Oe.addChild(i);
			let u = bt() * k, d = 130 + bt() * (A - 200);
			kt.push({
				g: i,
				wl: o,
				wr: s,
				x: u,
				y: d,
				tx: u,
				ty: d,
				sp: 45 + bt() * 25,
				phase: bt() * 6,
				rest: 0
			});
		}
	}
	function Ft(e, t, n, r = 0) {
		for (let i of wt) {
			let a = i.s.x - e, o = i.s.y - t, s = Math.hypot(a, o), c = Math.max(0, 1 - s / (Math.max(k, A) * .9));
			if (c <= 0) continue;
			let l = a >= 0 ? 1 : -1;
			Tt.push({
				at: lr + s / 700,
				deco: i,
				amt: l * n * (.4 + .6 * c),
				pop: r * c
			});
		}
		for (let r of kt) if (Math.hypot(r.x - e, r.y - t) < 220 * (.5 + n)) {
			r.rest = 0;
			let n = Math.atan2(r.y - t, r.x - e);
			r.tx = It(r.x + Math.cos(n) * 160), r.ty = Lt(r.y + Math.sin(n) * 160), r.sp = 140;
		}
	}
	function It(e) {
		return Math.max(20, Math.min(k - 20, e));
	}
	function Lt(e) {
		return Math.max(110, Math.min(A - 30, e));
	}
	function Rt(e, t) {
		let n = ye.toGlobal(new Ee(e, t));
		return ge.toLocal(n);
	}
	function zt(e, t, n = !1) {
		let r = new $(), i = [
			16777215,
			16774084,
			16234184,
			16769162
		][Math.floor(Math.random() * 4)];
		r.ellipse(0, 0, 5, 2.6).fill(i).stroke({
			width: .8,
			color: 14270602,
			alpha: .6
		}), r.position.set(e, t), Oe.addChild(r);
		let a = n ? Math.random() * Math.PI * 2 : 0, o = n ? 60 + Math.random() * 90 : 0;
		At.push({
			g: r,
			x: e,
			y: t,
			vx: n ? Math.cos(a) * o : 12 + Math.random() * 14,
			vy: n ? Math.sin(a) * o - 60 : 14 + Math.random() * 10,
			rot: Math.random() * 6,
			vr: (Math.random() - .5) * 4,
			flip: Math.random() * 6,
			life: n ? 1.6 : 9
		});
	}
	function Bt(e) {
		Ot -= e, Ot <= 0 && (Ot = 2.5 + Math.random() * 4, Dt = (Math.random() - .35) * .9), Et += (Dt - Et) * Math.min(1, e * .8), Tt.length && (Tt = Tt.filter((e) => lr < e.at || (e.deco.s.destroyed || (e.deco.vel += e.amt * 9, e.deco.pop = Math.max(e.deco.pop, e.pop)), !1)));
		for (let t of wt) {
			if (t.s.destroyed) continue;
			t.vel += (-t.ang * 60 - t.vel * 7) * e, t.ang += t.vel * e, t.pop = Math.max(0, t.pop - e * 2.2);
			let n = lr + t.phase, r = 1 + Math.sin(t.pop * Math.PI) * .18 * Math.min(1, t.pop * 3);
			if (t.kind === "flower") t.s.rotation = Math.sin(n * 1.7) * .07 + Et * .12 + t.ang, t.s.scale.set(t.sx * r, t.sy * r * (1 + Math.sin(n * 2.3) * .02));
			else if (t.kind === "grass") t.s.rotation = 0, t.s.skew.x = Math.sin(n * 2.4) * .12 + Et * .25 + t.ang * 1.4, t.s.scale.set(t.sx * r, t.sy * r * (1 + Math.sin(n * 3.1) * .04));
			else if (t.kind === "flag") {
				let e = Math.sin(n * 7) * .06 + Math.sin(n * 11.3) * .03;
				t.s.skew.y = Math.sin(n * 6.2) * .06 + Et * .05, t.s.scale.set(t.sx * (1 + e + Math.abs(Et) * .04) * r, t.sy * r), t.s.rotation = t.ang * .6 + Et * .03;
			} else {
				t.s.rotation = t.ang * .25;
				let e = Math.sin(n * 1.3) * .025;
				t.s.scale.set(t.sx * (1 + e) * r, t.sy * (1 - e * .6) * r);
			}
		}
		for (let t of Mt) t.x += t.sp * e, t.x - t.w * .6 > k && (t.x = -t.w * .6), t.g.position.set(t.x, t.y);
		for (let t of kt) {
			let n = t.tx - t.x, r = t.ty - t.y, i = Math.hypot(n, r), a;
			if (t.rest > 0) t.rest -= e, a = .55 + .35 * Math.sin(lr * 2.5 + t.phase), t.rest <= 0 && (t.tx = It(t.x + (Math.random() - .5) * 300), t.ty = Lt(t.y + (Math.random() - .5) * 260), t.sp = 45 + Math.random() * 25);
			else if (i < 6) {
				let e = wt.filter((e) => e.kind === "flower" && !e.s.destroyed);
				if (e.length && Math.random() < .45) {
					let n = e[Math.floor(Math.random() * e.length)];
					t.tx = n.s.x, t.ty = n.s.y - n.h * .7, Math.hypot(t.tx - t.x, t.ty - t.y) < 8 && (t.rest = 2 + Math.random() * 3);
				} else t.tx = It(t.x + (Math.random() - .5) * 320), t.ty = Lt(t.y + (Math.random() - .5) * 260);
				t.sp = 45 + Math.random() * 25, a = Math.abs(Math.sin(lr * 18 + t.phase));
			} else {
				let o = Math.min(i, t.sp * e);
				t.x += n / i * o, t.y += r / i * o + Math.sin(lr * 6 + t.phase) * 18 * e, t.g.rotation = Math.max(-.5, Math.min(.5, n / i * .4)), a = Math.abs(Math.sin(lr * (t.sp > 100 ? 30 : 18) + t.phase)), t.sp += (55 - t.sp) * e;
			}
			t.wl.scale.x = .25 + .75 * a, t.wr.scale.x = .25 + .75 * a;
			let o = t.rest > 0 ? 0 : Math.sin(lr * 9 + t.phase) * 2;
			t.g.position.set(t.x, t.y + o), t.g.children[0].y = t.rest > 0 ? -18 : -o;
		}
		if (jt -= e, jt <= 0 && At.length < 10) {
			jt = 1.2 + Math.random() * 1.8;
			let e = wt.filter((e) => e.kind === "flower" && !e.s.destroyed);
			if (e.length) {
				let t = e[Math.floor(Math.random() * e.length)];
				zt(t.s.x, t.s.y - t.h * .6);
			}
		}
		At = At.filter((t) => (t.life -= e, t.vx += (Et * 40 + 10 - t.vx) * e * .8, t.vy += (16 - t.vy) * e * 1.5, t.x += (t.vx + Math.sin(lr * 2 + t.rot) * 14) * e, t.y += t.vy * e, t.rot += t.vr * e, t.flip += e * 5, t.g.position.set(t.x, t.y), t.g.rotation = t.rot, t.g.scale.y = Math.abs(Math.sin(t.flip)) * .8 + .2, t.g.alpha = Math.min(1, t.life * 1.5), t.life <= 0 || t.x > k + 20 || t.y > A + 20 ? (t.g.destroy(), !1) : !0));
	}
	function Vt(e, t) {
		let n = ge.toLocal(new Ee(e, t)), r = null, i = 1e9;
		for (let e of wt) {
			if (e.s.destroyed) continue;
			let t = e.s.x, a = e.s.y - e.h * .45, o = Math.hypot(n.x - t, n.y - a);
			o < Math.max(32, e.h * .6) && o < i && (i = o, r = e);
		}
		for (let e of kt) if (Math.hypot(n.x - e.x, n.y - e.y) < 40) return e.rest = 0, e.tx = It(e.x + (Math.random() - .5) * 360), e.ty = Lt(e.y - 120), e.sp = 160, !0;
		if (!r) return !1;
		if (r.vel += (n.x < r.s.x ? 1 : -1) * 7, r.pop = 1, r.kind === "flower") for (let e = 0; e < 6; e++) zt(r.s.x, r.s.y - r.h * .6, !0);
		return E("ui.click", 6 + Math.random() * 4), !0;
	}
	function Ht(e) {
		let t = Le[Le.length - 1], [n, r] = ft(t), i = e, a = [], o = [], s = /* @__PURE__ */ new Set();
		for (;;) {
			let e = n + g[i][0], t = r + g[i][1], c = t * W + e;
			if (!_t(e, t) || Re[c] || s.has(c)) break;
			n = e, r = t, a.push(c), o.push(i), s.add(c);
			let l = Xe[c];
			l >= 0 && !Re[l] && !s.has(l) ? (a.push(l), o.push(-1), s.add(l), n = l % W, r = Math.floor(l / W)) : Ye[c] >= 0 && (i = Ye[c]);
		}
		return Ze = o, a;
	}
	function Ut() {
		for (let e = 0; e < 4; e++) if (Ht(e).length) return !0;
		return !1;
	}
	function Wt(e) {
		if (U !== "game" || We || ct || Cn) return;
		if (G) {
			tt = e;
			return;
		}
		let t = Ht(e);
		if (e === 0 ? nt = 1 : e === 1 && (nt = -1), !t.length) {
			rt = 1, it = e, at = 0, E("move.bump", -2), Jt(e, .3);
			return;
		}
		He = 0, Je.push({
			len: Le.length,
			slides: ze,
			snackStates: Ke.map((e) => e.state)
		}), G = {
			cells: t,
			dirs: Ze.slice(),
			jump: !1,
			t: 0,
			dir: e,
			speed: Math.max(14, Math.min(26, 10 + t.length * 2))
		}, E("move.slide", Math.min(5, t.length * .5));
	}
	function q() {
		if (!G) return;
		let e = G;
		G = null, ze++, rt = 1, it = e.dir, at = 0, ot = Math.min(6, 2 + e.cells.length * .6), E("move.bump"), Jt(e.dir, Math.min(1, e.cells.length / 5));
		for (let e of Ke) e.state === "fresh" && ze >= e.deadline && qt(e);
		if (St(), Pn(), Le.length === Ie) {
			Zt();
			return;
		}
		if (Ut() || (st = !0, In()), tt >= 0) {
			let e = tt;
			tt = -1, Wt(e);
		}
	}
	function Gt(e) {
		if (G) {
			for (G.t += e * G.speed; G && Le.length - Je[Je.length - 1].len < Math.floor(G.t) && Le.length - Je[Je.length - 1].len < G.cells.length;) {
				let e = Le.length - Je[Je.length - 1].len, t = G.cells[e];
				Le.push(t), Re[t] = 1;
				let [n, r] = ft(t);
				for (let e of Ke) e.state === "fresh" && e.x === n && e.y === r && Kt(e);
				if (G.dirs[e] < 0 && ($t(n * K + K / 2, r * K + K / 2, 8, [
					11691990,
					15764028,
					16777215
				]), E("move.slide", 8)), e + 1 < G.cells.length) {
					let t = G.dirs[e + 1];
					G.jump = t < 0, t >= 0 && (G.dir = t, t === 0 ? nt = 1 : t === 1 && (nt = -1));
				} else G.jump = !1;
			}
			G && G.t >= G.cells.length && (G.t = G.cells.length, q());
		}
	}
	function Kt(e) {
		e.state = "eaten", E("snack.eat", 2 + e.kind), e.tag.visible = !1;
		let t = e.sprite;
		$t(e.x * K + K / 2, e.y * K + K / 2, 10, [
			16777215,
			15909198,
			h.red,
			11887901
		]), e.tw = je(.35, (n) => {
			t.scale.set(1 + n * .6), t.alpha = 1 - n, t.y = e.y * K + K * .72 - n * K * .6;
		}), Pn();
	}
	function qt(e) {
		e.state = "spoiled", e.tag.visible = !1;
		let t = e.sprite, n = t.x, r = t.y;
		e.tw = je(.6, (e) => {
			t.alpha = 1 - e, t.rotation = e * 1.2, t.x = n + e * K * .8, t.y = r - e * K * 1.4, t.scale.set(1 - e * .5);
		});
	}
	function Jt(e, t) {
		Ve = ue(se, de), He = .6 + .5 * t;
		let [n, r] = ft(Le[Le.length - 1]), i = n * K + K / 2 + g[e][0] * K * .55, a = r * K + K / 2 + g[e][1] * K * .55 - dt;
		$t(i, a, 5 + Math.round(t * 5), [
			h.cardLight,
			h.yellowLight,
			16777215
		]);
		{
			let e = Rt(i, a);
			Ft(e.x, e.y, .35 + t * .65);
		}
		let o = new $(), s = K * .18, c = K * (.45 + .25 * t), l = [];
		for (let e = 0; e < 18; e++) {
			let t = e / 18 * Math.PI * 2, n = e % 2 ? s : c;
			l.push(Math.cos(t) * n, Math.sin(t) * n);
		}
		o.poly(l).fill(16774048).stroke({
			width: 3,
			color: h.red
		}), o.position.set(i, a), o.rotation = Math.random(), De.addChild(o), je(.35, (e) => {
			o.scale.set(.4 + e * .9), o.alpha = 1 - e;
		}, () => o.destroy());
	}
	function Yt() {
		U === "game" && (Be++, He = 0, ht(), E("move.undo", -3), ye.scale.set(.96), je(.25, (e) => ye.scale.set(.96 + .04 * Me(e))));
	}
	function Xt() {
		let e = Ke.every((e) => e.state === "eaten");
		return {
			clear: We,
			snack: e,
			perfect: Be === 0
		};
	}
	function Zt() {
		We = !0, Ge = 0, E("level.win"), E("chicken.squawk", 5), me = ue(ce, fe), Te.texture = me;
		let e = Xt(), t = 1 + +!!e.snack + +!!e.perfect;
		v.stars[Ne] = Math.max(v.stars[Ne] || 0, t), v.unlocked = Math.max(v.unlocked, Math.min(wj.length, Ne + 2)), y(), Pn(), He = 0, Ln();
		for (let e = 0; e < 4; e++) f(() => $t(Math.random() * W * K, Math.random() * Pe * K, 12, [
			h.red,
			4165590,
			h.yellow,
			16777215,
			h.green
		]), e * 150);
		f(() => Bn(70), 900), f(() => {
			let e = Rt(W * K / 2, Pe * K / 2);
			Ft(e.x, e.y, 1.1, 1);
			for (let e of wt) if (e.kind === "flower" && !e.s.destroyed) for (let t = 0; t < 3; t++) zt(e.s.x, e.s.y - e.h * .6, !0);
		}, 950), f(() => or(e), 1100);
	}
	let Qt = [];
	function $t(e, t, n, r) {
		for (let i = 0; i < n; i++) {
			let n = new $(), a = K * (.06 + Math.random() * .08);
			n.rect(-a, -a * .6, a * 2, a * 1.2).fill(r[i % r.length]), n.position.set(e, t), n.rotation = Math.random() * 6, De.addChild(n);
			let o = Math.random() * Math.PI * 2, s = K * (1.5 + Math.random() * 3);
			Qt.push({
				g: n,
				vx: Math.cos(o) * s,
				vy: Math.sin(o) * s - K * 2,
				life: 0,
				max: .6 + Math.random() * .4,
				vr: (Math.random() - .5) * 12
			});
		}
	}
	function en(e) {
		Qt = Qt.filter((t) => (t.life += e, t.life >= t.max ? (t.g.destroy(), !1) : (t.vy += K * 9 * e, t.vx *= .97, t.g.x += t.vx * e, t.g.y += t.vy * e, t.g.rotation += t.vr * e, t.g.alpha = 1 - t.life / t.max, !0)));
	}
	function tn(e) {
		we.clear();
		let t = Le.length, n, r, [i, a] = ft(Le[t - 1]);
		n = i, r = a;
		let o = 0;
		if (G) {
			let e = t - Je[Je.length - 1].len;
			o = G.jump ? 0 : Math.max(0, Math.min(1, G.t - e)), n = i + g[G.dir][0] * o, r = a + g[G.dir][1] * o;
		}
		let s = [], c = /* @__PURE__ */ new Map();
		Le.forEach((e, t) => c.set(e, t));
		for (let e = 0; e < t; e++) {
			let [n, r] = ft(Le[e]), i = [
				!1,
				!1,
				!1,
				!1
			];
			for (let a of [e - 1, e + 1]) {
				if (a < 0 || a >= t) continue;
				let [e, o] = ft(Le[a]);
				for (let t = 0; t < 4; t++) n + g[t][0] === e && r + g[t][1] === o && (i[t] = !0);
			}
			e === t - 1 && G && o > 0 && (i[G.dir] = !0), s.push({
				x: n,
				y: r,
				conn: i,
				idx: e
			});
		}
		let l = s.slice().sort((e, t) => e.y - t.y || e.x - t.x), u = K * .07;
		for (let e of l) {
			let n = 0;
			if (We) {
				let t = Ge * 14 - e.idx * .6;
				t > 0 && t < Math.PI && (n = Math.sin(t) * K * .18);
			}
			let r = e.x * K + u, i = (e.x + 1) * K - u, a = e.y * K + u, s = (e.y + 1) * K - u;
			if (e.conn[1] && (r = e.x * K), e.conn[0] && (i = (e.x + 1) * K), e.conn[3] && (a = e.y * K), e.conn[2] && (s = (e.y + 1) * K), e.idx === t - 1 && G && o > 0) {
				let t = g[G.dir];
				t[0] > 0 && (i = (e.x + 1) * K + o * K - u), t[0] < 0 && (r = e.x * K - o * K + u), t[1] > 0 && (s = (e.y + 1) * K + o * K - u), t[1] < 0 && (a = e.y * K - o * K + u);
			}
			nn(r, a - dt - n, i, s - dt - n, e, n);
		}
		let d = We ? Math.abs(Math.sin(Ge * 8)) * K * .25 : 0;
		Te.position.set(n * K + K / 2, (r + 1) * K - u - dt * .4 - d);
		let f = rt, p = le(Te.texture);
		Te.anchor.set(.5, p.ay);
		let m = K * (We ? 1.42 : 1.53) / p.h;
		if (Ue.clear(), He > 0 && !We) {
			let t = Te.x, n = Te.y - K * 1.45, r = Math.min(1, He * 3);
			for (let i = 0; i < 3; i++) {
				let a = e * 7 + i * Math.PI * 2 / 3, o = t + Math.cos(a) * K * .42, s = n + Math.sin(a) * K * .14, c = K * .09 * (.8 + .3 * Math.sin(a)), l = [];
				for (let e = 0; e < 10; e++) {
					let t = e / 10 * Math.PI * 2 - Math.PI / 2, n = e % 2 ? c * .45 : c;
					l.push(o + Math.cos(t) * n, s + Math.sin(t) * n);
				}
				Ue.poly(l).fill({
					color: h.yellow,
					alpha: r
				}).stroke({
					width: 1.5,
					color: h.yellowDeep,
					alpha: r
				});
			}
		}
		let _ = 1, v = 1;
		if (f > 0) {
			let e = Math.sin(at * 30) * f;
			it === 0 || it === 1 ? (_ = 1 - .18 * e, v = 1 + .12 * e) : (v = 1 - .18 * e, _ = 1 + .12 * e);
		}
		G && (G.dir <= 1 ? (_ *= 1.08, v *= .92) : (v *= 1.08, _ *= .92));
		let y = We ? 0 : Math.sin(e * 3) * .02;
		Te.scale.set(m * _ * nt, m * v * (1 + y));
	}
	function nn(e, t, n, r, i, a) {
		let o = we, s = n - e, c = r - t, l = Math.min(K * .1, s / 3, c / 3);
		o.rect(e + 2, r + dt + a - 2, s, K * .08).fill({
			color: 860992,
			alpha: .25
		}), o.roundRect(e, t + dt * .3, s, c + dt * .7 + a, l).fill(h.yellowDark), o.rect(e, r + dt * .4 + a, s, dt * .6 - 1).fill({
			color: h.yellowDeep,
			alpha: .5
		}), o.roundRect(e, t, s, c, l).fill(h.yellow);
		let u = (i.conn[0] || i.conn[1]) && !(i.conn[2] || i.conn[3]), d = (i.conn[2] || i.conn[3]) && !(i.conn[0] || i.conn[1]);
		if (u) {
			let n = s / 3;
			for (let i = 0; i < 3; i++) {
				let s = e + i * n;
				o.poly([
					s,
					t,
					s + n * .5,
					t + c * .5,
					s,
					r
				]).fill({
					color: h.yellowLight,
					alpha: .75
				}), o.poly([
					s + n * .5,
					t + c * .5,
					s + n,
					t,
					s + n,
					r
				]).fill({
					color: h.yellowDark,
					alpha: .35
				}), o.moveTo(s + n, r).lineTo(s + n, r + dt * .7 + a).stroke({
					width: 1.2,
					color: h.yellowDeep,
					alpha: .6
				});
			}
		} else if (d) {
			let r = c / 3;
			for (let i = 0; i < 3; i++) {
				let a = t + i * r;
				o.poly([
					e,
					a,
					e + s * .5,
					a + r * .5,
					n,
					a
				]).fill({
					color: h.yellowLight,
					alpha: .75
				}), o.poly([
					e,
					a + r,
					e + s * .5,
					a + r * .5,
					n,
					a + r
				]).fill({
					color: h.yellowDark,
					alpha: .3
				});
			}
		} else {
			let i = (e + n) / 2, a = (t + r) / 2;
			o.poly([
				e,
				t,
				n,
				t,
				i,
				a
			]).fill({
				color: h.yellowLight,
				alpha: .7
			}), o.poly([
				e,
				t,
				e,
				r,
				i,
				a
			]).fill({
				color: h.yellowLight,
				alpha: .35
			}), o.poly([
				n,
				t,
				n,
				r,
				i,
				a
			]).fill({
				color: h.yellowDark,
				alpha: .25
			}), o.poly([
				e,
				r,
				n,
				r,
				i,
				a
			]).fill({
				color: h.yellowDark,
				alpha: .35
			});
		}
		o.rect(e + l * .5, t, s - l, 2).fill({
			color: 16777215,
			alpha: .35
		});
	}
	function rn(e, t) {
		let n = Math.round((e >> 16 & 255) * t), r = Math.round((e >> 8 & 255) * t), i = Math.round((e & 255) * t);
		return Math.min(255, n) << 16 | Math.min(255, r) << 8 | Math.min(255, i);
	}
	function an(e, t, n = h.ink, r = "700", i) {
		let a = {
			fontFamily: P,
			fontSize: t,
			fontWeight: r,
			fill: n,
			align: "center"
		};
		i && (a.stroke = {
			color: i.color,
			width: i.width,
			join: "round"
		});
		let o = new Hv({
			text: e,
			style: a
		});
		return o.anchor.set(.5), o;
	}
	function on(e, t) {
		e.width > t && e.scale.set(t / e.width * e.scale.x);
	}
	function sn(e, t, n, r, i, a, o, s, c = 2) {
		let l = (t, n, r, i) => {
			let a = Math.hypot(r - t, i - n), o = (r - t) / a, s = (i - n) / a;
			for (let r = 0; r < a; r += 13) {
				let i = Math.min(a, r + 7);
				e.moveTo(t + o * r, n + s * r).lineTo(t + o * i, n + s * i);
			}
		};
		l(t + a, n, t + r - a, n), l(t + a, n + i, t + r - a, n + i), l(t, n + a, t, n + i - a), l(t + r, n + a, t + r, n + i - a), e.stroke({
			width: c,
			color: o,
			alpha: s,
			cap: "round"
		});
	}
	function cn(e, t, n, r, i) {
		let a = new $(), o = [];
		for (let e = 0; e <= 4; e++) o.push(-r / 2 + (e % 2 ? 4 : 0), -10 + e * 20 / 4);
		for (let e = 4; e >= 0; e--) o.push(r / 2 - (e % 2 ? 4 : 0), -10 + e * 20 / 4);
		a.poly(o).fill({
			color: 15984320,
			alpha: .82
		}), a.rect(-r / 2 + 4, -7, r - 8, 3).fill({
			color: 16777215,
			alpha: .35
		}), a.position.set(t, n), a.rotation = i, e.addChild(a);
	}
	function ln(e, t, n, r) {
		let i = new Y(), a = n.fill ?? h.cream, o = n.depth ?? Math.max(5, Math.min(9, t * .1)), s = n.radius ?? Math.min(18, Math.min(e, t) * .3), c = new $();
		c.roundRect(-e / 2 + 2, -t / 2 + o + 4, e, t, s).fill({
			color: 4864536,
			alpha: .22
		}), c.roundRect(-e / 2, -t / 2 + o, e, t, s).fill(rn(a, .72)), i.addChild(c);
		let l = new Y(), u = new $();
		u.roundRect(-e / 2, -t / 2, e, t, s).fill(a), u.roundRect(-e / 2 + 4, -t / 2 + 3, e - 8, t * .32, s * .7).fill({
			color: 16777215,
			alpha: .22
		}), sn(u, -e / 2 + 6, -t / 2 + 6, e - 12, t - 12, Math.max(4, s - 4), rn(a, .6), .45, 1.6), l.addChild(u);
		let d = n.iconColor ?? h.ink, f = Math.min(e, t), p = (e) => {
			if (n.iconTex) {
				let t = new pi(n.iconTex);
				return t.anchor.set(.5), t.scale.set(e * .52 / n.iconTex.height), t;
			}
			let t = new $();
			return n.icon(t, e, d), t;
		};
		if ((n.icon || n.iconTex) && n.label) {
			let t = an(n.label, n.fontSize ?? 24, n.textColor ?? h.ink, "800"), r = p(f * .8), i = f * .42;
			on(t, e - i - 36);
			let a = i + 8 + t.width;
			r.x = -a / 2 + i / 2, t.x = -a / 2 + i + 8 + t.width / 2, l.addChild(r, t);
		} else if (n.icon || n.iconTex) l.addChild(p(f));
		else if (n.label) {
			let t = an(n.label, n.fontSize ?? 24, n.textColor ?? h.ink, "800");
			on(t, e - 22), l.addChild(t);
		}
		i.addChild(l), i.face = l, i.eventMode = "static", i.cursor = "pointer", i.hitArea = new qe(-e / 2, -t / 2, e, t + o);
		let m = () => {
			l.y = 0;
		};
		return i.on("pointerdown", () => {
			l.y = o * .75;
		}), i.on("pointerupoutside", m), i.on("pointerleave", m), i.on("pointerup", () => {
			m(), E("ui.click"), r();
		}), i;
	}
	let un = (e, t, n) => {
		let r = t * .15, i = t * .22, a = t * .05;
		for (let t = 0; t < 8; t++) {
			let o = t / 8 * Math.PI * 2, s = Math.cos(o), c = Math.sin(o);
			e.poly([
				s * r * .7 - c * a,
				c * r * .7 + s * a,
				s * i - c * a * .75,
				c * i + s * a * .75,
				s * i + c * a * .75,
				c * i - s * a * .75,
				s * r * .7 + c * a,
				c * r * .7 - s * a
			]).fill(n);
		}
		e.circle(0, 0, r).fill(n), e.circle(0, 0, r * .45).fill(h.cream);
	}, dn = (e, t, n) => {
		let r = t * .18;
		e.arc(0, 0, r, -Math.PI * .3, Math.PI * 1.45).stroke({
			width: t * .085,
			color: n,
			cap: "round"
		});
		let i = -Math.PI * .3, a = Math.cos(i) * r, o = Math.sin(i) * r;
		e.poly([
			a - t * .03,
			o - t * .13,
			a + t * .13,
			o + t * .02,
			a - t * .08,
			o + t * .07
		]).fill(n);
	}, fn = (e, t, n) => {
		e.poly([
			-t * .1,
			-t * .18,
			t * .18,
			0,
			-t * .1,
			t * .18
		]).fill(n);
	}, pn = (e, t, n) => {
		let r = t * .1, i = t * .035;
		for (let t = 0; t < 2; t++) for (let a = 0; a < 2; a++) e.roundRect(-r - i / 2 + t * (r + i), -r - i / 2 + a * (r + i), r, r, 2).fill(n);
	}, mn = (e, t, n) => {
		e.poly([
			0,
			-t * .2,
			t * .2,
			-t * .02,
			-t * .2,
			-t * .02
		]).fill(n), e.rect(-t * .14, -t * .03, t * .28, t * .2).fill(n), e.rect(-t * .04, t * .06, t * .08, t * .11).fill(16777215);
	}, hn = (e) => (t, n, r) => {
		t.rect(-n * .02, -n * .18, n * .05, n * .28).fill(r), t.poly([
			n * .03,
			-n * .18,
			n * .16,
			-n * .12,
			n * .16,
			-n * .05,
			n * .03,
			-n * .1
		]).fill(r), t.ellipse(-n * .07, n * .11, n * .09, n * .07).fill(r), e || t.moveTo(-n * .2, -n * .2).lineTo(n * .2, n * .2).stroke({
			width: n * .06,
			color: h.red,
			cap: "round"
		});
	}, gn = (e) => (t, n, r) => {
		t.poly([
			-n * .18,
			-n * .07,
			-n * .08,
			-n * .07,
			n * .04,
			-n * .18,
			n * .04,
			n * .18,
			-n * .08,
			n * .07,
			-n * .18,
			n * .07
		]).fill(r), e ? (t.arc(n * .06, 0, n * .1, -.9, .9).stroke({
			width: n * .045,
			color: r,
			cap: "round"
		}), t.arc(n * .06, 0, n * .18, -.9, .9).stroke({
			width: n * .045,
			color: r,
			cap: "round"
		})) : t.moveTo(-n * .2, -n * .2).lineTo(n * .2, n * .2).stroke({
			width: n * .06,
			color: h.red,
			cap: "round"
		});
	}, _n = (e, t, n) => {
		e.moveTo(t * .14, 0).lineTo(-t * .1, 0).stroke({
			width: t * .08,
			color: n,
			cap: "round"
		}), e.poly([
			-t * .2,
			0,
			-t * .04,
			-t * .14,
			-t * .04,
			t * .14
		]).fill(n);
	};
	function vn(e, t, n, r, i, a = h.red, o = 30) {
		let s = new Y(), c = new $(), l = o * 1.75, u = l * .75, d = l * .28, f = rn(a, .62);
		c.poly([
			-i / 2 - u,
			d,
			-i / 2 + 6,
			d,
			-i / 2 + 6,
			l + d,
			-i / 2 - u,
			l + d,
			-i / 2 - u + l * .32,
			d + l / 2
		]).fill(rn(a, .82)), c.poly([
			i / 2 + u,
			d,
			i / 2 - 6,
			d,
			i / 2 - 6,
			l + d,
			i / 2 + u,
			l + d,
			i / 2 + u - l * .32,
			d + l / 2
		]).fill(rn(a, .82)), c.poly([
			-i / 2 + 6,
			l,
			-i / 2 + 6 + u * .45,
			l + d,
			-i / 2 + 6,
			l + d
		]).fill(f), c.poly([
			i / 2 - 6,
			l,
			i / 2 - 6 - u * .45,
			l + d,
			i / 2 - 6,
			l + d
		]).fill(f), c.rect(-i / 2 + 3, 5, i, l).fill({
			color: 3811856,
			alpha: .2
		}), c.rect(-i / 2, 0, i, l).fill(a), c.rect(-i / 2, 0, i, l * .3).fill({
			color: 16777215,
			alpha: .14
		}), sn(c, -i / 2 + 6, 6, i - 12, l - 12, 0, 16777215, .55, 1.6), s.addChild(c);
		let p = an(t, o, 16777215, "900", {
			color: f,
			width: 5
		});
		return on(p, i - 30), p.position.set(0, l / 2), s.addChild(p), s.position.set(n, r - l / 2), e.addChild(s), s;
	}
	function yn(e, t, n, r, i) {
		let a = new $(), o = new $();
		o.roundRect(-t / 2, -n / 2, t, n, 24).fill(h.card), o.position.set(r + 6, i + 9), o.rotation = -.02, e.addChild(o), a.roundRect(r - t / 2 + 3, i - n / 2 + 7, t, n, 24).fill({
			color: 4864536,
			alpha: .18
		}), a.roundRect(r - t / 2, i - n / 2, t, n, 24).fill(h.cream), yt(Math.round(t * 7 + n));
		for (let e = 0; e < 26; e++) {
			let e = i - n / 2 + 20 + bt() * (n - 40), o = r - t / 2 + 20 + bt() * (t - 80);
			a.moveTo(o, e).lineTo(o + 20 + bt() * 40, e + (bt() - .5) * 2);
		}
		return a.stroke({
			width: 1,
			color: h.creamDark,
			alpha: .35
		}), sn(a, r - t / 2 + 12, i - n / 2 + 12, t - 24, n - 24, 16, h.creamDark, .9, 2), e.addChild(a), cn(e, r - t / 2 + 26, i - n / 2 + 6, 70, -.6), cn(e, r + t / 2 - 26, i - n / 2 + 6, 70, .6), a;
	}
	function bn(e, t) {
		let n = new Y();
		return n.pivot.set(e, t), n.position.set(e, t), V.addChild(n), n.scale.set(.8), n.alpha = 0, je(.32, (e) => {
			n.scale.set(.8 + .2 * Me(e)), n.alpha = Math.min(1, e * 2.5);
		}), n;
	}
	let xn = null, Sn = 0, Cn = !1, wn = null, Tn = null, En = 0, Dn = 0, On = [], kn = null, An = null, jn = 16;
	function Mn() {
		if (ke.removeChildren().forEach((e) => e.destroy({ children: !0 })), xn && !xn.destroyed && xn.destroy({ children: !0 }), xn = null, wn = null, Tn = null, On = [], kn = null, An = null, U !== "game") return;
		let e = ln(58, 58, { icon: un }, () => ir());
		e.position.set(45, 45);
		let t = ln(58, 58, { icon: dn }, () => Yt());
		t.position.set(k - 16 - 29, 45), An = t, ke.addChild(e, t);
		let n = Math.max(120, Math.min(230, k - 148 - 70));
		vn(ke, Ij("level", { n: Ne + 1 }), k / 2, 43, n, h.red, 24);
		let r = Ke.length, i = Math.min(k - 32 - 20, 300);
		Dn = i - (r ? r * 36 + 8 : 0);
		let a = k / 2 - i / 2, o = new $();
		o.roundRect(a + 2, 99, Dn, 18, 9).fill({
			color: 4864536,
			alpha: .2
		}), o.roundRect(a, 95, Dn, 18, 9).fill(h.cardDark), o.roundRect(a + 2, 97, Dn - 4, 14, 7).fill(h.card), ke.addChild(o), wn = new $(), wn.position.set(a + 2, 97), ke.addChild(wn), Tn = an("", 13, 16777215, "900", {
			color: h.ink,
			width: 3.5
		}), Tn.position.set(a + Dn / 2, 104), ke.addChild(Tn), En = Le.length / Math.max(1, Ie), Ke.forEach((e, t) => {
			let n = new Y(), r = new $();
			r.circle(0, 0, 15).fill(h.cream).stroke({
				width: 2,
				color: h.creamDark
			});
			let i = new pi(e.spriteTex);
			i.anchor.set(.5), i.scale.set(30 * .78 / Math.max(i.texture.width, i.texture.height));
			let o = new $();
			n.addChild(r, i, o), n.position.set(a + Dn + 8 + 15 + t * 36, 104), ke.addChild(n), On.push({
				c: n,
				mark: o,
				spr: i
			});
		}), Pn();
	}
	function Nn(e) {
		if (!wn || !Tn) return;
		let t = Le.length / Math.max(1, Ie);
		En += (t - En) * Math.min(1, e * 10), Math.abs(t - En) < .002 && (En = t);
		let n = Math.max(14, (Dn - 4) * En);
		wn.clear(), wn.roundRect(0, 0, n, 14, 7).fill(h.yellow), wn.roundRect(2, 2, Math.max(0, n - 4), 4, 2).fill({
			color: 16777215,
			alpha: .45
		});
		for (let e = 10; e < n - 4; e += 12) wn.moveTo(e, 3).lineTo(e - 4, 11);
		wn.stroke({
			width: 1.5,
			color: h.yellowDark,
			alpha: .5
		}), Tn.text = Math.round(t * 100) + "%";
	}
	function Pn() {
		Ke.forEach((e, t) => {
			let n = On[t];
			n && (n.mark.clear(), e.state === "eaten" ? (n.spr.alpha = .45, n.mark.circle(8, 8, 8).fill(h.green), n.mark.moveTo(4, 8).lineTo(7, 11).lineTo(12, 5).stroke({
				width: 2.5,
				color: 16777215,
				cap: "round",
				join: "round"
			})) : e.state === "spoiled" ? (n.spr.alpha = .25, n.spr.tint = 8947848, n.mark.moveTo(-8, -8).lineTo(8, 8).moveTo(8, -8).lineTo(-8, 8).stroke({
				width: 3.5,
				color: h.red,
				cap: "round"
			})) : (n.spr.alpha = 1, n.spr.tint = 16777215));
		});
	}
	function Fn(e, t, n = !1) {
		xn &&= (xn.destroy({ children: !0 }), null);
		let r = new Y(), i = an(e, 19, h.ink, "700"), a = Math.min(k - 48, 420);
		on(i, a - 36);
		let o = Math.min(a, i.width * i.scale.x + 44), s = new $();
		s.roundRect(-o / 2 + 3, -21, o, 52, 10).fill({
			color: 4864536,
			alpha: .2
		}), s.roundRect(-o / 2, -26, o, 52, 10).fill(16776169), sn(s, -o / 2 + 6, -20, o - 12, 40, 4, h.creamDark, .9, 1.5), r.addChild(s, i), cn(r, 0, -26, 54, (Math.random() - .5) * .2), r.rotation = (Math.random() - .5) * .04, r.position.set(k / 2, n ? 56 : A - 70), (n ? Ae : ke).addChild(r), xn = r, Sn = t;
	}
	function In() {
		if (kn || U !== "game") return;
		xn &&= (xn.destroy({ children: !0 }), null);
		let e = new Y(), t = Math.min(k - 40, 360), n = new $();
		n.roundRect(-t / 2 + 3, -60, t, 132, 18).fill({
			color: 4864536,
			alpha: .22
		}), n.roundRect(-t / 2, -66, t, 132, 18).fill(16776169), sn(n, -t / 2 + 8, -58, t - 16, 116, 12, h.creamDark, .9, 1.6), e.addChild(n), cn(e, -t / 2 + 30, -64, 56, -.5), cn(e, t / 2 - 30, -64, 56, .5);
		let r = an(Ij("stuck"), 21, h.ink, "800");
		on(r, t - 40), r.position.set(0, -34), e.addChild(r);
		let i = ln(Math.min(240, t - 60), 58, {
			label: Ij("retry"),
			icon: dn,
			fill: h.yellow,
			fontSize: 24
		}, () => Yt());
		i.position.set(0, 18), e.addChild(i), e.position.set(k / 2, A + 132), ke.addChild(e), kn = e;
		let a = A - 66 - 22;
		je(.4, (t) => {
			e.y = A + 132 + (a - A - 132) * Me(t);
		}, void 0, .35);
	}
	function Ln() {
		kn &&= (kn.destroy({ children: !0 }), null);
	}
	let Rn = [], zn = new Y();
	he.addChild(zn);
	function Bn(e) {
		let t = [
			h.red,
			4165590,
			h.yellow,
			16777215,
			h.green,
			15764028,
			11691990
		];
		for (let n = 0; n < e; n++) {
			let e = new $(), r = 8 + Math.random() * 8, i = 5 + Math.random() * 6;
			e.rect(-r / 2, -i / 2, r, i).fill(t[n % t.length]), zn.addChild(e), Rn.push({
				g: e,
				x: Math.random() * k,
				y: -20 - Math.random() * A * .4,
				vx: (Math.random() - .5) * 60,
				vy: 80 + Math.random() * 120,
				vr: (Math.random() - .5) * 8,
				life: 3 + Math.random() * 2,
				flip: Math.random() * 6
			});
		}
	}
	function Vn(e) {
		Rn = Rn.filter((t) => (t.life -= e, t.life <= 0 || t.y > A + 30 ? (t.g.destroy(), !1) : (t.flip += e * 7, t.x += (t.vx + Math.sin(t.flip) * 40) * e, t.y += t.vy * e, t.g.position.set(t.x, t.y), t.g.rotation += t.vr * e, t.g.scale.y = Math.cos(t.flip), t.g.alpha = Math.min(1, t.life), !0)));
	}
	function Hn() {
		V.removeChildren().forEach((e) => e.destroy({ children: !0 })), Cn = !1, Kn = null, qn = [], Jn = null;
	}
	function Un(e = .45) {
		let t = new $();
		return t.rect(0, 0, k, A).fill({
			color: 2760720,
			alpha: e
		}), t.eventMode = "static", V.addChild(t), t;
	}
	function Wn() {
		return v.stars.reduce((e, t) => e + (t || 0), 0);
	}
	function Gn(e, t, n, r = 22) {
		let i = new pi(R.star);
		i.anchor.set(.5), i.scale.set(r * 1.3 / R.star.height);
		let a = an(Wn() + " / " + wj.length * 3, r, h.ink, "800"), o = r * 1.3 + 8 + a.width;
		i.position.set(t - o / 2 + r * .65, n), a.position.set(t - o / 2 + r * 1.3 + 8 + a.width / 2, n), e.addChild(i, a);
	}
	let Kn = null, qn = [], Jn = null, Yn = 0, Xn = 200;
	function Zn() {
		U = "title", Hn(), Mn(), $n(), Un(.22);
		let e = k / 2, t = A < 640, n = Ej().split(" "), r = [
			h.red,
			15764028,
			4165590,
			h.red,
			h.green,
			4165590
		], i = Math.max(...n.map((e) => Array.from(e).length)), a = /^[\x00-\x7f]+$/.test(Ej()), o = a ? .64 : 1.02, s = Math.min(a ? 58 : 64, (k - 40) / (i * o)), c = Math.max(78 + s * .5, A * (t ? .12 : .15) - (n.length - 1) * s * .45), l = 0;
		n.forEach((t, n) => {
			let i = Array.from(t), a = c + n * s * .95;
			i.forEach((t, n) => {
				let c = new Y(), u = r[l % r.length], d = an(t, s, 3811856, "900", {
					color: 3811856,
					width: 12
				});
				d.alpha = .3, d.position.set(3, 6);
				let f = an(t, s, 16777215, "900", {
					color: 16775398,
					width: 14
				}), p = an(t, s, u, "900", {
					color: rn(u, .6),
					width: 3
				});
				c.addChild(d, f, p), c.position.set(e + (n - (i.length - 1) / 2) * s * o, a), c.rotation = (l % 2 ? 1 : -1) * .07, V.addChild(c), qn.push(c), l++;
			});
		});
		let u = c + (n.length - 1) * s * .95, d = Math.min(A * (t ? .22 : .28), 270, k * .6);
		Xn = d;
		let f = u + s * .7 + 20 + d * .9, p = new $();
		for (let e = 0; e < 14; e++) {
			let t = e / 14 * Math.PI * 2, n = t + Math.PI / 14, r = d * 1.3;
			p.poly([
				0,
				0,
				Math.cos(t) * r,
				Math.sin(t) * r,
				Math.cos(n) * r,
				Math.sin(n) * r
			]);
		}
		p.fill({
			color: 16774864,
			alpha: .35
		}), p.position.set(e, f - d * .45), V.addChild(p), Jn = p;
		let m = new pi(R.head);
		m.anchor.set(.5, .9), m.scale.set(d / R.head.height), m.position.set(e, f), m.eventMode = "static", m.cursor = "pointer", m.on("pointertap", () => {
			m.texture = ue(se, de);
			let e = le(m.texture);
			m.anchor.set(.5, e.ay), m.scale.set(d / e.h), Yn = .8, E("move.bump");
		}), V.addChild(m), Kn = m;
		let g = an(Ij("tagline"), t ? 22 : 26, h.ink, "800");
		on(g, k - 80);
		let _ = f + 40, y = Math.min(k - 30, g.width * g.scale.x + 56), b = new Y(), x = new $();
		x.rect(-y / 2 + 3, -19, y, 48).fill({
			color: 4864536,
			alpha: .18
		}), x.rect(-y / 2, -24, y, 48).fill(16776169), sn(x, -y / 2 + 6, -18, y - 12, 36, 0, h.creamDark, .9, 1.5), b.addChild(x, g), cn(b, -y / 2 + 8, -18, 44, -.7), cn(b, y / 2 - 8, -18, 44, .7), b.position.set(e, _), b.rotation = -.025, V.addChild(b);
		let S = Math.min(270, k - 80), C = ln(S, 76, {
			label: Ij("play"),
			icon: fn,
			fill: h.yellow,
			fontSize: 32
		}, () => {
			pt(Math.min(v.unlocked - 1, wj.length - 1));
		});
		C.position.set(e, Math.min(A - 150, _ + 90));
		let w = ln(S * .82, 58, {
			label: Ij("levels"),
			icon: pn,
			fontSize: 22
		}, () => {
			tr = "title", er();
		});
		w.position.set(e, C.y + 82), V.addChild(C, w), w.y + 70 < A - 10 && Gn(V, e, Math.min(A - 28, w.y + 66), 20), Qn(), Cn = !0;
	}
	function Qn() {
		let e = Math.min(104, (k - 32 - 8 * (kj.length - 1)) / kj.length), t = e * kj.length + 8 * (kj.length - 1);
		kj.forEach((n, r) => {
			let i = n === Fj(), a = ln(e, 48, {
				label: Oj[n],
				fill: i ? h.yellow : 16776169,
				fontSize: 17,
				depth: 5
			}, () => {
				n !== Fj() && (Pj(n), v.lang = n, y(), sr());
			});
			i || (a.alpha = .9), a.position.set(k / 2 - t / 2 + e / 2 + r * (e + 8), 40), V.addChild(a);
		});
	}
	function $n() {
		if (!W) {
			let e = wj[Math.min(v.unlocked - 1, wj.length - 1)];
			Ne = Math.min(v.unlocked - 1, wj.length - 1), et(e), ht();
		}
		gt();
	}
	function er(e) {
		U = "levels", Hn(), Mn(), Un(.38), Cn = !0;
		let t = Math.ceil(wj.length / 25), n = Math.min(v.unlocked - 1, wj.length - 1);
		e === void 0 && (e = Math.floor(n / 25)), e = Math.max(0, Math.min(t - 1, e)), nr = e;
		let r = e * 25, i = Math.min(wj.length, r + 25), a = Math.min(k - 28, 470), o = Math.floor(Math.min((a - 48) / 5 - 10, (A - 96 - 202) / 5 - 10, 76)), s = 5 * (o + 10) + 96 + 102, c = A / 2 + 10, l = c - s / 2, u = bn(k / 2, c);
		yn(u, a, s, k / 2, c), vn(u, Ij("levels"), k / 2, l + 4, Math.min(240, a - 120), h.red, 26), Gn(u, k / 2, l + 64, 18);
		let d = 5 * (o + 10) - 10, f = k / 2 - d / 2 + o / 2, p = l + 96 + o / 2;
		yt(99 + e);
		for (let e = r; e < i; e++) {
			let t = (e - r) % 5, i = Math.floor((e - r) / 5), a = e >= v.unlocked, s = v.stars[e] || 0, c = a ? 13481098 : s >= 3 ? h.yellow : s > 0 ? 16640416 : 16776169, l = ln(o, o, {
				label: a ? "" : String(e + 1),
				fill: c,
				fontSize: o * .36,
				depth: 5,
				radius: 12
			}, () => {
				a || pt(e);
			}), d = l.face;
			if (a) {
				let e = new $(), t = o * .15;
				e.roundRect(-t, -t * .2, t * 2, t * 1.6, 3).fill(9074e3), e.arc(0, -t * .2, t * .62, Math.PI, 0).stroke({
					width: t * .3,
					color: 9074e3
				}), d.addChild(e), l.eventMode = "none";
			} else {
				let t = d.children[1];
				t && (t.y = -o * .1);
				for (let e = 0; e < 3; e++) {
					let t = new pi(R.star);
					t.anchor.set(.5), t.scale.set(o * .22 / R.star.height), t.position.set((e - 1) * o * .23, o * .27 - (e === 1 ? 3 : 0)), e >= s && (t.tint = 7829367, t.alpha = .35), d.addChild(t);
				}
				if (e === n && s === 0) {
					let e = new pi(R.head);
					e.anchor.set(.5, 1), e.scale.set(o * .55 / R.head.height), e.position.set(o * .36, -o * .22), e.rotation = .25, l.addChild(e), rr = l;
				}
			}
			l.rotation = (bt() - .5) * .08, l.position.set(f + t * (o + 10), p + i * (o + 10)), u.addChild(l);
		}
		let m = p + 5 * (o + 10) - o / 2 + 22, g = an(`${e + 1} / ${t}`, 20, h.ink, "900");
		g.position.set(k / 2, m), u.addChild(g);
		let _ = (n) => {
			let r = n < 0 ? e > 0 : e < t - 1, i = ln(64, 48, {
				icon: (e, t, r) => {
					e.poly(n > 0 ? [
						-t * .1,
						-t * .18,
						t * .16,
						0,
						-t * .1,
						t * .18
					] : [
						t * .1,
						-t * .18,
						-t * .16,
						0,
						t * .1,
						t * .18
					]).fill(r);
				},
				label: "",
				fill: r ? h.yellow : 13481098,
				depth: 5
			}, () => {
				r && er(e + n);
			});
			r || (i.alpha = .5, i.eventMode = "none"), i.position.set(k / 2 + n * Math.min(110, d / 2 - 32), m), u.addChild(i);
		};
		_(-1), _(1);
		let y = ln(150, 54, {
			icon: tr === "game" ? _n : mn,
			label: "",
			fontSize: 22
		}, () => {
			tr === "game" ? (Hn(), U = "game", Mn()) : Zn();
		});
		y.position.set(k / 2, c + s / 2 - 4), u.addChild(y);
	}
	let tr = "title", nr = -1, rr = null;
	function ir() {
		We || (ct = !0, Cn = !0, ar(!0));
	}
	function ar(e = !1) {
		V.removeChildren().forEach((e) => e.destroy({ children: !0 })), Un(.45);
		let t = Math.min(k - 40, 360), n = A / 2 + 10, r = e ? bn(k / 2, n) : V;
		yn(r, t, 456, k / 2, n), vn(r, Ej(), k / 2, n - 228 + 4, Math.min(250, t - 110), h.red, 26);
		let i = an(Ij("settings"), 18, 9074e3, "800");
		i.position.set(k / 2, n - 228 + 64), r.addChild(i);
		let a = t - 64, o = (a - 12) / 2, s = k / 2 - o / 2 - 6, c = k / 2 + o / 2 + 6, l = n - 228 + 116, u = ln(a, 62, {
			label: Ij("resume"),
			icon: fn,
			fill: h.yellow,
			fontSize: 24
		}, () => {
			ct = !1, Hn();
		});
		u.position.set(k / 2, l);
		let d = ln(o, 54, {
			label: Ij("retry"),
			icon: dn,
			fontSize: 19
		}, () => {
			ct = !1, Hn(), Yt();
		});
		d.position.set(s, l + 74);
		let f = ln(o, 54, {
			label: Ij("home"),
			icon: mn,
			fontSize: 19
		}, () => {
			ct = !1, ht(), Zn();
		});
		f.position.set(c, l + 74);
		let p = ln(a, 54, {
			label: Ij("menu"),
			icon: pn,
			fontSize: 21
		}, () => {
			ct = !1, tr = "game", er();
		});
		p.position.set(k / 2, l + 142), r.addChild(u, d, f, p);
		let m = ln(o, 54, {
			label: Ij("music"),
			icon: hn(v.music),
			fill: v.music ? 16776169 : 14208692,
			fontSize: 18
		}, () => {
			v.music = !v.music, S(), y(), ar();
		});
		m.position.set(s, l + 210);
		let g = ln(o, 54, {
			label: Ij("sound"),
			icon: gn(v.sfx),
			fill: v.sfx ? 16776169 : 14208692,
			fontSize: 18
		}, () => {
			v.sfx = !v.sfx, S(), y(), ar();
		});
		g.position.set(c, l + 210), r.addChild(m, g);
		let _ = (a - 16) / kj.length;
		kj.forEach((e, t) => {
			let n = e === Fj(), i = ln(_, 48, {
				label: Oj[e],
				fill: n ? h.yellow : 16776169,
				fontSize: 16,
				depth: 5
			}, () => {
				e !== Fj() && (Pj(e), v.lang = e, y(), Mn(), ar());
			});
			i.position.set(k / 2 - a / 2 + _ / 2 + t * (_ + 8), l + 278), r.addChild(i);
		});
	}
	function or(e, t = !0) {
		if (U !== "game") return;
		Hn(), Ln(), Cn = !0, Un(.4);
		let n = Math.min(k - 40, 380), r = A / 2 + 50, i = t ? bn(k / 2, r) : V, a = new pi(me), o = le(me);
		a.anchor.set(.5, o.ay), a.scale.set(150 / o.h), a.position.set(k / 2, r - 180 + 14), i.addChild(a), yn(i, n, 360, k / 2, r);
		let s = Ne === wj.length - 1;
		vn(i, Ij(s ? "allDone" : "clear"), k / 2, r - 180 + 10, Math.min(260, n - 100), h.red, s ? 20 : 30);
		let c = [
			e.clear,
			e.snack,
			e.perfect
		], l = [
			Ij("starClear"),
			Ij("starSnack"),
			Ij("starPerfect")
		];
		for (let e = 0; e < 3; e++) {
			let a = new pi(R.star);
			a.anchor.set(.5);
			let o = (e === 1 ? 74 : 60) / R.star.height;
			a.position.set(k / 2 + (e - 1) * (n / 3.3), r - 38 - (e === 1 ? 10 : 0)), a.rotation = (e - 1) * .18, c[e] || (a.tint = 7829367, a.alpha = .4), i.addChild(a), t ? (a.scale.set(0), je(.4, (e) => a.scale.set(o * Me(e)), () => {
				c[e] && E("snack.eat", 4 + e * 2);
			}, .25 + e * .22)) : a.scale.set(o);
			let s = an(l[e], 14, c[e] ? h.ink : 10128492, "700");
			on(s, n / 3.3 - 6), s.position.set(a.x, r + 18), i.addChild(s);
		}
		let u = (n - 76) / 2, d = ln(u, 62, {
			label: Ij("retry"),
			icon: dn,
			fontSize: 22
		}, () => mt(Ne));
		d.position.set(k / 2 - u / 2 - 8, r + 180 - 76);
		let f = ln(u, 62, {
			label: Ij(s ? "menu" : "next"),
			icon: s ? pn : fn,
			fill: h.yellow,
			fontSize: 22
		}, () => {
			s ? (tr = "title", er()) : mt(Ne + 1);
		});
		f.position.set(k / 2 + u / 2 + 8, r + 180 - 76), i.addChild(d, f);
	}
	function sr() {
		if (k = j.screen.width, A = j.screen.height, _e.width = k, _e.height = A, W) {
			gt();
			for (let e of Ke) e.tagText.style.fontFamily = P;
			U === "game" ? (Mn(), We && Cn ? or(Xt(), !1) : ct ? ar() : st && !We && !Ut() && In()) : U === "title" ? Zn() : U === "levels" && er(nr);
		}
	}
	let cr = null;
	j.canvas.addEventListener("pointerdown", (e) => {
		let t = j.canvas.getBoundingClientRect();
		cr = {
			x: e.clientX - t.left,
			y: e.clientY - t.top,
			id: e.pointerId,
			fired: !1
		};
	}), u(window, "pointermove", (e) => {
		if (!cr || cr.fired || e.pointerId !== cr.id) return;
		let t = j.canvas.getBoundingClientRect(), n = e.clientX - t.left - cr.x, r = e.clientY - t.top - cr.y;
		Math.hypot(n, r) < 24 || (cr.fired = !0, Wt(Math.abs(n) > Math.abs(r) ? n > 0 ? 0 : 1 : r > 0 ? 2 : 3));
	}), u(window, "pointerup", (e) => {
		if (cr && !cr.fired && e.pointerId === cr.id && (U === "game" || U === "title") && !Cn) {
			let t = j.canvas.getBoundingClientRect();
			Vt(e.clientX - t.left, e.clientY - t.top);
		}
		cr = null;
	}), u(window, "pointercancel", () => {
		cr = null;
	}), u(window, "keydown", (e) => {
		let t = e.key.toLowerCase();
		if (U === "game") {
			if (t === "arrowright" || t === "d") Wt(0);
			else if (t === "arrowleft" || t === "a") Wt(1);
			else if (t === "arrowdown" || t === "s") Wt(2);
			else if (t === "arrowup" || t === "w") Wt(3);
			else if (t === "r") Yt();
			else if (t === "escape" || t === "p") ct ? (ct = !1, Hn()) : ir();
			else return;
			e.preventDefault();
		}
	});
	let lr = 0;
	j.ticker.add((e) => {
		let t = Math.min(.05, e.deltaMS / 1e3);
		lr += t, ct || Gt(t);
		for (let e of H.slice()) {
			if (e.delay > 0) {
				e.delay -= t;
				continue;
			}
			e.t += t;
			let n = Math.min(1, e.t / e.dur);
			e.fn(n), n >= 1 && (H.splice(H.indexOf(e), 1), e.done?.());
		}
		rt > 0 && (at += t, rt = Math.max(0, rt - t * 3.2)), We && (Ge += t), He > 0 && (He = Math.max(0, He - t));
		let n = We ? me : He > 0 && Ve ? Ve : R.head;
		if (Te.texture !== n && (Te.texture = n), Nn(t), Vn(t), tn(lr), en(t), Bt(t), Ke.forEach((e, t) => {
			if (e.state === "fresh") {
				let n = e.sprite.children[0];
				n.y = Math.sin(lr * 3 + t) * K * .04;
			}
		}), ot > 0 ? (ge.position.set((Math.random() - .5) * ot, (Math.random() - .5) * ot), ot = Math.max(0, ot - t * 40)) : ge.position.set(0, 0), xn && (Sn -= t, xn.alpha = Math.min(1, Sn * 2), Sn <= 0 && (xn.destroy({ children: !0 }), xn = null)), An && !An.destroyed && An.scale.set(kn ? 1 + .07 * Math.max(0, Math.sin(lr * 8)) : 1), Kn && U === "title" && !Kn.destroyed) {
			Yn > 0 && (Yn -= t, Yn <= 0 && (Kn.texture = R.head, Kn.anchor.set(.5, .88), Kn.scale.set(Xn / R.head.height)));
			let e = Kn.scale.x > 0 ? Math.abs(Kn.scale.x) : 1;
			Kn.rotation = Math.sin(lr * 2.2) * .08 + (Yn > 0 ? Math.sin(lr * 40) * .06 : 0), Kn.scale.y = e * (1 + Math.sin(lr * 5) * .03);
		}
		qn.forEach((e, t) => {
			e.destroyed || (e.y += Math.sin(lr * 3 + t * .8) * 4 - (e.bob ?? 0)), e.bob = Math.sin(lr * 3 + t * .8) * 4;
		}), Jn && !Jn.destroyed && (Jn.rotation = lr * .15), rr && !rr.destroyed && U === "levels" ? rr.scale.set(1 + .05 * Math.sin(lr * 5)) : rr = null;
	}), M = !0, sr(), Zn(), pe();
	let ur = {
		ready: !0,
		state: () => ({
			levelIdx: Ne,
			path: Le.length,
			total: Ie,
			won: We,
			slides: ze,
			screen: U,
			stars: v.stars.slice(),
			unlocked: v.unlocked,
			lang: Fj()
		}),
		move: (e) => Wt(e),
		restart: Yt,
		startLevel: pt,
		buttons: () => {
			let e = [], t = (e) => {
				if (e instanceof Hv) return e.text;
				for (let n of e.children ?? []) {
					let e = t(n);
					if (e) return e;
				}
				return null;
			}, n = (r) => {
				if (r && !r.destroyed) {
					if (r.eventMode === "static") {
						let n = t(r);
						if (n) {
							let t = r.getGlobalPosition();
							e.push({
								label: String(n),
								x: Math.round(t.x),
								y: Math.round(t.y)
							});
						}
						return;
					}
					for (let e of r.children ?? []) n(e);
				}
			};
			return n(V), e;
		}
	};
	return window.__screamchick = ur, dr;
	function dr() {
		if (s) {
			s = !1;
			try {
				window.__screamchick === ur && delete window.__screamchick;
			} catch {}
			for (let e of d) clearTimeout(e);
			d.clear();
			for (let [e, t, n] of l) try {
				e.removeEventListener(t, n);
			} catch {}
			l.length = 0;
			try {
				N.dispose();
			} catch {}
			try {
				j.ticker.stop();
			} catch {}
			try {
				b && b.dispose();
			} catch {}
			b = null;
			try {
				j.destroy(!0, { children: !0 });
			} catch {}
			if (n) {
				try {
					document.documentElement.lang = p;
				} catch {}
				try {
					document.title = m;
				} catch {}
			}
		}
	}
}
//#endregion
//#region plugin.js
var Bj = 4, Vj = 10, Hj = {
	id: "screamchick",
	name: "尖叫鸡",
	emoji: "🐔",
	tabLabel: "尖叫鸡",
	version: "1.0.0",
	minHostApi: Bj,
	coin: {
		id: "screamchick-star",
		name: "星星",
		emoji: "⭐"
	},
	economy: {
		playCost: Vj,
		expectedPayout: 0,
		capPerPrize: 1
	}
};
async function Uj(e, t, n = {}) {
	let r = getComputedStyle(e).position === "static", i = e.style.position, a = e.style.overflow, o = e.style.touchAction, s = e.style.userSelect;
	r && (e.style.position = "relative"), e.style.overflow = "hidden", e.style.touchAction = "none", e.style.userSelect = "none";
	let c = "screamchick-" + Math.random().toString(36).slice(2, 8);
	e.classList.add(c);
	let l = document.createElement("style");
	l.textContent = `.${c} canvas{display:block}`, document.head.appendChild(l);
	let u = typeof n.assetUrl == "function" ? (e) => n.assetUrl(e) : (e) => String(n.assetBase || "") + e, d = Lj(t.storage);
	try {
		await d.preload();
	} catch (e) {
		console.warn("[screamchick] 读存档失败，按新档开始", e);
	}
	let f = 0, p = async () => {
		try {
			if (typeof t.balance == "function" && t.balance() < Vj || !await t.spendPoints(Vj, "尖叫鸡 · 进关")) return t.pushToast?.({
				kind: "warn",
				title: "积分不够啦",
				detail: `进一关要 ${Vj} 积分 —— 去做个任务攒一点吧`
			}), !1;
		} catch (e) {
			return console.error("[screamchick] 进关扣分失败", e), t.pushToast?.({
				kind: "warn",
				title: "扣分失败",
				detail: "稍后再试一次"
			}), !1;
		}
		return f++, t.tone?.("coin"), !0;
	}, m = null;
	try {
		m = await zj({
			mountTo: e,
			asset: u,
			assetBase: typeof n.assetBase == "string" ? n.assetBase : "",
			store: d,
			chargePlay: p,
			locale: n.locale
		});
	} catch (t) {
		console.error("[screamchick] mount 失败", t);
		try {
			l.remove();
		} catch {}
		throw e.classList.remove(c), r && (e.style.position = i), e.style.overflow = a, e.style.touchAction = o, e.style.userSelect = s, t;
	}
	return async function() {
		try {
			await m?.();
		} catch (e) {
			console.warn("[screamchick] 卸载出错", e);
		}
		try {
			await d.flush();
		} catch (e) {
			console.warn("[screamchick] 存档落盘失败", e);
		}
		try {
			l.remove();
		} catch {}
		e.classList.remove(c), r && (e.style.position = i), e.style.overflow = a, e.style.touchAction = o, e.style.userSelect = s;
	};
}
var Wj = {
	manifest: Hj,
	mount: Uj
};
//#endregion
export { Wj as default, Hj as manifest, Uj as mount };
