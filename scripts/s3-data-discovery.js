const AWS = require("aws-sdk");
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

class S3DataDiscovery {
  constructor() {
    this.s3 = null;
    this.config = {
      bucketName: process.env.S3_BUCKET_NAME,
      region: process.env.S3_REGION || "us-east-1",
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      acsDataPrefix: process.env.ACS_DATA_PREFIX || "acs-lab-certificates/",
    };
    
    this.discovery = {
      connection: null,
      buckets: [],
      totalObjects: 0,
      totalSize: 0,
      fileTypes: {},
      certificates: [],
      batches: {},
      structure: {},
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
    console.log(`${colors.bright}${colors.blue}🔍 S3 DATA DISCOVERY FOR ACS LABS COAs 🔍${colors.reset}`);
    console.log("=" .repeat(70));
    console.log("Discovering and cataloging real ACS Labs certificates");
    console.log("Target: Production COAs for batch minting");
    console.log("Scope: Complete inventory and readiness assessment\n");
    
    await this.establishConnection();
  }

  async establishConnection() {
    console.log(`${colors.cyan}🔗 Establishing S3 Connection...${colors.reset}`);
    
    // Validate configuration
    if (!this.config.bucketName || !this.config.accessKeyId || !this.config.secretAccessKey) {
      throw new Error("S3 configuration incomplete. Check S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env");
    }
    
    try {
      // Initialize S3 client
      this.s3 = new AWS.S3({
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        region: this.config.region,
        timeout: 60000,
        maxRetries: 3
      });
      
      console.log(`Configuration:`);
      console.log(`  Bucket: ${this.config.bucketName}`);
      console.log(`  Region: ${this.config.region}`);
      console.log(`  ACS Prefix: ${this.config.acsDataPrefix}`);
      
      // Test connection
      await this.testConnection();
      
      this.discovery.connection = {
        status: "success",
        bucket: this.config.bucketName,
        region: this.config.region,
        timestamp: new Date().toISOString()
      };
      
      console.log(`${colors.green}✅ S3 connection established successfully${colors.reset}\n`);
      
    } catch (error) {
      console.log(`${colors.red}❌ S3 connection failed: ${error.message}${colors.reset}`);
      this.discovery.connection = {
        status: "failed",
        error: error.message,
        timestamp: new Date().toISOString()
      };
      throw error;
    }
  }

  async testConnection() {
    console.log(`Testing connection to bucket: ${this.config.bucketName}`);
    
    try {
      // Test bucket access
      await this.s3.headBucket({ Bucket: this.config.bucketName }).promise();
      console.log(`✅ Bucket access verified`);
      
      // Test list permissions
      const testList = await this.s3.listObjectsV2({
        Bucket: this.config.bucketName,
        MaxKeys: 1
      }).promise();
      
      console.log(`✅ List permissions verified`);
      console.log(`✅ Found ${testList.KeyCount || 0} objects (sample)`);
      
    } catch (error) {
      if (error.code === 'NoSuchBucket') {
        throw new Error(`Bucket '${this.config.bucketName}' does not exist`);
      } else if (error.code === 'Forbidden') {
        throw new Error("Access denied - check S3 credentials and permissions");
      } else {
        throw error;
      }
    }
  }

  async discoverBucketStructure() {
    console.log(`${colors.cyan}📁 Discovering bucket structure...${colors.reset}`);
    
    try {
      // Get all objects in the bucket
      const objects = await this.getAllObjects();
      
      this.discovery.totalObjects = objects.length;
      this.discovery.totalSize = objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      
      console.log(`Total objects found: ${this.discovery.totalObjects}`);
      console.log(`Total size: ${this.formatBytes(this.discovery.totalSize)}`);
      
      // Analyze file structure
      this.analyzeFileStructure(objects);
      
      // Filter ACS Labs specific data
      const acsObjects = objects.filter(obj => 
        obj.Key.toLowerCase().includes('acs') || 
        obj.Key.includes(this.config.acsDataPrefix.replace(/\/$/, ''))
      );
      
      console.log(`ACS Labs related objects: ${acsObjects.length}`);
      
      return { allObjects: objects, acsObjects };
      
    } catch (error) {
      console.log(`${colors.red}❌ Failed to discover bucket structure: ${error.message}${colors.reset}`);
      throw error;
    }
  }

  async getAllObjects() {
    const allObjects = [];
    let continuationToken = null;
    
    do {
      const params = {
        Bucket: this.config.bucketName,
        MaxKeys: 1000,
        ContinuationToken: continuationToken
      };
      
      const response = await this.s3.listObjectsV2(params).promise();
      allObjects.push(...response.Contents || []);
      continuationToken = response.NextContinuationToken;
      
      // Progress indicator
      if (allObjects.length % 1000 === 0) {
        console.log(`  Scanned ${allObjects.length} objects...`);
      }
      
    } while (continuationToken);
    
    return allObjects;
  }

  analyzeFileStructure(objects) {
    console.log(`\n${colors.cyan}📊 Analyzing file structure...${colors.reset}`);
    
    const structure = {};
    const fileTypes = {};
    
    objects.forEach(obj => {
      const key = obj.Key;
      const pathParts = key.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const extension = path.extname(fileName).toLowerCase();
      
      // Build directory structure
      let current = structure;
      pathParts.slice(0, -1).forEach(part => {
        if (!current[part]) current[part] = {};
        current = current[part];
      });
      
      // Count file types
      fileTypes[extension || 'no-extension'] = (fileTypes[extension || 'no-extension'] || 0) + 1;
    });
    
    this.discovery.structure = structure;
    this.discovery.fileTypes = fileTypes;
    
    console.log(`File types discovered:`);
    Object.entries(fileTypes).forEach(([ext, count]) => {
      console.log(`  ${ext || '[no extension]'}: ${count} files`);
    });
  }

  async catalogACSCertificates(acsObjects) {
    console.log(`\n${colors.cyan}📋 Cataloging ACS Lab certificates...${colors.reset}`);
    
    const certificates = [];
    const batches = {};
    const validationResults = {
      complete: 0,
      incomplete: 0,
      corrupted: 0,
      missing: []
    };
    
    // Group by potential certificate ID or batch
    const groupedObjects = {};
    
    acsObjects.forEach(obj => {
      const key = obj.Key;
      const fileName = path.basename(key);
      
      // Try to extract certificate ID or order ID from filename
      const certIdMatch = fileName.match(/(ACS[-_]?\d+|COA[-_]?\d+|\d{4,})/i);
      const certId = certIdMatch ? certIdMatch[1] : fileName;
      
      if (!groupedObjects[certId]) {
        groupedObjects[certId] = [];
      }
      groupedObjects[certId].push(obj);
    });
    
    console.log(`Found ${Object.keys(groupedObjects).length} potential certificate groups`);
    
    // Analyze each certificate group
    for (const [certId, objects] of Object.entries(groupedObjects)) {
      const certificate = await this.analyzeCertificateGroup(certId, objects);
      certificates.push(certificate);
      
      // Track batches
      if (certificate.batch) {
        if (!batches[certificate.batch]) {
          batches[certificate.batch] = [];
        }
        batches[certificate.batch].push(certificate);
      }
      
      // Validation tracking
      if (certificate.status === 'complete') {
        validationResults.complete++;
      } else if (certificate.status === 'incomplete') {
        validationResults.incomplete++;
        validationResults.missing.push(...certificate.missingFiles);
      } else {
        validationResults.corrupted++;
      }
    }
    
    this.discovery.certificates = certificates;
    this.discovery.batches = batches;
    this.discovery.validation = validationResults;
    
    console.log(`\nCatalog Results:`);
    console.log(`  Total certificates: ${certificates.length}`);
    console.log(`  Complete: ${validationResults.complete}`);
    console.log(`  Incomplete: ${validationResults.incomplete}`);
    console.log(`  Corrupted: ${validationResults.corrupted}`);
    console.log(`  Batches identified: ${Object.keys(batches).length}`);
    
    return certificates;
  }

  async analyzeCertificateGroup(certId, objects) {
    const certificate = {
      id: certId,
      files: objects.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        extension: path.extname(obj.Key).toLowerCase(),
        type: this.classifyFileType(obj.Key)
      })),
      totalSize: objects.reduce((sum, obj) => sum + obj.Size, 0),
      batch: this.extractBatchInfo(objects[0].Key),
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
    const requiredFiles = ['metadata', 'image'];
    const missingFiles = [];
    
