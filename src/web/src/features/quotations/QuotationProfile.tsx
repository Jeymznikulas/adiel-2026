import { useState } from "react";
import { AnimatedDropdown } from "../../components/ui/AnimatedDropdown";
import { DocumentExportDialog } from "../../components/ui/DocumentExportDialog";
import { SummarySurface } from "../../components/ui/SummarySurface";
import { createQuotationPdfBlob } from "../../services/pdf/documentPdf";
import { loadCompanyProfile } from "../settings/settingsStorage";
import type { Quotation, QuotationStatus } from "./QuotationsPage";

type QuotationProfileProps = {
  quotation: Quotation;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onStatusChange: (status: QuotationStatus) => void;
};

const statusOptions = [
  {
    value: "For Approval" as const,
    dotClassName: "bg-amber-500",
    toneClassName: "border-amber-100 bg-amber-50 text-amber-700",
  },
  {
    value: "Approved" as const,
    dotClassName: "bg-emerald-500",
    toneClassName: "border-emerald-100 bg-emerald-50 text-emerald-700",
  },
  {
    value: "Rejected" as const,
    dotClassName: "bg-red-500",
    toneClassName: "border-red-100 bg-red-50 text-red-600",
  },
];

function Icon({
  path,
  className = "size-4",
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function ProductPhoto({ photo, name }: { photo: string; name: string }) {
  return photo ? (
    <img
      className="size-11 shrink-0 rounded-xl object-cover"
      src={photo}
      alt=""
    />
  ) : (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#eef3fb,#e3eaf5)] text-[10px] font-extrabold text-brand-blue">
      {name
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .join("")
        .slice(0, 2)
        .toUpperCase() || "IT"}
    </span>
  );
}

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return `${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date)} · ${new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(date)}`;
}

function statusTone(status: QuotationStatus) {
  if (status === "Approved")
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "Rejected") return "border-red-100 bg-red-50 text-red-600";
  return "border-amber-100 bg-amber-50 text-amber-700";
}

