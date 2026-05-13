/**
 * PLai Gift Modal — reusable email collection form
 *
 * Usage:
 *   <button data-gift="article_continue">続きを読む</button>
 *   <button data-gift="obsidian_vault">Vaultテンプレを受け取る</button>
 *
 * On click:
 *   - Opens modal
 *   - On form submit → POST /api/subscribe
 *   - On success → fires `gift:unlocked` CustomEvent on the trigger element
 *
 * Article gates: listen for `gift:unlocked` to reveal hidden content.
 * Vault download: redirects to /decks/obsidian-vault-template.html
 *
 * LocalStorage caches successful submissions to avoid re-asking on same browser.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'plai_gift_unlocked';
  let modalEl = null;
  let currentTrigger = null;

  function init() {
    // Pre-unlock if user has already submitted (same gift_type)
    document.querySelectorAll('[data-gift]').forEach((btn) => {
      const giftType = btn.getAttribute('data-gift');
      if (isUnlocked(giftType)) {
        btn.classList.add('gift-trigger--unlocked');
      }
      btn.addEventListener('click', onTriggerClick);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl) closeModal();
    });
  }

  function onTriggerClick(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const giftType = btn.getAttribute('data-gift');
    if (isUnlocked(giftType)) {
      // Already submitted — fire the unlock event directly
      btn.dispatchEvent(new CustomEvent('gift:unlocked', { bubbles: true, detail: { gift_type: giftType, cached: true } }));
      if (giftType === 'obsidian_vault') {
        window.open(btn.getAttribute('data-download') || '/decks/obsidian-vault-template.html', '_blank');
      }
      return;
    }
    currentTrigger = btn;
    openModal(giftType, btn);
  }

  function openModal(giftType, triggerBtn) {
    if (modalEl) closeModal();

    const title = triggerBtn.getAttribute('data-title')
      || (giftType === 'obsidian_vault' ? '無料プレゼント：Obsidian Vault テンプレ' : '記事の続きを読む');
    const subtitle = triggerBtn.getAttribute('data-subtitle')
      || (giftType === 'obsidian_vault'
        ? 'PLaiが運用中のVault構造をHTMLスライドで公開しています。下記4項目を入力すると、即座にダウンロード/閲覧できます。'
        : '残りの本文はメアド登録で読めます。下記4項目を入力すると、その場で続きを表示します。');

    modalEl = document.createElement('div');
    modalEl.className = 'gift-modal';
    modalEl.innerHTML = `
      <div class="gift-modal__backdrop" data-close></div>
      <div class="gift-modal__panel" role="dialog" aria-modal="true" aria-labelledby="gift-modal-title">
        <button type="button" class="gift-modal__close" data-close aria-label="閉じる">×</button>
        <p class="gift-modal__eyebrow">FREE</p>
        <h3 id="gift-modal-title" class="gift-modal__title">${escapeHtml(title)}</h3>
        <p class="gift-modal__subtitle">${escapeHtml(subtitle)}</p>
        <form class="gift-modal__form" novalidate>
          <label class="gift-modal__field">
            <span>お名前 <em>必須</em></span>
            <input type="text" name="name" required maxlength="100" placeholder="山田 太郎">
          </label>
          <label class="gift-modal__field">
            <span>メールアドレス <em>必須</em></span>
            <input type="email" name="email" required maxlength="254" placeholder="info@example.com">
          </label>
          <label class="gift-modal__field">
            <span>会社名・団体名</span>
            <input type="text" name="company" maxlength="200" placeholder="株式会社○○">
          </label>
          <label class="gift-modal__field">
            <span>役職</span>
            <input type="text" name="position" maxlength="100" placeholder="代表取締役 / マーケ担当 など">
          </label>
          <p class="gift-modal__notice">いただいた情報は PLai のサービスに関するご案内のためのみに利用します。</p>
          <button type="submit" class="gift-modal__submit">
            ${giftType === 'obsidian_vault' ? '受け取る →' : '続きを読む →'}
          </button>
          <p class="gift-modal__error" hidden></p>
        </form>
      </div>
    `;
    document.body.appendChild(modalEl);
    document.body.style.overflow = 'hidden';

    modalEl.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
    modalEl.querySelector('form').addEventListener('submit', (e) => submitForm(e, giftType));
    setTimeout(() => modalEl.querySelector('input[name="name"]').focus(), 30);
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.remove();
    modalEl = null;
    document.body.style.overflow = '';
  }

  async function submitForm(e, giftType) {
    e.preventDefault();
    const form = e.currentTarget;
    const submitBtn = form.querySelector('.gift-modal__submit');
    const errEl = form.querySelector('.gift-modal__error');
    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      company: form.company.value.trim(),
      position: form.position.value.trim(),
      gift_type: giftType,
      source_path: location.pathname + location.search,
    };

    if (!data.name) { showError(errEl, 'お名前を入力してください'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showError(errEl, 'メールアドレスの形式が正しくありません'); return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '送信中…';
    errEl.hidden = true;

    let result;
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || 'request_failed');
    } catch (err) {
      showError(errEl, '送信に失敗しました。時間を置いて再度お試しください。');
      submitBtn.disabled = false;
      submitBtn.textContent = giftType === 'obsidian_vault' ? '受け取る →' : '続きを読む →';
      return;
    }

    // Mark unlocked in localStorage
    markUnlocked(giftType, result.submission_id);

    // Fire unlock event on the trigger (for article gates)
    if (currentTrigger) {
      currentTrigger.dispatchEvent(new CustomEvent('gift:unlocked', {
        bubbles: true,
        detail: { gift_type: giftType, submission_id: result.submission_id, download_url: result.download_url },
      }));
    }

    if (giftType === 'obsidian_vault') {
      // Show "thank you" then open the deck
      form.innerHTML = `
        <p class="gift-modal__success-title">受付完了。資料を開きます。</p>
        <p class="gift-modal__success-text">資料のリンクが新しいタブで開きます。閉じる場合はこのモーダル外をクリック。</p>
        <a class="gift-modal__submit" href="${result.download_url || '/decks/obsidian-vault-template.html'}" target="_blank" rel="noopener">資料を開く →</a>
      `;
      window.open(result.download_url || '/decks/obsidian-vault-template.html', '_blank');
    } else {
      // Article continue — close modal, gate reveal handled by article page
      closeModal();
    }
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getUnlocked() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { return {}; }
  }

  function isUnlocked(giftType) {
    return !!getUnlocked()[giftType];
  }

  function markUnlocked(giftType, submissionId) {
    const state = getUnlocked();
    state[giftType] = { id: submissionId, at: Date.now() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
