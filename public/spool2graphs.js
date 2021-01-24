function Node(gid, container) {
    this.gid = gid;
    Object.assign(this, container);
}

function Graph() {
    this.nodes = [];
    this.connections = [];
}

Graph.prototype.get = function (gid) {
    return this.nodes[gid];
};

Graph.prototype.addNode = function (container) {
    let node = new Node(this.nodes.length, container);
    this.nodes.push(node);
    this.connections[node.gid] = [];
    return node.gid;
};

Graph.prototype.connect = function (a, b, weight = 1) {
    if (!(a in this.connections)) {
        this.connections[a] = [];
    }
    if (!(b in this.connections)) {
        this.connections[b] = [];
    }
    this.connections[a].push([b, weight]);
    this.connections[b].push([a, weight]);
};

Graph.prototype.getNeighbours = function (node) {
    return this.connections[node.gid].map((a) => [this.nodes[a[0]], a[1]]);
};

function reconstructPath(cameFrom, startGid, targetGid) {
    var node = targetGid;
    var res = [];
    while (node && node != startGid) {
        res.push(node);
        node = cameFrom[node];
    }
    res.push(startGid);
    res.reverse();
    return res;
}

/**
 * @callback heuristicDistance
 * @param {Node} node - node that is given the h value
 * @param {Node} target - target node
 */

/**
 *
 * @param {Graph} graph
 * @param {number} startGid - graph id of the start
 * @param {number} targetGid - graph id of the target
 * @param {heuristicDistance} h - function that gives Node aproximated distance
 *                                to target
 */
function aStar(graph, startGid, targetGid, h) {
    opened = new Heap((a, b) => f[a.gid] - f[b.gid]);
    openedSet = new Set();

    var start = graph.get(startGid);
    var target = graph.get(targetGid);

    f = { [startGid]: h(start, target) };
    g = { [startGid]: 0 };
    cameFrom = {};

    opened.add(start);
    openedSet.add(startGid);

    while (opened.size > 0) {
        var current = opened.pop();

        openedSet.delete(current.gid);

        if (current.gid == targetGid) {
            return reconstructPath(cameFrom, startGid, targetGid);
        }

        for (var i = 0; i < graph.connections[current.gid].length; i++) {
            var neighbourPair = graph.connections[current.gid][i];

            let neighbour = graph.nodes[neighbourPair[0]];
            let weight = neighbourPair[1];

            let newG = g[current.gid] + weight;
            if (!(neighbour.gid in g) || newG < g[neighbour.gid]) {
                cameFrom[neighbour.gid] = current.gid;
                g[neighbour.gid] = newG;
                f[neighbour.gid] = newG + h(neighbour, target);

                if (!(neighbour.gid in openedSet)) {
                    opened.add(neighbour);
                    openedSet.add(neighbour.gid);
                }
            }
        }
    }

    return null;
}
