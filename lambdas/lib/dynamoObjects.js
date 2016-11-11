
var co = require('co');
var jwt = require('jsonwebtoken');
var cookieParser = require('cookie');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();

module.exports = function(table, object_id){
	this.table = table;
	this.object_id = object_id;
	this.object = null;

	this.load = function(){
		var me = this;
		return new Promise(function(resolve, reject){
    		var params = {
	            TableName: me.table,
	            KeyConditionExpression: "object_id = :object_id",
			    ExpressionAttributeValues: {
			        ":object_id": me.object_id
			    }
	        };

	        docClient.query(params, function(err, data) {
	            if (err){
	            	console.log(err);
	                reject(err);
	            }else{
	                if(!data.Count){
	                    reject(new Error('object does not exist'));
	                }else{
	                	me.object = JSON.parse(data.Items[0].JSON);
	                    resolve(me);
	                }
	            }
	        });
    	})
	};

	this.save = function(){
		var me = this;

		return new Promise(function(resolve, reject){
			var json_str = JSON.stringify(me.object);
			var json_str_parts = json_str.match(/.{1,300000}/g);

			var promises = [];

			co(function *(){
				for(var i = 0; i < json_str_parts.length; i++){
					promises.push(
						new Promise(function(resolve, reject){
							docClient.put({
							    TableName: me.table,
							    Item:{
							        "object_id": me.object_id,
							        "part": 0,
							        "JSON": json_str_parts[i]
							    }
							}, function(err, data) {
							    if (err) {
							        reject(err);
							    } else {
							        resolve(me.object)
							    }
							});
						})
					)
				}

				var res = yield promises;
				resolve(me);
			});
		})
	}

	return this.load();
} 