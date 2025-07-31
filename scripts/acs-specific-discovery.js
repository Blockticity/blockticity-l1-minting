const fs = require("fs");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

class ACSSpecificDiscovery {
  constructor() {
    this.searchPaths = [
      "/Users/guppynft/Desktop",
      "/Users/guppynft/Downloads",
      "/Users/guppynft/Documents",
      path.join(__dirname, "..")
    ];
    
    this.acsKeywords = [
      'acs lab', 'acs laboratory', 'acs_lab', 'acs-lab',
      'analytical chemistry', 'chemistry services',
      'laboratory certificate', 'lab certificate',
      'certificate of analysis', 'coa',
      'quality control', 'quality assurance'
    ];
    
    this.findings = {
      acsFolders: [],
      acsFiles: [],
      csvFiles: [],
      potentialBatches: [],
      productionData: []
    };
  }

  async initialize() {
    console.log(`${colors.bright}${colors.blue}🔬 ACS LABS SPECIFIC DATA DISCOVERY 🔬${colors.reset}`);
    console.log("=" .repeat(70));
    console.log("Focused search for real ACS Laboratory certificates");
    console.log("Looking for: Production COAs, CSV data, lab reports");
    console.log("Filtering out: Test data, demos, development files\n");
  }

  async searchForACSData() {
    console.log(`${colors.cyan}🔍 Searching for ACS Labs data...${colors.reset}`);
    
    for (const searchPath of this.searchPaths) {
      if (fs.existsSync(searchPath)) {
        console.log(`Scanning: ${searchPath}`);
        await this.scanForACSContent(searchPath);
      }
    }
    
    console.log(`\nACS Discovery Results:`);
    console.log(`  ACS-related folders: ${this.findings.acsFolders.length}`);
    console.log(`  ACS-related files: ${this.findings.acsFiles.length}`);
    console.log(`  CSV files: ${this.findings.csvFiles.length}`);
    console.log(`  Potential batches: ${this.findings.potentialBatches.length}`);
  }

