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
                    callback({
                        data: data.data,
                        width: data.shape[0],
                        height: data.shape[1],
                        pixelSize: data.shape[2],
                    });
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