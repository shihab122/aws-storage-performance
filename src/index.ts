import * as AWS from 'aws-sdk';
import * as fs from 'fs';

import { App, Stack, StackProps } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import config from '../configs/config.json';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';

enum StorageType {
  EBS = 'ebs',
  EFS = 'efs',
  S3 = 's3',
  S3FS = 's3fs',
}

enum EbsType {
  GP3 = 'gp3',
  IO2 = 'io2',
}

enum EfsType {
  STANDARD = 'standard',
  ONEZONE_IA = 'onezone_ia',
  IA = 'ia',
}

enum FileType {
  CSV = 'csv',
  JSON = 'json',
  PARQUET = 'parquet',
}

interface Storage {
  type: StorageType;
  ebsType?: EbsType;
  efsType?: EfsType;
}

interface File {
  type: FileType;
  local_path: string;
}

interface StorageConfig {
  storages: Storage[];
  file: File;
}

class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 3,
    });

    const ec2Instance = new ec2.Instance(this, 'Instance', {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: new ec2.AmazonLinuxImage(),
    });

    for (let i = 0; i < config.storages.length; i++) {
      const storage = config.storages[i];
      switch (storage.type) {
        case StorageType.EBS:
          break;
        case StorageType.EFS:
          break;
        case StorageType.S3:
          const bucketName = `bucket${i}`;
          const fileContent = ''; // Declare the fileContent variable
          new s3.Bucket(this, bucketName, {
            bucketName,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: true,
          });

          const fileUrl = await uploadToS3(bucketName, fileContent);
          await downloadFromS3(bucketName, fileUrl);

          break;

        case StorageType.S3FS:
          break;

        default:
          break;
      }
    }
  }
}

const uploadToS3 = async (bucketName: string, fileContent: any) => {
  const s3Client = new AWS.S3();
  const uploadResult = await s3Client
    .upload({ Bucket: bucketName, Key: 'file', Body: fileContent })
    .promise();
  const fileUrl = uploadResult.Location;
  return fileUrl;
};

const downloadFromS3 = async (bucketName: string, fileContent: string) => {
  const s3Client = new AWS.S3();
  await s3Client
    .getObject({ Bucket: bucketName, Key: 'file' })
    .createReadStream()
    .pipe(fs.createWriteStream(fileContent));
};

const app = new App();
new MyStack(app, 'MyStack', { env: { region: 'us-west-2' } });
