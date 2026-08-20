import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartAxisTick, chartPalette, chartTooltipItemStyle, chartTooltipLabelStyle, chartTooltipStyle, formatChartCompactPeso, formatChartPeso, useChartAnimation } from '../../components/charts/chartTheme'

export type ExpenseTrendChartPoint = { key: string; monthLabel: string; yearLabel: string; fullLabel: string; total: number; isSelected: boolean }
export type ExpenseCategoryChartPoint = { name: string; total: number; count: number }

export function ExpenseTrendRechart({ points }: { points: ExpenseTrendChartPoint[] }) {
  const animationEnabled = useChartAnimation()
  const data = points.map((point) => ({ ...point, axisLabel: `${point.monthLabel} '${point.yearLabel.slice(-2)}` }))
  const minimumWidth = Math.max(560, points.length * 64)
  return <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/45"><div className="h-64" style={{ minWidth: `${minimumWidth}px` }} role="img" aria-label="Monthly expense totals">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} margin={{ top: 20, right: 14, bottom: 4, left: 2 }} accessibilityLayer>
        <CartesianGrid stroke={chartPalette.grid} strokeDasharray="4 6" vertical={false} />
        <XAxis dataKey="axisLabel" axisLine={false} tickLine={false} tick={{ ...chartAxisTick, fontWeight: 700 }} tickMargin={11} interval={0} />
        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={formatChartCompactPeso} width={62} />
        <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.58)' }} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} labelFormatter={(_, payload) => (payload?.[0]?.payload as ExpenseTrendChartPoint | undefined)?.fullLabel ?? ''} formatter={(value) => [formatChartPeso(Number(value) || 0), 'Expenses']} isAnimationActive={animationEnabled} />
        <Bar dataKey="total" name="Expenses" radius={[6, 6, 0, 0]} maxBarSize={42} isAnimationActive={animationEnabled} animationDuration={520}>{data.map((point) => <Cell fill={point.isSelected ? chartPalette.orangeDark : point.total > 0 ? chartPalette.navy : '#cbd5e1'} key={point.key} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  </div></div>
}

type CategoryTooltipProps = { active?: boolean; payload?: Array<{ payload?: ExpenseCategoryChartPoint & { share: number } }> }

function CategoryTooltip({ active, payload }: CategoryTooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_18px_42px_-24px_rgba(0,20,76,0.42)]"><p className="text-xs font-extrabold text-brand-blue">{point.name}</p><p className="mt-1.5 text-[10px] font-bold text-slate-600">{formatChartPeso(point.total)}</p><p className="mt-1 text-[9px] text-slate-400">{point.count} {point.count === 1 ? 'entry' : 'entries'} · {point.share.toFixed(1)}% of spending</p></div>
}

export function ExpenseCategoryRechart({ categories, total }: { categories: ExpenseCategoryChartPoint[]; total: number }) {
  const animationEnabled = useChartAnimation()
  const data = categories.map((category) => ({ ...category, share: total > 0 ? (category.total / total) * 100 : 0 }))
  const height = Math.max(220, data.length * 44 + 48)
  return <div className="mt-5 overflow-x-auto"><div style={{ height: `${height}px`, minWidth: '560px' }} role="img" aria-label="Expense totals by category">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 74, bottom: 4, left: 8 }} accessibilityLayer>
        <CartesianGrid stroke={chartPalette.grid} strokeDasharray="4 6" horizontal={false} />
        <XAxis type="number" axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={formatChartCompactPeso} />
        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ ...chartAxisTick, fontWeight: 700 }} width={128} tickFormatter={(value) => String(value).length > 18 ? `${String(value).slice(0, 17)}…` : String(value)} />
        <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.58)' }} content={<CategoryTooltip />} isAnimationActive={animationEnabled} />
        <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={24} isAnimationActive={animationEnabled} animationDuration={520}>{data.map((point, index) => <Cell fill={index === 0 ? chartPalette.orangeDark : chartPalette.navy} key={point.name} />)}<LabelList dataKey="total" position="right" formatter={(value) => formatChartCompactPeso(Number(value) || 0)} style={{ fill: chartPalette.navyDark, fontSize: 10, fontWeight: 800 }} /></Bar>
      </BarChart>
    </ResponsiveContainer>
  </div></div>
}
