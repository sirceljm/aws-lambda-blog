// login
var co = require('co');

var jwt = require('jsonwebtoken');
var moment = require('moment');

exports.handler = (event, context, callback) => {
	var signing_key = event.signing_key;
	var admin_pass = event.admin_pass;
	var user_pass = event.user_pass;
	var remember_me = event.remember_me;

	co(function *(){
		yield checkPass(admin_pass, user_pass);
		var jwt = yield generateJWT(signing_key);
		
		var expires = moment().add(14, 'days').format('ddd, D MMM YYYY hh:mm:ss UTC');
		if(remember_me){	
			callback(null, { 
				success: true,
				Cookie: "token="+jwt+"; path=/; expires="+expires+";",
			});
		}else{
			callback(null, { 
				success: true,
				Cookie: "token="+jwt+"; path=/;",
			});
		}
	}).catch(function(err) {
		callback(null, {
			success: false
		});
	});

	function checkPass(admin_pass, user_pass){
		console.log(admin_pass, user_pass);
		return new Promise(function(resolve, reject){
			if(admin_pass == user_pass){
				resolve();
			}else{
				reject(new Error("Wrong password"));
			}
		});
	}

	function generateJWT(signing_key){
		return Promise.resolve(
			jwt.sign({
				logged_in: true,
			}, signing_key)
		);
	}

}

