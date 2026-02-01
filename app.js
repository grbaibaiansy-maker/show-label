(function () {
  const refImageInput = document.getElementById('refImageInput');
  const refImageEl = document.getElementById('refImage');
  const refPlaceholder = document.getElementById('refPlaceholder');
  const imageInput = document.getElementById('imageInput');
  const imageEl = document.getElementById('image');
  const overlay = document.getElementById('overlay');
  const canvasWrap = document.getElementById('canvasWrap');
  const placeholder = document.getElementById('placeholder');
  const cellList = document.getElementById('cellList');
  const rowsInput = document.getElementById('rowsInput');
  const colsInput = document.getElementById('colsInput');
  const cellWidthInput = document.getElementById('cellWidthInput');
  const cellHeightInput = document.getElementById('cellHeightInput');
  const groundTruthFileInput = document.getElementById('groundTruthFileInput');
  const groundTruthFileName = document.getElementById('groundTruthFileName');
  const saveBtn = document.getElementById('saveBtn');
  const clearAllBtn = document.getElementById('clearAll');
  const modeSelectBtn = document.getElementById('modeSelect');
  const modeDragGridBtn = document.getElementById('modeDragGrid');
  const modeDragImageBtn = document.getElementById('modeDragImage');
  const resetAlignBtn = document.getElementById('resetAlign');

  let rows = 4, cols = 5;
  let userSelected = new Set();
  let groundTruthFalse = [];
  let submitted = false;
  let gridOffsetX = 0, gridOffsetY = 0;
  let imageOffsetX = 0, imageOffsetY = 0;
  let mode = 'dragGrid';
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let dragStartGridX = 0, dragStartGridY = 0;
  let dragStartImageX = 0, dragStartImageY = 0;
  let ctx = overlay.getContext('2d');

  function getImageRect() {
    const wrap = canvasWrap.getBoundingClientRect();
    const img = imageEl;
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;
    let maxW = wrap.width;
    let maxH = wrap.height;
    if (maxW <= 0) maxW = naturalW;
    if (maxH <= 0) maxH = naturalH;
    let w = naturalW, h = naturalH;
    if (w > maxW || h > maxH) {
      const r = Math.min(maxW / w, maxH / h);
      w = w * r;
      h = h * r;
    }
    const baseX = (wrap.width - w) / 2;
    const baseY = (wrap.height - h) / 2;
    return {
      x: baseX + imageOffsetX,
      y: baseY + imageOffsetY,
      width: w,
      height: h
    };
  }

  function getDisplaySize() {
    const r = getImageRect();
    return { width: r.width, height: r.height };
  }

  function getCellSize() {
    const { width, height } = getDisplaySize();
    const cw = parseInt(cellWidthInput.value, 10);
    const ch = parseInt(cellHeightInput.value, 10);
    const w = cw > 0 ? cw : width / cols;
    const h = ch > 0 ? ch : height / rows;
    return { w, h };
  }

  function getCellFromPoint(px, py) {
    const { width, height } = getDisplaySize();
    const { w: cellW, h: cellH } = getCellSize();
    const qx = px - gridOffsetX;
    const qy = py - gridOffsetY;
    if (qx < 0 || qy < 0 || qx >= width || qy >= height) return null;
    const col = Math.floor(qx / cellW);
    const row = Math.floor(qy / cellH);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { row, col };
  }

  function getGridSizePx() {
    const { w, h } = getCellSize();
    return { width: cols * w, height: rows * h };
  }

  function getCellRect(row, col) {
    const { w: cellW, h: cellH } = getCellSize();
    return {
      x: gridOffsetX + col * cellW,
      y: gridOffsetY + row * cellH,
      w: cellW,
      h: cellH
    };
  }

  function syncOverlaySize() {
    const rect = getImageRect();
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.left = rect.x + 'px';
    overlay.style.top = rect.y + 'px';
    overlay.width = rect.width;
    overlay.height = rect.height;
    imageEl.style.position = 'absolute';
    imageEl.style.left = rect.x + 'px';
    imageEl.style.top = rect.y + 'px';
    imageEl.style.width = rect.width + 'px';
    imageEl.style.height = rect.height + 'px';
    redrawOverlay();
  }

  function redrawOverlay() {
    const rect = getImageRect();
    if (overlay.width !== rect.width || overlay.height !== rect.height) {
      overlay.width = rect.width;
      overlay.height = rect.height;
    }
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const { w: cellW, h: cellH } = getCellSize();

    // 绘制网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      const x = gridOffsetX + c * cellW;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, overlay.height);
    }
    for (let r = 0; r <= rows; r++) {
      const y = gridOffsetY + r * cellH;
      ctx.moveTo(0, y);
      ctx.lineTo(overlay.width, y);
    }
    ctx.stroke();

    // 每个格子内标注行列索引 (row, col)
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3b82f6';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = getCellRect(r, c);
        const cx = cell.x + cell.w / 2;
        const cy = cell.y + cell.h / 2;
        ctx.fillText(`${r},${c}`, cx, cy);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.font = '12px sans-serif';

    userSelected.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      const cell = getCellRect(r, c);
      ctx.strokeStyle = '#f7768e';
      ctx.lineWidth = 3;
      ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
    });

    if (submitted && groundTruthFalse.length > 0) {
      groundTruthFalse.forEach(([r, c]) => {
        const cell = getCellRect(r, c);
        ctx.strokeStyle = '#9ece6a';
        ctx.lineWidth = 3;
        ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
        ctx.fillStyle = 'rgba(158, 206, 106, 0.5)';
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      });
    }
  }

  function parseGroundTruthFromText(raw) {
    const list = [];
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach((line, row) => {
      const parts = line.split(/[\s,]+/).filter(Boolean);
      parts.forEach((val, col) => {
        const v = val.toLowerCase();
        if (v === '0' || v === 'false' || v === 'f') list.push([row, col]);
      });
    });
    return list;
  }

  function renderCellList() {
    const entries = Array.from(userSelected).sort((a, b) => {
      const [r1, c1] = a.split(',').map(Number);
      const [r2, c2] = b.split(',').map(Number);
      return r1 !== r2 ? r1 - r2 : c1 - c2;
    });
    cellList.innerHTML = '';
    entries.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      const li = document.createElement('li');
      li.innerHTML = `<span>(${r}, ${c})</span> <button type="button" class="remove-cell" aria-label="取消">×</button>`;
      li.querySelector('.remove-cell').addEventListener('click', function (e) {
        e.stopPropagation();
        userSelected.delete(key);
        renderCellList();
        redrawOverlay();
      });
      cellList.appendChild(li);
    });
  }

  function setMode(m) {
    mode = m;
    modeDragGridBtn.classList.toggle('active', m === 'dragGrid');
    modeDragImageBtn.classList.toggle('active', m === 'dragImage');
    modeSelectBtn.classList.toggle('active', m === 'select');
    canvasWrap.classList.toggle('align-drag', m === 'dragGrid' || m === 'dragImage');
    
  }

  function getOverlayCoords(clientX, clientY) {
    const rect = overlay.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  refImageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    refImageEl.onload = function () {
      URL.revokeObjectURL(url);
      refImageEl.classList.remove('hidden');
      refPlaceholder.classList.add('hidden');
    };
    refImageEl.src = url;
  });

  imageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    imageEl.onload = function () {
      URL.revokeObjectURL(url);
      imageEl.classList.remove('hidden');
      placeholder.classList.add('hidden');
      canvasWrap.classList.add('has-image');
      rows = parseInt(rowsInput.value, 10) || 4;
      cols = parseInt(colsInput.value, 10) || 5;
      userSelected.clear();
      submitted = false;
      gridOffsetX = 0;
      gridOffsetY = 0;
      imageOffsetX = 0;
      imageOffsetY = 0;
      renderCellList();
      syncOverlaySize();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          syncOverlaySize();
        });
      });
    };
    imageEl.src = url;
  });

  rowsInput.addEventListener('change', function () {
    rows = parseInt(rowsInput.value, 10) || 4;
    if (imageEl.src && imageEl.complete) syncOverlaySize();
  });
  colsInput.addEventListener('change', function () {
    cols = parseInt(colsInput.value, 10) || 5;
    if (imageEl.src && imageEl.complete) syncOverlaySize();
  });

  cellWidthInput.addEventListener('input', function () {
    if (imageEl.src && imageEl.complete) redrawOverlay();
  });
  cellWidthInput.addEventListener('change', function () {
    if (imageEl.src && imageEl.complete) redrawOverlay();
  });
  cellHeightInput.addEventListener('input', function () {
    if (imageEl.src && imageEl.complete) redrawOverlay();
  });
  cellHeightInput.addEventListener('change', function () {
    if (imageEl.src && imageEl.complete) redrawOverlay();
  });

  window.addEventListener('resize', function () {
    if (imageEl.src && imageEl.complete) syncOverlaySize();
  });

  overlay.addEventListener('mousedown', function (e) {
    if (!imageEl.src || !imageEl.complete) return;
    const pos = getOverlayCoords(e.clientX, e.clientY);
    if (mode === 'dragGrid') {
      isDragging = true;
      canvasWrap.classList.add('dragging');
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartGridX = gridOffsetX;
      dragStartGridY = gridOffsetY;
      return;
    }
    if (mode === 'dragImage') {
      isDragging = true;
      canvasWrap.classList.add('dragging');
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartImageX = imageOffsetX;
      dragStartImageY = imageOffsetY;
      return;
    }
    const cell = getCellFromPoint(pos.x, pos.y);
    if (!cell) return;
    const key = `${cell.row},${cell.col}`;
    if (userSelected.has(key)) userSelected.delete(key);
    else userSelected.add(key);
    renderCellList();
    redrawOverlay();
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    if (mode === 'dragGrid') {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      gridOffsetX = dragStartGridX + dx;
      gridOffsetY = dragStartGridY + dy;
      redrawOverlay();
    } else if (mode === 'dragImage') {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      imageOffsetX = dragStartImageX + dx;
      imageOffsetY = dragStartImageY + dy;
      syncOverlaySize();
    }
  });

  window.addEventListener('mouseup', function () {
    if (isDragging) canvasWrap.classList.remove('dragging');
    isDragging = false;
  });

  modeDragGridBtn.addEventListener('click', function () { setMode('dragGrid'); });
  modeDragImageBtn.addEventListener('click', function () { setMode('dragImage'); });
  modeSelectBtn.addEventListener('click', function () { setMode('select'); });
  setMode('dragGrid');

  resetAlignBtn.addEventListener('click', function () {
    gridOffsetX = 0;
    gridOffsetY = 0;
    imageOffsetX = 0;
    imageOffsetY = 0;
    if (imageEl.src && imageEl.complete) syncOverlaySize();
    else redrawOverlay();
  });

  groundTruthFileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    groundTruthFileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const raw = (ev.target && ev.target.result) || '';
      groundTruthFalse = parseGroundTruthFromText(raw);
      submitted = true;
      redrawOverlay();
    };
    reader.readAsText(file, 'UTF-8');
  });

  saveBtn.addEventListener('click', function () {
    if (!imageEl.src || !imageEl.complete) return;
    const w = overlay.width;
    const h = overlay.height;
    if (w <= 0 || h <= 0) return;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const outCtx = out.getContext('2d');
    outCtx.drawImage(imageEl, 0, 0, imageEl.naturalWidth, imageEl.naturalHeight, 0, 0, w, h);
    outCtx.drawImage(overlay, 0, 0);
    const link = document.createElement('a');
    link.download = 'annotated-' + Date.now() + '.png';
    link.href = out.toDataURL('image/png');
    link.click();
  });

  clearAllBtn.addEventListener('click', function () {
    userSelected.clear();
    submitted = false;
    renderCellList();
    redrawOverlay();
  });
})();
