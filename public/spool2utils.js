function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function arraysEqual(a, b) {
    if (a === b) return true;

    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function ABList(allow, block) {
    this.allow = allow ? new Set(allow) : null;
    this.block = block ? new Set(block) : null;
}

ABList.prototype.allowed = function (value) {
    return (
        (!this.block || !this.block.has(value)) &&
        (!this.allow || this.allow.has(value))
    );
};

//#region STRINGS

function getHex(value) {
    assert(0 <= value && value <= 255, "Color out of bounds");
    var hexchars = "0123456789abcdef";
    var res =
        hexchars[Math.floor(value / 16)] + hexchars[Math.floor(value % 16)];
    return res;
}

function getColor(r, g, b) {
    return `#${getHex(r * 255)}${getHex(g * 255)}${getHex(b * 255)}`;
}

//#endregion
