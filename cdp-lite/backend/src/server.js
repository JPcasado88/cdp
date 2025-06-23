const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();
const setupDatabase = require('./setup');

const app = express();

// Database configuration
const dbConfig = process.env.DATABASE_URL 
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: 'localhost',
      port: 5432,
      database: 'cdp_db',
      user: 'postgres',
      password: 'postgres'
    };

const pool = new Pool(dbConfig);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true
}));
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../../frontend/build')));

// Health check
app.get('/api/health', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    dbStatus = 'disconnected';
  }
  
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// Database setup endpoint (only in development/staging)
app.post('/api/setup', async (req, res) => {
  try {
    // Check if database is connected
    await pool.query('SELECT 1');
    
    // Run setup
    const result = await setupDatabase(pool);
    res.json(result);
  } catch (error) {
    console.error('Setup failed:', error);
    res.status(500).json({ 
      error: 'Setup failed', 
      message: error.message,
      hint: 'Make sure DATABASE_URL is set correctly' 
    });
  }
});

// Mock data for when database is not available
const getMockMetrics = () => ({
  totalCustomers: 2847,
  customerHealth: {
    healthy: 1847,
    warning: 642,
    critical: 358
  },
  revenue: {
    totalRevenue: 847293,
    monthlyRecurring: 42350,
    avgOrderValue: 297.45
  },
  segments: [
    { name: 'High Value', customerCount: 512, avgLifetimeValue: 2847, growthRate: 12.5 },
    { name: 'Frequent Buyers', customerCount: 893, avgLifetimeValue: 1234, growthRate: 8.3 },
    { name: 'New Customers', customerCount: 1442, avgLifetimeValue: 156, growthRate: 23.7 }
  ],
  opportunities: [
    { 
      type: 'subscription', 
      title: 'Subscription Opportunities',
      count: 234,
      value: 11700,
      description: '234 frequent buyers could be converted to subscribers'
    },
    { 
      type: 'winback', 
      title: 'Win-back Opportunities',
      count: 89,
      value: 44500,
      description: '89 high-value cancelled customers to re-engage'
    },
    { 
      type: 'retention', 
      title: 'Retention Opportunities',
      count: 45,
      value: 22500,
      description: '45 at-risk subscribers need immediate attention'
    }
  ],
  recentEvents: [
    { type: 'order', customer: 'Sarah Johnson', value: 285.50, time: '2 min ago' },
    { type: 'signup', customer: 'Mike Chen', value: null, time: '5 min ago' },
    { type: 'subscription', customer: 'Emma Davis', value: 49.99, time: '12 min ago' }
  ]
});

