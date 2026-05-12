const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');
const tool = document.getElementById('tool');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const shapeFill = document.getElementById('shapeFill');
const shapeType = document.getElementById('shapeType');
const fillBtn = document.getElementById('fillBtn');

// Size canvases to the wrapper so overlay aligns perfectly
function setCanvasSize() {
  const wrap = document.querySelector('.canvas-wrap');
  if (!wrap) return;
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.max(0, wrap.clientWidth);
  const ch = Math.max(0, wrap.clientHeight);
  // style size in CSS pixels
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  overlay.style.width = cw + 'px';
  overlay.style.height = ch + 'px';
  // backing store size for crisp drawing
  canvas.width = Math.floor(cw * dpr);
  canvas.height = Math.floor(ch * dpr);
  overlay.width = Math.floor(cw * dpr);
  overlay.height = Math.floor(ch * dpr);
  // reset transforms to dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

setCanvasSize();

let drawing = false;
let history = [];
let step = -1;
let startPoint = null; // for shapes
let currentTool = tool.value;

function getEffectiveTool() {
  return currentTool === 'shape' ? (shapeType ? shapeType.value : 'rectangle') : currentTool;
}

// Inset margin (pixels) where drawing is NOT allowed. We'll draw a visible line at this inset.
const INSET = 24; // pixels from each edge

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
  const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function isInsideDrawableArea(x, y) {
  return x >= INSET && y >= INSET && x <= (canvas.clientWidth - INSET) && y <= (canvas.clientHeight - INSET);
}

function startDraw(e) {
  e.preventDefault();
  const p = getPos(e);
  if (!isInsideDrawableArea(p.x, p.y)) return; // ignore starts in the border region
  const eff = getEffectiveTool();
  if (eff === 'pen' || eff === 'eraser') {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    draw(e);
  } else if (eff === 'line' || eff === 'rectangle' || eff === 'ellipse' || eff === 'diamond' || eff === 'star' || eff === 'triangle') {
    startPoint = p;
  } else if (eff === 'fill') {
    floodFillAtPoint(p);
    saveState();
  } else if (eff === 'text') {
    const text = prompt('Enter text');
    if (text) {
      drawTextAt(p, text);
      saveState();
    }
  } else if (eff === 'eyedropper') {
    pickColorAt(p);
  }
}

function endDraw() {
  if (drawing) {
    drawing = false;
    ctx.beginPath();
    saveState();
  } else if (startPoint) {
    // commit shape directly to the main canvas
    commitShapeToCanvas(startPoint, lastPosForPreview || startPoint);
    startPoint = null;
    lastPosForPreview = null;
    // clear overlay preview but keep border
    drawInsetBorder();
    saveState();
  }
}

function draw(e) {
  e.preventDefault();
  const pos = getPos(e);
  if (!isInsideDrawableArea(pos.x, pos.y)) return;
  const eff = getEffectiveTool();

  if (drawing && (eff === 'pen' || eff === 'eraser')) {
    ctx.lineWidth = brushSize.value;
    ctx.lineCap = 'round';
    ctx.strokeStyle = eff === 'eraser' ? '#fff' : colorPicker.value;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  } else if (startPoint && (eff === 'line' || eff === 'rectangle' || eff === 'ellipse' || eff === 'diamond' || eff === 'star' || eff === 'triangle')) {
    previewShape(startPoint, pos);
  }
}

function saveState() {
  step++;
  if (step < history.length) history.length = step;
  history.push(canvas.toDataURL());
}

function undo() {
  if (step > 0) {
    step--;
    let img = new Image();
    img.src = history[step];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
    };
  }
}

function redo() {
  if (step < history.length - 1) {
    step++;
    let img = new Image();
    img.src = history[step];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
    };
  }
}

// restoreFromHistory no longer needed in raster-only mode

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  saveState();
}

function saveImage() {
  // Export drawing as JPEG. JPEG doesn't support transparency, so composite
  // the canvas and overlay onto a white background on an offscreen canvas.
  const temp = document.createElement('canvas');
  // use the backing store size for best quality
  temp.width = canvas.width;
  temp.height = canvas.height;
  const tctx = temp.getContext('2d');
  // fill white background to replace transparency
  tctx.fillStyle = '#fff';
  tctx.fillRect(0, 0, temp.width, temp.height);
  // draw the main canvas content
  tctx.drawImage(canvas, 0, 0, temp.width, temp.height);
  // draw the overlay (border/dim) on top so the exported image matches what's visible
  tctx.drawImage(overlay, 0, 0, temp.width, temp.height);
  const data = temp.toDataURL('image/jpeg', 0.92);
  const link = document.createElement('a');
  link.download = 'drawing.jpg';
  link.href = data;
  link.click();
}

window.addEventListener('resize', resizeAndRedraw);
resizeAndRedraw(); // Initial sizing and border

// Mouse events
// Pointer events for better cross-device support
canvas.addEventListener('pointerdown', startDraw);
canvas.addEventListener('pointerup', endDraw);
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerleave', endDraw);

