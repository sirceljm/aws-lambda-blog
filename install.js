var fs = require('fs');
var inquirer = require('inquirer');
var Rx = require('rx');
var unhandledRejection = require("unhandled-rejection");

var path = require("path");
var node_s3_client = require('s3');

var isThere = require("is-there");
var chalk = require('chalk');
var _ = require('lodash');
var parse_domain = require('domain-name-parser');

var MemoryFS = require("memory-fs");
var webpack = require("webpack");
var pass_generator = require('generate-password');
var uuid = require('uuid');

var zip = require("node-zip");

var Mocha = require('mocha');

var lambda_api_mappings = require('./install/install_Lambda_API_Gateway_mappings.json');

var api_gateway_definitions = require('./install/install_API_Gateway_definitions.json');
var installation_policy = require('./install/install_IAM_UserPolicy.json');
var role_policy = require('./install/install_IAM_RolePolicy.json');

let rejectionEmitter = unhandledRejection({
    timeout: 20
});

rejectionEmitter.on("unhandledRejection", (error, promise) => {
    // loggingServer.registerError(error);
});

rejectionEmitter.on("rejectionHandled", (error, promise) => {
    // loggingServer.registerHandled(error);
})

var co = require('co');

var credentials = null;

var AWS = null;
var iam = null;
var route53 = null;
var acm = null;

