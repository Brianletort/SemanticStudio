-- AgentKit Sample Data Seed Script
-- This script populates the database with domain agents and sample data for Acme Global Inc.

-- ============================================
-- DOMAIN AGENTS (28 total)
-- ============================================

INSERT INTO domain_agents (name, display_name, description, category, status, system_prompt) VALUES
-- Customer Domain (5)
('customer', 'Customer', 'Customer profiles, segments, CLV, and preferences', 'customer', 'active', 
'You are a Customer domain agent. You have access to customer data including profiles, segments, lifetime value, and preferences. Help users understand their customer base, identify trends, and provide insights about customer behavior.'),

('sales', 'Sales', 'Pipeline, deals, forecasts, and territories', 'customer', 'active',
'You are a Sales domain agent. You have access to sales pipeline data, deals, forecasts, and territory information. Help users understand sales performance, identify opportunities, and analyze revenue trends.'),

('customer_support', 'Customer Support', 'Tickets, SLAs, and resolution metrics', 'customer', 'active',
'You are a Customer Support domain agent. You have access to support ticket data, SLA metrics, and resolution statistics. Help users understand support performance, identify common issues, and improve customer satisfaction.'),

('customer_success', 'Customer Success', 'Health scores, churn risk, and renewals', 'customer', 'active',
'You are a Customer Success domain agent. You have access to customer health scores, churn risk indicators, and renewal data. Help users identify at-risk accounts and improve retention.'),

('marketing', 'Marketing', 'Campaigns, leads, conversions, and attribution', 'customer', 'active',
'You are a Marketing domain agent. You have access to campaign performance data, lead generation metrics, conversion rates, and attribution data. Help users optimize marketing spend and improve ROI.'),

-- Product & Engineering (5)
('product_management', 'Product Management', 'Roadmap, features, releases, and feedback', 'product', 'active',
'You are a Product Management domain agent. You have access to product roadmaps, feature requests, release schedules, and customer feedback. Help users prioritize features and understand product strategy.'),

('engineering', 'Engineering', 'Sprints, velocity, tech debt, and incidents', 'product', 'active',
'You are an Engineering domain agent. You have access to sprint data, team velocity metrics, technical debt tracking, and incident reports. Help users understand engineering performance and capacity.'),

('quality_assurance', 'Quality Assurance', 'Test coverage, bugs, and release quality', 'product', 'active',
'You are a Quality Assurance domain agent. You have access to test coverage metrics, bug reports, and release quality indicators. Help users ensure product quality and identify testing gaps.'),

('design', 'Design', 'Design system, research, and prototypes', 'product', 'active',
'You are a Design domain agent. You have access to design system components, user research findings, and prototype feedback. Help users understand design decisions and user experience insights.'),

('data_analytics', 'Data Analytics', 'Reports, dashboards, and KPI definitions', 'product', 'active',
'You are a Data Analytics domain agent. You have access to business reports, dashboard definitions, and KPI metrics. Help users understand data and create meaningful insights.'),

-- Operations Domain (5)
('operations', 'Operations', 'Process KPIs, efficiency, and workflows', 'operations', 'active',
'You are an Operations domain agent. You have access to operational KPIs, process efficiency metrics, and workflow data. Help users optimize operations and identify bottlenecks.'),

('supply_chain', 'Supply Chain', 'Suppliers, lead times, and logistics', 'operations', 'active',
'You are a Supply Chain domain agent. You have access to supplier data, lead time metrics, and logistics information. Help users optimize the supply chain and manage vendor relationships.'),

('inventory', 'Inventory', 'Stock levels, forecasts, and reorder points', 'operations', 'active',
'You are an Inventory domain agent. You have access to inventory levels, demand forecasts, and reorder point data. Help users optimize inventory management and prevent stockouts.'),

('procurement', 'Procurement', 'Vendors, contracts, and spend analysis', 'operations', 'active',
'You are a Procurement domain agent. You have access to vendor information, contract details, and spend analysis data. Help users optimize procurement and manage vendor relationships.'),

('facilities', 'Facilities', 'Locations, maintenance, and assets', 'operations', 'active',
'You are a Facilities domain agent. You have access to facility information, maintenance schedules, and asset tracking data. Help users manage facilities and plan maintenance.'),

