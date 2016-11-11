// removeCategory
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
    
    var category_id = event.category_id;

    co(function *(){
        var user = yield auth(signing_key, cookie, token_name);

        var categories = yield dynamoObjects(objects_table, 'categories');
        _.remove(categories.object, function(o){return o.category_id == category_id});
        yield categories.save();


        callback(null, {
            success: true,
            categories: categories.object
        });
    }).catch(function(err) {
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    });
}