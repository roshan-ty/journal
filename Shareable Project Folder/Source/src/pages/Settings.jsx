import {product} from '../product.js';
import React, { useState } from "react";
import { Download, Upload } from "lucide-react";
import { validateState } from "../../shared/model.mjs";
import { download } from "../components/ui.jsx";

export function SettingsPage({ state, commit, setToast, adapter, isConnected }) {
  const [changes, setChanges] = useState({});
  const settings = {...state.settings, ...changes};
  const change = (key, value) => setChanges(current => ({...current, [key]:value}));
  const [disconnecting, setDisconnecting] = useState(false);
  return (
    <section className="panel settings-panel">
      <div className="panel-head">
        <h2>Workspace preferences</h2>

      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone });
            if (await commit({ ...state, settings })) {
              setChanges({});
              setToast("Preferences saved");
            }
          } catch {
            setToast("Enter a valid IANA timezone, for example Asia/Karachi.");
          }
        }}
      >
        <div className="form-grid">
          <label>
            Workspace name
            <input
              value={settings.brand}
              onChange={(e) =>
                change('brand', e.target.value)
              }
            />
          </label>
          <label>
            Theme
            <select
              value={settings.theme}
              onChange={(e) =>
                change('theme', e.target.value)
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <label>
            Journal timezone
            <input
              value={settings.timezone}
              onChange={(e) =>
                change('timezone', e.target.value)
              }
            />
          </label>
          <label>
            Reporting currency
            <select
              value={settings.currency}
              onChange={(e) =>
                change('currency', e.target.value)
              }
            >
              {["USD", "EUR", "GBP", "PKR", "JPY", "CAD", "AUD"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="micro">
          Combined reporting includes only accounts in the selected currency. No
          unverified FX conversion is applied. Provider rules may use a
          different trading-day boundary.
        </p>
        <label className="field">
          Your coaching guidance
          <textarea
            rows={6}
            value={settings.coachKnowledge}
            onChange={(e) =>
              change('coachKnowledge', e.target.value)
            }
            placeholder="My process rules, review reminders, and definitions…"
          />
        </label>
        <button className="button primary">Save preferences</button>
      </form>
      <hr />
      <h2>Data & backups</h2>
      <p className="subtle">
        Backups include your journal and attachments. Keep them private.
      </p>
      <div className="row wrap">
        <button
          className="button"
          onClick={async () => { try {
            await (
            adapter.exportBackup
              ? adapter.exportBackup()
              : download(
                  JSON.stringify(state, null, 2),
                  `${product.id}-backup.json`,
                  "application/json",
                ));
          } catch (error) { setToast(error.message); } }}
        >
          <Download size={16} />
          Export backup
        </button>
        <label className="button">
          <Upload size={16} />
          Restore backup
          <input
            className="hidden-input"
            type="file"
            accept=".json"
            onChange={async (e) => {
              try {
                const f = e.target.files[0];
                e.target.value = '';
                if (!f) return;
                if (f.size > 50e6)
                  throw Error("Backup is too large (50 MB limit).");
                const next = validateState(JSON.parse(await f.text()));
                if (
                  !window.confirm(
                    "Replace this workspace with the selected backup? Export your current workspace first if you need to keep it.",
                  )
                )
                  return;
                if (await commit(next)) {
                  setChanges({});
                  setToast("Backup restored");
                }
              } catch (e) {
                setToast(e.message);
              }
            }}
          />
        </label>

      </div>
      <hr />
      <h2>Connection</h2>
      <p className="subtle">
        TradersYard sign-in stays inside its official page. The journal requests
        account data only; it never sends trade orders.
      </p>
      <button
        className="button"
        disabled={!adapter.disconnect || !isConnected || disconnecting}
        onClick={async () => {
          setDisconnecting(true);
          try {
            await adapter.disconnect();
            setToast("Disconnected. Existing journal data is preserved.");
          } catch (error) { setToast(error.message); }
          finally { setDisconnecting(false); }
        }}
      >
        Disconnect TradersYard
      </button>

    </section>
  );
}
