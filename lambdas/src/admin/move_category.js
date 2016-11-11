// moveCategory
var co = require('co');
var _ = require('lodash');
var getSlug = require('speakingurl');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();

var auth = require('../../lib/auth.js');
var dynamoObjects = require('../../lib/dynamoObjects.js');

Array.prototype.move = function (old_index, new_index) {
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this; // for testing purposes
};

exports.handler = (event, context, callback) => {
    // STAGE VARIABLES FROM API GATEWAY
    var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;

    var category_id = event.category_id;
    var direction = event.direction;
    var objects_table = event.objects_table;

    co(function *(){
        var user = yield auth(signing_key, cookie, token_name);

        var categories = yield dynamoObjects(objects_table, 'categories');
                
        var category_position = _.findIndex(categories.object, function(o){return o.category_id == category_id});
        categories.object.move(category_position, (direction == "up" ? category_position-1 : category_position+1));

        yield categories.save();

        callback(null, {
            success: true,
            categories: categories.object
        });
    }).catch(onerror);

    

    function onerror(err) {
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    }
}