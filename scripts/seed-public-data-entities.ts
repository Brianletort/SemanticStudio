/**
 * Public Data Entities Seeder
 * 
 * Seeds semantic entities and aliases for public data tables.
 * Run with: npx tsx scripts/seed-public-data-entities.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://agentkit:agentkit@localhost:5433/agentkit',
});

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting public data entities seed...');
    
    // Begin transaction
    await client.query('BEGIN');

    // ============================================
    // Seed Semantic Entities for Public Data
    // ============================================
    console.log('Seeding public data semantic entities...');
    await client.query(`
      INSERT INTO semantic_entities (name, display_name, description, source_table, domain_agent, fields, relationships) VALUES
        ('economic_indicator', 'Economic Indicator', 'Economic metrics like GDP, unemployment, inflation from FRED', 'economic_indicators', 'finance', 
         '[{"name": "indicator", "type": "text", "description": "Indicator code (GDP, UNRATE, CPI, etc.)"}, {"name": "indicator_name", "type": "text", "description": "Human-readable name"}, {"name": "value", "type": "real", "description": "Indicator value"}, {"name": "date", "type": "date", "description": "Observation date"}, {"name": "unit", "type": "text", "description": "Unit of measurement"}]',
         '[{"target": "industry", "type": "AFFECTS"}]'),
        ('public_company', 'Public Company', 'Public company profiles with stock data from Yahoo Finance', 'public_companies', 'competitive_intel',
         '[{"name": "ticker", "type": "text", "description": "Stock ticker symbol"}, {"name": "name", "type": "text", "description": "Company name"}, {"name": "sector", "type": "text", "description": "Business sector"}, {"name": "industry", "type": "text", "description": "Industry"}, {"name": "market_cap", "type": "real", "description": "Market capitalization"}, {"name": "pe_ratio", "type": "real", "description": "Price/earnings ratio"}, {"name": "revenue", "type": "real", "description": "Annual revenue"}, {"name": "employees", "type": "integer", "description": "Employee count"}, {"name": "last_price", "type": "real", "description": "Latest stock price"}]',
         '[{"target": "industry", "type": "OPERATES_IN"}]'),
        ('industry_sector', 'Industry Sector', 'Industry statistics by NAICS code from Census Bureau', 'industry_statistics', 'business_intel',
         '[{"name": "naics_code", "type": "text", "description": "NAICS industry code"}, {"name": "naics_title", "type": "text", "description": "Industry name"}, {"name": "year", "type": "integer", "description": "Data year"}, {"name": "establishments", "type": "integer", "description": "Number of establishments"}, {"name": "employment", "type": "integer", "description": "Total employment"}, {"name": "annual_payroll", "type": "real", "description": "Annual payroll in thousands"}, {"name": "average_wage", "type": "real", "description": "Average wage per employee"}]',
         '[{"target": "public_company", "type": "CONTAINS"}, {"target": "economic_indicator", "type": "MEASURED_BY"}]')
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        source_table = EXCLUDED.source_table,
        domain_agent = EXCLUDED.domain_agent,
        fields = EXCLUDED.fields,
        relationships = EXCLUDED.relationships
    `);

    // ============================================
    // Seed Entity Aliases for Public Data
    // ============================================
    console.log('Seeding public data entity aliases...');
    
    // Economic indicator aliases
    const economicAliases = ['gdp', 'unemployment', 'inflation', 'cpi', 'interest rate', 'fed funds', 'consumer sentiment', 'economy', 'economic data', 'macro'];
    for (const alias of economicAliases) {
      await client.query(`
        INSERT INTO entity_aliases (entity_id, alias, alias_type)
        SELECT id, $1, 'synonym' FROM semantic_entities WHERE name = 'economic_indicator'
        ON CONFLICT DO NOTHING
      `, [alias]);
    }

    // Public company aliases
    const companyAliases = ['stock', 'ticker', 'competitor', 'corporation', 'firm', 'company', 'public company', 'market cap', 'stock price'];
    for (const alias of companyAliases) {
      await client.query(`
        INSERT INTO entity_aliases (entity_id, alias, alias_type)
        SELECT id, $1, 'synonym' FROM semantic_entities WHERE name = 'public_company'
        ON CONFLICT DO NOTHING
      `, [alias]);
    }

    // Industry aliases
    const industryAliases = ['industry', 'sector', 'naics', 'market segment', 'business sector', 'vertical', 'industry data', 'employment', 'payroll'];
    for (const alias of industryAliases) {
      await client.query(`
        INSERT INTO entity_aliases (entity_id, alias, alias_type)
        SELECT id, $1, 'synonym' FROM semantic_entities WHERE name = 'industry_sector'
        ON CONFLICT DO NOTHING
      `, [alias]);
    }

    // ============================================
    // Seed Data Sources for Public Data
    // ============================================
    console.log('Seeding public data sources...');
    await client.query(`
      INSERT INTO data_sources (name, display_name, source_type, config, status, sync_frequency) VALUES
        ('fred_economic', 'FRED Economic Data', 'api', '{"tables": ["economic_indicators"], "api_url": "https://api.stlouisfed.org", "description": "Federal Reserve Economic Data"}', 'active', 'daily'),
        ('yahoo_finance', 'Yahoo Finance', 'api', '{"tables": ["public_companies"], "api_url": "https://query1.finance.yahoo.com", "description": "Public company stock and financial data"}', 'active', 'hourly'),
        ('census_cbp', 'Census Bureau CBP', 'api', '{"tables": ["industry_statistics"], "api_url": "https://api.census.gov", "description": "County Business Patterns industry statistics"}', 'active', 'yearly')
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        config = EXCLUDED.config,
        status = EXCLUDED.status
    `);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Public data entities seed completed successfully!');
    
    // Print summary
    const counts = await Promise.all([
      client.query("SELECT COUNT(*) FROM semantic_entities WHERE name IN ('economic_indicator', 'public_company', 'industry_sector')"),
      client.query("SELECT COUNT(*) FROM entity_aliases ea JOIN semantic_entities se ON ea.entity_id = se.id WHERE se.name IN ('economic_indicator', 'public_company', 'industry_sector')"),
      client.query("SELECT COUNT(*) FROM data_sources WHERE name IN ('fred_economic', 'yahoo_finance', 'census_cbp')"),
    ]);

    console.log('\nSeed Summary:');
    console.log(`  Public Data Semantic Entities: ${counts[0].rows[0].count}`);
    console.log(`  Public Data Entity Aliases: ${counts[1].rows[0].count}`);
    console.log(`  Public Data Sources: ${counts[2].rows[0].count}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
