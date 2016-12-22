// rss

var co = require('co');
var https = require('https');
var doT = require('dot');
var moment = require('moment');
var _ = require('lodash');
var escape = require('escape-html');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();

var dynamoObjects = require('../../lib/dynamoObjects.js');

var get_templates = function(template){
    return {
        template: require('html!../../templates/'+template+'/rss.html')
    } 
}

exports.handler = (event, context, callback) => {
    var site_base_url = event.site_base_url;

    var articles_bucket_path = event.articles_bucket_path;
    var posts_table = event.posts_table;
    var objects_table = event.objects_table;

    var template = event.template;

    var templates = get_templates(template);

    co(function *(){
        var settings_object = yield dynamoObjects(objects_table, 'settings');
        var settings = settings_object.object;

        var posts = yield getBlogPostsFromDB();

        var html = doT.template(templates.template)({
            website_title: settings.website_title,
            header_title: settings.header_title,
            header_desc: settings.header_desc,

            site_base_url: site_base_url,
            moment: moment,
            escape: escape,
            posts: posts
        });

        callback(null, html);
    }).catch(onerror);

    function getBlogPostsFromDB(){
        return new Promise(function(resolve, reject){
            var params = { 
                TableName: posts_table,
                IndexName: "post_status-date-index",
                KeyConditionExpression: "post_status = :post_status AND #date > :date",
                
                ExpressionAttributeNames: {"#date": "date"},

                ExpressionAttributeValues: {
                    ":post_status": "published",
                    ":date": 0
                },
                ScanIndexForward: false
            };

            docClient.query(params, function(err, data) {
                if (err){
                    reject(err);
                }else{
                    resolve(data.Items);
                }
            });
        })
    }

    function getBlogPostHtml(post_id){
        return new Promise(function(resolve, reject){
            https.get(site_base_url+"/"+articles_bucket_path+"/"+post_id+"/index.html", (response) => {
                var body = [];
                response.on('data', function(chunk) {
                  body.push(chunk);
                }).on('end', function() {
                    body = Buffer.concat(body).toString('utf8');
                    resolve(body);
                }).on('error', function(err) {
                    reject(err);
                });
            }).on('error', (e) => {
              console.log(`Got error: ${e.message}`);
            });
        });
    }

    function onerror(err) {
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    }
}