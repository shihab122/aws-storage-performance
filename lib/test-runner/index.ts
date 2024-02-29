import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';

import config from './config.json';

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

async function uploadToS3(bucketName: string): Promise<void> {
  try {
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
    };
    await s3.upload(params).promise();
    console.log(`Uploaded file to S3 bucket: ${bucketName}`);
  } catch (error) {
    console.error(`Error uploading file to S3 bucket ${bucketName}`);
  }
}

// Function to download a file from S3 bucket
async function downloadFromS3(bucketName: string): Promise<void> {
  try {
    const params = {
      Bucket: bucketName,
      Key: fileName,
    };
    await s3.getObject(params).promise();
    console.log(`Downloaded file from S3 bucket ${bucketName}}`);
  } catch (error) {
    console.error(`Error downloading file from S3 bucket ${bucketName}`);
  }
}

async function uploadToEFS(volumeName: string): Promise<void> {
  try {
    fs.writeFileSync(`/mnt/${volumeName}/${fileName}`, fileContent);
    console.log(`Uploaded file to EFS volume: ${volumeName}`);
  } catch (error) {
    console.error(`Error uploading file to EFS volume: ${volumeName}`);
  }
}

async function downloadFromEFS(volueName: string): Promise<void> {
  try {
    fs.readFileSync(`/mnt/${volueName}/${fileName}`, 'utf-8');
    console.log(`Downloaded file from EFS volume: ${volueName}`);
  } catch (error) {
    console.error(`Error downloading file from EFS volume: ${volueName}`);
  }
}

async function uploadToEBS(volumeName: string): Promise<void> {
  try {
    fs.writeFileSync(`/mnt/${volumeName}/${fileName}`, fileContent);
    console.log(`Uploaded file from EBS volume: ${volumeName}`);
  } catch (error) {
    console.error(`Error uploading file from EBS volume: ${volumeName}`);
  }
}

async function downloadFromEBS(volumeName: string): Promise<void> {
  try {
    fs.readFileSync(`/mnt/${volumeName}/${fileName}`, 'utf-8');
    console.log(`Downloaded file from EBS volume: ${volumeName}`);
  } catch (error) {
    console.error(`Error downloading file from EBS volume: ${volumeName}`);
  }
}

async function uploadToS3FS(bucketName: string): Promise<void> {
  try {
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
    };
    await s3.upload(params).promise();
    console.log(`Uploaded file to S3FS bucket: ${bucketName}`);
  } catch (error) {
    console.error(`Error uploading file to S3FS bucket ${bucketName}`);
  }
}

async function downloadFromS3FS(bucketName: string): Promise<void> {
  try {
    const params = {
      Bucket: bucketName,
      Key: fileName,
    };
    await s3.getObject(params).promise();
    console.log(`Downloaded file from S3FS bucket ${bucketName}}`);
  } catch (error) {
    console.error(`Error downloading file from S3FS bucket ${bucketName}`);
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
        const efsVolumeName = `aws-storage-performance-efs-${index}`;
        for (const _ of Array(10)) {
          await uploadToEFS(efsVolumeName);
          await downloadFromEFS(efsVolumeName);
        }
        break;
      case 'ebs':
        const ebsVolumeName = `aws-storage-performance-ebs-${index}`;
        for (const _ of Array(10)) {
          await uploadToEBS(ebsVolumeName);
          await downloadFromEBS(ebsVolumeName);
        }
        break;
      case 's3fs':
        const s3fsBucketName = `aws-storage-performance-s3fs-bucket-${index}`;
        for (const _ of Array(10)) {
          await uploadToS3FS(s3fsBucketName);
          await downloadFromS3FS(s3fsBucketName);
        }
        break;
      default:
        console.log(`Unsupported storage type: ${storage.type}`);
        break;
    }
  }
}

testStorage().catch((error) =>
  console.error('Error running storage tests:', error)
);
