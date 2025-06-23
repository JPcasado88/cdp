import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { TrendingUp, Users, DollarSign, Target, Bell, ShoppingCart, Mail, UserCheck } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './AnimatedDashboard.css';

interface DashboardProps {
  onCustomerSelect: (customerId: string) => void;
  onSegmentSelect: (segmentType: string) => void;
}

// Animated counter component
const AnimatedCounter: React.FC<{ value: number; prefix?: string; suffix?: string; duration?: number }> = ({ 
  value, 
  prefix = '', 
  suffix = '', 
  duration = 2000 
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startValue = useRef(0);

  useEffect(() => {
    const startTime = Date.now();
    const endValue = value;
    
    const updateValue = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue.current + (endValue - startValue.current) * easeOutQuart;
      
      setDisplayValue(Math.floor(currentValue));
      
      if (progress < 1) {
        requestAnimationFrame(updateValue);
      } else {
        startValue.current = endValue;
      }
    };
    
    requestAnimationFrame(updateValue);
  }, [value, duration]);

  return <>{prefix}{displayValue.toLocaleString()}{suffix}</>;
};

// Live event notification
interface LiveEvent {
  id: string;
  type: 'order' | 'signup' | 'subscription' | 'review';
  customer: string;
  value?: number;
  timestamp: Date;
}

