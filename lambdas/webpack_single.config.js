var path = require("path");
var fs = require("fs");

var webpack = require("webpack");

var AWSUploadPlugin = require("webpack-aws-lambda-upload-plugin");

var config = require('./../install_config.js');

var file_path = process.argv[5];

var dirname = path.basename(file_path, '.js');

var entry = {};
entry[dirname] = file_path;


var array = fs.readFileSync(file_path).toString().split("\n");
var first_line = array[0];
var lambda_fn_name = first_line.substring(3).trim();
 
var AWS = require('aws-sdk');
var iam = new AWS.IAM();

AWS.config.loadFromPath(config.credentials_path);



module.exports = new Promise(function(resolve, reject){  
    iam.getRole({
      RoleName: config.role_name
    }, function(err, data) {
      if (err) {
        reject(new Error("ERROR iam.getRole"));
      }else{
        resolve({
          entry: entry, 
          output: {
            path: path.join(__dirname, "./bin"),
            library: "[name]",
            libraryTarget: "commonjs2",
            filename: "[name]/[name].js"
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
          
          plugins: [    
            new AWSUploadPlugin({
              aws_config: require("F:/iam/lbp.json"),
              lambda_name: config.lambda_prefix+"_"+lambda_fn_name,
              lambda_handler: dirname+".handler",
              lambda_role: data.Role.Arn,
              lambda_runtime: "nodejs4.3", // java8, nodejs, nodejs4.3, python2.7
              lambda_timeout: 10,
              lambda_memory_size: 512,


              asset: "[path].zip",
              test: /\.html$|\.js$|\.xml$|\.rels$|/,
              threshold: 10240,
              minRatio: 0.8,
              verbose: true
            }),
          ]
        })
      }
    });
  })
