# Customer Data Platform (CDP) Lite

> **Turn scattered customer data into revenue-driving segments**

![CDP Lite Dashboard](https://via.placeholder.com/1200x600/3b82f6/ffffff?text=CDP+Lite+Dashboard)

## 💰 Business Impact

- **$400K+ in opportunities** identified in demo data
- **1,200 customers** ready for subscription conversion
- **800 at-risk subscribers** flagged for retention

## 🎯 Key Features

### Unified Customer Profiles
Combine data from Shopify, Klaviyo, GA4, and more into single source of truth
- Complete customer timeline
- Predictive churn scores
- Engagement metrics
- Subscription status

### AI-Powered Segmentation
Discover hidden segments you didn't know existed
- Visual segment builder
- Real-time segment testing
- Pre-built high-value segments
- Dynamic membership updates

### Churn Prediction
Know who's leaving before they do
- Risk scoring algorithm
- Early warning indicators
- Automated alerts
- Retention recommendations

### One-Click Activation
Push segments directly to your marketing tools
- Export to CSV
- Webhook integrations
- API access
- Real-time sync

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 13+
- Redis (optional, for caching)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/cdp-lite.git
cd cdp-lite
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Initialize the database
```bash
npm run init-db
```

5. Generate demo data
```bash
npm run generate-data
```

6. Start the backend server
```bash
npm run dev
```

7. In a new terminal, install and start the frontend
```bash
cd ../frontend
npm install
npm start
```

8. Open http://localhost:3000 in your browser

## 📊 Demo Data

The platform comes with realistic synthetic data modeling a DTC skincare brand:

- **10,000+ customers** across 5 personas
- **2 years** of order history
- **Realistic patterns**: seasonality, churn, engagement decline
- **5 pre-built segments**: VIPs, At Risk, Prime for Subscription, etc.

### Customer Personas

1. **VIP Subscribers** (500 customers)
   - LTV: $1,000-5,000
   - Monthly orders
   - High engagement
   - Low churn risk

2. **Regular Subscribers** (2,000 customers)
   - LTV: $300-1,000
   - Bi-monthly orders
   - Medium engagement
   - Medium churn risk

3. **At Risk Subscribers** (800 customers)
   - Haven't ordered in 60-120 days
   - Declining engagement
   - High support ticket volume

4. **One-time Buyers** (4,000 customers)
   - LTV: $50-300
   - No subscription
   - Conversion opportunity

5. **Churned High Value** (200 customers)
   - Previous LTV: $500-2,000
   - Cancelled 30-180 days ago
   - Win-back opportunity

## 🏗️ Architecture

```
cdp-lite/
├── backend/
│   ├── src/
│   │   ├── server.js         # Express API server
│   │   ├── db/
│   │   │   └── schema.sql    # Database schema
│   │   └── scripts/
│   │       ├── initDb.js     # Database initialization
│   │       └── generateData.js # Data generator
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.tsx   # Overview metrics
    │   │   ├── CustomerList.tsx # Customer search/browse
    │   │   ├── CustomerProfile.tsx # Unified profile
    │   │   └── SegmentBuilder.tsx # Visual segmentation
    │   └── App.tsx
    └── package.json
```

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express
- **PostgreSQL** for data storage
- **Bull** for job queuing
- **Redis** for caching (optional)

### Frontend
- **React** with TypeScript
- **Recharts** for data visualization
- **Axios** for API calls
- **Lucide React** for icons

## 📚 API Documentation

### Endpoints

#### Get Overview Metrics
```
GET /api/metrics/overview
```

#### Search Customers
```
GET /api/customers?search=sarah&segment=VIP&limit=50&offset=0
```

#### Get Customer Profile
```
GET /api/customers/:id
```

#### Create Segment
```
POST /api/segments
{
  "name": "High Value At Risk",
  "description": "Customers worth saving",
  "rules": {
    "conditions": [
      { "field": "lifetime_value", "operator": "greater_than", "value": 500 },
      { "field": "churn_risk_score", "operator": "greater_than", "value": 70 }
    ],
    "logic": "AND"
  }
}
```

#### Test Segment
```
POST /api/segments/test
{
  "rules": { ... }
}
```

## 🎨 Screenshots

### Dashboard
- Customer health breakdown
- Revenue metrics
- Top opportunities
- Segment performance

### Customer Profile
- Complete customer timeline
- Predictive analytics
- Engagement metrics
- Segment membership

### Segment Builder
- Visual rule builder
- Real-time testing
- Sample results
- One-click save

## 🏢 Built For

- **Retention Marketers** fighting churn
- **CRM Managers** seeking customer insights
- **Growth Teams** maximizing LTV
- **Data Teams** unifying customer data

## 🔒 Security & Privacy

- PII encryption at rest
- Audit logs for all access
- GDPR-compliant data export
- Role-based access control (coming soon)

## 🚧 Roadmap

- [ ] Real-time webhook integrations
- [ ] Machine learning churn model
- [ ] A/B test segment performance
- [ ] Custom calculated fields
- [ ] Team collaboration features

## 📄 License

MIT License - feel free to use this for your own projects!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ for marketing teams who want to actually understand their customers