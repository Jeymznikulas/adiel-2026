import { useState } from "react";
import { DocumentExportDialog } from "../../components/ui/DocumentExportDialog";
import { WorkflowHeader } from "../../components/ui/WorkflowHeader";
import { createQuotationPdfBlob } from "../../services/pdf/documentPdf";
import { loadCompanyProfile } from "../settings/settingsStorage";
import type { Quotation, QuotationStatus } from "./QuotationsPage";

type QuotationProfileProps = {
  quotation: Quotation;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onStatusChange: (status: QuotationStatus) => void;
  onCreateStatement: () => void;
};

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

export function QuotationProfile({
  quotation,
  onBack,
  onEdit,
  onDuplicate,
  onArchive,
  onStatusChange,
  onCreateStatement,
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
      <WorkflowHeader
        eyebrow="Quotation"
        recordNumber={quotation.quotationNumber}
        partyName={quotation.clientName}
        amount={formatPeso(quotation.totalAmount)}
        createdLabel={`Created ${formatDate(quotation.dateCreated)}`}
        status={quotation.status}
        steps={["Draft", "For Approval", "Approved", "SOA Created"]}
        currentStep={quotation.status === "Draft" ? 0 : quotation.status === "Approved" ? 2 : 1}
        module="Quotations"
        recordId={quotation.id}
        primaryAction={quotation.status === "Draft" ? { label: "Submit for Approval", onClick: () => onStatusChange("For Approval") } : quotation.status === "For Approval" ? { label: "Review & Approve", onClick: () => onStatusChange("Approved") } : quotation.status === "Approved" ? { label: "Create SOA", onClick: onCreateStatement } : quotation.status === "Rejected" ? { label: "Edit quotation", onClick: onEdit } : undefined}
        secondaryActions={quotation.status === "For Approval" ? [{ label: "Reject", tone: "danger", onClick: () => onStatusChange("Rejected") }] : []}
        menuActions={[
          { label: "Edit", onClick: onEdit, disabled: quotation.status === "Approved" || quotation.status === "Voided" },
          { label: "Preview & Export", onClick: () => setIsExportOpen(true) },
          { label: "Duplicate", onClick: onDuplicate },
          { label: "Archive", onClick: onArchive },
          ...(quotation.status !== "Voided" ? [{ label: "Void", tone: "danger" as const, onClick: () => onStatusChange("Voided") }] : []),
        ]}
      >
        <p className="text-sm leading-6 text-slate-500">{quotation.subject}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      </WorkflowHeader>
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
