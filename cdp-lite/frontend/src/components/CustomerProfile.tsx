import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Package, Star, Users, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './CustomerProfile.css';

interface CustomerProfileProps {
  customerId: string;
  onBack: () => void;
}

interface CustomerData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  lifetime_value: number;
  total_orders: number;
  first_order_date: string;
  last_order_date: string;
  days_since_last_order: number;
  average_order_value: number;
  subscription_status: string;
  subscription_start_date: string;
  subscription_mrr: number;
  subscription_product: string;
  email_engagement_score: number;
  email_opens_30d: number;
  email_clicks_30d: number;
  support_tickets_count: number;
  product_reviews_count: number;
  referrals_count: number;
  churn_risk_score: number;
  predicted_ltv: number;
  predicted_next_order_date: string;
  created_at: string;
  segments: Array<{ name: string; description: string }>;
  recentEvents: Array<{
    event_type: string;
    event_source: string;
    event_data: any;
    occurred_at: string;
  }>;
  insights: {
    nextBestAction: string;
    lifetimeValueTrend: string;
    engagementTrend: string;
  };
}

const CustomerProfile: React.FC<CustomerProfileProps> = ({ customerId, onBack }) => {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomer = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/customers/${customerId}`);
      setCustomer(response.data);
    } catch (error) {
      console.error('Error fetching customer:', error);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomer();
  }, [customerId, fetchCustomer]);

  if (loading) {
    return <div className="loading">Loading customer profile...</div>;
  }

  if (!customer) {
    return <div className="loading">Customer not found</div>;
  }

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatEventType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getHealthColor = (score: number) => {
    if (score < 30) return '#10b981';
    if (score < 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="customer-profile">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={20} />
        Back to Customers
      </button>

      <div className="profile-header">
        <div className="profile-info">
          <h1>{customer.first_name} {customer.last_name}</h1>
          <div className="profile-meta">
            <span><Mail size={16} /> {customer.email}</span>
            <span><Phone size={16} /> {customer.phone}</span>
            <span><MapPin size={16} /> {customer.city}, {customer.state}</span>
            <span><Calendar size={16} /> Customer since {formatDate(customer.created_at)}</span>
          </div>
        </div>
        
        <div className="profile-actions">
          <button className="btn btn-primary">Send Campaign</button>
          <button className="btn btn-secondary">Add Note</button>
        </div>
      </div>

      <div className="profile-grid">
        {/* Key Metrics */}
        <div className="card">
          <h2>Key Metrics</h2>
          <div className="metrics-list">
            <div className="metric-item">
              <span className="metric-label">Lifetime Value</span>
              <span className="metric-value">${Math.round(customer.lifetime_value)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Predicted LTV</span>
              <span className="metric-value">${Math.round(customer.predicted_ltv)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Total Orders</span>
              <span className="metric-value">{customer.total_orders}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Avg Order Value</span>
              <span className="metric-value">${Math.round(customer.average_order_value)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Days Since Last Order</span>
              <span className="metric-value">{customer.days_since_last_order || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Health & Risk */}
        <div className="card">
          <h2>Health & Risk</h2>
          <div className="health-meter">
            <div className="health-score">
              <div className="score-label">Churn Risk Score</div>
              <div 
                className="score-value" 
                style={{ color: getHealthColor(customer.churn_risk_score) }}
              >
                {customer.churn_risk_score}%
              </div>
            </div>
            <div className="health-bar">
              <div 
                className="health-fill" 
                style={{ 
                  width: `${customer.churn_risk_score}%`,
                  backgroundColor: getHealthColor(customer.churn_risk_score)
                }}
              />
            </div>
          </div>
          
          <div className="insight-box">
            <AlertCircle size={16} />
            <span>{customer.insights.nextBestAction}</span>
          </div>
        </div>

        {/* Subscription */}
        <div className="card">
          <h2>Subscription</h2>
          {customer.subscription_status === 'active' ? (
            <div className="subscription-active">
              <div className="subscription-badge active">Active Subscriber</div>
              <div className="subscription-details">
                <p><strong>Product:</strong> {customer.subscription_product}</p>
                <p><strong>Monthly Revenue:</strong> ${customer.subscription_mrr}</p>
                <p><strong>Started:</strong> {formatDate(customer.subscription_start_date)}</p>
              </div>
            </div>
          ) : (
            <div className="subscription-inactive">
              <div className="subscription-badge inactive">No Active Subscription</div>
              <p className="subscription-cta">Customer has made {customer.total_orders} orders. Consider offering a subscription.</p>
            </div>
          )}
        </div>

        {/* Engagement */}
        <div className="card">
          <h2>Engagement</h2>
          <div className="engagement-stats">
            <div className="stat-item">
              <Mail size={20} />
              <div>
                <div className="stat-value">{customer.email_engagement_score}%</div>
                <div className="stat-label">Email Score</div>
              </div>
            </div>
            <div className="stat-item">
              <Package size={20} />
              <div>
                <div className="stat-value">{customer.email_opens_30d}</div>
                <div className="stat-label">Opens (30d)</div>
              </div>
            </div>
            <div className="stat-item">
              <Star size={20} />
              <div>
                <div className="stat-value">{customer.product_reviews_count}</div>
                <div className="stat-label">Reviews</div>
              </div>
            </div>
            <div className="stat-item">
              <Users size={20} />
              <div>
                <div className="stat-value">{customer.referrals_count}</div>
                <div className="stat-label">Referrals</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Segments */}
      <div className="card">
        <h2>Segments</h2>
        <div className="segments-list">
          {customer.segments.map((segment, index) => (
            <div key={index} className="segment-item">
              <h3>{segment.name}</h3>
              <p>{segment.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h2>Recent Activity</h2>
        <div className="timeline">
          {customer.recentEvents.map((event, index) => (
            <div key={index} className="timeline-item">
              <div className="timeline-date">
                {formatDate(event.occurred_at)}
              </div>
              <div className="timeline-content">
                <strong>{formatEventType(event.event_type)}</strong>
                <span className="event-source"> via {event.event_source}</span>
                {event.event_type === 'order_completed' && (
                  <div className="event-details">
                    Order Total: ${event.event_data.total}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;