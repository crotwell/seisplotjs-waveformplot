/*global window*/
/**
 * Philip Crotwell
 * University of South Carolina, 2014
 * http://www.seis.sc.edu
 */

import * as d3 from 'd3';
import * as miniseed from 'seisplotjs-miniseed';

/* re-export */
export { miniseed , d3 };

/** create seismogram plots by selecting elements using the supplied
  * css selector. Each element is expected to have attributes defined
  * for net, sta, loc, chan and two of start, end and duration.
  * Optionally, end will default to NOW if neither start or end are
  * given, so only giving duration shows the most recent duration seconds
  * from current time. Optionally, host may be given to choose an Fdsn
  * FDSN dataselect web service for data retrieval, which defaults to
  * service.iris.edu.
  *
  * Note that css style for the selector should set both stoke to a color
  * and fill to none in order for the seismogram to display. 
  * This can be done by: <br>
  * yourselector {
  *   stroke: skyblue;
  *   fill: none;
  * }<br/>
  */
export function createPlotsBySelector(selector) {
  let clockOffset = 0; // should set from server
  d3.selectAll(selector).each(function(d) {
    let svgParent = d3.select(this);
    let net = svgParent.attr("net");
    let sta = svgParent.attr("sta");
    let loc = svgParent.attr("loc");
    let chan = svgParent.attr("chan");
    let start = svgParent.attr("start");
    let end = svgParent.attr("end");
    let duration = svgParent.attr("duration");
    let host = svgParent.attr("host");
    let protocol = 'http:';
    if (! host) {
        host = "service.iris.edu";
    }
    if ("https:" == document.location.protocol) {
      protocol = 'https:'
    }

    let seisDates = calcStartEndDates(start, end, duration, clockOffset);
    let startDate = seisDates.startDate;
    let endDate = seisDates.endDate;

    let url = formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate);
    loadParseSplitUrl(url,
        function(error, segments) {
            if (error) {
                console.log("error loading data: "+error);
            } else {
                let seismogram = new chart(svgParent, segments, startDate, endDate);
                seismogram.draw();
                //seismogram.enableDrag();
                // seismogram.enableZoom();
            }
        });
  });
}

export function calcClockOffset(serverTime) {
  return new Date().getTime() - serverTime.getTime();
}

/** 
Any two of start, end and duration can be specified, or just duration which
then assumes end is now.
start and end are Date objects, duration is in seconds.
clockOffset is the milliseconds that should be subtracted from the local time
 to get real world time, ie local - UTC 
 or new Date().getTime() - serverDate.getTime()
 default is zero.
*/
export function calcStartEndDates(start, end, duration, clockOffset) {
  let startDate;
  let endDate;
  if (clockOffset === undefined) {
    clockOffset = 0;
  }
  if (start && end) {
    startDate = new Date(start);
    endDate = new Date(end);
  } else if (start && duration) {
    startDate = new Date(start);
    endDate = new Date(startDate.getTime()+parseFloat(duration)*1000);
  } else if (end && duration) {
    endDate = new Date(end);
    startDate = new Date(endDate.getTime()-parseFloat(duration)*1000);
  } else if (duration) {
    endDate = new Date(new Date().getTime()-clockOffset);
    startDate = new Date(endDate.getTime()-parseFloat(duration)*1000);
  } else {
    throw "need some combination of start, end and duration";
  }
  return { "startDate": startDate, "endDate": endDate };
}

export function formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate) {
  let isoStart = startDate.toISOString();
  isoStart = isoStart.substring(0, isoStart.lastIndexOf('.'));
  let isoEnd = endDate.toISOString();
  isoEnd = isoEnd.substring(0, isoEnd.lastIndexOf('.'));
  let url = url=protocol+"//"+host+"/fdsnws/dataselect/1/query?net="+escape(net)+"&sta="+escape(sta)+"&loc="+escape(loc)+"&cha="+escape(chan)+"&start="+isoStart+"&end="+isoEnd;
  return url;
}

export function loadParseSplit(protocol, host, net, sta, loc, chan, startDate, endDate, callback) {
  let url = formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate);
  loadParseSplitUrl(url, callback);
}


/** loads and parses data into an array of miniseed records */
export function loadParse(url, callback) {
  d3.request(url)
    .mimeType("application/vnd.fdsn.mseed")
    .responseType("arraybuffer")
    .get(null,
        function(error, data) {
          if (error) {
            callback(error, null);
          } else {
            let dataRecords = miniseed.parseDataRecords(data.response);
            callback(null, dataRecords);
          }
        });
}

