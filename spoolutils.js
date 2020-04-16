const SpoolUtils = {
    forEachInObject: (object, callback) => {
        var keys = Object.keys(object);
        keys.forEach(key => {
            callback(object[key], key);
        })
    },
    shuffle: (array) => {
        array.sort(() => Math.random() - 0.5);
    },
    subarray: (array, a, b) => {
        if (b <= a) {
            return []
        } else {
            return array.filter((value, index) => index >= a && index < b);
        }
    }
}


module.exports = {
    SpoolUtils
}