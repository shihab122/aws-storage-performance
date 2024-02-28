#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { AwsStoragePerformanceStack } from '../lib/aws-storage-performance-stack';

const app = new cdk.App();
new AwsStoragePerformanceStack(app, 'AwsStoragePerformanceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  stackName: process.env.STACKNAME,
});
