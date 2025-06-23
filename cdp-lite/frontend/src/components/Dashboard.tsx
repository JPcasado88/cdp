import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Users, DollarSign, Target } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './Dashboard.css';

interface DashboardProps {
  onCustomerSelect: (customerId: string) => void;
}

interface Metrics {
  totalCustomers: number;
  customerHealth: {
    healthy: number;
    warning: number;
    critical: number;
  };
  revenue: {
    totalRevenue: number;
    averageLTV: number;
    totalMRR: number;
  };
  segments: Array<{
    name: string;
    customerCount: number;
    avgLTV: number;
    avgOrderCount: number;
  }>;
  opportunities: Array<{
    type: string;
    count: number;
    value: number;
    description: string;
  }>;
}

const Dashboard: React.FC<DashboardProps> = ({ onCustomerSelect }) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/overview`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!metrics) {
    return <div className="loading">Failed to load metrics</div>;
  }

  const healthData = [
    { name: 'Healthy', value: metrics.customerHealth.healthy, color: '#10b981' },
    { name: 'Warning', value: metrics.customerHealth.warning, color: '#f59e0b' },
    { name: 'Critical', value: metrics.customerHealth.critical, color: '#ef4444' }
  ];

  const segmentData = metrics.segments.map(seg => ({
    name: seg.name.replace(' Customers', '').replace(' for Subscription', ''),
    customers: seg.customerCount,
    ltv: Math.round(seg.avgLTV)
  }));

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Customer Intelligence Dashboard</h1>
        <p className="dashboard-subtitle">Real-time insights into your customer base</p>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <Users size={24} />
          </div>
          <div className="metric-label">Total Customers</div>
          <div className="metric-value">{metrics.totalCustomers.toLocaleString()}</div>
          <div className="metric-change positive">
            <TrendingUp size={16} /> +12% from last month
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <DollarSign size={24} />
          </div>
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value">${(metrics.revenue.totalRevenue / 1000000).toFixed(1)}M</div>
          <div className="metric-change positive">
            <TrendingUp size={16} /> +23% YoY
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <Target size={24} />
          </div>
          <div className="metric-label">Average LTV</div>
          <div className="metric-value">${Math.round(metrics.revenue.averageLTV)}</div>
          <div className="metric-change negative">
            <TrendingDown size={16} /> -5% from last quarter
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <DollarSign size={24} />
          </div>
          <div className="metric-label">Monthly Recurring</div>
          <div className="metric-value">${(metrics.revenue.totalMRR / 1000).toFixed(1)}K</div>
          <div className="metric-change positive">
            <TrendingUp size={16} /> +18% growth
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Customer Health */}
        <div className="card">
          <h2>Customer Health</h2>
          <div className="health-chart">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={healthData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="health-legend">
              {healthData.map((item) => (
                <div key={item.name} className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: item.color }}></div>
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-value">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Opportunities */}
        <div className="card">
          <h2>Top Opportunities</h2>
          <div className="opportunities">
            {metrics.opportunities.map((opp, index) => (
              <div key={index} className="opportunity-item">
                <div className="opportunity-header">
                  <h3>{opp.type}</h3>
                  <span className="opportunity-value">+${(opp.value / 1000).toFixed(0)}K</span>
                </div>
                <p className="opportunity-description">{opp.description}</p>
                <div className="opportunity-count">{opp.count.toLocaleString()} customers</div>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    // Navigate to segments view with pre-filled query
                    // For now, just alert
                    alert(`View segment: ${opp.type}\n${opp.count} customers identified`);
                  }}
                >
                  View Segment
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Segment Performance */}
      <div className="card">
        <h2>Segment Performance</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={segmentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
            <Tooltip />
            <Bar yAxisId="left" dataKey="customers" fill="#3b82f6" name="Customers" />
            <Bar yAxisId="right" dataKey="ltv" fill="#10b981" name="Avg LTV ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;