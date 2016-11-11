// deletePost
var co = require('co');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();

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

    var articles_bucket = new AWS.S3({params: {Bucket: stage_articles_bucket}});

    co(function *(){
        var user = yield auth(signing_key, cookie, token_name);

        yield removePostFromDB(post_id);
        yield removePostFromS3(post_id);

        callback(null, {success: true});
    }).catch(onerror);

    function removePostFromDB(post_id){
        return new Promise(function(resolve, reject){
            var params = {
              TableName : stage_posts_table,
              Key: {
                 post_id: post_id
              },
              ReturnValues: "NONE"
            };

            docClient.delete(params, function(err, data) {
              if (err){
                reject(err);
              }else{
                resolve(post_id);
              }
            });
        })
    }

    function removePostFromS3(post_id){
        return new Promise(function(resolve, reject){
            s3.deleteObjects({ 
                Bucket: stage_articles_bucket, 
                Delete: {
                    Objects: [{
                        Key: stage_articles_bucket_path+"/"+post_id+"/index.html"
                    },{
                        Key: stage_articles_bucket_path+"/"+post_id
                    }],
                    Quiet: true
                }
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