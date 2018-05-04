$(function () {
	var overview = window.overview = {}
	/* svg settings */
	var overview = window.overview = {}
	var width = 450
	var height = 450

	var baseTaxonomyData
	api.v1.taxonomy().then(serp => {
		baseTaxonomyData = serp
	})

	/* remove -10 to make svg fill the square from edge-to-edge */
	var radius = (Math.min(width, height) / 2) - 10

	/* colorScheme is defined in util/color.js */
	var color = window.util.colorScheme()

	//used to set text size depending on 'zoom' level
	var tier =0;

	/* x-axis should map to a full circle, otherwise strange chart */
	var x = d3.scale.linear().range([0, 2 * Math.PI])

	/* use pow scale to make root node radius smaller */
	var y = d3.scale.pow().exponent(1.2).range([0, radius]);

	/* compute relative to total number of entries, found in root */
	function relativeUse(d) {
		/* root node has no parent, but its usage is known (100%) */
		if (!d.parent)
			return 1.0
		var root = d.parent
		while (root.parent)
			root = root.parent
		return d.usage / Math.max(root.usage, 1)
	}

	function getStartAngle(d) {
		return Math.max(0, Math.min(2 * Math.PI, x(d.x)))
	}
	function getEndAngle(d) {
		return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx)))
	}

	/* sample x coord of arc for label positioning */
	function arcX(d) {
		var angle = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx * 0.5)))
		var radius = Math.max(0, y(d.y + d.dy * 0.5))
		return Math.cos(angle - 0.5 * Math.PI) * radius
	}

	/* sample y coord of arc for label positioning */
	function arcY(d) {
		if (d.name === 'root')
			return 0

		var angle = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx * 0.5)))
		var radius = Math.max(0, y(d.y + d.dy * 0.5))
		return Math.sin(angle - 0.5 * Math.PI) * radius
	}

	function computeTextRotation(d) {
		return 0
		if (d.name === "root") return 0;
		return (x(d.x + d.dx / 2) - Math.PI / 2) / Math.PI * 180;
	}
	/* Idea is to map the flat tree into an arc tree using the computed
	 * extents (d.dx, d.dy). A partition layout normally looks something
	 * like this: http://codepen.io/anon/pen/Bfpmg
	 * The y-axis is used to determine inner and outer radii, while
	 * the x-axis determines start and end angles for the arc.
	 */
	var arc = d3.svg.arc()
		.startAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x))))
		.endAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))))
		.innerRadius(d => Math.max(0, y(d.y)))
		.outerRadius(d => Math.max(0, y(d.y + d.dy)))

	overview.renderGraph = function(nodeId, dataset, taxonomy) {
		var usage = window.util.computeUsage(dataset, taxonomy)
		var color = window.util.colorScheme(taxonomy)
		var serp = taxonomy.tree()

		/* Ensure that all facets and sub facets have an object that contains the
		 * 'usage' key, which is parsed during treeify and added to the new node.
		 */
		serp.map(function init(node) {
			node.usage = usage[node.id().toLowerCase()]
			node.map(init)
		})

		var partition = d3.layout.partition()
			.value(d => d.size)
			.nodes(window.util.treeify(serp, dataset.nodes().length))

		var svg = d3.select(nodeId)
			.append("svg")
				.attr("width", width)
				.attr("height", height)
				.attr('overflow','visible')
			.append("g")
				.attr("transform", `translate(${width/2}, ${height/2})`)

       function getParent(label){
			if(label == 'root'){
				return 'root'
			}
			else{
				var parent = serp.dfs(label).parentId().toLowerCase()
				if(parent =='root') parent='root'
				return parent
			}
		}

        //temporarily disables Mouse Events for a given time length
        function toggleMouseEvents(d,on){
	     	if(on){
	     		mouseOut(d)
		     	svg.selectAll("path")
						.on("mousemove", null)
						.on("mouseout", null)
						.on("click",null)
			}else{
				svg.selectAll("path")
				.on("mousemove", mouseMove)
				.on("mouseout", mouseOut)
				.on("click",click)
			}
        }

        function hoverFacet(d){
        	var hand = document.getElementById('hand')
        	hand.style.background = color(d.name)(relativeUse(d))
			var facetTitle = document.getElementById('hover-facet-title')
	    	facetTitle.innerText = d.full || d.name
	    	facetTitle.style.fontStyle= "normal"
			facetTitle.style.color = "black"
        }

	    function mouseMove(d) {
			hoverFacet(d)
			if (d.depth === 0) return
			svg.select('#text'+d.name)
		 		.attr('font-size', d=>labelScale(d)+ (relativeDepth(d)*2))
		}

		function mouseOut(d){
			if (d.depth === 0) return
		 	svg.select('#text'+d.name)
				.attr('font-size', d => labelScale(d))
				.style("text-shadow", "none")
		}

		function labelScale(d){
		 	var scale = Math.max(relativeDepth(d)+.5, 1)
			return 20/scale
		}

		function pathId(path){
			return 'path'+path
		}
		function textId(text){
			return 'text'+text
		}

		function facetInfo(d){
			var info = window.info.getInfo(d.name)
			var explanation = document.getElementById('facet-explanation')
			var description= serp.dfs(d.name).desc!=null? serp.dfs(d.name).desc : info.description
			explanation.innerText=description
			if(d.depth != 0){
				explanation.style.fontStyle= "normal"
				explanation.style.color = "black"
			}
			else{
				explanation.style.fontStyle= "italic"
				explanation.style.color = ''
			}

			var facetTitle = document.getElementById('facet-title')
			var title = d.full || d.name
			if (d.depth > 0) {
				title = title +' ('+ getParent(d.name) + ')'
			}
			facetTitle.innerText = title

			var square = document.getElementById('square')
			square.style.background = color(d.name)(relativeUse(d))
		}

		function relativeDepth(d){
			return d.depth - tier
		}

      	function arcTween(d) {
		  	var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
		     	yd = d3.interpolate(y.domain(), [d.y, 1]),
		      	yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
			return function(d, i) {
		    	return i
		        ? function(t) { return arc(d); }
		        : function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
		  };
		}

		function pathWindUp(d,delay){
			svg.selectAll('text').transition()
				.attr("opacity", 0)
				.attr('font-size', d => labelScale(d))
		  	svg.selectAll("path").transition()
		  		.duration(600 + delay)
		  		.attrTween("d",arcTween(d))
			    .each("end", function(e, i) {
		        	// check if the animated element's data e lies within the visible angle span given in d
		          	if (e.name!=='root' && e.x >= d.x && e.x < (d.x + d.dx)) {
			        // get a selection of the associated text element
		            var arcText = d3.select("#text"+e.name);
		            // fade in the text element and recalculate positions
		            arcText.transition().duration(400 + delay)
		              .attr("opacity", 1)
		              .attr("transform", function() {return "rotate(" + computeTextRotation(e) + ")"  })
		              .attr("x", arcX)
		              .attr("y", arcY)
	        		}
	        		else{
			        	svg.select("#textroot")
			        		.attr("transform", "rotate(0)")
			        		.attr('dx',"0")
			        		.attr("opacity", 1)
							.attr('text-anchor', 'middle')
							.attr('x', arcX)
							.attr('y', arcY)
			        }
		    	})
		}
		//use to isolate direction of taxonomy exporer
		function getActiveList(d, list){
			var children = d.children
			if (children && children.length > 0) {
				for (var i = 0; i < children.length; i++) {
					getActiveList(children[i], list)
					list.push(children[i])
				}
			}
		}

		function getHiddenItems(reverseList, type){
			var list = svg.selectAll(type).filter(function(item){
  				return reverseList.indexOf(item) === -1;
			})
			return list
		}
		function getActiveItems (reverseList,type){
			var list = svg.selectAll(type).filter(function(item){
  				return reverseList.indexOf(item) != -1;
			})
			return list
		}

		function click(d){
			if(d.name=='serp')
				return
			var rel = relativeDepth(d)
			if(rel !== 0){
				var delay = rel > 0 ? (rel*50) : 100
				facetInfo(d, delay)
				toggleMouseEvents(d, true)
				new Promise(function (F, R) {
					zoom(d, delay)
					setTimeout(F, Math.max(1100, 700 + delay))
				}).then( function () {
					toggleMouseEvents(d, false)
				})
			}
		}

		function zoom(d, delay) {
			var activeList =[]
			tier = d.depth
			getActiveList(d, activeList)
			activeList.push(d)
			var hiddenText = getHiddenItems(activeList,'text')
			var activeText = getActiveItems(activeList,'text')
			//add BackButton
			svg.selectAll("path").filter( function(path){
				if(path.name==getParent(d.name)) {
				 	activeList.push(path)
				}
			})
			var hiddenFacets = getHiddenItems(activeList,'path')
			var activeFacets = getActiveItems(activeList,'path')
			activeText[0].forEach(active => {
				setTimeout(function(){
					active.classList.remove("hide")
				}, 300)
			})
			hiddenText[0].forEach(hidden => {
				hidden.classList.add("hide");
			})
			pathWindUp(d, delay)
			activeFacets[0].forEach(active => {
				active.classList.remove("disappear")
				active.classList.remove('hide')
			})
			hiddenFacets[0].forEach(hidden => {
			hidden.classList.add("disappear")
				setTimeout(function(){
					hidden.classList.add('hide')
				}, 1100)
			})
		}

		function isBaseTax(d){
			var current = serp.dfs(d.name)
			var isBase = baseTaxonomyData.taxonomy.some( some => {
	    		return some.id.toLowerCase()==current.id().toLowerCase()
	    	})
		    if(isBase || d.name=='root')
		    	return color(d.name)(relativeUse(d))
		    else
		    	return '#E3E3E3'
		}

		/* setup the main graph */
		svg.selectAll("path")
			.data(partition).enter()
			.append("path")
				.attr("d", arc)
				.attr("id", d=> 'path'+d.name)
				.style("fill", d => isBaseTax(d))
				.style("stroke", '#f2f2f2')
				.on("mousemove", mouseMove)
				.on("mouseout", mouseOut)
				.on("click", click)

		/* add labels positioned at area center */
		svg.selectAll("text")
			.data(partition).enter()
			.append('text')
			.attr("id", d => 'text'+d.name)
			.attr('font-family', 'Arial, sans-serif')
			.attr("transform", d => `rotate(${computeTextRotation(d)})`)
			.attr('text-anchor', 'middle')
		    .attr("x", arcX)
		    .attr("y", arcY)
		    .text(function(d) { return d.name; })
			.attr('pointer-events', 'none')
			.attr('font-size', d => labelScale(d))
	}
 	
})
 // only works on live
// Dataset.loadDefault(data => {
// 		Promise.all([
// 			api.v1.taxonomy(),
// 			api.v1.collection.taxonomy(682)
// 		]).then(taxonomies => {
// 			var taxonomy = new window.Taxonomy(taxonomies[0].taxonomy)
// 			taxonomy.extend(taxonomies[1].taxonomy)
// 			//taxonomy.extend(taxonomies[1].taxonomy)
// 			renderGraph('#taxonomy', data, taxonomy)
// 		})
// 	})
// })
