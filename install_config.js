module.exports = {
	"credentials_path": "F:/iam/lbp.json",
    "region": "eu-west-1",
	
	"user_name": "lbp",
	"role_name": "LBP_role",

	"domain_name": "lbp.example.com",
	"hosted_zone_id": "Z31EM********", /*required*/

	"lambda_prefix": "LBP",
	"bucket_name": "lbp-myblog",
	"table_prefix": "LBP_myblog",
	"api_gateway_name" : "LBP_myblog",
	"api_gateway_deployment_name": "prod",

	"cloudfront_comment": "AWS Lambda Blog Platform", /*required for locating already configured cloudfront distribution - do not change unless you want to make another blog*/
	"cloudfront_certificate_arn": "arn:aws:acm:us-east-1:128137337832:certificate/b870ad53-dea5-4ceb-aabc-**********", /*needs to be created in us-east-1*/

	"api_gateway_stage_variables" : {
		"template": "default",
		"token_name": "token",
		
		"articles_bucket_path": "static/articles",

		"categories_posts_table": "",
		"objects_table": "",
		"posts_table": "",

		"articles_bucket": "",

		"signing_key": "",

		"site_base_url": "https://lbp.example.com",
		"admin_pass": "",
		"recaptcha_privKey": "no_key",
		"contact_send_email": "me@example.com",

		"disqus_subdomain": "my_disqus_subdomain" // ___.disqus.com/embed.js
	}
}
