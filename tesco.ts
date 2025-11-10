import * as cheerio from 'cheerio';
import * as fs from 'fs';

interface Product {
  name: string;
  sourceId: string;
  sourceRef: string;
  country: string;
  categoriesTags: string;
  categoriesEn: string;
}

interface CsvRow {
  barcode: string;
  product_name: string;
  amount: string;
  unit: string;
  brand: string;
  categories_tags: string;
  categories_en: string;
  countries: string;
  source_id: string;
  source_ref: string;
}

/**
 * Converts a Product to a CSV row format
 * @param product - The product to convert
 * @returns A CsvRow object
 */
function productToCsvRow(product: Product): CsvRow {
  return {
    barcode: '',
    product_name: product.name,
    amount: '',
    unit: '',
    brand: '',
    categories_tags: product.categoriesTags,
    categories_en: product.categoriesEn,
    countries: product.country,
    source_id: product.sourceId,
    source_ref: product.sourceRef
  };
}

/**
 * Escapes a CSV field value
 * @param value - The value to escape
 * @returns The escaped value
 */
function escapeCsvField(value: string | number): string {
  const stringValue = String(value);
  // If the value contains comma, quote, or newline, wrap it in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Converts CSV row to CSV line
 * @param row - The CSV row object
 * @returns A CSV line string
 */
function rowToCsvLine(row: CsvRow): string {
  return [
    escapeCsvField(row.barcode),
    escapeCsvField(row.product_name),
    escapeCsvField(row.amount),
    escapeCsvField(row.unit),
    escapeCsvField(row.brand),
    escapeCsvField(row.categories_tags),
    escapeCsvField(row.categories_en),
    escapeCsvField(row.countries),
    escapeCsvField(row.source_id),
    escapeCsvField(row.source_ref)
  ].join(',');
}

/**
 * Writes products to CSV file, appending if file exists
 * @param products - Array of products to write
 * @param filename - The filename to write to
 */
function writeProductsToCsv(products: Product[], filename: string): void {
  const fileExists = fs.existsSync(filename);

  let csvContent = '';

  // Add header if file doesn't exist
  if (!fileExists) {
    const headers = [
      'barcode',
      'product_name',
      'amount',
      'unit',
      'brand',
      'categories_tags',
      'categories_en',
      'countries',
      'source_id',
      'source_ref'
    ];
    csvContent = headers.join(',') + '\n';
  }

  // Convert products to CSV rows and add to content
  const csvRows = products.map(productToCsvRow);
  csvContent += csvRows.map(rowToCsvLine).join('\n') + '\n';

  // Append to file
  fs.appendFileSync(filename, csvContent);
}

/**
 * Parses a Tesco HTML document and extracts product information
 * @param htmlContent - The HTML content as a string
 * @returns Array of Product objects
 */
function parseTescoProducts(htmlContent: string): Product[] {
  const products: Product[] = [];
  const $ = cheerio.load(htmlContent);

  // Find all product list items within #list-content
  $('#list-content > li').each((index, element) => {
    const $item = $(element);

    // Find the product title link
    const $link = $item.find('._64Yvfa_titleContainer h2 a');

    if ($link.length === 0) {
      return; // Skip if no link found
    }

    // Extract product name from link text
    const name = $link.text().trim();

    // Extract href and get the source_id (last part after /)
    const href = $link.attr('href') || '';
    const hrefParts = href.split('/');
    const sourceId = hrefParts[hrefParts.length - 1] || '';

    // Only add product if we have both name and sourceId

    const storage = 'Fresh Food > Fresh Fruit';
    const category = 'Organic Fruit & Nuts';

    if (name && sourceId) {
      products.push({
        name,
        sourceId,
        sourceRef: '3',
        country: 'GB',
        categoriesTags: `${storage}, ${category}`,
        categoriesEn: `${storage}, ${category}`
      });
    }
  });

  return products;
}

/**
 * Main function to read HTML file and output to CSV
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: ts-node parse-tesco-products.ts <html-file> <output-csv>');
    console.error('Example: ts-node parse-tesco-products.ts tesco.html main.csv');
    process.exit(1);
  }

  const htmlFilePath = args[0];
  const outputCsvFile = args[1];

  try {
    // Read the HTML file
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');

    // Parse the products
    const products = parseTescoProducts(htmlContent);

    // Check if file exists before writing
    const fileExistedBefore = fs.existsSync(outputCsvFile);

    // Write to CSV
    writeProductsToCsv(products, outputCsvFile);

    const action = fileExistedBefore ? 'Appended' : 'Created';

    console.log(`${action} ${products.length} products to ${outputCsvFile}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

// Export for use as a module
module.exports = { parseTescoProducts, writeProductsToCsv };