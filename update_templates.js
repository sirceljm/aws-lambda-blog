var co = require("co");
var path = require("path");
var fs = require("fs");
var node_s3_client = require('s3');

var isThere = require("is-there");
var chalk = require('chalk');
var _ = require('lodash');

var webpack = require("webpack");

var MemoryFS = require("memory-fs");
var uuid = require('uuid');

var zip = require("node-zip");

var config = require('./install_config.js');

var AWS = require('aws-sdk');
AWS.config.loadFromPath(config.credentials_path);

var iam = new AWS.IAM({apiVersion: '2010-05-08'});
var lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

console.log();
console.log(chalk.cyan("Updating Lambda functions"));

function getFiles(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return !fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

function getEntries(){
  var public_files = getFiles(path.join(__dirname, "./lambdas/src/public"))
    .filter(obj => {
    	return _.includes(["about.js", "contact.js", "get.js", "get_post.js", "get_posts_by_category.js"], obj);
    }).map(filename => {
	       return {
	       	name: filename,
	       	path: path.join(
		         path.join(__dirname, "./lambdas/src/public"),
		         filename
		    )
	       };
     })
  return public_files;
}


var entries = getEntries();

co(function*(){
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
		  RoleName: config.role_name, /* required */
		}, function(err, data) {
		  if (err){
		  	if(err.code = "EntityAlreadyExists"){
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
				var zip_data = zip.generate({type:"uint8array", compression: 'deflate'});

			  	var params = {
				  Code: {
				    ZipFile: zip_data
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
						  	var params = {
							  FunctionName: lambda_fn_name, /* required */
							  Publish: true,
							  ZipFile: zip_data
							};
							lambda.updateFunctionCode(params, function(err, data) {
							  if (err){
							  	console.log(err, err.stack); // an error occurred
							  }else{
							  	console.log(data);           // successful response
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
					  Action: 'lambda:*', /* required */
					  FunctionName: lambda_fn_name, /* required */
					  Principal: 'apigateway.amazonaws.com', /* required */
					  StatementId: uuid.v4(), /* required */
					}, function(err, data) {
					  if (err) {
					  	console.log(err, err.stack); // an error occurred
					  }else{
					  	console.log(data); 
				  		resolve();
					  }
					});
				  }
				});

			});
		});
	}
}).catch(function(err){
	console.log(err);
});