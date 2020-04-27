console.log('loaded');

var SpoolUIElement = (initObject) => {
    var self = {
        elements: {},
        layerKeys: [],

        x: 0,
        y: 0,
        width: 0,
        height: 0,

        layer: 10,

        visible: true,

        bgColor: null,
        fgColor: null,
        strokeColor: null,

        textMargin: 10,

        id: Math.random(),

        lineHeight: 10,

        bindedMouseEvent: null,

        mouseUp: false,
        mouseDown: true,

        ...initObject
    }

    //// CREATING INIT LEFT,TOP,RIGHT,BOTTOM COORDINATES ////

    self.left = self.x;
    self.top = self.y;
    self.right = self.x + self.width;
    self.bottom = self.y + self.height;

    //// UPDATE AND RENDER ////

    self.update = () => {};

    self.render = (ctx) => {
        self.renderBounds(ctx);
        self.renderSprite(ctx);
        self.renderText(ctx);

        self.layerKeys.forEach(layer => {
            layer.ids.forEach(id => {
                self.elements[layer.key][id].update();
                if (self.elements[layer.key][id].visible) {
                    self.elements[layer.key][id].render(ctx);
                }
            });
        })
    }

    //// RENDERING METHODS ////

    self.renderBounds = (ctx) => {
        if (!self.radius) {
            ctx.beginPath();
            ctx.lineWidth = "1";
            ctx.rect(self.x, self.y, self.width, self.height);

            if (self.bgColor) {

                if (self.bgOpacity != 1) {
                    ctx.globalAlpha = self.bgOpacity;
                    ctx.fillStyle = self.bgColor;
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                } else {
                    ctx.fillStyle = self.bgColor;
                    ctx.fill();
                }
            }
        } else {
            if (self.bgColor) {
                ctx.fillStyle = self.bgColor;

            }
            if (self.strokeColor) {
                ctx.strokeStyle = self.strokeColor;

            }
            drawRoundRect(ctx, self.x, self.y, self.width, self.height, self.radius, self.bgColor, self.strokeColor)
        }
    }

    self.renderText = (ctx) => {
        if (self.text) {
            if (self.disabled) {
                ctx.fillStyle = 'gray';
            } else {
                if (self.fgColor) {
                    ctx.fillStyle = fgColor;
                } else {
                    ctx.fillStyle = 'white';
                }
            }
            if (self.font) {
                ctx.font = self.font;
            }
            ctx.textAlign = 'center';

            if (self.multiLine) {
                if ((self.linesSplit && self.textLines) ? self.linesSplit != self.text : true) {
                    var words = self.text.split(' ');
                    var line = '';
                    var lines = [];

                    words.forEach((word, index) => {
                        var tempWidth = ctx.measureText(line + word).width;
                        if (tempWidth >= self.width - self.textMargin * 2) {
                            lines.push(line);
                            line = word;
                        } else {
                            line += ' ' + word;
                        }
                    })

                    if (line) {
                        lines.push(line);
                    }

                    self.lineHeight = parseInt(ctx.font) + 3;
                    self.textLines = lines;

                }

                self.textLines.forEach((line, index) => {
                    ctx.fillText(
                        line,
                        self.x + (self.width) / 2,
                        self.y + self.height / 2 - self.textLines.length / 2 * self.lineHeight + index * self.lineHeight)
                })

                self.linesSplit = self.text;
            } else {
                ctx.fillText(self.text, self.x + self.width / 2, self.y + self.height / 2);
            }

        }

    }

    self.renderSprite = (ctx, sprite = self.sprite, scale = 1) => {
        if (sprite) {
            ctx.drawImage(
                sprite,
                self.x + self.width / 2 - self.width / 2 * scale,
                self.y + self.height / 2 - self.height / 2 * scale,
                self.width * scale,
                self.height * scale);
        }
    }

    //// MOUSE EVENTS ////

    self.mouseEvent = (event, onmouseup = self.mouseUp, onmousedown = self.mouseDown) => {
        var res = false;

        if (self.disabled) {
            return false;
        }

        self.layerKeys.forEach(layer => {
            layer.ids.forEach(id => {
                if (self.elements[layer.key][id].visible) {
                    res |= self.elements[layer.key][id].mouseEvent(event);
                }
            });
        })
        if (res) {
            return res;
        }
        recognizedEvent = (event.type == 'mouseup' && onmouseup) || (event.type == 'mousedown' && onmousedown);
        if (self.bindedMouseEvent && recognizedEvent) {
            if (self.x <= event.x && event.x <= self.x + self.width) {
                if (self.y <= event.y && event.y <= self.y + self.width) {
                    var res = self.bindedMouseEvent(event, self);
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

    self.mouseMove = (event) => {
        self.mx = event.clientX;
        self.my = event.clientY;

        var res = false;

        var childrenRes = false;

        self.layerKeys.forEach(layer => {
            layer.ids.forEach(id => {
                if (self.elements[layer.key][id].visible) {
                    childrenRes |= self.elements[layer.key][id].mouseMove(event);
                }
            });
        })

        var mouseOnChange = self.mouseOn
        var mouseInChange = self.mouseIn

        if (childrenRes) {
            mouseOnChange = false;
            mouseInChange = true;
            res = false;
        } else {
            if (self.x <= event.x && event.x <= self.x + self.width) {
                if (self.y <= event.y && event.y <= self.y + self.width) {
                    res = true;
                }
            }
            mouseOnChange = res;
            mouseInChange = res;
        }

        if (mouseOnChange != self.mouseOn) {
            if (mouseOnChange && self.onMouseEnter) {
                self.onMouseEnter(event, self)
            } else if (!mouseOnChange && self.onMouseLeave) {
                self.onMouseLeave(event, self)
            }
            self.mouseOn = mouseOnChange
        }
        self.mouseOn = mouseInChange


        return res;
    }

    //// HANDLING ELEMENTS ////

    self.add = element => {

        if (!self.elements[element.layer]) {
            self.elements[element.layer] = {}
        }

        self.elements[element.layer][element.id] = element;
        self.refreshKeys();

    }

    self.remove = id => {
        delete self.elements[id]
        self.refreshKeys();
    }

    self.forEachElement = func => {
        self.layerKeys.forEach(layer => {
            layer.ids.forEach(id => {
                func(self.elements[layer.key][id]);
            });
        })
    }

    self.removeAll = () => {
        self.elements = {};
        self.layerKeys = []
    }

    self.refreshKeys = () => {
        var layers = Object.keys(self.elements).sort((a, b) => {
            return parseInt(a) - parseInt(b);
        })
        self.layerKeys = [];
        layers.forEach(layer => {
            self.layerKeys.push({
                key: layer,
                ids: Object.keys(self.elements[layer])
            })
        })
    }

    //// ALIGMENT //// 

    self.alignItems = (alignType, cx, cy) => {

        var minX = null;
        var maxX = null;
        var minY = null;
        var maxY = null;

        self.layerKeys.forEach(layer => {
            layer.ids.forEach(id => {
                var temp = self.elements[layer.key][id];

                if (minX ? temp.x < minX : true) {
                    minX = temp.x;
                }
                if (minY ? temp.y < minY : true) {
                    minY = temp.y;
                }
                if (maxX ? temp.x + temp.width > maxX : true) {
                    maxX = temp.x + temp.width;
                }
                if (maxY ? temp.y + temp.height > maxY : true) {
                    maxY = temp.y + temp.height;
                }
            });
        })

        var dx = cx - (minX + maxX) / 2;
        var dy = cy - (minY + maxY) / 2;

        console.log(dx, dy);

        self.layerKeys.forEach(layer => {
            layer.ids.forEach(id => {
                self.elements[layer.key][id].x += dx;
                self.elements[layer.key][id].y += dy;
            });
        })
    }

    self.getElementBounds = () => {

        var minX = null;
        var maxX = null;
        var minY = null;
        var maxY = null;

        self.layerKeys.forEach(layer => {
            layer.ids.forEach(id => {
                var temp = self.elements[layer.key][id];

                if (minX ? temp.x < minX : true) {
                    minX = temp.x;
                }
                if (minY ? temp.y < minY : true) {
                    minY = temp.y;
                }
                if (maxX ? temp.x + temp.width > maxX : true) {
                    maxX = temp.x + temp.width;
                }
                if (maxY ? temp.y + temp.height > maxY : true) {
                    maxY = temp.y + temp.height;
                }
            });
        })

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            left: minX,
            right: maxX,
            top: minY,
            bottom: maxY
        }
    }

    self.pack = () => {
        var bounds = self.getElementBounds()

        self.x = bounds.x;
        self.y = bounds.y;
        self.width = bounds.width;
        self.height = bounds.height;
    }


    return self;
}

var SpoolUIHandler = (initObject) => {
    var self = SpoolUIElement({
        initObject
    })
    return self;
}

var SpoolUIButton = (initObject) => {
    var self = SpoolUIElement({
        ...initObject
    });

    return self;
}

var SpoolUIButtonList = (initObject, buttonsInitArray, buttonConst = SpoolUIButton) => {
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


    self.width = (self.margin + self.buttonWidth) * (self.columns);
    self.height = (self.margin + self.buttonHeight) * (self.rows);

    var leftCornerX = self.x - self.width * (self.offsetX);
    var leftCornerY = self.y - self.height * (self.offsetY);
    var counter = 0;

    self.left = leftCornerX;
    self.up = leftCornerY;
    self.right = leftCornerX + self.width;
    self.bottom = leftCornerY + self.height;

    self.buttons = [];

    buttonsInitArray.forEach(bo => {
        var button = buttonConst({
            x: leftCornerX + (counter % self.columns) * (self.buttonWidth + self.margin),
            y: leftCornerY + (Math.floor(counter / self.columns)) * (self.buttonWidth + self.margin),
            width: self.buttonWidth,
            height: self.buttonHeight,
            ...bo
        })
        counter += 1;
        self.buttons.push(button);
        self.add(button);
    });

    return self;
}