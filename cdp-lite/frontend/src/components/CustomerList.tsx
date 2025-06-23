import React, { useEffect, useState } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './CustomerList.css';

interface CustomerListProps {
  onCustomerSelect: (customerId: string) => void;
}

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  lifetime_value: number;
  total_orders: number;
  subscription_status: string;
  churn_risk_score: number;
  last_order_date: string;
  email_engagement_score: number;
  city: string;
  state: string;
  segments: string[];
}

const CustomerList: React.FC<CustomerListProps> = ({ onCustomerSelect }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [segments, setSegments] = useState<string[]>([]);
  
  const limit = 50;

  useEffect(() => {
    fetchCustomers();
    fetchSegments();
  }, [searchTerm, selectedSegment, currentPage]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params: any = {
        limit,
        offset: (currentPage - 1) * limit
      };
      
      if (searchTerm) params.search = searchTerm;
      if (selectedSegment) params.segment = selectedSegment;
      
      const response = await axios.get(`${API_BASE_URL}/customers`, { params });
      setCustomers(response.data.customers);
      setTotalCustomers(response.data.total);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSegments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/segments`);
      setSegments(response.data.map((seg: any) => seg.name));
    } catch (error) {
      console.error('Error fetching segments:', error);
    }
  };

  const getHealthStatus = (churnRisk: number) => {
    if (churnRisk < 30) return { label: 'Healthy', class: 'tag-green' };
    if (churnRisk < 60) return { label: 'Warning', class: 'tag-yellow' };
    return { label: 'At Risk', class: 'tag-red' };
  };

  const getSubscriptionBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Active', class: 'tag-green' };
      case 'cancelled':
        return { label: 'Cancelled', class: 'tag-red' };
      case 'paused':
        return { label: 'Paused', class: 'tag-yellow' };
      default:
        return { label: 'None', class: 'tag' };
    }
  };

  const formatDate = (date: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const totalPages = Math.ceil(totalCustomers / limit);

  return (
    <div className="customer-list">
      <div className="customer-list-header">
        <h1>Customers</h1>
        <p className="customer-count">{totalCustomers.toLocaleString()} total customers</p>
      </div>

      <div className="search-bar">
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select 
          className="segment-filter"
          value={selectedSegment}
          onChange={(e) => setSelectedSegment(e.target.value)}
        >
          <option value="">All Segments</option>
          {segments.map(segment => (
            <option key={segment} value={segment}>{segment}</option>
          ))}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">Loading customers...</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>LTV</th>
                  <th>Orders</th>
                  <th>Subscription</th>
                  <th>Health</th>
                  <th>Last Order</th>
                  <th>Segments</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => {
                  const health = getHealthStatus(customer.churn_risk_score);
                  const subscription = getSubscriptionBadge(customer.subscription_status);
                  
                  return (
                    <tr 
                      key={customer.id} 
                      onClick={() => onCustomerSelect(customer.id)}
                      className="clickable-row"
                    >
                      <td>
                        <div className="customer-info">
                          <div className="customer-name">
                            {customer.first_name} {customer.last_name}
                          </div>
                          <div className="customer-email">{customer.email}</div>
                          <div className="customer-location">
                            {customer.city}, {customer.state}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="ltv-value">${Math.round(customer.lifetime_value)}</div>
                      </td>
                      <td>{customer.total_orders}</td>
                      <td>
                        <span className={`tag ${subscription.class}`}>
                          {subscription.label}
                        </span>
                      </td>
                      <td>
                        <span className={`tag ${health.class}`}>
                          {health.label}
                        </span>
                      </td>
                      <td>{formatDate(customer.last_order_date)}</td>
                      <td>
                        <div className="segment-tags">
                          {customer.segments?.filter(seg => seg).slice(0, 2).map((segment, index) => (
                            <span key={index} className="tag tag-blue">{segment}</span>
                          ))}
                          {customer.segments?.length > 2 && (
                            <span className="tag">+{customer.segments.length - 2}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="pagination">
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerList;