function showMaximized(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.maximize();
  window.show();
  window.focus();
}
module.exports = { showMaximized };
