// listPostsAdmin
var co = require('co');
var jwt = require('jsonwebtoken');
var cookieParser = require('cookie');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();

var auth = require('../../lib/auth.js');

function isEmpty(obj) { 
   for (var x in obj) { return false; }
   return true;
}

exports.handler = function(event, context) {
	var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;

	var posts_table = event.posts_table;

	co(function *(){
		var user = yield auth(signing_key, cookie, token_name);

		var posts = yield getPosts();

		returnMessage(posts);
	  
	}).catch(function(err) {
		console.log("ERROR!");
		console.log(err);
		console.log(arguments);
		context.fail(err.message);
	});

	function getPosts(){
		return new Promise(function(resolve, reject){
			var params = {
			  TableName: posts_table
			};

			docClient.scan(params, function(err, data) {
			   if (err){
			   	reject(err);
			   }else{
			   	resolve(data.Items);
			   }
			});
		})
	}

	function returnMessage(posts){
		context.succeed({
			success: true,
			posts: posts
		});
	}
}

