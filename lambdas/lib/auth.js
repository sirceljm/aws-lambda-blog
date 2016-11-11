
var co = require('co');
var jwt = require('jsonwebtoken');
var cookieParser = require('cookie');

module.exports = function(signing_key, cookie, token_name){
	var getTokenfromCookie = function(cookie){
		if(cookie){
			return cookieParser.parse(cookie)[token_name];
		}else{
			return Promise.reject(new Error('no cookie'));
		}
	};

	var getTokenInfo = function(token, signing_key){
		if(token){
			try {
			  return Promise.resolve(jwt.verify(token, signing_key));
			} catch(err) {
			  return Promise.reject(new Error('token not valid'));
			}
		}else{
			return Promise.reject(new Error('no token'));
		}
	};

	return getTokenInfo(getTokenfromCookie(cookie), signing_key);		  

}