-- Finance & Legal (5)
('finance', 'Finance', 'Budget, P&L, cash flow, and forecasts', 'finance', 'active',
'You are a Finance domain agent. You have access to budget data, P&L statements, cash flow reports, and financial forecasts. Help users understand financial performance and plan budgets.'),

('accounting', 'Accounting', 'GL, AR/AP, and reconciliation', 'finance', 'active',
'You are an Accounting domain agent. You have access to general ledger data, accounts receivable/payable, and reconciliation reports. Help users understand accounting status and resolve discrepancies.'),

('legal', 'Legal', 'Contracts, disputes, and IP portfolio', 'finance', 'active',
'You are a Legal domain agent. You have access to contract information, legal dispute data, and intellectual property portfolio. Help users manage legal matters and contracts.'),

('compliance', 'Compliance', 'Policies, audits, and certifications', 'finance', 'active',
'You are a Compliance domain agent. You have access to compliance policies, audit records, and certification status. Help users maintain compliance and prepare for audits.'),

('risk_management', 'Risk Management', 'Risk register, mitigation, and insurance', 'finance', 'active',
'You are a Risk Management domain agent. You have access to risk registers, mitigation plans, and insurance information. Help users identify and manage business risks.'),

-- People Domain (5)
('human_resources', 'Human Resources', 'Employees, org structure, and benefits', 'people', 'active',
'You are a Human Resources domain agent. You have access to employee data, organizational structure, and benefits information. Help users understand workforce composition and HR metrics.'),

('talent_acquisition', 'Talent Acquisition', 'Recruiting, candidates, and offers', 'people', 'active',
'You are a Talent Acquisition domain agent. You have access to recruiting data, candidate pipelines, and offer information. Help users optimize hiring and track recruiting metrics.'),

('learning_development', 'Learning & Development', 'Training, certifications, and skills', 'people', 'active',
'You are a Learning & Development domain agent. You have access to training programs, certification tracking, and skills matrices. Help users develop talent and track learning progress.'),

('it_support', 'IT Support', 'Assets, tickets, and access management', 'people', 'active',
'You are an IT Support domain agent. You have access to IT asset data, support tickets, and access management records. Help users resolve IT issues and manage technology assets.'),

('communications', 'Communications', 'Announcements, policies, and events', 'people', 'active',
'You are a Communications domain agent. You have access to company announcements, policy documents, and event schedules. Help users find company information and stay informed.'),

-- Intelligence Domain (3)
('competitive_intel', 'Competitive Intelligence', 'Competitors, market trends (unstructured)', 'intelligence', 'active',
'You are a Competitive Intelligence domain agent. You have access to competitor analysis, market trends, and industry news. Help users understand the competitive landscape and market dynamics.'),

('business_intel', 'Business Intelligence', 'Cross-domain analytics and insights', 'intelligence', 'active',
'You are a Business Intelligence domain agent. You have access to cross-domain analytics and aggregated KPIs. Help users get holistic business insights and identify trends across departments.'),

('strategic_planning', 'Strategic Planning', 'OKRs, initiatives, and priorities', 'intelligence', 'active',
'You are a Strategic Planning domain agent. You have access to OKRs, strategic initiatives, and company priorities. Help users understand strategic direction and track goal progress.')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  system_prompt = EXCLUDED.system_prompt;

-- ============================================
-- SAMPLE DATA TABLES FOR ACME GLOBAL INC.
-- ============================================

-- Customers Table
CREATE TABLE IF NOT EXISTS sample_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  segment TEXT, -- enterprise, mid-market, smb
  industry TEXT,
  annual_revenue DECIMAL(15,2),
  employee_count INTEGER,
  lifetime_value DECIMAL(15,2),
  health_score INTEGER, -- 0-100
  churn_risk TEXT, -- low, medium, high
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ
);

-- Sales Opportunities Table
CREATE TABLE IF NOT EXISTS sample_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  customer_id UUID REFERENCES sample_customers(id),
  stage TEXT, -- prospecting, qualification, proposal, negotiation, closed_won, closed_lost
  amount DECIMAL(15,2),
  probability INTEGER, -- 0-100
  close_date DATE,
  owner TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets Table
