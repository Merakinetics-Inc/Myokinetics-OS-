/* ═══ MYO — IMAGING: on-device DICOM viewer with a holographic 3D view ═══
   Opens CT / MRI / DEXA DICOM series (uncompressed transfer syntaxes) and plain images, entirely in the
   browser. Patient-identifying tags are never read. Volumes are kept in IndexedDB on this device only.
   Views: axial / coronal / sagittal planes with crosshairs, plus a ray-marched 3D hologram (MIP or
   structures). CT adds per-slice tissue areas (fat, muscle, bone) and a skeletal muscle index.
   Medivis (FDA-cleared surgical AR) is shown as a partner integration, pending partnership. */
(function () {
  'use strict';
  const { esc, pill, icon, clamp } = OS;

  /* ── DICOM parser (little-endian implicit/explicit VR) ───────────── */
  const TS_OK = { '1.2.840.10008.1.2': false, '1.2.840.10008.1.2.1': true, '1.2.840.10008.1.2.1.99': true };
  const TS_NAME = { '1.2.840.10008.1.2.4.50': 'JPEG baseline', '1.2.840.10008.1.2.4.51': 'JPEG extended', '1.2.840.10008.1.2.4.57': 'JPEG lossless', '1.2.840.10008.1.2.4.70': 'JPEG lossless', '1.2.840.10008.1.2.5': 'RLE lossless',
    '1.2.840.10008.1.2.4.80': 'JPEG-LS', '1.2.840.10008.1.2.4.81': 'JPEG-LS', '1.2.840.10008.1.2.4.90': 'JPEG 2000', '1.2.840.10008.1.2.4.91': 'JPEG 2000', '1.2.840.10008.1.2.4.201': 'HTJ2K', '1.2.840.10008.1.2.4.202': 'HTJ2K', '1.2.840.10008.1.2.4.203': 'HTJ2K', '1.2.840.10008.1.2.2': 'Big-endian DICOM' };
  const TS_DEC = new Set(['1.2.840.10008.1.2.4.50', '1.2.840.10008.1.2.4.51', '1.2.840.10008.1.2.4.57', '1.2.840.10008.1.2.4.70', '1.2.840.10008.1.2.5']);
  const LONG_VR = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC', 'UR', 'OD', 'OL', 'OV', 'SV', 'UV']);
  const T = (g, e) => g * 65536 + e;
  const TAG = {
    ts: T(0x0002, 0x0010), modality: T(0x0008, 0x0060), date: T(0x0008, 0x0020), desc: T(0x0008, 0x103E), part: T(0x0018, 0x0015),
    thick: T(0x0018, 0x0050), between: T(0x0018, 0x0088), series: T(0x0020, 0x000E), inst: T(0x0020, 0x0013), pos: T(0x0020, 0x0032), ori: T(0x0020, 0x0037),
    spp: T(0x0028, 0x0002), photo: T(0x0028, 0x0004), planar: T(0x0028, 0x0006), frames: T(0x0028, 0x0008), rows: T(0x0028, 0x0010), cols: T(0x0028, 0x0011),
    spacing: T(0x0028, 0x0030), bits: T(0x0028, 0x0100), signed: T(0x0028, 0x0103), wc: T(0x0028, 0x1050), ww: T(0x0028, 0x1051),
    icpt: T(0x0028, 0x1052), slope: T(0x0028, 0x1053), pixels: T(0x7FE0, 0x0010), cineRate: T(0x0018, 0x0040), frameTime: T(0x0018, 0x1063), fps: T(0x0008, 0x2144)
  };
  const KEEP = new Set(Object.values(TAG));

  function parseDicom(buf) {
    const dv = new DataView(buf), n = buf.byteLength, u8 = new Uint8Array(buf);
    const str = (o, l) => { let s = ''; for (let i = 0; i < l && o + i < n; i++) { const c = u8[o + i]; if (c) s += String.fromCharCode(c); } return s.trim(); };
    let off = 0;
    if (n > 132 && str(128, 4) === 'DICM') off = 132;
    else if (!(n > 8 && (dv.getUint16(0, true) === 0x0008 || dv.getUint16(0, true) === 0x0002))) return null;
    const el = {}; let explicit = true, encapsulated = false, ts = null, enc = null;
    // encapsulated pixel data: a basic offset table item, then fragment items, then a sequence delimiter
    function frags(q, end) {
      const F = [], bot = []; let first = true, base = 0;
      while (q + 8 <= end) {
        const g = dv.getUint16(q, true), e = dv.getUint16(q + 2, true), l = dv.getUint32(q + 4, true); q += 8;
        if (g !== 0xFFFE || e === 0xE0DD) break;
        if (e !== 0xE000) continue;
        if (first) { for (let i = 0; i + 4 <= l; i += 4) bot.push(dv.getUint32(q + i, true)); first = false; }
        else { if (!F.length) base = q - 8; F.push({ o: q, len: Math.min(l, end - q), rel: q - 8 - base }); }
        q += l;
      }
      return { frags: F, bot, next: q };
    }
    const isVR = (o) => u8[o] >= 65 && u8[o] <= 90 && u8[o + 1] >= 65 && u8[o + 1] <= 90;
    function parse(o, end, depth) {
      while (o + 8 <= end) {
        const g = dv.getUint16(o, true), e = dv.getUint16(o + 2, true); o += 4;
        if (g === 0xFFFE) {
          const len = dv.getUint32(o, true); o += 4;
          if (e === 0xE00D || e === 0xE0DD) return o;
          if (e === 0xE000) { o = len === 0xFFFFFFFF ? parse(o, end, depth + 1) : o + len; }
          continue;
        }
        if (g !== 0x0002 && ts === null) ts = '1.2.840.10008.1.2.1';
        const exp = g === 0x0002 || (explicit && isVR(o));
        let vr = '', len;
        if (exp) { vr = String.fromCharCode(u8[o], u8[o + 1]); o += 2; if (LONG_VR.has(vr)) { o += 2; len = dv.getUint32(o, true); o += 4; } else { len = dv.getUint16(o, true); o += 2; } }
        else { len = dv.getUint32(o, true); o += 4; }
        const key = T(g, e);
        if (len === 0xFFFFFFFF) {
          if (key === TAG.pixels) { const fr = frags(o, end); if (depth === 0) { encapsulated = true; enc = fr; return end; } o = fr.next; continue; }
          o = parseSeq(o, end, depth); continue;
        }
        if (depth === 0 && KEEP.has(key)) el[key] = { o, len, vr };
        if (key === TAG.ts) { ts = str(o, len); explicit = ts !== '1.2.840.10008.1.2'; }
        o += len;
      }
      return o;
    }
    function parseSeq(o, end, depth) {
      while (o + 8 <= end) {
        const g = dv.getUint16(o, true), e = dv.getUint16(o + 2, true), len = dv.getUint32(o + 4, true); o += 8;
        if (g === 0xFFFE && e === 0xE0DD) return o;
        if (g === 0xFFFE && e === 0xE000) o = len === 0xFFFFFFFF ? parse(o, end, depth + 1) : o + len;
        else return o;
      }
      return o;
    }
    parse(off, n, 0);
    const S = (k) => (el[k] ? str(el[k].o, el[k].len) : '');
    const U = (k) => (el[k] ? dv.getUint16(el[k].o, true) : null);
    const D = (k) => S(k).split('\\').map(parseFloat).filter((x) => !isNaN(x));
    const px = el[TAG.pixels];
    const info = {
      ts: ts || '1.2.840.10008.1.2.1', modality: S(TAG.modality) || 'OT', date: S(TAG.date), desc: S(TAG.desc), part: S(TAG.part), series: S(TAG.series) || 'single',
      inst: parseInt(S(TAG.inst)) || 0, pos: D(TAG.pos), ori: D(TAG.ori), spacing: D(TAG.spacing), thick: D(TAG.thick)[0], between: D(TAG.between)[0],
      rows: U(TAG.rows), cols: U(TAG.cols), bits: U(TAG.bits) || 16, signed: U(TAG.signed) === 1, spp: U(TAG.spp) || 1, photo: S(TAG.photo) || 'MONOCHROME2', planar: U(TAG.planar) || 0,
      frames: parseInt(S(TAG.frames)) || 1, wc: D(TAG.wc)[0], ww: D(TAG.ww)[0], icpt: D(TAG.icpt)[0] || 0, slope: D(TAG.slope)[0] || 1
    };
    info.cine = parseFloat(S(TAG.cineRate)) || parseFloat(S(TAG.fps)) || (parseFloat(S(TAG.frameTime)) ? 1000 / parseFloat(S(TAG.frameTime)) : 0);
    if (!info.rows || !info.cols || (!px && !encapsulated)) return { info, pixels: null, why: 'No image in this file' };
    if (encapsulated) return TS_DEC.has(info.ts) && enc && enc.frags.length ? { info, pixels: null, enc, u8 } : { info, pixels: null, why: `${TS_NAME[info.ts] || 'This compression'} is not supported yet. Export uncompressed, JPEG or RLE DICOM from the scanner portal.` };
    if (!(info.ts in TS_OK)) return { info, pixels: null, why: `${TS_NAME[info.ts] || 'This transfer syntax'} is not supported yet. Export uncompressed DICOM from the scanner portal.` };
    const fsz = info.rows * info.cols * info.spp, bytes = info.bits / 8, frames = [];
    for (let f = 0; f < info.frames; f++) {
      const start = px.o + f * fsz * bytes; if (start + fsz * bytes > n) break;
      const raw = buf.slice(start, start + fsz * bytes);
      frames.push(info.bits === 16 ? (info.signed ? new Int16Array(raw) : new Uint16Array(raw)) : info.bits === 32 ? (info.signed ? new Int32Array(raw) : new Uint32Array(raw)) : new Uint8Array(raw));
    }
    return { info, pixels: frames };
  }

  /* ── compressed pixel data: JPEG lossless (process 14), RLE lossless, JPEG baseline via the browser's decoder ── */
  function groupFrames(enc, n, u8, ts) {
    const F = enc.frags; if (!F.length) return [];
    const cat = (list) => { if (list.length === 1) return u8.subarray(list[0].o, list[0].o + list[0].len); const o = new Uint8Array(list.reduce((a, f) => a + f.len, 0)); let q = 0; list.forEach((f) => { o.set(u8.subarray(f.o, f.o + f.len), q); q += f.len; }); return o; };
    if (n <= 1) return [cat(F)];
    if (enc.bot.length === n) { const G = enc.bot.map((off, i) => F.filter((f) => f.rel >= off && (i === n - 1 || f.rel < enc.bot[i + 1]))); if (G.every((g) => g.length)) return G.map(cat); }
    if (F.length === n) return F.map((f) => cat([f]));
    if (ts !== '1.2.840.10008.1.2.5') { const G = []; F.forEach((f) => { if (!G.length || (u8[f.o] === 0xFF && u8[f.o + 1] === 0xD8)) G.push([f]); else G[G.length - 1].push(f); }); return G.map(cat); }
    return F.slice(0, n).map((f) => cat([f]));
  }
  function rleDecode(b, info) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), ns = dv.getUint32(0, true), offs = [];
    for (let i = 0; i < ns; i++) offs.push(dv.getUint32(4 + 4 * i, true));
    const npx = info.rows * info.cols, bps = Math.max(1, info.bits / 8), spp = info.spp;
    const segs = offs.map((o, i) => {
      const end = i + 1 < ns ? offs[i + 1] : b.length, out = new Uint8Array(npx); let p = 0, q = o;
      while (p < npx && q < end) { const n = (b[q] << 24) >> 24; q++; if (n >= 0) { const c = Math.min(n + 1, npx - p); out.set(b.subarray(q, q + c), p); p += c; q += n + 1; } else if (n !== -128) { const c = Math.min(1 - n, npx - p); out.fill(b[q], p, p + c); p += c; q++; } }
      return out;
    });
    if (segs.length < bps * spp) throw new Error('RLE segments missing');
    const out = bps === 1 ? new Uint8Array(npx * spp) : bps === 2 ? (info.signed ? new Int16Array(npx * spp) : new Uint16Array(npx * spp)) : (info.signed ? new Int32Array(npx * spp) : new Uint32Array(npx * spp));
    for (let c = 0; c < spp; c++) for (let i = 0; i < npx; i++) { let v = 0; for (let k = 0; k < bps; k++) v = v * 256 + segs[c * bps + k][i]; out[i * spp + c] = v; }
    if (spp === 3) info.planar = 0;
    return out;
  }
  async function jpegNative(b, info) {
    const bmp = await createImageBitmap(new Blob([b], { type: 'image/jpeg' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
    const d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height;
    info.bits = 8; info.signed = false;
    if (info.spp === 1) { const o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = d[i * 4]; return o; }
    const o = new Uint8Array(n * 3); for (let i = 0; i < n; i++) { o[i * 3] = d[i * 4]; o[i * 3 + 1] = d[i * 4 + 1]; o[i * 3 + 2] = d[i * 4 + 2]; }
    info.photo = 'RGB'; info.planar = 0; return o;
  }
  function huffTable(counts, syms) {
    const maxcode = new Int32Array(18).fill(-1), valptr = new Int32Array(17), mincode = new Int32Array(17), look = new Int16Array(256).fill(-1), lookLen = new Uint8Array(256);
    let code = 0, k = 0;
    for (let l = 1; l <= 16; l++) {
      const c = counts[l - 1]; valptr[l] = k; mincode[l] = code;
      for (let i = 0; i < c; i++) { if (l <= 8) { const base = code << (8 - l); for (let j = 0; j < 1 << (8 - l); j++) { look[base + j] = syms[k]; lookLen[base + j] = l; } } code++; k++; }
      maxcode[l] = c ? code - 1 : -1; code <<= 1;
    }
    return { maxcode, valptr, mincode, syms, look, lookLen };
  }
  function ljpegDecode(b, info) {
    const n = b.length, u16 = (i) => (b[i] << 8) | b[i + 1], H = {};
    let p = 0, P = 16, Y = 0, X = 0, comps = [], sc = [], Ss = 1, Pt = 0, ri = 0;
    for (;;) {
      while (p < n && b[p] !== 0xFF) p++;
      while (p < n && b[p] === 0xFF) p++;
      if (p >= n) throw new Error('no image data');
      const m = b[p++];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) continue;
      if (m === 0xD9) throw new Error('no scan');
      const len = u16(p), seg = p + 2, next = p + len;
      if (m === 0xC4) { let q = seg; while (q < next) { const id = b[q++], counts = b.subarray(q, q + 16); q += 16; let tot = 0; for (let i = 0; i < 16; i++) tot += counts[i]; H[id] = huffTable(counts, b.subarray(q, q + tot)); q += tot; } }
      else if (m === 0xC3 || m === 0xC7) { P = b[seg]; Y = u16(seg + 1); X = u16(seg + 3); const nf = b[seg + 5]; comps = []; for (let i = 0; i < nf; i++) comps.push(b[seg + 6 + i * 3]); }
      else if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) throw new Error('not a lossless JPEG');
      else if (m === 0xDD) ri = u16(seg);
      else if (m === 0xDA) { const ns = b[seg]; sc = []; for (let i = 0; i < ns; i++) sc.push(H[b[seg + 2 + i * 2] >> 4]); Ss = b[seg + 1 + ns * 2]; Pt = b[seg + 3 + ns * 2] & 15; p = next; break; }
      p = next;
    }
    if (!Y) Y = info.rows; if (!X) X = info.cols;
    if (sc.some((t) => !t)) throw new Error('missing Huffman table');
    const ns = sc.length, N = X * Y, planes = sc.map(() => new Uint16Array(N)), def = 1 << (P - Pt - 1);
    let pos = p, buf = 0, cnt = 0;
    const fill = () => { while (cnt <= 24) { let by = 0; if (pos < n) { if (b[pos] === 0xFF) { if (b[pos + 1] === 0) { by = 0xFF; pos += 2; } } else by = b[pos++]; } buf = (buf | (by << (24 - cnt))) >>> 0; cnt += 8; } };
    const dec = (T) => { fill(); const t8 = buf >>> 24, s = T.look[t8]; if (s >= 0) { const l = T.lookLen[t8]; buf = (buf << l) >>> 0; cnt -= l; return s; } let code = 0; for (let l = 1; l <= 16; l++) { code = (code << 1) | (buf >>> 31); buf = (buf << 1) >>> 0; cnt--; if (T.maxcode[l] >= 0 && code <= T.maxcode[l]) return T.syms[T.valptr[l] + code - T.mincode[l]]; } throw new Error('bad Huffman code'); };
    const get = (s) => { fill(); const v = buf >>> (32 - s); buf = (buf << s) >>> 0; cnt -= s; return v; };
    const restart = () => { buf = 0; cnt = 0; while (pos < n - 1 && !(b[pos] === 0xFF && b[pos + 1] >= 0xD0 && b[pos + 1] <= 0xD7)) pos++; pos += 2; };
    let mcu = 0, sy = 0, sx = 0;
    for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) {
      if (ri && mcu && mcu % ri === 0) { restart(); sy = y; sx = x; }
      const i = y * X + x;
      for (let c = 0; c < ns; c++) {
        const pl = planes[c], s = dec(sc[c]);
        let d = 0; if (s === 16) d = 32768; else if (s) { const v = get(s); d = v < 1 << (s - 1) ? v - (1 << s) + 1 : v; }
        let pr;
        if (y === sy && x === sx) pr = def;
        else if (y === sy) pr = pl[i - 1];
        else if (x === 0) pr = pl[i - X];
        else { const a = pl[i - 1], bb = pl[i - X], cc = pl[i - X - 1]; pr = Ss === 1 ? a : Ss === 2 ? bb : Ss === 3 ? cc : Ss === 4 ? a + bb - cc : Ss === 5 ? a + ((bb - cc) >> 1) : Ss === 6 ? bb + ((a - cc) >> 1) : (a + bb) >> 1; }
        pl[i] = (pr + d) & 0xFFFF;
      }
      mcu++;
    }
    const sh = (v) => (Pt ? (v << Pt) & 0xFFFF : v);
    if (ns === 1) {
      const pl = planes[0];
      if (P <= 8 && !Pt) return Uint8Array.from(pl);
      if (info.signed) { const o = new Int16Array(N), lim = 1 << (P - 1), full = 1 << P; for (let k = 0; k < N; k++) { const v = sh(pl[k]); o[k] = P >= 16 ? (v << 16) >> 16 : v >= lim ? v - full : v; } return o; }
      if (Pt) for (let k = 0; k < N; k++) pl[k] = sh(pl[k]);
      return pl;
    }
    const o = new Uint8Array(N * 3); for (let k = 0; k < N; k++) for (let c = 0; c < 3; c++) o[k * 3 + c] = sh(planes[c][k]);
    info.planar = 0; return o;
  }
  async function decodeFrames(r) {
    const { info, enc, u8 } = r, fr = groupFrames(enc, info.frames, u8, info.ts), out = [];
    for (let k = 0; k < Math.min(fr.length, 600); k++) {
      const b = fr[k];
      if (info.ts === '1.2.840.10008.1.2.5') out.push(rleDecode(b, info));
      else if (info.ts === '1.2.840.10008.1.2.4.50' || info.ts === '1.2.840.10008.1.2.4.51') out.push(await jpegNative(b, info));
      else out.push(ljpegDecode(b, info));
    }
    return out;
  }
  // deflated explicit little endian: everything after the file meta group is raw-deflate compressed
  async function prep(buf) {
    const u8 = new Uint8Array(buf);
    if (!(u8.length > 144 && u8[128] === 0x44 && u8[129] === 0x49 && u8[130] === 0x43 && u8[131] === 0x4D)) return buf;
    const dv = new DataView(buf); if (dv.getUint16(132, true) !== 2 || dv.getUint16(134, true) !== 0) return buf;
    const metaEnd = 144 + dv.getUint32(140, true);
    if (!new TextDecoder().decode(u8.subarray(132, metaEnd)).includes('1.2.840.10008.1.2.1.99')) return buf;
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read deflated DICOM');
    const inf = await new Response(new Blob([u8.subarray(metaEnd)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    const out = new Uint8Array(metaEnd + inf.byteLength); out.set(u8.subarray(0, metaEnd)); out.set(new Uint8Array(inf), metaEnd); return out.buffer;
  }
  /* ── NIfTI-1 (.nii, .nii.gz): research volumes, reoriented so axial shows anterior up and the patient's right on the left ── */
  async function niftiVolume(file) {
    let buf = await file.arrayBuffer(); const head = new Uint8Array(buf, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b) { if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unzip NIfTI'); buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }
    const dv = new DataView(buf); let le = true;
    if (dv.getInt32(0, true) !== 348) { if (dv.getInt32(0, false) === 348) le = false; else throw new Error('Not a NIfTI-1 file'); }
    const i16 = (o) => dv.getInt16(o, le), f32 = (o) => dv.getFloat32(o, le);
    if (String.fromCharCode(dv.getUint8(344), dv.getUint8(345), dv.getUint8(346)) !== 'n+1') throw new Error('Only single-file NIfTI (.nii) is supported');
    const nx = i16(42), ny = i16(44), nz = Math.max(1, i16(46)), dt = i16(70), off = Math.max(348, Math.round(f32(108))), slope = f32(112) || 1, inter = f32(116) || 0;
    const px = [Math.abs(f32(80)) || 1, Math.abs(f32(84)) || 1, Math.abs(f32(88)) || 1];
    let fx = false, fy = true, fz = false;
    if (i16(254) > 0) { fx = f32(280) > 0; fy = f32(300) > 0; fz = f32(320) < 0; }
    else if (i16(252) > 0) { const b = f32(256), c = f32(260), d = f32(264), a = Math.sqrt(Math.max(0, 1 - b * b - c * c - d * d)), qf = f32(76) < 0 ? -1 : 1; fx = a * a + b * b - c * c - d * d > 0; fy = a * a + c * c - b * b - d * d > 0; fz = (a * a + d * d - b * b - c * c) * qf < 0; }
    const RD = { 2: [1, (o) => dv.getUint8(o)], 4: [2, (o) => dv.getInt16(o, le)], 8: [4, (o) => dv.getInt32(o, le)], 16: [4, (o) => dv.getFloat32(o, le)], 64: [8, (o) => dv.getFloat64(o, le)], 256: [1, (o) => dv.getInt8(o)], 512: [2, (o) => dv.getUint16(o, le)], 768: [4, (o) => dv.getUint32(o, le)] }[dt];
    if (!RD) throw new Error('Unsupported NIfTI data type ' + dt);
    if (off + nx * ny * nz * RD[0] > buf.byteLength) throw new Error('NIfTI file is truncated');
    const f = Math.max(1, Math.ceil(Math.max(nx, ny) / MAX_XY)), zs = Math.max(1, Math.ceil(nz / MAX_Z)), ox = Math.floor(nx / f), oy = Math.floor(ny / f), oz = Math.ceil(nz / zs);
    const tmp = new Float32Array(ox * oy * oz); let lo = Infinity, hi = -Infinity;
    for (let z = 0; z < oz; z++) {
      const k = fz ? nz - 1 - z * zs : z * zs;
      for (let y = 0; y < oy; y++) for (let x = 0; x < ox; x++) {
        let acc = 0;
        for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) { const c = x * f + dx, r = y * f + dy, i = fx ? nx - 1 - c : c, j = fy ? ny - 1 - r : r; acc += RD[1](off + ((k * ny + j) * nx + i) * RD[0]); }
        const v = (acc / (f * f)) * slope + inter; tmp[(z * oy + y) * ox + x] = v; if (v < lo) lo = v; if (v > hi) hi = v;
      }
    }
    const vs = Math.max(1e-6, Math.max(Math.abs(lo), Math.abs(hi)) / 32000), data = new Int16Array(tmp.length);
    for (let i = 0; i < tmp.length; i++) data[i] = Math.round(tmp[i] / vs);
    let desc = ''; for (let i = 148; i < 228; i++) { const ch = dv.getUint8(i); if (!ch) break; desc += String.fromCharCode(ch); }
    const V = { id: 'img-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'volume', modality: lo <= -900 ? 'CT' : 'MR', part: '', desc: desc.trim() || file.name.replace(/\.nii(\.gz)?$/i, '').slice(0, 40), date: '', nx: ox, ny: oy, nz: oz, sx: px[0] * f, sy: px[1] * f, sz: px[2] * zs, vs, data, wc: null, ww: null };
    const [a, b] = pct(V, 0.01, 0.995); V.wc = (a + b) / 2; V.ww = Math.max(1e-6, b - a);
    return V;
  }
  /* ── single images and cine loops ── */
  const nid = () => 'img-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function autoWin(p, n, sl, ic) { const s = [], st = Math.max(1, Math.floor(n / 100000)); for (let k = 0; k < n; k += st) s.push(p[k] * sl + ic); s.sort((a, b) => a - b); const a = s[Math.floor(s.length * 0.01)], b = s[Math.floor(s.length * 0.995)]; return [(a + b) / 2, Math.max(1, b - a)]; }
  function grayFrame(p, i, w, h, wc, ww, id) {
    const n = w * h, d = id.data, lo = wc - ww / 2, sl = i.slope || 1, ic = i.icpt || 0, inv = i.photo === 'MONOCHROME1';
    for (let q = 0; q < n; q++) { let v = ((p[q] * sl + ic - lo) / ww) * 255; v = v < 0 ? 0 : v > 255 ? 255 : v; if (inv) v = 255 - v; d[q * 4] = d[q * 4 + 1] = d[q * 4 + 2] = v; d[q * 4 + 3] = 255; }
  }
  function grayImage(r) {
    const i = r.info, p = r.pixels[0], w = i.cols, h = i.rows;
    const [wc, ww] = i.wc != null && i.ww ? [i.wc, i.ww] : autoWin(p, w * h, i.slope || 1, i.icpt || 0);
    const src = document.createElement('canvas'); src.width = w; src.height = h; const id = new ImageData(w, h); grayFrame(p, i, w, h, wc, ww, id); src.getContext('2d').putImageData(id, 0, 0);
    const k = Math.min(1, 1600 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return { id: nid(), kind: 'image', modality: i.modality, part: i.part, desc: i.desc || 'Image', date: i.date, url: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height };
  }
  function cineOf(r) {
    const i = r.info, w = i.cols, h = i.rows, n = w * h, k = Math.min(1, 640 / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
    const src = document.createElement('canvas'); src.width = w; src.height = h; const sg = src.getContext('2d'), c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
    const [wc, ww] = i.spp === 3 ? [0, 0] : i.wc != null && i.ww ? [i.wc, i.ww] : autoWin(r.pixels[0], n, i.slope || 1, i.icpt || 0);
    const step = Math.max(1, Math.ceil(r.pixels.length / 200)), frames = [];
    for (let f = 0; f < r.pixels.length; f += step) {
      const p = r.pixels[f], id = new ImageData(w, h), d = id.data;
      if (i.spp === 3) for (let q = 0; q < n; q++) { d[q * 4] = i.planar ? p[q] : p[q * 3]; d[q * 4 + 1] = i.planar ? p[q + n] : p[q * 3 + 1]; d[q * 4 + 2] = i.planar ? p[q + 2 * n] : p[q * 3 + 2]; d[q * 4 + 3] = 255; }
      else grayFrame(p, i, w, h, wc, ww, id);
      sg.putImageData(id, 0, 0); g.drawImage(src, 0, 0, cw, ch); frames.push(c.toDataURL('image/jpeg', 0.82));
    }
    return { id: nid(), kind: 'cine', modality: i.modality, part: i.part, desc: i.desc || `${i.modality} loop`, date: i.date, url: frames[0], frames, fps: Math.round(clamp((i.cine || 15) / step, 1, 60)), w: cw, h: ch };
  }

  /* ── volume assembly ─────────────────────────────────────────────── */
  const MAX_XY = 256, MAX_Z = 320;
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function buildVolume(slices) {
    const i0 = slices[0].info;
    let order = slices.flatMap((s) => s.pixels.map((p, f) => ({ s, p, f })));
    let sz = i0.between || i0.thick || 1;
    if (i0.ori.length === 6 && slices.every((s) => s.info.pos.length === 3) && slices.length > 1) {
      const nrm = cross(i0.ori.slice(0, 3), i0.ori.slice(3));
      order.forEach((o) => { o.k = dot(o.s.info.pos, nrm); });
      order.sort((a, b) => a.k - b.k);
      const d = order.slice(1).map((o, i) => o.k - order[i].k).filter((x) => x > 0.01).sort((a, b) => a - b);
      if (d.length) sz = d[Math.floor(d.length / 2)];
    } else order.sort((a, b) => a.s.info.inst - b.s.info.inst || a.f - b.f);
    const R = i0.rows, C = i0.cols, f = Math.max(1, Math.ceil(Math.max(R, C) / MAX_XY)), zs = Math.max(1, Math.ceil(order.length / MAX_Z));
    const nx = Math.floor(C / f), ny = Math.floor(R / f), nz = Math.ceil(order.length / zs);
    const sp = i0.spacing.length === 2 ? i0.spacing : [1, 1];
    const tmp = new Float32Array(nx * ny * nz); let lo = Infinity, hi = -Infinity;
    for (let z = 0; z < nz; z++) {
      const o = order[z * zs], p = o.p, sl = o.s.info.slope, ic = o.s.info.icpt, inv = o.s.info.photo === 'MONOCHROME1';
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        let acc = 0;
        for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) acc += p[(y * f + dy) * C + x * f + dx];
        let v = (acc / (f * f)) * sl + ic; if (inv) v = -v;
        tmp[(z * ny + y) * nx + x] = v; if (v < lo) lo = v; if (v > hi) hi = v;
      }
    }
    const vs = Math.max(1, Math.max(Math.abs(lo), Math.abs(hi)) / 32000), data = new Int16Array(tmp.length);
    for (let i = 0; i < tmp.length; i++) data[i] = Math.round(tmp[i] / vs);
    const V = {
      id: 'img-' + Date.now().toString(36), kind: 'volume', modality: i0.modality, part: i0.part, desc: i0.desc, date: i0.date,
      nx, ny, nz, sx: sp[1] * f, sy: sp[0] * f, sz: sz * zs, vs, data, wc: i0.wc, ww: i0.ww
    };
    if (V.wc == null || !V.ww) { const [a, b] = pct(V, 0.01, 0.995); V.wc = (a + b) / 2; V.ww = Math.max(1, b - a); }
    return V;
  }
  function pct(V, a, b) {
    const N = V.data.length, step = Math.max(1, Math.floor(N / 200000)), s = [];
    for (let i = 0; i < N; i += step) s.push(V.data[i] * V.vs);
    s.sort((x, y) => x - y); return [s[Math.floor(s.length * a)], s[Math.floor(s.length * b)]];
  }
  function rgbImage(sl) {
    const i = sl.info, p = sl.pixels[0], w = i.cols, h = i.rows, out = new Uint8ClampedArray(w * h * 4);
    for (let k = 0; k < w * h; k++) {
      const r = i.planar ? p[k] : p[k * 3], g = i.planar ? p[k + w * h] : p[k * 3 + 1], b = i.planar ? p[k + 2 * w * h] : p[k * 3 + 2];
      out[k * 4] = r; out[k * 4 + 1] = g; out[k * 4 + 2] = b; out[k * 4 + 3] = 255;
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
    return { id: 'img-' + Date.now().toString(36), kind: 'image', modality: i.modality, part: i.part, desc: i.desc || 'Image', date: i.date, url: c.toDataURL('image/jpeg', 0.9), w, h };
  }

  /* ── demo phantom: procedural CT torso (not a real scan) ─────────── */
  function phantom() {
    const nx = 128, ny = 96, nz = 84, sx = 3, sy = 3, sz = 5, data = new Int16Array(nx * ny * nz);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
    for (let z = 0; z < nz; z++) {
      const Z = z * sz;
      const a = 165 - Math.max(0, Z - 340) * 0.9 + (Z < 90 ? (90 - Z) * 0.15 : 0), b = 108 - Math.max(0, Z - 340) * 0.5;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const X = (x - nx / 2 + 0.5) * sx, Y = (y - ny / 2 + 0.5) * sy;
        const r = (X / a) ** 2 + (Y / b) ** 2; let v = -1000;
        if (r <= 1) {
          const depth = (1 - Math.sqrt(r)) * Math.min(a, b);
          v = depth < 16 ? -100 : depth < 30 ? 52 : 38 + (rnd() > 0.38 ? 0 : -130);
          const lungZ = Z > 225 && Z < 395;
          if (lungZ) for (const s of [-1, 1]) { const lx = (X - s * 68) / 58, ly = (Y + 8) / 72; if (lx * lx + ly * ly < 1) v = -830 + (rnd() > 0.47 ? 700 : 0) * (lx * lx + ly * ly < 0.12 ? 1 : 0.05); }
          if (Z > 250 && Z < 330 && ((X - 18) / 52) ** 2 + ((Y + 22) / 46) ** 2 < 1) v = 45;
          if (Z > 170 && Z < 262 && ((X + 62) / 78) ** 2 + ((Y + 2) / 62) ** 2 < 1 && !(lungZ && v < -500)) v = 62;
          if (Z > 140 && Z < 205) for (const s of [-1, 1]) if (((X - s * 58) / 22) ** 2 + ((Y - 42) / 30) ** 2 < 1) v = 32;
          if (Z > 60 && Z < 190) for (const s of [-1, 1]) if (((X - s * 34) / 17) ** 2 + ((Y - 52) / 17) ** 2 < 1) v = 50;
          for (const s of [-1, 1]) if (((X - s * 30) / 24) ** 2 + ((Y - 86) / 15) ** 2 < 1) v = 52;
          const vb = Math.hypot(X, Y - 55), disc = (Z % 32) < 7;
          if (vb < 19) v = disc ? 85 : vb > 15 ? 900 : 320;
          if (Math.abs(X) < 5 && Y > 72 && Y < 98 && !disc) v = 750;
          if (Z > 205 && Z < 395 && (Z % 26) < 9) { const ri = Math.sqrt(r); if (ri > 0.8 && ri < 0.88 && Y < 70) v = 820; }
          if (Z > 250 && Z < 360 && Math.abs(X) < 14 && Y > -100 && Y < -88) v = 650;
          if (Z > 40 && Z < 118) { const wx = 48 + (Z - 40) * 0.75; if (Math.abs(Math.abs(X) - wx) < 5 + (118 - Z) * 0.04 && Y > -20 + (118 - Z) * 0.3 && Y < 62) v = 780; }
          if (Z > 38 && Z < 105 && Math.abs(X) < 34 - (105 - Z) * 0.25 && Y > 52 && Y < 78) v = Y > 72 || Y < 57 ? 820 : 360;
          if (Z > 10 && Z < 60) for (const s of [-1, 1]) { const fh = Math.hypot(X - s * 62, Y + 2, (Z - 42) * 1.1); if (fh < 21) v = fh > 17 ? 880 : 320; }
          if (Z < 40) for (const s of [-1, 1]) { const fx = X - s * (62 + (40 - Z) * 0.35), fs = Math.hypot(fx, Y + 2); if (fs < 13) v = fs > 9 ? 900 : 300; }
          if (Z > 28 && Z < 46 && Math.abs(X) < 24 && Y > -70 && Y < -54) v = 760;
          v += rnd() * 18;
        }
        data[(z * ny + y) * nx + x] = Math.round(v);
      }
    }
    return { id: 'demo-phantom', kind: 'volume', demo: true, modality: 'CT', part: 'CHEST/ABDOMEN', desc: 'Demo phantom (synthetic)', date: '', nx, ny, nz, sx, sy, sz, vs: 1, data, wc: 40, ww: 400 };
  }

  /* ── on-device store ─────────────────────────────────────────────── */
  const DB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => { let r; try { r = indexedDB.open('mk-imaging', 1); } catch (e) { return rej(e); } r.onupgradeneeded = () => r.result.createObjectStore('studies', { keyPath: 'id' }); r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error); });
    },
    async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('studies', mode), out = fn(t.objectStore('studies')); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); },
    all() { return this.tx('readonly', (st) => st.getAll()); }, put(r) { return this.tx('readwrite', (st) => st.put(r)); }, del(id) { return this.tx('readwrite', (st) => st.delete(id)); }
  };

  /* ── viewer state (module-level, survives re-render) ─────────────── */
  const I = { studies: [], cur: null, ix: 0, iy: 0, iz: 0, wc: 40, ww: 400, preset: 'soft', cmap: 'holo', mode3: 'mip', yaw: 0.6, spin: true, tissue: false, busy: '', readout: '', proxy: null, proxyKey: '', persistent: true };
  const PRESETS = { soft: ['Soft tissue', 40, 400], lung: ['Lung', -600, 1500], bone: ['Bone', 400, 1800], muscle: ['Muscle', 50, 250] };
  const vol = () => I.studies.find((x) => x.id === I.cur) || null;
  function select(id) {
    I.cur = id; const V = vol(); if (!V || V.kind !== 'volume') return;
    I.ix = V.nx >> 1; I.iy = V.ny >> 1; I.iz = Math.round(V.nz * 0.45);
    if (V.modality === 'CT') { I.preset = 'soft'; I.wc = 40; I.ww = 400; } else { I.preset = 'auto'; I.wc = V.wc; I.ww = V.ww; }
    I.proxy = null; I.tissue = false;
  }
  async function loadAll() {
    try { const rows = (await DB.all()) || []; rows.forEach((r) => { if (r.data && !(r.data instanceof Int16Array)) r.data = new Int16Array(r.data); }); I.studies = rows; }
    catch { I.persistent = false; }
    if (!I.studies.length) I.studies.push(phantom());
    select(I.studies[I.studies.length - 1].id);
    if (OS.current === 'imaging') OS.render();
  }

  /* ── colour LUTs ─────────────────────────────────────────────────── */
  const LUT = { gray: new Uint8ClampedArray(256 * 3), holo: new Uint8ClampedArray(256 * 3) };
  for (let i = 0; i < 256; i++) {
    const t = i / 255; LUT.gray.set([i, i, i], i * 3);
    const r = t < 0.6 ? 10 + t * 60 : 46 + (t - 0.6) * 520, g = t < 0.35 ? 20 + t * 300 : 125 + (t - 0.35) * 200, b = 40 + Math.min(1, t * 1.6) * 215;
    LUT.holo.set([r, g, b], i * 3);
  }
  const win = (v) => { const lo = I.wc - I.ww / 2; return clamp(((v - lo) / I.ww) * 255, 0, 255) | 0; };

  /* ── 2D planes ───────────────────────────────────────────────────── */
  function drawPlane(cv, plane) {
    const V = vol(); if (!V || !cv) return;
    const { nx, ny, nz, data, vs } = V, L = LUT[I.cmap];
    const [w, h] = plane === 'ax' ? [nx, ny] : plane === 'co' ? [nx, nz] : [ny, nz];
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data, tis = I.tissue && V.modality === 'CT' && plane === 'ax';
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const idx = plane === 'ax' ? (I.iz * ny + r) * nx + c : plane === 'co' ? ((nz - 1 - r) * ny + I.iy) * nx + c : ((nz - 1 - r) * ny + c) * nx + I.ix;
      const hv = data[idx] * vs, k = win(hv), o = (r * w + c) * 4;
      if (tis && hv > -191) {
        if (hv <= -30) { d[o] = 250; d[o + 1] = 196; d[o + 2] = 60; }
        else if (hv <= 150) { d[o] = 232; d[o + 1] = 70; d[o + 2] = 92; }
        else if (hv >= 200) { d[o] = 240; d[o + 1] = 246; d[o + 2] = 255; }
        else { d[o] = L[k * 3]; d[o + 1] = L[k * 3 + 1]; d[o + 2] = L[k * 3 + 2]; }
      } else { d[o] = L[k * 3]; d[o + 1] = L[k * 3 + 1]; d[o + 2] = L[k * 3 + 2]; }
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(34,211,238,.75)'; ctx.lineWidth = Math.max(1, w / 260); ctx.setLineDash([3, 3]); ctx.beginPath();
    const vx = plane === 'ax' ? I.ix : plane === 'co' ? I.ix : I.iy, hy = plane === 'ax' ? I.iy : nz - 1 - I.iz;
    ctx.moveTo(vx + 0.5, 0); ctx.lineTo(vx + 0.5, h); ctx.moveTo(0, hy + 0.5); ctx.lineTo(w, hy + 0.5); ctx.stroke();
  }

  /* ── 3D hologram: orthographic ray-march on a ≤112³ proxy ────────── */
  function buildProxy(V) {
    const ct = V.modality === 'CT', key = `${V.id}|${ct ? 'ct' : I.wc + '|' + I.ww}`;
    const w3 = ct ? (v) => clamp(((v + 300) / 1600) * 255, 0, 255) | 0 : win; if (I.proxy && I.proxyKey === key) return I.proxy;
    const ext = [V.nx * V.sx, V.ny * V.sy, V.nz * V.sz], vox = Math.max(...ext) / 112;
    const px = Math.max(2, Math.round(ext[0] / vox)), py = Math.max(2, Math.round(ext[1] / vox)), pz = Math.max(2, Math.round(ext[2] / vox));
    const P = new Uint8Array(px * py * pz);
    for (let z = 0; z < pz; z++) { const sz = Math.min(V.nz - 1, Math.floor((z / pz) * V.nz)); for (let y = 0; y < py; y++) { const sy = Math.min(V.ny - 1, Math.floor((y / py) * V.ny)); for (let x = 0; x < px; x++) { const sx = Math.min(V.nx - 1, Math.floor((x / px) * V.nx)); P[(z * py + y) * px + x] = w3(V.data[(sz * V.ny + sy) * V.nx + sx] * V.vs); } } }
    I.proxy = { P, px, py, pz }; I.proxyKey = key; return I.proxy;
  }
  function draw3D(cv) {
    const V = vol(); if (!V || !cv || V.kind !== 'volume') return;
    const { P, px, py, pz } = buildProxy(V), R = 224, ctx = cv.getContext('2d');
    if (cv.width !== R) { cv.width = R; cv.height = R; }
    const img = ctx.createImageData(R, R), d = img.data, L = LUT.holo;
    const diag = Math.hypot(px, py, pz), scale = diag / R, cx = px / 2, cy = py / 2, cz = pz / 2;
    const cs = Math.cos(I.yaw), sn = Math.sin(I.yaw), dx = sn, dy = cs, rx = cs, ry = -sn, steps = Math.ceil(diag), thr = V.modality === 'CT' ? 76 : 150;
    for (let v = 0; v < R; v++) {
      const z = cz + (R / 2 - v) * scale;
      if (z < 0 || z >= pz) continue;
      const zo = (z | 0) * py * px;
      for (let u = 0; u < R; u++) {
        const s = (u - R / 2) * scale;
        let x = cx + s * rx - dx * diag / 2, y = cy + s * ry - dy * diag / 2, best = 0, hit = -1;
        for (let k = 0; k < steps; k++, x += dx, y += dy) {
          if (x < 0 || y < 0 || x >= px || y >= py) continue;
          const val = P[zo + (y | 0) * px + (x | 0)];
          if (I.mode3 === 'mip') { if (val > best) best = val; }
          else if (val > thr) { hit = k; best = val; break; }
        }
        let t = I.mode3 === 'mip' ? best : hit < 0 ? 0 : clamp(255 - (hit / steps) * 260, 40, 255);
        if (t < 6) continue;
        const o = (v * R + u) * 4; d[o] = L[t * 3]; d[o + 1] = L[t * 3 + 1]; d[o + 2] = L[t * 3 + 2]; d[o + 3] = clamp(t * 1.6, 0, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const zl = R / 2 - ((I.iz / V.nz) * pz - cz) / scale;
    ctx.fillStyle = 'rgba(34,211,238,.18)'; ctx.fillRect(0, zl - 1, R, 2);
  }

  /* ── CT tissue areas on the current axial slice ──────────────────── */
  function tissue(V, z) {
    if (!V || V.kind !== 'volume' || V.modality !== 'CT') return null;
    let fat = 0, mus = 0, bone = 0; const o = z * V.ny * V.nx, px = V.sx * V.sy / 100;
    for (let i = 0; i < V.nx * V.ny; i++) { const h = V.data[o + i] * V.vs; if (h >= -190 && h <= -30) fat++; else if (h >= -29 && h <= 150) mus++; else if (h >= 200) bone++; }
    return { fat: fat * px, muscle: mus * px, bone: bone * px };
  }

  function photoView(V) {
    if (I.bri == null) { I.bri = 100; I.con = 100; I.inv = false; I.fr = 0; I.cplay = true; }
    const fr = V.kind === 'cine' ? Math.min(I.fr || 0, V.frames.length - 1) : 0;
    return `<section class="card img-photo"><img id="img-ph" src="${V.kind === 'cine' ? V.frames[fr] : V.url}" alt="${esc(V.desc || 'Scan image')}" style="filter:brightness(${I.bri}%) contrast(${I.con}%)${I.inv ? ' invert(1)' : ''}">
      <div class="img-ph-ctl">
        <label>Brightness<input type="range" min="40" max="200" value="${I.bri}" data-ph="bri"></label><label>Contrast<input type="range" min="40" max="300" value="${I.con}" data-ph="con"></label>
        <label class="ped-use tested"><input type="checkbox" data-change="img-inv" ${I.inv ? 'checked' : ''}> Invert</label>
        ${V.kind === 'cine' ? `<button class="btn ghost sm" data-act="img-cine">${I.cplay ? icon('pause', 14) + ' Pause' : icon('play', 14) + ' Play'}</button><label>Frame <span class="num" id="img-fr-n">${fr + 1}/${V.frames.length}</span><input type="range" min="0" max="${V.frames.length - 1}" value="${fr}" data-ph="fr"></label><span class="muted small">${V.fps} fps</span>` : ''}
        <button class="btn ghost sm" data-act="img-ph-reset">Reset</button></div></section>`;
  }
  function mountPhoto(root, V) {
    const img = root.querySelector('#img-ph'); if (!img) return;
    const apply = () => { img.style.filter = `brightness(${I.bri}%) contrast(${I.con}%)${I.inv ? ' invert(1)' : ''}`; };
    const pre = V.kind === 'cine' ? V.frames.map((u) => { const im = new Image(); im.src = u; return im; }) : [];
    const show = () => { if (V.kind !== 'cine') return; img.src = V.frames[I.fr]; const n = root.querySelector('#img-fr-n'); if (n) n.textContent = `${I.fr + 1}/${V.frames.length}`; const sl = root.querySelector('[data-ph="fr"]'); if (sl) sl.value = I.fr; };
    const onIn = (e) => { const k = e.target.dataset && e.target.dataset.ph; if (!k) return; if (k === 'fr') { I.fr = +e.target.value; I.cplay = false; show(); } else { I[k] = +e.target.value; apply(); } };
    let raf = 0, last = 0;
    const loop = (t) => { raf = requestAnimationFrame(loop); if (V.kind !== 'cine' || !I.cplay || t - last < 1000 / (V.fps || 15)) return; last = t; I.fr = (I.fr + 1) % V.frames.length; show(); };
    root.addEventListener('input', onIn); raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); root.removeEventListener('input', onIn); pre.length = 0; };
  }

  /* ── render ──────────────────────────────────────────────────────── */
  const MRI_NAMES = { nfc: 'NFC/RFID chip', magnet: 'magnet implant', pacemaker: 'pacemaker or ICD', joint: 'joint replacement or metal hardware', cochlear: 'cochlear implant', cgm: 'implanted glucose sensor', osseo: 'osseointegrated implant', neural: 'neural implant' };
  OS.register('imaging', {
    title: 'Imaging', icon: 'imaging',
    render(s) {
      const V = vol(), isVol = V && V.kind === 'volume', ct = isVol && V.modality === 'CT', tz = isVol ? tissue(V, I.iz) : null, hM = s.profile.heightCm / 100;
      const studies = I.studies.map((x) => `<button class="img-study ${x.id === I.cur ? 'on' : ''}" data-act="img-pick" data-id="${x.id}"><b>${esc(x.modality)}</b><span>${esc((x.desc || x.part || 'Study').slice(0, 38))}</span><em>${x.kind === 'volume' ? `${x.nx}×${x.ny}×${x.nz}` : x.kind === 'cine' ? `${x.frames.length} frames` : `${x.w}×${x.h}`}${x.demo ? ' · demo' : ''}</em></button>`).join('');
      const seg = (act, cur, opts) => `<div class="seg">${opts.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-v="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
      const smi = tz ? tz.muscle / (hM * hM) : null, lowRef = s.profile.sex === 'F' ? 38.5 : 52.4;
      return `${OS.ui.head('Medical imaging · on-device · Medivis-ready', 'Imaging', 'Open your own CT, MRI, PET, X-ray, mammography, ultrasound, angiogram or DEXA scans: volumes as planes and a 3D hologram, X-rays as images, ultrasound and angiograms as moving loops. Files are read on this device and never uploaded.',
        `<div class="hstat"><span>Studies</span><b class="num">${I.studies.filter((x) => !x.demo).length}</b></div><div class="hstat"><span>Viewing</span><b class="num">${V ? esc(V.modality) : '—'}</b></div>`)}
      <div class="img-bar">
        <label class="btn sm file">${icon('upload', 14)} Open scan folder<input type="file" webkitdirectory multiple data-change="img-files"></label>
        <label class="btn ghost sm file">${icon('upload', 14)} Open files<input type="file" multiple accept=".dcm,.nii,.gz,application/dicom,image/*,*/*" data-change="img-files"></label>
        ${I.studies.some((x) => x.demo) ? '' : '<button class="btn ghost sm" data-act="img-demo">Load demo phantom</button>'}
        ${V && !V.demo ? '<button class="btn ghost sm" data-act="img-del">Remove this study</button>' : ''}
        <span class="muted small">${esc(I.busy)}</span>
      </div>
      <div class="img-studies">${studies}</div>
      ${(() => { const a = s.augment && s.augment.implants, list = a ? Object.keys(a).filter((k) => a[k] && MRI_NAMES[k]) : []; return list.length ? `<div class="banner warn" role="note"><strong>MRI safety.</strong> You listed: ${list.map((k) => esc(MRI_NAMES[k])).join(', ')} (on the Augment page). Tell the imaging team before any MRI and bring the device card.${a.magnet ? ' Magnet implants are generally MRI-unsafe.' : ''}${a.pacemaker ? ' Cardiac devices need cardiology clearance first.' : ''}</div>` : ''; })()}
      ${V && V.demo ? '<div class="banner" role="note"><strong>Demo phantom.</strong> A synthetic CT torso generated in the app, so you can try the viewer. Open your own scan folder to replace it.</div>' : ''}
      ${!V ? '<section class="card"><p>No study open.</p></section>' : V.kind === 'image' || V.kind === 'cine' ? photoView(V) : `
      <div class="img-grid">
        <section class="img-holo"><div class="img-hud"><span>${esc(V.modality)} · ${esc(V.part || 'Volume')}</span><span>${(V.nx * V.sx / 10).toFixed(0)}×${(V.ny * V.sy / 10).toFixed(0)}×${(V.nz * V.sz / 10).toFixed(0)} cm</span></div>
          <canvas id="img-3d" aria-label="3D hologram of the scan"></canvas>
          <div class="img-3d-ctl">${seg('img-m3', I.mode3, [['mip', 'Hologram (MIP)'], ['surf', 'Structures']])}
            <button class="btn ghost sm" data-act="img-spin">${I.spin ? icon('pause', 14) + ' Pause' : icon('play', 14) + ' Rotate'}</button>
            <input type="range" id="img-yaw" min="0" max="628" value="${Math.round(((I.yaw % 6.283) + 6.283) % 6.283 * 100)}" aria-label="Rotate 3D view"></div></section>
        ${[['ax', 'Axial', I.iz, V.nz, V.nx * V.sx, V.ny * V.sy], ['co', 'Coronal', I.iy, V.ny, V.nx * V.sx, V.nz * V.sz], ['sa', 'Sagittal', I.ix, V.nx, V.ny * V.sy, V.nz * V.sz]].map(([p, l, i, n, w, h]) => `
        <section class="img-pl img-${p}"><div class="img-pl-h"><b>${l}</b><span class="num">${i + 1}/${n}</span></div>
          <canvas id="img-${p}" style="aspect-ratio:${w.toFixed(1)} / ${h.toFixed(1)}" data-plane="${p}" aria-label="${l} plane"></canvas>
          <input type="range" min="0" max="${n - 1}" value="${i}" data-slice="${p}" aria-label="${l} slice"></section>`).join('')}
      </div>
      <div class="img-ctl">
        <div><span class="lbl">Window</span>${ct ? seg('img-preset', I.preset, Object.entries(PRESETS).map(([k, v]) => [k, v[0]])) : seg('img-preset', I.preset, [['auto', 'Auto']])}</div>
        <div><span class="lbl">Colour</span>${seg('img-cmap', I.cmap, [['holo', 'Holo'], ['gray', 'Grey']])}</div>
        ${ct ? `<label class="ped-use"><input type="checkbox" data-change="img-tissue" ${I.tissue ? 'checked' : ''}> Colour tissue on axial (fat · muscle · bone)</label>` : ''}
        <span class="muted small" id="img-read">${esc(I.readout || 'Click a plane to move the crosshair and read the value.')}</span>
      </div>`}
      <div class="grid g-2">
        ${ct ? `<section class="card"><div class="card-h"><h2>Body composition on this slice</h2><span class="muted small">Axial ${I.iz + 1} · CT tissue thresholds</span></div>
          <div class="img-tz"><div><span><i class="lg-key" style="background:#fac43c"></i>Fat</span><b class="num">${tz.fat.toFixed(0)}</b><em>cm²</em></div><div><span><i class="lg-key" style="background:#e8465c"></i>Muscle + organs</span><b class="num">${tz.muscle.toFixed(0)}</b><em>cm²</em></div><div><span><i class="lg-key" style="background:#f0f6ff"></i>Bone</span><b class="num">${tz.bone.toFixed(0)}</b><em>cm²</em></div></div>
          <p class="small">Muscle index at this level: <b class="num">${smi.toFixed(1)} cm²/m²</b>. ${smi < lowRef ? `Below the ${lowRef} reference used for low muscle at L3, so building muscle is a top priority.` : `Above the ${lowRef} low-muscle reference used at L3.`}</p>
          <p class="fine">Move the axial slice to the third lumbar vertebra (L3) for the standard measure. Areas use −190 to −30 HU for fat, −29 to 150 HU for muscle and 200+ HU for bone; organs share the muscle range, so this reads high above and below L3.</p>
          <button class="btn ghost sm" data-act="img-save">Save to my record</button></section>` : ''}
        <section class="card"><div class="card-h"><h2>What opens here</h2></div>
          <ul class="ath-list small"><li><b>DICOM:</b> uncompressed, JPEG baseline, JPEG lossless, RLE and deflated files from CT, MRI, PET and nuclear medicine, X-ray (CR, DX), mammography, ultrasound, angiography (XA), DEXA, dental and endoscopy.</li><li><b>Loops:</b> multi-frame ultrasound and angiograms play as cine.</li><li><b>NIfTI:</b> .nii and .nii.gz research volumes.</li><li><b>Photos:</b> JPG and PNG of films or reports.</li><li><b>Not yet:</b> JPEG 2000, JPEG-LS and HTJ2K compressed DICOM. Ask the imaging centre for an uncompressed or JPEG export.</li></ul></section>
        <section class="card medivis"><div class="card-h"><h2>Medivis</h2>${pill('muted', 'Partnership pending')}</div>
          <p>Medivis makes FDA-cleared surgical AR and 3D imaging for clinicians: Studio for 3D planning from CT and MRI, AR navigation in the operating room, and a Vision Pro viewer.</p>
          <ul class="ath-list"><li><b>Planned:</b> share a study held in Myo with your care team's Medivis Studio.</li><li><b>Planned:</b> view 3D reconstructions your surgeon shares from Medivis here in Myo.</li><li><b>Today:</b> Myo's own viewer handles your scans on-device. Medivis has no public API, so this card goes live once a partnership is in place.</li></ul>
          <a class="btn ghost sm" href="https://www.medivis.com/contact" target="_blank" rel="noopener">About Medivis</a></section>
      </div>
      <p class="fine">Myo's imaging viewer is for exploring and tracking your own scans. It is not a diagnostic device; a radiologist's report is the reading of record. Names and other patient identifiers in DICOM files are never read or stored.</p>`;
    },
    mount(root) {
      const V = vol();
      if (V && (V.kind === 'image' || V.kind === 'cine')) return mountPhoto(root, V);
      if (!V || V.kind !== 'volume') return;
      const cvs = { ax: root.querySelector('#img-ax'), co: root.querySelector('#img-co'), sa: root.querySelector('#img-sa') }, c3 = root.querySelector('#img-3d');
      const redraw2 = () => { Object.entries(cvs).forEach(([p, c]) => drawPlane(c, p)); };
      redraw2(); draw3D(c3);
      const syncLabels = () => {
        [['ax', I.iz, V.nz], ['co', I.iy, V.ny], ['sa', I.ix, V.nx]].forEach(([p, i, n]) => { const sec = root.querySelector('.img-' + p); if (!sec) return; sec.querySelector('.num').textContent = `${i + 1}/${n}`; sec.querySelector('input').value = i; });
      };
      const onInput = (e) => {
        const t = e.target;
        if (t.dataset.slice) { const v = +t.value; if (t.dataset.slice === 'ax') I.iz = v; else if (t.dataset.slice === 'co') I.iy = v; else I.ix = v; redraw2(); syncLabels(); if (!I.spin) draw3D(c3); }
        else if (t.id === 'img-yaw') { I.yaw = +t.value / 100; I.spin = false; draw3D(c3); }
      };
      const onChangeSlice = (e) => { if (e.target.dataset.slice === 'ax' && V.modality === 'CT') OS.render(); };
      const onClick = (e) => {
        const c = e.target.closest('canvas[data-plane]'); if (!c) return;
        const r = c.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height, p = c.dataset.plane;
        if (p === 'ax') { I.ix = clamp(Math.floor(fx * V.nx), 0, V.nx - 1); I.iy = clamp(Math.floor(fy * V.ny), 0, V.ny - 1); }
        else if (p === 'co') { I.ix = clamp(Math.floor(fx * V.nx), 0, V.nx - 1); I.iz = clamp(V.nz - 1 - Math.floor(fy * V.nz), 0, V.nz - 1); }
        else { I.iy = clamp(Math.floor(fx * V.ny), 0, V.ny - 1); I.iz = clamp(V.nz - 1 - Math.floor(fy * V.nz), 0, V.nz - 1); }
        const hv = V.data[(I.iz * V.ny + I.iy) * V.nx + I.ix] * V.vs;
        I.readout = `${V.modality === 'CT' ? Math.round(hv) + ' HU' : 'Signal ' + Math.round(hv)} at x ${(I.ix * V.sx).toFixed(0)} · y ${(I.iy * V.sy).toFixed(0)} · z ${(I.iz * V.sz).toFixed(0)} mm`;
        if (p !== 'ax' && V.modality === 'CT') { OS.render(); return; }
        const rd = root.querySelector('#img-read'); if (rd) rd.textContent = I.readout;
        redraw2(); syncLabels(); if (!I.spin) draw3D(c3);
      };
      const onWheel = (e) => {
        const c = e.target.closest('canvas[data-plane]'); if (!c) return; e.preventDefault();
        const d = e.deltaY > 0 ? 1 : -1, p = c.dataset.plane;
        if (p === 'ax') I.iz = clamp(I.iz + d, 0, V.nz - 1); else if (p === 'co') I.iy = clamp(I.iy + d, 0, V.ny - 1); else I.ix = clamp(I.ix + d, 0, V.nx - 1);
        redraw2(); syncLabels();
        if (p === 'ax' && V.modality === 'CT') { clearTimeout(wheelT); wheelT = setTimeout(() => OS.render(), 350); }
      };
      let wheelT = 0;
      root.addEventListener('input', onInput); root.addEventListener('change', onChangeSlice); root.addEventListener('click', onClick); root.addEventListener('wheel', onWheel, { passive: false });
      let raf = 0, last = 0;
      const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const loop = (t) => { raf = requestAnimationFrame(loop); if (!I.spin || reduce || t - last < 66) return; last = t; I.yaw = (I.yaw + 0.045) % (Math.PI * 2); draw3D(c3); const y = root.querySelector('#img-yaw'); if (y) y.value = Math.round(I.yaw * 100); };
      raf = requestAnimationFrame(loop);
      return () => { cancelAnimationFrame(raf); root.removeEventListener('input', onInput); root.removeEventListener('change', onChangeSlice); root.removeEventListener('click', onClick); root.removeEventListener('wheel', onWheel); };
    }
  });

  /* ── actions ─────────────────────────────────────────────────────── */
  OS.act('img-pick', (el) => { select(el.dataset.id); I.fr = 0; OS.render(); });
  OS.act('img-cine', () => { I.cplay = !I.cplay; OS.render(); });
  OS.act('img-ph-reset', () => { I.bri = 100; I.con = 100; I.inv = false; OS.render(); });
  OS.change('img-inv', (el) => { I.inv = el.checked; const im = document.getElementById('img-ph'); if (im) im.style.filter = `brightness(${I.bri}%) contrast(${I.con}%)${I.inv ? ' invert(1)' : ''}`; });
  OS.act('img-preset', (el) => { const k = el.dataset.v, V = vol(); I.preset = k; if (PRESETS[k]) { I.wc = PRESETS[k][1]; I.ww = PRESETS[k][2]; } else if (V) { I.wc = V.wc; I.ww = V.ww; } OS.render(); });
  OS.act('img-cmap', (el) => { I.cmap = el.dataset.v; OS.render(); });
  OS.act('img-m3', (el) => { I.mode3 = el.dataset.v; OS.render(); });
  OS.act('img-spin', () => { I.spin = !I.spin; OS.render(); });
  OS.change('img-tissue', (el) => { I.tissue = el.checked; OS.render(); });
  OS.act('img-demo', () => { const P = phantom(); I.studies.unshift(P); select(P.id); OS.render(); });
  OS.act('img-del', async () => {
    const V = vol(); if (!V || V.demo) return;
    if (!confirm('Remove this study from this device? This cannot be undone.')) return;
    try { await DB.del(V.id); } catch {}
    I.studies = I.studies.filter((x) => x.id !== V.id); if (!I.studies.length) I.studies.push(phantom());
    select(I.studies[I.studies.length - 1].id); OS.render(); OS.toast('Study removed from this device');
  });
  OS.act('img-save', () => {
    const V = vol(), tz = tissue(V, I.iz); if (!tz) return;
    OS.update((s) => { s.imaging = { modality: V.modality, part: V.part, date: V.date || null, slice: I.iz + 1, fatCm2: Math.round(tz.fat), muscleCm2: Math.round(tz.muscle), boneCm2: Math.round(tz.bone), muscleIndex: +(tz.muscle / Math.pow(s.profile.heightCm / 100, 2)).toFixed(1), demo: !!V.demo, savedAt: new Date().toISOString() }; });
    OS.toast('Saved. Myo now sees these body-composition numbers.');
  });
  async function importFiles(files) {
    I.busy = `Reading ${files.length} file${files.length > 1 ? 's' : ''}…`; OS.render();
    const series = {}, images = [], vols = []; let skipped = 0, why = '';
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        if (/^image\//.test(f.type) && !/dicom/i.test(f.type)) {
          const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
          const im = await new Promise((r) => { const x = new Image(); x.onload = () => r(x); x.onerror = () => r(null); x.src = url; });
          if (im) { const c = document.createElement('canvas'), k = Math.min(1, 1600 / Math.max(im.width, im.height)); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); images.push({ id: nid(), kind: 'image', modality: 'IMG', desc: f.name.replace(/\.[^.]+$/, '').slice(0, 40), date: '', url: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height }); }
          continue;
        }
        if (/\.nii(\.gz)?$/i.test(f.name || '')) { vols.push(await niftiVolume(f)); continue; }
        if (f.size < 256 || f.size > 600e6) { skipped++; continue; }
        const r = parseDicom(await prep(await f.arrayBuffer()));
        if (r && r.enc) { try { r.pixels = await decodeFrames(r); } catch (e) { r.pixels = null; r.why = `Could not decode this ${TS_NAME[r.info.ts] || 'compressed'} image${e && e.message ? ` (${e.message})` : ''}.`; } }
        if (!r || !r.pixels || !r.pixels.length) { skipped++; if (r && r.why) why = r.why; continue; }
        const multi = r.pixels.length > 1;
        if (multi && (r.info.spp === 3 || /^(US|XA|RF|ES|IVUS|OCT)$/.test(r.info.modality))) { images.push(cineOf(r)); continue; }
        if (r.info.spp === 3) { images.push(rgbImage(r)); continue; }
        const key = `${r.info.series}|${r.info.rows}x${r.info.cols}`; (series[key] = series[key] || []).push(r);
      } catch (e) { skipped++; if (e && e.message) why = e.message; }
      if (i % 40 === 0) { I.busy = `Reading ${i + 1} of ${files.length}…`; const sp = document.querySelector('.img-bar .muted'); if (sp) sp.textContent = I.busy; await new Promise((r) => setTimeout(r, 0)); }
    }
    Object.values(series).forEach((list) => { const nfr = list.reduce((a, r) => a + r.pixels.length, 0); if (nfr === 1) images.push(grayImage(list[0])); else vols.push(buildVolume(list)); });
    const added = [...vols, ...images];
    for (const v of added) { try { await DB.put(v); } catch { I.persistent = false; } }
    if (added.length) { I.studies = I.studies.filter((x) => !x.demo).concat(added); select((vols.slice().sort((a, b) => b.nz - a.nz)[0] || added[0]).id); I.fr = 0; }
    I.busy = '';
    OS.render();
    const cines = images.filter((x) => x.kind === 'cine').length, stills = images.length - cines;
    const msg = added.length ? `Opened ${[vols.length ? `${vols.length} volume${vols.length > 1 ? 's' : ''}` : '', stills ? `${stills} image${stills > 1 ? 's' : ''}` : '', cines ? `${cines} loop${cines > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')}${skipped ? `. Skipped ${skipped} file${skipped > 1 ? 's' : ''}` : ''}${skipped && why ? `: ${why.replace(/\.$/, '')}` : ''}.` : (why || 'No readable images found in those files.');
    OS.toast(msg);
    if (added.length && OS.logEvent) OS.logEvent('scan', `Scans opened: ${added.map((x) => x.modality).filter((m, k, a) => a.indexOf(m) === k).join(', ')}`, msg, { src: 'file', go: 'imaging' });
    return added;
  }
  OS.change('img-files', async (el) => { const files = [...(el.files || [])]; el.value = ''; if (files.length) await importFiles(files); });

  if (window.indexedDB) loadAll(); else { I.persistent = false; I.studies.push(phantom()); select('demo-phantom'); }
  OS.imaging = { parseDicom, buildVolume, phantom, tissue, state: I, importFiles, decodeFrames, ljpegDecode, rleDecode, niftiVolume, prep };
})();