// Touch-action none to avoid scrolling while drawing
canvas.style.touchAction = 'none';


// Buttons
clearBtn.addEventListener('click', clearCanvas);
saveBtn.addEventListener('click', saveImage);
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// Initialize blank state
saveState();

// Keep current tool in sync
tool.addEventListener('change', () => {
  currentTool = tool.value;
  updateActiveUI();
});

// Fill button sets current tool to fill mode
if (fillBtn) {
  fillBtn.addEventListener('click', () => {
    currentTool = 'fill';
    if (tool) tool.value = 'fill';
    updateActiveUI();
  });
}

// =========================
// Toolbar Buttons & Swatches
// =========================
const toolButtons = Array.from(document.querySelectorAll('.tool-btn'));
const shapeButtons = Array.from(document.querySelectorAll('.shape-btn'));
const swatches = Array.from(document.querySelectorAll('.swatch'));

function setTool(t) {
  currentTool = t;
  if (tool) tool.value = t === 'pen' || t === 'eraser' || t === 'text' || t === 'eyedropper' || t === 'fill' ? t : tool.value;
  updateActiveUI();
}

function setShape(s) {
  if (shapeType) shapeType.value = s;
  currentTool = 'shape';
  if (tool) tool.value = 'shape';
  updateActiveUI();
}

function updateActiveUI() {
  const eff = getEffectiveTool();
  // tools
  toolButtons.forEach(btn => {
    const t = btn.getAttribute('data-tool');
    const active = (t === currentTool) || (t === 'pen' && eff === 'pen') || (t === 'eraser' && eff === 'eraser') || (t === 'text' && eff === 'text') || (t === 'eyedropper' && eff === 'eyedropper') || (t === 'fill' && eff === 'fill');
    btn.classList.toggle('active', active);
  });
  // shapes
  shapeButtons.forEach(btn => {
    const s = btn.getAttribute('data-shape');
    btn.classList.toggle('active', currentTool === 'shape' && shapeType && shapeType.value === s);
  });
  // swatches
  swatches.forEach(sw => {
    sw.classList.toggle('active', sw.getAttribute('data-color')?.toLowerCase() === colorPicker.value.toLowerCase());
  });
}

toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.getAttribute('data-tool');
    setTool(t);
  });
});

shapeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const s = btn.getAttribute('data-shape');
    setShape(s);
  });
});

swatches.forEach(sw => {
  sw.addEventListener('click', () => {
    const c = sw.getAttribute('data-color');
    if (c) {
      colorPicker.value = c;
      updateActiveUI();
    }
  });
});

colorPicker.addEventListener('input', () => updateActiveUI());

// initialize active states on load
updateActiveUI();

// =========================
// Shapes preview and commit
// =========================
let lastPosForPreview = null;

function previewShape(p0, p1) {
  lastPosForPreview = p1;
  // clear overlay then redraw border and preview
  drawInsetBorder();
  octx.save();
  octx.lineWidth = brushSize.value;
  octx.strokeStyle = colorPicker.value;
  octx.fillStyle = colorPicker.value;
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);

  const eff = getEffectiveTool();
  if (eff === 'line') {
    octx.beginPath();
    octx.moveTo(p0.x, p0.y);
    octx.lineTo(p1.x, p1.y);
    octx.stroke();
  } else if (eff === 'rectangle') {
    if (shapeFill && shapeFill.checked) {
      octx.fillRect(x, y, w, h);
    } else {
      octx.strokeRect(x, y, w, h);
    }
  } else if (eff === 'ellipse') {
    octx.beginPath();
    octx.ellipse(x + w / 2, y + h / 2, Math.max(0, w / 2), Math.max(0, h / 2), 0, 0, Math.PI * 2);
    if (shapeFill && shapeFill.checked) octx.fill(); else octx.stroke();
  } else if (eff === 'diamond') {
    // four points: mid-top, mid-right, mid-bottom, mid-left
    const cx = x + w / 2, cy = y + h / 2;
    octx.beginPath();
    octx.moveTo(cx, y);
    octx.lineTo(x + w, cy);
    octx.lineTo(cx, y + h);
    octx.lineTo(x, cy);
    octx.closePath();
    if (shapeFill && shapeFill.checked) octx.fill(); else octx.stroke();
  } else if (eff === 'star') {
    drawStar(octx, x, y, w, h, shapeFill && shapeFill.checked);
  } else if (eff === 'triangle') {
    octx.beginPath();
    octx.moveTo(x + w / 2, y);           // top
    octx.lineTo(x, y + h);               // bottom-left
    octx.lineTo(x + w, y + h);           // bottom-right
    octx.closePath();
    if (shapeFill && shapeFill.checked) octx.fill(); else octx.stroke();
  }
  octx.restore();
}

