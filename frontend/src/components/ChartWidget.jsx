import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts'

const COLORS = ['#4318ff', '#6b5ce7', '#a3aed0', '#e0e5f2', '#ff6b6b', '#4ecdc4']

export default function ChartWidget({ title, type, data, labels }) {
  const chartData = labels.map((label, i) => ({
    name: label,
    value: data[i],
  }))

  const renderChart = () => {
    switch (type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e5f2" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#4318ff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e5f2" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#4318ff" strokeWidth={2} dot={{ fill: '#4318ff' }} />
            </LineChart>
          </ResponsiveContainer>
        )

      default:
        return null
    }
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-space-900 mb-4">{title}</h3>
      {renderChart()}
    </div>
  )
}