const AnimatedDashboard: React.FC<DashboardProps> = ({ onCustomerSelect, onSegmentSelect }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [realtimeMetrics, setRealtimeMetrics] = useState({
    totalCustomers: 0,
    totalRevenue: 0,
    activeUsers: 0,
    conversionRate: 0
  });
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  const simulateLiveUpdate = useCallback(() => {
    // Simulate different types of events
    const eventTypes = [
      { type: 'order', icon: ShoppingCart, message: 'New order', value: 50 + Math.random() * 150 },
      { type: 'signup', icon: UserCheck, message: 'New customer signup', value: null },
      { type: 'subscription', icon: Target, message: 'New subscription', value: 49 },
      { type: 'review', icon: Mail, message: 'New product review', value: null }
    ];

    const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const customerNames = ['Sarah J.', 'Mike D.', 'Emma W.', 'John K.', 'Lisa M.', 'Tom B.'];
    
    const newEvent: LiveEvent = {
      id: Date.now().toString(),
      type: randomEvent.type as any,
      customer: customerNames[Math.floor(Math.random() * customerNames.length)],
      value: randomEvent.value || undefined,
      timestamp: new Date()
    };

    setLiveEvents(prev => [newEvent, ...prev].slice(0, 5));

    // Update metrics based on event
    setRealtimeMetrics(prev => ({
      ...prev,
      totalCustomers: randomEvent.type === 'signup' ? prev.totalCustomers + 1 : prev.totalCustomers,
      totalRevenue: randomEvent.value ? prev.totalRevenue + randomEvent.value : prev.totalRevenue,
      activeUsers: prev.activeUsers + (Math.random() > 0.5 ? 1 : -1),
      conversionRate: prev.conversionRate + (Math.random() - 0.5) * 0.1
    }));

    // Update metrics for animated changes
    setMetrics((prevMetrics: any) => {
      if (!prevMetrics) return prevMetrics;
      
      const updatedMetrics = { ...prevMetrics };
      
      if (randomEvent.type === 'signup') {
        updatedMetrics.totalCustomers += 1;
        updatedMetrics.customerHealth.healthy += 1;
      }
      
      if (randomEvent.value) {
        updatedMetrics.revenue.totalRevenue += randomEvent.value;
      }

      // Randomly update segment counts
      if (updatedMetrics.segments) {
        updatedMetrics.segments = updatedMetrics.segments.map((seg: any) => ({
          ...seg,
          customerCount: seg.customerCount + Math.floor(Math.random() * 3 - 1)
        }));
      }

      return updatedMetrics;
    });
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/overview`);
      setMetrics(response.data);
      
      // Initialize realtime metrics
      setRealtimeMetrics({
        totalCustomers: response.data.totalCustomers,
        totalRevenue: response.data.revenue.totalRevenue,
        activeUsers: Math.floor(response.data.totalCustomers * 0.15), // 15% active
        conversionRate: 2.8
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    generateHourlyData();
    
    // Simulate real-time data updates
    const interval = setInterval(() => {
      simulateLiveUpdate();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  const generateHourlyData = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      data.push({
        hour: hour.getHours() + ':00',
        orders: Math.floor(20 + Math.random() * 30),
        revenue: Math.floor(800 + Math.random() * 400),
        visitors: Math.floor(200 + Math.random() * 100)
      });
    }
    
    setHourlyData(data);
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

  const segmentData = metrics.segments.map((seg: any) => ({
    name: seg.name.replace(' Customers', '').replace(' for Subscription', ''),
    customers: seg.customerCount,
    ltv: Math.round(seg.avgLTV)
  }));

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingCart size={16} />;
      case 'signup': return <UserCheck size={16} />;
      case 'subscription': return <Target size={16} />;
      case 'review': return <Mail size={16} />;
      default: return <Bell size={16} />;
    }
  };

  return (
    <div className="animated-dashboard">
      {/* Live Events Ticker */}
      <div className="live-events-ticker">
        <div className="ticker-header">
          <Bell size={16} className="pulse" />
          <span>Live Activity</span>
        </div>
        <div className="ticker-content">
          {liveEvents.map((event, index) => (
            <div key={event.id} className={`event-item fade-in delay-${index}`}>
              {getEventIcon(event.type)}
              <span className="event-customer">{event.customer}</span>
              <span className="event-action">
                {event.type === 'order' && `placed order`}
                {event.type === 'signup' && `joined`}
                {event.type === 'subscription' && `subscribed`}
                {event.type === 'review' && `left review`}
              </span>
              {event.value && <span className="event-value">${event.value.toFixed(0)}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-header">
        <h1>Real-Time Customer Intelligence</h1>
        <p className="dashboard-subtitle">Live insights updated every few seconds</p>
      </div>

      {/* Animated Metrics */}
      <div className="metrics-grid animated">
        <div className="metric-card glow">
          <div className="metric-icon pulse">
            <Users size={24} />
          </div>
          <div className="metric-label">Total Customers</div>
          <div className="metric-value">
            <AnimatedCounter value={realtimeMetrics.totalCustomers} />
          </div>
          <div className="metric-change positive">
            <TrendingUp size={16} /> +12% from last month
          </div>
          <div className="metric-sparkline">
            <ResponsiveContainer width="100%" height={40}>
              <LineChart data={hourlyData.slice(-8)}>
                <Line type="monotone" dataKey="visitors" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="metric-card glow">
          <div className="metric-icon pulse">
            <DollarSign size={24} />
          </div>
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value">
            $<AnimatedCounter value={Math.round(realtimeMetrics.totalRevenue / 1000)} />K
          </div>
          <div className="metric-change positive">
            <TrendingUp size={16} /> +23% YoY
          </div>
          <div className="metric-sparkline">
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={hourlyData.slice(-8)}>
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="metric-card glow">
          <div className="metric-icon pulse">
            <Target size={24} />
          </div>
          <div className="metric-label">Active Now</div>
          <div className="metric-value">
            <AnimatedCounter value={realtimeMetrics.activeUsers} />
          </div>
          <div className="live-indicator">
            <span className="live-dot"></span>
            LIVE
          </div>
        </div>

        <div className="metric-card glow">
          <div className="metric-icon pulse">
            <ShoppingCart size={24} />
          </div>
          <div className="metric-label">Conversion Rate</div>
          <div className="metric-value">
            <AnimatedCounter value={Math.round(realtimeMetrics.conversionRate * 10) / 10} suffix="%" />
          </div>
          <div className="metric-change positive">
            <TrendingUp size={16} /> +0.3% today
          </div>
        </div>
      </div>

      {/* Real-time Activity Chart */}
      <div className="card">
        <h2>24-Hour Activity</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={hourlyData}>
            <defs>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="orders" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOrders)" />
            <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="dashboard-grid">
        {/* Animated Customer Health */}
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
                  animationBegin={0}
                  animationDuration={1500}
                >
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="health-center-label">
              <div className="health-total">{metrics.totalCustomers.toLocaleString()}</div>
              <div className="health-label">Total</div>
            </div>
            <div className="health-legend">
              {healthData.map((item) => (
                <div key={item.name} className="legend-item">
                  <div className="legend-color pulse-bg" style={{ backgroundColor: item.color }}></div>
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-value">
                    <AnimatedCounter value={item.value} duration={1500} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Opportunities with animations */}
        <div className="card">
          <h2>Top Opportunities</h2>
          <div className="opportunities">
            {metrics.opportunities && metrics.opportunities.map((opp: any, index: number) => (
              <div key={index} className={`opportunity-item slide-in delay-${index}`}>
                <div className="opportunity-header">
                  <h3>{opp.type}</h3>
                  <span className="opportunity-value pulse-text">
                    +$<AnimatedCounter value={Math.round(opp.value / 1000)} suffix="K" />
                  </span>
                </div>
                <p className="opportunity-description">{opp.description}</p>
                <div className="opportunity-count">
                  <AnimatedCounter value={opp.count} /> customers
                </div>
                <div className="opportunity-progress">
                  <div 
                    className="progress-bar"
                    style={{ width: `${(opp.count / metrics.totalCustomers) * 100}%` }}
                  />
                </div>
                <button 
                  className="btn btn-primary hover-lift"
                  onClick={() => {
                    onSegmentSelect(opp.type);
                  }}
                >
                  View Segment
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Animated Segment Performance */}
      <div className="card">
        <h2>Live Segment Updates</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={segmentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
            <Tooltip />
            <Bar yAxisId="left" dataKey="customers" fill="#3b82f6" name="Customers" animationDuration={1500} />
            <Bar yAxisId="right" dataKey="ltv" fill="#10b981" name="Avg LTV ($)" animationDuration={1500} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnimatedDashboard;