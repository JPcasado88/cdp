-- Customer Data Platform Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS segment_membership CASCADE;
DROP TABLE IF EXISTS segments CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;

-- Create customers table (unified profile)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    
    -- Calculated fields
    lifetime_value DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    first_order_date DATE,
    last_order_date DATE,
    days_since_last_order INTEGER,
    average_order_value DECIMAL(10,2) DEFAULT 0,
    
    -- Subscription data
    subscription_status VARCHAR(50), -- active, cancelled, paused, none
    subscription_start_date DATE,
    subscription_mrr DECIMAL(10,2),
    subscription_product VARCHAR(200),
    
    -- Engagement scores
    email_engagement_score INTEGER DEFAULT 50, -- 0-100
    email_opens_30d INTEGER DEFAULT 0,
    email_clicks_30d INTEGER DEFAULT 0,
    support_tickets_count INTEGER DEFAULT 0,
    product_reviews_count INTEGER DEFAULT 0,
    referrals_count INTEGER DEFAULT 0,
    
    -- Predictive
    churn_risk_score INTEGER DEFAULT 50, -- 0-100
    predicted_ltv DECIMAL(10,2),
    predicted_next_order_date DATE,
    
    -- Location
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    
    -- Meta
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create events table (all customer touchpoints)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- order_placed, email_opened, ticket_created, etc
    event_source VARCHAR(50) NOT NULL, -- shopify, klaviyo, gorgias, etc
    event_data JSONB,
    occurred_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create segments table
CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    rules JSONB NOT NULL, -- Segment definition
    customer_count INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE, -- System vs user-created
    avg_ltv DECIMAL(10,2),
    avg_order_count DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create segment membership table
CREATE TABLE segment_membership (
    segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (segment_id, customer_id)
);

-- Create sync logs table
CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Create indexes for performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_ltv ON customers(lifetime_value DESC);
CREATE INDEX idx_customers_churn ON customers(churn_risk_score DESC);
CREATE INDEX idx_events_customer ON events(customer_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_occurred ON events(occurred_at DESC);
CREATE INDEX idx_segment_membership_customer ON segment_membership(customer_id);