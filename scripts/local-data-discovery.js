const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

class LocalDataDiscovery {
  constructor(searchPaths = []) {
    this.searchPaths = searchPaths.length > 0 ? searchPaths : [
      path.join(__dirname, "..", "acs-data"),
      path.join(__dirname, "..", "certificates"),
      path.join(__dirname, "..", "coa-data"),
      "/Users/guppynft/Desktop", // Common location
      "/Users/guppynft/Downloads", // Downloads folder
    ];
    
    this.discovery = {
      searchPaths: this.searchPaths,
      totalFiles: 0,
      totalSize: 0,
      fileTypes: {},
      certificates: [],
      batches: {},
      validation: {
        complete: 0,
        incomplete: 0,
        corrupted: 0,
        missing: []
      },
      readinessAssessment: {}
    };
  }

  async initialize() {
    console.log(`${colors.bright}${colors.blue}🔍 LOCAL DATA DISCOVERY FOR ACS LABS COAs 🔍${colors.reset}`);
    console.log("=" .repeat(70));
    console.log("Discovering ACS Labs certificates from local filesystem");
    console.log("Searching for: PDFs, JSONs, images, QR codes, CSVs");
    console.log("Target: Production COAs for batch minting\n");
    
    console.log(`${colors.cyan}Search Locations:${colors.reset}`);
    this.searchPaths.forEach(searchPath => {
      const exists = fs.existsSync(searchPath);
      console.log(`  ${exists ? '✅' : '❌'} ${searchPath}`);
    });
    console.log();
  }

  async discoverFiles() {
    console.log(`${colors.cyan}🔍 Scanning for ACS certificate files...${colors.reset}`);
    
    const allFiles = [];
    
    for (const searchPath of this.searchPaths) {
      if (fs.existsSync(searchPath)) {
        console.log(`Scanning: ${searchPath}`);
        const files = await this.scanDirectory(searchPath);
        allFiles.push(...files);
      }
    }
    
    // Filter for potential ACS/COA files
    const acsFiles = allFiles.filter(file => this.isACSRelated(file.path));
    
    this.discovery.totalFiles = acsFiles.length;
    this.discovery.totalSize = acsFiles.reduce((sum, file) => sum + file.size, 0);
    
    console.log(`Found ${acsFiles.length} potential ACS certificate files`);
    console.log(`Total size: ${this.formatBytes(this.discovery.totalSize)}`);
    
    // Analyze file types
    this.analyzeFileTypes(acsFiles);
    
    return acsFiles;
  }

  async scanDirectory(dirPath, depth = 0, maxDepth = 3) {
    const files = [];
    
    if (depth > maxDepth) return files;
    
    try {
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          // Skip common non-data directories
          if (!this.shouldSkipDirectory(entry)) {
            const subFiles = await this.scanDirectory(fullPath, depth + 1, maxDepth);
            files.push(...subFiles);
          }
        } else if (stats.isFile()) {
          files.push({
            path: fullPath,
            name: entry,
            size: stats.size,
            modified: stats.mtime,
            extension: path.extname(entry).toLowerCase()
          });
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
    }
    
    return files;
  }

  shouldSkipDirectory(dirName) {
    const skipDirs = [
      'node_modules', '.git', '.DS_Store', 'Trash', 'tmp', 'temp',
      'cache', 'logs', 'system', 'library', 'applications'
    ];
    return skipDirs.some(skip => dirName.toLowerCase().includes(skip.toLowerCase()));
  }

  isACSRelated(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    const dirPath = path.dirname(filePath).toLowerCase();
    
    // Check for ACS/COA related keywords
    const keywords = [
      'acs', 'coa', 'certificate', 'lab', 'analysis', 'blockticity',
      'authenticity', 'quality', 'test', 'sample', 'batch'
    ];
    
    // Check filename and directory
    const hasKeyword = keywords.some(keyword => 
      fileName.includes(keyword) || dirPath.includes(keyword)
    );
    
    // Check file extensions
    const relevantExtensions = ['.pdf', '.json', '.csv', '.jpg', '.jpeg', '.png', '.txt'];
    const hasRelevantExtension = relevantExtensions.includes(path.extname(fileName));
    
    return hasKeyword || hasRelevantExtension;
  }