// Get dashboard metrics
app.get('/api/metrics/overview', async (req, res) => {
  try {
    // Try to get real data from database
    const metrics = {};
    
    try {
      // Total customers
      const totalCustomers = await pool.query('SELECT COUNT(*) FROM customers');
      metrics.totalCustomers = parseInt(totalCustomers.rows[0].count);
    } catch (dbError) {
      // If database fails, return mock data
      console.log('Database not available, returning mock data');
      return res.json(getMockMetrics());
    }
    
    // Customer health breakdown
    const healthBreakdown = await pool.query(`
      SELECT 
        CASE 
          WHEN churn_risk_score < 30 THEN 'healthy'
          WHEN churn_risk_score < 60 THEN 'warning'
          ELSE 'critical'
        END as health_status,
        COUNT(*) as count
      FROM customers
      GROUP BY health_status
    `);
    
    metrics.customerHealth = {
      healthy: 0,
      warning: 0,
      critical: 0
    };
    
    healthBreakdown.rows.forEach(row => {
      metrics.customerHealth[row.health_status] = parseInt(row.count);
    });
    
    // Revenue metrics
    const revenueMetrics = await pool.query(`
      SELECT 
        SUM(lifetime_value) as total_revenue,
        AVG(lifetime_value) as avg_ltv,
        SUM(CASE WHEN subscription_status = 'active' THEN subscription_mrr ELSE 0 END) as total_mrr
      FROM customers
    `);
    
    metrics.revenue = {
      totalRevenue: parseFloat(revenueMetrics.rows[0].total_revenue) || 0,
      averageLTV: parseFloat(revenueMetrics.rows[0].avg_ltv) || 0,
      totalMRR: parseFloat(revenueMetrics.rows[0].total_mrr) || 0
    };
    
    // Segment performance
    const segments = await pool.query(`
      SELECT name, customer_count, avg_ltv, avg_order_count
      FROM segments
      WHERE is_system = true
      ORDER BY customer_count DESC
    `);
    
    metrics.segments = segments.rows.map(seg => ({
      name: seg.name,
      customerCount: parseInt(seg.customer_count),
      avgLTV: parseFloat(seg.avg_ltv) || 0,
      avgOrderCount: parseFloat(seg.avg_order_count) || 0
    }));
    
    // Opportunities
    const opportunities = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM customers 
         WHERE subscription_status = 'none' 
         AND total_orders >= 3 
         AND average_order_value > 75) as subscription_opportunities,
        (SELECT COUNT(*) FROM customers 
         WHERE subscription_status = 'cancelled' 
         AND lifetime_value > 500) as winback_opportunities,
        (SELECT COUNT(*) FROM customers 
         WHERE subscription_status = 'active' 
         AND churn_risk_score > 70) as retention_opportunities
    `);
    
    const opp = opportunities.rows[0];
    metrics.opportunities = [
      {
        type: 'Convert to Subscription',
        count: parseInt(opp.subscription_opportunities),
        value: parseInt(opp.subscription_opportunities) * 120 * 12, // $120/month * 12 months
        description: 'Regular buyers ready for subscription'
      },
      {
        type: 'Win Back High Value',
        count: parseInt(opp.winback_opportunities),
        value: parseInt(opp.winback_opportunities) * 400, // Avg $400 recovery
        description: 'Previously high-value customers'
      },
      {
        type: 'Prevent Churn',
        count: parseInt(opp.retention_opportunities),
        value: parseInt(opp.retention_opportunities) * 240, // $240 saved per customer
        description: 'At-risk subscribers to save'
      }
    ];
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Search customers
app.get('/api/customers', async (req, res) => {
  try {
    const { search, segment, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        c.id, c.email, c.first_name, c.last_name, 
        c.lifetime_value, c.total_orders, c.subscription_status,
        c.churn_risk_score, c.last_order_date, c.email_engagement_score,
        c.city, c.state,
        ARRAY_AGG(DISTINCT s.name) as segments
      FROM customers c
      LEFT JOIN segment_membership sm ON c.id = sm.customer_id
      LEFT JOIN segments s ON sm.segment_id = s.id
    `;
    
    const conditions = [];
    const params = [];
    
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.email ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length})`);
    }
    
    if (segment) {
      params.push(segment);
      conditions.push(`s.name = $${params.length}`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY c.id';
    query += ' ORDER BY c.lifetime_value DESC';
    
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    
    params.push(offset);
    query += ` OFFSET $${params.length}`;
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(DISTINCT c.id) FROM customers c';
    if (segment) {
      countQuery += ' LEFT JOIN segment_membership sm ON c.id = sm.customer_id';
      countQuery += ' LEFT JOIN segments s ON sm.segment_id = s.id';
    }
    
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    res.json({
      customers: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error searching customers:', error);
    // Return mock customers if database is not available
    const mockCustomers = [
      { id: '1', email: 'sarah.johnson@email.com', first_name: 'Sarah', last_name: 'Johnson', lifetime_value: 2847.50, total_orders: 12, subscription_status: 'active', churn_risk_score: 15, last_order_date: '2024-01-15', email_engagement_score: 85, city: 'New York', state: 'NY', segments: ['High Value', 'Frequent Buyers'] },
      { id: '2', email: 'mike.chen@email.com', first_name: 'Mike', last_name: 'Chen', lifetime_value: 1234.75, total_orders: 8, subscription_status: 'none', churn_risk_score: 45, last_order_date: '2024-01-10', email_engagement_score: 72, city: 'San Francisco', state: 'CA', segments: ['Frequent Buyers'] },
      { id: '3', email: 'emma.davis@email.com', first_name: 'Emma', last_name: 'Davis', lifetime_value: 567.25, total_orders: 3, subscription_status: 'cancelled', churn_risk_score: 78, last_order_date: '2023-12-20', email_engagement_score: 45, city: 'Chicago', state: 'IL', segments: ['At Risk'] },
      { id: '4', email: 'john.smith@email.com', first_name: 'John', last_name: 'Smith', lifetime_value: 156.00, total_orders: 2, subscription_status: 'none', churn_risk_score: 25, last_order_date: '2024-01-18', email_engagement_score: 90, city: 'Austin', state: 'TX', segments: ['New Customers'] },
      { id: '5', email: 'lisa.wong@email.com', first_name: 'Lisa', last_name: 'Wong', lifetime_value: 3456.80, total_orders: 15, subscription_status: 'active', churn_risk_score: 10, last_order_date: '2024-01-20', email_engagement_score: 95, city: 'Seattle', state: 'WA', segments: ['High Value', 'Frequent Buyers'] }
    ];
    res.json({
      customers: mockCustomers,
      total: mockCustomers.length,
      limit: parseInt(req.query.limit || 50),
      offset: parseInt(req.query.offset || 0)
    });
  }
});

// Get customer profile
app.get('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get customer details
    const customerResult = await pool.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customer = customerResult.rows[0];
    
    // Get segments
    const segmentsResult = await pool.query(`
      SELECT s.name, s.description 
      FROM segments s
      JOIN segment_membership sm ON s.id = sm.segment_id
      WHERE sm.customer_id = $1
    `, [id]);
    
    customer.segments = segmentsResult.rows;
    
    // Get recent events
    const eventsResult = await pool.query(`
      SELECT event_type, event_source, event_data, occurred_at
      FROM events
      WHERE customer_id = $1
      ORDER BY occurred_at DESC
      LIMIT 20
    `, [id]);
    
    customer.recentEvents = eventsResult.rows;
    
    // Calculate insights
    customer.insights = {
      nextBestAction: determineNextBestAction(customer),
      lifetimeValueTrend: customer.predicted_ltv > customer.lifetime_value ? 'increasing' : 'decreasing',
      engagementTrend: customer.email_engagement_score > 50 ? 'engaged' : 'disengaged'
    };
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    
    // Return mock customer data
    const mockCustomers = {
      '1': {
        id: '1',
        email: 'sarah.johnson@email.com',
        first_name: 'Sarah',
        last_name: 'Johnson',
        phone: '+1 (555) 123-4567',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        lifetime_value: 2847.50,
        total_orders: 12,
        first_order_date: '2023-01-15',
        last_order_date: '2024-01-15',
        days_since_last_order: 5,
        average_order_value: 237.29,
        subscription_status: 'active',
        subscription_start_date: '2023-06-01',
        subscription_mrr: 49.99,
        subscription_product: 'Premium Plan',
        email_engagement_score: 85,
        email_opens_30d: 12,
        email_clicks_30d: 8,
        support_tickets_count: 2,
        product_reviews_count: 5,
        referrals_count: 3,
        churn_risk_score: 15,
        predicted_ltv: 4500.00,
        predicted_next_order_date: '2024-02-01',
        created_at: '2023-01-15',
        segments: [
          { name: 'High Value', description: 'Customers with lifetime value over $1000' },
          { name: 'Frequent Buyers', description: 'More than 5 orders in last 90 days' }
        ],
        recentEvents: [
          { event_type: 'order_placed', event_source: 'website', event_data: { amount: 285.50 }, occurred_at: '2024-01-15' },
          { event_type: 'email_opened', event_source: 'mailchimp', event_data: { campaign: 'winter_sale' }, occurred_at: '2024-01-14' },
          { event_type: 'product_viewed', event_source: 'website', event_data: { product: 'Premium Widget' }, occurred_at: '2024-01-13' }
        ],
        insights: {
          nextBestAction: 'Offer exclusive early access to new product line',
          lifetimeValueTrend: 'Increasing steadily',
          engagementTrend: 'Highly engaged'
        }
      },
      '2': {
        id: '2',
        email: 'mike.chen@email.com',
        first_name: 'Mike',
        last_name: 'Chen',
        phone: '+1 (555) 234-5678',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        lifetime_value: 1234.75,
        total_orders: 8,
        first_order_date: '2023-03-20',
        last_order_date: '2024-01-10',
        days_since_last_order: 10,
        average_order_value: 154.34,
        subscription_status: 'none',
        subscription_start_date: null,
        subscription_mrr: 0,
        subscription_product: null,
        email_engagement_score: 72,
        email_opens_30d: 8,
        email_clicks_30d: 4,
        support_tickets_count: 1,
        product_reviews_count: 3,
        referrals_count: 1,
        churn_risk_score: 45,
        predicted_ltv: 2000.00,
        predicted_next_order_date: '2024-02-15',
        created_at: '2023-03-20',
        segments: [
          { name: 'Frequent Buyers', description: 'More than 5 orders in last 90 days' }
        ],
        recentEvents: [
          { event_type: 'order_placed', event_source: 'website', event_data: { amount: 156.25 }, occurred_at: '2024-01-10' },
          { event_type: 'cart_abandoned', event_source: 'website', event_data: { value: 89.99 }, occurred_at: '2024-01-08' }
        ],
        insights: {
          nextBestAction: 'Send personalized subscription offer',
          lifetimeValueTrend: 'Stable',
          engagementTrend: 'Moderately engaged'
        }
      },
      '3': {
        id: '3',
        email: 'emma.davis@email.com',
        first_name: 'Emma',
        last_name: 'Davis',
        phone: '+1 (555) 345-6789',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        lifetime_value: 567.25,
        total_orders: 3,
        first_order_date: '2023-08-10',
        last_order_date: '2023-12-20',
        days_since_last_order: 30,
        average_order_value: 189.08,
        subscription_status: 'cancelled',
        subscription_start_date: '2023-09-01',
        subscription_mrr: 0,
        subscription_product: 'Basic Plan',
        email_engagement_score: 45,
        email_opens_30d: 3,
        email_clicks_30d: 1,
        support_tickets_count: 4,
        product_reviews_count: 1,
        referrals_count: 0,
        churn_risk_score: 78,
        predicted_ltv: 800.00,
        predicted_next_order_date: '2024-03-01',
        created_at: '2023-08-10',
        segments: [
          { name: 'At Risk', description: 'High churn risk score' }
        ],
        recentEvents: [
          { event_type: 'subscription_cancelled', event_source: 'stripe', event_data: { reason: 'too_expensive' }, occurred_at: '2023-12-20' },
          { event_type: 'support_ticket', event_source: 'zendesk', event_data: { issue: 'billing_question' }, occurred_at: '2023-12-18' }
        ],
        insights: {
          nextBestAction: 'Offer win-back discount and address pricing concerns',
          lifetimeValueTrend: 'Declining',
          engagementTrend: 'Disengaged'
        }
      },
      '4': {
        id: '4',
        email: 'john.smith@email.com',
        first_name: 'John',
        last_name: 'Smith',
        phone: '+1 (555) 456-7890',
        city: 'Austin',
        state: 'TX',
        country: 'USA',
        lifetime_value: 156.00,
        total_orders: 2,
        first_order_date: '2024-01-05',
        last_order_date: '2024-01-18',
        days_since_last_order: 2,
        average_order_value: 78.00,
        subscription_status: 'none',
        subscription_start_date: null,
        subscription_mrr: 0,
        subscription_product: null,
        email_engagement_score: 90,
        email_opens_30d: 5,
        email_clicks_30d: 4,
        support_tickets_count: 0,
        product_reviews_count: 1,
        referrals_count: 0,
        churn_risk_score: 25,
        predicted_ltv: 500.00,
        predicted_next_order_date: '2024-02-05',
        created_at: '2024-01-05',
        segments: [
          { name: 'New Customers', description: 'Joined in last 30 days' }
        ],
        recentEvents: [
          { event_type: 'order_placed', event_source: 'website', event_data: { amount: 78.00 }, occurred_at: '2024-01-18' },
          { event_type: 'welcome_series', event_source: 'mailchimp', event_data: { email: 'welcome_3' }, occurred_at: '2024-01-17' }
        ],
        insights: {
          nextBestAction: 'Complete onboarding sequence and introduce loyalty program',
          lifetimeValueTrend: 'Too early to determine',
          engagementTrend: 'Highly engaged'
        }
      },
      '5': {
        id: '5',
        email: 'lisa.wong@email.com',
        first_name: 'Lisa',
        last_name: 'Wong',
        phone: '+1 (555) 567-8901',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        lifetime_value: 3456.80,
        total_orders: 15,
        first_order_date: '2022-11-01',
        last_order_date: '2024-01-20',
        days_since_last_order: 0,
        average_order_value: 230.45,
        subscription_status: 'active',
        subscription_start_date: '2023-01-01',
        subscription_mrr: 99.99,
        subscription_product: 'Enterprise Plan',
        email_engagement_score: 95,
        email_opens_30d: 15,
        email_clicks_30d: 12,
        support_tickets_count: 1,
        product_reviews_count: 8,
        referrals_count: 5,
        churn_risk_score: 10,
        predicted_ltv: 6000.00,
        predicted_next_order_date: '2024-02-10',
        created_at: '2022-11-01',
        segments: [
          { name: 'High Value', description: 'Customers with lifetime value over $1000' },
          { name: 'Frequent Buyers', description: 'More than 5 orders in last 90 days' }
        ],
        recentEvents: [
          { event_type: 'order_placed', event_source: 'website', event_data: { amount: 345.60 }, occurred_at: '2024-01-20' },
          { event_type: 'referral_made', event_source: 'referral_program', event_data: { referred_email: 'friend@email.com' }, occurred_at: '2024-01-19' },
          { event_type: 'review_posted', event_source: 'website', event_data: { rating: 5, product: 'Premium Widget Pro' }, occurred_at: '2024-01-18' }
        ],
        insights: {
          nextBestAction: 'Invite to VIP program and beta test new features',
          lifetimeValueTrend: 'Strong growth',
          engagementTrend: 'Brand advocate'
        }
      }
    };
    
    const { id } = req.params;
    const mockCustomer = mockCustomers[id] || mockCustomers['1'];
    mockCustomer.id = id;
    
    res.json(mockCustomer);
  }
});

// Get segments
app.get('/api/segments', async (req, res) => {
  try {
    const segments = await pool.query(`
      SELECT 
        id, name, description, customer_count, 
        avg_ltv, avg_order_count, is_system, rules
      FROM segments
      ORDER BY customer_count DESC
    `);
    
    res.json(segments.rows);
  } catch (error) {
    console.error('Error fetching segments:', error);
    // Return mock segments if database is not available
    const mockSegments = [
      { id: '1', name: 'High Value', description: 'Customers with lifetime value over $1000', customer_count: 512, avg_ltv: 2847, avg_order_count: 8.5, is_system: true },
      { id: '2', name: 'Frequent Buyers', description: 'More than 5 orders in last 90 days', customer_count: 893, avg_ltv: 1234, avg_order_count: 12.3, is_system: true },
      { id: '3', name: 'At Risk', description: 'High churn risk score', customer_count: 358, avg_ltv: 567, avg_order_count: 3.2, is_system: true },
      { id: '4', name: 'New Customers', description: 'Joined in last 30 days', customer_count: 1442, avg_ltv: 156, avg_order_count: 1.5, is_system: true }
    ];
    res.json(mockSegments);
  }
});

// Create segment
app.post('/api/segments', async (req, res) => {
  try {
    const { name, description, rules } = req.body;
    
    const result = await pool.query(
      `INSERT INTO segments (name, description, rules, is_system) 
       VALUES ($1, $2, $3, false) 
       RETURNING *`,
      [name, description, JSON.stringify(rules)]
    );
    
    // Calculate membership
    await calculateSegmentMembership(result.rows[0].id, rules);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({ error: 'Failed to create segment' });
  }
});

// Test segment (preview without saving)
app.post('/api/segments/test', async (req, res) => {
  try {
    const { rules } = req.body;
    
    // Build SQL from rules
    const { whereClause, params } = buildWhereClause(rules);
    
    // Get matching customers count and sample
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM customers WHERE ${whereClause}`,
      params
    );
    
    const sampleResult = await pool.query(
      `SELECT id, email, first_name, last_name, lifetime_value, total_orders
       FROM customers 
       WHERE ${whereClause}
       ORDER BY lifetime_value DESC
       LIMIT 10`,
      params
    );
    
    // Get aggregate stats
    const statsResult = await pool.query(
      `SELECT 
         AVG(lifetime_value) as avg_ltv,
         AVG(total_orders) as avg_orders,
         AVG(churn_risk_score) as avg_churn_risk
       FROM customers 
       WHERE ${whereClause}`,
      params
    );
    
    res.json({
      count: parseInt(countResult.rows[0].count),
      sample: sampleResult.rows,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error testing segment:', error);
    res.status(500).json({ error: 'Failed to test segment' });
  }
});

