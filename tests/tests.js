
var should = require('should');
var request = require('supertest');

var test_config = require('../install_test.json');

var website_base_path = test_config.api_gateway_url;

describe('Frontpage', function() {
  var check_page_response = function(base_url, page, required_response, required_content_type){
    it('GET '+base_url+page+" should return status:"+required_response+" & Content-Type:"+required_content_type, function (done) {
      request(base_url)
        .get(page)
        .expect('Content-Type', required_content_type)
        .expect(required_response, done)
    })
  }
  
  var html_pages = ["/","/about","/contact","/list"];

  for(var i = 0; i < html_pages.length; i++){
    check_page_response(website_base_path, html_pages[i], 200, 'text/html');
  }

  var rss_pages = ["/rss"];

  for(var i = 0; i < rss_pages.length; i++){
    check_page_response(website_base_path, rss_pages[i], 200, 'application/rss+xml');
  }
})


var success_true = function(res){
  console.log(res.body);
  res.body.success.should.equal(true);
}

var success_false = function(res){
  res.body.success.should.equal(false);
}

describe('Login', function(){
  it('Login with wrong password should return success false & no cookie', function (done) {
    request(website_base_path)
      .post("/login") 
      .send({
        password: ""
      })
      .expect('Content-Type', "application/json")
      .expect(200)
      .expect(success_false)
      .end(done)
  })

  it('Login with right password should return success true & cookie with token', function (done) {
    request(website_base_path)
      .post("/login")
      .send({
        password: test_config.admin_password
      })
      .expect('Content-Type', "application/json")
      .expect(200)
      .expect(success_true)
      .end(done)
  })

})
