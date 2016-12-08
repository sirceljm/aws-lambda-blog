# LambdaBlogPlatform
AWS LBP - Amazon Web Services Lambda Blog Platform
 ![alt tag](https://s3-us-west-2.amazonaws.com/s-media.si/static/img/LBP_perspective_UI.jpg)
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

 * download this repo, unzip and cd to project folder
 * run ```npm install```
 
 * Have an AWS account
 * Create a new user in IAM (you will put this user name into install_config.js later)
  * [IAM -> Users -> Add User -> Access type -> check Programmatic access]
 * Copy account keys for the user and make a json file that looks like this: 
 ![user_access_keys](https://s3-us-west-2.amazonaws.com/s-media.si/static/img/user_access_keys.png)

 ```json
 {
    "accessKeyId": "AK************", 
    "secretAccessKey": "BX**********************", 
    "region": "eu-west-1"
}
```
 * add anew inline policy to the user 
  * [IAM -> Users -> your_user -> Permissions -> Add inline policy -> Custom policy -> Select -> Copy JSON below and enter a policy name
  
   ```json

{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Stmt1481118325000",
            "Effect": "Allow",
            "Action": [
                "iam:CreatePolicy",
                "iam:CreateRole",
                "iam:GetPolicy",
                "iam:GetRole",
                "iam:AttachUserPolicy",
                "iam:AttachRolePolicy",
                "iam:PassRole"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
```

 -> Attach policy]

  * (install script will add other permisions that are necessary for installation)

 * Have a domain/subdomain set up in Route53 
 * Copy and save Hosted Zone ID for your domain
 ![alt tag](https://s3-us-west-2.amazonaws.com/s-media.si/static/img/hosted_zone.png)

 * request a new certificate in AWS ACM (https://console.aws.amazon.com/acm/home?region=us-east-1#/) for *.yourdomain.com (HAS TO BE ISSUED IN __us-east-1__ REGION!!!) - you will have to approve request by email
 * copy this certificate ARN - and paste it into install_config.js
 ![alt tag](https://s3-us-west-2.amazonaws.com/s-media.si/static/img/cert_arn.png)
 
 * get your recaptcha key (you can edit this later in API Gateway)
 * change values in install_config.js 
 * run ```node install.js```
 * if everything went smooth you should see your page after CloudFront changes resolve (usually takes around 15 minutes)
