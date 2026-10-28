import React, { useEffect, useRef } from "react";
import { X, Activity } from "lucide-react";

export const money = (n, c = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: c,
        maximumFractionDigits: 2,
      }).format(n);

export const num = (n, d = 2) =>
  n === Infinity ? "∞" : n == null ? "—" : n.toFixed(d);

export const download = (text, name, type = "text/plain") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export const Badge = ({ children, tone = "" }) => (
  <span className={`badge ${tone}`}>{children}</span>
);

export const Empty = ({
  title = "No trades here yet",
  text = "Connect TradersYard or import a CSV to start your journal.",
  action,
}) => (
  <div className="empty">
    <Activity size={32} />
    <h3>{title}</h3>
    <p>{text}</p>
    {action}
  </div>
);

export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const a = [
          ...ref.current.querySelectorAll(
            'button,input,select,textarea,[tabindex="0"]',
          ),
        ].filter((x) => !x.disabled && x.getClientRects().length && x.tabIndex !== -1);
        if (!a.length) return;
        if (e.shiftKey && (document.activeElement === a[0] || document.activeElement === ref.current)) {
          e.preventDefault();
          a.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === a.at(-1)) {
          e.preventDefault();
          a[0].focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      old?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div className="ty-journal loading">
        <h2>The journal couldn’t display this view.</h2>
        <p>{this.state.error.message}</p>
        <button className="button" onClick={() => this.setState({error:null})}>
          Retry journal
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
