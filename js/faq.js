document.querySelectorAll('.faq-panel, .rules-preview-list').forEach((group) => {
  group.addEventListener('toggle', (event) => {
    const item = event.target;
    if (item.tagName !== 'DETAILS' || !item.open) return;
    group.querySelectorAll('details[open]').forEach((other) => {
      if (other !== item) other.open = false;
    });
  }, true);
});
