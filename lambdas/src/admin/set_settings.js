// setSettings
var co = require('co');

var auth = require('../../lib/auth.js');
var dynamoObjects = require('../../lib/dynamoObjects.js');

exports.handler = (event, context, callback) => {
    var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;
    var objects_table = event.objects_table;

    var new_settings = event.new_settings;
    console.log(new_settings);

    co(function *(){
	    var user = yield auth(signing_key, cookie, token_name);

	    var settings = yield dynamoObjects(objects_table, 'settings');
        settings.object = new_settings;
        yield settings.save();

        callback(null, settings.object);
    }).catch(function(err){
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    });
}