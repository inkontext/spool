function Canvas(id = null) {
    this.canvas = document.createElement("CANVAS");
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };
    this.ctx = this.canvas.getContext("2d");

    if (id === null) {
        document.body.appendChild(this.canvas);
    } else {
        document.getElementById(id).appendChild(this.canvas);
    }
}

Canvas.prototype.fullScreen = function () {
    this.resize(window.innerWidth, window.innerHeight);
    return this;
};

Canvas.prototype.resize = function (width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    return this;
};

Canvas.prototype.renderBackground = function () {
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "white";
    this.ctx.fill();
};

Canvas.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderBackground();
};

function MouseListener() {
    this.activeTypes = ["mousedown", "mouseup"];
    this.pressedButtons = Array(3).fill(false);
    this.m = SPTensors.vector([0, 0]);
    this.onUpdate = () => {};
}

MouseListener.prototype.initListener = function () {
    document.onmousedown = (e) => {
        this.pressedButtons[e.button] = true;
        this.onUpdate();
    };

    document.onmouseup = (e) => {
        this.pressedButtons[e.button] = false;
        this.onUpdate();
    };

    document.onmousemove = (e) => {
        this.m.x = e.clientX;
        this.m.y = e.clientY;
        this.onUpdate();
    };
};