export function loadParseSplitUrl(url, callback) {
  loadParse(url, function(error, dataRecords) {
      if (error) {
        callback(error, null);
      } else {
        let byChannel = miniseed.byChannel(dataRecords);
        let keys = Object.keys(byChannel);
        let segments = [];
        for(let i=0; i<keys.length; i++) {
          let key = keys[i];
          segments[i] = miniseed.merge(byChannel[key]);
        }
        callback(null, segments);
      }
  });
}

/* segments is an array of arrays of DataRecords
*/
export function calcDataStartEnd(segments) {
    if (segments.length === 0) {
      return null;
    }
    let dataStart = segments[0][0].start;
    let dataEnd = segments[0][0].end;
    for (let plotNum=0; plotNum < segments.length; plotNum++) {
      for (let drNum = 0; drNum < segments[plotNum].length; drNum++) {
        let record = segments[plotNum][drNum];
        let s = record.start;
        let e = record.end;
        if ( s < dataStart) {
          dataStart = s;
        }
        if ( dataEnd < e) {
          dataEnd = e;
        }
      }
    }
    return { start: dataStart, end: dataEnd };
  }
 
/** A seismogram plot, using d3. Note that you must have
  * stroke and fill set in css like:<br>
  * path.seispath {
  *   stroke: skyblue;
  *   fill: none;
  * }<br/>
  * in order to have the seismogram display. 
  */
export class chart {
  constructor(inSvgParent, inSegments, plotStartDate, plotEndDate) {
    this.throttleResize = true;
    this.plotStart = plotStartDate;
    this.plotEnd = plotEndDate;
        
    let styleWidth = parseInt(inSvgParent.style("width")) ;
    let styleHeight = parseInt(inSvgParent.style("height")) ;
    if (styleWidth == 0) { styleWidth = 50;}
    if (styleHeight == 0) { styleHeight = 100;}

    // d3 margin convention, see http://bl.ocks.org/mbostock/3019563
    this.margin = {top: 20, right: 20, bottom: 40, left: 75};
    this.outerWidth = styleWidth;
    this.outerHeight = styleHeight;
    this.width = this.outerWidth - this.margin.left - this.margin.right;
    this.height = this.outerHeight - this.margin.top - this.margin.bottom;
    // d3 margin convention, see http://bl.ocks.org/mbostock/3019563
    
    this.segments = inSegments;
    this.svgParent;
    this.xScale;
    this.yScale;
    this.xAxis;
    this.yAxis;
    this.xLabel = "Time";
    this.xSublabel = "";
    this.yLabel = "Amplitude";
    this.ySublabel = "";
    this.plotUUID = guid();
    this.clipPathId = "clippath_"+this.plotUUID;
    this.svgParent = inSvgParent;
        
    if (this.segments.length > 0) {
      if( ! this.plotStart ) {
        this.plotStart = this.segments[0][0].start;
      }
      if( ! this.plotEnd) {
        // fix this????
        this.plotEnd = this.segments[0][0].end;
      }
    } else {
      console.log("WARNING segments is length 0");
    }
    //  fix this....
    //  addResizeHandler(resize);
  }

  enableZoom() {
    console.log("enableZoom does not work yet");
    let zoomed = function() {
      console.log("zooming, or we should be at least...");
      this.svgParent.select('svg').attr("transform", d3.event.transform);
      this.svgParent.select('.x.axis').call(this.xAxis.scale(d3.event.transform.rescaleX(this.xScale)));
      //gY.call(yAxis.scale(d3.event.transform.rescaleY(y)));
    };
    let zoom = d3.zoom().on('zoom', zoomed);
    this.svgParent.select('svg').call(zoom);
  }

  enableDrag() {
    console.log("enableDrag does not work yet");
    let myThis = this;
    let drag = d3.behavior.drag()
                          .origin(function() {
                             return {x: 0, y: 0};
                          })
                          .on("drag", function() {
                             return myThis.dragmove.call(myThis);
                          });
    let svgP = this.svgParent;
    let svg = svgP.select("svg");
    let svgG = svg.select("g");
    let clickPane = svgG.select("rect.graphClickPane");
    clickPane.call(drag);
  }
    
  append(key, segment) {
    console.log("append doesnot work...");
    this.segments.push(segment);
  }
    
  dragmove() {
    d3.event.sourceEvent.stopPropagation(); // silence other listeners
    let rectWidth = this.width;

    let pStart = this.plotStart;
    let pEnd = this.plotEnd;
    let timeWidth = pEnd - pStart;
    let timeShift = Math.round(timeWidth*d3.event.dx/rectWidth);
    let zStart =  new Date(pStart.getTime() - timeShift);
    let zEnd = new Date(pEnd.getTime() - timeShift);
    this.setPlotStart(zStart);
    this.setPlotEnd(zEnd);

  }

