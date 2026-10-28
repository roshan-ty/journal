import React, { useState } from "react";
import { CheckCheck, Plus } from "lucide-react";
import { dayKey } from "../../shared/analytics.mjs";
import { uid } from "../../shared/model.mjs";

export function Progress({ state, commit, timezone }) {
  const today = dayKey(new Date(), timezone),
    [date, setDate] = useState(today),
    [name, setName] = useState("");
  const done = state.habits.filter(
    (h) => state.habitLog[`${date}:${h.id}`],
  ).length;
  return (
    <section className="panel progress-panel">
      <div className="panel-head">
        <div>
          <h2>Show up for your process</h2>
          <p>
            Your checklist is personal; it doesn’t change provider account
            rules.
          </p>
        </div>
        <input
          aria-label="Checklist date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="habit-summary">
        <strong>
          {done}
          <span> / {state.habits.length}</span>
        </strong>
        <p>intentions followed today</p>
        <div className="progress-track">
          <span
            style={{
              width: `${state.habits.length ? (done / state.habits.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
      {state.habits.map((h) => (
        <label
          className={`habit ${state.habitLog[`${date}:${h.id}`] ? "done" : ""}`}
          key={h.id}
        >
          <input
            type="checkbox"
            checked={!!state.habitLog[`${date}:${h.id}`]}
            onChange={(e) =>
              commit({
                ...state,
                habitLog: {
                  ...state.habitLog,
                  [`${date}:${h.id}`]: e.target.checked,
                },
              })
            }
          />
          <span>{h.name}</span>
          <CheckCheck size={19} />
        </label>
      ))}
      <form
        className="add-habit"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            name.trim() &&
            (await commit({
              ...state,
              habits: [...state.habits, { id: uid(), name: name.trim() }],
            }))
          )
            setName("");
        }}
      >
        <input
          aria-label="New daily habit"
          placeholder="Add a personal trading habit…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="button">
          <Plus size={16} />
          Add habit
        </button>
      </form>
    </section>
  );
}
