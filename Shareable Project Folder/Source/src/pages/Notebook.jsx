import React, { useState } from "react";
import { Plus } from "lucide-react";
import { dayKey } from "../../shared/analytics.mjs";
import { uid } from "../../shared/model.mjs";
import { Badge, Empty } from '../components/ui.jsx';

export const noteTemplates = {
  "Daily review":
    "What worked today?\n\nWhat could I improve?\n\nOne focus for tomorrow\n",
  "Pre-market plan":
    "Market context\n\nKey levels\n\nIf / then scenarios\n\nRisk and invalidation\n",
  "Weekly review":
    "What repeated this week?\n\nBest execution\n\nA mistake to address\n\nNext week’s process goal\n",
};

export function Notebook({ state, commit, account, setToast }) {
  const [current, setCurrent] = useState(null),
    [draft, setDraft] = useState(null);
  const notes = state.notes.filter(
    (n) => account === "all" || n.accountId === account,
  );
  const select = (n) => {
    setCurrent(n.id);
    setDraft({ ...n });
  };
  const create = (type) => {
    setCurrent(null);
    setDraft({
      id: uid(),
      title: type,
      date: dayKey(new Date(), state.settings.timezone),
      type,
      accountId: account,
      body: noteTemplates[type],
    });
  };
  return (
    <div className="notebook-layout">
      <section className="panel note-list">
        <div className="panel-head">
          <h2>Your notes</h2>
          <button
            className="icon"
            aria-label="New note"
            onClick={() => create("Daily review")}
          >
            <Plus size={18} />
          </button>
        </div>
        {notes.map((n) => (
          <button
            key={n.id}
            className={`note-list-item ${current === n.id ? "selected" : ""}`}
            onClick={() => select(n)}
          >
            <small>
              {n.date} · {n.type}
            </small>
            <b>{n.title}</b>
            <span>{n.body.slice(0, 70)}</span>
          </button>
        ))}
        <div className="template-list">
          <span className="eyebrow">START WITH A TEMPLATE</span>
          {Object.keys(noteTemplates).map((t) => (
            <button key={t} className="text-button" onClick={() => create(t)}>
              <Plus size={14} />
              {t}
            </button>
          ))}
        </div>
      </section>
      <section className="panel note-editor">
        {draft ? (
          <>
            <div className="panel-head">
              <Badge>{draft.type}</Badge>
              <button
                className="button primary"
                onClick={async () => {
                  if (
                    await commit({
                      ...state,
                      notes: [
                        ...state.notes.filter((n) => n.id !== draft.id),
                        draft,
                      ],
                    })
                  ) {
                    setCurrent(draft.id);
                    setToast("Note saved");
                  }
                }}
              >
                Save note
              </button>
            </div>
            <input
              className="note-title"
              aria-label="Note title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <input
              className="note-date"
              aria-label="Note date"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
            <textarea
              aria-label="Note body"
              placeholder="A space for your thoughts…"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </>
        ) : (
          <Empty
            title="Clear thinking starts here"
            text="Open a note or start with a review template."
            action={
              <button
                className="button primary"
                onClick={() => create("Daily review")}
              >
                <Plus size={16} />
                Write a note
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}