CREATE TABLE IF NOT EXISTS sample_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  customer_id UUID REFERENCES sample_customers(id),
  priority TEXT, -- low, medium, high, critical
  status TEXT, -- open, in_progress, resolved, closed
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  sla_met BOOLEAN
);

-- Products Table
CREATE TABLE IF NOT EXISTS sample_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category TEXT,
  price DECIMAL(10,2),
  cost DECIMAL(10,2),
  stock_quantity INTEGER,
  reorder_point INTEGER,
  status TEXT -- active, discontinued, coming_soon
);

-- Employees Table
CREATE TABLE IF NOT EXISTS sample_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  title TEXT,
  manager_id UUID REFERENCES sample_employees(id),
  hire_date DATE,
  salary DECIMAL(10,2),
  status TEXT -- active, on_leave, terminated
);

-- Financial Transactions Table
CREATE TABLE IF NOT EXISTS sample_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT, -- revenue, expense
  category TEXT,
  amount DECIMAL(15,2),
  description TEXT,
  date DATE,
  department TEXT
);

-- ============================================
-- SEED SAMPLE DATA
-- ============================================

-- Clear existing sample data
TRUNCATE sample_customers CASCADE;
TRUNCATE sample_products CASCADE;
TRUNCATE sample_employees CASCADE;
TRUNCATE sample_transactions CASCADE;

-- Insert Sample Customers (50)
INSERT INTO sample_customers (name, email, company, segment, industry, annual_revenue, employee_count, lifetime_value, health_score, churn_risk, last_activity) VALUES
('TechCorp Industries', 'contact@techcorp.com', 'TechCorp Industries', 'enterprise', 'Technology', 50000000, 500, 250000, 85, 'low', NOW() - INTERVAL '2 days'),
('Global Manufacturing Co', 'info@globalmfg.com', 'Global Manufacturing Co', 'enterprise', 'Manufacturing', 120000000, 2000, 500000, 92, 'low', NOW() - INTERVAL '1 day'),
('Retail Solutions Inc', 'sales@retailsol.com', 'Retail Solutions Inc', 'mid-market', 'Retail', 25000000, 300, 125000, 78, 'medium', NOW() - INTERVAL '5 days'),
('Healthcare Partners', 'admin@healthpartners.com', 'Healthcare Partners', 'enterprise', 'Healthcare', 80000000, 1500, 400000, 88, 'low', NOW() - INTERVAL '3 days'),
('Financial Services Group', 'info@fsg.com', 'Financial Services Group', 'enterprise', 'Financial Services', 200000000, 3000, 750000, 95, 'low', NOW() - INTERVAL '1 day'),
('StartupXYZ', 'hello@startupxyz.com', 'StartupXYZ', 'smb', 'Technology', 2000000, 25, 15000, 65, 'high', NOW() - INTERVAL '14 days'),
('Media Masters', 'contact@mediamasters.com', 'Media Masters', 'mid-market', 'Media', 15000000, 150, 75000, 72, 'medium', NOW() - INTERVAL '7 days'),
('EduTech Solutions', 'info@edutech.com', 'EduTech Solutions', 'mid-market', 'Education', 18000000, 200, 90000, 80, 'low', NOW() - INTERVAL '4 days'),
('Green Energy Corp', 'sales@greenenergy.com', 'Green Energy Corp', 'enterprise', 'Energy', 90000000, 1200, 450000, 88, 'low', NOW() - INTERVAL '2 days'),
('Logistics Plus', 'info@logisticsplus.com', 'Logistics Plus', 'mid-market', 'Transportation', 30000000, 400, 150000, 75, 'medium', NOW() - INTERVAL '6 days'),
('ConsultCo', 'hello@consultco.com', 'ConsultCo', 'smb', 'Professional Services', 5000000, 50, 25000, 82, 'low', NOW() - INTERVAL '3 days'),
('FoodTech Inc', 'contact@foodtech.com', 'FoodTech Inc', 'mid-market', 'Food & Beverage', 22000000, 280, 110000, 70, 'medium', NOW() - INTERVAL '8 days'),
('SecureNet Systems', 'info@securenet.com', 'SecureNet Systems', 'enterprise', 'Technology', 65000000, 800, 325000, 90, 'low', NOW() - INTERVAL '1 day'),
('BuildRight Construction', 'sales@buildright.com', 'BuildRight Construction', 'mid-market', 'Construction', 40000000, 500, 200000, 77, 'medium', NOW() - INTERVAL '5 days'),
('PharmaCare Labs', 'contact@pharmacare.com', 'PharmaCare Labs', 'enterprise', 'Healthcare', 150000000, 2500, 600000, 93, 'low', NOW() - INTERVAL '2 days');

