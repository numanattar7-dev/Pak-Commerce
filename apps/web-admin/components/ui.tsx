'use client';

import React from 'react';

// ---------------------------------------------------------------------------
// Shared UI primitives (Tailwind) — Shopify-admin-inspired: neutral surfaces,
// dark primary actions, Inter typography, subtle borders.
// ---------------------------------------------------------------------------

export const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-[7px] text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
export const btnPrimary = `${btn} bg-slate-900 text-white hover:bg-slate-800 shadow-sm`;
export const btnGhost = `${btn} bg-white text-slate-700 border border-slate-300 hover:bg-slate-50`;
export const btnDanger = `${btn} bg-white text-red-600 border border-red-300 hover:bg-red-50`;
export const btnSm = 'px-2.5 py-1.5 text-xs';
export const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-[7px] text-[13px] text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400';
export const label =
  'block text-xs font-medium text-slate-600 mb-1';

export const card = 'bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';

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
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-[14px]">{title}</h3>
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
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className={`relative bg-white rounded-xl shadow-2xl w-full ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        } max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-semibold text-slate-900">{title}</h3>
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
  VERIFIED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
  DISPATCHED: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  DELIVERED: 'bg-emerald-600 text-white',
  CANCELLED: 'bg-red-50 text-red-700 border border-red-200',
  RTO: 'bg-amber-50 text-amber-800 border border-amber-200',
  COD: 'bg-amber-50 text-amber-800 border border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  INITIATED: 'bg-sky-50 text-sky-700 border border-sky-200',
  AWAITING_PROOF: 'bg-amber-50 text-amber-800 border border-amber-200',
  SUCCEEDED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border border-red-200',
  REFUNDED: 'bg-slate-100 text-slate-600',
  LOW: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-red-50 text-red-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  PAUSED: 'bg-slate-100 text-slate-600',
  TRIAL: 'bg-sky-50 text-sky-700 border border-sky-200',
  DELIVERED_WEBHOOK: 'bg-emerald-50 text-emerald-700',
};

export function Pill({ value, className = '' }: { value: string; className?: string }) {
  const style =
    value === 'DELIVERED' ? STATUS_STYLES[value] || STATUS_STYLES.DELIVERED_WEBHOOK : STATUS_STYLES[value] || 'bg-slate-100 text-slate-700';
  return (
    <span
      className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md font-medium whitespace-nowrap ${style} ${className}`}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export function Empty({ msg }: { msg: string }) {
  return (
    <div className="py-12 text-center text-[13px] text-slate-400">
      <p className="text-3xl mb-3">📭</p>
      {msg}
    </div>
  );
}

export function Spinner({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-[13px] gap-3">
      <span className="inline-block w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      {text}
    </div>
  );
}
