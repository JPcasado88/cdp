const { Pool } = require('pg');
const faker = require('faker');

async function setupDatabase(pool) {
  try {
    console.log('Starting database setup...');
    
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(50),
        city VARCHAR(100),
        state VARCHAR(50),
        country VARCHAR(50),
        lifetime_value DECIMAL(10,2) DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        first_order_date DATE,
        last_order_date DATE,
        days_since_last_order INTEGER,
        average_order_value DECIMAL(10,2),
        subscription_status VARCHAR(50) DEFAULT 'none',
        subscription_start_date DATE,
        subscription_mrr DECIMAL(10,2) DEFAULT 0,
        subscription_product VARCHAR(100),
        email_engagement_score INTEGER DEFAULT 50,
        email_opens_30d INTEGER DEFAULT 0,
        email_clicks_30d INTEGER DEFAULT 0,
        support_tickets_count INTEGER DEFAULT 0,
        product_reviews_count INTEGER DEFAULT 0,
        referrals_count INTEGER DEFAULT 0,
        churn_risk_score INTEGER DEFAULT 50,
        predicted_ltv DECIMAL(10,2),
        predicted_next_order_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS segments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        rules JSONB,
        customer_count INTEGER DEFAULT 0,
        avg_ltv DECIMAL(10,2),
        avg_order_count DECIMAL(10,2),
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS segment_membership (
        customer_id INTEGER REFERENCES customers(id),
        segment_id INTEGER REFERENCES segments(id),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (customer_id, segment_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        event_type VARCHAR(100),
        event_source VARCHAR(100),
        event_data JSONB,
        occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Tables created successfully');

    // Create default segments
    const segments = [
      {
        name: 'High Value',
        description: 'Customers with lifetime value over $1000',
        rules: { lifetime_value: { gt: 1000 } },
        is_system: true
      },
      {
        name: 'At Risk',
        description: 'High churn risk score',
        rules: { churn_risk_score: { gt: 70 } },
        is_system: true
      },
      {
        name: 'Frequent Buyers',
        description: 'More than 5 orders in last 90 days',
        rules: { orders_90d: { gt: 5 } },
        is_system: true
      },
      {
        name: 'New Customers',
        description: 'Joined in last 30 days',
        rules: { days_since_join: { lt: 30 } },
        is_system: true
      }
    ];

    for (const segment of segments) {
      await pool.query(
        `INSERT INTO segments (name, description, rules, is_system) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (name) DO NOTHING`,
        [segment.name, segment.description, JSON.stringify(segment.rules), segment.is_system]
      );
    }

    console.log('Segments created successfully');

    // Check if we already have customers
    const customerCount = await pool.query('SELECT COUNT(*) FROM customers');
    if (parseInt(customerCount.rows[0].count) > 0) {
      return { success: true, message: 'Database already initialized with data' };
    }

    // Generate sample customers
    console.log('Generating sample customers...');
    const numCustomers = 100; // Start with 100 for faster setup

    for (let i = 0; i < numCustomers; i++) {
      const firstName = faker.name.firstName();
      const lastName = faker.name.lastName();
      const email = faker.internet.email(firstName, lastName).toLowerCase();
      
      // Random customer attributes
      const totalOrders = faker.datatype.number({ min: 0, max: 50 });
      const avgOrderValue = faker.datatype.float({ min: 20, max: 500, precision: 0.01 });
      const lifetimeValue = totalOrders * avgOrderValue;
      
      const subscriptionStatus = faker.random.arrayElement(['active', 'cancelled', 'none', 'none', 'none']);
      const subscriptionMrr = subscriptionStatus === 'active' ? 
        faker.random.arrayElement([29.99, 49.99, 99.99]) : 0;
      
      const churnRiskScore = subscriptionStatus === 'cancelled' ? 
        faker.datatype.number({ min: 60, max: 95 }) :
        faker.datatype.number({ min: 5, max: 80 });

      await pool.query(`
        INSERT INTO customers (
          email, first_name, last_name, phone, city, state, country,
          lifetime_value, total_orders, average_order_value,
          subscription_status, subscription_mrr, email_engagement_score,
          support_tickets_count, product_reviews_count, referrals_count,
          churn_risk_score, predicted_ltv, first_order_date, last_order_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `, [
        email, firstName, lastName,
        faker.phone.phoneNumber(),
        faker.address.city(),
        faker.address.stateAbbr(),
        'USA',
        lifetimeValue,
        totalOrders,
        avgOrderValue,
        subscriptionStatus,
        subscriptionMrr,
        faker.datatype.number({ min: 0, max: 100 }),
        faker.datatype.number({ min: 0, max: 10 }),
        faker.datatype.number({ min: 0, max: totalOrders }),
        faker.datatype.number({ min: 0, max: 5 }),
        churnRiskScore,
        lifetimeValue * 1.5,
        faker.date.past(2),
        faker.date.recent(90)
      ]);
    }

    console.log(`Generated ${numCustomers} customers`);

    // Assign customers to segments
    await pool.query(`
      INSERT INTO segment_membership (customer_id, segment_id)
      SELECT c.id, s.id
      FROM customers c, segments s
      WHERE s.name = 'High Value' AND c.lifetime_value > 1000
      ON CONFLICT DO NOTHING
    `);

    await pool.query(`
      INSERT INTO segment_membership (customer_id, segment_id)
      SELECT c.id, s.id
      FROM customers c, segments s
      WHERE s.name = 'At Risk' AND c.churn_risk_score > 70
      ON CONFLICT DO NOTHING
    `);

    // Update segment counts
    await pool.query(`
      UPDATE segments s
      SET customer_count = (
        SELECT COUNT(*) FROM segment_membership sm WHERE sm.segment_id = s.id
      )
    `);

    console.log('Database setup completed successfully!');
    return { success: true, message: 'Database initialized with sample data' };

  } catch (error) {
    console.error('Setup error:', error);
    throw error;
  }
}

module.exports = setupDatabase;