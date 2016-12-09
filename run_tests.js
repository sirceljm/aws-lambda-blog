var fs = require("fs");
var path = require("path");
var Mocha = require('mocha');
var mocha = new Mocha();


function Tests(){
	var testDir = 'tests'

	// Add each .js file to the mocha instance
	fs.readdirSync(testDir).filter(function(file){
	    // Only keep the .js files
	    return file.substr(-3) === '.js';

	}).forEach(function(file){
	    mocha.addFile(
	        path.join(testDir, file)
	    );
	});
}

Tests.prototype.run = function(){
	return new Promise(function(resolve, reject){
		mocha.run(function(failures){
		  	resolve();
		});
	});
}

if (require.main === module) {
    test = new Tests();
	test.run();
} else {
    module.exports = new Tests();
}





