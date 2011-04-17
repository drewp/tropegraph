$(function () {

    function setInitialPositions(nodes, prevPositions, w, h) {
	for (var i = 0; i < nodes.length; ++i) {
	    o = nodes[i];

	    var prev = prevPositions[o.name];
	    if (prev) {
		o.x = prev.x;
		o.y = prev.y;
	    } else {
		o.x = o.x || Math.random() * w;
		o.y = o.y || Math.random() * h;
	    }
	    o.fixed = 0;
	}
    }

    function makeDrag(elem, resumeTick) {
	var node, element;
	elem
	    .on("mouseover", function(d) { d.fixed = true; })
	    .on("mouseout", function(d) { if (d != node) d.fixed = false; })
	    .on("mousedown", mousedown);

	d3.select(window)
	    .on("mousemove", mousemove)
	    .on("mouseup", mouseup);

	function mousedown(d) {
	    (node = d).fixed = true;
	    element = this;
	    d3.event.preventDefault();
	}

	function mousemove() {
	    if (!node) return;
	    var m = d3.svg.mouse($("svg")[0]);
	    node.x = m[0];
	    node.y = m[1];
	    resumeTick();
	}

	function mouseup() {
	    if (!node) return;
	    mousemove();
	    node.fixed = false;
	    node = element = null;
	}
    }

    function makeEdgeLists(json) {
	$.each(json.nodes, function (i, n) { n.edges = {}; });
	$.each(json.links, function (i, link) {
	    json.nodes[link.source].edges[link.target] = link;
	    json.nodes[link.target].edges[link.source] = link;
	});
    }

    function makeD3Objs(vis, json, resumeTick, event) {
	var link = vis.selectAll("line.link")
	    .data(json.links);

	link.exit().remove();

	link = link.enter().append("svg:line")
	    .attr("class", "link")
	    .attr("x1", function(d) { return d.source.x; })
	    .attr("y1", function(d) { return d.source.y; })
	    .attr("x2", function(d) { return d.target.x; })
	    .attr("y2", function(d) { return d.target.y; });
	
	var edgeLabel = vis.selectAll("text.value")
	    .data(json.links);
	edgeLabel.exit().remove();
	edgeLabel = edgeLabel.enter().append("svg:text")
	    .attr("class", "value")
	    .text(function (d) { return d.value });

	var node = vis.selectAll("g.node")
	    .data(json.nodes);
	node.exit().remove();
	node = node.enter().append("svg:g")
	    .attr("class", "node")
	    .style("display", function (n) { return _.size(n.edges) ? "normal" : "none" })
	    .call(function () { makeDrag(this, resumeTick); });
	
	node.append("svg:circle")
	    .attr("cx", 0)
	    .attr("cy", 0)
	    .attr("r", 5);

	node.append("svg:text")
	    .each(function (d) {
		var text = d3.select(this);
		$.each(d.name.split(" "), function (i, line) {
		    text.append("svg:tspan")
			.text(line)
			.attr("x",0).attr("y",i*10)
			.attr("dx",5).attr("dy", 0);
		});
	    });
	
	event["tick"].add(function() {
	    var nn = json.nodes;
	    link.attr("x1", function(d) { return nn[d.source].x; })
		.attr("y1", function(d) { return nn[d.source].y; })
		.attr("x2", function(d) { return nn[d.target].x; })
		.attr("y2", function(d) { return nn[d.target].y; });
	    edgeLabel.attr("x", function (d) { return nn[d.target].x * .5 + nn[d.source].x * .5; })
		.attr("y", function (d) { return nn[d.target].y * .5 + nn[d.source].y * .5; })

	    node.attr("transform", function(d) { return "translate("+d.x+","+d.y+")"; })
	    
	});
    }

    var allJson = {nodes: [], links: []};

    d3.json("out262.json", function (json) {
	$.extend(allJson, json);
	reload();
    });

    var w = 600,
    h = 600;

    var params = {
	minTropes: {value: 15, 	min: 0, max:50, range: "max", reload: true},
	maxEdge: {value: 300, min: 5, max: 1000, reload: true},
	numMovies: { value: 15, min: 2, max: 262, reload: true},
	centerPull: { value: 20, min: 0, max: 200, reload: false},
	repulsion: { value: 50000, min: 0, max: 100000, reload: false},
	stepSize: { value: .0003, min: .0001, max: .001, step: .00001, reload: false}
    };

    $.each(params, function (pname, opts) {
	var row = $("#"+pname);
	row.find(".slider").slider($.extend({
	    slide: function (ev, ui) { 
		params[pname].value = ui.value; 
		row.find(".val").text(ui.value); 
		if (opts.reload) {
		    reload();
		} else {
		    $(window).trigger("resumeTick");
		}
	    }}, params[pname]));
	row.find(".val").text(params[pname].value);
    });

    var vis = d3.select("#plot")
	.attr("width", w)
	.attr("height", h);
    var scl = .02;

    var prevPositions = {}; // name : {x,y}
    function reload() {
	$("#plot").empty();

	var json = {};

	json.nodes = allJson.nodes.slice(0, params.numMovies.value);
	json.links = [];
	$.each(allJson.links, function (i,x) {
	    if (x.source < json.nodes.length && x.target < json.nodes.length && 
		x.value > params.minTropes.value) {
		json.links.push(x);
	    }
	});

	setInitialPositions(json.nodes, prevPositions, w, h);
	makeEdgeLists(json);

	var event = d3.dispatch("tick");

	var currentStep = params.stepSize.value;
	var forcex = {}, forcey = {};
	var nodes = json.nodes;
	
	function edgeLengthForTropeCount(c) {
	    return params.maxEdge.value * (1 - .9 * Math.min(1, c / 60));
	}

	function tick() {
	    // adapted from
	    // https://github.com/jackrusher/jssvggraph/blob/master/graph.js
	    // and from d3 force.js

	    for (var i in nodes) {
		if (!_.size(nodes[i].edges)) {
		    continue;
		}
		forcex[i] = 0;
		forcey[i] = 0;
		
		forcex[i] += params.centerPull.value * (w/2 - nodes[i].x);
		forcey[i] += params.centerPull.value * (h/2 - nodes[i].y);
		
		for (var j in nodes) {
		    if (!_.size(nodes[j].edges)) {
			continue;
		    }
		    if( i !== j ) {
			// using rectangle's center, bounding box would be better
			var deltax = nodes[j].x - nodes[i].x;
			var deltay = nodes[j].y - nodes[i].y;
			var d2 = deltax * deltax + deltay * deltay;

			// add some jitter if distance^2 is very small
			while( d2 < 0.01 ) {
			    deltax = 0.1 * Math.random() + 0.1;
			    deltay = 0.1 * Math.random() + 0.1;
			    d2 = deltax * deltax + deltay * deltay;
			}
			
			// Coulomb's law -- repulsion varies inversely with square of distance
			forcex[i] -= (params.repulsion.value / d2) * deltax;
			forcey[i] -= (params.repulsion.value / d2) * deltay;
			
			// spring force along edges, follows Hooke's law
			var edge = nodes[i].edges[j]
			if (edge) {
			    var distance = Math.sqrt(d2);
			    var goal = edgeLengthForTropeCount(edge.value);
			    forcex[i] += (distance - goal) * deltax;
			    forcey[i] += (distance - goal) * deltay;
			}
		    }
		}
	    }

	    var maxMove = 0;
	    for (i in nodes) {
		if (nodes[i].fixed) {
		    continue;
		}
		if (isNaN(forcex[i]) || isNaN(forcey[i])) {
		    // color the node?
		    continue;
		}
		var dx = forcex[i] * currentStep;
		var dy = forcey[i] * currentStep;
		nodes[i].x += dx;
		nodes[i].y += dy;
		prevPositions[nodes[i].name] = {x: nodes[i].x, y: nodes[i].y};
		maxMove = Math.max(maxMove, dx, dy);
	    }
	    $("#maxForce").text(Math.round(maxMove*1000)/1000);
	    event.tick.dispatch({type: "tick"});
	    currentStep *= .999;
	    return maxMove < .05 && currentStep < params.stepSize.value * .5;
	}

	function resumeTick() {
	    currentStep = params.stepSize.value;
	    d3.timer(tick);
	}
	$(window).bind("resumeTick", resumeTick);
	resumeTick();
	makeD3Objs(vis, json, resumeTick, event);

    }
    reload();
});