  resize() {
    /*
     * This only works if added to the window, see addResizeHandler in crocusplot.js
     */

    let svgP = this.svgParent;
    let svg = svgP.select("svg");
    svg.classed("waveformPlotSVG", true);
    let svgG = svg.select("g");
    
    let styleWidth = parseInt(svgP.style("width")) ;
    let styleHeight = parseInt(svgP.style("height")) ;
    this.setWidthHeight(svg, styleWidth, styleHeight);

    /* Update the range of the scale with new width/height */
    this.xScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
        
    /* Update the axis with the new scale */
    svgG.select('.x.axis')
        .attr("transform",  "translate(0," + (this.height ) + " )")
        .call(this.xAxis);

    svgG.selectAll('.y.axis')
        .call(this.yAxis);

    svg.select('g.xLabel')
       .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight  - 6)+")");
            
    svg.select('g.yLabel')
       .attr("transform", "translate(0, "+(this.margin.top+(this.height)/2)+")");
            

    svg.select('#'+this.clipPathId).select("rect")
       .attr("width", this.width)
       .attr("height", this.height);
        
    svgG.select("rect.graphClickPane")
        .attr("width", this.width)
        .attr("height", this.height);
        
    /* Force D3 to recalculate and update the line segments*/
    for (let plotNum=0; plotNum < this.segments.length; plotNum++) {
      for (let drNum = 0; drNum < this.segments[plotNum].length; drNum++) { 
        svgG.select('#'+this.segments[plotNum][drNum].seisId()+'_'+this.plotUUID)
            .attr("d", this.createLineFunction(this.segments[plotNum][drNum], this.xScale, this.yScale));
      }
    }
  }

  getXScale() {
    return this.xScale;
  }
  getYScale() {
    return this.yScale;
  }
  getResizeFunction() {
    return this.resize;
  }
    
  createLineFunction(segment, in_xScale, in_yScale) {
    let seg = segment;
    let xScale = in_xScale;
    let yScale = in_yScale;
    return d3.line()
      .x(function(d, i) {
        return xScale(seg.timeOfSample(i));
      }).y(function(d) {
        return yScale(d);
      }).curve(d3.curveLinear)(seg); // call the d3 function created by line with data
       // }).interpolate("linear")(seg); // call the d3 function created by line with data
  }

    
  draw() {
    let minAmp = 2 << 24;
    let maxAmp = -1 * (minAmp);
    let s;
    let e;
    let record;
    let n;
    let startEnd = calcDataStartEnd(this.segments);
    if (this.segments.length > 0) {
      if( ! this.plotStart) {
        this.plotStart = startEnd.start;
      }
      if( ! this.plotEnd) {
        this.plotEnd = startEnd.end;
      }
    } else {
      console.log("WARN: segments length 0");
    }
    for (let plotNum=0; plotNum < this.segments.length; plotNum++) {
      for (let drNum = 0; drNum < this.segments[plotNum].length; drNum++) {
        record = this.segments[plotNum][drNum];
        s = record.start;
        e = record.end;
        for (n = 0; n < record.length; n++) {
          if (minAmp > record[n]) {
            minAmp = record[n];
          }
          if (maxAmp < record[n]) {
            maxAmp = record[n];
          }
        }
      }
    }
    this.outerWidth = parseInt(this.svgParent.style("width")) ;
    this.outerHeight = parseInt(this.svgParent.style("height")) ;
    let svg = this.svgParent.append("svg");
    this.setWidthHeight(svg, this.outerWidth, this.outerHeight);

    this.svgG = svg
        .append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
        

    this.svgG.append("defs").append("clipPath").attr("id", this.clipPathId)
        .append("rect")
        .attr("width", this.width)
        .attr("height", this.height);
    this.xScale = d3.scaleUtc().domain([ this.plotStart, this.plotEnd ])
        .range([ 0, this.width ])
        .nice();
    this.yScale = d3.scaleLinear().domain([ minAmp, maxAmp ])
        .range([ this.height, 0 ])
        .nice();
    this.xAxis = d3.axisBottom().scale(this.xScale).ticks(5);

    this.yAxis = d3.axisLeft().scale(this.yScale).ticks(5);
        
    this.svgG.append("g").classed("x axis", true)
        .attr("transform",  "translate(0," + (this.height ) + " )")
        .call(this.xAxis);
    this.svgG.append("g").classed("y axis", true).call(this.yAxis);
    let dataSvgG = this.svgG.append("g").classed("seisdata", true).attr("clip-path", "url("+this.clipPathId+")");
        
        
    let insidePlotUUID = this.plotUUID;
    let insideCreateLineFunction = this.createLineFunction;
    let xScale = this.xScale;
    let yScale = this.yScale;
    let seisG = dataSvgG.selectAll("g").data(this.segments).enter().append("g").attr("id", function(d) {return d[0].seisId();});
    seisG.selectAll("path").data(function(d) {return d;})
        .enter().append("path")
        .classed("seispath", true)
//        .style("fill", "none")
//        .style("stroke", "black")
//        .style("stroke-width", "1px")
        .attr("id", function(d) { return d.seisId()+'_'+insidePlotUUID;})
        .attr("d", function(d) {return insideCreateLineFunction(d, xScale, yScale);});
        
    /*
    let seismogram = svgG.append("g").attr("class", "seismogram").attr("clip-path", "url(#"+clipPathId+")");
    
    let seisLine = seismogram.selectAll("path").data(segments, function(d) {return d.seisId();});
    seisLine.enter().append("path")
        .attr("id", function(d) {return d.seisId()+'_'+plotUUID})
        .attr("d", function(d) {return createLineFunction(d)});
    seisLine.exit().remove();
    */
    svg.append("g")
       .classed("xLabel", true)
       .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight  - 6)+")")
       .append("text").classed("x label", true)
       .attr("text-anchor", "middle")
       .text(this.xLabel);
    svg.append("g")
       .classed("yLabel", true)
       .attr("x", 0)
       .attr("transform", "translate(0, "+(this.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label", true)
       .attr("text-anchor", "middle")
       .attr("dy", ".75em")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)")
       .text(this.yLabel);
    this.svgG.append("rect").classed("graphClickPane", true)
        .attr("fill", "none")
        .attr("width", this.width)
        .attr("height", this.height);
    this.resize();
  }

  setWidthHeight(svg, nOuterWidth, nOuterHeight) {
    this.outerWidth = Math.max(200, nOuterWidth);
    this.outerHeight = Math.max(100, nOuterHeight);
    this.height = this.outerHeight - this.margin.top - this.margin.bottom;
    this.width = this.outerWidth - this.margin.left - this.margin.right;
    svg.attr("width", this.outerWidth)
      .attr("height", this.outerHeight);
  }
    

  // see http://blog.kevinchisholm.com/javascript/javascript-function-throttling/
  throttle(func, delay){
    if (this.throttleResize) {
      window.clearTimeout(this.throttleResize);
    }
    this.throttleResize = window.setTimeout(func, delay);
  }
    
  resizeNeeded() {
    let myThis = this;
    this.throttle(function(){
        myThis.resize();
    }, 250);
  }

  setPlotStart(value) {
    this.plotStart = value;
    this.xScale.domain([ this.plotStart, this.plotEnd ]);
    this.resizeNeeded();
    return this;
  }
  setPlotEnd(value) {
    this.plotEnd = value;
    this.xScale.domain([ this.plotStart, this.plotEnd ]);
    this.resizeNeeded();
    return this;
  }
  setPlotStartEnd(startDate, endDate) {
    this.plotStart = startDate;
    this.plotEnd = endDate;
    this.xScale.domain([ this.plotStart, this.plotEnd ]);
    this.resizeNeeded();
    return this;
  }
    
  setWidth(value) {
    if (!arguments.length)
      return this.width;
    this.width = value;
    return this;
  }

  setHeight(value) {
    if (!arguments.length)
      return this.height;
    this.height = value;
    return this;
  }

  setMargin(value) {
    if (!arguments.length)
      return this.margin;
    this.margin = value;
    return this;
  }
  setXLabel(value) {
    if (!arguments.length)
      return this.xLabel;
    this.xLabel = value;
    return this;
  }
  setYLabel(value) {
    if (!arguments.length)
      return this.yLabel;
    this.yLabel = value;
    return this;
  }
  setXSublabel(value) {
    if (!arguments.length)
      return this.xSublabel;
    this.xSublabel = value;
    return this;
  }
  setYSublabel(value) {
    if (!arguments.length)
      return this.ySublabel;
    this.ySublabel = value;
    return this;
  }
}


/*
 * from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
 */
let s4 = function() {
  return Math.floor((1 + Math.random()) * 0x10000)
                 .toString(16)
                 .substring(1);
};
let guid = function() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
};
