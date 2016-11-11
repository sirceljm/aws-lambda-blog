// editCategory
var co = require('co');
var _ = require('lodash');
var getSlug = require('speakingurl');

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

    var category_id = event.category_id;
    var category_name = event.category_name;

    co(function *(){
        var user = yield auth(signing_key, cookie, token_name);

        var categories = yield dynamoObjects(objects_table, 'categories');

        var category_to_change = categories.object[_.findIndex(categories.object, function(o){return o.category_id == category_id})];
        category_to_change.category = category_name;
        category_to_change.url_title = getSlug(category_name);

        yield categories.save();

        callback(null, {
            success: true,
            categories: categories.object
        });
    }).catch(onerror);


    function checkIfCategoryExists(category_id){
        return new Promise(function(resolve, reject){
            var params = {
                TableName: stage_categories_table,
                Key:{
                    "category_id": category_id
                }
            };

            docClient.get(params, function(err, data) {
                if (err){
                    reject(err);
                }else{
                    if(!data.Item){
                        reject(new Error('category does not exist'));
                    }else{
                        resolve();
                    }
                    
                }
            });
        })

    }

    function editCategory(category_id, category_name){
        console.log(category_id, category_name);
        return new Promise(function(resolve, reject){
            var params = {
                TableName: stage_categories_table,
                Key:{
                    "category_id": category_id
                },
                UpdateExpression: "set category = :category_name",

                ExpressionAttributeValues:{
                    ":category_name":category_name
                },
                ReturnValues:"UPDATED_NEW"
            }

            docClient.update(params, function(err, data) {
              if (err){
                reject(err);
              }else{
                resolve(category_id);
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