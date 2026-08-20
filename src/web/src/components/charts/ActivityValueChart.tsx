import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmptyState } from './ChartSupport'
import { chartAxisTick, chartPalette, chartTooltipItemStyle, chartTooltipLabelStyle, chartTooltipStyle, formatChartCompactPeso, formatChartPeso, useChartAnimation } from './chartTheme'

export type ActivityValuePoint = { key: string; label: string; count: number; amount: number }

type ActivityValueChartProps = {
  data: ActivityValuePoint[]
  ariaLabel: string
  emptyTitle: string
  emptyDetail: string
  itemLabel: string
}

export default function ActivityValueChart({ data, ariaLabel, emptyTitle, emptyDetail, itemLabel }: ActivityValueChartProps) {
  const animationEnabled = useChartAnimation()
  if (!data.some((point) => point.amount)) return <ChartEmptyState className="mt-5 min-h-40" title={emptyTitle} detail={emptyDetail} />

  return <div className="mt-4 h-44 min-w-0 rounded-2xl bg-slate-50/55 px-2 pt-2" role="img" aria-label={ariaLabel}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 2, left: 0 }} accessibilityLayer>
        <CartesianGrid stroke={chartPalette.grid} strokeDasharray="4 6" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ ...chartAxisTick, fontWeight: 700 }} tickMargin={8} />
        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={formatChartCompactPeso} width={54} />
        <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.58)' }} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} formatter={(value, _name, item) => {
          const count = Number((item.payload as ActivityValuePoint | undefined)?.count) || 0
          return [formatChartPeso(Number(value) || 0), `${count} ${itemLabel}${count === 1 ? '' : 's'}`]
        }} isAnimationActive={animationEnabled} />
        <Bar dataKey="amount" name="Value" fill={chartPalette.navy} radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={animationEnabled} animationDuration={520}>
          <LabelList dataKey="count" position="top" formatter={(value) => Number(value) || ''} style={{ fill: chartPalette.axis, fontSize: 9, fontWeight: 800 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
}
