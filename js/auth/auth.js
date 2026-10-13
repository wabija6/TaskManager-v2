import { addRecord, getRecord, getUserByUsername, openDatabase } from "../data/database.js";

const SESSION_KEY = "taskmanager-v2-session-user";
const PBKDF2_ITERATIONS = 310000;
let onAuthenticatedCallback = () => {};
let onSignedOutCallback = () => {};
let activeMode = "login";

const authPage = document.querySelector("#auth-page");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const feedback = document.querySelector("#auth-feedback");
const authTitle = document.querySelector("#auth-title");
const authIntro = document.querySelector("#auth-intro");

function setFeedback(message = "", type = "error") {
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.classList.toggle("is-success", type === "success");
}

function setMode(mode) {
  activeMode = mode === "register" ? "register" : "login";
  const registering = activeMode === "register";
  loginForm.hidden = registering;
  registerForm.hidden = !registering;
  authTitle.textContent = registering ? "Create your account" : "Welcome back";
  authIntro.textContent = registering
    ? "Set up a local account for your personal workspace."
    : "Sign in to continue to your local workspace.";
  setFeedback();
  (registering ? document.querySelector("#register-name") : document.querySelector("#login-username")).focus();
}

function randomId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePasswordHash(password, salt, iterations = PBKDF2_ITERATIONS) {
  if (!crypto?.subtle || !crypto.getRandomValues) {
    throw new Error("Secure password hashing is unavailable in this browser context. Open the app at http://localhost:8000 and use a current browser.");
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt, iterations
  }, keyMaterial, 256);
  return new Uint8Array(bits);
}

async function hashNewPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return { salt: toBase64(salt), passwordHash: toBase64(hash), iterations: PBKDF2_ITERATIONS };
}

async function verifyPassword(password, user) {
  try {
    const salt = fromBase64(user.salt);
    const expected = fromBase64(user.passwordHash);
    const actual = await derivePasswordHash(password, salt, user.iterations);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) difference |= actual[index] ^ expected[index];
    return difference === 0;
  } catch {
    return false;
  }
}

function persistSession(userId) {
  try {
    localStorage.setItem(SESSION_KEY, userId);
    return true;
  } catch {
    setFeedback("Your browser blocked session storage. Enable site storage and try again.");
    return false;
  }
}

function readSessionId() {
  try { return localStorage.getItem(SESSION_KEY); }
  catch { return null; }
}

export async function signOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* The visible sign-out still proceeds. */ }
  appShell.hidden = true;
  authPage.hidden = false;
  loginForm.reset();
  registerForm.reset();
  setMode("login");
  onSignedOutCallback();
}

async function handleLogin(event) {
  event.preventDefault();
  setFeedback();
  const submit = document.querySelector("#login-submit");
  submit.disabled = true;
  submit.textContent = "Signing in…";
  try {
    const username = loginForm.elements.username.value.trim();
    const password = loginForm.elements.password.value;
    if (!username || !password) throw new Error("Enter your username and password.");
    const user = await getUserByUsername(username);
    if (!user || !(await verifyPassword(password, user))) {
      throw new Error("The username or password is incorrect.");
    }
    if (!persistSession(user.id)) return;
    loginForm.reset();
    await enterWorkspace(user);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Sign in";
  }
}

async function handleRegister(event) {
  event.preventDefault();
  setFeedback();
  const submit = document.querySelector("#register-submit");
  submit.disabled = true;
  submit.textContent = "Creating account…";
  try {
    const displayName = registerForm.elements.displayName.value.trim();
    const username = registerForm.elements.username.value.trim();
    const password = registerForm.elements.password.value;
    const confirmPassword = registerForm.elements.confirmPassword.value;
    if (displayName.length < 2 || displayName.length > 50) throw new Error("Display name must be between 2 and 50 characters.");
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(username)) throw new Error("Username must be 3–24 characters using only letters, numbers, underscores, or hyphens.");
    if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");
    if (password !== confirmPassword) throw new Error("The passwords do not match.");
    if (await getUserByUsername(username)) throw new Error("That username is already registered in this browser.");
    const passwordData = await hashNewPassword(password);
    const now = new Date().toISOString();
    const user = {
      id: randomId(), displayName, username, usernameLower: username.toLowerCase(),
      ...passwordData, createdAt: now, updatedAt: now
    };
    try {
      await addRecord("users", user);
    } catch (error) {
      if (error?.name === "ConstraintError") throw new Error("That username is already registered in this browser.");
      throw error;
    }
    if (!persistSession(user.id)) return;
    registerForm.reset();
    await enterWorkspace(user);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : "Account creation failed. Please try again.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Create account";
  }
}

async function enterWorkspace(user) {
  authPage.hidden = true;
  appShell.hidden = false;
  setFeedback();
  await onAuthenticatedCallback(user);
}

export async function initializeAuth({ onAuthenticated, onSignedOut }) {
  onAuthenticatedCallback = onAuthenticated || (() => {});
  onSignedOutCallback = onSignedOut || (() => {});
  document.querySelectorAll("[data-auth-switch]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.authSwitch));
  });
  loginForm.addEventListener("submit", handleLogin);
  registerForm.addEventListener("submit", handleRegister);

  try {
    await openDatabase();
    const sessionId = readSessionId();
    if (sessionId) {
      const user = await getRecord("users", sessionId);
      if (user) {
        await enterWorkspace(user);
        return;
      }
      try { localStorage.removeItem(SESSION_KEY); } catch { /* Ignore blocked cleanup. */ }
    }
    authPage.hidden = false;
    appShell.hidden = true;
    setMode("login");
  } catch (error) {
    authPage.hidden = false;
    appShell.hidden = true;
    setFeedback(error instanceof Error ? error.message : "Could not initialize local storage.");
    loginForm.querySelectorAll("input, button[type='submit']").forEach((control) => { control.disabled = true; });
    registerForm.querySelectorAll("input, button[type='submit']").forEach((control) => { control.disabled = true; });
  }
}
