import React, { useState, useEffect } from 'react';
import { Plus, X, Save, Play } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './SegmentBuilder.css';

interface Condition {
  field: string;
  operator: string;
  value: string | number;
}

interface SegmentRules {
  conditions: Condition[];
  logic: 'AND' | 'OR';
}

interface TestResults {
  count: number;
  sample: any[];
  stats: {
    avg_ltv: number;
    avg_orders: number;
    avg_churn_risk: number;
  };
}

const FIELDS = [
  { value: 'lifetime_value', label: 'Lifetime Value', type: 'number' },
  { value: 'total_orders', label: 'Total Orders', type: 'number' },
  { value: 'days_since_last_order', label: 'Days Since Last Order', type: 'number' },
  { value: 'average_order_value', label: 'Average Order Value', type: 'number' },
  { value: 'subscription_status', label: 'Subscription Status', type: 'select', options: ['active', 'cancelled', 'paused', 'none'] },
  { value: 'email_engagement_score', label: 'Email Engagement Score', type: 'number' },
  { value: 'churn_risk_score', label: 'Churn Risk Score', type: 'number' },
  { value: 'support_tickets_count', label: 'Support Tickets', type: 'number' },
  { value: 'product_reviews_count', label: 'Product Reviews', type: 'number' },
  { value: 'referrals_count', label: 'Referrals', type: 'number' },
];

const OPERATORS = {
  number: [
    { value: 'greater_than', label: 'greater than' },
    { value: 'greater_than_or_equal', label: 'greater than or equal' },
    { value: 'less_than', label: 'less than' },
    { value: 'less_than_or_equal', label: 'less than or equal' },
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
  ],
  select: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
  ],
};

interface SegmentBuilderProps {
  initialSegmentType?: string | null;
}

