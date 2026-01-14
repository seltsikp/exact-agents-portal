// modules/labs.js
export function initLabManagement({ ui, helpers }) {
  const { show } = helpers;

  const {
    lmViewBtn,
    lmAddBtn,
    lmClearBtn,
    labMsg,
    lmViewPanel,
    lmAddPanel
  } = ui;

  const setLabMsg = (t) => { if (labMsg) labMsg.textContent = t || ""; };

  function resetLabsScreen() {
    show(lmViewPanel, false);
    show(lmAddPanel, false);
    show(lmClearBtn, false);
    setLabMsg("");
  }

  function showViewLabsPanel() {
    show(lmViewPanel, true);
    show(lmAddPanel, false);
    show(lmClearBtn, true);
    setLabMsg("Click “Add lab” to enter a new lab (coming next).");
  }

  function showAddLabPanel() {
    show(lmViewPanel, false);
    show(lmAddPanel, true);
    show(lmClearBtn, true);
    setLabMsg("Add/edit lab form will be added next.");
  }

  // buttons
  if (lmViewBtn) lmViewBtn.addEventListener("click", showViewLabsPanel);
  if (lmAddBtn) lmAddBtn.addEventListener("click", showAddLabPanel);
  if (lmClearBtn) lmClearBtn.addEventListener("click", resetLabsScreen);

  return {
    resetLabsScreen
  };
}
