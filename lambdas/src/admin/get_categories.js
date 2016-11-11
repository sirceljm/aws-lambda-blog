// getCategories
var co = require('co');
var _ = require('lodash');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();

var auth = require('../../lib/auth.js');
var dynamoObjects = require('../../lib/dynamoObjects.js');

exports.handler = (event, context, callback) => {
    // STAGE VARIABLES FROM API GATEWAY
    var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;
    var objects_table = event.objects_table;

    var stage_categories_table = event.categories_table;
    
    co(function *(){
    	var user = yield auth(signing_key, cookie, token_name);
    	var categories = yield dynamoObjects(objects_table, 'categories');
        
        callback(null, categories.object);
    }).catch(onerror);


    function getCategories(){
        return new Promise(function(resolve, reject){
            var params = { 
                TableName: stage_categories_table,
            };

            docClient.scan(params, function(err, data) {
                if (err){
                    reject(err);
                }else{
                    var sorted_categories = _.sortBy(data.Items, 'precedence');
                    resolve(sorted_categories);
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