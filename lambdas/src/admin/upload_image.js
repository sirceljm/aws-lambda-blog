// uploadImage
var co = require('co');
var shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

var imageSize = require('image-size');
var Jimp = require("jimp");

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3({
    signatureVersion: 'v4'
});

var auth = require('../../lib/auth.js');
var dynamoObjects = require('../../lib/dynamoObjects.js');

exports.handler = (event, context, callback) => {
    // STAGE VARIABLES FROM API GATEWAY
    var stage = event.stage;
    var signing_key = event.signing_key;
    var cookie = event.cookie;
    var token_name = event.token_name;
    var objects_table = event.objects_table;
    
    var stage_articles_bucket = event.articles_bucket;
    var stage_articles_bucket_path = event.articles_bucket_path;
    var stage_articles_table = event.articles_table;

    var image = event.image;

    //console.log(image);

    var articles_bucket = new AWS.S3({params: {Bucket: stage_articles_bucket}});

    co(function *(){
        var user = yield auth(signing_key, cookie, token_name);

        var settings = yield dynamoObjects(objects_table, 'settings');
                
        var image_obj = yield saveImageToS3(image, settings.object.image_max_dimensions.width, settings.object.image_max_dimensions.height);

        callback(null, {
            status: 'success',
            image: image_obj
        });
    }).catch(onerror);

    function saveImageToS3(image, max_width, max_height){
        function decodeBase64Image(dataString) {
          var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          var response = {};

          if (matches.length !== 3) 
          {
            return new Error('Invalid input string');
          }

          response.type = matches[1];
          response.data = new Buffer(matches[2], 'base64');

          return response;
        }

		return new Promise(function(resolve, reject){

	        var image_buffer = decodeBase64Image(image); 

	    	Jimp.read(image_buffer.data, function (err, image) {
	    		if(err){
		    		reject(err);
		    	}
			    image.scaleToFit(parseInt(max_width), parseInt(max_height));

			    image.getBuffer(Jimp.AUTO, function(err, image){
			    	if(err){
			    		reject(err);
			    	}else{
				    	var dimensions = imageSize(image);

			            var img_id = shortid.generate();

			            s3.putObject({ 
			                Bucket: stage_articles_bucket, 
			                Key: "images/"+img_id+".png", 
			                Body: image,
			                ContentType: image_buffer.type,
			                ACL: 'public-read'
			            }, function(err, data) {
			                if(err){
			                    reject(err);
			                }else{
			                    resolve({
			                        url: "/images/"+img_id+".png",
			                        size: [dimensions.width, dimensions.height],
			                        type: image_buffer.type
			                    });
			                }
			            })
			        }
			    });
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