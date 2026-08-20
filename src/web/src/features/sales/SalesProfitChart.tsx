import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmptyState } from '../../components/charts/ChartSupport'
import { chartAxisTick, chartPalette, chartTooltipItemStyle, chartTooltipLabelStyle, chartTooltipStyle, formatChartCompactPeso, formatChartPeso, useChartAnimation } from '../../components/charts/chartTheme'

export type SalesProfitPoint = { label: string; sales: number; profit: number; actualProfit: number }

export default function SalesProfitChart({ data }: { data: SalesProfitPoint[] }) {
  const animationEnabled = useChartAnimation()
  const hasData = data.some((point) => point.sales || point.profit || point.actualProfit)
  if (!hasData) return <ChartEmptyState className="mt-5 min-h-64" title="No sales in this period" detail="The chart will populate from approved quotations." />

  const highest = [...data].sort((left, right) => right.sales - left.sales)[0]
  const seriesNames: Record<string, string> = { sales: 'Estimated revenue', profit: 'Estimated profit', actualProfit: 'Actual profit' }

  return <div className="mt-6"><div className="h-72 min-w-0" role="img" aria-label="Estimated revenue, estimated profit, and actual profit by period">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} margin={{ top: 12, right: 12, bottom: 2, left: 2 }} accessibilityLayer>
        <CartesianGrid stroke={chartPalette.grid} strokeDasharray="4 6" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ ...chartAxisTick, fontWeight: 700 }} tickMargin={11} interval="preserveStartEnd" />
        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={formatChartCompactPeso} width={62} />
        <ReferenceLine y={0} stroke={chartPalette.zero} />
        <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.58)' }} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} formatter={(value, name) => [formatChartPeso(Number(value) || 0), seriesNames[String(name)] ?? String(name)]} isAnimationActive={animationEnabled} />
        <Bar dataKey="sales" name="sales" fill={chartPalette.navy} radius={[5, 5, 0, 0]} maxBarSize={24} isAnimationActive={animationEnabled} animationDuration={480} />
        <Bar dataKey="profit" name="profit" radius={[5, 5, 0, 0]} maxBarSize={24} isAnimationActive={animationEnabled} animationDuration={540}>{data.map((point, index) => <Cell fill={point.profit >= 0 ? chartPalette.green : chartPalette.red} key={`estimated-${index}`} />)}</Bar>
        <Bar dataKey="actualProfit" name="actualProfit" radius={[5, 5, 0, 0]} maxBarSize={24} isAnimationActive={animationEnabled} animationDuration={600}>{data.map((point, index) => <Cell fill={point.actualProfit >= 0 ? chartPalette.cyan : chartPalette.amber} key={`actual-${index}`} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  </div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/70 px-4 py-3"><p className="text-[9px] font-semibold text-slate-400">Highest estimated revenue period</p><p className="text-[10px] font-extrabold text-brand-blue">{highest?.label} · {formatChartCompactPeso(highest?.sales ?? 0)}</p></div></div>
}
