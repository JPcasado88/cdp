const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('Database initialized successfully!');
    
    // Create default segments
    await createDefaultSegments();
    
    console.log('Default segments created!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

async function createDefaultSegments() {
  const defaultSegments = [
    {
      name: 'VIP Customers',
      description: 'Customers with lifetime value over $1000',
      rules: {
        conditions: [
          { field: 'lifetime_value', operator: 'greater_than', value: 1000 }
        ]
      },
      is_system: true
    },
    {
      name: 'At Risk Subscribers',
      description: 'Active subscribers showing signs of churn',
      rules: {
        conditions: [
          { field: 'subscription_status', operator: 'equals', value: 'active' },
          { field: 'days_since_last_order', operator: 'greater_than', value: 60 },
          { field: 'email_engagement_score', operator: 'less_than', value: 20 }
        ],
        logic: 'AND'
      },
      is_system: true
    },
    {
      name: 'Prime for Subscription',
      description: 'Regular buyers who should convert to subscription',
      rules: {
        conditions: [
          { field: 'subscription_status', operator: 'equals', value: 'none' },
          { field: 'total_orders', operator: 'greater_than_or_equal', value: 3 },
          { field: 'average_order_value', operator: 'greater_than', value: 75 }
        ],
        logic: 'AND'
      },
      is_system: true
    },
    {
      name: 'Churned High Value',
      description: 'Previously high-value customers who churned',
      rules: {
        conditions: [
          { field: 'subscription_status', operator: 'equals', value: 'cancelled' },
          { field: 'lifetime_value', operator: 'greater_than', value: 500 }
        ],
        logic: 'AND'
      },
      is_system: true
    },
    {
      name: 'Brand Advocates',
      description: 'Customers who refer others and leave reviews',
      rules: {
        conditions: [
          { field: 'referrals_count', operator: 'greater_than', value: 0 },
          { field: 'product_reviews_count', operator: 'greater_than', value: 1 }
        ],
        logic: 'AND'
      },
      is_system: true
    }
  ];
  
  for (const segment of defaultSegments) {
    await pool.query(
      `INSERT INTO segments (name, description, rules, is_system) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (name) DO NOTHING`,
      [segment.name, segment.description, JSON.stringify(segment.rules), segment.is_system]
    );
  }
}

initDatabase();