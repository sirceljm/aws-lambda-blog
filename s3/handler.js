const AWS = require('aws-sdk');
require('atob');

exports.static = (event, context, callback) => {
    const S3 = new AWS.S3({
        s3ForcePathStyle: true,
        endpoint: new AWS.Endpoint('http://localhost:8000/static'),
    });

    var contentType = 'image/png';
    var b64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';
    var byteCharacters = atob(b64Data);
    callback(null, byteCharacters);
    console.log("webhook");
    // S3.putObject({
    //     Bucket: 'local-bucket',
    //     Key: '1234',
    //     Body: new Buffer('<html>abcd</html>')
    // }, (err) => {
    //     console.log(err);
    // } );
};