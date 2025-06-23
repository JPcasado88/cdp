const { Pool } = require('pg');
const faker = require('faker');
const { addDays, subDays, format } = require('date-fns');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Customer persona definitions
const personas = {
  vip_subscriber: {
    count: 500,
    ltv_range: [1000, 5000],
    order_frequency_days: [25, 35], // Monthly
    email_engagement: [70, 95],
    churn_risk: [5, 20],
    subscription_rate: 0.95,
    review_rate: 0.7,
    referral_rate: 0.4,
    support_ticket_rate: 0.1
  },
  regular_subscriber: {
    count: 2000,
    ltv_range: [300, 1000],
    order_frequency_days: [45, 75], // Bi-monthly
    email_engagement: [40, 70],
    churn_risk: [20, 50],
    subscription_rate: 0.85,
    review_rate: 0.3,
    referral_rate: 0.15,
    support_ticket_rate: 0.2
  },
  at_risk_subscriber: {
    count: 800,
    ltv_range: [200, 800],
    order_frequency_days: [90, 150],
    email_engagement: [10, 30],
    churn_risk: [60, 90],
    subscription_rate: 1.0, // All are subscribers
    review_rate: 0.1,
    referral_rate: 0.05,
    support_ticket_rate: 0.4 // Higher support tickets
  },
  one_time_buyer: {
    count: 4000,
    ltv_range: [50, 300],
    order_frequency_days: [180, 365],
    email_engagement: [20, 50],
    churn_risk: [30, 60],
    subscription_rate: 0,
    review_rate: 0.15,
    referral_rate: 0.05,
    support_ticket_rate: 0.15
  },
  churned_high_value: {
    count: 200,
    ltv_range: [500, 2000],
    order_frequency_days: [30, 60], // Used to be frequent
    email_engagement: [5, 15], // Now low
    churn_risk: [80, 95],
    subscription_rate: 0, // All cancelled
    review_rate: 0.4,
    referral_rate: 0.2,
    support_ticket_rate: 0.5, // High before churning
    churned_days_ago: [30, 180]
  }
};

// Product catalog for realistic orders
const products = [
  { name: 'Vitamin C Serum', price: 42, category: 'serum' },
  { name: 'Retinol Night Cream', price: 58, category: 'cream' },
  { name: 'Hyaluronic Acid Serum', price: 38, category: 'serum' },
  { name: 'SPF 50 Sunscreen', price: 28, category: 'protection' },
  { name: 'Gentle Cleanser', price: 24, category: 'cleanser' },
  { name: 'Exfoliating Toner', price: 32, category: 'toner' },
  { name: 'Eye Cream', price: 45, category: 'cream' },
  { name: 'Face Mask Set', price: 35, category: 'treatment' },
  { name: 'Moisturizer', price: 48, category: 'cream' },
  { name: 'Lip Treatment', price: 18, category: 'treatment' }
];

// Event types with realistic patterns
const eventPatterns = {
  happy_path: [
    'page_viewed',
    'product_viewed',
    'added_to_cart',
    'checkout_started',
    'order_completed',
    'email_opened',
    'product_reviewed'
  ],
  browse_abandon: [
    'page_viewed',
    'product_viewed',
    'product_viewed',
    'session_ended'
  ],
  cart_abandon: [
    'page_viewed',
    'product_viewed',
    'added_to_cart',
    'checkout_started',
    'session_ended'
  ],
  support_interaction: [
    'order_completed',
    'support_ticket_created',
    'support_ticket_updated',
    'support_ticket_resolved'
  ]
};

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

