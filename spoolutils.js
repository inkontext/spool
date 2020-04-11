const SpoolUtils = {
    forEachInObject: (object, callback) => {
        var keys = Object.keys(object);
        keys.forEach(key => {
            callback(object[key], key);
        })
    },
    shuffle: (array) => {
        array.sort(() => Math.random() - 0.5);
    }
}


module.exports = {
    SpoolUtils
}