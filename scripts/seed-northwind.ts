/**
 * Northwind Sample Data Seeder
 * 
 * Seeds the database with Northwind-style demo data that works with the domain agents.
 * Run with: npx tsx scripts/seed-northwind.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://semanticstudio:semanticstudio@localhost:5433/semanticstudio',
});

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting Northwind data seed...');
    
    // Begin transaction
    await client.query('BEGIN');

    // ============================================
    // Categories
    // ============================================
    console.log('Seeding categories...');
    await client.query(`
      INSERT INTO nw_categories (id, category_name, description) VALUES
        (1, 'Beverages', 'Soft drinks, coffees, teas, beers, and ales'),
        (2, 'Condiments', 'Sweet and savory sauces, relishes, spreads, and seasonings'),
        (3, 'Confections', 'Desserts, candies, and sweet breads'),
        (4, 'Dairy Products', 'Cheeses'),
        (5, 'Grains/Cereals', 'Breads, crackers, pasta, and cereal'),
        (6, 'Meat/Poultry', 'Prepared meats'),
        (7, 'Produce', 'Dried fruit and bean curd'),
        (8, 'Seafood', 'Seaweed and fish')
      ON CONFLICT (id) DO NOTHING
    `);

    // ============================================
    // Suppliers
    // ============================================
    console.log('Seeding suppliers...');
    await client.query(`
      INSERT INTO nw_suppliers (id, company_name, contact_name, contact_title, address, city, region, postal_code, country, phone) VALUES
        (1, 'Exotic Liquids', 'Charlotte Cooper', 'Purchasing Manager', '49 Gilbert St.', 'London', NULL, 'EC1 4SD', 'UK', '(171) 555-2222'),
        (2, 'New Orleans Cajun Delights', 'Shelley Burke', 'Order Administrator', 'P.O. Box 78934', 'New Orleans', 'LA', '70117', 'USA', '(100) 555-4822'),
        (3, 'Grandma Kelly''s Homestead', 'Regina Murphy', 'Sales Representative', '707 Oxford Rd.', 'Ann Arbor', 'MI', '48104', 'USA', '(313) 555-5735'),
        (4, 'Tokyo Traders', 'Yoshi Nagase', 'Marketing Manager', '9-8 Sekimai Musashino-shi', 'Tokyo', NULL, '100', 'Japan', '(03) 3555-5011'),
        (5, 'Cooperativa de Quesos ''Las Cabras''', 'Antonio del Valle Saavedra', 'Export Administrator', 'Calle del Rosal 4', 'Oviedo', 'Asturias', '33007', 'Spain', '(98) 598 76 54'),
        (6, 'Mayumi''s', 'Mayumi Ohno', 'Marketing Representative', '92 Setsuko Chuo-ku', 'Osaka', NULL, '545', 'Japan', '(06) 431-7877'),
        (7, 'Pavlova, Ltd.', 'Ian Devling', 'Marketing Manager', '74 Rose St. Moonie Ponds', 'Melbourne', 'Victoria', '3058', 'Australia', '(03) 444-2343'),
        (8, 'Specialty Biscuits, Ltd.', 'Peter Wilson', 'Sales Representative', '29 King''s Way', 'Manchester', NULL, 'M14 GSD', 'UK', '(161) 555-4448'),
        (9, 'PB Knäckebröd AB', 'Lars Peterson', 'Sales Agent', 'Kaloadagatan 13', 'Göteborg', NULL, 'S-345 67', 'Sweden', '031-987 65 43'),
        (10, 'Refrescos Americanas LTDA', 'Carlos Diaz', 'Marketing Manager', 'Av. das Americanas 12.890', 'São Paulo', NULL, '5442', 'Brazil', '(11) 555 4640')
      ON CONFLICT (id) DO NOTHING
    `);

    // ============================================
    // Products
    // ============================================
    console.log('Seeding products...');
    await client.query(`
      INSERT INTO nw_products (id, product_name, supplier_id, category_id, quantity_per_unit, unit_price, units_in_stock, units_on_order, reorder_level, discontinued) VALUES
        (1, 'Chai', 1, 1, '10 boxes x 20 bags', 18.00, 39, 0, 10, false),
        (2, 'Chang', 1, 1, '24 - 12 oz bottles', 19.00, 17, 40, 25, false),
        (3, 'Aniseed Syrup', 1, 2, '12 - 550 ml bottles', 10.00, 13, 70, 25, false),
        (4, 'Chef Anton''s Cajun Seasoning', 2, 2, '48 - 6 oz jars', 22.00, 53, 0, 0, false),
        (5, 'Chef Anton''s Gumbo Mix', 2, 2, '36 boxes', 21.35, 0, 0, 0, true),
        (6, 'Grandma''s Boysenberry Spread', 3, 2, '12 - 8 oz jars', 25.00, 120, 0, 25, false),
        (7, 'Uncle Bob''s Organic Dried Pears', 3, 7, '12 - 1 lb pkgs.', 30.00, 15, 0, 10, false),
        (8, 'Northwoods Cranberry Sauce', 3, 2, '12 - 12 oz jars', 40.00, 6, 0, 0, false),
        (9, 'Mishi Kobe Niku', 4, 6, '18 - 500 g pkgs.', 97.00, 29, 0, 0, true),
        (10, 'Ikura', 4, 8, '12 - 200 ml jars', 31.00, 31, 0, 0, false),
        (11, 'Queso Cabrales', 5, 4, '1 kg pkg.', 21.00, 22, 30, 30, false),
        (12, 'Queso Manchego La Pastora', 5, 4, '10 - 500 g pkgs.', 38.00, 86, 0, 0, false),
        (13, 'Konbu', 6, 8, '2 kg box', 6.00, 24, 0, 5, false),
        (14, 'Tofu', 6, 7, '40 - 100 g pkgs.', 23.25, 35, 0, 0, false),
        (15, 'Genen Shouyu', 6, 2, '24 - 250 ml bottles', 15.50, 39, 0, 5, false),
        (16, 'Pavlova', 7, 3, '32 - 500 g boxes', 17.45, 29, 0, 10, false),
        (17, 'Alice Mutton', 7, 6, '20 - 1 kg tins', 39.00, 0, 0, 0, true),
        (18, 'Carnarvon Tigers', 7, 8, '16 kg pkg.', 62.50, 42, 0, 0, false),
        (19, 'Teatime Chocolate Biscuits', 8, 3, '10 boxes x 12 pieces', 9.20, 25, 0, 5, false),
        (20, 'Sir Rodney''s Marmalade', 8, 3, '30 gift boxes', 81.00, 40, 0, 0, false)
      ON CONFLICT (id) DO NOTHING
    `);

    // ============================================
    // Regions
    // ============================================
    console.log('Seeding regions...');
    await client.query(`
      INSERT INTO nw_regions (id, region_description) VALUES
        (1, 'Eastern'),
        (2, 'Western'),
        (3, 'Northern'),
        (4, 'Southern')
      ON CONFLICT (id) DO NOTHING
    `);

    // ============================================
    // Shippers
    // ============================================
    console.log('Seeding shippers...');
    await client.query(`
      INSERT INTO nw_shippers (id, company_name, phone) VALUES
        (1, 'Speedy Express', '(503) 555-9831'),
        (2, 'United Package', '(503) 555-3199'),
        (3, 'Federal Shipping', '(503) 555-9931')
      ON CONFLICT (id) DO NOTHING
    `);

    // ============================================
    // Get sample customer and employee IDs for orders
    // ============================================
    const customerResult = await client.query('SELECT id FROM sample_customers LIMIT 5');
    const employeeResult = await client.query('SELECT id FROM sample_employees LIMIT 5');
    
    if (customerResult.rows.length > 0 && employeeResult.rows.length > 0) {
      console.log('Seeding orders...');
      
      // Create sample orders
      const customerIds = customerResult.rows.map(r => r.id);
      const employeeIds = employeeResult.rows.map(r => r.id);
      
      for (let i = 1; i <= 20; i++) {
        const customerId = customerIds[i % customerIds.length];
        const employeeId = employeeIds[i % employeeIds.length];
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 90));
        
        await client.query(`
          INSERT INTO nw_orders (id, customer_id, employee_id, order_date, required_date, shipped_date, shipper_id, freight, ship_name, ship_city, ship_country)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          i,
          customerId,
          employeeId,
          orderDate.toISOString().split('T')[0],
          new Date(orderDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          (i % 3) + 1,
          Math.floor(Math.random() * 100) + 10,
          'Customer ' + (i % 5 + 1),
          ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i % 5],
          'USA'
        ]);

        // Add order details
        for (let j = 1; j <= 3; j++) {
          const productId = ((i + j) % 20) + 1;
          await client.query(`
            INSERT INTO nw_order_details (order_id, product_id, unit_price, quantity, discount)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            i,
            productId,
            Math.floor(Math.random() * 50) + 10,
            Math.floor(Math.random() * 10) + 1,
            Math.random() < 0.3 ? 0.05 : 0
          ]);
        }
      }
    }

    // ============================================
    // Seed Semantic Entities
    // ============================================
    console.log('Seeding semantic entities...');
    await client.query(`
      INSERT INTO semantic_entities (name, display_name, description, source_table, domain_agent, fields, relationships) VALUES
        ('customer', 'Customer', 'Customer accounts and profiles', 'sample_customers', 'customer', 
         '[{"name": "name", "type": "text", "description": "Customer name"}, {"name": "segment", "type": "text", "description": "Market segment"}, {"name": "industry", "type": "text", "description": "Industry vertical"}]',
         '[{"target": "opportunity", "type": "HAS_OPPORTUNITY"}, {"target": "ticket", "type": "HAS_TICKET"}]'),
        ('employee', 'Employee', 'Company employees', 'sample_employees', 'human_resources',
         '[{"name": "name", "type": "text", "description": "Employee name"}, {"name": "department", "type": "text", "description": "Department"}, {"name": "title", "type": "text", "description": "Job title"}]',
         '[{"target": "employee", "type": "REPORTS_TO"}, {"target": "order", "type": "PROCESSED"}]'),
        ('product', 'Product', 'Products in catalog', 'nw_products', 'product_management',
         '[{"name": "product_name", "type": "text", "description": "Product name"}, {"name": "unit_price", "type": "decimal", "description": "Price"}, {"name": "units_in_stock", "type": "integer", "description": "Stock level"}]',
         '[{"target": "category", "type": "BELONGS_TO"}, {"target": "supplier", "type": "SUPPLIED_BY"}]'),
        ('category', 'Category', 'Product categories', 'nw_categories', 'product_management',
         '[{"name": "category_name", "type": "text", "description": "Category name"}, {"name": "description", "type": "text", "description": "Category description"}]',
         '[{"target": "product", "type": "CONTAINS"}]'),
        ('supplier', 'Supplier', 'Product suppliers', 'nw_suppliers', 'procurement',
         '[{"name": "company_name", "type": "text", "description": "Company name"}, {"name": "contact_name", "type": "text", "description": "Contact person"}, {"name": "country", "type": "text", "description": "Country"}]',
         '[{"target": "product", "type": "SUPPLIES"}]'),
        ('order', 'Order', 'Customer orders', 'nw_orders', 'sales',
         '[{"name": "order_date", "type": "date", "description": "Order date"}, {"name": "shipped_date", "type": "date", "description": "Ship date"}, {"name": "freight", "type": "decimal", "description": "Shipping cost"}]',
         '[{"target": "customer", "type": "PLACED_BY"}, {"target": "product", "type": "CONTAINS"}]'),
        ('opportunity', 'Opportunity', 'Sales opportunities', 'sample_opportunities', 'sales',
         '[{"name": "name", "type": "text", "description": "Opportunity name"}, {"name": "stage", "type": "text", "description": "Sales stage"}, {"name": "amount", "type": "decimal", "description": "Deal value"}]',
         '[{"target": "customer", "type": "BELONGS_TO"}]'),
        ('ticket', 'Support Ticket', 'Customer support tickets', 'sample_tickets', 'customer_support',
         '[{"name": "subject", "type": "text", "description": "Ticket subject"}, {"name": "priority", "type": "text", "description": "Priority level"}, {"name": "status", "type": "text", "description": "Ticket status"}]',
         '[{"target": "customer", "type": "SUBMITTED_BY"}]'),
        ('transaction', 'Transaction', 'Financial transactions', 'sample_transactions', 'finance',
         '[{"name": "type", "type": "text", "description": "Transaction type"}, {"name": "amount", "type": "decimal", "description": "Amount"}, {"name": "category", "type": "text", "description": "Category"}]',
         '[{"target": "department", "type": "BELONGS_TO"}]')
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        source_table = EXCLUDED.source_table,
        domain_agent = EXCLUDED.domain_agent,
        fields = EXCLUDED.fields,
        relationships = EXCLUDED.relationships
    `);

    // ============================================
    // Seed Entity Aliases
    // ============================================
    console.log('Seeding entity aliases...');
    await client.query(`
      INSERT INTO entity_aliases (entity_id, alias, alias_type)
      SELECT id, 'client', 'synonym' FROM semantic_entities WHERE name = 'customer'
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO entity_aliases (entity_id, alias, alias_type)
      SELECT id, 'account', 'synonym' FROM semantic_entities WHERE name = 'customer'
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO entity_aliases (entity_id, alias, alias_type)
      SELECT id, 'staff', 'synonym' FROM semantic_entities WHERE name = 'employee'
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO entity_aliases (entity_id, alias, alias_type)
      SELECT id, 'worker', 'synonym' FROM semantic_entities WHERE name = 'employee'
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO entity_aliases (entity_id, alias, alias_type)
      SELECT id, 'item', 'synonym' FROM semantic_entities WHERE name = 'product'
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO entity_aliases (entity_id, alias, alias_type)
      SELECT id, 'deal', 'synonym' FROM semantic_entities WHERE name = 'opportunity'
      ON CONFLICT DO NOTHING
    `);
    await client.query(`
      INSERT INTO entity_aliases (entity_id, alias, alias_type)
      SELECT id, 'vendor', 'synonym' FROM semantic_entities WHERE name = 'supplier'
      ON CONFLICT DO NOTHING
    `);

    // ============================================
    // Seed Data Sources
    // ============================================
    console.log('Seeding data sources...');
    await client.query(`
      INSERT INTO data_sources (name, display_name, source_type, config, status, sync_frequency) VALUES
        ('sample_data', 'Sample Business Data', 'database', '{"tables": ["sample_customers", "sample_employees", "sample_opportunities", "sample_tickets", "sample_products", "sample_transactions"]}', 'active', 'manual'),
        ('northwind', 'Northwind Dataset', 'database', '{"tables": ["nw_categories", "nw_suppliers", "nw_products", "nw_orders", "nw_order_details", "nw_shippers", "nw_regions"]}', 'active', 'manual')
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        config = EXCLUDED.config,
        status = EXCLUDED.status
    `);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Northwind data seed completed successfully!');
    
    // Print summary
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) FROM nw_categories'),
      client.query('SELECT COUNT(*) FROM nw_suppliers'),
      client.query('SELECT COUNT(*) FROM nw_products'),
      client.query('SELECT COUNT(*) FROM nw_orders'),
      client.query('SELECT COUNT(*) FROM nw_order_details'),
      client.query('SELECT COUNT(*) FROM semantic_entities'),
      client.query('SELECT COUNT(*) FROM entity_aliases'),
      client.query('SELECT COUNT(*) FROM data_sources'),
    ]);

    console.log('\nSeed Summary:');
    console.log(`  Categories: ${counts[0].rows[0].count}`);
    console.log(`  Suppliers: ${counts[1].rows[0].count}`);
    console.log(`  Products: ${counts[2].rows[0].count}`);
    console.log(`  Orders: ${counts[3].rows[0].count}`);
    console.log(`  Order Details: ${counts[4].rows[0].count}`);
    console.log(`  Semantic Entities: ${counts[5].rows[0].count}`);
    console.log(`  Entity Aliases: ${counts[6].rows[0].count}`);
    console.log(`  Data Sources: ${counts[7].rows[0].count}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
