const SpoolUtils = {
    forEachInObject: (object, callback) => {
        var keys = Object.keys(object);
        keys.forEach((key) => {
            callback(object[key], key);
        });
    },
    shuffle: (array) => {
        array.sort(() => Math.random() - 0.5);
    },
    subarray: (array, a, b) => {
        if (b <= a) {
            return [];
        } else {
            return array.filter((value, index) => index >= a && index < b);
        }
    },

    arraysEqual: (a, b) => {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length !== b.length) return false;

        // If you don't care about the order of the elements inside
        // the array, you should sort both arrays here.
        // Please note that calling sort on an array will modify that array.
        // you might want to clone your array first.

        for (var i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    },
};

try {
    module.exports = {
        SpoolUtils,
    };
} catch (e) {
    if (typeof module === "undefined") {
        console.log(
            "Modules are not present, you are probably on client, make sure this script is included before the files that require it"
        );
    } else {
        console.error(e);
    }
}