co(function *() {
    AWS = require('aws-sdk');

    var credentials_file = "credentials.csv";
    var user;
    var install_config = {
        main_domain: "",
        domain_name: "",
        api_gateway_stage_variables: {
            /* DON'T EDIT */
            "template": "default",

            "articles_bucket_path": "static/articles",

            "objects_table": "",
            "posts_table": "",

            "articles_bucket": "",

            "admin_pass": "",
            "token_name": "token",
            "signing_key": "",
            "recaptcha_siteKey": 'no_key',
            "recaptcha_privateKey": 'no_key',
            "disqus_subdomain": 'no_domain'
        }
    };

    function hostedZonesOptionsPromise () {
        return new Promise(function (resolve, reject) {
            route53.listHostedZones({}, function (err, data) {
                if (err) {
                    console.log("lllllllllllllllllllll");
                    reject(err, err.stack);
                } else {
                    var hosted_zones_options = [];
                    for (var i = 0; i < data.HostedZones.length; i++) {
                        hosted_zones_options.push({
                            name: data.HostedZones[i].Name.slice(0, -1),
                            value: {
                                name: data.HostedZones[i].Name.slice(0, -1),
                                id: data.HostedZones[i].Id.substring(12)
                            }
                        });
                    }
                    resolve(hosted_zones_options);
                }
            });
        });
    }

    function certificatesPromise () {
        return new Promise(function (resolve, reject) {
            acm.listCertificates({
                CertificateStatuses: ["ISSUED"]
            }, function (err, data) {
                if (err) {
                    reject(err, err.stack);
                } else {
                    resolve(data);
                }
            });
        });
    }

    var credentialsLoadedFirstTry = true;
    var credentialsLoadedFirstTryPromise = new Promise(function (resolve, reject) {
        credentialsLoadedFirstTryPromiseResolve = resolve;
    });

    var credentialsLoaded = false;
    var credentialsLoadedPromiseResolve;
    var credentialsLoadedPromise = new Promise(function (resolve, reject) {
        credentialsLoadedPromiseResolve = resolve;
    });

    var hostedZoneIsSetResolve;
    var hostedZoneIsSet = new Promise(function (resolve, reject) {
        hostedZoneIsSetResolve = resolve;
    });

    var domainIsSetResolve;
    var domainIsSet = new Promise(function (resolve, reject) {
        domainIsSetResolve = resolve;
    });

    var certificatesAvailablePromiseResolve;
    var certificatesAvailablePromise = new Promise(function (resolve, reject) {
        certificatesAvailablePromiseResolve = resolve;
    });


    var setupCompletedPromiseResolve;
    var setupCompletedPromise = new Promise(function (resolve, reject) {
        setupCompletedPromiseResolve = resolve;
    });

    var prompts = new Rx.Subject();


    inquirer.prompt(prompts).ui.process.subscribe(
        function (ans) {
            if (ans.name === "user_loaded") {

            }
            if (ans.name === "prefix") {
                install_config.role_name = ans.answer + "_role";
                install_config.install_policy_name = ans.answer + "_install_policy";
                install_config.role_policy_name = ans.answer + "_role_policy";

                install_config.lambda_prefix = ans.answer;
                install_config.table_prefix = ans.answer;
                install_config.api_gateway_name = ans.answer;


            }
            if (ans.name === "region") {
                AWS.config.update({
                    region: ans.answer
                });
                install_config.region = ans.answer;
            }
            if (ans.name === "hosted_zone") {
                install_config.main_domain = ans.answer.name;
                install_config.hosted_zone_id = ans.answer.id;

                hostedZoneIsSetResolve();
            }
            if (ans.name === "domain") {
                install_config.domain_name = ans.answer;
                install_config.bucket_name = install_config.lambda_prefix.toLowerCase() + "-" + ans.answer;
                install_config.cloudfront_comment = ans.answer + " - Awly";
                install_config.cloudfront_caller_reference = "lbp_cloudfront_caller_reference_" + ans.answer.toLowerCase();
                install_config.api_gateway_stage_variables.site_base_url = "https://" + ans.answer
                domainIsSetResolve();
            }
            if (ans.name === "cloudfront_certificate_arn") {
                install_config.cloudfront_certificate_arn = ans.answer;
            }
            if (ans.name === "api_gateway_deployment_name") {
                install_config.api_gateway_deployment_name = ans.answer
            }
            if (ans.name === "admin_password") {
                install_config.api_gateway_stage_variables.admin_pass = ans.answer;
            }
            if (ans.name === "email") {
                install_config.api_gateway_stage_variables.contact_send_email = ans.answer;
            }
            if (ans.name === "recaptcha_siteKey" && ans.answer) {
                install_config.api_gateway_stage_variables.recaptcha_siteKey = ans.answer;
            }
            if (ans.name === "recaptcha_privateKey" && ans.answer) {
                install_config.api_gateway_stage_variables.recaptcha_privateKey = ans.answer;
            }
            if (ans.name === "disqus_subdomain" && ans.answer) {
                install_config.api_gateway_stage_variables.disqus_subdomain = ans.answer;
            }
            if (ans.name === "disqus_subdomain") {
                setupCompletedPromiseResolve();
            }
        },
        function (err) {
            console.log('Error: ', err);
        },
        function () {
        }
    );

    var loadUserCredentials = function (file) {
        return new Promise(function (resolve, reject) {
            if (!fs.existsSync(file)) {
                credentialsLoadedFirstTryPromiseResolve();
                resolve("File " + file + " was not found. Please retry.");
            }
            var data = fs.readFileSync(file, "utf8").toString().split(/\r?\n/);
            var values = data[1].split(',');


            user = _.trim(values[0], '"\'');
            install_config.user_name = user;

            credentials = {
                accessKeyId: values[2],
                secretAccessKey: values[3]
            }

            AWS.config.update(credentials);

            var params = {
                UserName: user, /* required */
            };

            route53 = new AWS.Route53({apiVersion: '2013-04-01'});
            acm = new AWS.ACM({
                apiVersion: '2015-12-08',
                region: 'us-east-1'
            });

            iam = new AWS.IAM({apiVersion: '2010-05-08'});
            iam.listUserPolicies(params, function (err, data) {
                if (err) {
                    console.log("------------------------------------------");
                    console.log(err, err.stack); // an error occurred
                    credentialsLoadedFirstTryPromiseResolve();
                    resolve(err);
                } else {
                    if (data.PolicyNames.length === 0) {
                        resolve("User has no inline policies attached");
                    }
                    for (var i = 0; i < data.PolicyNames.length; i++) {
                        var params = {
                            PolicyName: data.PolicyNames[i], /* required */
                            UserName: user /* required */
                        };
                        iam.getUserPolicy(params, function (err, data) {
                            if (err) {
                                console.log(err, err.stack); // an error occurred
                                credentialsLoadedFirstTryPromiseResolve();
                            } else {
                                var policies_document = JSON.parse(decodeURIComponent(data.PolicyDocument));

                                var checkActions = function (actions) {
                                    if (actions.indexOf("iam:CreatePolicy") === -1) {
                                        return false;
                                    }
                                    if (actions.indexOf("iam:CreateRole") === -1) {
                                        return false;
                                    }
                                    if (actions.indexOf("iam:GetPolicy") === -1) {
                                        return false;
                                    }
                                    if (actions.indexOf("iam:GetRole") === -1) {
                                        return false;
                                    }
                                    if (actions.indexOf("iam:AttachUserPolicy") === -1) {
                                        return false;
                                    }
                                    if (actions.indexOf("iam:PassRole") === -1) {
                                        return false;
                                    }
                                    if (actions.indexOf("route53:ListHostedZones") === -1) {
                                        return false;
                                    }
                                    if (actions.indexOf("acm:ListCertificates") === -1) {
                                        return false;
                                    }
                                    return true;
                                }
                                for (var i = 0; i < policies_document.Statement.length; i++) {
                                    var policy_document = policies_document.Statement[i];

                                    if (policy_document.Effect === "Allow" && policy_document.Resource.indexOf("*") !== -1 && checkActions(policy_document.Action)) {
                                        credentialsLoaded = true;
                                        credentialsLoadedFirstTryPromiseResolve();
                                        credentialsLoadedPromiseResolve();
                                        resolve(true);
                                    } else {
                                        credentialsLoadedFirstTryPromiseResolve();
                                        resolve("User " + user + " does not have required permissions.");
                                    }
                                }
                            }
                        });
                    }

                }
            });
        })
    }

    loadUserCredentials(credentials_file);

    yield credentialsLoadedFirstTryPromise;

    if (!credentialsLoaded) {
        prompts.onNext({
            message: "File credentials.csv with required credentials was not found in this folder. Press Enter to refresh or enter path:",
            name: 'user_loaded',
            type: 'input',
            validate: function (value) {
                if (value === "") {
                    value = credentials_file;
                } else {
                    credentials_file = value;
                }

                if (!fs.existsSync(value)) {
                    return "File " + value + " was not found. Please retry.";
                } else {
                    return loadUserCredentials(value);
                }
            },
            required: true
        });
    }

    yield credentialsLoadedPromise;

    prompts.onNext({
        message: "Prefix for this installation",
        name: 'prefix',
        type: 'input',
        validate: function (value) {
            var pass = value.match(/^[a-zA-Z0-9]+$/i);
            if (pass) {
                return true;
            }

            return 'Prefix can contain only latin letters and numbers';
        },
        default: 'Awly',
        required: true
    });

    prompts.onNext({
        type: 'list',
        name: 'region',
        message: 'In which region do you want to install?',
        choices: [
            {
                name: 'US East (N. Virginia) - us-east-1',
                value: 'us-east-1'
            },
            {
                name: 'US East (Ohio) - us-east-2',
                value: 'us-east-2'
            },
            {
                name: 'US West (N. California) - us-west-1',
                value: 'us-west-1'
            },
            {
                name: 'US West (Oregon) - us-west-2',
                value: 'us-west-2'
            },
            /*{
             name: 'Canada (Central) - ca-central-1',
             value: 'ca-central-1'
             },*/
            {
                name: 'EU (Ireland) - eu-west-1',
                value: 'eu-west-1'
            },
            {
                name: 'EU (Frankfurt) - eu-central-1',
                value: 'eu-central-1'
            },
            {
                name: 'Asia Pacific (Tokyo) - ap-northeast-1',
                value: 'ap-northeast-1'
            },
            {
                name: 'Asia Pacific (Seoul) - ap-northeast-2',
                value: 'ap-northeast-2'
            },
            {
                name: 'Asia Pacific (Singapore) - ap-southeast-1',
                value: 'ap-southeast-1'
            },
            {
                name: 'Asia Pacific (Sydney) - ap-southeast-2',
                value: 'ap-southeast-2'
            },
            /*{
             name: 'Asia Pacific (Mumbai) - ap-south-1',
             value: 'ap-south-1'
             },
             {
             name: 'South America (São Paulo) - sa-east-1',
             value: 'sa-east-1'
             }*/
        ]
    });

    var hosted_zones_options = yield hostedZonesOptionsPromise();

    prompts.onNext({
        type: 'list',
        name: 'hosted_zone',
        message: 'Which hosted zone will you be using for this installation? (If you want to use a subdomain, you will be able to configure that on the next step)',
        choices: hosted_zones_options,
        required: true
    });

    prompts.onNext({
        type: 'input',
        name: 'domain',
        message: 'Enter a subdomain or leave blank if you want to use just your domain',
        required: true,
        validate: function (value) {
            var pass = value.match(/^(([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]|[a-zA-Z0-9])\.)*[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/);
            if (pass) {
                return true;
            }

            return 'Invalid subdomain. This would return: ' + value;
        },
        filter: function (value) {
            value = value.replace(new RegExp(install_config.main_domain.replace(".", "\\.") + "$"), "");
            value = value.replace(/\.$/, "");

            if (value == "") {
                return install_config.main_domain
            } else {
                return value + "." + install_config.main_domain
            }
        }
    });

    yield hostedZoneIsSet;
    yield domainIsSet;

    certificates = yield certificatesPromise();

    var filterCertificates = function (certificates, domain) {
        var d = parse_domain(domain);

        var filtered_certificates = [];
        var certs = certificates.CertificateSummaryList;

        for (var i = 0; i < certs.length; i++) {
            if (d.level(3) === null) { // no subdomain
                if (certs[i].DomainName === domain) {
                    filtered_certificates.push({
                        name: certs[i].DomainName + " - " + certs[i].CertificateArn,
                        value: certs[i].CertificateArn
                    });
                }
            } else { // subdomain
                if (certs[i].DomainName === "*." + d.domainName || certs[i].DomainName === domain || certs[i].DomainName === "*." + d.domain) {
                    filtered_certificates.push({
                        name: certs[i].DomainName + " - " + certs[i].CertificateArn,
                        value: certs[i].CertificateArn
                    });
                }
            }

        }

        if (filtered_certificates.length > 0) {
            certificatesAvailablePromiseResolve();
        }
        return filtered_certificates;
    }

    var filtered_certificates = filterCertificates(certificates, install_config.domain_name);

    if (filtered_certificates.length === 0) {
        prompts.onNext({
            type: 'input',
            name: 'certificates_wait',
            message: function () {
                if (install_config.main_domain === install_config.domain_name) { // domain
                    return "There are no validated " + install_config.main_domain + " certificates available in US East (N. Virginia) - us-east-1 region. Press Enter to refresh.";
                } else { // subdomain
                    return "There are no validated *." + install_config.main_domain + " certificates available in US East (N. Virginia) - us-east-1 region. Press Enter to refresh.";
                }

            },
            validate: function () {
                acm.listCertificates({
                    CertificateStatuses: ["ISSUED"]
                }, function (err, data) {
                    if (err) {
                        console.log(err, err.stack);
                    } else {
                        filtered_certificates = filterCertificates(data, install_config.domain_name);
                    }
                });

                return (filtered_certificates.length > 0 ? true : "Still no certificates available - make sure that certificate name is " +
                    (install_config.main_domain === install_config.domain_name ? install_config.main_domain : "*." + install_config.main_domain) +
                    ", that it is issued in US East (N. Virginia) - us-east-1 region, and that it is verified");
            },
            filter: function () {
                return "Certificates available"
            }
        });
    }

    yield certificatesAvailablePromise;

    prompts.onNext({
        type: 'list',
        name: 'cloudfront_certificate_arn',
        message: 'Choose certificate',
        choices: filtered_certificates,
        required: true
    });

    prompts.onNext({
        message: "API Gateway stage name",
        name: 'api_gateway_deployment_name',
        type: 'input',
        default: 'prod',
        validate: function (value) {
            var pass = value.match(/^[a-z]+$/i);
            if (pass) {
                return true;
            }

            return "API Gateway stage name is not valid. Please use only lowercase alphanumeric characters"
        },
        required: true
    });


    prompts.onNext({
        message: "Admin password",
        name: 'admin_password',
        type: 'input',
        validate: function (value) {
            var pass = value.match(/^[a-zA-Z0-9\-\.\_\:\/\?\&\=\,]+$/i);
            if (pass) {
                return true;
            }

            return "Admin password is not valid. Please use values with alphanumeric characters and the symbols '-', '.', '_', ':', '/', '?', '&', '=', and ','"
        },
        required: true
    });

    prompts.onNext({
        message: "Email address for contact form - you have to validate it in AWS SES",
        name: 'email',
        type: 'input',
        validate: function (value) {
            var pass = value.match(/^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i);
            if (pass) {
                return true;
            }

            return 'Email address is not valid';
        },
        required: true
    });

    prompts.onNext({
        type: 'input',
        name: 'recaptcha_siteKey',
        message: 'OPTIONAL - ReCaptcha site key - you can skip this & edit later in API gateway stage variables',
        required: false
    });

    prompts.onNext({
        type: 'input',
        name: 'recaptcha_privateKey',
        message: 'OPTIONAL - ReCaptcha private key - you can skip this & edit later in API gateway stage variables',
        required: false
    });

    prompts.onNext({
        type: 'input',
        name: 'disqus_subdomain',
        message: 'OPTIONAL - Disqus subdomain (______.disqus.com) you can skip this & edit later in API gateway stage variables',
        required: false
    });

    yield setupCompletedPromise;
    prompts.onCompleted();

    var config = install_config;

    console.log();
    console.log(chalk.bold.cyan("AWS Lambda Blog Platform install"));

    var lambda = new AWS.Lambda({apiVersion: '2015-03-31'});
    var s3 = new AWS.S3({
        signatureVersion: 'v4',
        apiVersion: '2006-03-01'
    });
    var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    var apigateway = new AWS.APIGateway({apiVersion: '2015-07-09'});
    var cloudfront = new AWS.CloudFront({apiVersion: '2016-09-07'});
    var sts = new AWS.STS();


    console.log();
    console.log(chalk.cyan("Getting user account ID"));
    var account_id = yield new Promise(function (resolve, reject) {
        sts.getCallerIdentity({}, function (err, data) {
            if (err) {
                console.log(chalk.red(err));
                console.log(err.stack);
                reject()
            } else {
                resolve(data.Account)
            }
        });
    });

    console.log();
    console.log(chalk.cyan("Creating policies"));

    var install_policy_arn = yield new Promise(function (resolve, reject) {
        iam.getPolicy({
            PolicyArn: "arn:aws:iam::" + account_id + ":policy/" + config.install_policy_name
        }, function (err, data) {
            if (err) {
                iam.createPolicy({
                    PolicyDocument: JSON.stringify(installation_policy),
                    PolicyName: config.install_policy_name
                }, function (err, data) {
                    if (err) {
                        console.log(chalk.red(err));
                        console.log(err.stack);
                        reject();
                    } else {
                        resolve(data.Policy.Arn);
                    }
                });
            } else {
                resolve(data.Policy.Arn);
            }
        });
    });

    var role_policy_arn = yield new Promise(function (resolve, reject) {
        iam.getPolicy({
            PolicyArn: "arn:aws:iam::" + account_id + ":policy/" + config.role_policy_name
        }, function (err, data) {
            if (err) {
                iam.createPolicy({
                    PolicyDocument: JSON.stringify(role_policy), /* required */
                    PolicyName: config.role_policy_name
                }, function (err, data) {
                    if (err) {
                        console.log(chalk.red(err));
                        console.log(err.stack);
                        reject();
                    } else {
                        resolve(data.Policy.Arn);
                    }
                });
            } else {
                resolve(data.Policy.Arn);
            }
        });
    });

    console.log();
    console.log(chalk.cyan("Waiting 5s for changes to propagate"));

    yield new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, 5000);
    });

    console.log();
    console.log(chalk.cyan("Attaching policy to the user"));

    yield new Promise(function (resolve, reject) {
        iam.attachUserPolicy({
            PolicyArn: install_policy_arn,
            UserName: config.user_name
        }, function (err, data) {
            if (err) {
                console.log(chalk.red(err));
                console.log(err.stack);
                reject()
            } else {
                console.log("Policy: " + chalk.green(config.install_policy_name) + " was attached to the user: " + chalk.yellow(config.user_name));
                resolve()
            }
        });
    })

    console.log();
    console.log(chalk.cyan("creating IAM role"));

    var role_arn = yield new Promise(function (resolve, reject) {
        iam.createRole({
            AssumeRolePolicyDocument: JSON.stringify({
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": {
                        "Service": ["lambda.amazonaws.com"]
                    },
                    "Action": ["sts:AssumeRole"]
                }]
            }),
            RoleName: config.role_name
        }, function (err, data) {
            if (err) {
                if (err.code === "EntityAlreadyExists") {
                    console.log(chalk.yellow(err));
                    iam.getRole({
                        RoleName: config.role_name
                    }, function (err, data) {
                        if (err) {
                            console.log(chalk.red(err));
                            console.log(err.stack);
                            reject();
                        } else {
                            resolve(data.Role.Arn);
                        }
                    });
                } else {
                    console.log(chalk.red(err));
                    console.log(err.stack);
                    reject();
                }
            } else {
                resolve(data.Role.Arn);
            }
        });
    });


    console.log();
    console.log(chalk.cyan("Attaching policy to the role"));

    yield new Promise(function (resolve, reject) {
        iam.attachRolePolicy({
            PolicyArn: role_policy_arn,
            RoleName: config.role_name
        }, function (err, data) {
            if (err) {
                console.log(chalk.red(err));
                console.log(err.stack);
                reject();
            } else {
                console.log("Policy: " + chalk.green(role_policy_arn) + " was attached to the role: " + chalk.yellow(config.role_name));
                resolve();
            }
        });
    });

    console.log();
    console.log(chalk.cyan("Waiting 10s for changes to propagate"));

    yield new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, 10000);
    });

    console.log();
    console.log(chalk.cyan("Creating S3 bucket"));
    yield new Promise(function (resolve, reject) {
        s3.createBucket({
            Bucket: config.bucket_name
        }, function (err, data) {
            if (err) {
                if (err.code === "BucketAlreadyOwnedByYou") {
                    console.log(chalk.yellow(err));
                    resolve();
                } else {
                    console.log(chalk.red(err));
                    console.log(err.stack);
                    reject();
                }
                reject();
            } else {
                console.log("S3 bucket: " + chalk.green(config.bucket_name) + " was created");
                resolve();
            }
        })
    });

    console.log();
    console.log(chalk.cyan("Configuring S3 bucket for website hosting"));
    yield new Promise(function (resolve, reject) {
        s3.putBucketWebsite({
            Bucket: config.bucket_name, /* required */
            WebsiteConfiguration: {
                /* required */
                ErrorDocument: {
                    Key: "error.html" /* required */
                },
                IndexDocument: {
                    Suffix: "index.html" /* required */
                }
            }
        }, function (err, data) {
            if (err) {
                console.log(chalk.red(err));
                console.log(err.stack);
                reject();
            } else {
                console.log("S3 bucket: " + chalk.green(config.bucket_name) + " was configured for website hosting");
                resolve();
            }
        });
    });

    console.log();
    console.log(chalk.cyan("Uploading files to S3 bucket"));

    yield new Promise(function (resolve, reject) {
        var public_dir = path.join(__dirname, "./public");
        var client = node_s3_client.createClient({
            s3Client: s3,
            maxAsyncS3: 20,     // this is the default
            s3RetryCount: 3,    // this is the default
            s3RetryDelay: 1000, // this is the default
            multipartUploadThreshold: 20971520, // this is the default (20 MB)
            multipartUploadSize: 15728640 // this is the default (15 MB)
        });

        var params = {
            localDir: path.join(__dirname, "./public"),
            deleteRemoved: false,

            s3Params: {
                Bucket: config.bucket_name,
                Prefix: "",
                ACL: "public-read"
            }
        };
        var uploader = client.uploadDir(params);
        uploader.on('error', function (err) {
            console.error("unable to sync:", err.stack);
            reject();
        });

        if (!uploader.filesFound) {
            console.log("no new files found");
            resolve();
        } else {
            var files_to_upload = 0;
            var files_uploaded = 0;
            uploader.on('fileUploadStart', function (localFilePath, s3Key) {
                files_to_upload++;
            });

            uploader.on('fileUploadEnd', function (localFilePath, s3Key) {
                files_uploaded++;

                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                process.stdout.write("Uploaded: " + files_uploaded + "/" + files_to_upload);

                if (files_uploaded === files_to_upload) {
                    resolve();
                }
            });
        }

    });


    console.log();
    console.log(chalk.cyan("Creating DynamoDB tables"));

    yield new Promise(function (resolve, reject) {
        var params = {
            AttributeDefinitions: [/* required */
                {
                    AttributeName: 'object_id', /* required */
                    AttributeType: 'S' /* required */
                },
                {
                    AttributeName: 'part', /* required */
                    AttributeType: 'N' /* required */
                }
                /* more items */
            ],
            KeySchema: [{
                AttributeName: 'object_id', /* required */
                KeyType: 'HASH' /* required */
            }, {
                AttributeName: 'part', /* required */
                KeyType: 'RANGE' /* required */
            }],
            ProvisionedThroughput: {
                /* required */
                ReadCapacityUnits: 1, /* required */
                WriteCapacityUnits: 1 /* required */
            },
            TableName: config.table_prefix + "_objects" /* required */
        };
        dynamodb.createTable(params, function (err, data) {
            if (err) {
                if (err.code === "ResourceInUseException") {
                    console.log(chalk.yellow(err));
                    resolve();
                } else {
                    console.log(chalk.red(err));
                    console.log(err.stack);
                    reject();
                }
                reject();
            } else {
                console.log("Table: " + chalk.green(config.table_prefix + "_objects") + " was created");
                resolve();
            }
        });
    })

    yield new Promise(function (resolve, reject) {
        var params = {
            AttributeDefinitions: [/* required */
                {
                    AttributeName: 'post_id', /* required */
                    AttributeType: 'S' /* required */
                }, {
                    AttributeName: 'post_status', /* required */
                    AttributeType: 'S' /* required */
                }, {
                    AttributeName: 'date', /* required */
                    AttributeType: 'N' /* required */
                }
            ],
            KeySchema: [{
                AttributeName: 'post_id', /* required */
                KeyType: 'HASH' /* required */
            }],
            ProvisionedThroughput: {
                /* required */
                ReadCapacityUnits: 1, /* required */
                WriteCapacityUnits: 1 /* required */
            },
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'post_status-date-index', /* required */
                    KeySchema: [/* required */
                        {
                            AttributeName: 'post_status', /* required */
                            KeyType: 'HASH' /* required */
                        }, {
                            AttributeName: 'date', /* required */
                            KeyType: 'RANGE' /* required */
                        }
                    ],
                    Projection: {
                        /* required */
                        ProjectionType: 'ALL'
                    },
                    ProvisionedThroughput: {
                        /* required */
                        ReadCapacityUnits: 1, /* required */
                        WriteCapacityUnits: 1 /* required */
                    }
                }
                /* more items */
            ],
            TableName: config.table_prefix + "_posts", /* required */
        };
        dynamodb.createTable(params, function (err, data) {
            if (err) {
                if (err.code === "ResourceInUseException") {
                    console.log(chalk.yellow(err));
                    resolve();
                } else {
                    console.log(chalk.red(err));
                    console.log(err.stack);
                    reject();
                }
                reject();
            } else {
                console.log("Table: " + chalk.green(config.table_prefix + "_posts") + " was created");
                resolve();
            }
        });
    });

    console.log();
    console.log(chalk.cyan("Populating DynamoDB tables with data"));

    var putToDB = function (table_name, data, err) {
        if (err) {
            console.log(chalk.red(err));
            console.log(err);
            reject();
        } else {
            return fn = co.wrap(function*() {
                for (var i = 0; i < data.length; i++) {
                    yield new Promise(function (resolve2, reject2) {
                        var db_item = {};
                        for (var key in data[i]) {
                            var db_key = key.split(" ")[0];
                            var db_key_type = key.split(" ")[1].replace(/[()]/g, "");

                            db_item[db_key] = {};
                            if (db_key === "JSON" || db_key === "categories") {
                                //db_item[db_key][db_key_type] = JSON.stringify(data[i][key]);
                                db_item[db_key][db_key_type] = data[i][key] + "";
                            } else if (db_key_type === "N") {
                                db_item[db_key][db_key_type] = data[i][key] + "";
                            } else {
                                db_item[db_key][db_key_type] = data[i][key];
                            }
                        }

                        var params = {
                            Item: db_item,
                            TableName: table_name, /* required */
                            ReturnValues: 'NONE'
                        };

                        dynamodb.putItem(params, function (err, data) {
                            if (err) {
                                console.log(chalk.red(err));
                                console.log(err.stack);
                                reject2();
                            } else {
                                console.log("An item was added into: " + chalk.green(table_name) + " table");
                                resolve2();
                            }
                        });
                    })
                }
            });
        }
    }

    var Converter = require("csvtojson").Converter;
    var converter = new Converter({});
    yield new Promise(function (resolve, reject) {
        var converter = new Converter({});
        converter.fromFile("./install/install_objects.csv", function (err, result) {
            var params = {
                TableName: config.table_prefix + "_objects"
            };
            dynamodb.waitFor('tableExists', params, function (err, data) {
                if (err) {
                    console.log(err, err.stack);
                } else {
                    putToDB(config.table_prefix + "_objects", result, err)().then(function () {
                        resolve();
                    });
                }
            });

        });
    });

    yield new Promise(function (resolve, reject) {
        var converter = new Converter({});
        converter.fromFile("./install/install_posts.csv", function (err, result) {
            var params = {
                TableName: config.table_prefix + "_posts"
            };
            dynamodb.waitFor('tableExists', params, function (err, data) {
                if (err) {
                    console.log(err, err.stack);
                } else {
                    putToDB(config.table_prefix + "_posts", result, err)().then(function () {
                        resolve();
                    });
                }
            });
        });
    });

    console.log();
    console.log(chalk.cyan("Uploading Lambda functions & creating API gateway endpoints"));

    function getFiles(srcpath) {
        return fs.readdirSync(srcpath).filter(function (file) {
            return !fs.statSync(path.join(srcpath, file)).isDirectory();
        });
    }

    function getEntries() {
        var public_files = getFiles(path.join(__dirname, "./lambdas/src/public"))
            .map(filename => {
                return {
                    name: filename,
                    path: path.join(
                        path.join(__dirname, "./lambdas/src/public"),
                        filename
                    )
                };
            })

        var admin_files = getFiles(path.join(__dirname, "./lambdas/src/admin"))
            .map(filename => {
                return {
                    name: filename,
                    path: path.join(
                        path.join(__dirname, "./lambdas/src/admin"),
                        filename
                    )
                };
            })
        return public_files.concat(admin_files);
    }


    var entries = getEntries();
    for (var i = 0; i < entries.length; i++) {
        yield new Promise(function (resolve, reject) {
            var array = fs.readFileSync(entries[i].path).toString().split("\n");
            var first_line = array[0];
            var fn_name_without_prefix = first_line.substring(3).trim();
            var lambda_fn_name = config.lambda_prefix + "_" + fn_name_without_prefix;

            console.log("Creating lambda function: " + chalk.green(lambda_fn_name));

            var mfs = new MemoryFS();
            var compiler = webpack({
                entry: entries[i].path,
                output: {
                    path: __dirname,
                    libraryTarget: "commonjs2",
                    filename: "compiled.js"
                },
                externals: {
                    "aws-sdk": "aws-sdk"
                },
                target: "node",

                module: {
                    loaders: [{
                        test: /\.json$/,
                        loader: 'json'
                    }]
                },

            }, function (err, stats) {
                if (err) {
                    console.log(chalk.red(err));
                    console.log(err);
                }
            });
            compiler.outputFileSystem = mfs;

            compiler.run(function (err, stats) {
                var zip = new JSZip();

                zip.file(entries[i].name, mfs.readFileSync(__dirname + "/" + "compiled.js"));
                var data = zip.generate({type: "uint8array", compression: 'deflate'});

                var params = {
                    Code: {
                        ZipFile: data
                    },
                    FunctionName: lambda_fn_name,
                    Handler: path.basename(entries[i].name, '.js') + ".handler",
                    Role: role_arn,
                    Runtime: "nodejs4.3",
                    //Description: 'STRING_VALUE',
                    MemorySize: 512,
                    Publish: true,
                    Timeout: 10
                };

                lambda.createFunction(params, function (err, data) {
                    if (err) {
                        if (err.code == "ResourceConflictException") {
                            console.log(chalk.yellow(err));
                            lambda.getFunction({
                                FunctionName: lambda_fn_name
                            }, function (err, data) {
                                if (err) {
                                    console.log(chalk.red(err));
                                    console.log(err.stack);
                                } else {
                                    lambda.addPermission({
                                        Action: 'lambda:*',
                                        FunctionName: lambda_fn_name,
                                        Principal: 'apigateway.amazonaws.com',
                                        StatementId: uuid.v4(),
                                    }, function (err, data) {
                                        if (err) {
                                            console.log(err, err.stack); // an error occurred
                                        } else {
                                            //console.log(JSON.parse(data.Statement).Resource);
                                            lambda_api_mappings[fn_name_without_prefix].lambda_arn = JSON.parse(data.Statement).Resource;
                                            resolve();
                                        }
                                    });
                                }
                            });
                        } else {
                            console.log(chalk.red(err));
                            console.log(err.stack);
                        }
                    } else {
                        lambda.addPermission({
                            Action: 'lambda:*',
                            FunctionName: lambda_fn_name,
                            Principal: 'apigateway.amazonaws.com',
                            StatementId: uuid.v4(),
                        }, function (err, data) {
                            if (err) {
                                console.log(err, err.stack); // an error occurred
                            } else {
                                //console.log(data);
                                lambda_api_mappings[fn_name_without_prefix].lambda_arn = JSON.parse(data.Statement).Resource;
                                resolve();
                            }
                        });
                    }
                });

            });
        });
    }

    api_gateway_definitions.info.title = config.api_gateway_name;

    for (var key in lambda_api_mappings) {
        if (lambda_api_mappings[key].resource.constructor === Array) {
            for (var i = 0; i < lambda_api_mappings[key].resource.length; i++) {
                if (api_gateway_definitions.paths[lambda_api_mappings[key].resource[i]].post) {
                    api_gateway_definitions.paths[lambda_api_mappings[key].resource[i]].post["x-amazon-apigateway-integration"].uri = "arn:aws:apigateway:" + config.region + ":lambda:path/2015-03-31/functions/" + lambda_api_mappings[key].lambda_arn + "/invocations";
                }
                if (api_gateway_definitions.paths[lambda_api_mappings[key].resource[i]].get) {
                    api_gateway_definitions.paths[lambda_api_mappings[key].resource[i]].get["x-amazon-apigateway-integration"].uri = "arn:aws:apigateway:" + config.region + ":lambda:path/2015-03-31/functions/" + lambda_api_mappings[key].lambda_arn + "/invocations";
                }
            }
        } else {
            if (api_gateway_definitions.paths[lambda_api_mappings[key].resource].post) {
                api_gateway_definitions.paths[lambda_api_mappings[key].resource].post["x-amazon-apigateway-integration"].uri = "arn:aws:apigateway:" + config.region + ":lambda:path/2015-03-31/functions/" + lambda_api_mappings[key].lambda_arn + "/invocations";
            }
            if (api_gateway_definitions.paths[lambda_api_mappings[key].resource].get) {
                api_gateway_definitions.paths[lambda_api_mappings[key].resource].get["x-amazon-apigateway-integration"].uri = "arn:aws:apigateway:" + config.region + ":lambda:path/2015-03-31/functions/" + lambda_api_mappings[key].lambda_arn + "/invocations";
            }
        }
    }

    var api_id = yield new Promise(function (resolve, reject) {
        apigateway.getRestApis({}, function (err, data) {
            if (err) {
                console.log(err, err.stack);
                reject();
            } else {
                var found_api_gateway = _.find(data.items, {'name': config.api_gateway_name});
                if (found_api_gateway) {
                    console.log();
                    console.log(chalk.yellow("API Gateway with name: " + config.api_gateway_name + " already exists"));
                    resolve(found_api_gateway.id);
                } else {
                    apigateway.importRestApi({
                        body: JSON.stringify(api_gateway_definitions),
                        failOnWarnings: true,
                    }, function (err, data) {
                        if (err) {
                            console.log(chalk.red(err));
                            console.log(err.stack);
                            reject();
                        } else {
                            console.log();
                            console.log("API Gateway: " + chalk.green(config.api_gateway_name) + " was created");
                            resolve(data.id);
                        }
                    });
                }
            }
        });
    });

    config.api_gateway_stage_variables.objects_table = config.table_prefix + "_objects";
    config.api_gateway_stage_variables.posts_table = config.table_prefix + "_posts";

    config.api_gateway_stage_variables.articles_bucket = config.bucket_name;

    config.api_gateway_stage_variables.signing_key = pass_generator.generate({
        length: 20,
        numbers: true,
        symbols: false,
        uppercase: true
    });

    var deployment_id = yield new Promise(function (resolve, reject) {
        var params = {
            restApiId: api_id,
            stageName: 'prod',
            cacheClusterEnabled: false,
            variables: config.api_gateway_stage_variables
        };
        apigateway.createDeployment(params, function (err, data) {
            if (err) {
                console.log(err, err.stack);
            } else {
                resolve(data.id);
            }

        });
    });

    console.log();
    console.log(chalk.cyan("Configuring cloudfront"));
    var cloudfront_domain = yield new Promise(function (resolve, reject) {
        var cloudfront_params = {
            DistributionConfig: {
                /* required */
                CallerReference: config.cloudfront_caller_reference, /* required */
                Comment: config.cloudfront_comment, /* required */
                DefaultCacheBehavior: {
                    /* required */
                    ForwardedValues: {
                        /* required */
                        Cookies: {
                            /* required */
                            Forward: 'all', /* required */
                            WhitelistedNames: {
                                Quantity: 0, /* required */
                                Items: []
                            }
                        },
                        QueryString: true, /* required */
                        Headers: {
                            Quantity: 0, /* required */
                            Items: []
                        },
                        QueryStringCacheKeys: {
                            Quantity: 0, /* required */
                            Items: []
                        }
                    },
                    MinTTL: 0, /* required */
                    TargetOriginId: "Custom-" + api_id + ".execute-api." + config.region + ".amazonaws.com/" + config.api_gateway_deployment_name, /* required */
                    TrustedSigners: {
                        /* required */
                        Enabled: false, /* required */
                        Quantity: 0, /* required */
                        Items: []
                    },
                    ViewerProtocolPolicy: 'redirect-to-https', /* required */
                    AllowedMethods: {
                        Items: [/* required */
                            'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'
                            /* more items */
                        ],
                        Quantity: 7, /* required */
                        CachedMethods: {
                            Items: [/* required */
                                'GET', 'HEAD',
                                /* more items */
                            ],
                            Quantity: 2 /* required */
                        }
                    },
                    Compress: true,
                    DefaultTTL: 0,
                    LambdaFunctionAssociations: {
                        Quantity: 0
                    },
                    MaxTTL: 0,
                    SmoothStreaming: false
                },
                Enabled: true, /* required */
                Origins: {
                    /* required */
                    Quantity: 2, /* required */
                    Items: [
                        {
                            DomainName: api_id + ".execute-api." + config.region + ".amazonaws.com",
                            Id: "Custom-" + api_id + ".execute-api." + config.region + ".amazonaws.com/" + config.api_gateway_deployment_name, /* required */
                            CustomHeaders: {
                                Quantity: 0, /* required */
                                Items: []
                            },
                            CustomOriginConfig: {
                                HTTPPort: 80, /* required */
                                HTTPSPort: 443, /* required */
                                OriginProtocolPolicy: 'https-only', /* required */
                                OriginSslProtocols: {
                                    Items: [/* required */
                                        'TLSv1', 'TLSv1.1', 'TLSv1.2',
                                    ],
                                    Quantity: 3 /* required */
                                }
                            },
                            OriginPath: '/' + config.api_gateway_deployment_name,
                        },
                        {
                            DomainName: config.bucket_name + ".s3-website-" + config.region + ".amazonaws.com",
                            Id: "Custom-" + config.bucket_name + ".s3-website-" + config.region + ".amazonaws.com",
                            CustomHeaders: {
                                Quantity: 0,
                                Items: []
                            },
                            CustomOriginConfig: {
                                HTTPPort: 80,
                                HTTPSPort: 443,
                                OriginProtocolPolicy: 'http-only',
                                OriginSslProtocols: {
                                    Items: [
                                        'TLSv1', 'TLSv1.1', 'TLSv1.2',
                                    ],
                                    Quantity: 3
                                }
                            },
                            OriginPath: '',
                        }
                    ]
                },
                Aliases: {
                    Quantity: 1, /* required */
                    Items: [config.domain_name]
                },
                CacheBehaviors: {
                    Quantity: 4, /* required */
                    Items: [{
                        ForwardedValues: {
                            /* required */
                            Cookies: {
                                /* required */
                                Forward: 'all', /* required */
                                WhitelistedNames: {
                                    Quantity: 0, /* required */
                                    Items: []
                                }
                            },
                            QueryString: true, /* required */
                            Headers: {
                                Quantity: 0, /* required */
                                Items: []
                            },
                            QueryStringCacheKeys: {
                                Quantity: 0, /* required */
                                Items: []
                            }
                        },
                        MinTTL: 0, /* required */
                        PathPattern: '/images*', /* required */
                        TargetOriginId: "Custom-" + config.bucket_name + ".s3-website-" + config.region + ".amazonaws.com", /* required */
                        TrustedSigners: {
                            /* required */
                            Enabled: false, /* required */
                            Quantity: 0, /* required */
                            Items: []
                        },
                        ViewerProtocolPolicy: 'redirect-to-https', /* required */
                        AllowedMethods: {
                            Items: [/* required */
                                'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'
                                /* more items */
                            ],
                            Quantity: 7, /* required */
                            CachedMethods: {
                                Items: [/* required */
                                    'GET', 'HEAD'
                                    /* more items */
                                ],
                                Quantity: 2 /* required */
                            }
                        },
                        Compress: true,
                        DefaultTTL: 86400,
                        LambdaFunctionAssociations: {
                            Quantity: 0
                        },
                        MaxTTL: 31536000,
                        SmoothStreaming: false
                    }, {
                        ForwardedValues: {
                            /* required */
                            Cookies: {
                                /* required */
                                Forward: 'all', /* required */
                                WhitelistedNames: {
                                    Quantity: 0, /* required */
                                    Items: []
                                }
                            },
                            QueryString: true, /* required */
                            Headers: {
                                Quantity: 0, /* required */
                                Items: []
                            },
                            QueryStringCacheKeys: {
                                Quantity: 0, /* required */
                                Items: []
                            }
                        },
                        MinTTL: 0, /* required */
                        PathPattern: '/static*', /* required */
                        TargetOriginId: "Custom-" + config.bucket_name + ".s3-website-" + config.region + ".amazonaws.com", /* required */
                        TrustedSigners: {
                            /* required */
                            Enabled: false, /* required */
                            Quantity: 0, /* required */
                            Items: []
                        },
                        ViewerProtocolPolicy: 'redirect-to-https', /* required */
                        AllowedMethods: {
                            Items: [/* required */
                                'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'
                                /* more items */
                            ],
                            Quantity: 7, /* required */
                            CachedMethods: {
                                Items: [/* required */
                                    'GET', 'HEAD'
                                    /* more items */
                                ],
                                Quantity: 2 /* required */
                            }
                        },
                        Compress: true,
                        DefaultTTL: 86400,
                        LambdaFunctionAssociations: {
                            Quantity: 0
                        },
                        MaxTTL: 31536000,
                        SmoothStreaming: false
                    }, {
                        ForwardedValues: {
                            /* required */
                            Cookies: {
                                /* required */
                                Forward: 'all', /* required */
                                WhitelistedNames: {
                                    Quantity: 0, /* required */
                                    Items: []
                                }
                            },
                            QueryString: true, /* required */
                            Headers: {
                                Quantity: 0, /* required */
                                Items: []
                            },
                            QueryStringCacheKeys: {
                                Quantity: 0, /* required */
                                Items: []
                            }
                        },
                        MinTTL: 0, /* required */
                        PathPattern: '/admin*', /* required */
                        TargetOriginId: "Custom-" + config.bucket_name + ".s3-website-" + config.region + ".amazonaws.com", /* required */
                        TrustedSigners: {
                            /* required */
                            Enabled: false, /* required */
                            Quantity: 0, /* required */
                            Items: []
                        },
                        ViewerProtocolPolicy: 'redirect-to-https', /* required */
                        AllowedMethods: {
                            Items: [/* required */
                                'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'
                                /* more items */
                            ],
                            Quantity: 7, /* required */
                            CachedMethods: {
                                Items: [/* required */
                                    'GET', 'HEAD'
                                    /* more items */
                                ],
                                Quantity: 2 /* required */
                            }
                        },
                        Compress: true,
                        DefaultTTL: 86400,
                        LambdaFunctionAssociations: {
                            Quantity: 0
                        },
                        MaxTTL: 31536000,
                        SmoothStreaming: false
                    }, {
                        ForwardedValues: {
                            /* required */
                            Cookies: {
                                /* required */
                                Forward: 'all', /* required */
                                WhitelistedNames: {
                                    Quantity: 0, /* required */
                                    Items: []
                                }
                            },
                            QueryString: true, /* required */
                            Headers: {
                                Quantity: 0, /* required */
                                Items: []
                            },
                            QueryStringCacheKeys: {
                                Quantity: 0, /* required */
                                Items: []
                            }
                        },
                        MinTTL: 0, /* required */
                        PathPattern: '/favicon.ico', /* required */
                        TargetOriginId: "Custom-" + config.bucket_name + ".s3-website-" + config.region + ".amazonaws.com", /* required */
                        TrustedSigners: {
                            /* required */
                            Enabled: false, /* required */
                            Quantity: 0, /* required */
                            Items: []
                        },
                        ViewerProtocolPolicy: 'redirect-to-https', /* required */
                        AllowedMethods: {
                            Items: [/* required */
                                'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'
                                /* more items */
                            ],
                            Quantity: 7, /* required */
                            CachedMethods: {
                                Items: [/* required */
                                    'GET', 'HEAD'
                                    /* more items */
                                ],
                                Quantity: 2 /* required */
                            }
                        },
                        Compress: true,
                        DefaultTTL: 86400,
                        LambdaFunctionAssociations: {
                            Quantity: 0
                        },
                        MaxTTL: 31536000,
                        SmoothStreaming: false
                    }]
                },
                DefaultRootObject: '',
                Logging: {
                    Bucket: '', /* required */
                    Enabled: false, /* required */
                    IncludeCookies: false, /* required */
                    Prefix: '' /* required */
                },
                CustomErrorResponses: {
                    Quantity: 0, /* required */
                    Items: []
                },
                HttpVersion: 'http1.1',
                PriceClass: 'PriceClass_All',
                Restrictions: {
                    GeoRestriction: {
                        /* required */
                        Quantity: 0, /* required */
                        RestrictionType: 'none', /* required */
                        Items: []
                    }
                },
                ViewerCertificate: {
                    ACMCertificateArn: config.cloudfront_certificate_arn,
                    CertificateSource: 'acm',
                    CloudFrontDefaultCertificate: false,
                    MinimumProtocolVersion: 'TLSv1',
                    SSLSupportMethod: 'sni-only'
                },
                WebACLId: ''
            }
        };

        cloudfront.listDistributions({}, function (err, data) {
            if (err) {
                console.log(err, err.stack);
            } else {
                var existing_distribution = _.find(data.DistributionList.Items, {"Comment": config.cloudfront_comment});
                if (existing_distribution) {
                    var params = {
                        Id: existing_distribution.Id /* required */
                    };
                    cloudfront.getDistributionConfig(params, function (err, data) {
                        if (err) {
                            console.log(err, err.stack); // an error occurred
                        } else {
                            cloudfront_params.Id = existing_distribution.Id;
                            cloudfront_params.IfMatch = data.ETag;
                            cloudfront.updateDistribution(cloudfront_params, function (err, data) {
                                if (err) {
                                    console.log(chalk.red(err));
                                    console.log(err.stack);
                                } else {
                                    resolve(data.Distribution.DomainName);
                                }
                            });
                        }
                    });
                } else {
                    cloudfront.createDistribution(cloudfront_params, function (err, data) {
                        if (err) {
                            console.log(chalk.red(err));
                            console.log(err.stack);
                        } else {
                            resolve(data.Distribution.DomainName);
                        }
                    });
                }
            }
        });
    });


    console.log();
    console.log(chalk.cyan("Adding Route53 record"));
    yield new Promise(function (resolve, reject) {
        var params = {
            ChangeBatch: {
                /* required */
                Changes: [/* required */
                    {
                        Action: 'CREATE', /* required */
                        ResourceRecordSet: {
                            /* required */
                            Name: config.domain_name, /* required */
                            Type: 'A', /* required */
                            AliasTarget: {
                                DNSName: cloudfront_domain, /* required */
                                EvaluateTargetHealth: false, /* required */
                                HostedZoneId: 'Z2FDTNDATAQYW2' /* required */
                            },
                        }
                    },
                ],
            },
            HostedZoneId: config.hosted_zone_id /* required */
        };

        route53.changeResourceRecordSets(params, function (err, data) {
            if (err) {
                if (err.code === "InvalidChangeBatch") {
                    console.log(chalk.yellow("There is already an A record for " + config.domain_name + " in hosted zone in Route53"));
                    resolve();
                } else {
                    console.log(chalk.red(err));
                    console.log(err.stack);
                    reject();
                }

            } else {
                resolve();
            }
        });
    });

    console.log();
    console.log(chalk.cyan("DONE!"));
    console.log(chalk.yellow("Please wait around 15 minutes for changes to propagate."));
    console.log("Your admin password is: " + chalk.red(config.api_gateway_stage_variables.admin_pass) + " you can change it in API Gateway -> your API -> stages -> prod -> Stage variables");

    var lambda_config = {
        "region": config.region,
        "lambda_prefix": config.lambda_prefix,
        "role_name": config.role_name
    }

    fs.writeFileSync("./install/lambda_config.json", JSON.stringify(lambda_config), 'utf8');

    process.exit(0);

}).catch(function (err) {
    console.log(err);

    process.exit(0);
});