    if (!certificate.hasMetadata) missingFiles.push('metadata');
    if (!certificate.hasImage) missingFiles.push('image');
    
    if (missingFiles.length === 0) {
      certificate.status = 'complete';
    } else {
      certificate.status = 'incomplete';
      certificate.missingFiles = missingFiles;
    }
    
    return certificate;
  }

  classifyFileType(key) {
    const fileName = path.basename(key).toLowerCase();
    const extension = path.extname(fileName);
    
    if (['.json', '.txt', '.csv'].includes(extension) || fileName.includes('metadata')) {
      return 'metadata';
    }
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(extension)) {
      return 'image';
    }
    if (fileName.includes('qr') || fileName.includes('code')) {
      return 'qr';
    }
    if (extension === '.pdf') {
      return 'pdf';
    }
    return 'other';
  }

  extractBatchInfo(key) {
    const batchMatch = key.match(/(batch[-_]?\w+|group[-_]?\w+|\d{4}-\d{2})/i);
    return batchMatch ? batchMatch[1] : 'unknown';
  }

  async validateDataIntegrity() {
    console.log(`\n${colors.cyan}🔍 Validating data integrity...${colors.reset}`);
    
    const validation = {
      totalChecked: 0,
      validFiles: 0,
      invalidFiles: 0,
      sampleResults: []
    };
    
    // Sample validation - check first 10 certificates
    const sampleCerts = this.discovery.certificates.slice(0, 10);
    
    for (const cert of sampleCerts) {
      console.log(`Validating certificate: ${cert.id}`);
      
      for (const file of cert.files) {
        try {
          // Check file accessibility
          const headResult = await this.s3.headObject({
            Bucket: this.config.bucketName,
            Key: file.key
          }).promise();
          
          validation.validFiles++;
          
          // For metadata files, try to download and parse a sample
          if (file.type === 'metadata' && file.size < 1024 * 1024) { // Less than 1MB
            try {
              const content = await this.downloadFile(file.key);
              if (file.extension === '.json') {
                JSON.parse(content); // Validate JSON
              }
              
              validation.sampleResults.push({
                file: file.key,
                status: 'valid',
                size: headResult.ContentLength,
                contentType: headResult.ContentType
              });
              
            } catch (parseError) {
              validation.sampleResults.push({
                file: file.key,
                status: 'invalid',
                error: 'Parse error'
              });
              validation.invalidFiles++;
            }
          }
          
        } catch (error) {
          validation.invalidFiles++;
          validation.sampleResults.push({
            file: file.key,
            status: 'error',
            error: error.message
          });
        }
        
        validation.totalChecked++;
      }
    }
    
    console.log(`Validation Results:`);
    console.log(`  Files checked: ${validation.totalChecked}`);
    console.log(`  Valid: ${validation.validFiles}`);
    console.log(`  Invalid: ${validation.invalidFiles}`);
    
    this.discovery.validation = { ...this.discovery.validation, ...validation };
    
    return validation;
  }

  async downloadFile(key) {
    const result = await this.s3.getObject({
      Bucket: this.config.bucketName,
      Key: key
    }).promise();
    
    return result.Body.toString();
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
      gasEstimate: this.estimateGasCosts(completeCertificates.length),
      priorityBatches: this.identifyPriorityBatches(),
      dataPreparationNeeded: this.identifyDataPreparationNeeds()
    };
    
    this.discovery.readinessAssessment = assessment;
    
    console.log(`Minting Readiness Assessment:`);
    console.log(`  Ready for immediate minting: ${assessment.readyForMinting} certificates`);
    console.log(`  Require preparation: ${assessment.needsPreparation} certificates`);
    console.log(`  Recommended batch size: ${assessment.recommendedBatchSize}`);
    console.log(`  Estimated minting time: ${assessment.estimatedMintingTime}`);
    console.log(`  Priority batches: ${assessment.priorityBatches.length}`);
    
    return assessment;
  }

  calculateOptimalBatchSize(batchSizes) {
    if (batchSizes.length === 0) return 25; // Default
    
    const avgBatchSize = batchSizes.reduce((sum, size) => sum + size, 0) / batchSizes.length;
    return Math.min(Math.max(Math.floor(avgBatchSize), 10), 50); // Between 10-50
  }

  estimateMintingTime(count) {
    const mintingRatePerSecond = 0.3; // Based on previous batch
    const totalSeconds = count / mintingRatePerSecond;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  estimateGasCosts(count) {
    const gasPerMint = 370000; // Based on previous mints
    const totalGas = count * gasPerMint;
    const gasPriceGwei = 25; // Current network gas price
    const costBTIC = (totalGas * gasPriceGwei * 1e-9).toFixed(6);
    
    return `${costBTIC} BTIC`;
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
      .slice(0, 5); // Top 5 priority batches
  }

  identifyDataPreparationNeeds() {
    const needs = [];
    
    this.discovery.certificates.forEach(cert => {
      if (cert.status === 'incomplete') {
        needs.push({
          certificateId: cert.id,
          missingFiles: cert.missingFiles,
          priority: cert.missingFiles.includes('metadata') ? 'high' : 'medium'
        });
      }
    });
    
    return needs;
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
        title: "S3 Data Discovery Report - ACS Labs COAs",
        timestamp: new Date().toISOString(),
        discoveryVersion: "1.0.0",
        targetBucket: this.config.bucketName
      },
      connection: this.discovery.connection,
      summary: {
        totalObjects: this.discovery.totalObjects,
        totalSize: this.formatBytes(this.discovery.totalSize),
        certificatesFound: this.discovery.certificates.length,
        batchesIdentified: Object.keys(this.discovery.batches).length,
        readyForMinting: this.discovery.readinessAssessment.readyForMinting,
        needsPreparation: this.discovery.validation.incomplete
      },
      bucketStructure: {
        fileTypes: this.discovery.fileTypes,
        directoryStructure: Object.keys(this.discovery.structure)
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
          certificateCount: this.discovery.batches[batchId].length,
          completionRate: (this.discovery.batches[batchId].filter(c => c.status === 'complete').length / this.discovery.batches[batchId].length * 100).toFixed(1) + '%'
        }))
      },
      validation: this.discovery.validation,
      mintingReadiness: this.discovery.readinessAssessment,
      recommendations: this.generateRecommendations()
    };
    
    // Save detailed report
    const reportPath = path.join(__dirname, "..", `s3-discovery-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Save certificate inventory
    const inventoryPath = path.join(__dirname, "..", `acs-certificate-inventory-${Date.now()}.json`);
    fs.writeFileSync(inventoryPath, JSON.stringify(this.discovery.certificates, null, 2));
    
    console.log(`\n${colors.bright}${colors.blue}📊 S3 DATA DISCOVERY COMPLETE${colors.reset}`);
    console.log("=" .repeat(70));
    console.log(`${colors.green}Discovery Summary:${colors.reset}`);
    console.log(`Total Objects: ${report.summary.totalObjects}`);
    console.log(`Total Size: ${report.summary.totalSize}`);
    console.log(`ACS Certificates Found: ${report.summary.certificatesFound}`);
    console.log(`Ready for Minting: ${report.summary.readyForMinting}`);
    console.log(`Batches Identified: ${report.summary.batchesIdentified}`);
    
    console.log(`\n${colors.cyan}Files Generated:${colors.reset}`);
    console.log(`📋 Full Report: ${path.basename(reportPath)}`);
    console.log(`📦 Certificate Inventory: ${path.basename(inventoryPath)}`);
    
    console.log(`\n${colors.yellow}Next Steps:${colors.reset}`);
    report.recommendations.forEach(rec => console.log(`• ${rec}`));
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    const assessment = this.discovery.readinessAssessment;
    
    if (assessment.readyForMinting > 0) {
      recommendations.push(`✅ ${assessment.readyForMinting} certificates ready for immediate batch minting`);
    }
    
    if (assessment.needsPreparation > 0) {
      recommendations.push(`⚠️  ${assessment.needsPreparation} certificates need data preparation before minting`);
    }
    
    if (assessment.priorityBatches.length > 0) {
      recommendations.push(`🎯 Start with priority batch: ${assessment.priorityBatches[0].batchId} (${assessment.priorityBatches[0].count} certificates)`);
    }
    
    recommendations.push(`📏 Use batch size of ${assessment.recommendedBatchSize} for optimal performance`);
    recommendations.push(`⏱️  Estimated total minting time: ${assessment.estimatedMintingTime}`);
    recommendations.push(`⛽ Estimated gas cost: ${assessment.gasEstimate}`);
    
    if (this.discovery.validation.invalidFiles > 0) {
      recommendations.push(`🔧 Fix ${this.discovery.validation.invalidFiles} corrupted files before minting`);
    }
    
    return recommendations;
  }

  async run() {
    try {
      await this.initialize();
      
      const { allObjects, acsObjects } = await this.discoverBucketStructure();
      
      if (acsObjects.length === 0) {
        console.log(`${colors.yellow}⚠️  No ACS Labs data found in bucket${colors.reset}`);
        console.log("Check the ACS_DATA_PREFIX configuration or bucket contents");
        return;
      }
      
      await this.catalogACSCertificates(acsObjects);
      await this.validateDataIntegrity();
      this.assessMintingReadiness();
      
      const report = await this.generateReport();
      
      return report;
      
    } catch (error) {
      console.error(`\n${colors.red}S3 Data Discovery failed:${colors.reset}`, error);
      process.exitCode = 1;
    }
  }
}

async function main() {
  const discovery = new S3DataDiscovery();
  await discovery.run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});