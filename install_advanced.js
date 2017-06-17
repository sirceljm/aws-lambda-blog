var co = require("co");
var path = require("path");
var fs = require("fs");
var node_s3_client = require('s3');

var isThere = require("is-there");
var chalk = require('chalk');
var _ = require('lodash');

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



co(function*(){
	console.log();
	console.log(chalk.bold.cyan("AWS Lambda Blog Platform install"));

	if(!fs.existsSync("install_config.js")){
		console.log();
		console.log(chalk.cyan("Creating install_config.json from install_config_template.js"));

		yield new Promise(function(resolve, reject){
			var rd = fs.createReadStream("install/install_config_template.js");
			rd.on("error", function(err){
				console.log(err);
				reject();
			});

			var wr = fs.createWriteStream("install_config.js");
			wr.on("error", function(err){
				console.log(err);
				reject();
			});
			wr.on("close", function(ex) {
				resolve();
			});
			rd.pipe(wr);
		});
	}else{
		console.log();
		console.log(chalk.cyan("Not creating install_config.js from install_config_template.js - File already exists"));
	}

	var config = require('./install_config.js');

	var AWS = require('aws-sdk');
	AWS.config.loadFromPath(config.credentials_path);

	var iam = new AWS.IAM({apiVersion: '2010-05-08'});
	var lambda = new AWS.Lambda({apiVersion: '2015-03-31'});
	var s3 = new AWS.S3({
		signatureVersion: 'v4',
		apiVersion: '2006-03-01'
	});
	var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
	var apigateway = new AWS.APIGateway({apiVersion: '2015-07-09'});
	var cloudfront = new AWS.CloudFront({apiVersion: '2016-09-07'});
	var route53 = new AWS.Route53({apiVersion: '2013-04-01'});
	var sts = new AWS.STS();


	console.log();
	console.log(chalk.cyan("Getting user account ID"));
	var account_id = yield new Promise(function(resolve, reject){
		sts.getCallerIdentity({}, function(err, data) {
		   if (err){
		  	console.log(chalk.red(err));
		  	console.log(err.stack);
		  	reject()
		  }else{
		  	resolve(data.Account)
		  }
	 	});
	});

	console.log();
	console.log(chalk.cyan("Creating policies"));

	var install_policy_arn = yield new Promise(function(resolve, reject){
		iam.getPolicy({
		  PolicyArn: "arn:aws:iam::"+account_id+":policy/"+config.install_policy_name
		}, function(err, data) {
		  if (err) {
	  		iam.createPolicy({
			  PolicyDocument: JSON.stringify(installation_policy),
			  PolicyName: config.install_policy_name
			}, function(err, data) {
			  if (err) {
			  		console.log(chalk.red(err));
			  		console.log(err.stack);
			  		reject();
			  }else{
			  	resolve(data.Policy.Arn);
			  }
			});
		  }else{
		  	resolve(data.Policy.Arn);
		  }
		});
	});

	var role_policy_arn = yield new Promise(function(resolve, reject){
		iam.getPolicy({
		  PolicyArn: "arn:aws:iam::"+account_id+":policy/"+config.role_policy_name
		}, function(err, data) {
		  if (err) {
	  		iam.createPolicy({
			  PolicyDocument: JSON.stringify(role_policy), /* required */
			  PolicyName: config.role_policy_name
			}, function(err, data) {
			  if (err) {
			  		console.log(chalk.red(err));
			  		console.log(err.stack);
			  		reject();
			  }else{
			  	resolve(data.Policy.Arn);
			  }
			});
		  }else{
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

	yield new Promise(function(resolve, reject){
		iam.attachUserPolicy({
		  PolicyArn: install_policy_arn,
		  UserName: config.user_name
		}, function(err, data) {
		  if (err){
		  	console.log(chalk.red(err));
		  	console.log(err.stack);
		  	reject()
		  }else{
		  	console.log("Policy: " + chalk.green(config.install_policy_name) + " was attached to the user: "+ chalk.yellow(config.user_name));
		  	resolve()
		  }
		});
	})

	console.log();
	console.log(chalk.cyan("creating IAM role"));

	var role_arn = yield new Promise(function(resolve, reject){
		iam.createRole({
		  AssumeRolePolicyDocument: JSON.stringify({
			   "Version" : "2012-10-17",
			   "Statement": [ {
			      "Effect": "Allow",
			      "Principal": {
			         "Service": [ "lambda.amazonaws.com" ]
			      },
			      "Action": [ "sts:AssumeRole" ]
			   } ]
			}),
		  RoleName: config.role_name
		}, function(err, data) {
		  if (err){
		  	if(err.code === "EntityAlreadyExists"){
		  		console.log(chalk.yellow(err));
				iam.getRole({
				  RoleName: config.role_name
				}, function(err, data) {
				  if (err) {
				  	console.log(chalk.red(err));
			  		console.log(err.stack);
			  		reject();
				  }else{
				  	resolve(data.Role.Arn);
				  }
				});
		  	}else{
		  		console.log(chalk.red(err));
		  		console.log(err.stack);
		  		reject();
		  	}
		  }else{
		  	resolve(data.Role.Arn);
		  }
		});
	});


	console.log();
	console.log(chalk.cyan("Attaching policy to the role"));

	yield new Promise(function(resolve, reject){
		iam.attachRolePolicy({
		  PolicyArn: role_policy_arn,
		  RoleName: config.role_name
		}, function(err, data) {
		  if (err){
		  	console.log(chalk.red(err));
		  	console.log(err.stack);
		  	reject();
		  }else{
		  	console.log("Policy: " + chalk.green(role_policy_arn) + " was attached to the role: "+ chalk.yellow(config.role_name));
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
	yield new Promise(function(resolve, reject){
		s3.createBucket({
		  Bucket: config.bucket_name
		}, function(err, data) {
		  if (err){
		  	if(err.code === "BucketAlreadyOwnedByYou"){
		  		console.log(chalk.yellow(err));
		  		resolve();
		  	}else{
		  		console.log(chalk.red(err));
		  		console.log(err.stack);
		  		reject();
		  	}
		  	reject();
		  }else{
		  	console.log("S3 bucket: " + chalk.green(config.bucket_name) + " was created");
		  	resolve();
		  }
		})
	});

	console.log();
	console.log(chalk.cyan("Configuring S3 bucket for website hosting"));
	yield new Promise(function(resolve, reject){
		s3.putBucketWebsite({
		  Bucket: config.bucket_name, /* required */
		  WebsiteConfiguration: { /* required */
		    ErrorDocument: {
		      Key: "error.html" /* required */
		    },
		    IndexDocument: {
		      Suffix: "index.html" /* required */
		    }
		  }
		}, function(err, data) {
		  if (err){
		  	console.log(chalk.red(err));
		  	console.log(err.stack);
		  	reject();
		  }else{
		  	console.log("S3 bucket: " + chalk.green(config.bucket_name) + " was configured for website hosting");
		  	resolve();
		  }
		});
	});

	console.log();
	console.log(chalk.cyan("Uploading files to S3 bucket"));

	yield new Promise(function(resolve, reject){
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
		uploader.on('error', function(err) {
		  console.error("unable to sync:", err.stack);
		  reject();
		});

		if(!uploader.filesFound){
			console.log("no new files found");
			resolve();
		}else{
			var files_to_upload = 0;
			var files_uploaded = 0;
			uploader.on('fileUploadStart', function(localFilePath, s3Key) {
				files_to_upload++;
			});

			uploader.on('fileUploadEnd', function(localFilePath, s3Key) {
				files_uploaded++;

				process.stdout.clearLine();
				process.stdout.cursorTo(0);
				process.stdout.write("Uploaded: "+files_uploaded+"/"+files_to_upload);

				if(files_uploaded === files_to_upload){
					resolve();
				}
			});
		}

	});


	console.log();
	console.log(chalk.cyan("Creating DynamoDB tables"));

	yield new Promise(function(resolve, reject){
		var params = {
		  AttributeDefinitions: [ /* required */
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
		  },{
		      AttributeName: 'part', /* required */
		      KeyType: 'RANGE' /* required */
		  }],
		  ProvisionedThroughput: { /* required */
		    ReadCapacityUnits: 1, /* required */
		    WriteCapacityUnits: 1 /* required */
		  },
		  TableName: config.table_prefix+"_objects" /* required */
		};
		dynamodb.createTable(params, function(err, data) {
		  if (err){
		  	if(err.code === "ResourceInUseException"){
		  		console.log(chalk.yellow(err));
		  		resolve();
		  	}else{
		  		console.log(chalk.red(err));
		  		console.log(err.stack);
		  		reject();
		  	}
		  	reject();
		  }else{
		  	console.log("Table: " + chalk.green(config.table_prefix+"_objects") + " was created");
		  	resolve();
		  }
		});
	})

	yield new Promise(function(resolve, reject){
		var params = {
		  AttributeDefinitions: [ /* required */
		    {
		      AttributeName: 'post_id', /* required */
		      AttributeType: 'S' /* required */
		    },{
		      AttributeName: 'post_status', /* required */
		      AttributeType: 'S' /* required */
		    },{
		      AttributeName: 'date', /* required */
		      AttributeType: 'N' /* required */
		    }
		  ],
		  KeySchema: [{
		      AttributeName: 'post_id', /* required */
		      KeyType: 'HASH' /* required */
		  }],
		  ProvisionedThroughput: { /* required */
		    ReadCapacityUnits: 1, /* required */
		    WriteCapacityUnits: 1 /* required */
		  },
		  GlobalSecondaryIndexes: [
		    {
		      IndexName: 'post_status-date-index', /* required */
		      KeySchema: [ /* required */
		        {
		          AttributeName: 'post_status', /* required */
		          KeyType: 'HASH' /* required */
		        },{
		          AttributeName: 'date', /* required */
		          KeyType: 'RANGE' /* required */
		        }
		      ],
		      Projection: { /* required */
		        ProjectionType: 'ALL'
		      },
		      ProvisionedThroughput: { /* required */
		        ReadCapacityUnits: 1, /* required */
		        WriteCapacityUnits: 1 /* required */
		      }
		    }
		    /* more items */
		  ],
		  TableName: config.table_prefix+"_posts", /* required */
		};
		dynamodb.createTable(params, function(err, data) {
		  if (err){
		  	if(err.code === "ResourceInUseException"){
		  		console.log(chalk.yellow(err));
		  		resolve();
		  	}else{
		  		console.log(chalk.red(err));
		  		console.log(err.stack);
		  		reject();
		  	}
		  	reject();
		  }else{
		  	console.log("Table: " + chalk.green(config.table_prefix+"_posts") + " was created");
		  	resolve();
		  }
		});
	});

	console.log();
	console.log(chalk.cyan("Populating DynamoDB tables with data"));

	var putToDB = function(table_name, data, err){
		if (err){
			console.log(chalk.red(err));
			console.log(err);
			reject();
		}else{
			return fn = co.wrap(function*(){
				for(var i = 0; i < data.length; i++){
					yield new Promise(function(resolve2, reject2){
						var db_item = {};
						for(var key in data[i]){
							var db_key = key.split(" ")[0];
							var db_key_type = key.split(" ")[1].replace(/[()]/g, "");

							db_item[db_key] = {};
							if(db_key === "JSON" || db_key === "categories"){
								//db_item[db_key][db_key_type] = JSON.stringify(data[i][key]);
								db_item[db_key][db_key_type] = data[i][key]+"";
							}else if(db_key_type === "N"){
								db_item[db_key][db_key_type] = data[i][key]+"";
							}else{
								db_item[db_key][db_key_type] = data[i][key];
							}
						}

						var params = {
						  Item: db_item,
						  TableName: table_name, /* required */
						  ReturnValues: 'NONE'
						};

						dynamodb.putItem(params, function(err, data) {
						  if (err){
					  		console.log(chalk.red(err));
					  		console.log(err.stack);
						  	reject2();
						  }else{
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
	yield new Promise(function(resolve, reject){
		var converter = new Converter({});
		converter.fromFile("./install/install_objects.csv",function(err,result){
			var params = {
			  TableName: config.table_prefix+"_objects"
			};
			dynamodb.waitFor('tableExists', params, function(err, data) {
			  if (err){
			  	console.log(err, err.stack);
			  }else{
			  	putToDB(config.table_prefix+"_objects", result, err)().then(function(){
					resolve();
				});
			  }
			});

		});
	});

	yield new Promise(function(resolve, reject){
		var converter = new Converter({});
		converter.fromFile("./install/install_posts.csv",function(err,result){
			var params = {
			  TableName: config.table_prefix+"_posts"
			};
			dynamodb.waitFor('tableExists', params, function(err, data) {
			  if (err){
			  	console.log(err, err.stack);
			  }else{
				putToDB(config.table_prefix+"_posts", result, err)().then(function(){
					resolve();
				});
			  }
			});
		});
	});

	console.log();
	console.log(chalk.cyan("Uploading Lambda functions & creating API gateway endpoints"));

	function getFiles(srcpath) {
	  return fs.readdirSync(srcpath).filter(function(file) {
	    return !fs.statSync(path.join(srcpath, file)).isDirectory();
	  });
	}

	function getEntries(){
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
	for(var i = 0; i < entries.length; i++){
		yield new Promise(function(resolve, reject){
			var array = fs.readFileSync(entries[i].path).toString().split("\n");
			var first_line = array[0];
			var fn_name_without_prefix = first_line.substring(3).trim();
			var lambda_fn_name = config.lambda_prefix+"_"+fn_name_without_prefix;

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

			}, function(err, stats) {
			    if (err){
				  	console.log(chalk.red(err));
				  	console.log(err);
				  }
			});
			compiler.outputFileSystem = mfs;

			compiler.run(function(err, stats) {
				var zip = new JSZip();

				zip.file(entries[i].name, mfs.readFileSync(__dirname+"/"+"compiled.js"));
				var data = zip.generate({type:"uint8array", compression: 'deflate'});

			  	var params = {
				  Code: {
				    ZipFile: data
				  },
				  FunctionName: lambda_fn_name,
				  Handler: path.basename(entries[i].name, '.js')+".handler",
				  Role: role_arn,
				  Runtime: "nodejs4.3",
				  //Description: 'STRING_VALUE',
				  MemorySize: 512,
				  Publish: true,
				  Timeout: 10
				};

				lambda.createFunction(params, function(err, data) {
				  if (err){
				  	if(err.code == "ResourceConflictException"){
				  		console.log(chalk.yellow(err));
				  		lambda.getFunction({
						  FunctionName: lambda_fn_name
						}, function(err, data) {
						  if (err) {
						  	console.log(chalk.red(err));
					  		console.log(err.stack);
						  }else{
						  	lambda.addPermission({
							  Action: 'lambda:*',
							  FunctionName: lambda_fn_name,
							  Principal: 'apigateway.amazonaws.com',
							  StatementId: uuid.v4(),
							}, function(err, data) {
							  if (err) {
							  	console.log(err, err.stack); // an error occurred
							  }else{
							  	//console.log(JSON.parse(data.Statement).Resource);
							  	lambda_api_mappings[fn_name_without_prefix].lambda_arn = JSON.parse(data.Statement).Resource;
						  		resolve();
							  }
							});
						  }
						});
				  	}else{
				  		console.log(chalk.red(err));
				  		console.log(err.stack);
				  	}
				  }else{
					lambda.addPermission({
					  Action: 'lambda:*',
					  FunctionName: lambda_fn_name,
					  Principal: 'apigateway.amazonaws.com',
					  StatementId: uuid.v4(),
					}, function(err, data) {
					  if (err) {
					  	console.log(err, err.stack); // an error occurred
					  }else{
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

	for(var key in lambda_api_mappings){
		if(lambda_api_mappings[key].resource.constructor === Array){
			for(var i = 0; i < lambda_api_mappings[key].resource.length; i++){
				if(api_gateway_definitions.paths[lambda_api_mappings[key].resource[i]].post){
					api_gateway_definitions.paths[lambda_api_mappings[key].resource[i]].post["x-amazon-apigateway-integration"].uri = "arn:aws:apigateway:"+AWS.config.region+":lambda:path/2015-03-31/functions/"+lambda_api_mappings[key].lambda_arn+"/invocations";
				}
				if(api_gateway_definitions.paths[lambda_api_mappings[key].resource[i]].get){
					api_gateway_definitions.paths[lambda_api_mappings[key].resource[i]].get["x-amazon-apigateway-integration"].uri = "arn:aws:apigateway:"+AWS.config.region+":lambda:path/2015-03-31/functions/"+lambda_api_mappings[key].lambda_arn+"/invocations";
				}
			}
		}else{
			if(api_gateway_definitions.paths[lambda_api_mappings[key].resource].post){
				api_gateway_definitions.paths[lambda_api_mappings[key].resource].post["x-amazon-apigateway-integration"].uri = "arn:aws:apigateway:"+AWS.config.region+":lambda:path/2015-03-31/functions/"+lambda_api_mappings[key].lambda_arn+"/invocations";
			}
			if(api_gateway_definitions.paths[lambda_api_mappings[key].resource].get){
				api_gateway_definitions.paths[lambda_api_mappings[key].resource].get["x-amazon-apigateway-integration"].uri = "arn:aws:apigateway:"+AWS.config.region+":lambda:path/2015-03-31/functions/"+lambda_api_mappings[key].lambda_arn+"/invocations";
			}
		}
	}

	var api_id = yield new Promise(function(resolve, reject){
		apigateway.getRestApis({}, function(err, data) {
		  if (err){
		  	console.log(err, err.stack);
		  	reject();
		  }else{
		  	var found_api_gateway = _.find(data.items, {'name': config.api_gateway_name});
		  	if(found_api_gateway){
		  		console.log(chalk.yellow("API Gateway with name: " + config.api_gateway_name + " already exists"));
		  		resolve(found_api_gateway.id);
		  	}else{
		  		apigateway.importRestApi({
				  body: JSON.stringify(api_gateway_definitions),
				  failOnWarnings: true,
				}, function(err, data) {
				  if (err){
			  		console.log(chalk.red(err));
			  		console.log(err.stack);
				  	reject();
				  }else{
				  	console.log("API Gateway: " + chalk.green(config.api_gateway_name) + " was created");
				  	resolve(data.id);
				  }
				});
		  	}
		  }
		});
	});

	config.api_gateway_stage_variables.objects_table = config.table_prefix+"_objects";
	config.api_gateway_stage_variables.posts_table = config.table_prefix+"_posts";

	config.api_gateway_stage_variables.articles_bucket = config.bucket_name;

	config.api_gateway_stage_variables.signing_key = pass_generator.generate({
	    length: 20,
	    numbers: true,
	    symbols: false,
	    uppercase: true
	});

	/* config.api_gateway_stage_variables.admin_pass = pass_generator.generate({
	    length: 5,
	    numbers: true,
	    symbols: false,
	    uppercase: true
	}); */

	var deployment_id = yield new Promise(function(resolve, reject){
		var params = {
		  restApiId: api_id,
		  stageName: 'prod',
		  cacheClusterEnabled: false,
		  variables: config.api_gateway_stage_variables
		};
		apigateway.createDeployment(params, function(err, data) {
		  if (err){
		  	console.log(err, err.stack);
		  }else{
		  	console.log(data);
		  	resolve(data.id);
		  }

		});
	});

	console.log();
	console.log(chalk.cyan("Configuring cloudfront"));
	var cloudfront_domain = yield new Promise(function(resolve, reject){
		var cloudfront_params = {
		  DistributionConfig: { /* required */
		    CallerReference: config.cloudfront_caller_reference, /* required */
		    Comment: config.cloudfront_comment, /* required */
		    DefaultCacheBehavior: { /* required */
		      ForwardedValues: { /* required */
		        Cookies: { /* required */
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
		      TargetOriginId: "Custom-"+api_id+".execute-api."+AWS.config.region+".amazonaws.com/"+config.api_gateway_deployment_name, /* required */
		      TrustedSigners: { /* required */
		        Enabled: false, /* required */
		        Quantity: 0, /* required */
		        Items: []
		      },
		      ViewerProtocolPolicy: 'redirect-to-https', /* required */
		      AllowedMethods: {
		        Items: [ /* required */
		          'GET','HEAD','POST','PUT','PATCH','OPTIONS','DELETE'
		          /* more items */
		        ],
		        Quantity: 7, /* required */
		        CachedMethods: {
		          Items: [ /* required */
		            'GET','HEAD',
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
		    Origins: { /* required */
		      Quantity: 2, /* required */
		      Items: [
		        {
		          DomainName: api_id+".execute-api."+AWS.config.region+".amazonaws.com",
		          Id: "Custom-"+api_id+".execute-api."+AWS.config.region+".amazonaws.com/"+config.api_gateway_deployment_name, /* required */
		          CustomHeaders: {
		            Quantity: 0, /* required */
		            Items: []
		          },
		          CustomOriginConfig: {
		            HTTPPort: 80, /* required */
		            HTTPSPort: 443, /* required */
		            OriginProtocolPolicy: 'https-only', /* required */
		            OriginSslProtocols: {
		              Items: [ /* required */
		                'TLSv1','TLSv1.1','TLSv1.2',
		              ],
		              Quantity: 3 /* required */
		            }
		          },
		          OriginPath: '/'+config.api_gateway_deployment_name,
		        },
		        {
		          DomainName: config.bucket_name+".s3-website-"+AWS.config.region+".amazonaws.com",
		          Id: "Custom-"+config.bucket_name+".s3-website-"+AWS.config.region+".amazonaws.com",
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
		                'TLSv1','TLSv1.1','TLSv1.2',
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
		          ForwardedValues: { /* required */
		            Cookies: { /* required */
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
		          TargetOriginId: "Custom-"+config.bucket_name+".s3-website-"+AWS.config.region+".amazonaws.com", /* required */
		          TrustedSigners: { /* required */
		            Enabled: false, /* required */
		            Quantity: 0, /* required */
		            Items: []
		          },
		          ViewerProtocolPolicy: 'redirect-to-https', /* required */
		          AllowedMethods: {
		            Items: [ /* required */
		              'GET','HEAD','POST','PUT','PATCH','OPTIONS','DELETE'
		              /* more items */
		            ],
		            Quantity: 7, /* required */
		            CachedMethods: {
		              Items: [ /* required */
		                'GET','HEAD'
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
		        },{
		          ForwardedValues: { /* required */
		            Cookies: { /* required */
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
		          TargetOriginId: "Custom-"+config.bucket_name+".s3-website-"+AWS.config.region+".amazonaws.com", /* required */
		          TrustedSigners: { /* required */
		            Enabled: false, /* required */
		            Quantity: 0, /* required */
		            Items: []
		          },
		          ViewerProtocolPolicy: 'redirect-to-https', /* required */
		          AllowedMethods: {
		            Items: [ /* required */
		              'GET','HEAD','POST','PUT','PATCH','OPTIONS','DELETE'
		              /* more items */
		            ],
		            Quantity: 7, /* required */
		            CachedMethods: {
		              Items: [ /* required */
		                'GET','HEAD'
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
		        },{
		          ForwardedValues: { /* required */
		            Cookies: { /* required */
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
		          TargetOriginId: "Custom-"+config.bucket_name+".s3-website-"+AWS.config.region+".amazonaws.com", /* required */
		          TrustedSigners: { /* required */
		            Enabled: false, /* required */
		            Quantity: 0, /* required */
		            Items: []
		          },
		          ViewerProtocolPolicy: 'redirect-to-https', /* required */
		          AllowedMethods: {
		            Items: [ /* required */
		              'GET','HEAD','POST','PUT','PATCH','OPTIONS','DELETE'
		              /* more items */
		            ],
		            Quantity: 7, /* required */
		            CachedMethods: {
		              Items: [ /* required */
		                'GET','HEAD'
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
		        },{
		          ForwardedValues: { /* required */
		            Cookies: { /* required */
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
		          TargetOriginId: "Custom-"+config.bucket_name+".s3-website-"+AWS.config.region+".amazonaws.com", /* required */
		          TrustedSigners: { /* required */
		            Enabled: false, /* required */
		            Quantity: 0, /* required */
		            Items: []
		          },
		          ViewerProtocolPolicy: 'redirect-to-https', /* required */
		          AllowedMethods: {
		            Items: [ /* required */
		              'GET','HEAD','POST','PUT','PATCH','OPTIONS','DELETE'
		              /* more items */
		            ],
		            Quantity: 7, /* required */
		            CachedMethods: {
		              Items: [ /* required */
		                'GET','HEAD'
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
		      GeoRestriction: { /* required */
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

		cloudfront.listDistributions({}, function(err, data) {
		  if (err){
		  	console.log(err, err.stack);
		  } else {
		  	var existing_distribution = _.find(data.DistributionList.Items, {"Comment": config.cloudfront_comment});
		  	if(existing_distribution){
		  		var params = {
				  Id: existing_distribution.Id /* required */
				};
				cloudfront.getDistributionConfig(params, function(err, data) {
				  if (err) {
				  	console.log(err, err.stack); // an error occurred
				  }else{
				  	cloudfront_params.Id = existing_distribution.Id;
				  	cloudfront_params.IfMatch = data.ETag;
			  		cloudfront.updateDistribution(cloudfront_params, function(err, data) {
					  if (err){
					  	console.log(chalk.red(err));
					  	console.log(err.stack);
					  }else{
					  	resolve(data.Distribution.DomainName);
					  }
					});
				  }
				});
		  	}else{
		  		cloudfront.createDistribution(cloudfront_params, function(err, data) {
				  if (err){
				  	console.log(chalk.red(err));
				  	console.log(err.stack);
				  }else{
				  	resolve(data.Distribution.DomainName);
				  }
				});
		  	}
		  }
		});
	});


	console.log();
	console.log(chalk.cyan("Adding Route53 record"));
	yield new Promise(function(resolve, reject){
		var params = {
		  ChangeBatch: { /* required */
		    Changes: [ /* required */
		      {
		        Action: 'CREATE', /* required */
		        ResourceRecordSet: { /* required */
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
		route53.changeResourceRecordSets(params, function(err, data) {
		  if (err){
		  	if(err.code === "InvalidChangeBatch"){
		  		console.log(chalk.yellow("There is already an A record for "+config.domain_name+" in hosted zone in Route53"));
		  		resolve();
		  	}else{
		  		console.log(chalk.red(err));
		  		console.log(err.stack);
		  		reject();
		  	}

		  }else{
		  	resolve();
		  }
		});
	});

	console.log();
	console.log(chalk.cyan("DONE!"));
	console.log(chalk.yellow("Please wait around 15 minutes for changes to propagate."));
	console.log("Your admin password is: "+chalk.red(config.api_gateway_stage_variables.admin_pass)+" you can change it in API Gateway -> your API -> stages -> prod -> Stage variables");

	var install_config = {
		api_gateway_url: "https://"+api_id+".execute-api."+AWS.config.region+".amazonaws.com/"+config.api_gateway_deployment_name,
		admin_password: config.api_gateway_stage_variables.admin_pass
	}

	yield new Promise(function(resolve, reject){
		fs.writeFile("./install_test.json", JSON.stringify(install_config, null, 1), function(err) {
			if(err) {
			    reject(err);
			}else{
				resolve();
			}
		});
	})
	console.log();
	console.log(chalk.cyan("install_test.json was saved"));

	console.log();
	console.log(chalk.cyan("In the meantime we will run some tests on API Gateway"));
	console.log(chalk.cyan("Wainting 10s for changes to propagate"));
	yield new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, 10000);
    });


	yield new Promise(function(resolve, reject){
		var tests_task = require("./run_tests.js");
		tests_task.run().then(function(){
			resolve();
		})
	});

	console.log(chalk.yellow("If some tests failed please try again running 'node run_tests.js' as it is possible that all the changes to AWS haven't yet propagated."));


	process.exit();

}).catch(function(err){
	console.log(err);
	process.exit();
});