  analyzeFileTypes(files) {
    console.log(`\n${colors.cyan}📊 Analyzing file types...${colors.reset}`);
    
    const fileTypes = {};
    
    files.forEach(file => {
      const ext = file.extension || 'no-extension';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    });
    
    this.discovery.fileTypes = fileTypes;
    
    console.log(`File types discovered:`);
    Object.entries(fileTypes).forEach(([ext, count]) => {
      console.log(`  ${ext || '[no extension]'}: ${count} files`);
    });
  }

  async catalogCertificates(files) {
    console.log(`\n${colors.cyan}📋 Cataloging certificates...${colors.reset}`);
    
    const certificates = [];
    const batches = {};
    
    // Group files by potential certificate ID
    const groupedFiles = {};
    
    files.forEach(file => {
      const certId = this.extractCertificateId(file.name);
      if (!groupedFiles[certId]) {
        groupedFiles[certId] = [];
      }
      groupedFiles[certId].push(file);
    });
    
    console.log(`Found ${Object.keys(groupedFiles).length} potential certificate groups`);
    
    // Analyze each certificate group
    for (const [certId, fileGroup] of Object.entries(groupedFiles)) {
      const certificate = await this.analyzeCertificateGroup(certId, fileGroup);
      certificates.push(certificate);
      
      // Track batches
      if (certificate.batch) {
        if (!batches[certificate.batch]) {
          batches[certificate.batch] = [];
        }
        batches[certificate.batch].push(certificate);
      }
    }
    
    this.discovery.certificates = certificates;
    this.discovery.batches = batches;
    
    // Validation summary
    const validation = {
      complete: certificates.filter(c => c.status === 'complete').length,
      incomplete: certificates.filter(c => c.status === 'incomplete').length,
      corrupted: certificates.filter(c => c.status === 'corrupted').length
    };
    
    this.discovery.validation = validation;
    
    console.log(`Catalog Results:`);
    console.log(`  Total certificates: ${certificates.length}`);
    console.log(`  Complete: ${validation.complete}`);
    console.log(`  Incomplete: ${validation.incomplete}`);
    console.log(`  Batches identified: ${Object.keys(batches).length}`);
    
    return certificates;
  }

  extractCertificateId(fileName) {
    // Try to extract certificate ID from filename
    const matches = [
      fileName.match(/(ACS[-_]?\d+)/i),
      fileName.match(/(COA[-_]?\d+)/i),
      fileName.match(/(\d{4,})/),
      fileName.match(/(cert[-_]?\d+)/i),
      fileName.match(/(sample[-_]?\d+)/i)
    ];
    
    for (const match of matches) {
      if (match) return match[1];
    }
    
    // If no ID found, use base filename
    return path.parse(fileName).name;
  }

  async analyzeCertificateGroup(certId, files) {
    const certificate = {
      id: certId,
      files: files.map(file => ({
        path: file.path,
        name: file.name,
        size: file.size,
        modified: file.modified,
        extension: file.extension,
        type: this.classifyFileType(file.name)
      })),
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      batch: this.extractBatchInfo(files[0].path),
      hasMetadata: false,
      hasImage: false,
      hasQR: false,
      hasPDF: false,
      status: 'unknown',
      missingFiles: []
    };
    
    // Analyze file types
    certificate.files.forEach(file => {
      switch (file.type) {
        case 'metadata':
          certificate.hasMetadata = true;
          break;
        case 'image':
          certificate.hasImage = true;
          break;
        case 'qr':
          certificate.hasQR = true;
          break;
        case 'pdf':
          certificate.hasPDF = true;
          break;
      }
    });
    
    // Determine completeness
    const missingFiles = [];
    if (!certificate.hasMetadata && !certificate.hasPDF) missingFiles.push('metadata');
    if (!certificate.hasImage && !certificate.hasPDF) missingFiles.push('image');
    
    if (missingFiles.length === 0) {
      certificate.status = 'complete';
    } else {
      certificate.status = 'incomplete';
      certificate.missingFiles = missingFiles;
    }
    
    return certificate;
  }

