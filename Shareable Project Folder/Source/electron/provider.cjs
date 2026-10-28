const product = require('../product.json');
const ACCOUNT_LIST = "/api/v4.0/challenges?page=1&type%5B%5D=challenge&type%5B%5D=funded";
const GOOGLE_ACCOUNT_HOSTS = new Set(require("./google-auth-hosts.cjs"));
function connectionError(message, code = "TY_AUTH_REQUIRED") {
  return Object.assign(new Error(message), { code });
}
const ALLOWED_AUTH = new Set([
  "tradersyard.com",
  "www.tradersyard.com",
  "accounts.google.com",
  // Google's OAuth password flow checks its YouTube account session here.
  "accounts.youtube.com",
  "appleid.apple.com",
  "account.apple.com",
  "discord.com",
  "www.discord.com",
]);
const LOGIN_URL = "https://tradersyard.com/auth/login";
function allowedAuthUrl(value, allowBlank = false) {
  if (allowBlank && value === "about:blank") return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port && (ALLOWED_AUTH.has(url.hostname) || GOOGLE_ACCOUNT_HOSTS.has(url.hostname));
  } catch { return false; }
}
class TradersYardProvider {
  constructor({ onReady = () => {}, onConnectionChange = () => {}, onAuthIssue = () => {}, electron = require("electron") }) {
    this.electron = electron;
    this.onConnectionChange = onConnectionChange;
    this.onAuthIssue = onAuthIssue;
    this.authenticated = false;
    this.authWindows = new Set();
    this.activeRequests = new Set();
    this.connectPending = null;
    this.verificationPending = null;
    this.cancelError = connectionError("Connection was disconnected.", "TY_DISCONNECTED");
    this.requestQueue = Promise.resolve();
    this.nextRequestAt = 0;
    this.generation = 0;
    this.onReady = onReady;
    this.window = null;
    this.authSession = electron.session.fromPartition(
      `persist:${product.id}-auth`,
    );
    this.authSession.setPermissionRequestHandler((_wc, _permission, callback) =>
      callback(false),
    );
    this.authSession.setPermissionCheckHandler(() => false);
  }
  setAuthenticated(value, error) {
    const changed = this.authenticated !== value;
    this.authenticated = value;
    if (changed || error) this.onConnectionChange(value, error);
    if (value) this.closeAuthWindows();
  }
  closeAuthWindows() {
    for (const win of [...this.authWindows]) {
      if (!win.isDestroyed()) win.close();
    }
  }
  async verifySession() {
    if (!this.verificationPending) {
      this.verificationPending = this.getJson(ACCOUNT_LIST).then((result) => {
        if (!Array.isArray(result.data)) throw Error("Account API schema changed: expected data array.");
        return true;
      }).finally(() => { this.verificationPending = null; });
    }
    return this.verificationPending;
  }
  startSync() {
    // Authentication is already verified; history collection can continue without a browser window.
    Promise.resolve().then(() => this.authenticated && this.onReady()).catch(() => {});
  }
  async connect() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      this.window.focus();
      return { connected: false, message: "Complete sign-in in the TradersYard window." };
    }
    if (this.connectPending) return this.connectPending;
    this.connectPending = this.beginConnect().finally(() => { this.connectPending = null; });
    return this.connectPending;
  }
  async beginConnect() {
    try {
      await this.verifySession();
      this.startSync();
      return { connected: true, message: "TradersYard connected. Syncing your accounts…" };
    } catch (error) {
      if (error.code !== "TY_AUTH_REQUIRED") throw error;
    }
    const win = new this.electron.BrowserWindow({
      title: "Connect TradersYard · Official sign-in",
      width: 1080,
      height: 800,
      autoHideMenuBar: false,
      webPreferences: {
        session: this.authSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window = win;
    this.authWindows.add(win);
    const notices = new Set();
    let recoveryOpen = false;
    const recover = async (owner, message, buttons = ["Reload page", "Keep waiting", "Close sign-in"]) => {
      if (owner.isDestroyed() || recoveryOpen) return;
      this.onAuthIssue(message);
      if (!this.electron.dialog) return;
      recoveryOpen = true;
      try {
        const { response } = await this.electron.dialog.showMessageBox(owner, {
          type: "warning", title: "TradersYard sign-in", message,
          detail: "Use the Sign-in menu to go back, reload, or restart. If Google says this browser is unsupported, use another sign-in method offered by TradersYard.",
          buttons, defaultId: 1, cancelId: 1,
        });
        if (owner.isDestroyed()) return;
        if (response === 0) owner.webContents.reload();
        if (response === 2) win.close();
      } finally { recoveryOpen = false; }
    };
    const reportBlocked = (owner, value) => {
      let host = "an unsupported address";
      try { host = new URL(value).hostname || host; } catch {}
      // Never retain OAuth URLs, query strings, credentials, or page contents.
      if (notices.has(host)) return;
      notices.add(host);
      void recover(owner, `Sign-in tried to open ${host}, which this connection does not allow.`).catch(() => {});
    };
    const restrict = (owner) => {
      const wc = owner.webContents;
      const restrictNavigation = (event, legacyUrl) => {
        const url = event.url ?? legacyUrl;
        if (!allowedAuthUrl(url, true)) {
          event.preventDefault();
          reportBlocked(owner, url);
        }
      };
      wc.on("will-navigate", restrictNavigation);
      wc.on("will-redirect", restrictNavigation);
      wc.setWindowOpenHandler(({ url }) => {
        if (!allowedAuthUrl(url, true)) {
          reportBlocked(owner, url);
          return { action: "deny" };
        }
        return {
            action: "allow",
            overrideBrowserWindowOptions: {
              autoHideMenuBar: false,
              webPreferences: {
                session: this.authSession,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
              },
            },
        };
      });
      wc.on("did-create-window", (child) => {
        this.authWindows.add(child);
        child.on("closed", () => this.authWindows.delete(child));
        restrict(child);
        watch(child.webContents);
      });
      if (this.electron.Menu) owner.setMenu(this.electron.Menu.buildFromTemplate([{
        label: "Sign-in", submenu: [
          { label: "Go back", accelerator: "Alt+Left", click: () => {
            if (!wc.isDestroyed() && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
          } },
          { label: "Reload page", accelerator: "CmdOrCtrl+R", click: () => { if (!wc.isDestroyed()) wc.reload(); } },
          { label: "Restart TradersYard sign-in", click: () => {
            if (!win.isDestroyed()) void win.loadURL(LOGIN_URL).catch(() => {});
            for (const child of this.authWindows) if (child !== win && !child.isDestroyed()) child.close();
          } },
          { type: "separator" },
          { label: "Close sign-in", accelerator: "Alt+F4", click: () => { if (!win.isDestroyed()) win.close(); } },
        ],
      }]));
      owner.on("unresponsive", () => {
        void recover(owner, "The sign-in page stopped responding.").catch(() => {});
      });
      wc.on("render-process-gone", () => {
        void recover(owner, "The sign-in page closed unexpectedly. Reload it to continue.").catch(() => {});
      });
      wc.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
        if (code === -3 || !isMainFrame) return; // Normal redirects cancel the previous load.
        const key = `load:${code}`;
        if (notices.has(key)) return;
        notices.add(key);
        void recover(owner, `The sign-in page could not load (network error ${code}). Check your connection and reload.`).catch(() => {});
      });
    };
    let ready = false;
    let verifying = false;
    const check = async (wc) => {
      if (ready || verifying || win.isDestroyed() || wc.isDestroyed()) return;
      const url = new URL(wc.getURL() || "about:blank");
      if (allowedAuthUrl(url.href) && ["tradersyard.com", "www.tradersyard.com"].includes(url.hostname) && /^\/app(?:\/|$)/.test(url.pathname)) {
        verifying = true;
        try {
          await this.verifySession();
          if (!ready) { ready = true; this.startSync(); }
        } catch {
          // Keep sign-in open if authentication has not completed or the network is unavailable.
        } finally { verifying = false; }
      }
    };
    const watch = (wc) => {
      for (const event of ["did-navigate", "did-navigate-in-page", "did-finish-load"])
        wc.on(event, () => { void check(wc); });
    };
    restrict(win);
    watch(win.webContents);
    const retryTimer = setInterval(() => {
      for (const child of this.authWindows) if (!child.isDestroyed()) void check(child.webContents);
    }, 5000);
    win.on("closed", () => {
      clearInterval(retryTimer);
      this.authWindows.delete(win);
      if (this.window === win) this.window = null;
      this.closeAuthWindows();
    });
    try { await win.loadURL(LOGIN_URL); }
    catch { /* Keep the native recovery menu available after an initial network failure. */ }
    return { connected: this.authenticated, message: this.authenticated ? "TradersYard connected. Syncing your accounts…" : "Complete sign-in in the TradersYard window." };
  }
  async getJson(route) {
    const generation = this.generation;
    const result = this.requestQueue.then(async () => {
      try {
        let data;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (generation !== this.generation) throw this.cancelError;
          if (this.rateLimitedUntil > Date.now()) throw connectionError('TradersYard is limiting requests. Your downloaded data is saved; retry shortly.', 'TY_RATE_LIMIT');
          const delay = Math.max(0, this.nextRequestAt - Date.now());
          if (delay) await new Promise(resolve => setTimeout(resolve,delay));
          if (generation !== this.generation) throw this.cancelError;
          this.nextRequestAt = Date.now() + 1500;
          try { data = await this.requestJson(route); break; }
          catch (error) {
            const transient = ['TY_TIMEOUT','TY_TEMPORARY'].includes(error.code) || /net::ERR_(CONNECTION_RESET|CONNECTION_CLOSED|TIMED_OUT|NETWORK_CHANGED|INTERNET_DISCONNECTED)/.test(error.message);
            if (attempt || !transient || generation !== this.generation) throw error;
          }
        }
        if (generation !== this.generation) throw this.cancelError;
        if (/^\/api\/v4\.0\/challenges\?/.test(route) && Array.isArray(data.data)) this.setAuthenticated(true);
        return data;
      } catch (error) {
        if (error.code === "TY_AUTH_REQUIRED" && generation === this.generation) {
          this.cancelError = error;
          this.generation++;
          this.setAuthenticated(false, error);
        }
        throw error;
      }
    });
    this.requestQueue = result.catch(() => {});
    return result;
  }
  async requestJson(route) {
    if (
      !/^\/api\/v4\.0\/challenges(?:\?[\w%=&-]+|\/[A-Za-z0-9_-]+(?:\/(?:stats|definition|levels))?)?$/.test(
        route,
      ) &&
      !/^\/api\/v3\.0\/trader-challenge-analytics\/[A-Za-z0-9_-]+\/(?:open|closed)$/.test(
        route,
      )
    )
      throw Error("Read-only endpoint is not allowed.");
    return new Promise((resolve, reject) => {
      // An explicit same-site origin lets Chromium apply the official session's SameSite cookies.
      const request = this.electron.net.request({
        url: `https://tradersyard.com${route}`,
        method: "GET",
        session: this.authSession,
        credentials: "include",
        origin: "https://tradersyard.com",
        redirect: "error",
      });
      this.activeRequests.add(request);
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.activeRequests.delete(request);
        if (error) reject(error); else resolve(result);
      };
      request.setHeader("Accept", "application/json");
      request.setHeader("X-Requested-With", "XMLHttpRequest");
      request.setHeader("Origin", "https://tradersyard.com");
      request.setHeader("Referer", "https://tradersyard.com/app/");
      const timeout = setTimeout(() => {
        finish(connectionError("TradersYard request timed out.", 'TY_TIMEOUT'));
        request.abort();
      }, 20000);
      request.on("error", (e) => {
        finish(e);
      });
      request.on("abort", () => finish(this.cancelError));
      request.on("redirect", (_status, _method, redirectUrl) => {
        let isLogin = false;
        try { const target = new URL(redirectUrl); isLogin = target.origin === 'https://tradersyard.com' && target.pathname.startsWith('/auth/'); } catch {}
        finish(isLogin ? connectionError('TradersYard session expired. Connect again.') : Error('Unexpected provider redirect.'));
        request.abort();
      });
      request.on("response", (response) => {
        let size = 0;
        const chunks = [];
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 25e6) {
            finish(Error("Provider response exceeded 25 MB."));
            request.abort();
          } else chunks.push(chunk);
        });
        response.on("error", (error) => finish(error));
        response.on("end", () => {
          clearTimeout(timeout);
          const status = response.statusCode;
          if (status === 401 || status === 419)
            return finish(connectionError("TradersYard session expired. Connect again."));
          if (status === 429) {
            const seconds = Number(response.headers["retry-after"]?.[0]) || 60;
            this.rateLimitedUntil =
              Date.now() + Math.max(60, Math.min(900, seconds)) * 1000;
            this.nextRequestAt = this.rateLimitedUntil;
            return finish(
              connectionError("TradersYard rate limit reached. Your downloaded data is saved; retry shortly.", 'TY_RATE_LIMIT'),
            );
          }
          if (status < 200 || status >= 300)
            return finish(connectionError(`Provider returned HTTP ${status}`,status >= 500 ? 'TY_TEMPORARY' : 'TY_HTTP_ERROR'));
          if (!String(response.headers["content-type"] || "").includes("json"))
            return finish(
              connectionError("Sign in to TradersYard to sync your accounts."),
            );
          try {
            finish(null, JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            finish(Error("Invalid provider JSON response."));
          }
        });
      });
      request.end();
    });
  }
  async disconnect() {
    this.cancelError = connectionError("Connection was disconnected.", "TY_DISCONNECTED");
    this.generation++;
    this.setAuthenticated(false);
    for (const request of this.activeRequests) request.abort();
    this.closeAuthWindows();
    await this.authSession.clearStorageData();
    await this.authSession.clearCache();
  }
}
module.exports = { TradersYardProvider };
