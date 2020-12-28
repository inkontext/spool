function DevUI(id, stateContainer) {
    this.root = document.createElement("div");
    this.root.className = "spool-devui-root";
    this.root.style.position = "absolute";
    this.root.style.bottom = "0px";
    this.root.style.left = "0px";
    this.root.style.padding = "1em";
    this.root.style.width = "250px";
    this.stateContainer = stateContainer;

    this.stateListeners = {};

    document.getElementById(id).appendChild(this.root);
}

DevUI.prototype.refresh = function () {
    for (const key of Object.keys(this.stateListeners)) {
        this.stateListeners[key](this.stateContainer[key]);
    }
};

DevUI.prototype.addRange = function (
    name,
    min = 0,
    max = 5,
    step = 1,
    defaultValue
) {
    if (defaultValue === undefined) {
        defaultValue = this.stateContainer[name];
    } else {
        this.stateContainer[name] = defaultValue;
    }

    let range = document.createElement("div");
    range.className = "spool-devui-range";
    range.style.paddingBottom = "0.3em";
    range.style.paddingTop = "0.3em";

    let label = document.createElement("p");
    label.innerHTML = name + ": " + defaultValue;

    this.stateListeners[name] = (x) => {
        label.innerHTML = name + ": " + x;
        input.value = x;
    };

    label.style.margin = "0px";

    range.appendChild(label);

    let input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = defaultValue;
    input.className = "spool-devui-range-input";
    input.style.width = "100%";

    input.oninput = (e) => {
        label.innerHTML = name + ": " + e.target.value;
        this.stateContainer[name] = e.target.value;

        e.preventDefault();
    };

    range.appendChild(input);

    this.root.appendChild(range);
};

DevUI.prototype.addButton = function (name, callback) {
    let buttonWrapper = document.createElement("div");
    buttonWrapper.style.paddingTop = "0.3em";
    buttonWrapper.style.paddingBottom = "0.3em";

    var button = document.createElement("button");
    button.innerHTML = name;
    button.style.width = "100%";
    button.onclick = callback;
    button.style.borderRadius = "10px";

    buttonWrapper.appendChild(button);

    this.root.appendChild(buttonWrapper);
};
