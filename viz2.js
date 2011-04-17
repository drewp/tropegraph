$(function () {

    function setInitialPositions(nodes, shuffle, w, h) {
	for (var i = 0; i < nodes.length; ++i) {
	    o = nodes[i];

	    if (shuffle) {
		o.x = o.y = null;
	    }
	    o.x = o.x || Math.random() * w;
	    o.y = o.y || Math.random() * h;

	    o.fixed = 0;
	}
    }

    function makeEdgeLists(selectedData) {
	$.each(selectedData.nodes, function (i, n) { n.edges = {}; });
	$.each(selectedData.links, function (i, link) {
	    selectedData.nodes[link.source].edges[link.target] = link;
	    selectedData.nodes[link.target].edges[link.source] = link;
	});
    }

    function selectData(allJson, params) {
	var sel = {};

	sel.nodes = allJson.nodes.slice(0, params.numMovies.value);
	sel.links = [];
	$.each(allJson.links, function (i,x) {
	    if (x.source < sel.nodes.length && x.target < sel.nodes.length) {
		if ((params.edgeMode == 'frac' && 
		     x.fracShare * 100 >= params.fracTropes.value) ||
		    (params.edgeMode == 'abs' &&
		     x.absShare > params.absTropes.value)) {
		    sel.links.push(x);
		}
	    }
	});

	makeEdgeLists(sel);
	return sel;
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

    function makeD3Objs(vis, selectedData, resumeTick, event, edgeMode) {
	var link = vis.selectAll("line.link")
	    .data(selectedData.links);

	link.exit().remove();

	link = link.enter().append("svg:line")
	    .attr("class", "link")
	    .attr("x1", function(d) { return d.source.x; })
	    .attr("y1", function(d) { return d.source.y; })
	    .attr("x2", function(d) { return d.target.x; })
	    .attr("y2", function(d) { return d.target.y; });
	
	var edgeLabel = vis.selectAll("text.value")
	    .data(selectedData.links);
	edgeLabel.exit().remove();
	edgeLabel = edgeLabel.enter().append("svg:text")
	    .attr("class", "value")
	    .text(function (d) { 
		return (edgeMode == 'abs') ? 
		    d.absShare : 
		    ((d.fracShare * 100).toFixed(1) + "%");
	    });

	var node = vis.selectAll("g.node")
	    .data(selectedData.nodes);
	node.exit().remove();
	node = node.enter().append("svg:g")
	    .attr("class", "node")
	    .style("display", 
		   function (n) { return _.size(n.edges) ? "normal" : "none" })
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
	$("#svgChildren").text($("svg").children().length);

	event["tick"].add(function() {
	    var nn = selectedData.nodes;
	    link.attr("x1", function(d) { return nn[d.source].x; })
		.attr("y1", function(d) { return nn[d.source].y; })
		.attr("x2", function(d) { return nn[d.target].x; })
		.attr("y2", function(d) { return nn[d.target].y; });

	    edgeLabel
		.attr("x", function (d) { 
		    return nn[d.target].x * .5 + nn[d.source].x * .5; })
		.attr("y", function (d) { 
		    return nn[d.target].y * .5 + nn[d.source].y * .5; })

	    node.attr("transform", function(d) { 
		return "translate("+d.x+","+d.y+")"; })
	});
    }

    function edgeLengthForTropeCount(link) {

	var x = params.edgeMode == 'frac' ? link.fracShare : link.absShare;
	if (params.edgeMode == 'frac') {
	    x *= 100;
	}
	var minVal = params[params.edgeMode == 'frac' ? 
			    "fracTropes" : "absTropes"].value;

	var f = (x - minVal) / (minVal * 2 - minVal);

	var m = params.maxEdge.values;
	return m[0] + (m[1] - m[0]) * (1 - f);
    }

    function tick() {
	// adapted from
	// https://github.com/jackrusher/jssvggraph/blob/master/graph.js
	// and from d3 force.js
	var nodes = selectedData.nodes;

	    // todo: if this is running slow, it should start working
	    // on only chunks of the nodes at a time, so the ui event
	    // loop gets more of a chance. Or use web workers.
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
			var goal = edgeLengthForTropeCount(edge);
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

    function reload(shuffle) {
	$("#plot").empty();

	selectedData = selectData(allJson, params);
	setInitialPositions(selectedData.nodes, shuffle, w, h);

	makeD3Objs(vis, selectedData, resumeTick, event, params.edgeMode);
	if (shuffle) {
	    for (var settle=0; settle < 15; settle++) {
		tick();
	    }
	}
	resumeTick();
    }

    function makeParamWidgets(params) {
	$.each(params, function (pname, opts) {
	    var row = $("#"+pname);
	    var p = params[pname];
	    function onSlide(ev, ui, suppressReload) { 
		if (p.range) {
		    p.values = ui.values;
		    row.find(".val").text(ui.values[0]+" to "+ui.values[1]); 

		} else {
		    p.value = ui.value; 
		    row.find(".val").text(ui.value); 
		}
		if (!suppressReload) {
		    if (opts.reload) {
			reload();
		    } else {
			$(window).trigger("resumeTick");
		    }
		}
	    }
	    
	    row.find(".slider").slider($.extend({slide: onSlide}, p));
	    onSlide(null, p, true);   
	});

	$("input[name=edgeMode]").change(function (m) {
	    params['edgeMode'] = $("input[name=edgeMode]:checked").val();
	    reload();
	});
	params['edgeMode'] = 'frac';
	$("input[value=frac]").attr("checked", true);
    }


    var allJson = {nodes: [], links: []};
    var selectedData = {nodes: [], links: []};

    d3.json("out.json", function (json) {
	$.extend(allJson, json);
	reload();
    });

    var w = 600, h = 600;

    var params = {
	fracTropes: {value: 3, min: 0, max:100, step: .1, reload: true},
	absTropes:  {value: 5, min: 0, max:300, step: 1, reload: true},
	maxEdge: {values: [50, 300], min: 5, max: 1000, 
		  range: true, reload: true},
	numMovies: { value: 15, min: 2, max: 262, reload: true},
	centerPull: { value: 20, min: 0, max: 200, reload: false},
	repulsion: { value: 50000, min: 0, max: 1000000, reload: false},
	stepSize: { value: .0003, min: .0001, max: .001, step: .00001, 
		    reload: false}
    };

    makeParamWidgets(params);
    var vis = d3.select("#plot").attr("width", w).attr("height", h);
    
    var event = d3.dispatch("tick");
    var forcex = {}, forcey = {};

    var currentStep = params.stepSize.value;
    $(window).bind("resumeTick", resumeTick);
    
    $("#stats")
	.append($("<button>").text("Stop")
		.button({icons: {primary: "ui-icon-pause"}})
		.click(function () {
		    currentStep = 0;
		}))
	.append($("<button>").text("Randomize placement")
		.button({icons: {primary: "ui-icon-refresh"}})
		.click(function () {
		    reload(true);
		}));

    $("#intro .more").click(function () { $(this).find("+ div").toggle() });
    reload();
});