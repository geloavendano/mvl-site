/* ==========================================================================
   Shared image lightbox — the prize posters on /mvl/checkin and the roster
   reveals on the team cards. Extracted from checkin.js so both pages get the
   same zoom, pan and dismissal behaviour rather than two implementations
   drifting apart.

   Fit-to-screen by default, one tap to natural size. When zoomed the stage
   scrolls, so panning is drag-to-scroll rather than a transform matrix — that
   keeps momentum scrolling and pinch-zoom native on touch.
   ========================================================================== */
window.createLightbox = ({ dialog, img, stage, hint, zoomedHint, fitHint }) => {
  if (!dialog || !img || !stage) return null;

  const setZoom = (on) => {
    dialog.classList.toggle('is-zoomed', on);
    if (hint) hint.textContent = on
      ? (zoomedHint || 'Drag to pan · tap to fit')
      : (fitHint || 'Tap the image to zoom');
    if (!on) { stage.scrollTop = 0; stage.scrollLeft = 0; }
  };

  const open = (src, label) => {
    img.src = src;
    img.alt = label || '';
    setZoom(false);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  img.addEventListener('click', () => setZoom(!dialog.classList.contains('is-zoomed')));

  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-lightbox-close]')) { dialog.close(); return; }
    // the ::backdrop and the stage's own padding both register on those elements,
    // never on the image — so a click there means "outside the image"
    if (event.target === dialog || event.target === stage) dialog.close();
  });

  // Release the decoded image rather than holding every poster in memory. The
  // close event is queued as a task, not fired synchronously, so a quick
  // close-then-reopen would land this after the new src was set and blank the
  // image — hence the guard.
  dialog.addEventListener('close', () => {
    if (!dialog.open) img.removeAttribute('src');
  });

  // Drag-to-pan. Pointer events cover mouse, pen and single-finger touch; a
  // second finger falls through to the browser's own pinch-zoom.
  let panning = false;
  let panFrom = { x: 0, y: 0, left: 0, top: 0 };
  stage.addEventListener('pointerdown', (event) => {
    if (!dialog.classList.contains('is-zoomed') || event.button) return;
    panning = true;
    panFrom = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
  });
  stage.addEventListener('pointermove', (event) => {
    if (!panning) return;
    stage.scrollLeft = panFrom.left - (event.clientX - panFrom.x);
    stage.scrollTop = panFrom.top - (event.clientY - panFrom.y);
  });
  const endPan = () => { panning = false; };
  stage.addEventListener('pointerup', endPan);
  stage.addEventListener('pointercancel', endPan);
  stage.addEventListener('pointerleave', endPan);

  return { open, setZoom };
};
