Array.prototype.swap = function (index1, index2) {
    if (index1 <= this.length && index2 <= this.length) {
        var temp = this[index2];
        this[index2] = this[index1];
        this[index1] = temp;
    }
};

function addEvent(elem, event, fn){
	if(elem.addEventListener){
	  elem.addEventListener(event, fn, false);
	}else{
	  elem.attachEvent("on" + event,
	  function(){ return(fn.call(elem, window.event)); });
	}
}

var app = angular.module('app', ['ngCookies', 'ngInputModified', 'color.picker', 'naif.base64'], 
	function($locationProvider) {
		$locationProvider.html5Mode({
		  enabled: true,
		  requireBase: false
		});
    }
)
.filter('to_trusted', ['$sce', function($sce){
    return function(text) {
        return $sce.trustAsHtml(text);
    };
}]);

var checkIfLoggedIn = function(){
	return new Promise(function(resolve, reject){
		function getCookie(name) {
		  var value = "; " + document.cookie;
		  var parts = value.split("; " + name + "=");
		  if (parts.length == 2) return parts.pop().split(";").shift();
		}
		var token = getCookie("token");

		if(token){
			var decoded = jwt_decode(token);
			if(!decoded.logged_in){
				$('#loginModal').openModal({
					dismissible: false
				});
			}else{
				resolve();
			}
		}else{
			$('#loginModal').openModal({
				dismissible: false
			});
		}
	})
}

