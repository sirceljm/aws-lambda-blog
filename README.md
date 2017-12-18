<img src="http://awsmedia.s3.amazonaws.com/AWS_Logo_PoweredBy_127px.png" alt="Powered by Amazon Web Services" align="right">

# LambdaBlogPlatform
## serverless blogging platform built with AWS

## Table of Contents
 * [About](#about)
 * [Installation prerequisites](#prerequisites)
 * [Installation](#installation)
 * [Advanced installation](#installation_advanced)

## <a name="about"></a>About
 ![alt tag](https://s3-us-west-2.amazonaws.com/s-media.si/static/img/LBP_perspective_UI.jpg)
AWS Lambda Blog Platform is a complete blogging solution that uses the following Amazon Web Services for operation:
 * API Gateway
 * Lambda
 * DynamoDB
 * S3
 * Cloudfront
 * SES

It runs completely serverless - free of any inflexible hardware infrastructure. The whole system running as a team of small microservices means that the running expenses are without any overhead even at the smallest scale.

## <a name="prerequisites"></a>Installation prerequisites
* Have an AWS account
* Have your domain/subdomain set up in Route53
* Make sure you can receive email at one of the following addresses for https certificate generation (if you dont have a mail server set up, you can use https://github.com/sirceljm/AWS-SES-simple-mail-forward to forward emails to your email address)
 * administrator@domain.com
 * hostmaster@domain.com
 * postmaster@domain.com
 * webmaster@domain.com
 * admin@domain.com

* Request a new certificate in AWS ACM (https://console.aws.amazon.com/acm/home?region=us-east-1#/) (THIS HAS TO BE ISSUED IN the __us-east-1__ REGION!!!)
 * If you are using just the domain - the certificate name should be _domain.com_
 * If you are using a subdomain - the certificate name should be _subdomain.domain.com_ or _*.domain.com_

## <a name="installation"></a>Installation
* Download this repo, unzip and cd to project folder
* Run ```npm install```
* Create a new user in IAM
 * [IAM -> Users -> Add User -> Access type -> check Programmatic access]
 * On the last step click on **Download .csv file** and save the file in project folder
* Add permissions to the user
 * [IAM -> Users -> your_user -> Permissions -> Add inline policy -> Custom policy]
 * Copy the following JSON and give your inline policy a name

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
                    "iam:PassRole",
                    "route53:ListHostedZones",
                    "acm:ListCertificates",
                    "iam:ListUserPolicies",
                    "iam:GetUserPolicy"
                ],
                "Resource": [
                    "*"
                ]
            }
        ]
    }
```
* The install script will add other permissions that are necessary for installation
* Run ```node install.js```
* The wizard will take you through the process of installation
* If everything went smoothly you should see your page after CloudFront changes resolve. This usually takes around 15 minutes.

## <a name="installation_advanced"></a>Advanced installation
* Download this repo, unzip and cd to project folder
* Run ```npm install```
* Create a new user in IAM (you will put this user name into `install_config.js` later)
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
 * Add a new inline policy to the user
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
                    "iam:PassRole",
                    "route53:ListHostedZones",
                    "acm:ListCertificates",
                    "iam:ListUserPolicies",
                    "iam:GetUserPolicy"
                ],
                "Resource": [
                    "*"
                ]
            }
        ]
    }
```

 -> Attach policy]

 * The install script will add other permissions that are necessary for installation
 * Copy and save the Hosted Zone ID for your domain
 ![alt tag](https://s3-us-west-2.amazonaws.com/s-media.si/static/img/hosted_zone.png)
 * Copy this certificate ARN - and paste it into `install_config.js`
 ![alt tag](https://s3-us-west-2.amazonaws.com/s-media.si/static/img/cert_arn.png)
 * Get your recaptcha key (you can edit this later in API Gateway)
 * Copy `install/install_config_template.js` to `install/install_config.js`
 * Change values in `install/install_config.js`
 * Run ```node install_advanced.js```
 * If everything went smoothly you should see your page after CloudFront changes resolve, which usually takes around 15 minutes
