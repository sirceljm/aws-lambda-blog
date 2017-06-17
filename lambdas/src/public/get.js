// get

require('dotenv').config();
var co = require('co');
var https = require('https');
var doT = require('dot');
var moment = require('moment');
var _ = require('lodash');

var AWS = require('aws-sdk');
AWS.config.update({ accessKeyId: "myKeyId", secretAccessKey: "secretKey", region: "localhost" });
var cfg = { "endpoint": new AWS.Endpoint("http://localhost:8001")};
AWS.config.update(cfg);

var docClient = new AWS.DynamoDB.DocumentClient();

var dynamoObjects = require('../../lib/dynamoObjects.js');

var get_templates = function(template){
    return {
        main_template: require('raw!../../templates/'+template+'/main.html'),
        header: require('raw!../../templates/'+template+'/header.html'),
        footer: require('raw!../../templates/'+template+'/footer.html'),
        template: require('raw!../../templates/'+template+'/posts.html')
    } 
}

console.log(process.env.TEST_ENV);

exports.handler = (event, context, callback) => {
    const site_base_url = process.env.site_base_url;

    const articles_bucket_path = process.env.articles_bucket_path;
    const posts_table = process.env.posts_table;
    const objects_table = process.env.objects_table;

    const template = process.env.template;

    const templates = get_templates(template);

    if(event.pathParams && event.pathParams['page']){
        var page = parseInt(event.pathParams['page']) || 0;
    }else{
        var page = 0;
    }

    co(function *(){
        var categories_object = yield dynamoObjects(objects_table, 'categories');
        var categories = categories_object.object;
        var settings_object = yield dynamoObjects(objects_table, 'settings');
        var settings = settings_object.object;

        console.log("1");
        var posts = yield getBlogPostsFromDB();
        var recent_posts = _.clone(posts);

        var posts_html = [];
        var j = 0;
        console.log("2");
        for(var i = page*settings.no_posts_per_page; i < (page + 1)*settings.no_posts_per_page; i++){
            if(posts[i]){
                posts_html.push(getBlogPostHtml(posts[i].post_id));
                posts[i].html = j;
                j++;               
            }
        }

        var resolved_posts_html = yield posts_html;
        console.log("3");
        for(var i = 0; i < categories.length; i++){
            if(!_.find(posts, function(post){return _.includes(post.categories, categories[i].category_id)})){
                categories.splice(i, 1);
                i--;
            }
        }
        console.log("4");
        var html = doT.template(templates.main_template)({
            header: doT.template(templates.header)({
                website_title: settings.website_title,
                header_title: settings.header_title,
                header_desc: settings.header_desc,
                
                site_base_url: site_base_url,
                categories: categories,
                template_settings: settings.template,
                recent_posts: recent_posts,
                page: page,
                last_page: Math.ceil(posts.length / settings.no_posts_per_page)-1
            }),
            content: doT.template(templates.template)({
                site_base_url: site_base_url,
                moment: moment,
                categories: categories,
                posts: posts,
                recent_posts: recent_posts,
                posts_html: resolved_posts_html,
                page: page,
                no_posts_per_page: settings.no_posts_per_page,
                last_page: Math.ceil(posts.length / settings.no_posts_per_page)-1
            }),
            footer: doT.template(templates.footer)({
                site_base_url: site_base_url
            }),
        });

        callback(null, html);
    }).catch(onerror);

    function getBlogPostsFromDB(){
        return new Promise(function(resolve, reject){
            console.log(posts_table);
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
            console.log("DOC CLIENT");
            docClient.query(params, function(err, data) {
                if (err){
                    console.log("ERR");
                    reject(err);
                }else{
                    resolve(data.Items);
                }
            });
        })
    }

    function getBlogPostHtml(post_id){
        return "";
        return new Promise(function(resolve, reject){
            console.log(site_base_url+"/"+articles_bucket_path+"/"+post_id+"/index.html");
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