app.controller('mainController', ['$scope', '$http', '$timeout', '$cookies',
	function mainController($scope, $http, $timeout, $cookies) {
		$scope.login = function(){
			$http({
			  method: 'POST',
			  url: '/login',
			  data:{
				password: $scope.password
			  }
			}).then(function successCallback(response) {
				console.log(response);
				if(response.data.success){
					init();
					$("#loginModal").closeModal();
				}else{
					$("#loginModal input").removeClass("valid").addClass("invalid");
					console.log("wrong passs");
				}
				$scope.password = "";
			}, function errorCallback(response) {
			});
		}
		
		$scope.logout = function(){
			$cookies.remove("token", { path: '/' });
			window.location = "/";
		}
		
		var init = function(){
			checkIfLoggedIn().then(function(){
				var moved = 0;
				$scope.menu_open = false;
				$scope.display = 'posts';
				
				$('select').material_select();
				
				$scope.displayPosts = function(){
					$("#menu").animate({
						marginTop: "100vh"
					}, 400, "swing", function(){
						$scope.display = 'posts';
						$timeout(function(){
							$("#menu").animate({
								marginTop: "0"
							});
							$(".main_panel_wrap").css({
								height: ""
							})
							moved = 0;
							$scope.menu_open = false;
							$timeout(function(){
								$('.dropdown-button').dropdown();
							})
						});
						
					})
				}

				$scope.displayCategories = function(){
					$("#menu").animate({
						marginTop: "100vh"
					}, 400, "swing", function(){
						$scope.display = 'categories';
						$timeout(function(){
							$("#menu").animate({
								marginTop: "0"
							});
							$(".main_panel_wrap").css({
								height: ""
							})
							moved = 0;
							$scope.menu_open = false;
							$timeout(function(){
								$('.dropdown-button').dropdown();
							})
						});
						
					})
				}
				
				$scope.displaySettings = function(){
					$("#menu").animate({
						marginTop: "100vh"
					}, 400, "swing", function(){
						$scope.display = 'settings';
						$timeout(function(){
							$("#menu").animate({
								marginTop: "0"
							});
							$(".main_panel_wrap").css({
								height: ""
							})
							moved = 0;
							$scope.menu_open = false;
							$timeout(function(){
								$('.dropdown-button').dropdown();
							})
						});
						
					})
				}
				
				$scope.posts = [];
				$scope.addPost = function(){
					window.location.href = "/admin/post";
				}
				
				$scope.editPost = function(post_id, date){
					window.location.href = "/admin/post/?post_id="+post_id+"&date="+date;
				}
				
				$scope.categories = [];
				$scope.new_category = "";
				
				var getCategories = function(){
					return new Promise(function(resolve, reject){
						$http({
						  method: 'GET',
						  url: '/get-categories'
						}).then(function successCallback(response) {
							resolve(response.data);
						}, function errorCallback(response) {
							reject();
						})
					});
				}
				
				var getSettings = function(){
					return new Promise(function(resolve, reject){
						$http({
						  method: 'POST',
						  url: '/get-settings'
						}).then(function successCallback(response) {
							resolve(response.data);
							$scope.settings = response.data;
							$timeout(function () {
								$scope.settings_form.$setPristine();
							});
						}, function errorCallback(response) {
							reject();
						})
					});
				}
				
				var getTemplates = function(){
					return new Promise(function(resolve, reject){
						$http({
						  method: 'POST',
						  url: '/get-templates'
						}).then(function successCallback(response) {
							resolve(response.data);
							$scope.templates = response.data;
							$timeout(function(){
								$('#templates_select').material_select();
							})
						}, function errorCallback(response) {
							reject();
						})
					});
				}
				
				$scope.saveSettings = function(settings){
					return new Promise(function(resolve, reject){
						$http({
						  method: 'POST',
						  url: '/set-settings',
						  data:{
							  new_settings: settings
						  }
						}).then(function successCallback(response) {
							resolve(response.data);
							$scope.settings = response.data;
							$timeout(function () {
								$scope.settings_form.$setPristine();
							});
						}, function errorCallback(response) {
							reject();
						})
					});
				}
				
				$scope.addCategory = function(new_category){
					$http({
					  method: 'POST',
					  url: '/add-category',
					  data:{
						category: new_category
					  }
					}).then(function successCallback(response) {
						getCategories();
					}, function errorCallback(response) {
					});
				}
				
				$scope.moveCategory = function(category, index, direction){
					$scope.moving_categories = true;

					$http({
					  method: 'POST',
					  url: '/move-category',
					  data:{
						category_id: category.category_id,
						direction: direction
					  }
					}).then(function successCallback(response) {
						if(direction == "up" && index != 0){
							$scope.categories.swap(index, index-1);
						}else if(direction == "down" && index != $scope.categories.length){
							$scope.categories.swap(index, index+1);
						}
					}, function errorCallback(response) {
						console.log("error");
					});
				}
				
				$scope.editCategory = function(category, index){
					$scope.editing_categories = true;
					$scope.categories[index].editing = true;
					
					var element = document.getElementById('category_input_'+category.category_id);

					$timeout(function(){
						addEvent(element,'focus',function(){
						  var that = this;
						  setTimeout(function(){ 
							that.selectionStart = that.selectionEnd = 10000; 
							
						  }, 0);
						  
						});
						element.focus();
					})
					
				}
				
				$scope.editCategorySave = function(category, index){
					$scope.editing_categories = false;
					$scope.categories[index].editing = false;
					
					console.log(category);
					
					$http({
					  method: 'POST',
					  url: '/edit-category',
					  data:{
						category_id: category.category_id,
						category_name: category.category
					  }
					}).then(function successCallback(response) {
						
					}, function errorCallback(response) {
					});
				}
				
				$scope.deleteCategory = function(category, index){
					$http({
					  method: 'POST',
					  url: '/remove-category',
					  data:{
						category_id: category.category_id,
						precedence: category.precedence
					  }
					}).then(function successCallback(response) {
						$scope.categories.splice(index, 1);
					}, function errorCallback(response) {
					});
				}
				
				
				
			
				
				$scope.displayDate = function(ts){
					return moment(ts).format('MMM Do YYYY');
				}
				
				var getPosts = function(){
					return new Promise(function(resolve, reject){
						$http({
						  method: 'GET',
						  url: '/list-posts-admin'
						}).then(function successCallback(response) {
							$scope.posts = response.data.posts;

							$timeout(function(){
							  $('.dropdown-button').dropdown();
							  
							  var mc = new Hammer(document.getElementById('menu'));
							  mc.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });

							  var mc2 = new Hammer(document.getElementById('menu_home_button'));
							  mc2.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });
								mc2.on('tap pandown', function(ev) {
									if(ev.isFinal){
										if($scope.menu_open){
											moved = 0;
											$scope.menu_open = false;
											$("#menu").animate({
												marginTop: 0
											})
											$(".main_panel_wrap").css({
												height: ""
											})
										}else{
											moved = 335;
											$scope.menu_open = true;
											$("#menu").animate({
												marginTop: 335
											})
											$(".main_panel_wrap").css({
												height: "calc(100vh - 284px)"
											})
										}
									}
								})
								
								var prevDeltaTime = 1000;
								var prevDelta = 0;
								mc.on('pandown panup', function(ev) {
									ev.preventDefault();
									
									if(prevDeltaTime < ev.deltaTime){
										moved += ev.deltaY - prevDelta;
									}
									
									prevDelta = ev.deltaY;
									prevDeltaTime = ev.deltaTime;
									
									var mT = 0;
									if(moved < 0){
										mT = 0;
										moved = 0;
									}else if(moved > 335){
										mT = 335;
										moved = 335;
									}else{
										mT = moved;
									}
									
									$("#menu").css({
										marginTop: mT
									})
								});
								
								mc.on('panend', function(ev){
									if(ev.deltaY > 0){
										if(moved > 50){
											moved = 335;
											$scope.menu_open = true;
											$("#menu").animate({
												marginTop: 335
											})
											$(".main_panel_wrap").css({
												height: "calc(100vh - 284px)"
											})
										}else{
											moved = 0;
											$scope.menu_open = false;
											$("#menu").animate({
												marginTop: 0
											})
										}
									}else if(ev.deltaY < 0){
										if(moved < 285){
											moved = 0;
											$scope.menu_open = false;
											$("#menu").animate({
												marginTop: 0
											})
											$(".main_panel_wrap").css({
												height: ""
											})
										}else{
											moved = 335;
											$scope.menu_open = true;
											$("#menu").animate({
												marginTop: 335
											})	
											
										}
									}
								})
								return false;
							},0)
							resolve(response.data.posts);
						}, function errorCallback(response) {
							reject();
						})
						
					});
				}
				
				Promise.all([getPosts(), getCategories()]).then(function(results){
					$scope.posts = results[0];
					$scope.categories = results[1];
					
					for(var i = 0; i < $scope.categories.length; i++){
						$scope.categories[i].no_posts = 0;
						for(var j = 0; j < $scope.posts.length; j++){
							if(!$scope.posts[j].categories_names){
								$scope.posts[j].categories_names = [];
							}
							if($scope.posts[j].categories.indexOf($scope.categories[i].category_id) != -1){
								$scope.categories[i].no_posts += 1;
								$scope.posts[j].categories_names.push($scope.categories[i].category);
							}
						}
					}
					$timeout(function(){
						$('.dropdown-button').dropdown();
						$('.modal').modal({
							opacity: .1, 
						});
					})
				});
				
				/*
				 * SETTINGS
				 */
				$scope.templateChange = function(){
					if($scope.settings.template.header_image == "upload_new"){
						$('#uploadImageModal').openModal();
					}else{
						var selected_template = _.find($scope.templates, function(o){return o.image == $scope.settings.template.header_image});
						$scope.settings.template.palette = selected_template.palette;
					}
				}
				
				$scope.submitUploadedImage = function(image){
					$http({
					  method: 'POST',
					  url: '/upload-template-image',
					  data:{
						image: image
					  }
					}).then(function successCallback(response) {
						$("#uploadImageModal").closeModal();
						$scope.templates.push(response.data.new_template);
						
						$timeout(function(){
							$('#templates_select').material_select();
						})
							
						$scope.settings.template.header_image = response.data.new_template.image;
						$scope.settings.template.palette = response.data.new_template.palette;
					}, function errorCallback(response) {
					});
				}
				
				getSettings();
				getTemplates();
				
				$scope.publishPost = function(post){
					$http({
					  method: 'POST',
					  url: '/publish-post',
					  data:{
						post_id: post.post_id
					  }
					}).then(function successCallback(response) {
						$scope.posts[$scope.posts.indexOf(post)].post_status = 'published';
					}, function errorCallback(response) {
					});
				}
				
				$scope.unpublishPost = function(post){
					$http({
					  method: 'POST',
					  url: '/unpublish-post',
					  data:{
						post_id: post.post_id
					  }
					}).then(function successCallback(response) {
						$scope.posts[$scope.posts.indexOf(post)].post_status = 'draft';
					}, function errorCallback(response) {
					});
				}
				
				$scope.deletePost = function(post){
					$http({
					  method: 'POST',
					  url: '/delete-post',
					  data:{
						post_id: post.post_id
					  }
					}).then(function successCallback(response) {
						$scope.posts.splice($scope.posts.indexOf(post), 1);
					}, function errorCallback(response) {
					});
				}			
			});
		}
		
		init();
	}]
);

