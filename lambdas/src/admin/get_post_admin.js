// getPostAdmin
var co = require('co');
var https = require('https');

var moment = require('moment');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();

var auth = require('../../lib/auth.js');
var dynamoObjects = require('../../lib/dynamoObjects.js');

exports.handler = (event, context, callback) => {
    // STAGE VARIABLES FROM API GATEWAY
    var site_base_url = event.site_base_url;
    var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;

    var stage_articles_bucket = event.articles_bucket;
    var stage_articles_bucket_path = event.articles_bucket_path;

    var stage_posts_table = event.posts_table;
    var stage_template = event.template;

    var post_id = event.post_id;

    co(function *(){
        var user = yield auth(signing_key, cookie, token_name);

        var post = yield getBlogPostFromDB(post_id);

        var post_html = yield getBlogPostHtml(post_id);

        callback(null, {
            post_id: post_id,
            categories: post.categories,
            date: post.date,
            title: post.title,
            post_html: post_html,
            post_status: post.post_status
        });
    }).catch(function(err) {
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    });


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
                    resolve(data.Items[0]);
                }
            });

        })
    }

    function getBlogPostHtml(post_id){
        console.log("getBlogPostHtml");
        return new Promise(function(resolve, reject){
            https.get(site_base_url+"/"+stage_articles_bucket_path+"/"+post_id+"/index.html", (response) => {
                var body = [];
                response.on('data', function(chunk) {
                  body.push(chunk);
                }).on('end', function() {
                    body = "" + Buffer.concat(body).toString('utf8');
                    resolve(body);
                }).on('error', function(err) {
                    console.log("ERROR");
                    reject(err);
                });
            }).on('error', (err) => {
              console.log('Got error: ${err.message}');
              reject(err);
            });
        })
    }
}
