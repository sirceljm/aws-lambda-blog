# LambdaBlogPlatform
AWS LBP - Amazon Web Services Lambda Blog Platform

## About
AWS Lambda Blog Platform is a complete blogging solution that uses the following Amazon Web Services for operation
 * API Gateway
 * Lambda
 * DynamoDB
 * S3
 * Cloudfront
 * SES
 
Therefore it is free of any inflexible hardware infrastructure and running expenses are without any overhead even at the smallest scale.

## Installation

 * download this repo
 * ```npm install```
 
 * Have an AWS account
 * Have a domain/subdomain ready
 * Get your AWS account keys and make a json file that looks like this: 
 
 ```json
 {
    "accessKeyId": "AK************", 
    "secretAccessKey": "BX**********************", 
    "region": "eu-west-1"
}
```

 * request a new certificate in AWS ACM (https://console.aws.amazon.com/acm/home?region=us-east-1#/) for *.yourdomain.com (HAS TO BE ISSUED IN __us-east-1__ REGION!!!) - you will have to approve request by email
 * copy this certificate ARN - and paste it into install_config.js
 * edit other values in install_config.js
 * ```node install.js```
 * if everything went smooth you should see your page after CloudFront changes resolve (usually takes around 15 minutes)
