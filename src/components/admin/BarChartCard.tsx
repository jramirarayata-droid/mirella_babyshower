import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface ChartDatum {
  label: string
  value: number
}

interface Props {
  title: string
  description?: string
  data: ChartDatum[]
  /** Shown when every value is zero. */
  emptyText?: string
}

// One validated hue for every chart. Categories are identified by their axis
// label (never by colour), and every bar carries a direct value label.
const BAR = '#8a6e45'
const AXIS = '#6b655c'
const GRID = '#ebe3d6'

export function BarChartCard({ title, description, data, emptyText = 'No responses yet.' }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const height = Math.max(150, data.length * 44 + 30)

  return (
    <figure className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <figcaption>
        <h3 className="font-sans text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </figcaption>

      {total === 0 ? (
        <p className="flex h-[150px] items-center justify-center text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="mt-4" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="0" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={118}
                tick={{ fill: '#4a4640', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(184,155,106,0.10)' }}
                formatter={(v) => [String(v), 'Count']}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2d8c8',
                  background: '#fffdf9',
                  fontSize: 12,
                  boxShadow: '0 12px 24px -12px rgba(43,42,40,.25)',
                }}
                labelStyle={{ color: '#2b2a28', fontWeight: 600 }}
              />
              <Bar dataKey="value" fill={BAR} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" fill="#2b2a28" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Accessible data table */}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
