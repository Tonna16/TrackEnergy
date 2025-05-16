import  {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useState } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface EnergyUsageChartProps {
  dailyData?: number[];
  weeklyData?: number[];
  monthlyData?: number[];
  appliances?: { name: string; usage: number }[];
  type?: 'line' | 'bar';
  height?: number;
}

export default function EnergyUsageChart({
  dailyData = [3.2, 3.7, 3.0, 3.5, 3.9, 3.3, 3.1],
  weeklyData = [22, 25, 21, 24, 18, 20, 23, 22],
  monthlyData = [650, 720, 680, 710, 690, 620, 630, 640, 680, 700, 710, 650],
  appliances = [],
  type = 'line',
  height = 300,
}: EnergyUsageChartProps) {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  let labels: string[] = [];
  let data: number[] = [];
  
  if (timeframe === 'daily') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    data = dailyData;
  } else if (timeframe === 'weekly') {
    labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'];
    data = weeklyData;
  } else {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    data = monthlyData;
  }
  
  const chartData = appliances.length
    ? {
        labels: appliances.map((app) => app.name),
        datasets: [
          {
            label: 'Energy Usage (kWh)',
            data: appliances.map((app) => app.usage),
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
          },
        ],
      }
    : {
        labels,
        datasets: [
          {
            label: 'Energy Usage (kWh)',
            data,
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            tension: 0.3,
          },
        ],
      };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  return (
    <div>
      {!appliances.length && (
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setTimeframe('daily')}
            className={`px-3 py-1 text-sm rounded-full ${
              timeframe === 'daily'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setTimeframe('weekly')}
            className={`px-3 py-1 text-sm rounded-full ${
              timeframe === 'weekly'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setTimeframe('monthly')}
            className={`px-3 py-1 text-sm rounded-full ${
              timeframe === 'monthly'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Monthly
          </button>
        </div>
      )}

      <div style={{ height: `${height}px` }}>
        {type === 'line' ? (
          <Line data={chartData} options={options} />
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
 