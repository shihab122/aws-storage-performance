import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';

import config from './config.json';
import process from 'process';

interface LatencyReport {
  service: string;
  configuration?: string;
  operation: string;
  latency: number;
}

AWS.config.update({
  region: process.env.CDK_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.CDK_ACCCESS_KEY_ID || '',
    secretAccessKey: process.env.CDK_SECRET_ACCESS_KEY || '',
  },
});

const s3 = new AWS.S3();
const ec2 = new AWS.EC2();

const fileName = 'Test.docx';
const fileContent = fs.readFileSync(path.join(__dirname, fileName));

const report: LatencyReport[] = [];
const reportBucketName = process.env.REPORT_BUCKET_NAME || '';

async function uploadToS3(bucketName: string): Promise<void> {
  try {
    const startTime = new Date().getTime();
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
    };
    await s3.upload(params).promise();
    const endTime = new Date().getTime();
    const latency = (endTime - startTime) / 1000;
    report.push({
      service: 'S3',
      operation: 'upload',
      latency,
    });
    console.log(`Uploaded file to S3 bucket: ${bucketName}`);
  } catch (error) {
    console.error(`Error uploading file to S3 bucket ${bucketName}`);
  }
}

// Function to download a file from S3 bucket
async function downloadFromS3(bucketName: string): Promise<void> {
  try {
    const startTime = new Date().getTime();
    const params = {
      Bucket: bucketName,
      Key: fileName,
    };
    await s3.getObject(params).promise();
    const endTime = new Date().getTime();
    const latency = (endTime - startTime) / 1000;
    report.push({
      service: 'S3',
      operation: 'download',
      latency,
    });
    console.log(`Downloaded file from S3 bucket ${bucketName}}`);
  } catch (error) {
    console.error(`Error downloading file from S3 bucket ${bucketName}`);
  }
}

async function uploadToEFS(
  volumeName: string,
  peformanceMode?: string
): Promise<void> {
  try {
    const startTime = new Date().getTime();
    fs.writeFileSync(`/mnt/${volumeName}/${fileName}`, fileContent);
    const endTime = new Date().getTime();
    const latency = (endTime - startTime) / 1000;
    report.push({
      service: 'EFS',
      configuration: peformanceMode,
      operation: 'upload',
      latency,
    });
    console.log(`Uploaded file to EFS volume: ${volumeName}`);
  } catch (error) {
    console.error(`Error uploading file to EFS volume: ${volumeName}`);
  }
}

async function downloadFromEFS(
  volueName: string,
  performanceMode?: string
): Promise<void> {
  try {
    const startTime = new Date().getTime();
    fs.readFileSync(`/mnt/${volueName}/${fileName}`, 'utf-8');
    const endTime = new Date().getTime();
    const latency = (endTime - startTime) / 1000;
    report.push({
      service: 'EFS',
      configuration: performanceMode,
      operation: 'download',
      latency,
    });
    console.log(`Downloaded file from EFS volume: ${volueName}`);
  } catch (error) {
    console.error(`Error downloading file from EFS volume: ${volueName}`);
  }
}

async function uploadToEBS(
  volumeName: string,
  ebsType?: string
): Promise<void> {
  try {
    const startTime = new Date().getTime();
    fs.writeFileSync(`/mnt/${volumeName}/${fileName}`, fileContent);
    const endTime = new Date().getTime();
    const latency = (endTime - startTime) / 1000;
    report.push({
      service: 'EBS',
      configuration: ebsType,
      operation: 'upload',
      latency,
    });
    console.log(`Uploaded file from EBS volume: ${volumeName}`);
  } catch (error) {
    console.error(`Error uploading file from EBS volume: ${volumeName}`);
  }
}

async function downloadFromEBS(
  volumeName: string,
  ebsType?: string
): Promise<void> {
  try {
    const startTime = new Date().getTime();
    fs.readFileSync(`/mnt/${volumeName}/${fileName}`, 'utf-8');
    const endTime = new Date().getTime();
    const latency = (endTime - startTime) / 1000;
    report.push({
      service: 'EBS',
      configuration: ebsType,
      operation: 'download',
      latency,
    });
    console.log(`Downloaded file from EBS volume: ${volumeName}`);
  } catch (error) {
    console.error(`Error downloading file from EBS volume: ${volumeName}`);
  }
}

async function uploadToS3FS(volumeName: string): Promise<void> {
  try {
    const startTime = new Date().getTime();
    fs.writeFileSync(`/mnt/${volumeName}/${fileName}`, fileContent);
    const endTime = new Date().getTime();
    const latency = (endTime - startTime) / 1000;
    report.push({
      service: 'S3FS',
      operation: 'upload',
      latency,
    });
    console.log(`Uploaded file to S3FS bucket: ${volumeName}`);
  } catch (error) {
    console.error(`Error uploading file to S3FS bucket ${volumeName}`);
  }
}

async function downloadFromS3FS(volumeName: string): Promise<void> {
  try {
    const startTime = new Date().getTime();
    fs.readFileSync(`/mnt/${volumeName}/${fileName}`, 'utf-8');
    const endTime = new Date().getTime();
    const latency = (endTime - startTime) / 1000;
    report.push({
      service: 'S3FS',
      operation: 'download',
      latency,
    });
    console.log(`Downloaded file from S3FS bucket ${volumeName}}`);
  } catch (error) {
    console.error(`Error downloading file from S3FS bucket ${volumeName}`);
  }
}

async function uploadToS3ReportBucket(): Promise<void> {
  try {
    const params = {
      Bucket: reportBucketName,
      Key: 'report.json',
      Body: JSON.stringify(report),
    };
    await s3.upload(params).promise();
    console.log(`Uploaded report to S3 bucket: ${reportBucketName}`);
  } catch (error) {
    console.error(`Error uploading report to S3 bucket ${reportBucketName}`);
  }
}

async function testStorage(): Promise<void> {
  for (const [index, storage] of config.storages.entries()) {
    switch (storage.type) {
      case 's3':
        const bucketName = `aws-storage-performance-bucket-${index}`;
        for (const _ of Array(10)) {
          await uploadToS3(bucketName);
          await downloadFromS3(bucketName);
        }
        break;
      case 'efs':
        const efsVolumeName = `efs-${index}`;
        for (const _ of Array(10)) {
          await uploadToEFS(efsVolumeName, storage.peformanceMode);
          await downloadFromEFS(efsVolumeName, storage.peformanceMode);
        }
        break;
      case 'ebs':
        const ebsVolumeName = `ebs-${index}`;
        for (const _ of Array(10)) {
          await uploadToEBS(ebsVolumeName, storage.ebsType);
          await downloadFromEBS(ebsVolumeName, storage.ebsType);
        }
        break;
      case 's3fs':
        const s3fsVolumeName = `s3fs-${index}`;
        for (const _ of Array(10)) {
          await uploadToS3FS(s3fsVolumeName);
          await downloadFromS3FS(s3fsVolumeName);
        }
        break;
      default:
        console.log(`Unsupported storage type: ${storage.type}`);
        break;
    }
  }
  await uploadToS3ReportBucket();
}

testStorage().catch((error) =>
  console.error('Error running storage tests:', error)
);