async function generateCustomer(persona, personaType) {
  const now = new Date();
  const accountAge = randomBetween(30, 730); // 1 month to 2 years
  const createdAt = subDays(now, accountAge);
  
  // Generate basic info
  const customer = {
    email: faker.internet.email().toLowerCase(),
    first_name: faker.name.firstName(),
    last_name: faker.name.lastName(),
    phone: faker.phone.phoneNumber(),
    city: faker.address.city(),
    state: faker.address.stateAbbr(),
    country: 'US',
    created_at: createdAt
  };
  
  // Calculate order history
  const orderCount = Math.ceil(accountAge / randomBetween(...persona.order_frequency_days));
  const orders = [];
  let totalRevenue = 0;
  let lastOrderDate = createdAt;
  
  for (let i = 0; i < orderCount; i++) {
    const daysUntilOrder = randomBetween(...persona.order_frequency_days);
    const orderDate = addDays(lastOrderDate, daysUntilOrder);
    
    if (orderDate > now) break;
    
    // For churned customers, stop orders in the past
    if (personaType === 'churned_high_value') {
      const churnDate = subDays(now, randomBetween(...persona.churned_days_ago));
      if (orderDate > churnDate) break;
    }
    
    // Generate order with 1-3 products
    const orderProducts = [];
    const productCount = randomBetween(1, 3);
    let orderTotal = 0;
    
    for (let j = 0; j < productCount; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      orderProducts.push(product);
      orderTotal += product.price;
    }
    
    orders.push({
      date: orderDate,
      total: orderTotal,
      products: orderProducts
    });
    
    totalRevenue += orderTotal;
    lastOrderDate = orderDate;
  }
  
  // Calculate customer metrics
  customer.lifetime_value = totalRevenue;
  customer.total_orders = orders.length;
  customer.first_order_date = orders.length > 0 ? orders[0].date : null;
  customer.last_order_date = orders.length > 0 ? orders[orders.length - 1].date : null;
  customer.days_since_last_order = customer.last_order_date 
    ? Math.floor((now - customer.last_order_date) / (1000 * 60 * 60 * 24))
    : null;
  customer.average_order_value = orders.length > 0 ? totalRevenue / orders.length : 0;
  
  // Set subscription status
  if (persona.subscription_rate > 0 && Math.random() < persona.subscription_rate) {
    customer.subscription_status = personaType === 'churned_high_value' ? 'cancelled' : 'active';
    customer.subscription_start_date = orders.length > 1 ? orders[1].date : createdAt;
    customer.subscription_mrr = randomBetween(35, 85);
    customer.subscription_product = 'Monthly Beauty Box';
  } else {
    customer.subscription_status = 'none';
  }
  
  // Set engagement metrics
  customer.email_engagement_score = randomBetween(...persona.email_engagement);
  customer.email_opens_30d = Math.floor(customer.email_engagement_score / 10);
  customer.email_clicks_30d = Math.floor(customer.email_opens_30d * 0.3);
  
  // Set other engagement metrics
  customer.support_tickets_count = Math.random() < persona.support_ticket_rate 
    ? randomBetween(1, 5) : 0;
  customer.product_reviews_count = Math.random() < persona.review_rate 
    ? randomBetween(1, orders.length) : 0;
  customer.referrals_count = Math.random() < persona.referral_rate 
    ? randomBetween(1, 5) : 0;
  
  // Set predictive scores
  customer.churn_risk_score = randomBetween(...persona.churn_risk);
  
  // Adjust churn risk based on recent behavior
  if (customer.days_since_last_order > 90) {
    customer.churn_risk_score = Math.min(95, customer.churn_risk_score + 20);
  }
  if (customer.email_engagement_score < 20) {
    customer.churn_risk_score = Math.min(95, customer.churn_risk_score + 10);
  }
  
  // Predict lifetime value (simple model)
  const remainingLifetimeMonths = customer.churn_risk_score < 50 ? 24 : 6;
  const monthlyValue = customer.average_order_value * (30 / randomBetween(...persona.order_frequency_days));
  customer.predicted_ltv = customer.lifetime_value + (monthlyValue * remainingLifetimeMonths);
  
  // Predict next order date
  if (customer.subscription_status === 'active') {
    customer.predicted_next_order_date = addDays(customer.last_order_date || now, 30);
  } else if (customer.last_order_date) {
    const avgDaysBetweenOrders = customer.days_since_last_order / Math.max(1, customer.total_orders - 1);
    customer.predicted_next_order_date = addDays(customer.last_order_date, Math.floor(avgDaysBetweenOrders));
  }
  
  return { customer, orders };
}

