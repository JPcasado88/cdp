const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Get dashboard metrics
app.get('/api/metrics/overview', async (req, res) => {
  try {
    const metrics = {};
    
    // Total customers
    const totalCustomers = await pool.query('SELECT COUNT(*) FROM customers');
    metrics.totalCustomers = parseInt(totalCustomers.rows[0].count);
    
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
    res.status(500).json({ error: 'Failed to search customers' });
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
    res.status(500).json({ error: 'Failed to fetch customer' });
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
    res.status(500).json({ error: 'Failed to fetch segments' });
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CDP Backend running on port ${PORT}`);
});