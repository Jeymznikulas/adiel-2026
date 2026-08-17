import { useState } from "react";
import { AnimatedDropdown } from "../../components/ui/AnimatedDropdown";
import { DocumentExportDialog } from "../../components/ui/DocumentExportDialog";
import { SummarySurface } from "../../components/ui/SummarySurface";
import { createStatementOfAccountPdfBlob } from "../../services/pdf/documentPdf";
import { loadCompanyProfile } from "../settings/settingsStorage";
import type {
  StatementOfAccount,
  StatementStatus,
} from "./statementOfAccountTypes";

type StatementOfAccountProfileProps = {
  statement: StatementOfAccount;
  effectiveStatus: StatementStatus;
  onBack: () => void;
  onEdit: () => void;
  onRecordPayment: () => void;
  onArchive: () => void;
  onStatusChange: (status: StatementStatus) => void;
};

const statusOptions = [
  { value: "Draft" as const, dotClassName: "bg-slate-400" },
  { value: "Issued" as const, dotClassName: "bg-sky-500" },
  { value: "Partially Settled" as const, dotClassName: "bg-amber-500" },
  { value: "Settled" as const, dotClassName: "bg-emerald-500" },
  { value: "Overdue" as const, dotClassName: "bg-red-500" },
  { value: "Cancelled" as const, dotClassName: "bg-slate-500" },
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
      className="size-10 shrink-0 rounded-xl object-cover"
      src={photo}
      alt=""
    />
  ) : (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#eef3fb,#e3eaf5)] text-[9px] font-extrabold text-brand-blue">
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
  if (!value) return "Not provided";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function statusTone(status: StatementStatus) {
  if (status === "Settled")
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "Partially Settled")
    return "border-amber-100 bg-amber-50 text-amber-700";
  if (status === "Overdue") return "border-red-100 bg-red-50 text-red-600";
  if (status === "Issued") return "border-sky-100 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export function StatementOfAccountProfile({
  statement,
  effectiveStatus,
  onBack,
  onEdit,
  onRecordPayment,
  onArchive,
  onStatusChange,
}: StatementOfAccountProfileProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const totalItems = statement.quotations.reduce(
    (total, quotation) => total + quotation.items.length,
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
        Back to statements
      </button>
      <SummarySurface className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_100%_0%,rgba(14,165,233,0.12),transparent_62%)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusTone(effectiveStatus)}`}
              >
                <span
                  className={`size-1.5 rounded-full ${effectiveStatus === "Settled" ? "bg-emerald-500" : effectiveStatus === "Overdue" ? "bg-red-500" : effectiveStatus === "Partially Settled" ? "bg-amber-500" : effectiveStatus === "Issued" ? "bg-sky-500" : "bg-slate-400"}`}
                />
                {effectiveStatus}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                Statement date {formatDate(statement.statementDate)}
              </span>
            </div>
            <h2 className="mt-4 font-mono text-2xl font-extrabold tracking-[-0.035em] text-brand-blue sm:text-3xl">
              {statement.soaNumber}
            </h2>
            <p className="mt-2 text-base font-extrabold text-slate-700">
              {statement.clientName}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Account coverage: {formatDate(statement.coverageFrom)} –{" "}
              {formatDate(statement.coverageTo)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AnimatedDropdown
              className="min-w-44"
              size="filter"
              fullWidth={false}
              value={effectiveStatus}
              options={statusOptions}
              onChange={onStatusChange}
              ariaLabel="Statement status"
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
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-brand-blue shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
              type="button"
              onClick={onEdit}
            >
              <Icon
                className="size-3.5"
                path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"
              />
              Edit statement
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
              type="button"
              onClick={onArchive}
            >
              <Icon className="size-3.5" path="M3 6h18M5 6l1 15h12l1-15M9 10v7M15 10v7" />
              Archive
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-12px_rgba(0,20,76,0.75)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              onClick={onRecordPayment}
              disabled={
                statement.balance <= 0 || effectiveStatus === "Cancelled"
              }
            >
              <Icon
                className="size-3.5"
                path="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              />
              Record payment
            </button>
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Total charges
            </p>
            <p className="mt-2 text-xl font-extrabold text-brand-blue">
              {formatPeso(statement.totalCharges)}
            </p>
          </article>
          <article className="rounded-2xl border border-emerald-100 bg-emerald-50/55 p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-600">
              Payments received
            </p>
            <p className="mt-2 text-xl font-extrabold text-emerald-700">
              {formatPeso(statement.totalPayments)}
            </p>
          </article>
          <article
            className={`rounded-2xl border p-4 ${effectiveStatus === "Overdue" ? "border-red-100 bg-red-50/60" : "border-amber-100 bg-amber-50/55"}`}
          >
            <p
              className={`text-[9px] font-bold uppercase tracking-[0.1em] ${effectiveStatus === "Overdue" ? "text-red-500" : "text-amber-600"}`}
            >
              Outstanding balance
            </p>
            <p
              className={`mt-2 text-xl font-extrabold ${effectiveStatus === "Overdue" ? "text-red-600" : "text-amber-700"}`}
            >
              {formatPeso(statement.balance)}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Due date
            </p>
            <p className="mt-2 text-base font-extrabold text-brand-blue">
              {formatDate(statement.dueDate)}
            </p>
          </article>
        </div>
      </SummarySurface>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-brand-blue">
              <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-brand-blue">
                Client account
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Statement recipient and coverage details
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Client
              </dt>
              <dd className="mt-1.5 text-sm font-extrabold text-slate-700">
                {statement.clientName}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Contact person
              </dt>
              <dd className="mt-1.5 text-sm font-bold text-slate-700">
                {statement.contactPerson || "Not provided"}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Coverage period
              </dt>
              <dd className="mt-1.5 text-sm font-semibold text-slate-600">
                {formatDate(statement.coverageFrom)} –{" "}
                {formatDate(statement.coverageTo)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3.5">
              <dt className="text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Account records
              </dt>
              <dd className="mt-1.5 text-sm font-bold text-slate-700">
                {statement.quotations.length} quotations · {totalItems} items
              </dd>
            </div>
          </dl>
          {statement.notes ? (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/45 p-3.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-brand-blue">
                Notes
              </p>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">
                {statement.notes}
              </p>
            </div>
          ) : null}
        </section>
        <aside className="rounded-[1.5rem] bg-[linear-gradient(145deg,#00113f,#073078)] p-5 text-white shadow-[0_20px_48px_-30px_rgba(0,20,76,0.75)]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-white/10">
              <Icon path="M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold">Account summary</h3>
              <p className="mt-0.5 text-[10px] text-white/45">
                Charges, payments, and remaining balance
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 text-white/65">
              <span>Opening balance</span>
              <strong className="tabular-nums text-white">
                {formatPeso(statement.openingBalance)}
              </strong>
            </div>
            <div className="flex justify-between gap-4 text-white/65">
              <span>Quotation charges</span>
              <strong className="tabular-nums text-white">
                {formatPeso(statement.totalCharges)}
              </strong>
            </div>
            <div className="flex justify-between gap-4 text-emerald-300/80">
              <span>Payments received</span>
              <strong className="tabular-nums text-emerald-300">
                − {formatPeso(statement.totalPayments)}
              </strong>
            </div>
          </div>
          <div className="mt-5 border-t border-white/15 pt-5">
            <div className="flex items-end justify-between gap-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                Balance due
              </span>
              <strong className="text-2xl font-extrabold tracking-[-0.035em]">
                {formatPeso(statement.balance)}
              </strong>
            </div>
          </div>
        </aside>
      </div>
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-extrabold text-brand-blue">
              Included quotations
            </h3>
            <p className="mt-1 text-[10px] text-slate-400">
              Approved quotation-based sales included in this account
            </p>
          </div>
          <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
            {statement.quotations.length} records
          </span>
        </header>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {statement.quotations.map((quotation) => (
            <article
              className="rounded-2xl border border-slate-200 bg-slate-50/45 p-4"
              key={quotation.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-extrabold text-brand-blue">
                    {quotation.quotationNumber}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {formatDate(quotation.dateCreated)}
                  </p>
                </div>
                <strong className="text-sm tabular-nums text-brand-blue">
                  {formatPeso(quotation.totalAmount)}
                </strong>
              </div>
              <p className="mt-3 text-xs font-bold text-slate-700">
                {quotation.subject}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-slate-400">
                {quotation.projectLocation}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[9px] font-bold text-slate-400">
                  {quotation.items.length} items
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  {quotation.vatEnabled ? "VAT included" : "No VAT"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-extrabold text-brand-blue">
              Account items
            </h3>
            <p className="mt-1 text-[10px] text-slate-400">
              All products across the selected quotations
            </p>
          </div>
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-brand-blue">
            {totalItems} items
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-left">
            <thead>
              <tr className="bg-slate-50/70 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                <th className="w-[14%] px-4 py-3.5">Quotation</th>
                <th className="w-[34%] px-4 py-3.5">Item</th>
                <th className="w-[11%] px-4 py-3.5">Unit</th>
                <th className="w-[11%] px-4 py-3.5 text-right">Quantity</th>
                <th className="w-[15%] px-4 py-3.5 text-right">Unit price</th>
                <th className="w-[15%] px-4 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {statement.quotations
                .flatMap((quotation) => quotation.items)
                .map((item) => (
                  <tr
                    className="border-t border-slate-100 transition hover:bg-blue-50/30"
                    key={item.id}
                  >
                    <td className="px-4 py-4 font-mono text-[10px] font-extrabold text-violet-700">
                      {item.quotationNumber}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductPhoto photo={item.photo} name={item.itemName} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold text-slate-700">
                            {item.itemName}
                          </p>
                          <p className="mt-1 truncate text-[9px] text-slate-400">
                            {item.productCode || "No product code"}
                            {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {item.unitOfMeasure}
                    </td>
                    <td className="px-4 py-4 text-right text-xs tabular-nums text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-4 text-right text-xs font-bold tabular-nums text-slate-600">
                      {formatPeso(item.unitPrice)}
                    </td>
                    <td className="px-4 py-4 text-right text-xs font-extrabold tabular-nums text-brand-blue">
                      {formatPeso(item.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
          <header className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-extrabold text-brand-blue">
              Account ledger
            </h3>
            <p className="mt-1 text-[10px] text-slate-400">
              Chronological charges and payments
            </p>
          </header>
          <div className="divide-y divide-slate-100">
            {[
              ...statement.quotations.map((quotation) => ({
                id: `charge-${quotation.id}`,
                date: quotation.dateCreated,
                reference: quotation.quotationNumber,
                description: quotation.subject,
                charge: quotation.totalAmount,
                payment: 0,
              })),
              ...statement.payments.map((payment) => ({
                id: payment.id,
                date: payment.date,
                reference: payment.referenceNumber || "Payment",
                description: payment.method,
                charge: 0,
                payment: payment.amount,
              })),
            ]
              .sort((left, right) => left.date.localeCompare(right.date))
              .map((entry) => (
                <div
                  className="grid grid-cols-[5.5rem_1fr_auto] gap-3 px-5 py-3.5"
                  key={entry.id}
                >
                  <div>
                    <p className="text-[10px] font-bold text-slate-600">
                      {formatDate(entry.date)}
                    </p>
                    <p className="mt-1 font-mono text-[8px] text-slate-400">
                      {entry.reference}
                    </p>
                  </div>
                  <p className="text-[10px] font-semibold leading-4 text-slate-500">
                    {entry.description}
                  </p>
                  <p
                    className={`text-right text-xs font-extrabold tabular-nums ${entry.payment ? "text-emerald-600" : "text-brand-blue"}`}
                  >
                    {entry.payment
                      ? `− ${formatPeso(entry.payment)}`
                      : formatPeso(entry.charge)}
                  </p>
                </div>
              ))}
          </div>
        </section>
        <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_40px_-32px_rgba(0,20,76,0.35)]">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-extrabold text-brand-blue">
                Payment history
              </h3>
              <p className="mt-1 text-[10px] text-slate-400">
                Payments applied to this statement
              </p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              {statement.payments.length}
            </span>
          </header>
          {statement.payments.length ? (
            <div className="divide-y divide-slate-100">
              {statement.payments.map((payment) => (
                <article
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  key={payment.id}
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-700">
                      {payment.method}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      {formatDate(payment.date)} ·{" "}
                      {payment.referenceNumber || "No reference"}
                    </p>
                    {payment.notes ? (
                      <p className="mt-1 text-[9px] text-slate-400">
                        {payment.notes}
                      </p>
                    ) : null}
                  </div>
                  <strong className="text-sm tabular-nums text-emerald-700">
                    {formatPeso(payment.amount)}
                  </strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center p-6 text-center">
              <div>
                <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-300">
                  <Icon path="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </span>
                <p className="mt-3 text-xs font-bold text-slate-500">
                  No payments recorded
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Use Record payment when the client pays.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      {isExportOpen ? (
        <DocumentExportDialog
          title="Statement of account preview"
          reference={statement.soaNumber}
          pdfFilename={`${statement.soaNumber}-statement-of-account.pdf`}
          pngFilename={`${statement.soaNumber}-statement-of-account.png`}
          createPdfBlob={() =>
            createStatementOfAccountPdfBlob(
              statement,
              effectiveStatus,
              loadCompanyProfile(),
            )
          }
          onClose={() => setIsExportOpen(false)}
        />
      ) : null}
    </div>
  );
}