function commitShapeToCanvas(p0, p1) {
  if (!p0 || !p1) return;
  ctx.save();
  ctx.lineWidth = brushSize.value;
  ctx.strokeStyle = colorPicker.value;
  ctx.fillStyle = colorPicker.value;
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);

  const eff = getEffectiveTool();
  if (eff === 'line') {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  } else if (eff === 'rectangle') {
    if (shapeFill && shapeFill.checked) {
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  } else if (eff === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.max(0, w / 2), Math.max(0, h / 2), 0, 0, Math.PI * 2);
    if (shapeFill && shapeFill.checked) ctx.fill(); else ctx.stroke();
  } else if (eff === 'diamond') {
    const cx = x + w / 2, cy = y + h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(cx, y + h);
    ctx.lineTo(x, cy);
    ctx.closePath();
    if (shapeFill && shapeFill.checked) ctx.fill(); else ctx.stroke();
  } else if (eff === 'star') {
    drawStar(ctx, x, y, w, h, shapeFill && shapeFill.checked);
  } else if (eff === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);           // top
    ctx.lineTo(x, y + h);               // bottom-left
    ctx.lineTo(x + w, y + h);           // bottom-right
    ctx.closePath();
    if (shapeFill && shapeFill.checked) ctx.fill(); else ctx.stroke();
  }
  ctx.restore();
}

// Draw a 5-point star fitted to bounding box
function drawStar(context, x, y, w, h, filled) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.5;
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5; // start at -90deg
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
  if (filled) context.fill(); else context.stroke();
}

// =========================
// Eyedropper
// =========================
function pickColorAt(p) {
  const dpr = window.devicePixelRatio || 1;
  const x = Math.floor(p.x * dpr);
  const y = Math.floor(p.y * dpr);
  try {
    const data = ctx.getImageData(x, y, 1, 1).data;
    const r = data[0], g = data[1], b = data[2];
    colorPicker.value = rgbToHex(r, g, b);
  } catch (_) {
    // ignore security errors (tainted canvas)
  }
}

function rgbToHex(r, g, b) {
  return (
    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
  );
}

// =========================
// Text
// =========================
function drawTextAt(p, text) {
  ctx.save();
  const size = Math.max(10, parseInt(brushSize.value, 10) * 4);
  ctx.font = `${size}px Arial`;
  ctx.fillStyle = colorPicker.value;
  ctx.textBaseline = 'top';
  ctx.fillText(text, p.x, p.y);
  ctx.restore();
}

// =========================
// Flood fill (4-way)
// =========================
function floodFillAtPoint(p) {
  const dpr = window.devicePixelRatio || 1;
  const x0 = Math.floor(p.x * dpr);
  const y0 = Math.floor(p.y * dpr);
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  const targetIdx = (y0 * w + x0) * 4;
  const tr = data[targetIdx], tg = data[targetIdx + 1], tb = data[targetIdx + 2], ta = data[targetIdx + 3];

  // new color from colorPicker
  const hex = colorPicker.value;
  const nr = parseInt(hex.slice(1, 3), 16);
  const ng = parseInt(hex.slice(3, 5), 16);
  const nb = parseInt(hex.slice(5, 7), 16);
  const na = 255;

  // If target color is already the new color, bail
  if (tr === nr && tg === ng && tb === nb && ta === na) return;

  const stack = [[x0, y0]];

  function match(x, y) {
    const i = (y * w + x) * 4;
    return data[i] === tr && data[i + 1] === tg && data[i + 2] === tb && data[i + 3] === ta;
  }

  function colorPixel(x, y) {
    const i = (y * w + x) * 4;
    data[i] = nr; data[i + 1] = ng; data[i + 2] = nb; data[i + 3] = na;
  }

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    if (!match(x, y)) continue;

    // scan left-right
    let xl = x, xr = x;
    while (xl - 1 >= 0 && match(xl - 1, y)) xl--;
    while (xr + 1 < w && match(xr + 1, y)) xr++;
    for (let xi = xl; xi <= xr; xi++) {
      colorPixel(xi, y);
      if (y - 1 >= 0 && match(xi, y - 1)) stack.push([xi, y - 1]);
      if (y + 1 < h && match(xi, y + 1)) stack.push([xi, y + 1]);
    }
  }

  ctx.putImageData(img, 0, 0);
}

function drawInsetBorder() {
  // draw the border on the overlay so drawing doesn't erase it
  octx.clearRect(0, 0, overlay.clientWidth, overlay.clientHeight);
  octx.save();
  octx.setLineDash([4, 6]);
  octx.lineWidth = 1;
  octx.strokeStyle = '#222';
  // use half-pixel offset for crisp 1px lines
  octx.strokeRect(INSET + 0.5, INSET + 0.5, overlay.clientWidth - INSET * 2 - 1, overlay.clientHeight - INSET * 2 - 1);
  octx.restore();
}

function resizeAndRedraw() {
  // preserve current image
  const data = canvas.toDataURL();
  setCanvasSize();
  const img = new Image();
  img.src = data;
  img.onload = () => {
    // clear using CSS pixels
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    // draw preserved content scaled to new size
    ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
    drawInsetBorder();
  };
}