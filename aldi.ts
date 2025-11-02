import * as cheerio from 'cheerio';
import * as fs from 'fs';

interface Product {
  name: string;
  brand: string;
  amount: string;
  sourceId: number;
  sourceRef: string;
  country: string;
  category: string;
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
  source_id: number;
  source_ref: string;
}

/**
 * Converts a string to title case
 * @param s - The string to convert
 * @returns The string in title case
 */
export const toTitleCase = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) =>
      w.length && w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w,
    )
    .join(' ');

/**
 * Converts a Product to a CSV row format
 * @param product - The product to convert
 * @returns A CsvRow object
 */
function productToCsvRow(product: Product): CsvRow {
  return {
    barcode: '',
    product_name: product.name,
    amount: product.amount,
    unit: '',
    brand: product.brand || 'Aldi',
    categories_tags: '',
    categories_en: product.category,
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
 * Parses an Aldi HTML document and extracts product information
 * @param htmlContent - The HTML content as a string
 * @returns Array of Product objects
 */
function parseAldiProducts(htmlContent: string): Product[] {
  const products: Product[] = [];

  let htmlToProcess = htmlContent;

  // Check if the HTML STRUCTURE is escaped (not just text content)
  // Look for escaped HTML tags like &lt;div to determine this
  const trimmedContent = htmlContent.trim();
  const hasEscapedStructure = trimmedContent.startsWith('&lt;') ||
    htmlContent.includes('&lt;div') ||
    htmlContent.includes('&lt;p');

  if (hasEscapedStructure) {
    // Load the HTML with cheerio to extract the escaped content
    const $ = cheerio.load(htmlContent);

    // The actual product HTML is escaped within a paragraph tag
    // Extract the text content which contains escaped HTML
    let escapedHtml = $('p.p1 span.s1').text();

    // If not found, try to find it in the entire document
    if (!escapedHtml) {
      escapedHtml = $('p').first().text();
    }

    // If still not found, maybe the HTML is directly in the content
    if (!escapedHtml && htmlContent.includes('product-tile-')) {
      escapedHtml = htmlContent;
    }

    // Unescape HTML entities
    htmlToProcess = escapedHtml
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Load the HTML (either unescaped from above, or already unescaped)
  const $ = cheerio.load(htmlToProcess);

  // Find all product tiles - they have IDs starting with "product-tile-"
  $('[id^="product-tile-"]').each((index, element) => {
    const $tile = $(element);

    // Extract sourceRef from the id attribute
    // e.g., "product-tile-000000000000622208" -> "000000000000622208"
    const id = $tile.attr('id') || '';
    const sourceRef = id.replace('product-tile-', '');

    // Skip if we couldn't extract a valid sourceRef
    if (!sourceRef) {
      return;
    }

    // Extract name from .product-tile__name
    const name = $tile.find('.product-tile__name p').text().trim();

    // Extract brand from .product-tile__brandname
    const brand = $tile.find('.product-tile__brandname p').text().trim();

    // Extract amount from .product-tile__unit-of-measurement
    const amount = $tile.find('.product-tile__unit-of-measurement p').text().trim();

    // Only add product if we have at least a name
    if (name) {
      products.push({
        name,
        brand: toTitleCase(brand) || 'Aldi',
        amount,
        sourceId: 2,
        sourceRef,
        country: 'GB',
        category: 'Fresh Food'
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

  if (args.length === 0) {
    console.error('Usage: ts-node parse-aldi-products.ts <html-file-path> [output-csv-file]');
    console.error('Example: ts-node parse-aldi-products.ts aldi.html main.csv');
    console.error('\nIf no output file is specified, defaults to main.csv');
    process.exit(1);
  }

  const htmlFilePath = args[0];
  const outputCsvFile = args[1] || 'main.csv';

  try {
    // Read the HTML file
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');

    // Parse the products
    const products = parseAldiProducts(htmlContent);

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
module.exports = { parseAldiProducts, writeProductsToCsv, toTitleCase };