import * as path from 'path';

import { Stack, StackProps } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Size } from 'aws-cdk-lib';
import config from '../configs/config.json';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_efs as efs } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_s3_assets as s3_assets } from 'aws-cdk-lib';

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

enum PerformanceMode {
  GENERAL_PURPOSE = 'general_purpose',
  MAX_IO = 'max_io',
}

enum FileType {
  CSV = 'csv',
  JSON = 'json',
  PARQUET = 'parquet',
}

interface Storage {
  type: StorageType;
  ebsType?: EbsType;
  peformanceMode?: PerformanceMode;
  size?: number;
}

interface File {
  type: FileType;
  local_path: string;
}

interface StorageConfig {
  storages: Storage[];
  file: File;
}

interface AwsStoragePerformanceStackProps extends StackProps {
  storageConfig: StorageConfig;
}

export class AwsStoragePerformanceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC');
    const subnets = vpc.selectSubnets();
    const availabilityZone = subnets.subnets[0].availabilityZone;

    // Create IAM role
    const role = new iam.Role(this, 'aws-storage-performance-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    // Create security group
    const securityGroup = new ec2.SecurityGroup(
      this,
      'aws-storage-performance-sg',
      {
        vpc,
        allowAllOutbound: true,
        securityGroupName: 'aws-storage-performance-sg',
      }
    );

    // Allow SSH access
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

    // Create EC2 instance
    const ec2Instance = new ec2.Instance(
      this,
      'AWSStoragePerformanceInstance',
      {
        vpc,
        role,
        securityGroup,
        instanceName: 'AWSStoragePerformanceInstance',
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO
        ),
        machineImage: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        }),
      }
    );
    ec2Instance.role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess')
    );

    for (const [index, storage] of config.storages.entries()) {
      switch (storage.type) {
        case StorageType.EBS:
          this.createEBSVolume(
            role,
            index,
            availabilityZone,
            storage as Storage
          );
          break;
        case StorageType.EFS:
          this.createEFSFileSystem(
            vpc,
            securityGroup,
            ec2Instance,
            index,
            storage as Storage
          );
          break;
        case StorageType.S3:
          this.createS3Bucket(ec2Instance, index);
          break;
        case StorageType.S3FS:
          this.createS3FSBucket(ec2Instance, index);
          break;
        default:
          break;
      }
    }

    const s3Asset = new s3_assets.Asset(this, 'TestRunnerAsset', {
      path: path.join(__dirname, config.file.local_path),
    });
    s3Asset.grantRead(ec2Instance);
    ec2Instance.userData.addCommands(
      `sudo yum install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm`,
      `sudo systemctl start amazon-ssm-agent`,
      `aws s3 cp s3://${s3Asset.s3BucketName}/${s3Asset.s3ObjectKey} lib/test-runner/Test.docx`
      // `npx ts-node lib/test-runner/index.ts`
    );
  }

  private createEBSVolume(
    role: iam.Role,
    index: number,
    availabilityZone: string,
    storage: Storage
  ) {
    let volumeType = ec2.EbsDeviceVolumeType.GP3;
    let iops: number | undefined;

    if (storage.ebsType === EbsType.GP3) {
      volumeType = ec2.EbsDeviceVolumeType.GP3;
    } else if (storage.ebsType === EbsType.IO2) {
      volumeType = ec2.EbsDeviceVolumeType.IO2;
      iops = 100;
    }

    const volume = new ec2.Volume(
      this,
      `aws-storage-performance-ebs-${index}`,
      {
        availabilityZone,
        size: Size.gibibytes(storage.size || 8),
        volumeType,
        iops,
        volumeName: `aws-storage-performance-ebs-${index}`,
        encrypted: true,
      }
    );

    volume.grantAttachVolume(role);
    volume.applyRemovalPolicy(RemovalPolicy.DESTROY);
  }

  private createEFSFileSystem(
    vpc: ec2.Vpc,
    securityGroup: ec2.SecurityGroup,
    ec2Instance: ec2.Instance,
    index: number,
    storage: Storage
  ) {
    let performanceMode = efs.PerformanceMode.GENERAL_PURPOSE;

    if (storage.peformanceMode === PerformanceMode.MAX_IO) {
      performanceMode = efs.PerformanceMode.MAX_IO;
    }

    const fileSystem = new efs.FileSystem(
      this,
      `aws-storage-performance-efs-${index}`,
      {
        vpc,
        securityGroup,
        encrypted: true,
        lifecyclePolicy: efs.LifecyclePolicy.AFTER_7_DAYS,
        performanceMode,
        removalPolicy: RemovalPolicy.DESTROY,
        fileSystemName: `aws-storage-performance-efs-${index}`,
      }
    );

    fileSystem.connections.allowDefaultPortFrom(ec2Instance);
    ec2Instance.userData.addCommands(
      `sudo yum install -y amazon-efs-utils`,
      `sudo mkdir /mnt/efs-${index}`,
      `sudo mount -t efs -o tls ${fileSystem.fileSystemId}:/ /mnt/efs-${index}`
    );
  }

  private createS3Bucket(ec2Instance: ec2.Instance, index: number) {
    const bucket = new s3.Bucket(
      this,
      `aws-storage-performance-bucket-${index}`,
      {
        bucketName: `aws-storage-performance-bucket-${index}`,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      }
    );

    bucket.grantReadWrite(ec2Instance);
  }

  private createS3FSBucket(ec2Instance: ec2.Instance, index: number) {
    const s3fsBucket = new s3.Bucket(
      this,
      `aws-storage-performance-s3fs-bucket-${index}`,
      {
        bucketName: `aws-storage-performance-s3fs-bucket-${index}`,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      }
    );

    ec2Instance.userData.addCommands(
      'sudo yum install -y s3fs-fuse',
      'sudo mkdir /mnt/s3fs',
      `echo "${s3fsBucket.bucketName} /mnt/s3fs fuse.s3fs _netdev,allow_other 0 0" | sudo tee -a /etc/fstab`,
      'sudo mount -a'
    );
  }
}
