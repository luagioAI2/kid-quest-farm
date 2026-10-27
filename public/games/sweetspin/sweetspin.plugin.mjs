//#region runtime/display-1.js
var e = Object.freeze({
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
}), t = [
	"landscape",
	"portrait",
	"both"
];
function n(e, t) {
	return e >= t ? "landscape" : "portrait";
}
function r(e, t) {
	return e === "landscape" && t === "portrait";
}
function i(e) {
	let t = Math.max(1, e.width | 0), n = Math.max(1, e.height | 0), r = e.dpr > 0 ? e.dpr : 1, i = e.maxPixelRatio > 0 ? e.maxPixelRatio : 2, a = e.minPixelRatio > 0 ? e.minPixelRatio : 1, o = Math.min(r, i);
	return e.maxPixels > 0 && t * n * o * o > e.maxPixels && (o = Math.sqrt(e.maxPixels / (t * n))), o = Math.max(a, Math.min(o, i)), Math.round(o * 100) / 100;
}
function a(e) {
	let t = String(e || typeof document < "u" && document.documentElement.lang || typeof navigator < "u" && navigator.language || "en").toLowerCase();
	return t.startsWith("zh") ? "zh" : t.startsWith("ja") ? "ja" : "en";
}
function o(t) {
	let n = e[t] || e.en, r = document.createElement("div");
	r.setAttribute("data-mp-rotate", "1"), r.setAttribute("role", "status"), r.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(6,3,13,.95);color:#f4f1fa;font:600 20px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Noto Sans,sans-serif;text-align:center;padding:24px;box-sizing:border-box;touch-action:none;user-select:none;-webkit-user-select:none";
	let i = document.createElement("style");
	i.textContent = "@keyframes mpRotateHint{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(90deg)}}";
	let a = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	a.setAttribute("width", "64"), a.setAttribute("height", "64"), a.setAttribute("viewBox", "0 0 64 64"), a.setAttribute("aria-hidden", "true"), a.style.animation = "mpRotateHint 1.8s ease-in-out infinite alternate";
	let o = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	for (let [e, t] of [
		["x", "18"],
		["y", "6"],
		["width", "28"],
		["height", "52"],
		["rx", "5"],
		["fill", "none"],
		["stroke", "#f4f1fa"],
		["stroke-width", "3"]
	]) o.setAttribute(e, t);
	let s = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	for (let [e, t] of [
		["cx", "32"],
		["cy", "51"],
		["r", "2.5"],
		["fill", "#f4f1fa"]
	]) s.setAttribute(e, t);
	a.appendChild(o), a.appendChild(s);
	let c = document.createElement("div");
	c.textContent = n.title;
	let l = document.createElement("div");
	return l.style.cssText = "font-size:14px;font-weight:400;opacity:.75", l.textContent = n.sub, r.appendChild(i), r.appendChild(a), r.appendChild(c), r.appendChild(l), r;
}
var s = 1.5, c;
function l() {
	if (c !== void 0) return c;
	try {
		let e = navigator.userAgentData;
		return c = e && typeof e.mobile == "boolean" ? e.mobile : matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) <= 500;
	} catch {
		return c = !1;
	}
}
function u(e, t, n) {
	let r = e > 0 ? e : 2;
	if (!t) return r;
	let i = typeof window < "u" ? window.__mpPhoneMaxRatio : void 0;
	if (typeof i == "number" && isFinite(i)) return i <= 0 ? r : Math.min(r, i);
	let a = Math.min(r, s);
	return n ? Math.max(1, Math.floor(a)) : a;
}
function d(e) {
	let s = e || {}, c = t.includes(s.orientation) ? s.orientation : "both", d = s.host || typeof document < "u" && (document.getElementById("app") || document.body) || null, f = a(s.lang), p = s.pixelated === !0, m = [], h = null, g = 0, _ = !1, v = null, y = null, b = {
		width: 0,
		height: 0,
		resolution: 1,
		dpr: 1,
		orientation: "landscape",
		blocked: !1,
		bufferWidth: 0,
		bufferHeight: 0
	}, x = "";
	function S() {
		let e = d ? d.clientWidth : 0, t = d ? d.clientHeight : 0;
		if (!(e > 0 && t > 0)) {
			let n = document.documentElement;
			e = n && n.clientWidth || window.innerWidth, t = n && n.clientHeight || window.innerHeight;
		}
		return {
			w: Math.max(1, Math.round(e)),
			h: Math.max(1, Math.round(t))
		};
	}
	function C(e) {
		e && !h ? (h = o(f), document.body.appendChild(h)) : !e && h && (h.remove(), h = null);
	}
	function w(e) {
		if (typeof matchMedia == "function") {
			v && v.removeEventListener("change", D);
			try {
				v = matchMedia("(resolution: " + e + "dppx)"), v.addEventListener("change", D);
			} catch {
				v = null;
			}
		}
	}
	function T() {
		if (_) return;
		let e = S(), t = window.devicePixelRatio || 1, a = u(s.maxPixelRatio, l(), p), o = i({
			width: e.w,
			height: e.h,
			dpr: t,
			maxPixelRatio: a,
			minPixelRatio: s.minPixelRatio,
			maxPixels: s.maxPixels === void 0 ? 4e6 : s.maxPixels
		}), d = n(e.w, e.h), f = r(c, d), h = e.w + "x" + e.h + "@" + o + "/" + t + "/" + d, g = f !== b.blocked;
		if (h !== x || g) {
			x = h, b.width = e.w, b.height = e.h, b.resolution = o, b.dpr = t, b.orientation = d, b.blocked = f, b.bufferWidth = Math.round(e.w * o), b.bufferHeight = Math.round(e.h * o);
			for (let e of m) try {
				e(b);
			} catch (e) {
				console.warn("[display] attach target failed", e);
			}
			C(f), ee || (typeof s.onResize == "function" && s.onResize(b), g && typeof s.onBlocked == "function" && s.onBlocked(f)), w(t);
		}
	}
	let E = !1;
	function D() {
		_ || E || (E = !0, g = requestAnimationFrame(() => {
			E = !1, T();
		}));
	}
	function O(e) {
		e && e.style && p && (e.style.imageRendering = "pixelated", e.setAttribute("data-mp-pixelated", "1"));
	}
	let k = {
		info: b,
		get declaredOrientation() {
			return c;
		},
		refresh() {
			return T(), b;
		},
		attachPixi(e) {
			let t = (t) => {
				let n = e && e.renderer;
				n && (n.resolution !== t.resolution && (n.resolution = t.resolution), n.resize(t.width, t.height), O(e.canvas || n.canvas));
			};
			return m.push(t), b.width && t(b), k;
		},
		attachThree(e, t) {
			let n = (n) => {
				e && (e.setPixelRatio(n.resolution), e.setSize(n.width, n.height, !0), t && typeof t.updateProjectionMatrix == "function" && "aspect" in t && (t.aspect = n.width / n.height, t.updateProjectionMatrix()), O(e.domElement));
			};
			return m.push(n), b.width && n(b), k;
		},
		attachCanvas(e) {
			let t = (t) => {
				e && (e.width = t.bufferWidth, e.height = t.bufferHeight, e.style.width = t.width + "px", e.style.height = t.height + "px", O(e));
			};
			return m.push(t), b.width && t(b), k;
		},
		applyTransform(e) {
			return e.setTransform(b.resolution, 0, 0, b.resolution, 0, 0), b;
		},
		dispose() {
			_ = !0, g && cancelAnimationFrame(g), window.removeEventListener("resize", D), window.removeEventListener("orientationchange", D), window.visualViewport && window.visualViewport.removeEventListener("resize", D), y && y.disconnect(), v && v.removeEventListener("change", D), C(!1), m.length = 0;
		}
	};
	if (window.addEventListener("resize", D), window.addEventListener("orientationchange", D), window.visualViewport && window.visualViewport.addEventListener("resize", D), typeof ResizeObserver == "function" && d) try {
		y = new ResizeObserver(D), y.observe(d);
	} catch {
		y = null;
	}
	let ee = !0;
	return T(), ee = !1, queueMicrotask(() => {
		_ || (typeof s.onResize == "function" && s.onResize(b), b.blocked && typeof s.onBlocked == "function" && s.onBlocked(!0));
	}), k;
}
//#endregion
//#region runtime/sound-1.js
var f = 1e-6, p = Object.freeze({
	panningModel: "equalpower",
	distanceModel: "inverse",
	refDistance: 133,
	maxDistance: 3200,
	rolloffFactor: .5,
	speedOfSound: 9150,
	dopplerFactor: 1,
	levelTrimDb: 3
}), m = Object.freeze({
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
		...p
	}),
	phaser: Object.freeze({
		id: "phaser",
		...p
	})
});
function h(e) {
	let t = Number(e?.levelTrimDb);
	return Number.isFinite(t) ? 10 ** (t / 20) : 1;
}
var g = .5, _ = 2, v = .02, y = .05;
function b(e, t = 0) {
	let n = Number(e);
	return Number.isFinite(n) ? n : t;
}
function x(e) {
	return typeof e == "object" && !!e && (Array.isArray(e) || "x" in e || "y" in e || "z" in e);
}
function S(e, t = null) {
	if (!x(e)) return t;
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
function C(e, t) {
	return {
		x: e.x - t.x,
		y: e.y - t.y,
		z: e.z - t.z
	};
}
function w(e, t) {
	return e.x * t.x + e.y * t.y + e.z * t.z;
}
function T(e, t) {
	return e != null && t != null && e.x === t.x && e.y === t.y && e.z === t.z;
}
function E(e) {
	let t = Math.sqrt(w(e, e));
	return t < f ? null : {
		x: e.x / t,
		y: e.y / t,
		z: e.z / t
	};
}
function D({ listenerPosition: e, listenerVelocity: t, sourcePosition: n, sourceVelocity: r, speedOfSound: i, dopplerFactor: a = 1 }) {
	if (!(a > 0)) return 1;
	let o = b(i, 0);
	if (!(o > 0)) return 1;
	let s = E(C(e, n));
	if (!s) return 1;
	let c = w(t, s) * a, l = w(r, s) * a, u = o - c, d = o - l;
	if (d <= f) return _;
	if (u <= 0) return g;
	let p = u / d;
	return Number.isFinite(p) ? Math.min(_, Math.max(g, p)) : 1;
}
function O(e, t, n, r = v) {
	e.setTargetAtTime(t, n, r);
}
function k() {
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
				let n = C(e, this.position);
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
function ee({ profile: e = m.three } = {}) {
	let t = { ...e }, n = null, r = null, i = k(), a = /* @__PURE__ */ new Set();
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
		let t = x(e) ? S(e) : S(e?.position);
		if (!t) throw TypeError("setListener requires a position: { position: {x,y,z} } or a bare vector");
		let r = S(e?.forward) ?? {
			x: 0,
			y: 0,
			z: -1
		}, a = S(e?.up) ?? {
			x: 0,
			y: 1,
			z: 0
		};
		return i.explicitVelocity = S(e?.velocity), n = {
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
		T(r?.position, i) || (O(t.positionX, i.x, s), O(t.positionY, i.y, s), O(t.positionZ, i.z, s)), (!T(r?.forward, a) || !T(r?.up, o)) && (O(t.forwardX, a.x, s), O(t.forwardY, a.y, s), O(t.forwardZ, a.z, s), O(t.upX, o.x, s), O(t.upY, o.y, s), O(t.upZ, o.z, s)), r = {
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
	function h(e, t, n) {
		if (!e.panner || T(e.pushedPosition, n)) return;
		let r = t.currentTime;
		O(e.panner.positionX, n.x, r), O(e.panner.positionY, n.y, r), O(e.panner.positionZ, n.z, r), e.pushedPosition = n;
	}
	function g({ position: e = {
		x: 0,
		y: 0,
		z: 0
	}, spatial: t = null, id: n = null } = {}) {
		let r = k(), i = {
			id: n,
			disposed: !1,
			position: S(e) ?? {
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
				let t = S(e);
				if (!t) throw TypeError("emitter position must be a vector");
				return i.position = t, i;
			},
			setVelocity(e) {
				return r.explicitVelocity = S(e), i;
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
	function _(e) {
		e && (e.disposed = !0, a.delete(e));
	}
	function v(e, t, { listenerVelocity: r, sourceVelocity: i }) {
		if (!e.source?.playbackRate) return;
		let a = 1;
		e.doppler && (a = D({
			listenerPosition: n.position,
			listenerVelocity: r,
			sourcePosition: e.emitter.position,
			sourceVelocity: i,
			speedOfSound: e.params.speedOfSound,
			dopplerFactor: e.params.dopplerFactor
		})), e.dopplerRatio = a;
		let o = e.playbackRate * e.emitter.pitchScale * a;
		o !== e.appliedRate && (e.appliedRate = o, O(e.source.playbackRate, o, t.currentTime, y));
	}
	function b(e, t) {
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
			for (let e of n.voices) e.finalized || (o += 1, h(e, t, n.position), v(e, t, {
				listenerVelocity: r,
				sourceVelocity: i
			}));
		}
		return {
			emitters: a.size,
			voices: o
		};
	}
	function C() {
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
	function w() {
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
		createEmitter: g,
		removeEmitter: _,
		createPanner: p,
		update: b,
		snapshot: C,
		clear: w
	};
}
function te(e, { engine: t, readListener: n, readPosition: r, isGone: i }) {
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
function A(e) {
	return {
		x: e[12],
		y: e[13],
		z: e[14]
	};
}
function j(e, t, n) {
	let r = Math.hypot(e, t, n);
	return r > 1e-6 ? {
		x: e / r + 0,
		y: t / r + 0,
		z: n / r + 0
	} : null;
}
function M(e) {
	return j(-e[8], -e[9], -e[10]) ?? {
		x: 0,
		y: 0,
		z: -1
	};
}
function ne(e) {
	return j(e[4], e[5], e[6]) ?? {
		x: 0,
		y: 1,
		z: 0
	};
}
function N(e) {
	let t = e?.matrixWorld?.elements;
	if (!t || t.length < 16) throw TypeError("three adapter needs an Object3D with a matrixWorld");
	return t;
}
function re(e) {
	return e == null || e.parent === null && e.isScene !== !0;
}
function ie(e, { camera: t, listenerObject: n, autoUpdateMatrices: r = !1 } = {}) {
	let i = n ?? t;
	if (!i) throw TypeError("attachThree requires a camera (or listenerObject)");
	function a(e) {
		r && typeof e?.updateMatrixWorld == "function" && e.updateMatrixWorld();
	}
	let o = te(e, {
		engine: "three",
		readListener() {
			a(i);
			let e = N(i);
			return {
				position: A(e),
				forward: M(e),
				up: ne(e)
			};
		},
		readPosition(e) {
			return a(e), A(N(e));
		},
		isGone: re
	});
	return Object.freeze({
		...o,
		setListenerTarget(e) {
			if (!e) throw TypeError("setListenerTarget requires an Object3D");
			return i = e, o.syncListener().resetMotion(), this;
		}
	});
}
function ae(e, t) {
	let n = e?.worldTransform;
	if (!n || typeof n.tx != "number") throw TypeError(`pixi adapter needs ${t} to have a worldTransform`);
	return n;
}
function oe(e, t, n) {
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
function P(e) {
	return {
		x: e.x,
		y: 0,
		z: e.y
	};
}
function F(e) {
	return e == null || e.destroyed === !0 || e.parent === null;
}
function I(e, t) {
	if (!e || !(e.width > 0) || !(e.height > 0)) throw TypeError(`${t} requires a logical screen size`);
}
function L(e, { world: t, screen: n } = {}) {
	if (!t) throw TypeError("attachPixi requires the game world container");
	I(n, "attachPixi");
	let r = n, i = te(e, {
		engine: "pixi",
		readListener() {
			return { position: P(oe(ae(t, "the world container"), r.width / 2, r.height / 2)) };
		},
		readPosition(e) {
			let n = ae(e, "the emitter object");
			return P(oe(ae(t, "the world container"), n.tx, n.ty));
		},
		isGone: F
	});
	return Object.freeze({
		...i,
		setScreen(e) {
			return I(e, "setScreen"), r = e, i.syncListener(), this;
		}
	});
}
function R(e, t) {
	let n = (e) => typeof e == "number" && Number.isFinite(e);
	if (!e || !n(e.scrollX) || !n(e.scrollY) || !n(e.width) || !n(e.height)) throw TypeError(`${t} requires a Phaser camera with numeric scrollX/scrollY/width/height`);
}
function z(e) {
	return R(e, "phaser adapter"), ce({
		x: e.scrollX + e.width / 2,
		y: e.scrollY + e.height / 2
	});
}
function se(e) {
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
function ce(e) {
	return {
		x: e.x,
		y: 0,
		z: e.y
	};
}
function le(e) {
	return e == null || e.scene == null;
}
function ue(e, { scene: t, camera: n = t?.cameras?.main, autoUpdate: r = !0 } = {}) {
	let i = t?.events;
	if (!i || typeof i.on != "function" || typeof i.once != "function" || typeof i.off != "function") throw TypeError("attachPhaser requires a Phaser scene");
	R(n, "attachPhaser");
	let a = n, o = te(e, {
		engine: "phaser",
		readListener() {
			return { position: z(a) };
		},
		readPosition(e) {
			return ce(se(e));
		},
		isGone: le
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
			return R(e, "setCamera"), a = e, o.syncListener().resetMotion(), this;
		}
	});
}
var de = Object.freeze([
	"master",
	"music",
	"sfx",
	"voice"
]), B = Object.freeze({
	master: 1,
	music: 1,
	sfx: 1,
	voice: 1
}), fe = 200, V = "0.8.1", pe = /* @__PURE__ */ new WeakMap();
function H(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function me(e, t) {
	if (Array.isArray(e)) {
		let n = e.map((e, n) => {
			if (!H(e) || typeof e.id != "string" || e.id.length === 0) throw TypeError(`${t}[${n}] must have a non-empty id`);
			return [e.id, { ...e }];
		});
		return new Map(n);
	}
	if (H(e)) return new Map(Object.entries(e).map(([e, n]) => {
		if (!H(n)) throw TypeError(`${t}.${e} must be an object`);
		return [e, {
			id: e,
			...n
		}];
	}));
	throw TypeError(`manifest.${t} must be an object or array`);
}
function he(e, t) {
	return e == null ? /* @__PURE__ */ new Map() : me(e, t);
}
function ge(e) {
	return e === -Infinity ? 0 : 10 ** (Number(e || 0) / 20);
}
function _e(e) {
	return e === 0 ? 0 : e * e;
}
function U(e, t, n) {
	e && Number.isFinite(t) && (typeof e.setValueAtTime == "function" && Number.isFinite(n) ? e.setValueAtTime(t, n) : e.value = t);
}
function ve(e, t, n) {
	e && (typeof e.linearRampToValueAtTime == "function" && Number.isFinite(n) ? e.linearRampToValueAtTime(t, n) : e.value = t);
}
function ye(e, t, n) {
	if (!e) return;
	let r = Number.isFinite(e.value) ? e.value : 1;
	if (typeof e.exponentialRampToValueAtTime == "function" && Number.isFinite(n) && r > 0 && t > 0) {
		e.exponentialRampToValueAtTime(t, n);
		return;
	}
	ve(e, t, n);
}
function be(e, t) {
	e && typeof e.cancelScheduledValues == "function" && e.cancelScheduledValues(Number.isFinite(t) ? t : 0);
}
function xe(e) {
	let t = String(e), n = 2166136261;
	for (let e = 0; e < t.length; e += 1) n ^= t.charCodeAt(e), n = Math.imul(n, 16777619);
	return n >>> 0;
}
function Se(e, t, n) {
	let r = e.assetIds ?? e.assets ?? e.assetId, i = (Array.isArray(r) ? r : [r]).filter((e) => e != null).map((e) => typeof e == "string" ? {
		assetId: e,
		weight: 1
	} : {
		assetId: e.assetId ?? e.id,
		weight: Number.isFinite(e.weight) && e.weight > 0 ? e.weight : 1
	}).filter((e) => typeof e.assetId == "string" && e.assetId.length > 0);
	if (i.length === 0) throw Error(`cue ${t} has no assets`);
	let a = i.reduce((e, t) => e + t.weight, 0), o = xe(`${t}:${n}`) / 4294967296 * a;
	for (let e of i) if (o -= e.weight, o < 0) return e.assetId;
	return i.at(-1).assetId;
}
function Ce(e, t) {
	let n = e.variants, r;
	r = Array.isArray(n) ? n.map((e, n) => ({
		id: e.id ?? e.format ?? e.codec ?? `${t}-${n}`,
		...e
	})) : H(n) ? Object.entries(n).map(([e, t]) => typeof t == "string" ? {
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
		let n = J(e.variant.priority, e.variant.preference), r = J(t.variant.priority, t.variant.preference);
		if (n != null || r != null) {
			let e = (n ?? Infinity) - (r ?? Infinity);
			if (e !== 0) return e;
		}
		let a = String(e.variant.codec ?? e.variant.format ?? e.variant.id).toLowerCase(), o = String(t.variant.codec ?? t.variant.format ?? t.variant.id).toLowerCase();
		return (i.get(a) ?? 99) - (i.get(o) ?? 99) || e.index - t.index;
	}).map(({ variant: e }) => e);
}
var W = "MPSND1", we = 1, Te = 4096, Ee = 14;
function De(e) {
	return new TextEncoder().encode(e);
}
function Oe(e) {
	let t = e.reduce((e, t) => e + t.length, 0), n = new Uint8Array(t), r = 0;
	for (let t of e) n.set(t, r), r += t.length;
	return n;
}
var ke = new Uint32Array([
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
function G(e) {
	let t = Oe(e), n = t.length * 8, r = (t.length + 9 >> 6) + 1 << 6, i = new Uint8Array(r);
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
			let a = (h >>> 6 | h << 26) ^ (h >>> 11 | h << 21) ^ (h >>> 25 | h << 7), o = h & g ^ ~h & _, s = v + a + o + ke[e] + m[e] >>> 0, c = ((t >>> 2 | t << 30) ^ (t >>> 13 | t << 19) ^ (t >>> 22 | t << 10)) + (t & n ^ t & r ^ n & r) >>> 0;
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
function K(e, t, n) {
	let r = G([
		e,
		De(String(t)),
		De(n)
	]), i = [];
	for (let e = 0; e * 32 < Te; e += 1) {
		let t = /* @__PURE__ */ new Uint8Array(4);
		new DataView(t.buffer).setUint32(0, e, !0), i.push(G([r, t]));
	}
	return Oe(i).subarray(0, Te);
}
function Ae(e, t) {
	let n = new Uint8Array(e.length);
	for (let r = 0; r < e.length; r += 1) n[r] = e[r] ^ t[r % t.length];
	return n;
}
function je(e, t) {
	let n = new Uint8Array(e), r = new DataView(n.buffer, n.byteOffset, n.byteLength);
	if (new TextDecoder().decode(n.subarray(0, 6)) !== W) throw Error("not a sound pack");
	let i = r.getUint16(6, !0);
	if (i !== we) throw Error(`unsupported pack version ${i}`);
	let a = r.getUint16(8, !0), o = r.getUint32(10, !0), s = n.subarray(Ee, Ee + a), c = Ee + a, l = c + o, u = K(s, t, "index"), d = K(s, t, "payload"), f = Ae(n.subarray(c, l), u);
	return {
		index: JSON.parse(new TextDecoder().decode(f)),
		payload: Ae(n.subarray(l), d)
	};
}
function Me(e) {
	return e.url ?? e.path ?? e.file ?? e.src;
}
function q(e, t) {
	if (!e || /^(?:data:|blob:|https?:|file:)/i.test(t)) return t;
	try {
		let n = e.endsWith("/") ? e : `${e}/`;
		return new URL(t, n).toString();
	} catch {
		return `${e}${e.endsWith("/") || e.endsWith("\\") ? "" : "/"}${t}`;
	}
}
function Ne(e, t) {
	let n = t || e, r = globalThis.document?.baseURI ?? globalThis.location?.href;
	try {
		let e = r ? new URL(n, r) : new URL(n);
		return new URL(".", e).toString();
	} catch {
		let e = String(n).split(/[?#]/, 1)[0].replaceAll("\\\\", "/"), t = e.lastIndexOf("/");
		return t >= 0 ? e.slice(0, t + 1) : "";
	}
}
function Pe(e, t, n) {
	let r = e.resolvedLoadPolicy ?? e.loadPolicy ?? t.resolvedLoadPlan?.[n] ?? t.loadPlan?.[n] ?? "buffer";
	if (typeof r == "string") return { mode: r };
	if (H(r)) return {
		...r,
		mode: r.mode ?? r.type ?? r.strategy ?? "buffer"
	};
	throw TypeError(`asset ${n} has an invalid load policy`);
}
function Fe(e, t) {
	if (e == null) return t;
	if (typeof e == "string") {
		let t = m[e];
		if (!t) throw TypeError(`unknown spatial profile ${e}`);
		return t;
	}
	if (H(e)) {
		let n = t;
		if (e.id != null && (n = m[e.id], !n)) throw TypeError(`unknown spatial profile ${e.id}`);
		return {
			...n,
			...e
		};
	}
	throw TypeError("spatial profile must be a profile id or a partial profile object");
}
function Ie(e) {
	let t = e?.spatial;
	if (!H(t)) return null;
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
function Le(e) {
	return H(e?.spatial) && e.spatial.doppler === !0;
}
function Re(e) {
	try {
		e?.disconnect?.();
	} catch {}
}
function J(...e) {
	for (let t of e) if (Number.isFinite(Number(t))) return Number(t);
}
function ze(e) {
	return e ? {
		x: Number(e.x ?? e[0] ?? 0),
		y: Number(e.y ?? e[1] ?? 0),
		z: Number(e.z ?? e[2] ?? 0)
	} : null;
}
function Y(e, t, n = {}) {
	let r = Error(t);
	return r.name = "SoundRuntimeError", r.code = e, r.details = Object.freeze({ ...n }), r;
}
function Be(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function Ve(e, t, n) {
	if (Number.isFinite(e.playbackRate) && e.playbackRate > 0) return Number(e.playbackRate);
	let r = e.playbackRateRange;
	if (Array.isArray(r) && r.length === 2) {
		let e = Number(r[0]), i = Number(r[1]);
		if (Number.isFinite(e) && Number.isFinite(i) && e > 0 && i >= e) {
			let r = xe(`${t}:${n}:playback-rate`) / 4294967296;
			return e + (i - e) * r;
		}
	}
	let i = e.pitchSemitoneRange ?? e.pitchSemitones;
	if (Array.isArray(i) && i.length === 2) {
		let e = Number(i[0]), r = Number(i[1]);
		if (Number.isFinite(e) && Number.isFinite(r) && r >= e) {
			let i = xe(`${t}:${n}:pitch-semitones`) / 4294967296;
			return 2 ** ((e + (r - e) * i) / 12);
		}
	}
	return 1;
}
function X({ manifest: e, baseUrl: t = "", audioContextFactory: n, fetchImpl: r, mediaElementFactory: i, telemetrySink: a, now: o = () => Date.now(), spatialProfile: s } = {}) {
	if (!H(e)) throw TypeError("manifest is required");
	let c = me(e.assets, "assets"), l = me(e.cues, "cues"), u = me(e.buses, "buses"), d = he(e.mixStates, "mixStates"), f = he(e.musicStates, "musicStates"), p = he(e.duckRules, "duckRules"), g = H(e.voicePolicy) ? e.voicePolicy : {}, _ = null, v = null, y = /* @__PURE__ */ new Set(), b = !1, x = !1, C = /* @__PURE__ */ new Set(), w = null, T = [], E = null, D = !1, O = !1, k = !1, te = 0, A = null, j = null, M = null, ne = ee({ profile: Fe(s, m.three) }), N = { ...B }, re = /* @__PURE__ */ new Map(), ae = /* @__PURE__ */ new Map(), oe = /* @__PURE__ */ new Map(), P = /* @__PURE__ */ new Map(), F = [], I = /* @__PURE__ */ new Map(), R = /* @__PURE__ */ new Map(), z = /* @__PURE__ */ new Map(), se = [], ce = Math.max(1, Math.floor(J(e.loadPolicy?.maxConcurrentDecodes, e.runtimePolicy?.maxConcurrentDecodes, 3))), le = 0, V = {
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
	function W() {
		if (D) throw Error("sound runtime is disposed");
	}
	function we() {
		if (!D) {
			if (b || y.size > 0) {
				for (let e of P.values()) e.kind === "stream" && e.element && e.element.paused === !1 && (e.element.pause?.(), C.add(e));
				_ && _.state === "running" && typeof _.suspend == "function" && Promise.resolve(_.suspend()).catch(() => {}), x || (x = !0, G("sound_runtime_held", {
					pageHidden: b,
					holds: [...y].sort()
				}));
			} else if (x) {
				x = !1, O && _ && _.state === "suspended" && typeof _.resume == "function" && Promise.resolve(_.resume()).catch(() => {});
				for (let e of C) e.finalized || Promise.resolve(e.element?.play?.()).catch(() => Q(e, "stream-play-error"));
				C.clear(), G("sound_runtime_resumed", {});
			}
		}
	}
	let Te = typeof document == "object" && document ? document : null;
	function Ee() {
		b = Te.visibilityState === "hidden" || Te.hidden === !0, we();
	}
	Te?.addEventListener && (Te.addEventListener("visibilitychange", Ee), b = Te.visibilityState === "hidden" || Te.hidden === !0);
	function De(e, t) {
		if (W(), typeof e != "string" || !e) throw TypeError("setHold requires a non-empty string id");
		return t === !0 ? y.add(e) : y.delete(e), we(), Object.freeze({
			type: "hold",
			status: x ? "held" : "released",
			holds: Object.freeze([...y].sort())
		});
	}
	function Oe() {
		if (!D) for (; le < ce && se.length > 0;) {
			let e = se.shift();
			le += 1, Promise.resolve().then(e.task).then(e.resolve, e.reject).finally(() => {
				--le, Oe();
			});
		}
	}
	function ke(e) {
		return W(), new Promise((t, n) => {
			se.push({
				task: e,
				resolve: t,
				reject: n
			}), Oe();
		});
	}
	function G(t, n = {}) {
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
			V.telemetryErrors += 1;
		}
	}
	function K(e) {
		return F.push(e), F.length > fe && F.shift(), e;
	}
	function Ae() {
		return xe(JSON.stringify({
			muted: k,
			userVolumes: de.map((e) => [e, N[e]]),
			mixStates: [...I.keys()].sort(),
			musicStateId: A
		})).toString(16).padStart(8, "0");
	}
	function Ne() {
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
	Ne();
	function X() {
		if (typeof n == "function") return n;
		let e = globalThis.AudioContext ?? globalThis.webkitAudioContext;
		if (!e) throw Error("audioContextFactory is required in this environment");
		return () => new e();
	}
	function He(t) {
		let n = e.masterSafety;
		if (!H(n) || typeof t.createDynamicsCompressor != "function") return null;
		let r = t.createDynamicsCompressor(), i = t.currentTime;
		return U(r.threshold, J(n.thresholdDb, n.threshold), i), U(r.knee, J(n.kneeDb, n.knee), i), U(r.ratio, J(n.ratio), i), U(r.attack, J(n.attackSeconds, n.attack), i), U(r.release, J(n.releaseSeconds, n.release), i), r.connect(t.destination), r;
	}
	function Ue(e) {
		let t = e, n = /* @__PURE__ */ new Set();
		for (; t && !n.has(t);) {
			n.add(t);
			let e = u.get(t), r = e.userVolume ?? e.userCategory ?? e.category;
			if (de.includes(r)) return r;
			if (de.includes(t)) return t;
			t = e.parent ?? e.parentId ?? e.output ?? null;
		}
		return null;
	}
	function We(e) {
		let t = /* @__PURE__ */ new Map();
		for (let [n, r] of u) {
			let i = e.createGain(), a = e.createGain(), o = e.createGain(), s = e.createGain(), c = e.createGain();
			i.connect(a), a.connect(o), o.connect(s), s.connect(c), U(a.gain, ge(r.gainDb ?? 0), e.currentTime), U(o.gain, 1, e.currentTime), U(s.gain, 1, e.currentTime), U(c.gain, 1, e.currentTime), t.set(n, {
				id: n,
				definition: r,
				parentId: r.parent ?? r.parentId ?? r.output ?? null,
				userCategory: Ue(n),
				input: i,
				canonical: a,
				mix: o,
				duck: s,
				user: c,
				mixDb: 0,
				duckDb: 0
			});
		}
		w = He(e);
		let n = [];
		for (let r of t.values()) r.parentId ? r.user.connect(t.get(r.parentId).input) : (r.user.connect(w ?? e.destination), n.push(r.user));
		return T = w ? [w] : n, t;
	}
	function Ge() {
		W();
		let e = Ke();
		if (!E) {
			if (typeof e.createMediaStreamDestination != "function") throw Y("SOUND_RECORDING_UNSUPPORTED", "this AudioContext cannot create a MediaStreamDestination");
			E = e.createMediaStreamDestination();
			for (let e of T) e.connect(E);
		}
		return E.stream;
	}
	function Ke() {
		if (W(), !_) {
			if (_ = X()(), !_ || typeof _.createGain != "function") throw TypeError("audioContextFactory returned an invalid AudioContext");
			v = We(_), Ye();
		}
		return _;
	}
	function qe(e) {
		Ke();
		let t = v.get(e);
		if (!t) throw Error(`unknown bus ${e}`);
		return t;
	}
	function Je(e) {
		let t = e.userCategory ? _e(N[e.userCategory]) : 1;
		return e.id === "master" && k && (t = 0), t;
	}
	function Ye() {
		if (v && _) for (let e of v.values()) U(e.user.gain, Je(e), _.currentTime);
	}
	function Xe(e, t) {
		let n = e, r = /* @__PURE__ */ new Set();
		for (; n && !r.has(n);) {
			if (n === t) return !0;
			r.add(n);
			let e = u.get(n);
			n = e?.parent ?? e?.parentId ?? e?.output ?? null;
		}
		return !1;
	}
	function Z() {
		return J(g.globalMax, g.maxVoices, g.globalMaxVoices) ?? Infinity;
	}
	function Ze(e) {
		return J((g.busMax ?? g.busMaxVoices ?? {})[e], u.get(e)?.maxVoices);
	}
	function Qe(e) {
		return [...e].sort((e, t) => {
			let n = e.priority - t.priority;
			if (n !== 0) return n;
			let r = e.startedAt - t.startedAt;
			return r === 0 ? e.sequence - t.sequence : r;
		})[0];
	}
	function Q(e, t, { emitReceipt: n = !0 } = {}) {
		if (!e || e.finalized) return null;
		e.finalized = !0, P.delete(e.instanceId), e.emitter?.voices?.delete(e), j === e.instanceId && (j = null), e.startTimer && clearTimeout(e.startTimer), e.stopTimer && clearTimeout(e.stopTimer);
		try {
			e.kind === "stream" ? (e.element?.pause?.(), e.element && "src" in e.element && t === "dispose" && (e.element.removeAttribute?.("src"), e.element.load?.())) : t !== "ended" && e.source?.stop?.(_?.currentTime ?? 0);
		} catch {}
		for (let t of e.nodes ?? []) Re(t);
		if (st(e), e.status = t === "ended" ? "ended" : "stopped", e.endedAt = _?.currentTime ?? null, e.stopReason = t, !n) return null;
		let r = K(Object.freeze({
			type: "stop",
			status: e.status,
			instanceId: e.instanceId,
			cueId: e.cueId,
			eventId: e.eventId,
			reason: t,
			endedAt: e.endedAt
		}));
		return G("sound_voice_stopped", r), r;
	}
	function $e(e, t, n) {
		let r = Qe(e);
		return !r || r.priority > t ? !1 : (V.steals += 1, Q(r, `stolen:${n}`), G("sound_voice_stolen", {
			instanceId: r.instanceId,
			cueId: r.cueId,
			scope: n,
			replacementPriority: t
		}), !0);
	}
	function et(e, t, n, r) {
		let i = Math.max(0, Z());
		for (; P.size >= i;) if (!$e(P.values(), r, "global")) return "global";
		let a = J(t.polyphony, t.maxVoices, t.voiceLimit, g.defaultCueMax) ?? Infinity, o = [...P.values()].filter((t) => t.cueId === e);
		for (; o.length >= a;) {
			if (!$e(o, r, `cue:${e}`)) return `cue:${e}`;
			o = [...P.values()].filter((t) => t.cueId === e);
		}
		for (let e of u.keys()) {
			let t = Ze(e);
			if (t == null || !Xe(n, e)) continue;
			let i = [...P.values()].filter((t) => Xe(t.busId, e));
			for (; i.length >= Math.max(0, t);) {
				if (!$e(i, r, `bus:${e}`)) return `bus:${e}`;
				i = [...P.values()].filter((t) => Xe(t.busId, e));
			}
		}
		return null;
	}
	function tt(e, t) {
		let n = (e.busGainsDb ?? e.buses ?? e.gainsDb ?? {})[t];
		return Number.isFinite(n) ? Number(n) : H(n) ? J(n.gainDb, n.db) ?? 0 : 0;
	}
	function $() {
		if (v && _) for (let e of v.values()) {
			let t = 0;
			for (let n of I.keys()) t += tt(d.get(n), e.id);
			e.mixDb = t, U(e.mix.gain, ge(t), _.currentTime);
		}
	}
	function nt(e) {
		return e.targetBus ?? e.targetBusId ?? e.bus;
	}
	function rt(e) {
		let t = J(e.reductionDb, e.maxReductionDb);
		return t == null ? Math.min(0, J(e.gainDb, e.db) ?? 0) : -Math.abs(t);
	}
	function it(e) {
		let t = 0;
		for (let n of R.values()) n.phase !== "idle" && nt(n.rule) === e && (t += rt(n.rule));
		return t;
	}
	function at(e, { attackMs: t = 0, releaseMs: n = 0, holdMs: r = 0, releasing: i = !1 } = {}) {
		if (!v || !_) return;
		let a = v.get(e);
		if (!a) throw Error(`duck rule references unknown bus ${e}`);
		let o = _.currentTime, s = it(e);
		a.duckDb = s, be(a.duck.gain, o);
		let c = Number.isFinite(a.duck.gain.value) ? a.duck.gain.value : 1;
		if (U(a.duck.gain, c, o), i) {
			let e = o + r / 1e3;
			r > 0 && U(a.duck.gain, c, e), ye(a.duck.gain, ge(s), e + n / 1e3);
		} else ye(a.duck.gain, ge(s), o + t / 1e3);
	}
	function ot(e, t, n) {
		if (!t) return;
		let r = p.get(t);
		if (!r) throw Error(`cue ${e.cueId} references unknown duck rule ${t}`);
		let i = nt(r);
		if (!i) throw Error(`duck rule ${t} has no target bus`);
		let a = R.get(t);
		a || (a = {
			id: t,
			rule: r,
			voices: /* @__PURE__ */ new Set(),
			phase: "active",
			releaseTimer: null
		}, R.set(t, a)), a.releaseTimer && clearTimeout(a.releaseTimer), a.releaseTimer = null, a.phase = "active", a.voices.add(e.instanceId), e.duckRuleId = t;
		let o = Math.max(0, J(r.attackMs) ?? 0), s = qe(i), c = Math.max(_.currentTime, n ?? _.currentTime);
		be(s.duck.gain, c), U(s.duck.gain, s.duck.gain.value, c), s.duckDb = it(i), ye(s.duck.gain, ge(s.duckDb), c + o / 1e3), G("sound_duck_started", {
			ruleId: t,
			targetBusId: i,
			instanceId: e.instanceId
		});
	}
	function st(e) {
		let t = e.duckRuleId;
		if (!t) return;
		let n = R.get(t);
		if (!n || (n.voices.delete(e.instanceId), n.voices.size > 0)) return;
		n.phase = "releasing";
		let r = nt(n.rule), i = Math.max(0, J(n.rule.holdMs) ?? 0), a = Math.max(0, J(n.rule.releaseMs) ?? 0);
		R.delete(t), at(r, {
			holdMs: i,
			releaseMs: a,
			releasing: !0
		}), R.set(t, n), n.releaseTimer = setTimeout(() => {
			n.voices.size === 0 && (R.delete(t), at(r), G("sound_duck_ended", {
				ruleId: t,
				targetBusId: r
			}));
		}, i + a);
	}
	async function ct(n) {
		if (ae.has(n)) return ae.get(n);
		let i = e.packs?.[n];
		if (!i) throw Error(`unknown pack ${n}`);
		if (typeof r != "function") throw Error("fetchImpl is required to load sound packs");
		let a = (async () => {
			let n = await r(q(t, i.url));
			if (!n || n.ok === !1 || typeof n.arrayBuffer != "function") throw Error(`pack fetch failed${n?.status ? ` (${n.status})` : ""}`);
			return je(await n.arrayBuffer(), e.contentHash);
		})();
		ae.set(n, a);
		try {
			return await a;
		} catch (e) {
			throw ae.delete(n), e;
		}
	}
	async function lt(e) {
		if (!e.pack) return null;
		let { payload: t } = await ct(e.pack.id), n = e.pack.offset, r = n + e.pack.length;
		if (r > t.length) throw Error(`pack slice out of range for ${e.id}`);
		return t.slice(n, r).buffer;
	}
	async function ut(e, t) {
		let n = `${e}:${t.id}`, r = oe.get(n);
		if (r) return r;
		let i = await lt(t);
		if (!i) return null;
		if (typeof URL?.createObjectURL != "function" || typeof Blob != "function") throw Error("Blob/createObjectURL are required to stream packed audio");
		let a = URL.createObjectURL(new Blob([i], { type: t.mimeType ?? "application/octet-stream" }));
		return oe.set(n, a), a;
	}
	function dt() {
		for (let e of oe.values()) try {
			URL.revokeObjectURL?.(e);
		} catch {}
		oe.clear();
	}
	async function ft(e, t) {
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
	async function pt(e) {
		if (re.has(e)) return re.get(e);
		if (typeof r != "function") throw Error("fetchImpl is required to load buffer assets");
		let n = c.get(e);
		if (!n) throw Error(`unknown asset ${e}`);
		let i = Ce(n, e);
		if (i.length === 0) throw Error(`asset ${e} has no variants`);
		let a = Ke(), o = ke(async () => {
			let o = [];
			for (let s = 0; s < i.length; s += 1) {
				let c = i[s], l = c.pack ? `pack:${c.pack.id}` : q(t, Me(c));
				try {
					let t = await lt(c);
					if (t === null) {
						let e = await r(l, { signal: void 0 });
						if (!e || e.ok === !1 || typeof e.arrayBuffer != "function") throw Error(`fetch failed${e?.status ? ` (${e.status})` : ""}`);
						t = await e.arrayBuffer();
					}
					let i = await ft(a, t);
					return V.assetLoads += 1, s > 0 && (V.decodeFallbacks += 1), G("sound_asset_loaded", {
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
					o.push(`${c.id}: ${t.message}`), G("sound_variant_failed", {
						assetId: e,
						variantId: c.id,
						mode: "buffer"
					});
				}
			}
			throw Error(`all variants failed for ${e}: ${o.join("; ")}`);
		});
		re.set(e, o);
		try {
			return await o;
		} catch (t) {
			throw re.delete(e), t;
		}
	}
	function mt(e, t, n, r, i) {
		let a = r ? ne.createPanner(_, r.position, r.params) : null;
		return i.panner = a, a && (i.pushedPosition = r.position), a ? (e.connect(a), a.connect(t)) : e.connect(t), t.connect(n.input), a ? [
			e,
			a,
			t
		] : [e, t];
	}
	function ht({ voice: e, at: t, position: n, loadPolicy: r, cue: i }) {
		let a = J(i.transientAnchorMs) ?? 0;
		return {
			type: "play",
			status: t > _.currentTime + .001 ? "scheduled" : "playing",
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
			startedAt: _.currentTime,
			audioStartedAt: _.currentTime,
			audioTransientAt: t + a / 1e3,
			position: ze(n),
			priority: e.priority,
			loadPolicy: r,
			syncRole: i.syncRole ?? null,
			transientAnchorMs: a,
			duckRuleId: i.duckRule ?? i.duckRuleId ?? null,
			gainDb: J(i.gainDb) ?? 0,
			playbackRate: e.playbackRate,
			stateHash: Ae(),
			guard: "admitted"
		};
	}
	function gt({ cueId: e, eventId: t, seed: n, reason: r, at: i = null }) {
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
		return K(a), G("sound_cue_suppressed", a), a;
	}
	async function _t({ voice: e, cue: t, assetId: n, spatialPlan: r, at: i, loadPolicy: a }) {
		let o = await pt(n), s = et(e.cueId, t, e.busId, e.priority);
		if (s) return V.budgetSuppressions += 1, gt({
			cueId: e.cueId,
			eventId: e.eventId,
			seed: e.seed,
			reason: `voice-budget:${s}`,
			at: i
		});
		let c = qe(e.busId), l = _.createBufferSource(), u = _.createGain();
		return l.buffer = o.buffer, l.loop = !!(t.loop ?? o.asset.loop ?? a.loop), l.playbackRate && U(l.playbackRate, e.playbackRate, _.currentTime), e.baseGain = ge(t.gainDb ?? 0) * (r?.levelGain ?? 1), e.gainNode = u, e.fadeInMs > 0 ? (U(u.gain, 0, i), ve(u.gain, e.baseGain, i + e.fadeInMs / 1e3)) : U(u.gain, e.baseGain, _.currentTime), e.kind = "buffer", e.source = l, e.nodes = mt(l, u, c, r, e), e.variantId = o.variant.id, e.variantUrl = o.url, e.assetVariantHash = o.variant.sha256 ?? o.variant.hash ?? null, e.codec = o.variant.codec ?? o.variant.format ?? o.variant.id, e.status = i > _.currentTime + .001 ? "scheduled" : "playing", P.set(e.instanceId, e), l.onended = () => Q(e, "ended"), ot(e, t.duckRule ?? t.duckRuleId, i), l.start(i, Math.max(0, Number(a.offsetSeconds ?? 0))), null;
	}
	async function vt({ voice: e, cue: n, assetId: r, spatialPlan: a, at: o, loadPolicy: s }) {
		let l = c.get(r), u = Ce(l, r);
		if (u.length === 0) throw Error(`asset ${r} has no variants`);
		let d = et(e.cueId, n, e.busId, e.priority);
		if (d) return V.budgetSuppressions += 1, gt({
			cueId: e.cueId,
			eventId: e.eventId,
			seed: e.seed,
			reason: `voice-budget:${d}`,
			at: o
		});
		if (typeof i != "function") throw Y("SOUND_MEDIA_FACTORY_REQUIRED", "mediaElementFactory is required to stream assets", {
			assetId: r,
			cueId: e.cueId
		});
		let f = i, p = qe(e.busId), m = [];
		for (let i = 0; i < u.length; i += 1) {
			let c = u[i], d = await ut(r, c) ?? q(t, Me(c)), h, g, v, y;
			try {
				if (h = f(d, {
					assetId: r,
					variant: c,
					cueId: e.cueId
				}), !h) throw Error("mediaElementFactory returned no element");
				h.crossOrigin ?? (h.crossOrigin = "anonymous");
				let t = c.mimeType ?? c.mime;
				if (t && typeof h.canPlayType == "function" && h.canPlayType(t) === "") throw Error(`unsupported MIME type ${t}`);
				"src" in h && !h.src && (h.src = d), h.preload = s.preload ?? "auto", h.loop = !!(n.loop ?? l.loop ?? s.loop), g = _.createMediaElementSource(h), v = _.createGain(), e.baseGain = ge(n.gainDb ?? 0) * (a?.levelGain ?? 1), e.gainNode = v, e.fadeInMs > 0 ? (U(v.gain, 0, o), ve(v.gain, e.baseGain, o + e.fadeInMs / 1e3)) : U(v.gain, e.baseGain, _.currentTime), y = mt(g, v, p, a, e), e.kind = "stream", e.element = h, e.source = g, e.nodes = y, e.variantId = c.id, e.variantUrl = d, e.assetVariantHash = c.sha256 ?? c.hash ?? null, e.codec = c.codec ?? c.format ?? c.id, "playbackRate" in h && (h.playbackRate = e.playbackRate), e.status = o > _.currentTime + .001 ? "scheduled" : "playing", h.addEventListener?.("ended", () => Q(e, "ended"), { once: !0 }), P.set(e.instanceId, e), ot(e, n.duckRule ?? n.duckRuleId, o);
				let u = async () => {
					if (e.finalized) return;
					if (x) {
						C.add(e), e.status = "playing";
						return;
					}
					let t = h.play?.();
					t && typeof t.then == "function" && await t, e.status = "playing";
				}, m = Math.max(0, (o - _.currentTime) * 1e3);
				return m > 1 ? e.startTimer = setTimeout(() => {
					u().catch(() => Q(e, "stream-play-error"));
				}, m) : await u(), i > 0 && (V.streamFallbacks += 1), V.assetLoads += 1, G("sound_asset_loaded", {
					assetId: r,
					variantId: c.id,
					mode: "stream"
				}), null;
			} catch (t) {
				m.push(`${c.id}: ${t.message}`), P.get(e.instanceId) === e && P.delete(e.instanceId), st(e), e.duckRuleId = null;
				try {
					h?.pause?.();
				} catch {}
				for (let e of y ?? [g, v]) Re(e);
				G("sound_variant_failed", {
					assetId: r,
					variantId: c.id,
					mode: "stream"
				});
			}
		}
		throw Error(`all stream variants failed for ${r}: ${m.join("; ")}`);
	}
	async function yt() {
		W();
		let e = Ke();
		e.state === "suspended" && typeof e.resume == "function" && await e.resume(), O = e.state === "running" || e.state == null, we();
		let t = Object.freeze({
			type: "unlock",
			status: O ? "running" : e.state
		});
		return K(t), G("sound_runtime_unlocked", { status: t.status }), t;
	}
	async function bt(t) {
		W(), Ke();
		let n = [];
		for (let [r, i] of c) {
			let a = Pe(i, e, r);
			if (a.mode !== "buffer") continue;
			let o = a.group ?? a.preloadGroup ?? i.group ?? i.preloadGroup;
			(t == null || o === t) && n.push(r);
		}
		let r = await Promise.allSettled(n.map((e) => pt(e))), i = Object.freeze({
			group: t ?? null,
			requested: n.length,
			loaded: r.filter((e) => e.status === "fulfilled").length,
			failed: r.filter((e) => e.status === "rejected").length,
			assets: n.map((e, t) => ({
				assetId: e,
				status: r[t].status
			}))
		});
		return G("sound_preload_completed", i), i;
	}
	function xt({ cueId: e, cue: t, eventId: n, emitter: r, position: i, loadPolicy: a }) {
		if (!(r || i)) return null;
		if (!ne.hasListener()) {
			if (r) throw Y("SOUND_LISTENER_MISSING", `spatial playback of ${e} requires setListener() to be called first`, {
				cueId: e,
				hint: "attachThree/attachPixi/attachPhaser 会每帧代劳；裸用 core 时自己喂听者"
			});
			return V.spatialDegradations += 1, G("sound_spatial_degraded", {
				cueId: e,
				eventId: n ?? null,
				reason: "listener-missing"
			}), { degraded: {
				status: "degraded",
				reason: "listener-missing"
			} };
		}
		let o = r ? r.position : S(i);
		if (!o) throw Y("SOUND_POSITION_INVALID", `position for ${e} must be a vector`, { cueId: e });
		let s = ne.resolveParams(Ie(t), r?.overrides), c = !1;
		if (Le(t)) {
			if (a.mode !== "buffer") throw Y("SOUND_DOPPLER_REQUIRES_BUFFER", `cue ${e} enables doppler but resolves to a ${a.mode} asset`, {
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
			levelGain: h(s)
		};
	}
	async function St(t, { eventId: n, seed: r, at: i, position: a, pitchSemitones: s, playbackRate: d, emitter: f, __emitter: p, __fadeInMs: m = 0 } = {}) {
		W();
		let h = l.get(t);
		if (!h) throw Y("SOUND_CUE_UNKNOWN", `unknown cue ${t}`, { cueId: t });
		if (f !== void 0) throw Y("SOUND_EMITTER_HANDLE_MISUSE", `playCue(${t}, { emitter }) is not supported; call emitter.play(cueId) instead`, { cueId: t });
		if (p?.disposed) throw Y("SOUND_EMITTER_DISPOSED", `emitter for ${t} is disposed`, { cueId: t });
		let g = Ke(), _ = String(r ?? n ?? `${t}:default`), v = Number.isFinite(i) ? Math.max(g.currentTime, Number(i)) : g.currentTime;
		if (!O) {
			let r = e.runtimePolicy?.lockedPlayback ?? e.lockedPolicy ?? "reject";
			if (r === "drop") return gt({
				cueId: t,
				eventId: n,
				seed: _,
				reason: "locked",
				at: v
			});
			throw Y("SOUND_CONTEXT_LOCKED", "sound runtime must be unlocked from a user gesture before playback", {
				cueId: t,
				eventId: n ?? null,
				lockedPolicy: r
			});
		}
		let y = Math.max(0, J(h.cooldownMs, h.cooldown) ?? 0), b = o(), x = z.get(t);
		if (x != null && b - x < y) return V.cooldownSuppressions += 1, gt({
			cueId: t,
			eventId: n,
			seed: _,
			reason: "cooldown",
			at: v
		});
		let S = Se(h, t, _), C = c.get(S);
		if (!C) throw Error(`cue ${t} references unknown asset ${S}`);
		let w = h.bus ?? h.busId;
		if (!w || !u.has(w)) throw Error(`cue ${t} references unknown bus ${w}`);
		let T = Pe(C, e, S);
		if (!["buffer", "stream"].includes(T.mode)) throw Error(`asset ${S} has unsupported load policy ${T.mode}`);
		let E = xt({
			cueId: t,
			cue: h,
			eventId: n,
			emitter: p,
			position: a,
			loadPolicy: T
		});
		z.set(t, b);
		let D = E?.degraded ?? null, k = D ? null : E, ee = p ? p.stopEpoch : 0, A = `sound-${++te}`, j = J(h.priority) ?? 0, M = {
			sequence: te,
			instanceId: A,
			cueId: t,
			assetId: S,
			busId: w,
			eventId: n ?? null,
			seed: _,
			priority: j,
			requestedAt: g.currentTime,
			startedAt: g.currentTime,
			scheduledAt: v,
			playbackRate: Be(Ve(h, t, _) * (Number.isFinite(d) && d > 0 ? Number(d) : 1) * (Number.isFinite(s) ? 2 ** (Be(Number(s), -24, 24) / 12) : 1), .25, 4),
			fadeInMs: Math.max(0, J(m) ?? 0),
			status: "loading",
			position: ze(k?.position ?? a),
			finalized: !1,
			panner: null,
			pushedPosition: null,
			emitter: k?.emitter ?? null,
			doppler: k?.doppler ?? !1,
			params: k?.params ?? null,
			dopplerRatio: 1,
			appliedRate: void 0
		};
		try {
			let e = T.mode === "stream" ? await vt({
				voice: M,
				cue: h,
				assetId: S,
				spatialPlan: k,
				at: v,
				loadPolicy: T
			}) : await _t({
				voice: M,
				cue: h,
				assetId: S,
				spatialPlan: k,
				at: v,
				loadPolicy: T
			});
			if (e) return e;
			if (M.emitter) {
				if (M.emitter.disposed || M.emitter.stopEpoch !== ee) return Q(M, "emitter-cancelled", { emitReceipt: !1 }), gt({
					cueId: t,
					eventId: n,
					seed: _,
					reason: "emitter-cancelled",
					at: v
				});
				M.emitter.voices.add(M);
			}
			let r = Object.freeze({
				...ht({
					voice: M,
					at: v,
					position: k?.position ?? a,
					loadPolicy: T.mode,
					cue: h
				}),
				variantId: M.variantId,
				spatial: k ? {
					status: "spatial",
					emitterId: k.emitter?.id ?? null,
					doppler: k.doppler
				} : D
			});
			return K(r), G("sound_cue_played", r), r;
		} catch (e) {
			throw V.playErrors += 1, P.get(A) === M && Q(M, "play-error", { emitReceipt: !1 }), G("sound_cue_failed", {
				cueId: t,
				assetId: S,
				eventId: n ?? null,
				message: e.message
			}), e;
		}
	}
	function Ct(e, t, n = "music-crossfade") {
		let r = P.get(e);
		if (!r) return null;
		let i = Math.max(0, J(t) ?? 0);
		if (i === 0 || !r.gainNode?.gain || !_) return Q(r, n);
		let a = _.currentTime, o = r.gainNode.gain;
		return be(o, a), U(o, Number.isFinite(o.value) ? o.value : r.baseGain, a), ve(o, 0, a + i / 1e3), r.status = "fading-out", r.stopTimer = setTimeout(() => Q(r, n), i), Object.freeze({
			type: "fade-out",
			status: "scheduled",
			instanceId: e,
			cueId: r.cueId,
			durationMs: i,
			reason: n
		});
	}
	function wt() {
		return M ? M.cueId : (j && P.get(j)?.cueId) ?? null;
	}
	function Tt(e, t) {
		return Object.freeze({
			...e,
			type: "music",
			eventId: t.eventId ?? null,
			previousInstanceId: null,
			crossfadeMs: 0,
			unchanged: !0
		});
	}
	async function Et(e, t = {}) {
		W();
		let n = Math.max(0, J(t.crossfadeMs, t.fadeMs) ?? 0);
		if (M?.cueId === e) return Tt(await M.promise, t);
		let r = j ? P.get(j) : null;
		if (r?.cueId === e) return M = null, Tt({
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
		return M = i, i.promise = Dt(i, t, n), i.promise;
	}
	async function Dt(e, t, n) {
		let r;
		try {
			r = await St(e.cueId, {
				...t,
				__fadeInMs: n
			});
		} catch (t) {
			throw M === e && (M = null), t;
		}
		if (M !== e) {
			let i = r.instanceId ? P.get(r.instanceId) : null;
			i && Q(i, "music-superseded", { emitReceipt: !1 });
			let a = r.status === "suppressed" ? r : gt({
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
		M = null;
		let i = j;
		return (r.status === "playing" || r.status === "scheduled") && (j = r.instanceId, i && i !== r.instanceId && Ct(i, n)), Object.freeze({
			...r,
			type: "music",
			previousInstanceId: i,
			crossfadeMs: n
		});
	}
	async function Ot(e, t = {}) {
		W();
		let n = f.get(e) ?? d.get(e);
		if (!n) throw Error(`unknown music state ${e}`);
		let r = n.mixStateId ?? (d.has(e) ? e : null), i = Object.hasOwn(n, "cueId") || Object.hasOwn(n, "musicCueId"), a = Object.hasOwn(n, "cueId") ? n.cueId : n.musicCueId, o = !i || (a == null ? j == null && M == null : wt() === a);
		if (e === A && o && (r == null || I.has(r))) {
			let n = a ? await Et(a, t) : null;
			return Object.freeze({
				type: "music-state",
				status: "unchanged",
				stateId: e,
				previousStateId: e,
				eventId: t.eventId ?? null,
				instanceId: n?.instanceId ?? j
			});
		}
		let s = A;
		A = e;
		let c = (s ? f.get(s) : null)?.mixStateId ?? (s && d.has(s) ? s : null);
		c && kt(c, {
			active: !1,
			eventId: t.eventId
		}), r && kt(r, {
			active: !0,
			eventId: t.eventId
		});
		let l = Math.max(0, J(t.crossfadeMs, n.crossfadeMs) ?? 0), u = null;
		if (i && a == null) {
			let e = j;
			j = null, M = null, e && Ct(e, l, "music-silent-state");
		} else a && (u = await Et(a, {
			...t,
			crossfadeMs: l
		}));
		let p = Object.freeze({
			type: "music-state",
			status: "active",
			stateId: e,
			previousStateId: s,
			eventId: t.eventId ?? null,
			instanceId: u?.instanceId ?? j
		});
		return K(p), G("sound_music_state_changed", p), p;
	}
	function kt(e, { active: t = !0, eventId: n } = {}) {
		if (W(), !d.has(e)) throw Error(`unknown mix state ${e}`);
		Ke(), t ? I.set(e, { eventId: n ?? null }) : I.delete(e), $();
		let r = Object.freeze({
			type: "mix-state",
			status: t ? "active" : "inactive",
			stateId: e,
			eventId: n ?? null
		});
		return K(r), G("sound_mix_state_changed", r), r;
	}
	function At(e) {
		if (W(), !H(e)) throw TypeError("volume settings must be an object");
		for (let t of Object.keys(e)) {
			if (!de.includes(t)) throw TypeError(`unknown user volume ${t}`);
			let n = e[t];
			if (!Number.isFinite(n) || n < 0 || n > 1) throw RangeError(`${t} volume must be between 0 and 1`);
		}
		Object.assign(N, e), Ke(), Ye();
		let t = Object.freeze({
			type: "user-volumes",
			status: "applied",
			volumes: { ...N }
		});
		return K(t), G("sound_user_volumes_changed", { volumes: { ...N } }), t;
	}
	function jt(e) {
		if (W(), typeof e != "boolean") throw TypeError("muted must be boolean");
		k = e, Ke(), Ye();
		let t = Object.freeze({
			type: "mute",
			status: k ? "muted" : "unmuted"
		});
		return K(t), G("sound_mute_changed", { muted: k }), t;
	}
	function Mt(e) {
		W();
		let t = P.get(e);
		return t ? Q(t, "requested") : null;
	}
	function Nt() {
		for (let e of R.values()) e.releaseTimer && clearTimeout(e.releaseTimer);
		if (R.clear(), v && _) for (let e of v.values()) e.duckDb = 0, be(e.duck.gain, _.currentTime), U(e.duck.gain, 1, _.currentTime);
	}
	function Pt(e = "voices") {
		W();
		let t = typeof e == "string" ? { type: e } : { ...e }, n = t.type ?? t.scope ?? "voices", r = [...P.values()];
		if (n === "music") r = r.filter((e) => Xe(e.busId, "music"));
		else if (n === "sfx") r = r.filter((e) => Xe(e.busId, "sfx"));
		else if (n === "bus") r = r.filter((e) => Xe(e.busId, t.busId));
		else if (n === "cue") r = r.filter((e) => e.cueId === t.cueId);
		else if (["cache", "receipts"].includes(n)) r = [];
		else if (!["voices", "all"].includes(n)) throw Error(`unknown clear scope ${n}`);
		for (let e of r) Q(e, "clear");
		(n === "cache" || n === "all") && re.clear(), (n === "receipts" || n === "all") && (F.length = 0), n === "all" && (dt(), Nt(), I.clear(), $(), z.clear(), A = null);
		let i = Object.freeze({
			type: "clear",
			status: "cleared",
			scope: n,
			stopped: r.length
		});
		return K(i), G("sound_runtime_cleared", i), i;
	}
	function Ft() {
		let t = v;
		return Object.freeze({
			disposed: D,
			unlocked: O,
			context: _ ? {
				state: _.state ?? "unknown",
				currentTime: _.currentTime
			} : {
				state: "not-created",
				currentTime: null
			},
			manifest: {
				schemaVersion: e.schemaVersion ?? null,
				contentHash: e.contentHash ?? null
			},
			muted: k,
			suspension: {
				held: x,
				pageHidden: b,
				holds: [...y].sort()
			},
			userVolumes: { ...N },
			activeMixStates: [...I.keys()],
			music: {
				stateId: A,
				instanceId: j
			},
			buses: t ? [...t.values()].map((e) => ({
				id: e.id,
				parentId: e.parentId,
				userCategory: e.userCategory,
				canonicalGainDb: J(e.definition.gainDb) ?? 0,
				mixGainDb: e.mixDb,
				duckGainDb: e.duckDb,
				userGain: Je(e),
				currentUserGain: e.user.gain?.value ?? null,
				voiceCount: [...P.values()].filter((t) => Xe(t.busId, e.id)).length
			})) : [...u.entries()].map(([e, t]) => ({
				id: e,
				parentId: t.parent ?? t.parentId ?? t.output ?? null,
				userCategory: Ue(e),
				canonicalGainDb: J(t.gainDb) ?? 0,
				mixGainDb: 0,
				duckGainDb: 0,
				userGain: null,
				voiceCount: 0
			})),
			voices: [...P.values()].map((e) => ({
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
			ducks: [...R.values()].map((e) => ({
				id: e.id,
				targetBusId: nt(e.rule),
				reductionDb: rt(e.rule),
				phase: e.phase,
				triggerCount: e.voices.size
			})),
			cache: [...re.keys()],
			diagnostics: {
				...V,
				decodedBufferBytes: [...re.keys()].reduce((e, t) => e + (J(c.get(t)?.decodedBytes) ?? 0), 0),
				clipDiagnostics: {
					available: !1,
					reason: "no-runtime-meter"
				},
				masterSafety: {
					available: !!w,
					reductionDb: Number.isFinite(w?.reduction) ? w.reduction : null
				},
				bufferLoadQueue: {
					active: le,
					queued: se.length,
					maxConcurrent: ce
				}
			},
			receipts: F.map((e) => ({ ...e })),
			spatial: ne.snapshot()
		});
	}
	async function It() {
		if (D) return;
		for (let e of [...P.values()]) Q(e, "dispose", { emitReceipt: !1 });
		for (Nt(), ne.clear(), re.clear(), I.clear(), z.clear(); se.length > 0;) se.shift().reject(Y("SOUND_RUNTIME_DISPOSED", "sound runtime disposed"));
		if (Te?.removeEventListener?.("visibilitychange", Ee), y.clear(), C.clear(), v) for (let e of v.values()) Re(e.input), Re(e.canonical), Re(e.mix), Re(e.duck), Re(e.user);
		if (Re(w), E) {
			for (let e of E.stream?.getTracks?.() ?? []) e.stop?.();
			E = null;
		}
		let e = _;
		D = !0, pe.get(Gt)?.(), G("sound_runtime_disposed"), e && e.state !== "closed" && typeof e.close == "function" && await e.close();
	}
	function Lt(e) {
		W();
		let t = ne.setListener(e);
		return Object.freeze({
			type: "listener",
			status: "applied",
			position: { ...t.position },
			forward: { ...t.forward },
			up: { ...t.up }
		});
	}
	function Rt() {
		return W(), ne.resetListenerMotion(), Object.freeze({
			type: "listener-motion",
			status: "reset"
		});
	}
	function zt(e, t) {
		let n = 0;
		for (let r of [...e.voices]) Q(r, t), n += 1;
		return e.voices.clear(), n;
	}
	function Bt(e = {}) {
		W();
		let t = ne.createEmitter(e), n = Object.freeze({
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
				return t.disposed ? Promise.reject(Y("SOUND_EMITTER_DISPOSED", `emitter ${t.id ?? ""} is disposed`, { cueId: e })) : St(e, {
					...n,
					__emitter: t
				});
			},
			stop() {
				t.stopEpoch += 1;
				let e = zt(t, "emitter-stop");
				return Object.freeze({
					type: "emitter-stop",
					status: "stopped",
					stopped: e
				});
			},
			dispose() {
				t.stopEpoch += 1;
				let e = zt(t, "emitter-dispose");
				return ne.removeEmitter(t), Object.freeze({
					type: "emitter-dispose",
					status: "disposed",
					stopped: e
				});
			}
		});
		return n;
	}
	function Vt(e) {
		if (W(), !_) return Object.freeze({
			type: "spatial-update",
			status: "no-context"
		});
		let t = ne.update(Number(e) || 0, _);
		return Object.freeze({
			type: "spatial-update",
			status: "applied",
			...t
		});
	}
	function Ht(e) {
		return W(), Object.freeze({
			type: "spatial-profile",
			status: "applied",
			profile: ne.setProfile(Fe(e, ne.getProfile()))
		});
	}
	let Ut = Object.freeze({
		configureSpatial: Ht,
		setListener: Lt,
		resetListenerMotion: Rt,
		createEmitter: Bt,
		updateSpatial: Vt
	}), Wt = Object.freeze({
		get() {
			return W(), Object.freeze({
				volumes: { ...N },
				muted: k
			});
		},
		setVolumes: At,
		setMuted: jt
	}), Gt = Object.freeze({
		unlock: yt,
		unlocked: () => O,
		recordingStream: Ge,
		preload: bt,
		playCue: St,
		startMusic: Et,
		setMusicState: Ot,
		setMixState: kt,
		setUserVolumes: At,
		setMuted: jt,
		setHold: De,
		settings: Wt,
		setListener: Lt,
		resetListenerMotion: Rt,
		createEmitter: Bt,
		updateSpatial: Vt,
		configureSpatial: Ht,
		attachThree: (e) => ie(Ut, e),
		attachPixi: (e) => L(Ut, e),
		attachPhaser: (e) => ue(Ut, e),
		stop: Mt,
		clear: Pt,
		inspect: Ft,
		dispose: It
	});
	return Gt;
}
function He(e) {
	let t = globalThis.window;
	if (!t || typeof t != "object") return;
	let n = Object.freeze({
		recordingStream: () => e.recordingStream(),
		unlocked: () => e.unlocked(),
		unlock: () => e.unlock(),
		version: V
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
	if (pe.set(e, () => {
		if (t.__mpSound === n) try {
			delete t.__mpSound;
		} catch {}
	}), typeof t.dispatchEvent == "function" && typeof globalThis.CustomEvent == "function") try {
		t.dispatchEvent(new globalThis.CustomEvent("mp:sound-ready"));
	} catch {}
}
async function Ue({ manifestUrl: e = "./sound.manifest.json", baseUrl: t, audioContextFactory: n, fetchImpl: r, mediaElementFactory: i, telemetrySink: a, now: o } = {}) {
	let s = r ?? globalThis.fetch?.bind(globalThis);
	if (typeof s != "function") throw Y("SOUND_MANIFEST_FETCH_REQUIRED", "fetch is required to load the sound manifest", { manifestUrl: e });
	let c;
	try {
		c = await s(e);
	} catch (t) {
		throw Y("SOUND_MANIFEST_LOAD_FAILED", `failed to load sound manifest ${e}`, {
			manifestUrl: e,
			cause: t
		});
	}
	if (!c || c.ok === !1 || typeof c.json != "function") throw Y("SOUND_MANIFEST_LOAD_FAILED", `failed to load sound manifest ${e}`, {
		manifestUrl: e,
		status: c?.status ?? null
	});
	let l;
	try {
		l = await c.json();
	} catch (t) {
		throw Y("SOUND_MANIFEST_INVALID", `sound manifest ${e} is not valid JSON`, {
			manifestUrl: e,
			cause: t
		});
	}
	let u = globalThis.document?.createElement ? () => globalThis.document.createElement("audio") : void 0, d = X({
		manifest: l,
		baseUrl: t ?? Ne(e, c.url),
		audioContextFactory: n,
		fetchImpl: s,
		mediaElementFactory: i ?? u,
		telemetrySink: a,
		now: o
	});
	return He(d), d;
}
//#endregion
//#region i18n.js
var We = {
	zh: {
		gameTitle: "旋转灯泡",
		totalStars: "总星星 {n}",
		level: "第 {n} 关",
		moves: "步数 {n}",
		par: "3星≤{n}步",
		hint: "提示",
		next: "下一关",
		replay: "再玩一次",
		levels: "选择关卡",
		settings: "设置",
		language: "语言",
		sound: "声音",
		on: "开",
		off: "关",
		play: "开始",
		cleared: "全部点亮！",
		allClear: "100关全部通关！",
		close: "关闭",
		noHint: "提示用完了，通关新关卡可获得提示",
		loading: "加载中",
		tip: "点击方块旋转管道，点亮所有灯泡",
		page: "{a} / {b}"
	},
	en: {
		gameTitle: "Sweet Spin",
		totalStars: "Stars {n}",
		level: "Level {n}",
		moves: "Moves {n}",
		par: "3★ ≤ {n}",
		hint: "Hint",
		next: "Next",
		replay: "Replay",
		levels: "Levels",
		settings: "Settings",
		language: "Language",
		sound: "Sound",
		on: "On",
		off: "Off",
		play: "Play",
		cleared: "All lit up!",
		allClear: "All 100 levels cleared!",
		close: "Close",
		noHint: "No hints left. Clear new levels to earn more.",
		loading: "Loading",
		tip: "Tap tiles to rotate pipes and light every bulb",
		page: "{a} / {b}"
	},
	ja: {
		gameTitle: "スイートスピン",
		totalStars: "スター {n}",
		level: "レベル {n}",
		moves: "手数 {n}",
		par: "★3 ≤ {n}手",
		hint: "ヒント",
		next: "次へ",
		replay: "もう一度",
		levels: "レベル選択",
		settings: "設定",
		language: "言語",
		sound: "サウンド",
		on: "オン",
		off: "オフ",
		play: "スタート",
		cleared: "全部点灯！",
		allClear: "全100レベルクリア！",
		close: "閉じる",
		noHint: "ヒントがありません。新しいレベルをクリアで獲得",
		loading: "読み込み中",
		tip: "タイルをタップして回転、全部の電球を点けよう",
		page: "{a} / {b}"
	}
}, Ge = "zh", Ke = !0;
function qe(e) {
	Ke = !!e;
}
function Je(e) {
	Ge = e, Ke && (document.documentElement.lang = e === "zh" ? "zh-CN" : e);
}
function Ye() {
	return Ge;
}
function Xe(e) {
	let t = (e || navigator.language || "zh").toLowerCase();
	return t.startsWith("ja") ? "ja" : t.startsWith("en") ? "en" : "zh";
}
function Z(e, t) {
	let n = We[Ge][e] ?? We.zh[e] ?? e;
	if (t) for (let e in t) n = n.replace("{" + e + "}", String(t[e]));
	return n;
}
//#endregion
//#region src/host.js
function Ze(e) {
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
					console.warn("[sweetspin] 存档落盘失败", t, e);
				}
			}));
		}
	};
}
function Qe(e = "sweetspin:") {
	let t = /* @__PURE__ */ new Map(), n = (() => {
		try {
			let e = "__ss_probe__";
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
//#region levels.js
var Q = [
	[0, -1],
	[1, -1],
	[1, 0],
	[0, 1],
	[-1, 1],
	[-1, 0]
];
function $e(e) {
	let t = e >>> 0;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function et(e, t) {
	return t = (t % 6 + 6) % 6, (e << t | e >> 6 - t) & 63;
}
function tt(e, t, n) {
	for (let r = 0; r < 6; r++) if (et(e, t + r) === n) return r;
	return 0;
}
var $ = (e, t) => e + "," + t;
function nt(e) {
	return {
		cols: Math.min(7, 3 + Math.floor((e - 1) / 14)),
		rows: Math.min(9, 3 + Math.floor((e - 1) / 9)),
		holeFrac: e <= 4 ? 0 : Math.min(.16, .05 + e * .0012),
		branch: Math.min(.75, .25 + e * .005)
	};
}
function rt(e) {
	let { cols: t, rows: n, holeFrac: r, branch: i } = nt(e), a = $e(e * 7919 + 1337), o = [];
	for (let e = 0; e < t; e++) for (let t = 0; t < n; t++) o.push({
		col: e,
		row: t,
		q: e,
		r: t - (e - (e & 1)) / 2
	});
	let s = (e) => {
		let t = e.values().next().value;
		if (!t) return !1;
		let n = /* @__PURE__ */ new Set([$(t.q, t.r)]), r = [t];
		for (; r.length;) {
			let t = r.pop();
			for (let [i, a] of Q) {
				let o = $(t.q + i, t.r + a);
				e.has(o) && !n.has(o) && (n.add(o), r.push(e.get(o)));
			}
		}
		return n.size === e.size;
	}, c = /* @__PURE__ */ new Map();
	for (let e of o) c.set($(e.q, e.r), e);
	let l = Math.floor(o.length * r), u = 0;
	for (; l > 0 && u < 200;) {
		u++;
		let e = o[Math.floor(a() * o.length)], t = $(e.q, e.r);
		if (c.has(t)) {
			if (c.delete(t), !s(c)) {
				c.set(t, e);
				continue;
			}
			l--;
		}
	}
	o = [...c.values()];
	let d = /* @__PURE__ */ new Map();
	for (let e of o) d.set($(e.q, e.r), 0);
	let f = o[Math.floor(a() * o.length)], p = /* @__PURE__ */ new Set([$(f.q, f.r)]), m = [f];
	for (; m.length;) {
		let e = a() < i ? Math.floor(a() * m.length) : m.length - 1, t = m[e], n = [];
		for (let e = 0; e < 6; e++) {
			let r = $(t.q + Q[e][0], t.r + Q[e][1]);
			c.has(r) && !p.has(r) && n.push(e);
		}
		let r = it(d.get($(t.q, t.r)));
		if (!n.length || r >= 3) {
			m.splice(e, 1);
			continue;
		}
		let o = n[Math.floor(a() * n.length)], s = c.get($(t.q + Q[o][0], t.r + Q[o][1]));
		d.set($(t.q, t.r), d.get($(t.q, t.r)) | 1 << o), d.set($(s.q, s.r), d.get($(s.q, s.r)) | 1 << (o + 3) % 6), p.add($(s.q, s.r)), m.push(s);
	}
	let h = !0;
	for (; h;) {
		h = !1;
		for (let e of o) {
			let t = $(e.q, e.r);
			if (!p.has(t)) for (let n = 0; n < 6; n++) {
				let r = $(e.q + Q[n][0], e.r + Q[n][1]);
				if (p.has(r)) {
					d.set(t, d.get(t) | 1 << n), d.set(r, d.get(r) | 1 << (n + 3) % 6), p.add(t), h = !0;
					break;
				}
			}
		}
	}
	let g = [], _ = 0;
	for (let e of o) {
		let t = $(e.q, e.r), n = d.get(t), r = e === f ? "source" : it(n) === 1 ? "bulb" : "pipe";
		g.push({
			...e,
			kind: r,
			mask: n,
			start: 0,
			color: Math.floor(a() * 5)
		});
	}
	let v = e < 10 ? 2 : e < 30 ? 3 : e < 60 ? 4 : 5, y = e < 10 ? .35 : e < 30 ? .2 : .08;
	for (let e of g) e.start = (6 - (a() < y ? 0 : 1 + Math.floor(a() * v))) % 6, _ += tt(e.mask, e.start, e.mask);
	_ === 0 && (g[0].start = (g[0].start + 1) % 6, _ = tt(g[0].mask, g[0].start, g[0].mask)), _ = 0;
	for (let e of g) _ += tt(e.mask, e.start, e.mask);
	return {
		cols: t,
		rows: n,
		cells: g,
		par: _
	};
}
function it(e) {
	let t = 0;
	for (; e;) t += e & 1, e >>= 1;
	return t;
}
//#endregion
//#region game.js
async function at(e = {}) {
	let t = e.mountTo || document.getElementById("app") || document.body, n = !!e.mountTo, r = typeof e.asset == "function" ? e.asset : (e) => e, i = typeof e.assetBase == "string" ? e.assetBase : "", a = e.store || Qe("sweetspin"), o = typeof e.chargePlay == "function" ? e.chargePlay : async () => !0;
	qe(!n);
	let s = !0, c = !1, l = [], u = (e, t, n) => {
		e.addEventListener(t, n), l.push([
			e,
			t,
			n
		]);
	}, f = /* @__PURE__ */ new Set(), p = (e, t) => {
		let n = setTimeout(() => {
			f.delete(n), s && e();
		}, t);
		return f.add(n), n;
	}, m = 0, h = Math.sqrt(3), g = [
		[
			"#86b6e0",
			"#6390bd",
			"#d6ebfa"
		],
		[
			"#9ccf8c",
			"#72a866",
			"#e0f4d6"
		],
		[
			"#efa6b9",
			"#c97d92",
			"#fde0e8"
		],
		[
			"#b9a4dd",
			"#927dbd",
			"#ebe2fa"
		],
		[
			"#f2b78e",
			"#cc8d65",
			"#fde6d4"
		]
	], _ = [
		"#ffc155",
		"#e5952e",
		"#fff1c4"
	], v = t, y = document.createElement("canvas");
	y.style.width = "100%", y.style.height = "100%", y.style.touchAction = "none", v.appendChild(y);
	let b = y.getContext("2d"), x = v.clientWidth || 390, S = v.clientHeight || 700, C = d({
		orientation: "portrait",
		host: v,
		onResize: ({ width: e, height: t }) => {
			x = e, S = t, de = !0;
		}
	});
	C.attachCanvas(y);
	function w() {
		return {
			v: 1,
			unlocked: 1,
			stars: Array(100).fill(0),
			hints: 3,
			lang: null,
			muted: !1,
			cur: null
		};
	}
	let T = w();
	try {
		let e = a.getItem("save"), t = e ? JSON.parse(e) : null;
		t && t.v === 1 && Array.isArray(t.stars) && (T = {
			...w(),
			...t
		});
	} catch {}
	function E() {
		try {
			a.setItem("save", JSON.stringify(T));
		} catch {}
	}
	function D() {
		return T.stars.reduce((e, t) => e + t, 0);
	}
	Je(T.lang ?? Xe(e.locale));
	let O = null, k = !1;
	Ue({
		manifestUrl: r("sound.manifest.json"),
		baseUrl: i
	}).then((e) => {
		O = e, O.settings.setMuted(T.muted), k && ee();
	}).catch(() => {});
	function ee() {
		O && (O.preload("gameplay").catch(() => {}), O.setMusicState("main", { eventId: "session" }).catch(() => {}));
	}
	async function te() {
		k || (k = !0, O && (await O.unlock(), ee()));
	}
	let A = 0;
	function j() {
		O?.playCue("sfx.rotate", {
			eventId: "r" + A++,
			pitchSemitones: Math.random() * 2 - 1
		}).catch(() => {});
	}
	function M(e) {
		O?.playCue("sfx.bulb", {
			eventId: "b" + A++,
			pitchSemitones: Math.min(12, e * 2)
		}).catch(() => {});
	}
	function ne() {
		O?.playCue("sfx.win", { eventId: "w" + A++ }).catch(() => {});
	}
	function N() {
		O?.playCue("ui.tap", { eventId: "t" + A++ }).catch(() => {});
	}
	u(window, "pagehide", () => {
		O?.dispose();
	});
	let re = {
		bg: "assets/bg_clay.webp",
		battery: "assets/battery_clay.webp",
		bulbOff: "assets/bulb_clay_off.webp",
		bulbOn: "assets/bulb_clay_on.webp",
		hex: "assets/hex_clay.webp",
		lock: "assets/lock_clay.webp"
	}, ie = {}, ae = 0, oe = Object.keys(re).length, P = "loading", F = 1, I = null, L = [], R = /* @__PURE__ */ new Map(), z = 0, se = !1, ce = 0, le = !1, ue = 40, de = !0, B = 0, fe = !1, V = "", pe = 0, H = 0, me = [];
	function he(e, t) {
		return e + "," + t;
	}
	async function ge(e, t = !1) {
		if (e !== m) {
			if (c) return;
			c = !0;
			let t = !1;
			try {
				t = await o();
			} catch {
				t = !1;
			}
			if (c = !1, !s || !t) return;
			m = e;
		}
		if (F = e, I = rt(e), L = I.cells.map((e) => ({
			def: e,
			rot: e.start,
			vis: e.start,
			pop: 0,
			locked: !1,
			powered: !1,
			litT: 0,
			x: 0,
			y: 0
		})), R = new Map(L.map((e) => [he(e.def.q, e.def.r), e])), z = 0, t && T.cur && T.cur.level === e && T.cur.rots.length === L.length) {
			L.forEach((e, t) => {
				e.rot = e.vis = T.cur.rots[t];
			}), z = T.cur.moves;
			for (let e of T.cur.locked) L[e] && (L[e].locked = !0);
		}
		se = !1, le = !1, ce = 0, me = [], ve(!1);
		let n = 0;
		for (; ye() && n++ < 20;) {
			let e = L[n % L.length];
			e.rot = e.vis = e.rot + 1, ve(!1);
		}
		L.forEach((e) => {
			e.litT = +!!e.powered;
		}), de = !0, P = "game", _e();
	}
	function _e() {
		T.cur = {
			level: F,
			rots: L.map((e) => (e.rot % 6 + 6) % 6),
			moves: z,
			locked: L.map((e, t) => e.locked ? t : -1).filter((e) => e >= 0)
		}, E();
	}
	function U(e) {
		return et(e.def.mask, e.rot);
	}
	function ve(e) {
		let t = new Set(L.filter((e) => e.powered));
		L.forEach((e) => e.powered = !1);
		let n = L.find((e) => e.def.kind === "source");
		if (!n) return;
		n.powered = !0;
		let r = [n];
		for (; r.length;) {
			let e = r.pop(), t = U(e);
			for (let n = 0; n < 6; n++) {
				if (!(t & 1 << n)) continue;
				let i = R.get(he(e.def.q + Q[n][0], e.def.r + Q[n][1]));
				i && !i.powered && U(i) & 1 << (n + 3) % 6 && (i.powered = !0, r.push(i));
			}
		}
		if (e) {
			let e = 0;
			for (let n of L) n.def.kind === "bulb" && n.powered && !t.has(n) && (M(e++), we(n.x, n.y, 8, [
				"#ffe066",
				"#fff4b0",
				"#ffb347"
			]));
		}
	}
	function ye() {
		return L.every((e) => e.def.kind !== "bulb" || e.powered);
	}
	function be(e) {
		return I ? e <= I.par ? 3 : e <= Math.ceil(I.par * 1.5) + 2 ? 2 : 1 : 1;
	}
	function xe(e) {
		if (se || e.locked) {
			e.locked && (e.pop = .5);
			return;
		}
		e.rot += 1, e.pop = 1, z++, j(), ve(!0), ye() && Se(), _e();
	}
	function Se() {
		se = !0, ce = 0;
		let e = be(z), t = T.stars[F - 1] === 0;
		T.stars[F - 1] = Math.max(T.stars[F - 1], e), F >= T.unlocked && F < 100 && (T.unlocked = F + 1), F === 100 && (T.unlocked = 100), t && (T.hints = Math.min(9, T.hints + 1)), T.cur = null, E(), ne(), p(() => {
			le = !0;
			for (let e = 0; e < 3; e++) we(x / 2 + (e - 1) * 90, S * .35, 24, [
				"#ff8fb8",
				"#ffd25e",
				"#6ec3ff",
				"#8be38a",
				"#b896ff"
			]);
		}, 650);
	}
	function Ce() {
		if (se) return;
		if (T.hints <= 0) {
			W(Z("noHint"));
			return;
		}
		let e = L.filter((e) => !e.locked && U(e) !== e.def.mask);
		if (!e.length) return;
		e.sort((e, t) => Number(t.powered) - Number(e.powered));
		let t = e[Math.floor(Math.random() * Math.min(3, e.length))];
		t.rot += tt(t.def.mask, t.rot, t.def.mask), t.locked = !0, t.pop = 1, T.hints--, j(), we(t.x, t.y, 10, ["#ffe066", "#ffffff"]), ve(!0), ye() && Se(), _e();
	}
	function W(e) {
		V = e, pe = 2.2;
	}
	function we(e, t, n, r) {
		for (let i = 0; i < n; i++) {
			let n = Math.random() * Math.PI * 2, a = 80 + Math.random() * 260;
			me.push({
				x: e,
				y: t,
				vx: Math.cos(n) * a,
				vy: Math.sin(n) * a - 120,
				life: 1 + Math.random() * .6,
				c: r[i % r.length],
				r: 3 + Math.random() * 4,
				rot: Math.random() * 6
			});
		}
	}
	function Te(e, t, n) {
		b.lineJoin = "round", b.lineCap = "round", b.strokeStyle = q, b.lineWidth = n * .2, b.beginPath(), b.arc(e - n * .34, t - n * .18, n * .17, Math.PI * .5, Math.PI * 1.5), b.stroke(), b.beginPath(), b.arc(e + n * .34, t - n * .18, n * .17, -Math.PI * .5, Math.PI * .5), b.stroke(), b.strokeStyle = "#fff", b.lineWidth = n * .08, b.beginPath(), b.arc(e - n * .34, t - n * .18, n * .17, Math.PI * .5, Math.PI * 1.5), b.stroke(), b.beginPath(), b.arc(e + n * .34, t - n * .18, n * .17, -Math.PI * .5, Math.PI * .5), b.stroke(), b.beginPath(), b.moveTo(e - n * .36, t - n * .42), b.lineTo(e + n * .36, t - n * .42), b.quadraticCurveTo(e + n * .34, t + n * .08, e + n * .06, t + n * .14), b.lineTo(e + n * .06, t + n * .28), b.lineTo(e + n * .24, t + n * .3), b.lineTo(e + n * .24, t + n * .44), b.lineTo(e - n * .24, t + n * .44), b.lineTo(e - n * .24, t + n * .3), b.lineTo(e - n * .06, t + n * .28), b.lineTo(e - n * .06, t + n * .14), b.quadraticCurveTo(e - n * .34, t + n * .08, e - n * .36, t - n * .42), b.closePath(), b.lineWidth = n * .12, b.strokeStyle = q, b.stroke(), b.fillStyle = "#fff", b.fill(), Ke(e, t - n * .16, n * .15, Pe[0], q);
	}
	let Ee = () => 150, De = () => 112;
	function Oe() {
		if (de = !1, !I) return;
		let e = Math.min(x, 640) - 28, t = S - Ee() - De() - 24, n = 1e9, r = -1e9, i = 1e9, a = -1e9;
		for (let e of L) {
			let t = 1.5 * e.def.col, o = h * (e.def.row + (e.def.col & 1) / 2);
			n = Math.min(n, t - 1), r = Math.max(r, t + 1), i = Math.min(i, o - h / 2), a = Math.max(a, o + h / 2);
		}
		ue = Math.min(e / (r - n), t / (a - i), 80);
		let o = x / 2 - (n + r) / 2 * ue, s = Ee() + 12 + t / 2 - (i + a) / 2 * ue;
		for (let e of L) e.x = o + 1.5 * e.def.col * ue, e.y = s + h * (e.def.row + (e.def.col & 1) / 2) * ue;
	}
	let ke = [];
	function G(e, t, n, r, i, a = "") {
		ke.push({
			x: e,
			y: t,
			w: n,
			h: r,
			fn: i,
			label: a
		});
	}
	function K(e, t, n, r, i) {
		b.beginPath(), b.moveTo(e + i, t), b.arcTo(e + n, t, e + n, t + r, i), b.arcTo(e + n, t + r, e, t + r, i), b.arcTo(e, t + r, e, t, i), b.arcTo(e, t, e + n, t, i), b.closePath();
	}
	function Ae(e, t, n) {
		b.beginPath();
		for (let r = 0; r < 6; r++) {
			let i = Math.PI / 3 * r, a = e + Math.cos(i) * n, o = t + Math.sin(i) * n;
			r === 0 ? b.moveTo(a, o) : b.lineTo(a, o);
		}
		b.closePath();
	}
	function je(e, t = 800) {
		return `${t} ${Math.round(e)}px "PingFang SC","Hiragino Maru Gothic ProN","Hiragino Sans","Microsoft YaHei","Noto Sans CJK SC","Noto Sans JP","Yu Gothic",system-ui,sans-serif`;
	}
	function Me(e, t, n, r = 800) {
		let i = n;
		for (b.font = je(i, r); b.measureText(e).width > t && i > 9;) --i, b.font = je(i, r);
	}
	let q = "#5b3a29", Ne = ["#ff7a6b", "#e5574a"], Pe = ["#ffd45c", "#f0aa2e"], Fe = ["#66c3f2", "#3a9bd5"], Ie = ["#7fd68a", "#4fb162"], Le = ["#fff7e6", "#f2dfbf"];
	function Re(e, t, n, r, i, a, o = 5, s = 3) {
		b.lineJoin = "round", b.save(), b.translate(0, o + 2), e(), b.fillStyle = "rgba(70,40,20,0.18)", b.fill(), b.restore(), b.save(), b.translate(0, o), e(), b.fillStyle = q, b.fill(), b.lineWidth = s, b.strokeStyle = q, b.stroke(), b.restore(), e(), b.fillStyle = a[0], b.fill(), b.save(), e(), b.clip(), b.fillStyle = a[1], b.fillRect(t - 2, n + i * .72, r + 4, i * .3 + 2), b.fillStyle = "rgba(255,255,255,0.5)", K(t + r * .12, n + Math.max(3, i * .1), r * .76, Math.max(3, i * .16), Math.max(1.5, i * .08)), b.fill(), b.restore(), e(), b.lineWidth = s, b.strokeStyle = q, b.stroke();
	}
	function J(e, t, n, r, i, a, o = 5) {
		Re(() => K(e, t, n, r, Math.min(i, r / 2, n / 2)), e, t, n, r, a, o);
	}
	function ze(e, t, n, r, i = 5) {
		Re(() => {
			b.beginPath(), b.arc(e, t, n, 0, Math.PI * 2);
		}, e - n, t - n, n * 2, n * 2, r, i);
	}
	function Y(e, t, n, r) {
		let i = r * .42;
		b.beginPath(), b.moveTo(e - n / 2 + i, t - r / 2), b.lineTo(e + n / 2 - i, t - r / 2), b.lineTo(e + n / 2, t), b.lineTo(e + n / 2 - i, t + r / 2), b.lineTo(e - n / 2 + i, t + r / 2), b.lineTo(e - n / 2, t), b.closePath();
	}
	function Be(e, t, n, r, i) {
		Re(() => Y(e, t, n, r), e - n / 2, t - r / 2, n, r, i, 5, 3.5);
	}
	function Ve(e, t, n, r, i = 5) {
		Re(() => Ae(e, t, n), e - n, t - n * .87, n * 2, n * 1.74, r, i, 3);
	}
	function X(e, t, n, r, i, a = "#ffffff", o = 900) {
		Me(e, i, r, o);
		let s = parseInt(b.font.split(" ")[1]);
		b.lineJoin = "round", b.lineWidth = Math.max(3, s * .24), b.strokeStyle = q, b.strokeText(e, t, n), b.fillStyle = a, b.fillText(e, t, n);
	}
	function He(e, t, n, r, i, a = 800) {
		Me(e, i, r, a), b.fillStyle = q, b.fillText(e, t, n);
	}
	function We(e, t, n, r) {
		J(e, t, n, r, r / 2, Le, 4);
	}
	function Ge(e, t, n, r) {
		ze(e, t, n, r, Math.max(4, n * .16));
	}
	function Ke(e, t, n, r, i = q) {
		b.beginPath();
		for (let r = 0; r < 10; r++) {
			let i = r % 2 ? n * .5 : n, a = -Math.PI / 2 + r * Math.PI / 5, o = e + Math.cos(a) * i, s = t + Math.sin(a) * i;
			r ? b.lineTo(o, s) : b.moveTo(o, s);
		}
		b.closePath(), b.fillStyle = r, b.fill(), b.lineJoin = "round", b.lineWidth = Math.max(2, n * .18), b.strokeStyle = i, b.stroke();
	}
	function Ze(e, t, n, r) {
		b.save(), b.translate(0, n * .14), Ke(e, t, n, r ? "#e0951f" : "#c9b79c", r ? q : "#a8957a"), b.restore(), Ke(e, t, n, r ? "#ffd23f" : "#efe4d0", r ? q : "#b9a68a"), r && (b.fillStyle = "rgba(255,255,255,0.7)", b.beginPath(), b.ellipse(e - n * .18, t - n * .22, n * .16, n * .1, -.6, 0, 7), b.fill());
	}
	function $e(e, t) {
		b.lineCap = "round", b.lineJoin = "round", b.strokeStyle = q, b.lineWidth = t * .36, e(), b.stroke(), b.strokeStyle = "#fff", b.lineWidth = t * .2, e(), b.stroke();
	}
	function $(e, t, n) {
		$e(() => {
			b.beginPath(), b.moveTo(e + n * .45, t), b.lineTo(e - n * .45, t), b.moveTo(e - n * .02, t - n * .42), b.lineTo(e - n * .45, t), b.lineTo(e - n * .02, t + n * .42);
		}, n);
	}
	function nt(e, t, n) {
		b.beginPath();
		for (let r = 0; r < 16; r++) {
			let i = r / 16 * Math.PI * 2, a = r % 2 ? n * .4 : n * .56, o = i + Math.PI / 16;
			b.lineTo(e + Math.cos(i) * a, t + Math.sin(i) * a), b.lineTo(e + Math.cos(o) * a, t + Math.sin(o) * a);
		}
		b.closePath(), b.lineJoin = "round", b.lineWidth = n * .14, b.strokeStyle = q, b.stroke(), b.fillStyle = "#fff", b.fill(), b.fillStyle = Fe[1], b.beginPath(), b.arc(e, t, n * .17, 0, 7), b.fill(), b.lineWidth = n * .08, b.stroke();
	}
	function it(e, t, n) {
		$e(() => {
			b.beginPath(), b.arc(e, t, n * .42, -Math.PI * .3, Math.PI * 1.45);
		}, n);
		let r = -Math.PI * .3, i = e + Math.cos(r) * n * .42, a = t + Math.sin(r) * n * .42;
		b.beginPath(), b.moveTo(i + n * .26, a - n * .16), b.lineTo(i - n * .2, a - n * .26), b.lineTo(i + n * 0, a + n * .22), b.closePath(), b.lineJoin = "round", b.lineWidth = n * .12, b.strokeStyle = q, b.stroke(), b.fillStyle = "#fff", b.fill();
	}
	function at(e, t, n) {
		$e(() => {
			b.beginPath(), b.moveTo(e - n * .18, t - n * .4), b.lineTo(e + n * .22, t), b.lineTo(e - n * .18, t + n * .4);
		}, n);
	}
	function ot(e, t, n) {
		$e(() => {
			b.beginPath(), b.moveTo(e + n * .18, t - n * .4), b.lineTo(e - n * .22, t), b.lineTo(e + n * .18, t + n * .4);
		}, n);
	}
	function st(e, t, n, r) {
		if (!e || !e.complete) return;
		let i = r * e.width / e.height;
		b.drawImage(e, t - i / 2, n - r / 2, i, r);
	}
	function ct(e, t) {
		let n = t * .84, r = [];
		for (let t = 0; t < 6; t++) e & 1 << t && r.push(t);
		let i = (e, t = 1) => {
			let r = -Math.PI / 2 + e * Math.PI / 3;
			return [Math.cos(r) * n * t, Math.sin(r) * n * t];
		};
		if (b.beginPath(), r.length === 2) {
			let [e, t] = i(r[0]), [n, a] = i(r[1]);
			b.moveTo(e, t), b.quadraticCurveTo(0, 0, n, a);
		} else for (let e of r) {
			let [t, n] = i(e);
			b.moveTo(0, 0), b.lineTo(t, n);
		}
		return r;
	}
	function lt(e, t, n, r, i, a, o) {
		b.save(), b.translate(r, i), b.rotate(n), ct(e, t), b.restore(), b.strokeStyle = a, b.lineWidth = o, b.stroke();
	}
	function ut(e, t, n, r) {
		let i = e.def.mask, a = g[e.def.color], o = t * .36;
		b.lineCap = "round", b.lineJoin = "round";
		let s = n > .5 ? _ : a;
		lt(i, t, r, 0, -o * .04, "rgba(150,120,80,0.22)", o * 1.12), n > 0 && (b.globalAlpha = n * (.28 + .08 * Math.sin(H * 4 + e.x * .01)), lt(i, t, r, 0, 0, "#ffd36b", o * 2), b.globalAlpha = 1), lt(i, t, r, 0, o * .26, "rgba(60,70,40,0.22)", o), lt(i, t, r, 0, o * .1, s[1], o), lt(i, t, r, 0, 0, s[0], o * .9), b.globalAlpha = .55, lt(i, t, r, -o * .06, -o * .16, s[2], o * .34), b.globalAlpha = 1;
		let c = 0;
		for (let e = 0; e < 6; e++) i & 1 << e && c++;
		c >= 3 && (b.fillStyle = s[1], b.beginPath(), b.arc(0, o * .1, o * .7, 0, 7), b.fill(), b.fillStyle = s[0], b.beginPath(), b.arc(0, 0, o * .64, 0, 7), b.fill(), b.fillStyle = s[2], b.globalAlpha = .6, b.beginPath(), b.arc(-o * .18, -o * .2, o * .22, 0, 7), b.fill(), b.globalAlpha = 1);
	}
	function dt(e) {
		let t = ie.hex;
		if (t && t.complete && t.width) {
			let n = 2 * e * .95, r = n * 745 / 825;
			b.drawImage(t, 100, 132, 825, 745, -n / 2, -r / 2 + e * .02, n, r);
		} else Ae(0, 0, e * .92), b.fillStyle = "#f1dfb8", b.fill();
	}
	function ft(e) {
		let t = ue, n = 1 + e.pop * .08;
		b.save(), b.translate(e.x, e.y), b.scale(n, n), b.lineJoin = "round", Ae(0, t * .14, t * .9), b.fillStyle = "rgba(40,90,40,0.16)", b.fill(), dt(t);
		let r = e.litT;
		if (r > .05 && e.def.kind === "bulb" && (Ae(0, 0, t * .86), b.fillStyle = `rgba(255,220,120,${.35 * r})`, b.fill()), e.locked && (Ae(0, 0, t * .86), b.strokeStyle = "rgba(240,170,60,0.85)", b.lineWidth = Math.max(2, t * .06), b.stroke()), ut(e, t, r, e.vis * Math.PI / 3), e.def.kind === "bulb") {
			if (r > .05) {
				let e = b.createRadialGradient(0, 0, 0, 0, 0, t * .9);
				e.addColorStop(0, `rgba(255,230,110,${.6 * r})`), e.addColorStop(1, "rgba(255,230,110,0)"), b.fillStyle = e, b.beginPath(), b.arc(0, 0, t * .9, 0, 7), b.fill(), b.strokeStyle = `rgba(255,200,60,${r})`, b.lineWidth = t * .06, b.lineCap = "round";
				for (let e = 0; e < 5; e++) {
					let n = -Math.PI / 2 + (e - 2) * .55;
					b.beginPath(), b.moveTo(Math.cos(n) * t * .55, Math.sin(n) * t * .55 - t * .05), b.lineTo(Math.cos(n) * t * .7, Math.sin(n) * t * .7 - t * .05), b.stroke();
				}
			}
			st(r > .5 ? ie.bulbOn : ie.bulbOff, 0, -t * .04, t * 1.18);
		} else e.def.kind === "source" && st(ie.battery, 0, -t * .04, t * 1.32);
		b.restore();
	}
	function pt() {
		let e = ie.bg;
		if (b.fillStyle = "#bfe3b4", b.fillRect(0, 0, x, S), e && e.complete && e.width) {
			let t = Math.max(x / e.width, S / e.height);
			b.drawImage(e, (x - e.width * t) / 2, (S - e.height * t) / 2, e.width * t, e.height * t);
		}
	}
	function mt() {
		let e = Math.min(x, 560);
		return {
			x0: (x - e) / 2,
			cw: e
		};
	}
	function ht(e) {
		de && Oe();
		for (let t of L) {
			t.vis += (t.rot - t.vis) * Math.min(1, e * 16), Math.abs(t.rot - t.vis) < .002 && (t.vis = t.rot), t.pop = Math.max(0, t.pop - e * 5);
			let n = t.powered && Math.abs(t.rot - t.vis) < .3 ? 1 : t.powered ? t.litT : 0;
			t.litT += (n - t.litT) * Math.min(1, e * 10);
		}
		for (let e of L) ft(e);
		let { x0: t, cw: n } = mt();
		b.textAlign = "center", b.textBaseline = "middle";
		let r = Ee();
		Ge(t + 18 + 25, 40, 25, Ne), $(t + 18 + 25, 40, 23.75), G(t + 10, 9, 66, 62, () => {
			N(), P = "levels", B = Math.floor((F - 1) / 20);
		}, "back"), Ge(t + n - 18 - 25, 40, 25, Fe), nt(t + n - 18 - 25, 40, 23.75), G(t + n - 26 - 50, 9, 66, 62, () => {
			N(), fe = !0;
		}, "settings");
		let i = Math.min(n - 100 - 70, 200);
		Be(x / 2, 40, i, 50, Pe), X(Z("level", { n: F }), x / 2, 41, 24, i - 44);
		let a = Math.min(n - 60, 280);
		We(x / 2 - a / 2, 84, a, 38);
		let o = be(z);
		for (let e = 0; e < 3; e++) Ze(x / 2 - a / 2 + 28 + e * 27, 103, 11.5, e < o);
		b.textAlign = "right", He(Z("moves", { n: z }) + "  ·  " + Z("par", { n: I?.par ?? 0 }), x / 2 + a / 2 - 18, 104, 15, a - 130), b.textAlign = "center", b.fillStyle = "rgba(70,90,50,0.85)", Me(Z("tip"), n - 40, 13, 700), b.fillText(Z("tip"), x / 2, r - 6);
		let s = Math.min(n - 48, 300), c = S - 84 - 18;
		J(x / 2 - s / 2, c, s, 84, 28, Le, 5);
		let l = c + 34, u = x / 2 - s * .24, d = x / 2 + s * .24;
		Ge(u, l, 27, Pe), st(ie.bulbOn, u, l - 1, 39.15), T.hints > 0 ? (ze(u + 27 * .82, l - 27 * .72, 12, Ne, 2), X(String(T.hints), u + 27 * .82, l - 27 * .72 + 1, 14, 20)) : (ze(u + 27 * .82, l - 27 * .72, 12, Ne, 2), X("0", u + 27 * .82, l - 27 * .72 + 1, 14, 20)), He(Z("hint"), u, c + 84 - 12, 13, s * .4), G(u - 27 - 8, l - 27 - 8, 70, 84, () => {
			N(), Ce();
		}, "hint"), Ge(d, l, 27, Fe), it(d, l, 25.65), He(Z("replay"), d, c + 84 - 12, 13, s * .4), G(d - 27 - 8, l - 27 - 8, 70, 84, () => {
			N(), T.cur = null, ge(F);
		}, "replay"), le && _t(e);
	}
	function gt(e, t, n, r, i, a) {
		let o = r * .7;
		for (let i of [-1, 1]) {
			let a = e + i * (n / 2 - 4);
			b.beginPath(), b.moveTo(a, t + r * .25), b.lineTo(a + i * o, t + r * .25), b.lineTo(a + i * o * .6, t + r * .75), b.lineTo(a + i * o, t + r * 1.2), b.lineTo(a, t + r * 1.2), b.closePath(), b.fillStyle = Ne[1], b.fill(), b.lineJoin = "round", b.lineWidth = 3, b.strokeStyle = q, b.stroke();
		}
		J(e - n / 2, t, n, r, 16, Ne, 5), X(i, e, t + r / 2 + 1, a, n - 36);
	}
	function _t(e) {
		ce += e;
		let t = Math.min(1, ce * 3);
		b.fillStyle = `rgba(60,35,20,${.45 * t})`, b.fillRect(0, 0, x, S);
		let n = Math.min(x - 56, 340), r = x / 2 - n / 2, i = S / 2 - 165 + (1 - t) * 40;
		b.globalAlpha = t, b.textAlign = "center", b.textBaseline = "middle", J(r, i, n, 330, 30, Le, 7), gt(x / 2, i - 26, n * .82, 56, Z(F === 100 ? "allClear" : "cleared"), 26);
		let a = be(z);
		for (let e = 0; e < 3; e++) {
			let t = Math.max(0, Math.min(1, (ce - .2 - e * .18) * 4)), n = 30 * (e === 1 ? 1.3 : 1) * (t < 1 ? .6 + t * .6 : 1);
			Ze(x / 2 + (e - 1) * 80, i + 100 - (e === 1 ? 12 : 0), n, e < a && t > 0);
		}
		He(Z("moves", { n: z }) + "  ·  " + Z("par", { n: I?.par ?? 0 }), x / 2, i + 168, 17, n - 40);
		let o = Math.min(n - 40, 250), s = i + 190;
		J(x / 2 - o / 2, s, o, 36, 18, Pe, 4), Te(x / 2 - o / 2 + 24, s + 18, 24), X(Z("totalStars", { n: D() }), x / 2 + 12, s + 19, 15, o - 60);
		let c = (n - 56) / 2, l = i + 330 - 56 - 30, u = r + 20, d = r + 36 + c;
		J(u, l, c, 56, 22, Fe, 5), X(Z("replay"), u + c / 2, l + 28 + 1, 21, c - 18), J(d, l, c, 56, 22, Ie, 5), X(Z(F < 100 ? "next" : "levels"), d + c / 2, l + 28 + 1, 21, c - 18), b.globalAlpha = 1, ke = [], G(u, l, c, 62, () => {
			N(), ge(F);
		}, "replay-win"), G(d, l, c, 62, () => {
			N(), F < 100 ? ge(F + 1) : P = "levels";
		}, "next");
	}
	let vt = 0, yt = -1;
	function bt() {
		let { x0: e, cw: t } = mt();
		B !== yt && (yt = B, vt = 0), vt += 1 / 60, b.textAlign = "center", b.textBaseline = "middle";
		let n = T.stars.reduce((e, t) => e + t, 0);
		We(e + 30, 19, 132, 42), Ze(e + 34, 40, 19, !0), He(`${n} / 300`, e + 30 + 66 + 12, 41, 18, 92, 900), Ge(e + t - 18 - 25, 40, 25, Fe), nt(e + t - 18 - 25, 40, 23.75), G(e + t - 26 - 50, 9, 66, 62, () => {
			N(), fe = !0;
		}, "settings2");
		let r = Math.sin(H * 1.8) * 2, i = Math.min(t - 110, 300);
		gt(x / 2, 82 + r, i, 62, Z("gameTitle"), 34), b.font = je(15, 900);
		let a = Z("levels") + "  " + Z("page", {
			a: B + 1,
			b: 5
		}), o = Math.min(t - 40, b.measureText(a).width + 44);
		J(x / 2 - o / 2, 162, o, 32, 16, Fe, 4), X(a, x / 2, 179, 15, o - 20);
		let s = S - 104, c = Math.min(t - 36, 440), l = s - 214, u = Math.min(c / 6.6, l / (h * 5.6), 62), d = 6.5 * u, f = h * 5.5 * u, p = x / 2 - d / 2 + u, m = 214 + (l - f) / 2 + h / 2 * u;
		for (let e = 0; e < 20; e++) {
			let t = B * 20 + e + 1, n = e % 4, r = Math.floor(e / 4), i = p + 1.5 * n * u, a = m + h * (r + (n & 1) / 2) * u, o = t <= T.unlocked, s = T.stars[t - 1], c = o && t === T.unlocked && s === 0, l = Math.max(0, Math.min(1, (vt - e * .025) * 5)), d = (.6 + .4 * (1 - (1 - l) ** 3)) * (c ? 1 + .05 * Math.sin(H * 4) : 1);
			b.save(), b.translate(i, a), b.scale(d, d), b.globalAlpha = l;
			let f = o ? c ? Pe : s === 3 ? ["#ffe9a8", "#f5cf6c"] : Le : ["#e3d6c4", "#cdbda6"];
			if (Ve(0, 0, u * .88, f, 5), o) {
				c ? X(String(t), 0, -u * .1, u * .62, u * 1.3) : He(String(t), 0, -u * .1, u * .6, u * 1.3, 900);
				for (let e = 0; e < 3; e++) Ze((e - 1) * u * .36, u * .42 - (e === 1 ? u * .06 : 0), u * .15, e < s);
			} else {
				let e = ie.lock;
				if (e && e.complete && e.width) {
					let t = u * .8;
					b.globalAlpha = l * .85, b.drawImage(e, 215, 120, 594, 790, -t * .375, -t * .5, t * .75, t);
				}
			}
			b.restore(), o && G(i - u * .9, a - u * .8, u * 1.8, u * 1.6, () => {
				N(), ge(t, !0);
			}, "L" + t);
		}
		b.globalAlpha = 1;
		let g = S - 56, _ = Math.min(t / 2 - 20 - 26, 140);
		b.save(), B === 0 && (b.globalAlpha = .4), Ge(x / 2 - _, g, 26, Ne), ot(x / 2 - _, g, 24.7), b.restore(), B > 0 && G(x / 2 - _ - 26 - 8, g - 26 - 8, 68, 68, () => {
			N(), B--;
		}, "prev"), b.save(), B >= 4 && (b.globalAlpha = .4), Ge(x / 2 + _, g, 26, Ne), at(x / 2 + _, g, 24.7), b.restore(), B < 4 && G(x / 2 + _ - 26 - 8, g - 26 - 8, 68, 68, () => {
			N(), B++;
		}, "nextpage");
		for (let e = 0; e < 5; e++) {
			let t = x / 2 + (e - 2) * 22, n = e === B, r = n ? 22 : 12;
			J(t - r / 2, g - 7, r, 14, 7, n ? Pe : Le, 2), G(t - 11, g - 24, 22, 48, () => {
				B !== e && (N(), B = e);
			}, "page:" + e);
		}
	}
	function xt() {
		ke = [], b.fillStyle = "rgba(60,35,20,0.45)", b.fillRect(0, 0, x, S), G(0, 0, x, S, () => {
			fe = !1;
		}, "scrim");
		let e = Math.min(x - 56, 340), t = x / 2 - e / 2, n = S / 2 - 160 + 10;
		b.textAlign = "center", b.textBaseline = "middle", J(t, n, e, 320, 30, Le, 7), G(t, n - 30, e, 350, () => {}), gt(x / 2, n - 26, e * .7, 52, Z("settings"), 24), He(Z("language"), x / 2, n + 52, 16, e - 40, 900);
		let r = [
			["zh", "中文"],
			["en", "English"],
			["ja", "日本語"]
		], i = (e - 52) / 3;
		r.forEach(([e, r], a) => {
			let o = t + 18 + a * (i + 8), s = n + 70, c = Ye() === e;
			J(o, s, i, 48, 18, c ? Pe : Le, 4), c ? X(r, o + i / 2, s + 25, 17, i - 12) : He(r, o + i / 2, s + 25, 17, i - 12), G(o, s, i, 52, () => {
				N(), Je(e), T.lang = e, E();
			}, "lang:" + e);
		}), He(Z("sound"), x / 2, n + 148, 16, e - 40, 900);
		let a = (e - 44) / 2;
		[[!1, Z("on")], [!0, Z("off")]].forEach(([e, r], i) => {
			let o = t + 18 + i * (a + 8), s = n + 166, c = T.muted === e;
			J(o, s, a, 48, 18, c ? Fe : Le, 4), c ? X(r, o + a / 2, s + 25, 17, a - 12) : He(r, o + a / 2, s + 25, 17, a - 12), G(o, s, a, 52, () => {
				T.muted = e, O?.settings.setMuted(T.muted), E(), N();
			}, "sound:" + (e ? "off" : "on"));
		});
		let o = n + 320 - 76;
		J(x / 2 - 85, o, 170, 52, 22, Ne, 5), X(Z("close"), x / 2, o + 27, 20, 150), G(x / 2 - 85, o, 170, 58, () => {
			N(), fe = !1;
		}, "close");
	}
	function St() {
		b.fillStyle = "#bfe3b4", b.fillRect(0, 0, x, S), b.textAlign = "center", b.textBaseline = "middle";
		let e = ae / oe, t = Math.min(260, x - 80);
		J(x / 2 - t / 2, S / 2 + 40, t, 22, 11, Le, 3), e > 0 && (b.fillStyle = Pe[0], K(x / 2 - t / 2 + 4, S / 2 + 44, Math.max(14, (t - 8) * e), 14, 7), b.fill()), b.save(), b.translate(x / 2, S / 2 - 20), b.rotate(H * 2), Ve(0, 0, 34, Pe, 4), b.restore(), He(Z("loading") + " " + Math.round(e * 100) + "%", x / 2, S / 2 + 86, 16, x - 40), X(Z("gameTitle"), x / 2, S / 2 - 100, 36, x - 40);
	}
	function Ct(e) {
		me = me.filter((t) => (t.life -= e) > 0);
		for (let t of me) t.vy += 600 * e, t.x += t.vx * e, t.y += t.vy * e, t.rot += e * 6, b.globalAlpha = Math.min(1, t.life * 2), b.save(), b.translate(t.x, t.y), b.rotate(t.rot), b.fillStyle = t.c, b.fillRect(-t.r, -t.r * .6, t.r * 2, t.r * 1.2), b.restore();
		b.globalAlpha = 1;
	}
	let wt = performance.now();
	function Tt(e) {
		if (!s) return;
		let t = Math.min(.05, (e - wt) / 1e3);
		wt = e, H += t, Et(t), requestAnimationFrame(Tt);
	}
	function Et(e) {
		if (b.setTransform(1, 0, 0, 1, 0, 0), C.applyTransform(b), ke = [], P === "loading") {
			St();
			return;
		}
		if (pt(), P === "levels" ? bt() : ht(e), Ct(e), pe > 0) {
			pe -= e, b.globalAlpha = Math.min(1, pe * 3), b.font = je(15, 700);
			let t = Math.min(x - 40, b.measureText(V).width + 40);
			b.fillStyle = "rgba(75,90,114,0.92)", K(x / 2 - t / 2, S - De() - 64, t, 44, 22), b.fill(), b.fillStyle = "#fff", b.textAlign = "center", b.textBaseline = "middle", Me(V, t - 24, 15, 700), b.fillText(V, x / 2, S - De() - 41), b.globalAlpha = 1;
		}
		fe && xt();
	}
	function Dt(e) {
		te();
		let t = y.getBoundingClientRect(), n = e.clientX - t.left, r = e.clientY - t.top;
		for (let e = ke.length - 1; e >= 0; e--) {
			let t = ke[e];
			if (n >= t.x && n <= t.x + t.w && r >= t.y && r <= t.y + t.h) {
				t.fn();
				return;
			}
		}
		if (P === "game" && !fe && !le) {
			let e = null, t = ue * .95;
			for (let i of L) {
				let a = Math.hypot(i.x - n, i.y - r);
				a < t && (t = a, e = i);
			}
			e && xe(e);
		}
	}
	u(y, "pointerdown", Dt), u(window, "keydown", (e) => {
		e.key === "Escape" && (fe ? fe = !1 : P === "game" && (P = "levels")), (e.key === "Enter" || e.key === " ") && le && F < 100 && ge(F + 1);
	}), Et(0);
	let Ot = requestAnimationFrame(Tt);
	Promise.all(Object.entries(re).map(([e, t]) => new Promise((n) => {
		let i = new Image();
		i.onload = i.onerror = () => {
			ae++, n();
		}, i.src = r(t), ie[e] = i;
	}))).then(() => {
		if (!s) return;
		let e = T.cur && T.cur.level >= 1 && T.cur.level <= T.unlocked ? T.cur.level : Math.min(T.unlocked, 100);
		B = Math.floor((e - 1) / 20), P = "levels", Et(0);
	});
	let kt = {
		ready: !0,
		state: () => ({
			screen: P,
			level: F,
			moves: z,
			won: se,
			showWin: le,
			hints: T.hints,
			unlocked: T.unlocked,
			stars: T.stars.slice(),
			totalStars: D(),
			page: B,
			muted: T.muted,
			lang: Ye(),
			tiles: L.map((e) => ({
				x: e.x,
				y: e.y,
				q: e.def.q,
				r: e.def.r,
				kind: e.def.kind,
				powered: !!e.powered,
				need: tt(e.def.mask, e.rot, e.def.mask)
			}))
		}),
		buttons: () => ke.map((e) => ({
			label: e.label || "",
			x: e.x,
			y: e.y,
			w: e.w,
			h: e.h
		})),
		startLevel: (e) => ge(e, !0)
	};
	return window.__sweetspin = kt, async function() {
		s = !1, Ot && cancelAnimationFrame(Ot);
		for (let e of f) clearTimeout(e);
		f.clear();
		for (let [e, t, n] of l) try {
			e.removeEventListener(t, n);
		} catch {}
		l.length = 0;
		try {
			C.dispose();
		} catch {}
		try {
			await O?.dispose?.();
		} catch {}
		window.__sweetspin === kt && delete window.__sweetspin;
		try {
			y.remove();
		} catch {}
		await a.flush?.();
	};
}
//#endregion
//#region plugin.js
var ot = 4, st = 10, ct = {
	id: "sweetspin",
	name: "旋转灯泡",
	emoji: "💡",
	tabLabel: "旋转灯泡",
	version: "1.0.0",
	minHostApi: ot,
	coin: {
		id: "sweetspin-bulb",
		name: "灯泡",
		emoji: "💡"
	},
	economy: {
		playCost: st,
		expectedPayout: 0,
		capPerPrize: 1
	}
};
async function lt(e, t, n = {}) {
	let r = getComputedStyle(e).position === "static", i = e.style.position, a = e.style.overflow, o = e.style.touchAction, s = e.style.userSelect;
	r && (e.style.position = "relative"), e.style.overflow = "hidden", e.style.touchAction = "none", e.style.userSelect = "none";
	let c = "sweetspin-" + Math.random().toString(36).slice(2, 8);
	e.classList.add(c);
	let l = document.createElement("style");
	l.textContent = `.${c} canvas{display:block}`, document.head.appendChild(l);
	let u = typeof n.assetUrl == "function" ? (e) => n.assetUrl(e) : (e) => String(n.assetBase || "") + e, d = Ze(t.storage);
	try {
		await d.preload();
	} catch (e) {
		console.warn("[sweetspin] 读存档失败，按新档开始", e);
	}
	let f = async () => {
		try {
			if (typeof t.balance == "function" && t.balance() < st || !await t.spendPoints(st, "旋转灯泡 · 进关")) return t.pushToast?.({
				kind: "warn",
				title: "积分不够啦",
				detail: `进一关要 ${st} 积分 —— 去做个任务攒一点吧`
			}), !1;
		} catch (e) {
			return console.error("[sweetspin] 进关扣分失败", e), t.pushToast?.({
				kind: "warn",
				title: "扣分失败",
				detail: "稍后再试一次"
			}), !1;
		}
		return t.tone?.("coin"), !0;
	}, p = null;
	try {
		p = await at({
			mountTo: e,
			asset: u,
			assetBase: typeof n.assetBase == "string" ? n.assetBase : "",
			store: d,
			chargePlay: f,
			locale: n.locale
		});
	} catch (t) {
		console.error("[sweetspin] mount 失败", t);
		try {
			l.remove();
		} catch {}
		throw e.classList.remove(c), r && (e.style.position = i), e.style.overflow = a, e.style.touchAction = o, e.style.userSelect = s, t;
	}
	return async function() {
		try {
			await p?.();
		} catch (e) {
			console.warn("[sweetspin] 卸载出错", e);
		}
		try {
			await d.flush();
		} catch (e) {
			console.warn("[sweetspin] 存档落盘失败", e);
		}
		try {
			l.remove();
		} catch {}
		e.classList.remove(c), r && (e.style.position = i), e.style.overflow = a, e.style.touchAction = o, e.style.userSelect = s;
	};
}
var ut = {
	manifest: ct,
	mount: lt
};
//#endregion
export { ut as default, ct as manifest, lt as mount };