  async scanForACSContent(dirPath, depth = 0, maxDepth = 4) {
    if (depth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          // Check if directory name suggests ACS content
          if (this.isACSRelatedDirectory(entry)) {
            this.findings.acsFolders.push({
              path: fullPath,
              name: entry,
              type: 'acs_directory'
            });
            
            // Deep scan ACS directories
            await this.scanForACSContent(fullPath, depth + 1, maxDepth + 2);
          } else if (!this.shouldSkipDirectory(entry)) {
            await this.scanForACSContent(fullPath, depth + 1, maxDepth);
          }
        } else if (stats.isFile()) {
          // Check files for ACS content
          if (this.isACSRelatedFile(entry, fullPath)) {
            this.findings.acsFiles.push({
              path: fullPath,
              name: entry,
              size: stats.size,
              modified: stats.mtime,
              type: this.classifyACSFile(entry)
            });
          }
          
          // Track CSV files separately (potential batch data)
          if (path.extname(entry).toLowerCase() === '.csv') {
            this.findings.csvFiles.push({
              path: fullPath,
              name: entry,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  isACSRelatedDirectory(dirName) {
    const name = dirName.toLowerCase();
    return this.acsKeywords.some(keyword => name.includes(keyword.toLowerCase()));
  }

  isACSRelatedFile(fileName, fullPath) {
    const name = fileName.toLowerCase();
    const pathStr = fullPath.toLowerCase();
    
    // Check for ACS keywords in filename or path
    const hasACSKeyword = this.acsKeywords.some(keyword => 
      name.includes(keyword.toLowerCase()) || pathStr.includes(keyword.toLowerCase())
    );
    
    // Check for specific ACS file patterns
    const acsPatterns = [
      /acs[-_]?\d+/i,
      /laboratory[-_]?certificate/i,
      /lab[-_]?report/i,
      /certificate[-_]?of[-_]?analysis/i,
      /quality[-_]?control/i
    ];
    
    const hasACSPattern = acsPatterns.some(pattern => pattern.test(name));
    
    // Check file extension relevance
    const relevantExtensions = ['.pdf', '.json', '.csv', '.txt', '.jpg', '.png'];
    const hasRelevantExtension = relevantExtensions.includes(path.extname(name));
    
    return (hasACSKeyword || hasACSPattern) && hasRelevantExtension;
  }

  classifyACSFile(fileName) {
    const name = fileName.toLowerCase();
    const ext = path.extname(name);
    
    if (name.includes('certificate') || name.includes('coa')) return 'certificate';
    if (name.includes('report') || name.includes('analysis')) return 'report';
    if (name.includes('batch') || name.includes('lot')) return 'batch';
    if (ext === '.csv') return 'data';
    if (['.jpg', '.png', '.pdf'].includes(ext)) return 'document';
    if (ext === '.json') return 'metadata';
    
    return 'other';
  }

  shouldSkipDirectory(dirName) {
    const skipDirs = [
      'node_modules', '.git', 'cache', 'logs', 'tmp', 'temp',
      'system', 'library', 'applications', 'trash'
    ];
    return skipDirs.some(skip => dirName.toLowerCase().includes(skip));
  }

  async analyzeCSVFiles() {
    console.log(`\n${colors.cyan}📊 Analyzing CSV files for production data...${colors.reset}`);
    
    for (const csvFile of this.findings.csvFiles) {
      try {
        console.log(`\nAnalyzing: ${csvFile.name}`);
        
        const content = fs.readFileSync(csvFile.path, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) continue;
        
        // Analyze headers
        const headers = lines[0].toLowerCase().split(',');
        const hasProductionHeaders = this.hasProductionDataHeaders(headers);
        
        // Check for ACS-specific columns
        const acsColumns = headers.filter(header => 
          header.includes('acs') || 
          header.includes('lab') || 
          header.includes('certificate') ||
          header.includes('coa') ||
          header.includes('analysis')
        );
        
        // Sample data analysis
        const sampleRows = lines.slice(1, Math.min(6, lines.length));
        const hasProductionData = this.analyzeSampleData(sampleRows);
        
        const analysis = {
          file: csvFile,
          headers: headers,
          rowCount: lines.length - 1,
          hasProductionHeaders,
          acsColumns,
          hasProductionData,
          isProductionCandidate: hasProductionHeaders && hasProductionData && acsColumns.length > 0
        };
        
        console.log(`  Rows: ${analysis.rowCount}`);
        console.log(`  ACS columns: ${acsColumns.length}`);
        console.log(`  Production candidate: ${analysis.isProductionCandidate ? '✅ YES' : '❌ NO'}`);
        
        if (analysis.isProductionCandidate) {
          this.findings.productionData.push(analysis);
        }
        
      } catch (error) {
        console.log(`  ❌ Failed to analyze: ${error.message}`);
      }
    }
  }

  hasProductionDataHeaders(headers) {
    const productionHeaders = [
      'order_id', 'certificate_id', 'coa_id', 'batch_id',
      'client', 'customer', 'product', 'sample',
      'date', 'timestamp', 'analysis', 'result',
      'volume', 'quantity', 'weight', 'purity'
    ];
    
    return productionHeaders.some(prodHeader => 
      headers.some(header => header.includes(prodHeader))
    );
  }

  analyzeSampleData(sampleRows) {
    // Check if data looks like real production data
    if (sampleRows.length === 0) return false;
    
    // Look for realistic data patterns
    const dataIndicators = [
      /\d{4}-\d{2}-\d{2}/, // Dates
      /ACS[-_]?\d+/i, // ACS IDs
      /\d+(\.\d+)?\s*(kg|lb|oz|g|ml|l)/i, // Quantities with units
      /\d+(\.\d+)?%/, // Percentages
      /batch|lot|sample/i // Production terms
    ];
    
    const hasRealisticData = sampleRows.some(row => 
      dataIndicators.some(pattern => pattern.test(row))
    );
    
    // Check for test/demo data indicators
    const testIndicators = [
      /test|demo|sample|example/i,
      /lorem|ipsum/i,
      /^1,2,3,4,5/, // Sequential test data
      /placeholder/i
    ];
    
    const hasTestData = sampleRows.some(row => 
      testIndicators.some(pattern => pattern.test(row))
    );
    
    return hasRealisticData && !hasTestData;
  }

  async identifyProductionBatches() {
    console.log(`\n${colors.cyan}🎯 Identifying production batches...${colors.reset}`);
    
    const batches = {};
    
    // Group ACS files by potential batch
    this.findings.acsFiles.forEach(file => {
      const batchId = this.extractBatchFromFile(file.path);
      if (!batches[batchId]) {
        batches[batchId] = [];
      }
      batches[batchId].push(file);
    });
    
    // Analyze each batch
    Object.entries(batches).forEach(([batchId, files]) => {
      const hasMetadata = files.some(f => f.type === 'metadata');
      const hasDocuments = files.some(f => f.type === 'document');
      const hasCertificates = files.some(f => f.type === 'certificate');
      
      const batch = {
        batchId,
        fileCount: files.length,
        hasMetadata,
        hasDocuments,
        hasCertificates,
        readiness: this.assessBatchReadiness(hasMetadata, hasDocuments, hasCertificates),
        files
      };
      
      this.findings.potentialBatches.push(batch);
      
      console.log(`Batch ${batchId}: ${files.length} files (${batch.readiness})`);
    });
  }

  extractBatchFromFile(filePath) {
    const pathStr = filePath.toLowerCase();
    
    // Try to extract batch info from path
    const batchPatterns = [
      /batch[-_]?(\w+)/i,
      /lot[-_]?(\w+)/i,
      /(\d{4}[-_]\d{2})/,
      /acs[-_]?(\d+)/i
    ];
    
    for (const pattern of batchPatterns) {
      const match = pathStr.match(pattern);
      if (match) return match[1];
    }
    
    return 'unknown';
  }

  assessBatchReadiness(hasMetadata, hasDocuments, hasCertificates) {
    if (hasMetadata && hasDocuments && hasCertificates) return 'complete';
    if (hasMetadata || hasDocuments) return 'partial';
    return 'minimal';
  }

  async generateACSReport() {
    const report = {
      metadata: {
        title: "ACS Labs Specific Data Discovery Report",
        timestamp: new Date().toISOString(),
        discoveryType: "ACS-Focused Search",
        searchPaths: this.searchPaths
      },
      summary: {
        acsFolders: this.findings.acsFolders.length,
        acsFiles: this.findings.acsFiles.length,
        csvFiles: this.findings.csvFiles.length,
        productionDataFiles: this.findings.productionData.length,
        potentialBatches: this.findings.potentialBatches.length
      },
      acsFindings: {
        folders: this.findings.acsFolders,
        files: this.findings.acsFiles.map(f => ({
          name: f.name,
          path: f.path,
          type: f.type,
          size: this.formatBytes(f.size)
        })),
        csvAnalysis: this.findings.csvFiles.map(f => ({
          name: f.name,
          path: f.path,
          size: this.formatBytes(f.size)
        }))
      },
      productionCandidates: this.findings.productionData.map(pd => ({
        fileName: pd.file.name,
        rowCount: pd.rowCount,
        acsColumns: pd.acsColumns,
        isCandidate: pd.isProductionCandidate
      })),
      batches: this.findings.potentialBatches.map(batch => ({
        batchId: batch.batchId,
        fileCount: batch.fileCount,
        readiness: batch.readiness
      })),
      recommendations: this.generateACSRecommendations()
    };
    
    // Save report
    const reportPath = path.join(__dirname, "..", `acs-specific-discovery-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n${colors.bright}${colors.blue}📋 ACS LABS DISCOVERY COMPLETE${colors.reset}`);
    console.log("=" .repeat(60));
    console.log(`${colors.green}ACS-Specific Findings:${colors.reset}`);
    console.log(`ACS Folders: ${report.summary.acsFolders}`);
    console.log(`ACS Files: ${report.summary.acsFiles}`);
    console.log(`CSV Files: ${report.summary.csvFiles}`);
    console.log(`Production Candidates: ${report.summary.productionDataFiles}`);
    console.log(`Potential Batches: ${report.summary.potentialBatches}`);
    
    if (this.findings.productionData.length > 0) {
      console.log(`\n${colors.cyan}🎯 Production Data Found:${colors.reset}`);
      this.findings.productionData.forEach(pd => {
        console.log(`  📄 ${pd.file.name} (${pd.rowCount} rows)`);
      });
    }
    
    console.log(`\n${colors.yellow}Recommendations:${colors.reset}`);
    report.recommendations.forEach(rec => console.log(`• ${rec}`));
    
    console.log(`\n📋 Detailed Report: ${path.basename(reportPath)}`);
    
    return report;
  }

  generateACSRecommendations() {
    const recommendations = [];
    
    if (this.findings.productionData.length > 0) {
      recommendations.push(`✅ Found ${this.findings.productionData.length} CSV files with production data structure`);
      recommendations.push(`🚀 Ready to proceed with batch minting using production CSV files`);
      
      const largestFile = this.findings.productionData.reduce((largest, current) => 
        current.rowCount > largest.rowCount ? current : largest
      );
      recommendations.push(`📊 Start with: ${largestFile.file.name} (${largestFile.rowCount} certificates)`);
    } else {
      recommendations.push(`⚠️  No production-ready CSV files found with ACS data structure`);
    }
    
    if (this.findings.acsFolders.length > 0) {
      recommendations.push(`📁 Explore ACS folders: ${this.findings.acsFolders.map(f => f.name).join(', ')}`);
    }
    
    if (this.findings.potentialBatches.length > 0) {
      const readyBatches = this.findings.potentialBatches.filter(b => b.readiness === 'complete');
      if (readyBatches.length > 0) {
        recommendations.push(`🎯 ${readyBatches.length} complete batches ready for minting`);
      }
    }
    
    if (this.findings.acsFiles.length === 0 && this.findings.acsFolders.length === 0) {
      recommendations.push(`🔍 No ACS Labs data found locally - check S3 for production data`);
      recommendations.push(`📥 Consider downloading ACS data from remote storage`);
    }
    
    recommendations.push(`📋 Configure S3 access to discover additional ACS data`);
    
    return recommendations;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async run() {
    try {
      await this.initialize();
      await this.searchForACSData();
      await this.analyzeCSVFiles();
      await this.identifyProductionBatches();
      
      const report = await this.generateACSReport();
      
      return report;
      
    } catch (error) {
      console.error(`\n${colors.red}ACS discovery failed:${colors.reset}`, error);
      process.exitCode = 1;
    }
  }
}

async function main() {
  const discovery = new ACSSpecificDiscovery();
  await discovery.run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});