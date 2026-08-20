import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmptyState } from '../../components/charts/ChartSupport'
import { chartAxisTick, chartPalette, chartTooltipItemStyle, chartTooltipLabelStyle, chartTooltipStyle, formatChartCompactPeso, formatChartPeso, useChartAnimation } from '../../components/charts/chartTheme'

export type BusinessTrendPoint = {
  key: string
  label: string
  sales: number
  expenses: number
  profit: number
}

function ProfitDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: BusinessTrendPoint }) {
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return null
  const color = payload.profit >= 0 ? chartPalette.green : chartPalette.red
  return <circle cx={cx} cy={cy} r="4" fill="white" stroke={color} strokeWidth="2.5" />
}

export default function BusinessTrendChart({ data }: { data: BusinessTrendPoint[] }) {
  const animationEnabled = useChartAnimation()
  const hasData = data.some((point) => point.sales || point.expenses || point.profit)
  if (!hasData) return <ChartEmptyState title="No business trend yet" detail="The chart will appear when sales or expenses are recorded." />

  const seriesNames: Record<string, string> = { sales: 'Sales', expenses: 'Expenses', profit: 'Company net profit' }
  return <div className="h-72 w-full min-w-0 animate-[content-enter_320ms_cubic-bezier(0.22,1,0.36,1)]" role="img" aria-label={`Sales, expenses, and company net profit for the last ${data.length} months`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 4, left: 2 }} accessibilityLayer>
        <CartesianGrid stroke={chartPalette.grid} strokeDasharray="4 6" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ ...chartAxisTick, fontSize: 11, fontWeight: 700 }} tickMargin={12} />
        <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={formatChartCompactPeso} width={62} />
        <ReferenceLine y={0} stroke={chartPalette.zero} />
        <Tooltip
          cursor={{ fill: 'rgba(241, 245, 249, 0.58)' }}
          contentStyle={chartTooltipStyle}
          labelStyle={chartTooltipLabelStyle}
          itemStyle={chartTooltipItemStyle}
          formatter={(value, name) => [formatChartPeso(Number(value) || 0), seriesNames[String(name)] ?? String(name)]}
          isAnimationActive={animationEnabled}
        />
        <Bar dataKey="sales" name="sales" fill={chartPalette.navy} barSize={16} radius={[5, 5, 0, 0]} isAnimationActive={animationEnabled} animationDuration={480} />
        <Bar dataKey="expenses" name="expenses" fill={chartPalette.orange} barSize={16} radius={[5, 5, 0, 0]} isAnimationActive={animationEnabled} animationDuration={480} />
        <Line dataKey="profit" name="profit" type="monotone" stroke={chartPalette.green} strokeWidth={2.5} dot={<ProfitDot />} activeDot={{ r: 6, fill: '#ffffff', stroke: chartPalette.green, strokeWidth: 3 }} isAnimationActive={animationEnabled} animationDuration={620} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
}
