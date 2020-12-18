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
            console.log(i);
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
