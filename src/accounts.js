// Account + persistence layer. The only module that touches localStorage,
// so the rest of the app stays storage-agnostic. Prototype-only credential
// handling: a real backend must hash passwords server-side.

const NS = 'paperTrader.v1';
const key = (suffix) => `${NS}.${suffix}`;

function read(k, fallback) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(k, value) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch (e) {
    /* storage unavailable — session stays in memory */
  }
}

function allUsers() {
  return read(key('users'), {});
}

function fingerprint(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function register({ name, email, password }) {
  const id = String(email || '').trim().toLowerCase();
  if (!id || !name || !password) return { ok: false, error: 'Fill in every field to continue.' };
  if (password.length < 6) return { ok: false, error: 'Use at least 6 characters for your password.' };
  const users = allUsers();
  if (users[id]) return { ok: false, error: 'An account already exists for that email.' };
  users[id] = { name: name.trim(), email: id, secret: fingerprint(password), createdAt: Date.now() };
  write(key('users'), users);
  return { ok: true, error: null, user: { name: users[id].name, email: id } };
}

export function login({ email, password }) {
  const id = String(email || '').trim().toLowerCase();
  const user = allUsers()[id];
  if (!user || user.secret !== fingerprint(password || '')) return { ok: false, error: 'Email or password is incorrect.' };
  return { ok: true, error: null, user: { name: user.name, email: id } };
}

export function saveSession(user) {
  write(key('session'), user);
}

export function currentSession() {
  return read(key('session'), null);
}

export function clearSession() {
  try {
    localStorage.removeItem(key('session'));
  } catch (e) {
    /* noop */
  }
}

export function loadPortfolio(email) {
  return read(key(`portfolio.${email}`), null);
}

export function savePortfolio(email, portfolio) {
  write(key(`portfolio.${email}`), portfolio);
}

export function loadWatchlist(email, fallback) {
  return read(key(`watchlist.${email}`), fallback);
}

export function saveWatchlist(email, list) {
  write(key(`watchlist.${email}`), list);
}
