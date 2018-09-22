// contact
var co = require('co');
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
        template: require('html!../../templates/'+template+'/contact.html')
    } 
}

exports.handler = (event, context, callback) => {
    var objects_table = event.objects_table;
    var site_base_url = event.site_base_url;
    var posts_table = event.posts_table;
    var captcha_sitekey = event.captcha_key;

    var template = event.template;

    var templates = get_templates(template);

    co(function *(){
        var categories_object = yield dynamoObjects(objects_table, 'categories');
        var categories = categories_object.object;
        var settings_object = yield dynamoObjects(objects_table, 'settings');
        var settings = settings_object.object;

        var posts = yield getBlogPostsFromDB();
        var recent_posts = _.clone(posts);

        for(var i = 0; i < categories.length; i++){
            if(!_.find(posts, function(post){return _.includes(post.categories, categories[i].category_id)})){
                categories.splice(i, 1);
                i--;
            }
        }


        var html = doT.template(templates.main_template)({
            header: doT.template(templates.header)({
                website_title: settings.website_title,
                header_title: settings.header_title,
                header_desc: settings.header_desc,
                
                site_base_url: site_base_url,
                categories: categories,
                recent_posts: recent_posts,
                template_settings: settings.template
            }),
            content: doT.template(templates.template)({
                site_base_url: site_base_url,
                moment: moment,
                categories: categories,
                recent_posts: recent_posts,
                captcha_sitekey: captcha_sitekey
            }),
            footer: doT.template(templates.footer)({
                site_base_url: site_base_url
            }),
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
    

    function onerror(err) {
        console.log("ERROR!");
        console.log(err);
        console.log(arguments);
        callback(err.message);
    }
}
