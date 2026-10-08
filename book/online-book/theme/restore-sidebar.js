// Inlined at the end of the sidebar so it runs before the first paint.
// Ox Content restores the sidebar scroll from a deferred script, which paints
// the sidebar at the top first and then jumps — visible as a flicker on every
// page change (and captured into the view-transition snapshot).
(function () {
  var sidebar = document.getElementById("ox-sidebar");
  if (!sidebar) return;
  try {
    var saved = sessionStorage.getItem("sidebarScroll");
    if (saved) sidebar.scrollTop = parseInt(saved, 10);
  } catch (_) {}
  // Keep the current page visible, e.g. on a direct visit or a jump via search.
  var active = sidebar.querySelector("a.active");
  if (!active) return;
  var top =
    active.getBoundingClientRect().top - sidebar.getBoundingClientRect().top + sidebar.scrollTop;
  var view = sidebar.clientHeight;
  if (top < sidebar.scrollTop || top > sidebar.scrollTop + view - 48) {
    sidebar.scrollTop = Math.max(0, top - view / 3);
  }
})();
