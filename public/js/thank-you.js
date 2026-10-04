import { api } from './api.js';

const CODE_PATTERN = /^GT-[2-9A-HJKMNP-TV-Z]{6}$/;
const code = new URLSearchParams(window.location.search).get('code')?.toUpperCase();

if (code && CODE_PATTERN.test(code)) {
  document.getElementById('donation-code').textContent = code;
  document.getElementById('code-box').hidden = false;
  document.getElementById('track-link').href = `/track?code=${encodeURIComponent(code)}`;

  const copyButton = document.getElementById('copy-code');
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      copyButton.querySelector('span').textContent = 'Copied';
    } catch {
      copyButton.querySelector('span').textContent = 'Copy failed';
    }
  });

  api(`/api/donations/${encodeURIComponent(code)}`)
    .then((donation) => {
      document.getElementById('greeting').textContent =
        `Thank you, ${donation.firstName}! Your ${donation.categoryLabel.toLowerCase()} donation has been registered.`;
    })
    .catch(() => {});
}