async function generateEvents(customerId, customer, orders) {
  const events = [];
  
  // Generate order events
  for (const order of orders) {
    // Add browsing events before order
    const browsingEvents = randomBetween(3, 8);
    for (let i = 0; i < browsingEvents; i++) {
      events.push({
        customer_id: customerId,
        event_type: 'product_viewed',
        event_source: 'website',
        event_data: {
          product: products[Math.floor(Math.random() * products.length)].name,
          session_id: faker.datatype.uuid()
        },
        occurred_at: subDays(order.date, randomBetween(1, 7))
      });
    }
    
    // Add order event
    events.push({
      customer_id: customerId,
      event_type: 'order_completed',
      event_source: 'shopify',
      event_data: {
        order_id: faker.datatype.uuid(),
        total: order.total,
        products: order.products,
        payment_method: Math.random() > 0.3 ? 'credit_card' : 'paypal'
      },
      occurred_at: order.date
    });
    
    // Add post-order events
    if (Math.random() > 0.5) {
      events.push({
        customer_id: customerId,
        event_type: 'email_opened',
        event_source: 'klaviyo',
        event_data: {
          campaign: 'order_confirmation',
          subject: 'Your GlowBeauty order is confirmed!'
        },
        occurred_at: addDays(order.date, 1)
      });
    }
  }
  
  // Add email engagement events
  const emailCount = randomBetween(10, 50);
  for (let i = 0; i < emailCount; i++) {
    const emailDate = subDays(new Date(), randomBetween(1, 180));
    events.push({
      customer_id: customerId,
      event_type: 'email_opened',
      event_source: 'klaviyo',
      event_data: {
        campaign: faker.random.arrayElement(['weekly_newsletter', 'product_launch', 'seasonal_sale']),
        subject: faker.company.catchPhrase()
      },
      occurred_at: emailDate
    });
    
    // Some emails get clicked
    if (Math.random() < 0.3) {
      events.push({
        customer_id: customerId,
        event_type: 'email_clicked',
        event_source: 'klaviyo',
        event_data: {
          link: faker.internet.url()
        },
        occurred_at: addDays(emailDate, randomFloat(0, 1))
      });
    }
  }
  
  // Add support tickets
  if (customer.support_tickets_count > 0) {
    for (let i = 0; i < customer.support_tickets_count; i++) {
      const ticketDate = subDays(new Date(), randomBetween(1, 365));
      events.push({
        customer_id: customerId,
        event_type: 'support_ticket_created',
        event_source: 'gorgias',
        event_data: {
          ticket_id: faker.datatype.uuid(),
          subject: faker.random.arrayElement([
            'Order status inquiry',
            'Product question',
            'Return request',
            'Subscription modification'
          ]),
          priority: faker.random.arrayElement(['low', 'medium', 'high'])
        },
        occurred_at: ticketDate
      });
    }
  }
  
  // Add reviews
  if (customer.product_reviews_count > 0) {
    const reviewableOrders = orders.slice(-customer.product_reviews_count);
    for (const order of reviewableOrders) {
      events.push({
        customer_id: customerId,
        event_type: 'product_reviewed',
        event_source: 'shopify',
        event_data: {
          product: order.products[0].name,
          rating: randomBetween(3, 5),
          title: faker.lorem.sentence(5)
        },
        occurred_at: addDays(order.date, randomBetween(7, 30))
      });
    }
  }
  
  return events;
}