app.controller('postController', ['$scope', '$http', '$location', '$timeout', '$cookies',
	function postController($scope, $http, $location, $timeout, $cookies) {	
		checkIfLoggedIn().then(function(){
			 var $input = $('.datepicker').pickadate({
				selectMonths: true,
				selectYears: 15,
				format: 'd mmmm, yyyy',
				formatSubmit: 'dd/mm/yyyy',
			  });
			
			var picker = $input.pickadate('picker');
			
			$scope.post = {
				status: false
			};
			$scope.post_id = $location.search()['post_id'];					
			$scope.categories = [];
			$scope.outputCategories = [];
			$scope.date = undefined;
			
			$scope.displayMain = function(){
				window.location = "/admin";
			}
			
			$scope.displayFrontpage = function(){
				window.location = "/";
			}
			
			$scope.postHasCategory = function(post, category_id){
				if(post.categories){
					for(var i = 0; i < post.categories.length; i++){
						if(post.categories[i].category_id == category_id){
							return true;
						}
					}
				}
				return false;
			}
			
			ContentTools.IMAGE_UPLOADER = imageUploader;
			var editor = ContentTools.EditorApp.get();
			
			

			var getPostAdmin = function(post_id, post_date){
				return new Promise(function(resolve, reject){
					$http({
					  method: 'POST',
					  url: '/get-post-admin',
					  data:{
						post_id: post_id,
						date: post_date
					  }
					}).then(function successCallback(response) {

						$scope.post.title = response.data.title;
						$scope.post.status = (response.data.post_status == 'published' ? true : false);
						$scope.post.date = response.data.date;
						$scope.post.categories = response.data.categories;
						$scope.post_html = response.data.post_html;
						
						resolve();
					}, function errorCallback(response) {
						reject()
					})
				}); 
				
			}
			
			var getCategories = function(){
				return new Promise(function(resolve, reject){
					$http({
					  method: 'GET',
					  url: '/get-categories'
					}).then(function successCallback(response) {
						$scope.categories = response.data;		
						resolve();
					}, function errorCallback(response) {
						reject();
					})
				})
			}
			
			if($scope.post_id){
				Promise.all([getPostAdmin($scope.post_id), getCategories()]).then(values => { 
					$timeout(function(){
						picker.set('select', $scope.post.date);
						$('#categories_select').material_select();
					}, 0);					  
				
					var selectedCategories = $scope.post.categories;
					for(var i = 0; i < selectedCategories.length; i++){
						for(var j = 0; j < $scope.categories.length; j++){
							if($scope.categories[j].category_id == selectedCategories[i].category_id){
								$scope.categories[j].ticked = true;
							}
							
						}
					}
					
					$timeout(function(){
						var el = document.getElementById("aaa");
						editor.init('[data-editable]', 'data-name', null, false, el);
						editor.start();
									
					}, 0)
				});
			}else{		
				getCategories().then(function(){
					$timeout(function(){
						picker.set('select', $scope.post.date);
						$('#categories_select').material_select();
					}, 0);	
				})
				
				var el = document.getElementById("aaa");
				editor.init('[data-editable]', 'data-name', null, false, el);
				editor.start();
			}


			
			
			
			
			$scope.submitPostPanelOpen = false;
			
			$scope.closeSubmitPostPanel = function(){
				$scope.submitPostPanelOpen = false;
				$( ".submit_post_panel" ).animate({
					bottom: "-=300",
				  }, 300, 'swing', function() {});

			}
			
			$scope.openSubmitPostPanel = function(){
				$scope.submitPostPanelOpen = true;
				$( ".submit_post_panel" ).animate({
					bottom: "+=300",
				  }, 300, 'swing', function() {});
			}
			
			editor.addEventListener('saved', function (ev) {
				console.log("saved");
				
				var regions = ev.detail().regions;
				console.log(regions['article-body']);
				
				if(regions['article-body']){
					$scope.post.content = regions['article-body'];
				}
				
				if(!$scope.post.content){
					$('#toast-container').empty();
					Materialize.toast(
						$('<span><i class="fa fa-exclamation toast_icon"></i>You need to write something first!</span>'), 
						4000, 
						'orange lighten-1'
					);
				}else if(!$scope.post.title){
					$('#toast-container').empty();
					Materialize.toast(
						$('<span><i class="fa fa-exclamation toast_icon"></i>Title of your blog post is missing!</span>'), 
						4000, 
						'orange lighten-1'
					);
				}else if(!$scope.post.categories){
					$('#toast-container').empty();
					Materialize.toast(
						$('<span><i class="fa fa-exclamation toast_icon"></i>Please select at least one category!</span>'), 
						4000, 
						'orange lighten-1'
					);
				}else if(!$scope.post.date){
					$('#toast-container').empty();
					Materialize.toast(
						$('<span><i class="fa fa-exclamation toast_icon"></i>You need to enter a date of submittion!</span>'), 
						4000, 
						'orange lighten-1'
					);
				}else{
					$('#toast-container').empty();
					
					Materialize.toast(
						$('<span><i class="fa fa-spinner fa-pulse toast_icon"></i>Submitting your post!</span>'), 
						4000000, 
						'light-blue accent-2'
					);
					
					$http({
					  method: 'POST',
					  url: '/submit-post',
					  data: {
						post_id: $scope.post_id || null,
						post_status: ($scope.post.status ? "published" : "draft"),
						title: $scope.post.title,
						categories: $scope.post.categories,
						date: $scope.post.date,
						html: $scope.post.content
					  }
					}).then(function successCallback(response) {
						$timeout(function(){
							if(response.data.status == "success"){
								$('#toast-container').empty();
								Materialize.toast(
									$('<span><i class="fa fa-check toast_icon"></i>Your post was submitted!</span>'), 
									1000, 
									'green lighten-1',
									function(){
										window.location.href = "/admin/";
									}
								);
							}else{
								$('#toast-container').empty();
								Materialize.toast(
									$('<span><i class="fa fa-check toast_icon"></i>There was an error!</span>'), 
									4000, 
									'orange lighten-1',
									function(){
										
									}
								);
							}
						}, 500);
					}, function errorCallback(response) {
					});
				}
			});
			
			$scope.submitPost = function(){
				editor.save(true);
			}
			
			
			function imageUploader(dialog) {
				 var image, xhr, xhrComplete, xhrProgress;

				dialog.addEventListener('imageuploader.fileready', function (ev) {

					// Upload a file to the server
					var formData;
					var file = ev.detail().file;

					// Define functions to handle upload progress and completion
					xhrProgress = function (ev) {
						// Set the progress for the upload
						dialog.progress((ev.loaded / ev.total) * 100);
					}

					xhrComplete = function (ev) {
						var response;

						// Check the request is complete
						if (ev.target.readyState != 4) {
							return;
						}

						// Clear the request
						xhr = null
						xhrProgress = null
						xhrComplete = null

						// Handle the result of the upload
						if (parseInt(ev.target.status) == 200) {
							// Unpack the response (from JSON)
							response = JSON.parse(ev.target.responseText);

							// Store the image details
							image = {
								size: response.image.size,
								url: response.image.url
							};

							// Populate the dialog
							dialog.populate(image.url, image.size);

						} else {
							// The request failed, notify the user
							new ContentTools.FlashUI('no');
						}
					}

					// Set the dialog state to uploading and reset the progress bar to 0
					dialog.state('uploading');
					dialog.progress(0);

					// Build the form data to post to the server
					formData = new FormData();
					formData.append('image', file);
					
					var reader  = new FileReader();

					  reader.addEventListener("load", function () {
						// Make the request
						xhr = new XMLHttpRequest();
						xhr.upload.addEventListener('progress', xhrProgress);
						xhr.addEventListener('readystatechange', xhrComplete);
						xhr.open('POST', '/upload-image', true);
						xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
						xhr.send(JSON.stringify({
							image: reader.result
						}));
						
					  }, false);
  
					  if (file) {
						  reader.readAsDataURL(file);
					  }

					
				});
				
				dialog.addEventListener('imageuploader.cancelupload', function () {
					// Cancel the current upload

					// Stop the upload
					if (xhr) {
						xhr.upload.removeEventListener('progress', xhrProgress);
						xhr.removeEventListener('readystatechange', xhrComplete);
						xhr.abort();
					}

					// Set the dialog to empty
					dialog.state('empty');
				});
				
				dialog.addEventListener('imageuploader.clear', function () {
					// Clear the current image
					dialog.clear();
					image = null;
				});
				
				function rotateImage(direction) {
					// Request a rotated version of the image from the server
					var formData;

					// Define a function to handle the request completion
					xhrComplete = function (ev) {
						var response;

						// Check the request is complete
						if (ev.target.readyState != 4) {
							return;
						}

						// Clear the request
						xhr = null
						xhrComplete = null

						// Free the dialog from its busy state
						dialog.busy(false);

						// Handle the result of the rotation
						if (parseInt(ev.target.status) == 200) {
							// Unpack the response (from JSON)
							response = JSON.parse(ev.target.responseText);

							// Store the image details (use fake param to force refresh)
							image = {
								size: response.image.size,
								url: response.image.url + '?_ignore=' + Date.now()
							};

							// Populate the dialog
							dialog.populate(image.url, image.size);

						} else {
							// The request failed, notify the user
							new ContentTools.FlashUI('no');
						}
					}

					// Set the dialog to busy while the rotate is performed
					dialog.busy(true);

					// Build the form data to post to the server
					formData = new FormData();
					formData.append('url', image.url);
					formData.append('direction', direction);

					// Make the request
					xhr = new XMLHttpRequest();
					xhr.addEventListener('readystatechange', xhrComplete);
					xhr.open('POST', '/rotate-image', true);
					xhr.send(formData);
				}

				dialog.addEventListener('imageuploader.rotateccw', function () {
					rotateImage('CCW');
				});

				dialog.addEventListener('imageuploader.rotatecw', function () {
					rotateImage('CW');
				});
				
				dialog.addEventListener('imageuploader.save', function () {
					console.log(image);
					dialog.save(
						image.url,
						image.size,
						{
							'data-ce-max-width': image.size[0]
						}
					)
					return; 
					
					var crop, cropRegion, formData;

					// Define a function to handle the request completion
					xhrComplete = function (ev) {
						// Check the request is complete
						if (ev.target.readyState !== 4) {
							return;
						}

						// Clear the request
						xhr = null
						xhrComplete = null

						// Free the dialog from its busy state
						dialog.busy(false);

						// Handle the result of the rotation
						if (parseInt(ev.target.status) === 200) {
							// Unpack the response (from JSON)
							var response = JSON.parse(ev.target.responseText);

							// Trigger the save event against the dialog with details of the
							// image to be inserted.
							

						} else {
							// The request failed, notify the user
							new ContentTools.FlashUI('no');
						}
					}

					// Set the dialog to busy while the rotate is performed
					dialog.busy(true);

					// Build the form data to post to the server
					formData = new FormData();
					formData.append('url', image.url);

					// Set the width of the image when it's inserted, this is a default
					// the user will be able to resize the image afterwards.
					formData.append('width', 600);

					// Check if a crop region has been defined by the user
					if (dialog.cropRegion()) {
						formData.append('crop', dialog.cropRegion());
					}

					// Make the request
					xhr = new XMLHttpRequest();
					xhr.addEventListener('readystatechange', xhrComplete);
					xhr.open('POST', '/insert-image', true);
					xhr.send(formData);
				});
			}
		});
	}]
);