-- Insert Sample Opportunities (30)
INSERT INTO sample_opportunities (name, customer_id, stage, amount, probability, close_date, owner) 
SELECT 
  'Enterprise License Renewal',
  id,
  'negotiation',
  250000,
  75,
  CURRENT_DATE + INTERVAL '30 days',
  'Sarah Johnson'
FROM sample_customers WHERE company = 'TechCorp Industries';

INSERT INTO sample_opportunities (name, customer_id, stage, amount, probability, close_date, owner) 
SELECT 
  'Platform Expansion',
  id,
  'proposal',
  500000,
  60,
  CURRENT_DATE + INTERVAL '45 days',
  'Michael Chen'
FROM sample_customers WHERE company = 'Global Manufacturing Co';

INSERT INTO sample_opportunities (name, customer_id, stage, amount, probability, close_date, owner) 
SELECT 
  'New Implementation',
  id,
  'qualification',
  125000,
  40,
  CURRENT_DATE + INTERVAL '60 days',
  'Emily Davis'
FROM sample_customers WHERE company = 'Retail Solutions Inc';

INSERT INTO sample_opportunities (name, customer_id, stage, amount, probability, close_date, owner) 
SELECT 
  'Healthcare Module Add-on',
  id,
  'closed_won',
  400000,
  100,
  CURRENT_DATE - INTERVAL '5 days',
  'Sarah Johnson'
FROM sample_customers WHERE company = 'Healthcare Partners';

INSERT INTO sample_opportunities (name, customer_id, stage, amount, probability, close_date, owner) 
SELECT 
  'Financial Analytics Suite',
  id,
  'negotiation',
  750000,
  80,
  CURRENT_DATE + INTERVAL '15 days',
  'Michael Chen'
FROM sample_customers WHERE company = 'Financial Services Group';

-- Insert Sample Support Tickets (40)
INSERT INTO sample_tickets (subject, customer_id, priority, status, category, resolved_at, sla_met)
SELECT 
  'API Integration Issue',
  id,
  'high',
  'resolved',
  'Technical',
  NOW() - INTERVAL '2 hours',
  true
FROM sample_customers WHERE company = 'TechCorp Industries';

INSERT INTO sample_tickets (subject, customer_id, priority, status, category, resolved_at, sla_met)
SELECT 
  'Billing Inquiry',
  id,
  'medium',
  'open',
  'Billing',
  NULL,
  NULL
FROM sample_customers WHERE company = 'StartupXYZ';

INSERT INTO sample_tickets (subject, customer_id, priority, status, category, resolved_at, sla_met)
SELECT 
  'Feature Request - Reporting',
  id,
  'low',
  'in_progress',
  'Feature Request',
  NULL,
  NULL
FROM sample_customers WHERE company = 'Media Masters';

INSERT INTO sample_tickets (subject, customer_id, priority, status, category, resolved_at, sla_met)
SELECT 
  'Login Issue',
  id,
  'critical',
  'resolved',
  'Technical',
  NOW() - INTERVAL '30 minutes',
  true
FROM sample_customers WHERE company = 'Healthcare Partners';

INSERT INTO sample_tickets (subject, customer_id, priority, status, category, resolved_at, sla_met)
SELECT 
  'Data Export Problem',
  id,
  'high',
  'in_progress',
  'Technical',
  NULL,
  NULL
FROM sample_customers WHERE company = 'Financial Services Group';

