// uploadTemplateImage
var co = require('co');
var shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

var vibrant = require('node-vibrant');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3({
    signatureVersion: 'v4'
});

var auth = require('../../lib/auth.js');
var dynamoObjects = require('../../lib/dynamoObjects.js');

String.prototype.toLongHEX = function(){
    var hash = this[0];
    var r = this[1];
    var g = this[2];
    var b = this[3];
    return hash + r + r + g + g + b + b; 
}
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

        var image_buffer = new Buffer(image.base64, 'base64');

        var pallete = yield getPalette(image_buffer);
        var image_obj = yield saveImageToS3(image, image_buffer);
        
        var templates = yield dynamoObjects(objects_table, 'templates');

        var new_template = {
            image: image_obj.url,
            palette: {
                Vibrant: (pallete.Vibrant ? pallete.Vibrant.getHex() : "#ffffff"),
                VibrantText: (pallete.Vibrant ? pallete.Vibrant.getBodyTextColor().toLongHEX() : "#000000"),
                VibrantTitle: (pallete.Vibrant ? pallete.Vibrant.getTitleTextColor().toLongHEX() : "#000000"),

                Muted: (pallete.Muted ? pallete.Muted.getHex() : "#ffffff"),
                MutedText: (pallete.Muted ? pallete.Muted.getBodyTextColor().toLongHEX() : "#000000"),
                MutedTitle: (pallete.Muted ? pallete.Muted.getTitleTextColor().toLongHEX() : "#000000"),

                DarkVibrant: (pallete.DarkVibrant ? pallete.DarkVibrant.getHex() : "#ffffff"),
                DarkVibrantText: (pallete.DarkVibrant ? pallete.DarkVibrant.getBodyTextColor().toLongHEX() : "#000000"),
                DarkVibrantTitle: (pallete.DarkVibrant ? pallete.DarkVibrant.getTitleTextColor().toLongHEX() : "#000000"),

                DarkMuted: (pallete.DarkMuted ? pallete.DarkMuted.getHex() : "#ffffff"),
                DarkMutedText: (pallete.DarkMuted ? pallete.DarkMuted.getBodyTextColor().toLongHEX() : "#000000"),
                DarkMutedTitle: (pallete.DarkMuted ? pallete.DarkMuted.getTitleTextColor().toLongHEX() : "#000000"),

                LightVibrant: (pallete.LightVibrant ? pallete.LightVibrant.getHex() : "#ffffff"),
                LightVibrantText: (pallete.LightVibrant ? pallete.LightVibrant.getBodyTextColor().toLongHEX() : "#000000"),
                LightVibrantTitle: (pallete.LightVibrant ? pallete.LightVibrant.getTitleTextColor().toLongHEX() : "#000000"),

                LightMuted: (pallete.LightMuted ? pallete.LightMuted.getHex() : "#ffffff"),
                LightMutedText: (pallete.LightMuted ? pallete.LightMuted.getBodyTextColor().toLongHEX() : "#000000"),
                LightMutedTitle: (pallete.LightMuted ? pallete.LightMuted.getTitleTextColor().toLongHEX() : "#000000"),
            }
        }

        templates.object.push(new_template);
        templates.save();

        callback(null, {
            status: 'success',
            new_template: new_template
        });
    }).catch(onerror);

    function getPalette(buffer){
        return new Promise(function(resolve, reject){
            vibrant.from(buffer).getPalette(function(err, palette) {
                if(err){
                    reject(new Error("Vibrant error"));
                }else{
                    resolve(palette);
                }
            }); 
        })
    }

    function saveImageToS3(image, image_buffer){
		return new Promise(function(resolve, reject){
            var img_id = shortid.generate();

            s3.putObject({ 
                Bucket: stage_articles_bucket, 
                Key: "images/"+img_id+".png", 
                Body: image_buffer,
                ContentType: image.filetype,
                ACL: 'public-read'
            }, function(err, data) {
                if(err){
                    reject(err);
                }else{
                    resolve({
                        url: "/images/"+img_id+".png"
                    });
                }
            })
			        
        })

    }
    

    function onerror(err) {
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    }
}