const SegmentBuilder: React.FC<SegmentBuilderProps> = ({ initialSegmentType }) => {
  const [segmentName, setSegmentName] = useState('');
  const [segmentDescription, setSegmentDescription] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([
    { field: 'lifetime_value', operator: 'greater_than', value: 100 }
  ]);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingSegments, setExistingSegments] = useState<any[]>([]);

  useEffect(() => {
    fetchSegments();
    
    // Pre-populate segment based on type from dashboard
    if (initialSegmentType) {
      switch (initialSegmentType) {
        case 'Convert to Subscription':
          setSegmentName('Ready for Subscription');
          setSegmentDescription('Regular buyers who should convert to subscription');
          setConditions([
            { field: 'subscription_status', operator: 'equals', value: 'none' },
            { field: 'total_orders', operator: 'greater_than_or_equal', value: 3 },
            { field: 'average_order_value', operator: 'greater_than', value: 75 }
          ]);
          setLogic('AND');
          break;
        case 'Win Back High Value':
          setSegmentName('Win Back Campaign');
          setSegmentDescription('Previously high-value customers to win back');
          setConditions([
            { field: 'subscription_status', operator: 'equals', value: 'cancelled' },
            { field: 'lifetime_value', operator: 'greater_than', value: 500 }
          ]);
          setLogic('AND');
          break;
        case 'Prevent Churn':
          setSegmentName('Churn Prevention');
          setSegmentDescription('At-risk subscribers who need attention');
          setConditions([
            { field: 'subscription_status', operator: 'equals', value: 'active' },
            { field: 'churn_risk_score', operator: 'greater_than', value: 70 }
          ]);
          setLogic('AND');
          break;
      }
      
      // Auto-test the segment after a short delay
      setTimeout(() => {
        const testButton = document.querySelector('.segment-actions .btn-secondary');
        if (testButton) {
          (testButton as HTMLButtonElement).click();
        }
      }, 500);
    }
  }, [initialSegmentType]);

  const fetchSegments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/segments`);
      setExistingSegments(response.data);
    } catch (error) {
      console.error('Error fetching segments:', error);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'lifetime_value', operator: 'greater_than', value: 0 }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const testSegment = async () => {
    setTesting(true);
    try {
      const rules: SegmentRules = { conditions, logic };
      const response = await axios.post(`${API_BASE_URL}/segments/test`, { rules });
      setTestResults(response.data);
    } catch (error) {
      console.error('Error testing segment:', error);
    } finally {
      setTesting(false);
    }
  };

  const saveSegment = async () => {
    if (!segmentName || !segmentDescription) {
      alert('Please provide a name and description for the segment');
      return;
    }

    setSaving(true);
    try {
      const rules: SegmentRules = { conditions, logic };
      await axios.post(`${API_BASE_URL}/segments`, {
        name: segmentName,
        description: segmentDescription,
        rules
      });
      alert('Segment saved successfully!');
      fetchSegments();
      // Reset form
      setSegmentName('');
      setSegmentDescription('');
      setConditions([{ field: 'lifetime_value', operator: 'greater_than', value: 100 }]);
      setTestResults(null);
    } catch (error) {
      console.error('Error saving segment:', error);
      alert('Failed to save segment');
    } finally {
      setSaving(false);
    }
  };

  const getFieldType = (field: string) => {
    return FIELDS.find(f => f.value === field)?.type || 'text';
  };

  const getFieldOptions = (field: string) => {
    return FIELDS.find(f => f.value === field)?.options || [];
  };

  return (
    <div className={`segment-builder-container ${initialSegmentType ? 'pre-populated' : ''}`}>
      <div className="segment-builder-header">
        <h1>Segment Builder</h1>
        <p>Create dynamic customer segments based on behavior and attributes</p>
      </div>

      <div className="segment-builder">
        <div className="segment-builder-left">
          <div className="card">
            <h2>Define Segment</h2>
            
            <div className="form-group">
              <label>Segment Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., High-Value VIPs"
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Customers with LTV > $1000 who are actively engaged"
                value={segmentDescription}
                onChange={(e) => setSegmentDescription(e.target.value)}
              />
            </div>

            <div className="segment-rules">
              <div className="rules-header">
                <h3>IF customer matches {logic} of these conditions:</h3>
                <select 
                  value={logic} 
                  onChange={(e) => setLogic(e.target.value as 'AND' | 'OR')}
                  className="logic-select"
                >
                  <option value="AND">ALL</option>
                  <option value="OR">ANY</option>
                </select>
              </div>

              {conditions.map((condition, index) => {
                const fieldType = getFieldType(condition.field);
                const operators = OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.text;
                const fieldOptions = getFieldOptions(condition.field);

                return (
                  <div key={index} className="condition">
                    <select
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value })}
                    >
                      {FIELDS.map(field => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value })}
                    >
                      {operators.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>

                    {fieldType === 'select' ? (
                      <select
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                      >
                        {fieldOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={fieldType === 'number' ? 'number' : 'text'}
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { 
                          value: fieldType === 'number' ? Number(e.target.value) : e.target.value 
                        })}
                        placeholder="Value"
                      />
                    )}

                    <button
                      className="condition-remove"
                      onClick={() => removeCondition(index)}
                      disabled={conditions.length === 1}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}

              <button className="add-condition" onClick={addCondition}>
                <Plus size={16} />
                Add Condition
              </button>
            </div>

            <div className="segment-actions">
              <button 
                className="btn btn-secondary"
                onClick={testSegment}
                disabled={testing}
              >
                <Play size={16} />
                {testing ? 'Testing...' : 'Test Segment'}
              </button>
              <button 
                className="btn btn-primary"
                onClick={saveSegment}
                disabled={saving || !segmentName || !testResults}
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Segment'}
              </button>
            </div>
          </div>
        </div>

        <div className="segment-builder-right">
          {testResults && (
            <div className="card">
              <h2>Test Results</h2>
              <div className="test-summary">
                <div className="test-stat">
                  <div className="test-stat-value">{testResults.count.toLocaleString()}</div>
                  <div className="test-stat-label">Matching Customers</div>
                </div>
                <div className="test-stat">
                  <div className="test-stat-value">${Math.round(testResults.stats.avg_ltv)}</div>
                  <div className="test-stat-label">Average LTV</div>
                </div>
                <div className="test-stat">
                  <div className="test-stat-value">{Math.round(testResults.stats.avg_churn_risk)}%</div>
                  <div className="test-stat-label">Avg Churn Risk</div>
                </div>
              </div>

              <h3>Sample Customers</h3>
              <div className="sample-customers">
                {testResults.sample.map((customer, index) => (
                  <div key={index} className="sample-customer">
                    <div>
                      <strong>{customer.first_name} {customer.last_name}</strong>
                      <div className="sample-email">{customer.email}</div>
                    </div>
                    <div className="sample-ltv">${Math.round(customer.lifetime_value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2>Existing Segments</h2>
            <div className="existing-segments">
              {existingSegments.map((segment) => (
                <div key={segment.id} className="existing-segment">
                  <div className="segment-info">
                    <h3>{segment.name}</h3>
                    <p>{segment.description}</p>
                  </div>
                  <div className="segment-stats">
                    <span className="segment-count">{segment.customer_count} customers</span>
                    {segment.is_system && <span className="system-badge">System</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentBuilder;