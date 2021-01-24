function Heap(comparator) {
    this.arr = [];
    this.size = 0;
    this.comparator = comparator;
}

Heap.prototype.pop = function () {
    if (this.size == 0) {
        throw "Heap is already empty";
    }

    var value = this.arr[0];
    this.arr[0] = this.arr[this.size - 1];
    this.size--;
    this.heapDown();
    return value;
};

Heap.prototype.add = function (value) {
    if (this.size < this.arr.length) {
        this.arr[this.size] = value;
    } else {
        this.arr.push(value);
    }
    this.size++;
    this.heapUp();
};

Heap.prototype.getParent = function (index) {
    return Math.floor((index - 1) / 2);
};

Heap.prototype.getLChild = function (index) {
    return Math.floor(index * 2 + 1);
};

Heap.prototype.getRChild = function (index) {
    return Math.floor(index * 2 + 2);
};

Heap.prototype.hasParent = function (index) {
    return index != 0;
};

Heap.prototype.hasLChild = function (index) {
    return index * 2 + 1 < this.size;
};

Heap.prototype.hasRChild = function (index) {
    return index * 2 + 2 < this.size;
};

Heap.prototype.heapUp = function () {
    var index = this.size - 1;

    var parent = this.getParent(index);

    while (
        this.hasParent(index) &&
        this.comparator(this.arr[parent], this.arr[index]) > 0
    ) {
        this.swap(index, parent);

        index = this.getParent(index);
        parent = this.getParent(index);
    }
};

Heap.prototype.heapDown = function () {
    var index = 0;

    while (this.hasLChild(index)) {
        var smallerChild = this.getLChild(index);
        if (
            this.hasRChild(index) &&
            this.comparator(
                this.arr[smallerChild],
                this.arr[this.getRChild(index)]
            ) > 0
        ) {
            smallerChild = this.getRChild(index);
        }

        if (this.comparator(smallerChild, this.arr[index]) > 0) {
            break;
        }

        this.swap(smallerChild, index);
        index = smallerChild;
    }
};

Heap.prototype.swap = function (a, b) {
    let value = this.arr[a];
    this.arr[a] = this.arr[b];
    this.arr[b] = value;
};