async function insertCustomer(customerData) {
  const { customer } = customerData;
  const query = `
    INSERT INTO customers (
      email, first_name, last_name, phone, city, state, country,
      lifetime_value, total_orders, first_order_date, last_order_date,
      days_since_last_order, average_order_value, subscription_status,
      subscription_start_date, subscription_mrr, subscription_product,
      email_engagement_score, email_opens_30d, email_clicks_30d,
      support_tickets_count, product_reviews_count, referrals_count,
      churn_risk_score, predicted_ltv, predicted_next_order_date,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
              $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, 
              $25, $26, $27)
    RETURNING id
  `;
  
  const values = [
    customer.email, customer.first_name, customer.last_name, customer.phone,
    customer.city, customer.state, customer.country, customer.lifetime_value,
    customer.total_orders, customer.first_order_date, customer.last_order_date,
    customer.days_since_last_order, customer.average_order_value,
    customer.subscription_status, customer.subscription_start_date,
    customer.subscription_mrr, customer.subscription_product,
    customer.email_engagement_score, customer.email_opens_30d,
    customer.email_clicks_30d, customer.support_tickets_count,
    customer.product_reviews_count, customer.referrals_count,
    customer.churn_risk_score, customer.predicted_ltv,
    customer.predicted_next_order_date, customer.created_at
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

async function insertEvents(events) {
  for (const event of events) {
    const query = `
      INSERT INTO events (customer_id, event_type, event_source, event_data, occurred_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(query, [
      event.customer_id,
      event.event_type,
      event.event_source,
      JSON.stringify(event.event_data),
      event.occurred_at
    ]);
  }
}

async function updateSegmentMembership() {
  console.log('Calculating segment memberships...');
  
  // Get all segments
  const segments = await pool.query('SELECT * FROM segments WHERE is_system = true');
  
  for (const segment of segments.rows) {
    console.log(`Processing segment: ${segment.name}`);
    
    // Build SQL conditions based on rules
    let whereClause = '';
    const conditions = segment.rules.conditions;
    
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      let sqlCondition = '';
      
      switch (condition.operator) {
        case 'equals':
          sqlCondition = `${condition.field} = '${condition.value}'`;
          break;
        case 'greater_than':
          sqlCondition = `${condition.field} > ${condition.value}`;
          break;
        case 'greater_than_or_equal':
          sqlCondition = `${condition.field} >= ${condition.value}`;
          break;
        case 'less_than':
          sqlCondition = `${condition.field} < ${condition.value}`;
          break;
        default:
          continue;
      }
      
      if (i > 0) whereClause += ' AND ';
      whereClause += sqlCondition;
    }
    
    // Find matching customers
    const matchingCustomers = await pool.query(
      `SELECT id FROM customers WHERE ${whereClause}`
    );
    
    // Insert memberships
    for (const customer of matchingCustomers.rows) {
      await pool.query(
        `INSERT INTO segment_membership (segment_id, customer_id) 
         VALUES ($1, $2) 
         ON CONFLICT DO NOTHING`,
        [segment.id, customer.id]
      );
    }
    
    // Update segment stats
    await pool.query(
      `UPDATE segments 
       SET customer_count = (
         SELECT COUNT(*) FROM segment_membership WHERE segment_id = $1
       ),
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
       WHERE id = $1`,
      [segment.id]
    );
  }
}

async function generateData() {
  console.log('Starting data generation...');
  
  try {
    // Generate customers for each persona
    for (const [personaType, persona] of Object.entries(personas)) {
      console.log(`Generating ${persona.count} ${personaType} customers...`);
      
      for (let i = 0; i < persona.count; i++) {
        try {
          // Generate customer data
          const customerData = await generateCustomer(persona, personaType);
          
          // Insert customer
          const customerId = await insertCustomer(customerData);
          
          // Generate and insert events
          const events = await generateEvents(customerId, customerData.customer, customerData.orders);
          await insertEvents(events);
          
          if ((i + 1) % 100 === 0) {
            console.log(`  Generated ${i + 1}/${persona.count} ${personaType} customers`);
          }
        } catch (error) {
          console.error(`Error generating customer: ${error.message}`);
        }
      }
    }
    
    // Update segment memberships
    await updateSegmentMembership();
    
    console.log('Data generation complete!');
    
    // Print summary
    const customerCount = await pool.query('SELECT COUNT(*) FROM customers');
    const eventCount = await pool.query('SELECT COUNT(*) FROM events');
    const segmentStats = await pool.query(`
      SELECT name, customer_count, avg_ltv 
      FROM segments 
      WHERE is_system = true 
      ORDER BY customer_count DESC
    `);
    
    console.log('\n=== Summary ===');
    console.log(`Total customers: ${customerCount.rows[0].count}`);
    console.log(`Total events: ${eventCount.rows[0].count}`);
    console.log('\nSegment breakdown:');
    segmentStats.rows.forEach(segment => {
      console.log(`  ${segment.name}: ${segment.customer_count} customers (avg LTV: $${Math.round(segment.avg_ltv)})`);
    });
    
  } catch (error) {
    console.error('Error generating data:', error);
  } finally {
    await pool.end();
  }
}

// Run the generator
generateData();