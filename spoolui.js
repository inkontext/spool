console.log('loaded');

var SpoolUIHandler = (initObject) => {
    var self = {
        elements: {},
        keys: [],
        ...initObject
    }

    self.render = (ctx) => {
        self.keys.forEach(key => {
            self.elements[key].render(ctx);
        })
    }

    self.mouseEvent = (event) => {
        var res = false;
        self.keys.forEach(key => {
            res |= self.elements[key].mouseEvent(event);
        })
        return res;
    }

    self.add = element => {
        self.elements[element.id] = element;
        self.keys = Object.keys(self.elements);
    }

    self.remove = id => {
        delete self.elements[id]
        self.keys = Object.keys(self.elements);
    }

    return self;
}

var SpoolUIElement = (initObject) => {
    var self = {
        elements: {},
        keys: [],

        x: 0,
        y: 0,
        width: 0,
        height: 0,

        bgColor: null,
        fgColor: null,

        id: Math.random(),

        bindedMouseEvent: null,
        ...initObject
    }

    self.render = (ctx) => {
        self.renderBounds(ctx);
        self.renderSprite(ctx);
        self.renderText(ctx);

        self.keys.forEach(key => {
            self.elements[key].render(ctx);
        })
    }

    self.renderBounds = (ctx) => {
        ctx.beginPath();
        ctx.lineWidth = "1";
        ctx.rect(self.x, self.y, self.width, self.height);

        if (self.bgColor) {
            ctx.fillStyle = self.bgColor;
            ctx.fill();
        }
    }

    self.renderText = (ctx) => {
        if (self.text) {
            if (self.fgColor) {
                ctx.fillStyle = fgColor;
            } else {
                ctx.fillStyle = 'white';
            }
            if (self.font) {
                ctx.font = self.font;
            }
            ctx.textAlign = 'center';
            ctx.fillText(self.text, self.x + self.width / 2, self.y + self.height / 2)
        }
    }

    self.renderSprite = (ctx) => {
        if (self.sprite) {
            ctx.drawImage(self.sprite, self.x, self.y, self.width, self.height);
        }
    }

    self.mouseEvent = (event) => {
        var res = false;
        self.keys.forEach(key => {
            res |= self.elements[key].mouseEvent(event);
        })
        if (res) {
            return res;
        }
        if (self.bindedMouseEvent) {
            if (self.x <= event.x && event.x <= self.x + self.width) {
                if (self.y <= event.y && event.y <= self.y + self.width) {
                    var res = self.bindedMouseEvent(event);
                    if (res !== false) {
                        return true;
                    }
                }
            }
            return false;
        } else {
            return false;
        }
    }

    self.add = element => {
        self.elements[element.id] = element;
        self.keys = Object.keys(self.elements);
    }

    self.remove = id => {
        delete self.elements[id]
        self.keys = Object.keys(self.elements);
    }

    return self;
}

var SpoolUIButton = (initObject) => {
    var self = SpoolUIElement({
        ...initObject
    });

    return self;
}

var SpoolUIButtonList = (initObject, buttonsInitArray) => {
    var self = SpoolUIElement({
        rows: 1,
        columns: 1,
        margin: 10,
        buttonWidth: 50,
        buttonHeight: 50,
        offsetX: 0.5,
        offsetY: 0.5,
        ...initObject
    });



    var leftCornerX = self.x - (self.margin + self.buttonWidth) * (self.columns) * (self.offsetX);
    var leftCornerY = self.y - (self.margin + self.buttonHeight) * (self.rows) * (self.offsetY);
    var counter = 0;


    buttonsInitArray.forEach(bo => {
        var button = SpoolUIButton({
            x: leftCornerX + (counter % self.columns) * (self.buttonWidth + self.margin),
            y: leftCornerY + (Math.floor(counter / self.columns)) * (self.buttonWidth + self.margin),
            width: self.buttonWidth,
            height: self.buttonHeight,
            ...bo
        })

        counter += 1;

        self.add(button);
    });

    return self;
}