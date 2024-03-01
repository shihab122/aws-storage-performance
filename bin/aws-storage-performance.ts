#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';

import { AwsStoragePerformanceStack } from '../lib/aws-storage-performance-stack';

dotenv.config();

const app = new cdk.App();
new AwsStoragePerformanceStack(app, 'AwsStoragePerformanceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  stackName: process.env.STACKNAME,
});
