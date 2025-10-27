import Color from './Color.js';
import Vector from './Vector.js';

export default class Draw {
    constructor() {
        this.ctx = null;
        this.ctxMap = new Map(); // Store multiple contexts by name
        this.currentCtxName = null;
        this.Scale = new Vector(1, 1); // scaling for coordinates
        // Stack depths (save/restore counts)
        this._matrixDepth = 0;
        this._maskDepth = 0;
        // Caches (for SVG, if you use them later)
        this.clipPaths = new Map();
        this.svgCache = new Map();
        this.parsedSvgCache = new Map();
        this.loading = new Map();
    }

    px(num) { return num * this.Scale.x; }
    py(num) { return num * this.Scale.y; }
    ps(num) { return num * this.Scale.x; }
    pv(vec) { return new Vector(this.px(vec.x), this.py(vec.y)); }

    /**
     * Register a context with a name for fast swapping.
     */
    registerCtx(name, ctx) {
        this.ctxMap.set(name, ctx);
    }

    /**
     * Use a context by name or direct ctx object.
     */
    useCtx(ctxOrName) {
        if (typeof ctxOrName === 'string') {
            const ctx = this.ctxMap.get(ctxOrName);
            if (!ctx) throw new Error(`Draw.useCtx: context '${ctxOrName}' not found.`);
            this.ctx = ctx;
            this.currentCtxName = ctxOrName;
        } else {
            this.ctx = ctxOrName;
            // Optionally, you could search for the name in ctxMap and set currentCtxName
        }
        return this;
    }

    /**
     * Get a context by name.
     */
    getCtx(name) {
        return this.ctxMap.get(name);
    }

    // =========================
    // Context management
    // =========================
    _assertCtx(where) {
        if (!this.ctx) throw new Error(`Draw.${where}: no active context. Call useCtx(ctx) first.`);
        return this.ctx;
    }

    /**
     * transformType: 'offset' | 'rotate' | 'scale'
     * - offset: data = {x,y}
     * - rotate: data = number (radians) OR { angle, origin?: {x,y} }
     * - scale : data = number | {x,y}
     */
    pushMatrix(data, transformType = 'offset') {
        const ctx = this._assertCtx('pushMatrix');
        ctx.save();

        switch (transformType) {
            case 'offset': {
                const { x, y } = _asVec(data);
                ctx.translate(x, y);
                break;
            }
            case 'rotate': {
                if (typeof data === 'number') {
                    ctx.rotate(data);
                } else {
                    const angle = data.angle ?? 0;
                    const origin = data.origin ? _asVec(data.origin) : null;
                    if (origin) {
                        ctx.translate(origin.x, origin.y);
                        ctx.rotate(angle);
                        ctx.translate(-origin.x, -origin.y);
                    } else {
                        ctx.rotate(angle);
                    }
                }
                break;
            }
            case 'scale': {
                if (typeof data === 'number') {
                    ctx.scale(data, data);
                } else {
                    const { x, y } = _asVec(data);
                    ctx.scale(x, y);
                }
                break;
            }
            default:
                console.warn(`pushMatrix: unknown transformType "${transformType}"`);
        }

        this._matrixDepth++;
    }

    popMatrix(deep = true) {
        const ctx = this._assertCtx('popMatrix');

        if (deep) {
            while (this._matrixDepth > 0) {
                ctx.restore();
                this._matrixDepth--;
            }
        } else if (this._matrixDepth > 0) {
            ctx.restore();
            this._matrixDepth--;
        }
    }

