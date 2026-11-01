'use client';

import React from 'react';

// ---------------------------------------------------------------------------
// Shared UI primitives (Tailwind) — matches the existing slate/emerald style
// ---------------------------------------------------------------------------

export const btn =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
export const btnPrimary = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
export const btnGhost = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`;
export const btnDanger = `${btn} bg-red-50 text-red-700 border border-red-200 hover:bg-red-100`;
export const btnSm = 'px-2.5 py-1.5 text-xs';
export const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
export const label = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1';
export const card = 'bg-white rounded-xl border border-slate-200/80 shadow-sm';

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${card} ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div
        className={`relative bg-white rounded-xl shadow-2xl w-full ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        } max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  DISPATCHED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-emerald-600 text-white',
  CANCELLED: 'bg-red-100 text-red-800',
  RTO: 'bg-amber-100 text-amber-900',
  COD: 'bg-amber-100 text-amber-800',
  PAID: 'bg-blue-100 text-blue-800',
  FAILED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-slate-200 text-slate-700',
  LOW: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-red-50 text-red-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PAUSED: 'bg-slate-200 text-slate-600',
  TRIAL: 'bg-sky-100 text-sky-800',
  DELIVERED_WEBHOOK: 'bg-emerald-100 text-emerald-800',
};

export function Pill({ value, className = '' }: { value: string; className?: string }) {
  const style =
    value === 'DELIVERED' ? STATUS_STYLES[value] || STATUS_STYLES.DELIVERED_WEBHOOK : STATUS_STYLES[value] || 'bg-slate-100 text-slate-700';
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${style} ${className}`}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export function Empty({ msg }: { msg: string }) {
  return (
    <div className="py-12 text-center text-sm text-slate-400">
      <p className="text-3xl mb-3">📭</p>
      {msg}
    </div>
  );
}

export function Spinner({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-3">
      <span className="inline-block w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      {text}
    </div>
  );
}