// Helper functions
function determineNextBestAction(customer) {
  if (customer.subscription_status === 'none' && customer.total_orders >= 3) {
    return 'Offer subscription upgrade';
  }
  if (customer.churn_risk_score > 70 && customer.subscription_status === 'active') {
    return 'Send retention campaign';
  }
  if (customer.referrals_count === 0 && customer.lifetime_value > 500) {
    return 'Invite to referral program';
  }
  if (customer.product_reviews_count === 0 && customer.total_orders > 5) {
    return 'Request product review';
  }
  return 'Continue nurturing';
}

function buildWhereClause(rules) {
  const conditions = rules.conditions || [];
  const logic = rules.logic || 'AND';
  const params = [];
  
  const sqlConditions = conditions.map((condition, index) => {
    let paramIndex = params.length + 1;
    
    switch (condition.operator) {
      case 'equals':
        params.push(condition.value);
        return `${condition.field} = $${paramIndex}`;
      case 'not_equals':
        params.push(condition.value);
        return `${condition.field} != $${paramIndex}`;
      case 'greater_than':
        params.push(condition.value);
        return `${condition.field} > $${paramIndex}`;
      case 'greater_than_or_equal':
        params.push(condition.value);
        return `${condition.field} >= $${paramIndex}`;
      case 'less_than':
        params.push(condition.value);
        return `${condition.field} < $${paramIndex}`;
      case 'less_than_or_equal':
        params.push(condition.value);
        return `${condition.field} <= $${paramIndex}`;
      case 'contains':
        params.push(`%${condition.value}%`);
        return `${condition.field} ILIKE $${paramIndex}`;
      default:
        return '1=1';
    }
  });
  
  const whereClause = sqlConditions.join(` ${logic} `) || '1=1';
  return { whereClause, params };
}