    clear() {
        const ctx = this._assertCtx('clear');
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    /**
     * Rectangular mask. If invert=true, everything OUTSIDE the rect is kept (even-odd rule).
     * Affects subsequent drawing until clearMask().
     */
    maskRect(pos, size, invert = false) {
        pos = this.pv(pos.clone())
        size = this.pv(size.clone())
        const ctx = this._assertCtx('maskRect');
        const { x, y } = _asVec(pos);
        const { x: w, y: h } = _asVec(size);

        ctx.save();
        ctx.beginPath();

        if (invert) {
            // Even-odd: draw big rect + inner rect
            ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.rect(x, y, w, h);
            ctx.clip('evenodd');
        } else {
            ctx.rect(x, y, w, h);
            ctx.clip();
        }

        this._maskDepth++;
    }

    /**
     * Polygon mask (points >= 3). If invert=true, keeps outside of polygon via even-odd rule.
     */
    polyMask(points, invert = false) {
        const ctx = this._assertCtx('polyMask');
        if (!points || points.length < 3) return;

        const p0 = _asVec(points[0]);

        ctx.save();
        ctx.beginPath();

        if (invert) {
            // Big rect first for even-odd inversion
            ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        ctx.moveTo(this.px(p0.x), this.py(p0.y));
        for (let i = 1; i < points.length; i++) {
            const p = _asVec(points[i]);
            ctx.lineTo(this.px(p.x), this.py(p.y));
        }
        ctx.closePath();

        ctx.clip(invert ? 'evenodd' : 'nonzero');
        this._maskDepth++;
    }

    /**
     * Remove masks. deep=true clears all active masks; false pops one.
     */
    clearMask(deep = true) {
        const ctx = this._assertCtx('clearMask');
        if (deep) {
            while (this._maskDepth > 0) {
                ctx.restore();
                this._maskDepth--;
            }
        } else if (this._maskDepth > 0) {
            ctx.restore();
            this._maskDepth--;
        }
    }
    circle(pos, r, color = '#000000FF', fill = true, width = 1, erase = false) {
        pos = this.pv(pos.clone());
        r = this.ps(r);
        width = this.ps(width);
        const ctx = this._assertCtx('circle');
        const { x, y } = _asVec(pos);
        const col = Color.convertColor(color);
        ctx.save();
        ctx.globalAlpha = col.d;
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (fill) {
            ctx.fillStyle = col.toHex();
            ctx.fill();
        } else {
            ctx.strokeStyle = col.toHex();
            ctx.lineWidth = width;
            ctx.stroke();
        }
        ctx.restore();
    }


    line(start, end, color = '#000000FF', width = 1, erase = false, cap = 'butt') {
        start = this.pv(start.clone());
        end = this.pv(end.clone());
        width = this.ps(width);
        const ctx = this._assertCtx('line');
        const col = Color.convertColor(color);
        ctx.save();
        ctx.globalAlpha = col.d;
        if (erase) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = '#000';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = col.toHex();
        }
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineWidth = width;
        ctx.lineCap = cap;
        ctx.stroke();
        ctx.restore();
    }

    /** Note, If fill is set to gradient then use an array of colors */
    rect(pos, size, color = '#000000FF', fill = true, width = 1, erase = false) {
        pos = this.pv(pos.clone());
        size = this.pv(size.clone());
        width = this.ps(width);
        const ctx = this._assertCtx('rect');
        const { x, y } = _asVec(pos);
        const { x: w, y: h } = _asVec(size);

        // Special erase case: black & full alpha
        if (erase && color === null) {
            ctx.clearRect(x, y, w, h);
            return;
        }

        ctx.save();
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        // --- FILLED SOLID ---
        if (fill === true) {
            const col = Color.convertColor(erase ? '#000000FF' : color);
            ctx.fillStyle = col.toHex();
            ctx.fillRect(x, y, w, h);
        // --- GRADIENT FILL ---
        } else if (fill === 'gradient') {
            if (!Array.isArray(color)) {
                debug.log("Gradient fill requires an array of at least 2 colors");
                ctx.restore();
                return;
            }
            const grad = ctx.createLinearGradient(x, y, x + w, y); // horizontal gradient
            const stops = color.length;
            color.forEach((c, i) => {
                const col = Color.convertColor(c);
                grad.addColorStop(i / (stops - 1), col.toHex());
            });
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, w, h);
        // --- STROKED RECT ---
        } else if (fill === false) {
            const col = Color.convertColor(erase ? '#000000FF' : color);
            ctx.strokeStyle = col.toHex();
            ctx.lineWidth = width;
            ctx.strokeRect(x, y, w, h);
        }
        ctx.restore();
    }
    
    background(color = '#000000FF') {
        const ctx = this._assertCtx('background');
        this.rect(new Vector(0, 0), new Vector(ctx.canvas.width / this.Scale.x, ctx.canvas.height / this.Scale.y), color, true);
    }


    polygon(points, color = '#000000FF', width = 1, fill = false, erase = false) {
        width = this.ps(width);
        const ctx = this._assertCtx('polygon');
        if (!points || points.length < 2) return;
        ctx.save();
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        const col = Color.convertColor(erase ? '#000000FF' : color);
        ctx.beginPath();
        const p0 = _asVec(points[0]);
        ctx.moveTo(px(p0.x), this.py(p0.y));
        for (let i = 1; i < points.length; i++) {
            const p = _asVec(points[i]);
            ctx.lineTo(px(p.x), this.py(p.y));
        }
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = col.toHex();
            ctx.fill();
        } else {
            ctx.strokeStyle = col.toHex();
            ctx.lineWidth = width;
            ctx.stroke();
        }
        ctx.restore();
    }

    text(txt, pos, color = '#000000FF', width = 1, fontSize = 20, options = {}, erase = false) {
        pos = this.pv(pos.clone());
        fontSize = this.ps(fontSize);
        width = this.ps(width);
        const ctx = this._assertCtx('text');
        const {
            font = `${fontSize}px Arial`,
            align = 'start',
            baseline = 'alphabetic',
            fill = true,
            strokeWidth = width, // pass down our width param
            italics = false,
        } = options;
        ctx.save();
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        const col = Color.convertColor(erase ? '#000000FF' : color);
        // If italics is requested, prepend 'italic ' to the font string
        let fontStr = font;
        if (italics) fontStr = 'italic ' + fontStr;
        ctx.font = fontStr;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        if (fill) {
            ctx.fillStyle = col.toHex();
            ctx.fillText(txt, pos.x, pos.y);
        } else {
            ctx.strokeStyle = col.toHex();
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(txt, pos.x, pos.y);
        }
        ctx.restore();
    }

    image(img, pos, size = null, invert = null, rad = 0, opacity = 1) {
        pos = this.pv(pos.clone())
        size = this.pv(size.clone())
        const ctx = this._assertCtx('image');
        const { x, y } = _asVec(pos);
        const w = size?.x ?? img.width;
        const h = size?.y ?? img.height;

        ctx.save();
        ctx.globalAlpha *= opacity;

        // Move to the image position
        ctx.translate(x + w / 2, y + h / 2);

        // Apply rotation
        if (rad) ctx.rotate(rad);

        // Apply invert scaling
        if (invert) {
            const { x: ix, y: iy } = _asVec(invert);
            ctx.scale(ix < 0 ? -1 : 1, iy < 0 ? -1 : 1);
        }

        // Draw image centered at origin
        ctx.drawImage(img, -w / 2, -h / 2, w, h);

        ctx.restore();
    }

    // =========================
    // (Optional) SVG helpers if needed later
    // =========================

    async _fetchSvg(url) {
        if (this.svgCache.has(url)) return this.svgCache.get(url);
        if (this.loading.has(url)) return this.loading.get(url);

        const promise = fetch(url).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch SVG: ${res.statusText}`);
            return res.text();
        });
        this.loading.set(url, promise);
        const text = await promise;
        this.svgCache.set(url, text);
        this.loading.delete(url);
        return text;
    }

    _parseClipPaths(doc) {
        this.clipPaths.clear();
        doc.querySelectorAll('clipPath').forEach(clip => {
            const id = clip.getAttribute('id');
            const child = clip.firstElementChild;
            if (!id || !child) return;

            let path;
            const tag = child.tagName.toLowerCase();

            if (tag === 'path') {
                const d = child.getAttribute('d');
                if (d) path = new Path2D(d);
            } else if (tag === 'rect') {
                const x = parseFloat(child.getAttribute('x') ?? 0);
                const y = parseFloat(child.getAttribute('y') ?? 0);
                const w = parseFloat(child.getAttribute('width') ?? 0);
                const h = parseFloat(child.getAttribute('height') ?? 0);
                path = new Path2D();
                path.rect(x, y, w, h);
            }

            if (path) this.clipPaths.set(id, path);
        });
    }

    _renderSvgElement(ctx, el) {
        const tag = el.tagName?.toLowerCase();
        if (!tag) return;

        let appliedClip = false;
        const clipAttr = el.getAttribute('clip-path');

        if (clipAttr) {
            const match = clipAttr.match(/url\(#(.+?)\)/);
            if (match) {
                const clipId = match[1];
                const clipPath = this.clipPaths.get(clipId);
                if (clipPath) {
                    ctx.save();
                    ctx.clip(clipPath);
                    appliedClip = true;
                }
            }
        }

        // 🔑 pull out opacity
        const opacity = parseFloat(el.getAttribute('opacity') ?? '1');
        const fillOpacity = parseFloat(el.getAttribute('fill-opacity') ?? '1');
        const effectiveOpacity = Math.max(0, Math.min(1, opacity * fillOpacity));

        switch (tag) {
            case 'svg':
            case 'g':
                for (const child of el.children) this._renderSvgElement(ctx, child);
                break;

            case 'path': {
                const d = el.getAttribute('d');
                const fill = el.getAttribute('fill');
                if (!d) break;
                const path = new Path2D(d);
                if (fill && fill !== 'none') {
                    ctx.save();
                    ctx.globalAlpha *= effectiveOpacity;   // ✅ respect opacity
                    ctx.fillStyle = fill;
                    ctx.fill(path);
                    ctx.restore();
                }
                break;
            }

            case 'rect': {
                const x = parseFloat(el.getAttribute('x') ?? 0);
                const y = parseFloat(el.getAttribute('y') ?? 0);
                const w = parseFloat(el.getAttribute('width') ?? 0);
                const h = parseFloat(el.getAttribute('height') ?? 0);
                const fill = el.getAttribute('fill');
                if (fill && fill !== 'none') {
                    ctx.save();
                    ctx.globalAlpha *= effectiveOpacity;   // ✅ respect opacity
                    ctx.fillStyle = fill;
                    ctx.fillRect(x, y, w, h);
                    ctx.restore();
                }
                break;
            }
        }

        if (appliedClip) ctx.restore();
    }


    async svg(url, pos, size = null, rotation = 0, origin = null, lockRatio = true) {
        pos = this.pv(pos.clone())
        size = this.pv(size.clone())
        const ctx = this._assertCtx('svg');
        if (!this.parsedSvgCache.has(url)) {
            if (!this.loading.has(url)) {
                this.loading.set(this._fetchSvg(url).then(svgText => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgText, 'image/svg+xml');
                    this._parseClipPaths(doc);
                    this.parsedSvgCache.set(url, doc.documentElement);
                    this.loading.delete(url);
                }).catch(e => {
                    console.error('SVG load failed', e);
                    this.loading.delete(url);
                }));
            }
            return; // not ready yet
        }

        const svgRoot = this.parsedSvgCache.get(url);

        ctx.save();

        const ox = origin?.x ?? pos.x;
        const oy = origin?.y ?? pos.y;

        let intrinsicWidth = parseFloat(svgRoot.getAttribute('width')) || 0;
        let intrinsicHeight = parseFloat(svgRoot.getAttribute('height')) || 0;

        if ((!intrinsicWidth || !intrinsicHeight) && svgRoot.hasAttribute('viewBox')) {
            const parts = svgRoot.getAttribute('viewBox').trim().split(/\s+/);
            if (parts.length === 4) {
                const vbWidth = parseFloat(parts[2]);
                const vbHeight = parseFloat(parts[3]);
                if (!isNaN(vbWidth) && !isNaN(vbHeight)) {
                    intrinsicWidth = vbWidth;
                    intrinsicHeight = vbHeight;
                }
            }
        }

        let scaleX = 1, scaleY = 1;
        if (size !== null) {
            if (typeof size === 'number') {
                if (intrinsicWidth && intrinsicHeight) {
                    const maxDim = Math.max(intrinsicWidth, intrinsicHeight);
                    scaleX = scaleY = size / maxDim;
                } else {
                    scaleX = scaleY = size;
                }
            } else {
                const s = _asVec(size);
                if (intrinsicWidth && intrinsicHeight) {
                    if (lockRatio) {
                        const ratio = Math.min(s.x / intrinsicWidth, s.y / intrinsicHeight);
                        scaleX = scaleY = ratio;
                    } else {
                        scaleX = s.x / intrinsicWidth;
                        scaleY = s.y / intrinsicHeight;
                    }
                } else {
                    scaleX = s.x; scaleY = s.y;
                }
            }
        }

        // Apply transforms (external to primitives)
        ctx.translate(pos.x, pos.y);
        ctx.translate(ox - pos.x, oy - pos.y);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-(ox - pos.x), -(oy - pos.y));

        this._renderSvgElement(ctx, svgRoot);

        ctx.restore();
    }
}

function _asVec(v) {
    if (v && typeof v.x === 'number' && typeof v.y === 'number') return v;
    if (Array.isArray(v) && v.length >= 2) return { x: v[0], y: v[1] };
    // scalar -> uniform
    const n = Number(v ?? 0);
    return { x: n, y: n };
}