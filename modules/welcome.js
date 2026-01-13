// modules/welcome.js
export function showWelcomePanel({ containerEl }) {
  if (!containerEl) return;

  containerEl.innerHTML = `
    <div style="padding:2px 0;">
      <h2 style="margin-top:0;">Welcome</h2>
      <p style="margin:0 0 10px 0;">
        Welcome to the <b>EXACT Cosmetics Portal</b>.
      </p>
      <p class="subtle" style="margin:0;">
        If you encounter any issues whatsoever, please contact us at
        <b>exactportal@exactcosmetics.com</b>.
      </p>
    </div>
  `;
}
