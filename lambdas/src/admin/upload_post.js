// uploadPost
var co = require('co');
var shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

var moment = require('moment');
var getSlug = require('speakingurl');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3({
    signatureVersion: 'v4'
});

var auth = require('../../lib/auth.js');

exports.handler = (event, context, callback) => {
    // STAGE VARIABLES FROM API GATEWAY
    var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;

    var stage_articles_bucket = event.articles_bucket;
    var stage_articles_bucket_path = event.articles_bucket_path;

    var stage_posts_table = event.posts_table;

    var post_id = event.post_id;
    var post_status = event.post_status;
    var title = event.title;
    var categories = event.categories;
    var date = event.date;
    var html = event.html;

    var articles_bucket = new AWS.S3({params: {Bucket: stage_articles_bucket}});

    co(function *(){
      var user = yield auth(signing_key, cookie, token_name);

      if(!date){
        date = moment().valueOf();
      }else{
        date = moment(date).valueOf();
      }

      if(!post_id){ // NEW POST
        post_id = yield addBlogPostToDB(title, date, categories, post_status);
      }else{
      	var old_post = yield getBlogPostFromDB(post_id);
      	console.log(old_post);
        yield updateBlogPostInDB(old_post.post_id, old_post.date, title, date, categories, post_status);
      }

      yield addBlogPostToS3(post_id, html);

      callback(null, {status: 'success'});
    }).catch(onerror);

	function getBlogPostFromDB(post_id){
        console.log("getBlogPostFromDB");
        return new Promise(function(resolve, reject){
            var params = {
                TableName: stage_posts_table,
                KeyConditionExpression: "post_id = :post_id",
                ExpressionAttributeValues: {
                    ":post_id": post_id
                }
            };

            docClient.query(params, function(err, data) {
                if (err){
                    reject(err);
                }else{
                	console.log(data.Items[0]);
                    resolve(data.Items[0]);
                }
            });

        })
    }

    function addBlogPostToDB(title, date, categories, post_status){
        var post_id = shortid.generate();

        return new Promise(function(resolve, reject){
            var params = {
              TableName : stage_posts_table,
              Item: {
                 post_id: post_id,
                 title: title,
                 date: date,
                 categories: categories,
                 post_url: getSlug(title)+"_"+post_id,
                 post_status: post_status || "published"
              }
            };

            docClient.put(params, function(err, data) {
              if (err){
                reject(err);
              }else{
                resolve(post_id);
              }
            });
        })
    }

    function updateBlogPostInDB(post_id, date, title, new_date, categories, post_status){
        return new Promise(function(resolve, reject){
        	var params = {
	            TableName: stage_posts_table,
			    Key:{
			        "post_id": post_id
			    },
			    UpdateExpression: "set title = :title, #date=:new_date, categories=:categories, post_status=:post_status",
    			ExpressionAttributeNames: {"#date": "date"},

			    ExpressionAttributeValues:{
			        ":title":title,
			        ":new_date":new_date,
			        ":categories":categories,
			        ":post_status":post_status
			    },
			    ReturnValues:"UPDATED_NEW"
			}

            docClient.update(params, function(err, data) {
              if (err){
                reject(err);
              }else{
                resolve(post_id);
              }
            });
        })
    }

    function addBlogPostToS3(post_id, html){
        console.log(post_id, html);
        return new Promise(function(resolve, reject){
            s3.putObject({
                Bucket: stage_articles_bucket,
                Key: stage_articles_bucket_path+"/"+post_id+"/index.html",
                Body: html,
                ACL: 'public-read',
                ContentType: 'text/html; charset=utf-8"',
                CacheControl: 'max-age=30'
            }, function(err, data) {
                if(err){
                    reject(err);
                }else{
                    resolve();
                }
            })
        });
    }


    function onerror(err) {
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    }
}
