// addCategory
var co = require('co');
var shortid = require('shortid');
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

    var category = event.category;

    co(function *(){
        var user = yield auth(signing_key, cookie, token_name);

        var categories = yield dynamoObjects(objects_table, 'categories');

        var category_id = shortid.generate();

        var new_category = {
            category_id: category_id,
            category: category,
            url_title: getSlug(category)
        }

        categories.object.push(new_category);
        yield categories.save();

        callback(null, {
            success: true,
            categories: categories.object
        });
    }).catch(onerror);


    function checkIfCategoryAlreadyExists(category){
        return new Promise(function(resolve, reject){
            var params = { 
                TableName: stage_categories_table,
                Limit: 1,
                FilterExpression: "category = :category",
                ExpressionAttributeValues: {
                    ":category": category
                }
            };

            docClient.scan(params, function(err, data) {
                if (err){
                    reject(err);
                }else{
                    if(data.Items.length == 0){
                        resolve();
                    }else{
                        reject(new Error('category already exists'));
                    }
                    
                }
            });
        })

    }

    function addCategory(category, precedence){
        return new Promise(function(resolve, reject){
            var category_id = shortid.generate();

            console.log(category_id, category, precedence);

            var params = {
              TableName : stage_categories_table,
              Item: {
                 category_id: category_id,
                 category: category,
                 url_title: getSlug(category)
              }
            };

            docClient.put(params, function(err, data) {
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