var fs = require('fs')
var getPixels = require('get-pixels');

const FileReader = {
    readFile: (fileName, callback) => {
        fs.exists(fileName, function (exists) {
            if (exists) {
                fs.readFile(fileName, 'utf8', function (err, data) {
                    if (err) throw err;
                    callback(data);
                });
            } else {
                return 'file does not exist'
            }
        });
    },
    readImage: (fileName, callback) => {
        fs.exists(fileName, function (exists) {
            if (exists) {
                getPixels(fileName, function (err, data) {
                    if (err) throw err;
                    callback(data);
                })
            } else {
                return 'file does not exist'
            }
        });
    }
}

module.exports = {
    FileReader
}