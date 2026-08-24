# tests/test_aws.py
# Confirms boto3 can authenticate to AWS with our credentials.
# This calls STS get_caller_identity — a free "who am I?" check.

import boto3

# Create a client for STS (Security Token Service).
sts = boto3.client("sts")

# Ask AWS who we are. If credentials work, this returns our account info.
identity = sts.get_caller_identity()

print("Success! Authenticated as:")
print("Account:", identity["Account"])
print("User ARN:", identity["Arn"])
