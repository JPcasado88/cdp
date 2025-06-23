# Database Setup for CDP

## Using Real Data Instead of Mock Data

The application currently uses mock data when no database is connected. To use real data with generated customers:

### Option 1: Add PostgreSQL on Railway (Recommended)

1. **In your Railway project dashboard:**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically create a database and set the `DATABASE_URL` environment variable

2. **Initialize the database:**
   - Once deployed, open the Railway shell or run locally with the DATABASE_URL:
   ```bash
   # Set the DATABASE_URL from Railway
   export DATABASE_URL="your-railway-postgres-url"
   
   # Run initialization
   cd cdp-lite/backend
   npm run init-db
   npm run generate-data
   ```

### Option 2: Use Local PostgreSQL

1. **Install PostgreSQL locally**
2. **Create a database:**
   ```bash
   createdb cdp_db
   ```

3. **Set environment variables:**
   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cdp_db"
   ```

4. **Initialize with sample data:**
   ```bash
   cd cdp-lite/backend
   npm run init-db      # Creates tables
   npm run generate-data # Generates 1000+ customers with realistic data
   ```

### What the Generate Data Script Creates:

- **1000+ customers** with realistic names, emails, and demographics
- **Order history** with varying frequencies and values
- **Subscription data** (active, cancelled, none)
- **Email engagement metrics**
- **Support ticket history**
- **Product reviews and ratings**
- **Referral data**
- **Churn risk scores** calculated based on behavior
- **Customer segments** automatically assigned based on rules

### Database Schema Includes:

- `customers` - Core customer data
- `events` - Customer activity tracking
- `segments` - Dynamic customer segments
- `segment_membership` - Which customers belong to which segments
- `orders` - Order history
- `subscriptions` - Subscription details

The generated data creates a realistic customer database that demonstrates:
- Customer lifecycle from acquisition to retention
- Various customer health states
- Different engagement levels
- Revenue patterns
- Behavioral segments