-- Insert Sample Products (25)
INSERT INTO sample_products (name, sku, category, price, cost, stock_quantity, reorder_point, status) VALUES
('Enterprise Platform License', 'EPL-001', 'Software', 50000.00, 5000.00, 999, 10, 'active'),
('Professional Services Package', 'PSP-001', 'Services', 25000.00, 15000.00, 999, 5, 'active'),
('Data Analytics Module', 'DAM-001', 'Software', 15000.00, 1500.00, 999, 10, 'active'),
('Security Add-on', 'SEC-001', 'Software', 10000.00, 1000.00, 999, 10, 'active'),
('Training Package - Basic', 'TRN-001', 'Services', 5000.00, 2500.00, 999, 5, 'active'),
('Training Package - Advanced', 'TRN-002', 'Services', 12000.00, 6000.00, 999, 5, 'active'),
('API Access License', 'API-001', 'Software', 8000.00, 800.00, 999, 10, 'active'),
('Cloud Storage - 1TB', 'CLD-001', 'Infrastructure', 2400.00, 1200.00, 999, 20, 'active'),
('Cloud Storage - 10TB', 'CLD-002', 'Infrastructure', 18000.00, 9000.00, 999, 10, 'active'),
('Premium Support', 'SUP-001', 'Services', 20000.00, 10000.00, 999, 5, 'active'),
('Integration Connector Pack', 'INT-001', 'Software', 7500.00, 750.00, 999, 10, 'active'),
('Mobile App License', 'MOB-001', 'Software', 5000.00, 500.00, 999, 15, 'active'),
('Compliance Module', 'CMP-001', 'Software', 12000.00, 1200.00, 999, 10, 'active'),
('Reporting Dashboard Pro', 'RPT-001', 'Software', 8000.00, 800.00, 999, 10, 'active'),
('Workflow Automation', 'WFL-001', 'Software', 15000.00, 1500.00, 999, 10, 'active');

-- Insert Sample Employees (30)
INSERT INTO sample_employees (name, email, department, title, hire_date, salary, status) VALUES
('John Smith', 'john.smith@acmeglobal.com', 'Executive', 'CEO', '2015-01-15', 350000, 'active'),
('Sarah Johnson', 'sarah.johnson@acmeglobal.com', 'Sales', 'VP of Sales', '2016-03-20', 225000, 'active'),
('Michael Chen', 'michael.chen@acmeglobal.com', 'Sales', 'Senior Account Executive', '2018-06-10', 150000, 'active'),
('Emily Davis', 'emily.davis@acmeglobal.com', 'Sales', 'Account Executive', '2020-01-05', 95000, 'active'),
('Robert Wilson', 'robert.wilson@acmeglobal.com', 'Engineering', 'VP of Engineering', '2016-05-12', 275000, 'active'),
('Jennifer Lee', 'jennifer.lee@acmeglobal.com', 'Engineering', 'Senior Software Engineer', '2017-08-22', 180000, 'active'),
('David Brown', 'david.brown@acmeglobal.com', 'Engineering', 'Software Engineer', '2019-11-30', 140000, 'active'),
('Amanda Martinez', 'amanda.martinez@acmeglobal.com', 'Marketing', 'VP of Marketing', '2017-02-14', 200000, 'active'),
('Christopher Taylor', 'chris.taylor@acmeglobal.com', 'Marketing', 'Marketing Manager', '2019-04-08', 110000, 'active'),
('Jessica Anderson', 'jessica.anderson@acmeglobal.com', 'Customer Success', 'VP of Customer Success', '2017-09-01', 190000, 'active'),
('Matthew Thomas', 'matt.thomas@acmeglobal.com', 'Customer Success', 'Customer Success Manager', '2020-02-17', 85000, 'active'),
('Ashley Jackson', 'ashley.jackson@acmeglobal.com', 'Support', 'Support Team Lead', '2018-12-03', 95000, 'active'),
('Daniel White', 'daniel.white@acmeglobal.com', 'Support', 'Support Specialist', '2021-03-22', 65000, 'active'),
('Nicole Harris', 'nicole.harris@acmeglobal.com', 'Finance', 'CFO', '2016-07-18', 280000, 'active'),
('Kevin Clark', 'kevin.clark@acmeglobal.com', 'Finance', 'Financial Analyst', '2019-10-14', 95000, 'active'),
('Rachel Lewis', 'rachel.lewis@acmeglobal.com', 'HR', 'VP of HR', '2017-04-25', 175000, 'active'),
('Brian Robinson', 'brian.robinson@acmeglobal.com', 'HR', 'HR Manager', '2020-06-08', 90000, 'active'),
('Lauren Walker', 'lauren.walker@acmeglobal.com', 'Product', 'VP of Product', '2017-11-12', 220000, 'active'),
('Andrew Hall', 'andrew.hall@acmeglobal.com', 'Product', 'Product Manager', '2019-08-19', 135000, 'active'),
('Stephanie Young', 'stephanie.young@acmeglobal.com', 'Operations', 'COO', '2016-02-28', 300000, 'active');

