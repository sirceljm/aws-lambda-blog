// getPost

var co = require('co');
var https = require('https');
var doT = require('dot');
var moment = require('moment');
var _ = require('lodash');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();

var dynamoObjects = require('../../lib/dynamoObjects.js');


var get_templates = function(template){
    return {
        main_template: require('html!../../templates/'+template+'/main.html'),
        header: require('html!../../templates/'+template+'/header.html'),
        footer: require('html!../../templates/'+template+'/footer.html'),
        template: require('html!../../templates/'+template+'/post.html')
    } 
}


exports.handler = (event, context, callback) => {
    var site_base_url = event.site_base_url;
    var stage_articles_bucket_path = event.articles_bucket_path;
    var posts_table = event.posts_table;
    var objects_table = event.objects_table;

    var template = event.template;
    var disqus_subdomain = event.disqus_subdomain;

    var templates = get_templates(template);

    var post_url = event.pathParams['post-id'];
    var post_id = post_url.split('_').slice(-1).pop();


    co(function *(){
        var categories_object = yield dynamoObjects(objects_table, 'categories');
        var categories = categories_object.object;
        var settings_object = yield dynamoObjects(objects_table, 'settings');
        var settings = settings_object.object;

        var post = yield getBlogPostFromDB(post_id);
        var posts = yield getBlogPostsFromDB(); 

        for(var i = 0; i < categories.length; i++){
            if(!_.find(posts, function(post){return _.includes(post.categories, categories[i].category_id)})){
                categories.splice(i, 1);
                i--;
            }
        }

        var post_html = yield getBlogPostHtml(post_id);

        var html = doT.template(templates.main_template)({
            header: doT.template(templates.header)({
                website_title: settings.website_title,
                header_title: settings.header_title,
                header_desc: settings.header_desc,
                
                site_base_url: site_base_url,
                categories: categories,
                template_settings: settings.template,
                recent_posts: posts
            }),
            content: doT.template(templates.template)({
                site_base_url: site_base_url,
                moment: moment,
                categories: categories,
                post: post,
                recent_posts: posts,
                post_html: post_html,
                disqus_subdomain: disqus_subdomain
            }),
            footer: doT.template(templates.footer)({
                site_base_url: site_base_url,
                categories: categories,
                recent_posts: posts,
            }),
        });

        

        callback(null, html);
    }).catch(onerror);

    function getBlogPostFromDB(post_id){
        return new Promise(function(resolve, reject){
            var params = { 
                TableName: posts_table,
                Key:{
                    post_id: post_id
                }
            };

            docClient.get(params, function(err, data) {
                if (err){
                    reject(err);
                }else{
                    resolve(data.Item);
                }
            });

        })
    }

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
            https.get(site_base_url+"/"+stage_articles_bucket_path+"/"+post_id+"/index.html", (response) => {
                var body = [];
                response.on('data', function(chunk) {
                  body.push(chunk);
                }).on('end', function() {
                    body = ""+Buffer.concat(body).toString('utf8');
                    resolve(body);
                }).on('error', function(err) {
                    reject(err);
                });
            }).on('error', (e) => {
              console.log(`Got error: ${e.message}`);
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