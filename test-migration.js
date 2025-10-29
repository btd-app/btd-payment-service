#!/usr/bin/env node

/**
 * Test Migration to @btd/proto v2.2.0
 * Verifies that proto files are loaded correctly from the centralized package
 */

const {
  getServiceProtoPath,
  getHealthProtoPath,
  getProtoDir,
  getProtoStandardDir,
} = require('@btd/proto');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('BTD Payment Service - Proto Migration Verification');
console.log('='.repeat(60));

let exitCode = 0;

// Test 1: Verify helper functions work
console.log('\n1. Testing @btd/proto helper functions...');
try {
  const paymentProtoPath = getServiceProtoPath('payment');
  const healthProtoPath = getHealthProtoPath();
  const protoDir = getProtoDir();
  const standardDir = getProtoStandardDir();

  console.log('   ✓ Payment proto path:', paymentProtoPath);
  console.log('   ✓ Health proto path:', healthProtoPath);
  console.log('   ✓ Proto directory:', protoDir);
  console.log('   ✓ Standard directory:', standardDir);
} catch (error) {
  console.error('   ✗ Helper functions failed:', error.message);
  exitCode = 1;
}

// Test 2: Verify proto files exist
console.log('\n2. Verifying proto files exist...');
try {
  const paymentProtoPath = getServiceProtoPath('payment');
  const healthProtoPath = getHealthProtoPath();

  if (fs.existsSync(paymentProtoPath)) {
    console.log('   ✓ Payment proto exists');
  } else {
    console.error('   ✗ Payment proto NOT FOUND:', paymentProtoPath);
    exitCode = 1;
  }

  if (fs.existsSync(healthProtoPath)) {
    console.log('   ✓ Health proto exists');
  } else {
    console.error('   ✗ Health proto NOT FOUND:', healthProtoPath);
    exitCode = 1;
  }
} catch (error) {
  console.error('   ✗ Proto file check failed:', error.message);
  exitCode = 1;
}

// Test 3: Verify no local proto files
console.log('\n3. Verifying local proto directories removed...');
const localProtoDirs = [
  path.join(__dirname, 'src', 'proto'),
  path.join(__dirname, 'proto'),
  path.join(__dirname, 'dist', 'proto'),
];

let foundLocal = false;
localProtoDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    console.error('   ✗ Local proto directory still exists:', dir);
    foundLocal = true;
    exitCode = 1;
  }
});

if (!foundLocal) {
  console.log('   ✓ All local proto directories removed');
}

// Test 4: Verify package versions
console.log('\n4. Checking package versions...');
try {
  const packageJson = require('./package.json');
  const protoVersion = packageJson.dependencies['@btd/proto'];
  const sharedVersion = packageJson.dependencies['@btd/shared'];

  console.log('   ✓ @btd/proto:', protoVersion);
  console.log('   ✓ @btd/shared:', sharedVersion);

  if (!protoVersion.includes('2.2.0')) {
    console.error('   ✗ @btd/proto version should be ^2.2.0');
    exitCode = 1;
  }
  if (!sharedVersion.includes('2.1.15')) {
    console.error('   ✗ @btd/shared version should be ^2.1.15');
    exitCode = 1;
  }
} catch (error) {
  console.error('   ✗ Package version check failed:', error.message);
  exitCode = 1;
}

// Test 5: Verify proto package names
console.log('\n5. Verifying proto package names...');
try {
  const paymentProtoPath = getServiceProtoPath('payment');
  const paymentProtoContent = fs.readFileSync(paymentProtoPath, 'utf8');

  if (paymentProtoContent.includes('package btd.payment.v1')) {
    console.log('   ✓ Payment proto has correct package: btd.payment.v1');
  } else {
    console.error('   ✗ Payment proto package name incorrect');
    exitCode = 1;
  }

  const healthProtoPath = getHealthProtoPath();
  const healthProtoContent = fs.readFileSync(healthProtoPath, 'utf8');

  if (healthProtoContent.includes('package grpc.health.v1')) {
    console.log('   ✓ Health proto has correct package: grpc.health.v1');
  } else {
    console.error('   ✗ Health proto package name incorrect');
    exitCode = 1;
  }
} catch (error) {
  console.error('   ✗ Proto package verification failed:', error.message);
  exitCode = 1;
}

// Test 6: Verify build output
console.log('\n6. Verifying build output...');
const mainJsPath = path.join(__dirname, 'dist', 'main.js');
if (fs.existsSync(mainJsPath)) {
  const mainJs = fs.readFileSync(mainJsPath, 'utf8');

  if (mainJs.includes('getServiceProtoPath')) {
    console.log('   ✓ main.js uses getServiceProtoPath');
  } else {
    console.error('   ✗ main.js does not use getServiceProtoPath');
    exitCode = 1;
  }

  if (mainJs.includes("package: ['btd.payment.v1', 'grpc.health.v1']")) {
    console.log('   ✓ main.js has correct package names');
  } else {
    console.error('   ✗ main.js package names incorrect');
    exitCode = 1;
  }

  if (mainJs.includes('includeDirs')) {
    console.log('   ✓ main.js includes proto directories');
  } else {
    console.error('   ✗ main.js missing includeDirs configuration');
    exitCode = 1;
  }
} else {
  console.error('   ✗ Build output not found. Run: npm run build');
  exitCode = 1;
}

// Summary
console.log('\n' + '='.repeat(60));
if (exitCode === 0) {
  console.log('✓ All migration tests passed!');
  console.log('\nPayment service successfully migrated to @btd/proto v2.2.0');
  console.log('\nNext steps:');
  console.log('  1. Test gRPC server: npm run start:dev');
  console.log('  2. Verify health check: grpcurl -plaintext localhost:50055 grpc.health.v1.Health/Check');
  console.log('  3. Test payment operations');
} else {
  console.log('✗ Some migration tests failed!');
  console.log('\nPlease review the errors above and fix any issues.');
}
console.log('='.repeat(60) + '\n');

process.exit(exitCode);