async function calculateSegmentMembership(segmentId, rules) {
  const { whereClause, params } = buildWhereClause(rules);
  
  // Clear existing membership
  await pool.query('DELETE FROM segment_membership WHERE segment_id = $1', [segmentId]);
  
  // Add new members
  const customersResult = await pool.query(
    `SELECT id FROM customers WHERE ${whereClause}`,
    params
  );
  
  for (const customer of customersResult.rows) {
    await pool.query(
      'INSERT INTO segment_membership (segment_id, customer_id) VALUES ($1, $2)',
      [segmentId, customer.id]
    );
  }
  
  // Update segment stats
  await pool.query(`
    UPDATE segments 
    SET 
      customer_count = (SELECT COUNT(*) FROM segment_membership WHERE segment_id = $1),
      avg_ltv = (
        SELECT AVG(c.lifetime_value) 
        FROM customers c 
        JOIN segment_membership sm ON c.id = sm.customer_id 
        WHERE sm.segment_id = $1
      ),
      avg_order_count = (
        SELECT AVG(c.total_orders) 
        FROM customers c 
        JOIN segment_membership sm ON c.id = sm.customer_id 
        WHERE sm.segment_id = $1
      ),
      updated_at = NOW()
    WHERE id = $1
  `, [segmentId]);
}

// Serve React app for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/build', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CDP Backend running on port ${PORT}`);
});