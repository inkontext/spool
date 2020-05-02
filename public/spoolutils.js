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

try {
    module.exports = {
        SpoolUtils
    }

} catch (e) {
    if (typeof module === 'undefined') {
        console.log("Modules are not present, you are probably on client, make sure this script is included before the files that require it");
    } else {
        console.error(e);
    }
}