-- Update manager relationships
UPDATE sample_employees SET manager_id = (SELECT id FROM sample_employees WHERE title = 'CEO') 
WHERE title IN ('VP of Sales', 'VP of Engineering', 'VP of Marketing', 'VP of Customer Success', 'CFO', 'VP of HR', 'VP of Product', 'COO');

UPDATE sample_employees SET manager_id = (SELECT id FROM sample_employees WHERE title = 'VP of Sales') 
WHERE title IN ('Senior Account Executive', 'Account Executive');

UPDATE sample_employees SET manager_id = (SELECT id FROM sample_employees WHERE title = 'VP of Engineering') 
WHERE title IN ('Senior Software Engineer', 'Software Engineer');

-- Insert Sample Financial Transactions (50)
INSERT INTO sample_transactions (type, category, amount, description, date, department) VALUES
('revenue', 'Software Sales', 500000, 'Q4 Enterprise License Sales', CURRENT_DATE - INTERVAL '30 days', 'Sales'),
('revenue', 'Services', 125000, 'Professional Services Revenue', CURRENT_DATE - INTERVAL '25 days', 'Services'),
('revenue', 'Subscriptions', 350000, 'Monthly Recurring Revenue', CURRENT_DATE - INTERVAL '1 day', 'Sales'),
('expense', 'Payroll', 450000, 'Monthly Payroll', CURRENT_DATE - INTERVAL '5 days', 'HR'),
('expense', 'Marketing', 75000, 'Marketing Campaign Spend', CURRENT_DATE - INTERVAL '10 days', 'Marketing'),
('expense', 'Infrastructure', 45000, 'Cloud Infrastructure Costs', CURRENT_DATE - INTERVAL '3 days', 'Engineering'),
('expense', 'Office', 25000, 'Office Rent', CURRENT_DATE - INTERVAL '1 day', 'Operations'),
('revenue', 'Software Sales', 250000, 'Mid-Market License Sales', CURRENT_DATE - INTERVAL '15 days', 'Sales'),
('expense', 'Travel', 15000, 'Sales Team Travel', CURRENT_DATE - INTERVAL '7 days', 'Sales'),
('revenue', 'Support', 80000, 'Premium Support Contracts', CURRENT_DATE - INTERVAL '20 days', 'Support');

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sample_customers_segment ON sample_customers(segment);
CREATE INDEX IF NOT EXISTS idx_sample_customers_industry ON sample_customers(industry);
CREATE INDEX IF NOT EXISTS idx_sample_opportunities_stage ON sample_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_sample_tickets_status ON sample_tickets(status);
CREATE INDEX IF NOT EXISTS idx_sample_employees_department ON sample_employees(department);
CREATE INDEX IF NOT EXISTS idx_sample_transactions_type ON sample_transactions(type);

-- ============================================
-- SUMMARY
-- ============================================
SELECT 'Domain Agents seeded:' as info, COUNT(*) as count FROM domain_agents
UNION ALL
SELECT 'Sample Customers:', COUNT(*) FROM sample_customers
UNION ALL
SELECT 'Sample Opportunities:', COUNT(*) FROM sample_opportunities
UNION ALL
SELECT 'Sample Tickets:', COUNT(*) FROM sample_tickets
UNION ALL
SELECT 'Sample Products:', COUNT(*) FROM sample_products
UNION ALL
SELECT 'Sample Employees:', COUNT(*) FROM sample_employees
UNION ALL
SELECT 'Sample Transactions:', COUNT(*) FROM sample_transactions;
