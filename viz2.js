$(function () {

    var w = 600,
    h = 600,
    fill = d3.scale.category20();

    var vis = d3.select("body")
	.append("svg:svg")
	.attr("width", w)
	.attr("height", h);
    var scl = .02;

    d3.json("out20.json", function (json) {

	json.nodes = json.nodes.slice(0,4);
	var remaining = [];
	$.each(json.links, function (i,x) {
	    if (x.source < json.nodes.length && x.target < json.nodes.length) {
		remaining.push(x);
	    }
	});
	json.links = remaining;

	for (var i = 0; i < json.nodes.length; ++i) {
	    o = json.nodes[i];
	    o.x = o.x || Math.random() * w;
	    o.y = o.y || Math.random() * h;
	    o.fixed = 0;
	}

	var force = d3.layout.force()
	    .nodes(json.nodes)
	    .links(json.links)
	    .size([w, h]);

	$.each(json.nodes, function (i, n) { n.edges = {}; });
	$.each(json.links, function (i, link) {
	    json.nodes[link.source].edges[link.target] = true;
	    json.nodes[link.target].edges[link.source] = true;
	});

	var event = d3.dispatch("tick");

	var stepsize = 0.0003;
	var currentStep = stepsize;
	var centerPull = 20;
	var forcex = {}, forcey = {};
	var nodes = json.nodes;
	var repulsion = 20000; // repulsion constant, adjust for wider/narrower spacing
	var spring_length = 300; // base resting length of springs

	function tick() {
	    // adapted from
	    // https://github.com/jackrusher/jssvggraph/blob/master/graph.js
	    // and from d3 force.js

	    for (var i in nodes) {
		forcex[i] = 0;
		forcey[i] = 0;
		
		forcex[i] += centerPull * (w/2 - nodes[i].x);
		forcey[i] += centerPull * (h/2 - nodes[i].y);
		
		for (var j in nodes) {
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
			forcex[i] -= (repulsion / d2) * deltax;
			forcey[i] -= (repulsion / d2) * deltay;
			
			// spring force along edges, follows Hooke's law
			if( nodes[i].edges[j] ) {
			    var distance = Math.sqrt(d2);
			    forcex[i] += (distance - spring_length) * deltax;
			    forcey[i] += (distance - spring_length) * deltay;
			}
		    }
		}
	    }
	    var maxForce = 0;
	    for (i in nodes) {
		// update rectangles
		if (nodes[i].fixed) {
		    continue;
		}
		if (isNaN(forcex[i]) || isNaN(forcey[i])) {
			// color the node?
		    continue;
		}
		nodes[i].x += forcex[i] * currentStep;
		nodes[i].y += forcey[i] * currentStep;
		maxForce = Math.max(maxForce, forcex[i], forcey[i]);
	    }
	    $("#maxForce").text(Math.round(maxForce));
	    event.tick.dispatch({type: "tick"});
	    currentStep *= .999;
	    return maxForce < 10;
	}

	function resumeTick() {
	    currentStep = stepsize;
	    d3.timer(tick);
	}

	d3.timer(tick);


	function makeDrag() {
	    var node, element;
	    this
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
	    return force;
	}

	var link = vis.selectAll("line.link")
	    .data(json.links)
	    .enter().append("svg:line")
	    .attr("class", "link")
	    .attr("x1", function(d) { return d.source.x; })
	    .attr("y1", function(d) { return d.source.y; })
	    .attr("x2", function(d) { return d.target.x; })
	    .attr("y2", function(d) { return d.target.y; });
	var edgeLabel = vis.selectAll("text.value")
	    .data(json.links)
	    .enter().append("svg:text")
	    .attr("class", "value")
	    .text(function (d) { return d.value });

	var node = vis.selectAll("g.node")
	    .data(json.nodes)
	    .enter().append("svg:g")
	    .attr("class", "node")
	    .call(makeDrag);
	    
	node.append("svg:circle")
	    .attr("cx", 0)
	    .attr("cy", 0)
	    .attr("r", 5);

	node.append("svg:text")
	    .attr("dx", 6)
	    .attr("dy", 5)
	    .text(function (d) { return d.name; });

	vis.attr("opacity", 0)
	    .transition()
	    .duration(1000)
	    .attr("opacity", 1);

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
    });
});