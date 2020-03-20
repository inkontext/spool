const SpoolUtils = {
    forEachInObject: (object, callback) => {
        var keys = Object.keys(object);
        keys.forEach(key => {
            callback(object[key], key);
        })
    }
}


module.exports = {
    SpoolUtils
}