const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

const state = { user: null, accounts: [] };

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '処理を完了できませんでした。');
  return data;
}

function setMessage(id, text) {
  document.getElementById(id).textContent = text || '';
}

async function loadSession() {
  const [{ user }, { users }] = await Promise.all([api('/api/session'), api('/api/users')]);
  state.user = user;
  document.getElementById('current-user').textContent = user.name;
  document.getElementById('hero-name').textContent = user.name;
  const select = document.getElementById('user-select');
  select.innerHTML = users.map(u => `<option value="${u.id}" ${u.id === user.id ? 'selected' : ''}>${u.name}</option>`).join('');
}

async function loadAccounts() {
  const { accounts } = await api('/api/accounts');
  state.accounts = accounts;
  document.getElementById('total-balance').textContent = yen.format(accounts.reduce((sum, a) => sum + a.balance, 0));
  document.getElementById('accounts').innerHTML = accounts.map(a => `
    <button class="account-card" data-account-id="${a.id}">
      <span>${a.label}</span>
      <strong>${yen.format(a.balance)}</strong>
      <div class="account-number">口座番号 ${a.id}</div>
    </button>`).join('');
  document.getElementById('from-account').innerHTML = accounts.map(a => `<option value="${a.id}">${a.label} (${a.id})</option>`).join('');
  document.querySelectorAll('[data-account-id]').forEach(btn => btn.addEventListener('click', () => showAccount(Number(btn.dataset.accountId))));
}

async function showAccount(accountId) {
  const card = document.getElementById('account-detail');
  card.classList.remove('hidden');
  setMessage('detail-message', '');
  try {
    const { account } = await api(`/api/accounts/${accountId}`);
    document.getElementById('detail-owner').textContent = account.ownerName;
    document.getElementById('detail-label').textContent = account.label;
    document.getElementById('detail-id').textContent = account.id;
    document.getElementById('detail-balance').textContent = yen.format(account.balance);
    history.replaceState(null, '', `/?account=${account.id}`);
  } catch (error) {
    document.getElementById('detail-owner').textContent = '-';
    document.getElementById('detail-label').textContent = '-';
    document.getElementById('detail-id').textContent = accountId;
    document.getElementById('detail-balance').textContent = '-';
    setMessage('detail-message', error.message);
    history.replaceState(null, '', `/?account=${accountId}`);
  }
}

async function loadProfile() {
  const { profile } = await api('/api/profile');
  document.getElementById('profile-name').value = profile.name;
  document.getElementById('profile-email').value = profile.email;
}

async function boot() {
  await loadSession();
  await loadAccounts();
  await loadProfile();
  const requested = Number(new URL(location.href).searchParams.get('account'));
  if (requested) await showAccount(requested);
}

document.getElementById('user-select').addEventListener('change', async event => {
  await api('/api/session', { method: 'POST', body: JSON.stringify({ userId: Number(event.target.value) }) });
  location.href = '/';
});

document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === button));
  document.querySelectorAll('.panel-section').forEach(s => s.classList.toggle('active', s.id === button.dataset.target));
}));

document.getElementById('transfer-form').addEventListener('submit', async event => {
  event.preventDefault();
  setMessage('transfer-message', '');
  try {
    const data = await api('/api/transfers', {
      method: 'POST',
      body: JSON.stringify({
        fromAccountId: Number(document.getElementById('from-account').value),
        toAccountId: Number(document.getElementById('to-account').value),
        amount: Number(document.getElementById('amount').value)
      })
    });
    setMessage('transfer-message', data.message);
    await loadAccounts();
  } catch (error) { setMessage('transfer-message', error.message); }
});

document.getElementById('claim-button').addEventListener('click', async () => {
  setMessage('campaign-message', '');
  try {
    const data = await api('/api/campaign/claim', { method: 'POST', body: '{}' });
    setMessage('campaign-message', data.message);
    await loadAccounts();
  } catch (error) { setMessage('campaign-message', error.message); }
});

document.getElementById('profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  setMessage('profile-message', '');
  try {
    const data = await api('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        name: document.getElementById('profile-name').value,
        email: document.getElementById('profile-email').value
      })
    });
    setMessage('profile-message', data.message);
    await loadSession();
  } catch (error) { setMessage('profile-message', error.message); }
});

boot().catch(error => {
  console.error(error);
  document.body.insertAdjacentHTML('beforeend', `<p class="message" style="padding:20px">${error.message}</p>`);
});