  classifyFileType(fileName) {
    const name = fileName.toLowerCase();
    const extension = path.extname(name);
    
    if (['.json', '.txt', '.csv'].includes(extension) || name.includes('metadata')) {
      return 'metadata';
    }
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(extension)) {
      return 'image';
    }
    if (name.includes('qr') || name.includes('code')) {
      return 'qr';
    }
    if (extension === '.pdf') {
      return 'pdf';
    }
    return 'other';
  }

  extractBatchInfo(filePath) {
    const pathStr = filePath.toLowerCase();
    const batchMatch = pathStr.match(/(batch[-_]?\w+|group[-_]?\w+|\d{4}-\d{2})/i);
    return batchMatch ? batchMatch[1] : 'unknown';
  }

  async validateSampleFiles() {
    console.log(`\n${colors.cyan}🔍 Validating sample files...${colors.reset}`);
    
    const validation = {
      checkedFiles: 0,
      validFiles: 0,
      invalidFiles: 0,
      sampleResults: []
    };
    
    // Check first 10 certificates
    const sampleCerts = this.discovery.certificates.slice(0, 10);
    
    for (const cert of sampleCerts) {
      for (const file of cert.files) {
        try {
          // Check file accessibility and basic validation
          const stats = fs.statSync(file.path);
          
          if (file.type === 'metadata' && file.extension === '.json') {
            const content = fs.readFileSync(file.path, 'utf8');
            JSON.parse(content); // Validate JSON
          }
          
          validation.validFiles++;
          validation.sampleResults.push({
            file: file.name,
            status: 'valid',
            size: stats.size
          });
          
        } catch (error) {
          validation.invalidFiles++;
          validation.sampleResults.push({
            file: file.name,
            status: 'invalid',
            error: error.message
          });
        }
        
        validation.checkedFiles++;
      }
    }
    
    console.log(`Validation Results:`);
    console.log(`  Files checked: ${validation.checkedFiles}`);
    console.log(`  Valid: ${validation.validFiles}`);
    console.log(`  Invalid: ${validation.invalidFiles}`);
    
    return validation;
  }

  assessMintingReadiness() {
    console.log(`\n${colors.cyan}🎯 Assessing minting readiness...${colors.reset}`);
    
    const completeCertificates = this.discovery.certificates.filter(cert => cert.status === 'complete');
    const batchSizes = Object.values(this.discovery.batches).map(batch => batch.length);
    
    const assessment = {
      readyForMinting: completeCertificates.length,
      needsPreparation: this.discovery.validation.incomplete,
      recommendedBatchSize: this.calculateOptimalBatchSize(batchSizes),
      estimatedMintingTime: this.estimateMintingTime(completeCertificates.length),
      priorityBatches: this.identifyPriorityBatches(),
      dataPreparationNeeded: this.identifyDataPreparationNeeds()
    };
    
    this.discovery.readinessAssessment = assessment;
    
    console.log(`Minting Readiness Assessment:`);
    console.log(`  Ready for immediate minting: ${assessment.readyForMinting} certificates`);
    console.log(`  Require preparation: ${assessment.needsPreparation} certificates`);
    console.log(`  Recommended batch size: ${assessment.recommendedBatchSize}`);
    console.log(`  Estimated minting time: ${assessment.estimatedMintingTime}`);
    
    return assessment;
  }

  calculateOptimalBatchSize(batchSizes) {
    if (batchSizes.length === 0) return 25;
    const avgBatchSize = batchSizes.reduce((sum, size) => sum + size, 0) / batchSizes.length;
    return Math.min(Math.max(Math.floor(avgBatchSize), 10), 50);
  }

  estimateMintingTime(count) {
    const mintingRatePerSecond = 0.3;
    const totalSeconds = count / mintingRatePerSecond;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  identifyPriorityBatches() {
    return Object.entries(this.discovery.batches)
      .filter(([batchId, certs]) => certs.every(cert => cert.status === 'complete'))
      .map(([batchId, certs]) => ({
        batchId,
        count: certs.length,
        readiness: 'complete'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  identifyDataPreparationNeeds() {
    return this.discovery.certificates
      .filter(cert => cert.status === 'incomplete')
      .map(cert => ({
        certificateId: cert.id,
        missingFiles: cert.missingFiles,
        priority: cert.missingFiles.includes('metadata') ? 'high' : 'medium'
      }));
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async generateReport() {
    const report = {
      metadata: {
        title: "Local Data Discovery Report - ACS Labs COAs",
        timestamp: new Date().toISOString(),
        discoveryType: "Local Filesystem",
        searchPaths: this.searchPaths
      },
      summary: {
        totalFiles: this.discovery.totalFiles,
        totalSize: this.formatBytes(this.discovery.totalSize),
        certificatesFound: this.discovery.certificates.length,
        batchesIdentified: Object.keys(this.discovery.batches).length,
        readyForMinting: this.discovery.readinessAssessment.readyForMinting,
        needsPreparation: this.discovery.validation.incomplete
      },
      fileAnalysis: {
        fileTypes: this.discovery.fileTypes,
        searchLocations: this.searchPaths.map(searchPath => ({
          path: searchPath,
          exists: fs.existsSync(searchPath)
        }))
      },
      certificates: {
        total: this.discovery.certificates.length,
        byStatus: {
          complete: this.discovery.validation.complete,
          incomplete: this.discovery.validation.incomplete,
          corrupted: this.discovery.validation.corrupted
        },
        batches: Object.keys(this.discovery.batches).map(batchId => ({
          batchId,
          certificateCount: this.discovery.batches[batchId].length
        }))
      },
      validation: this.discovery.validation,
      mintingReadiness: this.discovery.readinessAssessment,
      recommendations: this.generateRecommendations()
    };
    
    // Save reports
    const reportPath = path.join(__dirname, "..", `local-discovery-report-${Date.now()}.json`);
    const inventoryPath = path.join(__dirname, "..", `local-certificate-inventory-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(inventoryPath, JSON.stringify(this.discovery.certificates, null, 2));
    
    console.log(`\n${colors.bright}${colors.blue}📊 LOCAL DATA DISCOVERY COMPLETE${colors.reset}`);
    console.log("=" .repeat(70));
    console.log(`${colors.green}Discovery Summary:${colors.reset}`);
    console.log(`Files Found: ${report.summary.totalFiles}`);
    console.log(`Total Size: ${report.summary.totalSize}`);
    console.log(`Certificates: ${report.summary.certificatesFound}`);
    console.log(`Ready for Minting: ${report.summary.readyForMinting}`);
    console.log(`Batches: ${report.summary.batchesIdentified}`);
    
    console.log(`\n${colors.cyan}Files Generated:${colors.reset}`);
    console.log(`📋 Full Report: ${path.basename(reportPath)}`);
    console.log(`📦 Certificate Inventory: ${path.basename(inventoryPath)}`);
    
    console.log(`\n${colors.yellow}Recommendations:${colors.reset}`);
    report.recommendations.forEach(rec => console.log(`• ${rec}`));
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    const assessment = this.discovery.readinessAssessment;
    
    if (assessment.readyForMinting === 0) {
      recommendations.push("⚠️  No complete certificates found. Check file locations and formats.");
      recommendations.push("💡 Consider using S3 discovery if data is stored remotely.");
    } else {
      recommendations.push(`✅ ${assessment.readyForMinting} certificates ready for minting`);
      recommendations.push(`📏 Use batch size of ${assessment.recommendedBatchSize} for optimal performance`);
    }
    
    if (this.discovery.totalFiles === 0) {
      recommendations.push("🔍 No ACS-related files found in search locations");
      recommendations.push("📁 Check if files are stored in different directories");
      recommendations.push("🏷️  Verify filename conventions contain 'ACS', 'COA', or 'certificate'");
    }
    
    recommendations.push("📥 For large datasets, consider S3-based discovery");
    recommendations.push("🔄 Re-run discovery after organizing or downloading more ACS data");
    
    return recommendations;
  }

  async run() {
    try {
      await this.initialize();
      
      const files = await this.discoverFiles();
      
      if (files.length === 0) {
        console.log(`${colors.yellow}⚠️  No ACS certificate files found in search locations${colors.reset}`);
        console.log("\nSuggestions:");
        console.log("1. Download ACS data from S3 to a local folder");
        console.log("2. Configure S3 access for remote discovery");
        console.log("3. Check if files are in different locations");
        return;
      }
      
      await this.catalogCertificates(files);
      await this.validateSampleFiles();
      this.assessMintingReadiness();
      
      const report = await this.generateReport();
      
      return report;
      
    } catch (error) {
      console.error(`\n${colors.red}Local data discovery failed:${colors.reset}`, error);
      process.exitCode = 1;
    }
  }
}

async function main() {
  // Custom search paths can be provided as command line arguments
  const customPaths = process.argv.slice(2);
  
  const discovery = new LocalDataDiscovery(customPaths);
  await discovery.run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});