// sendMessage
var validator = require('validator');
var co = require('co');
var needle = require('needle');

var AWS = require('aws-sdk');
var ses = new AWS.SES();


exports.handler = function(event, context) {
	var data = event.data;
	var contact_send_email = event.contact_send_email;

	var captchaPrivateKey = event.recaptcha_privKey;
	var captchaResponse = event.captchaResponse;

	co(function *(){
	  
		var email = event.email.toLowerCase();

		yield isCaptchaValid(captchaResponse, captchaPrivateKey);
		yield isValid(email);

		yield sendEmail(email, event.name, event.message);


		context.succeed({
			success: true
		})

	}).catch(function(err) {
		console.log("ERROR!");
		console.log(err);
		callback(err.message);
	});

	function isCaptchaValid(captcha, key){	
		return new Promise(function(resolve, reject){
			needle.get(
			    'https://www.google.com/recaptcha/api/siteverify?secret='+key+'&response='+captcha,
			    function (error, response, body) {
			        if (!error && response.statusCode == 200) {
			            if(body.success){
			            	resolve();
			            }else{
			            	reject(new Error('captcha error'))
			            }
			        }else{
			        	reject(error);
			        }
			    }
			);
		})
	}

	function isValid(email){
		return (validator.isEmail(email) ? Promise.resolve() : Promise.reject(new Error('email not valid')));
	}

	
	function sendEmail(email, name, message){
		return new Promise(function(resolve, reject){
			// TODO from API variables
			ses.sendEmail({ 
				Source: contact_send_email, 
				Destination: { ToAddresses: [contact_send_email] },
				Message: {
				   Subject:{
				      Data: 'New message from '+name+' ('+email+')'
				   },
				   Body: {
				       Text: {
				           Data: message
				       }
				    }
				}
			}, function(err, data) {
				if(err){
					reject(err);
				}else{
					resolve();
				}
			});
		});
	}
}


