import { api } from './api.js';

const REDIRECT_DELAY_MS = 1800;

setUpNavbar();
setUpGallery();
setUpDonationForm();

function setUpNavbar() {
  const toggler = document.querySelector('.navbar-toggler');
  const menu = document.getElementById('main-nav');

  const setOpen = (open) => {
    menu.classList.toggle('show', open);
    toggler.setAttribute('aria-expanded', String(open));
  };
  toggler.addEventListener('click', () => setOpen(!menu.classList.contains('show')));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
}

function setUpGallery() {
  const popup = document.querySelector('.pop-image');
  const popupImage = popup.querySelector('img');
  const close = () => {
    popup.hidden = true;
  };

  document.querySelectorAll('.gallery-sec .image').forEach((button) => {
    button.addEventListener('click', () => {
      const image = button.querySelector('img');
      popupImage.src = image.src;
      popupImage.alt = image.alt;
      popup.hidden = false;
      popup.querySelector('.pop-close').focus();
    });
  });
  popup.addEventListener('click', (event) => {
    if (event.target !== popupImage) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

function setUpDonationForm() {
  const form = document.getElementById('donation-form');
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('button[type="submit"]');

  document.querySelectorAll('[data-category]').forEach((link) => {
    link.addEventListener('click', () => {
      form.elements.category.value = link.dataset.category;
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    showStatus(status, null);
    submit.disabled = true;

    try {
      const values = Object.fromEntries(new FormData(form));
      const { code, firstName } = await api('api/donations', { method: 'POST', body: values });

      form.reset();
      showStatus(status, 'success', `Thank you, ${firstName}! Your donation code is ${code}. Taking you to your confirmation...`);
      setTimeout(() => {
        window.location.assign(`thank-you?code=${encodeURIComponent(code)}`);
      }, REDIRECT_DELAY_MS);
    } catch (err) {
      submit.disabled = false;
      for (const { field, message } of err.details ?? []) markInvalid(form, field, message);
      showStatus(status, 'danger', err.message || 'Something went wrong. Please try again.');
    }
  });
}

function markInvalid(form, field, message) {
  const input = form.elements[field];
  if (!input || input.classList.contains('is-invalid')) return;
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
  input.parentElement.querySelector('.invalid-feedback').textContent = message;
}

function clearErrors(form) {
  form.querySelectorAll('.is-invalid').forEach((input) => {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  });
}

function showStatus(element, kind, message = '') {
  element.hidden = !kind;
  element.className = kind ? `form-status alert alert-${kind}` : 'form-status alert';
  element.textContent = message;
}
