import * as fs from 'fs';

import { App, Stack, StackProps } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
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

export class AwsStoragePerformanceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC');

    const role = new iam.Role(this, 'aws-storage-performance-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    const securityGroup = new ec2.SecurityGroup(
      this,
      'aws-storage-performance-sg',
      {
        vpc,
        allowAllOutbound: true,
        securityGroupName: 'aws-storage-performance-sg',
      }
    );

    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

    const ec2Instance = new ec2.Instance(this, 'TestInstance', {
      vpc,
      role,
      securityGroup,
      instanceName: 'TestInstance',
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            deleteOnTermination: true,
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
    });
  }
}
