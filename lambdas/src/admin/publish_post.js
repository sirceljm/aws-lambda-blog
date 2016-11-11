// publishPost
var co = require('co');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();

var auth = require('../../lib/auth.js');

exports.handler = (event, context, callback) => {
    // STAGE VARIABLES FROM API GATEWAY
    var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;

    var stage_posts_table = event.posts_table;

    var post_id = event.post_id;

    co(function *(){
      var user = yield auth(signing_key, cookie, token_name);

      yield changePostStatus(post_id);

      callback(null, {success: true});
    }).catch(onerror);

    function changePostStatus(post_id){
        return new Promise(function(resolve, reject){
            var params = {
              TableName : stage_posts_table,
              Key: {
                 post_id: post_id
              },
              UpdateExpression: "set post_status = :post_status",
              ExpressionAttributeValues:{
                  ":post_status": 'published',
              },
              ReturnValues:"UPDATED_NEW"
            };

            docClient.update(params, function(err, data) {
              if (err){
                reject(err);
              }else{
                resolve(post_id);
              }
            });
        })
    }

    function onerror(err) {
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    }
}