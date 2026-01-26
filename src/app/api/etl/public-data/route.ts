/**
 * Public Data ETL API Route
 * 
 * Runs all public data ETL jobs (economic indicators, company data, industry stats)
 * and optionally rebuilds the knowledge graph afterward.
 * 
 * POST /api/etl/public-data - Run all public data ETL jobs
 * GET /api/etl/public-data - Get status of public data tables
 */

import { NextRequest, NextResponse } from 'next/server';
import { ETLOrchestrator } from '@/lib/etl/orchestrator';
import { KnowledgeGraphPipeline } from '@/lib/graph/kg-pipeline';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
// Import agents to ensure they're registered
import '@/lib/etl/agents';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { rebuildKg = true } = body;

    const results = {
      economicIndicators: null as unknown,
      publicCompanies: null as unknown,
      industryStatistics: null as unknown,
      knowledgeGraph: null as unknown,
      totalDuration: 0,
    };

    const startTime = Date.now();

    // Run Economic Indicators ETL
    console.log('Running Economic Indicators ETL...');
    try {
      results.economicIndicators = await ETLOrchestrator.executeJobDirect({
        jobType: 'economic_indicators',
        name: 'Economic Indicators from FRED',
        sourceConfig: { type: 'api' },
        targetConfig: { table: 'economic_indicators', mode: 'replace' },
      });
    } catch (error) {
      console.error('Economic Indicators ETL failed:', error);
      results.economicIndicators = { error: String(error) };
    }

    // Run Public Companies ETL
    console.log('Running Public Companies ETL...');
    try {
      results.publicCompanies = await ETLOrchestrator.executeJobDirect({
        jobType: 'public_companies',
        name: 'Public Companies from Yahoo Finance',
        sourceConfig: { type: 'api' },
        targetConfig: { table: 'public_companies', mode: 'upsert' },
      });
    } catch (error) {
      console.error('Public Companies ETL failed:', error);
      results.publicCompanies = { error: String(error) };
    }

    // Run Industry Statistics ETL
    console.log('Running Industry Statistics ETL...');
    try {
      results.industryStatistics = await ETLOrchestrator.executeJobDirect({
        jobType: 'industry_statistics',
        name: 'Industry Statistics from Census Bureau',
        sourceConfig: { type: 'api' },
        targetConfig: { table: 'industry_statistics', mode: 'replace' },
      });
    } catch (error) {
      console.error('Industry Statistics ETL failed:', error);
      results.industryStatistics = { error: String(error) };
    }

    // Rebuild Knowledge Graph if requested
    if (rebuildKg) {
      console.log('Rebuilding Knowledge Graph...');
      try {
        const kgPipeline = new KnowledgeGraphPipeline({ generateEmbeddings: false });
        results.knowledgeGraph = await kgPipeline.build();
      } catch (error) {
        console.error('Knowledge Graph rebuild failed:', error);
        results.knowledgeGraph = { error: String(error) };
      }
    }

    results.totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Public data ETL completed',
      results,
    });
  } catch (error) {
    console.error('Public data ETL error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get counts from each public data table
    const [economicCount] = await db.execute(
      sql.raw(`SELECT COUNT(*) as count FROM economic_indicators`)
    ).then(r => r.rows as Array<{ count: string }>);

    const [companyCount] = await db.execute(
      sql.raw(`SELECT COUNT(*) as count FROM public_companies`)
    ).then(r => r.rows as Array<{ count: string }>);

    const [industryCount] = await db.execute(
      sql.raw(`SELECT COUNT(*) as count FROM industry_statistics`)
    ).then(r => r.rows as Array<{ count: string }>);

    // Get sample data from each table
    const economicSample = await db.execute(
      sql.raw(`SELECT indicator, indicator_name, value, date FROM economic_indicators ORDER BY date DESC LIMIT 5`)
    ).then(r => r.rows);

    const companySample = await db.execute(
      sql.raw(`SELECT ticker, name, sector, market_cap, last_price FROM public_companies LIMIT 5`)
    ).then(r => r.rows);

    const industrySample = await db.execute(
      sql.raw(`SELECT naics_code, naics_title, employment, average_wage FROM industry_statistics LIMIT 5`)
    ).then(r => r.rows);

    return NextResponse.json({
      status: 'ok',
      tables: {
        economicIndicators: {
          count: parseInt(economicCount?.count || '0', 10),
          sample: economicSample,
        },
        publicCompanies: {
          count: parseInt(companyCount?.count || '0', 10),
          sample: companySample,
        },
        industryStatistics: {
          count: parseInt(industryCount?.count || '0', 10),
          sample: industrySample,
        },
      },
    });
  } catch (error) {
    console.error('Error getting public data status:', error);
    return NextResponse.json(
      { status: 'error', error: String(error) },
      { status: 500 }
    );
  }
}
