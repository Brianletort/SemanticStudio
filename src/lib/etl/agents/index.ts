/**
 * ETL Agents Index
 * 
 * Exports all ETL agent implementations and registers them with the orchestrator.
 */

// Import agents to register them
import './csv-import-agent';
import './json-import-agent';
import './kg-builder-agent';
import './data-loader-agent';
// Public data ETL agents
import './economic-indicators-agent';
import './public-company-agent';
import './industry-statistics-agent';

// Re-export for direct use
export { CSVImportAgent } from './csv-import-agent';
export { JSONImportAgent } from './json-import-agent';
export { KGBuilderAgent } from './kg-builder-agent';
export { DataLoaderAgent } from './data-loader-agent';
// Public data ETL agents
export { EconomicIndicatorsAgent } from './economic-indicators-agent';
export { PublicCompanyAgent } from './public-company-agent';
export { IndustryStatisticsAgent } from './industry-statistics-agent';
