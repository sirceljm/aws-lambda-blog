// getTemplates
var co = require('co');

var auth = require('../../lib/auth.js');
var dynamoObjects = require('../../lib/dynamoObjects.js');

exports.handler = (event, context, callback) => {
    var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;
    var objects_table = event.objects_table;

    co(function *(){
	    var user = yield auth(signing_key, cookie, token_name);

	    var templates = yield dynamoObjects(objects_table, 'templates');

        callback(null, templates.object);
    }).catch(function(err){
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    });
}