export function QuotationProfile({
  quotation,
  onBack,
  onEdit,
  onDuplicate,
  onStatusChange,
}: QuotationProfileProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const totalCost = quotation.items.reduce(
    (total, line) => total + line.quantity * line.unitCost,
    0,
  );
  const margin = quotation.subtotalAmount
    ? (quotation.estimatedProfit / quotation.subtotalAmount) * 100
    : 0;
  const totalFees = quotation.otherCharges.reduce(
    (total, charge) => total + charge.amount,
    0,
  );

  return (
    <div className="space-y-5 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]">
      <button
        className="group inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-400 transition hover:bg-white hover:text-brand-blue"
        type="button"
        onClick={onBack}
      >
        <Icon
          className="size-3.5 transition-transform group-hover:-translate-x-0.5"
          path="m15 18-6-6 6-6"
        />
        Back to quotations
      </button>
      <SummarySurface className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_100%_0%,rgba(82,56,168,0.12),transparent_62%)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusTone(quotation.status)}`}
              >
                <span
                  className={`size-1.5 rounded-full ${quotation.status === "Approved" ? "bg-emerald-500" : quotation.status === "Rejected" ? "bg-red-500" : "bg-amber-500"}`}
                />
                {quotation.status}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                Created {formatDate(quotation.dateCreated)}
              </span>
            </div>
            <h2 className="mt-4 font-mono text-2xl font-extrabold tracking-[-0.035em] text-brand-blue sm:text-3xl">
              {quotation.quotationNumber}
            </h2>
            <p className="mt-2 truncate text-base font-extrabold text-slate-700">
              {quotation.clientName}
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {quotation.subject}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AnimatedDropdown
              className="min-w-44"
              size="filter"
              fullWidth={false}
              value={quotation.status}
              options={statusOptions}
              onChange={onStatusChange}
              ariaLabel="Quotation status"
            />
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-xs font-bold text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-50"
              type="button"
              onClick={() => setIsExportOpen(true)}
            >
              <Icon
                className="size-3.5"
                path="M12 3v12M7 10l5 5 5-5M5 21h14"
              />
              Preview & Export
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-brand-blue shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/20 hover:bg-blue-50"
              type="button"
              onClick={onDuplicate}
            >
              <Icon
                className="size-3.5"
                path="M8 8h11v11H8V8ZM5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"
              />
              Duplicate
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-12px_rgba(0,20,76,0.75)] transition hover:-translate-y-0.5"
              type="button"
              onClick={onEdit}
            >
              <Icon
                className="size-3.5"
                path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"
              />
              Edit quotation
            </button>
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Grand total
            </p>
            <p className="mt-2 text-xl font-extrabold tracking-[-0.035em] text-brand-blue">
              {formatPeso(quotation.totalAmount)}
            </p>
          </article>
          <article className="rounded-2xl border border-emerald-100 bg-emerald-50/55 p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-600">
              Estimated profit
            </p>
            <p
              className={`mt-2 text-xl font-extrabold tracking-[-0.035em] ${quotation.estimatedProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}
            >
              {formatPeso(quotation.estimatedProfit)}
            </p>
          </article>
          <article className="rounded-2xl border border-violet-100 bg-violet-50/55 p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-violet-600">
              Estimated margin
            </p>
            <p className="mt-2 text-xl font-extrabold tracking-[-0.035em] text-violet-700">
              {margin.toFixed(1)}%
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Items quoted
            </p>
            <p className="mt-2 text-xl font-extrabold tracking-[-0.035em] text-brand-blue">
              {quotation.items.length}
            </p>
          </article>
        </div>
      </SummarySurface>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-brand-blue">
              <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-brand-blue">
                Client &amp; project information
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Client and delivery details
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Client
              </dt>
              <dd className="mt-1.5 text-sm font-extrabold text-slate-700">
                {quotation.clientName}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Contact person
              </dt>
              <dd className="mt-1.5 text-sm font-bold text-slate-700">
                {quotation.contactPerson}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Project location
              </dt>
              <dd className="mt-1.5 text-sm font-semibold leading-5 text-slate-600">
                {quotation.projectLocation}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Lead time
              </dt>
              <dd className="mt-1.5 text-sm font-bold text-slate-700">
                {quotation.leadTime}
              </dd>
            </div>
          </dl>
        </section>
        <aside className="rounded-[1.5rem] bg-[linear-gradient(145deg,#00113f,#073078)] p-5 text-white shadow-[0_20px_48px_-30px_rgba(0,20,76,0.75)]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-white/10">
              <Icon path="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold">Pricing breakdown</h3>
              <p className="mt-0.5 text-[10px] text-white/45">
                Amounts shown to the client
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 text-white/65">
              <span>Items subtotal</span>
              <strong className="tabular-nums text-white">
                {formatPeso(quotation.subtotalAmount)}
              </strong>
            </div>
            <div
              className={`flex justify-between gap-4 ${quotation.vatEnabled ? "text-white/65" : "text-white/30"}`}
            >
              <span>VAT (12%)</span>
              <strong className="tabular-nums text-white">
                {formatPeso(quotation.vatAmount)}
              </strong>
            </div>
            {quotation.otherCharges.map((charge) => (
              <div
                className="flex justify-between gap-4 text-white/65"
                key={charge.id}
              >
                <span className="truncate">{charge.label}</span>
                <strong className="shrink-0 tabular-nums text-white">
                  {formatPeso(charge.amount)}
                </strong>
              </div>
            ))}
            {!quotation.otherCharges.length ? (
              <div className="flex justify-between gap-4 text-white/30">
                <span>Other fees</span>
                <strong>{formatPeso(0)}</strong>
              </div>
            ) : null}
          </div>
          <div className="mt-5 border-t border-white/15 pt-5">
            <div className="flex items-end justify-between gap-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                Grand total
              </span>
              <strong className="text-2xl font-extrabold tracking-[-0.035em]">
                {formatPeso(quotation.totalAmount)}
              </strong>
            </div>
          </div>
        </aside>
      </div>
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-extrabold text-brand-blue">
              Quotation items
            </h3>
            <p className="mt-1 text-[10px] text-slate-400">
              All quoted items and prices
            </p>
          </div>
          <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
            {quotation.items.length} items
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed text-left">
            <thead>
              <tr className="bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                <th className="w-[6%] px-4 py-3.5 text-center">#</th>
                <th className="w-[36%] px-4 py-3.5">Item</th>
                <th className="w-[12%] px-4 py-3.5">Unit</th>
                <th className="w-[12%] px-4 py-3.5 text-right">Quantity</th>
                <th className="w-[17%] px-4 py-3.5 text-right">Unit price</th>
                <th className="w-[17%] px-4 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((line, index) => (
                <tr
                  className="border-t border-slate-100 transition hover:bg-blue-50/30"
                  key={line.id}
                >
                  <td className="px-4 py-4 text-center text-xs font-extrabold text-brand-blue">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductPhoto photo={line.photo} name={line.itemName} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-slate-700">
                          {line.itemName}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-slate-400">
                          {line.productCode || "No product code"}
                          {line.variantLabel ? ` · ${line.variantLabel}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-600">
                    {line.unitOfMeasure}
                  </td>
                  <td className="px-4 py-4 text-right text-xs tabular-nums text-slate-600">
                    {line.quantity}
                  </td>
                  <td className="px-4 py-4 text-right text-xs font-bold tabular-nums text-slate-600">
                    {formatPeso(line.unitPrice)}
                  </td>
                  <td className="px-4 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">
                    {formatPeso(line.quantity * line.unitPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon path="M3 3v18h18M7 16l4-5 3 3 6-8" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-brand-blue">
                Expected profit
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                For internal use only
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Estimated cost
              </dt>
              <dd className="mt-2 text-sm font-extrabold text-slate-700">
                {formatPeso(totalCost)}
              </dd>
            </div>
            <div className="rounded-xl bg-emerald-50/65 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-600">
                Estimated profit
              </dt>
              <dd
                className={`mt-2 text-sm font-extrabold ${quotation.estimatedProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}
              >
                {formatPeso(quotation.estimatedProfit)}
              </dd>
            </div>
            <div className="rounded-xl bg-violet-50/65 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-violet-600">
                Estimated margin
              </dt>
              <dd className="mt-2 text-sm font-extrabold text-violet-700">
                {margin.toFixed(1)}%
              </dd>
            </div>
            <div className="rounded-xl bg-blue-50/65 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-brand-blue">
                Additional fees
              </dt>
              <dd className="mt-2 text-sm font-extrabold text-brand-blue">
                {formatPeso(totalFees)}
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-orange-50 text-brand-orange">
              <Icon path="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-brand-blue">
                History
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                When this quotation changed
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="flex gap-3">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-orange ring-4 ring-orange-50" />
              <div>
                <p className="text-xs font-extrabold text-slate-700">
                  Quotation created
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {formatTimestamp(quotation.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-blue ring-4 ring-blue-50" />
              <div>
                <p className="text-xs font-extrabold text-slate-700">
                  Last updated
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {formatTimestamp(quotation.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${quotation.status === "Approved" ? "bg-emerald-500 ring-emerald-50" : quotation.status === "Rejected" ? "bg-red-500 ring-red-50" : "bg-amber-500 ring-amber-50"} ring-4`}
              />
              <div>
                <p className="text-xs font-extrabold text-slate-700">
                  Current status: {quotation.status}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Status changes are recorded in System Logs.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
      {isExportOpen ? (
        <DocumentExportDialog
          title="Quotation preview"
          reference={quotation.quotationNumber}
          pdfFilename={`${quotation.quotationNumber}-quotation.pdf`}
          pngFilename={`${quotation.quotationNumber}-quotation.png`}
          createPdfBlob={() =>
            createQuotationPdfBlob(quotation, loadCompanyProfile())
          }
          onClose={() => setIsExportOpen(false)}
        />
      ) : null}
    </div>
  );
}
